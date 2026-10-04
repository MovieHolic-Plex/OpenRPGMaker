import { registerDatabasePreview, setDatabasePreviewsActiveIn, type DatabasePreviewLifecycle } from "./databasePreviewLifecycle";
import { buildBattleMotionPreview, type BattleMotionPreviewOutcome } from "@/battle/battleMotionPreview";
import {partyPixelSheet,partyPixelSheetUrl,partyPixelFrame} from "@/assets/partyPixelSheets";
import { applyChoreographyHandles } from "@/battle/retroChoreographyHandles";
import { motionPositionAt, type MotionAnchors } from "@/battle/battleMotionProgram";
import type { SkillChoreographyRecord } from "@/project/types/database";
// retro2003 **몬스터 스킬** 미리보기 — 편집기 전용 순수 타임라인 + 레이어 그리기 + 스킬 탭 반전 무대.
//
// 계약: src/assets/retroMonsterSkills.ts(스킬 42개 · slug → 스킬 목록). 레코드(skill_mon_*)가 없어도 계약만으로 돈다.
// 방향은 직업 스킬과 반대다 — 몬스터가 왼쪽에서 시전하고 아군(오른쪽)이 대상이다. 투사체는 왼→오로 날고
// 계약상 첫 칸이 오른쪽을 보므로 뒤집지 않는다.
//
// 타임라인은 src/battle/retroSkillTimeline.ts 의 사건 형식(RetroSkillTimeline)을 그대로 쓰고
// 상태 계산도 그 파일의 retroTimelineStateAt 을 쓴다. 몬스터 시트 9칸은 pose 사건에 다음처럼 싣는다:
//   windup ↔ attack_windup · move ↔ walk_b · attack ↔ attack · recover ↔ attack_follow · 대기 ↔ idle
// lunge 는 직업 파고들기(dash-strike)와 같은 속도감이다 — 질주 130ms, 복귀 190ms, 여운 260ms.
//
// 레이어 크기(논리 px — 무대 전체가 2배로 그려지므로 화면에서는 2배다): 32·64 칸은 칸 그대로,
// 대상·전원 위 128 칸은 절반(화면 1배, 런타임 fxBoxSize 와 같은 규칙), screen 128 은 무대 높이 × 1.25 로 덮는다.
//
// 타이머 수명: 스킬 탭 무대는 stopMonsterSkillStagesIn / resumeMonsterSkillStagesIn 을
// databaseSkillRetroStage 의 범위 헬퍼가 함께 부른다. 재생은 rAF 하나, 두 틱 연속 문서 밖이면 스스로 멈춘다.
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { charsetBattler } from "@/assets/charsetBattlers";
import { PIXEL_ENEMY_FRAME, PIXEL_ENEMY_SHEETS, pixelEnemyCell, pixelEnemySheetUrl, type PixelEnemyCell, type PixelEnemySheet } from "@/assets/pixelEnemySheets";
import type { RetroFxAnchor, RetroFxLayer } from "@/assets/retroClassSkills";
import { RETRO_MONSTER_SKILLS, RETRO_MONSTER_SKILLSETS, retroMonsterSkill, type RetroMonsterSkill, type RetroMonsterSkillMotion } from "@/assets/retroMonsterSkills";
import { EXTENDED_POSE_FRAME, type CastType, type ExtendedBattlerPose } from "@/battle/battlePose";
import {
  RETRO_FX_FRAME_MS,
  retroSoundForLayer,
  retroSoundsBetween,
  retroTimelineSounds,
  retroTimelineStateAt,
  retroMonsterSkillTimeline,
  type RetroProjectilePath,
  type RetroScreenEffect,
  type RetroSkillTimeline,
  type RetroStagePlace,
  type RetroStageState,
  type RetroTimelineEvent,
  type RetroTimelineSide,
} from "@/battle/retroSkillTimeline";
import { loadBattleSample, playBattleSample } from "@/player/battleSeSamples";
import { el } from "@/util/dom";

// ---- 계약 조회 ----

/** 도트 시트 → 계약 slug(pixel-enemies/<slug>.png 의 파일 이름). */
export function pixelEnemySlug(sheet: Pick<PixelEnemySheet, "path">): string {
  return /([^/]+)\.png$/.exec(sheet.path)?.[1] ?? "";
}

/** 이 slug 가 쓰는 스킬(계약 순서). 모르는 slug 는 빈 배열. */
export function monsterSkillsForSlug(slug: string): readonly RetroMonsterSkill[] {
  return (RETRO_MONSTER_SKILLSETS[slug] ?? []).flatMap((id) => {
    const skill = retroMonsterSkill(id);
    return skill ? [skill] : [];
  });
}

/** 이 스킬을 가진 첫 slug(계약 표 순서)와 그 도트 시트. 스킬 탭 무대의 시전 몬스터다. */
export function monsterCasterFor(skillId: string): { readonly slug: string; readonly sheet: PixelEnemySheet | undefined } | undefined {
  const slug = Object.keys(RETRO_MONSTER_SKILLSETS).find((key) => RETRO_MONSTER_SKILLSETS[key]!.includes(skillId));
  if (!slug) return undefined;
  return { slug, sheet: PIXEL_ENEMY_SHEETS.find((entry) => pixelEnemySlug(entry) === slug) };
}

/** 몬스터 필터 판정: 계약 스킬이거나 skill_mon_ 접두사. */
export function isMonsterSkillId(id: string | undefined): boolean {
  return Boolean(retroMonsterSkill(id)) || Boolean(id?.startsWith("skill_mon_"));
}

export const MONSTER_MOTION_LABELS: Readonly<Record<RetroMonsterSkillMotion, string>> = {
  lunge: "파고들어 치기", shoot: "제자리 사격", cast: "제자리 시전", breath: "숨결 뿜기",
  stomp: "내려찍기", buff: "기합 강화", finisher: "필살기",
};
export const MONSTER_ANCHOR_LABELS: Readonly<Record<RetroFxAnchor, string>> = {
  user: "시전 몬스터", target: "아군 하나", allTargets: "아군 전원", allAllies: "몬스터 편", screen: "화면", projectile: "투사체",
};

// ---- 순수 타임라인 ----

type MonsterBeat = "windup" | "move" | "attack" | "recover" | "idle";
const POSE_OF: Readonly<Record<MonsterBeat, ExtendedBattlerPose>> = {
  windup: "attack_windup", move: "walk_b", attack: "attack", recover: "attack_follow", idle: "idle",
};

/** 타임라인 pose → 몬스터 시트 칸. 대기는 null(호출자가 대기 루프를 돈다). */
export function monsterCellForPose(pose: ExtendedBattlerPose): PixelEnemyCell | null {
  switch (pose) {
    case "attack_windup": return "windup";
    case "walk_b": return "move";
    case "attack": return "attack";
    case "attack_follow": return "recover";
    default: return null;
  }
}

const TAIL_MS = 520;
const QUICK_TAIL_MS = 260;
const OVERLAP = 0.55;
const ELEMENT_SOUND: Readonly<Record<string, string>> = {
  fire: "easyrpg-sound-fire1", ice: "easyrpg-sound-ice1", thunder: "easyrpg-sound-flash3", water: "easyrpg-sound-wave2",
  earth: "easyrpg-sound-earth2", wind: "easyrpg-sound-wind8", holy: "easyrpg-sound-holy3", dark: "easyrpg-sound-darkness3",
};
const ELEMENT_CAST: Readonly<Record<string, CastType>> = { fire: "fire", ice: "ice", water: "ice", thunder: "thunder", holy: "heal", dark: "dark" };

class Builder {
  readonly events: RetroTimelineEvent[] = [];
  end = 0;
  mid = -1;
  private touch(at: number): void { this.end = Math.max(this.end, at); }
  pose(at: number, beat: MonsterBeat): void { this.events.push({ kind: "pose", at, pose: POSE_OF[beat] }); this.touch(at); }
  move(at: number, durationMs: number, to: RetroStagePlace, arc = 0): void { this.events.push({ kind: "move", at, durationMs, to, arc }); this.touch(at + durationMs); }
  sound(at: number, id: string): void { this.events.push({ kind: "sound", at, id }); }
  screen(at: number, durationMs: number, effect: RetroScreenEffect): void { this.events.push({ kind: "screen", at, durationMs, effect }); this.touch(at + durationMs); }
  hit(at: number, who: "target" | "allTargets", durationMs = 280): void { this.events.push({ kind: "hit", at, durationMs, who }); this.touch(at + durationMs); }
  fx(at: number, index: number, layer: RetroFxLayer): number {
    const anchor = layer.anchor === "projectile" ? "target" : layer.anchor;
    const frameMs = RETRO_FX_FRAME_MS[layer.frame] ?? 60;
    const cells = Array.from({ length: Math.max(1, layer.frames) }, (_, cell) => cell);
    this.events.push({ kind: "fx", at, layer: index, key: layer.key, anchor, frame: layer.frame, cells, frameMs });
    const end = at + cells.length * frameMs;
    this.touch(end);
    return end;
  }
  projectile(at: number, durationMs: number, index: number, layer: RetroFxLayer, path: RetroProjectilePath, aim: number): void {
    this.events.push({ kind: "projectile", at, durationMs, layer: index, key: layer.key, frame: layer.frame, frames: Math.max(1, layer.frames), frameMs: RETRO_FX_FRAME_MS[layer.frame] ?? 60, path, aim });
    this.touch(at + durationMs);
  }
}

type Indexed = { readonly index: number; readonly layer: RetroFxLayer };

function impact(b: Builder, start: number, layers: readonly Indexed[]): number {
  let at = start;
  let end = start;
  for (const { index, layer } of layers) {
    const layerEnd = b.fx(at, index, layer);
    const length = layerEnd - at;
    if (b.mid < 0) b.mid = Math.round(at + length * 0.45);
    // 몬스터 편 강화(allAllies)는 아군 피격이 아니다.
    if (layer.anchor !== "allAllies") b.hit(Math.round(at + length * 0.3), layer.anchor === "target" ? "target" : "allTargets");
    b.sound(at, retroSoundForLayer(layer.key));
    end = Math.max(end, layerEnd);
    at = Math.round(at + length * OVERLAP);
  }
  return end;
}

/** 투사체 방출. 반환값은 첫 발이 닿는 시각(착탄 레이어 시작). */
function launch(b: Builder, at: number, shots: readonly Indexed[], spread: boolean): number {
  let first = at;
  for (const { index, layer } of shots) {
    const fall = /meteor/.test(layer.key);
    const volley = /arrow/.test(layer.key) || fall;
    const count = volley ? 3 : 1;
    const durationMs = fall ? 420 : /boulder|bomb/.test(layer.key) ? 400 : 300;
    for (let i = 0; i < count; i += 1) b.projectile(at + i * 110, durationMs, index, layer, fall ? "fall" : "throw", spread ? (count > 1 ? i % 3 : -1) : FRONT_ALLY);
    b.sound(at, /arrow/.test(layer.key) ? "easyrpg-sound-shot1" : "easyrpg-sound-magic1");
    first = Math.max(first, at + durationMs);
  }
  return shots.length > 0 ? first : at;
}

/** 몬스터 스킬 → 타임라인(순수). 같은 스킬은 늘 같은 사건 목록이다. */
export function monsterSkillTimeline(skill: Pick<RetroMonsterSkill, "motion" | "layers" | "effect" | "element">): RetroSkillTimeline {
  const b = new Builder();
  const indexed = skill.layers.map((layer, index) => ({ index, layer }));
  const user = indexed.filter((entry) => entry.layer.anchor === "user");
  const shots = indexed.filter((entry) => entry.layer.anchor === "projectile");
  const hits = indexed.filter((entry) => entry.layer.anchor !== "user" && entry.layer.anchor !== "projectile");
  const spread = hits.some((entry) => entry.layer.anchor === "allTargets");
  const playUser = (at: number): void => { for (const { index, layer } of user) b.fx(at, index, layer); };
  const castSound = ELEMENT_SOUND[skill.element ?? ""] ?? "easyrpg-sound-magic2";
  let tail = TAIL_MS;
  const settle = (at: number): void => { b.pose(at, "recover"); b.pose(at + 200, "idle"); };

  switch (skill.motion) {
    case "lunge": {
      // 직업 파고들기(dash-strike)와 같은 박자: 준비 100ms → 질주 130ms → 착탄 → 복귀 190ms → 여운 260ms.
      b.pose(0, "windup"); playUser(30);
      b.sound(90, "easyrpg-sound-wind8"); b.pose(100, "move"); b.move(100, 130, "front", -6);
      b.pose(230, "attack"); b.sound(235, "easyrpg-sound-blow4");
      const end = impact(b, 245, hits);
      const back = Math.max(end - 120, 480);
      b.pose(back, "recover"); b.move(back, 190, "home", -14); b.pose(back + 230, "idle");
      tail = QUICK_TAIL_MS;
      break;
    }
    case "shoot": {
      b.pose(0, "windup"); playUser(60);
      const release = 460;
      b.pose(release, "attack");
      const land = shots.length > 0 ? launch(b, release, shots, spread) : release + 60;
      if (shots.length === 0) b.sound(release, "easyrpg-sound-shot1");
      const end = impact(b, land, hits);
      settle(Math.max(release + 300, end - 160));
      break;
    }
    case "cast": {
      // 충전을 길게: windup 칸에 720ms 머문다.
      b.pose(0, "windup"); playUser(60);
      const release = 720;
      b.pose(release, "attack"); b.sound(release, castSound);
      const land = shots.length > 0 ? launch(b, release + 40, shots, spread) : release + 60;
      if (shots.some((entry) => /meteor/.test(entry.layer.key))) b.screen(land, 320, "shake");
      const end = impact(b, land, hits);
      settle(Math.max(land + 160, end - 160));
      break;
    }
    case "breath": {
      // attack 칸을 착탄 내내 유지한다.
      b.pose(0, "windup"); b.pose(320, "attack"); b.sound(320, castSound);
      const end = impact(b, 360, hits);
      settle(Math.max(900, end - 140));
      break;
    }
    case "stomp": {
      b.pose(0, "windup"); b.pose(380, "move"); b.pose(440, "attack");
      b.sound(440, "easyrpg-sound-earth2"); b.screen(440, 360, "shake");
      const end = impact(b, 450, hits);
      settle(Math.max(820, end - 140));
      break;
    }
    case "buff": {
      b.pose(0, "windup"); b.sound(160, retroSoundForLayer(skill.layers[0]?.key ?? "buff"));
      playUser(160);
      const end = impact(b, 200, hits);
      if (b.mid < 0 && user[0]) b.mid = 160 + Math.round(user[0].layer.frames * (RETRO_FX_FRAME_MS[user[0].layer.frame] ?? 60) * 0.45);
      settle(Math.max(700, end - 120));
      break;
    }
    case "finisher": {
      // 화면 어둡게 → 긴 windup(오라) → attack → 화면 층 + 전체 착탄 + 섬광·흔들림.
      b.pose(0, "windup"); b.sound(160, "easyrpg-sound-flash1"); b.screen(160, 90, "flash");
      playUser(220);
      const release = 1060;
      b.pose(release, "attack"); b.sound(release, castSound);
      const end = impact(b, release + 20, hits);
      const first = hits[0] ? hits[0].layer.frames * (RETRO_FX_FRAME_MS[hits[0].layer.frame] ?? 60) : 400;
      const blow = Math.round(release + 20 + first * 0.5);
      b.screen(blow, 140, "flash"); b.screen(blow, 420, "shake"); b.sound(blow, "easyrpg-sound-explosion1");
      settle(Math.max(release + 400, end - 120));
      b.screen(0, Math.max(end + 120, release + 600), "dim");
      break;
    }
  }
  const side: RetroTimelineSide = skill.effect === "buffSelf" ? "self" : skill.effect === "buffAllies" ? "allies" : "enemies";
  return {
    durationMs: Math.round(b.end + tail),
    castType: ELEMENT_CAST[skill.element ?? ""] ?? "arcane",
    side,
    representativeMs: b.mid >= 0 ? b.mid : Math.round(b.end / 2),
    events: [...b.events].sort((x, y) => x.at - y.at),
  };
}

// ---- 시트 적재(404 허용) ----

const sheetState = new Map<string, boolean>();
export function probeMonsterSheet(url: string): Promise<boolean> {
  if (sheetState.get(url)) return Promise.resolve(true);
  if (typeof Image !== "function") return Promise.resolve(true);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => { sheetState.set(url, true); resolve(true); };
    // 실패는 기억하지 않는다 — 그림 에이전트가 시트를 막 추가했을 수 있다.
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

export function monsterFxUrl(key: string): string {
  return withInlineAsset("/assets/generated/pixel-fx/" + key + ".png");
}

// ---- 레이어 그리기(두 무대 공용) ----

export type Point = { readonly x: number; readonly y: number };
export type MonsterFxGeometry = {
  /** 시전 몬스터 발 위치(이동 중이면 그 순간 위치)와 셀 크기. */
  readonly caster: Point;
  readonly casterCell: number;
  /** 한 대상 스킬의 과녁(아군 하나) 발 위치. */
  readonly target: Point;
  /** 아군 전원 발 위치. */
  readonly targets: readonly Point[];
  /** 몬스터 편 전원 발 위치(allAllies). */
  readonly allies: readonly Point[];
  readonly stageW: number;
  readonly stageH: number;
  readonly programAnchors?:MotionAnchors;
  readonly acceleration?:number;
};

/** 레이어 한 칸의 논리 크기. 대상·전원 위 128 칸은 절반(화면 1배), 화면 128 은 무대 높이 × 1.25. */
export function monsterFxBox(layer: Pick<RetroFxLayer, "anchor" | "frame">, stageH: number): number {
  if (layer.anchor === "screen") return Math.round(stageH * 1.25);
  if (layer.frame >= 128 && (layer.anchor === "target" || layer.anchor === "allTargets")) return layer.frame / 2;
  return layer.frame;
}

export type MonsterFxPainter = {
  readonly paint: (state: RetroStageState, geometry: MonsterFxGeometry) => void;
  readonly clear: () => void;
};

/**
 * container 안에 레이어 노드를 두고 상태를 그린다. 404 시트는 그 레이어만 조용히 생략한다.
 * onMissing 은 시트 하나가 없다고 판명될 때 부른다(칩 표시용).
 * screen 레이어는 screenContainer(배우 뒤) 에 둔다 — 앞에 두면 128 하늘이 시전 몬스터를 통째로 가렸다(2026-09-28 캡처).
 */
export function createMonsterFxPainter(
  container: HTMLElement, layers: readonly RetroFxLayer[], nodeClass: string, onMissing?: (key: string) => void, screenContainer: HTMLElement = container,
): MonsterFxPainter {
  const nodes = new Map<number, HTMLElement>();
  const missing = new Set<string>();
  for (const key of new Set(layers.map((layer) => layer.key))) {
    void probeMonsterSheet(monsterFxUrl(key)).then((ok) => {
      if (ok) return;
      missing.add(key);
      onMissing?.(key);
    });
  }
  const nodeFor = (id: number, screen: boolean): HTMLElement => {
    let node = nodes.get(id);
    if (!node) { node = el("span", { class: nodeClass }); (screen ? screenContainer : container).append(node); nodes.set(id, node); }
    return node;
  };
  const place = (id: number, layerIndex: number, cell: number, center: Point, bottom: boolean, used: Set<number>, stageH: number): void => {
    const layer = layers[layerIndex];
    if (!layer || missing.has(layer.key)) return;
    const size = monsterFxBox(layer, stageH);
    const node = nodeFor(id, layer.anchor === "screen");
    used.add(id);
    node.style.width = size + "px";
    node.style.height = size + "px";
    node.style.backgroundImage = 'url("' + monsterFxUrl(layer.key) + '")';
    node.style.backgroundSize = size * layer.frames + "px " + size + "px";
    node.style.backgroundPosition = -cell * size + "px 0";
    node.style.left = Math.round(center.x - size / 2) + "px";
    node.style.top = Math.round(bottom ? center.y - size : center.y - size / 2) + "px";
    node.dataset.key = layer.key;
    node.dataset.anchor = layer.anchor;
    node.dataset.cell = String(cell);
  };
  const feet = (point: Point): Point => ({ x: point.x, y: point.y + 6 });
  const paint = (state: RetroStageState, g: MonsterFxGeometry): void => {
    const used = new Set<number>();
    for (const fx of state.fx) {
      const id = fx.event * 10;
      if (fx.anchor === "screen") place(id, fx.layer, fx.cell, { x: g.stageW / 2, y: g.stageH / 2 }, false, used, g.stageH);
      else if (fx.anchor === "user") place(id, fx.layer, fx.cell, feet(g.caster), true, used, g.stageH);
      else if (fx.anchor === "target") place(id, fx.layer, fx.cell, feet(g.target), true, used, g.stageH);
      else (fx.anchor === "allAllies" ? g.allies : g.targets).forEach((point, index) => place(id + index + 1, fx.layer, fx.cell, feet(point), true, used, g.stageH));
    }
    for (const shot of state.projectiles) {
      const aimed = shot.aim < 0 ? centroid(g.targets) : g.targets[shot.aim % Math.max(1, g.targets.length)] ?? g.target;
      const to = { x: aimed.x, y: aimed.y - 22 };
      // 몬스터 앞쪽(오른쪽) 몸 가운데에서 떠나 왼→오로 난다.
      const from = { x: g.caster.x + g.casterCell * 0.3, y: g.caster.y - g.casterCell * 0.45 };
      const p = shot.progress;
      let point = shot.path === "fall"
        ? { x: lerp(to.x - 46, to.x, p), y: lerp(-20, to.y, p) }
        : { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) - 14 * 4 * p * (1 - p) };
      if(shot.trajectory&&g.programAnchors)point=motionPositionAt(shot.trajectory,shot.at??0,g.programAnchors,g.acceleration);
      place(shot.event * 10 + 9, shot.layer, shot.cell, point, false, used, g.stageH);
    }
    for (const [id, node] of nodes) node.hidden = !used.has(id);
  };
  return { paint, clear: () => { for (const node of nodes.values()) node.hidden = true; } };
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function centroid(points: readonly Point[]): Point {
  const n = Math.max(1, points.length);
  return { x: points.reduce((sum, p) => sum + p.x, 0) / n, y: points.reduce((sum, p) => sum + p.y, 0) / n };
}

/** 이동 사건의 그 순간 위치. home·front 두 자리만 쓴다(front = 과녁 앞). */
export function monsterMovePoint(state: RetroStageState, home: Point, front: Point): Point {
  const at = (place: RetroStagePlace): Point => (place === "front" ? front : home);
  const from = at(state.move.from), to = at(state.move.to), p = state.move.progress;
  return { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) + state.move.arc * 4 * p * (1 - p) };
}

// ---- 스킬 탭 반전 무대 ----

const STAGE_W = 240;
const STAGE_H = 136;
const CELL = 48;
const LOOP_REST_MS = 520;
const SOUND_VOLUME = 0.36;
const SOUND_WAIT_MS = 360;
const SCENERY = ["ground", "mid", "far", "sky"].map((layer) => withInlineAsset("/assets/generated/battle-scenery/plains/" + layer + ".png"));
/** 오른쪽 아군 셋(대상). 스킬 탭 직업 무대와 같은 사선 계단. */
const PARTY_HOMES: readonly Point[] = [{ x: 176, y: 90 }, { x: 196, y: 106 }, { x: 216, y: 122 }];
const PARTY_BATTLERS = ["charset-battler-actor1-0", "charset-battler-actor2-0", "charset-battler-actor1-5"];
/** 한 대상 스킬의 과녁 — 가운데 아군. */
const FRONT_ALLY = 1;

let sessionSpeed: 0.5 | 1 = 1;
let sessionRepeat = true;

export type MonsterSkillStage = { readonly element: HTMLElement; readonly stop: () => void };

/**
 * 스킬 탭 몬스터 스킬 무대. 몬스터(그 스킬을 가진 첫 slug 의 도트 시트)가 왼쪽에서 시전하고
 * 오른쪽 아군 셋이 대상이다. 이름은 레코드 이름 → 계약 이름.
 */
export function renderMonsterSkillStage(skill: RetroMonsterSkill, name?: string,record?:SkillChoreographyRecord,hits?:number): MonsterSkillStage {
  const baseTimeline=record?.movement?retroMonsterSkillTimeline(skill,{hits}):monsterSkillTimeline(skill);
  let timeline = record?.movement
    ? buildBattleMotionPreview(record,count=>retroMonsterSkillTimeline(skill,{hits:count}),{hits,preparing:record.motion==="buff"})
    : applyChoreographyHandles(baseTimeline,record);
  let previewHit=true,previewTriggered=true;
  const extraNodes=new Map<string,HTMLElement>();
  const caster = monsterCasterFor(skill.id) ?? (record?.movement ? {slug:"slime",sheet:PIXEL_ENEMY_SHEETS.find(s=>s.resourceId==="generated-enemy-slime-01")} : undefined);
  const sheet = caster?.sheet;
  const cell = sheet ? pixelEnemyCell(sheet) : CELL;
  const grow = Math.max(0, cell - CELL);
  const home: Point = { x: 58 + grow / 4, y: 112 + grow / 8 };
  const title = name || skill.name;

  const world = el("div", { class: "db-skill-retro-world", attrs: { "aria-hidden": "true" } });
  world.style.width = STAGE_W + "px";
  world.style.height = STAGE_H + "px";
  const scenery = el("div", { class: "db-skill-retro-scenery" });
  scenery.style.backgroundImage = SCENERY.map((url) => 'url("' + url + '")').join(", ");
  const dimVeil = el("div", { class: "db-skill-retro-dim" });
  const screenLayer = el("div", { class: "db-skill-retro-screen-layer" });
  const cast = el("div", { class: "db-skill-retro-cast" });
  const fxLayer = el("div", { class: "db-skill-retro-fx-layer" });
  const flashVeil = el("div", { class: "db-skill-retro-flash" });
  world.append(scenery, dimVeil, screenLayer, cast, fxLayer, flashVeil);

  const monster = el("span", { class: "db-skill-retro-enemy db-skill-mon-caster", dataset: { enemy: sheet?.resourceId ?? "" } });
  monster.style.width = cell + "px";
  monster.style.height = cell + "px";
  monster.style.backgroundSize = cell * 3 + "px " + cell * 3 + "px";
  if (sheet) {
    const url = pixelEnemySheetUrl(sheet);
    monster.style.backgroundImage = 'url("' + url + '")';
    // 시트가 아직 없으면(다른 에이전트가 그리는 중) 몸만 빼고 레이어는 그대로 돈다.
    void probeMonsterSheet(url).then((ok) => { if (!ok) monster.hidden = true; });
  } else monster.hidden = true;
  const party = PARTY_BATTLERS.map((id, index) => {
    const node = el("span", { class: "db-skill-retro-battler", dataset: { role: "ally", battler: id } });
    const entry = charsetBattler(id);
    if (entry) node.style.backgroundImage = 'url("' + withInlineAsset("/" + entry.path) + '")';
    return { node, home: PARTY_HOMES[index]! };
  });
  [{ y: home.y, node: monster }, ...party.map((entry) => ({ y: entry.home.y, node: entry.node }))]
    .sort((a, b) => a.y - b.y).forEach((entry, index) => { entry.node.style.zIndex = String(10 + index); cast.append(entry.node); });
  const baseZ = monster.style.zIndex;

  const layerChips = new Map<string, HTMLElement>();
  const painter = createMonsterFxPainter(fxLayer, skill.layers, "db-skill-retro-fx", (key) => {
    layerChips.get(key)?.classList.add("is-missing");
    layerChips.get(key)?.setAttribute("data-missing", "true");
  }, screenLayer);

  const stage = el("div", {
    class: "db-skill-retro-stage db-skill-mon-stage",
    dataset: { testid: "db-skill-mon-stage", skill: skill.id, motion: skill.motion, caster: caster?.slug ?? "", mirror: "true", running: "false" },
    attrs: { role: "img", "aria-label": `${title} 몬스터 스킬 미리보기` },
    children: [world],
  });

  const target = party[FRONT_ALLY]!.home;
  // 과녁 앞: 몬스터 몸 폭의 절반 + 14px 떨어져 선다.
  const front: Point = { x: target.x - cell / 2 - 14, y: target.y };
  let now = 0;
  let clock = 0;
  const idleCells: readonly PixelEnemyCell[] = ["idle_a", "idle_b", "idle_c", "idle_b"];
  const counter = el("span", { class: "db-skill-animation-chip db-skill-retro-time", dataset: { testid: "db-skill-mon-time" } });

  function draw(): void {
    let state = retroTimelineStateAt(timeline, now);
    if(!previewHit||!previewTriggered)state={...state,hitTarget:0,hitAll:0};
    world.style.setProperty("--retro-shake-x", state.shake.x + "px");
    world.style.setProperty("--retro-shake-y", state.shake.y + "px");
    dimVeil.style.opacity = String(Math.round(state.dim * 72) / 100);
    flashVeil.style.opacity = String(Math.round(state.flash * 80) / 100);
    const anchors:MotionAnchors={home,front,target,target2:party[0]!.home,target3:party[2]!.home,ally:home,left:{x:-96,y:home.y},right:{x:STAGE_W+96,y:home.y},top:{x:target.x,y:-160}};
    const track=timeline.actors?.find(a=>a.role==="user");
    const programmed=track?motionPositionAt(track,now,anchors,timeline.movement?.acceleration):undefined;
    const point = programmed??monsterMovePoint(state, home, front);
    const beat = monsterCellForPose(programmed?.pose??state.pose) ?? idleCells[Math.floor(clock / (sheet?.idleFrameMs ?? 220)) % 4]!;
    const pos = PIXEL_ENEMY_FRAME[beat];
    monster.style.backgroundPosition = -pos.col * cell + "px " + -pos.row * cell + "px";
    // 시트 계약: 바닥 기준선 y = cell − 4.
    monster.style.left = Math.round(point.x - cell / 2) + "px";
    monster.style.top = Math.round(point.y - (cell - 4)) + "px";
    monster.style.opacity=String(programmed?.alpha??1);
    monster.style.scale=programmed?.flip?"-1 1":"";
    monster.style.zIndex = point.x > home.x + 1 ? "40" : baseZ;
    const selfGlow = timeline.side !== "enemies" && state.fx.some((fx) => fx.anchor === "user" || fx.anchor === "allAllies") ? 0.6 : 0;
    monster.style.setProperty("--retro-hit", String(selfGlow * 0.3));
    monster.style.setProperty("--retro-dim", String(Math.round(state.dim * 100) / 100));
    party.forEach((member, index) => {
      const struck = timeline.side === "enemies" ? Math.max(state.hitAll, index === FRONT_ALLY ? state.hitTarget : 0) : 0;
      const targetTrack=index===FRONT_ALLY?timeline.actors?.find(a=>a.role==="target"):undefined;
      const targetPose=targetTrack?motionPositionAt(targetTrack,now,anchors,timeline.movement?.acceleration).pose:undefined;
      const pose = EXTENDED_POSE_FRAME[targetPose??(struck > 0.3 ? "hit" : "idle")];
      member.node.style.backgroundPosition = -pose.col * CELL + "px " + -pose.row * CELL + "px";
      // 아군은 오른쪽으로 밀려난다.
      const knock = struck > 0 ? Math.round(5 * struck) + (Math.floor(clock / 40) % 2 === 0 ? 1 : -1) : 0;
      const at=targetTrack?motionPositionAt(targetTrack,now,anchors,timeline.movement?.acceleration):member.home;
      member.node.style.left = Math.round(at.x - CELL / 2 + knock) + "px";
      member.node.style.top = Math.round(at.y - 45) + "px";
      member.node.style.setProperty("--retro-glow", "0");
      member.node.style.setProperty("--retro-dim", String(Math.round(state.dim * 100) / 100));
    });
    const usedRoles=new Set<string>();
    for(const track of timeline.actors??[]){if(["user","target"].includes(track.role))continue;
      usedRoles.add(track.role);let node=extraNodes.get(track.role);if(!node){node=monster.cloneNode(false) as HTMLElement;world.append(node);extraNodes.set(track.role,node);}
      const p=motionPositionAt(track,now,anchors,timeline.movement?.acceleration);node.hidden=false;node.style.opacity=String(p.alpha);node.style.scale=p.flip?"-1 1":"";
      const summon=track.role==="summon"?partyPixelSheet("party-pixel-animal-7"):undefined,c=summon?.cell??cell;
      const f=summon?partyPixelFrame(summon,p.pose==="attack"?"attack":"idle_a"):PIXEL_ENEMY_FRAME[monsterCellForPose(p.pose??"idle")??"idle_a"];
      Object.assign(node.style,{left:`${p.x-c/2}px`,top:`${p.y-c+4}px`,width:`${c}px`,height:`${c}px`,backgroundSize:`${c*3}px ${c*(summon?.rows??3)}px`,backgroundPosition:`${-f.col*c}px ${-f.row*c}px`,zIndex:"42"});
      if(summon)node.style.backgroundImage=`url("${partyPixelSheetUrl(summon)}")`;
    }
    for(const [role,node]of extraNodes)node.hidden=!usedRoles.has(role);
    const targetMotion=timeline.actors?.find(a=>a.role==="target");
    const movingTarget=targetMotion?motionPositionAt(targetMotion,now,anchors,timeline.movement?.acceleration):target;
    painter.paint(state, {
      caster: point, casterCell: cell, target:movingTarget, targets: party.map((entry,index) => index===FRONT_ALLY?movingTarget:entry.home), allies: [point], stageW: STAGE_W, stageH: STAGE_H,programAnchors:anchors,acceleration:timeline.movement?.acceleration,
    });
    stage.dataset.retroTime = String(Math.round(now));
    stage.dataset.pixelCell = beat;
    counter.textContent = seconds(now) + " / " + seconds(timeline.durationMs) + "초";
  }

  // ---- 재생 제어(직업 무대와 같은 규약: 자동 반복은 무음, ▶ 재생 회차만 소리) ----
  const playButton = el("button", { class: "db-skill-animation-toggle db-skill-retro-play", dataset: { testid: "db-skill-mon-play" }, attrs: { type: "button", "aria-pressed": "false" }, text: "▶ 재생" });
  const repeatButton = el("button", { class: "db-skill-retro-option", dataset: { testid: "db-skill-mon-repeat" }, attrs: { type: "button", "aria-pressed": String(sessionRepeat) }, text: "반복" });
  const speedButtons = ([0.5, 1] as const).map((speed) => el("button", {
    class: "db-skill-retro-option", dataset: { testid: "db-skill-mon-speed-" + speed }, attrs: { type: "button", "aria-pressed": String(sessionSpeed === speed) }, text: speed + "×",
  }));
  const speedGroup = el("div", { class: "db-skill-retro-segment", attrs: { role: "group", "aria-label": "재생 속도" }, children: speedButtons });

  const chips = el("div", { class: "db-skill-retro-layers", attrs: { "aria-label": "연출 레이어" } });
  for (const layer of new Map(skill.layers.map((entry) => [entry.key, entry])).values()) {
    const chip = el("span", { class: "db-skill-retro-layer", dataset: { testid: "db-skill-mon-layer", key: layer.key }, children: [
      el("img", { class: "db-skill-retro-layer-thumb", attrs: { src: monsterFxUrl(layer.key), alt: "", width: "16", height: "16" } }),
      el("code", { class: "db-skill-retro-layer-key", text: layer.key }),
      el("span", { class: "db-skill-retro-layer-anchor", text: MONSTER_ANCHOR_LABELS[layer.anchor] }),
      el("span", { class: "db-skill-retro-layer-size", text: layer.frame + "px × " + layer.frames + "칸" }),
      el("span", { class: "db-skill-retro-layer-missing", text: "그림 없음" }),
    ] });
    chip.querySelector("img")?.addEventListener("error", () => chip.classList.add("is-missing"), { once: true });
    layerChips.set(layer.key, chip);
    chips.append(chip);
  }
  const caption = el("div", { class: "db-skill-retro-caption", children: [
    el("span", { class: "db-skill-retro-badge-inline", text: "몬스터 스킬" }),
    el("span", { class: "db-skill-animation-chip", dataset: { testid: "db-skill-mon-motion" }, text: MONSTER_MOTION_LABELS[skill.motion] }),
    ...(caster ? [el("span", { class: "db-skill-animation-chip", dataset: { testid: "db-skill-mon-caster" }, children: [
      el("span", { text: "시전 몬스터" }), " ", el("code", { class: "notranslate", attrs: { translate: "no" }, text: caster.slug }),
    ] })] : []),
  ] });
  const outcome=el("select",{attrs:{"aria-label":"명중 결과"},children:[el("option",{attrs:{value:"hit"},text:"명중"}),el("option",{attrs:{value:"miss"},text:"빗나감"}),el("option",{attrs:{value:"cancel"},text:"발동불가"})]}) as HTMLSelectElement;
  if(record?.motion==="buff"){outcome.options[0]!.text="발동";outcome.options[1]!.disabled=true;}
  outcome.addEventListener("change",()=>{stop();previewHit=outcome.value!=="miss";previewTriggered=outcome.value!=="cancel";if(timeline.movement)timeline=buildBattleMotionPreview(record,count=>retroMonsterSkillTimeline(skill,{hits:count}),{hits:baseTimeline.hitCount,outcome:outcome.value as BattleMotionPreviewOutcome,preparing:record?.motion==="buff"});now=timeline.representativeMs;draw();});
  const controls = el("div", { class: "db-skill-retro-controls", children: [playButton, repeatButton, speedGroup, counter,...(timeline.movement?[outcome]:[])] });
  const wrap = el("div", { class: "db-skill-retro-preview db-skill-mon-preview", dataset: { testid: "db-skill-mon-preview", skill: skill.id }, children: [caption, stage, controls, chips] });
  let resizeObserver: ResizeObserver | undefined;
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) world.style.setProperty("--retro-stage-scale", String(Math.round((width / STAGE_W) * 1000) / 1000));
    });
    resizeObserver.observe(stage);
  }

  let frame: number | null = null;
  let last = 0;
  let withSound = false;
  let userPlay = false;
  let soundToken = 0;
  let restUntil = -1;
  const canAutoplay = autoplayAllowed();
  let wantsPlayback = canAutoplay;
  let lifecycle: DatabasePreviewLifecycle;
  const setRunning = (running: boolean): void => {
    const userPlaying = running && userPlay;
    playButton.textContent = userPlaying ? "■ 정지" : "▶ 재생";
    playButton.setAttribute("aria-pressed", String(userPlaying));
    stage.dataset.running = String(running);
  };
  const suspend = (): void => {
    soundToken += 1;
    if (frame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    frame = null;
    withSound = false;
    setRunning(false);
  };
  const schedule = (): void => { if (typeof requestAnimationFrame === "function") frame = requestAnimationFrame(tick); };
  const stop = (): void => { wantsPlayback = false; userPlay = false; suspend(); };
  function tick(stamp: number): void {
    frame = null;
    if (!stage.isConnected) { lifecycle.dispose(); return; }
    if (!lifecycle.isActive()) { suspend(); return; }
    const dt = Math.min(64, Math.max(0, stamp - (last || stamp)));
    last = stamp;
    clock += dt;
    if (restUntil >= 0) {
      if (clock < restUntil) { draw(); schedule(); return; }
      restUntil = -1;
      now = 0;
    }
    const before = now;
    now = Math.min(timeline.durationMs, now + dt * sessionSpeed);
    if (withSound) for (const id of retroSoundsBetween(timeline, before, now)) playBattleSample(id, SOUND_VOLUME);
    draw();
    if (now >= timeline.durationMs) {
      withSound = false;
      if (!sessionRepeat) { stop(); return; }
      restUntil = clock + LOOP_REST_MS;
    }
    schedule();
  }
  const start = (sound: boolean): void => {
    if (!lifecycle?.isActive()) return;
    suspend();
    wantsPlayback = true;
    userPlay = sound;
    now = 0;
    restUntil = -1;
    last = 0;
    setRunning(true);
    draw();
    if (!sound) { schedule(); return; }
    const token = ++soundToken;
    const ready = Promise.all(retroTimelineSounds(timeline).map((id) => loadBattleSample(id)));
    const wait = new Promise<void>((resolve) => { setTimeout(resolve, SOUND_WAIT_MS); });
    void Promise.race([ready, wait]).then(() => {
      if (token !== soundToken || !lifecycle.isActive()) return;
      withSound = true;
      for (const id of retroSoundsBetween(timeline, -1, 0)) playBattleSample(id, SOUND_VOLUME);
      schedule();
    });
  };
  playButton.addEventListener("click", () => {
    if (userPlay && stage.dataset.running === "true") { stop(); return; }
    start(true);
  });
  repeatButton.addEventListener("click", () => {
    sessionRepeat = !sessionRepeat;
    repeatButton.setAttribute("aria-pressed", String(sessionRepeat));
  });
  speedButtons.forEach((button, index) => button.addEventListener("click", () => {
    sessionSpeed = index === 0 ? 0.5 : 1;
    speedButtons.forEach((other, otherIndex) => other.setAttribute("aria-pressed", String(otherIndex === index)));
  }));

  lifecycle = registerDatabasePreview(stage, {
    suspend,
    resume: () => {
      if (!wantsPlayback || frame !== null || stage.dataset.running === "true") return;
      // Resume the retained timeline without replaying buffered sound or hidden elapsed time.
      last = 0;
      setRunning(true);
      schedule();
    },
    dispose: () => resizeObserver?.disconnect(),
  });
  // Construction is static, including startup prewarm.
  now = canAutoplay ? 0 : timeline.representativeMs;
  draw();
  return { element: wrap, stop: () => lifecycle.dispose() };
}

function seconds(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(1);
}

function autoplayAllowed(): boolean {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches !== true;
}

/** scope 안의 몬스터 스킬 무대를 모두 멈춘다. stopRetroSkillStagesIn 이 함께 부른다. */
export function stopMonsterSkillStagesIn(scope: ParentNode): void {
  setDatabasePreviewsActiveIn(scope, false);
}
export function resumeMonsterSkillStagesIn(scope: ParentNode): void {
  setDatabasePreviewsActiveIn(scope, true);
}

/**
 * 스킬 레코드(skill_mon_*)가 아직 없을 때 「몬스터」 칩 목록 자리에 띄우는 계약 둘러보기.
 * 계약 스킬 목록 + 무대 하나. 고를 때 옛 무대를 멈춘다(떨어진 무대는 두 틱 뒤 스스로도 멈춘다).
 */
export function renderMonsterSkillContractBrowser(): HTMLElement {
  const slot = el("div", { class: "db-skill-mon-browser-stage" });
  let current: MonsterSkillStage | null = null;
  const select = el("select", { class: "db-skill-mon-browser-select", attrs: { "aria-label": "몬스터 스킬 고르기" }, dataset: { testid: "db-skill-mon-browser-select" } });
  for (const skill of RETRO_MONSTER_SKILLS) select.append(el("option", { text: skill.name, attrs: { value: skill.id } }));
  const show = (id: string): void => {
    const skill = retroMonsterSkill(id);
    if (!skill) return;
    current?.stop();
    current = renderMonsterSkillStage(skill);
    slot.replaceChildren(current.element);
  };
  select.addEventListener("change", () => show(select.value));
  show(RETRO_MONSTER_SKILLS[0]!.id);
  return el("div", { class: "db-skill-mon-browser", dataset: { testid: "db-skill-mon-browser" }, children: [
    el("p", { class: "db-skill-mon-browser-note", text: `스킬 레코드가 아직 없어 계약으로 미리 봅니다 (몬스터 스킬 ${RETRO_MONSTER_SKILLS.length}개).` }),
    el("label", { class: "db-skill-mon-browser-label", children: [el("span", { text: "스킬" }), select] }),
    slot,
  ] });
}
