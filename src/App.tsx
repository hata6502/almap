import { Almap } from "./Almap";
import { Calendar } from "./Calendar";
import { Photo, getAlbum, putPhoto } from "./database";
import { readEXIF, resize } from "./import";

import { Popover, Transition } from "@headlessui/react";
import { CalendarDaysIcon, PhotoIcon } from "@heroicons/react/20/solid";
import {
  Fragment,
  FunctionComponent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

type WebMessage =
  | {
      type: "importPhoto";
      id: string;
      dataURL: string;
      location: {
        latitude: number;
        longitude: number;
      };
      creationTime: number;
    }
  | {
      type: "progress";
      progress?: number;
    };

export const App: FunctionComponent<{
  defaultAlbum: Photo[];
  defaultLatitude?: number;
  defaultLongitude?: number;
  defaultZoom: number;
}> = ({ defaultAlbum, defaultLatitude, defaultLongitude, defaultZoom }) => {
  const [, startTransition] = useTransition();

  const [album, setAlbum] = useState(defaultAlbum);
  const [dateRange, setDateRange] = useState<[Date, Date]>([
    new Date(-8640000000000000),
    new Date(8640000000000000),
  ]);
  const [progress, setProgress] = useState<number>();
  const processing = typeof progress === "number";

  const updateAlbum = async () => {
    setAlbum(await getAlbum());
  };

  useEffect(() => {
    if (!("ReactNativeWebView" in window)) {
      return;
    }

    let intervalID: number | undefined;
    // @ts-expect-error
    const handleWebMessage = async (event) => {
      const message: WebMessage = JSON.parse(event.data);

      switch (message.type) {
        case "importPhoto": {
          const response = await fetch(message.dataURL);
          await putPhoto({
            name: message.id,
            blob: await response.blob(),
            latitude: message.location.latitude,
            longitude: message.location.longitude,
            originalDate: new Date(message.creationTime),
          });
          break;
        }

        case "progress": {
          startTransition(() => {
            setProgress(message.progress);
          });

          if (message.progress === 0) {
            if (!defaultAlbum.length) {
              alert(
                "デバイス内のアルバムを取り込みます。しばらくお待ちください。"
              );
            }
            intervalID = window.setInterval(updateAlbum, 3000);
          } else if (message.progress === undefined) {
            window.clearInterval(intervalID);
            await updateAlbum();
          }
          break;
        }

        default: {
          throw new Error(`Unknown message: ${message satisfies never}`);
        }
      }
    };
    // Web APIのDocumentにmessageイベントは存在しない
    // react-native-webviewからのmessageを受け取る
    document.addEventListener("message", handleWebMessage);

    return () => {
      document.removeEventListener("message", handleWebMessage);
    };
  }, []);

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
        alert(`${importedPhotos.length}枚のEXIF付き写真を取り込みました。`);

        const importedTimes = importedPhotos.map((photo) =>
          new Date(photo.originalDate).setHours(0, 0, 0, 0)
        );
        setDateRange([
          new Date(Math.min(...importedTimes)),
          new Date(Math.max(...importedTimes)),
        ]);
      } else {
        alert("EXIF付き写真が見つかりませんでした。");
        open(
          "https://scrapbox.io/hata6502/EXIF%E4%BB%98%E3%81%8D%E5%86%99%E7%9C%9F%E3%82%92%E5%85%A8%E9%81%B8%E6%8A%9E%E3%81%99%E3%82%8B%E6%96%B9%E6%B3%95"
        );
      }
    });

    inputElement.addEventListener("cancel", () => {
      setProgress(undefined);
    });

    inputElement.click();
  };

  const filteredAlbum = useMemo(() => {
    const [startDate, endDate] = dateRange;
    return album.filter(
      (photo) =>
        new Date(photo.originalDate).setHours(0, 0, 0, 0) >=
          startDate.getTime() &&
        new Date(photo.originalDate).setHours(0, 0, 0, 0) <= endDate.getTime()
    );
  }, [album, dateRange]);
  const albumFiltered = filteredAlbum.length !== album.length;

  return (
    <div className="relative h-full">
      <Almap
        album={filteredAlbum}
        albumFiltered={albumFiltered}
        defaultLatitude={defaultLatitude}
        defaultLongitude={defaultLongitude}
        defaultZoom={defaultZoom}
      />

      {!("ReactNativeWebView" in window) && (
        <button
          type="button"
          disabled={processing}
          className="absolute right-12 top-12 z-1000 rounded-full bg-white p-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 print:hidden"
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

      <Popover className="absolute right-2 top-12 z-1000 print:hidden">
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
              dateRange={dateRange}
              setDateRange={setDateRange}
            />
          </Popover.Panel>
        </Transition>
      </Popover>

      <div
        className="absolute left-0 top-0 z-1000 h-1 bg-pink-400"
        style={{ width: `${(progress ?? 0) * 100}%` }}
      />
    </div>
  );
};
