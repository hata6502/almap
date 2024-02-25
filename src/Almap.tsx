import L from "leaflet";
import {
  FunctionComponent,
  useCallback,
  useEffect,
  useId,
  useRef,
} from "react";
import { Photo } from "./database";
import { boundaries, drawTile, tileSize } from "./tile";

export const Almap: FunctionComponent<{
  album: Photo[];
  albumFiltered: boolean;
}> = ({ album, albumFiltered }) => {
  const albumRef = useRef(album);
  const loadedTilesRef = useRef<HTMLCanvasElement[]>([]);
  const mapRef = useRef<L.Map>();
  const id = useId();

  const draw = useCallback(async () => {
    for (const canvasElement of loadedTilesRef.current) {
      if (!mapRef.current) {
        return;
      }

      await drawTile({
        canvasElement,
        album: albumRef.current,
        map: mapRef.current,
      });
    }
  }, []);

  useEffect(() => {
    albumRef.current = album;

    if (!mapRef.current) {
      return;
    }
    if (albumFiltered && album.length) {
      mapRef.current.fitBounds(
        L.latLngBounds(
          album.map((photo) => L.latLng(photo.latitude, photo.longitude))
        )
      );
    }
    draw();
  }, [album, draw]);

  useEffect(() => {
    let isMoving = false;

    const map = L.map(id)
      .locate({ setView: true, maxZoom: 13 })
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
            map,
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
        loadedTilesRef.current = [...loadedTilesRef.current, event.tile];
      })
      .on("tileunload", (event: L.TileEvent) => {
        loadedTilesRef.current = loadedTilesRef.current.filter(
          // @ts-expect-error
          (loadedTile) => loadedTile !== event.tile
        );
      })
      .addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = undefined;
    };
  }, [draw]);

  return <div id={id} className="h-full" />;
};
