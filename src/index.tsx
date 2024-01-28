import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { getAlbum } from "./database";

if ("serviceWorker" in navigator) {
  await navigator.serviceWorker.register("serviceWorker.js", {
    type: "module",
  });
}

const container = document.createElement("div");
container.classList.add("h-full");
document.body.append(container);
createRoot(container).render(
  <StrictMode>
    <App defaultAlbum={await getAlbum()} />
  </StrictMode>
);
