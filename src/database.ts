export interface Photo {
  name: string;
  blob: Blob;
  latitude: number;
  longitude: number;
  originalDate: Date;
}

export const getAlbum = () =>
  new Promise<Photo[]>((resolve, reject) => {
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
