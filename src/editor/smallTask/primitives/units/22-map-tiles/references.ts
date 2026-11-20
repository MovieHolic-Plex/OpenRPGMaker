import { withOpenEventDrafts, type SmallTaskDraftSource } from "@/ai/smallTaskReferences";
import { fieldNumber, fieldString } from "@/player/interpreter/m2RuntimeFields";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { canMove, inBounds, isPassable, isPassableLanding } from "@/project/collision";
import { parseDoorValue, type DoorSpec } from "@/project/eventCommands/doorAnimation";
import { layerTileAt, TILE_LAYER_NOS, type TileLayerNo } from "@/project/mapLayers";
import { structurePlacementIsOverpainted } from "@/project/structurePlacements";
import { terrainTagAt } from "@/project/terrainAt";
import { terrainReachability } from "@/project/terrainReachability";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { Command, GameMap, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";

const CHANGE_TILE_LAYER: Record<Extract<Command, { kind: "changeTile" }>["layer"], TileLayerNo> = {
  lower: 1, lower2: 2, upper: 3, upper2: 4,
};

type LocatedCommand = { command: Command; onMap: boolean };

type TransferCheck = (command: Command) => boolean;

function mayEnterMap(commands: readonly Command[], mayTransfer: TransferCheck): boolean {
  return commands.some(command => mayTransfer(command) ||
    nestedCommandLists(command).some(branch => mayEnterMap(branch, mayTransfer)));
}

function transferCheck(project: Project, mapId: string): TransferCheck {
  const commonEvents = new Map(project.commonEvents.map(event => [event.id, event.commands]));
  const transfers = (command: Command, visited: Set<string>): boolean => {
    if (command.kind === "transfer") return command.mapId === mapId;
    // The active map event, a script or a chosen teleport may depend on play state.
    if (command.kind === "callMapEvent" || command.kind === "script") return true;
    if (command.kind === "m2Command") {
      return command.commandId === "m2-223-teleport-menu"
        && command.fields.transfer !== false && command.fields.transfer !== "false";
    }
    if (command.kind !== "callCommonEvent" || visited.has(command.commonEventId)) return false;
    visited.add(command.commonEventId);
    const commands = commonEvents.get(command.commonEventId);
    return !!commands && mayEnterMap(commands, next => transfers(next, visited));
  };
  return command => transfers(command, new Set());
}

function* mapTileCommands(
  commands: readonly Command[], mayTransfer: TransferCheck, onMap: boolean,
): Generator<LocatedCommand, boolean> {
  if (!onMap && commands.some(command => command.kind === "gotoLabel")) {
    onMap = mayEnterMap(commands, mayTransfer);
  }
  for (const command of commands) {
    yield { command, onMap };
    let branchCanEnter = false;
    for (const branch of nestedCommandLists(command)) {
      // A later iteration can start on the map reached by an earlier iteration.
      const branchStartsHere = onMap || (command.kind === "loop" && mayEnterMap(branch, mayTransfer));
      if (yield* mapTileCommands(branch, mayTransfer, branchStartsHere)) branchCanEnter = true;
    }
    // A transfer can fail, so even a specified destination does not rule out the previous map.
    onMap ||= branchCanEnter || mayTransfer(command);
  }
  return onMap;
}

function* commandsInProject(project: Project, mapId: string, live?: SmallTaskDraftSource): Iterable<LocatedCommand> {
  const mayTransfer = transferCheck(project, mapId);
  const working = withOpenEventDrafts(project, live);
  for (const map of Object.values(project.maps)) {
    const workingEvents = working.maps[map.id]?.events;
    const records = new Set(map.events);
    for (const event of workingEvents ?? []) records.add(event);
    for (const event of records) {
      const original = event.draft?.kind === "edit" ? event.draft.original : undefined;
      if (original) records.add(original);
      yield* mapTileCommands(event.commands, mayTransfer, map.id === mapId);
      for (const page of event.pages ?? []) yield* mapTileCommands(page.commands, mayTransfer, map.id === mapId);
    }
  }
  for (const event of project.commonEvents) yield* mapTileCommands(event.commands, mayTransfer, true);
  for (const troop of project.database.troops) {
    for (const page of [...troop.battleEventPages, ...troopAfterBattleLists(troop)]) {
      yield* mapTileCommands(page.commands, mayTransfer, true);
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
  command: Extract<Command, { kind: "m2Command" }>, onMap: boolean,
  lostLanding: (x: number, y: number) => boolean,
): void {
  const { commandId, fields } = command;
  if (commandId === "m2-202-screen-effect") {
    if (map === next || !onMap) return;
    if (typeof fields.value === "string" && (fields.effect === "doorOpen" || fields.effect === "doorClose")) {
      const door = parseDoorValue(fields.value);
      if (door) assertDoorTilesPreserved(map, next, door);
    }
    return;
  }
  if (commandId !== "m2-042-get-terrain-id" && commandId !== "m2-072-set-teleportation-point") return;
  const explicitMapId = fields.mapId === undefined ? "" : fieldString(fields, "mapId", "");
  if (explicitMapId ? explicitMapId !== map.id : !onMap) return;
  const fallback = explicitMapId || commandId === "m2-042-get-terrain-id" ? 0 : NaN;
  const x = Math.trunc(fields.x === undefined ? fallback : fieldNumber(fields, "x", fallback));
  const y = Math.trunc(fields.y === undefined ? fallback : fieldNumber(fields, "y", fallback));
  if (commandId === "m2-072-set-teleportation-point") {
    // Omitted coordinates use the player's position at runtime.
    const minX = Number.isNaN(x) ? 0 : Math.max(0, x);
    const minY = Number.isNaN(y) ? 0 : Math.max(0, y);
    const maxX = Number.isNaN(x) ? map.width : Math.min(map.width, x + 1);
    const maxY = Number.isNaN(y) ? map.height : Math.min(map.height, y + 1);
    for (let row = minY; row < maxY; row++) {
      for (let column = minX; column < maxX; column++) {
        if (lostLanding(column, row)) throw new PrimitiveError("이벤트가 지정한 순간이동 칸에서 움직일 수 없게 돼요.");
      }
    }
  } else if (map !== next && inBounds(map, x, y) && fields.variableId !== undefined && fieldString(fields, "variableId", "")) {
    const location = { mapId: map.id, x, y };
    if (terrainTagAt(before, location) !== terrainTagAt(after, location)) {
      throw new PrimitiveError("이 칸의 지형을 읽는 이벤트가 있어요. 이벤트 명령을 먼저 확인해 주세요.");
    }
  }
}

type Point = { x: number; y: number };
const NEIGHBORS = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
const APPROACH = [[0, 0], ...NEIGHBORS] as const;

/** Flood from a target's approach cells, following only incoming runtime edges. */
function landingsThatCanReach(project: Project, map: GameMap, approach: readonly Point[]): Uint8Array {
  const reached = new Uint8Array(map.width * map.height);
  const queue = new Int32Array(reached.length);
  let end = 0;
  for (const { x, y } of approach) {
    if (!isPassable(project, map, x, y)) continue;
    const index = y * map.width + x;
    reached[index] = 1;
    queue[end++] = index;
  }
  for (let head = 0; head < end; head++) {
    const index = queue[head]!;
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    for (const [dx, dy] of NEIGHBORS) {
      const px = x + dx;
      const py = y + dy;
      const previous = py * map.width + px;
      if (!inBounds(map, px, py) || reached[previous] || !canMove(project, map, px, py, x, y)) continue;
      reached[previous] = 1;
      queue[end++] = previous;
    }
  }
  return reached;
}

function assertRoutesPreserved(
  before: Project, after: Project, map: GameMap, next: GameMap, landings: readonly Point[], exits: readonly Point[],
): void {
  // Solid NPCs and doors are reached from an adjacent walkable cell. Connections
  // require a walkable path to their exact cell.
  const targets = [
    ...exits.map(point => ({ point, offsets: [[0, 0]] as const })),
    ...map.events.filter(event => event.commands.length || event.pages?.some(page => page.commands.length))
      .map(point => ({ point, offsets: APPROACH })),
  ].map(({ point, offsets }) => offsets.map(([dx, dy]) => ({ x: point.x + dx, y: point.y + dy }))
    .filter(({ x, y }) => inBounds(map, x, y)));
  if (!targets.length || !landings.length) return;
  const arrivals = new Map<number, Point>();
  for (const { x, y } of landings) {
    if (inBounds(map, x, y)) arrivals.set(y * map.width + x, { x, y });
  }
  const routeLost = "착지 칸에서 기존 이벤트나 출구로 가는 길이 끊겨요.";
  if (targets.length < arrivals.size) {
    for (const approach of targets) {
      const oldReach = landingsThatCanReach(before, map, approach);
      const newReach = landingsThatCanReach(after, next, approach);
      for (const index of arrivals.keys()) {
        if (oldReach[index] && !newReach[index]) throw new PrimitiveError(routeLost);
      }
    }
    return;
  }
  for (const landing of arrivals.values()) {
    const oldReach = terrainReachability(before, map, landing);
    const newReach = terrainReachability(after, next, landing);
    for (const approach of targets) {
      const accessible = (reached: Uint8Array) => approach.some(({ x, y }) => reached[y * map.width + x]);
      if (accessible(oldReach) && !accessible(newReach)) throw new PrimitiveError(routeLost);
    }
  }
}

export function assertTileReferencesPreserved(
  before: Project, after: Project, map: GameMap, next: GameMap,
  live?: SmallTaskDraftSource,
  passageTile?: { tile: number; contains: (x: number, y: number) => boolean },
): void {
  const lostLanding = (x: number, y: number) =>
    isPassableLanding(before, map, x, y) && !isPassableLanding(after, next, x, y);
  const landings: Point[] = [];
  const exits: Point[] = [];
  if (before.startMapId === map.id) {
    if (lostLanding(before.startPos.x, before.startPos.y)) {
      throw new PrimitiveError("게임 시작 칸에서 이동할 수 없게 돼요.");
    }
    landings.push(before.startPos);
  }
  for (const connection of before.mapConnections ?? []) {
    if (!(connection.playerEnabled || connection.npcEnabled)) continue;
    if (connection.playerEnabled) {
      if (connection.from.mapId === map.id) exits.push(connection.from);
      if (connection.to.mapId === map.id) landings.push(connection.to);
    }
    if ([connection.from, connection.to].some(point => point.mapId === map.id && lostLanding(point.x, point.y))) {
      throw new PrimitiveError("다른 맵과 이어지는 칸에서 움직일 수 없게 돼요.");
    }
  }
  for (const ending of before.endings ?? []) {
    const point = ending.continueTo;
    if (point?.mapId !== map.id) continue;
    if (lostLanding(point.x, point.y)) throw new PrimitiveError("엔딩 뒤에 이어지는 칸에서 움직일 수 없게 돼요.");
    landings.push(point);
  }
  for (const { command, onMap } of commandsInProject(before, map.id, live)) {
    if (command.kind === "transfer") {
      if (command.mapId === map.id) {
        if (lostLanding(command.x, command.y)) throw new PrimitiveError("이벤트가 이동해 오는 칸에서 움직일 수 없게 돼요.");
        landings.push(command);
      }
      continue;
    }
    if (command.kind === "m2Command") {
      assertM2TileReferencePreserved(before, after, map, next, command, onMap, lostLanding);
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
  assertRoutesPreserved(before, after, map, next, landings, exits);
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
