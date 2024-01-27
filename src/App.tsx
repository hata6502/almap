import { Popover, Transition } from "@headlessui/react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PhotoIcon,
} from "@heroicons/react/20/solid";
import L from "leaflet";
import "leaflet-control-geocoder";
import OpenAI from "openai";
import PQueue from "p-queue";
import {
  Fragment,
  FunctionComponent,
  MouseEventHandler,
  useEffect,
  useState,
} from "react";
import { Photo } from "./";
import { label, readEXIF, resize } from "./import";
import { boundaries, drawTile, tileSize } from "./tile";

const openai =
  // @ts-expect-error
  typeof window.OPENAI_API_KEY === "string"
    ? new OpenAI({
        // @ts-expect-error
        apiKey: window.OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      })
    : undefined;

export const App: FunctionComponent<{
  initialAlbum: Photo[];
  almapDB: IDBDatabase;
}> = ({ initialAlbum, almapDB }) => {
  const [importAlbum, setImportAlbum] = useState<MouseEventHandler>();

  useEffect(() => {
    let album = initialAlbum;
    let isMoving = false;
    let loadedTiles: HTMLCanvasElement[] = [];
    let query = "";

    const map = L.map("map")
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
          await drawTile({ canvasElement, album, map, query });

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
                      album.findIndex(
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
        loadedTiles = [...loadedTiles, event.tile];
      })
      .on("tileunload", (event: L.TileEvent) => {
        loadedTiles = loadedTiles.filter(
          // @ts-expect-error
          (loadedTile) => loadedTile !== event.tile
        );
      })
      .addTo(map);

    const redraw = async () => {
      for (const canvasElement of loadedTiles) {
        await drawTile({ canvasElement, album, map, query });
      }
    };

    if (openai) {
      // @ts-expect-error
      L.Control.geocoder({
        collapsed: false,
        defaultMarkGeocode: false,
        placeholder:
          initialAlbum
            .flatMap((photo) => (photo.labels ?? []).slice(0, 1))
            .sort(() => Math.random() - 0.5)
            .at(0) ?? "",
        query: new URLSearchParams(location.search).get("query"),
        showUniqueResult: false,
      })
        // @ts-expect-error
        .on("startgeocode", async function (event) {
          query = event.input;
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

          // @ts-expect-error
          this.setQuery("");
          query = "";
          await redraw();
        })
        .addTo(map);
    }

    setImportAlbum(() => () => {
      const inputElement = document.createElement("input");
      inputElement.type = "file";
      inputElement.accept = "image/jpeg";
      inputElement.multiple = true;

      inputElement.addEventListener("change", async () => {
        const photoNames = album.map((photo) => photo.name);

        const promises = [];
        const queue = new PQueue({ concurrency: 16 });
        let appendedFileCount = 0;
        for (const file of inputElement.files ?? []) {
          if (photoNames.includes(file.name)) {
            continue;
          }

          promises.push(
            queue.add(async () => {
              const exif = await readEXIF(file);
              if (!exif) {
                return;
              }
              const { latitude, longitude } = exif;

              try {
                const { resizedDataURL, resizedBlob } = await resize(file);
                const photo: Photo = {
                  name: file.name,
                  blob: resizedBlob,
                  latitude,
                  longitude,
                  labels:
                    openai && (await label({ openai, url: resizedDataURL })),
                };
                console.log(photo);

                await new Promise<void>((resolve, reject) => {
                  const albumPutRequest = almapDB
                    .transaction(["album"], "readwrite")
                    .objectStore("album")
                    .put(photo);
                  albumPutRequest.onsuccess = () => {
                    resolve();
                  };
                  albumPutRequest.onerror = () => {
                    reject(albumPutRequest.error);
                  };
                });
                album = [...album, photo];

                if (!(appendedFileCount % 300)) {
                  map.setView(L.latLng(latitude, longitude), 16, {
                    animate: false,
                    duration: 0,
                  });
                }
                appendedFileCount++;
              } catch (exception) {
                // 効いてないかも?
                if (exception instanceof OpenAI.RateLimitError) {
                  alert(exception);
                  throw exception;
                }

                console.error(file.name, exception);
              }
            })
          );
        }
        await Promise.all(promises);

        if (appendedFileCount) {
          alert(`${appendedFileCount}枚のEXIF付き写真を取り込みました。`);
        } else {
          alert("EXIF付き写真が見つかりませんでした。");
          open(
            "https://scrapbox.io/hata6502/EXIF%E4%BB%98%E3%81%8D%E5%86%99%E7%9C%9F%E3%82%92%E5%85%A8%E9%81%B8%E6%8A%9E%E3%81%99%E3%82%8B%E6%96%B9%E6%B3%95"
          );
        }
      });

      inputElement.click();
    });

    return () => {
      map.remove();
    };
  }, []);

  return (
    <div className="relative">
      <div id="map" className="h-lvh" />

      <button
        type="button"
        className="absolute left-12 top-2.5 z-1000 rounded-full bg-white p-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        onClick={importAlbum}
      >
        <PhotoIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      <Popover className="absolute left-24 top-2.5 z-1000">
        <Popover.Button className="inline-flex w-full justify-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
          Options
          <ChevronDownIcon
            className="-mr-1 h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
        </Popover.Button>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Popover.Panel className="absolute left-1/2 z-10 mt-2 w-56 -translate-x-1/2 transform rounded-md bg-white text-center shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="flex items-center text-gray-900">
              <button
                type="button"
                className="-m-1.5 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Previous month</span>
                <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="flex-auto text-sm font-semibold">January</div>
              <button
                type="button"
                className="-m-1.5 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Next month</span>
                <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-7 text-xs leading-6 text-gray-500">
              <div>M</div>
              <div>T</div>
              <div>W</div>
              <div>T</div>
              <div>F</div>
              <div>S</div>
              <div>S</div>
            </div>
            <div className="isolate mt-2 grid grid-cols-7 gap-px rounded-lg bg-gray-200 text-sm shadow ring-1 ring-gray-200">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((day) => (
                <button
                  key={day}
                  type="button"
                  className="py-1.5 hover:bg-gray-100 focus:z-10 bg-white text-gray-900"
                  //dayIdx === 0 && "rounded-tl-lg",
                  //dayIdx === 6 && "rounded-tr-lg",
                  //dayIdx === days.length - 7 && "rounded-bl-lg",
                  //dayIdx === days.length - 1 && "rounded-br-lg"
                >
                  <time
                    dateTime={String(day)}
                    className="mx-auto flex h-7 w-7 items-center justify-center rounded-full"
                  >
                    {day}
                  </time>
                </button>
              ))}
            </div>
          </Popover.Panel>
        </Transition>
      </Popover>
    </div>
  );
};
