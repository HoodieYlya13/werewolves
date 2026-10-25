import { MAX_PHOTO_LENGTH, PHOTO_SIZE } from "@/lib/protocol";

/**
 * Turns a picked or captured image into a small square JPEG data URL, cropped
 * from the centre, so photos stay light for the room server.
 */
export async function resizePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PHOTO_SIZE;
  const context = canvas.getContext("2d")!;
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_SIZE,
    PHOTO_SIZE,
  );
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.5]) {
    const data = canvas.toDataURL("image/jpeg", quality);
    if (data.length <= MAX_PHOTO_LENGTH) return data;
  }
  throw new Error("Photo too large");
}
