// src/editor/workshop/pixels.ts
/** 공방 실행기에 넘기는 브라우저 어댑터: 그림 읽기(canvas getImageData)·PNG 쓰기(toDataURL). */
import { onBackground, renderGrid, scaleImage } from "@/harnesses/_core/workshop/grid";
import type { Grid, Palette, Rgba, RgbaImage, WorkshopEnv } from "@/harnesses/_core/workshop/types";

function canvasOf(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas 2d 를 못 연다");
  return context;
}

async function loadImage(url: string): Promise<RgbaImage> {
  const picture = new Image();
  picture.decoding = "async";
  picture.src = url;
  await picture.decode();
  const context = canvasOf(picture.naturalWidth, picture.naturalHeight);
  context.drawImage(picture, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, picture.naturalWidth, picture.naturalHeight);
  return { width, height, data };
}

function encodePng(image: RgbaImage): string {
  const context = canvasOf(image.width, image.height);
  context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  return context.canvas.toDataURL("image/png");
}

export function browserWorkshopEnv(): WorkshopEnv {
  return { loadImage, encodePng, assetUrl: (path) => `${import.meta.env.BASE_URL}${path}` };
}

const cache = new Map<string, string>();
/** 카드 그림. 같은 격자·배율은 다시 그리지 않는다(판 화면이 몇 초마다 다시 그려도 깜빡이지 않게). */
export function gridDataUrl(grid: Grid, palette: Palette, scale: number, background?: Rgba): string {
  const key = `${scale}|${background?.join(",") ?? ""}|${grid.width}x${grid.height}|${grid.cells.join(",")}`;
  let url = cache.get(key);
  if (!url) {
    const flat = renderGrid(grid, palette);
    url = encodePng(scaleImage(background ? onBackground(flat, background) : flat, scale));
    if (cache.size > 600) cache.clear();
    cache.set(key, url);
  }
  return url;
}
