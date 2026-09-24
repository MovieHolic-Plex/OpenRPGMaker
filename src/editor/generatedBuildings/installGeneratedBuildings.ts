/**
 * 생성 건물 시트를 프로젝트에 싣고 맵에 찍는다(author_village.mjs 의 「생성 칸 등록」·건물 배치 이식).
 * 시트 = 프로젝트 업로드 자산(kind "tileset", id 는 내용 해시). 타일셋은 그 자산을 tileGrafts 소스로 가리켜
 * 기존 칸 번호 뒤에 행 단위로 자란다(기존 번호는 절대 안 바뀐다). 통행은 설계도가 정한다.
 */
import type { GameMap, Project, TilesetDef } from "@/project/types";
import type { BuildingTileSheet, SlicedBuilding } from "./blueprintTiles.ts";

export interface InstalledBuildingSheet {
  readonly assetId: string;
  /** 시트 칸 k → 타일셋 칸 번호. */
  readonly tileIds: readonly number[];
}

/** 원본 문 칸(위 = 완전 검정, 아래 = 문). forest_harmony 칩셋 번호. */
export interface DoorTiles { readonly doorTop: number; readonly doorBottom: number }

function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function generatedSheetAssetId(pngDataUrl: string): string {
  return `gen_bld_${hash(pngDataUrl)}_${pngDataUrl.length.toString(36)}`;
}

/** project 를 제자리에서 고친다(호출자는 편집 초안에 대고 부른다). 같은 시트를 두 번 실어도 칸을 다시 늘리지 않는다. */
export function installGeneratedBuildingSheet(
  project: Project,
  tilesetId: string,
  sheet: BuildingTileSheet,
  png: { readonly dataUrl: string; readonly width: number; readonly height: number },
): InstalledBuildingSheet {
  const ts = project.tilesets[tilesetId];
  if (!ts) throw new Error(`타일셋이 없습니다: ${tilesetId}`);
  const assetId = generatedSheetAssetId(png.dataUrl);
  const existing = (ts.tileGrafts ?? []).filter((g) => g.sourceChipset === assetId).sort((a, b) => a.sourceTile - b.sourceTile);
  if (existing.length === sheet.tiles.length) return { assetId, tileIds: existing.map((g) => g.targetTile) };
  project.assets.uploaded[assetId] = {
    id: assetId,
    name: "생성 건물 시트",
    kind: "tileset",
    dataUrl: png.dataUrl,
    meta: { tileSize: ts.tileSize, width: png.width, height: png.height },
  };
  const layerOf = new Map<number, { upper: boolean; walk: boolean }>();
  for (const b of sheet.buildings) {
    for (const c of b.cells) if (c && "tile" in c) layerOf.set(c.tile, { upper: c.layer === "upper", walk: c.walk });
  }
  const perRow = ts.tilesPerRow;
  const base = Math.ceil(Math.max(ts.count, ...(ts.tileGrafts ?? []).map((g) => g.targetTile + 1)) / perRow) * perRow;
  const count = Math.ceil((base + sheet.tiles.length) / perRow) * perRow;
  while (ts.passability.length < count) ts.passability.push({ up: false, down: false, left: false, right: false });
  while (ts.priority.length < count) ts.priority.push("lower");
  while (ts.terrain.length < count) ts.terrain.push(0);
  if (ts.tileMeta) while (ts.tileMeta.length < count) ts.tileMeta.push({ label: "미사용", description: "", source: "unknown" });
  ts.tileGrafts ??= [];
  const tileIds: number[] = [];
  for (let k = 0; k < sheet.tiles.length; k++) {
    const id = base + k, role = layerOf.get(k) ?? { upper: false, walk: false };
    tileIds.push(id);
    ts.tileGrafts.push({ sourceChipset: assetId, sourceTile: k, targetTile: id });
    ts.passability[id] = { up: role.walk, down: role.walk, left: role.walk, right: role.walk };
    ts.priority[id] = role.upper ? "upper" : "lower";
    ts.terrain[id] = 0;
    if (ts.tileMeta) {
      ts.tileMeta[id] = {
        label: role.upper ? "생성 건물 · 지붕 위(굴뚝·첨탑)" : "생성 건물",
        description: "설계도 방식으로 생성한 건물 칸. 통행은 설계도가 정한다.",
        source: "user",
        role: "building",
        defaultLayer: role.upper ? "upper" : "lower",
        passage: role.walk ? "passable" : "solid",
        userLocked: true,
      } as NonNullable<TilesetDef["tileMeta"]>[number];
    }
  }
  ts.count = Math.max(ts.count, count);
  return { assetId, tileIds };
}

export interface StampedBuilding {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** 문 이벤트 칸과 그 앞 접근칸(맵 좌표). */
  readonly doors: readonly { readonly x: number; readonly y: number; readonly front: { readonly x: number; readonly y: number } }[];
}

/**
 * 설계도 맨 위 기준 (x, y) 에 한 채를 찍는다. 굴뚝·첨탑으로 머리 줄이 늘었으면 그만큼 위에서 시작한다.
 * 맵 밖으로 나가는 칸이 있으면 아무것도 바꾸지 않고 null.
 */
export function stampGeneratedBuilding(
  map: GameMap,
  building: SlicedBuilding,
  installed: InstalledBuildingSheet,
  doorTiles: DoorTiles,
  x: number,
  y: number,
): StampedBuilding | null {
  const top = y - building.headExtra;
  if (x < 0 || top < 0 || x + building.w > map.width || top + building.h > map.height) return null;
  building.cells.forEach((c, k) => {
    if (!c) return;
    const i = (top + Math.floor(k / building.w)) * map.width + x + (k % building.w);
    if ("orig" in c) { map.lowerTiles[i] = c.orig === "doorTop" ? doorTiles.doorTop : doorTiles.doorBottom; return; }
    const tile = installed.tileIds[c.tile]!;
    if (c.layer === "upper") map.upperTiles[i] = tile;
    else map.lowerTiles[i] = tile;
  });
  return {
    x, y: top, w: building.w, h: building.h,
    doors: building.doors.map((d) => ({ x: x + d.x, y: top + d.y, front: { x: x + d.front[0], y: top + d.front[1] } })),
  };
}
