/**
 * 『이상 없음』 오프닝 애니메틱 + 타이틀 — 게임 맵(map-view)과 번들 걷기 칩만으로 짓는다. 새 그림 없음.
 *   컷 1 운동장·교문 (밤, 쇠사슬) → 컷 2 2층 복도 (빈 복도, 저 끝 계단참에 손전등) → 컷 3 교무실 열쇠함 →
 *   컷 4 3층 복도 끝의 세일러복 → 컷 5 2-B 교실 (책상에 엎드린 린, 방송 차임) — 게임은 컷 5 의 그 자리에서 시작한다.
 * 음악은 없다. 소리는 바람·발소리·차임뿐.
 */
import { openingMapViewCrop } from "@/project/openingMapView";
import type { AnimaticLayer } from "@/project/openingAnimatic";
import type { Project } from "@/project/types";
import { type Cell, execTool } from "./nothingToReportKit";

const STAGE = { width: 480, height: 270 } as const;
const LB = 0.12;
const TILE = 16;
const INK = "#dfe6ff";
const M = { f1: "map_nr_1f", f2: "map_nr_2f", f3: "map_nr_3f", yard: "map_nr_yard" } as const;
type Crop = { x: number; y: number; width: number; height: number };
type View = { crop: Crop; sc: number };

function layerOf(project: Project, shotId: string, layerId: string): AnimaticLayer {
  const scene = project.system.opening?.scenes.find((s) => s.id === shotId);
  const layer = scene && scene.kind === "animatic" ? scene.composition.layers.find((l) => l.id === layerId) : undefined;
  if (!layer) throw new Error(`[nothing-to-report] 오프닝 ${shotId} 에 레이어 ${layerId} 가 없다`);
  return layer;
}
function patchLayer(project: Project, shotId: string, layerId: string, patch: Partial<AnimaticLayer>): void {
  execTool(project, "upsert_opening_layer", { shotId, layer: { ...JSON.parse(JSON.stringify(layerOf(project, shotId, layerId))), ...patch } });
}
function newShot(project: Project, shotId: string, ms: number, transition: Record<string, unknown>): void {
  execTool(project, "create_opening_animatic_shot", { shotId, durationMs: ms, width: STAGE.width, height: STAGE.height, background: "#000000", replace: true, clearLayers: true });
  execTool(project, "set_opening_pixel_grid", { shotId, width: STAGE.width, height: STAGE.height });
  execTool(project, "set_opening_transition", { shotId, transition, letterbox: LB });
}
function mapBackground(project: Project, shotId: string, mapId: string, focus: Cell, zoom: number): View {
  execTool(project, "place_opening_background", { shotId, layerId: "bg", mapId, focus, zoom });
  const crop = openingMapViewCrop(project.maps[mapId]!, STAGE, focus, zoom);
  return { crop, sc: STAGE.width / crop.width };
}
function chipAt(view: View, c: Cell): Cell {
  return { x: Math.round(((c.x + 0.5) * TILE - 12 - view.crop.x) * view.sc), y: Math.round(((c.y + 1) * TILE - 32 - view.crop.y) * view.sc) };
}
function cellCenter(view: View, c: Cell): Cell {
  return { x: Math.round(((c.x + 0.5) * TILE - view.crop.x) * view.sc), y: Math.round(((c.y + 0.5) * TILE - view.crop.y) * view.sc) };
}
function actor(project: Project, shotId: string, layerId: string, res: string, index: number, at: Cell, dir: "down" | "up" | "left" | "right", scale: number, opts: { blend?: string; opacity?: number } = {}): void {
  execTool(project, "place_opening_charset_actor", { shotId, layerId, charsetResourceId: res, characterIndex: index, direction: dir, scale, x: at.x, y: at.y, stride: 8 * scale, characterRole: "hero" });
  patchLayer(project, shotId, layerId, { x: at.x, y: at.y, ...(opts.blend ? { blend: opts.blend } : {}), ...(opts.opacity !== undefined ? { opacity: opts.opacity } : {}) } as Partial<AnimaticLayer>);
}
/** 밤 — 화면 전체를 짙은 남색으로 곱한다. */
function night(project: Project, shotId: string, opacity = 0.78): void {
  execTool(project, "upsert_opening_layer", { shotId, layer: {
    id: "night", kind: "shape", shape: "rect", role: "effect", space: "screen", color: "#0a0f1e", blend: "multiply", x: 0, y: 0, width: STAGE.width, height: STAGE.height, opacity,
  } });
}
function glow(project: Project, shotId: string, layerId: string, center: Cell, size: number, color: string, opts: { hz?: number; amount?: number; flicker?: boolean; startMs?: number; endMs?: number; inner?: number } = {}): void {
  execTool(project, "upsert_opening_light_fx", {
    shotId, layerId, kind: "glow", x: center.x - size / 2, y: center.y - size / 2, width: size, height: size, color, inner: opts.inner ?? 0.3,
    pulse: { hz: opts.hz ?? 0.8, amount: opts.amount ?? 0.15, pattern: opts.flicker ? "flicker" : "pulse", seed: layerId.length * 5 + size },
    ...(opts.startMs !== undefined ? { startMs: opts.startMs } : {}), ...(opts.endMs !== undefined ? { endMs: opts.endMs } : {}),
  });
}
function sfx(project: Project, shotId: string, id: string, resourceId: string, atMs: number, durationMs: number, volume = 0.7, fadeOutMs?: number): void {
  execTool(project, "upsert_opening_audio_cue", { shotId, cue: { id, resourceId, atMs, durationMs, volume, ...(fadeOutMs ? { fadeOutMs } : {}) } });
}
function captions(project: Project, shotId: string, cues: { atMs: number; text: string }[]): void {
  execTool(project, "set_opening_caption", { shotId, layerId: "caption", letterbox: LB, color: INK, fontSize: 12, fadeOutMs: 500,
    cues: cues.map((c) => ({ ...c, color: INK, typewriterMs: Math.min(900, 40 * c.text.length) })) });
}
function slowPan(project: Project, shotId: string, ms: number, from: Cell, to: Cell): void {
  execTool(project, "animate_opening_camera", { shotId, camera: { x: from.x, y: from.y, zoom: 1, keys: {
    x: [{ atMs: 0, value: from.x }, { atMs: ms, value: to.x, ease: "ease-in-out" }],
    y: [{ atMs: 0, value: from.y }, { atMs: ms, value: to.y, ease: "ease-in-out" }],
  } } });
}

/** 컷 1 — 교문. 쇠사슬, 바람, 꺼진 교사. */
function shotGate(project: Project): void {
  const id = "nr_op_gate", ms = 6400;
  newShot(project, id, ms, { kind: "fade", durationMs: 1400 });
  const view = mapBackground(project, id, M.yard, { x: 26, y: 24 }, 2);
  night(project, id, 0.82);
  glow(project, id, "lamp", cellCenter(view, { x: 42, y: 37 }), 110, "#ffc98a", { hz: 0.3, amount: 0.08 });
  glow(project, id, "exit", cellCenter(view, { x: 11, y: 10 }), 26, "#3ee07a", { flicker: true, hz: 3, amount: 0.25 });
  slowPan(project, id, ms, { x: 270, y: 150 }, { x: 230, y: 125 });
  sfx(project, id, "wind", "easyrpg-sound-wind8", 0, ms, 0.5, 1200);
  captions(project, id, [{ atMs: 1400, text: "11월 7일 밤. 사쿠라자카 중학교." }]);
}

/** 컷 2 — 빈 2층 복도. 저 끝 계단참에 손전등 빛이 선다. 발소리 둘. */
function shotCorridor(project: Project): void {
  const id = "nr_op_corridor", ms = 7200;
  newShot(project, id, ms, { kind: "fade", durationMs: 900 });
  const view = mapBackground(project, id, M.f2, { x: 14, y: 15 }, 2);
  night(project, id, 0.86);
  glow(project, id, "exit-e", cellCenter(view, { x: 23, y: 15 }), 32, "#3ee07a", { flicker: true, hz: 2.4, amount: 0.2 });
  glow(project, id, "torch", cellCenter(view, { x: 22, y: 16 }), 120, "#fff3c4", { startMs: 2600, hz: 0.6, amount: 0.12, inner: 0.15 });
  actor(project, id, "saeki", "oprn-charset-modern3", 6, chipAt(view, { x: 22, y: 16 }), "left", 2, { opacity: 0 });
  patchLayer(project, id, "saeki", { keys: { opacity: [{ atMs: 2600, value: 0 }, { atMs: 3600, value: 0.9 }] } } as Partial<AnimaticLayer>);
  slowPan(project, id, ms, { x: 200, y: 140 }, { x: 290, y: 140 });
  sfx(project, id, "step1", "cc0-se-osx-wooden-01", 3900, 600, 0.35);
  sfx(project, id, "step2", "cc0-se-osx-wooden-01", 4700, 600, 0.4);
  captions(project, id, [{ atMs: 4400, text: "숙직 선생은 문을 하나씩 열어 본다." }]);
}

/** 컷 3 — 교무실 열쇠함. 네 자리 다이얼. */
function shotKeyBox(project: Project): void {
  const id = "nr_op_keybox", ms = 6000;
  newShot(project, id, ms, { kind: "fade", durationMs: 900 });
  const view = mapBackground(project, id, M.f1, { x: 7, y: 4 }, 2);
  night(project, id, 0.84);
  glow(project, id, "moon", cellCenter(view, { x: 9, y: 3 }), 140, "#6f86c8", { hz: 0.2, amount: 0.05 });
  glow(project, id, "key", cellCenter(view, { x: 8, y: 1 }), 60, "#fff3c4", { startMs: 1200, hz: 0.5, amount: 0.15 });
  slowPan(project, id, ms, { x: 250, y: 150 }, { x: 240, y: 120 });
  sfx(project, id, "clock", "easyrpg-sound-clock", 300, 5200, 0.4, 800);
  captions(project, id, [{ atMs: 1500, text: "그리고 수첩에 같은 말을 적는다." }, { atMs: 3800, text: "「이상 없음.」" }]);
}

/** 컷 4 — 3층 복도 끝. 세일러복 학생이 서 있다. 이 학교 교복은 이제 블레이저다. */
function shotSailor(project: Project): void {
  const id = "nr_op_sailor", ms = 6400;
  newShot(project, id, ms, { kind: "cut", durationMs: 1 });
  const view = mapBackground(project, id, M.f3, { x: 7, y: 13 }, 2);
  night(project, id, 0.88);
  glow(project, id, "cold", cellCenter(view, { x: 3, y: 13 }), 70, "#9fb8ff", { hz: 0.4, amount: 0.2 });
  actor(project, id, "sayo", "oprn-charset-modern1", 5, chipAt(view, { x: 3, y: 13 }), "right", 2, { blend: "lighter", opacity: 0 });
  patchLayer(project, id, "sayo", { keys: { opacity: [{ atMs: 800, value: 0 }, { atMs: 2600, value: 0.75 }, { atMs: 5200, value: 0.75 }, { atMs: 5800, value: 0 }] } } as Partial<AnimaticLayer>);
  execTool(project, "animate_opening_camera", { shotId: id, camera: { x: 240, y: 135, zoom: 1, keys: { zoom: [{ atMs: 0, value: 1 }, { atMs: ms, value: 1.12, ease: "ease-in" }] } } });
  sfx(project, id, "dark", "easyrpg-sound-darkness4", 2400, 3200, 0.55, 1000);
  captions(project, id, [{ atMs: 2800, text: "이 학교 교복은, 이제 블레이저다." }]);
}

/** 컷 5 — 2-B 교실. 책상에 엎드린 린. 방송 차임에서 끊긴다(게임은 이 자리에서 시작한다). */
function shotClassroom(project: Project): void {
  const id = "nr_op_classroom", ms = 5600;
  newShot(project, id, ms, { kind: "fade", durationMs: 1000 });
  const view = mapBackground(project, id, M.f2, { x: 17, y: 6 }, 2);
  night(project, id, 0.8);
  glow(project, id, "moon-b1", cellCenter(view, { x: 14, y: 3 }), 120, "#6f86c8", { hz: 0.2, amount: 0.05 });
  glow(project, id, "moon-b2", cellCenter(view, { x: 20, y: 3 }), 120, "#6f86c8", { hz: 0.2, amount: 0.05 });
  actor(project, id, "rin", "oprn-charset-modern2", 0, chipAt(view, { x: 17, y: 7 }), "up", 2);
  execTool(project, "animate_opening_camera", { shotId: id, camera: { x: 240, y: 135, zoom: 1, keys: { zoom: [{ atMs: 0, value: 1 }, { atMs: ms, value: 1.18, ease: "ease-in-out" }] } } });
  sfx(project, id, "chime", "easyrpg-sound-chime2", 3600, 2000, 0.6);
  captions(project, id, [{ atMs: 900, text: "하야세 린은 일직 일지를 쓰다, 잠들었다." }]);
}

export function buildNothingToReportOpening(project: Project): void {
  project.system.opening = { enabled: true, skippable: true, scenes: [] };
  shotGate(project);
  shotCorridor(project);
  shotKeyBox(project);
  shotSailor(project);
  shotClassroom(project);
  execTool(project, "set_title_screen", {
    title: "이상 없음", logoSubtitle: "11월 7일. 옥상 이상 없음.",
    backgroundResourceId: "opening-still:nr_op_corridor@5200", backgroundFit: "cover", backgroundRendering: "pixelated",
    menuStyle: "plain", menuFontPx: 12, musicResourceId: "cc0-bgm-rtp-mys-002",
    runners: [],
    layout: { titleX: 24, titleY: 40, menuX: 28, menuY: 176 },
    sequence: { fadeMs: 1800, push: 0.03, logoAtMs: 1400, logoReveal: "fade", menuAtMs: 2600 },
    transition: { kind: "fade", durationMs: 900 },
    effects: [
      { kind: "glow", source: [0.86, 0.6], spread: 0.16, color: "#fff3c4", intensity: 0.5, speed: 0.3 },
      { kind: "glow", source: [0.96, 0.54], spread: 0.05, color: "#3ee07a", intensity: 0.6, speed: 0.8 },
    ],
  });
}
