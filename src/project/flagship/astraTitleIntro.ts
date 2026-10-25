/**
 * 『아스트라 호라이즌』 타이틀 앞 인트로 — 전설 추격 콜드 오픈(약 27초, 게임을 켤 때 타이틀보다 먼저, system.titleIntro).
 *
 * 2026-10-25 사용자 승인안 A: 별똥별이 흐르는 밤하늘 → 전설의 달그림자(루나만타) 실루엣이 달을 가로지른다 →
 * 숲가의 세 스타터가 고개를 들고 → 뒤쫓아 달린다 → 로고가 박힌다. 포켓몬 루비·에메랄드 인트로의 결.
 * 엔진 기능만 쓴다: 레터박스·카메라 이동·시차 층·입자(별·별똥별·반딧불)·실루엣 틴트·빛줄기·섬광·흔들림·말풍선·효과음 큐·BGM.
 * 새 화소 없음 — 배경은 OPRN 밤하늘 파노라마 세 겹 + 타이틀 그림에서 하늘을 오린 밤 풀밭(src/assets/astraOpeningArt.ts),
 * 몬스터는 게임 속 종의 정면·뒷모습·필드 칩 그대로다.
 *
 * 컷은 곡(별바람을 타는 글라이더, 124 BPM — 한 박 484ms, 한 마디 1935ms)의 마디에 맞춘다:
 *   0 밤하늘(3마디) → 5.8 달을 가로지르는 전설(3) → 11.6 숲가의 셋(3) → 17.4 추격(2) → 21.3 로고(3) = 27.1초.
 * 아무 키나 누르면 타이틀로 간다.
 */
import { astraArt } from "@/assets/astraOpeningArt";
import { charsetPatternIndex } from "@/project/emeraldMonsterOpeningShots";
import { validateOpeningAnimatic, type AnimaticKey, type AnimaticLayer, type OpeningAnimatic } from "@/project/openingAnimatic";
import type { CinematicSequence, Project } from "@/project/types";

const STAGE = { width: 480, height: 320 } as const;
const CENTER = { x: STAGE.width / 2, y: STAGE.height / 2 } as const;
const LETTERBOX = 0.1;
const BEAT = 484;
const BAR = 1935;
export const ASTRA_INTRO_MUSIC = "cc0-bgm-rtp-vrt-002";

const SE = {
  whoosh: "cc0-se-orp-battle-swing",
  whoosh2: "cc0-se-orp-battle-swing3",
  cry: "cc0-se-ors-creature-misc-03",
  sparkle: "cc0-se-ors-item-gem-01",
  alert: "cc0-sound-monster-encounter",
  boom: "cc0-se-osx-explosion",
  gong: "cc0-se-osx-gong-02",
  shimmer: "cc0-sound-monster-evolve-during",
} as const;

/** 전설의 달그림자 — 게임 속 루나만타(정면 그림이 왼쪽을 본다). */
const LEGEND = "harness-monster-lunavane-front";
/** 스타터 셋의 뒷모습·필드 칩(필드 칩은 데모가 고른 종 그림을 따른다 — 아래 cast). */
export type AstraIntroCast = {
  readonly starters: readonly { readonly back: string; readonly chip?: { readonly resourceId: string; readonly index: number } }[];
};

type Point = { x: number; y: number };
type CamKeys = { x: AnimaticKey[]; y: AnimaticKey[]; zoom?: AnimaticKey[] };
const key = (atMs: number, value: number, ease?: AnimaticKey["ease"]): AnimaticKey => (ease ? { atMs, value, ease } : { atMs, value });

// ── 공통 층 ─────────────────────────────────────────────────────────────

/** 카메라 범위 전체를 덮도록 이음매 없는 밤하늘 그림을 깐다(깊이 p). */
function tiled(prefix: string, resourceId: string, scale: number, p: number, cam: CamKeys, extra: Partial<AnimaticLayer> = {}): AnimaticLayer[] {
  const xs = cam.x.map(k => k.value), ys = cam.y.map(k => k.value), zoomOut = Math.min(1, ...(cam.zoom ?? [key(0, 1)]).map(k => k.value)), margin = 8 + (1 - zoomOut) * 200;
  const x0 = (Math.min(...xs) - CENTER.x) * p - margin, x1 = STAGE.width + (Math.max(...xs) - CENTER.x) * p + margin;
  const y0 = (Math.min(...ys) - CENTER.y) * p - margin, y1 = STAGE.height + (Math.max(...ys) - CENTER.y) * p + margin;
  const w = 320 * scale, h = 256 * scale, out: AnimaticLayer[] = [];
  for (let x = Math.floor(x0); x < x1; x += w) for (let y = Math.floor(y0); y < y1; y += h) {
    out.push({ id: `${prefix}-${out.length}`, kind: "image", role: "background", resourceId, sampling: "nearest", x, y, width: w, height: h, parallax: p, ...extra });
  }
  return out;
}

function nightSky(cam: CamKeys, depth = { nebula: 0.1, far: 0.25, near: 0.5 }): AnimaticLayer[] {
  return [
    ...tiled("sky-nebula", "oprn-pano-night", 2, depth.nebula, cam),
    ...tiled("sky-far", "oprn-pano-night-stars-far", 1, depth.far, cam),
    ...tiled("sky-near", "oprn-pano-night-stars-near", 2, depth.near, cam, { opacity: 0.9 }),
  ];
}

function glow(id: string, color: string, center: Point, size: number, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  return { id, kind: "glow", role: "effect", color, blend: "lighter", x: center.x - size / 2, y: center.y - size / 2, width: size, height: size,
    glow: { inner: 0.3, pulse: { hz: 0.6, amount: 0.15, pattern: "pulse", seed: id.length } }, ...extra };
}

/** 달: 원반 + 둥근 빛무리. 깊이 p 로 하늘과 같이 흐른다. */
function moon(id: string, center: Point, radius: number, p: number, extra: Partial<AnimaticLayer> = {}): AnimaticLayer[] {
  return [
    glow(`${id}-halo`, "#c8d8ff", center, radius * 6, { parallax: p, opacity: 0.55, ...extra }),
    { id: `${id}-disc`, kind: "shape", shape: "ellipse", role: "prop", color: "#fff6dc", x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2, parallax: p, ...extra },
    { id: `${id}-shade`, kind: "shape", shape: "ellipse", role: "prop", color: "#e8dcc0", opacity: 0.55, x: center.x - radius * 0.35, y: center.y - radius * 0.5, width: radius * 0.7, height: radius * 0.55, parallax: p, ...extra },
  ];
}

function particles(id: string, preset: "stars" | "sparks" | "dust" | "meteors", color: string, box: { x: number; y: number; width: number; height: number }, count: number, seed: number, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  return { id, kind: "particles", role: "effect", color, opacity: 0.8, blend: "lighter", ...box, particles: { preset, count, seed, speed: preset === "meteors" ? 300 : preset === "stars" ? 6 : 14, size: preset === "meteors" ? 1.6 : preset === "dust" ? 2 : 1.2 }, ...extra };
}

/** 화면에 붙은 판(섬광·색조·암전). */
function screenFill(id: string, color: string, opacity: AnimaticKey[], blend: AnimaticLayer["blend"] = "source-over"): AnimaticLayer {
  return { id, kind: "shape", shape: "rect", role: "effect", space: "screen", color, blend, x: 0, y: 0, width: STAGE.width, height: STAGE.height, opacity: 1, keys: { opacity } };
}

/** 몬스터 그림(64×64)을 실루엣으로 — 색 틴트 1이면 모양만 남는다. */
function silhouette(id: string, resourceId: string, size: number, keys: AnimaticLayer["keys"], extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  return { id, kind: "image", role: "actor", characterRole: "monster", resourceId, sampling: "nearest", x: 0, y: 0, width: size, height: size, anchorX: 0.5, anchorY: 0.5,
    tint: { color: "#0a1028" }, keys, ...extra };
}

/** 사인 물결 경로 키(날갯짓처럼 오르내리며 x 를 지난다). */
function flightKeys(from: Point, to: Point, startMs: number, endMs: number, wave: number, steps = 10): { x: AnimaticKey[]; y: AnimaticKey[] } {
  const x: AnimaticKey[] = [], y: AnimaticKey[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, t = Math.round(startMs + (endMs - startMs) * u);
    x.push(key(t, Math.round(from.x + (to.x - from.x) * u), i ? "ease-in-out" : undefined));
    y.push(key(t, Math.round(from.y + (to.y - from.y) * u + Math.sin(u * Math.PI * 3) * wave), i ? "ease-in-out" : undefined));
  }
  return { x, y };
}

const shot = (layers: AnimaticLayer[], camera: OpeningAnimatic["camera"], transition: OpeningAnimatic["transition"], audioCues: OpeningAnimatic["audioCues"] = [], letterbox = LETTERBOX): OpeningAnimatic =>
  ({ width: STAGE.width, height: STAGE.height, background: "#04060f", ...(letterbox ? { letterbox } : {}), upscale: "nearest", layers,
    ...(camera ? { camera } : {}), ...(transition ? { transition } : {}), ...(audioCues.length ? { audioCues } : {}) });

// ── 1. 밤하늘 ───────────────────────────────────────────────────────────
/** 깊이가 다른 별이 흐르고 별똥별이 이따금 긋는다. 카메라는 달 쪽으로 천천히 오른다. */
function skyShot(): OpeningAnimatic {
  const ms = 3 * BAR, cam: CamKeys = { x: [key(0, 290), key(ms, 360, "ease-in-out")], y: [key(0, 250), key(ms, 190, "ease-in-out")] };
  return shot([
    ...nightSky(cam),
    ...moon("moon", { x: 470, y: 120 }, 15, 0.3),
    particles("twinkle", "stars", "#e8f0ff", { x: -40, y: -20, width: 620, height: 380 }, 90, 11, { parallax: 0.7, opacity: 0.6 }),
    particles("meteors", "meteors", "#dfeaff", { x: 0, y: -10, width: 640, height: 260 }, 6, 7, { parallax: 0.6 }),
    screenFill("dawn", "#04060f", [key(0, 1), key(500, 1), key(1900, 0, "ease-in-out")]),
  ], { keys: cam }, { kind: "cut", durationMs: 1 }, [
    { id: "sparkle", resourceId: SE.sparkle, atMs: 2 * BAR, durationMs: 900, volume: 0.35 },
  ]);
}

// ── 2. 달을 가로지르는 전설 ─────────────────────────────────────────────
/** 큰 달 앞을 루나만타 실루엣이 날갯짓하며 가로지른다. 지나는 박에 빛이 번지고 울음이 울린다. */
function legendShot(): OpeningAnimatic {
  const ms = 3 * BAR, cam: CamKeys = { x: [key(0, 250), key(ms, 222, "ease-in-out")], y: [key(0, 170), key(ms, 160, "ease-in-out")], zoom: [key(0, 1), key(ms, 1.1, "ease-in-out")] };
  const moonAt = { x: 250, y: 150 }, cross = 4 * BEAT + 2 * BEAT; // 지나는 순간(달 한가운데) — 일곱째 박 근처
  const path = flightKeys({ x: 620, y: 110 }, { x: -160, y: 175 }, BEAT, ms - 300, 14);
  return shot([
    ...nightSky(cam),
    ...moon("moon", moonAt, 58, 0.9),
    particles("twinkle", "stars", "#e8f0ff", { x: -40, y: -20, width: 600, height: 360 }, 70, 13, { parallax: 0.6, opacity: 0.55 }),
    particles("meteors", "meteors", "#dfeaff", { x: 0, y: -20, width: 600, height: 240 }, 4, 21, { parallax: 0.5 }),
    // 달빛 테두리(실루엣 뒤) → 실루엣 → 날개 끝 반짝이.
    { ...glow("legend-rim", "#9fb8ff", { x: 0, y: 0 }, 300, { opacity: 0.45, parallax: 0.95, startMs: BEAT }), anchorX: 0.5, anchorY: 0.5, keys: path },
    silhouette("legend", LEGEND, 224, { ...path, rotation: [key(BEAT, -8), key(cross, 2, "ease-in-out"), key(ms, 10, "ease-in")] }, { parallax: 0.95, startMs: BEAT }),
    { ...particles("legend-trail", "dust", "#cfe0ff", { x: 0, y: 0, width: 160, height: 90 }, 34, 5, { parallax: 0.95, startMs: BEAT, opacity: 0.75 }),
      keys: { x: path.x.map(k => ({ ...k, value: k.value + 40 })), y: path.y.map(k => ({ ...k, value: k.value - 30 })) } },
    screenFill("moon-flash", "#dfe8ff", [key(0, 0), key(cross - 80, 0), key(cross + 60, 0.35, "ease-out"), key(cross + 700, 0, "ease-in")], "screen"),
  ], { keys: cam, shake: { atMs: cross, durationMs: 500, amplitude: 2, frequency: 16, seed: 3 } }, { kind: "cut", durationMs: 1 }, [
    { id: "whoosh", resourceId: SE.whoosh, atMs: cross - 2 * BEAT, durationMs: 1200, volume: 0.65 },
    { id: "cry", resourceId: SE.cry, atMs: cross, durationMs: 1500, volume: 0.6, fadeOutMs: 500 },
    { id: "shimmer", resourceId: SE.shimmer, atMs: cross + BEAT, durationMs: 1400, volume: 0.25, fadeOutMs: 600 },
  ]);
}

// ── 3. 숲가의 셋 ────────────────────────────────────────────────────────
/** 밤 풀밭. 거대한 그림자가 풀 위를 훑고, 스타터 셋(뒷모습)이 놀라 튀어 오르며 하늘을 본다. 멀리 숲 위로 전설이 날아간다. */
function forestShot(cast: AstraIntroCast): OpeningAnimatic {
  // 카메라는 높이를 고정하고 살짝만 다가간다 — 위로 올라가며 1.05배로 다가가면 스타터 발이 아래 레터박스에 잘렸다(2026-10-25 적대 VQA).
  const ms = 3 * BAR, cam: CamKeys = { x: [key(0, 240), key(ms, 240)], y: [key(0, 168), key(ms, 168)], zoom: [key(0, 1), key(ms, 1.03, "ease-in-out")] };
  const ground = astraArt("meadow-night");
  const shadowAt = 2 * BEAT, startle = shadowAt + 3 * BEAT, farFrom = Math.round(3 * BAR / 2);
  const size = 96, baseY = 262, xs = [122, 240, 358];
  const starters = cast.starters.slice(0, 3).flatMap((starter, i): AnimaticLayer[] => {
    const at = startle + i * 140, x = xs[i]!, top = baseY - size;
    return [
      { id: `starter-${i}`, kind: "image", role: "actor", characterRole: "monster", resourceId: starter.back, sampling: "nearest", x: x - size / 2, y: top, width: size, height: size, parallax: 1.15,
        keys: { y: [key(0, top), key(at, top), key(at + 150, top - 26, "ease-out"), key(at + 330, top, "ease-in"), key(at + 2 * BEAT, top), key(at + 2 * BEAT + 120, top - 8, "ease-out"), key(at + 2 * BEAT + 260, top, "ease-in")] } },
      // 느낌표는 그림 상자 위가 아니라 머리 곁에 — 뒷모습 그림은 상자 위 22~40% 가 비어 있어 상자 위에 띄우면 허공에 떴다.
      // 펄쩍 뛰었다 내려앉은 뒤(at+330)에 떠서 셋이 같은 높이·같은 크기로 보인다.
      { id: `starter-${i}-emote`, kind: "emote", role: "effect", x: x - size / 2 + Math.round(size * 0.62) - 14, y: top + Math.round(size * 0.3) - 30, width: 28, height: 30, parallax: 1.15, startMs: at + 330, endMs: at + 2000, emote: { preset: "exclaim", tail: "down", popMs: 140, outMs: 200 } },
    ];
  });
  const far = flightKeys({ x: 540, y: 60 }, { x: -80, y: 92 }, farFrom, ms - 200, 6, 8);
  return shot([
    ...nightSky(cam, { nebula: 0.08, far: 0.18, near: 0.32 }),
    ...moon("moon", { x: 92, y: 62 }, 12, 0.2),
    particles("twinkle", "stars", "#e8f0ff", { x: -20, y: -10, width: 520, height: 150 }, 50, 17, { parallax: 0.3, opacity: 0.55 }),
    // 멀리 숲 위로 날아가는 전설(작게) — 지평선 위.
    { ...glow("far-rim", "#9fb8ff", { x: 0, y: 0 }, 90, { opacity: 0.4, parallax: 0.5, startMs: farFrom }), anchorX: 0.5, anchorY: 0.5, keys: far },
    silhouette("far-legend", LEGEND, 56, { ...far, rotation: [key(farFrom, -4), key(ms - 200, 6)] }, { parallax: 0.5, startMs: farFrom }),
    { id: "ground", kind: "image", role: "background", resourceId: ground.resourceId, sampling: "nearest", x: 0, y: 0, width: ground.width * 2, height: ground.height * 2 },
    // 창 불빛·반딧불.
    glow("window-a", "#ffc870", { x: 130, y: 182 }, 18, { opacity: 0.6, glow: { inner: 0.3, pulse: { hz: 1.7, amount: 0.3, pattern: "flicker", seed: 4 } } }),
    glow("window-b", "#ffc870", { x: 160, y: 182 }, 16, { opacity: 0.55, glow: { inner: 0.3, pulse: { hz: 1.4, amount: 0.3, pattern: "flicker", seed: 9 } } }),
    particles("fireflies", "dust", "#d8ff88", { x: 20, y: 200, width: 440, height: 100 }, 18, 31, { parallax: 1.1, opacity: 0.7 }),
    // 거대한 그림자가 풀 위를 오른쪽에서 왼쪽으로 훑는다.
    silhouette("shadow", LEGEND, 360, { x: [key(shadowAt, 680), key(shadowAt + 1300, -220, "linear")], y: [key(shadowAt, 250), key(shadowAt + 1300, 262, "linear")] },
      { tint: { color: "#000000" }, opacity: 0.4, startMs: shadowAt, endMs: shadowAt + 1400, parallax: 1.1 }),
    ...starters,
  ], { keys: cam }, { kind: "flash", durationMs: 300, color: "#dfe8ff" }, [
    { id: "shadow-whoosh", resourceId: SE.whoosh2, atMs: shadowAt, durationMs: 1100, volume: 0.7 },
    { id: "alert", resourceId: SE.alert, atMs: startle, durationMs: 900, volume: 0.6 },
  ]);
}

// ── 4. 추격 ─────────────────────────────────────────────────────────────
/** 셋이 풀밭을 가로질러 달빛 쪽으로 뛴다(필드 칩 2배 + 발밑 먼지). 카메라가 함께 흐른다. */
function chaseShot(cast: AstraIntroCast): OpeningAnimatic {
  // 땅 그림은 480 폭 한 장 — 살짝 확대해 그 안에서만 흐른다(밖은 빈 하늘).
  const ms = 2 * BAR, cam: CamKeys = { x: [key(0, 252), key(ms, 228, "ease-in-out")], y: [key(0, 166), key(ms, 166)], zoom: [key(0, 1.06), key(ms, 1.06)] };
  const ground = astraArt("meadow-night");
  const CELL = { w: 24, h: 32 }, scale = 2;
  const runners = cast.starters.slice(0, 3).flatMap((starter, i): AnimaticLayer[] => {
    if (!starter.chip) return [];
    const chip = starter.chip, row = Math.floor(chip.index / 4) * 4 + 3, base = row * 12 + (chip.index % 4) * 3; // 왼쪽 보기 행
    const y = 262 - CELL.h * scale + i * 6, startX = 520 + i * 54, endX = 60 + i * 54;
    return [{
      id: `runner-${i}`, kind: "image", role: "actor", characterRole: "monster", resourceId: chip.resourceId, sampling: "nearest",
      sheet: { frameWidth: CELL.w, frameHeight: CELL.h, columns: 12, count: 96, fps: 0 }, x: startX, y, width: CELL.w * scale, height: CELL.h * scale,
      walk: { stride: 10, frames: [base + 1, base + 2, base + 1, base] }, keys: { x: [key(0, startX), key(ms, endX, "linear")] },
    }, {
      ...particles(`dust-${i}`, "dust", "#b8c4e8", { x: 0, y: y + CELL.h * scale - 14, width: 40, height: 16 }, 10, 40 + i, { blend: undefined, opacity: 0.45 }),
      keys: { x: [key(0, startX + 30), key(ms, endX + 30, "linear")] },
    }];
  });
  const ahead = flightKeys({ x: 180, y: 70 }, { x: -120, y: 50 }, 0, ms, 8, 6);
  return shot([
    ...nightSky(cam, { nebula: 0.08, far: 0.18, near: 0.32 }),
    ...moon("moon", { x: 120, y: 64 }, 13, 0.25),
    particles("twinkle", "stars", "#e8f0ff", { x: -40, y: -10, width: 600, height: 150 }, 50, 19, { parallax: 0.3, opacity: 0.55 }),
    { ...glow("ahead-rim", "#9fb8ff", { x: 0, y: 0 }, 110, { opacity: 0.4, parallax: 0.4 }), anchorX: 0.5, anchorY: 0.5, keys: ahead },
    silhouette("ahead", LEGEND, 72, { ...ahead }, { parallax: 0.4 }),
    { id: "ground", kind: "image", role: "background", resourceId: ground.resourceId, sampling: "nearest", x: 0, y: 0, width: ground.width * 2, height: ground.height * 2 },
    particles("fireflies", "dust", "#d8ff88", { x: 0, y: 200, width: 480, height: 100 }, 14, 37, { parallax: 1.1, opacity: 0.6 }),
    ...runners,
  ], { keys: cam }, { kind: "cut", durationMs: 1 }, [
    { id: "steps", resourceId: SE.whoosh, atMs: BEAT, durationMs: 800, volume: 0.35 },
  ]);
}

// ── 5. 로고 ─────────────────────────────────────────────────────────────
/** 달빛 줄기 아래 전설이 달을 한 번 더 지나고, 둘째 마디 첫 박에 로고가 박힌다(섬광·흔들림·폭음·징). 끝은 검게 닫힌다. */
function logoShot(): OpeningAnimatic {
  const ms = 3 * BAR, cam: CamKeys = { x: [key(0, 240), key(ms, 240)], y: [key(0, 176), key(ms, 150, "ease-out")] };
  const slam = BAR, sub = BAR + 3 * BEAT;
  const path = flightKeys({ x: 470, y: 74 }, { x: 10, y: 96 }, 0, BAR + BEAT, 6, 6);
  const ray = (i: number, x: number, rotation: number, width: number): AnimaticLayer => ({
    id: `ray-${i}`, kind: "shaft", role: "effect", color: "#dfe6ff", blend: "lighter", x, y: -20, width, height: 300, rotation, parallax: 0.9,
    shaft: { spread: 0.55, softness: 0.8, dust: { count: 8, seed: 50 + i, speed: 8, size: 1 }, pulse: { hz: 0.35 + i * 0.07, amount: 0.25, pattern: "pulse", seed: i } },
    keys: { opacity: [key(0, 0), key(slam - 200, 0.18), key(slam + 200, 0.42, "ease-out"), key(ms, 0.3)] },
  });
  const logoTop = 92;
  return shot([
    ...nightSky(cam, { nebula: 0.1, far: 0.25, near: 0.45 }),
    ...moon("moon", { x: 240, y: 92 }, 46, 0.85),
    ray(0, 210, -14, 70), ray(1, 260, 10, 54), ray(2, 300, 24, 40),
    particles("twinkle", "stars", "#e8f0ff", { x: -20, y: -10, width: 520, height: 340 }, 80, 23, { parallax: 0.6, opacity: 0.55 }),
    { ...glow("legend-rim", "#9fb8ff", { x: 0, y: 0 }, 150, { opacity: 0.45, parallax: 0.85, endMs: BAR + BEAT }), anchorX: 0.5, anchorY: 0.5, keys: path },
    silhouette("legend", LEGEND, 110, { ...path }, { parallax: 0.85, endMs: BAR + BEAT }),
    glow("logo-glow", "#ffd27a", { x: 240, y: 118 }, 300, { space: "screen", startMs: slam - 120, keys: { opacity: [key(slam - 120, 0), key(slam + 80, 0.75, "ease-out"), key(slam + 900, 0.32, "ease-in"), key(ms, 0.28)] } }),
    // 로고: 두께 그림자 → 금빛 글자. 크게 날아와 박힌다(2.6배 → 0.94 → 1).
    { id: "logo-shadow", kind: "text", role: "credit", space: "screen", text: "아스트라 호라이즌", color: "#1a1240", x: 243, y: logoTop + 3, width: 470, height: 64, anchorX: 0.5, anchorY: 0,
      typography: { fontSize: 50, weight: 900, align: "center" }, startMs: slam,
      keys: { scaleX: [key(slam, 2.6), key(slam + 160, 0.94, "ease-in"), key(slam + 300, 1, "ease-out")], scaleY: [key(slam, 2.6), key(slam + 160, 0.94, "ease-in"), key(slam + 300, 1, "ease-out")], opacity: [key(slam, 0), key(slam + 120, 1)] } },
    { id: "logo", kind: "text", role: "credit", space: "screen", text: "아스트라 호라이즌", color: "#ffd75a", x: 240, y: logoTop, width: 470, height: 64, anchorX: 0.5, anchorY: 0,
      typography: { fontSize: 50, weight: 900, align: "center" }, startMs: slam,
      keys: { scaleX: [key(slam, 2.6), key(slam + 160, 0.94, "ease-in"), key(slam + 300, 1, "ease-out")], scaleY: [key(slam, 2.6), key(slam + 160, 0.94, "ease-in"), key(slam + 300, 1, "ease-out")], opacity: [key(slam, 0), key(slam + 120, 1)] } },
    { id: "subtitle", kind: "text", role: "credit", space: "screen", text: "다우닝 시티와 여명의 날개", color: "#e8eefc", x: 0, y: logoTop + 66, width: STAGE.width, height: 24,
      typography: { fontSize: 17, weight: 700, align: "center" }, startMs: sub, keys: { opacity: [key(sub, 0), key(sub + 600, 0.95, "ease-out")], y: [key(sub, logoTop + 74), key(sub + 600, logoTop + 66, "ease-out")] } },
    particles("logo-sparks", "sparks", "#fff0b0", { x: 60, y: logoTop - 10, width: 360, height: 90 }, 40, 61, { space: "screen", startMs: slam, endMs: slam + 1600, keys: { opacity: [key(slam, 1), key(slam + 1600, 0, "ease-in")] } }),
    screenFill("flash", "#ffffff", [key(0, 0), key(slam - 30, 0), key(slam + 40, 0.9), key(slam + 520, 0, "ease-out")]),
    screenFill("close", "#000000", [key(0, 0), key(ms - 900, 0), key(ms, 1, "ease-in")]),
  ], { keys: cam, shake: { atMs: slam, durationMs: 600, amplitude: 6, frequency: 18, seed: 11 } }, { kind: "flash", durationMs: 260, color: "#ffffff" }, [
    { id: "whoosh", resourceId: SE.whoosh, atMs: slam - 2 * BEAT, durationMs: 900, volume: 0.5 },
    { id: "boom", resourceId: SE.boom, atMs: slam, durationMs: 1200, volume: 0.8 },
    { id: "gong", resourceId: SE.gong, atMs: slam, durationMs: 2200, volume: 0.45, fadeOutMs: 900 },
  ], 0);
}

const SHOTS: readonly { id: string; ms: number; build: (cast: AstraIntroCast) => OpeningAnimatic }[] = [
  { id: "astra_intro_sky", ms: 3 * BAR, build: skyShot },
  { id: "astra_intro_legend", ms: 3 * BAR, build: legendShot },
  { id: "astra_intro_forest", ms: 3 * BAR, build: forestShot },
  { id: "astra_intro_chase", ms: 2 * BAR, build: chaseShot },
  { id: "astra_intro_logo", ms: 3 * BAR, build: logoShot },
];

/** 스타터 셋(풀·불꽃·물)의 뒷모습·필드 칩 — 데모 프로젝트의 실제 종 그림. */
export function astraIntroCast(project: Project): AstraIntroCast {
  const species = project.database.monsterSpecies ?? [];
  const starters = ["grass", "fire", "water"].flatMap(type => {
    const row = species.find(s => s.types?.includes(type));
    const back = row?.graphic.backResourceId ?? row?.graphic.monsterResourceId;
    if (!row || !back) return [];
    const field = row.graphic.fieldGraphic;
    return [{ back, ...(field?.sprite?.id ? { chip: { resourceId: field.sprite.id, index: charsetPatternIndex(field.pattern ?? 0) } } : {}) }];
  });
  return { starters };
}

/** 인트로 컷들(검증 포함). 테스트·도구가 프로젝트 없이 컷을 볼 수 있게 따로 둔다. */
export function astraTitleIntroScenes(cast: AstraIntroCast): CinematicSequence["scenes"] {
  return SHOTS.map(({ id, ms, build }) => {
    const composition = build(cast);
    validateOpeningAnimatic(composition, ms, `titleIntro.${id}`);
    return { id, kind: "animatic" as const, composition, durationMs: ms, narration: "" };
  });
}

/** system.titleIntro 를 짓는다. 기존 opening(새 게임 뒤 박사 소개)은 건드리지 않는다. */
export function buildAstraTitleIntro(project: Project): CinematicSequence {
  const sequence: CinematicSequence = { enabled: true, skippable: true, musicResourceId: ASTRA_INTRO_MUSIC, scenes: astraTitleIntroScenes(astraIntroCast(project)) };
  project.system.titleIntro = sequence;
  return sequence;
}
