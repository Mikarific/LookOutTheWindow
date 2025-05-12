// TODO(netux): these change depending on the pano!
const TILES_SIZE = 256;
const TILES_ZOOM = 3;
const TILES_MAX_X = 7;
const TILES_MAX_Y = 3;

export async function loadTile(
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

export async function loadAndRender(
  panoId: string,
  canvasCtx: CanvasRenderingContext2D,
) {
  canvasCtx.canvas.width = TILES_SIZE * TILES_MAX_X;
  canvasCtx.canvas.height = TILES_SIZE * TILES_MAX_Y;

  interface LoadedTileData {
    image: HTMLImageElement;
    x: number;
    y: number;
  }

  const loadedTilePromises: Promise<LoadedTileData>[] = [];
  for (let y = 0; y < TILES_MAX_Y; y++) {
    for (let x = 0; x < TILES_MAX_X; x++) {
      loadedTilePromises.push(
        loadTile(panoId, x, y).then((image) => ({ image, x, y })),
      );
    }
  }

  // TODO(netux): @Mikarific fix pano image issues
  // See https://discord.com/channels/1370059928185864242/1370073711549350039/1371287295763681283

  for (const { image, x, y } of await Promise.all(loadedTilePromises)) {
    canvasCtx.drawImage(
      image,
      x * TILES_SIZE,
      y * TILES_SIZE,
      TILES_SIZE,
      TILES_SIZE,
    );
  }
}
