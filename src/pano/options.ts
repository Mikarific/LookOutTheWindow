import * as IRF from 'internet-roadtrip-framework';

import { createEffect, createSignal } from 'solid-js';
import * as THREE from 'three';

let offset = 0;
let perspectiveCamera: THREE.PerspectiveCamera;

export const [getOptionsRotation, setOptionsRotation] = createSignal(
	(GM_getValue('optionsRotation') as boolean) ?? true,
);
createEffect(() => {
	GM_setValue('optionsRotation', getOptionsRotation());
	if (!getOptionsRotation()) offset = 0;
	if (getOptionsRotation() && perspectiveCamera) offset = THREE.MathUtils.radToDeg(perspectiveCamera.rotation.y);
	document.querySelectorAll('.option').forEach(async (option: HTMLDivElement, index) => {
		option.style.rotate = `${(await IRF.vdom.options).methods.getRotation(index)}deg`;
	});
});

export function updateOptions(camera: THREE.PerspectiveCamera) {
	if (getOptionsRotation()) {
		perspectiveCamera = camera;
		offset = THREE.MathUtils.radToDeg(camera.rotation.y);
		document.querySelectorAll('.option').forEach(async (option: HTMLDivElement, index) => {
			option.style.rotate = `${(await IRF.vdom.options).methods.getRotation(index)}deg`;
		});
	}
}

IRF.vdom.options.then((vOptions) => {
	vOptions.state.getRotation = new Proxy(vOptions.methods.getRotation, {
		apply: (target, thisArg, args) => {
			// Multiplication by 1.25 offsets the vanilla game's multiplication by 0.8.
			// This way, the arrows actually point towards the road they correspond to.
			const angle = Reflect.apply(target, thisArg, args) * 1.25;
			return angle + offset;
		},
	});
});
