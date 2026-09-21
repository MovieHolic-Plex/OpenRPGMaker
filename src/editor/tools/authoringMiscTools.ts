// 맵 연결·마을 문서·리소스 프로필·인물 프로필·테스트 프리셋·플래그 슬롯 저작.
import { extractQuestGraphConditions } from "@/project/quest/questGraph";
import { isQuestGraphDef, questDefId } from "@/project/quest/questDef";
import { buildStoryFlagUsageIndex, usageBucketFor } from "@/project/storyFlagUsage";
import type {
  CharacterProfile,
  Dir,
  MapConnection,
  Project,
  ResourceKind,
  ResourceProfile,
  StoryFlagKind,
  TestPreset,
  VillageInfoDocument,
} from "@/project/types";
import {
  DELETE_MAP_CONNECTION_SCHEMA,
  DELETE_CHARACTER_PROFILE_SCHEMA,
  DELETE_RESOURCE_PROFILE_SCHEMA,
  DELETE_TEST_PRESET_SCHEMA,
  DELETE_VILLAGE_DOCUMENT_SCHEMA,
  MANAGE_FLAG_SLOT_SCHEMA,
  UPSERT_CHARACTER_PROFILE_SCHEMA,
  UPSERT_MAP_CONNECTION_SCHEMA,
  UPSERT_RESOURCE_PROFILE_SCHEMA,
  UPSERT_TEST_PRESET_SCHEMA,
  UPSERT_VILLAGE_DOCUMENT_SCHEMA,
} from "./authoringMiscSchemas";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const DIRECTIONS = ["down", "left", "right", "up"] as const satisfies readonly Dir[];
const RESOURCE_KINDS = [
  "chipset", "charset", "battle", "battleCharset", "battleWeapon", "backdrop",
  "gameOver", "monster", "faceset", "picture", "movie", "system", "system2", "title", "music", "sound",
] as const satisfies readonly ResourceKind[];
const SEASONS = ["spring", "summer", "fall", "winter"] as const;

type Season = (typeof SEASONS)[number];
type RecordWithId = { readonly id: string };

function recordArg(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolError(`${label} 객체가 필요합니다.`, { code: "invalid-args" });
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean) throw new ToolError(`${label} 문자열이 필요합니다.`, { code: "invalid-args" });
  return clean;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean || undefined;
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ToolError(`${label} 숫자가 필요합니다.`, { code: "invalid-args" });
  }
  return value;
}

function integerValue(value: unknown, label: string): number {
  const parsed = numberValue(value, label);
  if (!Number.isInteger(parsed)) throw new ToolError(`${label} 정수가 필요합니다.`, { code: "invalid-args" });
  return parsed;
}

function validValues(values: readonly string[]): string {
  return values.slice(0, 12).join(", ") || "(없음)";
}

function requireMap(project: Project, mapId: string) {
  const map = project.maps[mapId];
  if (!map) {
    throw new ToolError(`맵을 찾을 수 없습니다: ${mapId} (유효한 mapId: ${validValues(Object.keys(project.maps))})`, { code: "map-not-found" });
  }
  return map;
}

function requirePosition(project: Project, mapId: string, x: number, y: number, label: string): void {
  const map = requireMap(project, mapId);
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) {
    throw new ToolError(`${label} 좌표가 ${mapId} 범위를 벗어납니다: (${x},${y}), 유효 범위 x=0..${map.width - 1}, y=0..${map.height - 1}`, {
      code: "coordinate-out-of-bounds",
      mapId,
      x,
      y,
    });
  }
}

function upsertById<T extends RecordWithId>(entries: readonly T[], entry: T): T[] {
  const index = entries.findIndex((candidate) => candidate.id === entry.id);
  if (index < 0) return [...entries, entry];
  return entries.map((candidate, candidateIndex) => candidateIndex === index ? entry : candidate);
}

function deleteById<T extends RecordWithId>(entries: readonly T[], id: string, label: string): T[] {
  if (!entries.some((entry) => entry.id === id)) {
    throw new ToolError(`${label}를 찾을 수 없습니다: ${id} (유효한 id: ${validValues(entries.map((entry) => entry.id))})`, { code: "record-not-found" });
  }
  return entries.filter((entry) => entry.id !== id);
}

function parseEndpoint(project: Project, value: unknown, label: string): MapConnection["from"] {
  const record = recordArg(value, label);
  const mapId = requiredString(record.mapId, `${label}.mapId`);
  const x = integerValue(record.x, `${label}.x`);
  const y = integerValue(record.y, `${label}.y`);
  requirePosition(project, mapId, x, y, label);
  const rawDirection = record.direction;
  if (rawDirection !== undefined && (typeof rawDirection !== "string" || !DIRECTIONS.includes(rawDirection as Dir))) {
    throw new ToolError(`${label}.direction은 ${DIRECTIONS.join("/")} 중 하나여야 합니다.`, { code: "invalid-args" });
  }
  return { mapId, x, y, ...(rawDirection ? { direction: rawDirection as Dir } : {}) };
}

function parseConnection(project: Project, value: unknown): MapConnection {
  const record = recordArg(value, "connection");
  if (typeof record.playerEnabled !== "boolean" || typeof record.npcEnabled !== "boolean") {
    throw new ToolError("connection.playerEnabled와 npcEnabled는 boolean이어야 합니다.", { code: "invalid-args" });
  }
  return {
    id: requiredString(record.id, "connection.id"),
    ...(optionalString(record.name) ? { name: optionalString(record.name) } : {}),
    from: parseEndpoint(project, record.from, "connection.from"),
    to: parseEndpoint(project, record.to, "connection.to"),
    playerEnabled: record.playerEnabled,
    npcEnabled: record.npcEnabled,
  };
}

const upsertMapConnection: ToolDefinition = {
  name: "upsert_map_connection",
  description: "NPC 생활 이동과 플레이어 이동에 쓰는 프로젝트 맵 연결 레코드를 등록하거나 수정한다.",
  mode: "write",
  domains: ["map"],
  parameters: UPSERT_MAP_CONNECTION_SCHEMA,
  run(draft, args): ToolExecResult {
    const connection = parseConnection(draft, args.connection);
    draft.mapConnections = upsertById(draft.mapConnections ?? [], connection);
    return { summary: `맵 연결 ${connection.id} 저장`, data: { connection } };
  },
};

const deleteMapConnection: ToolDefinition = {
  name: "delete_map_connection",
  description: "프로젝트 맵 연결 레코드를 id로 삭제한다.",
  mode: "write",
  domains: ["map"],
  parameters: DELETE_MAP_CONNECTION_SCHEMA,
  run(draft, args): ToolExecResult {
    const connectionId = requiredString(args.connectionId, "connectionId");
    draft.mapConnections = deleteById(draft.mapConnections ?? [], connectionId, "맵 연결");
    return { summary: `맵 연결 ${connectionId} 삭제`, data: { connectionId } };
  },
};

function parseVillageDocument(project: Project, value: unknown): VillageInfoDocument {
  const record = recordArg(value, "document");
  const mapId = requiredString(record.mapId, "document.mapId");
  requireMap(project, mapId);
  return {
    id: requiredString(record.id, "document.id"),
    mapId,
    title: requiredString(record.title, "document.title"),
    markdown: requiredString(record.markdown, "document.markdown"),
  };
}

const upsertVillageDocument: ToolDefinition = {
  name: "upsert_village_document",
  description: "맵에 연결되는 마을 정보 Markdown 문서를 등록하거나 수정한다. AI 표시 문서와 별도 필드다.",
  mode: "write",
  domains: ["map"],
  parameters: UPSERT_VILLAGE_DOCUMENT_SCHEMA,
  run(draft, args): ToolExecResult {
    const document = parseVillageDocument(draft, args.document);
    draft.villageInfoDocuments = upsertById(draft.villageInfoDocuments ?? [], document);
    return { summary: `마을 문서 ${document.id} 저장`, data: { document } };
  },
};

const deleteVillageDocument: ToolDefinition = {
  name: "delete_village_document",
  description: "마을 정보 문서를 id로 삭제한다. aiDocuments는 건드리지 않는다.",
  mode: "write",
  domains: ["map"],
  parameters: DELETE_VILLAGE_DOCUMENT_SCHEMA,
  run(draft, args): ToolExecResult {
    const documentId = requiredString(args.documentId, "documentId");
    draft.villageInfoDocuments = deleteById(draft.villageInfoDocuments ?? [], documentId, "마을 문서");
    return { summary: `마을 문서 ${documentId} 삭제`, data: { documentId } };
  },
};

function parseResourceProfile(project: Project, value: unknown): ResourceProfile {
  const record = recordArg(value, "profile");
  const kind = requiredString(record.kind, "profile.kind");
  if (!RESOURCE_KINDS.includes(kind as ResourceKind)) {
    throw new ToolError(`profile.kind는 ${RESOURCE_KINDS.join("/")} 중 하나여야 합니다.`, { code: "invalid-args" });
  }
  const assetId = requiredString(record.assetId, "profile.assetId");
  const validAssetIds = [...Object.keys(project.assets.uploaded), ...Object.keys(project.assets.sprites)];
  if (!validAssetIds.includes(assetId) && !project.resourceProfiles.some((profile) => profile.assetId === assetId)) {
    throw new ToolError(`리소스 assetId를 찾을 수 없습니다: ${assetId} (유효한 assetId: ${validValues(validAssetIds)})`, { code: "resource-not-found" });
  }
  const optionalDimension = (key: "tileWidth" | "tileHeight" | "imageWidth" | "imageHeight"): number | undefined => {
    if (record[key] === undefined) return undefined;
    const value = integerValue(record[key], `profile.${key}`);
    if (value <= 0) throw new ToolError(`profile.${key}는 1 이상이어야 합니다.`, { code: "invalid-args" });
    return value;
  };
  return {
    kind: kind as ResourceKind,
    name: requiredString(record.name, "profile.name"),
    assetId,
    ...(optionalDimension("tileWidth") !== undefined ? { tileWidth: optionalDimension("tileWidth") } : {}),
    ...(optionalDimension("tileHeight") !== undefined ? { tileHeight: optionalDimension("tileHeight") } : {}),
    ...(optionalDimension("imageWidth") !== undefined ? { imageWidth: optionalDimension("imageWidth") } : {}),
    ...(optionalDimension("imageHeight") !== undefined ? { imageHeight: optionalDimension("imageHeight") } : {}),
  };
}

const upsertResourceProfile: ToolDefinition = {
  name: "upsert_resource_profile",
  description: "기존 리소스 assetId의 표시·분할 치수 프로필을 등록하거나 수정한다. 소재 등록은 upsert_resource가 담당한다.",
  mode: "write",
  domains: ["system"],
  parameters: UPSERT_RESOURCE_PROFILE_SCHEMA,
  run(draft, args): ToolExecResult {
    const profile = parseResourceProfile(draft, args.profile);
    const index = draft.resourceProfiles.findIndex((entry) => entry.assetId === profile.assetId);
    if (index < 0) draft.resourceProfiles.push(profile);
    else draft.resourceProfiles[index] = profile;
    return { summary: `리소스 프로필 ${profile.assetId} 저장`, data: { profile } };
  },
};

const deleteResourceProfile: ToolDefinition = {
  name: "delete_resource_profile",
  description: "리소스 치수 프로필만 삭제한다. 실제 업로드 소재는 delete_resource로 별도 삭제해야 하며 이 툴은 소재를 고아로 만들지 않는다.",
  mode: "write",
  domains: ["system"],
  parameters: DELETE_RESOURCE_PROFILE_SCHEMA,
  run(draft, args): ToolExecResult {
    const assetId = requiredString(args.assetId, "assetId");
    if (!draft.resourceProfiles.some((entry) => entry.assetId === assetId)) {
      const known = draft.resourceProfiles.map((entry) => entry.assetId ?? `${entry.kind}:${entry.name}`);
      throw new ToolError(`리소스 프로필을 찾을 수 없습니다: ${assetId} (유효한 assetId: ${validValues(known)})`, { code: "resource-profile-not-found" });
    }
    draft.resourceProfiles = draft.resourceProfiles.filter((entry) => entry.assetId !== assetId);
    return {
      summary: `리소스 프로필 ${assetId} 삭제 (소재는 유지; 소재 삭제는 delete_resource 사용)`,
      data: { assetId, resourceRetained: draft.assets.uploaded[assetId] !== undefined },
    };
  },
};

function stringList(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new ToolError(`${label}는 문자열 배열이어야 합니다.`, { code: "invalid-args" });
  }
  return value.map((entry) => entry.trim()).filter(Boolean);
}

function parseCharacterProfile(project: Project, value: unknown): CharacterProfile {
  const record = recordArg(value, "profile");
  let birthday: CharacterProfile["birthday"];
  if (record.birthday !== undefined) {
    const birthdayRecord = recordArg(record.birthday, "profile.birthday");
    const season = requiredString(birthdayRecord.season, "profile.birthday.season");
    const day = integerValue(birthdayRecord.day, "profile.birthday.day");
    if (!SEASONS.includes(season as Season) || day < 1 || day > 99) {
      throw new ToolError(`생일은 season=${SEASONS.join("/")}, day=1..99 범위여야 합니다.`, { code: "invalid-args" });
    }
    birthday = { season: season as Season, day };
  }
  let giftPrefs: CharacterProfile["giftPrefs"];
  if (record.giftPrefs !== undefined) {
    const prefs = recordArg(record.giftPrefs, "profile.giftPrefs");
    const loved = stringList(prefs.loved, "profile.giftPrefs.loved");
    const liked = stringList(prefs.liked, "profile.giftPrefs.liked");
    const disliked = stringList(prefs.disliked, "profile.giftPrefs.disliked");
    const itemIds = new Set(project.database.items.map((item) => item.id));
    const unknown = [...(loved ?? []), ...(liked ?? []), ...(disliked ?? [])].filter((itemId) => !itemIds.has(itemId));
    if (unknown.length > 0) {
      throw new ToolError(`선물 아이템을 찾을 수 없습니다: ${validValues(unknown)} (유효한 itemId: ${validValues([...itemIds])})`, { code: "item-not-found" });
    }
    giftPrefs = { ...(loved ? { loved } : {}), ...(liked ? { liked } : {}), ...(disliked ? { disliked } : {}) };
  }
  let giftResponses: CharacterProfile["giftResponses"];
  if (record.giftResponses !== undefined) {
    const responses = recordArg(record.giftResponses, "profile.giftResponses");
    giftResponses = {};
    for (const key of ["loved", "liked", "neutral", "disliked", "alreadyGifted", "noItems"] as const) {
      const text = optionalString(responses[key]);
      if (text) giftResponses = { ...giftResponses, [key]: text };
    }
  }
  return {
    ...(optionalString(record.displayName) ? { displayName: optionalString(record.displayName) } : {}),
    ...(birthday ? { birthday } : {}),
    ...(giftPrefs ? { giftPrefs } : {}),
    ...(giftResponses ? { giftResponses } : {}),
  };
}

const upsertCharacterProfile: ToolDefinition = {
  name: "upsert_character_profile",
  description: "characterId별 인물 프로필의 표시 이름·생일·선물 선호·반응 문구를 등록하거나 수정한다.",
  mode: "write",
  domains: ["database"],
  parameters: UPSERT_CHARACTER_PROFILE_SCHEMA,
  run(draft, args): ToolExecResult {
    const characterId = requiredString(args.characterId, "characterId");
    const profile = parseCharacterProfile(draft, args.profile);
    draft.characters = { ...(draft.characters ?? {}), [characterId]: profile };
    return { summary: `인물 프로필 ${characterId} 저장`, data: { characterId, profile } };
  },
};

const deleteCharacterProfile: ToolDefinition = {
  name: "delete_character_profile",
  description: "project.characters에서 인물 프로필을 삭제한다. 액터·이벤트 자체는 삭제하지 않으며, 참조가 필요한 인물은 먼저 다른 프로필로 교체한다.",
  mode: "write",
  domains: ["database"],
  parameters: DELETE_CHARACTER_PROFILE_SCHEMA,
  run(draft, args): ToolExecResult {
    const characterId = requiredString(args.characterId, "characterId");
    if (!draft.characters?.[characterId]) {
      throw new ToolError(`인물 프로필을 찾을 수 없습니다: ${characterId} (유효한 id: ${validValues(Object.keys(draft.characters ?? {}))})`, { code: "record-not-found" });
    }
    const next = { ...draft.characters };
    delete next[characterId];
    if (Object.keys(next).length === 0) delete draft.characters;
    else draft.characters = next;
    return { summary: `인물 프로필 ${characterId} 삭제`, data: { characterId } };
  },
};

function typedRecord<T extends boolean | number>(value: unknown, label: string, expected: "boolean" | "number"): Record<string, T> | undefined {
  if (value === undefined) return undefined;
  const record = recordArg(value, label);
  const result: Record<string, T> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry !== expected || (expected === "number" && !Number.isFinite(entry))) {
      throw new ToolError(`${label}.${key} 값은 ${expected}이어야 합니다.`, { code: "invalid-args" });
    }
    result[key] = entry as T;
  }
  return result;
}

function requireKnownKeys(keys: readonly string[], known: readonly string[], label: string): void {
  const knownSet = new Set(known);
  const unknown = keys.filter((key) => !knownSet.has(key));
  if (unknown.length > 0) {
    throw new ToolError(`${label} id를 찾을 수 없습니다: ${validValues(unknown)} (유효한 id: ${validValues(known)})`, { code: "reference-not-found" });
  }
}

function parseTestPreset(project: Project, value: unknown): TestPreset {
  const record = recordArg(value, "preset");
  const switches = typedRecord<boolean>(record.switches, "preset.switches", "boolean");
  const variables = typedRecord<number>(record.variables, "preset.variables", "number");
  const inventory = typedRecord<number>(record.inventory, "preset.inventory", "number");
  if (switches) requireKnownKeys(Object.keys(switches), project.switches.map((entry) => entry.id), "switch");
  if (variables) requireKnownKeys(Object.keys(variables), project.variables.map((entry) => entry.id), "variable");
  if (inventory) requireKnownKeys(Object.keys(inventory), project.database.items.map((entry) => entry.id), "item");
  const startMapId = optionalString(record.startMapId);
  let startPos: TestPreset["startPos"];
  if (record.startPos !== undefined) {
    if (!startMapId) throw new ToolError("preset.startPos를 쓰려면 startMapId가 필요합니다.", { code: "invalid-args" });
    const position = recordArg(record.startPos, "preset.startPos");
    startPos = { x: integerValue(position.x, "preset.startPos.x"), y: integerValue(position.y, "preset.startPos.y") };
    requirePosition(project, startMapId, startPos.x, startPos.y, "preset.startPos");
  } else if (startMapId) {
    requireMap(project, startMapId);
  }
  const gold = record.gold === undefined ? undefined : integerValue(record.gold, "preset.gold");
  if (gold !== undefined && gold < 0) throw new ToolError("preset.gold는 0 이상이어야 합니다.", { code: "invalid-args" });
  return {
    id: requiredString(record.id, "preset.id"),
    name: requiredString(record.name, "preset.name"),
    ...(switches ? { switches } : {}),
    ...(variables ? { variables } : {}),
    ...(inventory ? { inventory } : {}),
    ...(gold !== undefined ? { gold } : {}),
    ...(startMapId ? { startMapId } : {}),
    ...(startPos ? { startPos } : {}),
  };
}

const upsertTestPreset: ToolDefinition = {
  name: "upsert_test_preset",
  description: "디버그 실행용 스위치·변수·인벤토리·골드·시작 위치 프리셋을 등록하거나 수정한다.",
  mode: "write",
  domains: ["system"],
  parameters: UPSERT_TEST_PRESET_SCHEMA,
  run(draft, args): ToolExecResult {
    const preset = parseTestPreset(draft, args.preset);
    draft.testPresets = upsertById(draft.testPresets ?? [], preset);
    return { summary: `테스트 프리셋 ${preset.id} 저장`, data: { preset } };
  },
};

const deleteTestPreset: ToolDefinition = {
  name: "delete_test_preset",
  description: "저장된 디버그 테스트 프리셋을 id로 삭제한다.",
  mode: "write",
  domains: ["system"],
  parameters: DELETE_TEST_PRESET_SCHEMA,
  run(draft, args): ToolExecResult {
    const presetId = requiredString(args.presetId, "presetId");
    draft.testPresets = deleteById(draft.testPresets ?? [], presetId, "테스트 프리셋");
    return { summary: `테스트 프리셋 ${presetId} 삭제`, data: { presetId } };
  },
};

function questReferences(project: Project, kind: StoryFlagKind, id: string): string[] {
  const references: string[] = [];
  for (const quest of project.quests ?? []) {
    if (isQuestGraphDef(quest)) {
      const hasReference = quest.nodes.some((node) => extractQuestGraphConditions(node.completesWhen).some((condition) => {
        if (condition.kind !== kind) return false;
        if ("targetId" in condition) return condition.targetId === id;
        if (kind === "switch" && "switchId" in condition) return condition.switchId === id;
        if (kind === "variable" && "variableId" in condition) return condition.variableId === id;
        return false;
      }));
      if (hasReference) references.push(quest.id);
      continue;
    }
    const flags = [`sw_${quest.key}_started`, `sw_${quest.key}_done`, `var_${quest.key}_progress`, ...quest.steps.map((_, index) => `sw_${quest.key}_step${index}`)];
    if (flags.includes(id)) references.push(questDefId(quest));
  }
  return references;
}

function endingReferences(project: Project, kind: StoryFlagKind, id: string): string[] {
  return (project.endings ?? []).filter((ending) => ending.conditions.some((condition) =>
    kind === "switch"
      ? condition.kind === "switch" && condition.switchId === id
      : condition.kind === "variable" && condition.variableId === id
  )).map((ending) => ending.id);
}

function slotReferences(project: Project, kind: StoryFlagKind, id: string): string[] {
  const usage = usageBucketFor(buildStoryFlagUsageIndex(project), kind, id);
  const eventReferences = [...usage.reads, ...usage.writes].map((site) => site.eventId ?? site.commonEventId ?? site.troopId).filter((entry): entry is string => Boolean(entry));
  const storyFlagReferences = (project.storyFlags ?? []).filter((flag) => flag.kind === kind && flag.targetId === id).map((flag) => flag.id);
  return [...new Set([...eventReferences, ...questReferences(project, kind, id), ...endingReferences(project, kind, id), ...storyFlagReferences])];
}

const manageFlagSlot: ToolDefinition = {
  name: "manage_flag_slot",
  description: "이벤트용 이름 있는 스위치/변수 슬롯과 세션 시작값을 추가하거나, 참조가 없을 때 함께 삭제한다.",
  mode: "write",
  domains: ["event"],
  parameters: MANAGE_FLAG_SLOT_SCHEMA,
  run(draft, args): ToolExecResult {
    const action = requiredString(args.action, "action");
    const kind = requiredString(args.kind, "kind");
    if (kind !== "switch" && kind !== "variable") throw new ToolError("kind는 switch/variable 중 하나여야 합니다.", { code: "invalid-args" });
    const id = requiredString(args.id, "id");
    const records = kind === "switch" ? draft.switches : draft.variables;
    if (action === "add") {
      if (records.some((record) => record.id === id)) {
        throw new ToolError(`이미 존재하는 ${kind} id입니다: ${id} (유효한 기존 id: ${validValues(records.map((record) => record.id))})`, { code: "flag-slot-exists" });
      }
      const name = requiredString(args.name, "name");
      records.push({ id, name });
      if (kind === "switch") draft.session.switches[id] = typeof args.switchValue === "boolean" ? args.switchValue : false;
      else draft.session.variables[id] = typeof args.variableValue === "number" ? args.variableValue : 0;
      return { summary: `${kind} 슬롯 ${id} 추가`, data: { action, kind, id, name } };
    }
    if (!records.some((record) => record.id === id)) {
      throw new ToolError(`${kind} 슬롯을 찾을 수 없습니다: ${id} (유효한 id: ${validValues(records.map((record) => record.id))})`, { code: "flag-slot-not-found" });
    }
    const references = slotReferences(draft, kind, id);
    if (references.length > 0) {
      throw new ToolError(`${kind} 슬롯 ${id}는 참조 중이라 삭제할 수 없습니다: ${validValues(references)}`, { code: "flag-slot-referenced" });
    }
    if (kind === "switch") {
      draft.switches = draft.switches.filter((record) => record.id !== id);
      delete draft.session.switches[id];
    } else {
      draft.variables = draft.variables.filter((record) => record.id !== id);
      delete draft.session.variables[id];
    }
    return { summary: `${kind} 슬롯 ${id} 삭제`, data: { action, kind, id } };
  },
};

export const AUTHORING_MISC_TOOLS: readonly ToolDefinition[] = [
  upsertMapConnection,
  deleteMapConnection,
  upsertVillageDocument,
  deleteVillageDocument,
  upsertResourceProfile,
  deleteResourceProfile,
  upsertCharacterProfile,
  deleteCharacterProfile,
  upsertTestPreset,
  deleteTestPreset,
  manageFlagSlot,
];
