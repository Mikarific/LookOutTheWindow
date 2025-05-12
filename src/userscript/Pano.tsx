import { createSignal, onCleanup, onMount } from 'solid-js';
import styles from './index.module.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { effect } from 'solid-js/web';
import { store } from './store';
import { PanoControls } from './pano/PanoControls';
import * as streetview from './pano/streetview';

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
  camera.position.set(0, 0, 1);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(100, 100, 0);
  light.target.position.set(0, 0, 0);
  scene.add(light);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
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

    const skyTexture = new THREE.CanvasTexture(
      panoCanvasCtx.canvas,
      /* mapping: */ THREE.EquirectangularReflectionMapping,
    );
    return new THREE.Mesh(
      sphereGeo,
      new THREE.MeshBasicMaterial({ map: skyTexture }),
    );
  }

  const skyMesh = createSkyMesh();
  scene.add(skyMesh);

  const [carObject, setCarObject] = createSignal<THREE.Object3D | null>(null);

  async function renderCurrentPano() {
    if (store.currentPano == null) {
      return;
    }

    await streetview.loadAndRender(store.currentPano, panoCanvasCtx);

    skyMesh.material.map!.needsUpdate = true;
    scene.environment = skyMesh.material.map;
    // skyMesh.scale.y = panoCanvasCtx.canvas.height / panoCanvasCtx.canvas.width; // squish vertically to adjust to the aspect ratio of the equirectangular texture

    rerender();
  }
  effect(renderCurrentPano);

  effect(() => {
    const car = carObject();

    skyMesh.rotation.y = store.currentHeading;
    if (car) {
      car.rotation.y = -store.currentHeading;
    }

    rerender();
  });

  const gltfLoader = new GLTFLoader();
  gltfLoader
    .loadAsync(
      'https://cloudy.netux.site/neal_internet_roadtrip/iinvalid-3d-low-poly-model/fixed-model.glb',
    )
    .then(({ scene: carObject }) => {
      // TODO(netux): move camera instead, so we can rotate the vehicle?
      carObject.position.set(0.3, -1, 0.9);

      setCarObject(carObject);
      scene.add(carObject);
    })
    .catch((error) => {
      console.error('Could not load car :(', error);
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
