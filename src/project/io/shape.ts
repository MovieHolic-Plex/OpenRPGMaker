import type { Project, ProjectV1, ProjectV2 } from "../types";
import { normalizeDatabaseRecords, normalizeSystemRecords } from "../databaseRecordModel";
import { STORY_FLAG_ID_PATTERN } from "../storyFlags";
import { normalizeWorld } from "../world/guards";
import type { ProjectWorld } from "../world/types";
import { normalizeWorldGraph } from "../worldGraph";
import { normalizePalettePresetId } from "../tilesetPalette";
import { normalizeFarmAnimalStartInstances } from "../p1FoundationRecords";
import { normalizeFarmBuildingPlacements, normalizeHomeDecorationPlacements } from "../spatialPlacements";
import { assert, cloneJson, sanitize, type JsonRecord, requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "./guards";
import { repairProjectReferences, validateProjectReferences } from "./references";
import { validateConditionShape } from "./shapeCommandFields";
import { stampCharacterIdsForSocialEvents } from "../characterIdStamp";
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
export function validateProjectV4(data: JsonRecord): Project {
  validateMeta(data.meta);
  validateAssets(data.assets);
  validateResourceProfiles(data.resourceProfiles);
  const tilesets = requireRecord("tilesets", data.tilesets);
  for (const [id, tileset] of Object.entries(tilesets)) validateTileset(id, tileset);
  validateSwitches(data.switches);
  validateVariables(data.variables);
  validateCommonEvents(data.commonEvents);
  validateDatabase(data.database);
  validateSystem(data.system);
  validateSession(data.session);
  const maps = validateMaps(data.maps);
  validateMapConnections(data.mapConnections, new Set(Object.keys(maps)));
  validateVillageInfoDocuments(data.villageInfoDocuments, new Set(Object.keys(maps)));
  validateQuests(data.quests, new Set(Object.keys(maps)));
  validateTestPresets(data.testPresets, new Set(Object.keys(maps)));
  validateEndings(data.endings);
  validateCharacters(data.characters);
  const mapTree = validateMapTree("mapTree", data.mapTree, new Set(Object.keys(maps)));
  const startMapId = requireString("startMapId", data.startMapId);
  assert(startMapId in maps, "startMapId가 maps에 없습니다.");
  requirePosition("startPos", data.startPos);
  requireRecord("flags", data.flags);

  const project = cloneJson<Project>(data);
  project.mapTree = mapTree;
  project.mapConnections ??= [];
  project.villageInfoDocuments ??= [];
  dropLegacyTerrainTemplates(project);
  normalizeEndings(project);
  normalizeStoryFlags(project);
  normalizeTilesetPalettePresets(project);
  if (data.world !== undefined) project.world = normalizeWorld(data.world);
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
  repairProjectReferences(project);
  validateProjectReferences(project);
  return project;
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
      validateConditionShape(`endings[${index}].conditions[${conditionIndex}]`, condition);
      const kind = (condition as { kind?: unknown }).kind;
      assert(kind === "switch" || kind === "variable", `endings[${index}].conditions[${conditionIndex}]는 switch 또는 variable 조건이어야 합니다.`);
    }
    if (ending.priority !== undefined) requireNumber(`endings[${index}].priority`, ending.priority);
    if (ending.epilogue !== undefined) {
      for (const [beatIndex, beat] of requireArray(`endings[${index}].epilogue`, ending.epilogue).entries()) {
        requireRecord(`endings[${index}].epilogue[${beatIndex}]`, beat);
      }
    }
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
      preset.id = id;
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
    assert(Array.isArray(quest.steps), `quests[${index}].steps는 배열이어야 합니다.`);
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
