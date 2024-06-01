import { Almap } from "./Almap";
import { Calendar } from "./Calendar";
import { Photo, getAlbum, putPhoto } from "./database";
import { readEXIF, resize } from "./import";
import { WebMessage } from "./native";

import { Dialog, Popover, Transition } from "@headlessui/react";
import { CalendarDaysIcon, PhotoIcon } from "@heroicons/react/20/solid";
import {
  Fragment,
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

export const App: FunctionComponent<{
  defaultAlbum: Photo[];
}> = ({ defaultAlbum }) => {
  const [, startTransition] = useTransition();

  const [album, setAlbum] = useState(defaultAlbum);
  const [progress, setProgress] = useState<number>();
  const processing = typeof progress === "number";

  const [dateOfMonth, setDateOfMonth] = useState(new Date());
  const [dateRange, setDateRange] = useState<[Date, Date]>(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
    oneWeekAgo.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneWeek: [Date, Date] = [oneWeekAgo, today];

    return filterAlbum({ album, dateRange: oneWeek }).length
      ? oneWeek
      : [new Date(-8640000000000000), new Date(8640000000000000)];
  });

  const [androidDialogOpen, setAndroidDialogOpen] = useState(
    navigator.userAgent.includes("Android") && !("ReactNativeWebView" in window)
  );
  const [exifDialogOpen, setEXIFDialogOpen] = useState(false);

  const updateAlbum = useCallback(async () => {
    setAlbum(await getAlbum());
  }, []);

  useEffect(() => {
    if (!("ReactNativeWebView" in window)) {
      return;
    }

    const importPhotoPromises: Promise<void>[] = [];
    let intervalID: number | undefined;
    // @ts-expect-error
    const handleAlmapWebMessage = async (event) => {
      const message: WebMessage = event.detail;
      switch (message.type) {
        case "importPhoto": {
          importPhotoPromises.push(
            (async () => {
              const response = await fetch(message.dataURL);
              await putPhoto({
                name: message.id,
                source: "native",
                blob: await response.blob(),
                latitude: message.location.latitude,
                longitude: message.location.longitude,
                originalDate: new Date(message.creationTime),
              });
            })()
          );
          break;
        }

        case "progress": {
          startTransition(() => {
            setProgress(message.progress);
          });

          const drawImportedPhotos = async () => {
            if (!importPhotoPromises.length) {
              return;
            }

            await updateAlbum();
          };
          if (message.progress === 0) {
            intervalID = window.setInterval(drawImportedPhotos, 3000);
          } else if (message.progress === undefined) {
            await Promise.all(importPhotoPromises);

            window.clearInterval(intervalID);
            await drawImportedPhotos();
          }
          break;
        }

        case "loadPhoto": {
          break;
        }

        default: {
          throw new Error(`Unknown message: ${message satisfies never}`);
        }
      }
    };
    addEventListener("almapwebmessage", handleAlmapWebMessage);

    return () => {
      removeEventListener("almapwebmessage", handleAlmapWebMessage);
    };
  }, [updateAlbum]);

  const handleImportButtonClick = () => {
    setProgress(0);

    const inputElement = document.createElement("input");
    inputElement.type = "file";
    inputElement.accept = "image/jpeg";
    inputElement.multiple = true;

    inputElement.addEventListener("change", async () => {
      const intervalID = window.setInterval(updateAlbum, 3000);

      const importedPhotos = [];
      const files = [...(inputElement.files ?? [])]
        // 写真のファイルは日時で命名されることが多いと思われる
        // 古い写真を先に取り込みやすくして、取り込み中の演出を起こしやすくする
        .toSorted((a, b) => a.name.localeCompare(b.name));
      const photoNames = album.map((photo) => photo.name);
      for (const [fileIndex, file] of files.entries()) {
        startTransition(() => {
          setProgress((fileIndex + 1) / files.length);
        });

        if (photoNames.includes(file.name)) {
          continue;
        }
        const exif = await readEXIF(file);
        if (!exif) {
          continue;
        }

        const { latitude, longitude, originalDate } = exif;
        const resizedBlob = await resize(file);
        const photo: Photo = {
          name: file.name,
          blob: resizedBlob,
          latitude,
          longitude,
          originalDate,
        };
        console.log(photo);
        await putPhoto(photo);
        importedPhotos.push(photo);
      }

      window.clearInterval(intervalID);
      await updateAlbum();
      setProgress(undefined);

      if (importedPhotos.length) {
        const importedTimes = importedPhotos.map((photo) =>
          new Date(photo.originalDate).setHours(0, 0, 0, 0)
        );

        const startDate = new Date(Math.min(...importedTimes));
        const endDate = new Date(Math.max(...importedTimes));
        setDateOfMonth(startDate);
        setDateRange([startDate, endDate]);
      } else {
        setEXIFDialogOpen(true);
      }
    });

    inputElement.addEventListener("cancel", () => {
      setProgress(undefined);
    });

    inputElement.click();
  };

  const filteredAlbum = useMemo(
    () => filterAlbum({ album, dateRange }),
    [album, dateRange]
  );
  const albumFiltered = filteredAlbum.length !== album.length;

  return (
    <div className="relative h-full">
      <Almap
        album={filteredAlbum}
        albumFiltered={albumFiltered}
        updateAlbum={updateAlbum}
      />

      <div className="absolute right-2.5 top-2.5 z-1000 flex gap-2 print:hidden">
        {!("ReactNativeWebView" in window) && (
          <button
            type="button"
            disabled={processing}
            className="rounded-full bg-white p-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            onClick={handleImportButtonClick}
          >
            {processing ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="animate-spin h-5 w-5 text-pink-500"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="opacity-25"
                ></circle>
                <path
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  className="opacity-75"
                ></path>
              </svg>
            ) : (
              <PhotoIcon className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        )}

        {Boolean(album.length) && (
          <Popover>
            <Popover.Button className="rounded-full bg-white p-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
              <CalendarDaysIcon className="h-5 w-5" aria-hidden="true" />
            </Popover.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
              unmount={false}
            >
              <Popover.Panel
                unmount={false}
                className="absolute right-0 z-10 mt-2 w-72 rounded-md bg-white text-center shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
              >
                <Calendar
                  album={album}
                  dateOfMonth={dateOfMonth}
                  dateRange={dateRange}
                  setDateOfMonth={setDateOfMonth}
                  setDateRange={setDateRange}
                />
              </Popover.Panel>
            </Transition>
          </Popover>
        )}
      </div>

      <Transition.Root show={androidDialogOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-1000"
          onClose={setAndroidDialogOpen}
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
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white p-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                  <div>
                    <div className="text-center">
                      <Dialog.Title
                        as="h3"
                        className="text-base font-semibold leading-6 text-gray-900"
                      >
                        Androidアプリをダウンロード
                      </Dialog.Title>

                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Android版では、撮った写真が自動で取り込まれます。
                          クローズドテストにご協力をお願いします🙏
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 sm:mt-6">
                    <a
                      href="https://forms.gle/JuWRh2adTiDQpKAW6"
                      className="inline-flex w-full justify-center rounded-md bg-pink-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-pink-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"
                    >
                      クローズドテストに参加する
                    </a>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      <Transition.Root show={exifDialogOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-1000"
          onClose={setEXIFDialogOpen}
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
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white p-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                  <div>
                    <div className="text-center">
                      <Dialog.Title
                        as="h3"
                        className="text-base font-semibold leading-6 text-gray-900"
                      >
                        EXIF付き写真が見つかりませんでした
                      </Dialog.Title>

                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          <a
                            href="https://scrapbox.io/hata6502/EXIF%E4%BB%98%E3%81%8D%E5%86%99%E7%9C%9F%E3%82%92%E5%85%A8%E9%81%B8%E6%8A%9E%E3%81%99%E3%82%8B%E6%96%B9%E6%B3%95"
                            target="_blank"
                            className="text-pink-500 underline hover:text-pink-700"
                          >
                            EXIF付き写真を全選択する方法
                          </a>
                          を参考にして、もう一度写真を選択してみてください。
                        </p>
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      <div
        className="absolute left-0 top-0 z-1000 h-1 bg-pink-400"
        style={{ width: `${(progress ?? 0) * 100}%` }}
      />
    </div>
  );
};

const filterAlbum = ({
  album,
  dateRange: [startDate, endDate],
}: {
  album: Photo[];
  dateRange: [Date, Date];
}) =>
  album.filter(
    (photo) =>
      new Date(photo.originalDate).setHours(0, 0, 0, 0) >=
        startDate.getTime() &&
      new Date(photo.originalDate).setHours(0, 0, 0, 0) <= endDate.getTime()
  );
