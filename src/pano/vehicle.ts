import { createEffect, createSignal } from 'solid-js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export const [getVehicle, setVehicle] = createSignal((GM_getValue('vehicle') as boolean) ?? true);

export function createVehicle(scene: THREE.Scene) {
	const gltfLoader = new GLTFLoader();
	gltfLoader
		.loadAsync('https://cloudy.netux.site/neal_internet_roadtrip/vehicle/model.glb')
		.then(({ scene: vehicleObject }) => {
			vehicleObject.position.y = -1;
			vehicleObject.position.x = 0.3;
			vehicleObject.rotation.y = THREE.MathUtils.degToRad(90);
			vehicleObject.getObjectByName('steering_wheel')!.visible = false;

			vehicleObject.traverse((child) => {
				if (child instanceof THREE.Mesh) child.renderOrder = 2;
			});

			scene.add(vehicleObject);

			createEffect(() => {
				const vehicle = getVehicle();
				vehicleObject.visible = vehicle;
				GM_setValue('vehicle', getVehicle());
			});
		});
}
