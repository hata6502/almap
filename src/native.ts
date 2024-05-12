export type NativeMessage =
  | { type: "loadPhoto"; id: string }
  | { type: "memoryClosed" }
  | { type: "start"; after: number };

export type WebMessage =
  | {
      type: "importPhoto";
      id: string;
      dataURL: string;
      location: { latitude: number; longitude: number };
      creationTime: number;
    }
  | { type: "loadPhoto"; id: string; dataURL: string }
  | { type: "progress"; progress?: number };
