import { QUEST_PRESET_IDS } from '@/project/quest/questPresetIds';
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import { canonicalizeCommandFieldAliases } from "@/project/eventCommands/commandFieldAliases";
import { validateEndingPresentation } from "./shapeDatabaseFields";
import { referenceOwner } from "../tilesetReferences";
import { normalizeMapClimate } from "../mapClimate";
import { normalizeSunlight } from "../sunlight";
import { normalizeAiAuthoring } from "../aiAuthoring";
import { normalizeGameDesignBrief } from "../gameDesignBrief";
import { assertGrowthShape } from "@/project/growth/validation";
import { validateSpatialProject } from "../spatial/overviewPairs";
import { validateSpatialAuthoring } from "../spatial/guards";
import { validateAudioDescriptions } from "../audioDescriptions";
import { validateMonsterMetadata } from "../monsterMetadata";
import { validateCharacterGraphicsProject } from "../characterGraphics";
import { villageDesignIssue } from "../villageDesign";
import { EVENT_ANIMATION_TYPES } from "../types";
import type { Project, ProjectV1, ProjectV2 } from "../types";
import { normalizeDatabaseRecords, normalizeSystemRecords } from "../databaseRecordModel";
import { STORY_FLAG_ID_PATTERN } from "../storyFlags";
import { normalizeMapPlanningItems } from "../mapPlanningItems";
import { normalizeWorldCanon } from "../world/canonNormalize";
import { normalizeWorld } from "../world/guards";
import { normalizeProjectFactions } from "../factions";
import type { ProjectWorld } from "../world/types";
import { normalizeWorldGraph } from "../worldGraph";
import { normalizePalettePresetId } from "../tilesetPalette";
import { normalizeFarmAnimalStartInstances } from "../p1FoundationRecords";
import { normalizeFarmBuildingPlacements, normalizeHomeDecorationPlacements } from "../spatialPlacements";
import { HOUSE_TEMPLATE_DEFS } from "../defaults/houseTemplateCatalog";
import { normalizeMapBackground } from "../mapBackground";
import { assert, cloneJson, sanitize, type JsonRecord, requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "./guards";
import { repairProjectReferences, validateProjectReferences } from "./references";
import { validateConditionShape } from "./shapeCommandFields";
import { stampCharacterIdsForSocialEvents } from "../characterIdStamp";
import { normalizeRelief } from "@/project/relief/edit";
import { normalizeDoodadGroups } from "@/project/doodadGroups";
import { normalizeTerrainDesign, normalizeTerrainStamps } from "@/project/terrainDesign";
import { validateCharacters } from "./shapeCharacterFields";
import {
  requirePosition,
  validateAssets,
  validateCommonEvents,
  validateDatabase,
  validateMapTree,
  validateMaps,
  validateMeta,
  validateResourceProfiles,
  validateSession,
  validateSwitches,
  validateSystem,
  validateTileset,
  validateVariables,
} from "./shapeFields";

export function validateProjectV1(data: JsonRecord): ProjectV1 {
  requireNumber("version", data.version);
  requireRecord("meta", data.meta);
  requireRecord("assets", data.assets);
  requireRecord("maps", data.maps);
  requireString("startMapId", data.startMapId);
  requireRecord("startPos", data.startPos);
  requireRecord("flags", data.flags);
  return cloneJson<ProjectV1>(data);
}

export function validateProjectV2(data: JsonRecord): ProjectV2 {
  validateMeta(data.meta);
  validateAssets(data.assets);
  const tilesets = requireRecord("tilesets", data.tilesets);
  for (const [id, tileset] of Object.entries(tilesets)) validateTileset(id, tileset);
  for (const tileset of Object.values(tilesets)) referenceOwner({ tilesets } as unknown as Project, tileset as Project["tilesets"][string]);
  validateSwitches(data.switches);
  validateVariables(data.variables);
  validateStoryFlags(data.storyFlags, idSet(data.switches), idSet(data.variables));
  validateCommonEvents(data.commonEvents);
  const maps = validateMaps(data.maps);

  const mapTree = validateMapTree("mapTree", data.mapTree, new Set(Object.keys(maps)));
  const startMapId = requireString("startMapId", data.startMapId);
  assert(startMapId in maps, "startMapId가 maps에 없습니다.");
  requirePosition("startPos", data.startPos);
  requireRecord("flags", data.flags);
  const project = cloneJson<ProjectV2>(data);
  project.mapTree = mapTree;
  return project;
}

/** 현재(v4) 프로젝트 셰이프 검증. v3 저장본은 migrateV3toV4 가 얼굴 짝을 바꾼 뒤 여기로 들어온다. */
export function validateProjectV4(data: JsonRecord, options?: { readonly adoptParsed?: boolean }): Project {
  const spatialAuthoring = data.spatialAuthoring === undefined ? undefined : validateSpatialAuthoring(data.spatialAuthoring);
  validateAudioDescriptions(data.audioDescriptions);
  validateMonsterMetadata(data.monsterMetadata);
  const project = normalizeProjectV4(data, options?.adoptParsed === true);
  // Spatial authoring is validated against the normalized project before reference
  // repair, so a canonical overview pair cannot be pruned as an unknown reference.
  if (spatialAuthoring !== undefined) {
    validateSpatialProject(spatialAuthoring, project);
    project.spatialAuthoring = spatialAuthoring;
  }
  repairProjectReferences(project);
  validateProjectReferences(project);
  return project;
}

/**
 * Map-patch comparison only: keep shape checks and reference-independent
 * normalization. Defer reference repair as well as validation until the local
 * roots and remote maps are merged, so restored targets keep their callers.
 * This is not a loadable Project; callers must validate the completed candidate.
 */
export function readProjectV4MapMergeSnapshot(data: JsonRecord): Pick<Project, "maps" | "mapTree"> {
  const project = normalizeProjectV4(data);
  return { maps: project.maps, mapTree: project.mapTree };
}

function ownedParsedProject(data: JsonRecord): Project {
  return data as unknown as Project;
}

function normalizeProjectV4(data: JsonRecord, adoptParsed = false): Project {
  assertGrowthShape(data.growth);
  validateMeta(data.meta);
  validateAssets(data.assets);
  validateResourceProfiles(data.resourceProfiles);
  const tilesets = requireRecord("tilesets", data.tilesets);
  for (const [id, tileset] of Object.entries(tilesets)) validateTileset(id, tileset);
  for (const tileset of Object.values(tilesets)) referenceOwner({ tilesets } as unknown as Project, tileset as Project["tilesets"][string]);
  validateSwitches(data.switches);
  validateVariables(data.variables);
  validateCommonEvents(data.commonEvents);
  validateDatabase(data.database);
  validateSystem(data.system);
  validateSession(data.session);
  const maps = validateMaps(data.maps);
  for (const [mapId, rawMap] of Object.entries(maps)) {
    const map = requireRecord(`maps.${mapId}`, rawMap);
    if (map.villageDesignSource === undefined) continue;
    const source = requireRecord(`maps.${mapId}.villageDesignSource`, map.villageDesignSource);
    const preset = requireRecord("villageDesignSource.preset", source.preset);
    requireString("villageDesignSource.preset.id", preset.id);
    requireString("villageDesignSource.preset.name", preset.name);
    const issue = villageDesignIssue(preset.design);
    assert(!issue, `마을 시공 출처: ${issue}`);
    for (const key of ["seed", "houseCount"] as const) {
      const value = requireNumber(`villageDesignSource.${key}`, source[key]);
      assert(Number.isSafeInteger(value) && (key !== "houseCount" || value >= 1 && value <= 32), "마을 시공 출처 수치가 올바르지 않습니다.");
    }
    if (source.resolvedSettings !== undefined) requireRecord("villageDesignSource.resolvedSettings", source.resolvedSettings);
  }
  validateMapConnections(data.mapConnections, new Set(Object.keys(maps)));
  validateVillageInfoDocuments(data.villageInfoDocuments, new Set(Object.keys(maps)));
  validateQuests(data.quests, new Set(Object.keys(maps)));
  validateTestPresets(data.testPresets, new Set(Object.keys(maps)));
  validateEndings(data.endings);
  validateFactions(data.factions);
  validateVillageTemplates(data.villageTemplates);
  validateVillagePresets(data.villagePresets, idSet(data.villageTemplates));
  if (data.defaultVillagePresetId !== undefined) {
    const id = requireString("defaultVillagePresetId", data.defaultVillagePresetId);
    assert(requireArray("villagePresets", data.villagePresets).some(entry => {
      const preset = requireRecord("villagePreset", entry);
      return preset.id === id && preset.design !== undefined;
    }), "기본 마을 설계서를 찾을 수 없습니다.");
  }
  validateCharacters(data.characters);
  const mapTree = validateMapTree("mapTree", data.mapTree, new Set(Object.keys(maps)));
  const startMapId = requireString("startMapId", data.startMapId);
  assert(startMapId in maps, "startMapId가 maps에 없습니다.");
  requirePosition("startPos", data.startPos);
  requireRecord("flags", data.flags);

  // A string from JSON.parse is already a detached tree. Copying it again with
  // JSON.stringify just to satisfy the validator doubles the cost of a heavy load.
  const project = adoptParsed ? ownedParsedProject(data) : cloneJson<Project>(data);
  if (data.aiAuthoring !== undefined) project.aiAuthoring = normalizeAiAuthoring(data.aiAuthoring);
  if (data.gameDesignBrief !== undefined) project.gameDesignBrief = normalizeGameDesignBrief(data.gameDesignBrief);
  project.mapTree = mapTree;
  project.mapConnections ??= [];
  project.villageInfoDocuments ??= [];
  validateCharacterGraphicsProject(project);
  dropLegacyTerrainTemplates(project);
  normalizeEndings(project);
  normalizeStoryFlags(project);
  normalizeProjectPlanningItems(project);
  normalizeProjectMapBackgrounds(project);
  normalizeProjectRelief(project);
  for (const map of Object.values(project.maps)) {
    if (map.sunlight !== undefined) map.sunlight = normalizeSunlight(map.sunlight);
    const climate = normalizeMapClimate(map.climate);
    if (climate) map.climate = climate;
    else delete map.climate;
  }
  normalizeTilesetPalettePresets(project);
  if (data.world !== undefined) project.world = normalizeWorld(data.world);
  if (data.worldCanon !== undefined) {
    const canon = normalizeWorldCanon(data.worldCanon);
    if (canon !== undefined) project.worldCanon = canon;
    else delete project.worldCanon;
  }
  if (data.factions !== undefined) project.factions = normalizeProjectFactions(project.factions);
  if (data.worldGraph !== undefined) project.worldGraph = normalizeWorldGraph(data.worldGraph);
  migrateVillageInfoDocumentsToWorld(project);
  project.database = normalizeDatabaseRecords(project.database);
  project.system = normalizeSystemRecords(project.system);
  if (project.session.farmAnimals !== undefined) {
    project.session.farmAnimals = normalizeFarmAnimalStartInstances(project.session.farmAnimals) ?? [];
  }
  if (project.session.farmBuildingPlacements !== undefined) {
    project.session.farmBuildingPlacements = normalizeFarmBuildingPlacements(project.session.farmBuildingPlacements) ?? [];
  }
  if (project.session.homeDecorationPlacements !== undefined) {
    project.session.homeDecorationPlacements = normalizeHomeDecorationPlacements(project.session.homeDecorationPlacements) ?? [];
  }
  stampCharacterIdsForSocialEvents(project);
  normalizeShopCommands(project);
  canonicalizeProjectCommandFieldAliases(project);
  normalizeEventPageAnimationTypes(project);
  return project;
}

/** 저장본 페이지의 알 수 없는 animationType(예: 2026-09-24 갤러리 "none")은 지워 기본값으로 되돌린다 —
 * 유니온 밖 값이 런타임 canActionTurn 의 exhaustiveness 트립와이어를 때리면 첫 조작에서 씬이 죽고
 * 입력이 전부 죽어 게임이 완주 불능이 된다. 툴 경계(upsert_event)에서 막고, 여기서 기존 저장본을 건진다. */
function normalizeEventPageAnimationTypes(project: Project): void {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      for (const page of event.pages ?? []) {
        // 저장본 JSON 은 유니온을 어길 수 있다 — includes 로 실제 값을 가르고, 기본값은 필드 부재다.
        if (page.animationType !== undefined && !EVENT_ANIMATION_TYPES.includes(page.animationType)) {
          delete page.animationType;
        }
      }
    }
  }
}

/** 저장본에 남은 op↔action 표기 흔들림(예: changeParty op:"+=")을 로드 때 정본으로 옮긴다. */
function canonicalizeProjectCommandFieldAliases(project: Project): void {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      canonicalizeCommandFieldAliases(event.commands);
      for (const page of event.pages ?? []) canonicalizeCommandFieldAliases(page.commands);
    }
  }
  for (const commonEvent of project.commonEvents ?? []) canonicalizeCommandFieldAliases(commonEvent.commands);
  for (const troop of project.database?.troops ?? []) {
    for (const page of troop.battleEventPages ?? []) canonicalizeCommandFieldAliases(page.commands);
    for (const list of troopAfterBattleLists(troop)) canonicalizeCommandFieldAliases(list.commands);
  }
}

function idSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value
    .map((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry) ? (entry as { id?: unknown }).id : undefined)
    .filter((id): id is string => typeof id === "string"));
}

function validateStoryFlags(
  value: unknown,
  switchIds: ReadonlySet<string>,
  variableIds: ReadonlySet<string>
): void {
  if (value === undefined) return;
  const seenIds = new Set<string>();
  const activeTargets = new Set<string>();
  for (const [index, entry] of requireArray("storyFlags", value).entries()) {
    const flag = requireRecord(`storyFlags[${index}]`, entry);
    const id = requireString(`storyFlags[${index}].id`, flag.id);
    assert(STORY_FLAG_ID_PATTERN.test(id), `storyFlags[${index}].id는 kebab-case 슬러그여야 합니다: ${id}`);
    assert(!seenIds.has(id), `storyFlags id가 중복됩니다: ${id}`);
    seenIds.add(id);
    const kind = requireString(`storyFlags[${index}].kind`, flag.kind);
    assert(kind === "switch" || kind === "variable", `storyFlags[${index}].kind는 switch 또는 variable이어야 합니다.`);
    const targetId = requireString(`storyFlags[${index}].targetId`, flag.targetId);
    const targetIds = kind === "switch" ? switchIds : variableIds;
    assert(targetIds.has(targetId), `storyFlags[${index}].targetId가 존재하지 않습니다: ${kind}:${targetId}`);
    requireString(`storyFlags[${index}].description`, flag.description);
    if (flag.questId !== undefined) requireString(`storyFlags[${index}].questId`, flag.questId);
    if (flag.tags !== undefined) {
      for (const [tagIndex, tag] of requireArray(`storyFlags[${index}].tags`, flag.tags).entries()) {
        requireString(`storyFlags[${index}].tags[${tagIndex}]`, tag);
      }
    }
    if (flag.retired !== undefined) requireBoolean(`storyFlags[${index}].retired`, flag.retired);
    if (flag.retired === true) continue;
    const targetKey = `${kind}:${targetId}`;
    assert(!activeTargets.has(targetKey), `활성 storyFlags target이 중복됩니다: ${targetKey}`);
    activeTargets.add(targetKey);
  }
}

/**
 * 맵별 보존 기획 항목 정리. 항목이 하나도 안 남으면 필드 자체를 지워 옛 프로젝트 JSON 이
 * 바이트 그대로 유지되게 한다(스키마 버전 상승 불필요한 추가 필드).
 */
function normalizeProjectPlanningItems(project: Project): void {
  for (const map of Object.values(project.maps)) {
    if (map.planningItems === undefined) continue;
    const normalized = normalizeMapPlanningItems(map.planningItems);
    if (normalized) map.planningItems = normalized;
    else delete map.planningItems;
  }
}

/** 높이 지형 정리 — 맵 크기에 맞추고 0~14단으로 자른다. 전부 평지거나 모양이 틀리면 필드를 지운다. */
function normalizeProjectRelief(project: Project): void {
  const stamps = normalizeTerrainStamps(project.terrainStamps);
  if (stamps) project.terrainStamps = stamps; else delete project.terrainStamps;
  for (const map of Object.values(project.maps)) {
    const design = normalizeTerrainDesign(map.terrainDesign, map.width * map.height);
    if (design) map.terrainDesign = design; else delete map.terrainDesign;
    const groups=normalizeDoodadGroups(map.doodadGroups,map.width*map.height);
    if(groups)map.doodadGroups=groups;else delete map.doodadGroups;
    if (map.relief === undefined) continue;
    const normalized = normalizeRelief(map.relief, map.width, map.height);
    if (normalized) map.relief = normalized;
    else delete map.relief;
  }
}

/**
 * 맵 배경 정리 — 범위를 벗어난 스크롤 속도만 클램프하고, 저작이 «켜 둔» 빈 상태는 남긴다.
 * 규칙은 `@/project/mapBackground` 한 곳에 있다(편집기 입력·AI 툴 스키마와 같은 상한).
 */
function normalizeProjectMapBackgrounds(project: Project): void {
  for (const map of Object.values(project.maps)) {
    if (map.background === undefined) continue;
    const normalized = normalizeMapBackground(map.background);
    if (normalized) map.background = normalized;
    else delete map.background;
  }
}

function normalizeStoryFlags(project: Project): void {
  if (!project.storyFlags) return;
  project.storyFlags = project.storyFlags.map((flag) => {
    const questId = flag.questId?.trim();
    const tags = [...new Set((flag.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0))];
    return {
      id: flag.id.trim().toLowerCase(),
      kind: flag.kind,
      targetId: flag.targetId.trim(),
      description: flag.description.trim(),
      ...(questId ? { questId } : {}),
      ...(tags.length > 0 ? { tags } : {}),
      ...(flag.retired === true ? { retired: true } : {}),
    };
  });
}

function validateEndings(value: unknown): void {
  if (value === undefined) return;
  for (const [index, entry] of requireArray("endings", value).entries()) {
    const ending = requireRecord(`endings[${index}]`, entry);
    requireString(`endings[${index}].id`, ending.id);
    requireString(`endings[${index}].name`, ending.name);
    for (const [conditionIndex, condition] of requireArray(`endings[${index}].conditions`, ending.conditions).entries()) {
      const label = `endings[${index}].conditions[${conditionIndex}]`;
      if ((condition as { kind?: unknown } | null)?.kind === "newGamePlus") {
        requireBoolean(`${label}.value`, requireRecord(label, condition).value);
        continue;
      }
      validateConditionShape(label, condition);
      const kind = (condition as { kind?: unknown }).kind;
      assert(kind === "switch" || kind === "variable", `${label}는 switch, variable 또는 newGamePlus 조건이어야 합니다.`);
    }
    if (ending.presentation !== undefined) validateEndingPresentation(ending.presentation, `endings[${index}].presentation`);
    if (ending.priority !== undefined) requireNumber(`endings[${index}].priority`, ending.priority);
    if (ending.epilogue !== undefined) {
      for (const [beatIndex, beat] of requireArray(`endings[${index}].epilogue`, ending.epilogue).entries()) {
        requireRecord(`endings[${index}].epilogue[${beatIndex}]`, beat);
      }
    }
  }
}

function validateFactions(value: unknown): void {
  if (value === undefined) return;
  const factions = requireRecord("factions", value);
  if (factions.playerKillReputation !== undefined) {
    const reputation = requireRecord("factions.playerKillReputation", factions.playerKillReputation);
    if (reputation.weight !== undefined) {
      const weight = requireNumber("factions.playerKillReputation.weight", reputation.weight);
      assert(weight >= 0, "factions.playerKillReputation.weight는 0 이상이어야 합니다.");
    }
  }
  for (const [index, entry] of requireArray("factions.defs", factions.defs).entries()) {
    const def = requireRecord(`factions.defs[${index}]`, entry);
    requireString(`factions.defs[${index}].id`, def.id);
    requireString(`factions.defs[${index}].name`, def.name);
    if (def.worldEntityId !== undefined) {
      requireString(`factions.defs[${index}].worldEntityId`, def.worldEntityId);
    }
    if (def.color !== undefined) requireString(`factions.defs[${index}].color`, def.color);
    if (def.aggression !== undefined) requireNumber(`factions.defs[${index}].aggression`, def.aggression);
  }
  for (const [index, entry] of requireArray("factions.relations", factions.relations).entries()) {
    const relation = requireRecord(`factions.relations[${index}]`, entry);
    requireString(`factions.relations[${index}].a`, relation.a);
    requireString(`factions.relations[${index}].b`, relation.b);
    requireNumber(`factions.relations[${index}].stance`, relation.stance);
  }
}

function normalizeEndings(project: Project): void {
  if (!project.endings) return;
  project.endings = project.endings.map((ending) => ({
    ...ending,
    priority: Number.isFinite(ending.priority) ? Math.trunc(ending.priority) : 0,
    conditions: [...ending.conditions],
    epilogue: ending.epilogue ? [...ending.epilogue] : undefined,
  }));
}

function dropLegacyTerrainTemplates(project: Project): void {
  for (const tileset of Object.values(project.tilesets)) {
    delete (tileset as { terrainTemplates?: unknown }).terrainTemplates;
  }
}

function normalizeTilesetPalettePresets(project: Project): void {
  for (const tileset of Object.values(project.tilesets)) {
    if (tileset.palettePresets === undefined) continue;
    const usedIds = new Set<string>();
    for (const preset of tileset.palettePresets) {
      const base = normalizePalettePresetId(preset.id);
      let id = base;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${base}_${suffix}`;
        suffix += 1;
      }
      if (preset.id !== id) preset.id = id;
      usedIds.add(id);
    }
  }
}

function migrateVillageInfoDocumentsToWorld(project: Project): void {
  const docs = project.villageInfoDocuments ?? [];
  if (docs.length === 0) return;
  const current = project.world ?? { entities: [], relations: [] };
  if (!worldIsEmpty(current)) return;

  const entities: ProjectWorld["entities"][number][] = [];
  const usedIds = new Set<string>();
  const placeMapIds = new Set<string>();
  for (const entity of current.entities) {
    entities.push(entity);
    usedIds.add(entity.id);
    if (entity.type !== "place") continue;
    for (const ref of entity.refs ?? []) {
      if (ref.kind === "map") placeMapIds.add(ref.id);
    }
  }

  for (const doc of docs) {
    if (placeMapIds.has(doc.mapId)) continue;
    const entity = {
      id: nextVillageWorldId(doc.id, usedIds),
      type: "place" as const,
      name: doc.title,
      summary: firstMarkdownLine(doc.markdown) || doc.title,
      body: doc.markdown,
      refs: [{ kind: "map" as const, id: doc.mapId }],
      origin: "user" as const,
    };
    entities.push(entity);
    usedIds.add(entity.id);
    placeMapIds.add(doc.mapId);
  }

  if (entities.length > current.entities.length) {
    project.world = normalizeWorld({ entities, relations: current.relations });
  }
}

function worldIsEmpty(world: ProjectWorld): boolean {
  return world.entities.length === 0;
}

function nextVillageWorldId(documentId: string, usedIds: Set<string>): string {
  const base = `w_village_${sanitize(documentId)}`;
  let id = base;
  let index = 2;
  while (usedIds.has(id)) {
    id = `${base}_${index}`;
    index += 1;
  }
  return id;
}

function firstMarkdownLine(markdown: string): string {
  return markdown.split(/\r?\n/u).map((line) => line.trim()).find((line) => line.length > 0) ?? "";
}

function validateVillageInfoDocuments(value: unknown, mapIds: ReadonlySet<string>): void {
  if (value === undefined) return;
  assert(Array.isArray(value), "villageInfoDocuments는 배열이어야 합니다.");
  for (const [index, entry] of value.entries()) {
    const document = requireRecord(`villageInfoDocuments[${index}]`, entry);
    requireString(`villageInfoDocuments[${index}].id`, document.id);
    const mapId = requireString(`villageInfoDocuments[${index}].mapId`, document.mapId);
    assert(mapIds.has(mapId), `villageInfoDocuments[${index}].mapId가 존재하지 않는 맵입니다: ${mapId}`);
    requireString(`villageInfoDocuments[${index}].title`, document.title);
    requireString(`villageInfoDocuments[${index}].markdown`, document.markdown);
  }
}

// 퀘스트 정의(선언적 메타). step형은 questCompiler가, graph형은 questGraph가 상세 검증한다.
function validateQuests(value: unknown, mapIds: ReadonlySet<string>): void {
  if (value === undefined) return;
  assert(Array.isArray(value), "quests는 배열이어야 합니다.");
  for (const [index, entry] of value.entries()) {
    const quest = requireRecord(`quests[${index}]`, entry);
    if (quest.kind === "graph") {
      requireString(`quests[${index}].id`, quest.id);
      requireString(`quests[${index}].title`, quest.title);
      if (quest.summary !== undefined) requireString(`quests[${index}].summary`, quest.summary);
      assert(Array.isArray(quest.nodes), `quests[${index}].nodes는 배열이어야 합니다.`);
      assert(Array.isArray(quest.edges), `quests[${index}].edges는 배열이어야 합니다.`);
      continue;
    }
    requireString(`quests[${index}].key`, quest.key);
    requireString(`quests[${index}].title`, quest.title);
    requireString(`quests[${index}].summary`, quest.summary);
    if (quest.presetId !== undefined) {
      const presetId = requireString(`quests[${index}].presetId`, quest.presetId);
      assert((QUEST_PRESET_IDS as readonly string[]).includes(presetId), `quests[${index}].presetId가 올바르지 않습니다.`);
    }
    if (quest.dialogue !== undefined) {
      const dialogue = requireRecord(`quests[${index}].dialogue`, quest.dialogue);
      for (const key of ['accepted', 'declined', 'reminder', 'completed', 'afterComplete']) {
        if (dialogue[key] !== undefined) requireString(`quests[${index}].dialogue.${key}`, dialogue[key]);
      }
    }
    if (quest.order !== undefined) assert(quest.order === 'sequence' || quest.order === 'any', `quests[${index}].order가 올바르지 않습니다.`);
    if (quest.repeatable !== undefined) requireBoolean(`quests[${index}].repeatable`, quest.repeatable);
    const kinds = ['talk','collect','kill','reach','inspect','deliver','choice','escort','craft'];
    if (quest.blueprint !== undefined) {
      assert(Array.isArray(quest.blueprint), `quests[${index}].blueprint는 배열이어야 합니다.`);
      quest.blueprint.forEach((kind, i) => assert(kinds.includes(requireString(`quests[${index}].blueprint[${i}]`, kind)), '올바르지 않은 목표 종류입니다.'));
    }
    if (quest.requiresQuestKeys !== undefined) {
      assert(Array.isArray(quest.requiresQuestKeys), `quests[${index}].requiresQuestKeys는 배열이어야 합니다.`);
      quest.requiresQuestKeys.forEach((key, i) => requireString(`quests[${index}].requiresQuestKeys[${i}]`, key));
    }
    for (const name of ['onAcceptItems','worldChanges']) if (quest[name] !== undefined) assert(Array.isArray(quest[name]), `quests[${index}].${name}는 배열이어야 합니다.`);
    if (quest.effects !== undefined) requireRecord(`quests[${index}].effects`, quest.effects);
    assert(Array.isArray(quest.steps), `quests[${index}].steps는 배열이어야 합니다.`);
    quest.steps.forEach((raw, i) => {
      const step = requireRecord(`quests[${index}].steps[${i}]`, raw);
      assert(kinds.includes(requireString(`quests[${index}].steps[${i}].kind`, step.kind)), '올바르지 않은 목표 종류입니다.');
      if (step.label !== undefined) requireString(`quests[${index}].steps[${i}].label`, step.label);
      if (step.timePhase !== undefined) assert(['morning','day','evening','night'].includes(requireString(`quests[${index}].steps[${i}].timePhase`, step.timePhase)), '올바르지 않은 시간대입니다.');
    });
    // giver가 기존 이벤트 참조면 맵 존재를 확인(생성형이면 컴파일 시 생성되므로 생략).
    const giver = quest.giver as { mapId?: unknown } | undefined;
    if (giver && typeof giver.mapId === "string") {
      assert(mapIds.has(giver.mapId), `quests[${index}].giver.mapId가 존재하지 않는 맵입니다: ${giver.mapId}`);
    }
  }
}

// 테스트 상태 프리셋(Phase 4-1). optional. 최상위 형태와 참조 맵 존재만 검증한다.
function validateTestPresets(value: unknown, mapIds: ReadonlySet<string>): void {
  if (value === undefined) return;
  assert(Array.isArray(value), "testPresets는 배열이어야 합니다.");
  for (const [index, entry] of value.entries()) {
    const preset = requireRecord(`testPresets[${index}]`, entry);
    requireString(`testPresets[${index}].id`, preset.id);
    requireString(`testPresets[${index}].name`, preset.name);
    if (preset.switches !== undefined) requireRecord(`testPresets[${index}].switches`, preset.switches);
    if (preset.variables !== undefined) requireRecord(`testPresets[${index}].variables`, preset.variables);
    if (preset.inventory !== undefined) requireRecord(`testPresets[${index}].inventory`, preset.inventory);
    if (preset.gold !== undefined) requireNumber(`testPresets[${index}].gold`, preset.gold);
    if (preset.startMapId !== undefined) {
      const mapId = requireString(`testPresets[${index}].startMapId`, preset.startMapId);
      assert(mapIds.has(mapId), `testPresets[${index}].startMapId가 존재하지 않는 맵입니다: ${mapId}`);
    }
    if (preset.startPos !== undefined) requirePosition(`testPresets[${index}].startPos`, preset.startPos);
  }
}

function validateMapConnections(value: unknown, mapIds: ReadonlySet<string>): void {
  if (value === undefined) return;
  assert(Array.isArray(value), "mapConnections는 배열이어야 합니다.");
  const connections = value;
  for (const [index, entry] of connections.entries()) {
    const connection = requireRecord(`mapConnections[${index}]`, entry);
    requireString(`mapConnections[${index}].id`, connection.id);
    if (connection.name !== undefined) requireString(`mapConnections[${index}].name`, connection.name);
    validateEndpoint(`mapConnections[${index}].from`, connection.from, mapIds);
    validateEndpoint(`mapConnections[${index}].to`, connection.to, mapIds);
    requireBoolean(`mapConnections[${index}].playerEnabled`, connection.playerEnabled);
    requireBoolean(`mapConnections[${index}].npcEnabled`, connection.npcEnabled);
  }
}

function validateEndpoint(label: string, value: unknown, mapIds: ReadonlySet<string>): void {
  const endpoint = requireRecord(label, value);
  const mapId = requireString(`${label}.mapId`, endpoint.mapId);
  assert(mapIds.has(mapId), `${label}.mapId가 존재하지 않는 맵입니다: ${mapId}`);
  requireNumber(`${label}.x`, endpoint.x);
  requireNumber(`${label}.y`, endpoint.y);
  if (endpoint.direction !== undefined) {
    const direction = requireString(`${label}.direction`, endpoint.direction);
    assert(direction === "left" || direction === "right" || direction === "up" || direction === "down", `${label}.direction이 잘못되었습니다.`);
  }
}

function normalizeShopCommands(project: Project): void {
  const normalize = (commands: unknown[]) => {
    for (const raw of commands) {
      const cmd = raw as Record<string, unknown>;
      if (cmd?.kind !== "shop") continue;
      // allowSell → shopType 마이그레이션 (구 저장본 호환)
      if (cmd.shopType === undefined && typeof cmd.allowSell === "boolean") {
        cmd.shopType = cmd.allowSell ? "normal" : "buyOnly";
      }
      // 레거시 명령에 새 분기 필드 기본값 주입
      if (cmd.branchOnTransaction === undefined) cmd.branchOnTransaction = false;
      if (cmd.transactionBranch === undefined) cmd.transactionBranch = [];
      if ((cmd as Record<string, unknown>).branchOnFailedTransaction === undefined) (cmd as Record<string, unknown>).branchOnFailedTransaction = false;
      if ((cmd as Record<string, unknown>).failedTransactionBranch === undefined) (cmd as Record<string, unknown>).failedTransactionBranch = [];
      // stock ↔ itemIds 이중기록 해소: stock orphan 제거 + 순서 정렬
      if (Array.isArray(cmd.stock) && Array.isArray(cmd.itemIds)) {
        const ids = new Set(cmd.itemIds as string[]);
        const filtered = (cmd.stock as { itemId: string }[]).filter((e) => ids.has(e.itemId));
        const byId = new Map(filtered.map((e) => [e.itemId, e] as const));
        const ordered = (cmd.itemIds as string[]).map((id) => byId.get(id)).filter(Boolean) as typeof filtered;
        cmd.stock = ordered.length > 0 ? ordered : undefined;
      }
    }
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      for (const page of event.pages ?? []) normalize(page.commands as unknown[]);
    }
  }
  for (const ce of project.commonEvents ?? []) normalize(ce.commands as unknown[]);
}

/**
 * 사용자가 「마을」탭에서 만든 집 형태를 검사한다.
 *
 * 이 배열은 **전부 사용자 저작**이다(내장 34종은 코드 카탈로그가 정본이고 프로젝트에 복사되지
 * 않는다). 그런데 검증이 없으면 잘못된 값이 조용히 로드된 뒤 탭을 열거나 시공기가 읽는 순간
 * TypeError 로 터진다 — 사용자는 "저장은 됐는데 열면 죽는 프로젝트"를 갖게 되고, 어디가
 * 문제인지 알 수 없다. 로드 지점에서 필드 이름과 함께 막는 것이 낫다.
 *
 * 열거형(kitId·pathStyle 같은 문자열)은 값을 좁히지 않는다 — types 레이어가 editor 레이어를
 * import 하지 않는다는 계약이 있고, 읽는 쪽이 좁히도록 설계됐다. 여기서 막는 것은 **모양**이다.
 */
/** 내장 34종 id. 프리셋 화이트리스트가 이 id 를 가리키는 것은 정상이다(카탈로그가 정본). */
const BUILT_IN_HOUSE_TEMPLATE_IDS: ReadonlySet<string> = new Set(HOUSE_TEMPLATE_DEFS.map((def) => def.id));

function validateVillageTemplates(value: unknown): void {
  if (value === undefined) return;
  for (const [index, entry] of requireArray("villageTemplates", value).entries()) {
    const label = `villageTemplates[${index}]`;
    const template = requireRecord(label, entry);
    requireString(`${label}.id`, template.id);
    requireString(`${label}.name`, template.name);
    // w/h 는 후보 슬롯 폭 필터에 쓰인다. 0 이나 음수면 배치 루프가 후보를 영원히 못 찾거나
    // 음수 폭으로 타일 인덱스를 계산해 맵 밖을 쓴다.
    for (const key of ["w", "h"] as const) {
      const n = requireNumber(`${label}.${key}`, template[key]);
      assert(Number.isInteger(n) && n >= 1 && n <= 64, `${label}.${key}는 1~64 정수여야 합니다.`);
    }
    if (template.stories !== undefined) {
      const stories = requireNumber(`${label}.stories`, template.stories);
      assert(stories === 1 || stories === 2 || stories === 3, `${label}.stories는 1·2·3 중 하나여야 합니다.`);
    }
    if (template.lowWall !== undefined) requireBoolean(`${label}.lowWall`, template.lowWall);
    if (template.roofDeck !== undefined) requireBoolean(`${label}.roofDeck`, template.roofDeck);
    if (template.kitId !== undefined) requireString(`${label}.kitId`, template.kitId);
    if (template.clonedFrom !== undefined) requireString(`${label}.clonedFrom`, template.clonedFrom);
    if (template.note !== undefined) requireString(`${label}.note`, template.note);
    // 날개가 비면 집이 아니다 — 전개 함수가 빈 사각형 목록으로 문 판정을 하다 죽는다.
    const wings = requireArray(`${label}.wings`, template.wings);
    assert(wings.length >= 1, `${label}.wings는 최소 한 개여야 합니다.`);
    for (const [wingIndex, wingEntry] of wings.entries()) {
      const wingLabel = `${label}.wings[${wingIndex}]`;
      const wing = requireRecord(wingLabel, wingEntry);
      for (const key of ["x", "y"] as const) {
        const n = requireNumber(`${wingLabel}.${key}`, wing[key]);
        assert(Number.isInteger(n), `${wingLabel}.${key}는 정수여야 합니다.`);
      }
      for (const key of ["w", "h"] as const) {
        const n = requireNumber(`${wingLabel}.${key}`, wing[key]);
        assert(Number.isInteger(n) && n >= 1, `${wingLabel}.${key}는 1 이상 정수여야 합니다.`);
      }
    }
  }
}

/**
 * 마을 배치 프리셋을 검사한다. 예전엔 씨앗값으로 몰래 정해졌던 값들의 이름 붙은 묶음이다.
 *
 * `templateIds` 는 이 프리셋이 쓸 집 형태 화이트리스트다. 없는 id 를 가리키면 카탈로그가
 * 통째로 걸러져 후보가 0 이 되고, 시공기는 "집을 못 놓았다"로 중단한다 — 사용자 눈에는
 * 이유 없는 실패다. 그래서 시공 후보 집합과 대조한다.
 *
 * 후보는 **내장 34종 + 저작 형태** 다. 예전엔 저작 형태만 봤는데, 화면의 화이트리스트 고르기
 * (`db-village-preset-template-picker`)는 카탈로그 전체를 체크박스로 내주고 하네스
 * (`villageTemplateCatalog`)도 내장 id 를 그대로 받는다 — 그래서 사용자가 「작은 집」을 골라
 * 저장하면 그 프로젝트 파일이 다음 열기에서 ProjectFormatError 로 튕겼다.
 */
function validateVillagePresets(value: unknown, templateIds: ReadonlySet<string>): void {
  if (value === undefined) return;
  for (const [index, entry] of requireArray("villagePresets", value).entries()) {
    const label = `villagePresets[${index}]`;
    const preset = requireRecord(label, entry);
    if (preset.design !== undefined) {
      const issue = villageDesignIssue(preset.design);
      assert(!issue, `${label}: ${issue}`);
    }
    requireString(`${label}.id`, preset.id);
    requireString(`${label}.name`, preset.name);
    for (const [key, min, max] of [
      ["houseCount", 1, 32],
      ["roadWidth", 2, 3],
      ["roadNaturalness", 0.35, 1],
      ["npcCount", 0, 512],
    ] as const) {
      if (preset[key] === undefined) continue;
      const n = requireNumber(`${label}.${key}`, preset[key]);
      assert(Number.isFinite(n) && n >= min && n <= max, `${label}.${key}는 ${min}~${max} 사이여야 합니다.`);
    }
    for (const key of [
      "pathStyle",
      "settlementLayout",
      "kitMix",
      "yardStyle",
      "plazaStyle",
      "plazaLayout",
      "edgeTrees",
      "groundTheme",
      "note",
    ] as const) {
      if (preset[key] !== undefined) requireString(`${label}.${key}`, preset[key]);
    }
    if (preset.templateIds !== undefined) {
      for (const [idIndex, id] of requireArray(`${label}.templateIds`, preset.templateIds).entries()) {
        const templateId = requireString(`${label}.templateIds[${idIndex}]`, id);
        assert(
          templateIds.has(templateId) || BUILT_IN_HOUSE_TEMPLATE_IDS.has(templateId),
          `${label}.templateIds[${idIndex}]가 내장 형태에도 villageTemplates에도 없습니다: ${templateId}`,
        );
      }
    }
  }
}
