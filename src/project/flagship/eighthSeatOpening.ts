/**
 * 『여덟째 자리』 오프닝 — 맵 기반 애니메틱 5컷(약 24초).
 *
 * 숲 승차장 → 큰 강당 → 장학석 명단(아홉 번째 이름) → 시계탑 톱니 → 결투 원의 두 사람 → 검게 닫힘.
 * 배경은 게임 맵을 1:1 로 구운 그림(src/assets/eighthSeatOpeningBackdrops.ts), 인물은 게임과 같은 Wizarding 걷기 칩이다.
 * 새로 그린 그림은 없다.
 */
import { CHARSET_FRAME_COUNT, CHARSET_FRAME_HEIGHT, CHARSET_FRAME_WIDTH, CHARSET_SHEET_COLUMNS, charsetFrameIndex } from "@/assets/easyrpgRtp";
import { eighthSeatBackdrop, type EighthSeatBackdropId } from "@/assets/eighthSeatOpeningBackdrops";
import { validateOpeningAnimatic, type AnimaticKey, type AnimaticLayer, type OpeningAnimatic } from "@/project/openingAnimatic";
import type { Project } from "@/project/types";

const STAGE = { width: 480, height: 270 } as const;
const SHOT_MS = 4800;
const CAPTION = "#efe6d2";
const SHEET = { frameWidth: CHARSET_FRAME_WIDTH, frameHeight: CHARSET_FRAME_HEIGHT, columns: CHARSET_SHEET_COLUMNS, count: CHARSET_FRAME_COUNT, fps: 0 } as const;

type Chip = { readonly sheet: number; readonly index: number };
export const ES_CHIPS = {
  ren: { sheet: 1, index: 1 }, sera: { sheet: 1, index: 7 }, teo: { sheet: 2, index: 0 }, idel: { sheet: 2, index: 3 },
  brandt: { sheet: 3, index: 0 }, orben: { sheet: 2, index: 1 }, dowin: { sheet: 1, index: 5 }, gus: { sheet: 2, index: 7 },
  healer: { sheet: 3, index: 4 },
  scholarA: { sheet: 1, index: 3 }, scholarB: { sheet: 1, index: 6 }, scholarC: { sheet: 3, index: 1 }, scholarD: { sheet: 4, index: 3 },
  scholarE: { sheet: 2, index: 6 }, scholarF: { sheet: 2, index: 4 }, scholarG: { sheet: 1, index: 4 },
  owlA: { sheet: 4, index: 6 }, owlB: { sheet: 4, index: 7 }, owlC: { sheet: 5, index: 0 },
} as const satisfies Record<string, Chip>;
export const chipResource = (c: Chip): string => `oprn-charset-wizarding${c.sheet}`;
export const chipTexture = (c: Chip): string => `tex_oprn_charset_wizarding${c.sheet}`;

const key = (atMs: number, value: number, ease: AnimaticKey["ease"] = "ease-in-out"): AnimaticKey => ({ atMs, value, ease });

/** 맵 배경 — scale 배(정수, nearest)로 깔고 from → to 로 민다(좌표는 무대 픽셀). */
function backdrop(id: EighthSeatBackdropId, scale: number, from: { x: number; y: number }, to: { x: number; y: number }): AnimaticLayer {
  const b = eighthSeatBackdrop(id);
  return {
    id: `bg-${id}`, kind: "image", role: "background", resourceId: b.resourceId, sampling: "nearest",
    x: from.x, y: from.y, width: b.crop.width * scale, height: b.crop.height * scale,
    keys: { x: [key(0, from.x), key(SHOT_MS, to.x)], y: [key(0, from.y), key(SHOT_MS, to.y)] },
  } as AnimaticLayer;
}

/** 맵 칸 (tx,ty)에 선 칩 — 배경과 같이 움직인다(pan = 배경의 from/to). 칩은 맵과 같은 배율. */
function chipAt(id: string, c: Chip, dir: "up" | "down" | "left" | "right", tx: number, ty: number, scale: number,
  pan: { from: { x: number; y: number }; to: { x: number; y: number } }, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  const ox = (tx * 16 - 4) * scale, oy = (ty * 16 - 16) * scale;
  return {
    id, kind: "image", role: "actor", characterRole: "hero", resourceId: chipResource(c), sampling: "nearest", sheet: { ...SHEET },
    x: pan.from.x + ox, y: pan.from.y + oy, width: CHARSET_FRAME_WIDTH * scale, height: CHARSET_FRAME_HEIGHT * scale,
    keys: {
      x: [key(0, pan.from.x + ox), key(SHOT_MS, pan.to.x + ox)], y: [key(0, pan.from.y + oy), key(SHOT_MS, pan.to.y + oy)],
      frame: [{ atMs: 0, value: charsetFrameIndex({ characterIndex: c.index, direction: dir, pattern: 1 }) }],
    },
    ...extra,
  } as AnimaticLayer;
}

/** 걷는 칩 — 발걸음이 이동 거리에 맞물린다. 배경이 고정인 컷에서 쓴다. */
function walker(id: string, c: Chip, dir: "up" | "down" | "left" | "right", from: { x: number; y: number }, to: { x: number; y: number }, startMs: number, endMs: number, scale = 1): AnimaticLayer {
  const frames = [1, 2, 1, 0].map((pattern) => charsetFrameIndex({ characterIndex: c.index, direction: dir, pattern }));
  return {
    id, kind: "image", role: "actor", characterRole: "crowd", resourceId: chipResource(c), sampling: "nearest", sheet: { ...SHEET },
    x: from.x, y: from.y, width: CHARSET_FRAME_WIDTH * scale, height: CHARSET_FRAME_HEIGHT * scale,
    walk: { stride: 8 * scale, frames, holdFrame: frames[0]! },
    keys: { x: [key(startMs, from.x, "linear"), key(endMs, to.x, "linear")], y: [key(startMs, from.y, "linear"), key(endMs, to.y, "linear")] },
  } as AnimaticLayer;
}

function caption(text: string, atMs = 400): AnimaticLayer {
  return {
    id: "caption", kind: "caption", x: 0, y: 0, width: STAGE.width, height: 38, color: CAPTION,
    typography: { fontSize: 12, align: "center", weight: 600 },
    caption: { cues: [{ atMs, text, typewriterMs: 700 }], fadeOutMs: 400 },
  };
}

const dust = (seed: number): AnimaticLayer => ({
  id: "dust", kind: "particles", role: "effect", space: "screen", color: "#f3e3b8", opacity: 0.45,
  x: 0, y: 0, width: STAGE.width, height: STAGE.height, particles: { preset: "dust", count: 40, seed, size: 1 },
} as AnimaticLayer);

const shot = (layers: AnimaticLayer[], transition: OpeningAnimatic["transition"], background = "#07080d"): OpeningAnimatic =>
  ({ width: STAGE.width, height: STAGE.height, background, letterbox: 0.12, upscale: "nearest", layers, ...(transition ? { transition } : {}) });

/** 1. 숲 승차장 — 마차가 서 있고, 트렁크 하나를 든 렌이 내린다. */
function coachShot(): OpeningAnimatic {
  const pan = { from: { x: 0, y: -10 }, to: { x: 0, y: -46 } };
  return shot([
    backdrop("coach", 1, pan.from, pan.to),
    chipAt("brandt", ES_CHIPS.brandt, "left", 16, 10, 1, pan),
    chipAt("sera", ES_CHIPS.sera, "up", 15, 11, 1, pan),
    chipAt("s1", ES_CHIPS.scholarA, "up", 14, 11, 1, pan),
    { ...walker("ren", ES_CHIPS.ren, "right", { x: 12 * 16 - 4, y: 10 * 16 - 16 - 10 }, { x: 13 * 16 - 4, y: 10 * 16 - 16 - 46 }, 600, SHOT_MS) },
    caption("가을 학기 첫날. 서쪽 숲 승차장."),
  ], { kind: "fade", durationMs: 900 });
}

/** 2. 큰 강당 — 벽난로에서 긴 탁자 줄로 천천히 내려온다. */
function hallShot(): OpeningAnimatic {
  const pan = { from: { x: 0, y: 0 }, to: { x: 0, y: -82 } };
  return shot([
    backdrop("hall", 1, pan.from, pan.to),
    chipAt("orben", ES_CHIPS.orben, "down", 14, 5, 1, pan),
    chipAt("idel", ES_CHIPS.idel, "down", 17, 5, 1, pan),
    chipAt("brandt", ES_CHIPS.brandt, "down", 12, 5, 1, pan),
    chipAt("dowin", ES_CHIPS.dowin, "right", 11, 11, 1, pan),
    chipAt("e1", ES_CHIPS.scholarE, "left", 18, 11, 1, pan),
    dust(7),
    caption("케른 마도학원. 장학생의 자리는 여덟 개다."),
  ], { kind: "fade", durationMs: 600 });
}

/** 3. 장학석 명단 — 어두운 책상 위 양피지에 이름 여덟 줄, 그리고 덜 마른 잉크의 아홉 번째. */
function rosterShot(): OpeningAnimatic {
  const names = ["세라", "하림", "유안", "노엘", "이솔", "카이", "벨라", "오린"];
  const layers: AnimaticLayer[] = [
    { id: "desk", kind: "shape", shape: "rect", role: "background", color: "#1a120c", x: 0, y: 0, width: STAGE.width, height: STAGE.height } as AnimaticLayer,
    { id: "paper", kind: "shape", shape: "rect", role: "prop", color: "#d9c9a3", x: 150, y: 28, width: 180, height: 214 } as AnimaticLayer,
    { id: "paper-edge", kind: "shape", shape: "rect", role: "prop", color: "#b8a47c", x: 150, y: 238, width: 180, height: 4 } as AnimaticLayer,
    { id: "head", kind: "text", role: "credit", text: "케른 장학석 · 가을 학기", color: "#3b2a1a", x: 150, y: 38, width: 180, height: 18, typography: { fontSize: 11, align: "center", weight: 700 } } as AnimaticLayer,
  ];
  names.forEach((n, i) => layers.push({
    id: `n${i}`, kind: "text", role: "credit", text: `${i + 1}. ${n}`, color: "#3b2a1a", x: 182, y: 62 + i * 18, width: 140, height: 16,
    startMs: 200 + i * 160, typography: { fontSize: 11, align: "left", weight: 600 },
    keys: { opacity: [key(200 + i * 160, 0), key(400 + i * 160, 1)] },
  } as AnimaticLayer));
  layers.push({
    id: "ninth", kind: "text", role: "credit", text: "9. 렌", color: "#16233f", x: 182, y: 62 + 8 * 18 + 6, width: 140, height: 16,
    startMs: 2500, typography: { fontSize: 11, align: "left", weight: 700, typewriterMs: 500 },
    keys: { opacity: [key(2500, 0), key(2700, 1)] },
  } as AnimaticLayer);
  layers.push({ id: "candle", kind: "glow", role: "effect", color: "#ffb35c", blend: "lighter", x: 40, y: 40, width: 200, height: 200, opacity: 0.35,
    glow: { inner: 0.2, pulse: { hz: 0.8, amount: 0.2, pattern: "flicker", seed: 9 } } } as AnimaticLayer);
  layers.push(caption("올해 장학생은 아홉 명이다.", 2900));
  return shot(layers, { kind: "fade", durationMs: 500 }, "#1a120c");
}

/** 4. 시계탑 기어실 — 큰 톱니 앞을 두 배로 민다. */
function clockShot(): OpeningAnimatic {
  const pan = { from: { x: -40, y: -20 }, to: { x: -96, y: -150 } };
  return shot([
    backdrop("clock", 2, pan.from, pan.to),
    chipAt("gus", ES_CHIPS.gus, "up", 8, 7, 2, pan),
    dust(13),
    caption("겨울 시험이 끝나면, 맨 아래 두 사람이 결정전을 치른다."),
  ], { kind: "fade", durationMs: 600 });
}

/** 5. 실기 강의실 — 훈련 원 양쪽에 렌과 세라. 검게 닫는다. */
function duelShot(): OpeningAnimatic {
  const pan = { from: { x: -40, y: -80 }, to: { x: -80, y: -110 } };
  const layers: AnimaticLayer[] = [
    backdrop("duel", 2, pan.from, pan.to),
    chipAt("ren", ES_CHIPS.ren, "right", 8, 10, 2, pan),
    chipAt("sera", ES_CHIPS.sera, "left", 12, 10, 2, pan),
    caption("진 사람은 여기서 배운 것과 만난 사람을 두고 떠난다."),
    { id: "close", kind: "shape", shape: "rect", role: "background", color: "#000000", opacity: 0, x: 0, y: 0, width: STAGE.width, height: STAGE.height,
      keys: { opacity: [key(SHOT_MS - 900, 0), key(SHOT_MS - 60, 1, "ease-in")] } } as AnimaticLayer,
  ];
  return shot(layers, { kind: "fade", durationMs: 600 });
}

const SHOTS: readonly { id: string; build: () => OpeningAnimatic }[] = [
  { id: "es_op_coach", build: coachShot },
  { id: "es_op_hall", build: hallShot },
  { id: "es_op_roster", build: rosterShot },
  { id: "es_op_clock", build: clockShot },
  { id: "es_op_duel", build: duelShot },
];

export function buildEighthSeatOpening(project: Project, musicResourceId: string): void {
  const scenes = SHOTS.map(({ id, build }) => {
    const composition = build();
    validateOpeningAnimatic(composition, SHOT_MS, `opening.${id}`);
    return { id, kind: "animatic" as const, composition, durationMs: SHOT_MS, narration: "" };
  });
  project.system.opening = { enabled: true, skippable: true, scenes, musicResourceId } as typeof project.system.opening;
}
