// project/session.ts
// PlaySession: 플레이 중 런타임 상태. Project는 읽기 전용, 가변 상태는 여기에.
// v2: switches/variables/timers/mapOverrides 포함.
// 스펙 docs/specs/2026-06-18-rm2k3-overhaul-design.md §8.2.

import type { Command, MapId, Project, Condition } from "./types";
import type { PlaySessionLike } from "@/player/types";
import type { BattleResult } from "@/battle/runtime";

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

export interface PlaySession {
  // 스위치 런타임 값(switchId → bool).
  switches: Record<string, boolean>;
  // 변수 런타임 값(variableId → number).
  variables: Record<string, number>;
  // 타이머(id → 남은 초).
  timers: Record<string, number>;
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
    variables,
    timers: {},
    currentMapId: project.startMapId,
    x: project.startPos.x,
    y: project.startPos.y,
    mapOverrides: {},
    flags: { ...project.flags },
    audio: {},
    pictures: {},
  };
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
export function evalCondition(session: PlaySessionLike, condition: Condition | undefined): boolean {
  if (!condition) return true;
  if (condition.kind === "switch") {
    return getSwitch(session, condition.switchId) === condition.value;
  }
  // variable
  const v = getVariable(session, condition.variableId);
  switch (condition.op) {
    case ">=": return v >= condition.value;
    case "<=": return v <= condition.value;
    case "==": return v === condition.value;
    case "!=": return v !== condition.value;
  }
}
