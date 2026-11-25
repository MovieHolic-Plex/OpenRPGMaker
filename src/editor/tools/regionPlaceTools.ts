// editor/tools/regionPlaceTools.ts
// 영역 지시 한 번으로 끝나는 장소 레시피 — 「여기에 상점 만들어 줘」(오너 2026-11-24:
// 「거기다가 건물에다가 실내까지 지어야하는데?」).
//
// 예전에는 영역 지시가 「이 맵의 이 사각형만」이라 상점을 시키면 외관만 서거나(실내 없음), 실내가 일반 채팅으로
// 빠져 결과 카드가 사라졌다. 재료 도구는 다 있었다 — 외관(place_terrain_house·build_house), 실내(build_hand_interior_room
// layout.program), 왕복 문(create_transfer_pair), 주인(place_npc 의 shop·inn 명령), 던전(author_dungeon entrance).
// 모델이 그 다섯을 순서·좌표·품목까지 맞게 잇는 것이 매번 틀리는 자리라, 이 도구가 한 번에 결정적으로 잇는다.
//
// 계약:
// - 바깥 맵에서 바뀌는 칸은 영역 사각형 안뿐이다(외관과 문 앞 칸이 영역 안에 서지 않으면 거부한다).
// - 영역 밖에서 생기는 것은 **새 맵**(실내·던전)과 그 맵의 이벤트뿐이다. 결과 data.createdMapIds 로 알린다.
// - 복제본에서 다 지은 뒤 한 번에 반영한다 — 중간에 실패하면 아무것도 남지 않는다.
// - 품목은 이 게임의 데이터베이스에서 고른다(없는 아이템을 만들지 않는다). 고를 것이 없으면 경고로 알린다.
import type { MapId, MapTreeNode, Project } from "@/project/types";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import type { RegionPlaceKind } from "@/ai/regionPlaceIntent";

export { regionPlaceKindFromText, type RegionPlaceKind } from "@/ai/regionPlaceIntent";

let lookup: (name: string) => ToolDefinition | undefined = () => undefined;
/** toolRegistry 가 묶는다(순환 import 를 피한다 — jpCityStreetTool 과 같은 방식). */
export function bindRegionPlaceToolLookup(fn: (name: string) => ToolDefinition | undefined): void { lookup = fn; }

type Goods = "consumables" | "arms" | "food" | "none";
type Keeper = "shop" | "inn" | "talk";

interface BuildingRecipe {
  readonly kind: RegionPlaceKind;
  readonly label: string;
  readonly layout: { readonly program: string } | { readonly rooms: readonly { readonly kind: string }[] };
  /** 주인을 세울 방 종류 낱말(layout.rooms[].kind 에 이 낱말이 들면 그 방). */
  readonly counterRoom: RegExp;
  readonly keeper: Keeper;
  readonly keeperName: string;
  readonly keeperGraphic: string;
  readonly goods: Goods;
  readonly greeting: string;
  readonly big: boolean;
  readonly savepoint?: boolean;
  /**
   * 버들항 외관을 이 구조 키트(입구 부위 있는 건물)에서 먼저 고른다 — 창고·마구간·등대처럼 살림집 키트로는 안 되는 모양.
   * onlyKits 면 살림집·기본 마을 집으로 대신하지 않는다(등대·풍차를 집으로 세우지 않는다).
   */
  readonly kits?: readonly string[];
  readonly onlyKits?: boolean;
}

interface DungeonRecipe {
  readonly kind: RegionPlaceKind;
  readonly label: string;
  readonly dungeonType: "cave" | "catacomb";
}

const BUILDINGS: readonly BuildingRecipe[] = [
  { kind: "shop", label: "도구점", layout: { rooms: [{ kind: "pharmacy_shop" }, { kind: "storeroom" }] }, counterRoom: /shop/, keeper: "shop", keeperName: "도구점 주인", keeperGraphic: "상인", goods: "consumables", greeting: "어서 오세요. 천천히 보세요.", big: true },
  { kind: "weapon_shop", label: "무기점", layout: { rooms: [{ kind: "weapon_shop" }, { kind: "storeroom" }] }, counterRoom: /shop/, keeper: "shop", keeperName: "무기점 주인", keeperGraphic: "상인", goods: "arms", greeting: "좋은 물건만 있습니다.", big: true },
  { kind: "smithy", label: "대장간", layout: { program: "smithy" }, counterRoom: /shop|forge/, keeper: "shop", keeperName: "대장장이", keeperGraphic: "대장장이", goods: "arms", greeting: "쇠는 달궈졌을 때 두드려야지.", big: true },
  { kind: "inn", label: "여관", layout: { program: "inn" }, counterRoom: /inn|lobby|hall|tavern|bar|front/, keeper: "inn", keeperName: "여관 주인", keeperGraphic: "여관", goods: "none", greeting: "먼 길 오셨네요. 쉬어 가세요.", big: true },
  { kind: "tavern", label: "주점", layout: { program: "tavern" }, counterRoom: /tavern|bar|hall/, keeper: "shop", keeperName: "주점 주인", keeperGraphic: "상인", goods: "food", greeting: "한 잔 하고 가요. 소문도 덤이에요.", big: true },
  { kind: "house", label: "집", layout: { rooms: [{ kind: "kitchen" }, { kind: "bedroom" }] }, counterRoom: /kitchen|living|hall/, keeper: "talk", keeperName: "집주인", keeperGraphic: "마을 사람", goods: "none", greeting: "어머, 손님이 다 오시고.", big: false },
  { kind: "chapel", label: "교회", layout: { program: "chapel" }, counterRoom: /chapel|nave/, keeper: "talk", keeperName: "신부", keeperGraphic: "신부", goods: "none", greeting: "이곳에서 마음을 쉬어 가세요.", big: true, savepoint: true },
  { kind: "bakery", label: "빵집", layout: { program: "bakery" }, counterRoom: /shop/, keeper: "shop", keeperName: "빵집 주인", keeperGraphic: "상인", goods: "food", greeting: "갓 구운 빵 있어요!", big: true },
  { kind: "pharmacy", label: "약방", layout: { program: "pharmacy" }, counterRoom: /shop/, keeper: "shop", keeperName: "약방 주인", keeperGraphic: "상인", goods: "consumables", greeting: "다친 데는 없으세요?", big: true },
  { kind: "warehouse", label: "창고", layout: { rooms: [{ kind: "storeroom" }, { kind: "cellar" }] }, counterRoom: /storeroom/, keeper: "talk", keeperName: "창고지기", keeperGraphic: "마을 사람", goods: "none", greeting: "함부로 만지지 마쇼. 다 주인 있는 물건이오.", big: true,
    kits: ["bd-house-ware0", "bd-pick-mining-valley-s2", "bd-pick-snowfield-shed"] },
  { kind: "stable", label: "마구간", layout: { rooms: [{ kind: "stable" }, { kind: "tack_room" }] }, counterRoom: /stable|tack/, keeper: "talk", keeperName: "마부", keeperGraphic: "마을 사람", goods: "none", greeting: "말들이 오늘따라 순하네요.", big: false,
    kits: ["bd-house-cstable", "bd-house-estable"] },
  { kind: "school", label: "학교", layout: { rooms: [{ kind: "study" }, { kind: "library" }] }, counterRoom: /study|library/, keeper: "talk", keeperName: "선생님", keeperGraphic: "학자", goods: "none", greeting: "배움에는 늦은 때가 없단다.", big: true,
    kits: ["bd-house-h122_0", "bd-house-h119_0"] },
  { kind: "guard_post", label: "경비 초소", layout: { rooms: [{ kind: "guard_room" }, { kind: "armory" }] }, counterRoom: /guard/, keeper: "talk", keeperName: "경비병", keeperGraphic: "병사", goods: "none", greeting: "수상한 자는 못 지나간다.", big: false,
    kits: ["bd-pick-mountain-pass-guard-post", "bd-house-barracks"] },
  { kind: "windmill", label: "풍차", layout: { rooms: [{ kind: "storeroom" }, { kind: "kitchen" }] }, counterRoom: /storeroom|kitchen/, keeper: "talk", keeperName: "방앗간 주인", keeperGraphic: "마을 사람", goods: "none", greeting: "바람만 좋으면 밀가루는 얼마든지요.", big: false,
    kits: ["bd-house-mill1"], onlyKits: true },
  { kind: "lighthouse", label: "등대", layout: { rooms: [{ kind: "study" }, { kind: "bedroom" }] }, counterRoom: /study/, keeper: "talk", keeperName: "등대지기", keeperGraphic: "마을 사람", goods: "none", greeting: "불이 꺼지면 배들이 길을 잃지.", big: false,
    kits: ["bd-pick-fishing-port-lighthouse"], onlyKits: true },
];

const DUNGEONS: readonly DungeonRecipe[] = [
  { kind: "dungeon_entrance", label: "던전", dungeonType: "catacomb" },
  { kind: "cave_entrance", label: "동굴", dungeonType: "cave" },
];

/**
 * 실내 없이 영역 안에만 서는 장소(다리·성문·농장·시장). 버들항 구조 키트를 정해진 자리에 찍고 사람 하나를 세운다.
 * 키트는 버들항 칩셋에만 있어 다른 칩셋은 거부한다.
 */
interface OutdoorRecipe {
  readonly kind: RegionPlaceKind;
  readonly label: string;
  readonly min: { readonly width: number; readonly height: number };
  readonly build: (work: Project, mapId: MapId, region: Rect) => OutdoorBuilt;
}

interface OutdoorBuilt {
  readonly pieces: string[];
  readonly npc?: { readonly x: number; readonly y: number; readonly name: string; readonly graphic: string; readonly lines: string[]; readonly commands?: Record<string, unknown>[] };
  readonly warnings?: string[];
}

const BD = "beodeul_city";

function stampKit(work: Project, mapId: MapId, kitId: string, x: number, y: number): void {
  callTool(work, "stamp_object", { objectId: `kit:${BD}/${kitId}`, mapId, x, y });
}

function kitDef(work: Project, kitId: string): { width: number; height: number; rows: { tiles: number[]; upperTiles?: number[] }[] } {
  const kit = work.tilesets[BD]?.structureKits?.find((entry) => entry.id === kitId) as { width: number; height: number; rows: { tiles: number[]; upperTiles?: number[] }[] } | undefined;
  if (!kit) throw new ToolError(`버들항 키트 ${kitId} 가 없다`, { code: "kit-not-found" });
  return kit;
}

/** 강 조각(남북 4×4)의 줄을 돌려 가며 아래층에 칠한다 — 영역 높이가 4의 배수가 아니어도 영역 안에서 끝난다. */
function paintRiver(work: Project, mapId: MapId, x: number, y0: number, y1: number): void {
  const map = requireMap(work, mapId);
  const river = kitDef(work, "bd-river-straight-ns");
  for (let y = y0; y < y1; y += 1) {
    const row = river.rows[(y - y0) % river.height]!;
    for (let dx = 0; dx < river.width; dx += 1) {
      const i = y * map.width + x + dx;
      if (row.tiles[dx]! >= 0) map.lowerTiles[i] = row.tiles[dx]!;
      map.upperTiles[i] = row.upperTiles?.[dx] ?? -1;
    }
  }
}

/**
 * 영역 가운데 줄에 이미 물(강 조각·버들항 물·강/운하 오토타일)이 있으면 그 물줄기 가운데에 맞춘 폭 4칸의 왼쪽 열.
 * 물이 없으면 null. 다리는 폭 4칸 남북 강 조각에 맞게 그려져 있어, 물줄기는 다시 강 조각으로 고른다.
 */
function riverColumn(work: Project, mapId: MapId, region: Rect): number | null {
  const map = requireMap(work, mapId);
  const tileset = work.tilesets[BD];
  const water = new Set<number>([
    ...kitDef(work, "bd-river-straight-ns").rows.flatMap((row) => row.tiles),
    ...(tileset?.tileGroups ?? []).filter((group) => group.id === "beodeul:water").flatMap((group) => group.tileIds),
    ...(tileset?.autotileGroups ?? []).filter((group) => group.id === "beodeul_canal_lake_47").flatMap((group) => group.memberTileIds),
  ]);
  const y = region.y + Math.floor(region.height / 2);
  const wet: number[] = [];
  for (let x = region.x; x < region.x + region.width; x += 1) if (water.has(map.lowerTiles[y * map.width + x]!)) wet.push(x);
  if (wet.length === 0) return null;
  const middle = Math.round((wet[0]! + wet[wet.length - 1]!) / 2);
  return Math.min(Math.max(middle - 2, region.x), region.x + region.width - 4);
}

const OUTDOORS: readonly OutdoorRecipe[] = [
  {
    kind: "bridge", label: "다리", min: { width: 6, height: 7 },
    build(work, mapId, region) {
      const found = riverColumn(work, mapId, region);
      const x = found ?? region.x + Math.floor((region.width - 4) / 2);
      const bridgeY = region.y + Math.floor((region.height - 5) / 2);
      const warnings: string[] = [];
      paintRiver(work, mapId, x, region.y, region.y + region.height);
      if (found === null) {
        warnings.push(`영역에 강이 없어 남북으로 흐르는 강(폭 4칸, x ${x}~${x + 3})을 영역 안에만 냈다 — 강을 더 잇으려면 영역을 위아래로 더 잡는다`);
      }
      stampKit(work, mapId, "bd-bridge-arch", x, bridgeY);
      const npcX = x + 4 < region.x + region.width ? x + 4 : x - 1;
      return { pieces: [found === null ? "강(남북)" : "있던 강", "아치 다리"], warnings,
        npc: { x: npcX, y: bridgeY + 2, name: "다리지기", graphic: "마을 사람", lines: ["이 다리 덕에 강 건너 마을까지 반나절이면 가지."] } };
    },
  },
  {
    kind: "gate", label: "성문", min: { width: 4, height: 9 },
    build(work, mapId, region) {
      const wallY = region.y + region.height - 8;
      const runs = Math.floor((region.width - 4) / 8);
      const gateX = region.x + Math.floor((region.width - 4 - runs * 8) / 2) + runs * 4;
      stampKit(work, mapId, "bd-wall-gatehouse", gateX, wallY - 1);
      for (let i = 0; i < runs; i += 1) {
        stampKit(work, mapId, "bd-wall-run-south-4", gateX - 4 * (i + 1), wallY);
        stampKit(work, mapId, "bd-wall-run-south-4", gateX + 4 + 4 * i, wallY);
      }
      const guardX = gateX + 3 + 1 < region.x + region.width ? gateX + 4 : gateX - 1;
      return { pieces: ["성문루(열린 아치)", ...(runs > 0 ? [`성벽 토막 ${runs * 2}`] : [])],
        npc: { x: guardX, y: wallY + 6, name: "문지기", graphic: "병사", lines: ["해가 지기 전에는 문을 닫는다. 서두르게."] } };
    },
  },
  {
    kind: "farm", label: "농장", min: { width: 9, height: 7 },
    build(work, mapId, region) {
      const fieldX = region.x + Math.floor((region.width - 8) / 2);
      const rows = region.height >= 11 ? 2 : 1;
      for (let r = 0; r < rows; r += 1) stampKit(work, mapId, "bd-pick-vineyard-vine-field", fieldX, region.y + 1 + r * 4);
      const fenceY = region.y + 1 + rows * 4;
      const fences = Math.floor(region.width / 4);
      const fenceX = region.x + Math.floor((region.width - fences * 4) / 2);
      for (let i = 0; i < fences; i += 1) stampKit(work, mapId, "bd-out-fence-run", fenceX + i * 4, fenceY);
      return { pieces: [`밭 8×${rows * 4}`, `울타리 ${fences}`],
        npc: { x: fenceX + 2, y: Math.min(fenceY + 1, region.y + region.height - 1), name: "농부", graphic: "마을 사람", lines: ["올해 포도는 달게 익었어. 밭은 밟지 말고 사잇길로 다니게."] } };
    },
  },
  {
    kind: "market", label: "시장", min: { width: 10, height: 9 },
    build(work, mapId, region) {
      const x = region.x + Math.floor((region.width - 10) / 2);
      const y = region.y + Math.floor((region.height - 9) / 2);
      stampKit(work, mapId, "bd-block-market-10x8", x, y);
      const goods = pickGoods(work, "food");
      return { pieces: ["시장 블록(노점·우물·가로등)"],
        ...(goods.length ? {} : { warnings: ["이 게임 데이터베이스에 팔 만한 소모품이 없어 상인은 인사만 한다"] }),
        npc: { x: x + 4, y: y + 8, name: "시장 상인", graphic: "상인", lines: ["오늘 들어온 물건이에요, 구경하고 가세요!"],
          commands: goods.length ? [{ kind: "shop", itemIds: goods, allowSell: true, title: "시장" }] : [] } };
    },
  },
  {
    // 영역을 3×3 나무로 엇갈려 채우고 가운데에 남북 오솔길(폭 2)을 비워 둔다 — 숲이 길을 막지 않게.
    kind: "forest", label: "숲", min: { width: 8, height: 6 },
    build(work, mapId, region) {
      const trees = ["bd-tree-03a8f7", "bd-tree-3e8732", "bd-tree-a80c85", "bd-tree-7ecdb8"];
      const pathX = region.x + Math.floor(region.width / 2) - 1;
      let planted = 0;
      for (let row = 0; region.y + row * 3 + 3 <= region.y + region.height; row += 1) {
        const y = region.y + row * 3;
        for (let x = region.x + (row % 2); x + 3 <= region.x + region.width; x += 3) {
          if (x < pathX + 2 && x + 3 > pathX) continue;
          stampKit(work, mapId, trees[planted % trees.length]!, x, y);
          planted += 1;
        }
      }
      return { pieces: [`나무 ${planted}그루`, "가운데 남북 오솔길(폭 2)"] };
    },
  },
];

export const REGION_PLACE_KINDS: readonly RegionPlaceKind[] = [...BUILDINGS.map((r) => r.kind), ...DUNGEONS.map((r) => r.kind), ...OUTDOORS.map((r) => r.kind)];

function outdoorRecipe(work: Project, mapId: MapId, region: Rect, recipe: OutdoorRecipe, name: string): ToolExecResult & { project: Project } {
  const map = requireMap(work, mapId);
  if (map.tilesetId !== BD) {
    throw new ToolError(`맵 '${map.name}' 의 칩셋 '${map.tilesetId}' 에는 ${recipe.label} 키트가 없다(버들항 칩셋만). 그 칩셋의 구성 도구를 쓴다.`, { code: "unsupported-tileset", mapId });
  }
  if (region.width < recipe.min.width || region.height < recipe.min.height) {
    throw new ToolError(`${recipe.label} 은(는) 영역이 가로 ${recipe.min.width}·세로 ${recipe.min.height} 이상이어야 한다 — 지금 ${region.width}×${region.height}`, { code: "region-too-small", mapId });
  }
  const project = forkProject(work);
  const built = recipe.build(project, mapId, region);
  const eventIds: string[] = [];
  let keeper: { eventId: string; x: number; y: number; service: string } | null = null;
  if (built.npc && inside(region, built.npc.x, built.npc.y)) {
    const npc = callTool(project, "place_npc", {
      mapId, x: built.npc.x, y: built.npc.y, name: built.npc.name, graphic: { query: built.npc.graphic },
      pages: [{ lines: built.npc.lines, commands: built.npc.commands ?? [] }],
    }).data as { eventId: string; x: number; y: number };
    if (!inside(region, npc.x, npc.y)) throw new ToolError(`${built.npc.name} 이(가) 영역 밖(${npc.x},${npc.y})에 섰다`, { code: "npc-outside-region" });
    eventIds.push(npc.eventId);
    keeper = { eventId: npc.eventId, x: npc.x, y: npc.y, service: built.npc.commands?.length ? "상점" : "대화" };
  }
  return {
    project,
    summary: `${name}: 영역 (${region.x},${region.y}) ${region.width}×${region.height} 안에 ${built.pieces.join(" · ")}${keeper ? ` · ${built.npc!.name}(${keeper.service})` : ""}`,
    ...(built.warnings?.length ? { warnings: built.warnings } : {}),
    data: {
      kind: recipe.kind, mapId, region,
      createdMapIds: [],
      eventIds,
      ...(keeper ? { keeper } : {}),
      parts: { exterior: true, interior: false, link: false, keeper: keeper !== null, service: keeper?.service === "상점" },
    },
  };
}

interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

function readRegion(value: unknown): Rect {
  const r = value as Partial<Rect> | null | undefined;
  if (!r || typeof r !== "object" || ![r.x, r.y, r.width, r.height].every((n) => Number.isInteger(n))) {
    throw new ToolError("region 은 {x,y,width,height} 정수 사각형이다 — 사용자가 고른 영역을 그대로 넣는다", { code: "invalid-args" });
  }
  if (r.width! < 1 || r.height! < 1) throw new ToolError("region 의 넓이가 0 이다", { code: "invalid-args" });
  return { x: r.x!, y: r.y!, width: r.width!, height: r.height! };
}

/**
 * 시험용 사본. 타일셋·업로드 항목은 스토어와 같은 얼린 객체라 복제하지 않는다(도구들은 고칠 때 갈아 끼운다 —
 * sessionSharedEntriesFrozen 시험). 나머지(맵·맵 트리·DB·세계)는 도구가 제자리에서 고치므로 깊게 복제한다.
 */
function forkProject(project: Project): Project {
  const { tilesets, assets, ...rest } = project;
  return { ...structuredClone(rest), tilesets: { ...tilesets }, assets: { ...assets, uploaded: { ...assets.uploaded } } } as Project;
}

function callTool(work: Project, name: string, args: Record<string, unknown>): ToolExecResult {
  const tool = lookup(name);
  if (!tool) throw new ToolError(`도구 ${name} 이 없다`, { code: "unknown-tool" });
  const out = tool.run(work, args);
  if (out instanceof Promise) throw new ToolError(`도구 ${name} 은 비동기라 레시피에서 부를 수 없다`, { code: "unsupported" });
  return out;
}

function findNode(node: MapTreeNode, mapId: string): MapTreeNode | null {
  if (node.mapId === mapId) return node;
  for (const child of node.children ?? []) {
    const hit = findNode(child, mapId);
    if (hit) return hit;
  }
  return null;
}

function detachNode(node: MapTreeNode, mapId: string): MapTreeNode | null {
  const index = (node.children ?? []).findIndex((child) => child.mapId === mapId);
  if (index >= 0) return node.children.splice(index, 1)[0]!;
  for (const child of node.children ?? []) {
    const hit = detachNode(child, mapId);
    if (hit) return hit;
  }
  return null;
}

/**
 * 새 실내·던전 맵을 맵 트리에서 바깥 맵 아래에 둔다. 영역 턴은 그 맵의 맵 묶음(트리 하위 맵)만 반영하므로
 * (mergeMapBundles) 트리 밖에 매달린 새 맵은 「범위 밖」으로 버려져 문이 없는 맵을 가리킨다.
 */
function nestUnder(project: Project, parentId: string, childIds: readonly string[]): void {
  const root = project.mapTree;
  if (!root) return;
  const parent = findNode(root, parentId);
  if (!parent) return;
  for (const id of childIds) {
    const node = detachNode(root, id) ?? { mapId: id, children: [] };
    parent.children = [...(parent.children ?? []), node];
  }
}

function inside(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}

interface Exterior { readonly door: { x: number; y: number }; readonly front: { x: number; y: number }; readonly box: Rect; readonly how: string }

/**
 * 버들항 살림집 원본 키트만 쓴다 — 가게·여관은 큰 것부터, 집은 중간 크기부터. 조립 집(style)은 타일셋에 키트를 더해
 * 영역 턴의 맵 묶음 병합(mergeMapBundles)이 그 타일셋 변경을 버린다(외관 배치가 없는 키트를 가리킨다).
 */
function beodeulCandidates(work: Project, mapId: MapId, region: Rect, big: boolean): Record<string, unknown>[] {
  const inspected = callTool(work, "inspect_terrain", { mapId }).data as { houseKits?: { id: string; width: number; height: number }[] } | undefined;
  const area = (k: { width: number; height: number }): number => k.width * k.height;
  return [...(inspected?.houseKits ?? [])]
    .filter((k) => k.width <= region.width && k.height + 1 <= region.height)
    .sort((a, b) => (big ? area(b) - area(a) : Math.abs(area(a) - 42) - Math.abs(area(b) - 42)))
    .map((k) => ({ kitId: k.id }));
}

interface KitEntrance { readonly id: string; readonly width: number; readonly height: number; readonly door: { dx: number; dy: number } }

/** 레시피가 고른 구조 키트 중 이 타일셋에 있고 입구 부위가 있는 것. */
function recipeKits(work: Project, tilesetId: string, kitIds: readonly string[]): KitEntrance[] {
  const kits = work.tilesets[tilesetId]?.structureKits ?? [];
  const out: KitEntrance[] = [];
  for (const id of kitIds) {
    const kit = kits.find((entry) => entry.id === id) as { id: string; width?: number; height?: number; parts?: { kind: string; dx: number; dy: number }[] } | undefined;
    const door = kit?.parts?.find((part) => part.kind === "entrance");
    if (kit && door && kit.width && kit.height) out.push({ id: kit.id, width: kit.width, height: kit.height, door: { dx: door.dx, dy: door.dy } });
  }
  return out;
}

/** 키트 외관: 문 앞 칸이 영역 맨 아래 줄 가운데에 오도록 찍는다(stamp_object, 자리 그대로). */
function placeKitExterior(work: Project, mapId: MapId, region: Rect, kitIds: readonly string[], failures: string[]): { project: Project; exterior: Exterior } | null {
  const tilesetId = requireMap(work, mapId).tilesetId;
  for (const kit of recipeKits(work, tilesetId, kitIds)) {
    if (kit.width > region.width || kit.height + 1 > region.height) { failures.push(`${kit.id}: ${kit.width}×${kit.height + 1} 이 영역보다 크다`); continue; }
    const front = { x: region.x + Math.floor(region.width / 2), y: region.y + region.height - 1 };
    const origin = {
      x: Math.min(Math.max(front.x - kit.door.dx, region.x), region.x + region.width - kit.width),
      y: front.y - 1 - kit.door.dy,
    };
    if (origin.y < region.y) { failures.push(`${kit.id}: 영역 위로 넘친다`); continue; }
    const trial = forkProject(work);
    try {
      callTool(trial, "stamp_object", { objectId: `kit:${tilesetId}/${kit.id}`, mapId, x: origin.x, y: origin.y });
      const door = { x: origin.x + kit.door.dx, y: origin.y + kit.door.dy };
      return { project: trial, exterior: { door, front: { x: door.x, y: door.y + 1 }, box: { x: origin.x, y: origin.y, width: kit.width, height: kit.height }, how: kit.id } };
    } catch (error) {
      failures.push(`${kit.id}: ${(error as Error).message.slice(0, 80)}`);
    }
  }
  return null;
}

function placeExterior(work: Project, mapId: MapId, region: Rect, recipe: Pick<BuildingRecipe, "big" | "kits" | "onlyKits" | "label">): { project: Project; exterior: Exterior } {
  const map = requireMap(work, mapId);
  const tilesetId = map.tilesetId;
  const failures: string[] = [];
  const big = recipe.big;
  if (recipe.kits?.length) {
    const placed = placeKitExterior(work, mapId, region, recipe.kits, failures);
    if (placed) return placed;
    if (recipe.onlyKits) {
      throw new ToolError(
        tilesetId === "beodeul_city"
          ? `영역 (${region.x},${region.y}) ${region.width}×${region.height} 안에 ${recipe.label} 외관이 서지 않는다 — 영역을 더 넓고 높게 잡는다. 시도: ${failures.slice(0, 3).join(" / ")}`
          : `맵 '${map.name}' 의 칩셋 '${tilesetId}' 에는 ${recipe.label} 외관 키트가 없다(버들항 칩셋만). 그 칩셋의 구성 도구로 짓는다.`,
        { code: tilesetId === "beodeul_city" ? "region-too-small" : "unsupported-tileset", mapId },
      );
    }
  }
  if (tilesetId === "beodeul_city") {
    const centerX = region.x + Math.floor(region.width / 2);
    const bottom = region.y + region.height - 2;
    for (const candidate of beodeulCandidates(work, mapId, region, big)) {
      let anchor = { x: centerX, y: bottom };
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const trial = forkProject(work);
        try {
          const data = callTool(trial, "place_terrain_house", { mapId, anchor, ...candidate }).data as {
            x: number; y: number; width: number; height: number; doorFront: { x: number; y: number };
          };
          const box = { x: data.x, y: data.y, width: data.width, height: data.height };
          const dx = box.x < region.x ? region.x - box.x : box.x + box.width > region.x + region.width ? region.x + region.width - box.x - box.width : 0;
          const dy = region.y + region.height - 1 - data.doorFront.y;
          if (dx === 0 && dy === 0 && box.y >= region.y) {
            return { project: trial, exterior: { door: { x: data.doorFront.x, y: data.doorFront.y - 1 }, front: data.doorFront, box, how: String(candidate.kitId) } };
          }
          anchor = { x: anchor.x + dx, y: anchor.y + dy };
        } catch (error) {
          failures.push(`${String(candidate.kitId)}: ${(error as Error).message.slice(0, 80)}`);
          break;
        }
      }
    }
  } else if (tilesetId === COMBINED_TOWN_TILESET_ID || tilesetId === "forest_harmony") {
    const width = Math.min(region.width, big ? 11 : 8);
    const height = Math.min(region.height - 1, big ? 9 : 8);
    if (width >= 5 && height >= 6) {
      const trial = forkProject(work);
      try {
        const data = callTool(trial, "build_house", { mapId, origin: { x: region.x + Math.floor((region.width - width) / 2), y: region.y }, width, height, material: big ? "stone" : "wood", naturalness: 0 }).data as {
          door: { x: number; y: number }; origin: { x: number; y: number }; width: number; height: number;
        };
        const front = { x: data.door.x, y: data.door.y + 1 };
        if (inside(region, front.x, front.y)) {
          return { project: trial, exterior: { door: data.door, front, box: { x: data.origin.x, y: data.origin.y, width: data.width, height: data.height }, how: "build_house" } };
        }
      } catch (error) {
        failures.push(`build_house: ${(error as Error).message.slice(0, 80)}`);
      }
    }
  } else {
    throw new ToolError(
      `맵 '${map.name}' 의 칩셋 '${tilesetId}' 에는 영역 레시피가 쓸 외관 도구가 아직 없다(버들항·기본 마을 칩셋만). 그 칩셋의 구성 도구로 외관을 짓고 link_*_interior 로 잇는다.`,
      { code: "unsupported-tileset", mapId },
    );
  }
  throw new ToolError(
    `영역 (${region.x},${region.y}) ${region.width}×${region.height} 안에 외관과 문 앞 칸이 함께 서는 건물 자리가 없다 — 영역을 더 넓게(가로 7·세로 8 이상) 잡거나 평평한 빈 땅을 고른다.${failures.length ? ` 시도: ${failures.slice(0, 3).join(" / ")}` : ""}`,
    { code: "region-too-small", mapId },
  );
}

function pickGoods(project: Project, goods: Goods): string[] {
  if (goods === "none") return [];
  const items = project.database.items ?? [];
  const sellable = items.filter((item) => (item.price ?? 0) > 0 && item.type !== "special" && item.type !== "switch");
  const armsTypes = new Set(["weapon", "shield", "armor", "helmet", "accessory", "body"]);
  if (goods === "arms") {
    const equipment = (project.database.equipment ?? []).filter((e) => (e.price ?? 0) > 0).map((e) => e.id);
    const armItems = sellable.filter((item) => armsTypes.has(item.type)).map((item) => item.id);
    return [...equipment, ...armItems].slice(0, 8);
  }
  const consumable = sellable.filter((item) => item.consumable && !armsTypes.has(item.type));
  if (goods === "food") {
    const food = consumable.filter((item) => /빵|고기|술|차|음식|수프|과일|우유|food|bread|meal|ale|tea/i.test(`${item.name} ${item.description ?? ""}`));
    return (food.length > 0 ? food : consumable).slice(0, 8).map((item) => item.id);
  }
  return consumable.slice(0, 8).map((item) => item.id);
}

function innPrice(project: Project): number {
  const prices = (project.database.items ?? []).filter((item) => item.consumable && (item.price ?? 0) > 0).map((item) => item.price);
  if (prices.length === 0) return 20;
  const sorted = [...prices].sort((a, b) => a - b);
  return Math.max(5, Math.round(sorted[Math.floor(sorted.length / 2)]! * 1.5));
}

interface InteriorData {
  mapId: string;
  exits: { x: number; y: number }[];
  layout?: { rooms?: { kind: string; x0: number; y0: number; x1: number; y1: number }[] };
}

function keeperSpot(interior: InteriorData, recipe: BuildingRecipe): { x: number; y: number } {
  const rooms = interior.layout?.rooms ?? [];
  const room = rooms.find((r) => recipe.counterRoom.test(r.kind)) ?? rooms[0];
  if (room) return { x: Math.floor((room.x0 + room.x1) / 2), y: Math.min(room.y1, room.y0 + 3) };
  const exit = interior.exits[0]!;
  return { x: exit.x, y: Math.max(1, exit.y - 4) };
}

function buildingRecipe(work: Project, mapId: MapId, region: Rect, recipe: BuildingRecipe, name: string): ToolExecResult & { project: Project } {
  const warnings: string[] = [];
  const placed = placeExterior(work, mapId, region, recipe);
  let project = placed.project;
  const { exterior } = placed;
  const interior = callTool(project, "build_hand_interior_room", { name, layout: recipe.layout }).data as InteriorData;
  const exit = interior.exits?.[0];
  if (!interior.mapId || !exit) throw new ToolError(`${recipe.label} 실내에 출구가 없다`, { code: "interior-no-exit" });
  const pair = callTool(project, "create_transfer_pair", {
    a: { mapId, x: exterior.door.x, y: exterior.door.y },
    b: { mapId: interior.mapId, x: exit.x, y: exit.y },
  }).data as { eventIdA: string; eventIdB: string };
  const spot = keeperSpot(interior, recipe);
  const commands: Record<string, unknown>[] = [];
  if (recipe.keeper === "shop") {
    const itemIds = pickGoods(project, recipe.goods);
    if (itemIds.length > 0) commands.push({ kind: "shop", itemIds, allowSell: true, title: name });
    else warnings.push(`이 게임 데이터베이스에 ${recipe.label}에서 팔 만한 물건(가격 있는 ${recipe.goods === "arms" ? "무기·방어구" : "소모품"})이 없어 주인은 인사만 한다 — 아이템을 만든 뒤 set_shop_stock 으로 채운다`);
  } else if (recipe.keeper === "inn") {
    commands.push({ kind: "inn", price: innPrice(project) });
  }
  const npc = callTool(project, "place_npc", {
    mapId: interior.mapId, x: spot.x, y: spot.y, name: recipe.keeperName, graphic: { query: recipe.keeperGraphic },
    pages: [{ lines: [recipe.greeting], commands }],
  }).data as { eventId: string; x: number; y: number };
  const eventIds = [pair.eventIdA, pair.eventIdB, npc.eventId];
  if (recipe.savepoint) {
    const save = callTool(project, "place_savepoint", { mapId: interior.mapId, x: spot.x + 2, y: spot.y }).data as { eventId?: string } | undefined;
    if (save?.eventId) eventIds.push(save.eventId);
  }
  const service = recipe.keeper === "shop" ? (commands.length ? "상점" : "인사만") : recipe.keeper === "inn" ? "숙박" : "대화";
  return {
    project,
    summary: `${name}: 외관(${exterior.box.x},${exterior.box.y} ${exterior.box.width}×${exterior.box.height}, 문 ${exterior.door.x},${exterior.door.y}) · 실내 맵 ${interior.mapId} · 문 왕복 이동 · ${recipe.keeperName}(${service})`,
    ...(warnings.length ? { warnings } : {}),
    data: {
      kind: recipe.kind,
      mapId,
      region,
      exterior: { ...exterior.box, door: exterior.door, front: exterior.front, source: exterior.how },
      createdMapIds: [interior.mapId],
      interiorMapId: interior.mapId,
      eventIds,
      keeper: { eventId: npc.eventId, x: npc.x, y: npc.y, service },
      parts: { exterior: true, interior: true, link: true, keeper: true, service: service !== "인사만" },
    },
  };
}

function dungeonRecipe(work: Project, mapId: MapId, region: Rect, recipe: DungeonRecipe, name: string): ToolExecResult & { project: Project } {
  const project = forkProject(work);
  const gate = { x: region.x + Math.floor(region.width / 2), y: region.y + Math.floor(region.height / 2) };
  const before = new Set(Object.keys(project.maps));
  const beforeEvents = new Set(requireMap(project, mapId).events.map((e) => e.id));
  const out = callTool(project, "author_dungeon", { type: recipe.dungeonType, name, entrance: { fromMapId: mapId, x: gate.x, y: gate.y } });
  const created = Object.keys(project.maps).filter((id) => !before.has(id));
  const entranceEvents = requireMap(project, mapId).events.filter((e) => !beforeEvents.has(e.id));
  const outside = entranceEvents.filter((e) => !inside(region, e.x, e.y));
  if (outside.length > 0) throw new ToolError(`${recipe.label} 입구가 영역 밖(${outside.map((e) => `${e.x},${e.y}`).join(" ")})에 섰다`, { code: "entrance-outside-region" });
  return {
    project,
    summary: `${name}: 영역 안 입구(${entranceEvents.map((e) => `${e.x},${e.y}`).join(" ") || "없음"}) ↔ 새 ${recipe.label} 맵 ${created.join(", ")} — ${out.summary.slice(0, 120)}`,
    ...(out.warnings?.length ? { warnings: out.warnings } : {}),
    data: {
      kind: recipe.kind, mapId, region,
      createdMapIds: created,
      dungeonMapId: created[0] ?? null,
      eventIds: entranceEvents.map((e) => e.id),
      parts: { exterior: entranceEvents.length > 0, interior: created.length > 0, link: entranceEvents.length > 0, keeper: false, service: false },
    },
  };
}

const buildRegionPlace: ToolDefinition = {
  name: "build_region_place",
  mode: "write",
  domains: ["map", "event"],
  // 레시피가 주인·문지기·상자 칩을 스스로 고른다(graphic:{query}) — 모델이 칩을 고르지 않으므로 칩 관문 대상이 아니다.
  // 실측(2026-11-25 assistant-measure-r2 영역 6판): 6판 모두 첫 호출이 「캐릭터 그림 선택을 되돌렸습니다」로 거절돼
  // list_npc_graphics + 재호출로 모델 두 차례를 더 썼다.
  choosesOwnGraphic: true,
  description:
    "사용자가 맵에서 고른 영역(region) 한 곳에 장소 하나를 통째로 짓는다 — 「여기 상점 만들어 줘」 한 번으로 외관(지붕·벽·문) + 실내 맵(방·가구·계산대) + 문 왕복 이동 + 주인 NPC(상점은 이 게임 DB 품목으로 상점 명령, 여관은 숙박 명령, 교회는 세이브 포인트) 까지 끝낸다. "
    + "kind: shop 도구점·상점 · weapon_shop 무기점 · smithy 대장간 · inn 여관 · tavern 주점 · house 집 · chapel 교회 · bakery 빵집 · pharmacy 약방 · warehouse 창고 · stable 마구간 · school 학교 · guard_post 경비 초소 · windmill 풍차 · lighthouse 등대 · bridge 다리(강이 없으면 영역 안에 남북 강을 낸다) · gate 성문(성문루+양쪽 성벽) · farm 농장(밭+울타리+농부) · market 시장(노점 블록+상인) · forest 숲(나무+가운데 오솔길) · dungeon_entrance 던전 입구(새 던전 맵) · cave_entrance 동굴 입구(새 동굴 맵). "
    + "바깥 맵은 영역 사각형 안만 바뀐다(외관과 문 앞 칸이 영역 안에 서야 한다). 영역 밖에 생기는 것은 새 맵(실내·던전)뿐이고 결과 카드에서 같이 되돌린다. "
    + "외관·실내·문·주인을 따로 부르지 말고 이 도구 한 번으로 짓는다. 외관 칩셋: 버들항(beodeul_city)·기본 마을. 다른 칩셋은 거부되므로 그 칩셋의 구성 도구와 link_*_interior 를 쓴다.",
  invalidArgsExample: { mapId: "map_1", region: { x: 10, y: 6, width: 11, height: 10 }, kind: "shop" },
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "영역이 있는 바깥 맵 id" },
      region: {
        type: "object",
        description: "사용자가 고른 영역 그대로 {x,y,width,height}",
        properties: { x: { type: "integer" }, y: { type: "integer" }, width: { type: "integer" }, height: { type: "integer" } },
        required: ["x", "y", "width", "height"],
        additionalProperties: false,
      },
      kind: { type: "string", enum: [...REGION_PLACE_KINDS] },
      name: { type: "string", description: "장소 이름(실내 맵 이름·상점 머리). 생략하면 종류 이름" },
    },
    required: ["mapId", "region", "kind"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const mapId = String(args.mapId ?? "");
    const map = requireMap(draft, mapId);
    const region = readRegion(args.region);
    if (region.x < 0 || region.y < 0 || region.x + region.width > map.width || region.y + region.height > map.height) {
      throw new ToolError(`region 이 맵(${map.width}×${map.height}) 밖으로 나간다`, { code: "invalid-args", mapId });
    }
    const kind = args.kind as RegionPlaceKind;
    const building = BUILDINGS.find((r) => r.kind === kind);
    const dungeon = DUNGEONS.find((r) => r.kind === kind);
    const outdoor = OUTDOORS.find((r) => r.kind === kind);
    if (!building && !dungeon && !outdoor) throw new ToolError(`kind '${String(args.kind)}' 는 없다 — ${REGION_PLACE_KINDS.join(" · ")}`, { code: "invalid-args" });
    const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : (building?.label ?? dungeon?.label ?? outdoor!.label);
    const work = forkProject(draft);
    const result = building ? buildingRecipe(work, mapId, region, building, name)
      : dungeon ? dungeonRecipe(work, mapId, region, dungeon, name)
      : outdoorRecipe(work, mapId, region, outdoor!, name);
    nestUnder(result.project, mapId, (result.data as { createdMapIds: string[] }).createdMapIds);
    for (const key of Object.keys(result.project) as (keyof Project)[]) {
      (draft as unknown as Record<string, unknown>)[key] = result.project[key];
    }
    const { project: _project, ...rest } = result;
    return rest;
  },
};

export const REGION_PLACE_TOOLS: readonly ToolDefinition[] = [buildRegionPlace];
