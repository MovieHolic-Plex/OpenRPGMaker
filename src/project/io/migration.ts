import {
  defaultDatabase,
  defaultResourceProfiles,
  defaultSession,
  defaultSystem,
} from "../defaults";
import { faceIdForSheetCell } from "@/assets/facesetFaceAssets";
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
  splitFacesetPairs(upgraded);
  upgraded.version = SCHEMA_VERSION;
  return validateProjectV4(upgraded);
}

/**
 * 저장 JSON 전수 순회 한 번. 얼굴 짝은 액터 레코드·모든 페이지의 changeFace(공통 이벤트·
 * 전투 이벤트·중첩 분기 포함)·m2 Change Actor Faceset 필드·세션 오버라이드 맵에 흩어져 있다.
 * 컨테이너를 열거하는 대신 모든 노드를 한 번 훑는다 — 새 저장 위치를 하나 빠뜨리면 사용자
 * 데이터가 조용히 망가지는 종류의 버그다.
 */
function splitFacesetPairs(node: unknown): void {
  if (Array.isArray(node)) {
    for (const entry of node) splitFacesetPairs(entry);
    return;
  }
  if (node === null || typeof node !== "object") return;
  const record = node as JsonRecord;

  // changeFace 명령(및 같은 모양으로 저장된 FaceGraphic 사본).
  if (typeof record.resourceId === "string" && (record.kind === "changeFace" || "faceIndex" in record)) {
    record.resourceId = faceIdForSheetCell(record.resourceId, faceCell(record.faceIndex));
  }
  // 액터 레코드. 짝 없이 시트 id 만 있는 저장본도 0번 칸으로 옮긴다.
  if (typeof record.faceResourceId === "string") {
    record.faceResourceId = faceIdForSheetCell(record.faceResourceId, faceCell(record.faceIndex));
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
      fields.value = faceIdForSheetCell(fields.value, faceCell(fields.faceIndex));
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
      faceIds[actorId] = faceIdForSheetCell(value, faceCell(indexByActor[actorId]));
    }
  }
  delete record.actorFaceIndices;
  // 얼굴 id 가 붙지 않은 칸 번호는 v4 모델에 자리가 없다.
  delete record.faceIndex;

  for (const value of Object.values(record)) splitFacesetPairs(value);
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
