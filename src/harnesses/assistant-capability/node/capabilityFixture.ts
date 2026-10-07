import { createBlankProject } from '../../../project/defaults';
import { createBlankMap } from '../../../project/defaults/defaultMaps';
import { DEFAULT_TILESET_ID } from '../../../project/defaults/constants';
import type { GameEvent, Project } from '../../../project/types';
import emberEvents from './emberFixtureEvents.json' with { type: 'json' };

/**
 * 조수 기능 검증의 시작 프로젝트. 예전에는 《잿불의 유산》 데모(합본 마을 칩셋)를 통째로 만들었지만
 * 2026-10-07 저작권 정리로 그 데모와 칩셋을 지웠다. 과제가 쓰는 NPC 네 개(꼬마 미루·여관 주인 마사·
 * 경비·동문)만 `emberFixtureEvents.json` 에 떠 두고, 빈 프로젝트의 기본 칩셋(버들항) 맵에 올린다.
 */
export const CAPABILITY_MAP_ID = 'map_ember_village';

export function fixtureEvent(id: string): GameEvent {
  const event = (emberEvents as unknown as GameEvent[]).find(value => value.id === id);
  if (!event) throw Error(`fixture event 없음: ${id}`);
  return structuredClone(event);
}

export function createCapabilityFixtureProject(): Project {
  const project = createBlankProject();
  const map = createBlankMap('잿불 마을', 24, 18, DEFAULT_TILESET_ID);
  map.id = CAPABILITY_MAP_ID;
  // 동문(ev_ember_gate_a)은 지운 숲 맵으로 가므로 맵에 올리지 않는다 — 재진입 문 견본으로만 fixtureEvent() 로 꺼낸다.
  map.events = (emberEvents as unknown as GameEvent[]).filter(event => event.id !== 'ev_ember_gate_a').map(event => structuredClone(event));
  const oldStart = project.startMapId;
  project.maps[map.id] = map;
  project.startMapId = map.id;
  project.mapTree = { mapId: map.id, children: oldStart && oldStart !== map.id ? [{ mapId: oldStart, children: [] }] : [] };
  for (const id of ['sw_ember_q1_started', 'sw_ember_q1_clear']) {
    if (!project.switches.some(entry => entry.id === id)) project.switches.push({ id, name: id });
    project.session.switches[id] = false;
  }
  return project;
}
