import { keyOutBackground } from "@/assets/generatedArtworkAlpha";

const MAX_ARTWORK_DIMENSION = 512;

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("생성 이미지를 디코딩하지 못했습니다."));
    image.src = dataUrl;
  });
}

function fittedSize(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_ARTWORK_DIMENSION) return { width, height };
  const scale = MAX_ARTWORK_DIMENSION / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function flattenGeneratedArtwork(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const size = fittedSize(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  context.drawImage(image, 0, 0, size.width, size.height);
  const pixels = context.getImageData(0, 0, size.width, size.height);
  keyOutBackground({ data: pixels.data, width: size.width, height: size.height });
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}
