import { fieldNumber, fieldString } from "@/player/interpreter/m2RuntimeFields";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { inBounds, isPassableLanding } from "@/project/collision";
import { parseDoorValue, type DoorSpec } from "@/project/eventCommands/doorAnimation";
import { layerTileAt, TILE_LAYER_NOS, type TileLayerNo } from "@/project/mapLayers";
import { structurePlacementIsOverpainted } from "@/project/structurePlacements";
import { terrainTagAt } from "@/project/terrainAt";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { Command, GameMap, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";

const CHANGE_TILE_LAYER: Record<Extract<Command, { kind: "changeTile" }>["layer"], TileLayerNo> = {
  lower: 1, lower2: 2, upper: 3, upper2: 4,
};

function* mapTileCommands(commands: readonly Command[]): Iterable<Command> {
  for (const command of commands) {
    yield command;
    for (const branch of nestedCommandLists(command)) yield* mapTileCommands(branch);
  }
}

function* commandsInProject(project: Project): Iterable<{ command: Command; mapId?: string }> {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const original = event.draft?.kind === "edit" ? event.draft.original : undefined;
      for (const record of original ? [event, original] : [event]) {
        for (const command of mapTileCommands(record.commands)) yield { command, mapId: map.id };
        for (const page of record.pages ?? []) {
          for (const command of mapTileCommands(page.commands)) yield { command, mapId: map.id };
        }
      }
    }
  }
  for (const event of project.commonEvents) {
    for (const command of mapTileCommands(event.commands)) yield { command };
  }
  for (const troop of project.database.troops) {
    for (const page of [...troop.battleEventPages, ...troopAfterBattleLists(troop)]) {
      for (const command of mapTileCommands(page.commands)) yield { command };
    }
  }
}

function assertDoorTilesPreserved(map: GameMap, next: GameMap, door: DoorSpec): void {
  for (let y = Math.max(0, door.y); y < Math.min(map.height, door.y + door.h); y++) {
    for (let x = Math.max(0, door.x); x < Math.min(map.width, door.x + door.w); x++) {
      const index = y * map.width + x;
      if (TILE_LAYER_NOS.some(layer => layerTileAt(map, layer, index) !== layerTileAt(next, layer, index))) {
        throw new PrimitiveError("이 칸의 타일은 문을 여닫는 데 쓰여요. 문 설정을 먼저 확인해 주세요.");
      }
    }
  }
}

function assertM2TileReferencePreserved(
  before: Project, after: Project, map: GameMap, next: GameMap,
  command: Extract<Command, { kind: "m2Command" }>, ownerMapId: string | undefined,
  lostLanding: (x: number, y: number) => boolean,
): void {
  const { commandId, fields } = command;
  if (commandId === "m2-202-screen-effect") {
    if (map === next || (ownerMapId !== undefined && ownerMapId !== map.id)) return;
    if (typeof fields.value === "string" && (fields.effect === "doorOpen" || fields.effect === "doorClose")) {
      const door = parseDoorValue(fields.value);
      if (door) assertDoorTilesPreserved(map, next, door);
    }
    return;
  }
  if (commandId !== "m2-042-get-terrain-id" && commandId !== "m2-072-set-teleportation-point") return;
  const explicitMapId = fields.mapId === undefined ? "" : fieldString(fields, "mapId", "");
  const targetMapId = explicitMapId || ownerMapId;
  if (targetMapId !== undefined && targetMapId !== map.id) return;
  const fallback = explicitMapId || commandId === "m2-042-get-terrain-id" ? 0 : NaN;
  const x = Math.trunc(fields.x === undefined ? fallback : fieldNumber(fields, "x", fallback));
  const y = Math.trunc(fields.y === undefined ? fallback : fieldNumber(fields, "y", fallback));
  if (!inBounds(map, x, y)) return;
  if (commandId === "m2-072-set-teleportation-point") {
    if (lostLanding(x, y)) throw new PrimitiveError("이벤트가 지정한 순간이동 칸에서 움직일 수 없게 돼요.");
  } else if (map !== next && fields.variableId) {
    const location = { mapId: map.id, x, y };
    if (terrainTagAt(before, location) !== terrainTagAt(after, location)) {
      throw new PrimitiveError("이 칸의 지형을 읽는 이벤트가 있어요. 이벤트 명령을 먼저 확인해 주세요.");
    }
  }
}

export function assertTileReferencesPreserved(
  before: Project, after: Project, map: GameMap, next: GameMap,
  passageTile?: { tile: number; contains: (x: number, y: number) => boolean },
): void {
  const lostLanding = (x: number, y: number) =>
    isPassableLanding(before, map, x, y) && !isPassableLanding(after, next, x, y);
  if (before.startMapId === map.id && lostLanding(before.startPos.x, before.startPos.y)) {
    throw new PrimitiveError("게임 시작 칸에서 이동할 수 없게 돼요.");
  }
  for (const connection of before.mapConnections ?? []) {
    if (!(connection.playerEnabled || connection.npcEnabled)) continue;
    if ([connection.from, connection.to].some(point => point.mapId === map.id && lostLanding(point.x, point.y))) {
      throw new PrimitiveError("다른 맵과 이어지는 칸에서 움직일 수 없게 돼요.");
    }
  }
  for (const ending of before.endings ?? []) {
    const point = ending.continueTo;
    if (point?.mapId === map.id && lostLanding(point.x, point.y)) {
      throw new PrimitiveError("엔딩 뒤에 이어지는 칸에서 움직일 수 없게 돼요.");
    }
  }
  for (const { command, mapId } of commandsInProject(before)) {
    if (command.kind === "transfer") {
      if (command.mapId === map.id && lostLanding(command.x, command.y)) {
        throw new PrimitiveError("이벤트가 이동해 오는 칸에서 움직일 수 없게 돼요.");
      }
      continue;
    }
    if (command.kind === "m2Command") {
      assertM2TileReferencePreserved(before, after, map, next, command, mapId, lostLanding);
      continue;
    }
    if (command.kind !== "changeTile") continue;
    if (command.mapId !== map.id && !(passageTile && before.maps[command.mapId]?.tilesetId === map.tilesetId)) continue;
    const { x, y } = command;
    if (passageTile && command.tile === passageTile.tile && (command.mapId !== map.id || !passageTile.contains(x, y))) {
      throw new PrimitiveError("범위 밖: 이벤트가 선택 영역 밖에서도 이 타일을 써요.");
    }
    if (map === next || !inBounds(map, x, y)) continue;
    const layer = CHANGE_TILE_LAYER[command.layer];
    const index = y * map.width + x;
    if (layer && layerTileAt(map, layer, index) !== layerTileAt(next, layer, index)) {
      throw new PrimitiveError("이 칸의 타일을 바꾸는 이벤트가 있어요. 이벤트 명령을 먼저 확인해 주세요.");
    }
  }
  if (map === next) return;
  for (const door of map.doors ?? []) assertDoorTilesPreserved(map, next, door);
  for (const group of map.doodadGroups ?? []) {
    if (group.cells.some(({ index, tile }) => layerTileAt(map, 3, index) === tile && layerTileAt(next, 3, index) !== tile)) {
      throw new PrimitiveError("이 타일은 묶어 놓은 물건의 일부예요. 물건을 선택해서 편집해 주세요.");
    }
  }
  for (const placement of map.structurePlacements ?? []) {
    if (structurePlacementIsOverpainted(next, placement) && !structurePlacementIsOverpainted(map, placement)) {
      throw new PrimitiveError("이 타일은 배치한 구조물의 일부예요. 구조물을 선택해서 편집해 주세요.");
    }
  }
}
