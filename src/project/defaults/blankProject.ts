// 프로젝트 생성의 **가벼운 핵심**. defaultProject.ts 에서 떼어낸 이유는 성능이다.
//
// defaultProject.ts 에는 쇼케이스·데모 프로젝트 빌더 18개가 함께 있고, 그것들이
// `@/editor/content/townShowcaseMaps` → dbExtractedHouseTemplate → houseKit ↔ houseInteriors
// (에디터 인테리어 파이프라인 전체)를 끈다. ESM 은 파일 단위로 평가되므로 `createBlankProject`
// 하나만 쓰는 테스트도 그 전부를 다시 평가했다 — 그런 테스트가 1,259개다.
// 실측(2026-09-17): `@/project/defaults` 배럴 335모듈·6.8MB·파일당 collect 1.40 s
// → 이 분리 + defaultMaps 통과 re-export 제거로 162모듈·0.87 s.
//
// 여기에는 **에디터를 끌지 않는 것만** 둔다. 새 데모/쇼케이스 빌더는 defaultProject.ts 로.
import type { CommonEvent, GameMap, MapId, Project, SwitchDef, VariableDef } from "../types";
import { SCHEMA_VERSION } from "../types";
import { DEFAULT_ACTOR_ID } from "./constants";
import { FOREST_HARMONY_ID } from "./forestHarmony";
import { defaultAssetSet, defaultResourceProfiles, defaultTilesets } from "./defaultAssets";
import { defaultDatabase, defaultSession, defaultSystem, defaultTerms } from "./defaultDatabase";
import { defaultOpeningSequence } from "./defaultOpeningSequence";
import { createBlankMap, createStarterMap, singleNodeTree } from "./defaultMaps";
import { ensureItemSwitchDefs } from "@/project/itemSwitchDefs";
import { repairLegacyRateKeys } from "./legacyRateKeyRepair";
import { repairUnplayableSystemBgm } from "./legacyAudioRepair";

const BLANK_PROJECT_START_MAP_ID = "map_blank_start";
const BLANK_PROJECT_MAP_WIDTH = 20;
const BLANK_PROJECT_MAP_HEIGHT = 15;

// One classic picker block keeps first-use command forms immediately usable. This is
// starter capacity, not a maximum: add/range actions grow the arrays on demand.
const INITIAL_SWITCH_VARIABLE_SLOT_COUNT = 20;

function initialDefinitionSlots(prefix: "sw" | "var"): { id: string; name: string }[] {
  return Array.from({ length: INITIAL_SWITCH_VARIABLE_SLOT_COUNT }, (_, index) => ({
    id: `${prefix}_${String(index + 1).padStart(4, "0")}`,
    name: "",
  }));
}

export function ensureSwitchVariableSlots(project: Project): boolean {
  // 스위치 아이템이 켜는 스위치는 항상 정의가 존재해야 한다 — 없으면 저작자가
  // 스위치 탭에서 후속 조건을 연결할 방법이 없다(기본 카탈로그 기동석 11종 참조).
  const itemSwitchDefsChanged = ensureItemSwitchDefs(project);
  const switchesChanged = ensureDefinitionSlots({
    defs: project.switches,
    session: project.session.switches,
    defaultValue: false,
  });
  const variablesChanged = ensureDefinitionSlots({
    defs: project.variables,
    session: project.session.variables,
    defaultValue: 0,
  });
  return itemSwitchDefsChanged || switchesChanged || variablesChanged;
}

function ensureDefinitionSlots<TValue>(options: {
  readonly defs: { id: string; name: string }[];
  readonly session: Record<string, TValue>;
  readonly defaultValue: TValue;
}): boolean {
  const { defs, session, defaultValue } = options;
  let changed = false;
  const ids = new Set(defs.map((entry) => entry.id));
  for (const id of Object.keys(session).sort()) {
    if (ids.has(id)) continue;
    defs.push({ id, name: "" });
    ids.add(id);
    changed = true;
  }

  for (const { id } of defs) {
    if (Object.prototype.hasOwnProperty.call(session, id)) continue;
    session[id] = defaultValue;
    changed = true;
  }

  return changed;
}

export function createProjectWithMaps(starters: readonly GameMap[], selectedIndex: number): Project {
  const starter = starters[Math.max(0, Math.min(selectedIndex, starters.length - 1))] ?? createStarterMap();
  const startMapId: MapId = starter.id;
  const switches: SwitchDef[] = initialDefinitionSlots("sw");
  const variables: VariableDef[] = initialDefinitionSlots("var");
  const commonEvents: CommonEvent[] = [];
  const maps = Object.fromEntries(starters.map((map) => [map.id, map])) as Record<MapId, GameMap>;
  const project: Project = {
    version: SCHEMA_VERSION,
    meta: { title: "새 프로젝트", author: "", terms: defaultTerms() },
    assets: defaultAssetSet(),
    resourceProfiles: defaultResourceProfiles(),
    tilesets: defaultTilesets(),
    switches,
    variables,
    commonEvents,
    database: defaultDatabase(),
    system: defaultSystem(),
    session: defaultSession(),
    maps,
    mapConnections: [],
    mapTree: {
      mapId: startMapId,
      children: starters.filter((map) => map.id !== startMapId).map((map) => singleNodeTree(map.id)),
    },
    startMapId,
    startPos: {
      x: Math.floor(starter.width / 2),
      y: Math.floor(starter.height / 2) + 1,
    },
    flags: {},
    villageInfoDocuments: [],
  };
  ensureSwitchVariableSlots(project);
  // 낡은 export 잔재 정리 — 적 elementRates 의 state_death 등(legacyRateKeyRepair.ts 주석 참조).
  repairLegacyRateKeys(project);
  // 재생 불가 BGM(MIDI) 참조 교체 — 픽스처는 defaultSystem() 변경이 닿지 않는다.
  repairUnplayableSystemBgm(project);
  return project;
}

export function createBlankProject(): Project {
  const map = createBlankMap("빈 맵", BLANK_PROJECT_MAP_WIDTH, BLANK_PROJECT_MAP_HEIGHT, FOREST_HARMONY_ID);
  map.id = BLANK_PROJECT_START_MAP_ID;
  const project = createProjectWithMaps([map], 0);
  project.system = { ...project.system, startActorIds: [DEFAULT_ACTOR_ID] };
  project.system.opening = defaultOpeningSequence();
  project.session = { ...project.session, partyActorIds: [DEFAULT_ACTOR_ID] };
  return project;
}
