import { Memory } from "./Memory";
import { Photo } from "./database";
import { boundaries, drawTile, tileSize } from "./tile";

import L from "leaflet";
import { FunctionComponent, useEffect, useId, useRef, useState } from "react";

export const Almap: FunctionComponent<{
  album: Photo[];
  albumFiltered: boolean;
  updateAlbum: () => Promise<void>;
}> = ({ album, albumFiltered, updateAlbum }) => {
  const [ready] = useState(() => {
    let resolve: () => void;
    const promise = new Promise<void>((res) => {
      resolve = res;
    });
    // @ts-expect-error
    return { promise, resolve };
  });

  const [memoryAlbum, setMemoryAlbum] = useState<Photo[]>([]);
  const [openMemory, setOpenMemory] = useState(false);

  const albumRef = useRef(album);
  const loadedTiles = useRef<HTMLCanvasElement[]>([]);
  const map = useRef<L.Map>();
  const id = useId();

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
          await ready.promise;

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
            if (!boundaryAlbum.length) {
              return;
            }

            if (boundaryAlbum.length === 1 && boundaryAlbum[0].url) {
              open(boundaryAlbum[0].url);
            } else {
              setMemoryAlbum(boundaryAlbum);
              setOpenMemory(true);
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

    ready.resolve();
  }, [album, albumFiltered]);

  return (
    <>
      <div id={id} className="h-full" />
      <Memory
        album={memoryAlbum}
        open={openMemory}
        setOpen={setOpenMemory}
        updateAlbum={updateAlbum}
      />
    </>
  );
};
