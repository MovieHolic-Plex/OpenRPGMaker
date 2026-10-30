/**
 * 『이세계로 떠난 한국 고딩, 대본을 찢다』 — 타이틀 · 오프닝 애니메틱.
 *
 * 마왕 편의점 처음 하는 사람 검수의 교훈: 오프닝이 길고(조작까지 3분 24초) 애니메틱을 대사로 다시 틀었다.
 * 그래서 애니메틱은 교실 세 컷 약 15초뿐이고, 소환의 방은 대사로 이어 받기만 한다(같은 장면을 두 번 보이지 않는다).
 *   컷 1 밤 9시 52분, 야자 교실. 민재 혼자 남아 모의고사 문제지를 넘긴다 — 「옳지 않은 것은」을 끝까지 안 읽고 골랐다.
 *   컷 2 책상 아래 바닥에 금빛 원이 번진다. 민재는 원의 작은 글씨부터 읽는다.
 *   컷 3 빛이 교실을 삼킨다 → 흰 화면. 마지막으로 읽은 글자는 「일곱 번째」.
 * (v8c: 「배터리 3%」「떡볶이 먹고 싶다」는 두 검수자가 웹소설 1화 클리셰로 읽었다 — 민재의 버릇 하나로 바꿨다.)
 * 조수가 쓰는 애니메틱 도구(create_opening_animatic_shot · place_opening_background(mapId) · place_opening_charset_actor ·
 * upsert_opening_light_fx · upsert_opening_emote · animate_opening_camera · set_opening_caption · upsert_opening_audio_cue ·
 * set_opening_transition · configure_opening_music)만으로 짓는다. 배경은 게임 맵(교실) 그대로다 — 새 그림 없음.
 * 타이틀 배경은 오프닝 컷의 한 장면(opening-still:<컷>@<ms>)이다.
 */
import { openingMapViewCrop } from "@/project/openingMapView";
import type { AnimaticLayer } from "@/project/openingAnimatic";
import type { Project } from "@/project/types";
import { type Cell, execTool } from "./isekaiGoddingKit";

const STAGE = { width: 480, height: 270 } as const;
const LB = 0.12;
const TILE = 16;
const INK = { narr: "#fff3dc", minjae: "#bfe3ff" } as const;
const MODERN1 = "oprn-charset-modern1";
const BGM_TITLE = "cc0-bgm-rtp-com-001"; // 장난꾼의 수레
const SE = {
  tick: "cc0-se-osx-switch-01",
  buzz: "easyrpg-sound-buzzer1",
  hum: "easyrpg-sound-darkness3",
  summon: "easyrpg-sound-flash1",
  boom: "easyrpg-sound-explosion1",
} as const;

type Crop = { x: number; y: number; width: number; height: number };
type View = { crop: Crop; sc: number };

function layerOf(project: Project, shotId: string, layerId: string): AnimaticLayer {
  const scene = project.system.opening?.scenes.find((s) => s.id === shotId);
  const layer = scene && scene.kind === "animatic" ? scene.composition.layers.find((l) => l.id === layerId) : undefined;
  if (!layer) throw new Error(`[isekai-godding] 오프닝 ${shotId} 에 레이어 ${layerId} 가 없다`);
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
function actor(project: Project, shotId: string, layerId: string, res: string, index: number, at: Cell, dir: "down" | "up" | "left" | "right", scale: number): void {
  execTool(project, "place_opening_charset_actor", { shotId, layerId, charsetResourceId: res, characterIndex: index, direction: dir, scale, x: at.x, y: at.y, stride: 8 * scale, characterRole: "hero" });
  patchLayer(project, shotId, layerId, { x: at.x, y: at.y });
}
function glowAt(project: Project, shotId: string, layerId: string, center: Cell, size: number, color: string, opts: { hz?: number; amount?: number; startMs?: number; inner?: number } = {}): void {
  execTool(project, "upsert_opening_light_fx", {
    shotId, layerId, kind: "glow", x: center.x - size / 2, y: center.y - size / 2, width: size, height: size, color, inner: opts.inner ?? 0.25,
    pulse: { hz: opts.hz ?? 1.4, amount: opts.amount ?? 0.3, pattern: "pulse", seed: size },
    ...(opts.startMs !== undefined ? { startMs: opts.startMs } : {}),
  });
}
function screenTint(project: Project, shotId: string, layerId: string, color: string, opacity: number, blend: "multiply" | "screen" | "source-over", keys?: { atMs: number; value: number; ease?: string }[]): void {
  execTool(project, "upsert_opening_layer", { shotId, layer: {
    id: layerId, kind: "shape", shape: "rect", role: "effect", space: "screen", color, blend, x: 0, y: 0, width: STAGE.width, height: STAGE.height, opacity,
    ...(keys ? { keys: { opacity: keys } } : {}),
  } });
}
function sfx(project: Project, shotId: string, id: string, resourceId: string, atMs: number, durationMs: number, volume = 0.8): void {
  execTool(project, "upsert_opening_audio_cue", { shotId, cue: { id, resourceId, atMs, durationMs, volume } });
}
function captions(project: Project, shotId: string, cues: { atMs: number; text: string; color: string }[]): void {
  execTool(project, "set_opening_caption", { shotId, layerId: "caption", letterbox: LB, color: INK.narr, fontSize: 12, fadeOutMs: 300,
    cues: cues.map((c) => ({ ...c, typewriterMs: Math.min(650, 28 * c.text.length) })) });
}
function pop(project: Project, shotId: string, layerId: string, preset: "exclaim" | "question" | "ellipsis" | "heart" | "sweat", at: Cell, startMs: number, endMs: number): void {
  execTool(project, "upsert_opening_emote", { shotId, layerId, preset, x: at.x, y: at.y, width: 24, height: 28, startMs, endMs, popMs: 140, outMs: 160 });
}

/** 교실의 민재 자리 — 가운데 분단 맨 뒷줄 왼쪽 책상 뒤(빈 칸). 빌더가 같은 칸에 민재를 세운다. */
export const DESK: Cell = { x: 6, y: 7 };

export const OPENING_SHOTS = { night: "ig_op_night", glow: "ig_op_glow", flash: "ig_op_flash" } as const;

/** 컷 1 — 밤 9시 52분. 텅 빈 교실, 형광등 아래 민재 혼자. 카메라는 천천히 민재 쪽으로. */
function shotNight(project: Project, classMap: string): void {
  const id = OPENING_SHOTS.night, ms = 5200;
  newShot(project, id, ms, { kind: "fade", durationMs: 700 });
  const view = mapBackground(project, id, classMap, { x: DESK.x + 1, y: DESK.y - 2 }, 2);
  screenTint(project, id, "night", "#3a4a8a", 0.38, "multiply");
  glowAt(project, id, "fluoro", cellCenter(view, { x: DESK.x, y: DESK.y - 3 }), 300, "#fff6d8", { hz: 0.4, amount: 0.08, inner: 0.35 });
  execTool(project, "animate_opening_camera", { shotId: id, camera: { x: 240, y: 135, zoom: 1, keys: {
    zoom: [{ atMs: 0, value: 1 }, { atMs: ms, value: 1.18, ease: "ease-in-out" }],
  } } });
  const me = chipAt(view, DESK);
  actor(project, id, "minjae", MODERN1, 0, me, "up", 2);
  pop(project, id, "dots", "ellipsis", { x: me.x + 12, y: me.y - 18 }, 1800, 4200);
  sfx(project, id, "tick", SE.tick, 300, 400, 0.4);
  captions(project, id, [
    { atMs: 500, text: "밤 9시 52분. 야간 자율 학습.", color: INK.narr },
    { atMs: 2400, text: "민재 「17번, 「옳지 않은 것은」. 또 끝까지 안 읽고 골랐네.」", color: INK.minjae },
  ]);
}

/** 컷 2 — 책상 밑에서 금빛 원이 번지고 웅웅 소리가 오른다. 민재는 원의 글씨부터 읽는다. */
function shotGlow(project: Project, classMap: string): void {
  const id = OPENING_SHOTS.glow, ms = 5200;
  newShot(project, id, ms, { kind: "cut", durationMs: 1 });
  const view = mapBackground(project, id, classMap, { x: DESK.x + 1, y: DESK.y - 1 }, 2.5);
  screenTint(project, id, "night", "#3a4a8a", 0.34, "multiply");
  const center = cellCenter(view, { x: DESK.x, y: DESK.y });
  glowAt(project, id, "circle", { x: center.x, y: center.y + 10 }, 220, "#ffd34a", { hz: 2.2, amount: 0.45, inner: 0.1, startMs: 1500 });
  execTool(project, "upsert_opening_layer", { shotId: id, layer: {
    id: "motes", kind: "particles", role: "effect", color: "#ffe9a0", blend: "lighter", opacity: 0.9, x: center.x - 140, y: center.y - 120, width: 280, height: 220,
    particles: { preset: "sparks", count: 40, seed: 5, speed: 12, size: 1 }, startMs: 1600,
  } });
  execTool(project, "animate_opening_camera", { shotId: id, camera: { x: 240, y: 135, keys: {
    zoom: [{ atMs: 0, value: 1 }, { atMs: ms, value: 1.12 }],
  }, shake: { atMs: 3000, durationMs: 2100, amplitude: 2, frequency: 16, seed: 2 } } });
  const me = chipAt(view, DESK);
  actor(project, id, "minjae", MODERN1, 0, me, "down", 3);
  pop(project, id, "huh", "exclaim", { x: me.x + 18, y: me.y - 20 }, 2400, ms);
  sfx(project, id, "hum", SE.hum, 1500, 3600, 0.7);
  captions(project, id, [
    { atMs: 300, text: "바닥에 원이 번진다. 테두리에 작은 글씨.", color: INK.narr },
    { atMs: 2700, text: "민재 「…이것도 끝까지 읽어야 되나.」", color: INK.minjae },
  ]);
}

/** 컷 3 — 빛이 교실을 삼킨다. 하얗게 닫히면 바로 소환의 방(맵)으로. */
function shotFlash(project: Project, classMap: string): void {
  const id = OPENING_SHOTS.flash, ms = 3600;
  newShot(project, id, ms, { kind: "flash", durationMs: 200, color: "#fff4c0" });
  const view = mapBackground(project, id, classMap, { x: DESK.x, y: DESK.y }, 3);
  const center = cellCenter(view, { x: DESK.x, y: DESK.y });
  glowAt(project, id, "circle", center, 420, "#ffe070", { hz: 4, amount: 0.5, inner: 0.05 });
  const me = chipAt(view, DESK);
  actor(project, id, "minjae", MODERN1, 0, me, "down", 3);
  pop(project, id, "sweat", "sweat", { x: me.x + 18, y: me.y - 20 }, 200, 1800);
  screenTint(project, id, "white", "#ffffff", 1, "source-over", [{ atMs: 0, value: 0 }, { atMs: 1600, value: 0.25 }, { atMs: 3200, value: 1, ease: "ease-in" }]);
  sfx(project, id, "summon", SE.summon, 900, 1500, 0.9);
  sfx(project, id, "boom", SE.boom, 2900, 700, 0.6);
  captions(project, id, [{ atMs: 200, text: "민재 「「…일곱 번째」?」", color: INK.minjae }]);
}

export function buildIsekaiOpening(project: Project, classMap: string): void {
  project.system.opening = { enabled: true, skippable: true, scenes: [] };
  shotNight(project, classMap);
  shotGlow(project, classMap);
  shotFlash(project, classMap);
  execTool(project, "configure_opening_music", { musicResourceId: "cc0-bgm-rtp-hlc-005" });
}

/** 타이틀 — 오프닝 컷 2(빛나는 교실) 한 장면을 배경으로. 글자는 위, 메뉴는 왼쪽 아래. */
export function setupIsekaiTitle(project: Project): void {
  execTool(project, "set_title_screen", {
    title: "이세계로 떠난 한국 고딩, 대본을 찢다", logoSubtitle: "앞의 여섯 분은 대본을 지키셨습니다", backgroundResourceId: `opening-still:${OPENING_SHOTS.glow}@4200`,
    backgroundFit: "cover", backgroundRendering: "pixelated",
    logoStyle: "gold", logoShine: "once", menuStyle: "plain", menuFontPx: 13, musicResourceId: BGM_TITLE,
    runners: [],
    layout: { titleX: 16, titleY: 26, menuX: 22, menuY: 176 },
    sequence: { fadeMs: 1000, push: 0.05, logoAtMs: 700, logoReveal: "bloom", menuAtMs: 1600 },
    transition: { kind: "flash", durationMs: 600 },
    effects: [
      { kind: "glow", source: [0.5, 0.62], spread: 0.22, color: "#ffd34a", intensity: 0.8, speed: 0.8 },
      { kind: "motes", region: [[0.25, 0.4], [0.75, 0.4], [0.75, 0.95], [0.25, 0.95]], count: 26, color: "#ffe9a0", speed: 0.6 },
    ],
  });
}
