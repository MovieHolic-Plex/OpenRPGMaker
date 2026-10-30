/**
 * 조수 도구 generate_battle_backdrop 의 편집기 쪽 실행 — 맵 그리기 → 이미지 모델(참고 그림) → 도트화 → PNG.
 * 등록·연결은 호출자(assistantSession)가 기존 쓰기 도구(upsert_resource → upsert_troop / set_map_properties)로 한다.
 * 핵심(프롬프트·팔레트·도트화·기계 검사)은 하네스 battle-backdrop 과 같은 src/editor/battleBackdropCore.ts.
 * 하네스는 후보 여럿을 사람이 고르지만, 조수 경로는 사용자의 프로젝트 안에서 한 장을 만들어 바로 건다(사용자가 편집기에서 보고 바꾼다).
 */
import { generateAiImage, ImageGenerationError, type GenerateAiImageRequest, type GeneratedImageAsset } from "@/ai/imageGenerationClient";
import {
  BACKDROP_STORE_SCALE, backdropMachineChecks, backdropPrompt, inferTimeAndLight, mapPalette, meanLuma, pixelizeBackdrop, rgbToHex, scaleNearest,
  type BackdropFacts, type MachineCheck, type Rgba,
} from "@/editor/battleBackdropCore";
import { renderMapCoverCanvas } from "@/editor/mapCoverRender";
import { loadTilesetImage } from "@/editor/mapTileDraw";
import { prepareBattleBackdropRequest, type BattleBackdropRequest } from "@/editor/tools/battleBackdropTools";
import { ToolError } from "@/editor/tools/types";
import type { Project } from "@/project/types";
import { genId } from "@/util/id";

export type BattleBackdropGenerationResult =
  | {
    readonly ok: true; readonly request: BattleBackdropRequest; readonly resourceId: string; readonly name: string; readonly dataUrl: string;
    readonly facts: Pick<BackdropFacts, "timeOfDay" | "timeCertain" | "light" | "indoor">; readonly checks: Record<string, MachineCheck>; readonly colors: number;
  }
  | { readonly ok: false; readonly summary: string; readonly code: string };

const CAPTURE_W = 480;
const CAPTURE_H = 270;

function canvasRgba(canvas: HTMLCanvasElement): Rgba {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("캔버스를 읽지 못했습니다.");
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return { width: canvas.width, height: canvas.height, data };
}

function rgbaCanvas(img: Rgba): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.width; canvas.height = img.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("캔버스를 만들지 못했습니다.");
  context.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return canvas;
}

async function decodeDataUrl(dataUrl: string): Promise<Rgba> {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("생성 그림을 읽지 못했습니다.");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvasRgba(canvas);
}

/** 런타임 조명과 같은 식으로 어둡게(곱하기). */
function applyLighting(img: Rgba, lighting: { ambient?: number; color?: string } | undefined): Rgba {
  const ambient = Math.min(0.55, Math.max(0, lighting?.ambient ?? 0));
  const m = /^#([0-9a-f]{6})$/iu.exec(lighting?.color ?? "");
  if (!(ambient > 0) || !m) return img;
  const tint = [0, 2, 4].map((at) => parseInt(m[1]!.slice(at, at + 2), 16));
  const data = new Uint8ClampedArray(img.data);
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c += 1) data[i + c] = Math.round(data[i + c]! * (1 - ambient) + tint[c]! * ambient);
  return { width: img.width, height: img.height, data };
}

export async function generateBattleBackdrop(
  project: Project,
  args: Record<string, unknown>,
  options: { readonly signal?: AbortSignal; readonly generateImage?: (request: GenerateAiImageRequest) => Promise<GeneratedImageAsset> } = {},
): Promise<BattleBackdropGenerationResult> {
  let request: BattleBackdropRequest;
  try {
    request = prepareBattleBackdropRequest(project, args);
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message, code: error.code ?? "invalid-args" };
    throw error;
  }
  const map = project.maps[request.mapId]!;
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return { ok: false, summary: `맵 ${map.id} 의 타일셋 ${map.tilesetId} 이 없습니다.`, code: "tileset-missing" };
  try {
    options.signal?.throwIfAborted();
    // 1. 맵 캡처 — 이벤트(캐릭터)는 빼고 타일만, 조명 적용.
    const image = await loadTilesetImage(tileset);
    const canvas = renderMapCoverCanvas({ ...map, events: [] }, tileset, image, CAPTURE_W, CAPTURE_H, request.focus ?? null);
    if (!canvas) return { ok: false, summary: "맵을 그리지 못했습니다.", code: "capture-failed" };
    const capture = applyLighting(canvasRgba(canvas), map.defaultLighting);
    const indoor = map.climate?.mode === "indoor" || /실내|indoor|interior/iu.test(tileset.name ?? "");
    const tl = inferTimeAndLight({ lighting: map.defaultLighting, texts: [...request.texts, map.name], indoor });
    const troop = request.troopId ? project.database.troops.find((t) => t.id === request.troopId) : undefined;
    const facts: BackdropFacts = {
      mapId: map.id, mapName: map.name, tilesetName: tileset.name ?? map.tilesetId, indoor,
      timeOfDay: tl.time, timeCertain: tl.certain, light: tl.light, evidence: tl.evidence,
      placeWords: [map.name, ...(troop ? [troop.name] : [])],
      captureLuma: meanLuma(capture),
      palette: mapPalette(capture).map(rgbToHex),
      ...(request.note ? { note: request.note } : {}),
    };
    const reference = rgbaCanvas(scaleNearest(capture, 2)).toDataURL("image/png");
    // 2. 생성.
    const generated = await (options.generateImage ?? generateAiImage)({
      prompt: backdropPrompt(facts, 0),
      referenceImages: [{ mimeType: "image/png", data: reference.slice(reference.indexOf(",") + 1) }],
      purpose: "backdrop",
      ...(options.signal ? { signal: options.signal } : {}),
    });
    options.signal?.throwIfAborted();
    // 3. 도트화(맵 팔레트) → 2배 저장.
    const raw = await decodeDataUrl(generated.dataUrl);
    const palette = facts.palette.map((hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const);
    const result = pixelizeBackdrop(raw, palette);
    const dataUrl = rgbaCanvas(scaleNearest(result.native, BACKDROP_STORE_SCALE)).toDataURL("image/png");
    return {
      ok: true, request, resourceId: genId("battle_backdrop"), name: `전투 배경 · ${map.name}`, dataUrl,
      facts: { timeOfDay: facts.timeOfDay, timeCertain: facts.timeCertain, light: facts.light, indoor },
      checks: backdropMachineChecks(result.native, facts), colors: result.colors,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, summary: `전투 배경 생성에 실패했습니다: ${message}`, code: error instanceof ImageGenerationError ? "image-generation-failed" : "battle-backdrop-failed" };
  }
}
