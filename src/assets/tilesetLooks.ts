// 타일셋 겉모습(look) — 같은 칩셋으로 지은 게임들이 서로 다른 마을로 보이게, 게임마다 고른 그림을 그릴 때만 겹친다.
//
// 맵의 칸 번호·통행·오토타일·킷은 한 글자도 바뀌지 않는다. 겉모습은 «이 칸은 겉모습 그림판의 이 칸으로 그려라» 는 이식(graft) 목록일 뿐이고,
// 저장되는 것은 tileset.look(갈래마다 선택지 이름) 한 줄이다. 목록은 그릴 때마다 번들 표에서 편다 — 그래서
//   · 옛 저장본(look 없음)은 화소 하나 달라지지 않고,
//   · 도구·검사·조수가 읽는 것(칸 번호·이름·통행)은 겉모습과 무관하며,
//   · 번들 표가 자라면 이미 고른 게임도 새 칸까지 같은 겉모습으로 그려진다.
// 표·그림판은 scripts/content/beodeul-looks/bake.py 가 굽는다(버들항 시트가 풀밭·길·광장 재질을 «같은 자리 같은 화소» 로 되풀이해 그린 덕에
// 재질 화소만 바꾼 칸을 코드로 만들 수 있다). 고르기는 project/tilesetLook.ts.
import beodeulLooks from "./beodeulLooks.json";
import type { TileGraft, TilesetDef, TilesetLook } from "@/project/types";

export const TILESET_LOOK_PARTS = ["surface", "trees", "woods", "houses", "plaza"] as const;
export type TilesetLookPart = (typeof TILESET_LOOK_PARTS)[number];

type Sources = Readonly<Record<string, readonly number[]>>;
type LookOption = { readonly label: string; readonly en?: string; readonly ground?: string; readonly base?: number; readonly sources?: Sources; readonly pairs?: readonly number[] };
export type TilesetLookTable = {
  readonly version: number;
  readonly tilesetId: string;
  readonly image: string;
  readonly texture: string;
  readonly tileSize: number;
  readonly tilesPerRow: number;
  readonly count: number;
  readonly targets: { readonly ground: readonly number[]; readonly paved: readonly number[] };
  readonly grounds: Readonly<Record<string, { readonly base: number; readonly sources?: Sources }>>;
  readonly parts: Readonly<Record<TilesetLookPart, { readonly options: Readonly<Record<string, LookOption>> }>>;
};

const TABLES: readonly TilesetLookTable[] = [beodeulLooks as unknown as TilesetLookTable];

/** 겉모습 그림판 textureKey → 칸 수(bundledChipsetFrameCount 가 쓴다). */
export function tilesetLookSheetCount(textureKey: string): number | undefined {
  return TABLES.find((table) => table.texture === textureKey)?.count;
}

/** 이 타일셋 id 가 고를 수 있는 겉모습 표(없으면 undefined). */
export function tilesetLookTableFor(tilesetId: string): TilesetLookTable | undefined {
  return TABLES.find((table) => table.tilesetId === tilesetId);
}

type LookTileset = Pick<TilesetDef, "tileGrafts"> & Partial<Pick<TilesetDef, "look" | "image">>;

/** 이 타일셋에 걸린 겉모습의 표. 그림이 그 표의 번들 시트일 때만(올린 그림·다른 시트의 사본에는 걸지 않는다). */
function activeTable(tileset: LookTileset): TilesetLookTable | undefined {
  const look = tileset.look;
  if (!look || tileset.image?.type !== "bundled") return undefined;
  return TABLES.find((table) => table.texture === look.textureKey && table.image === tileset.image?.id);
}

/** 그림 캐시 열쇠에 붙일 겉모습 서명(겉모습이 없으면 빈 문자열). */
export function tilesetLookSignature(tileset: LookTileset): string {
  const table = activeTable(tileset);
  if (!table || !tileset.look) return "";
  const { surface = "", trees = "" } = tileset.look;
  if (!table.parts.surface.options[surface] && !table.parts.trees.options[trees]) return "";
  return `${table.texture}@${table.version}:${surface}:${trees}`;
}

const cache = new WeakMap<object, { readonly signature: string; readonly stored: readonly TileGraft[] | undefined; readonly length: number; readonly grafts: readonly TileGraft[] }>();

/**
 * 겉모습이 겹쳐 그리는 이식 목록. 시트 안 칸은 그 칸 번호로, 다른 그림판에서 이식된 칸(물가·짙은 풀 가장자리)은 저장된 이식의 원본으로 찾는다.
 * 사용자가 직접 덮어쓴 시트 칸(저장된 이식이 있는 칸)은 건드리지 않는다.
 */
export function tilesetLookGrafts(tileset: LookTileset): readonly TileGraft[] {
  const table = activeTable(tileset);
  const signature = tilesetLookSignature(tileset);
  if (!table || !signature) return [];
  const stored = tileset.tileGrafts;
  const hit = cache.get(tileset);
  if (hit && hit.signature === signature && hit.stored === stored && hit.length === (stored?.length ?? 0)) return hit.grafts;
  const out: TileGraft[] = [];
  const storedTargets = new Set((stored ?? []).map((graft) => graft.targetTile));
  const draw = (targetTile: number, sourceTile: number): void => {
    out.push({ targetTile, sourceChipset: table.texture, sourceTile, sourceTileSize: table.tileSize, sourceTilesPerRow: table.tilesPerRow });
  };
  const sheet = (targets: readonly number[], base: number): void => {
    for (let index = 0; index < targets.length; index += 1) if (!storedTargets.has(targets[index]!)) draw(targets[index]!, base + index);
  };
  const bySource = new Map<string, number>();
  const sources = (rows: Sources | undefined): void => {
    for (const [chip, pairs] of Object.entries(rows ?? {})) for (let index = 0; index + 1 < pairs.length; index += 2) bySource.set(`${chip}#${pairs[index]}`, pairs[index + 1]!);
  };
  const surface = table.parts.surface.options[tileset.look?.surface ?? ""];
  if (surface) {
    const ground = surface.ground ? table.grounds[surface.ground] : undefined;
    if (ground) { sheet(table.targets.ground, ground.base); sources(ground.sources); }
    if (surface.base !== undefined) sheet(table.targets.paved, surface.base);
    sources(surface.sources);
  }
  const trees = table.parts.trees.options[tileset.look?.trees ?? ""];
  if (trees) {
    const pairs = trees.pairs ?? [];
    for (let index = 0; index + 1 < pairs.length; index += 2) if (!storedTargets.has(pairs[index]!)) draw(pairs[index]!, pairs[index + 1]!);
    sources(trees.sources);
  }
  if (bySource.size) for (const graft of stored ?? []) {
    const sourceTile = bySource.get(`${graft.sourceChipset}#${graft.sourceTile}`);
    if (sourceTile !== undefined) draw(graft.targetTile, sourceTile);
  }
  cache.set(tileset, { signature, stored, length: stored?.length ?? 0, grafts: out });
  return out;
}

/** 그 겉모습의 바닥 재질 이름(표의 grounds 열쇠) — 절벽 둑 색처럼 바닥 색을 따라가야 하는 코드가 읽는다. 원래 풀밭이면 undefined. */
export function tilesetLookGround(tilesetId: string, look: TilesetLook | undefined): string | undefined {
  return tilesetLookTableFor(tilesetId)?.parts.surface.options[look?.surface ?? ""]?.ground;
}

/** 겉모습 갈래의 선택지 이름(표 순서). 맨 앞 "" 는 «원래 그림». */
export function tilesetLookOptions(table: TilesetLookTable, part: TilesetLookPart): string[] {
  return ["", ...Object.keys(table.parts[part]?.options ?? {})];
}

/** 사람이 읽는 겉모습 이름(보고·화면용). */
export function describeTilesetLook(tilesetId: string, look: TilesetLook | undefined): string {
  const table = tilesetLookTableFor(tilesetId);
  if (!table || !look) return "";
  return TILESET_LOOK_PARTS.map((part) => table.parts[part]?.options[look[part] ?? ""]?.label).filter(Boolean).join(" / ");
}
