import { Photo, putPhoto } from "./database";
import { NativeMessage, WebMessage } from "./native";

import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  Dispatch,
  Fragment,
  FunctionComponent,
  SetStateAction,
  useEffect,
  useState,
} from "react";

export const Memory: FunctionComponent<{
  album: Photo[];
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}> = ({ album, open, setOpen }) => {
  const handleCloseMemory = () => {
    setOpen(false);

    if ("ReactNativeWebView" in window) {
      const message: NativeMessage = { type: "memoryClosed" };
      // @ts-expect-error
      ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-1000" onClose={handleCloseMemory}>
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
                    {album.map((photo) => (
                      <div key={photo.name}>
                        <h3>{photo.originalDate.toLocaleString()}</h3>

                        <div className="mt-1">
                          <Photo photo={photo} />
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
  );
};

const Photo: FunctionComponent<{ photo: Photo }> = ({ photo }) => {
  const [blob, setBlob] = useState<Blob>();
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    const abortController = new AbortController();

    const photoSource = photo.source;
    switch (photoSource) {
      case "native": {
        setBlob(photo.originalBlob ?? photo.blob);

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
                const originalBlob = await response.blob();
                setBlob(originalBlob);
                await putPhoto({ ...photo, originalBlob });
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
        setBlob(photo.blob);
        break;
      }

      default: {
        throw new Error(`Unknown source: ${photoSource satisfies never}`);
      }
    }

    return () => {
      abortController.abort();
    };
  }, [photo]);

  useEffect(() => {
    if (!blob) {
      setSrc(undefined);
      return;
    }

    const objectURL = URL.createObjectURL(blob);
    setSrc(objectURL);
    return () => {
      URL.revokeObjectURL(objectURL);
    };
  }, [blob]);

  const image = <img alt="" src={src} className="w-full rounded-lg" />;
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
