// editor/titleArtFitting.ts
// 생성된 키아트에 프리셋 효과 좌표를 맞춘다. 이미지 모델은 구도 지시를 대략만 따르므로
// (실측: 칼이 70-78% 대신 72-86%, 강이 52-63% 대신 40-60%), 생성 뒤 비전 모델에게 그림을 보여 주고
// 효과마다 앵커(해·칼날 선·강·안개 띠·불빛)를 JSON 으로 받아 좌표만 바꾼다.
// 앵커를 못 받거나 형식이 틀리면 그 효과는 프리셋 좌표를 그대로 쓴다 — 맞춤은 개선이지 필수가 아니다.
// 프리셋이 없으면(자유 모드) 비전 모델이 효과 종류까지 고른다. 받은 것이 없으면 카메라 호흡 하나로 떨어진다.
import { chatCompletion, loadAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import type { TitleEffect, TitleLogoStyle } from "@/project/types";
import type { TitleOpeningPreset } from "@/project/titleEffects";
import {
  defaultTitleEffect,
  isTitleEffectKind,
  MAX_TITLE_EFFECTS,
  normalizeTitleEffect,
  normalizeTitleLogoStyle,
  TITLE_LOGO_STYLES,
  titleOpeningPresetEffects,
} from "@/project/titleEffects";

export type TitleArtFitChat = (request: ChatRequest) => Promise<ChatResult>;

export type TitleArtFitResult = {
  readonly effects: TitleEffect[];
  /** 앵커로 좌표를 바꾼 효과의 인덱스. 비었으면 프리셋 좌표 그대로다. */
  readonly fitted: readonly number[];
  /** 자유 모드에서 모델이 고른 로고 질감. */
  readonly logoStyle?: TitleLogoStyle;
};

type Point = readonly [number, number];

const KIND_HINT: Partial<Record<TitleEffect["kind"], string>> = {
  godRays: "light rays: `source` = where the light comes from (sun/moon/gap in the canopy; may be slightly above the top edge, y<0), `toward` = where the rays land",
  motes: "floating light dust: `source` and `toward` along the same light beam as the rays",
  glint: "a shine that runs along a sword blade: `line` = [[x,y] of the blade tip or top end, [x,y] of the blade's other end], following the brightest blade",
  water: "rippling water: `box` = [left, top, right, bottom] of the visible water surface (river, lake, moat)",
  mist: "drifting mist: `box` = [left, top, right, bottom] of the hazy band (around mountains or the ground fog)",
  dapple: "sun dapples on the ground: `box` = [left, top, right, bottom] of the sunlit ground area",
  glow: "a flickering warm light: `source` = [x,y] of one lit window, lantern or fire",
  camera: "a very slow camera breathing (zoom/drift) over the whole picture; no coordinates",
};

const FREE_FALLBACK: readonly TitleEffect[] = [{ kind: "camera" }];

/** 비전 모델에게 줄 지시문. 좌표는 모두 그림 전체 기준 0..1(왼쪽 위 원점). */
export function buildTitleArtFitPrompt(preset: TitleOpeningPreset): string {
  const lines = titleOpeningPresetEffects(preset).flatMap((effect, index) => {
    const hint = KIND_HINT[effect.kind];
    return hint ? [`- index ${index}, kind ${effect.kind}: ${hint}`] : [];
  });
  return [
    "You are placing animated effects on top of this title-screen key art.",
    "All coordinates are fractions of the WHOLE image: x from 0 (left) to 1 (right), y from 0 (top) to 1 (bottom).",
    "For each effect below, look at the picture and return where it belongs. If the picture has nothing suitable for an effect, omit it.",
    ...lines,
    'Answer with one JSON object only: {"effects":[{"index":0,"source":[x,y],"toward":[x,y]},{"index":1,"line":[[x,y],[x,y]]},{"index":2,"box":[l,t,r,b]}]}',
  ].join("\n");
}

/** 자유 모드 지시문 — 효과 종류·자리·색·세기를 그림을 보고 고른다. */
export function buildTitleArtFreeFitPrompt(brief: string): string {
  const kinds = Object.entries(KIND_HINT).map(([kind, hint]) => `- ${kind}: ${hint}`);
  return [
    "You are directing subtle animated effects on top of this title-screen key art for a 2D JRPG.",
    ...(brief ? [`The author described the scene as: ${JSON.stringify(brief)}.`] : []),
    "All coordinates are fractions of the WHOLE image: x from 0 (left) to 1 (right), y from 0 (top) to 1 (bottom).",
    "Pick 3 to 8 effects that match what is actually painted (at most one camera). Only place an effect where the picture supports it: rays from a real light source, glints on real blades or crystals, water on real water, glow on real lamps/windows/fires.",
    "Available kinds and their anchors:",
    ...kinds,
    "For motes you may instead give `box` = [l,t,r,b] for dust/snow/petals/embers drifting over an area.",
    "Optional per effect: `color` as #rrggbb matching the light in the picture, `intensity` from 0.3 to 1.6 (1 = normal).",
    `Also pick the logo texture that suits the art: one of ${TITLE_LOGO_STYLES.join(", ")}.`,
    'Answer with one JSON object only: {"logoStyle":"gold","effects":[{"kind":"godRays","source":[x,y],"toward":[x,y],"color":"#ffe6a8"},{"kind":"water","box":[l,t,r,b]},{"kind":"glow","source":[x,y]},{"kind":"camera"}]}',
  ].join("\n");
}

function point(value: unknown, allowAbove = false): Point | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [x, y] = value;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  const minY = allowAbove ? -0.3 : 0;
  if (x < -0.05 || x > 1.05 || y < minY || y > 1.05) return undefined;
  return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(minY, y))];
}

function box(value: unknown): Point[] | undefined {
  if (!Array.isArray(value) || value.length !== 4 || !value.every((n) => typeof n === "number" && Number.isFinite(n))) return undefined;
  const [l, t, r, b] = (value as number[]).map((n) => Math.min(1, Math.max(0, n)));
  if (r - l < 0.02 || b - t < 0.02) return undefined;
  return [[l, t], [r, t], [r, b], [l, b]];
}

function round(p: Point): [number, number] {
  return [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
}

type Anchor = { source?: unknown; toward?: unknown; line?: unknown; box?: unknown };

/** 앵커 하나를 효과에 입힌다. 형식이 틀리면 건드리지 않고 false. */
function applyAnchor(effect: TitleEffect, anchor: Anchor, allowRegionMotes = false): boolean {
  if (effect.kind === "godRays" || effect.kind === "motes") {
    if (effect.kind === "motes" && allowRegionMotes && anchor.box !== undefined) {
      const region = box(anchor.box);
      if (!region) return false;
      delete effect.source;
      delete effect.toward;
      effect.region = region.map(round);
      return true;
    }
    const source = point(anchor.source, true);
    const toward = point(anchor.toward);
    // motes 는 영역형일 수도 있다. 빛 방향형일 때만 바꾼다.
    if (source && toward && effect.source && Math.hypot(toward[0] - source[0], toward[1] - source[1]) > 0.1) {
      effect.source = round(source);
      effect.toward = round(toward);
      return true;
    }
    return false;
  }
  if (effect.kind === "glint") {
    const line = Array.isArray(anchor.line) && anchor.line.length === 2 ? [point(anchor.line[0]), point(anchor.line[1])] : [];
    if (line[0] && line[1] && Math.hypot(line[1][0] - line[0][0], line[1][1] - line[0][1]) > 0.05) {
      effect.line = [round(line[0]), round(line[1])];
      return true;
    }
    return false;
  }
  if (effect.kind === "water" || effect.kind === "mist" || effect.kind === "dapple") {
    const region = box(anchor.box);
    if (!region) return false;
    effect.region = region.map(round);
    return true;
  }
  if (effect.kind === "glow") {
    const source = point(anchor.source);
    if (!source) return false;
    effect.source = round(source);
    return true;
  }
  return effect.kind === "camera" || effect.kind === "parallax";
}

function parseJsonObject(raw: string): unknown {
  try {
    return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/gu, ""));
  } catch {
    return undefined;
  }
}

/** 자유 모드 응답을 효과 목록으로 조립한다. 순수 함수. 쓸 만한 것이 없으면 카메라 호흡 하나. */
export function applyTitleArtFreeFit(raw: string): TitleArtFitResult {
  const parsed = parseJsonObject(raw) as { effects?: unknown; logoStyle?: unknown } | undefined;
  const logoStyle = normalizeTitleLogoStyle(parsed?.logoStyle);
  const effects: TitleEffect[] = [];
  let camera = false;
  let parallax = false;
  for (const entry of Array.isArray(parsed?.effects) ? parsed.effects : []) {
    if (effects.length >= MAX_TITLE_EFFECTS) break;
    if (!entry || typeof entry !== "object") continue;
    const { kind, color, intensity } = entry as { kind?: unknown; color?: unknown; intensity?: unknown };
    if (!isTitleEffectKind(kind)) continue;
    if (kind === "camera") {
      if (camera) continue;
      camera = true;
    }
    if (kind === "parallax") {
      if (parallax) continue;
      parallax = true;
    }
    const effect = defaultTitleEffect(kind);
    if (!applyAnchor(effect, entry as Anchor, true)) continue;
    if (typeof color === "string" && /^#[0-9a-f]{6}$/iu.test(color)) effect.color = color.toLowerCase();
    if (typeof intensity === "number" && Number.isFinite(intensity)) effect.intensity = Math.min(1.6, Math.max(0.3, intensity));
    const normalized = normalizeTitleEffect(effect);
    if (normalized) effects.push(normalized);
  }
  if (effects.length === 0) return { effects: FREE_FALLBACK.map((effect) => ({ ...effect })), fitted: [], ...(logoStyle ? { logoStyle } : {}) };
  return { effects, fitted: effects.map((_, index) => index), ...(logoStyle ? { logoStyle } : {}) };
}

/** 모델 응답(JSON 문자열)을 프리셋 효과에 입힌다. 순수 함수 — 테스트는 여기를 친다. */
export function applyTitleArtFit(preset: TitleOpeningPreset, raw: string): TitleArtFitResult {
  const effects = titleOpeningPresetEffects(preset);
  const fitted: number[] = [];
  const parsed = parseJsonObject(raw);
  const entries = (parsed as { effects?: unknown })?.effects;
  if (!Array.isArray(entries)) return { effects, fitted };
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const { index } = entry as { index?: unknown };
    if (typeof index !== "number" || !Number.isInteger(index) || fitted.includes(index)) continue;
    const effect = effects[index];
    if (!effect) continue;
    if (applyAnchor(effect, entry as Anchor)) fitted.push(index);
  }
  return { effects, fitted: fitted.sort((a, b) => a - b) };
}

/**
 * 키아트를 비전 모델에 보여 주고 효과를 맞춘다. 프리셋이 없으면 자유 모드(종류까지 고른다).
 * 실패는 프리셋 좌표 / 카메라 호흡으로 떨어진다(던지지 않는다, 취소만 던진다).
 */
export async function fitTitleArtEffects(
  preset: TitleOpeningPreset | undefined,
  dataUrl: string,
  options: { readonly signal?: AbortSignal; readonly chat?: TitleArtFitChat; readonly brief?: string } = {},
): Promise<TitleArtFitResult> {
  const chat = options.chat ?? ((request: ChatRequest) => chatCompletion(loadAiConfig(), request));
  try {
    const result = await chat({
      stream: false,
      signal: options.signal,
      response_format: { type: "json_object" },
      temperature: preset ? 0.1 : 0.3,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: preset ? buildTitleArtFitPrompt(preset) : buildTitleArtFreeFitPrompt(options.brief ?? "") },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      }],
    });
    const content = result.message.content;
    const text = typeof content === "string" ? content : Array.isArray(content)
      ? content.map((part) => (part.type === "text" ? part.text : "")).join("")
      : "";
    return preset ? applyTitleArtFit(preset, text) : applyTitleArtFreeFit(text);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return preset ? { effects: titleOpeningPresetEffects(preset), fitted: [] } : applyTitleArtFreeFit("");
  }
}
