import * as THREE from 'three';

import { GM_fetch } from './utils';

export enum PanoramaType {
	OFFICIAL = 2,
	UNOFFICIAL = 10,
}

export type Panorama = {
	type: PanoramaType;
	id: string;
};

export enum RenderOrder {
	OLD_PANO = 0,
	NEW_PANO = 1,
	VEHICLE = 2,
}

let oldPano: THREE.Group | THREE.Mesh | null = null;
let newPano: THREE.Group | THREE.Mesh | null = null;
let panoFadeTime = performance.now();
const FADE_DURATION = 300;

function fadeOutPano(scene: THREE.Scene) {
	if (oldPano !== null) scene.remove(oldPano);
	oldPano = newPano;
	newPano = null;
	if (oldPano instanceof THREE.Group) {
		oldPano.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				child.renderOrder = RenderOrder.OLD_PANO;
			}
		});
	} else if (oldPano instanceof THREE.Mesh) {
		oldPano.renderOrder = RenderOrder.OLD_PANO;
	}
}

export function animatePano(scene: THREE.Scene) {
	if (newPano !== null) {
		const now = performance.now();
		const elapsed = now - panoFadeTime;
		const t = Math.min(elapsed / FADE_DURATION, 1);

		if (newPano instanceof THREE.Group) {
			newPano.traverse((child) => {
				if (child instanceof THREE.Mesh) child.material.opacity = t;
			});
		} else if (newPano instanceof THREE.Mesh) {
			(newPano.material as THREE.Material[]).forEach((material) => (material.opacity = t));
		}

		if (t >= 1) fadeOutPano(scene);
	}
}

export function removeOldPanos(scene: THREE.Scene) {
	for (let i = scene.children.length - 1; i >= 0; i--) {
		if (scene.children[i].name === 'panorama' && scene.children[i] !== newPano && scene.children[i] !== oldPano) {
			scene.remove(scene.children[i]);
		}
	}

	const now = performance.now();
	const elapsed = now - panoFadeTime;
	const t = Math.min(elapsed / FADE_DURATION, 1);
	if (t >= 1) fadeOutPano(scene);
}

export function decodePanoId(panoId: string): Panorama {
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
export function encodePanoId(pano: Panorama) {
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

const envCanvas = document.createElement('canvas');
const envContext = envCanvas.getContext('2d')!;

const envTexture = new THREE.CanvasTexture(envCanvas);
envTexture.mapping = THREE.EquirectangularReflectionMapping;
envTexture.colorSpace = THREE.SRGBColorSpace;

function setSceneEnvironment(
	meta: PanoMetadata,
	scene: THREE.Scene,
	pmremGenerator: THREE.PMREMGenerator,
	heading: number,
) {
	// TODO: Allow different environment quality levels (requires stitching multiple tiles together)

	// The environment doesn't need to be high quality,
	// so get the entire panorama as a single tile by using zoom level 0
	const { cropWidth, cropHeight } = meta.zoomLevels[0];

	envCanvas.width = cropWidth;
	envCanvas.height = cropHeight;

	// Get amount of pixels to shift by to simulate a yaw turn according to meta.heading
	// so that the environment actually faces the direction we're driving.
	const shift = Math.floor((((360 + (90 - meta.heading) + heading) % 360) / 360) * cropWidth);

	const image = new Image();
	image.crossOrigin = 'anonymous';
	image.src = getTileUrl(meta.pano, 0, 0, 0);
	image.onerror = console.error;

	image.onload = () => {
		envContext.clearRect(0, 0, cropWidth, cropHeight);

		// The image is drawn twice here in order to accomodate the yaw shift.
		// Once from the shifted point to the end of the canvas...
		envContext.drawImage(image, shift, 0, cropWidth - shift, cropHeight, 0, 0, cropWidth - shift, cropHeight);
		// and again from the start of the canvas to the shift point.
		envContext.drawImage(image, 0, 0, shift, cropHeight, cropWidth - shift, 0, shift, cropHeight);
		// This approach isn't perfect, the environment isn't going to correct for pitch and roll.
		// But it doesn't have to be, the environment is only used for lighting and reflections.

		envTexture.needsUpdate = true;

		const envMap = pmremGenerator.fromEquirectangular(envTexture).texture;
		scene.environment = envMap;
	};
}

const TAU = 2 * Math.PI;
const geometryCache = {};

type PanoMetadata = NonNullable<Awaited<ReturnType<typeof getPanoMetadataFromId>>>;
export async function renderPanoFromMetadata(
	meta: PanoMetadata,
	scene: THREE.Scene,
	pmremGenerator: THREE.PMREMGenerator,
	heading: number,
	maxZoom: number,
): Promise<THREE.Group<THREE.Object3DEventMap>> {
	return new Promise((resolve, reject) => {
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
			setSceneEnvironment(meta, scene, pmremGenerator, heading);
			resolve(panorama);
		};
		loadingManager.onError = (url) => {
			console.error(`Couldn't load tile: ${url}`);
			reject(`Couldn't load tile: ${url}`);
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

				// Often, two panoramas will load after each other with the same zoom level and cropWidth/cropHeight.
				// If this is the case, we don't need to recalculate the SphereGeometry, as we've already done that work.
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
					side: THREE.FrontSide,
					transparent: true,
					depthWrite: false,
					opacity: 0,
				});
				const tile = new THREE.Mesh(geometry, material);
				tile.renderOrder = RenderOrder.NEW_PANO;
				panorama.add(tile);
			}
		}
	});
}

const errCanvas = document.createElement('canvas');
const errContext = errCanvas.getContext('2d')!;
errCanvas.width = 1024;
errCanvas.height = 1024;

const errTexture = new THREE.CanvasTexture(errCanvas);
errTexture.colorSpace = THREE.SRGBColorSpace;

const errorPanoGeometry = new THREE.BoxGeometry(999, 999, 999);
errorPanoGeometry.scale(1, 1, -1);

export function renderErrorPano(pano: Panorama | string, scene: THREE.Scene) {
	if (typeof pano === 'string') pano = decodePanoId(pano);

	errContext.clearRect(0, 0, errCanvas.width, errCanvas.height);
	errContext.fillStyle = '#be0039';
	errContext.fillRect(0, 0, errCanvas.width, errCanvas.height);
	errContext.lineWidth = 16;
	errContext.strokeStyle = '#6d001a';
	errContext.strokeRect(0, 0, errCanvas.width, errCanvas.height);

	errContext.fillStyle = 'white';
	errContext.textAlign = 'center';
	errContext.textBaseline = 'middle';

	errContext.font = 'bold 60px sans-serif';
	errContext.fillText(`Failed to load panorama.`, errCanvas.width / 2, errCanvas.height / 2 - 40);

	errContext.font = 'bold 30px sans-serif';
	errContext.fillText(`Send a screenshot to Mika if you see this.`, errCanvas.width / 2, errCanvas.height / 2 + 20);

	errContext.font = 'bold 15px monospace';
	errContext.fillText(`Type: ${pano.type}; ID: ${pano.id}`, errCanvas.width / 2, errCanvas.height / 2 + 55);

	errTexture.needsUpdate = true;

	const materials = Array(6).fill(
		new THREE.MeshBasicMaterial({
			map: errTexture,
			side: THREE.FrontSide,
			transparent: true,
			depthWrite: false,
			opacity: 0,
		}),
	);

	const panorama = new THREE.Mesh(errorPanoGeometry, materials);
	panorama.renderOrder = RenderOrder.NEW_PANO;

	newPano = panorama;
	scene.add(panorama);
	panoFadeTime = performance.now();
	return panorama;
}
