import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { getAlbum } from "./database";
import { NativeMessage } from "./native";

if ("serviceWorker" in navigator) {
  await navigator.serviceWorker.register("serviceWorker.js", {
    type: "module",
  });
}

// @ts-expect-error
window.dataLayer = window.dataLayer || [];
function gtag(..._args: any[]) {
  // @ts-expect-error
  dataLayer.push(arguments);
}
gtag("js", new Date());
gtag("config", "G-1L4JVE9K6Q");

const album = await getAlbum();
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
    <App defaultAlbum={album} />
  </StrictMode>
);
