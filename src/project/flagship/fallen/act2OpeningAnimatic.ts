/**
 * 『폴른 스타』 제2막 「빌린 불」 진입 애니메틱 (22초 · 4컷, 제1막 엔딩 「제2막으로」 클릭 시 재생).
 *
 * 제1막 42초 콜드 오픈(fallenStarOpening.ts)과 같은 OpeningAnimatic 엔진을 사용한다 —
 * 레터박스 · 카메라 이동/줌 · 시차 밤하늘 · 꺼져 가는 등불 · 북쪽 마차 횃불 · 하늘탑 붉은 빛줄기 ·
 * 입자(재/눈/불티) · 동기화 효과음 · 자연스러운 한국어 자막.
 *
 * 컷 구성 (총 22,000ms):
 *   1. 불 꺼진 왕도 아스텔 (6,000ms) — 통금의 밤, 거리 등불이 하나씩 꺼진다.
 *   2. 북문 밖 쇠 마차 (5,250ms) — 붉은 횃불이 북쪽 숲으로 빠져나가고, 창 너머로 세 번 두드리는 소리.
 *   3. 깨어나는 하늘탑 (5,250ms) — 재의 들판 너머 붉은 빛기둥이 치솟고 재와 눈발이 날린다.
 *   4. 제2막 타이틀 「빌린 불」 (5,500ms) — 불씨와 빛살 위로 막 제목이 떠오른 뒤 암전 → 지하 감방.
 */
import { fallenStarArt, type FallenStarArtId } from "@/assets/fallenStarOpeningBackdrops";
import type { CinematicSequence } from "@/project/cinematicSettings";
import { validateOpeningAnimatic, type AnimaticKey, type AnimaticLayer, type AnimaticParticlePreset, type OpeningAnimatic } from "@/project/openingAnimatic";

const STAGE = { width: 480, height: 270 } as const;
const CENTER = { x: STAGE.width / 2, y: STAGE.height / 2 } as const;
const LETTERBOX = 0.12;
const CAPTION_COLOR = "#fff0dc";
const CURFEW_NIGHT = { color: "#091026", amount: 0.62 } as const;
const COLD_ASH = { color: "#121b34", amount: 0.52 } as const;

const SE = {
  bell: "cc0-sound-fs-op-bell",
  air: "cc0-sound-fs-op-night-air",
  smolder: "cc0-sound-fs-op-smolder",
  pod: "cc0-sound-fs-op-pod-hum",
  knock: "easyrpg-sound-knock",
  titleRise: "cc0-sound-fs-op-title-rise",
  titleHit: "cc0-sound-fs-op-title-hit",
} as const;

type Point = { x: number; y: number };
type CamKeys = { x: AnimaticKey[]; y: AnimaticKey[]; zoom?: AnimaticKey[] };

const key = (atMs: number, value: number, ease?: AnimaticKey["ease"]): AnimaticKey =>
  (ease ? { atMs, value, ease } : { atMs, value });

function art(id: FallenStarArtId, at: Point = { x: 0, y: 0 }, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  const { resourceId, width, height } = fallenStarArt(id);
  return { id, kind: "image", role: "background", resourceId, sampling: "nearest", x: at.x, y: at.y, width, height, ...extra };
}

function glow(id: string, color: string, center: Point, size: number, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  return {
    id, kind: "glow", role: "effect", color, blend: "lighter",
    x: center.x - size / 2, y: center.y - size / 2, width: size, height: size,
    glow: { inner: 0.3, pulse: { hz: 0.8, amount: 0.25, pattern: "pulse", seed: id.length } },
    ...extra,
  };
}

function particles(
  id: string,
  preset: AnimaticParticlePreset,
  color: string,
  box: { x: number; y: number; width: number; height: number },
  count: number,
  seed: number,
  extra: Partial<AnimaticLayer> = {},
): AnimaticLayer {
  return {
    id, kind: "particles", role: "effect", color, opacity: 0.65, blend: "lighter",
    ...box,
    particles: { preset, count, seed, speed: preset === "stars" ? 5 : 11, size: preset === "dust" ? 2 : 1 },
    ...extra,
  };
}

function screenFill(
  id: string,
  color: string,
  opacity: AnimaticKey[],
  blend: AnimaticLayer["blend"] = "source-over",
  extra: Partial<AnimaticLayer> = {},
): AnimaticLayer {
  return {
    id, kind: "shape", shape: "rect", role: "effect", space: "screen",
    color, blend, x: 0, y: 0, width: STAGE.width, height: STAGE.height, opacity: 1,
    keys: { opacity },
    ...extra,
  };
}

function caption(id: string, cues: readonly { atMs: number; text: string }[], endMs: number, fadeOutMs = 420): AnimaticLayer {
  const typewriterMs = (text: string) => Math.min(850, Math.max(320, Array.from(text).length * 28));
  return {
    id, kind: "caption", x: 0, y: 0, width: STAGE.width, height: 38, color: CAPTION_COLOR,
    typography: { fontSize: 16, align: "center", weight: 700 },
    startMs: cues[0]!.atMs,
    endMs,
    caption: { cues: cues.map((cue) => ({ ...cue, typewriterMs: typewriterMs(cue.text) })), fadeOutMs },
  };
}

function tiled(prefix: string, resourceId: string, tile: { w: number; h: number }, scale: number, p: number, cam: CamKeys, extra: Partial<AnimaticLayer> = {}): AnimaticLayer[] {
  const xs = cam.x.map((k) => k.value), ys = cam.y.map((k) => k.value), margin = 8;
  const x0 = (Math.min(...xs) - CENTER.x) * p - margin, x1 = STAGE.width + (Math.max(...xs) - CENTER.x) * p + margin;
  const y0 = (Math.min(...ys) - CENTER.y) * p - margin, y1 = STAGE.height + (Math.max(...ys) - CENTER.y) * p + margin;
  const w = tile.w * scale, h = tile.h * scale, out: AnimaticLayer[] = [];
  for (let x = Math.floor(x0); x < x1; x += w) {
    for (let y = Math.floor(y0); y < y1; y += h) {
      out.push({ id: `${prefix}-${out.length}`, kind: "image", role: "background", resourceId, sampling: "nearest", x, y, width: w, height: h, parallax: p, ...extra });
    }
  }
  return out;
}

function nightSky(cam: CamKeys, depth = { nebula: 0.12, far: 0.28, near: 0.5, twinkle: 0.72 }): AnimaticLayer[] {
  const tile = { w: 320, h: 256 };
  const xs = cam.x.map((k) => k.value), ys = cam.y.map((k) => k.value);
  const tw = depth.twinkle;
  const box = {
    x: (Math.min(...xs) - CENTER.x) * tw - 16,
    y: (Math.min(...ys) - CENTER.y) * tw - 16,
    width: STAGE.width + (Math.max(...xs) - Math.min(...xs)) * tw + 32,
    height: STAGE.height + (Math.max(...ys) - Math.min(...ys)) * tw + 32,
  };
  return [
    ...tiled("sky-nebula", "oprn-pano-night", tile, 2, depth.nebula, cam),
    ...tiled("sky-far", "oprn-pano-night-stars-far", tile, 1, depth.far, cam),
    ...tiled("sky-near", "oprn-pano-night-stars-near", tile, 2, depth.near, cam, { opacity: 0.85 }),
    particles("sky-twinkle", "stars", "#dce8ff", box, Math.min(160, Math.round((box.width * box.height) / 1600)), 19, { parallax: tw, opacity: 0.5 }),
  ];
}

const shot = (
  layers: AnimaticLayer[],
  camera: OpeningAnimatic["camera"],
  transition: OpeningAnimatic["transition"],
  audioCues: OpeningAnimatic["audioCues"] = [],
  background = "#040710",
): OpeningAnimatic => ({
  width: STAGE.width,
  height: STAGE.height,
  background,
  letterbox: LETTERBOX,
  upscale: "nearest",
  layers,
  ...(camera ? { camera } : {}),
  ...(transition ? { transition } : {}),
  ...(audioCues.length ? { audioCues } : {}),
});

// ── 1. 불 꺼진 왕도 아스텔 (6,000ms) ──────────────────────────────────────
function curfewShot(): OpeningAnimatic {
  const cam: CamKeys = {
    x: [key(0, 276), key(6000, 238, "ease-in-out")],
    y: [key(0, 152), key(6000, 134, "ease-in-out")],
    zoom: [key(0, 1.12), key(6000, 1.0, "ease-out")],
  };
  const px = (tx: number, ty: number) => ({ x: (tx - 16) * 16 + 8, y: (ty - 27) * 16 + 8 });
  const dyingLamp = (id: string, at: Point, offAt: number): AnimaticLayer =>
    glow(id, "#ffc470", at, 32, {
      glow: { inner: 0.25, pulse: { hz: 2.2, amount: 0.3, pattern: "flicker", seed: offAt } },
      keys: { opacity: [key(0, 0.58), key(offAt - 220, 0.52), key(offAt - 100, 0.14), key(offAt - 40, 0.42), key(offAt + 200, 0, "ease-out")] },
    });
  return shot([
    art("town-street", { x: 0, y: 0 }, { tint: CURFEW_NIGHT }),
    dyingLamp("lamp-smithy", px(30, 41), 1600),
    dyingLamp("lamp-workshop", px(37, 41), 2400),
    dyingLamp("lamp-board", px(39, 32), 3200),
    dyingLamp("lamp-post", px(24, 35), 4000),
    particles("curfew-ash", "dust", "#7e8ca8", { x: 0, y: 20, width: 520, height: 240 }, 24, 13, { parallax: 1.2, blend: undefined, opacity: 0.35 }),
    screenFill("fade-in", "#040710", [key(0, 0.9), key(900, 0, "ease-out")]),
    screenFill("dim-down", "#050814", [key(0, 0), key(1800, 0.08), key(5600, 0.38, "ease-in")]),
    caption("line-curfew", [
      { atMs: 550, text: "그날 밤, 왕도의 등불이 하나씩 꺼져 갔다." },
      { atMs: 3200, text: "아무도 문을 열지 않았다." },
    ], 5600),
  ], { keys: cam }, { kind: "fade", durationMs: 550 }, [
    { id: "night-air", resourceId: SE.air, atMs: 0, durationMs: 6000, volume: 0.85, fadeInMs: 800, fadeOutMs: 700 },
    { id: "curfew-bell", resourceId: SE.bell, atMs: 1200, durationMs: 4200, volume: 0.55, fadeOutMs: 1200 },
  ]);
}

// ── 2. 북문을 빠져나가는 쇠 마차 (5,250ms) ────────────────────────────────
function carriageShot(): OpeningAnimatic {
  const groundY = 392;
  const cam: CamKeys = {
    x: [key(0, 224), key(5250, 296, "ease-in-out")],
    y: [key(0, 504), key(5250, 444, "ease-in-out")],
    zoom: [key(0, 1.04), key(5250, 1.12, "ease-in-out")],
  };
  return shot([
    ...nightSky(cam),
    art("fall-ground", { x: 0, y: groundY }, { tint: CURFEW_NIGHT }),
    // 북쪽 길로 멀어지는 심문회 쇠 마차의 붉은 횃불과 은빛 흔적
    glow("carriage-torch", "#ff7238", { x: 160, y: groundY + 180 }, 54, {
      anchorX: 0.5, anchorY: 0.5,
      glow: { inner: 0.3, pulse: { hz: 4.5, amount: 0.3, pattern: "flicker", seed: 23 } },
      keys: {
        x: [key(0, 152), key(5250, 326, "ease-in-out")],
        y: [key(0, groundY + 188), key(5250, groundY + 96, "ease-in-out")],
        opacity: [key(0, 0.72), key(4400, 0.65), key(5250, 0.25)],
      },
    }),
    glow("iris-spark", "#90f0ff", { x: 160, y: groundY + 180 }, 24, {
      anchorX: 0.5, anchorY: 0.5,
      keys: {
        x: [key(0, 144), key(5250, 318, "ease-in-out")],
        y: [key(0, groundY + 190), key(5250, groundY + 98, "ease-in-out")],
        opacity: [key(0, 0), key(2600, 0), key(2750, 0.85), key(3050, 0.1), key(3250, 0.85), key(3550, 0.1), key(3750, 0.9), key(4200, 0)],
      },
    }),
    particles("north-snow", "snow", "#b8cce6", { x: 0, y: groundY - 80, width: 560, height: 320 }, 34, 47, { parallax: 1.25, blend: undefined, opacity: 0.45 }),
    caption("line-carriage", [
      { atMs: 450, text: "쇠로 덮인 마차가 북문을 빠져나갔다." },
      { atMs: 2650, text: "창 너머로, 작은 손이 세 번 두드렸다." },
    ], 4900),
  ], { keys: cam }, { kind: "fade", durationMs: 500 }, [
    { id: "road-smolder", resourceId: SE.smolder, atMs: 0, durationMs: 5250, volume: 0.7, fadeInMs: 400, fadeOutMs: 600 },
    { id: "knock-1", resourceId: SE.knock, atMs: 2700, durationMs: 420, volume: 0.85 },
    { id: "knock-2", resourceId: SE.knock, atMs: 3200, durationMs: 420, volume: 0.85 },
    { id: "knock-3", resourceId: SE.knock, atMs: 3700, durationMs: 480, volume: 0.9 },
  ]);
}

// ── 3. 재의 들판 너머 깨어나는 하늘탑 (5,250ms) ──────────────────────────
function towerWakeShot(): OpeningAnimatic {
  const cam: CamKeys = {
    x: [key(0, 248), key(5250, 240, "ease-in-out")],
    y: [key(0, 154), key(5250, 124, "ease-in-out")],
    zoom: [key(0, 1.0), key(2400, 1.06, "ease-in-out"), key(5250, 1.15, "ease-out")],
  };
  return shot([
    art("observatory", { x: 0, y: 0 }, { tint: COLD_ASH }),
    // 둥근 창 너머 북쪽 하늘탑에서 치솟는 붉은 신호 기둥
    {
      id: "tower-crimson-shaft", kind: "shaft", role: "effect", color: "#ff7258", blend: "lighter",
      x: 256, y: -24, width: 54, height: 290, rotation: 6, parallax: 0.9,
      shaft: { spread: 0.45, softness: 0.8, dust: { count: 14, seed: 89, speed: 12, size: 1 }, pulse: { hz: 1.4, amount: 0.3, pattern: "pulse", seed: 7 } },
      keys: { opacity: [key(0, 0), key(1400, 0.15), key(2200, 0.58, "ease-out"), key(5250, 0.45)] },
    },
    glow("window-red", "#ff785a", { x: 283, y: 46 }, 74, {
      keys: { opacity: [key(0, 0.15), key(2150, 0.95, "ease-out"), key(5250, 0.65)] },
      glow: { inner: 0.35, pulse: { hz: 2.6, amount: 0.3, pattern: "flicker", seed: 31 } },
    }),
    particles("ash-flakes", "snow", "#9e9490", { x: 0, y: 0, width: 480, height: 270 }, 42, 63, { parallax: 1.2, blend: undefined, opacity: 0.48 }),
    particles("red-embers", "sparks", "#ff9658", { x: 160, y: 80, width: 220, height: 170 }, 28, 73, { startMs: 1800, opacity: 0.8 }),
    screenFill("red-pulse", "#ff5238", [key(0, 0), key(2050, 0), key(2200, 0.28, "ease-out"), key(2900, 0.06, "ease-out")], "screen"),
    caption("line-tower", [{ atMs: 650, text: "서른 해 전 불탄 마을 너머, 하늘탑이 깨어난다." }], 4800),
  ], {
    keys: cam,
    shake: { atMs: 2150, durationMs: 900, amplitude: 3.5, frequency: 18, seed: 11 },
  }, { kind: "fade", durationMs: 550 }, [
    { id: "tower-hum", resourceId: SE.pod, atMs: 0, durationMs: 5250, volume: 0.85, fadeInMs: 600, fadeOutMs: 700 },
  ]);
}

// ── 4. 제2막 타이틀 「빌린 불」 (5,500ms) ────────────────────────────────
function act2TitleShot(): OpeningAnimatic {
  const cam: CamKeys = {
    x: [key(0, 240), key(5500, 240)],
    y: [key(0, 148), key(5500, 126, "ease-in-out")],
    zoom: [key(0, 1.0), key(1800, 1.04, "ease-in"), key(2000, 1.0, "ease-out"), key(5500, 1.03)],
  };
  const hitAt = 1850;
  return shot([
    art("title", { x: 0, y: 0 }, { tint: { color: "#1a1228", amount: 0.42 } }),
    {
      id: "ember-ray-1", kind: "shaft", role: "effect", color: "#ffb868", blend: "lighter",
      x: 200, y: -20, width: 58, height: 300, rotation: 18, parallax: 0.85,
      shaft: { spread: 0.55, softness: 0.85, dust: { count: 12, seed: 41, speed: 9, size: 1 } },
      keys: { opacity: [key(0, 0), key(hitAt, 0.42, "ease-in-out"), key(4600, 0.25)] },
    },
    {
      id: "ember-ray-2", kind: "shaft", role: "effect", color: "#ff7a48", blend: "lighter",
      x: 280, y: -20, width: 44, height: 300, rotation: 24, parallax: 0.85,
      shaft: { spread: 0.5, softness: 0.85, dust: { count: 10, seed: 43, speed: 11, size: 1 } },
      keys: { opacity: [key(0, 0), key(hitAt, 0.34, "ease-in-out"), key(4600, 0.18)] },
    },
    glow("title-ember-glow", "#ff9648", { x: 240, y: 106 }, 250, {
      space: "screen", startMs: hitAt - 300,
      keys: { opacity: [key(hitAt - 300, 0), key(hitAt + 400, 0.4, "ease-out"), key(5500, 0.2)] },
    }),
    {
      id: "act2-kicker", kind: "text", role: "credit", space: "screen", text: "폴른 스타", color: "#d8e4ff",
      x: 0, y: 58, width: STAGE.width, height: 22,
      typography: { fontSize: 13, weight: 700, align: "center" },
      startMs: hitAt - 200,
      keys: { opacity: [key(hitAt - 200, 0), key(hitAt + 350, 0.88, "ease-out")] },
    },
    {
      id: "act2-main-title", kind: "text", role: "credit", space: "screen", text: "제2막 · 빌린 불", color: "#ffd88a",
      x: 0, y: 82, width: STAGE.width, height: 54,
      typography: { fontSize: 38, weight: 800, align: "center" },
      startMs: hitAt,
      keys: {
        opacity: [key(hitAt, 0), key(hitAt + 450, 1, "ease-out")],
        y: [key(hitAt, 92), key(hitAt + 550, 82, "ease-out")],
      },
    },
    {
      id: "act2-epigraph", kind: "text", role: "credit", space: "screen", text: "대답하지 않은 밤의 대가", color: "#e8d6c4",
      x: 0, y: 142, width: STAGE.width, height: 22,
      typography: { fontSize: 13, weight: 600, align: "center" },
      startMs: hitAt + 700,
      keys: { opacity: [key(hitAt + 700, 0), key(hitAt + 1250, 0.9, "ease-out")] },
    },
    particles("title-embers", "sparks", "#ffba78", { x: 0, y: 60, width: 480, height: 210 }, 28, 91, { parallax: 1.25, opacity: 0.55 }),
    screenFill("title-flash", "#ffe6c0", [key(0, 0), key(hitAt - 40, 0), key(hitAt + 50, 0.38), key(hitAt + 650, 0, "ease-out")], "screen"),
    screenFill("close-out", "#000000", [key(0, 0), key(4400, 0), key(5500, 1, "ease-in")]),
  ], { keys: cam }, { kind: "fade", durationMs: 900 }, [
    { id: "act2-rise", resourceId: SE.titleRise, atMs: 0, durationMs: hitAt, volume: 0.9 },
    { id: "act2-hit", resourceId: SE.titleHit, atMs: hitAt - 20, durationMs: 5500 - hitAt + 20, volume: 0.85, fadeOutMs: 1800 },
  ]);
}

const ACT2_SHOTS: readonly { id: string; build: () => OpeningAnimatic; ms: number }[] = [
  { id: "fs2_op_curfew", build: curfewShot, ms: 6000 },
  { id: "fs2_op_carriage", build: carriageShot, ms: 5250 },
  { id: "fs2_op_tower_wake", build: towerWakeShot, ms: 5250 },
  { id: "fs2_op_title", build: act2TitleShot, ms: 5500 },
];

export function buildFallenAct2OpeningAnimatic(): CinematicSequence {
  const scenes = ACT2_SHOTS.map(({ id, build, ms }) => {
    const composition = build();
    validateOpeningAnimatic(composition, ms, `act2Opening.${id}`);
    return { id, kind: "animatic" as const, composition, durationMs: ms, narration: "" };
  });
  return {
    enabled: true,
    skippable: true,
    musicResourceId: "cc0-bgm-rtp-mys-002",
    scenes,
  };
}
