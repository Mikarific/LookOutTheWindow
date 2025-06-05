import * as THREE from 'three';

import { GM_fetch } from './utils';

enum PanoramaType {
	OFFICIAL = 2,
	UNOFFICIAL = 10,
}

type Panorama = {
	type: PanoramaType;
	id: string;
};

const TAU = 2 * Math.PI;
const geometryCache = {};

let oldPano: THREE.Group | THREE.Mesh | null = null;
let newPano: THREE.Group | THREE.Mesh | null = null;
let panoFadeTime = performance.now();

export function animatePano(scene: THREE.Scene) {
	scene.children
		.filter((child) => child.name === 'panorama')
		.forEach((pano) => {
			if (pano !== newPano && pano !== oldPano) scene.remove(pano);
		});

	if (newPano !== null) {
		const now = performance.now();
		const elapsed = now - panoFadeTime;
		const t = Math.min(elapsed / 300, 1);

		if (newPano instanceof THREE.Group) {
			newPano.traverse((child) => {
				if (child instanceof THREE.Mesh) {
					child.material.opacity = t;
				}
			});
		} else if (newPano instanceof THREE.Mesh) {
			(newPano.material as THREE.Material[]).forEach((material) => {
				material.opacity = t;
			});
		}

		if (t >= 1) {
			if (oldPano !== null) scene.remove(oldPano);
			oldPano = newPano;
			newPano = null;
			if (oldPano instanceof THREE.Group) {
				oldPano.traverse((child) => {
					if (child instanceof THREE.Mesh) {
						child.renderOrder = 0;
					}
				});
			} else if (oldPano instanceof THREE.Mesh) {
				oldPano.renderOrder = 0;
			}
		}
	}
}

function decodePanoId(panoId: string): Panorama {
	try {
		// Cursed Protobuf Parsing Bullshit

		// Convert potential base64 encoded protobuf panoId into a Uint8Array
		// We do it this way to avoid browser incompatibilities with Uint8Array.fromBase64
		const binary = atob(panoId.replaceAll('-', '+').replaceAll('_', '/').replaceAll('.', '='));
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}

		let index = 0;
		// Check if the first field (panorama type) is an integer
		// 0x08 is 00001000 in binary, so this checks if...
		// The field number, 00001 (1), is the first one.
		// The wire type, 000 (0), is that of a protobuf VARINT.
		// https://protobuf.dev/programming-guides/encoding/
		if (index >= bytes.length || bytes[index] !== 0x08) throw new Error('Not a protobuf panoId.');
		index++;

		const decodeVarint = () => {
			let result = 0;
			let shift = 0;
			let count = 0;
			while (index < bytes.length && count < 5) {
				const byte = bytes[index];
				index++;
				result |= (byte & 0x7f) << shift;
				if ((byte & 0x80) === 0) return result;
				shift += 7;
				count++;
			}
			return null;
		};

		// Get the type from the panoId
		const type = decodeVarint();
		if (type === null) throw new Error('Not a protobuf panoId.');

		// Check if the second field (panorama id) is a string
		// 0x12 is 00010010 in binary, so this checks if...
		// The field number, 00010 (2), is the second one.
		// The wire type, 010 (2), is that of a protobuf LEN.
		// https://protobuf.dev/programming-guides/encoding/
		if (index >= bytes.length || bytes[index] !== 0x12) throw new Error('Not a protobuf panoId.');
		index++;

		const decodeLen = () => {
			// Get the length of the panorama id string
			const length = decodeVarint();
			if (length === null) return null;

			// Check if the rest of the bytes are enough for the string
			if (index + length > bytes.length) return null;

			// Decode the string
			const strBytes = bytes.slice(index, index + length);
			try {
				return new TextDecoder().decode(strBytes);
			} catch {
				// If this catches, the string is invalid UTF-8
				return null;
			}
		};

		const id = decodeLen();
		if (id === null) throw new Error('Not a protobuf panoId.');

		return { type, id };
	} catch {
		// If this catches, the panoId is not a base64 encoded protobuf, and therefore does not include the pano type.
		// From here, we can guess the pano type from the ID.

		// Assume the panorama is official coverage unless proven otherwise.
		let type = PanoramaType.OFFICIAL;

		// If the panorama doesn't match the format of official streetview coverage, it is guaranteed to be unofficial.
		// Official panorama IDs are 22 characters long and end with a "g", "w", "A", or "Q".
		// https://reanna.neocities.org/blog/street-view-pano-ids/
		if (!/^[\w-]{21}[gwAQ]$/.test(panoId)) type = PanoramaType.UNOFFICIAL;

		return { type, id: panoId };
	}
}

// Currently unused, but might as well have it in case it's needed.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function encodePanoId(pano: Panorama) {
	// If the panorama is official, the ID does not need to be encoded.
	if (pano.type === PanoramaType.OFFICIAL) return pano.id;

	const encodeVarint = (num: number): number[] => {
		const bytes: number[] = [];
		while (num >= 0x80) {
			bytes.push((num & 0x7f) | 0x80);
			num >>>= 7;
		}
		bytes.push(num);
		return bytes;
	};

	const encodeLen = (str: string): number[] => {
		const bytes = new TextEncoder().encode(str);
		return [...encodeVarint(bytes.length), ...bytes];
	};

	// 0x08 is 00001000 in binary, so this corresponds to...
	// Field Number: 00001 (1)
	// Wire Type: 000 (0) which corresponds to VARINT
	const panoType = [0x08, ...encodeVarint(pano.type)];
	// 0x12 is 00010010 in binary, so this corresponds to...
	// Field Number: 00010 (2)
	// Wire Type: 010 (2) which corresponds to LEN
	const panoId = [0x12, ...encodeLen(pano.id)];

	// Base64 encode the new protobuf, and make it URL safe
	return btoa(String.fromCharCode(...new Uint8Array([...panoType, ...panoId])))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replaceAll('=', '.');
}

export async function getPanoMetadataFromId(panoId: string) {
	const { type, id } = decodePanoId(panoId);
	try {
		const { status, response: meta } = await GM_fetch({
			method: 'POST',
			headers: { 'Content-Type': 'application/json+protobuf' },
			url: 'https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/GetMetadata',
			// The last argument here is a list of types of data to get from the panorama ID.
			// Type 0 - ???
			// Type 1 - panorama type/id, imageWidth, imageHeight, array of cropWidth/cropHeight for each available zoom level, tileWidth, tileHeight
			// Type 2 - date the panorama was taken, month/year, multiple unknowns
			// Type 3 - copyright, and a link to an icon image of some sort?
			// Type 4 - latitude, longitude, heading, tilt, roll, a few unknowns
			// Type 5 - ???
			// Type 6 - links, each one has panorama type/id, lat/long, heading, tilt, roll, and the same unknowns as type 4
			// Type 7 - ???
			// Type 8 - ???
			// Only type 1 and type 4 are needed to be able to render a panorama image, so those are the only two I request for.
			data: `[["apiv3"],["en","US"],[[[${type},"${id}"]]],[[1,4]]]`,
			responseType: 'json',
		});
		if (status !== 200) return null;
		if (meta === null) return null;

		// Google Maps API incantation
		return {
			pano: {
				type: meta[1][0][1][0] as PanoramaType,
				id: meta[1][0][1][1] as string,
			} as Panorama,
			lat: meta[1][0][5][0][1][0][2] as number,
			lng: meta[1][0][5][0][1][0][3] as number,
			imageWidth: meta[1][0][2][2][1] as number,
			imageHeight: meta[1][0][2][2][0] as number,
			tileWidth: meta[1][0][2][3][1][1] as number,
			tileHeight: meta[1][0][2][3][1][0] as number,
			maxZoom: meta[1][0][2][3][0].length - 1,
			zoomLevels: meta[1][0][2][3][0].map((zoomLevel) => {
				return {
					cropWidth: zoomLevel[0][1],
					cropHeight: zoomLevel[0][0],
					numTilesX: Math.ceil(zoomLevel[0][1] / meta[1][0][2][3][1][1]),
					numTilesY: Math.ceil(zoomLevel[0][0] / meta[1][0][2][3][1][0]),
				};
			}) as {
				cropWidth: number;
				cropHeight: number;
				numTilesX: number;
				numTilesY: number;
			}[],
			heading: (meta[1][0][5][0][1].length >= 3 ? meta[1][0][5][0][1][2][0] : 0) as number,
			tilt: (meta[1][0][5][0][1].length >= 3 ? meta[1][0][5][0][1][2][1] : 90) as number,
			roll: (meta[1][0][5][0][1].length >= 3 ? meta[1][0][5][0][1][2][2] : 0) as number,
		};
	} catch (err) {
		console.error(err);
		return null;
	}
}

function getTileUrl(pano: Panorama, x: number, y: number, zoom: number) {
	if (pano.type === PanoramaType.OFFICIAL) {
		return `https://streetviewpixels-pa.googleapis.com/v1/tile?${new URLSearchParams({
			cb_client: 'maps_sv.tactile',
			panoid: pano.id,
			x: x.toString(),
			y: y.toString(),
			zoom: zoom.toString(),
			nbt: '1', // no_black_tiles (bool): 0 makes the API return a black square instead of an error when asking for coordinates out of bounds.
			fover: '2', // "zoom_failover" (int32)
		}).toString()}`;
	} else {
		return `https://lh3.ggpht.com/jsapi2/a/b/c/x${x}-y${y}-z${zoom}/${pano.id}`;
	}
}

type PanoMetadata = NonNullable<Awaited<ReturnType<typeof getPanoMetadataFromId>>>;
export function renderPanoFromMetadata(
	meta: PanoMetadata,
	scene: THREE.Scene,
	pmremGenerator: THREE.PMREMGenerator,
	heading: number,
	maxZoom: number,
) {
	const zoom = Math.min(meta.maxZoom, maxZoom);

	const sliceHorizontal = TAU / (meta.zoomLevels[zoom].cropWidth / meta.tileWidth);
	const sliceVertical = Math.PI / (meta.zoomLevels[zoom].cropHeight / meta.tileHeight);

	const panorama = new THREE.Group();
	panorama.name = 'panorama';
	panorama.rotation.order = 'YZX';
	panorama.rotation.set(
		THREE.MathUtils.degToRad((360 + meta.roll) % 360),
		THREE.MathUtils.degToRad((360 + (90 - meta.heading) + heading) % 360),
		THREE.MathUtils.degToRad((360 + (meta.tilt - 90)) % 360),
	);

	const loadingManager = new THREE.LoadingManager();
	loadingManager.onLoad = () => {
		newPano = panorama;
		scene.add(panorama);
		panoFadeTime = performance.now();
		setSceneEnvironment(meta.pano, scene, pmremGenerator, meta.zoomLevels[0].cropWidth, meta.zoomLevels[0].cropHeight);
	};
	loadingManager.onError = (url) => {
		console.error(`Couldn't load tile: ${url}`);
		// renderErrorPano(scene, meta.panoId);
	};

	for (let y = 0; y < meta.zoomLevels[zoom].numTilesY; y++) {
		for (let x = 0; x < meta.zoomLevels[zoom].numTilesX; x++) {
			const startX = sliceHorizontal * x;
			let widthX = sliceHorizontal;
			if (startX + widthX > 2 * Math.PI) widthX = 2 * Math.PI - startX;

			const startY = sliceVertical * y;
			let widthY = sliceVertical;
			if (startY + widthY > Math.PI) widthY = Math.PI - startY;

			const scaleX = x == meta.zoomLevels[zoom].numTilesX - 1 ? widthX / sliceHorizontal : 1;
			const scaleY = y == meta.zoomLevels[zoom].numTilesY - 1 ? widthY / sliceVertical : 1;
			const shiftY = y == meta.zoomLevels[zoom].numTilesY - 1 ? 1 - widthY / sliceVertical : 0;

			const key = `${startX}_${widthX}_${startY}_${widthY}`;
			if (!geometryCache[key]) {
				geometryCache[key] = new THREE.SphereGeometry(999, 32, 16, -startX, -widthX, startY, widthY);
			}

			const geometry = geometryCache[key];
			const loader = new THREE.TextureLoader(loadingManager);
			const texture = loader.load(getTileUrl(meta.pano, x, y, zoom));
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.matrixAutoUpdate = false;
			texture.matrix.set(scaleX, 0, 0, 0, scaleY, shiftY, 0, 0, 1);
			const material = new THREE.MeshBasicMaterial({
				map: texture,
				side: THREE.DoubleSide,
				transparent: true,
				depthWrite: false,
				opacity: 0,
			});
			const tile = new THREE.Mesh(geometry, material);
			tile.renderOrder = 1;
			panorama.add(tile);
		}
	}
}

function setSceneEnvironment(
	pano: Panorama,
	scene: THREE.Scene,
	pmremGenerator: THREE.PMREMGenerator,
	width: number,
	height: number,
) {
	new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = getTileUrl(pano, 0, 0, 0);
	}).then((image: HTMLImageElement) => {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d')!;
		const shift = Math.floor((90 / 360) * width);
		ctx.drawImage(image, shift, 0, width - shift, height, 0, 0, width - shift, height);
		ctx.drawImage(image, 0, 0, shift, height, width - shift, 0, shift, height);

		const envTexture = new THREE.CanvasTexture(canvas);
		envTexture.mapping = THREE.EquirectangularReflectionMapping;
		envTexture.colorSpace = THREE.SRGBColorSpace;
		const envMap = pmremGenerator.fromEquirectangular(envTexture).texture;
		scene.environment = envMap;
	});
}

// function renderErrorPano(scene: THREE.Scene, panoId: string) {
// 	const canvas = document.createElement('canvas');
// 	const ctx = canvas.getContext('2d')!;
// 	canvas.width = 1024;
// 	canvas.height = 1024;
// 	ctx.fillStyle = '#be0039';
// 	ctx.fillRect(0, 0, canvas.width, canvas.height);
// 	ctx.lineWidth = 16;
// 	ctx.strokeStyle = '#6d001a';
// 	ctx.strokeRect(0, 0, canvas.width, canvas.height);
// 	if (panoId !== '') {
// 		ctx.fillStyle = 'white';
// 		ctx.font = 'bold 60px sans-serif';
// 		ctx.textAlign = 'center';
// 		ctx.textBaseline = 'middle';
// 		ctx.fillText(`Failed to load panorama.`, canvas.width / 2, canvas.height / 2 - 40);
// 		ctx.font = 'bold 30px sans-serif';
// 		ctx.fillText(`Send a screenshot to Mika if you see this.`, canvas.width / 2, canvas.height / 2 + 20);
// 		ctx.font = 'bold 15px sans-serif';
// 		ctx.fillText(`PanoID: ${panoId}`, canvas.width / 2, canvas.height / 2 + 55);
// 	}

// 	const texture = new THREE.CanvasTexture(canvas);
// 	texture.colorSpace = THREE.SRGBColorSpace;
// 	const material = new THREE.MeshBasicMaterial({
// 		map: texture,
// 		side: THREE.DoubleSide,
// 		transparent: true,
// 		depthWrite: false,
// 		opacity: 0,
// 	});
// 	const geometry = new THREE.BoxGeometry(999, 999, 999);
// 	geometry.scale(1, 1, -1);
// 	const materials = [material, material, material, material, material, material];
// 	const panorama = new THREE.Mesh(geometry, materials);
// 	panorama.renderOrder = 1;

// 	newPano = panorama;
// 	scene.add(panorama);
// 	panoFadeTime = performance.now();
// }
