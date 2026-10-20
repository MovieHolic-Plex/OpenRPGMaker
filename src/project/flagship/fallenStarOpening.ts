/**
 * 『폴른 스타』 오프닝 — 다섯 컷 레이어 애니메틱.
 *
 * 감사 1차(2026-10-20)에서 반려된 것: 생성 페인팅 스틸 위에 2배 칩, 그림과 맞지 않는 자막(「크레이터」 자막 위 설산 마을 등),
 * 마차 칩으로 그린 「떨어진 별」. 이제는
 * - 배경 = 게임이 실제로 쓰는 맵(왕도·천문대·숲 추락지)을 1:1 로 구운 그림(src/assets/fallenStarOpeningBackdrops.ts).
 * - 무대 = 게임 화면과 같은 480×270, 사람 칩은 1배(24×32) — 맵 위 크기와 똑같다.
 * - 별똥별·추락 섬광·관의 빛은 빛 효과 레이어(glow)다. 새 도트 그림은 없다.
 * - 자막은 그 컷에 보이는 것만 말한다. 이야기는 컷 5 의 심문관 입성에서 게임 첫 컷신(포고)으로 바로 이어진다.
 */
import { fallenStarBackdrop, type FallenStarBackdropId } from "@/assets/fallenStarOpeningBackdrops";
import { validateOpeningAnimatic, type AnimaticKey, type AnimaticLayer, type OpeningAnimatic } from "@/project/openingAnimatic";
import type { Project } from "@/project/types";

const STAGE = { width: 480, height: 270 } as const;
const TILE = 16;
const CELL = { width: 24, height: 32 } as const;
const SHEET = { frameWidth: CELL.width, frameHeight: CELL.height, columns: 12, count: 96, fps: 0 } as const;
const SHOT_MS = 7000;
const CAPTION_COLOR = "#fff0dc";

type Facing = "up" | "right" | "down" | "left";
const FACING_ROW: Record<Facing, number> = { up: 0, right: 1, down: 2, left: 3 };
type Chip = { resourceId: string; index: number };

/** 게임 안과 같은 칩(chronoBell.ts setupCast·setEventChip). */
const KAEL: Chip = { resourceId: "tex_easyrpg_charset_actor1", index: 0 };
const ELENA: Chip = { resourceId: "tex_easyrpg_charset_actor1", index: 7 };
const VALEN: Chip = { resourceId: "tex_easyrpg_charset_actor1", index: 4 };
const KNIGHT: Chip = { resourceId: "tex_easyrpg_charset_actor1", index: 2 };
const HANEL: Chip = { resourceId: "tex_easyrpg_charset_people1", index: 6 };
const BRAM: Chip = { resourceId: "tex_easyrpg_charset_actor2", index: 2 };

function stepFrames(chip: Chip, facing: Facing): readonly [number, number, number] {
  const base = (Math.floor(chip.index / 4) * 4 + FACING_ROW[facing]) * SHEET.columns + (chip.index % 4) * 3;
  return [base, base + 1, base + 2];
}

/** 타일 (tx, ty) 에 선 칩의 왼쪽 위(맵 px). 칩 칸은 타일보다 넓고 높아 아래·가운데를 맞춘다. */
const standAt = (tx: number, ty: number) => ({ x: tx * TILE + TILE / 2 - CELL.width / 2, y: (ty + 1) * TILE - CELL.height });

function backdrop(id: FallenStarBackdropId): AnimaticLayer {
  const { resourceId, crop } = fallenStarBackdrop(id);
  return { id: "backdrop", kind: "image", role: "background", resourceId, sampling: "nearest", x: crop.x, y: crop.y, width: crop.width, height: crop.height };
}

function standing(id: string, chip: Chip, facing: Facing, at: { x: number; y: number }, turns: { atMs: number; facing: Facing }[] = []): AnimaticLayer {
  const frame: AnimaticKey[] = [{ atMs: 0, value: stepFrames(chip, facing)[1], ease: "step" },
    ...turns.map(turn => ({ atMs: turn.atMs, value: stepFrames(chip, turn.facing)[1], ease: "step" as const }))];
  return { id, kind: "image", role: "actor", resourceId: chip.resourceId, sampling: "nearest", sheet: { ...SHEET }, x: at.x, y: at.y, width: CELL.width, height: CELL.height, keys: { frame } };
}

/** 발걸음이 이동 거리에 맞물려 바뀌는 보행(반 타일마다 한 걸음). 경로는 한 방향으로만 걷는다. */
function walking(id: string, chip: Chip, facing: Facing, path: readonly { atMs: number; x: number; y: number }[]): AnimaticLayer {
  const [left, stand, right] = stepFrames(chip, facing);
  const keys = (axis: "x" | "y"): AnimaticKey[] => path.map(point => ({ atMs: point.atMs, value: point[axis], ease: "linear" }));
  return { id, kind: "image", role: "actor", resourceId: chip.resourceId, sampling: "nearest", sheet: { ...SHEET }, x: path[0]!.x, y: path[0]!.y, width: CELL.width, height: CELL.height,
    walk: { stride: TILE / 2, frames: [stand, right, stand, left], holdFrame: stand }, keys: { x: keys("x"), y: keys("y") } };
}

function emote(id: string, preset: "exclaim" | "question" | "ellipsis", over: { x: number; y: number }, atMs: number, endMs: number): AnimaticLayer {
  return { id, kind: "emote", role: "effect", x: over.x + 2, y: over.y - 20, width: 20, height: 22, startMs: atMs, endMs, emote: { preset, tail: "down", popMs: 160, outMs: 160 } };
}

function glow(id: string, color: string, center: { x: number; y: number }, size: number, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  return { id, kind: "glow", role: "effect", color, blend: "lighter", x: center.x - size / 2, y: center.y - size / 2, width: size, height: size,
    glow: { inner: 0.3, pulse: { hz: 0.7, amount: 0.25, pattern: "pulse", seed: id.length } }, ...extra };
}

function stars(seed: number): AnimaticLayer {
  return { id: "stars", kind: "particles", role: "effect", space: "screen", color: "#dfe8ff", opacity: 0.7, blend: "lighter", x: 0, y: 38, width: STAGE.width, height: 70,
    particles: { preset: "stars", count: 26, seed, speed: 6, size: 1 } };
}

function caption(cues: readonly { atMs: number; text: string }[]): AnimaticLayer {
  return { id: "caption", kind: "caption", x: 0, y: 0, width: STAGE.width, height: 38, color: CAPTION_COLOR, typography: { fontSize: 12, align: "center", weight: 600 },
    caption: { cues: cues.map(cue => ({ ...cue, typewriterMs: 600 })), fadeOutMs: 400 } };
}

const shot = (layers: AnimaticLayer[], camera: OpeningAnimatic["camera"], transition: OpeningAnimatic["transition"], background = "#05070f"): OpeningAnimatic =>
  ({ width: STAGE.width, height: STAGE.height, background, letterbox: 0.14, layers, ...(camera ? { camera } : {}), ...(transition ? { transition } : {}) });

/** 1. 밤의 왕도 — 하늘에서 내려와 천문대 문 앞. 카엘과 엘레나가 밤 당번을 서러 나온다. */
function nightTownShot(): OpeningAnimatic {
  const door = standAt(26, 20), stop = standAt(26, 23), elenaFrom = standAt(27, 21), elenaStop = standAt(27, 23);
  return shot([
    backdrop("hub-night"),
    glow("door-light", "#ffcf7a", { x: 26 * TILE + 8, y: 20 * TILE + 4 }, 44, { opacity: 0.55 }),
    glow("obelisk-light", "#9fc4ff", { x: 35 * TILE + 8, y: 25 * TILE }, 36, { opacity: 0.5 }),
    walking("kael", KAEL, "down", [{ atMs: 0, x: door.x, y: door.y }, { atMs: 1800, x: door.x, y: door.y }, { atMs: 3600, x: stop.x, y: stop.y }]),
    { ...walking("elena", ELENA, "down", [{ atMs: 2200, x: elenaFrom.x, y: elenaFrom.y }, { atMs: 3800, x: elenaStop.x, y: elenaStop.y }]), startMs: 2200 },
    stars(3),
    caption([
      { atMs: 300, text: "왕도 아스텔. 별을 읽는 천문대의 도시." },
      { atMs: 3600, text: "견습 별지기 카엘과 마도학자 엘레나. 오늘 밤도 관측 당번이다." },
    ]),
  ], { x: 440, keys: { y: [{ atMs: 0, value: 190 }, { atMs: 4200, value: 340, ease: "ease-in-out" }] } }, { kind: "fade", durationMs: 900 });
}

/** 2. 같은 자리 — 별 하나가 하늘을 가로질러 동쪽 숲 너머로 떨어진다. 먼 곳의 섬광, 땅울림. */
function fallingStarShot(): OpeningAnimatic {
  const kael = standAt(26, 23), elena = standAt(27, 23);
  const streak = (id: string, size: number, delay: number, opacity: number): AnimaticLayer => ({
    ...glow(id, "#c8f6ff", { x: 0, y: 0 }, size, { space: "screen", opacity, startMs: 700 + delay, endMs: 2700 + delay }),
    keys: {
      x: [{ atMs: 700 + delay, value: -30 }, { atMs: 2500 + delay, value: 470 - size / 2, ease: "ease-in" }],
      y: [{ atMs: 700 + delay, value: 44 }, { atMs: 2500 + delay, value: 132 - size / 2, ease: "ease-in" }],
    },
  });
  return shot([
    backdrop("hub-night"),
    glow("door-light", "#ffcf7a", { x: 26 * TILE + 8, y: 20 * TILE + 4 }, 44, { opacity: 0.55 }),
    standing("kael", KAEL, "down", kael, [{ atMs: 900, facing: "up" }, { atMs: 2500, facing: "right" }]),
    standing("elena", ELENA, "down", elena, [{ atMs: 1100, facing: "up" }, { atMs: 2600, facing: "right" }]),
    stars(5),
    streak("star-trail-3", 10, 240, 0.25),
    streak("star-trail-2", 16, 160, 0.4),
    streak("star-trail-1", 22, 80, 0.6),
    streak("star-head", 30, 0, 0.95),
    { ...glow("impact", "#e8fbff", { x: 0, y: 0 }, 200, { space: "screen", startMs: 2500, endMs: 4600 }), x: 330, y: 20,
      keys: { opacity: [{ atMs: 2500, value: 0 }, { atMs: 2700, value: 0.9, ease: "ease-out" }, { atMs: 4600, value: 0, ease: "ease-in" }] } },
    emote("kael-emote", "exclaim", kael, 950, 2300),
    emote("elena-emote", "exclaim", elena, 1150, 2300),
    caption([
      { atMs: 400, text: "그날 밤, 별 하나가 하늘을 가로질렀다." },
      { atMs: 3300, text: "별은 동쪽 숲에 떨어졌다. 한참 뒤, 땅이 울렸다." },
    ]),
  ], { x: 470, y: 330, shake: { atMs: 3000, durationMs: 700, amplitude: 2, frequency: 16, seed: 4 } }, { kind: "cut", durationMs: 1 });
}

/** 3. 천문대 — 하넬이 망원경에서 눈을 떼고 돌아선다. 별이 떨어지기 직전 방향을 튼 것을 본 사람. */
function observatoryShot(): OpeningAnimatic {
  const hanel = standAt(6, 7);
  return shot([
    backdrop("observatory-night"),
    glow("scope-light", "#c8dcff", { x: 6 * TILE + 8, y: 6 * TILE + 6 }, 40, { opacity: 0.6 }),
    glow("candle", "#ffc070", { x: 4 * TILE + 8, y: 7 * TILE }, 64, { opacity: 0.4 }),
    standing("hanel", HANEL, "up", hanel, [{ atMs: 3300, facing: "down" }]),
    emote("hanel-think", "ellipsis", hanel, 600, 3000),
    emote("hanel-turn", "exclaim", hanel, 3400, 4800),
    caption([
      { atMs: 300, text: "천문대장 하넬은 그 빛을 끝까지 지켜보았다." },
      { atMs: 3500, text: "떨어지기 직전, 별은 방향을 틀었다. 별똥별은 그러지 않는다." },
    ]),
  ], { x: 144, keys: { y: [{ atMs: 0, value: 120 }, { atMs: 5000, value: 150, ease: "ease-in-out" }] } }, { kind: "dither", durationMs: 650 });
}

/** 4. 숲 북쪽 끝 공터 — 그을린 흙 한가운데의 은빛 관. 숲지기 브람이 숲길 끝에서 그것을 본다. */
function crashShot(): OpeningAnimatic {
  const pod = { x: 232, y: 64 }, bram = standAt(17, 9);
  return shot([
    backdrop("forest-night"),
    glow("pod-glow", "#8ff0ff", pod, 96, { glow: { inner: 0.35, pulse: { hz: 1.1, amount: 0.4, pattern: "pulse", seed: 7 } } }),
    { id: "embers", kind: "particles", role: "effect", color: "#ffb070", opacity: 0.8, blend: "lighter", x: pod.x - 70, y: pod.y - 30, width: 140, height: 70,
      particles: { preset: "sparks", count: 14, seed: 9, speed: 10, size: 1 } },
    { id: "smoke", kind: "particles", role: "effect", color: "#8090a8", opacity: 0.45, x: pod.x - 50, y: pod.y - 60, width: 100, height: 80,
      particles: { preset: "dust", count: 18, seed: 12, speed: 8, size: 2 } },
    walking("bram", BRAM, "up", [{ atMs: 0, x: bram.x, y: bram.y + TILE * 3 }, { atMs: 2600, x: bram.x, y: bram.y }]),
    emote("bram-emote", "exclaim", bram, 2800, 4400),
    caption([
      { atMs: 300, text: "동쪽 숲 깊은 곳. 나무가 쓰러지고 흙이 검게 탔다." },
      { atMs: 3600, text: "그 한가운데, 유리창 달린 은빛 관이 빛나고 있었다." },
    ]),
  ], {
    // 브람을 따라 올라온 뒤 은빛 관으로 다가선다(감사 3차: 1배로는 관이 칩 크기라 무엇인지 읽히지 않았다). 정수 배율 2 — 도트가 뭉개지지 않는다.
    keys: {
      x: [{ atMs: 0, value: 240 }, { atMs: 3600, value: 240 }, { atMs: 6200, value: pod.x, ease: "ease-in-out" }],
      y: [{ atMs: 0, value: 185 }, { atMs: 3200, value: 135, ease: "ease-in-out" }, { atMs: 6200, value: 78, ease: "ease-in-out" }],
      zoom: [{ atMs: 0, value: 1 }, { atMs: 3600, value: 1 }, { atMs: 6200, value: 2, ease: "ease-in-out" }],
    },
  }, { kind: "fade", durationMs: 700 });
}

/** 5. 이튿날 아침 — 심문관 발렌과 기사가 다리를 건너 왕도에 들어선다. 카엘과 엘레나가 그 앞에 선다. */
function morningShot(): OpeningAnimatic {
  const kael = standAt(29, 22), elena = standAt(30, 22);
  const from = standAt(4, 21), to = standAt(26, 21);
  return shot([
    backdrop("hub-day"),
    walking("valen", VALEN, "right", [{ atMs: 0, x: from.x, y: from.y }, { atMs: 5200, x: to.x, y: to.y }]),
    walking("knight", KNIGHT, "right", [{ atMs: 0, x: from.x - TILE * 2, y: from.y }, { atMs: 5200, x: to.x - TILE * 2, y: to.y }]),
    standing("kael", KAEL, "left", kael),
    standing("elena", ELENA, "left", elena),
    emote("elena-emote", "ellipsis", elena, 4300, 6400),
    caption([
      { atMs: 300, text: "이튿날 아침. 교단의 심문관이 왕도에 들어섰다." },
      { atMs: 3800, text: "하늘에서 떨어진 것을, 모두 거두러 온 자들이었다." },
    ]),
  ], { y: 352, keys: { x: [{ atMs: 0, value: 290 }, { atMs: 5200, value: 470, ease: "ease-in-out" }] } }, { kind: "flash", durationMs: 300, color: "#fff6d8" });
}

/** 컷 길이 — 녹화로 잰 뒤 맞췄다(감사 3차): 천문대 컷은 하넬이 돌아선 뒤 할 일이 없어 6초, 추락지는 다가서는 시간만큼 7.5초. */
const SHOTS: readonly { id: string; build: () => OpeningAnimatic; ms?: number }[] = [
  { id: "fs_op_night_town", build: nightTownShot },
  { id: "fs_op_falling_star", build: fallingStarShot },
  { id: "fs_op_observatory", build: observatoryShot, ms: 6000 },
  { id: "fs_op_crash", build: crashShot, ms: 7500 },
  { id: "fs_op_morning", build: morningShot },
];

export function buildFallenStarOpening(project: Project): void {
  const scenes = SHOTS.map(({ id, build, ms = SHOT_MS }) => {
    const composition = build();
    validateOpeningAnimatic(composition, ms, `opening.${id}`);
    return { id, kind: "animatic" as const, composition, durationMs: ms, narration: "" };
  });
  project.system.opening = { enabled: true, skippable: true, scenes };
  // 도구 경로가 남긴 저작 타임라인이 있으면 이 오프닝을 덮어쓴다 — 지운다.
  const timelines = (project.meta as { oprnCinematicTimelines?: { entries?: { target?: string }[] } }).oprnCinematicTimelines;
  if (timelines?.entries) timelines.entries = timelines.entries.filter(entry => entry.target !== "opening");
}

/** 타이틀 배경 — 밤의 왕도 한 화면(1배). */
export const FALLEN_STAR_TITLE_BACKGROUND = fallenStarBackdrop("title").resourceId;
