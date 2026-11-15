// 숲 구성(stand) · 풀밭 얼룩(meadow) · 풀 결(grain) — «한 맵의 숲이 나무 그림 하나를 고른 간격으로 찍은 것» 으로 읽히지 않게(2026-11-13 오너: «나무랑 땅 타일도 좀
// 다양하게 해야할듯. 특히 숲쪽....»).
//
// 숲 구성 하나는 주 수종 · 곁 수종 둘 · 드문 강조 나무 · 물가 나무 · 덤불과 숲 바닥 재질이다. 나무 킷의 칸 번호·통행·이름은 그대로 두고
//   · 킷마다 다른 수종 그림을 그릴 때만 겹치고(pairs — assets/tilesetLooks.ts 가 겉모습 이식에 얹는다),
//   · 이어진 숲 수관(자연 덧그림 칸)도 그 수종 수관으로 다시 지은 그림을 겹치며(sources),
//   · 시공기는 역할별 킷 목록(kits)으로 «주 수종 많이 · 곁 수종 섞어 · 강조 나무 드물게» 를 고른다.
// 숲 바닥·풀밭 얼룩은 2층 투명 덧그림 칸이다(overlays — 꼭짓점 넷의 안팎 15꼴). 1층 바닥 칸·통행은 그대로다(editor/tools/beodeulGroundCover.ts).
// 그림판·표는 scripts/content/beodeul-looks/bake_stands.py 가 굽는다. 고르기는 겉모습의 stand·meadow 갈래(project/tilesetLook.ts).
import beodeulStands from "./beodeulStands.json";
import type { TilesetDef } from "@/project/types";

export type StandRole = "dominant" | "companion" | "accent" | "shrub" | "water" | "row" | "fruit";
type Pairs = readonly number[];
export type TilesetStand = {
  readonly label: string; readonly en?: string;
  /** 숲 바닥 재질(overlays 열쇠). */
  readonly floor: string;
  /** [버들항 칸, 그림판 칸] 쌍 — 나무 킷 칸의 그림. */
  readonly pairs: Pairs;
  /** 그림판별 [원본 칸, 그림판 칸] 쌍 — 이어진 숲 수관·숲 그늘. */
  readonly sources: Readonly<Record<string, Pairs>>;
  /** 주 수종 이름(그림판 명세의 수종 열쇠) — 겉모습을 퍼뜨려 고를 때 «주 수종이 같은 숲 구성» 을 닮은 것으로 본다. */
  readonly dominant?: string;
  readonly kits: Readonly<Partial<Record<StandRole, readonly string[]>>>;
  /** 밑풀 킷(고사리·버섯·그루터기·통나무·바위·들꽃) — 숲 바닥 재질에 맞춘 목록. 이미 있는 킷이다. */
  readonly under: readonly string[];
  /** 킷 → 덮은 그림의 칸마다 불투명 몫(0~100, 행 우선) — 숲길의 나무 composer 가 겹침을 이 값으로 정한다. */
  readonly cover?: Readonly<Record<string, readonly number[]>>;
  /** 킷 → 같은 수종·같은 크기의 «다른 개체» 그림들(줄 목록, 빈 칸 -1). 찍는 자리마다 골라 쓴다(project/standKit.ts). */
  readonly variants?: Readonly<Record<string, readonly (readonly (readonly number[])[])[]>>;
  readonly variantCover?: Readonly<Record<string, readonly (readonly number[])[]>>;
  /** 이어진 숲 수관 위(4층)에 얹는 «나무 머리» — 줄기를 잘라 낸 수관 그림(줄 목록, 빈 칸 -1). 시공기가 자리 해시로 골라 숲 속을 이 머리들로 덮는다. */
  readonly crowns?: readonly { readonly w: number; readonly h: number; readonly rows: readonly (readonly number[])[]; /** 눈에 띄는 곁 수종(꽃나무·단풍) — 드물게만 세운다. */ readonly accent?: boolean; /** 주 수종 — 머리의 절반 남짓을 차지한다. */ readonly dominant?: boolean }[];
  /** [버들항 칸, 그림판 칸] 쌍 — 걸어 넘는 한 칸 풀·덤불 킷(고사리·헤더 덤불·들꽃)의 그림. */
  readonly small?: Pairs;
  /** [자연 덧그림 숲 그늘 칸, 그 칸을 숲 바닥에 얹은 그림판 칸] 쌍 — 둘레가 숲 바닥인 칸에만 쓴다. */
  readonly shade?: Pairs;
  /** 눈에 띄는 곁 수종(꽃나무·단풍)의 나무 킷 — 숲 끝의 앞줄 나무·만입 덤불은 드물게만 고른다. */
  readonly loud?: readonly string[];
  /** 과수원을 둘 만한 숲 구성(주 수종이 과일나무) — 줄 맞춘 과수원은 이런 숲 구성에만 선다. */
  readonly orchard?: boolean;
};
export type GroundOverlay = {
  readonly label: string; readonly en?: string; readonly role: "floor" | "patch";
  /** [꼭짓점 비트 북서1·북동2·남서4·남동8] → 그림판 칸(0 은 -1). alt = 둘째 벌. */
  readonly cells: readonly number[]; readonly alt: readonly number[];
  /** 이 재질과 같은 바닥 겉모습(grounds 열쇠) — 바닥이 이 재질인 게임에는 얼룩으로 깔지 않는다. */
  readonly ground?: string;
  /** 이 바닥 겉모습 위에는 깔지 않는다(모래·맨흙 위의 짙은 풀·들꽃). */
  readonly avoid?: readonly string[];
  /** 작은 자리로만 깐다(맨흙 — 넓게 깔면 풀밭이 얼룩덜룩한 흙판이 된다). */
  readonly small?: boolean;
  /** [자연 덧그림 그림자 칸, 그 그림자를 이 바닥에 얹은 그림판 칸] 쌍. */
  readonly shadow?: Pairs;
};
/** 풀 결 섞음(게임마다 하나 — 겉모습 grain): 기본 풀 바닥 위에 섞어 까는 2층 칸의 몫. */
export type GrassGrainMix = {
  readonly label: string; readonly en?: string;
  /** 통칸 변형(같은 빛, 다른 배열)을 깔 몫(0~1). */
  readonly alt: number;
  /** 짙은/옅은 결이 서는 구간: [물결 칸 수, 문턱] — 문턱이 낮을수록 띠가 길다. 결은 나무 줄·물가·절벽·울타리·집 곁을 따라 선다. */
  readonly deep: readonly [number, number]; readonly pale: readonly [number, number];
  /** 곁에서 번지는 칸 수(띠의 가장 넓은 폭). */
  readonly reach: number;
  /** 풀 무늬 무리: [무리 자리 격자 칸 수, 격자 칸마다 무리가 설 몫, 무리 안에서 풀 무늬가 놓이는 몫] — 무리는 곁(나무·물가·울타리·집)의 풀밭에 반지름 한두 칸의 덩이로 선다. */
  readonly bloom: readonly [number, number, number];
  /** 무리 밖 낱칸 확률(드물게). */
  readonly single: number;
  /** 풀 무늬(풀 포기·토끼풀·들꽃·잔돌) 종류별 무게. */
  readonly sprigs: Readonly<Record<string, number>>;
};
type GrainTone = { readonly cells: readonly number[]; readonly alt: readonly number[]; readonly fill: readonly number[]; readonly sprigs: Readonly<Record<string, readonly number[]>> };
/** 한 바닥 재질(grass = 원래 풀밭, 그 밖은 바닥 겉모습 이름)의 풀 결 칸. */
export type GrassGrainCells = { readonly alt: readonly number[]; readonly deep: GrainTone; readonly pale: GrainTone; readonly sprigs: Readonly<Record<string, readonly number[]>> };
export type TilesetStandTable = {
  readonly version: number; readonly tilesetId: string; readonly image: string; readonly texture: string;
  readonly tileSize: number; readonly tilesPerRow: number; readonly count: number;
  readonly stands: Readonly<Record<string, TilesetStand>>;
  readonly meadows: Readonly<Record<string, { readonly label: string; readonly en?: string; readonly patches: readonly string[] }>>;
  readonly overlays: Readonly<Record<string, GroundOverlay>>;
  /** 닳은 땅(문 앞·우물 곁) 재질 · 길가/물가 띠 재질(overlays 열쇠). */
  readonly worn: string; readonly verge: { readonly water: string; readonly road: string };
  /** 물가 갈대 킷. */
  readonly reed: string;
  /** 풀 결(2026-11-14): 섞음 · 바닥 재질별 칸 · 종류 이름(alt·deep·pale·풀 무늬). */
  readonly grains?: Readonly<Record<string, GrassGrainMix>>;
  readonly grain?: Readonly<Record<string, GrassGrainCells>>;
  readonly grainLabels?: Readonly<Record<string, string>>;
};

const TABLES: readonly TilesetStandTable[] = [beodeulStands as unknown as TilesetStandTable];

const coverMemo = new WeakMap<object, { readonly grafts: unknown; readonly length: number; readonly cover: ReadonlySet<number> }>();
/**
 * 이 타일셋에서 «바닥에 덧깐 그림» 인 칸을 가리는 함수 — 숲 바닥·풀밭 얼룩의 2층 덧그림 칸(overlays 의 cells·alt)과 풀 결 칸(grain)이다.
 * 그림자·숲 그늘을 얹어 구운 칸(shadow·shade)은 아니다 — 그 자리에는 덧그림이 없을 때도 2층 그림이 있었다.
 * «2층이 빈 칸» 을 고르는 도구가 덧그림이 깔린 게임에서도 덧그림 없는 게임과 같은 칸을 고르게 한다(v2 던전의 적·상자 자리).
 */
export function standGroundCoverTile(tileset: TilesetDef | undefined): (tile: number) => boolean {
  const table = tileset ? TABLES.find((entry) => entry.tilesetId === tileset.id) : undefined;
  if (!tileset || !table) return () => false;
  const grafts = tileset.tileGrafts, hit = coverMemo.get(tileset);
  if (hit && hit.grafts === grafts && hit.length === (grafts?.length ?? 0)) return (tile) => hit.cover.has(tile);
  const plain = new Set<number>();
  for (const overlay of Object.values(table.overlays)) for (const cell of [...overlay.cells, ...overlay.alt]) if (cell > 0) plain.add(cell);
  for (const [cell] of grainCellKinds(table)) plain.add(cell);
  const cover = new Set<number>();
  for (const graft of grafts ?? []) if (graft.sourceChipset === table.texture && plain.has(graft.sourceTile)) cover.add(graft.targetTile);
  coverMemo.set(tileset, { grafts, length: grafts?.length ?? 0, cover });
  return (tile) => cover.has(tile);
}

const grainKinds = new WeakMap<object, Map<number, string>>();
const grainMemo = new WeakMap<object, { readonly grafts: unknown; readonly length: number; readonly of: ReadonlyMap<number, 1 | 2> }>();
/** 풀 결 칸 → 종류(alt · deep · pale · 풀 무늬 이름. 결 속 칸에 얹은 풀 무늬는 «deep+tuft» 꼴). */
function grainCellKinds(table: TilesetStandTable): Map<number, string> {
  let out = grainKinds.get(table);
  if (out) return out;
  out = new Map();
  for (const family of Object.values(table.grain ?? {})) {
    for (const cell of family.alt) out.set(cell, "alt");
    for (const [kind, cells] of Object.entries(family.sprigs)) for (const cell of cells) out.set(cell, kind);
    for (const tone of ["deep", "pale"] as const) {
      for (const cell of [...family[tone].cells, ...family[tone].alt, ...family[tone].fill]) if (cell > 0) out.set(cell, tone);
      for (const [kind, cells] of Object.entries(family[tone].sprigs)) for (const cell of cells) out.set(cell, `${tone}+${kind}`);
    }
  }
  grainKinds.set(table, out);
  return out;
}

/**
 * 이 타일셋에서 «풀 결» 인 칸을 가리는 함수: 0 아님 · 1 바탕 빛 그대로인 칸(통칸 변형·풀 무늬 — 다른 2층 꾸밈이 덮어써도 된다) · 2 짙은/옅은 결 칸.
 * 풀 결은 기본 풀 바닥의 한 부분이다 — «2층이 빈 칸» 을 찾는 도구는 1·2 를 빈 칸으로 본다.
 */
export function standGrainTile(tileset: TilesetDef | undefined): (tile: number) => 0 | 1 | 2 {
  const table = tileset ? TABLES.find((entry) => entry.tilesetId === tileset.id) : undefined;
  if (!tileset || !table?.grain) return () => 0;
  const grafts = tileset.tileGrafts, hit = grainMemo.get(tileset);
  if (hit && hit.grafts === grafts && hit.length === (grafts?.length ?? 0)) return (tile) => hit.of.get(tile) ?? 0;
  const kinds = grainCellKinds(table);
  const of = new Map<number, 1 | 2>();
  for (const graft of grafts ?? []) {
    const kind = graft.sourceChipset === table.texture ? kinds.get(graft.sourceTile) : undefined;
    if (kind) of.set(graft.targetTile, kind.startsWith("deep") || kind.startsWith("pale") ? 2 : 1);
  }
  grainMemo.set(tileset, { grafts, length: grafts?.length ?? 0, of });
  return (tile) => of.get(tile) ?? 0;
}

/** 숲 그림판 textureKey → 칸 수(bundledChipsetFrameCount 가 쓴다). */
export function tilesetStandSheetCount(textureKey: string): number | undefined {
  return TABLES.find((table) => table.texture === textureKey)?.count;
}

export function tilesetStandTableFor(tilesetId: string): TilesetStandTable | undefined {
  return TABLES.find((table) => table.tilesetId === tilesetId);
}

/** 그 겉모습의 숲 구성(없으면 undefined — 원래 숲). */
export function tilesetStand(tilesetId: string, stand: string | undefined): TilesetStand | undefined {
  return stand ? tilesetStandTableFor(tilesetId)?.stands[stand] : undefined;
}

const sources = new WeakMap<object, TilesetDef>();
/**
 * 덧그림 칸의 «원본 타일셋» — translateTiles 가 맵 타일셋으로 이식할 때 통행·위아래·이름표를 여기서 옮긴다.
 * 모두 ★(통행 + 상위): 2층 덧그림은 통행 판정에서 건너뛰고(칸의 통행은 1·3층이 정한다) 캐릭터 밑 묶음이라 인물 아래에 그린다(자연 덧그림과 같은 규칙).
 * 프로젝트에 넣지 않는다 — 타일셋 목록이 늘지 않는다.
 */
export function standOverlaySource(table: TilesetStandTable): TilesetDef {
  const hit = sources.get(table);
  if (hit) return hit;
  const n = table.count;
  const meta: { label: string; description: string }[] = Array.from({ length: n }, () => ({ label: "", description: "" }));
  for (const overlay of Object.values(table.overlays)) {
    const text = { label: overlay.label, description: overlay.role === "floor" ? "숲 바닥 — 2층 투명 덧그림(통행은 아래 바닥 그대로)" : "풀밭 얼룩 — 2층 투명 덧그림(통행은 아래 바닥 그대로)" };
    for (const cell of [...overlay.cells, ...overlay.alt]) if (cell > 0) meta[cell] = text;
    const shadow = overlay.shadow ?? [];
    for (let i = 1; i < shadow.length; i += 2) meta[shadow[i]!] = { label: `${overlay.label} · 그림자`, description: text.description };
  }
  // 풀 결: 이름표에 «바닥» 을 넣는다 — 이름표로 물건을 찾는 검사가 바닥으로 읽는다(숲 바닥·풀밭 얼룩과 같은 꼴)
  for (const [cell, kind] of grainCellKinds(table)) {
    const name = kind.split("+").map((part) => table.grainLabels?.[part] ?? part).join(" ");
    meta[cell] = { label: `풀밭 바닥 덧그림(${name})`, description: "풀 결 — 기본 풀 바닥 위의 2층 덧그림(통행은 아래 바닥 그대로)" };
  }
  for (const stand of Object.values(table.stands)) {
    const floor = table.overlays[stand.floor];
    for (let i = 1; i < (stand.shade ?? []).length; i += 2) meta[stand.shade![i]!] = { label: `${floor?.label ?? "숲 바닥 덧그림"} · 숲 그늘`, description: "숲 바닥 — 2층 투명 덧그림(통행은 아래 바닥 그대로)" };
    for (const crown of stand.crowns ?? []) for (const row of crown.rows) for (const cell of row) if (cell > 0) meta[cell] = { label: "숲 수관 · 솟은 나무 머리", description: "이어진 숲 수관 위에 얹는 4층 투명 덧그림(통행은 아래 수관 그대로 — 막힌 칸)" };
  }
  const tileset = {
    id: "beodeul_stands", name: "버들항 · 숲 바닥·풀밭 얼룩 덧그림",
    image: { type: "bundled", id: table.texture }, kind: "custom", family: "oprn-atlas",
    tileSize: table.tileSize, tilesPerRow: table.tilesPerRow, count: n,
    passability: Array.from({ length: n }, () => ({ up: true, down: true, left: true, right: true })),
    priority: Array(n).fill("upper"), terrain: Array(n).fill(0), tileMeta: meta,
  } as unknown as TilesetDef;
  sources.set(table, tileset);
  return tileset;
}
