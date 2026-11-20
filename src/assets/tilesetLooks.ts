// 타일셋 겉모습(look) — 같은 칩셋으로 지은 게임들이 서로 다른 마을로 보이게, 게임마다 고른 그림을 그릴 때만 겹친다.
//
// 맵의 칸 번호·통행·오토타일·킷은 한 글자도 바뀌지 않는다. 겉모습은 «이 칸은 겉모습 그림판의 이 칸으로 그려라» 는 이식(graft) 목록일 뿐이고,
// 저장되는 것은 tileset.look(갈래마다 선택지 이름) 한 줄이다. 목록은 그릴 때마다 번들 표에서 편다 — 그래서
//   · 옛 저장본(look 없음)은 화소 하나 달라지지 않고,
//   · 도구·검사·조수가 읽는 것(칸 번호·이름·통행)은 겉모습과 무관하며,
//   · 번들 표가 자라면 이미 고른 게임도 새 칸까지 같은 겉모습으로 그려진다.
// 표·그림판은 scripts/content/beodeul-looks/bake.py 가 굽는다(버들항 시트가 풀밭·길·광장 재질을 «같은 자리 같은 화소» 로 되풀이해 그린 덕에
// 재질 화소만 바꾼 칸을 코드로 만들 수 있다). 고르기는 project/tilesetLook.ts.
import beodeulLooks from "./beodeulLooks.json" with { type: "json" };
import { tilesetStandTableFor } from "./tilesetStands";
import { dungeonSkinLooks } from "./dungeonSkins";
import { reliefStyleForGround } from "@/project/relief/styles";
import { tilesetWaterTableFor, waterLookPairs } from "./tilesetWater";
import type { TileGraft, TilesetDef, TilesetLook } from "@/project/types";

// stand(숲 구성 — 섞인 수종·숲 수관·숲 바닥)·meadow(풀밭 얼룩)는 4차(2026-11-13)에 뒤에 덧붙였다 — 표는 assets/tilesetStands.ts. stand 를 고른 게임은 trees(수종 하나)를 겹치지 않는다.
// water(물빛)는 2026-11-14 에 뒤에 덧붙였다 — 표는 assets/tilesetWater.ts. 이 갈래에는 «원래 그림» 선택지가 없다(원래 물은 초록 쪽이라 새 게임은 늘 물빛 하나를 받는다).
// cliff(절벽 모습 — 절벽 면 양식 · 단 높이 습관 · 절벽 줄 굽이, 시공기와 지형 생성기가 읽는 값)는 2026-11-14 에 그 뒤에 덧붙였다 — 앞 갈래들의 고르기는 그대로다(갈래마다 따로 해시).
// grain(풀 결 — 기본 풀 바닥 위에 섞어 까는 통칸 변형·짙고 옅은 결·풀 무늬)은 그 뒤에 덧붙였다 — 표는 assets/tilesetStands.ts 의 grains. 이 갈래에도 «원래 그림» 선택지가 없다.
// 갈래는 저마다 제 이름으로 해시한다(project/tilesetLook.ts) — 갈래가 늘어도 앞 갈래들의 고르기는 그대로다(test/beodeulGrassGrain.test.ts «갈래 더하기»).
// dungeon(던전 겉가죽 — 동굴·유적 등 주제마다 새로 그린 바닥·벽·테·기물과 그 벽 색 줄, 2026-11-15)은 그 뒤에 덧붙였다 — 표는 assets/dungeonSkins.ts. 이 갈래에도 «원래 그림» 선택지가 없다(새 게임의 던전은 늘 겉가죽을 입는다).
export const TILESET_LOOK_PARTS = ["surface", "trees", "woods", "houses", "plaza", "stand", "meadow", "water", "cliff", "grain", "dungeon"] as const;
export type TilesetLookPart = (typeof TILESET_LOOK_PARTS)[number];

type Sources = Readonly<Record<string, readonly number[]>>;
type LookOption = { readonly label: string; readonly en?: string; readonly ground?: string; readonly base?: number; readonly sources?: Sources; readonly pairs?: readonly number[];
  /** 수종(trees) 선택지: 킷 → 덮은 그림의 칸마다 불투명 몫(0~100) — 숲길의 나무 composer 가 읽는다. */
  readonly cover?: Readonly<Record<string, readonly number[]>>;
  /** 절벽 모습(cliff) 선택지: 절벽 면 양식(relief/styles.ts) · 단이 둘일 때 단 하나의 높이(칸) · 단이 하나뿐일 때의 높이 · 절벽 줄이 곧게 이어지는 가장 긴 칸 수. */
  readonly style?: string; readonly step?: number; readonly lone?: number; readonly straight?: number };
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
  readonly parts: Readonly<Record<Exclude<TilesetLookPart, "stand" | "meadow" | "water" | "grain" | "dungeon">, { readonly options: Readonly<Record<string, LookOption>> }>>;
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
  const { surface = "", trees = "", stand = "", water = "" } = tileset.look;
  const stands = tilesetStandTableFor(table.tilesetId);
  const standOn = !!stands?.stands[stand];
  const waters = tilesetWaterTableFor(table.tilesetId);
  const waterOn = !!waters?.looks[water];
  if (!table.parts.surface.options[surface] && !table.parts.trees.options[trees] && !standOn && !waterOn) return "";
  return `${table.texture}@${table.version}:${surface}:${trees}${standOn ? `:${stands!.texture}@${stands!.version}:${stand}` : ""}${waterOn ? `:${waters!.texture}@${waters!.version}:${water}` : ""}`;
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
  let sheetOf: { readonly texture: string; readonly tileSize: number; readonly tilesPerRow: number } = table;
  const draw = (targetTile: number, sourceTile: number): void => {
    out.push({ targetTile, sourceChipset: sheetOf.texture, sourceTile, sourceTileSize: sheetOf.tileSize, sourceTilesPerRow: sheetOf.tilesPerRow });
  };
  const sheet = (targets: readonly number[], base: number): void => {
    for (let index = 0; index < targets.length; index += 1) if (!storedTargets.has(targets[index]!)) draw(targets[index]!, base + index);
  };
  const bySource = new Map<string, number>();
  const sources = (rows: Sources | undefined, into: Map<string, number> = bySource): void => {
    for (const [chip, pairs] of Object.entries(rows ?? {})) for (let index = 0; index + 1 < pairs.length; index += 2) into.set(`${chip}#${pairs[index]}`, pairs[index + 1]!);
  };
  const redraw = (from: Map<string, number>): void => {
    if (from.size) for (const graft of stored ?? []) {
      const sourceTile = from.get(`${graft.sourceChipset}#${graft.sourceTile}`);
      if (sourceTile !== undefined) draw(graft.targetTile, sourceTile);
    }
  };
  const surface = table.parts.surface.options[tileset.look?.surface ?? ""];
  if (surface) {
    const ground = surface.ground ? table.grounds[surface.ground] : undefined;
    if (ground) { sheet(table.targets.ground, ground.base); sources(ground.sources); }
    if (surface.base !== undefined) sheet(table.targets.paved, surface.base);
    sources(surface.sources);
  }
  // 숲 구성(stand)을 고른 게임은 수종 하나(trees) 대신 그 구성의 섞인 수종 그림·숲 수관을 겹친다 — 그림판이 다르다(assets/tilesetStands.ts).
  const stands = tilesetStandTableFor(table.tilesetId);
  const stand = stands?.stands[tileset.look?.stand ?? ""];
  const trees = stand ? undefined : table.parts.trees.options[tileset.look?.trees ?? ""];
  if (trees) {
    const pairs = trees.pairs ?? [];
    for (let index = 0; index + 1 < pairs.length; index += 2) if (!storedTargets.has(pairs[index]!)) draw(pairs[index]!, pairs[index + 1]!);
    sources(trees.sources);
  }
  redraw(bySource);
  if (stand && stands) {
    sheetOf = stands;
    // 나무 킷 칸 + 걸어 넘는 한 칸 풀·덤불(그 숲 바닥의 여섯 그림)
    for (const pairs of [stand.pairs, stand.small ?? []]) for (let index = 0; index + 1 < pairs.length; index += 2) if (!storedTargets.has(pairs[index]!)) draw(pairs[index]!, pairs[index + 1]!);
    const standSources = new Map<string, number>();
    sources(stand.sources, standSources);
    redraw(standSources);
  }
  // 물: 물가 둑 덧그림은 그 게임의 바닥 재질로(물빛을 고르지 않은 게임도), 물빛을 고른 게임은 물 칸·폭포 칸을 그 물빛으로.
  // 물과 풀·포석이 함께 실린 칸은 위에서 바닥·길 겉모습이 이미 겹쳤다 — 뒤에 온 것이 이기므로(activeTileGrafts) 그 겉모습 위에 물만 다시 칠한 칸으로 덮는다.
  const waters = tilesetWaterTableFor(table.tilesetId);
  if (waters) {
    sheetOf = waters;
    const waterSources = new Map<string, number>();
    const shore = surface?.ground ? waters.shoreGrounds[surface.ground] : undefined;
    if (shore) sources({ [waters.texture]: shore }, waterSources);
    const look = waters.looks[tileset.look?.water ?? ""];
    if (look) {
      for (const [target, source] of waterLookPairs(waters, tileset.look?.water, surface?.ground, surface?.base !== undefined ? tileset.look?.surface : undefined)) if (!storedTargets.has(target)) draw(target, source);
      sources(look.sources, waterSources);
    }
    redraw(waterSources);
  }
  cache.set(tileset, { signature, stored, length: stored?.length ?? 0, grafts: out });
  return out;
}

/** 그 겉모습의 바닥 재질 이름(표의 grounds 열쇠) — 절벽 둑 색처럼 바닥 색을 따라가야 하는 코드가 읽는다. 원래 풀밭이면 undefined. */
export function tilesetLookGround(tilesetId: string, look: TilesetLook | undefined): string | undefined {
  return tilesetLookTableFor(tilesetId)?.parts.surface.options[look?.surface ?? ""]?.ground;
}

/**
 * 이 게임이 그 절벽 양식 자리에 쓰는 양식: 풀 둑(grass-steps)은 게임의 절벽 모습(cliff)으로 바꾸고, 윗면 가장자리 색은 게임의 바닥 재질을 따른다.
 * 눈·모래·이탄·동굴 둑은 그 바이옴의 양식 그대로다. 겉모습이 없으면(옛 게임·열쇠 없는 편집) 받은 양식 그대로 — 마을·던전 시공기가 같은 함수를 쓴다.
 */
export function tilesetLookReliefStyle(tilesetId: string, look: TilesetLook | undefined, style: string): string {
  const cliff = style === "grass-steps" ? tilesetLookCliff(tilesetId, look)?.style : undefined;
  return reliefStyleForGround(cliff ?? style, tilesetLookGround(tilesetId, look));
}

/** 겉모습 갈래의 선택지 이름(표 순서). 맨 앞 "" 는 «원래 그림» — 물빛(water)과 절벽 모습(cliff)에는 없다. */
export function tilesetLookOptions(table: TilesetLookTable, part: TilesetLookPart): string[] {
  // 절벽 모습에는 «원래 그림»(되풀이 무늬 풀 둑) 선택지가 없다 — 새 게임은 모두 자연 면 절벽을 받는다(2026-11-14 오너 「벽이 타일 하나를 복사한 느낌은 싫다」). 표에 없으면 비어 있다.
  const names = Object.keys(partOptions(table, part));
  if (part === "water") return names;
  // 풀 결에도 «원래 그림»(한 칸 풀밭) 선택지가 없다 — 새 게임은 모두 결이 있는 풀밭을 받는다(2026-11-14 오너). 표에 결이 없으면 비어 있다.
  return (part === "cliff" || part === "grain" || part === "dungeon") && names.length ? names : ["", ...names];
}

/** 그 겉모습의 절벽 모습(표의 cliff 선택지) — 절벽 면 양식과 단 높이 습관. 고르지 않은 게임(옛 게임·열쇠 없는 편집)은 undefined. */
export function tilesetLookCliff(tilesetId: string, look: TilesetLook | undefined): { readonly style: string; readonly step: number; readonly lone?: number; readonly straight?: number } | undefined {
  const option = tilesetLookTableFor(tilesetId)?.parts.cliff?.options[look?.cliff ?? ""];
  return option?.style && option.step ? { style: option.style, step: option.step, ...(option.lone ? { lone: option.lone } : {}), ...(option.straight ? { straight: option.straight } : {}) } : undefined;
}

function partOptions(table: TilesetLookTable, part: TilesetLookPart): Readonly<Record<string, { readonly label: string }>> {
  if (part === "stand") return tilesetStandTableFor(table.tilesetId)?.stands ?? {};
  if (part === "meadow") return tilesetStandTableFor(table.tilesetId)?.meadows ?? {};
  if (part === "water") return tilesetWaterTableFor(table.tilesetId)?.looks ?? {};
  if (part === "grain") return tilesetStandTableFor(table.tilesetId)?.grains ?? {};
  if (part === "dungeon") return dungeonSkinLooks(table.tilesetId);
  return table.parts[part]?.options ?? {};
}

/** 사람이 읽는 겉모습 이름(보고·화면용). */
export function describeTilesetLook(tilesetId: string, look: TilesetLook | undefined): string {
  const table = tilesetLookTableFor(tilesetId);
  if (!table || !look) return "";
  const standOn = !!partOptions(table, "stand")[look.stand ?? ""];
  return TILESET_LOOK_PARTS.filter((part) => !(standOn && part === "trees")).map((part) => partOptions(table, part)[look[part] ?? ""]?.label).filter(Boolean).join(" / ");
}
