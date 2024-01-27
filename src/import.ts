import OpenAI from "openai";
// @ts-expect-error
import piexif from "piexifjs";

export const label = async ({
  openai,
  url,
}: {
  openai: OpenAI;
  url: string;
}) => {
  const labelCompletion = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "この写真に映っているものを重要度順に半角カンマ区切りで列挙してください。",
          },
          { type: "image_url", image_url: { detail: "low", url } },
        ],
      },
    ],
    max_tokens: 64,
  });
  const labelCompletionChoice = labelCompletion.choices[0];
  const coreLabels = (labelCompletionChoice.message.content ?? "")
    .split(",")
    .slice(0, labelCompletionChoice.finish_reason === "length" ? -1 : undefined)
    .map((label) => label.trim())
    .filter((label) => label.length <= 16);

  const synonyms = [];
  for (const coreLabel of coreLabels) {
    const synonymCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `「${coreLabel}」の類義語を半角カンマ区切りで列挙してください。`,
            },
          ],
        },
      ],
      max_tokens: 64,
    });
    const synonymCompletionChoice = synonymCompletion.choices[0];
    synonyms.push(
      ...(synonymCompletionChoice.message.content ?? "")
        .split(",")
        .slice(
          0,
          synonymCompletionChoice.finish_reason === "length" ? -1 : undefined
        )
        .map((synonym) => synonym.trim())
        .filter((synonym) => synonym.length <= 16)
    );
  }

  return [...coreLabels, ...synonyms];
};

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
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error();
    }

    return { latitude, longitude };
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
  const resizedDataURL = canvasElement.toDataURL("image/jpeg");
  const resizedBlob = await new Promise<Blob>((resolve, reject) => {
    canvasElement.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to resize image"));
        return;
      }
      resolve(blob);
    }, "image/jpeg");
  });

  return { resizedDataURL, resizedBlob };
};
