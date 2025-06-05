import * as IRF from 'internet-roadtrip-framework';

import { createEffect, createSignal } from 'solid-js';
import * as THREE from 'three';

import styles from '../style.module.css';

import {
	animatePano,
	getPanoMetadataFromId,
	removeOldPanos,
	renderErrorPano,
	renderPanoFromMetadata,
} from '../lib/panorama';
import { createControls } from './controls';
import { createVehicle } from './vehicle';

export const [getMaxZoom, setMaxZoom] = createSignal((GM_getValue('maxZoom') as number) ?? 3);
createEffect(() => GM_setValue('maxZoom', getMaxZoom()));

if (IRF.isInternetRoadtrip) {
	IRF.vdom.container.then((vContainer) => {
		const scene = new THREE.Scene();

		const camera = new THREE.PerspectiveCamera(
			/* fov: */ 90,
			/* aspect: */ window.innerWidth / window.innerHeight,
			/* near: */ 0.1,
			/* far: */ 1000,
		);

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.setClearColor(0x7f7f7f);
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.domElement.classList.add(styles['pano']);
		vContainer.$refs.pano0.replaceWith(renderer.domElement);
		vContainer.$refs.pano1.remove();

		const pmremGenerator = new THREE.PMREMGenerator(renderer);
		pmremGenerator.compileEquirectangularShader();

		createControls(renderer.domElement, camera);

		function animate() {
			animatePano(scene);
			renderer.render(scene, camera);
			requestAnimationFrame(animate);
		}
		animate();

		window.addEventListener('resize', () => {
			renderer.setSize(window.innerWidth, window.innerHeight);
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.render(scene, camera);
		});

		// This initializes the panorama if currentPano has been set already.
		// If it's not, it'll be set the next time getPanoUrl is called.
		// TODO: Overwrite the setter of currentPano to initialize if currentPano isn't set.
		if (vContainer.data.currentPano !== '') {
			const panoId = vContainer.data.currentPano;
			const heading = vContainer.data.currentHeading;
			getPanoMetadataFromId(panoId).then((meta) => {
				if (meta === null) return renderErrorPano(panoId, scene);
				renderPanoFromMetadata(meta, scene, pmremGenerator, heading, getMaxZoom()).catch(() => {
					renderErrorPano(meta.pano, scene);
				});
			});
		}

		createVehicle(scene);

		// This runs every time the panorama changes.
		vContainer.state.getPanoUrl = new Proxy(vContainer.methods.getPanoUrl, {
			apply: (target, thisArg, args) => {
				const panoId: string = args[0];
				const heading: number = args[1];
				getPanoMetadataFromId(panoId).then((meta) => {
					if (meta === null) return renderErrorPano(panoId, scene);
					renderPanoFromMetadata(meta, scene, pmremGenerator, heading, getMaxZoom()).catch(() => {
						renderErrorPano(meta.pano, scene);
					});
				});
				if (document.hidden) removeOldPanos(scene);
				return 'data:text/plain,';
			},
		});

		// The #pano0 and #pano1 iframes no longer exist, so this has no purpose anymore.
		vContainer.state.switchFrameOrder = () => {};
	});
}
