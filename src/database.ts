export type Photo = {
  name: string;
  blob: Blob;
  latitude: number;
  longitude: number;
  originalDate: Date;
  url?: string;
} & (
    | { source?: undefined }
    | {
      source: "native";
      originalBlob?: Blob;
  }
  );

const almapScrapboxURL =
  "https://scrapbox.io/hata6502/almap_-_%E3%82%A2%E3%83%AB%E3%83%90%E3%83%A0%E3%81%A8%E5%9C%B0%E5%9B%B3";
const almapIconResponse = await fetch("readme.png");
if (!almapIconResponse.ok) {
  throw new Error("Failed to fetch favicon.png");
}
const readme: Photo = {
  name: almapScrapboxURL,
  blob: await almapIconResponse.blob(),
  // 日本経緯度原点
  latitude: 35.39291572,
  longitude: 139.44288869,
  originalDate: new Date(-8640000000000000),
  url: almapScrapboxURL,
};

export const getAlbum = () =>
  new Promise<Photo[]>((resolve, reject) => {
    const albumGetAllRequest = almapDB
      .transaction(["album"], "readonly")
      .objectStore("album")
      .getAll();
    albumGetAllRequest.onsuccess = () => {
      resolve([...albumGetAllRequest.result, readme]);
    };
    albumGetAllRequest.onerror = () => {
      reject(albumGetAllRequest.error);
    };
  });

export const putPhoto = (photo: Photo) =>
  new Promise<void>((resolve, reject) => {
    const albumPutRequest = almapDB
      .transaction(["album"], "readwrite")
      .objectStore("album")
      .put(photo);
    albumPutRequest.onsuccess = () => {
      resolve();
    };
    albumPutRequest.onerror = () => {
      reject(albumPutRequest.error);
    };
  });

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
