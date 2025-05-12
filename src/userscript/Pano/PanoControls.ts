import * as THREE from 'three';

export class PanoControls extends EventTarget {
  public camera: THREE.PerspectiveCamera;
  public domElement: HTMLElement;

  public rotateSpeed = 0.15;
  public zoomSpeed: number = 0.05;
  public zoomClamp: [min: number, max: number] = [10, 75];

  private rotateStartCoords: {
    mouseX: number;
    mouseY: number;
    lon: number;
    lat: number;
  } | null = null;

  public get isRotating() {
    return this.rotateStartCoords != null;
  }

  public lat: number;
  public lon: number;

  private initialFov: number;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    super();

    this.camera = camera;
    this.domElement = domElement;

    this.initialFov = this.camera.fov;
    this.initializeCoords();

    this.domElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });

    this.domElement.addEventListener('pointerdown', (event) => {
      this.rotateStartCoords = {
        mouseX: event.clientX,
        mouseY: event.clientY,
        lat: this.lat,
        lon: this.lon,
      };

      this.dispatchEvent(new Event('rotationStart'));
    });

    this.domElement.addEventListener('pointermove', (event) => {
      if (!this.rotateStartCoords) {
        return;
      }

      const rotationZoomDamping = this.camera.fov / this.initialFov;
      const speed = this.rotateSpeed * rotationZoomDamping;

      this.lon =
        (this.rotateStartCoords.mouseX - event.clientX) * speed +
        this.rotateStartCoords.lon;
      this.lat =
        (event.clientY - this.rotateStartCoords.mouseY) * speed +
        this.rotateStartCoords.lat;

      this.update();
    });

    const endRotation = () => {
      const wasRotating = this.isRotating;
      this.rotateStartCoords = null;

      if (wasRotating) {
        this.dispatchEvent(new Event('rotationEnd'));
      }
    };

    this.domElement.addEventListener('pointerup', endRotation);
    this.domElement.addEventListener('pointerleave', endRotation);

    this.domElement.addEventListener('wheel', (event) => {
      const [min, max] = this.zoomClamp;

      const fov = this.camera.fov + event.deltaY * this.zoomSpeed;
      this.camera.fov = THREE.MathUtils.clamp(fov, min, max);
      this.camera.updateProjectionMatrix();

      this.dispatchEvent(new Event('zoom'));

      this.update();
    });
  }

  private initializeCoords() {
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.normalize();

    const phi = Math.acos(cameraDirection.y);
    const theta = Math.atan2(cameraDirection.z, cameraDirection.x);

    this.lat = 90 - THREE.MathUtils.radToDeg(phi);
    this.lon = THREE.MathUtils.radToDeg(theta);
  }

  update() {
    // Clamp so users cannot look too far up/down
    this.lat = Math.max(-89, Math.min(89, this.lat));

    // Stolen from https://github.com/mrdoob/three.js/blob/r147/examples/webgl_panorama_equirectangular.html#L189
    const phi = THREE.MathUtils.degToRad(90 - this.lat);
    const theta = THREE.MathUtils.degToRad(this.lon);

    const x = 500 * Math.sin(phi) * Math.cos(theta);
    const y = 500 * Math.cos(phi);
    const z = 500 * Math.sin(phi) * Math.sin(theta);

    this.camera.lookAt(x, y, z);
  }
}
