import { createSignal, onCleanup, onMount } from 'solid-js';
import styles from '../index.module.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { effect } from 'solid-js/web';
import { store } from '../store';
import { PanoControls } from './PanoControls';
import * as streetview from './streetview';

const SKYBOX_RADIUS = 500;
const SKYBOX_RESOLUTION = 64;

export function Pano() {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    /* fov: */ 75,
    /* aspect: */ window.innerWidth / window.innerHeight,
    /* near: */ 0.1,
    /* far: */ 1000,
  );
  camera.position.set(0, 0, -0.3);
  camera.rotation.y = THREE.MathUtils.degToRad(-90);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(100, 100, 0);
  light.target.position.set(0, 0, 0);
  scene.add(light);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor(0x222222);
  const rerender = () => renderer.render(scene, camera);

  const controls = new PanoControls(camera, renderer.domElement);

  const [isRotating, setIsRotating] = createSignal(false);
  controls.addEventListener('rotationStart', () => setIsRotating(true));
  controls.addEventListener('rotationEnd', () => setIsRotating(false));
  effect(() => {
    renderer.domElement.classList.toggle(styles['pano--panning'], isRotating());
  });

  const panoCanvasCtx = document.createElement('canvas').getContext('2d')!;

  function createSkyMesh() {
    const sphereGeo = new THREE.SphereGeometry(
      SKYBOX_RADIUS,
      SKYBOX_RESOLUTION,
      SKYBOX_RESOLUTION,
    );
    sphereGeo.scale(
      /* x: */ -1, // make sphere inside-out, so its texture is seen from the inside only
      /* y: */ 1,
      /* z: */ 1,
    );

    return new THREE.Mesh(
      sphereGeo,
      new THREE.MeshBasicMaterial({ opacity: 0, transparent: true }),
    );
  }
  const skyMesh = createSkyMesh();
  scene.add(skyMesh);

  async function renderCurrentPano() {
    if (store.currentPano == null) {
      return;
    }

    await streetview.loadAndRender(store.currentPano, panoCanvasCtx);

    const panoTexture = new THREE.CanvasTexture(
      panoCanvasCtx.canvas,
      /* mapping: */ THREE.EquirectangularReflectionMapping,
    );
    panoTexture.colorSpace = THREE.SRGBColorSpace;
    panoTexture.needsUpdate = true;

    skyMesh.material.opacity = 1;
    skyMesh.material.transparent = false;
    skyMesh.material.map = panoTexture;
    skyMesh.material.needsUpdate = true;

    scene.environment = panoTexture;

    skyMesh.rotation.y = store.currentHeading;

    rerender();
  }
  effect(renderCurrentPano);

  const [getVehicleObject, setVehicleObject] =
    createSignal<THREE.Object3D | null>(null);

  {
    const gltfLoader = new GLTFLoader();
    gltfLoader
      .loadAsync(
        IS_DEV
          ? `https://cloudy.netux.site/neal_internet_roadtrip/vehicle/model.glb?v=${Date.now()}`
          : 'https://cloudy.netux.site/neal_internet_roadtrip/vehicle/model.glb',
      )
      .then(({ scene: vehicleObject }) => {
        vehicleObject.position.y = -1;
        vehicleObject.getObjectByName('steering_wheel')!.visible = false;

        setVehicleObject(vehicleObject);
        scene.add(vehicleObject);
      })
      .catch((error) => {
        console.error('Could not load car :(', error);
      });
  }

  effect(() => {
    const vehicleObject = getVehicleObject();
    if (vehicleObject == null) {
      return;
    }

    vehicleObject.visible = store.settings.showVehicle;
  });

  const handleWindowResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);

    camera.aspect = renderer.domElement.width / renderer.domElement.height;
    camera.updateProjectionMatrix();

    rerender();
  };
  handleWindowResize();

  onMount(() => {
    window.addEventListener('resize', handleWindowResize);
  });

  onCleanup(() => {
    window.removeEventListener('resize', handleWindowResize);
  });

  requestAnimationFrame(function rerenderLoop() {
    rerender();
    requestAnimationFrame(rerenderLoop);
  });

  renderer.domElement.classList.add(styles.pano);

  return renderer.domElement;
}
