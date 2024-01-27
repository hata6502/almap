const indexResponse = await fetch("index.json");
if (!indexResponse.ok) {
  throw new Error(
    `Failed to fetch index.json. status: ${indexResponse.status}`
  );
}
const index = await indexResponse.json();

const container = document.querySelector("#container");
if (!container) {
  throw new Error("Failed to find #container");
}
// TODO: 日付ソート
const album = JSON.parse(
  new URLSearchParams(location.search).get("album") ?? ""
);
for (const photoIndex of album) {
  // 連想配列にしたい。
  const photo = index[photoIndex];

  const itemElement = document.createElement("div");
  itemElement.append(
    new Date(photo.birthtimeMs).toLocaleDateString(),
    document.createElement("br")
  );

  const imageElement = document.createElement("img");
  imageElement.src = photo.filePath;
  imageElement.style.maxWidth = "320px";
  itemElement.append(imageElement, document.createElement("br"));

  for (const label of (photo.labels ?? []).slice(0, 3)) {
    const labelElement = document.createElement("a");
    labelElement.href = `./?${new URLSearchParams({ query: label })}`;
    labelElement.textContent = `#${label.replaceAll(/\s/g, "_")}`;

    itemElement.append(labelElement, " ");
  }

  container.append(itemElement, document.createElement("br"));
}

export {};
