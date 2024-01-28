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
  searchBarDisplay: boolean;
}> = ({ album, searchBarDisplay }) => {
  const albumRef = useRef(album);
  const loadedTilesRef = useRef<HTMLCanvasElement[]>([]);
  const mapRef = useRef<L.Map>();
  const queryRef = useRef("");
  const id = useId();

  const redraw = useCallback(async () => {
    for (const canvasElement of loadedTilesRef.current) {
      if (!mapRef.current) {
        return;
      }

      await drawTile({
        canvasElement,
        album: albumRef.current,
        map: mapRef.current,
        query: queryRef.current,
      });
    }
  }, []);

  useEffect(() => {
    albumRef.current = album;

    if (!mapRef.current) {
      return;
    }
    mapRef.current.fitBounds(
      L.latLngBounds(
        album.map((photo) => L.latLng(photo.latitude, photo.longitude))
      )
    );
    void redraw();
  }, [album, redraw]);

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
            query: queryRef.current,
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
              open(
                `memory.html?${new URLSearchParams({
                  album: JSON.stringify(
                    boundaryAlbum.map((boundaryPhoto: Photo) =>
                      albumRef.current.findIndex(
                        (photo: Photo) => photo.name === boundaryPhoto.name
                      )
                    )
                  ),
                })}`
              );
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

    if (searchBarDisplay) {
      // @ts-expect-error
      L.Control.geocoder({
        collapsed: false,
        defaultMarkGeocode: false,
        placeholder:
          albumRef.current
            .flatMap((photo) => (photo.labels ?? []).slice(0, 1))
            .sort(() => Math.random() - 0.5)
            .at(0) ?? "",
        query: new URLSearchParams(location.search).get("query"),
        showUniqueResult: false,
      })
        // @ts-expect-error
        .on("startgeocode", async function (event) {
          queryRef.current = event.input;
          await redraw();
        })
        // @ts-expect-error
        .on("markgeocode", async function (event) {
          L.marker(event.geocode.center)
            .on("click", () => {
              open(
                `https://www.google.com/maps/search/?${new URLSearchParams({
                  api: "1",
                  query: `${event.geocode.center.lat},${event.geocode.center.lng}`,
                })}`
              );
            })
            .addTo(map);
          map.fitBounds(event.geocode.bbox, { maxZoom: 16 });

          queryRef.current = "";
          await redraw();
        })
        .addTo(map);
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = undefined;
    };
  }, [redraw, searchBarDisplay]);

  return <div id={id} className="h-full" />;
};
