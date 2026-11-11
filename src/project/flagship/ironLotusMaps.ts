/**
 * 장 구성기가 깔아 둔 무가 저택·빈 칸을 걷어 내고, 청죽림·사원·마을 실내가
 * 이름과 같게 읽히도록 다시 깐다. 타일셋은 sengoku_edo 하나다.
 */
import roomSpec from "@/assets/sengokuEdoRoomSpec.json";
import { isPassable } from "@/project/collision";
import type { Command, GameEvent, GameMap, Project } from "@/project/types";
import { pickSpot } from "@/editor/tools/jrpgVolumeTools";

export const IL_GROVE_PATH_Y = 18;
export const IL_DEEP_PATH_Y = 16;
/** QA 가 이 칸에서 위를 보면 살무사를 밟는다. */
export const IL_BATTLE_STAND = { x: 30, y: IL_GROVE_PATH_Y } as const;
export const IL_BATTLE_FOE = { x: 30, y: IL_GROVE_PATH_Y - 1 } as const;

const GRASS = 1;
const DARK = 2;
const FLOWER = 3;
const PATH = 4;
const COBBLE = 15;
const TATAMI = 816;
const TATAMI_GOLD = 832;
const WOOD = 848;
const FUSUMA = 860;
const FUSUMA_GOLD = 864;
const BOARD = 872;

type Exec = (project: Project, name: string, args: Record<string, unknown>) => unknown;
type Try = (project: Project, name: string, args: Record<string, unknown>) => boolean;

export type IronLotusMapIds = {
  hub: string;
  grove: string;
  temple: string;
  deep: string;
  inn: string;
  shop: string;
  nave: string;
  annex: string;
  stream: string;
  thicket: string;
  glade: string;
};

function eachCommand(event: GameEvent, visit: (cmd: Command) => void): void {
  const walk = (list: readonly Command[] | undefined): void => {
    if (!list) return;
    for (const cmd of list) {
      visit(cmd);
      const rec = cmd as unknown as Record<string, unknown>;
      for (const value of Object.values(rec)) {
        if (!Array.isArray(value) || !value.length) continue;
        if (typeof value[0] === "object" && value[0] && "kind" in (value[0] as object)) walk(value as Command[]);
        else {
          for (const opt of value) {
            if (!opt || typeof opt !== "object") continue;
            const branch = (opt as { branch?: Command[] }).branch;
            if (Array.isArray(branch)) walk(branch);
          }
        }
      }
      const otherwise = (cmd as { else?: Command[] }).else;
      if (Array.isArray(otherwise)) walk(otherwise);
    }
  };
  walk(event.commands);
  for (const page of event.pages ?? []) walk(page.commands);
}

function retarget(map: GameMap, fromId: string, toId: string, x: number, y: number, direction: "up" | "down" | "left" | "right"): void {
  for (const event of map.events) {
    eachCommand(event, (cmd) => {
      if (cmd.kind !== "transfer") return;
      const transfer = cmd as Command & { mapId: string; x: number; y: number; direction?: string };
      if (transfer.mapId !== fromId) return;
      transfer.mapId = toId;
      transfer.x = x;
      transfer.y = y;
      transfer.direction = direction;
    });
  }
}

function eventsTo(map: GameMap, mapId: string): GameEvent[] {
  return map.events.filter((event) => {
    let hit = false;
    eachCommand(event, (cmd) => {
      if (cmd.kind === "transfer" && (cmd as { mapId?: string }).mapId === mapId) hit = true;
    });
    return hit;
  });
}

function hash01(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function paintForest(map: GameMap, pathY: number, dense: boolean, must: ReadonlyArray<readonly [number, number]> = []): Set<string> {
  const n = map.width * map.height;
  map.lowerTiles = new Array<number>(n);
  map.upperTiles = new Array<number>(n).fill(-1);
  const pts = [
    { x: 1, y: pathY },
    { x: Math.floor(map.width * 0.22), y: pathY + (dense ? -4 : 3) },
    { x: Math.floor(map.width * 0.48), y: pathY - (dense ? 2 : 1) },
    { x: Math.floor(map.width * 0.72), y: pathY + (dense ? 3 : -2) },
    { x: map.width - 2, y: pathY },
  ];
  const path = new Set<string>();
  const paintPath = (x: number, y: number, radius: number): void => {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy > radius * radius + 0.2) continue;
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px >= map.width || py >= map.height) continue;
        path.add(`${px},${py}`);
      }
    }
  };
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(a.y + (b.y - a.y) * t);
      const breathe = 1 + (hash01(x, y, 3) > 0.62 ? 1 : 0);
      paintPath(x, y, breathe);
    }
  }
  for (const [x, y] of must) paintPath(x, y, 1);
  paintPath(1, pathY, 1);
  paintPath(map.width - 2, pathY, 1);
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const i = y * map.width + x;
      if (path.has(`${x},${y}`)) { map.lowerTiles[i] = hash01(x, y, 9) > 0.82 ? 5 : PATH; continue; }
      const n = hash01(x, y, dense ? 11 : 4);
      const edge = x < 2 || y < 2 || x > map.width - 3 || y > map.height - 3;
      map.lowerTiles[i] = edge || n > 0.86 ? DARK : n < 0.07 ? FLOWER : n < 0.14 ? 3 : GRASS;
    }
  }
  map.defaultLighting = {
    ambient: dense ? 0.42 : 0.18,
    color: dense ? "#07160f" : "#163222",
    sources: [],
    vignette: dense ? 0.34 : 0.16,
  };
  map.mapRole = "field";
  return path;
}

function fillHoles(map: GameMap, tile: number): void {
  for (let i = 0; i < map.lowerTiles.length; i += 1) if (map.lowerTiles[i] === 0) map.lowerTiles[i] = tile;
}

const BAMBOO_ROWS = [[667, 668], [669, 670], [671, 672]] as const;
const PINE_ROWS = [[641, 642], [643, 644]] as const;
const CEDAR_ROWS = [[659, 660], [661, 662], [663, 664], [665, 666]] as const;

function blitRows(map: GameMap, x: number, y: number, rows: readonly (readonly number[])[], blocked: Set<string>): boolean {
  const h = rows.length;
  const w = rows[0]!.length;
  if (x < 0 || y < 0 || x + w > map.width || y + h > map.height) return false;
  for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) if (blocked.has(`${x + dx},${y + dy}`)) return false;
  for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) {
    const tile = rows[dy]![dx]!;
    if (tile >= 0) map.upperTiles[(y + dy) * map.width + x + dx] = tile;
  }
  for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) blocked.add(`${x + dx},${y + dy}`);
  return true;
}

function stampForest(_project: Project, _tryTool: Try, map: GameMap, path: Set<string>, reserved: Set<string>, dense: boolean): void {
  const blocked = new Set<string>([...path, ...reserved]);
  const near = (x: number, y: number): number => {
    let best = 99;
    for (let dy = -6; dy <= 6; dy += 1) for (let dx = -6; dx <= 6; dx += 1) {
      if (path.has(`${x + dx},${y + dy}`)) best = Math.min(best, Math.abs(dx) + Math.abs(dy));
    }
    return best;
  };
  for (let y = 0; y < map.height - 3; y += 1) {
    for (let x = 0; x < map.width - 2; x += 1) {
      const dist = near(x, y);
      if (dist < 2) {
        const n = hash01(x, y, 8);
        if (dist === 1 && n < 0.4) map.lowerTiles[y * map.width + x] = n < 0.15 ? FLOWER : DARK;
        continue;
      }
      if (y % 3 !== 0 || x % 2 !== 0) continue;
      const clearing = hash01(Math.floor(x / 7), Math.floor(y / 5), dense ? 3 : 6) > 0.78;
      if (clearing) continue;
      const roll = hash01(x, y, 9);
      const rows = roll < 0.12 ? PINE_ROWS : roll > 0.88 ? CEDAR_ROWS : BAMBOO_ROWS;
      blitRows(map, x + (hash01(x, y, 5) > 0.5 ? 1 : 0), y, rows, blocked);
    }
  }
}

function reserve(map: GameMap, path: Set<string>, extra: ReadonlyArray<readonly [number, number, number, number]>): Set<string> {
  const out = new Set<string>(path);
  for (const event of map.events) {
    for (let dy = -1; dy <= 2; dy += 1) for (let dx = -1; dx <= 2; dx += 1) out.add(`${event.x + dx},${event.y + dy}`);
  }
  for (const [x0, y0, x1, y1] of extra) {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) out.add(`${x},${y}`);
  }
  return out;
}

function moveEvent(map: GameMap, idPart: string, x: number, y: number): void {
  const event = map.events.find((entry) => entry.id === idPart || entry.id.includes(idPart));
  if (!event) return;
  event.x = x;
  event.y = y;
}

function door(map: GameMap, id: string, name: string, x: number, y: number, toMapId: string, toX: number, toY: number, direction: "up" | "down" | "left" | "right"): void {
  const command = { kind: "transfer", mapId: toMapId, x: toX, y: toY, direction, fade: "black" } as Command;
  const index = y * map.width + x;
  if (index >= 0 && index < map.lowerTiles.length) {
    map.upperTiles[index] = -1;
    const lower = map.lowerTiles[index];
    if (lower === 0 || lower === 32 || lower === undefined) map.lowerTiles[index] = PATH;
  }
  map.events.push({
    id,
    name,
    x,
    y,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [{
      id: `${id}_p`,
      name,
      conditions: [],
      trigger: { kind: "playerTouch" },
      graphic: { transparent: true },
      priority: "below",
      overlapForbidden: false,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [command],
    }],
  } as GameEvent);
}

function paintRoom(map: GameMap, floor: number, wall: number): { x: number; y: number } {
  const doorX = Math.floor(map.width / 2);
  const n = map.width * map.height;
  map.lowerTiles = new Array<number>(n);
  map.upperTiles = new Array<number>(n).fill(-1);
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const edge = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
      const exit = y === map.height - 1 && x === doorX;
      map.lowerTiles[y * map.width + x] = edge && !exit ? wall : floor;
    }
  }
  map.defaultLighting = { ambient: 0.08, color: "#ffe2b8", sources: [], vignette: 0.08 };
  map.mapRole = "interior";
  return { x: doorX, y: map.height - 1 };
}

function makeRoom(project: Project, exec: Exec, id: string, name: string, width: number, height: number, floor: number, wall: number, bgm: string): { map: GameMap; exit: { x: number; y: number } } {
  exec(project, "create_map", {
    id, name, width, height, tilesetId: "sengoku_edo",
    bgm: { mode: "custom", resourceId: bgm },
  });
  const map = project.maps[id];
  if (!map) throw new Error(`[iron-lotus] 방을 만들지 못했다: ${id}`);
  map.tilesetId = "sengoku_edo";
  map.bgm = { mode: "custom", resourceId: bgm };
  const exit = paintRoom(map, floor, wall);
  return { map, exit };
}

function openCell(project: Project, map: GameMap, x: number, y: number): { x: number; y: number } {
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (!isPassable(project, map, nx, ny)) continue;
    if (map.events.some((event) => event.x === nx && event.y === ny)) continue;
    return { x: nx, y: ny };
  }
  return pickSpot(project, map, { x, y }, new Set(map.events.map((event) => `${event.x},${event.y}`)), 0.25, 2) ?? { x, y };
}

function talker(exec: Exec, project: Project, mapId: string, x: number, y: number, id: string, name: string, texture: string, index: number, line: string, again: string): void {
  exec(project, "place_npc", {
    mapId, x, y, id, name, movement: "fixed",
    graphic: { textureKey: texture, characterIndex: index },
    pages: [
      {
        name: "첫 말",
        commands: [
          { kind: "text", speaker: name, body: line },
          { kind: "setSelfSwitch", key: "A", value: true },
        ],
      },
      {
        name: "다시",
        conditions: [{ kind: "selfSwitch", key: "A", value: true }],
        commands: [{ kind: "text", speaker: name, body: again }],
      },
    ],
  });
}

function carveSpur(map: GameMap, x: number, fromY: number, _x2: number, toY: number): void {
  const y0 = Math.min(fromY, toY);
  const y1 = Math.max(fromY, toY);
  for (let y = y0; y <= y1; y += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const px = x + dx;
      if (px < 0 || px >= map.width || y < 0 || y >= map.height) continue;
      const i = y * map.width + px;
      map.lowerTiles[i] = PATH;
      map.upperTiles[i] = -1;
    }
  }
}

function laySideWood(project: Project, exec: Exec, tryTool: Try, id: string, name: string, width: number, height: number, stream: boolean): string {
  exec(project, "create_map", {
    id, name, width, height, tilesetId: "sengoku_edo",
    bgm: { mode: "custom", resourceId: "cc0-bgm-rtp-fld-002" },
  });
  const map = project.maps[id];
  if (!map) throw new Error(`[iron-lotus] 숲 곁길이 없다: ${id}`);
  map.tilesetId = "sengoku_edo";
  map.bgm = { mode: "custom", resourceId: "cc0-bgm-rtp-fld-002" };
  const pathY = Math.floor(height / 2);
  const path = paintForest(map, pathY, name.includes("덤불"), [[Math.floor(width / 2), pathY]]);
  if (stream) {
    for (let y = pathY - 1; y <= pathY + 1; y += 1) {
      for (let x = 2; x < width - 2; x += 1) {
        if (Math.abs(x - Math.floor(width / 2)) <= 1) continue;
        const i = y * width + x;
        if (path.has(`${x},${y}`)) continue;
        map.lowerTiles[i] = 32;
      }
    }
  }
  return id;
}

type FurnCell = readonly [number, number, number, number];

function placeFurn(map: GameMap, id: string, ox: number, oy: number): void {
  const objects = (roomSpec as { objects: Record<string, { cells: FurnCell[] }> }).objects;
  const obj = objects[id];
  if (!obj) return;
  for (const [dx, dy, tile] of obj.cells) {
    const x = ox + dx;
    const y = oy + dy;
    if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) continue;
    const index = y * map.width + x;
    if (map.lowerTiles[index] === 860 || map.lowerTiles[index] === 864 || map.lowerTiles[index] === 872 || map.lowerTiles[index] === 868) continue;
    map.upperTiles[index] = tile;
  }
}

export function layIronLotusWorld(
  project: Project,
  exec: Exec,
  tryTool: Try,
  ids: { hub: string; grove: string; temple: string },
): IronLotusMapIds {
  const grove = project.maps[ids.grove]!;
  const hub = project.maps[ids.hub]!;
  const temple = project.maps[ids.temple]!;
  const pathY = IL_GROVE_PATH_Y;
  const grovePath = paintForest(grove, pathY, false, [[IL_BATTLE_STAND.x, IL_BATTLE_STAND.y], [IL_BATTLE_FOE.x, IL_BATTLE_FOE.y], [7, pathY], [17, pathY]]);
  for (const event of eventsTo(grove, ids.hub)) { event.x = 1; event.y = pathY; }
  for (const event of eventsTo(grove, ids.temple)) { event.x = grove.width - 2; event.y = pathY; }
  moveEvent(grove, "baek", 7, pathY);
  moveEvent(grove, "inspect", 17, pathY - 1);
  moveEvent(grove, "clue", 17, pathY - 1);
  moveEvent(grove, "puzzle", 17, pathY - 1);
  retarget(hub, ids.grove, ids.grove, 4, pathY, "right");

  const deepId = "il_grove_deep";
  exec(project, "create_map", {
    id: deepId, name: "청죽림 깊숙이", width: 40, height: 32, tilesetId: "sengoku_edo",
    bgm: { mode: "custom", resourceId: "cc0-bgm-rtp-fld-002" },
  });
  const deep = project.maps[deepId];
  if (!deep) throw new Error("[iron-lotus] 깊은 죽림이 없다");
  deep.tilesetId = "sengoku_edo";
  deep.bgm = { mode: "custom", resourceId: "cc0-bgm-rtp-fld-002" };
  const deepPath = paintForest(deep, IL_DEEP_PATH_Y, true);
  const templeLanding = (() => {
    for (const event of grove.events) {
      let landing: { x: number; y: number } | undefined;
      eachCommand(event, (cmd) => {
        if (cmd.kind === "transfer" && (cmd as { mapId?: string }).mapId === ids.temple) {
          landing = { x: (cmd as { x: number }).x, y: (cmd as { y: number }).y };
        }
      });
      if (landing) return landing;
    }
    return { x: 2, y: Math.floor(temple.height / 2) };
  })();
  retarget(grove, ids.temple, deepId, 3, IL_DEEP_PATH_Y, "right");
  retarget(temple, ids.grove, deepId, deep.width - 4, IL_DEEP_PATH_Y, "left");
  door(deep, "ev_il_deep_west", "청죽림 입구", 1, IL_DEEP_PATH_Y, ids.grove, grove.width - 5, pathY, "left");
  door(deep, "ev_il_deep_east", "사원으로", deep.width - 2, IL_DEEP_PATH_Y, ids.temple, templeLanding.x, templeLanding.y, "up");

  carveSpur(grove, 16, pathY, 16, 4);
  const streamId = laySideWood(project, exec, tryTool, "il_grove_stream", "청죽림 물길", 36, 28, true);
  const thicketId = laySideWood(project, exec, tryTool, "il_grove_thicket", "청죽림 가시덤불", 34, 28, false);
  const gladeId = laySideWood(project, exec, tryTool, "il_grove_glade", "별지기 빈터", 30, 24, false);
  carveSpur(project.maps[streamId]!, 18, 14, 18, 26);
  carveSpur(project.maps[streamId]!, 18, 14, 18, 3);
  carveSpur(project.maps[thicketId]!, 16, 14, 16, 26);
  carveSpur(project.maps[thicketId]!, 16, 14, 16, 3);
  carveSpur(project.maps[gladeId]!, 15, 12, 15, 22);
  door(grove, "ev_il_to_stream", "물길로", 16, 4, streamId, 18, 24, "up");
  door(project.maps[streamId]!, "ev_il_stream_back", "죽림으로", 18, 26, ids.grove, 16, 6, "down");
  door(project.maps[streamId]!, "ev_il_stream_thicket", "덤불로", 18, 3, thicketId, 16, 24, "up");
  door(project.maps[thicketId]!, "ev_il_thicket_back", "물길로", 16, 26, streamId, 18, 5, "down");
  door(project.maps[thicketId]!, "ev_il_thicket_glade", "빈터로", 16, 3, gladeId, 15, 20, "up");
  door(project.maps[gladeId]!, "ev_il_glade_back", "덤불로", 15, 22, thicketId, 16, 5, "down");

  fillHoles(hub, COBBLE);
  fillHoles(temple, COBBLE);
  hub.defaultLighting = { ...(hub.defaultLighting ?? { sources: [] }), ambient: hub.defaultLighting?.ambient ?? 0.08, color: hub.defaultLighting?.color ?? "#ffe2b8", sources: hub.defaultLighting?.sources ?? [] };
  temple.defaultLighting = { ambient: 0.45, color: "#141828", sources: temple.defaultLighting?.sources ?? [], vignette: 0.2 };

  const inn = makeRoom(project, exec, "il_inn", "유하진 여관", 22, 16, TATAMI, FUSUMA, "cc0-bgm-rtp-fld-001");
  const shop = makeRoom(project, exec, "il_shop", "살구 약방", 18, 14, WOOD, BOARD, "cc0-bgm-rtp-fld-001");
  const nave = makeRoom(project, exec, "il_nave", "운무산 본당", 24, 18, TATAMI, FUSUMA, "cc0-bgm-rtp-dng-001");
  const annex = makeRoom(project, exec, "il_annex", "운무산 누각", 18, 14, TATAMI_GOLD, FUSUMA_GOLD, "cc0-bgm-rtp-dng-001");
  placeFurn(inn.map, "se-futon", 3, 4);
  placeFurn(inn.map, "se-tansu", 16, 4);
  placeFurn(inn.map, "se-zataku", 8, 8);
  placeFurn(inn.map, "se-zabuton", 7, 10);
  placeFurn(inn.map, "se-zabuton", 11, 10);
  placeFurn(inn.map, "se-andon", 14, 8);
  placeFurn(inn.map, "se-window-shoji", 4, 2);
  placeFurn(shop.map, "se-shop-counter", 6, 6);
  placeFurn(shop.map, "se-goods-shelf", 3, 3);
  placeFurn(shop.map, "se-cash-box", 12, 6);
  placeFurn(shop.map, "se-andon", 13, 4);
  placeFurn(nave.map, "se-dais", 10, 4);
  placeFurn(nave.map, "se-scroll", 4, 3);
  placeFurn(nave.map, "se-kamidana", 16, 3);
  placeFurn(nave.map, "se-taiko", 18, 8);
  placeFurn(annex.map, "se-armor", 3, 4);
  placeFurn(annex.map, "se-sword-rack", 8, 4);
  placeFurn(annex.map, "se-writing-desk", 12, 6);

  const gomo = hub.events.find((event) => event.id.includes("gomo"));
  const salgu = hub.events.find((event) => event.id.includes("salgu"));
  if (gomo) {
    const at = openCell(project, hub, gomo.x, gomo.y);
    exec(project, "create_transfer_pair", {
      a: { mapId: ids.hub, x: at.x, y: at.y },
      b: { mapId: inn.map.id, x: inn.exit.x, y: inn.exit.y },
      fade: "black",
    });
  }
  if (salgu) {
    const at = openCell(project, hub, salgu.x, salgu.y);
    exec(project, "create_transfer_pair", {
      a: { mapId: ids.hub, x: at.x, y: at.y },
      b: { mapId: shop.map.id, x: shop.exit.x, y: shop.exit.y },
      fade: "black",
    });
  }
  const templeDoor = openCell(project, temple, Math.floor(temple.width / 2), Math.min(temple.height - 3, 8));
  exec(project, "create_transfer_pair", {
    a: { mapId: ids.temple, x: templeDoor.x, y: templeDoor.y },
    b: { mapId: nave.map.id, x: nave.exit.x, y: nave.exit.y },
    fade: "black",
  });
  exec(project, "create_transfer_pair", {
    a: { mapId: nave.map.id, x: Math.floor(nave.map.width / 2), y: 2 },
    b: { mapId: annex.map.id, x: annex.exit.x, y: annex.exit.y },
    fade: "black",
  });

  talker(exec, project, deepId, 18, IL_DEEP_PATH_Y - 2, "ev_il_hermit", "대나무 은자", "tex_easyrpg_charset_people5", 5,
    "이 숲의 기운은 독이 아니다.\n검 끝에 실리는 것을, 저 기계 아이는 내공이라 부르지 못하는구나.",
    "길은 동쪽이다. 사원의 문이 별 모양으로 닫혀 있어도, 조각이 있으면 열린다.");
  talker(exec, project, nave.map.id, 6, 6, "ev_il_monk", "사원 지킴이", "tex_easyrpg_charset_people5", 4,
    "천기단은 마당의 향로다.\n누각은 북쪽 계단. 흑련사 발자국이 먼저 올라갔다.",
    "야율검은 향로 앞에서 기다린다. 서두르거라.");
  exec(project, "place_chest", {
    mapId: deepId, x: 28, y: IL_DEEP_PATH_Y - 2, id: "ev_il_chest_deep", name: "이슬 항아리",
    contents: { itemId: "item_potion", count: 2 },
  });
  exec(project, "place_chest", {
    mapId: nave.map.id, x: 16, y: 6, id: "ev_il_chest_nave", name: "시주함",
    contents: { gold: 80 },
  });
  exec(project, "place_chest", {
    mapId: annex.map.id, x: 8, y: 5, id: "ev_il_chest_annex", name: "누각의 함",
    contents: { itemId: "item_ether", count: 1 },
  });
  for (const [mapId, id, style] of [
    [deepId, "ev_il_chest_deep", "jar"],
    [nave.map.id, "ev_il_chest_nave", "chest"],
    [annex.map.id, "ev_il_chest_annex", "drawer"],
  ] as const) {
    const page = project.maps[mapId]?.events.find((event) => event.id === id)?.pages?.[0];
    if (!page || page.commands.some((cmd) => cmd.kind === "showAnimation")) continue;
    page.commands.unshift({ kind: "showAnimation", animationId: `fx:container:${style}`, target: "player", wait: true } as Command);
  }

  const liveInn = project.maps[inn.map.id]!;
  const liveShop = project.maps[shop.map.id]!;
  const liveNave = project.maps[nave.map.id]!;
  const liveAnnex = project.maps[annex.map.id]!;
  for (const map of [liveInn, liveShop, liveNave, liveAnnex]) {
    for (let i = 0; i < map.upperTiles.length; i += 1) map.upperTiles[i] = -1;
  }
  placeFurn(liveInn, "se-futon", 3, 4);
  placeFurn(liveInn, "se-tansu", 16, 4);
  placeFurn(liveInn, "se-zataku", 8, 8);
  placeFurn(liveInn, "se-zabuton", 7, 10);
  placeFurn(liveInn, "se-zabuton", 11, 10);
  placeFurn(liveInn, "se-andon", 14, 8);
  placeFurn(liveInn, "se-window-shoji", 4, 2);
  placeFurn(liveInn, "se-meal-tray", 9, 9);
  placeFurn(liveShop, "se-shop-counter", 6, 6);
  placeFurn(liveShop, "se-goods-shelf", 3, 3);
  placeFurn(liveShop, "se-cash-box", 12, 6);
  placeFurn(liveShop, "se-andon", 13, 4);
  placeFurn(liveShop, "se-kimono-rack", 3, 8);
  placeFurn(liveNave, "se-dais", 10, 4);
  placeFurn(liveNave, "se-scroll", 4, 3);
  placeFurn(liveNave, "se-kamidana", 16, 3);
  placeFurn(liveNave, "se-taiko", 18, 8);
  placeFurn(liveAnnex, "se-armor", 3, 4);
  placeFurn(liveAnnex, "se-sword-rack", 8, 4);
  placeFurn(liveAnnex, "se-writing-desk", 12, 6);
  placeFurn(liveAnnex, "se-go-board", 6, 8);
  // 도구가 프로젝트를 복제하면 그 전에 들고 있던 맵 객체에 찍은 나무는 버려진다. 모든 도구 뒤에 살아있는 맵에 다시 심는다.
  for (const [id, dense] of [
    [ids.grove, false], [deepId, true], [streamId, false], [thicketId, true], [gladeId, false],
  ] as const) {
    const map = project.maps[id];
    if (!map) continue;
    const path = new Set<string>();
    for (let i = 0; i < map.lowerTiles.length; i += 1) {
      const tile = map.lowerTiles[i];
      if (tile === PATH || tile === 5) path.add(`${i % map.width},${Math.floor(i / map.width)}`);
    }
    for (let i = 0; i < map.upperTiles.length; i += 1) map.upperTiles[i] = -1;
    stampForest(project, tryTool, map, path, reserve(map, path, []), dense);
  }
  return {
    hub: ids.hub,
    grove: ids.grove,
    temple: ids.temple,
    deep: deepId,
    inn: inn.map.id,
    shop: shop.map.id,
    nave: nave.map.id,
    annex: annex.map.id,
    stream: streamId,
    thicket: thicketId,
    glade: gladeId,
  };
}
