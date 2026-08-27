import {
  defaultDatabase,
  defaultResourceProfiles,
  defaultSession,
  defaultSystem,
} from "../defaults";
import { faceIdForSheetCell } from "@/assets/facesetFaceAssets";
import { faceCellSuffix, faceIdForUploadedSheetCell, planFacesetSheetSplit } from "@/assets/facesetSheetSlicing";
import { SCHEMA_VERSION } from "../types";
import type {
  AssetRef,
  AssetSet,
  Command,
  Condition,
  GameEvent,
  GameEventV1,
  GameMap,
  MapId,
  MapTreeNode,
  PassFlag,
  Project,
  ProjectV1,
  ProjectV2,
  TilesetDef,
} from "../types";
import { deepClone, sanitize, type JsonRecord } from "./guards";
import { validateProjectV4 } from "./shape";

export function migrateV1toV2(project: ProjectV1): ProjectV2 {
  const flagToSwitch = new Map<string, string>();
  const switches = Object.keys(project.flags).map((flag) => {
    const id = `sw_${sanitize(flag)}`;
    flagToSwitch.set(flag, id);
    return { id, name: flag };
  });

  const assets: AssetSet = {
    sprites: Object.fromEntries(Object.entries(project.assets.sprites).map(([id, sprite]) => [id, { ...sprite }])),
    uploaded: {},
  };

  const tilesets: Record<string, TilesetDef> = {};
  for (const [id, tileset] of Object.entries(project.assets.tilesets)) {
    const passability: PassFlag[] = [];
    const priority: ("lower" | "upper")[] = [];
    const terrain: number[] = [];
    for (let index = 0; index < tileset.count; index++) {
      passability.push({ up: true, down: true, left: true, right: true });
      priority.push("lower");
      terrain.push(0);
    }
    tilesets[id] = {
      id,
      name: id,
      image: tileset.image,
      tileSize: tileset.tileSize,
      tilesPerRow: tileset.tilesPerRow,
      count: tileset.count,
      passability,
      priority,
      terrain,
    };
  }

  const maps: Record<MapId, GameMap> = {};
  for (const [id, map] of Object.entries(project.maps)) {
    maps[id] = {
      id: map.id,
      name: map.name,
      width: map.width,
      height: map.height,
      tilesetId: findTilesetId(project.assets.tilesets, map.tileset),
      tileSize: map.tileSize,
      lowerTiles: [...map.tiles],
      upperTiles: new Array<number>(map.width * map.height).fill(-1),
      events: map.events.map((event) => migrateEventV1(event, flagToSwitch)),
    };
  }

  return {
    version: 2,
    meta: { title: project.meta.title, author: project.meta.author, terms: { gold: "G" } },
    assets,
    tilesets,
    switches,
    variables: [],
    commonEvents: [],
    maps,
    mapTree: createMapTree(project.startMapId, Object.keys(maps)),
    startMapId: project.startMapId,
    startPos: { ...project.startPos },
    flags: { ...project.flags },
  };
}

export function migrateV2toV3(project: ProjectV2): Project {
  // v1·v2 사슬도 v3→v4 단계를 통과한다 — 기본 DB/시드에 남은 얼굴 짝까지 한 곳에서 처리한다.
  return migrateV3toV4({
    version: SCHEMA_VERSION,
    meta: {
      title: project.meta.title,
      author: project.meta.author,
      terms: project.meta.terms,
    },
    assets: deepClone(project.assets),
    resourceProfiles: defaultResourceProfiles(),
    tilesets: deepClone(project.tilesets),
    switches: deepClone(project.switches),
    variables: deepClone(project.variables),
    commonEvents: deepClone(project.commonEvents),
    database: defaultDatabase(),
    system: defaultSystem(),
    session: defaultSession(),
    maps: Object.fromEntries(
      Object.entries(project.maps).map(([id, map]) => [
        id,
        {
          ...deepClone(map),
          events: map.events.map((event) => migrateEventV2(event)),
        },
      ])
    ),
    mapConnections: [],
    mapTree: deepClone(project.mapTree),
    startMapId: project.startMapId,
    startPos: { ...project.startPos },
    flags: { ...project.flags },
  });
}

/**
 * v3 → v4: 얼굴 (시트 리소스 id, faceIndex) 짝을 낱장 얼굴 id 하나로 바꾸고,
 * faceIndex 키와 actorFaceIndices 맵을 지운다.
 *
 * 생략 규칙: 인덱스가 없는 저장본은 **0번 칸**이다(빈 얼굴이 아니다).
 *
 * 순서 주의: 짝을 **검사 전에** 다시 쓴다. `validateProjectV4` 가 먼저 지나가면
 * `normalizeActorRecord` 가 모델에서 사라진 `faceIndex` 를 버리기 때문에(actorModel.ts),
 * 7번 칸을 고른 액터가 조용히 0번 칸으로 밀린다. 검사 자체는 그대로 전부 수행하므로
 * 새로 만든 낱장 id 도 리소스 화이트리스트 검사(resourceReferenceValidation)를 받는다.
 */
export function migrateV3toV4(data: JsonRecord): Project {
  const upgraded = deepClone(data);
  const uploadedSheetCells = collectUploadedFacesetSheetIds(upgraded);
  splitFacesetPairs(upgraded, uploadedSheetCells);
  splitUploadedFacesetSheetAssets(upgraded, uploadedSheetCells);
  upgraded.version = SCHEMA_VERSION;
  return validateProjectV4(upgraded);
}

/**
 * 저장 JSON 전수 순회 한 번. 얼굴 짝은 액터 레코드·모든 페이지의 changeFace(공통 이벤트·
 * 전투 이벤트·중첩 분기 포함)·m2 Change Actor Faceset 필드·세션 오버라이드 맵에 흩어져 있다.
 * 컨테이너를 열거하는 대신 모든 노드를 한 번 훑는다 — 새 저장 위치를 하나 빠뜨리면 사용자
 * 데이터가 조용히 망가지는 종류의 버그다.
 */
function splitFacesetPairs(node: unknown, uploadedSheetIds: ReadonlySet<string>): void {
  if (Array.isArray(node)) {
    // 원시값은 이 함수에서 즉시 return 되는 노드다. 호출 자체를 건너뛴다 — 3.6MB 마을
    // 저장본의 대부분은 타일 레이어(숫자 배열)라서, 숫자마다 함수를 부르면 로드 한 번에
    // 수백만 번 호출이 쌓인다.
    for (const entry of node) {
      if (entry !== null && typeof entry === "object") splitFacesetPairs(entry, uploadedSheetIds);
    }
    return;
  }
  if (node === null || typeof node !== "object") return;
  const record = node as JsonRecord;

  // changeFace 명령(및 같은 모양으로 저장된 FaceGraphic 사본).
  if (typeof record.resourceId === "string" && (record.kind === "changeFace" || "faceIndex" in record)) {
    record.resourceId = faceIdForFace(record.resourceId, faceCell(record.faceIndex), uploadedSheetIds);
  }
  // 액터 레코드. 짝 없이 시트 id 만 있는 저장본도 0번 칸으로 옮긴다.
  if (typeof record.faceResourceId === "string") {
    record.faceResourceId = faceIdForFace(record.faceResourceId, faceCell(record.faceIndex), uploadedSheetIds);
  }
  // m2 Change Actor Faceset: 얼굴은 fields.value, 칸은 fields.faceIndex 에 있다. 칸의 기본값이 0 이라
  // 짧게 직렬화된 저장본에는 faceIndex 키가 아예 없다 — 키가 있을 때만 옮기면 그 명령은 시트 id 를
  // 그대로 들고 남아 48px 얼굴 자리에 192x192 시트가 통째로 그려진다(시트 id 는 여전히 등록되어
  // 있어 검사도 못 잡는다). 그래서 문자열이면 무조건 통과시킨다: faceIdForSheetCell 은 시트 id 가
  // 아닌 입력을 그대로 되돌려 주므로(facesetFaceAssets.ts, Map 조회 실패 시 ?? sheetResourceId)
  // 얼굴과 무관한 m2 명령의 value 는 바뀌지 않는다.
  const fields = record.fields;
  if (record.kind === "m2Command" && isPlainObject(fields)) {
    if (typeof fields.value === "string") {
      fields.value = faceIdForFace(fields.value, faceCell(fields.faceIndex), uploadedSheetIds);
    }
    delete fields.faceIndex;
  }
  // 세션 오버라이드 맵 쌍(actorId → 시트 id, actorId → 칸).
  const faceIds = record.actorFaceResourceIds;
  if (isPlainObject(faceIds)) {
    const indices = record.actorFaceIndices;
    const indexByActor = isPlainObject(indices) ? indices : {};
    for (const [actorId, value] of Object.entries(faceIds)) {
      if (typeof value !== "string") continue;
      faceIds[actorId] = faceIdForFace(value, faceCell(indexByActor[actorId]), uploadedSheetIds);
    }
  }
  delete record.actorFaceIndices;
  // 얼굴 id 가 붙지 않은 칸 번호는 v4 모델에 자리가 없다.
  delete record.faceIndex;

  for (const value of Object.values(record)) {
    if (value !== null && typeof value === "object") splitFacesetPairs(value, uploadedSheetIds);
  }
}

/**
 * 내장 시트는 생성된 낱장 목록으로, 프로젝트에 업로드된 시트는 `<시트 id>-NN` 규약으로 옮긴다.
 * 업로드 시트 집합에 없는 id 는 손대지 않는다 — 얼굴과 무관한 m2 value 를 망치지 않기 위한 방어다.
 */
function faceIdForFace(resourceId: string, cell: number | undefined, uploadedSheetIds: ReadonlySet<string>): string {
  const builtin = faceIdForSheetCell(resourceId, cell);
  if (builtin !== resourceId) return builtin;
  if (!uploadedSheetIds.has(resourceId)) return resourceId;
  return faceIdForUploadedSheetCell(resourceId, clampUploadedCell(cell));
}

function clampUploadedCell(cell: number | undefined): number {
  if (cell === undefined || !Number.isFinite(cell)) return 0;
  return Math.max(0, Math.min(15, Math.trunc(cell)));
}

/** 업로드 자산 중 48 배수 정사각 얼굴 시트의 id 집합. meta 크기가 없으면 시트로 보지 않는다. */
function collectUploadedFacesetSheetIds(data: JsonRecord): ReadonlySet<string> {
  const ids = new Set<string>();
  const assets = data.assets;
  if (!isPlainObject(assets)) return ids;
  const uploaded = assets.uploaded;
  if (!isPlainObject(uploaded)) return ids;
  for (const [id, asset] of Object.entries(uploaded)) {
    if (!isPlainObject(asset) || asset.kind !== "faceset") continue;
    const meta = isPlainObject(asset.meta) ? asset.meta : {};
    const width = faceCell(meta.width);
    const height = faceCell(meta.height);
    if (width === undefined || height === undefined) continue;
    if (planFacesetSheetSplit(width, height) !== null) ids.add(id);
  }
  return ids;
}

/**
 * 업로드된 시트 자산 하나를 낱장 16개 자산으로 바꾼다. 여기서는 픽셀을 자를 수 없으므로
 * (마이그레이션은 동기 + canvas 없는 환경에서도 돈다) 각 칸이 시트 이미지를 물려받은 상태로
 * 등록하고, 실제 절단은 로드 직후 `repairUploadedFacesetSheets` 가 canvas 로 마무리한다.
 * 그래야 낱장 id 참조가 리소스 검사를 통과한다.
 */
function splitUploadedFacesetSheetAssets(data: JsonRecord, sheetIds: ReadonlySet<string>): void {
  if (sheetIds.size === 0) return;
  const assets = data.assets;
  if (!isPlainObject(assets)) return;
  const uploaded = assets.uploaded;
  if (!isPlainObject(uploaded)) return;
  for (const sheetId of sheetIds) {
    const sheet = uploaded[sheetId];
    if (!isPlainObject(sheet)) continue;
    const meta = isPlainObject(sheet.meta) ? sheet.meta : {};
    const plan = planFacesetSheetSplit(faceCell(meta.width) ?? 0, faceCell(meta.height) ?? 0);
    if (plan === null) continue;
    for (let index = 0; index < plan.count; index += 1) {
      const faceId = `${sheetId}-${faceCellSuffix(index)}`;
      if (uploaded[faceId] !== undefined) continue;
      uploaded[faceId] = {
        ...sheet,
        id: faceId,
        name: `${typeof sheet.name === "string" ? sheet.name : sheetId} 얼굴 ${index + 1}`,
        meta: { ...meta, width: plan.cellSize, height: plan.cellSize, frames: 1, sheetCell: index, sheetSourceId: sheetId },
      };
    }
    delete uploaded[sheetId];
    rewriteResourceProfilesForSplitSheet(data, sheetId, plan.count, plan.cellSize);
  }
}

function rewriteResourceProfilesForSplitSheet(data: JsonRecord, sheetId: string, count: number, cellSize: number): void {
  const profiles = data.resourceProfiles;
  if (!Array.isArray(profiles)) return;
  const sheetIndex = profiles.findIndex((entry) => isPlainObject(entry) && entry.assetId === sheetId);
  const sheetProfile = sheetIndex >= 0 && isPlainObject(profiles[sheetIndex]) ? (profiles[sheetIndex] as JsonRecord) : null;
  if (sheetIndex >= 0) profiles.splice(sheetIndex, 1);
  for (let index = 0; index < count; index += 1) {
    const faceId = `${sheetId}-${faceCellSuffix(index)}`;
    if (profiles.some((entry) => isPlainObject(entry) && entry.assetId === faceId)) continue;
    profiles.push({
      kind: "faceset",
      name: `${sheetProfile !== null && typeof sheetProfile.name === "string" ? sheetProfile.name : sheetId} 얼굴 ${index + 1}`,
      imageWidth: cellSize,
      imageHeight: cellSize,
      assetId: faceId,
    });
  }
}

function isPlainObject(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 저장본은 칸을 숫자로도 문자열로도 들고 있었다(m2 필드). 못 읽으면 생략 = 0번 칸. */
function faceCell(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

export function migrateV1toV3(project: ProjectV1): Project {
  return migrateV2toV3(migrateV1toV2(project));
}

function migrateEventV1(event: GameEventV1, flagToSwitch: Map<string, string>): GameEvent {
  const condition = migrateConditionV1(event.condition, flagToSwitch);
  const commands = event.commands.map((command) => migrateCommandV1(command, flagToSwitch));
  return migrateEventV2({
    id: event.id,
    x: event.x,
    y: event.y,
    sprite: event.sprite,
    trigger: event.trigger,
    condition,
    commands,
  });
}

function migrateEventV2(event: GameEvent): GameEvent {
  if (event.pages && event.pages.length > 0) return deepClone(event);
  return {
    ...deepClone(event),
    pages: [
      {
        id: `${event.id}_page_1`,
        name: "Page 1",
        conditions: event.condition ? [event.condition] : [],
        graphic: event.sprite ? { sprite: event.sprite } : {},
        trigger: event.trigger,
        priority: "same",
        movement: {
          type: event.moveRoute ? "custom" : "fixed",
          speed: 3,
          frequency: 3,
          route: event.moveRoute,
        },
        commands: deepClone(event.commands),
      },
    ],
  };
}

function migrateConditionV1(
  condition: ProjectV1["maps"][string]["events"][number]["condition"],
  flagToSwitch: Map<string, string>
): Condition | undefined {
  if (!condition) return undefined;
  return {
    kind: "switch",
    switchId: flagToSwitch.get(condition.flag) ?? `sw_${sanitize(condition.flag)}`,
    value: condition.value,
  };
}

function migrateCommandV1(
  command: ProjectV1["maps"][string]["events"][number]["commands"][number],
  flagToSwitch: Map<string, string>
): Command {
  switch (command.kind) {
    case "text":
      return { kind: "text", speaker: command.speaker, body: command.body };
    case "choices":
      return {
        kind: "choices",
        prompt: command.prompt,
        options: command.options.map((option) => ({
          text: option.text,
          branch: option.branch.map((branchCommand) => migrateCommandV1(branchCommand, flagToSwitch)),
        })),
      };
    case "setFlag":
      return {
        kind: "setSwitch",
        switchId: flagToSwitch.get(command.flag) ?? `sw_${sanitize(command.flag)}`,
        value: command.value,
      };
    case "transfer":
      return { kind: "transfer", mapId: command.mapId, x: command.x, y: command.y };
    case "wait":
      return { kind: "wait", ms: command.ms };
  }
}

function findTilesetId(tilesets: ProjectV1["assets"]["tilesets"], image: AssetRef): string {
  for (const [id, tileset] of Object.entries(tilesets)) {
    if (tileset.image.id === image.id) return id;
  }
  return Object.keys(tilesets)[0] ?? "tiles_default";
}

function createMapTree(startMapId: MapId, mapIds: readonly string[]): MapTreeNode {
  return {
    mapId: startMapId,
    children: mapIds.filter((mapId) => mapId !== startMapId).map((mapId) => ({ mapId, children: [] })),
  };
}
