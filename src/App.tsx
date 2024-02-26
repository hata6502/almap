import { Almap } from "./Almap";
import { Calendar } from "./Calendar";
import { Photo, getAlbum, putPhoto } from "./database";
import { readEXIF, resize } from "./import";

import { Popover, Transition } from "@headlessui/react";
import { CalendarIcon, PhotoIcon } from "@heroicons/react/20/solid";
import { Fragment, FunctionComponent, useMemo, useState } from "react";

export const App: FunctionComponent<{
  defaultAlbum: Photo[];
}> = ({ defaultAlbum }) => {
  const [album, setAlbum] = useState(defaultAlbum);
  const [dateRange, setDateRange] = useState<[Date, Date]>([
    new Date(-8640000000000000),
    new Date(8640000000000000),
  ]);

  const handleImportButtonClick = () => {
    const inputElement = document.createElement("input");
    inputElement.type = "file";
    inputElement.accept = "image/jpeg";
    inputElement.multiple = true;

    inputElement.addEventListener("change", async () => {
      const interval = async () => {
        setAlbum(await getAlbum());
      };
      const intervalID = window.setInterval(interval, 3000);

      const importedPhotos = [];
      const photoNames = album.map((photo) => photo.name);
      for (const file of inputElement.files ?? []) {
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
      await interval();

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
      <Almap album={filteredAlbum} albumFiltered={albumFiltered} />

      <button
        type="button"
        className="absolute right-12 top-2.5 z-1000 rounded-full bg-white p-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 print:hidden"
        onClick={handleImportButtonClick}
      >
        <PhotoIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      <Popover className="absolute right-2 top-2.5 z-1000 print:hidden">
        <Popover.Button className="rounded-full bg-white p-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
          <CalendarIcon className="h-5 w-5" aria-hidden="true" />
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
    </div>
  );
};
