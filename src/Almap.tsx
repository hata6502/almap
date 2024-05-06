import { Photo, putPhoto } from "./database";
import { NativeMessage, WebMessage } from "./native";
import { boundaries, drawTile, tileSize } from "./tile";

import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import L from "leaflet";
import {
  Fragment,
  FunctionComponent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

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

  const [memory, setMemory] = useState<string[]>([]);
  const [openMemory, setOpenMemory] = useState(false);

  const albumRef = useRef(album);
  const loadedTiles = useRef<HTMLCanvasElement[]>([]);
  const map = useRef<L.Map>();
  const id = useId();

  const handleCloseMemory = () => {
    setOpenMemory(false);

    if ("ReactNativeWebView" in window) {
      const message: NativeMessage = { type: "memoryClosed" };
      // @ts-expect-error
      ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  };

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
              // @ts-expect-error
              setMemory(boundaryAlbum.map(({ name }) => name));
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

  const memoryAlbum = useMemo(
    () => album.filter((photo) => memory.includes(photo.name)),
    [album, memory]
  );

  return (
    <>
      <div id={id} className="h-full" />

      <Transition.Root show={openMemory} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-1000"
          onClose={handleCloseMemory}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 hidden bg-gray-500 bg-opacity-75 transition-opacity md:block" />
          </Transition.Child>

          <div className="fixed inset-0 z-1000 w-screen overflow-y-auto">
            <div className="flex min-h-full items-stretch justify-center text-center md:items-center md:px-2 lg:px-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 md:translate-y-0 md:scale-95"
                enterTo="opacity-100 translate-y-0 md:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 md:scale-100"
                leaveTo="opacity-0 translate-y-4 md:translate-y-0 md:scale-95"
              >
                <Dialog.Panel className="flex w-full max-w-xl transform text-left text-base transition md:my-8 md:px-4">
                  <div className="relative w-full bg-white px-4 pb-8 pt-14 shadow-2xl sm:px-6 sm:pt-8 md:p-6 lg:p-8">
                    <button
                      type="button"
                      className="absolute right-4 top-4 text-gray-400 hover:text-gray-500 sm:right-6 sm:top-8 md:right-6 md:top-6 lg:right-8 lg:top-8"
                      onClick={handleCloseMemory}
                    >
                      <span className="sr-only">閉じる</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>

                    <div className="flex flex-col space-y-4">
                      {memoryAlbum.map((photo) => (
                        <div key={photo.name}>
                          <h3>{photo.originalDate.toLocaleString()}</h3>

                          <div className="mt-1">
                            <Photo photo={photo} updateAlbum={updateAlbum} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
};

const Photo: FunctionComponent<{
  photo: Photo;
  updateAlbum: () => Promise<void>;
}> = ({ photo, updateAlbum }) => {
  const [url, setURL] = useState<string>();

  useEffect(() => {
    const abortController = new AbortController();
    const photoSource = photo.source;
    let blob;
    switch (photoSource) {
      case "native": {
        blob = photo.originalBlob ?? photo.blob;

        (async () => {
          await new Promise((resolve) => setTimeout(resolve));
          if (photo.originalBlob || abortController.signal.aborted) {
            return;
          }

          // @ts-expect-error
          const handleAlmapWebMessage = async (event) => {
            const message: WebMessage = event.detail;
            switch (message.type) {
              case "loadPhoto": {
                if (message.id !== photo.name) {
                  break;
                }

                removeEventListener("almapwebmessage", handleAlmapWebMessage);

                const response = await fetch(message.dataURL);
                await putPhoto({
                  ...photo,
                  originalBlob: await response.blob(),
                });
                await updateAlbum();
                break;
              }

              case "importPhoto":
              case "progress": {
                break;
              }

              default: {
                throw new Error(`Unknown message: ${message satisfies never}`);
              }
            }
          };
          addEventListener("almapwebmessage", handleAlmapWebMessage);

          const message: NativeMessage = { type: "loadPhoto", id: photo.name };
          // @ts-expect-error
          ReactNativeWebView.postMessage(JSON.stringify(message));
        })();

        break;
      }

      case undefined: {
        blob = photo.blob;
        break;
      }

      default: {
        throw new Error(`Unknown source: ${photoSource satisfies never}`);
      }
    }

    const url = URL.createObjectURL(blob);
    setURL(url);

    return () => {
      abortController.abort();
      URL.revokeObjectURL(url);
    };
  }, [photo, updateAlbum]);

  const image = <img alt="" src={url} className="w-full rounded-lg" />;
  return photo.url ? (
    <div className="border-b border-pink-500 hover:border-pink-700">
      <a href={photo.url} target="_blank">
        {image}
      </a>
    </div>
  ) : (
    image
  );
};
