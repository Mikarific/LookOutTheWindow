import * as THREE from 'three';

import { fetch } from './utils';

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

export function renderPanoFromId(
	scene: THREE.Scene,
	pmremGenerator: THREE.PMREMGenerator,
	panoId: string,
	gameHeading: number,
	maxZoom: number,
) {
	if (panoId.startsWith('CAoS') && panoId.length > 22) {
		const matches = atob(panoId.replaceAll('-', '+').replaceAll('_', '/').replaceAll('.', '=')).match(
			/[A-Za-z0-9\-_]+$/,
		);
		panoId = matches !== null ? matches[0] : panoId;
	}
	const protobuf = panoId.startsWith('CIHM0og') || panoId.startsWith('AF1Qip') || panoId.length > 22;
	fetch({
		method: 'POST',
		headers: { 'Content-Type': 'application/json+protobuf' },
		url: 'https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/GetMetadata',
		data: `[["apiv3"],["en","US"],[[[${protobuf ? 10 : 2},"${panoId}"]]],[[1,4]]]`,
		responseType: 'json',
	})
		.then((res) => {
			const meta = res.response;
			if (meta === null) {
				console.error(`Couldn't load metadata for panoId: ${panoId}`);
				renderErrorPano(scene, panoId);
				return;
			}
			// Google Maps API incantation
			const zoom = Math.min(meta[1][0][2][3][0].length - 1, maxZoom);
			const tileWidth = meta[1][0][2][3][1][0];
			const tileHeight = meta[1][0][2][3][1][1];
			const cropWidth = meta[1][0][2][3][0][zoom][0][1];
			const cropHeight = meta[1][0][2][3][0][zoom][0][0];
			const numTilesX = Math.ceil(cropWidth / tileWidth);
			const numTilesY = Math.ceil(cropHeight / tileHeight);
			const heading = meta[1][0][5][0][1].length >= 3 ? meta[1][0][5][0][1][2][0] : 0;
			const tilt = meta[1][0][5][0][1].length >= 3 ? meta[1][0][5][0][1][2][1] : 90;
			const roll = meta[1][0][5][0][1].length >= 3 ? meta[1][0][5][0][1][2][2] : 0;

			const sliceHorizontal = TAU / (cropWidth / tileWidth);
			const sliceVertical = Math.PI / (cropHeight / tileHeight);

			const panorama = new THREE.Group();
			panorama.name = 'panorama';
			panorama.rotation.order = 'YZX';
			panorama.rotation.set(
				THREE.MathUtils.degToRad((360 + roll) % 360),
				THREE.MathUtils.degToRad((360 + (90 - heading) + gameHeading) % 360),
				THREE.MathUtils.degToRad((360 + (tilt - 90)) % 360),
			);

			const loadingManager = new THREE.LoadingManager();
			loadingManager.onLoad = () => {
				newPano = panorama;
				scene.add(panorama);
				panoFadeTime = performance.now();
				setSceneEnvironment(
					scene,
					pmremGenerator,
					panoId,
					protobuf,
					meta[1][0][2][3][0][0][0][1],
					meta[1][0][2][3][0][0][0][0],
				);
			};
			loadingManager.onError = () => {
				console.error(`Couldn't load tile for panoId: ${panoId}`);
				renderErrorPano(scene, panoId);
			};

			for (let y = 0; y < numTilesY; y++) {
				for (let x = 0; x < numTilesX; x++) {
					const startX = sliceHorizontal * x;
					let widthX = sliceHorizontal;
					if (startX + widthX > 2 * Math.PI) widthX = 2 * Math.PI - startX;

					const startY = sliceVertical * y;
					let widthY = sliceVertical;
					if (startY + widthY > Math.PI) widthY = Math.PI - startY;

					const scaleX = x == numTilesX - 1 ? widthX / sliceHorizontal : 1;
					const scaleY = y == numTilesY - 1 ? widthY / sliceVertical : 1;
					const shiftY = y == numTilesY - 1 ? 1 - widthY / sliceVertical : 0;

					const key = `${startX}_${widthX}_${startY}_${widthY}`;
					if (!geometryCache[key]) {
						geometryCache[key] = new THREE.SphereGeometry(999, 32, 16, -startX, -widthX, startY, widthY);
					}

					const geometry = geometryCache[key];
					const loader = new THREE.TextureLoader(loadingManager);
					const texture = loader.load(
						protobuf ?
							`https://lh3.ggpht.com/jsapi2/a/b/c/x${x}-y${y}-z${zoom}/${panoId}`
						:	`https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv.tactile&panoid=${panoId}&x=${x}&y=${y}&zoom=${zoom}&nbt=1&fover=2`,
					);
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
		})
		.catch((err) => {
			console.error(`Couldn't load metadata for panoId: ${panoId}`, err);
			renderErrorPano(scene, panoId);
		});
}

function renderErrorPano(scene: THREE.Scene, panoId: string) {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d')!;
	canvas.width = 1024;
	canvas.height = 1024;
	ctx.fillStyle = '#be0039';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.lineWidth = 16;
	ctx.strokeStyle = '#6d001a';
	ctx.strokeRect(0, 0, canvas.width, canvas.height);
	if (panoId !== '') {
		ctx.fillStyle = 'white';
		ctx.font = 'bold 60px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(`Failed to load panorama.`, canvas.width / 2, canvas.height / 2 - 40);
		ctx.font = 'bold 30px sans-serif';
		ctx.fillText(`Send a screenshot to Mika if you see this.`, canvas.width / 2, canvas.height / 2 + 20);
		ctx.font = 'bold 15px sans-serif';
		ctx.fillText(`PanoID: ${panoId}`, canvas.width / 2, canvas.height / 2 + 55);
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	const material = new THREE.MeshBasicMaterial({
		map: texture,
		side: THREE.DoubleSide,
		transparent: true,
		depthWrite: false,
		opacity: 0,
	});
	const geometry = new THREE.BoxGeometry(999, 999, 999);
	geometry.scale(1, 1, -1);
	const materials = [material, material, material, material, material, material];
	const panorama = new THREE.Mesh(geometry, materials);
	panorama.renderOrder = 1;

	newPano = panorama;
	scene.add(panorama);
	panoFadeTime = performance.now();
}

function setSceneEnvironment(
	scene: THREE.Scene,
	pmremGenerator: THREE.PMREMGenerator,
	panoId: string,
	protobuf: boolean,
	width: number,
	height: number,
) {
	new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src =
			protobuf ?
				`https://lh3.ggpht.com/jsapi2/a/b/c/x0-y0-z0/${panoId}`
			:	`https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv.tactile&panoid=${panoId}&x=0&y=0&zoom=0&nbt=1&fover=2`;
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
