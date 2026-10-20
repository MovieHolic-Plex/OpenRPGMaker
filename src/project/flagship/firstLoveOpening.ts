/**
 * 『첫사랑』 오프닝 — 다섯 컷, 약 30초. 30초 안에 「그 사람」이 나온다.
 *
 * 그림은 앱에 든 연애 타이틀 그림(뒷모습 두 사람) 두 장만 쓴다 — 교복의 두 사람(10년 전)과 밤 사무실 창가의 두 사람(지금).
 * 같은 두 사람이 10년을 사이에 두고 서 있다는 것이 오프닝의 전부다. 사이의 두 컷은 그림 없이 어둠과 빛 한 점과 자막뿐이다.
 * 자막은 그 컷에 보이는 것만 말한다. 마지막 컷 「월요일 아침」에서 게임 첫 장면(아침 승강장)으로 바로 이어진다.
 */
import { validateOpeningAnimatic, type AnimaticLayer, type OpeningAnimatic } from "@/project/openingAnimatic";
import type { Project } from "@/project/types";

const STAGE = { width: 480, height: 270 } as const;
const CAPTION = "#fff1e6";
const SHOT_MS = 6400;

/** 그림 원본 비율 1672×941 — 무대보다 조금 크게 깔고 천천히 민다(앵커 왼쪽 위, 크기는 scale 키로). */
function painting(resourceId: string, from: { x: number; y: number; w: number }, to: { x: number; y: number; w: number }, ms: number): AnimaticLayer {
  const h = (w: number) => Math.round((w * 941) / 1672);
  return {
    id: "painting", kind: "image", role: "background", resourceId, sampling: "linear",
    x: from.x, y: from.y, width: from.w, height: h(from.w),
    keys: {
      x: [{ atMs: 0, value: from.x }, { atMs: ms, value: to.x, ease: "ease-in-out" }],
      y: [{ atMs: 0, value: from.y }, { atMs: ms, value: to.y, ease: "ease-in-out" }],
      scaleX: [{ atMs: 0, value: 1 }, { atMs: ms, value: to.w / from.w, ease: "ease-in-out" }],
      scaleY: [{ atMs: 0, value: 1 }, { atMs: ms, value: to.w / from.w, ease: "ease-in-out" }],
    },
  } as AnimaticLayer;
}

function caption(cues: readonly { atMs: number; text: string }[], y = 0): AnimaticLayer {
  return {
    id: "caption", kind: "caption", x: 0, y, width: STAGE.width, height: 38, color: CAPTION,
    typography: { fontSize: 12, align: "center", weight: 600 },
    caption: { cues: cues.map((cue) => ({ ...cue, typewriterMs: 700 })), fadeOutMs: 400 },
  };
}

function glow(id: string, color: string, x: number, y: number, size: number, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  return {
    id, kind: "glow", role: "effect", color, blend: "lighter", x: x - size / 2, y: y - size / 2, width: size, height: size,
    glow: { inner: 0.3, pulse: { hz: 0.5, amount: 0.25, pattern: "pulse", seed: id.length } }, ...extra,
  } as AnimaticLayer;
}

function dust(seed: number, color = "#ffe2c0"): AnimaticLayer {
  return {
    id: "motes", kind: "particles", role: "effect", space: "screen", color, opacity: 0.55, blend: "lighter",
    x: 0, y: 40, width: STAGE.width, height: 190, particles: { preset: "dust", count: 22, seed, speed: 4, size: 1 },
  } as AnimaticLayer;
}

function centerText(id: string, text: string, atMs: number, endMs: number, size = 14): AnimaticLayer {
  return {
    id, kind: "text", role: "credit", text, color: CAPTION, x: 40, y: 118, width: 400, height: 34, startMs: atMs, endMs,
    typography: { fontSize: size, align: "center", weight: 600 },
    keys: { opacity: [{ atMs, value: 0 }, { atMs: atMs + 700, value: 1, ease: "ease-out" }, { atMs: endMs - 600, value: 1 }, { atMs: endMs, value: 0, ease: "ease-in" }] },
  } as AnimaticLayer;
}

const shot = (layers: AnimaticLayer[], transition: OpeningAnimatic["transition"], background = "#07060c"): OpeningAnimatic =>
  ({ width: STAGE.width, height: STAGE.height, background, letterbox: 0.14, layers, ...(transition ? { transition } : {}) });

/** 1. 10년 전 — 노을 진 학교 복도 창가, 교복의 두 사람. */
function schoolShot(): OpeningAnimatic {
  return shot([
    painting("oprn-title-romance-school", { x: -60, y: -22, w: 600 }, { x: -110, y: -36, w: 640 }, SHOT_MS),
    dust(3),
    caption([
      { atMs: 300, text: "열일곱, 금요일 점심. 방송실 스피커에서 그 목소리가 흘러나왔다." },
      { atMs: 3400, text: "“오늘의 마지막 사연. 보낸 사람은… 바나나우유 님.”" },
    ]),
  ], { kind: "fade", durationMs: 1000 });
}

/** 2. 어둠 속 편지 한 장의 빛 — 마지막 금요일, 처음으로 진짜 이름을 쓴 사연. */
function letterShot(): OpeningAnimatic {
  return shot([
    glow("letter", "#fff0c4", 240, 135, 84, { opacity: 1 }),
    glow("letter-halo", "#ffcf9a", 240, 135, 230, { opacity: 0.45 }),
    centerText("name", "‘바나나우유가 아니라, 윤서하가요.’", 600, 5600, 13),
    caption([
      { atMs: 300, text: "마지막 금요일. 처음으로, 진짜 이름을 썼다." },
    ], 232),
  ], { kind: "fade", durationMs: 800 });
}

/** 3. 꺼지는 빛 — 방송은 나가지 않았다. */
function silenceShot(): OpeningAnimatic {
  return shot([
    {
      ...glow("letter", "#fff0c4", 240, 135, 84, { opacity: 1 }),
      keys: { opacity: [{ atMs: 0, value: 1 }, { atMs: 3200, value: 0, ease: "ease-in" }] },
    } as AnimaticLayer,
    { id: "rain", kind: "particles", role: "effect", space: "screen", color: "#8fa3c8", opacity: 0.35, x: 0, y: 38, width: STAGE.width, height: 194,
      particles: { preset: "rain", count: 40, seed: 7, speed: 30, size: 1 } } as AnimaticLayer,
    caption([
      { atMs: 300, text: "그날 점심 방송은 나가지 않았다." },
      { atMs: 3200, text: "월요일, 선배의 자리는 비어 있었다. 인사도 없이." },
    ]),
  ], { kind: "cut", durationMs: 1 });
}

/** 4. 지금 — 밤의 사무실 창가, 어른이 된 두 사람. */
function officeShot(): OpeningAnimatic {
  return shot([
    painting("oprn-title-romance-office", { x: -40, y: -30, w: 580 }, { x: -150, y: -78, w: 700 }, SHOT_MS),
    dust(9, "#ffd8a8"),
    caption([
      { atMs: 300, text: "10년이 지났다." },
      { atMs: 3000, text: "그 사람이 어디서 무엇을 하는지, 나는 모른다. …몰랐다." },
    ]),
  ], { kind: "fade", durationMs: 1200 });
}

/** 5. 월요일 아침 — 첫 출근. 게임 첫 장면(아침 승강장)으로 이어진다. */
function mondayShot(): OpeningAnimatic {
  return shot([
    glow("dawn", "#ffd9a8", 240, 300, 560, { opacity: 0.6 }),
    centerText("title", "첫 출근, 월요일 아침.", 300, 5800, 15),
    caption([
      { atMs: 2400, text: "새 회사. 새 자리. 그리고 사수로 배정된, 한 사람." },
    ], 232),
  ], { kind: "fade", durationMs: 900 });
}

const SHOTS: readonly { id: string; build: () => OpeningAnimatic }[] = [
  { id: "fl_op_school", build: schoolShot },
  { id: "fl_op_letter", build: letterShot },
  { id: "fl_op_silence", build: silenceShot },
  { id: "fl_op_office", build: officeShot },
  { id: "fl_op_monday", build: mondayShot },
];

export function buildFirstLoveOpening(project: Project, musicResourceId?: string): void {
  const scenes = SHOTS.map(({ id, build }) => {
    const composition = build();
    validateOpeningAnimatic(composition, SHOT_MS, `opening.${id}`);
    return { id, kind: "animatic" as const, composition, durationMs: SHOT_MS, narration: "" };
  });
  project.system.opening = { enabled: true, skippable: true, scenes, ...(musicResourceId ? { musicResourceId } : {}) } as typeof project.system.opening;
  const timelines = (project.meta as { oprnCinematicTimelines?: { entries?: { target?: string }[] } }).oprnCinematicTimelines;
  if (timelines?.entries) timelines.entries = timelines.entries.filter((entry) => entry.target !== "opening");
}
