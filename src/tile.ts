import L from "leaflet";
import { Photo } from "./database";

export const boundaries = 3;
export const tileSize = 256;
export const drawTile = async ({
  canvasElement,
  album,
  map,
}: {
  canvasElement: HTMLCanvasElement;
  album: Photo[];
  map: L.Map;
}) => {
  const bufferCanvasElement = document.createElement("canvas");
  bufferCanvasElement.width = canvasElement.width;
  bufferCanvasElement.height = canvasElement.height;
  const bufferCanvasContext = bufferCanvasElement.getContext("2d");
  if (!bufferCanvasContext) {
    throw new Error("Failed to get canvas context");
  }
  bufferCanvasContext.imageSmoothingEnabled = true;
  bufferCanvasContext.imageSmoothingQuality = "high";

  const mapResponse = await fetch(
    // @ts-expect-error
    `https://tile.openstreetmap.jp/styles/maptiler-basic-ja/${canvasElement.coords.z}/${canvasElement.coords.x}/${canvasElement.coords.y}@2x.png`
  );
  if (mapResponse.ok) {
    bufferCanvasContext.drawImage(
      await createImageBitmap(await mapResponse.blob()),
      0,
      0,
      bufferCanvasElement.width,
      bufferCanvasElement.height
    );
  }

  // @ts-expect-error
  canvasElement.albums = await Promise.all(
    [...Array(boundaries).keys()].map((y) =>
      Promise.all(
        [...Array(boundaries).keys()].map(async (x) => {
          const boundaryCoords = {
            // @ts-expect-error
            x: canvasElement.coords.x + x / boundaries,
            // @ts-expect-error
            y: canvasElement.coords.y + y / boundaries,
            // @ts-expect-error
            z: canvasElement.coords.z,
          };

          const tileLatLngBounds = L.latLngBounds(
            map.unproject(
              L.point(boundaryCoords.x * tileSize, boundaryCoords.y * tileSize),
              boundaryCoords.z
            ),
            map.unproject(
              L.point(
                (boundaryCoords.x + 1 / boundaries) * tileSize,
                (boundaryCoords.y + 1 / boundaries) * tileSize
              ),
              boundaryCoords.z
            )
          );

          const foundAlbum = searchPhotoInBoundary({
            album,
            tileLatLngBounds,
          });

          const thumbnail = foundAlbum.at(0);
          if (thumbnail) {
            const imageBitmap = await createImageBitmap(thumbnail.blob);

            const minSideLength = Math.min(
              imageBitmap.width,
              imageBitmap.height
            );
            const canvasBoundaryWidth = bufferCanvasElement.width / boundaries;
            const canvasBoundaryHeight =
              bufferCanvasElement.height / boundaries;
            bufferCanvasContext.drawImage(
              imageBitmap,
              (imageBitmap.width - minSideLength) / 2,
              (imageBitmap.height - minSideLength) / 2,
              minSideLength,
              minSideLength,
              canvasBoundaryWidth * x,
              canvasBoundaryHeight * y,
              canvasBoundaryWidth,
              canvasBoundaryHeight
            );

            if (foundAlbum.length >= 2) {
              const text = String(foundAlbum.length);
              bufferCanvasContext.font = `${
                12 * devicePixelRatio
              }px sans-serif`;
              const textMetrics = bufferCanvasContext.measureText(text);

              bufferCanvasContext.fillStyle = "#181818";
              const width = textMetrics.width + 8 * devicePixelRatio;
              bufferCanvasContext.fillRect(
                canvasBoundaryWidth * (x + 1) - width,
                canvasBoundaryHeight * y,
                width,
                16 * devicePixelRatio
              );

              bufferCanvasContext.fillStyle = "#ffffff";
              bufferCanvasContext.textAlign = "right";
              bufferCanvasContext.textBaseline = "top";
              bufferCanvasContext.fillText(
                text,
                canvasBoundaryWidth * (x + 1) - 4 * devicePixelRatio,
                canvasBoundaryHeight * y + 2 * devicePixelRatio
              );
            }
          }

          return foundAlbum;
        })
      )
    )
  );

  const canvasContext = canvasElement.getContext("2d");
  if (!canvasContext) {
    throw new Error("Failed to get canvas context");
  }
  canvasContext.drawImage(bufferCanvasElement, 0, 0);
};

const searchPhotoInBoundary = ({
  album,
  tileLatLngBounds,
}: {
  album: Photo[];
  tileLatLngBounds: L.LatLngBounds;
}) =>
  album
    .filter((photo) =>
      tileLatLngBounds.contains(L.latLng(photo.latitude, photo.longitude))
    )
    .toSorted((a, b) => b.originalDate.getTime() - a.originalDate.getTime());
