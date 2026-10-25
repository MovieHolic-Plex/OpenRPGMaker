/**
 * 『첫사랑』 오프닝 — 애니메이션 오프닝풍 몽타주(2026-10-25 사용자 승인 C 안), 약 30초.
 *
 * 벚꽃 거리 → 아침 지하철 → 사무실 → 노을 옥상 → 등장인물이 이름과 함께 한 명씩 → 마지막에 제목.
 * 배경은 게임 맵 그 자체를 1:1 로 구운 그림(src/assets/firstLoveOpeningBackdrops.ts)이라 플레이 화면과 화풍이 같다.
 * 걷는 사람은 게임의 같은 걷기 칩(CAST), 흉상은 대화에 쓰는 공용 흉상이다 — 새로 그린 인물은 없다.
 * 벚꽃잎은 애니메틱 입자 'petals'(일반 기능), 노을은 공용 노을 파노라마. 마지막 제목 컷 뒤 게임은 출근길 횡단보도의 첫 만남에서 바로 시작한다.
 */
import { CHARSET_FRAME_COUNT, CHARSET_FRAME_HEIGHT, CHARSET_FRAME_WIDTH, CHARSET_SHEET_COLUMNS, charsetFrameIndex } from "@/assets/easyrpgRtp";
import { firstLoveOpeningBackdrop, type FirstLoveOpeningBackdropId } from "@/assets/firstLoveOpeningBackdrops";
import { validateOpeningAnimatic, type AnimaticKey, type AnimaticLayer, type OpeningAnimatic } from "@/project/openingAnimatic";
import type { Project } from "@/project/types";
import { CAST, bustId, type Who } from "./firstLoveKit";

const STAGE = { width: 480, height: 270 } as const;
const CAPTION = "#fff1e6";
const SHOT_MS = 4200;
const PETAL = "#ffc6d9";
const CHIP = { w: CHARSET_FRAME_WIDTH, h: CHARSET_FRAME_HEIGHT } as const;
const SHEET = { frameWidth: CHARSET_FRAME_WIDTH, frameHeight: CHARSET_FRAME_HEIGHT, columns: CHARSET_SHEET_COLUMNS, count: CHARSET_FRAME_COUNT, fps: 0 } as const;

const key = (atMs: number, value: number, ease: AnimaticKey["ease"] = "ease-in-out"): AnimaticKey => ({ atMs, value, ease });

/** 맵 그림 배경 — 1배(nearest)로 깔고 카메라 대신 그림을 천천히 민다. */
function mapBackdrop(id: FirstLoveOpeningBackdropId, from: { x: number; y: number }, to: { x: number; y: number }, ms = SHOT_MS): AnimaticLayer {
  const b = firstLoveOpeningBackdrop(id);
  return {
    id: `bg-${id}`, kind: "image", role: "background", resourceId: b.resourceId, sampling: "nearest",
    x: from.x, y: from.y, width: b.crop.width, height: b.crop.height,
    keys: { x: [key(0, from.x), key(ms, to.x)], y: [key(0, from.y), key(ms, to.y)] },
  } as AnimaticLayer;
}

function petals(id: string, count: number, seed: number, extra: Partial<AnimaticLayer> = {}): AnimaticLayer {
  return {
    id, kind: "particles", role: "effect", space: "screen", color: PETAL, opacity: 0.95,
    x: -40, y: -20, width: STAGE.width + 80, height: STAGE.height + 40, particles: { preset: "petals", count, seed, size: 2 }, ...extra,
  } as AnimaticLayer;
}

function caption(text: string, atMs = 300): AnimaticLayer {
  return {
    id: "caption", kind: "caption", x: 0, y: 0, width: STAGE.width, height: 38, color: CAPTION,
    typography: { fontSize: 12, align: "center", weight: 600 },
    caption: { cues: [{ atMs, text, typewriterMs: 600 }], fadeOutMs: 400 },
  };
}

/** 걷는 사람(게임과 같은 칩) — 발걸음이 이동 거리에 맞물린다. 칩은 무대에서 2배(맵 그림과 같은 도트 크기: 맵도 1배 16px 칸 → 무대 480 이 맵 30칸). */
function walker(id: string, who: Who | { resource: string; index: number }, dir: "left" | "right" | "up" | "down", from: { x: number; y: number }, to: { x: number; y: number }, ms = SHOT_MS, startMs = 0): AnimaticLayer {
  const c = typeof who === "string" ? CAST[who] : who;
  const frames = [1, 2, 1, 0].map((pattern) => charsetFrameIndex({ characterIndex: c.index, direction: dir, pattern }));
  return {
    id, kind: "image", role: "actor", characterRole: "crowd", resourceId: c.resource, sampling: "nearest",
    sheet: { ...SHEET },
    x: from.x, y: from.y, width: CHIP.w, height: CHIP.h,
    walk: { stride: 8, frames, holdFrame: frames[0]! },
    // 끝 키는 컷 길이를 넘지 않는다(늦게 출발한 사람은 컷이 끝날 때 그 비율만큼만 간다).
    keys: (() => {
      const end = Math.min(SHOT_MS, startMs + ms), t = (end - startMs) / ms;
      const ex = Math.round(from.x + (to.x - from.x) * t), ey = Math.round(from.y + (to.y - from.y) * t);
      return { x: [key(startMs, from.x, "linear"), key(end, ex, "linear")], y: [key(startMs, from.y, "linear"), key(end, ey, "linear")] };
    })(),
  } as AnimaticLayer;
}

function standing(id: string, who: Who, dir: "left" | "right" | "up" | "down", at: { x: number; y: number }): AnimaticLayer {
  const c = CAST[who];
  return {
    id, kind: "image", role: "actor", characterRole: "hero", resourceId: c.resource, sampling: "nearest",
    sheet: { ...SHEET },
    x: at.x, y: at.y, width: CHIP.w, height: CHIP.h,
    keys: { frame: [{ atMs: 0, value: charsetFrameIndex({ characterIndex: c.index, direction: dir, pattern: 1 }) }] },
  } as AnimaticLayer;
}

const shot = (layers: AnimaticLayer[], transition: OpeningAnimatic["transition"], background = "#0b0a12"): OpeningAnimatic =>
  ({ width: STAGE.width, height: STAGE.height, background, letterbox: 0.12, layers, ...(transition ? { transition } : {}) });

const M = { modern1: "oprn-charset-modern1", modern2: "oprn-charset-modern2", modern3: "oprn-charset-modern3" } as const;
const extra = (resource: string, index: number) => ({ resource, index });

/** 1. 벚꽃 거리 — 꽃잎이 화면 가득 흩날리고, 출근하는 사람 둘이 보도를 지난다. */
function blossomShot(): OpeningAnimatic {
  return shot([
    mapBackdrop("blossom", { x: 0, y: -10 }, { x: -40, y: -20 }),
    walker("w1", extra(M.modern3, 0), "right", { x: 60, y: 150 }, { x: 236, y: 150 }),
    walker("w2", "seoha", "right", { x: -20, y: 176 }, { x: 148, y: 176 }, SHOT_MS, 400),
    petals("petals-far", 70, 3, { opacity: 0.7 }),
    petals("petals-near", 40, 11, { particles: { preset: "petals", count: 40, seed: 11, size: 3, speed: 40 } } as Partial<AnimaticLayer>),
    caption("봄. 새 회사로 가는 첫 월요일."),
  ], { kind: "fade", durationMs: 900 });
}

/** 2. 아침 지하철 — 승강장을 서둘러 지나는 출근 인파. */
function subwayShot(): OpeningAnimatic {
  return shot([
    mapBackdrop("subway", { x: 0, y: 0 }, { x: -48, y: 0 }),
    walker("c1", extra(M.modern3, 0), "right", { x: 20, y: 96 }, { x: 260, y: 96 }),
    walker("c2", "commuterB", "right", { x: -40, y: 118 }, { x: 220, y: 118 }),
    walker("c3", extra(M.modern3, 2), "left", { x: 470, y: 108 }, { x: 250, y: 108 }),
    walker("c4", "seoha", "right", { x: 120, y: 128 }, { x: 330, y: 128 }, SHOT_MS - 400, 200),
    petals("petals", 10, 19, { opacity: 0.6 }),
    caption("8시 41분, 한결역."),
  ], { kind: "wipe-left", durationMs: 450 });
}

/** 3. 사무실 — 모니터가 줄지어 선 7층, 자리에 앉은 사람들. */
function officeShot(): OpeningAnimatic {
  return shot([
    // 맵 (0,0) 을 무대 (32,-40) → (8,-64) 로 민다: 자리 무리(맵 y 96~200)가 레터박스 안에 든다. 앉은 지후·걸어오는 팀장.
    mapBackdrop("office", { x: 32, y: -40 }, { x: 8, y: -64 }),
    { ...standing("jihu", "jihu", "up", { x: 32 + 17 * 16 - 4, y: -40 + 9 * 16 - 16 }),
      keys: { x: [key(0, 32 + 17 * 16 - 4), key(SHOT_MS, 8 + 17 * 16 - 4)], y: [key(0, -40 + 9 * 16 - 16), key(SHOT_MS, -64 + 9 * 16 - 16)],
        frame: [{ atMs: 0, value: charsetFrameIndex({ characterIndex: CAST.jihu.index, direction: "up", pattern: 1 }) }] } } as AnimaticLayer,
    walker("lead", "lead", "left", { x: 420, y: 170 }, { x: 330, y: 146 }, 3000, 400),
    petals("petals", 8, 23, { opacity: 0.5 }),
    caption("스튜디오 늘봄. 서른 명 남짓한 앱 회사."),
  ], { kind: "wipe-right", durationMs: 450 });
}

/** 4. 노을 옥상 — 노을 하늘 아래 난간, 지는 해. */
function rooftopShot(): OpeningAnimatic {
  return shot([
    { id: "sky", kind: "image", role: "background", resourceId: "oprn-pano-sunset", sampling: "nearest", x: -40, y: -10, width: 640, height: 240,
      keys: { x: [key(0, -40), key(SHOT_MS, -100)] } } as AnimaticLayer,
    { id: "sky-clouds", kind: "image", role: "background", resourceId: "oprn-pano-sunset-clouds", sampling: "nearest", x: 0, y: -10, width: 640, height: 240,
      keys: { x: [key(0, 0), key(SHOT_MS, -90)] } } as AnimaticLayer,
    { id: "skyline", kind: "image", role: "background", resourceId: "oprn-pano-sunset-skyline", sampling: "nearest", x: -20, y: 10, width: 640, height: 240,
      keys: { x: [key(0, -20), key(SHOT_MS, -60)] } } as AnimaticLayer,
    // 옥상 아랫부분(난간·데크)만 — 하늘 자리는 노을 파노라마가 맡는다. 두 사람은 난간 앞에서 노을을 본다.
    { ...mapBackdrop("rooftop", { x: 0, y: 80 }, { x: 0, y: 70 }), id: "deck" } as AnimaticLayer,
    { ...standing("seoha", "seoha", "up", { x: 212, y: 116 }), keys: { y: [key(0, 116), key(SHOT_MS, 106)], frame: [{ atMs: 0, value: charsetFrameIndex({ characterIndex: CAST.seoha.index, direction: "up", pattern: 1 }) }] } } as AnimaticLayer,
    { ...standing("jihu", "jihu", "up", { x: 238, y: 116 }), keys: { y: [key(0, 116), key(SHOT_MS, 106)], frame: [{ atMs: 0, value: charsetFrameIndex({ characterIndex: CAST.jihu.index, direction: "up", pattern: 1 }) }] } } as AnimaticLayer,
    { id: "sun", kind: "glow", role: "effect", color: "#ffb36b", blend: "lighter", x: 300, y: 30, width: 180, height: 180, opacity: 0.55,
      glow: { inner: 0.25, pulse: { hz: 0.4, amount: 0.15, pattern: "pulse", seed: 4 } } } as AnimaticLayer,
    petals("petals", 26, 31, { opacity: 0.85 }),
    caption("노을이 지는 옥상. 그리고 — 그 사람."),
  ], { kind: "dither", durationMs: 650 });
}

/** 5·6. 등장인물 — 흉상이 한 명씩 미끄러져 들어오고 이름이 뜬다. */
function castShot(pair: readonly { who: Who; role: string; expr?: "base" | "happy" }[], shade: string): OpeningAnimatic {
  const layers: AnimaticLayer[] = [
    { id: "band", kind: "shape", shape: "rect", role: "background", color: shade, x: 0, y: 0, width: STAGE.width, height: STAGE.height } as AnimaticLayer,
    petals("petals", 34, 41 + pair.length, { opacity: 0.8 }),
  ];
  const half = SHOT_MS / pair.length;
  pair.forEach((p, i) => {
    const at = Math.round(i * half), end = Math.round((i + 1) * half);
    const left = i % 2 === 0;
    const bustX = left ? 40 : 250, nameX = left ? 236 : 40;
    layers.push({
      id: `bust-${p.who}`, kind: "image", role: "actor", resourceId: bustId(p.who, p.expr ?? "base"), sampling: "linear",
      x: bustX, y: 34, width: 200, height: 200, startMs: at, endMs: end,
      keys: {
        x: [key(at, bustX + (left ? -60 : 60), "ease-out"), key(at + 500, bustX, "ease-out"), key(end - 300, bustX), key(end, bustX + (left ? 30 : -30), "ease-in")],
        opacity: [key(at, 0), key(at + 400, 1, "ease-out"), key(end - 300, 1), key(end, 0, "ease-in")],
      },
    } as AnimaticLayer);
    layers.push({
      id: `name-${p.who}`, kind: "text", role: "credit", text: CAST[p.who].name === "오 팀장" ? "오정민" : nameOf(p.who), color: "#ffffff",
      x: nameX, y: 110, width: 200, height: 40, startMs: at + 250, endMs: end, typography: { fontSize: 26, align: "center", weight: 700 },
      keys: { opacity: [key(at + 250, 0), key(at + 650, 1, "ease-out"), key(end - 300, 1), key(end, 0, "ease-in")] },
    } as AnimaticLayer);
    layers.push({
      id: `role-${p.who}`, kind: "text", role: "credit", text: p.role, color: "#ffe2ec",
      x: nameX, y: 146, width: 200, height: 24, startMs: at + 450, endMs: end, typography: { fontSize: 12, align: "center", weight: 600 },
      keys: { opacity: [key(at + 450, 0), key(at + 850, 1, "ease-out"), key(end - 300, 1), key(end, 0, "ease-in")] },
    } as AnimaticLayer);
  });
  return shot(layers, { kind: "flash", durationMs: 220, color: "#fff1f6" }, shade);
}

const FULL_NAMES: Partial<Record<Who, string>> = { seoha: "윤서하", jihu: "강지후", minho: "차민호" };
function nameOf(who: Who): string { return FULL_NAMES[who] ?? CAST[who].name; }

/** 7. 제목 — 노을빛 위에 꽃잎, 「첫사랑」. */
function titleShot(): OpeningAnimatic {
  return shot([
    { id: "sky", kind: "image", role: "background", resourceId: "oprn-pano-sunset", sampling: "nearest", x: -80, y: 0, width: 640, height: 240,
      keys: { x: [key(0, -80), key(SHOT_MS, -110)] } } as AnimaticLayer,
    { id: "skyline", kind: "image", role: "background", resourceId: "oprn-pano-sunset-skyline", sampling: "nearest", x: -60, y: 30, width: 640, height: 240 } as AnimaticLayer,
    { id: "dim", kind: "shape", shape: "rect", role: "background", color: "#1a0f1f", opacity: 0.35, x: 0, y: 0, width: STAGE.width, height: STAGE.height } as AnimaticLayer,
    petals("petals", 60, 53),
    { id: "title", kind: "text", role: "credit", text: "첫사랑", color: "#ffffff", x: 40, y: 92, width: 400, height: 60, startMs: 300,
      typography: { fontSize: 44, align: "center", weight: 800 },
      keys: { opacity: [key(300, 0), key(1300, 1, "ease-out")], scaleX: [key(300, 1.08), key(1600, 1, "ease-out")], scaleY: [key(300, 1.08), key(1600, 1, "ease-out")] } } as AnimaticLayer,
    { id: "subtitle", kind: "text", role: "credit", text: "10년 만에, 사수가 됐다", color: "#ffe2ec", x: 40, y: 152, width: 400, height: 24, startMs: 1300,
      typography: { fontSize: 14, align: "center", weight: 600 },
      keys: { opacity: [key(1300, 0), key(2100, 1, "ease-out")] } } as AnimaticLayer,
  ], { kind: "flash", durationMs: 260, color: "#fff6ee" });
}

const SHOTS: readonly { id: string; build: () => OpeningAnimatic }[] = [
  { id: "fl_op_blossom", build: blossomShot },
  { id: "fl_op_subway", build: subwayShot },
  { id: "fl_op_office", build: officeShot },
  { id: "fl_op_rooftop", build: rooftopShot },
  { id: "fl_op_cast1", build: () => castShot([{ who: "seoha", role: "신입 UX 디자이너", expr: "happy" }, { who: "jihu", role: "앱 개발 4년 차 · 사수" }], "#3a2236") },
  { id: "fl_op_cast2", build: () => castShot([{ who: "minho", role: "백엔드 신입 · 동기", expr: "happy" }, { who: "lead", role: "프로덕트팀 팀장" }], "#22304a") },
  { id: "fl_op_title", build: titleShot },
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
