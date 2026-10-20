/**
 * 『폴른 스타』 오프닝 — 다섯 컷 레이어 애니메틱.
 *
 * 2026-10-21 사용자 「타이틀·오프닝은 생성 이미지로 제대로」: 컷 배경은 이미지 모델로 만든 16px 칩셋 화풍 그림을
 * 게임 화면 배율 64색 도트로 누른 것이다(src/assets/fallenStarOpeningBackdrops.ts, 후보·선택 근거는 그 파일).
 * 사람·관·별똥별은 그림 안에 있다 — 그 위에 칩을 얹지 않는다(감사 1차 반려: 그림 위 2배 칩).
 * 움직임은 빛(glow)·입자·카메라만 준다. 카메라는 528×297 그림 안에서 1배로 흐르고, 관 클로즈업만 정수 2배다.
 * 자막은 위 레터박스 띠에 그 컷에 보이는 것만 말한다.
 */
import { fallenStarArt, type FallenStarArtId } from "@/assets/fallenStarOpeningBackdrops";
import { validateOpeningAnimatic, type AnimaticLayer, type OpeningAnimatic } from "@/project/openingAnimatic";
import type { Project } from "@/project/types";

const STAGE = { width: 480, height: 270 } as const;
const SHOT_MS = 7000;
const CAPTION_COLOR = "#fff0dc";

function backdrop(id: FallenStarArtId): AnimaticLayer {
  const { resourceId, width, height } = fallenStarArt(id);
  return { id: "backdrop", kind: "image", role: "background", resourceId, sampling: "nearest", x: 0, y: 0, width, height };
}

function glow(id: string, color: string, center: { x: number; y: number }, size: number, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  return { id, kind: "glow", role: "effect", color, blend: "lighter", x: center.x - size / 2, y: center.y - size / 2, width: size, height: size,
    glow: { inner: 0.3, pulse: { hz: 0.7, amount: 0.25, pattern: "pulse", seed: id.length } }, ...extra };
}

/** 촛불·창 불빛 — 작은 빛이 제각각 깜빡인다. */
function flicker(id: string, at: { x: number; y: number }, size = 22, color = "#ffc070", opacity = 0.45): AnimaticLayer {
  return glow(id, color, at, size, { opacity, glow: { inner: 0.25, pulse: { hz: 1.6 + (id.length % 5) * 0.23, amount: 0.35, pattern: "flicker", seed: id.length * 7 } } });
}

function particles(id: string, preset: "stars" | "sparks" | "dust", color: string, box: { x: number; y: number; width: number; height: number }, count: number, seed: number, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  return { id, kind: "particles", role: "effect", color, opacity: 0.7, blend: "lighter", ...box, particles: { preset, count, seed, speed: preset === "stars" ? 6 : 10, size: preset === "dust" ? 2 : 1 }, ...extra };
}

function caption(cues: readonly { atMs: number; text: string }[]): AnimaticLayer {
  return { id: "caption", kind: "caption", x: 0, y: 0, width: STAGE.width, height: 38, color: CAPTION_COLOR, typography: { fontSize: 16, align: "center", weight: 700 },
    caption: { cues: cues.map(cue => ({ ...cue, typewriterMs: 600 })), fadeOutMs: 400 } };
}

const shot = (layers: AnimaticLayer[], camera: OpeningAnimatic["camera"], transition: OpeningAnimatic["transition"], background = "#05070f", letterbox = 0.14): OpeningAnimatic =>
  ({ width: STAGE.width, height: STAGE.height, background, letterbox, layers, ...(camera ? { camera } : {}), ...(transition ? { transition } : {}) });

/** 1. 밤의 왕도 — 운하와 다리에서 천문대 발코니로 고개를 든다. 발코니에 카엘과 엘레나. */
function nightTownShot(): OpeningAnimatic {
  return shot([
    backdrop("town"),
    particles("stars", "stars", "#dfe8ff", { x: 0, y: 0, width: 528, height: 90 }, 30, 3),
    flicker("door", { x: 304, y: 188 }, 26), flicker("lamp-l", { x: 287, y: 186 }), flicker("balcony", { x: 248, y: 112 }, 20),
    flicker("win-a", { x: 120, y: 150 }), flicker("win-b", { x: 368, y: 118 }, 18), flicker("bridge-lamp", { x: 76, y: 175 }),
    glow("dome", "#c8dcff", { x: 335, y: 80 }, 60, { opacity: 0.35 }),
    caption([
      { atMs: 300, text: "왕도 아스텔. 별을 읽는 천문대의 도시." },
      { atMs: 3600, text: "견습 별지기 카엘과 마도학자 엘레나. 오늘 밤도 관측 당번이다." },
    ]),
  ], { keys: { x: [{ atMs: 0, value: 240 }, { atMs: 6500, value: 286, ease: "ease-in-out" }], y: [{ atMs: 0, value: 162 }, { atMs: 6500, value: 140, ease: "ease-in-out" }] } },
  { kind: "fade", durationMs: 900 });
}

/** 2. 별똥별 — 하늘을 가로지르는 꼬리, 다리 위 사람들이 올려다본다. 동쪽 숲 너머 섬광과 땅울림. */
function fallingStarShot(): OpeningAnimatic {
  const head = { x: 343, y: 67 };
  return shot([
    backdrop("fall"),
    particles("stars", "stars", "#dfe8ff", { x: 0, y: 0, width: 528, height: 80 }, 24, 5),
    glow("star-halo", "#c8f6ff", head, 36, { opacity: 0.5, glow: { inner: 0.45, pulse: { hz: 2.2, amount: 0.35, pattern: "pulse", seed: 3 } } }),
    flicker("bridge-lamp", { x: 334, y: 194 }, 24), flicker("lamp-b", { x: 268, y: 190 }), flicker("win-c", { x: 160, y: 200 }),
    // 꼬리 끝이 향하는 동쪽 지평선 너머 섬광.
    { ...glow("impact", "#e8fbff", { x: 0, y: 0 }, 220, { startMs: 3000, endMs: 5600 }), x: 400, y: -10,
      keys: { opacity: [{ atMs: 3000, value: 0 }, { atMs: 3250, value: 0.85, ease: "ease-out" }, { atMs: 5600, value: 0, ease: "ease-in" }] } },
    caption([
      { atMs: 400, text: "그날 밤, 별 하나가 하늘을 가로질렀다." },
      { atMs: 3300, text: "별은 동쪽 숲에 떨어졌다. 한참 뒤, 땅이 울렸다." },
    ]),
  ], { keys: { x: [{ atMs: 0, value: 260 }, { atMs: 6800, value: 288, ease: "ease-in-out" }], y: [{ atMs: 0, value: 138 }, { atMs: 6800, value: 130, ease: "ease-in-out" }] },
    shake: { atMs: 3600, durationMs: 700, amplitude: 2, frequency: 16, seed: 4 } }, { kind: "cut", durationMs: 1 }, "#05070f", 0.1);
}

/** 3. 천문대 — 하넬이 망원경에 눈을 댄 채 그 빛을 끝까지 좇는다. 돔 틈으로 꼬리가 지나간다. */
function observatoryShot(): OpeningAnimatic {
  return shot([
    backdrop("observatory"),
    glow("slit-streak", "#c8e8ff", { x: 300, y: 38 }, 46, { opacity: 0.6 }),
    glow("scope-eye", "#c8dcff", { x: 252, y: 126 }, 30, { opacity: 0.4 }),
    flicker("candle-a", { x: 196, y: 100 }), flicker("candle-b", { x: 410, y: 116 }), flicker("candle-c", { x: 500, y: 152 }),
    flicker("candle-d", { x: 60, y: 216 }, 26), flicker("candle-e", { x: 410, y: 214 }), flicker("candle-f", { x: 106, y: 176 }),
    caption([
      { atMs: 300, text: "천문대장 하넬은 그 빛을 끝까지 지켜보았다." },
      // 이 컷은 아래 띠가 얇다 — 두 줄로 접히면 화면 밖으로 밀리므로 한 줄씩 나눈다.
      { atMs: 3000, text: "떨어지기 직전, 별은 방향을 틀었다." },
      { atMs: 5000, text: "별똥별은 그러지 않는다." },
    ]),
  // 돔 틈의 별똥별 꼬리가 화면 위쪽에 있다 — 레터박스를 얇게, 카메라를 위로 둔다(감사 VQA: 위 띠가 꼬리를 가렸다).
  // 바둑판 디더 전환은 원화를 망친 것처럼 보였다 — 다른 컷처럼 페이드.
  ], { keys: { x: [{ atMs: 0, value: 264 }, { atMs: 6000, value: 252, ease: "ease-in-out" }], y: [{ atMs: 0, value: 146 }, { atMs: 6000, value: 136, ease: "ease-in-out" }] } },
  { kind: "fade", durationMs: 700 }, "#05070f", 0.06);
}

/** 4. 동쪽 숲 — 쓰러진 나무와 그을린 구덩이, 그 한가운데 유리창 달린 은빛 관. 관으로 다가선다(정수 2배). */
function crashShot(): OpeningAnimatic {
  const pod = { x: 272, y: 166 };
  return shot([
    backdrop("crash"),
    glow("pod-glow", "#8ff0ff", pod, 80, { opacity: 0.55, glow: { inner: 0.35, pulse: { hz: 1.1, amount: 0.4, pattern: "pulse", seed: 7 } } }),
    particles("embers", "sparks", "#ffb070", { x: pod.x - 80, y: pod.y - 40, width: 160, height: 90 }, 16, 9, { opacity: 0.8 }),
    particles("smoke", "dust", "#8090a8", { x: pod.x - 40, y: pod.y - 90, width: 110, height: 90 }, 18, 12, { opacity: 0.4, blend: undefined }),
    caption([
      { atMs: 300, text: "동쪽 숲 깊은 곳. 나무가 쓰러지고 흙이 검게 탔다." },
      { atMs: 3600, text: "그 한가운데, 유리창 달린 은빛 관이 빛나고 있었다." },
    ]),
  ], {
    keys: {
      x: [{ atMs: 0, value: 264 }, { atMs: 3400, value: 268 }, { atMs: 6000, value: pod.x, ease: "ease-in-out" }],
      y: [{ atMs: 0, value: 150 }, { atMs: 3400, value: 156 }, { atMs: 6000, value: pod.y, ease: "ease-in-out" }],
      zoom: [{ atMs: 0, value: 1 }, { atMs: 3400, value: 1 }, { atMs: 6000, value: 2, ease: "ease-in-out" }],
    },
  }, { kind: "fade", durationMs: 700 });
}

/** 5. 이튿날 아침 — 교단 행렬이 성문을 지나 광장에 들어선다. 맨 앞의 검은 망토가 심문관 발렌. */
function morningShot(): OpeningAnimatic {
  return shot([
    backdrop("morning"),
    particles("dust", "dust", "#fff2c8", { x: 160, y: 120, width: 300, height: 120 }, 14, 21, { opacity: 0.35 }),
    caption([
      { atMs: 300, text: "이튿날 아침. 교단의 심문관이 왕도에 들어섰다." },
      { atMs: 3600, text: "하늘에서 떨어진 것을, 모두 거두러 온 자들이었다." },
    ]),
  ], { keys: { x: [{ atMs: 0, value: 250 }, { atMs: 6500, value: 300, ease: "ease-in-out" }], y: [{ atMs: 0, value: 136 }, { atMs: 6500, value: 168, ease: "ease-in-out" }] } },
  { kind: "flash", durationMs: 300, color: "#fff6d8" });
}

/** 컷 길이 — 자막 두 줄(타자 0.6초 + 읽는 시간 약 2.5초)이 들어갈 만큼. 천문대는 할 일이 적어 6초, 추락지는 다가서는 시간만큼 7.5초. */
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

/** 타이틀 키아트 — 별똥별이 천문대 위를 지나는 밤 왕도(480×270, 화면 1배). */
export const FALLEN_STAR_TITLE_BACKGROUND = fallenStarArt("title").resourceId;
