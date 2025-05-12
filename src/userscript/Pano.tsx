import { onCleanup, onMount } from 'solid-js';
import styles from './index.module.css';
import * as three from 'three';
import { effect } from 'solid-js/web';
import { store } from './store';

// TODO(netux): these change depending on the pano!
const TILES_SIZE = 256;
const TILES_ZOOM = 3;
const TILES_MAX_X = 7;
const TILES_MAX_Y = 3;

async function loadTile(
  panoId: string,
  x: number,
  y: number,
): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const tileImage = new Image();
    tileImage.crossOrigin = 'anonymous';

    tileImage.onload = () => resolve(tileImage);

    const searchParams = new URLSearchParams({
      cb_client: 'apiv3',
      panoid: panoId,
      output: 'tile', // doesn't seem to do anything?
      x: x.toString(),
      y: y.toString(),
      zoom: TILES_ZOOM.toString(),
      nbt: '1', // no_black_tiles (bool): 0 makes the API return a black square instead of an error when asking for coordinates out of bounds
      fover: '2', // "zoom_failover" (int32)
    });

    tileImage.src = `https://streetviewpixels-pa.googleapis.com/v1/tile?${searchParams.toString()}`;
  });
}

const SKYBOX_RADIUS = 500;
const SKYBOX_RESOLUTION = 64;

export function Pano() {
  const scene = new three.Scene();

  const camera = new three.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 0, 1);

  const renderer = new three.WebGLRenderer({ antialias: true });
  const rerender = () => renderer.render(scene, camera);

  // TODO(netux): figure out how to import OrbitControls as an IIFE module from three/addons
  // const controls = new OrbitControls(camera, renderer.domElement);
  // controls.enablePan = true;
  // controls.enableZoom = false;

  const panoCanvasCtx = document.createElement('canvas').getContext('2d')!;

  function createSkyMesh() {
    const sphereGeo = new three.SphereGeometry(
      SKYBOX_RADIUS,
      SKYBOX_RESOLUTION,
      SKYBOX_RESOLUTION,
    );
    sphereGeo.scale(
      /* x: */ -1, // make sphere inside-out, so its texture is seen from the inside only
      /* y: */ 1,
      /* z: */ 1,
    );

    const skyTexture = new three.CanvasTexture(
      panoCanvasCtx.canvas,
      /* mapping: */ three.EquirectangularReflectionMapping,
    );
    return new three.Mesh(
      sphereGeo,
      new three.MeshBasicMaterial({ map: skyTexture }),
    );
  }

  const skyMesh = createSkyMesh();
  scene.add(skyMesh);

  async function renderCurrentPano() {
    if (store.currentPano == null) {
      return;
    }

    panoCanvasCtx.canvas.width = TILES_SIZE * TILES_MAX_X;
    panoCanvasCtx.canvas.height = TILES_SIZE * TILES_MAX_Y;

    interface LoadedTileData {
      image: HTMLImageElement;
      x: number;
      y: number;
    }

    const loadedTilePromises: Promise<LoadedTileData>[] = [];
    for (let y = 0; y < TILES_MAX_Y; y++) {
      for (let x = 0; x < TILES_MAX_X; x++) {
        loadedTilePromises.push(
          loadTile(store.currentPano, x, y).then((image) => ({ image, x, y })),
        );
      }
    }

    // TODO(netux): @Mikarific fix pano image issues
    // See https://discord.com/channels/1370059928185864242/1370073711549350039/1371287295763681283

    for (const { image, x, y } of await Promise.all(loadedTilePromises)) {
      panoCanvasCtx.drawImage(
        image,
        x * TILES_SIZE,
        y * TILES_SIZE,
        TILES_SIZE,
        TILES_SIZE,
      );
    }

    skyMesh.material.map!.needsUpdate = true;
    skyMesh.scale.y = panoCanvasCtx.canvas.height / panoCanvasCtx.canvas.width; // squish vertically to adjust to the aspect ratio of the equirectangular texture

    rerender();
  }
  effect(renderCurrentPano);

  effect(() => {
    skyMesh.rotation.y = store.currentHeading;

    rerender();
  });

  const handleWindowResize = () => {
    camera.aspect = renderer.domElement.width / renderer.domElement.height;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    renderCurrentPano();
  };
  handleWindowResize();

  onMount(() => {
    window.addEventListener('resize', handleWindowResize);
  });

  onCleanup(() => {
    window.removeEventListener('resize', handleWindowResize);
  });

  renderer.domElement.classList.add(styles.pano);

  return renderer.domElement;
}
