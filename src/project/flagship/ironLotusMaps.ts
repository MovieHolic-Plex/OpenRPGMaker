/**
 * 장 구성기가 깔아 둔 무가 저택·빈 칸을 걷어 내고, 청죽림·사원·마을 실내가
 * 이름과 같게 읽히도록 다시 깐다. 타일셋은 sengoku_edo 하나다.
 */
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

function paintForest(map: GameMap, pathY: number, dense: boolean): void {
  const n = map.width * map.height;
  map.lowerTiles = new Array<number>(n);
  map.upperTiles = new Array<number>(n).fill(-1);
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const onPath = Math.abs(y - pathY) <= 1 && x > 0 && x < map.width - 1;
      const edge = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
      let tile = GRASS;
      if (onPath) tile = PATH;
      else if (edge) tile = DARK;
      else if ((x * 5 + y * 3) % 13 === 0) tile = FLOWER;
      else if ((x + y * 2) % (dense ? 3 : 5) === 0) tile = DARK;
      map.lowerTiles[y * map.width + x] = tile;
    }
  }
  map.lowerTiles[pathY * map.width] = PATH;
  map.lowerTiles[pathY * map.width + map.width - 1] = PATH;
  map.defaultLighting = {
    ambient: dense ? 0.38 : 0.2,
    color: dense ? "#0c2418" : "#1c3a28",
    sources: [],
    vignette: dense ? 0.28 : 0.14,
  };
  map.mapRole = "field";
}

function fillHoles(map: GameMap, tile: number): void {
  for (let i = 0; i < map.lowerTiles.length; i += 1) if (map.lowerTiles[i] === 0) map.lowerTiles[i] = tile;
}

function stampOne(project: Project, tryTool: Try, map: GameMap, reserved: Set<string>, x: number, y: number, kit: "se-bamboo" | "se-tree-pine-small"): boolean {
  const w = 2;
  const h = kit === "se-bamboo" ? 3 : 2;
  if (x < 1 || y < 1 || x + w >= map.width || y + h >= map.height) return false;
  for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) if (reserved.has(`${x + dx},${y + dy}`)) return false;
  const ok = tryTool(project, "stamp_object", {
    objectId: `kit:sengoku_edo/${kit}`, mapId: map.id, x, y, layers: "upper", onOverlap: "nearest",
  });
  if (!ok) return false;
  for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) reserved.add(`${x + dx},${y + dy}`);
  return true;
}

function stampForest(project: Project, tryTool: Try, map: GameMap, pathY: number, reserved: Set<string>, dense: boolean): void {
  // 대나무(2×3)의 발이 흙길(pathY±1)에 걸치지 않게, 길 바로 위·아래에 줄을 세운다.
  for (let x = 2; x < map.width - 4; x += 3) {
    stampOne(project, tryTool, map, reserved, x, pathY - 4, "se-bamboo");
    stampOne(project, tryTool, map, reserved, x + 1, pathY + 2, "se-bamboo");
  }
  const step = dense ? 3 : 5;
  for (let y = 2; y < map.height - 4; y += step) {
    if (Math.abs(y - pathY) <= 4) continue;
    for (let x = 2; x < map.width - 4; x += step) {
      if ((x + y) % (dense ? 2 : 3) === 0) continue;
      stampOne(project, tryTool, map, reserved, x, y, (x + y) % 5 === 0 ? "se-tree-pine-small" : "se-bamboo");
    }
  }
}

function reserve(map: GameMap, pathY: number, extra: ReadonlyArray<readonly [number, number, number, number]>): Set<string> {
  const out = new Set<string>();
  for (let y = pathY - 1; y <= pathY + 1; y += 1) for (let x = 0; x < map.width; x += 1) out.add(`${x},${y}`);
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
  paintForest(grove, pathY, false);
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
  paintForest(deep, IL_DEEP_PATH_Y, true);
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

  stampForest(project, tryTool, grove, pathY, reserve(grove, pathY, [[14, 12, 22, 17], [28, 15, 32, 19]]), false);
  stampForest(project, tryTool, deep, IL_DEEP_PATH_Y, reserve(deep, IL_DEEP_PATH_Y, [[16, 12, 22, 16], [26, 13, 30, 16]]), true);

  fillHoles(hub, COBBLE);
  fillHoles(temple, COBBLE);
  hub.defaultLighting = { ...(hub.defaultLighting ?? { sources: [] }), ambient: hub.defaultLighting?.ambient ?? 0.08, color: hub.defaultLighting?.color ?? "#ffe2b8", sources: hub.defaultLighting?.sources ?? [] };
  temple.defaultLighting = { ambient: 0.45, color: "#141828", sources: temple.defaultLighting?.sources ?? [], vignette: 0.2 };

  const inn = makeRoom(project, exec, "il_inn", "유하진 여관", 22, 16, TATAMI, FUSUMA, "cc0-bgm-rtp-fld-001");
  const shop = makeRoom(project, exec, "il_shop", "살구 약방", 18, 14, WOOD, BOARD, "cc0-bgm-rtp-fld-001");
  const nave = makeRoom(project, exec, "il_nave", "운무산 본당", 24, 18, TATAMI, FUSUMA, "cc0-bgm-rtp-dng-001");
  const annex = makeRoom(project, exec, "il_annex", "운무산 누각", 18, 14, TATAMI_GOLD, FUSUMA_GOLD, "cc0-bgm-rtp-dng-001");

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

  return {
    hub: ids.hub,
    grove: ids.grove,
    temple: ids.temple,
    deep: deepId,
    inn: inn.map.id,
    shop: shop.map.id,
    nave: nave.map.id,
    annex: annex.map.id,
  };
}
