import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { getAlbum } from "./database";

type NativeMessage = {
  type: "start";
  after?: number;
};

if ("serviceWorker" in navigator) {
  await navigator.serviceWorker.register("serviceWorker.js", {
    type: "module",
  });
}

const urlSearchParams = new URLSearchParams(location.search);
let defaultLatitude = urlSearchParams.has("latitude")
  ? Number(urlSearchParams.get("latitude"))
  : undefined;
let defaultLongitude = urlSearchParams.has("longitude")
  ? Number(urlSearchParams.get("longitude"))
  : undefined;
let defaultZoom = 13;

const album = await getAlbum();
if (!album.length) {
  // 日本経緯度原点
  defaultLatitude = 35.39291572;
  defaultLongitude = 139.44288869;
  defaultZoom = 5;
}

if ("ReactNativeWebView" in window) {
  const message: NativeMessage = {
    type: "start",
    after: album
      .toSorted((a, b) => b.originalDate.getTime() - a.originalDate.getTime())
      .at(0)
      ?.originalDate.getTime(),
  };
  // @ts-expect-error
  ReactNativeWebView.postMessage(JSON.stringify(message));
}

const container = document.createElement("div");
container.classList.add("h-full");
document.body.append(container);
createRoot(container).render(
  <StrictMode>
    <App
      defaultAlbum={album}
      defaultLatitude={defaultLatitude}
      defaultLongitude={defaultLongitude}
      defaultZoom={defaultZoom}
    />
  </StrictMode>
);
