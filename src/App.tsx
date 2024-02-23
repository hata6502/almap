import { Almap } from "./Almap";
import { Calendar } from "./Calendar";
import { Photo, getAlbum, putPhoto } from "./database";
import { label, readEXIF, resize } from "./import";

import { Dialog, Popover, Transition } from "@headlessui/react";
import {
  Bars3Icon,
  ChevronDownIcon,
  PhotoIcon,
} from "@heroicons/react/20/solid";
import clsx from "clsx";
import "leaflet-control-geocoder";
import OpenAI from "openai";
import PQueue from "p-queue";
import {
  ChangeEventHandler,
  Fragment,
  FunctionComponent,
  useId,
  useMemo,
  useState,
} from "react";

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
  defaultAlbum: Photo[];
}> = ({ defaultAlbum }) => {
  const [album, setAlbum] = useState(defaultAlbum);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [selectedImportTimes, setSelectedImportTimes] = useState<Set<number>>(
    new Set()
  );

  const handleBar3ButtonClick = () => {
    setSidebarOpen(true);
  };
  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  const handleImportButtonClick = () => {
    const inputElement = document.createElement("input");
    inputElement.type = "file";
    inputElement.accept = "image/jpeg";
    inputElement.multiple = true;

    inputElement.addEventListener("change", async () => {
      const importDate = new Date();
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
            const { latitude, longitude, originalDate } = exif;

            try {
              const { resizedDataURL, resizedBlob } = await resize(file);
              const photo: Photo = {
                name: file.name,
                blob: resizedBlob,
                latitude,
                longitude,
                originalDate,
                importDate,
                labels:
                  openai && (await label({ openai, url: resizedDataURL })),
              };
              console.log(photo);
              await putPhoto(photo);

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
        setAlbum(await getAlbum());
        setSelectedImportTimes(new Set([importDate.getTime()]));
      } else {
        alert("EXIF付き写真が見つかりませんでした。");
        open(
          "https://scrapbox.io/hata6502/EXIF%E4%BB%98%E3%81%8D%E5%86%99%E7%9C%9F%E3%82%92%E5%85%A8%E9%81%B8%E6%8A%9E%E3%81%99%E3%82%8B%E6%96%B9%E6%B3%95"
        );
      }
    });

    inputElement.click();
  };

  const importID = useId();
  const imports = [
    ...Map.groupBy(album, (photo) => photo.importDate.getTime()),
  ].toSorted(([aTime], [bTime]) => bTime - aTime);

  const importFilterEnabled = Boolean(selectedImportTimes.size);
  const filteredAlbum = useMemo(
    () =>
      album.filter(
        (photo) =>
          !importFilterEnabled ||
          selectedImportTimes.has(photo.importDate.getTime())
      ),
    [album, importFilterEnabled, selectedImportTimes]
  );

  return (
    <>
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-1000"
          onClose={handleSidebarClose}
        >
          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1 text-gray-900">
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pt-6 pb-2">
                  <nav className="flex flex-1 flex-col ">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <div className="text-xs text-gray-500 font-semibold leading-6">
                          取り込み履歴
                        </div>

                        <ul role="list" className="-mx-2 mt-2 space-y-1">
                          <li>
                            <button
                              type="button"
                              className="group flex gap-x-3 w-full rounded-md p-2 text-sm leading-6 font-semibold hover:text-indigo-600 hover:bg-gray-50"
                              onClick={handleImportButtonClick}
                            >
                              <PhotoIcon
                                className="group-hover:text-indigo-600 h-6 w-6 shrink-0"
                                aria-hidden="true"
                              />
                              写真を取り込む
                            </button>
                          </li>
                        </ul>

                        <ul role="list" className="-mx-2 space-y-1">
                          {imports.map(([key, album]) => {
                            const handleInputChange: ChangeEventHandler<
                              HTMLInputElement
                            > = (event) => {
                              setSelectedImportTimes((prev) => {
                                const current = new Set(prev);
                                if (event.target.checked) {
                                  current.add(key);
                                } else {
                                  current.delete(key);
                                }
                                return current;
                              });
                            };

                            const id = `${importID}-${key}`;
                            const inputID = `${id}-input`;
                            const descriptionID = `${id}-description`;
                            const label = new Date(key).toLocaleString();

                            return (
                              <li key={key}>
                                <label
                                  htmlFor={inputID}
                                  className="relative group flex items-start gap-x-3 rounded-md p-2 text-sm leading-6 cursor-pointer hover:text-indigo-600 hover:bg-gray-50"
                                >
                                  <div
                                    className={clsx(
                                      "flex h-6 px-1 py-1 items-center",
                                      !importFilterEnabled && "invisible"
                                    )}
                                  >
                                    <input
                                      id={inputID}
                                      aria-describedby={descriptionID}
                                      type="checkbox"
                                      checked={selectedImportTimes.has(key)}
                                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                      onChange={handleInputChange}
                                    />
                                  </div>

                                  <div className="grow flex text-sm leading-6">
                                    <span className="grow">{label}</span>

                                    <span
                                      id={descriptionID}
                                      className="text-nowrap text-gray-500"
                                    >
                                      <span className="sr-only">{label}</span>
                                      {album.length}枚
                                    </span>
                                  </div>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      <div className="relative h-full">
        <Almap
          album={filteredAlbum}
          displaysSearchBar={Boolean(openai)}
          importFilterEnabled={importFilterEnabled}
        />

        <button
          type="button"
          className="absolute left-12 top-2.5 z-1000 rounded-full bg-white p-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          onClick={handleBar3ButtonClick}
        >
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
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
            <Popover.Panel className="absolute left-1/2 z-10 m-2 w-72 -translate-x-1/2 transform rounded-md bg-white text-center shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <Calendar />
            </Popover.Panel>
          </Transition>
        </Popover>
      </div>
    </>
  );
};
