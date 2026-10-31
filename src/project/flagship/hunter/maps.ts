/**
 * 「사냥꾼 계약」 맵 — 작업자 W. 전부 조수 도구로 짓는다(author_beodeul_town · author_dungeon · build_hand_interior_room ·
 * stamp_tileset_object · create_transfer_pair · set_scene_mood · set_map_properties).
 *
 * 세계 지도는 edit_world_terrain(shared-v9 판타지)을 서쪽 대륙만 잘라 얼린 스냅숏이다(worldmap.json,
 * scripts/content/hunter/bake-worldmap.mts). 빌더는 동기라 월드맵 키트(파이썬)를 부를 수 없다.
 *
 * 무대 좌표표(설계 5.1)는 이 파일이 돌려주는 Stage 다 — 계약·줄기 파일은 이것만 읽는다.
 */
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { type Cell, execTool, mustReach, nearestFree, reachableCells } from "./kit";
import worldSnapshot from "./worldmap.json";

export const M = {
  world: "hc_world",
  swamp: "hc_swamp",
  inn: "hc_swamp_inn",
  nest: "hc_nest",
} as const;

export const BGM = {
  world: "cc0-bgm-rtp-nfs-001",
  swamp: "cc0-bgm-rtp-swm-001",
  inn: "cc0-bgm-rtp-tav-001",
  nest: "cc0-bgm-rtp-dng-001",
  battle: "cc0-bgm-rtp-btl-001",
  boss: "cc0-bgm-rtp-btl-002",
  sorrow: "cc0-bgm-rtp-emo-001",
  mystery: "cc0-bgm-rtp-mys-001",
} as const;

export interface Stage {
  world: { start: Cell; swampGate: Cell; harborGate: Cell; castleGate: Cell };
  swamp: {
    entry: Cell;            // 세계 지도에서 들어오는 서쪽 끝
    innDoor: Cell;          // 여관 문(버들 수상 가옥 loom)
    plaza: Cell;            // 광장
    board: Cell;            // 「장례 마당」 — 시체가 놓인 둔덕
    funeral: Cell;
    widowDoor: Cell;        // 세나의 집 문
    boat: Cell;             // 뱃사공 자리(광장 동쪽 널판)
    dragStart: Cell;        // 끈 자국 시작
    dragTrail: Cell[];      // 끈 자국 ▼ 셋
    nestGate: Cell;         // 늪 깊은 곳으로 가는 남쪽 물가 칸
  };
  inn: { entry: Cell; keeper: Cell; board: Cell; marta: Cell; bed: Cell };
  nest: { entry: Cell; boss: Cell; bossRoom: { x: number; y: number; w: number; h: number }; packs: Cell[]; lake: Cell };
}

type Door = { kit: string; x: number; y: number };

/** 세계 지도 스냅숏을 프로젝트에 심는다. */
function installWorld(project: Project): Stage["world"] {
  const snap = worldSnapshot as unknown as {
    map: GameMap; tileset: TilesetDef; asset: Project["assets"]["uploaded"][string];
    places: { start: Cell; swamp: { entrance: Cell }; harbor: { entrance: Cell }; castle: { entrance: Cell } };
  };
  const map = structuredClone(snap.map);
  map.id = M.world as GameMap["id"];
  map.name = "서쪽 변경";
  project.maps[M.world] = map;
  // 월드맵 키트는 아이콘 그림 4천여 칸을 시트 끝에 이식해 둔다(192×11776px) — WebGL 최대 텍스처 8192 를 넘어 지도가 까맣다.
  // 이 지도가 실제로 쓰는 칸만 남긴다(엔진 쪽 재배치는 별도 PR).
  const ts = structuredClone(snap.tileset);
  const used = new Set([...map.lowerTiles, ...map.upperTiles]);
  ts.tileGrafts = (ts.tileGrafts ?? []).filter((g) => used.has(g.targetTile));
  const rowsNeeded = Math.ceil(Math.max(Math.ceil((snap.asset.meta as { height: number }).height / 16) * ts.tilesPerRow, ...[...used].map((t) => t + 1)) / ts.tilesPerRow);
  ts.count = rowsNeeded * ts.tilesPerRow;
  const perTile = ts as unknown as Record<string, unknown>;
  for (const key of ["passability", "priority", "terrain", "tileMeta"]) if (Array.isArray(perTile[key])) perTile[key] = (perTile[key] as unknown[]).slice(0, ts.count);
  // 지운 칸을 가리키는 붓·묶음·키트는 편집용이라 뺀다(데모 지도는 고정).
  const fits = (o: unknown): boolean => JSON.stringify(o).match(/-?\d+/g)?.every((n) => Number(n) < ts.count) ?? true;
  ts.autotileGroups = (ts.autotileGroups ?? []).filter((g) => g.memberTileIds.every((t) => t < ts.count));
  ts.tileGroups = (ts.tileGroups ?? []).map((g) => ({ ...g, tileIds: g.tileIds.filter((t) => t < ts.count) })).filter((g) => g.tileIds.length > 0);
  ts.structureKits = (ts.structureKits ?? []).filter((k) => fits(k.rows));
  project.tilesets[snap.tileset.id] = ts;
  project.assets.uploaded[snap.asset.id] = structuredClone(snap.asset);
  map.locations = [
    { id: "wm_hc_swamp", name: "갈대늪", x: snap.places.swamp.entrance.x - 1, y: snap.places.swamp.entrance.y - 1, w: 2, h: 2, tags: ["village"], note: "갈대늪 수상 마을" },
    { id: "wm_hc_harbor", name: "버들항", x: snap.places.harbor.entrance.x - 2, y: snap.places.harbor.entrance.y - 3, w: 5, h: 4, tags: ["harbor_city"], note: "성벽 두른 항구 도시" },
    { id: "wm_hc_castle", name: "회색봉", x: snap.places.castle.entrance.x - 1, y: snap.places.castle.entrance.y - 2, w: 3, h: 3, tags: ["castle"], note: "산 위의 무너진 성채" },
  ] as GameMap["locations"];
  return { start: snap.places.start, swampGate: snap.places.swamp.entrance, harborGate: snap.places.harbor.entrance, castleGate: snap.places.castle.entrance };
}

/** 소품 하나를 찍어 본다. 거부되거나 꼭 닿아야 할 길이 끊기면 되돌린다. */
export function tryStamp(project: Project, mapId: string, objectId: string, base: Cell, keep: () => boolean = () => true): boolean {
  const saved = structuredClone(project.maps[mapId]!);
  try {
    execTool(project, "stamp_tileset_object", { mapId, objectId, base });
  } catch {
    project.maps[mapId] = saved;
    return false;
  }
  if (!keep()) { project.maps[mapId] = saved; return false; }
  return true;
}

const reachesAll = (project: Project, mapId: string, from: Cell, targets: readonly Cell[]): boolean => {
  const seen = new Set(reachableCells(project, project.maps[mapId]!, from).map((c) => `${c.x},${c.y}`));
  return targets.every((t) => seen.has(`${t.x},${t.y}`));
};

export function buildMaps(project: Project): Stage {
  const world = installWorld(project);

  // ── 갈대늪 — 버들항 늪 수상 마을(시드 7). 서쪽 끝이 입구, 마른 둔덕 동쪽 반쪽에 집이 모였다.
  const town = execTool(project, "author_beodeul_town", { id: M.swamp, name: "갈대늪", theme: "swamp", seed: 7, width: 56, height: 44 });
  const td = town.data as { doors: Door[]; plaza?: Cell; entrance?: Cell; gathering?: { door: Cell } };
  const entry = td.entrance ?? { x: 0, y: 19 };
  const innDoor = td.doors.find((d) => d.kit.includes("loom")) ?? td.doors[0]!;
  const widowDoor = td.doors.find((d) => d.kit.includes("e2")) ?? td.doors[td.doors.length - 1]!;
  const plaza = td.plaza ? { x: td.plaza.x, y: td.plaza.y } : { x: 45, y: 16 };

  // 아무도 살지 않는 남쪽 늪 — 맵을 지은 대로 두면 아래 12줄이 전부 물이다(빈 바닥은 메우지 말고 줄인다).
  // resize_map 은 집 보호 영역(집 둘레 여유 칸)에 걸리면 통째로 거절한다 — 닿는 가장 짧은 높이를 찾는다.
  for (const h of [34, 35, 36, 37, 38, 39, 40, 41, 42]) {
    try { execTool(project, "resize_map", { mapId: M.swamp, width: 56, height: h }); if (process.env.HC_WARN) console.warn(`[hunter] 늪 높이 ${h}`); break; }
    catch (e) { if (process.env.HC_WARN) console.warn(`[hunter] 늪 높이 ${h} 거절: ${String((e as Error).message).slice(0, 300)}`); }
  }

  // 실내 — 늪 여관(촌장 하그네가 묵는다). 손 도트 v5 선술집.
  const inn = execTool(project, "build_hand_interior_room", { mapId: M.inn, name: "갈대늪 여관", replace: true, layout: { program: "tavern", seed: 3, furnish: true } });
  const innData = inn.data as { entrance: Cell[] };
  const innEntry = innData.entrance[0] ?? { x: 7, y: 17 };
  execTool(project, "create_transfer_pair", {
    a: { mapId: M.swamp, x: innDoor.x, y: innDoor.y, doorAt: { x: innDoor.x, y: innDoor.y - 1 } },
    b: { mapId: M.inn, x: innEntry.x, y: innEntry.y }, fade: "black",
  });

  // 늪 깊은 곳 — 늪 던전(작게, 시드 4). 마을 남쪽 둔덕 끝에서 들어간다.
  const swampMap = project.maps[M.swamp]!;
  const reach = reachableCells(project, swampMap, entry);
  // 남쪽 끝(장례 마당 아래 둔덕 31줄 근처)에서 물가에 가장 가까운 칸.
  const south = reach.reduce((best, c) => (c.y > best.y || (c.y === best.y && Math.abs(c.x - 38) < Math.abs(best.x - 38)) ? c : best), reach[0]!);
  const nest = execTool(project, "author_dungeon", { id: M.nest, name: "늪 깊은 곳", type: "swamp", adapter: "beodeul", genre: "rpg", seed: 4, size: "small", populate: false,
    entrance: { fromMapId: M.swamp, x: south.x, y: south.y } });
  type Room = { id: string; kind: string; x: number; y: number; w: number; h: number; spots: Cell[] };
  const nd = nest.data as { entrance: Cell; rooms: Room[]; population?: { boss?: Cell } };
  const bossRoom = nd.rooms.find((r) => r.kind === "boss")!;
  const lake = nd.rooms.find((r) => r.kind === "lake") ?? nd.rooms[1]!;
  const vault = nd.rooms.find((r) => r.kind === "vault");

  // ── 늪의 무대 — 장례 마당(광장 서쪽 둔덕), 끈 자국(장례 마당 → 남쪽 물가).
  const swampNow = project.maps[M.swamp]!;
  const avoid = [innDoor, widowDoor, plaza];
  const funeral = nearestFree(project, swampNow, { x: 38, y: 22 }, avoid);
  const boat = nearestFree(project, swampNow, { x: 41, y: 19 }, [...avoid, funeral]);
  // 장례 마당 소품 — 무덤 둘·길가 십자가. 입구→여관·물가 길을 끊지 않는 것만.
  const mustCells = [innDoor, { x: innDoor.x, y: innDoor.y + 1 }, south, funeral, boat, { x: widowDoor.x, y: widowDoor.y + 1 }];
  const keep = () => reachesAll(project, M.swamp, entry, mustCells);
  let props = 0;
  for (const [id, at] of [
    ["bd-pick-desert-oasis-grave", { x: funeral.x - 3, y: funeral.y + 1 }],
    ["bd-pick-desert-oasis-grave", { x: funeral.x + 2, y: funeral.y + 1 }],
    ["bd-pick-mountain-pass-wayside-cross", { x: funeral.x - 1, y: funeral.y - 2 }],
    ["bd-pick-swamp-stilt-lantern", { x: plaza.x + 3, y: plaza.y - 3 }],
    ["bd-pick-swamp-stilt-crab-trap", { x: boat.x + 2, y: boat.y + 1 }],
    ["bd-prop-net_rack", { x: boat.x - 3, y: boat.y - 2 }],
  ] as const) if (tryStamp(project, M.swamp, id, at, keep)) props++;
  if (process.env.HC_WARN) console.warn(`[hunter] 늪 소품 ${props}`);

  // 끈 자국 — 장례 마당에서 남쪽 물가 입구까지 걸어서 닿는 길 위 세 칸(▼ 표식).
  const path = shortestPath(project, project.maps[M.swamp]!, funeral, south);
  const trail = [path[Math.floor(path.length * 0.3)]!, path[Math.floor(path.length * 0.6)]!, path[Math.max(0, path.length - 2)]!];

  // ── 늪 여관 — 주인 베일(카운터 뒤), 게시판(벽), 하그네(창가 탁자).
  const innMap = project.maps[M.inn]!;
  // 선술집은 가구 사이가 한 칸 통로다. 서 있는 사람(주인·하그네)이 통로를 막으면 게시판·침대에 못 간다(2026-10-31 통짜 플레이에서
  // 주인이 카운터 뒤 통로 (3,12)에 서서 게시판·침대 쪽이 통째로 끊겼다). 게시판·침대를 먼저 정하고, 주인·하그네는 그 길을 끊지 않는 칸에 세운다.
  const innFrom = { x: innEntry.x, y: innEntry.y - 1 };
  const board = nearestFree(project, innMap, { x: 3, y: 10 }, [innEntry]);
  const bed = nearestFree(project, innMap, { x: 2, y: 5 }, [innEntry, board]);
  const standClear = (others: Cell[]) => (c: Cell) => reachesAround(project, innMap, innFrom, [board, bed, c, ...others], [c, ...others]);
  const keeper = nearestFreeWhere(project, innMap, { x: 4, y: 11 }, [innEntry, board, bed], standClear([]));   // 카운터 곁
  const marta = nearestFreeWhere(project, innMap, { x: 11, y: 12 }, [innEntry, keeper, board, bed], standClear([keeper]));
  mustReach(project, innMap, innFrom, keeper, "여관 입구 → 주인");
  // 게시판 그림(실내 v5 notice board) — 벽 앞에 세운다(설계 2.6 기본안: 게시판은 실내 벽에).
  tryStamp(project, M.inn, "hand-interior:notice board", { x: board.x, y: board.y - 1 }, () => reachesAll(project, M.inn, { x: innEntry.x, y: innEntry.y - 1 }, [keeper, board, marta]));

  // ── 맵 분위기 — 늪은 안개, 둥지는 어둡게.
  execTool(project, "set_scene_mood", { mapId: M.swamp, weather: { kind: "fog", intensity: 0.35 } });
  execTool(project, "set_scene_mood", { mapId: M.nest, weather: { kind: "fog", intensity: 0.6 }, lighting: { ambient: 0.45, color: "#0b1626", sources: [{ id: "hc_lamp", at: { kind: "player" }, radius: 5, intensity: 0.9, color: "#ffcf8a", flicker: 0.15 }] } });
  execTool(project, "set_scene_mood", { mapId: M.inn, lighting: { ambient: 0.2, color: "#1a1206", sources: [] } });

  const packs = [lake.spots[0] ?? { x: 11, y: 12 }, lake.spots[2] ?? { x: 7, y: 12 }, vault?.spots[0] ?? { x: 21, y: 22 }];
  return {
    world,
    swamp: { entry, innDoor: { x: innDoor.x, y: innDoor.y }, plaza, board: funeral, funeral, widowDoor: { x: widowDoor.x, y: widowDoor.y }, boat, dragStart: funeral, dragTrail: trail, nestGate: south },
    inn: { entry: innEntry, keeper, board, marta, bed },
    nest: { entry: nd.entrance, boss: nd.population?.boss ?? bossRoom.spots[0] ?? { x: 19, y: 9 }, bossRoom, packs, lake: lake.spots[1] ?? { x: 4, y: 16 } },
  };
}

/** want 근처 빈 칸 중 ok() 가 참인 가장 가까운 칸. */
function nearestFreeWhere(project: Project, map: GameMap, want: Cell, avoid: readonly Cell[], ok: (c: Cell) => boolean, maxR = 8): Cell {
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const c = { x: want.x + dx, y: want.y + dy };
      if (c.x < 0 || c.y < 0 || c.x >= map.width || c.y >= map.height) continue;
      if (!isPassable(project, map, c.x, c.y)) continue;
      if (map.events.some((e) => e.x === c.x && e.y === c.y) || avoid.some((a) => a.x === c.x && a.y === c.y)) continue;
      if (ok(c)) return c;
    }
  }
  throw new Error(`[hunter] ${map.id} 에 ${want.x},${want.y} 근처에 길을 막지 않는 빈 칸이 없다`);
}
/** from 에서 targets 마다 그 칸 또는 옆 칸에 닿는가 — blockers 칸(서 있는 사람)은 밟지 못한다. */
function reachesAround(project: Project, map: GameMap, from: Cell, targets: readonly Cell[], blockers: readonly Cell[]): boolean {
  const key = (x: number, y: number) => `${x},${y}`;
  const block = new Set(blockers.map((b) => key(b.x, b.y)));
  const seen = new Set([key(from.x, from.y)]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const c = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy };
      const k = key(n.x, n.y);
      if (seen.has(k) || block.has(k) || n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height) continue;
      if (!canMove(project, map, c.x, c.y, n.x, n.y)) continue;
      seen.add(k); queue.push(n);
    }
  }
  return targets.every((t) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(key(t.x + dx!, t.y + dy!)) && !block.has(key(t.x + dx!, t.y + dy!))));
}

/** BFS 최단 길(칸 목록, 시작·끝 포함). 길이 없으면 던진다. */
export function shortestPath(project: Project, map: GameMap, from: Cell, to: Cell): Cell[] {
  const key = (c: Cell) => `${c.x},${c.y}`;
  const prev = new Map<string, Cell | null>([[key(from), null]]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const c = queue.shift()!;
    if (c.x === to.x && c.y === to.y) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy };
      if (prev.has(key(n)) || n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height) continue;
      if (!reachableStep(project, map, c, n)) continue;
      prev.set(key(n), c); queue.push(n);
    }
  }
  if (!prev.has(key(to))) throw new Error(`[hunter] ${map.id}: (${from.x},${from.y}) → (${to.x},${to.y}) 길이 없다`);
  const out: Cell[] = [];
  for (let c: Cell | null = to; c; c = prev.get(key(c)) ?? null) out.unshift(c);
  return out;
}
import { canMove, isPassable } from "@/project/collision";
const reachableStep = (project: Project, map: GameMap, a: Cell, b: Cell) => canMove(project, map, a.x, a.y, b.x, b.y);
