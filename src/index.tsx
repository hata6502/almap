import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

export interface Photo {
  name: string;
  blob: Blob;
  latitude: number;
  longitude: number;
  labels?: string[];
}

if ("serviceWorker" in navigator) {
  await navigator.serviceWorker.register("serviceWorker.js", {
    type: "module",
  });
}

const almapDB = await new Promise<IDBDatabase>((resolve, reject) => {
  const almapDBOpenRequest = indexedDB.open("almap", 1);

  almapDBOpenRequest.onupgradeneeded = (event) => {
    const almapDB = almapDBOpenRequest.result;
    let version = event.oldVersion;

    if (version === 0) {
      almapDB.createObjectStore("album", { keyPath: "name" });
      version++;
    }
  };

  almapDBOpenRequest.onsuccess = () => {
    resolve(almapDBOpenRequest.result);
  };

  almapDBOpenRequest.onerror = () => {
    reject(almapDBOpenRequest.error);
  };
});
const initialAlbum = await new Promise<Photo[]>((resolve, reject) => {
  const albumGetAllRequest = almapDB
    .transaction(["album"], "readonly")
    .objectStore("album")
    .getAll();
  albumGetAllRequest.onsuccess = () => {
    resolve(albumGetAllRequest.result);
  };
  albumGetAllRequest.onerror = () => {
    reject(albumGetAllRequest.error);
  };
});

const container = document.createElement("div");
document.body.append(container);
createRoot(container).render(
  <StrictMode>
    <App initialAlbum={initialAlbum} almapDB={almapDB} />
  </StrictMode>
);
