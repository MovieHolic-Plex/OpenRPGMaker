// 칩셋 표면 계약 — «이 칩셋에서 어느 칸이 길이고, 새 길은 무엇으로 까는가». 번들마다 제 꼬리표·역할 말로 선언하고, 읽는 쪽은 칸 번호 집합만 본다.
// 왜: 길 판정이 네 군데에서 이름표 낱말로 따로 돌아(«오토타일» 이 든 이름표만 길 등) 구성기 칩셋에서는 출구 길 잇기·길 폭 출구가 말없이 아무 일도 안 했다.
// 새 번들은 SURFACES 에 한 줄을 더한다(test/tilesetSurface.test.ts 가 길 칸·까는 재료가 실제로 풀리는지 본다). 선언 없는 칩셋(올린 것)은 FALLBACK 으로 읽는다.
import type { TilesetDef } from "./types";

/** 번들이 제 칸을 고르는 말 — 하나라도 맞으면 그 칸이다. */
export interface TilePick {
  /** tileMeta.tags 에 이 꼬리표가 (글자 그대로) 있는 칸. */
  readonly tags?: readonly string[];
  /** tileMeta.role 이 이것인 칸. */
  readonly roles?: readonly string[];
  /** 이름표가 이 식에 맞는 칸 — 꼬리표가 없는 칩셋만 쓴다. */
  readonly label?: RegExp;
}

export interface SurfaceDecl {
  /** 길 — 사람이 걸어 다니라고 깐 줄(흙길·포석길·보도·부두 널). 찻길은 뺀다. */
  readonly road: TilePick;
  /** 길에서 빼는 칸(같은 말을 쓰는 실내 바닥·소품). */
  readonly notRoad?: TilePick;
  /** 새 길 칸을 까는 재료 — 오토타일 묶음 id 와 fill_region 에 주는 재료 말. 맵에 가장 많이 깔린 것을 쓴다. 없으면 이 칩셋의 길은 구성기만 낸다. */
  readonly lay?: readonly { readonly group: string; readonly material: string }[];
}

export interface TilesetSurface {
  /** 번들이 선언한 칩셋인가(아니면 낱말 추정). */
  readonly declared: boolean;
  readonly road: ReadonlySet<number>;
  readonly lay: readonly { readonly material: string; readonly tiles: ReadonlySet<number> }[];
}

/** 번들 칩셋의 선언(칩셋 id). 꼬리표는 그 번들의 굽기가 tileMeta 에 쓴 말 그대로다. */
export const SURFACES: Readonly<Record<string, SurfaceDecl>> = {
  beodeul_city: {
    road: { tags: ["road", "sand", "farm_lane"] }, notRoad: { tags: ["prop"] },
    lay: [{ group: "beodeul_road_autotile", material: "버들항 · 길 포석 오토타일" }, { group: "beodeul_sand_autotile", material: "버들항 · 모랫길 오토타일" }],
  },
  snow_north: { road: { tags: ["길", "눈길", "다진 눈길", "판석"] }, lay: [{ group: "sn-at-pack", material: "다진 눈길 (모양 0)" }] },
  desert_east: { road: { tags: ["흙길", "포석"] }, notRoad: { tags: ["de-interior"] } },
  prehistoric: { road: { tags: ["흙길", "다리"] } },
  sengoku_edo: { road: { tags: ["흙길", "돌길"] } },
  steampunk_city: { road: { tags: ["길", "도로", "보도", "포석"] } },
  pirate_isles: {
    road: { tags: ["길", "포석", "부두", "방파제"] },
    lay: [{ group: "pi-at-sandpath", material: "packed sand village path autotile sheet over grass, 47 varia" }, { group: "pi-at-path", material: "packed dirt jungle path autotile sheet over grass, 47 varian" }],
  },
  sky_island: { road: { tags: ["길", "광장", "다리", "잔교"] } },
  sf_station: {
    road: { tags: ["도로", "길", "보도", "차선", "횡단보도"] },
    lay: [{ group: "sf-at-road", material: "night city asphalt road autotile with concrete curb on open sides, 16 variants" }, { group: "sf-at-regolith-path", material: "compacted moon regolith road autotile with wheel ruts and berm edges, 16 variants" }],
  },
  wasteland_ruins: { road: { tags: ["도로", "보도"] }, lay: [{ group: "wl-asphalt", material: "금 간 아스팔트" }] },
  wizarding_world: { road: { tags: ["흙길", "골목"] }, lay: [{ group: "wz-nat-dirt", material: "숲길 흙" }, { group: "wz-post-snowcobble", material: "눈 덮인 자갈 골목" }] },
  joseon_baram: {
    road: { tags: ["road64", "road16", "fld_trail32", "slab_edge16", "slab", "slab_dirt"] },
    lay: [
      { group: "jb_road64_autotile", material: "조선 흙길 (4변형)" }, { group: "jb_road16_autotile", material: "조선 흙길" },
      { group: "jb_slab_edge16_autotile", material: "국내성 석판 길 (오토타일)" }, { group: "jb_fld_trail32_autotile", material: "사냥터 짐승길" },
    ],
  },
  jp_city: {
    road: { roles: ["path"], tags: ["sidewalk", "lane", "crosswalk", "횡단보도"] },
    lay: [
      { group: "jp-sidewalk-curb", material: "보도 연석" }, { group: "jp-lane-road", material: "생활도로" },
      { group: "jp-gravel-lawn", material: "자갈 참배길" }, { group: "jp-inaka-at-dirt", material: "시골 흙길" },
    ],
  },
  modern_city: { road: { tags: ["walk", "sidewalk", "path", "crosswalk"] }, lay: [{ group: "mc-sidewalk-curb", material: "보도 포석" }] },
  modern_campus: { road: { tags: ["길", "보도", "포석", "횡단보도"] } },
};

/** 선언 없는 칩셋(사용자가 올린 것·옛 시트) — 꼬리표·이름표의 흔한 길 낱말로 읽는다. 물·벽·지붕·풀·표지 이름표는 뺀다. */
const FALLBACK: SurfaceDecl = {
  road: { tags: ["road", "street", "path", "sidewalk", "길", "흙길", "도로", "보도", "인도", "포석"], label: /길|도로|포석|보도|인도|road|street|path|sidewalk|pavement|cobble/iu },
  notRoad: { label: /풀|잔디|grass|물|water|강|운하|벽|wall|지붕|roof|표지|이정표/iu },
};

type Meta = { readonly label?: string; readonly tags?: readonly string[]; readonly role?: string } | null | undefined;

function picks(pick: TilePick | undefined, meta: Meta): boolean {
  if (!pick || !meta) return false;
  if (pick.roles && meta.role && pick.roles.includes(meta.role)) return true;
  if (pick.tags && meta.tags?.some((tag) => pick.tags!.includes(tag))) return true;
  return !!pick.label && pick.label.test(meta.label ?? "");
}

const cache = new WeakMap<object, TilesetSurface>();
const NONE: TilesetSurface = { declared: false, road: new Set(), lay: [] };

/** 칩셋의 표면 — 선언(없으면 낱말 추정)을 칸 번호 집합으로 푼다. tileMeta 배열마다 한 번만 센다. */
export function tilesetSurface(tileset: Pick<TilesetDef, "id" | "tileMeta" | "autotileGroups"> | undefined): TilesetSurface {
  const meta = tileset?.tileMeta as readonly Meta[] | undefined;
  if (!tileset || !meta) return NONE;
  const hit = cache.get(meta);
  if (hit) return hit;
  const decl = SURFACES[tileset.id];
  const spec = decl ?? FALLBACK;
  const road = new Set<number>();
  meta.forEach((m, tile) => { if (picks(spec.road, m) && !picks(spec.notRoad, m)) road.add(tile); });
  const lay = (spec.lay ?? []).flatMap(({ group, material }) => {
    const members = tileset.autotileGroups?.find((g) => g.id === group)?.memberTileIds;
    return members?.length ? [{ material, tiles: new Set(members) }] : [];
  });
  const surface: TilesetSurface = { declared: !!decl, road, lay };
  cache.set(meta, surface);
  return surface;
}
