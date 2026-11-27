// 고수준 오프닝 연출 도구(compose_opening) — 폴른 스타급 480×270 풀스크린 멀티레이어 오프닝을 1회 호출로 조립한다.
//
// 왜 필요한가(2026-11-27 실측 진단):
// 1) 저수준 도구 15~20회로 픽셀 좌표·앵커·키프레임을 손으로 맞추면 모델이 좌표/경고에 매달려 연출이 망가진다.
// 2) 384×216 pixelGrid 는 960×540 화면에서 정수 2배(768×432)로 줄어들어 사방 36%가 검은 테두리가 되고,
//    64색 RGB 양자화가 생성 CG·파노라마의 색감을 뭉개 버린다.
// 3) fallenStarOpening.ts 의 검증된 공식 — 480×270 + upscale:"nearest"(960×540 정확 2배 꽉 채움, 원색 보존),
//    4겹 시차 파노라마(tiled), 부드러운 Ken Burns 카메라, 박자(BPM) 기준 자막·효과음·전환 — 를
//    단일 선언형 도구로 제공해 고성능·중간 모델 모두 1회 호출로 완성도 높은 오프닝을 뽑게 한다.
import { STARTER_TITLE_BGM_ID } from "@/assets/bgmStarterTracks";
import { keepOpeningStage, type CinematicScene, type CinematicSequence } from "@/project/cinematicSettings";
import {
  validateOpeningAnimatic,
  type AnimaticAudioCue,
  type AnimaticCamera,
  type AnimaticKey,
  type AnimaticLayer,
  type AnimaticParticlePreset,
  type OpeningAnimatic,
} from "@/project/openingAnimatic";
import { openingMapViewCrop, openingMapViewResourceId } from "@/project/openingMapView";
import type { GameMap, Project } from "@/project/types";
import { catalogLookup, hasOpeningImage } from "./cinematicTools";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

const STAGE_W = 480;
const STAGE_H = 270;
const CX = STAGE_W / 2;
const CY = STAGE_H / 2;
const DEFAULT_LETTERBOX = 0.12;
const DEFAULT_CAPTION_COLOR = "#fff0dc";

export const DIRECTOR_TEMPLATES = [
  "key-cg",
  "map-tour",
  "title-card",
  "day-sky",
  "sunset-sky",
  "night-sky",
  "cloud-sea",
  "mountains",
  "sea",
] as const;
export type DirectorTemplate = (typeof DIRECTOR_TEMPLATES)[number];

export const DIRECTOR_MOODS = ["dark", "noir", "warm", "dusk", "bright"] as const;
export type DirectorMood = (typeof DIRECTOR_MOODS)[number];

export const DIRECTOR_MOTIONS = [
  "pan-right",
  "pan-left",
  "tilt-down",
  "tilt-up",
  "zoom-in",
  "zoom-out",
  "drift",
  "still",
] as const;
export type DirectorMotion = (typeof DIRECTOR_MOTIONS)[number];

export const DIRECTOR_FX = [
  "stars",
  "meteors",
  "petals",
  "snow",
  "rain",
  "sparks",
  "dust",
  "shaft",
  "glow",
  "flash-hit",
  "shake",
  "night-tint",
  "dawn-tint",
  "sepia-tint",
] as const;
export type DirectorFx = (typeof DIRECTOR_FX)[number];

export const DIRECTOR_SFX = ["none", "bell", "gong", "impact", "magic", "sword", "hit"] as const;
export type DirectorSfx = (typeof DIRECTOR_SFX)[number];

const SFX_RESOURCE: Record<Exclude<DirectorSfx, "none">, { id: string; dur: number; vol: number }> = {
  bell: { id: "cc0-se-osx-bell-01", dur: 2200, vol: 0.72 },
  gong: { id: "cc0-se-osx-gong-01", dur: 2600, vol: 0.75 },
  impact: { id: "cc0-se-osx-explosion", dur: 1800, vol: 0.78 },
  magic: { id: "cc0-se-ors-spell-01", dur: 1600, vol: 0.68 },
  sword: { id: "cc0-se-orp-battle-sword-unsheathe", dur: 1400, vol: 0.72 },
  hit: { id: "cc0-se-osx-hit-01", dur: 1100, vol: 0.72 },
};

const TRANSITION_KINDS = ["fade", "dither", "flash", "cut", "wipe-left", "wipe-right", "iris"] as const;
type DirectorTransition = (typeof TRANSITION_KINDS)[number];

export interface DirectorShotInput {
  readonly id?: string;
  readonly template: DirectorTemplate;
  readonly mood?: DirectorMood;
  readonly durationMs?: number;
  readonly resourceId?: string;
  readonly mapId?: string;
  readonly focus?: { readonly x: number; readonly y: number };
  readonly motion?: DirectorMotion;
  readonly fx?: readonly DirectorFx[];
  readonly sfx?: DirectorSfx;
  readonly transition?: DirectorTransition;
  readonly captions?: readonly string[];
  readonly captionColor?: string;
  readonly title?: string;
  readonly subtitle?: string;
}

type CamSpec = {
  readonly camera: AnimaticCamera;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
};

function snapToBeats(ms: number, beatMs: number): number {
  const beats = Math.max(4, Math.min(16, Math.round(ms / beatMs)));
  return Math.max(3000, Math.min(15000, Math.round(beats * beatMs)));
}

function defaultDurationMs(shot: DirectorShotInput, beatMs: number): number {
  if (typeof shot.durationMs === "number" && Number.isFinite(shot.durationMs)) {
    return Math.max(2500, Math.min(20000, Math.round(shot.durationMs)));
  }
  const captionChars = (shot.captions ?? []).reduce((n, line) => n + Array.from(line.trim()).length, 0);
  const readingMs = captionChars > 0 ? captionChars * 115 + 2400 : 0;
  const baseMs = shot.template === "title-card" ? beatMs * 7 : beatMs * 7;
  return snapToBeats(Math.max(baseMs, readingMs), beatMs);
}

/** 카메라 궤적 계산 — 파노라마는 넓게 이동, 단일 그림/맵뷰는 줌 마진 안에서 가장자리 노출 0% 보장. */
function buildCamera(motion: DirectorMotion, durationMs: number, wideTravel: boolean, shake: boolean, beatMs: number): CamSpec {
  const ease = "ease-in-out" as const;
  let xKeys: AnimaticKey[] | undefined;
  let yKeys: AnimaticKey[] | undefined;
  let zoomKeys: AnimaticKey[] | undefined;
  let zoom = 1;
  let x = CX;
  let y = CY;

  if (wideTravel) {
    // 타일링 파노라마 — 줌 1 유지, 넉넉한 시차 이동(세계 좌표: 0ms 에서 ±25% 밖이 아니므로 중심 기준 오프셋으로 동작)
    switch (motion) {
      case "pan-right":
        xKeys = [{ atMs: 0, value: -36 }, { atMs: durationMs, value: 36, ease }];
        x = -36; y = 0;
        break;
      case "pan-left":
        xKeys = [{ atMs: 0, value: 36 }, { atMs: durationMs, value: -36, ease }];
        x = 36; y = 0;
        break;
      case "tilt-down":
        yKeys = [{ atMs: 0, value: -26 }, { atMs: durationMs, value: 26, ease }];
        x = 0; y = -26;
        break;
      case "tilt-up":
        yKeys = [{ atMs: 0, value: 26 }, { atMs: durationMs, value: -26, ease }];
        x = 0; y = 26;
        break;
      case "zoom-in":
        zoom = 1.02;
        zoomKeys = [{ atMs: 0, value: 1.02 }, { atMs: durationMs, value: 1.14, ease }];
        x = 0; y = 0;
        break;
      case "zoom-out":
        zoom = 1.14;
        zoomKeys = [{ atMs: 0, value: 1.14 }, { atMs: durationMs, value: 1.02, ease }];
        x = 0; y = 0;
        break;
      case "drift":
        xKeys = [{ atMs: 0, value: -22 }, { atMs: durationMs, value: 22, ease }];
        yKeys = [{ atMs: 0, value: -10 }, { atMs: durationMs, value: 10, ease }];
        x = -22; y = -10;
        break;
      case "still":
        x = 0; y = 0;
        break;
    }
  } else {
    // 단일 CG / 맵뷰 — 줌 여유(>=1.10)를 확보해 팬/틸트 중 검은 틈이 절대 보이지 않게 한다.
    switch (motion) {
      case "pan-right":
        zoom = 1.12; x = -14; y = 0;
        xKeys = [{ atMs: 0, value: -14 }, { atMs: durationMs, value: 14, ease }];
        zoomKeys = [{ atMs: 0, value: 1.11 }, { atMs: durationMs, value: 1.14, ease }];
        break;
      case "pan-left":
        zoom = 1.12; x = 14; y = 0;
        xKeys = [{ atMs: 0, value: 14 }, { atMs: durationMs, value: -14, ease }];
        zoomKeys = [{ atMs: 0, value: 1.11 }, { atMs: durationMs, value: 1.14, ease }];
        break;
      case "tilt-down":
        zoom = 1.12; x = 0; y = -8;
        yKeys = [{ atMs: 0, value: -8 }, { atMs: durationMs, value: 8, ease }];
        break;
      case "tilt-up":
        zoom = 1.12; x = 0; y = 8;
        yKeys = [{ atMs: 0, value: 8 }, { atMs: durationMs, value: -8, ease }];
        break;
      case "zoom-in":
        zoom = 1.03; x = 0; y = 0;
        zoomKeys = [{ atMs: 0, value: 1.03 }, { atMs: durationMs, value: 1.15, ease }];
        break;
      case "zoom-out":
        zoom = 1.15; x = 0; y = 0;
        zoomKeys = [{ atMs: 0, value: 1.15 }, { atMs: durationMs, value: 1.03, ease }];
        break;
      case "drift":
        zoom = 1.08; x = -8; y = -4;
        xKeys = [{ atMs: 0, value: -8 }, { atMs: durationMs, value: 8, ease }];
        yKeys = [{ atMs: 0, value: -4 }, { atMs: durationMs, value: 4, ease }];
        zoomKeys = [{ atMs: 0, value: 1.07 }, { atMs: durationMs, value: 1.13, ease }];
        break;
      case "still":
        zoom = 1.01; x = 0; y = 0;
        break;
    }
  }

  const keys: NonNullable<AnimaticCamera["keys"]> = {
    ...(xKeys ? { x: xKeys } : {}),
    ...(yKeys ? { y: yKeys } : {}),
    ...(zoomKeys ? { zoom: zoomKeys } : {}),
  };
  const shakeAt = Math.min(durationMs - 400, Math.round(beatMs * 1.5));
  const camera: AnimaticCamera = {
    x,
    y,
    zoom,
    ...(Object.keys(keys).length ? { keys } : {}),
    ...(shake && durationMs >= 800 ? { shake: { atMs: Math.max(0, shakeAt), durationMs: Math.min(480, durationMs - Math.max(0, shakeAt)), amplitude: 4.5, frequency: 24, seed: 17 } } : {}),
  };
  const xs = (xKeys ?? [{ atMs: 0, value: x }]).map((k) => CX + k.value);
  const ys = (yKeys ?? [{ atMs: 0, value: y }]).map((k) => CY + k.value);
  return { camera, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** 이음매 없는 파노라마를 카메라 이동 범위 전체에 바둑판 배치(fallenStarOpening.ts 의 tiled 공식). */
function tiled(
  prefix: string,
  resourceId: string,
  tile: { w: number; h: number },
  scale: number,
  parallax: number,
  cam: CamSpec,
  extra: Partial<AnimaticLayer> = {},
): AnimaticLayer[] {
  const margin = 16;
  const x0 = (cam.minX - CX) * parallax - margin;
  const x1 = STAGE_W + (cam.maxX - CX) * parallax + margin;
  const y0 = (cam.minY - CY) * parallax - margin;
  const y1 = STAGE_H + (cam.maxY - CY) * parallax + margin;
  const w = Math.round(tile.w * scale);
  const h = Math.round(tile.h * scale);
  const out: AnimaticLayer[] = [];
  for (let x = Math.floor(x0); x < x1; x += w) {
    for (let y = Math.floor(y0); y < y1; y += h) {
      out.push({
        id: `${prefix}-${out.length}`,
        kind: "image",
        role: "background",
        resourceId,
        sampling: "nearest",
        anchorX: 0,
        anchorY: 0,
        x,
        y,
        width: w,
        height: h,
        parallax,
        ...extra,
      });
    }
  }
  return out;
}

/** 수평(지평선형) 파노라마 한 줄을 카메라 이동 폭 전체에 배치. */
function horizonStrip(
  prefix: string,
  resourceId: string,
  parallax: number,
  cam: CamSpec,
  extra: Partial<AnimaticLayer> = {},
): AnimaticLayer[] {
  const w = STAGE_W;
  const h = STAGE_H;
  const margin = 16;
  const x0 = (cam.minX - CX) * parallax - margin;
  const x1 = STAGE_W + (cam.maxX - CX) * parallax + margin;
  const start = Math.floor(x0 / w) * w;
  const out: AnimaticLayer[] = [];
  for (let x = start; x < x1; x += w) {
    out.push({
      id: `${prefix}-${out.length}`,
      kind: "image",
      role: "background",
      resourceId,
      sampling: "nearest",
      anchorX: 0,
      anchorY: 0,
      x,
      y: 0,
      width: w,
      height: h,
      parallax,
      ...extra,
    });
  }
  return out;
}

function buildPanoramaLayers(template: DirectorTemplate, cam: CamSpec): { layers: AnimaticLayer[]; background: string; defaultFx: DirectorFx[] } {
  switch (template) {
    case "night-sky":
      return {
        background: "#03050d",
        defaultFx: ["stars"],
        layers: [
          ...tiled("sky-nebula", "oprn-pano-night", { w: 320, h: 256 }, 1.5, 0.15, cam),
          ...tiled("sky-stars-far", "oprn-pano-night-stars-far", { w: 320, h: 256 }, 1, 0.35, cam),
          ...tiled("sky-stars-near", "oprn-pano-night-stars-near", { w: 320, h: 256 }, 1.5, 0.65, cam, { opacity: 0.92 }),
        ],
      };
    case "sunset-sky":
      return {
        background: "#1a0d16",
        defaultFx: ["dust"],
        layers: [
          ...horizonStrip("sunset-base", "oprn-pano-sunset", 0.12, cam),
          ...horizonStrip("sunset-clouds", "oprn-pano-sunset-clouds", 0.35, cam),
          ...horizonStrip("sunset-skyline", "oprn-pano-sunset-skyline", 0.6, cam, { opacity: 0.92 }),
        ],
      };
    case "day-sky":
      return {
        background: "#1c4a78",
        defaultFx: ["shaft"],
        layers: [
          ...horizonStrip("day-base", "oprn-pano-sky-day", 0.1, cam),
          ...horizonStrip("day-clouds-far", "oprn-pano-sky-day-clouds-far", 0.3, cam),
          ...horizonStrip("day-clouds-near", "oprn-pano-sky-day-clouds-near", 0.6, cam),
        ],
      };
    case "cloud-sea":
      return {
        background: "#122238",
        defaultFx: ["glow"],
        layers: [
          ...horizonStrip("csea-base", "oprn-pano-cloud-sea", 0.15, cam),
          ...horizonStrip("csea-mid", "oprn-pano-cloud-sea-mid", 0.4, cam),
          ...horizonStrip("csea-near", "oprn-pano-cloud-sea-near", 0.7, cam),
        ],
      };
    case "mountains":
      return {
        background: "#0d1a24",
        defaultFx: ["dust"],
        layers: [
          ...horizonStrip("mnt-sky", "oprn-pano-far-mountains", 0.12, cam),
          ...horizonStrip("mnt-ridges", "oprn-pano-far-mountains-ridges", 0.35, cam),
          ...horizonStrip("mnt-forest", "oprn-pano-far-mountains-forest", 0.65, cam),
        ],
      };
    case "sea":
      return {
        background: "#081b2e",
        defaultFx: ["glow"],
        layers: [
          ...tiled("sea-base", "oprn-pano-sea", { w: 256, h: 256 }, 1.25, 0.35, cam),
          ...tiled("sea-waves", "oprn-pano-sea-waves", { w: 256, h: 256 }, 1.25, 0.7, cam, { opacity: 0.75 }),
        ],
      };
    default:
      return { background: "#05070e", defaultFx: [], layers: [] };
  }
}

function buildFxLayers(fxList: readonly DirectorFx[], durationMs: number, beatMs: number, seed: number): AnimaticLayer[] {
  const layers: AnimaticLayer[] = [];
  const seen = new Set<DirectorFx>();
  const addParticles = (id: string, preset: AnimaticParticlePreset, color: string, count: number, speed: number, size: number, extra: Partial<AnimaticLayer> = {}) => {
    layers.push({
      id,
      kind: "particles",
      role: "effect",
      space: "screen",
      anchorX: 0,
      anchorY: 0,
      x: 0,
      y: 0,
      width: STAGE_W,
      height: STAGE_H,
      color,
      blend: "lighter",
      opacity: preset === "rain" ? 0.55 : 0.8,
      particles: { preset, count, seed: seed + layers.length * 13, speed, size },
      ...extra,
    });
  };
  for (const fx of fxList) {
    if (seen.has(fx)) continue;
    seen.add(fx);
    switch (fx) {
      case "stars":
        addParticles("fx-stars", "stars", "#e8f2ff", 48, 5, 1.2, { opacity: 0.72 });
        break;
      case "meteors":
        addParticles("fx-meteors", "meteors", "#a8e0ff", 9, 280, 2, { opacity: 0.95, rotation: 28 });
        break;
      case "petals":
        addParticles("fx-petals", "petals", "#ffd6e6", 34, 24, 2.2, { blend: "source-over", opacity: 0.85 });
        break;
      case "snow":
        addParticles("fx-snow", "snow", "#eef6ff", 56, 22, 1.8, { blend: "source-over", opacity: 0.78 });
        break;
      case "rain":
        addParticles("fx-rain", "rain", "#b8d6f0", 72, 260, 1.2, { blend: "source-over", opacity: 0.5 });
        break;
      case "sparks":
        addParticles("fx-sparks", "sparks", "#ffbe6b", 38, 36, 1.8, { opacity: 0.88 });
        break;
      case "dust":
        addParticles("fx-dust", "dust", "#ffe9be", 32, 12, 1.6, { opacity: 0.65 });
        break;
      case "shaft":
        layers.push({
          id: "fx-shaft",
          kind: "shaft",
          role: "effect",
          space: "screen",
          anchorX: 0,
          anchorY: 0,
          x: 280,
          y: -16,
          width: 150,
          height: 310,
          rotation: -18,
          color: "#ffe8b4",
          blend: "lighter",
          opacity: 0.42,
          shaft: { spread: 0.58, softness: 0.75, dust: { count: 22, seed: seed + 31, speed: 10, size: 1.5 }, pulse: { hz: 0.35, amount: 0.18, pattern: "pulse", seed: seed + 5 } },
        });
        break;
      case "glow":
        layers.push({
          id: "fx-glow",
          kind: "glow",
          role: "effect",
          space: "screen",
          anchorX: 0.5,
          anchorY: 0.5,
          x: CX,
          y: Math.round(STAGE_H * 0.44),
          width: 320,
          height: 220,
          color: "#9fd8ff",
          blend: "lighter",
          opacity: 0.2,
          glow: { inner: 0.08, pulse: { hz: 0.55, amount: 0.2, pattern: "pulse", seed: seed + 9 } },
        });
        break;
      case "flash-hit": {
        const hitAt = Math.min(Math.max(120, durationMs - 520), Math.round(beatMs * 1.5));
        const t0 = Math.max(0, hitAt);
        const tPeak = Math.min(durationMs - 100, t0 + 90);
        const tEnd = Math.min(durationMs, tPeak + 360);
        layers.push({
          id: "fx-flash",
          kind: "shape",
          shape: "rect",
          role: "effect",
          space: "screen",
          anchorX: 0,
          anchorY: 0,
          x: 0,
          y: 0,
          width: STAGE_W,
          height: STAGE_H,
          color: "#fff8e8",
          blend: "lighter",
          opacity: 0,
          keys: {
            opacity: [
              { atMs: 0, value: 0 },
              ...(t0 > 0 ? [{ atMs: t0, value: 0 }] : []),
              { atMs: tPeak, value: 0.72, ease: "ease-out" },
              { atMs: tEnd, value: 0, ease: "ease-in" },
            ],
          },
        });
        break;
      }
      case "night-tint":
        layers.push({
          id: "fx-tint-night",
          kind: "shape",
          shape: "rect",
          role: "effect",
          space: "screen",
          anchorX: 0,
          anchorY: 0,
          x: 0,
          y: 0,
          width: STAGE_W,
          height: STAGE_H,
          color: "#0b1533",
          blend: "multiply",
          opacity: 0.42,
        });
        break;
      case "dawn-tint":
        layers.push({
          id: "fx-tint-dawn",
          kind: "shape",
          shape: "rect",
          role: "effect",
          space: "screen",
          anchorX: 0,
          anchorY: 0,
          x: 0,
          y: 0,
          width: STAGE_W,
          height: STAGE_H,
          color: "#ff9a5c",
          blend: "screen",
          opacity: 0.16,
        });
        break;
      case "sepia-tint":
        layers.push({
          id: "fx-tint-sepia",
          kind: "shape",
          shape: "rect",
          role: "effect",
          space: "screen",
          anchorX: 0,
          anchorY: 0,
          x: 0,
          y: 0,
          width: STAGE_W,
          height: STAGE_H,
          color: "#7a5832",
          blend: "multiply",
          opacity: 0.34,
        });
        break;
      case "shake":
        // 카메라 shake 로 처리됨
        break;
    }
  }
  return layers;
}

function buildCaptionLayer(lines: readonly string[], durationMs: number, beatMs: number, color: string): AnimaticLayer | undefined {
  const clean = lines.map((line) => line.replace(/\s+/gu, " ").trim()).filter(Boolean).slice(0, 4);
  if (!clean.length) return undefined;
  const startAt = Math.min(Math.round(beatMs * 0.5), Math.max(150, durationMs - 1400));
  const fadeOutMs = Math.min(420, Math.max(180, Math.round(durationMs * 0.08)));
  const span = Math.max(800, durationMs - startAt - fadeOutMs - 180);
  const step = Math.floor(span / clean.length);
  const cues = clean.map((text, index) => ({
    atMs: startAt + index * step,
    text: text.slice(0, 200),
    color,
    typewriterMs: Math.min(Math.max(320, Array.from(text).length * 32), Math.max(320, step - 300)),
  }));
  return {
    id: "caption",
    kind: "caption",
    anchorX: 0,
    anchorY: 0,
    x: 0,
    y: 0,
    width: STAGE_W,
    height: 36,
    color,
    typography: { fontSize: 15, align: "center", weight: 700 },
    startMs: startAt,
    endMs: Math.max(startAt + 400, durationMs - 120),
    caption: { cues, fadeOutMs },
  };
}

function buildTitleOverlayLayers(title: string, subtitle: string | undefined, durationMs: number, beatMs: number, isTitleCard: boolean): AnimaticLayer[] {
  const layers: AnimaticLayer[] = [];
  const appearAt = Math.max(120, Math.min(isTitleCard ? Math.round(beatMs * 0.75) : Math.round(durationMs * 0.35), durationMs - 1400));
  const settleAt = Math.min(durationMs - 700, appearAt + 620);
  const fadeOutStart = Math.max(settleAt + 250, durationMs - 450);

  // 가독성을 위한 은은한 뒤 어둠 띠 (글자가 밝은 구름/바다 위에서도 선명하게 읽히도록)
  const scrimOpacity: AnimaticKey[] = [
    { atMs: 0, value: 0 },
    { atMs: appearAt, value: 0 },
    { atMs: settleAt, value: isTitleCard ? 0.48 : 0.36, ease: "ease-out" },
  ];
  if (fadeOutStart < durationMs) {
    scrimOpacity.push({ atMs: fadeOutStart, value: isTitleCard ? 0.48 : 0.36 }, { atMs: durationMs, value: 0, ease: "ease-in" });
  }
  layers.push({
    id: "title-scrim",
    kind: "shape",
    shape: "rect",
    role: "effect",
    space: "screen",
    anchorX: 0,
    anchorY: 0.5,
    x: 0,
    y: Math.round(STAGE_H * 0.45),
    width: STAGE_W,
    height: subtitle ? 86 : 62,
    color: "#050914",
    opacity: 0,
    keys: { opacity: scrimOpacity },
  });

  // 메인 타이틀 텍스트
  const titleFont = Array.from(title).length > 14 ? 22 : 26;
  const headingOpacity: AnimaticKey[] = [
    { atMs: 0, value: 0 },
    { atMs: appearAt, value: 0 },
    { atMs: settleAt, value: 1, ease: "ease-out" },
  ];
  if (fadeOutStart < durationMs) {
    headingOpacity.push({ atMs: fadeOutStart, value: 1 }, { atMs: durationMs, value: 0, ease: "ease-in" });
  }
  layers.push({
    id: "title-heading",
    kind: "text",
    role: "credit",
    space: "screen",
    anchorX: 0,
    anchorY: 0.5,
    x: 24,
    y: Math.round(STAGE_H * (subtitle ? 0.41 : 0.45)),
    width: STAGE_W - 48,
    height: 44,
    text: title,
    color: "#f5f8ff",
    typography: { fontSize: titleFont, align: "center", weight: 700 },
    opacity: 0,
    keys: {
      opacity: headingOpacity,
      y: [
        { atMs: appearAt, value: Math.round(STAGE_H * (subtitle ? 0.44 : 0.48)) },
        { atMs: settleAt, value: Math.round(STAGE_H * (subtitle ? 0.41 : 0.45)), ease: "ease-out" },
      ],
    },
  });

  if (subtitle?.trim()) {
    const subAt = Math.min(fadeOutStart - 320, settleAt + 200);
    const subSettle = Math.min(fadeOutStart - 60, subAt + 420);
    const subOpacity: AnimaticKey[] = [{ atMs: 0, value: 0 }];
    if (subAt > 0) subOpacity.push({ atMs: subAt, value: 0 });
    if (subSettle > subAt) subOpacity.push({ atMs: subSettle, value: 0.92, ease: "ease-out" });
    if (fadeOutStart < durationMs && fadeOutStart > subSettle) {
      subOpacity.push({ atMs: fadeOutStart, value: 0.92 }, { atMs: durationMs, value: 0, ease: "ease-in" });
    }
    layers.push({
      id: "title-subtitle",
      kind: "text",
      role: "credit",
      space: "screen",
      anchorX: 0,
      anchorY: 0.5,
      x: 36,
      y: Math.round(STAGE_H * 0.53),
      width: STAGE_W - 72,
      height: 26,
      text: subtitle.trim(),
      color: "#d4e3ff",
      typography: { fontSize: 12, align: "center", weight: 500 },
      opacity: 0,
      keys: { opacity: subOpacity },
    });
  }
  return layers;
}

function buildSfxCue(project: Project, sfx: DirectorSfx | undefined, durationMs: number, beatMs: number, isTitleCard: boolean): AnimaticAudioCue[] {
  if (!sfx || sfx === "none") return [];
  const spec = SFX_RESOURCE[sfx];
  if (!spec || !catalogLookup(project)("sound", spec.id)) return [];
  const atMs = Math.min(durationMs - 200, Math.max(0, Math.round(isTitleCard ? beatMs * 0.75 : beatMs * 1.5)));
  const dur = Math.min(spec.dur, Math.max(1, durationMs - atMs));
  return [{ id: `sfx-${sfx}`, resourceId: spec.id, atMs, durationMs: dur, volume: spec.vol, fadeOutMs: Math.min(260, dur) }];
}

function buildMapTourBackground(project: Project, shot: DirectorShotInput): AnimaticLayer {
  const mapId = shot.mapId?.trim() || project.startMapId;
  const map: GameMap | undefined = project.maps[mapId];
  if (!map) throw new ToolError(`map-tour 대상 맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found" });
  const focus = shot.focus ?? (mapId === project.startMapId ? project.startPos : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) });
  const crop = openingMapViewCrop(map, { width: STAGE_W, height: STAGE_H }, focus, 1.5);
  return {
    id: "map-bg",
    kind: "image",
    role: "background",
    resourceId: openingMapViewResourceId(mapId),
    anchorX: 0,
    anchorY: 0,
    x: 0,
    y: 0,
    width: STAGE_W,
    height: STAGE_H,
    sampling: "nearest",
    crop,
  };
}

function defaultMotionFor(template: DirectorTemplate, index: number): DirectorMotion {
  switch (template) {
    case "night-sky": return "tilt-down";
    case "sunset-sky":
    case "day-sky":
    case "cloud-sea":
    case "mountains":
    case "sea": return index % 2 === 0 ? "pan-right" : "drift";
    case "key-cg": return index % 2 === 0 ? "zoom-in" : "drift";
    case "map-tour": return "pan-right";
    case "title-card": return "zoom-out";
  }
}

function defaultTransitionFor(template: DirectorTemplate, index: number): DirectorTransition {
  if (index === 0) return "fade";
  if (template === "title-card") return "flash";
  return index % 2 === 1 ? "dither" : "fade";
}

function buildDirectorShot(project: Project, input: DirectorShotInput, index: number, beatMs: number, letterbox: number): CinematicScene {
  const template = input.template;
  if (!(DIRECTOR_TEMPLATES as readonly string[]).includes(template)) {
    throw new ToolError(`shots[${index}].template 은 ${DIRECTOR_TEMPLATES.join("/")} 중 하나여야 합니다.`, { code: "invalid-args" });
  }
  const id = (input.id?.trim() || `op_shot_${index + 1}`).slice(0, 100);
  const durationMs = defaultDurationMs(input, beatMs);
  const motion: DirectorMotion = input.motion && (DIRECTOR_MOTIONS as readonly string[]).includes(input.motion)
    ? input.motion
    : defaultMotionFor(template, index);
  const fxInput = Array.isArray(input.fx) ? input.fx : [];
  const isParallax = template === "night-sky" || template === "sunset-sky" || template === "day-sky" || template === "cloud-sea" || template === "mountains" || template === "sea";
  const cam = buildCamera(motion, durationMs, isParallax, fxInput.includes("shake"), beatMs);

  let background = "#04060e";
  const layers: AnimaticLayer[] = [];
  let autoFx: DirectorFx[] = [];

  if (isParallax) {
    const pano = buildPanoramaLayers(template, cam);
    background = pano.background;
    layers.push(...pano.layers);
    autoFx = pano.defaultFx;
  } else if (template === "key-cg") {
    const resourceId = input.resourceId?.trim();
    if (!resourceId || !hasOpeningImage(project, resourceId)) {
      throw new ToolError(`shots[${index}] (key-cg) 에는 실제 그림 resourceId 가 필요합니다(generate_art{target:'opening'} 또는 list_opening_media).`, { code: "resource-not-found" });
    }
    layers.push({
      id: "cg-bg",
      kind: "image",
      role: "background",
      resourceId,
      anchorX: 0,
      anchorY: 0,
      x: 0,
      y: 0,
      width: STAGE_W,
      height: STAGE_H,
      // 생성 CG / 스틸은 부드러운 축소(linear)로 480×270 원색을 온전히 유지한다(pixelGrid 64색 뭉개기 없음).
      sampling: "linear",
    });
  } else if (template === "map-tour") {
    layers.push(buildMapTourBackground(project, input));
  } else if (template === "title-card") {
    const resourceId = input.resourceId?.trim();
    if (resourceId && hasOpeningImage(project, resourceId)) {
      layers.push({
        id: "title-bg",
        kind: "image",
        role: "background",
        resourceId,
        anchorX: 0,
        anchorY: 0,
        x: 0,
        y: 0,
        width: STAGE_W,
        height: STAGE_H,
        sampling: "linear",
      });
    } else {
      // 장르 중립 타이틀 배경(밤하늘·별 강제 없음) — mood 에 따라 어두운 톤·느와르·따뜻한 톤·노을·밝은 톤 단색+은은한 빛으로 구성.
      const mood: DirectorMood = input.mood && (DIRECTOR_MOODS as readonly string[]).includes(input.mood) ? input.mood : "dark";
      const moodPalette: Record<DirectorMood, { bg: string; band: string; glow: string; fx: DirectorFx[] }> = {
        dark: { bg: "#090c14", band: "#151c2e", glow: "#7aa6d6", fx: ["dust"] },
        noir: { bg: "#07090d", band: "#181d26", glow: "#68c4e8", fx: ["rain"] },
        warm: { bg: "#1c120d", band: "#332017", glow: "#f2b872", fx: ["dust"] },
        dusk: { bg: "#1a1019", band: "#331c2c", glow: "#e88d67", fx: ["dust"] },
        bright: { bg: "#162638", band: "#25405c", glow: "#cfe8ff", fx: ["shaft"] },
      };
      const pal = moodPalette[mood];
      background = pal.bg;
      layers.push(
        {
          id: "title-mood-band",
          kind: "shape",
          shape: "rect",
          role: "background",
          space: "screen",
          anchorX: 0,
          anchorY: 0.5,
          x: 0,
          y: CY,
          width: STAGE_W,
          height: Math.round(STAGE_H * 0.62),
          color: pal.band,
          opacity: 0.55,
        },
        {
          id: "title-mood-glow",
          kind: "glow",
          role: "effect",
          space: "screen",
          anchorX: 0.5,
          anchorY: 0.5,
          x: CX,
          y: Math.round(STAGE_H * 0.46),
          width: 340,
          height: 200,
          color: pal.glow,
          blend: "lighter",
          opacity: 0.22,
          glow: { inner: 0.08, pulse: { hz: 0.45, amount: 0.18, pattern: "pulse", seed: 71 } },
        },
      );
      autoFx = pal.fx;
    }
  }

  const combinedFx = fxInput.length > 0 ? fxInput : autoFx;
  layers.push(...buildFxLayers(combinedFx, durationMs, beatMs, (index + 1) * 53));

  const titleText = input.title?.trim() || (template === "title-card" ? (project.system.titleScreen?.title || project.meta.title || "제목 없는 이야기") : undefined);
  if (titleText) {
    layers.push(...buildTitleOverlayLayers(titleText, input.subtitle, durationMs, beatMs, template === "title-card"));
  }

  const captionColor = input.captionColor && /^#[0-9a-f]{6}$/iu.test(input.captionColor) ? input.captionColor : DEFAULT_CAPTION_COLOR;
  const captionLayer = buildCaptionLayer(input.captions ?? [], durationMs, beatMs, captionColor);
  if (captionLayer) layers.push(captionLayer);

  const transKind = input.transition && (TRANSITION_KINDS as readonly string[]).includes(input.transition)
    ? input.transition
    : defaultTransitionFor(template, index);
  const transition: OpeningAnimatic["transition"] = transKind === "cut"
    ? { kind: "cut", durationMs: 0 }
    : {
      kind: transKind,
      durationMs: transKind === "flash" ? 280 : transKind === "dither" ? 600 : 550,
      color: transKind === "flash" ? "#fff6de" : "#04060e",
    };

  const audioCues = buildSfxCue(project, input.sfx, durationMs, beatMs, template === "title-card");
  const composition: OpeningAnimatic = {
    width: STAGE_W,
    height: STAGE_H,
    background,
    letterbox,
    upscale: "smooth",
    layers,
    camera: cam.camera,
    transition,
    ...(audioCues.length ? { audioCues } : {}),
  };
  validateOpeningAnimatic(composition, durationMs, `shots[${index}]`);
  return {
    id,
    kind: "animatic",
    narration: (input.captions ?? []).join(" ").trim(),
    durationMs,
    composition,
  };
}

const SHOT_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", description: "Optional unique shot id (default op_shot_1…)." },
    template: {
      type: "string",
      enum: [...DIRECTOR_TEMPLATES],
      description: "key-cg (full-bleed full-color bespoke CG from generate_art{target:'opening'} with smooth Ken Burns motion) · map-tour (live game map panning) · title-card (dramatic title reveal over resourceId or genre-neutral mood backdrop) · optional landscape parallax (day-sky/sunset-sky/night-sky/cloud-sea/mountains/sea — use only when the story actually needs that outdoor sky/landscape).",
    },
    mood: {
      type: "string",
      enum: [...DIRECTOR_MOODS],
      description: "Optional backdrop mood for title-card without resourceId: dark | noir | warm | dusk | bright.",
    },
    durationMs: { type: "integer", description: "Optional shot duration in ms (default auto-snapped to beats & caption reading time, ~5250–6750ms)." },
    resourceId: { type: "string", description: "Required for key-cg; optional backdrop for title-card." },
    mapId: { type: "string", description: "For map-tour (defaults to project startMapId)." },
    focus: {
      type: "object",
      additionalProperties: false,
      properties: { x: { type: "integer" }, y: { type: "integer" } },
      required: ["x", "y"],
      description: "Map cell to center on for map-tour.",
    },
    motion: { type: "string", enum: [...DIRECTOR_MOTIONS], description: "Camera movement (pan-right, pan-left, tilt-down, tilt-up, zoom-in, zoom-out, drift, still)." },
    fx: {
      type: "array",
      items: { type: "string", enum: [...DIRECTOR_FX] },
      description: "Optional atmosphere/impact FX layers (stars, meteors, petals, snow, rain, sparks, dust, shaft, glow, flash-hit, shake, night-tint, dawn-tint, sepia-tint).",
    },
    sfx: { type: "string", enum: [...DIRECTOR_SFX], description: "Optional beat-synced bundled SFX (bell, gong, impact, magic, sword, hit) with automatic BGM ducking." },
    transition: { type: "string", enum: [...TRANSITION_KINDS], description: "Shot entry reveal (fade, dither, flash, cut, wipe-left, wipe-right, iris)." },
    captions: { type: "array", items: { type: "string" }, description: "1–3 concise bottom-bar narration lines, automatically timed to beats." },
    captionColor: { type: "string", description: "Optional #RRGGBB caption color (default #fff0dc)." },
    title: { type: "string", description: "Heading text for title-card (or overlay title on key-cg)." },
    subtitle: { type: "string", description: "Optional subtitle under title." },
  },
  required: ["template"],
};

const composeOpening: ToolDefinition = {
  name: "compose_opening",
  description:
    "Compose a full-bleed 480×270 cinema-grade opening sequence in ONE call (full-color Ken Burns key-cg without 64-color posterization, live map-tour, beat-synced title-card, optional landscape parallax, captions, transitions, and bundled SFX with BGM ducking). " +
    "Match this game's own genre and story: when image generation is available, pair with 2–4 style-matched key-cg shots from generate_art{target:'opening'}; when image generation is unavailable, finish cleanly with map-tour, mood title-card, and fitting parallax. Preserves any authored author_opening_stage.",
  mode: "write",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      shots: { type: "array", items: SHOT_SCHEMA, minItems: 1, maxItems: 10, description: "Ordered list of 2–6 cinematic shots." },
      bpm: { type: "integer", description: "Optional music tempo for beat-aligned timing (default 80 BPM = 750ms/beat)." },
      musicResourceId: { type: "string", description: "Looping BGM resource id across the whole opening (omit to keep current or use starter track)." },
      entry: { type: "string", enum: ["new-game", "before-title", "attract"], description: "Playback entry timing (default new-game)." },
      letterbox: { type: "number", description: "Top/bottom cinematic bar ratio 0..0.2 (default 0.12)." },
    },
    required: ["shots"],
  },
  run(draft, args): ToolExecResult {
    const rawShots = args.shots as DirectorShotInput[];
    if (!Array.isArray(rawShots) || rawShots.length === 0) {
      throw new ToolError("shots 배열에 최소 1개 이상의 샷을 넣으세요.", { code: "invalid-args" });
    }
    const bpm = typeof args.bpm === "number" && Number.isFinite(args.bpm) ? Math.max(50, Math.min(180, Math.round(args.bpm))) : 80;
    const beatMs = Math.round(60_000 / bpm);
    const letterbox = typeof args.letterbox === "number" && Number.isFinite(args.letterbox)
      ? Math.max(0, Math.min(0.2, args.letterbox))
      : DEFAULT_LETTERBOX;

    const scenes: CinematicScene[] = rawShots.map((shot, idx) => buildDirectorShot(draft, shot, idx, beatMs, letterbox));

    let musicResourceId = draft.system.opening?.musicResourceId;
    if (typeof args.musicResourceId === "string" && args.musicResourceId.trim()) {
      const m = args.musicResourceId.trim();
      if (!catalogLookup(draft)("music", m)) {
        throw new ToolError(`음악 ${m} 을 찾을 수 없습니다. recommend_bgm 또는 list_opening_media(kind:'music') 에서 고르세요.`, { code: "resource-not-found" });
      }
      musicResourceId = m;
    } else if (!musicResourceId && catalogLookup(draft)("music", STARTER_TITLE_BGM_ID)) {
      musicResourceId = STARTER_TITLE_BGM_ID;
    }

    const prevEntry = draft.system.opening?.entry;
    let nextEntry: CinematicSequence["entry"] | undefined;
    if (args.entry === "new-game") {
      nextEntry = undefined;
    } else if (args.entry === "before-title") {
      nextEntry = { mode: "before-title" };
    } else if (args.entry === "attract") {
      nextEntry = prevEntry?.mode === "attract" ? structuredClone(prevEntry) : { mode: "attract" };
    } else if (prevEntry && prevEntry.mode !== "new-game") {
      nextEntry = structuredClone(prevEntry);
    }
    const next: CinematicSequence = keepOpeningStage(draft.system.opening, {
      enabled: true,
      skippable: true,
      ...(musicResourceId ? { musicResourceId } : {}),
      ...(nextEntry ? { entry: nextEntry } : {}),
      scenes,
    });
    draft.system.opening = next;
    delete draft.meta.oprnOpeningBook;

    const totalSec = (scenes.reduce((sum, s) => sum + s.durationMs, 0) / 1000).toFixed(1);
    return {
      summary: `시네마틱 오프닝 ${scenes.length}샷(${totalSec}초 · 480×270 풀스크린 · ${bpm} BPM)을 조립했습니다.${next.stage ? ` 뒤에 엔진 무대(${next.stage.mapId})가 이어집니다.` : ""}`,
      data: {
        shots: scenes.map((s) => ({ id: s.id, durationMs: s.durationMs })),
        totalDurationMs: scenes.reduce((sum, s) => sum + s.durationMs, 0),
        musicResourceId: next.musicResourceId ?? null,
        stage: next.stage ?? null,
      },
    };
  },
};

export const OPENING_DIRECTOR_TOOLS: readonly ToolDefinition[] = [composeOpening];
