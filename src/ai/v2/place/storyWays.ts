// 이야기가 지나는 길 — 한 맵에서 플레이어가 꼭 가는 것들(청사진 단계의 이벤트 · 도망 못 치는 전투 · 쉼터)과, 들어오는 칸에서 그것들까지의 가장 짧은 길.
// 왜(2026-11-14 r4d-fun): 쫓는 박쥐가 가로 13칸짜리 보스 방 안, 쉼터와 보스 사이에 서서 스무 판 모두 플레이어를 잡았다 — 세계 채우기는 들어오는 칸에서의 걸음 수만 봤다.
// 쓰는 곳 둘: 세계 채우기(place/worldPopulate — 그 방·그 길에는 돌아다니는 적을 두지 않는다)와 보스 밴드(story/pathBattleBudget — 그래도 길을 지켜보는 적은 «피할 수 없는 전투» 로 센다).
import { isPassable } from "@/project/collision";
import type { Project } from "@/project/types";
import { eventBlockers, shortestPathCells, walkStart } from "./cells";
import { incomingLandings } from "./where";
import { placeThemeOf } from "./placeTheme";

type Cell = { readonly x: number; readonly y: number };
/** 이 넓이 아래의 맵은 방 한 칸이다 — 적이 알아채는 거리(3칸) 밖으로 돌아갈 틈이 없다. */
const ROOM_CELLS = 280;
/** 순찰하는 적이 제자리에서 오가는 거리(칸) — 두 칸 왕복. */
const PATROL_REACH = 2;

/** 방인가 — 실내 종류이거나 방 한 칸 넓이. 방 안의 돌아다니는 적은 피할 수 없다(들어서면 반드시 잡힌다). */
export const isStoryRoom = (project: Project, mapId: string): boolean => {
  const map = project.maps[mapId];
  return !!map && (!!placeThemeOf(project, mapId)?.kind?.indoor || map.width * map.height < ROOM_CELLS);
};

const FIGHT_OR_REST = /"kind":"(?:recoverAll|inn)"|"kind":"battleProcessing"[^}]*"canEscape":false/u;

/**
 * 보스 방인가 — 도망 못 치는 싸움이나 쉼터가 선 방, 또는 청사진의 싸우는 단계가 쓰는 방(지어지기 전에도 안다 — 보스 곁에는 쉼터가 선다).
 * 이 방에는 돌아다니는 적을 두지 않는다: 쉬러 가는 길에 먼저 잡히고, 보스 앞에 설 레벨이 달라진다.
 * 사람·찾을 것·자물쇠 단계만 있는 방(위험한 장소의 작은 동굴)은 보스 방이 아니다 — 그 장소의 적은 그대로 선다.
 */
export function isBossRoom(project: Project, mapId: string): boolean {
  const map = project.maps[mapId];
  if (!map || !isStoryRoom(project, mapId)) return false;
  return map.events.some((e) => FIGHT_OR_REST.test(JSON.stringify(e.pages ?? [])))
    || (project.gameBlueprint?.steps ?? []).some((step) => step.kind === "battle" && step.place.trim() === (map.name ?? "").trim());
}

/** 이 맵에서 플레이어가 꼭 가는 것들의 칸 — 청사진 단계의 이벤트(지어지기 전이면 없다) · 도망 못 치는 전투 · 쉼터(전원 회복). */
export function storyThings(project: Project, mapId: string): Cell[] {
  const map = project.maps[mapId];
  const stepIds = new Set((project.gameBlueprint?.steps ?? []).flatMap((step) => (step.built?.mapId === mapId ? [step.built.eventId] : [])));
  return (map?.events ?? []).filter((e) => stepIds.has(e.id) || FIGHT_OR_REST.test(JSON.stringify(e.pages ?? []))).map((e) => ({ x: e.x, y: e.y }));
}

/** 들어오는 칸에서 그것들까지 걷는 가장 짧은 길의 칸(이벤트는 지나지 못한다 — 그 곁 칸까지). */
export function storyLanes(project: Project, mapId: string, things: readonly Cell[]): Set<number> {
  const map = project.maps[mapId]!;
  const blocked = eventBlockers(map);
  const lanes = new Set<number>();
  const from = incomingLandings(project, mapId).filter((c) => isPassable(project, map, c.x, c.y));
  for (const start of from.length ? from : [walkStart(project, map)]) for (const thing of things) {
    const beside = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => ({ x: thing.x + dx!, y: thing.y + dy! })).filter((c) => isPassable(project, map, c.x, c.y))
      .map((c) => shortestPathCells(project, map, start, c, blocked)).filter((path) => path.size).sort((a, b) => a.size - b.size)[0];
    for (const cell of beside ?? []) lanes.add(cell);
  }
  return lanes;
}
/** 그 칸에 선 적이 길 위의 플레이어를 알아채는가 — 길의 칸이 알아채는 거리(notice) + 순찰 두 칸 안에 있다. */
export const watchesLane = (map: { readonly width: number }, lanes: ReadonlySet<number>, c: Cell, notice: number): boolean => {
  const reach = notice + PATROL_REACH;
  for (const i of lanes) if (Math.max(Math.abs((i % map.width) - c.x), Math.abs(Math.floor(i / map.width) - c.y)) <= reach) return true;
  return false;
};

/**
 * 그 적(닿으면 싸우는 이벤트)을 플레이어가 피할 수 없는가 — 단계·보스·쉼터가 있는 방 안에 섰거나, 들어오는 칸에서 그것들로 가는 가장 짧은 길을 제 알아채는 거리 안에서 지켜본다.
 * 모델이 직접 놓은 적(place_field_enemy)도 같은 잣대로 잰다.
 */
export function foeOnStoryWay(project: Project, mapId: string, event: { readonly x: number; readonly y: number; readonly pages?: readonly unknown[] }): boolean {
  const map = project.maps[mapId];
  const things = map ? storyThings(project, mapId).filter((c) => c.x !== event.x || c.y !== event.y) : [];
  if (!map || !things.length) return false;
  if (isStoryRoom(project, mapId)) return true;
  const sight = Math.max(0, ...(event.pages ?? []).map((page) => Number((page as { movement?: { sightRange?: number } }).movement?.sightRange ?? 0)));
  return watchesLane(map, storyLanes(project, mapId, things), event, sight);
}
