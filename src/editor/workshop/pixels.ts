// src/editor/workshop/pixels.ts
/** 공방 실행기에 넘기는 브라우저 어댑터: 그림 읽기(canvas getImageData)·PNG 쓰기(toDataURL). */
import { onBackground, renderGrid, scaleImage } from "@/harnesses/_core/workshop/grid";
import type { Grid, Palette, Rgba, RgbaImage, WorkshopEnv, WorkshopTilesetSource } from "@/harnesses/_core/workshop/types";
import { parseRgbHexColor } from "@/assets/transparentColorKey";
import { tilesetBaseImageUrl } from "@/editor/tilesetImage";
import { store } from "@/project/store";

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

/**
 * 칩셋 읽기 결과를 칩셋(그림 주소·물체 수)마다 하나만 둔다. 작업 줄이 여러 판을 함께 돌리면 장마다 칩셋을 다시 읽어
 * 큰 시트(버들항 23,936칸)를 동시에 수십 번 풀고 훑느라 편집기가 몇 분씩 멈췄다(2026-10-21 10개 동시 실측). 실행기는 읽기만 한다.
 */
const SOURCE_CACHE = new Map<string, Promise<WorkshopTilesetSource | null>>();
const SOURCE_CACHE_LIMIT = 3;

function tilesetSource(tilesetId: string): Promise<WorkshopTilesetSource | null> {
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset) return Promise.resolve(null);
  const key = `${tilesetId}|${tilesetBaseImageUrl(tileset)}|${tileset.transparentColor ?? ""}|${tileset.structureKits?.length ?? 0}`;
  const hit = SOURCE_CACHE.get(key);
  if (hit) return hit;
  const pending = readTilesetSource(tilesetId).then((source) => {
    if (!source) SOURCE_CACHE.delete(key);
    return source;
  });
  SOURCE_CACHE.set(key, pending);
  while (SOURCE_CACHE.size > SOURCE_CACHE_LIMIT) SOURCE_CACHE.delete(SOURCE_CACHE.keys().next().value!);
  return pending;
}

/** 맵 기물 실행기에 지금 프로젝트의 칩셋을 넘긴다: 이식 없는 바탕 시트(투명색 키를 뺀 것)와 학습된 물체. */
async function readTilesetSource(tilesetId: string): Promise<WorkshopTilesetSource | null> {
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset) return null;
  let image: RgbaImage;
  try {
    image = await loadImage(tilesetBaseImageUrl(tileset));
  } catch {
    return null;
  }
  const key = parseRgbHexColor(tileset.transparentColor ?? "");
  if (key) {
    for (let i = 0; i < image.data.length; i += 4) {
      if (image.data[i] === key.r && image.data[i + 1] === key.g && image.data[i + 2] === key.b) image.data[i + 3] = 0;
    }
  }
  const objects = (tileset.structureKits ?? []).map((kit) => ({
    name: kit.name ?? kit.id,
    description: kit.ai?.description ?? "",
    layers: [kit.rows.map((row) => row.tiles), kit.rows.map((row) => row.upperTiles ?? [])],
  }));
  return { id: tileset.id, name: tileset.name, tileSize: tileset.tileSize, tilesPerRow: tileset.tilesPerRow, image, objects };
}

/** dev 빌드 QA 용: window.__oprnWorkshopImage(prompt) 가 있으면 참고 그림을 그것으로 만든다(시험 구동기가 자기 그림 경로로 잇는다 — 주소·키는 코드에 없다). */
export const WORKSHOP_FAKE_IMAGE_KEY = "__oprnWorkshopImage";

/**
 * 참고 그림(object-gen ref 단계) — 사용자 자기 그림 계정(설정 「이미지」 칸, 용도 object-form-reference). 그림 계정이 없으면 null(참고 없이 그린다).
 * 돌려준 그림은 판 기록에만 둔다. 칩셋·스토어·공용으로 가지 않는다.
 */
async function referenceImage(prompt: string, signal: AbortSignal): Promise<{ dataUrl: string; source: string } | null> {
  if (import.meta.env.DEV) {
    const fake = (window as unknown as Record<string, unknown>)[WORKSHOP_FAKE_IMAGE_KEY];
    if (typeof fake === "function") {
      const dataUrl = await (fake as (prompt: string) => Promise<string | null>)(prompt);
      return dataUrl ? { dataUrl, source: "dev-hook" } : null;
    }
  }
  const [{ generateAiImage }, { loadAiConfig }, { resolveImageRoute }, { companionCredentialMissing }] = await Promise.all([
    import("@/ai/imageGenerationClient"), import("@/ai/llmClient"), import("@/ai/imageRoute"), import("@/ai/chatgptOAuthClient"),
  ]);
  const route = resolveImageRoute("object-form-reference", loadAiConfig());
  if (route.kind !== "generative" || await companionCredentialMissing(route.providerId)) return null;
  const image = await generateAiImage({ prompt, purpose: "object-form-reference", signal });
  return { dataUrl: image.dataUrl, source: `${image.provider}/${image.model}` };
}

export function browserWorkshopEnv(): WorkshopEnv {
  return { loadImage, encodePng, tilesetSource, referenceImage, assetUrl: (path) => `${import.meta.env.BASE_URL}${path}` };
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
