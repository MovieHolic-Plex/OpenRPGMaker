/**
 * 『폴른 스타』 제2막 「빌린 불」 진입 애니메틱 (22.5초 · 4컷, 제1막 엔딩 「제2막으로」 클릭 시 재생).
 *
 * 제2막 전용으로 새로 생성한 16비트 도트 일러스트 4컷(act2-curfew, act2-carriage, act2-tower, act2-title,
 * 528×297 8비트 팔레트)을 OpeningAnimatic 무대 위에서 연출한다 —
 * 레터박스 · 카메라 이동/줌 · 창문 촛불 소등 · 성문·마차 횃불 · 창 너머 이리스 별빛 노크 ·
 * 하늘탑 붉은 빛기둥 폭발 · 입자(재/눈/불티) · 동기화 효과음 · 한국어 자막 및 막 타이틀 카드.
 *
 * 컷 구성 (총 22,500ms):
 *   1. 통금의 왕도 아스텔 (6,000ms) — 달빛 아래 셔터 내린 거리, 창문 촛불이 하나씩 꺼지고 심문회 횃불만 남는다.
 *   2. 북문 밖 쇠 마차 (5,250ms) — 성문 밖 눈길을 달리는 심문회 마차, 쇠창살 너머 푸른 별빛이 세 번 깜박인다.
 *   3. 재의 폐허 너머 깨어나는 하늘탑 (5,500ms) — 불탄 마을 잔해 너머로 붉은 룬과 불기둥이 밤하늘을 가른다.
 *   4. 제2막 타이틀 「빌린 불」 (5,750ms) — 타오르는 하늘탑과 얼어붙은 계곡 위로 막 제목이 떠오른 뒤 암전 → 지하 감방.
 */
import { fallenStarArt, type FallenStarArtId } from "@/assets/fallenStarOpeningBackdrops";
import type { CinematicSequence } from "@/project/cinematicSettings";
import {
  validateOpeningAnimatic,
  type AnimaticKey,
  type AnimaticLayer,
  type AnimaticParticlePreset,
  type OpeningAnimatic,
} from "@/project/openingAnimatic";

const STAGE = { width: 480, height: 270 } as const;
const LETTERBOX = 0.12;
const CAPTION_COLOR = "#fff0dc";

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
    id,
    kind: "glow",
    role: "effect",
    color,
    blend: "lighter",
    x: center.x - size / 2,
    y: center.y - size / 2,
    width: size,
    height: size,
    glow: { inner: 0.3, pulse: { hz: 0.9, amount: 0.25, pattern: "pulse", seed: id.length } },
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
    id,
    kind: "particles",
    role: "effect",
    color,
    opacity: 0.62,
    blend: "lighter",
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
    id,
    kind: "shape",
    shape: "rect",
    role: "effect",
    space: "screen",
    color,
    blend,
    x: 0,
    y: 0,
    width: STAGE.width,
    height: STAGE.height,
    opacity: 1,
    keys: { opacity },
    ...extra,
  };
}

function caption(id: string, cues: readonly { atMs: number; text: string }[], endMs: number, fadeOutMs = 420): AnimaticLayer {
  const typewriterMs = (text: string) => Math.min(850, Math.max(320, Array.from(text).length * 28));
  return {
    id,
    kind: "caption",
    x: 0,
    y: 0,
    width: STAGE.width,
    height: 38,
    color: CAPTION_COLOR,
    typography: { fontSize: 16, align: "center", weight: 700 },
    startMs: cues[0]!.atMs,
    endMs,
    caption: { cues: cues.map((cue) => ({ ...cue, typewriterMs: typewriterMs(cue.text) })), fadeOutMs },
  };
}

const shot = (
  layers: AnimaticLayer[],
  camera: OpeningAnimatic["camera"],
  transition: OpeningAnimatic["transition"],
  audioCues: OpeningAnimatic["audioCues"] = [],
  background = "#050812",
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

// ── 1. 통금의 왕도 아스텔 (6,000ms) ────────────────────────────────────────
function curfewShot(): OpeningAnimatic {
  const cam: CamKeys = {
    x: [key(0, 274), key(6000, 256, "ease-in-out")],
    y: [key(0, 158), key(6000, 134, "ease-in-out")],
    zoom: [key(0, 1.02), key(6000, 1.11, "ease-out")],
  };
  const dyingCandle = (id: string, at: Point, offAt: number): AnimaticLayer =>
    glow(id, "#ffc872", at, 26, {
      glow: { inner: 0.25, pulse: { hz: 2.8, amount: 0.34, pattern: "flicker", seed: offAt } },
      keys: {
        opacity: [
          key(0, 0.65),
          key(offAt - 220, 0.55),
          key(offAt - 100, 0.14),
          key(offAt - 40, 0.48),
          key(offAt + 200, 0, "ease-out"),
        ],
      },
    });
  return shot([
    art("act2-curfew"),
    // 창문 속 촛불 3개가 차례대로 꺼진다
    dyingCandle("candle-left-low", { x: 114, y: 157 }, 1800),
    dyingCandle("candle-left-mid", { x: 138, y: 145 }, 2700),
    dyingCandle("candle-gable", { x: 315, y: 65 }, 3600),
    // 골목 끝 심문회 순찰병 횃불 2개는 붉게 타오른다
    glow("guard-torch-l", "#ff7838", { x: 259, y: 72 }, 32, {
      opacity: 0.68,
      glow: { inner: 0.28, pulse: { hz: 4.2, amount: 0.32, pattern: "flicker", seed: 17 } },
    }),
    glow("guard-torch-r", "#ff7838", { x: 275, y: 72 }, 32, {
      opacity: 0.68,
      glow: { inner: 0.28, pulse: { hz: 4.6, amount: 0.32, pattern: "flicker", seed: 29 } },
    }),
    particles("curfew-mist", "dust", "#8fa4c8", { x: 0, y: 10, width: 528, height: 280 }, 24, 13, {
      parallax: 1.15,
      blend: undefined,
      opacity: 0.32,
    }),
    screenFill("fade-in", "#040710", [key(0, 0.92), key(900, 0, "ease-out")]),
    screenFill("dim-down", "#050814", [key(0, 0), key(2000, 0.05), key(5600, 0.3, "ease-in")]),
    caption("line-curfew", [
      { atMs: 550, text: "그날 밤, 왕도의 등불이 하나씩 꺼져 갔다." },
      { atMs: 3200, text: "아무도 문을 열지 않았다." },
    ], 5600),
  ], { keys: cam }, { kind: "fade", durationMs: 550 }, [
    { id: "night-air", resourceId: SE.air, atMs: 0, durationMs: 6000, volume: 0.85, fadeInMs: 800, fadeOutMs: 700 },
    { id: "curfew-bell", resourceId: SE.bell, atMs: 1200, durationMs: 4200, volume: 0.55, fadeOutMs: 1200 },
  ]);
}

// ── 2. 북문을 빠져나가는 쇠 마차 (5,250ms) ─────────────────────────────────
function carriageShot(): OpeningAnimatic {
  const cam: CamKeys = {
    x: [key(0, 246), key(5250, 304, "ease-in-out")],
    y: [key(0, 158), key(5250, 146, "ease-in-out")],
    zoom: [key(0, 1.03), key(5250, 1.14, "ease-in-out")],
  };
  return shot([
    art("act2-carriage"),
    // 북문 벽 횃불 2개
    glow("gate-torch-l", "#ff9642", { x: 82, y: 221 }, 46, {
      opacity: 0.56,
      glow: { inner: 0.3, pulse: { hz: 4.1, amount: 0.3, pattern: "flicker", seed: 11 } },
    }),
    glow("gate-torch-r", "#ff9642", { x: 189, y: 260 }, 46, {
      opacity: 0.56,
      glow: { inner: 0.3, pulse: { hz: 3.7, amount: 0.3, pattern: "flicker", seed: 19 } },
    }),
    // 호송 기병 횃불
    glow("escort-torch", "#ff8438", { x: 454, y: 123 }, 56, {
      opacity: 0.72,
      glow: { inner: 0.32, pulse: { hz: 4.8, amount: 0.32, pattern: "flicker", seed: 23 } },
    }),
    // 마차 뒤 쇠창살 안쪽 — 세 번의 노크에 맞춰 푸른 별빛이 깜박인다
    glow("iris-window-glow", "#94f2ff", { x: 330, y: 159 }, 42, {
      keys: {
        opacity: [
          key(0, 0.22),
          key(2600, 0.25),
          key(2740, 0.92),
          key(3040, 0.22),
          key(3240, 0.92),
          key(3540, 0.22),
          key(3740, 0.98),
          key(4350, 0.35, "ease-out"),
          key(5250, 0.2),
        ],
      },
    }),
    particles("north-snow", "snow", "#cfe0f5", { x: 0, y: 0, width: 528, height: 297 }, 42, 47, {
      parallax: 1.2,
      blend: undefined,
      opacity: 0.52,
    }),
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

// ── 3. 재의 폐허 너머 깨어나는 하늘탑 (5,500ms) ────────────────────────────
function towerWakeShot(): OpeningAnimatic {
  const cam: CamKeys = {
    x: [key(0, 264), key(5500, 264)],
    y: [key(0, 174), key(5500, 118, "ease-in-out")],
    zoom: [key(0, 1.04), key(2150, 1.09, "ease-in-out"), key(5500, 1.15, "ease-out")],
  };
  return shot([
    art("act2-tower"),
    // 하늘탑 정상에서 솟구치는 붉은 불기둥 증폭
    {
      id: "tower-fire-shaft",
      kind: "shaft",
      role: "effect",
      color: "#ff6e44",
      blend: "lighter",
      x: 242,
      y: -18,
      width: 44,
      height: 165,
      rotation: 0,
      parallax: 0.96,
      shaft: {
        spread: 0.32,
        softness: 0.78,
        dust: { count: 16, seed: 89, speed: 14, size: 1 },
        pulse: { hz: 1.8, amount: 0.3, pattern: "pulse", seed: 7 },
      },
      keys: {
        opacity: [
          key(0, 0.14),
          key(1600, 0.28),
          key(2200, 0.72, "ease-out"),
          key(5500, 0.55),
        ],
      },
    },
    glow("tower-crown-flare", "#ff9248", { x: 264, y: 50 }, 96, {
      keys: { opacity: [key(0, 0.25), key(2150, 0.92, "ease-out"), key(5500, 0.65)] },
      glow: { inner: 0.34, pulse: { hz: 2.8, amount: 0.3, pattern: "flicker", seed: 31 } },
    }),
    glow("tower-rune-glow", "#ff5638", { x: 264, y: 100 }, 64, {
      keys: { opacity: [key(0, 0.18), key(2150, 0.65, "ease-out"), key(5500, 0.48)] },
      glow: { inner: 0.3, pulse: { hz: 2.1, amount: 0.28, pattern: "pulse", seed: 41 } },
    }),
    particles("ash-flakes", "snow", "#b2bac8", { x: 0, y: 0, width: 528, height: 297 }, 36, 63, {
      parallax: 1.18,
      blend: undefined,
      opacity: 0.45,
    }),
    particles("tower-sparks", "sparks", "#ffaa58", { x: 110, y: 20, width: 310, height: 210 }, 34, 73, {
      startMs: 1600,
      opacity: 0.82,
    }),
    screenFill("red-surge", "#ff5e38", [
      key(0, 0),
      key(2080, 0),
      key(2220, 0.26, "ease-out"),
      key(2950, 0.04, "ease-out"),
    ], "screen"),
    caption("line-tower", [{ atMs: 650, text: "서른 해 전 불탄 마을 너머, 하늘탑이 깨어난다." }], 5000),
  ], {
    keys: cam,
    shake: { atMs: 2150, durationMs: 900, amplitude: 3.5, frequency: 18, seed: 11 },
  }, { kind: "fade", durationMs: 550 }, [
    { id: "tower-hum", resourceId: SE.pod, atMs: 0, durationMs: 5500, volume: 0.85, fadeInMs: 600, fadeOutMs: 700 },
  ]);
}

// ── 4. 제2막 타이틀 「빌린 불」 (5,750ms) ──────────────────────────────────
function act2TitleShot(): OpeningAnimatic {
  const cam: CamKeys = {
    x: [key(0, 264), key(5750, 264)],
    y: [key(0, 160), key(5750, 138, "ease-in-out")],
    zoom: [key(0, 1.02), key(1800, 1.06, "ease-in"), key(2000, 1.02, "ease-out"), key(5750, 1.06)],
  };
  const hitAt = 1850;
  return shot([
    art("act2-title"),
    // 먼 산맥 너머 타오르는 하늘탑 화로 불빛
    glow("horizon-spire-fire", "#ff7832", { x: 132, y: 128 }, 94, {
      opacity: 0.62,
      glow: { inner: 0.3, pulse: { hz: 1.9, amount: 0.3, pattern: "flicker", seed: 53 } },
    }),
    // 오른쪽 위 푸른 혜성 꼬리 반짝임
    glow("comet-head-glint", "#8ee6ff", { x: 392, y: 48 }, 46, {
      opacity: 0.55,
      glow: { inner: 0.28, pulse: { hz: 1.4, amount: 0.24, pattern: "pulse", seed: 61 } },
    }),
    // 강가 모닥불 반사
    glow("river-camp-fire", "#ffaa48", { x: 389, y: 211 }, 34, {
      opacity: 0.52,
      glow: { inner: 0.25, pulse: { hz: 3.4, amount: 0.3, pattern: "flicker", seed: 67 } },
    }),
    glow("title-ember-bloom", "#ff9648", { x: 240, y: 92 }, 250, {
      space: "screen",
      startMs: hitAt - 280,
      keys: { opacity: [key(hitAt - 280, 0), key(hitAt + 420, 0.34, "ease-out"), key(5750, 0.16)] },
    }),
    {
      id: "act2-kicker",
      kind: "text",
      role: "credit",
      space: "screen",
      text: "폴른 스타",
      color: "#d8e6ff",
      x: 0,
      y: 44,
      width: STAGE.width,
      height: 22,
      typography: { fontSize: 13, weight: 700, align: "center" },
      startMs: hitAt - 200,
      keys: { opacity: [key(hitAt - 200, 0), key(hitAt + 350, 0.9, "ease-out")] },
    },
    {
      id: "act2-main-title",
      kind: "text",
      role: "credit",
      space: "screen",
      text: "제2막 · 빌린 불",
      color: "#ffd98a",
      x: 0,
      y: 66,
      width: STAGE.width,
      height: 54,
      typography: { fontSize: 38, weight: 800, align: "center" },
      startMs: hitAt,
      keys: {
        opacity: [key(hitAt, 0), key(hitAt + 450, 1, "ease-out")],
        y: [key(hitAt, 76), key(hitAt + 550, 66, "ease-out")],
      },
    },
    {
      id: "act2-epigraph",
      kind: "text",
      role: "credit",
      space: "screen",
      text: "대답하지 않은 밤의 대가",
      color: "#ebd8c4",
      x: 0,
      y: 124,
      width: STAGE.width,
      height: 22,
      typography: { fontSize: 13, weight: 600, align: "center" },
      startMs: hitAt + 700,
      keys: { opacity: [key(hitAt + 700, 0), key(hitAt + 1250, 0.92, "ease-out")] },
    },
    particles("title-embers", "sparks", "#ffba78", { x: 0, y: 70, width: 528, height: 227 }, 26, 91, {
      parallax: 1.2,
      opacity: 0.58,
    }),
    screenFill("title-flash", "#ffe6c0", [
      key(0, 0),
      key(hitAt - 40, 0),
      key(hitAt + 50, 0.36),
      key(hitAt + 650, 0, "ease-out"),
    ], "screen"),
    screenFill("close-out", "#000000", [key(0, 0), key(4650, 0), key(5750, 1, "ease-in")]),
  ], { keys: cam }, { kind: "fade", durationMs: 900 }, [
    { id: "act2-rise", resourceId: SE.titleRise, atMs: 0, durationMs: hitAt, volume: 0.9 },
    { id: "act2-hit", resourceId: SE.titleHit, atMs: hitAt - 20, durationMs: 5750 - hitAt + 20, volume: 0.85, fadeOutMs: 1800 },
  ]);
}

const ACT2_SHOTS: readonly { id: string; build: () => OpeningAnimatic; ms: number }[] = [
  { id: "fs2_op_curfew", build: curfewShot, ms: 6000 },
  { id: "fs2_op_carriage", build: carriageShot, ms: 5250 },
  { id: "fs2_op_tower_wake", build: towerWakeShot, ms: 5500 },
  { id: "fs2_op_title", build: act2TitleShot, ms: 5750 },
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
