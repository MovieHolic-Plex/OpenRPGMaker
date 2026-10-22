// src/harnesses/_core/workshop/gateAdvice.ts
/**
 * 공방 후보의 3/4 관문(object-gate) **조언** — 다 그린 후보마다 관문과 같은 지시문(rules.ts OBJECT_GATE_RUBRIC)·같은 기준 그림
 * (view34-pairs·view34-guide)·같은 측정 글(facts.ts)로 판정자 한 번을 부르고, 관문 규칙(decideObjectGate)으로 pass/refer/fail 을 낸다.
 *
 * 효력: 없음. 공방 굽기는 이 게임에만 들어가므로 막지 않고 후보 카드에 배지로 보인다(사용자 결정 2026-10-21).
 * 판정자는 사용자 AI 계정 1표이고 보정된 프로필이 아니다 — 번들·공용·스토어 출구는 여전히 영수증(object-gate review)만 본다.
 */
import type { ChatMessage, ContentPart } from "@/ai/llmClient";
import {
  decideObjectGate, OBJECT_GATE_KINDS, OBJECT_GATE_OUTPUT_FORMAT, OBJECT_GATE_RUBRIC,
  type ObjectGateJudgeAnswer, type ObjectGateKind,
} from "@/harnesses/_core/objectGate/rules";
import { columnScan, widthProfile } from "@/harnesses/object-gate/node/facts";
import { extractJsonObject, renderGrid } from "./grid";
import type { GateAdvice, Grid, Palette, RgbaImage, WorkshopEnv, WorkshopItem } from "./types";

const GUIDE = "assets/harnesses/object-gate/view34-guide.png";
const PAIRS = "assets/harnesses/object-gate/view34-pairs.png";
const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];

/** 공방 기물의 관문 종류. 정의에 적힌 것이 있으면 그것, 없으면 놓는 방식으로. */
export function gateKindOf(item: WorkshopItem): ObjectGateKind {
  if (item.gateKind && Object.hasOwn(OBJECT_GATE_KINDS, item.gateKind)) return item.gateKind as ObjectGateKind;
  return item.kind === "hang" ? "wall_mounted" : item.kind === "flat" ? "flat" : "other";
}

/** judge.mts magnify 와 같은 그림: 10배(큰 그림은 줄임) + 1화소 격자 + 왼쪽 행 번호 눈금(2행마다). */
export function magnifyWithRuler(image: RgbaImage, maxScale = 10): RgbaImage {
  const { width, height, data: rgba } = image;
  const scale = Math.max(4, Math.min(maxScale, Math.floor(1000 / Math.max(width, height))));
  const L = 40, W = width * scale + L, H = height * scale;
  const out = new Uint8ClampedArray(W * H * 4);
  const put = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4, ia = a / 255;
    out[i] = Math.round(out[i]! * (1 - ia) + r * ia); out[i + 1] = Math.round(out[i + 1]! * (1 - ia) + g * ia);
    out[i + 2] = Math.round(out[i + 2]! * (1 - ia) + b * ia); out[i + 3] = 255;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, 88, 92, 104);
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
    const checker = (px + py) % 2 ? 78 : 98;
    const s = (py * width + px) * 4;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const x = L + px * scale + dx, y = py * scale + dy;
      put(x, y, checker, checker + 4, checker + 16);
      put(x, y, rgba[s]!, rgba[s + 1]!, rgba[s + 2]!, rgba[s + 3]!);
      if (dx === 0 || dy === 0) put(x, y, 0, 0, 0, 40);
    }
  }
  for (let py = 0; py < height; py += 2) {
    String(py).split("").forEach((ch, k) => {
      const bits = DIGITS[Number(ch)]!;
      for (let i = 0; i < 15; i++) if (bits[i] === "1") for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
        put(2 + k * 8 + (i % 3) * 2 + dx, py * scale + 1 + Math.floor(i / 3) * 2 + dy, 255, 255, 255);
    });
  }
  return { width: W, height: H, data: out };
}

/** 칠한 화소만 남긴 사각(관문은 잘라 낸 그림을 잰다 — 위 패딩 행이 행 번호를 밀지 않게). */
function cropOpaque(image: RgbaImage): RgbaImage {
  let x0 = image.width, y0 = image.height, x1 = -1, y1 = -1;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    if (image.data[(y * image.width + x) * 4 + 3]! < 128) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return image;
  const width = x1 - x0 + 1, height = y1 - y0 + 1, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) data.set(image.data.subarray(((y + y0) * image.width + x0) * 4, ((y + y0) * image.width + x1 + 1) * 4), y * width * 4);
  return { width, height, data };
}

const refCache = new Map<string, Promise<string>>();
function refUrl(env: WorkshopEnv, path: string): Promise<string> {
  let pending = refCache.get(path);
  if (!pending) {
    pending = env.loadImage(env.assetUrl(path)).then((image) => env.encodePng(image));
    pending.catch(() => refCache.delete(path));
    refCache.set(path, pending);
  }
  return pending;
}

/** 관문 3/4 호출 하나(judge.mts 의 view34 와 같은 지시문·그림 순서·측정 글). */
export async function gateAdviceMessages(item: WorkshopItem, grid: Grid, palette: Palette, env: WorkshopEnv): Promise<ChatMessage[]> {
  const kind = gateKindOf(item);
  const candidate = cropOpaque(renderGrid(grid, palette));
  const facts = { width: candidate.width, height: candidate.height, data: new Uint8Array(candidate.data.buffer, candidate.data.byteOffset, candidate.data.byteLength) };
  const image = (url: string): ContentPart => ({ type: "image_url", image_url: { url, detail: "high" } });
  const text = `Object name: ${item.title}\nKind: ${kind} — ${OBJECT_GATE_KINDS[kind]?.meaning ?? "other"}\n`
    + "Image 1 = the candidate magnified 10x with source row numbers on the left.\nImage 2 = REAL reference pairs (red frame = WRONG drawing, green frame = RIGHT drawing, same objects).\nImage 3 = the fixed synthetic GUIDE (green = right, red = wrong).\n\n"
    + `${columnScan(facts)}\n\n${widthProfile(facts)}`;
  const [pairs, guide] = await Promise.all([refUrl(env, PAIRS), refUrl(env, GUIDE)]);
  return [
    { role: "system", content: `${OBJECT_GATE_RUBRIC}\n\n${OBJECT_GATE_OUTPUT_FORMAT}` },
    { role: "user", content: [{ type: "text", text }, image(env.encodePng(magnifyWithRuler(candidate))), image(pairs), image(guide)] },
  ];
}

/** 판정자 답 → 관문 규칙(1표). 답을 못 읽으면 decideObjectGate 가 fail 로 센다. */
export function parseGateAdvice(item: WorkshopItem, text: string): GateAdvice {
  const kind = gateKindOf(item);
  let answer: ObjectGateJudgeAnswer | null = null;
  try { answer = extractJsonObject(text) as ObjectGateJudgeAnswer; } catch { answer = null; }
  const decision = decideObjectGate(kind, [answer]);
  return {
    state: decision.state,
    kind,
    reasons: decision.reasons.slice(0, 3),
    topRows: typeof answer?.main_top_rows === "number" ? answer.main_top_rows : null,
    readsAs: typeof answer?.reads_as === "string" ? answer.reads_as : "",
  };
}
