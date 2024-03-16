import L from "leaflet";
import { FunctionComponent, useEffect, useId, useRef } from "react";
import { Photo } from "./database";
import { boundaries, drawTile, tileSize } from "./tile";

export const Almap: FunctionComponent<{
  album: Photo[];
  albumFiltered: boolean;
}> = ({ album, albumFiltered }) => {
  const albumRef = useRef(album);
  const loadedTiles = useRef<HTMLCanvasElement[]>([]);
  const map = useRef<L.Map>();
  const id = useId();

  useEffect(() => {
    albumRef.current = album;

    if (!map.current) {
      return;
    }

    if (album.length && albumFiltered) {
      map.current.fitBounds(
        L.latLngBounds(
          album.map((photo) => L.latLng(photo.latitude, photo.longitude))
        )
      );
    }
    Promise.all(
      loadedTiles.current.map(async (canvasElement) => {
        if (!map.current) {
          return;
        }

        await drawTile({
          canvasElement,
          album: albumRef.current,
          map: map.current,
        });
      })
    );
  }, [album, albumFiltered]);

  useEffect(() => {
    let isMoving = false;

    const currentMap = L.map(id, { zoomControl: false })
      // 日本経緯度原点
      .setView([35.39291572, 139.44288869], 5)
      .on("movestart", () => {
        isMoving = true;
      })
      .on("moveend", () => {
        setTimeout(() => {
          isMoving = false;
        });
      });

    const createTile: L.GridLayer["createTile"] = function (coords, done) {
      const canvasElement = document.createElement("canvas");
      canvasElement.width = tileSize * devicePixelRatio;
      canvasElement.height = tileSize * devicePixelRatio;
      canvasElement.style.width = `${tileSize}px`;
      canvasElement.style.height = `${tileSize}px`;

      (async () => {
        try {
          // @ts-expect-error
          canvasElement.coords = coords;
          await drawTile({
            canvasElement,
            album: albumRef.current,
            map: currentMap,
          });

          canvasElement.addEventListener("click", async (event) => {
            if (isMoving) {
              return;
            }

            const x = Math.floor((event.offsetX / tileSize) * boundaries);
            const y = Math.floor((event.offsetY / tileSize) * boundaries);
            // @ts-expect-error
            const boundaryAlbum = canvasElement.albums[y][x];
            const thumbnail = boundaryAlbum.at(0);

            if (boundaryAlbum.length >= 2) {
              // TODO: 一覧
            } else if (thumbnail) {
              open(URL.createObjectURL(thumbnail.blob));
            }
          });

          done(undefined, canvasElement);
        } catch (exception) {
          console.error(exception);
          if (!(exception instanceof Error)) {
            throw exception;
          }
          done(exception, canvasElement);
        }
      })();

      return canvasElement;
    };

    const AlmapLayer = L.GridLayer.extend({
      options: {
        attribution:
          '<a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
        maxZoom: 22,
      },
      createTile,
    });

    new AlmapLayer()
      .on("tileload", (event: L.TileEvent) => {
        // @ts-expect-error
        loadedTiles.current = [...loadedTiles.current, event.tile];
      })
      .on("tileunload", (event: L.TileEvent) => {
        loadedTiles.current = loadedTiles.current.filter(
          // @ts-expect-error
          (loadedTile) => loadedTile !== event.tile
        );
      })
      .addTo(currentMap);

    map.current = currentMap;
    return () => {
      currentMap.remove();
      map.current = undefined;
    };
  }, []);

  return <div id={id} className="h-full" />;
};
