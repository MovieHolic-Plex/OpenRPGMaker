export interface MagentaChromaKeyOptions {
  readonly minRed?: number;
  readonly maxGreen?: number;
  readonly minBlue?: number;
}

const DEFAULT_MAGENTA_CHROMA_KEY_OPTIONS: Required<MagentaChromaKeyOptions> = {
  minRed: 220,
  maxGreen: 80,
  minBlue: 180,
};

export function isMagentaChromaKeyPixel(
  red: number,
  green: number,
  blue: number,
  options: MagentaChromaKeyOptions = {}
): boolean {
  const resolved = { ...DEFAULT_MAGENTA_CHROMA_KEY_OPTIONS, ...options };
  return red > resolved.minRed && green < resolved.maxGreen && blue > resolved.minBlue;
}

export function applyMagentaChromaKey(image: HTMLImageElement, options?: MagentaChromaKeyOptions): void {
  const apply = (): void => {
    if (image.dataset.chromaKeyed === "true") return;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width <= 0 || height <= 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const red = pixels.data[index] ?? 0;
      const green = pixels.data[index + 1] ?? 0;
      const blue = pixels.data[index + 2] ?? 0;
      if (isMagentaChromaKeyPixel(red, green, blue, options)) pixels.data[index + 3] = 0;
    }
    context.putImageData(pixels, 0, 0);
    image.dataset.chromaKeyed = "true";
    image.src = canvas.toDataURL("image/png");
  };
  if (image.complete) {
    apply();
    return;
  }
  image.addEventListener("load", apply, { once: true });
}

export function applyMagentaChromaKeyToImageData(imageData: ImageData, options?: MagentaChromaKeyOptions): void {
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    if (isMagentaChromaKeyPixel(red, green, blue, options)) data[index + 3] = 0;
  }
}
