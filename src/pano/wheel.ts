import * as IRF from 'internet-roadtrip-framework';

import { createEffect, createSignal } from 'solid-js';
import * as THREE from 'three';

let perspectiveCamera: THREE.PerspectiveCamera;

export const [getWheelRotation, setWheelRotation] = createSignal((GM_getValue('wheelRotation') as boolean) ?? true);
createEffect(() => {
	GM_setValue('wheelRotation', getWheelRotation());
	IRF.dom.wheel.then((wheelContainer) => {
		const wheel = wheelContainer.querySelector('.wheel') as HTMLImageElement | null;
		if (wheel !== null) {
			if (!getWheelRotation()) wheel.style.rotate = '';
			if (getWheelRotation() && perspectiveCamera) {
				const offset = THREE.MathUtils.radToDeg(perspectiveCamera.rotation.y);
				wheel.style.rotate = `${offset}deg`;
			}
		}
	});
});

export function updateWheel(camera: THREE.PerspectiveCamera) {
	perspectiveCamera = camera;
	const offset = THREE.MathUtils.radToDeg(camera.rotation.y);
	IRF.dom.wheel.then((wheelContainer) => {
		const wheel = wheelContainer.querySelector('.wheel') as HTMLImageElement | null;
		if (wheel !== null && getWheelRotation()) wheel.style.rotate = `${offset}deg`;
	});
}
