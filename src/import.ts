// @ts-expect-error
import piexif from "piexifjs";

export const readEXIF = async (file: File) => {
  try {
    const appendedDataURL = await new Promise<string>((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        if (typeof fileReader.result !== "string") {
          reject(new Error("Failed to read file"));
          return;
        }

        resolve(fileReader.result);
      };
      fileReader.onerror = () => {
        reject(fileReader.error);
      };

      fileReader.readAsDataURL(file);
    });
    const exif = piexif.load(appendedDataURL);

    const latitude =
      (exif["GPS"][piexif.GPSIFD.GPSLatitudeRef] == "N" ? 1 : -1) *
      piexif.GPSHelper.dmsRationalToDeg(exif["GPS"][piexif.GPSIFD.GPSLatitude]);
    const longitude =
      (exif["GPS"][piexif.GPSIFD.GPSLongitudeRef] == "E" ? 1 : -1) *
      piexif.GPSHelper.dmsRationalToDeg(
        exif["GPS"][piexif.GPSIFD.GPSLongitude]
      );
    const dateMatch = (
      exif["Exif"][piexif.ExifIFD.DateTimeOriginal] ?? ""
    ).match(/(\d\d\d\d):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      // 緯度経度が0の場合は、EXIFを読めていないとみなす。
      !latitude ||
      !longitude ||
      !dateMatch
    ) {
      throw new Error("Failed to read EXIF");
    }

    const originalDate = new Date(
      `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}Z`
    );
    // タイムゾーンを修正
    originalDate.setMinutes(
      originalDate.getMinutes() + originalDate.getTimezoneOffset()
    );

    return { latitude, longitude, originalDate };
  } catch {
    return;
  }
};

export const resize = async (file: File) => {
  const imageBitmap = await createImageBitmap(file);
  const resizeRatio = 512 / Math.max(imageBitmap.width, imageBitmap.height);

  const canvasElement = document.createElement("canvas");
  canvasElement.width = imageBitmap.width * resizeRatio;
  canvasElement.height = imageBitmap.height * resizeRatio;
  const canvasContext = canvasElement.getContext("2d");
  if (!canvasContext) {
    throw new Error("Failed to get canvas context");
  }
  canvasContext.imageSmoothingEnabled = true;
  canvasContext.imageSmoothingQuality = "high";
  canvasContext.drawImage(
    imageBitmap,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  return new Promise<Blob>((resolve, reject) => {
    canvasElement.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to resize image"));
        return;
      }
      resolve(blob);
    }, "image/jpeg");
  });
};
