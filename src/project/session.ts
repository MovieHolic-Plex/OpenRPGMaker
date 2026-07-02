// project/session.ts
// PlaySession: 플레이 중 런타임 상태. Project는 읽기 전용, 가변 상태는 여기에.
// v2: switches/variables/timers/mapOverrides 포함.
// 스펙 docs/specs/2026-06-18-rm2k3-overhaul-design.md §8.2.

import type { ActorId, ActorInitialEquipment, Command, MapId, Project, SkillId, Condition, MessageWindowSettings } from "./types";
import type { M2RuntimeState, PlaySessionLike, RuntimeEventLocation, RuntimeNpcTravelState } from "@/player/types";
import type { BattleResult } from "@/battle/runtime";
import { compareVariableValue } from "@/project/conditionEvaluation";
import { initialActorVitals, syncActorVitals } from "@/project/sessionVitals";
import type { ActorVitals } from "@/project/sessionVitals";

export type AudioChannel = "bgm" | "bgs" | "me" | "se";

export type AudioTrackState = {
  readonly resourceId: string;
  readonly loop: boolean;
};

export type AudioCommandState = {
  bgm?: AudioTrackState;
  bgs?: AudioTrackState;
  me?: AudioTrackState;
  se?: AudioTrackState;
};

export type PictureState = {
  readonly pictureId: string;
  readonly resourceId: string;
  readonly x: number;
  readonly y: number;
};

export type ActorRowPosition = "front" | "back";

export const DEFAULT_MESSAGE_WINDOW_SETTINGS: MessageWindowSettings = {
  format: "normal",
  position: "bottom",
  preventObscuringPlayer: true,
  allowEventMovementDuringWait: false,
};

export interface PlaySession {
  // 스위치 런타임 값(switchId → bool).
  switches: Record<string, boolean>;
  // 셀프 스위치 런타임 값(eventId → (A/B/C/D → bool)).
  selfSwitches: Record<string, Partial<Record<string, boolean>>>;
  // 변수 런타임 값(variableId → number).
  variables: Record<string, number>;
  // 타이머(id → 남은 초).
  timers: Record<string, number>;
  gold: number;
  inventory: Record<string, number>;
  partyActorIds: string[];
  actorSkillIds: Record<ActorId, SkillId[]>;
  actorExperience: Record<string, number>;
  actorLevels: Record<string, number>;
  actorVitals: Record<string, ActorVitals>;
  eventLocations: Record<string, RuntimeEventLocation>;
  npcTravelStates: Record<string, RuntimeNpcTravelState>;
  actorEquipment: Record<string, ActorInitialEquipment>;
  actorRows: Record<string, ActorRowPosition>;
  // 현재 위치(맵 진입/transfer 시 갱신).
  currentMapId: MapId;
  x: number;
  y: number;
  // 런타임 맵 상태(changeTile 반영). mapId → { lower, upper } 오버라이드.
  mapOverrides: Record<MapId, { lower: Record<number, number>; upper: Record<number, number> }>;
  // 레거시 호환(flags → switches로 마이그레이션됐지만 보존).
  flags: Record<string, boolean>;
  battleResult?: BattleResult;
  commonEvents?: { id: string; commands: Command[] }[];
  audio: AudioCommandState;
  pictures: Record<string, PictureState>;
  messageWindowSettings?: MessageWindowSettings;
  m2Runtime?: M2RuntimeState;
  // 누적 플레이 타임(초). 매 프레임 update 에서 증가.
  playTimeSeconds: number;
}

// Project로부터 새 세션 시작.
// 스위치/변수는 Database 정의에서 0/false 로 초기화(Project.flags는 레거시).
export function startSession(project: Project): PlaySession {
  const switches: Record<string, boolean> = {};
  for (const sw of project.switches) {
    switches[sw.id] = false;
  }
  // 레거시 flags도 스위치로 보정(마이그레이션 잔여 대비).
  for (const [k, v] of Object.entries(project.flags)) {
    if (!(k in switches)) switches[k] = v;
  }
  const variables: Record<string, number> = {};
  for (const v of project.variables) {
    variables[v.id] = 0;
  }
  return {
    switches,
    selfSwitches: {},
    variables,
    timers: { ...(project.session.timers ?? {}) },
    gold: 0,
    inventory: { ...project.session.inventory },
    partyActorIds: [...project.session.partyActorIds],
    actorSkillIds: {},
    actorExperience: initialActorExperience(project),
    actorLevels: initialActorLevels(project),
    actorVitals: initialActorVitals(project),
    eventLocations: {},
    npcTravelStates: {},
    actorEquipment: initialActorEquipment(project),
    actorRows: initialActorRows(project),
    currentMapId: project.startMapId,
    x: project.startPos.x,
    y: project.startPos.y,
    mapOverrides: {},
    flags: { ...project.flags },
    audio: {},
    pictures: {},
    messageWindowSettings: { ...DEFAULT_MESSAGE_WINDOW_SETTINGS },
    playTimeSeconds: 0,
  };
}

function initialActorExperience(project: Project): Record<string, number> {
  const experience: Record<string, number> = {};
  for (const actorId of project.session.partyActorIds) {
    experience[actorId] = 0;
  }
  return experience;
}

function initialActorLevels(project: Project): Record<string, number> {
  const levels: Record<string, number> = {};
  for (const actor of project.database.actors) {
    levels[actor.id] = actor.initialLevel;
  }
  return levels;
}

function initialActorEquipment(project: Project): Record<string, ActorInitialEquipment> {
  const equipment: Record<string, ActorInitialEquipment> = {};
  for (const actor of project.database.actors) {
    equipment[actor.id] = { ...actor.initialEquipment };
  }
  return equipment;
}

function initialActorRows(project: Project): Record<string, ActorRowPosition> {
  const rows: Record<string, ActorRowPosition> = {};
  for (const actorId of project.session.partyActorIds) {
    rows[actorId] = "front";
  }
  return rows;
}

// 스위치 조회(없으면 false).
export function getSwitch(session: PlaySessionLike, switchId: string): boolean {
  return session.switches[switchId] ?? false;
}
export function setSwitch(session: PlaySessionLike, switchId: string, value: boolean): void {
  session.switches[switchId] = value;
}

// 변수 조회(없으면 0).
export function getVariable(session: PlaySessionLike, variableId: string): number {
  return session.variables[variableId] ?? 0;
}
export function setVariable(
  session: PlaySessionLike,
  variableId: string,
  op: "=" | "+=" | "-=" | "*=" | "/=",
  value: number
): void {
  const cur = session.variables[variableId] ?? 0;
  switch (op) {
    case "=": session.variables[variableId] = value; break;
    case "+=": session.variables[variableId] = cur + value; break;
    case "-=": session.variables[variableId] = cur - value; break;
    case "*=": session.variables[variableId] = cur * value; break;
    case "/=":
      session.variables[variableId] = value !== 0 ? Math.floor(cur / value) : cur;
      break;
  }
}

// 타이머.
export function setTimer(session: PlaySessionLike, id: string, seconds: number): void {
  session.timers[id] = seconds;
}
export function getTimer(session: PlaySessionLike, id: string): number {
  return session.timers[id] ?? 0;
}

export function changeGold(session: PlaySessionLike, op: "=" | "+=" | "-=", amount: number): void {
  const next = applyAmount(session.gold, op, amount);
  session.gold = Math.max(0, next);
}

export function changeItem(
  session: PlaySessionLike,
  itemId: string,
  op: "=" | "+=" | "-=",
  amount: number
): void {
  const current = session.inventory[itemId] ?? 0;
  const next = Math.max(0, applyAmount(current, op, amount));
  if (next === 0) {
    delete session.inventory[itemId];
    return;
  }
  session.inventory[itemId] = next;
}

export function changeParty(
  session: PlaySessionLike,
  actorId: string,
  action: "add" | "remove",
  project?: Project
): void {
  if (action === "add") {
    if (!session.partyActorIds.includes(actorId)) session.partyActorIds.push(actorId);
    if (project) syncActorVitals(project, session.actorVitals, actorId);
    return;
  }
  session.partyActorIds = session.partyActorIds.filter((id) => id !== actorId);
}

export function learnSkill(session: PlaySessionLike, actorId: ActorId, skillId: SkillId): void {
  session.actorSkillIds ??= {};
  const learned = session.actorSkillIds[actorId] ?? [];
  if (!learned.includes(skillId)) session.actorSkillIds[actorId] = [...learned, skillId];
}

function applyAmount(current: number, op: "=" | "+=" | "-=", amount: number): number {
  switch (op) {
    case "=":
      return amount;
    case "+=":
      return current + amount;
    case "-=":
      return current - amount;
  }
}

// 맵 타일 오버라이드(changeTile 런타임 반영).
export function setMapTileOverride(
  session: PlaySession,
  mapId: MapId,
  layer: "lower" | "upper",
  index: number,
  tile: number
): void {
  if (!session.mapOverrides[mapId]) {
    session.mapOverrides[mapId] = { lower: {}, upper: {} };
  }
  session.mapOverrides[mapId][layer][index] = tile;
}
export function getMapTile(
  session: PlaySession,
  mapId: MapId,
  layer: "lower" | "upper",
  map: { lowerTiles: number[]; upperTiles: number[] },
  index: number
): number {
  const ov = session.mapOverrides[mapId];
  if (ov && ov[layer] && index in ov[layer]) {
    return ov[layer][index];
  }
  return layer === "lower" ? map.lowerTiles[index] : map.upperTiles[index];
}

export function setAudioState(
  session: PlaySession,
  state: { readonly channel?: AudioChannel; readonly resourceId: string; readonly loop: boolean }
): void {
  const channel = state.channel ?? (state.loop ? "bgm" : "se");
  session.audio[channel] = {
    resourceId: state.resourceId,
    loop: state.loop,
  };
}

export function clearAudioState(session: PlaySession): void {
  session.audio = {};
}

export function showPictureState(session: PlaySession, picture: PictureState): void {
  session.pictures[picture.pictureId] = picture;
}

export function erasePictureState(session: PlaySession, pictureId: string): void {
  delete session.pictures[pictureId];
}

// 조건(Condition) 평가. condition이 없으면 항상 참.
// eventId 는 셀프 스위치 조건에서 "이 이벤트 자신"을 가리킬 때 사용(현재 실행 중인 이벤트).
export function evalCondition(session: PlaySessionLike, condition: Condition | undefined, eventId?: string): boolean {
  if (!condition) return true;
  switch (condition.kind) {
    case "switch":
      return getSwitch(session, condition.switchId) === condition.value;
    case "variable": {
      const v = getVariable(session, condition.variableId);
      return compareVariableValue(v, condition.op, condition.value);
    }
    case "selfSwitch": {
      // 이 이벤트의 셀프 스위치 상태. eventId 미전달 시 항상 false.
      const selfSwitches = session.selfSwitches ?? {};
      const own = eventId ? selfSwitches[eventId] : undefined;
      return (own?.[condition.key] ?? false) === condition.value;
    }
    case "actor":
      return session.partyActorIds.includes(condition.actorId) === condition.present;
    case "item":
      return ((session.inventory[condition.itemId] ?? 0) > 0) === condition.present;
    case "gold":
      return compareVariableValue(session.gold, condition.op, condition.amount);
    case "timer": {
      const remaining = session.timers[condition.timerId] ?? 0;
      return remaining <= condition.seconds;
    }
  }
}
