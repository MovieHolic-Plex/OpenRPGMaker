/**
 * 『전생한 마왕, 편의점 알바 시작하다』 — 타이틀 · 오프닝 애니메틱 · 옥좌 결전 · 원룸에서 눈뜨기.
 *
 * 2026-10-29 사용자 「오프닝이 허접하다」·「오프닝 전투도 어색하고, 대사도 흠…」 뒤에 다시 짰다. 흐름:
 *   타이틀(옥좌의 마왕 | 노을 편의점 앞의 지금의 마오) → 새 게임
 *   → 애니메틱 4컷 약 32초: 마왕성의 위엄 → 용사 일행이 성문을 박차고 들어온다 → 「세계의 절반」 흥정이 깎인다
 *     (절반 → 4분의 1 → 8분의 1, 연금·휴가 포함) → 「말로 안 되면 힘으로」
 *   → 옥좌의 방에서 바로 연출 전투(3합, 1분 안, 져도 같은 결말): 싸우는 중에도 흥정이 끼어들고 레온이 금단의 봉인술을 쓴다
 *   → 『동귀어진』 빛이 모든 것을 삼키고 장엄한 음악이 뚝 끊긴다 → 정적
 *   → 원룸 형광등 「치익」 → 관리국 안내문 → 잔고 0엔(슬픈 나팔) → 우편함으로 들어온 전단지 → 조작.
 * 옥좌 결전은 이 한 번뿐이다(옛판은 애니메틱 뒤에 같은 옥좌 장면을 맵 이벤트로 다시 열어 첫 조작까지 3분 30초 걸렸다).
 *
 * 오프닝은 조수가 쓰는 애니메틱 도구(create_opening_animatic_shot · place_opening_background · place_opening_charset_actor ·
 * upsert_opening_layer · upsert_opening_light_fx · upsert_opening_emote · animate_opening_camera · set_opening_caption ·
 * upsert_opening_audio_cue · set_opening_transition · configure_opening_music)만으로 짓는다. 전투는 upsert_actor · upsert_troop_battle_page.
 * 새 도트는 없다 — 게임 맵(map-view) · 번들 걷기 칩 · 파티원 도트 시트(party-pixel-monster2-7) · 공용 흉상만 쓴다.
 */
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { openingMapViewCrop } from "@/project/openingMapView";
import type { AnimaticLayer } from "@/project/openingAnimatic";
import type { Command, GameMap, Project } from "@/project/types";
import {
  CAST, caption, type Cell, emote, event, execTool, fadeIn, fadeOut, flash, gone, letter, m2, mustBlock, mustWalk, nearestFree, page,
  playSe, say, setSw, setVar, shake, stopBgm, thinkAs, transfer, varAtLeast, varIs, wait, walk, walkTo, face, bgm,
} from "./maouKonbiniKit";

// maouKonbini.ts 와 같은 id(순환 import 를 피하려고 문자열을 다시 적는다).
const V_STAGE = "var_mk_stage";
const MAOU_TRUE = "actor_mk_maou_true";
const MAP_THRONE = "map_mk_throne";
const MAP_ROOM = "map_mk_room";
const BGM_TITLE = "cc0-bgm-rtp-com-001";
const BGM_THRONE = "cc0-bgm-rtp-thr-001";
const BGM_ROOM = "cc0-bgm-rtp-rad-001";
const SE_PAPER = "cc0-se-osx-paper-04";
const SE_DARK = "easyrpg-sound-darkness3";

/** 자체 합성 효과음(scripts/content/maou-konbini/opening-sfx.py). */
const SFX = {
  dread: "cc0-sound-mk-op-dread",
  doors: "cc0-sound-mk-op-doors",
  scratch: "cc0-sound-mk-op-scratch",
  vanish: "cc0-sound-mk-op-vanish",
  fluoro: "cc0-sound-mk-op-fluoro",
  room: "cc0-sound-mk-op-room",
  sadHorn: "cc0-sound-mk-op-sad-horn",
  mailslot: "cc0-sound-mk-op-mailslot",
  gong: "cc0-se-osx-gong-02",
  sword: "cc0-se-orp-battle-sword-unsheathe2",
} as const;

// ── 오프닝 애니메틱 ─────────────────────────────────────────────────────

const STAGE = { width: 480, height: 270 } as const;
const LB = 0.12;
const TILE = 16;
/** 자막 색: 해설 · 마왕 · 용사 일행. */
const INK = { narr: "#fff0dc", maou: "#e4b8ff", hero: "#ffe39a" } as const;
const MON2 = "easyrpg-charset-monster2";
const ACT1 = "easyrpg-charset-actor1";

type Crop = { x: number; y: number; width: number; height: number };
type Dir = "down" | "up" | "left" | "right";

function layerOf(project: Project, shotId: string, layerId: string): AnimaticLayer {
  const scene = project.system.opening?.scenes.find((s) => s.id === shotId);
  const layer = scene && scene.kind === "animatic" ? scene.composition.layers.find((l) => l.id === layerId) : undefined;
  if (!layer) throw new Error(`[maou-konbini] 오프닝 ${shotId} 에 레이어 ${layerId} 가 없다`);
  return layer;
}
/** 도구로 만든 레이어를 읽어 일부만 바꿔 같은 id 로 다시 올린다(upsert_opening_layer). */
function patchLayer(project: Project, shotId: string, layerId: string, patch: Partial<AnimaticLayer>): void {
  execTool(project, "upsert_opening_layer", { shotId, layer: { ...JSON.parse(JSON.stringify(layerOf(project, shotId, layerId))), ...patch } });
}

function newShot(project: Project, shotId: string, ms: number, transition: Record<string, unknown>): void {
  execTool(project, "create_opening_animatic_shot", { shotId, durationMs: ms, width: STAGE.width, height: STAGE.height, background: "#000000", replace: true, clearLayers: true });
  execTool(project, "set_opening_pixel_grid", { shotId, width: STAGE.width, height: STAGE.height });
  execTool(project, "set_opening_transition", { shotId, transition, letterbox: LB });
}

/** 게임 맵 그대로를 배경으로 깐다. 돌려주는 crop·배율로 칸 → 무대 좌표를 잰다. */
function mapBackground(project: Project, shotId: string, mapId: string, focus: Cell, zoom: number): { crop: Crop; sc: number } {
  execTool(project, "place_opening_background", { shotId, layerId: "bg", mapId, focus, zoom });
  const crop = openingMapViewCrop(project.maps[mapId]!, STAGE, focus, zoom);
  return { crop, sc: STAGE.width / crop.width };
}

/** 칸(c)에 선 24×32 칩의 무대 왼쪽 위(발이 칸 아랫변). */
function chipAt(view: { crop: Crop; sc: number }, c: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.round(((c.x + 0.5) * TILE - 12 - view.crop.x) * view.sc), y: Math.round(((c.y + 1) * TILE - 32 - view.crop.y) * view.sc) };
}
/** 칸(c) 가운데의 무대 좌표. */
function cellCenter(view: { crop: Crop; sc: number }, c: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.round(((c.x + 0.5) * TILE - view.crop.x) * view.sc), y: Math.round(((c.y + 0.5) * TILE - view.crop.y) * view.sc) };
}

function actor(project: Project, shotId: string, layerId: string, res: string, index: number, at: { x: number; y: number }, dir: Dir, scale: number, role: "hero" | "monster" | "knight" | "mage" = "hero"): void {
  execTool(project, "place_opening_charset_actor", { shotId, layerId, charsetResourceId: res, characterIndex: index, direction: dir, scale, x: at.x, y: at.y, stride: 8 * scale, characterRole: role });
  // 도구는 배우를 레터박스 안쪽으로 당긴다 — 맵 칸에 맞춘 자리로 되돌린다(같은 도구 upsert).
  patchLayer(project, shotId, layerId, { x: at.x, y: at.y });
}

function glowAt(project: Project, shotId: string, layerId: string, center: { x: number; y: number }, size: number, color: string, opts: { hz?: number; amount?: number; flicker?: boolean; inner?: number; startMs?: number; endMs?: number } = {}): void {
  execTool(project, "upsert_opening_light_fx", {
    shotId, layerId, kind: "glow", x: center.x - size / 2, y: center.y - size / 2, width: size, height: size, color, inner: opts.inner ?? 0.25,
    pulse: { hz: opts.hz ?? 1.6, amount: opts.amount ?? 0.3, pattern: opts.flicker === false ? "pulse" : "flicker", seed: layerId.length * 7 + size },
    ...(opts.startMs !== undefined ? { startMs: opts.startMs } : {}), ...(opts.endMs !== undefined ? { endMs: opts.endMs } : {}),
  });
}

function screenTint(project: Project, shotId: string, layerId: string, color: string, opacity: number, blend: "multiply" | "screen" | "source-over" = "multiply", keys?: { atMs: number; value: number; ease?: string }[]): void {
  execTool(project, "upsert_opening_layer", { shotId, layer: {
    id: layerId, kind: "shape", shape: "rect", role: "effect", space: "screen", color, blend, x: 0, y: 0, width: STAGE.width, height: STAGE.height, opacity,
    ...(keys ? { keys: { opacity: keys } } : {}),
  } });
}

function sfx(project: Project, shotId: string, id: string, resourceId: string, atMs: number, durationMs: number, volume = 0.8, fadeOutMs?: number): void {
  execTool(project, "upsert_opening_audio_cue", { shotId, cue: { id, resourceId, atMs, durationMs, volume, ...(fadeOutMs ? { fadeOutMs } : {}) } });
}

function captions(project: Project, shotId: string, cues: { atMs: number; text: string; color: string }[]): void {
  execTool(project, "set_opening_caption", { shotId, layerId: "caption", letterbox: LB, color: INK.narr, fontSize: 12, fadeOutMs: 350,
    cues: cues.map((c) => ({ ...c, typewriterMs: Math.min(700, 30 * c.text.length) })) });
}

function pop(project: Project, shotId: string, layerId: string, preset: "exclaim" | "question" | "ellipsis" | "heart" | "sweat", at: { x: number; y: number }, startMs: number, endMs: number): void {
  execTool(project, "upsert_opening_emote", { shotId, layerId, preset, x: at.x, y: at.y, width: 24, height: 28, startMs, endMs, popMs: 140, outMs: 160 });
}

/** 옥좌의 방 공통 빛: 옥좌 보랏빛 · 화로 둘 · 기둥 횃불 둘 · 불티. */
function throneLights(project: Project, shotId: string, view: { crop: Crop; sc: number }): void {
  glowAt(project, shotId, "throne-glow", cellCenter(view, { x: 23, y: 4 }), 150 * view.sc / 2, "#b03cff", { hz: 0.7, amount: 0.3, flicker: false, inner: 0.2 });
  glowAt(project, shotId, "brazier-l", cellCenter(view, { x: 20, y: 4 }), 70 * view.sc / 2, "#ff8a3a", { hz: 1.9 });
  glowAt(project, shotId, "brazier-r", cellCenter(view, { x: 26, y: 4 }), 70 * view.sc / 2, "#ff8a3a", { hz: 2.2 });
  execTool(project, "upsert_opening_layer", { shotId, layer: {
    id: "embers", kind: "particles", role: "effect", color: "#ffb070", blend: "lighter", opacity: 0.7, parallax: 1.15,
    x: 0, y: 0, width: STAGE.width, height: STAGE.height, particles: { preset: "sparks", count: 28, seed: 7 + shotId.length, speed: 9, size: 1 },
  } });
}

/** 컷 1 — 마왕성 옥좌의 방. 어둠에서 옥좌로 천천히 밀고 들어간다. 첫 박에 마계 굉음. */
function shotThrone(project: Project): void {
  const id = "mk_op_throne", ms = 5200;
  newShot(project, id, ms, { kind: "fade", durationMs: 900 });
  const view = mapBackground(project, id, MAP_THRONE, { x: 23, y: 6 }, 2);
  screenTint(project, id, "tint", "#4a1460", 0.42);
  throneLights(project, id, view);
  const maou = cellCenter(view, { x: 23, y: 5 });
  execTool(project, "animate_opening_camera", { shotId: id, camera: { x: 240, y: 150, zoom: 1, keys: {
    y: [{ atMs: 0, value: 165 }, { atMs: ms, value: maou.y + 8, ease: "ease-in-out" }],
    zoom: [{ atMs: 0, value: 1 }, { atMs: ms, value: 1.25, ease: "ease-in-out" }],
  } } });
  actor(project, id, "maou", MON2, 7, chipAt(view, { x: 23, y: 5 }), "down", 2, "monster");
  sfx(project, id, "dread", SFX.dread, 150, 5000, 0.9, 900);
  captions(project, id, [{ atMs: 900, text: "마계력 999년. 세계의 절반을 손에 넣은 마왕 제르바스.", color: INK.narr }]);
}

/** 컷 2 — 성문이 열리고 용사 일행이 붉은 융단을 걸어 올라온다. 카메라가 그들을 따라 옥좌 쪽으로 기울어 올라간다. */
function shotHeroes(project: Project): void {
  const id = "mk_op_heroes", ms = 4800;
  newShot(project, id, ms, { kind: "cut", durationMs: 1 });
  // 옥좌(4줄)부터 홀 아래(21줄)까지 세로로 긴 배경 — 카메라가 아래에서 위로 기운다.
  mapBackground(project, id, MAP_THRONE, { x: 23, y: 12 }, 2);
  const crop: Crop = { x: 23 * TILE + 8 - 120, y: 3 * TILE, width: 240, height: 270 };
  patchLayer(project, id, "bg", { crop, width: 480, height: 540 });
  const view = { crop, sc: 2 };
  screenTint(project, id, "tint", "#4a1460", 0.38);
  throneLights(project, id, view);
  glowAt(project, id, "torch-l", cellCenter(view, { x: 18, y: 14 }), 60, "#ff8a3a", { hz: 1.7 });
  glowAt(project, id, "torch-r", cellCenter(view, { x: 28, y: 14 }), 60, "#ff8a3a", { hz: 2.1 });
  // 아래(성문 쪽)에서 위로. 세계 좌표 — 무대 높이 540 의 아래 절반 가운데에서 시작한다.
  // 카메라를 배우보다 먼저 건다: 배우가 세로로 긴 배경의 아래쪽(무대 밖 세계 y)에 서기 때문이다.
  execTool(project, "animate_opening_camera", { shotId: id, camera: { x: 240, y: 405, keys: {
    y: [{ atMs: 0, value: 405 }, { atMs: 600, value: 395 }, { atMs: 3700, value: 215, ease: "ease-in-out" }, { atMs: ms, value: 205 }],
  }, shake: { atMs: 60, durationMs: 500, amplitude: 4, frequency: 16, seed: 3 } } });
  actor(project, id, "maou", MON2, 7, chipAt(view, { x: 23, y: 5 }), "down", 2, "monster");
  const walkUp = (layerId: string, index: number, col: number, from: number, to: number, startMs: number) => {
    const a = chipAt(view, { x: col, y: from }), b = chipAt(view, { x: col, y: to });
    actor(project, id, layerId, ACT1, index, a, "up", 2, layerId === "leon" ? "hero" : layerId === "garet" ? "knight" : "mage");
    patchLayer(project, id, layerId, { keys: { y: [{ atMs: startMs, value: a.y }, { atMs: startMs + 3200, value: b.y }] } });
  };
  walkUp("leon", 0, 23, 17, 10, 250);
  walkUp("garet", 2, 22, 18, 11, 350);
  walkUp("mira", 5, 24, 18, 11, 450);
  const leonEnd = chipAt(view, { x: 23, y: 10 });
  pop(project, id, "leon-shout", "exclaim", { x: leonEnd.x + 12, y: leonEnd.y - 26 }, 3700, ms);
  sfx(project, id, "doors", SFX.doors, 0, 2600, 0.95);
  sfx(project, id, "unsheathe", SFX.sword, 3550, 900, 0.5);
  captions(project, id, [{ atMs: 3950, text: "레온 「여기까지다, 마왕 제르바스!」", color: INK.hero }]);
}

/** 컷 3 — 흥정. 마왕이 말할 때는 옥좌로, 일행이 말할 때는 일행 쪽으로 박에 맞춰 짧게 민다. 자막은 반응(말풍선)보다 반 박자 뒤. */
function shotDeal(project: Project): void {
  const id = "mk_op_deal", ms = 15600;
  newShot(project, id, ms, { kind: "cut", durationMs: 1 });
  const view = mapBackground(project, id, MAP_THRONE, { x: 23, y: 7 }, 2);
  screenTint(project, id, "tint", "#4a1460", 0.34);
  throneLights(project, id, view);
  const maouAt = chipAt(view, { x: 23, y: 5 }), leonAt = chipAt(view, { x: 23, y: 9 }), garetAt = chipAt(view, { x: 22, y: 10 }), miraAt = chipAt(view, { x: 24, y: 10 });
  const above = (a: { x: number; y: number }) => ({ x: a.x + 12, y: a.y - 16 });
  // 반응(말풍선) → 반 박자(250ms) 뒤 자막.
  const beats: { at: number; who: "maou" | "leon" | "garet" | "mira"; pop?: "exclaim" | "question" | "ellipsis" | "heart" | "sweat"; text: string }[] = [
    { at: 400, who: "maou", text: "제르바스 「잘 왔다, 용사여. 내 편에 서라. 세계의 절반을 주마.」" },
    { at: 3500, who: "leon", pop: "exclaim", text: "레온 「거절한다!」" },
    { at: 4700, who: "maou", pop: "sweat", text: "제르바스 「…그럼 4분의 1.」" },
    { at: 6300, who: "leon", pop: "exclaim", text: "레온 「거절한다!!」" },
    { at: 7500, who: "maou", text: "제르바스 「8분의 1. 연금이랑 휴가도 얹어 주마.」" },
    { at: 10200, who: "mira", pop: "heart", text: "미라 「레온… 저거 조건 나쁘지 않은데?」" },
    { at: 12200, who: "garet", pop: "question", text: "가렛 「휴가는 며칠이지?」" },
    { at: 13700, who: "leon", pop: "sweat", text: "레온 「둘 다 흔들리지 마! 마왕, 너도 흥정하지 마!」" },
  ];
  // 카메라: 박마다 말하는 쪽으로 짧게 밀었다 돌아온다(세계 좌표). 마왕은 위, 일행은 아래.
  // 마왕 쪽은 머리 위 말풍선이 레터박스에 잘리지 않게 마왕보다 조금 위를 가운데로 잡는다.
  const mY = cellCenter(view, { x: 23, y: 5 }).y - 14, hY = cellCenter(view, { x: 23, y: 9 }).y;
  const camY: { atMs: number; value: number; ease?: string }[] = [{ atMs: 0, value: 135 }];
  const camZ: { atMs: number; value: number; ease?: string }[] = [{ atMs: 0, value: 1 }];
  for (const b of beats) {
    const y = b.who === "maou" ? mY : hY, z = b.who === "maou" ? 1.3 : 1.22;
    camY.push({ atMs: b.at, value: camY[camY.length - 1]!.value }, { atMs: b.at + 260, value: y, ease: "ease-out" });
    camZ.push({ atMs: b.at, value: camZ[camZ.length - 1]!.value }, { atMs: b.at + 260, value: z, ease: "ease-out" });
  }
  camY.push({ atMs: ms, value: hY - 20 }); camZ.push({ atMs: ms, value: 1.12, ease: "ease-in-out" });
  execTool(project, "animate_opening_camera", { shotId: id, camera: { x: 240, y: 135, keys: { y: camY, zoom: camZ } } });
  // 배우는 카메라를 건 다음에 세운다(옥좌 위 마왕은 고정 무대로 치면 레터박스 위쪽이다). 층 순서는 빛 위·말풍선 아래.
  actor(project, id, "maou", MON2, 7, maouAt, "down", 2, "monster");
  actor(project, id, "leon", ACT1, 0, leonAt, "up", 2, "hero");
  actor(project, id, "garet", ACT1, 2, garetAt, "up", 2, "knight");
  actor(project, id, "mira", ACT1, 5, miraAt, "up", 2, "mage");
  const at = { maou: maouAt, leon: leonAt, garet: garetAt, mira: miraAt };
  beats.forEach((b, i) => { if (b.pop) pop(project, id, `pop-${i}`, b.pop, above(at[b.who]), b.at, Math.min(ms, b.at + 1500)); });
  captions(project, id, beats.map((b) => ({ atMs: b.at + (b.pop ? 250 : 0), text: b.text, color: b.who === "maou" ? INK.maou : INK.hero })));
  // 개그 박 — 「4분의 1」에 레코드가 긁히고, 「거절한다!!」에 화면이 한 번 흔들린다.
  sfx(project, id, "scratch", SFX.scratch, 4650, 550, 0.85);
  sfx(project, id, "no-2", "cc0-se-orp-battle-sword-unsheathe", 6300, 700, 0.45);
  sfx(project, id, "heart", "cc0-se-osx-bell-02", 10200, 900, 0.35);
}

/** 컷 4 — 「말로 안 되면 힘으로」. 마왕에게 바짝 다가서고 붉은 빛이 차오르다 하얗게 닫힌다(바로 전투로). */
function shotPower(project: Project): void {
  const id = "mk_op_power", ms = 3800;
  newShot(project, id, ms, { kind: "flash", durationMs: 220, color: "#ffd8ff" });
  const view = mapBackground(project, id, MAP_THRONE, { x: 23, y: 5 }, 3);
  execTool(project, "animate_opening_camera", { shotId: id, camera: { x: 240, y: 135, keys: {
    zoom: [{ atMs: 0, value: 1 }, { atMs: ms, value: 1.18, ease: "ease-in" }],
    // 뿔이 레터박스에 잘리지 않게 마왕 머리 쪽으로 조금 올려 잡는다.
    y: [{ atMs: 0, value: 120 }, { atMs: ms, value: 110 }],
  }, shake: { atMs: 1700, durationMs: 1900, amplitude: 3, frequency: 18, seed: 9 } } });
  screenTint(project, id, "tint", "#5a0a2a", 0.5);
  const center = cellCenter(view, { x: 23, y: 5 });
  glowAt(project, id, "aura", { x: center.x, y: center.y - 20 }, 260, "#c040ff", { hz: 3, amount: 0.4, inner: 0.15 });
  actor(project, id, "maou", MON2, 7, chipAt(view, { x: 23, y: 5 }), "down", 3, "monster");
  execTool(project, "upsert_opening_layer", { shotId: id, layer: {
    id: "dark-sparks", kind: "particles", role: "effect", color: "#d070ff", blend: "lighter", opacity: 0.85,
    x: center.x - 200, y: center.y - 160, width: 400, height: 260, particles: { preset: "sparks", count: 70, seed: 41, speed: 16, size: 2 },
  } });
  screenTint(project, id, "red", "#ff2050", 1, "screen", [{ atMs: 0, value: 0 }, { atMs: 1800, value: 0.05 }, { atMs: 3000, value: 0.35, ease: "ease-in" }]);
  screenTint(project, id, "white", "#ffffff", 1, "source-over", [{ atMs: 0, value: 0 }, { atMs: 3200, value: 0 }, { atMs: 3600, value: 1, ease: "ease-in" }]);
  sfx(project, id, "dark", SE_DARK, 1600, 1500, 0.8);
  sfx(project, id, "dread", SFX.dread, 1700, 2100, 0.9);
  captions(project, id, [{ atMs: 250, text: "제르바스 「흥. 말로 안 되면 힘으로 굴복시켜 주마!」", color: INK.maou }]);
}

export function buildMaouOpening(project: Project): void {
  project.system.opening = { enabled: true, skippable: true, scenes: [] };
  shotThrone(project);
  shotHeroes(project);
  shotDeal(project);
  shotPower(project);
  execTool(project, "configure_opening_music", { musicResourceId: BGM_THRONE });
}

/** 화면 효과 「색조」(Screen Effect tint) — 값 "R,G,B,A". 흰빛으로 덮었다가 fadeOut 이 그대로 검게 넘긴다. */
const fieldTint = (value: string, ms: number): Command => m2("Screen Effect", { effect: "tint", value, durationMs: ms });

// ── 옥좌의 방: 연출 전투 → 『동귀어진』 ────────────────────────────────────

/** 옥좌 결전 전투 — 3합. 싸우는 중에도 흥정이 끼어들고, 3합째에 레온이 금단의 봉인술로 전투를 끝낸다(이기든 지든 같은 결말). */
function setupThroneBattle(project: Project): void {
  // 마왕은 「마족 공작」 파티원 도트(Monster2 #7 걷기 칩과 같은 인물)로, 사람 배틀러의 두 배 크기로 선다.
  execTool(project, "upsert_actor", { actor: { id: MAOU_TRUE, battleCharacterResourceId: "party-pixel-monster2-7", battleScalePercent: 200 } });
  const leon = project.database.enemies.find((e) => e.id === "enemy_mk_leon_castle");
  if (!leon) throw new Error("[maou-konbini] 옥좌 결전 적(enemy_mk_leon_castle)이 없다");
  // 직접 코드: 슬라임을 본뜬 적이라 종(speciesId)이 남아 「야생의 용사 레온」이라고 나왔다. upsert_enemy 는 필드를 지우지 못한다.
  delete (leon as { speciesId?: string }).speciesId;
  // 3합 안에 쓰러지지 않게(연출 전투는 3합째 봉인술로 끝난다).
  execTool(project, "upsert_enemy", { enemy: { id: leon.id, stats: { ...leon.stats, maxHp: 4000, attack: 96 } } });
  const T = "troop_mk_castle";
  const pageOf = (pid: string, name: string, round: number, commands: Command[]) =>
    execTool(project, "upsert_troop_battle_page", { troopId: T, page: { id: pid, name, span: "battle", runOnce: true, conditions: [{ kind: "onRound", round }], commands } });
  pageOf("mk_castle_r1", "1합 싸우면서 흥정", 1, [
    ...say("leonF", "base", "간다, 마왕!"),
    ...say("maouF", "base", "기다려라. 16분의 1에 연금, 휴가, 성 앞 주차장까지 얹으마."),
    ...say("leonF", "base", "싸우는 중에 흥정하지 마!"),
  ]);
  pageOf("mk_castle_r2", "2합 미라가 흔들린다", 2, [
    ...say("mira", "base", "레온, 주차장은 좀 탐나는데."),
    ...say("leonF", "base", "미라!!"),
    ...say("maouF", "base", "크하하! 네 동료는 현실을 아는구나!"),
  ]);
  pageOf("mk_castle_r3", "3합 금단의 봉인술", 3, [
    ...say("leonF", "base", "이대로는 끝이 안 나…. 이 목숨을 걸겠다. 금단의 봉인술!"),
    { kind: "m2Command", commandId: "m2-105-abort-battle", fields: {} } as Command,
  ]);
}

/** 옥좌의 방 — 새 게임의 시작 맵. 오프닝이 끝나면 곧바로 결전 전투, 이어서 『동귀어진』으로 원룸에 떨어진다. */
export function buildMaouThrone(project: Project, roomWake: Cell): Cell {
  // 도구(execTool)는 project.maps 를 새 객체로 바꿔 끼운다 — 맵을 잡기 전에 전투 설정 도구부터 부른다.
  setupThroneBattle(project);
  const map = project.maps[MAP_THRONE]!;
  const start = mustWalk(project, map, { x: 23, y: 5 }, "옥좌 앞");
  mustBlock(project, map, { x: 23, y: 4 }, "옥좌");
  const leonAt = mustWalk(project, map, { x: 23, y: 8 }, "용사 자리");
  const garetAt = nearestFree(project, map, { x: 22, y: 9 }, [leonAt]);
  const miraAt = nearestFree(project, map, { x: 24, y: 9 }, [leonAt, garetAt]);
  const L = "ev_mk_t_leon", G = "ev_mk_t_garet", R = "ev_mk_t_mira";
  const scene: Command[] = [
    ...fadeIn(300),
    playSe(SFX.sword),
    { kind: "battleProcessing", troopId: "troop_mk_castle", canEscape: false, canLose: true, branchOnResult: false } as Command,
    // 봉인술 — 레온이 빛나고, 마왕은 마지막까지 연금을 묻는다.
    emote(L, "exclamation", 900), wait(300),
    ...say("leonF", "base", "『동귀어진』! 너도 나도 이 세계에서 사라지는 거다!"),
    emote("player", "sweat", 900),
    ...say("maouF", "base", "자, 잠깐! 연금은? 연금은 어떻게 되는 거냐!"),
    // 하얗게 타 버린다 — 화면 효과 「색조」로 흰빛을 채웠다가(맵 조명은 건드리지 않는다), 장엄한 음악을 그 순간 끊는다.
    playSe(SFX.vanish),
    fieldTint("255,255,255,0.35", 700), shake(1800, "3"),
    wait(900), flash("white", 300), wait(500),
    fieldTint("255,255,255,1", 1000), shake(800, "10"),
    wait(1000),
    stopBgm(),
    wait(700),
    ...caption("빛이 모든 것을 삼켰다."),
    ...fadeOut(900),
    wait(700),
    setVar(V_STAGE, "=", 1),
    // 전생 — 파티가 현대의 몸(마오)으로 바뀐다.
    { kind: "changeParty", actorId: DEFAULT_ACTOR_ID, action: "add" } as Command,
    { kind: "changeParty", actorId: DEFAULT_ACTOR_ID, action: "lead" } as Command,
    { kind: "changeParty", actorId: MAOU_TRUE, action: "remove" } as Command,
    transfer(MAP_ROOM, roomWake, "down"),
  ];
  map.events.push(event("ev_mk_throne_scene", "최후의 결전", { x: 1, y: 1 }, [
    page("ev_mk_throne_scene_p", [varIs(V_STAGE, 0)], scene, { trigger: "auto" }),
    gone("ev_mk_throne_scene_done", [varAtLeast(V_STAGE, 1)]),
  ]));
  map.events.push(event(L, "용사 레온", leonAt, [page(`${L}_p`, [], [...say("leonF", "base", "각오해라, 마왕!")], { who: "leonF", dir: "up" })]));
  map.events.push(event(G, "성기사 가렛", garetAt, [page(`${G}_p`, [], [...say("garet", "base", "…")], { who: "garet", dir: "up" })]));
  map.events.push(event(R, "마법사 미라", miraAt, [page(`${R}_p`, [], [...say("mira", "base", "…")], { who: "mira", dir: "up" })]));
  map.defaultLighting = {
    ambient: 0.5, color: "#2a0618",
    sources: [
      { id: "throne_glow", at: { x: 23, y: 4 }, radius: 4.5, intensity: 1, color: "#b03cff", flicker: true },
      { id: "brazier_l", at: { x: 20, y: 4 }, radius: 2.4, intensity: 0.9, color: "#ff7a2a", flicker: true },
      { id: "brazier_r", at: { x: 26, y: 4 }, radius: 2.4, intensity: 0.9, color: "#ff7a2a", flicker: true },
      { id: "hall_l", at: { x: 18, y: 8 }, radius: 2.2, intensity: 0.7, color: "#ff7a2a", flicker: true },
      { id: "hall_r", at: { x: 28, y: 8 }, radius: 2.2, intensity: 0.7, color: "#ff7a2a", flicker: true },
    ],
  };
  map.bgm = { mode: "custom", resourceId: BGM_THRONE } as GameMap["bgm"];
  return start;
}

// ── 원룸에서 눈뜨기: 정적 → 형광등 → 안내문 → 잔고 0엔 → 전단지 ──────────

/**
 * 원룸 눈뜨기·전단지 장면을 오프닝 박자로 다시 단다(buildRoom 이 만든 이벤트의 명령만 바꾼다 — 칸·조건은 그대로).
 * 장엄한 음악이 끊긴 뒤 생활 소음으로 넘어가는 대비가 핵심이라 방 음악은 전단지를 읽은 다음에야 튼다.
 */
export function stageMaouRoomWake(project: Project): void {
  // 방 음악은 아주 느리게 들어오게 한다(8초). 옥좌에서 넘어오는 순간 눈뜨기 장면이 곧바로 음악을 끄는데, 그 사이 들어온 소리가
  // 들리지 않아야 「정적 → 형광등」이 산다(v3 녹화: 기본 곡이 0.7초 울렸다). 나중에 현관으로 들어올 때도 같은 곡이 천천히 깔린다.
  // 도구가 project.maps 를 바꿔 끼우므로 맵은 그다음에 잡는다.
  execTool(project, "set_map_properties", { mapId: MAP_ROOM, bgm: { mode: "custom", resourceId: BGM_ROOM, fadeInMs: 8000 } });
  const map = project.maps[MAP_ROOM]!;
  const Z = (...l: string[]) => thinkAs(CAST.zervas.name, ...l);
  const zs = (expr: "base" | "happy" | "surprised" | "sad" | "embarrassed", ...l: string[]) => say("zervas", expr, ...l);
  const wakeScene: Command[] = [
    stopBgm(),
    wait(1200),
    playSe(SFX.fluoro),
    wait(250), flash("white", 90), wait(330), flash("white", 70), wait(220),
    ...fadeIn(350),
    playSe(SFX.room),
    ...Z("낯선 천장이다."),
    emote("player", "question", 1100),
    walk("@player", ["right", "right"]),
    face("@player", "up"),
    ...zs("surprised", "뿔이 없다. 망토도 없다. 이 올리브색 겉옷은 또 뭐냐!"),
    walkTo("@player", { x: 11, y: 6 }), face("@player", "right"),
    playSe(SE_PAPER),
    ...letter("「이세계 전생 관리국 안내문」\n귀하는 『동귀어진』 처리에 따라 일본으로 전생했습니다.\n마력은 봉인했습니다. 생활비는 직접 버십시오."),
    ...zs("embarrassed", "…이 몸에게 일을 하라고?"),
    playSe(SE_PAPER),
    ...letter("통장 잔고\n0엔"),
    playSe(SFX.sadHorn), shake(500, "3"), wait(1100),
    ...zs("sad", "세계의 절반을 가졌던 몸이 잔고 0엔이라니."),
    playSe(SFX.mailslot),
    emote("player", "exclamation", 900), face("@player", "down"),
    ...caption("현관 우편함으로 종이 한 장이 미끄러져 들어왔다."),
    setSw("sw_mk_woke"),
  ];
  const flyer: Command[] = [
    playSe(SE_PAPER),
    ...letter("아르바이트 급구! 해피 마트 사쿠라자카점\n시급 1,150엔. 초보 환영. 유니폼 지급.\n폐기 도시락 있음(?) 이 건물 바로 왼쪽입니다!"),
    ...zs("base", "…이것이 이 세계의 마계 문서인가."),
    ...zs("happy", "좋다. 이 몸이 직접 가 주마. 엎드려 반기도록 해라."),
    bgm(BGM_ROOM, 1200),
    setVar(V_STAGE, "=", 2),
  ];
  const replace = (eventId: string, pageId: string, commands: Command[]) => {
    const p = map.events.find((e) => e.id === eventId)?.pages?.find((pg) => pg.id === pageId);
    if (!p) throw new Error(`[maou-konbini] 원룸 ${eventId}/${pageId} 가 없다 — buildRoom 이 바뀌었다`);
    p.commands = commands;
  };
  replace("ev_mk_room_wake", "ev_mk_room_wake_p", wakeScene);
  replace("ev_mk_room_flyer", "ev_mk_room_flyer_p", flyer);
}

// ── 타이틀 ──────────────────────────────────────────────────────────────

/** 타이틀 — 왼쪽은 옥좌의 마왕, 오른쪽은 노을 진 편의점 앞의 지금의 마오(render_title.py). 글자와 메뉴는 인물이 없는 왼쪽 위·아래에 둔다. */
export function setupMaouTitle(project: Project): void {
  execTool(project, "set_title_screen", {
    title: "전생한 마왕, 편의점 알바 시작하다", logoSubtitle: "이랏샤이마세, 용사여", backgroundResourceId: "oprn-maou-konbini-title",
    backgroundFit: "cover", backgroundRendering: "pixelated",
    logoStyle: "gold", logoShine: "once", menuStyle: "plain", menuFontPx: 13, musicResourceId: BGM_TITLE,
    // 옛판의 달리는 인물(아래 줄)은 메뉴를 가로질러 지나갔다 — 뺀다.
    runners: [],
    layout: { titleX: 16, titleY: 30, menuX: 22, menuY: 168 },
    sequence: { fadeMs: 1200, push: 0.06, logoAtMs: 900, logoReveal: "bloom", menuAtMs: 1900 },
    transition: { kind: "flash", durationMs: 700 },
    effects: [
      // 마왕의 보랏빛 기운과 편의점 문 앞 형광등 — 그림 좌표(0..1).
      { kind: "glow", source: [0.355, 0.66], spread: 0.2, color: "#b648ff", intensity: 0.9, speed: 0.6 },
      { kind: "glow", source: [0.565, 0.7], spread: 0.12, color: "#fff2c8", intensity: 0.6, speed: 0.4 },
      { kind: "motes", region: [[0.02, 0.45], [0.42, 0.45], [0.38, 0.98], [0.02, 0.98]], count: 24, color: "#d890ff", speed: 0.5 },
    ],
  });
}
