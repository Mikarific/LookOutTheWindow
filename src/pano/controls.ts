import { updateOptions } from './options';
import { updateWheel } from './wheel';

let isMouseDown = false;
let previousMousePosition = { x: 0, y: 0 };

export function createControls(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
	camera.rotation.order = 'YXZ';

	canvas.addEventListener('contextmenu', (event) => {
		event.preventDefault();
	});

	canvas.addEventListener('mousedown', (event) => {
		isMouseDown = true;
		previousMousePosition = { x: event.clientX, y: event.clientY };
	});

	window.addEventListener('mouseup', () => {
		isMouseDown = false;
	});

	window.addEventListener('mousemove', async (event) => {
		if (!isMouseDown) return;

		const deltaX = event.clientX - previousMousePosition.x;
		const deltaY = event.clientY - previousMousePosition.y;

		const rotationSpeed = 0.002;

		camera.rotation.y += deltaX * rotationSpeed;
		camera.rotation.x += deltaY * rotationSpeed;
		camera.rotation.x = Math.max(Math.min(camera.rotation.x, Math.PI / 2), -Math.PI / 2);

		previousMousePosition = { x: event.clientX, y: event.clientY };

		updateOptions(camera);
		updateWheel(camera);
	});
}
