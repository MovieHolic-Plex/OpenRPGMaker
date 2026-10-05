import sheet from "@/assets/worldmapSelectedSheet.json";
import references from "@/assets/worldmapSelectedReferences.json";
import materialReferences from "@/assets/worldmapMaterialReferences.json";
import type { TilesetDef, StructureKitDef, TileGroupMetadata } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";

export const WORLDMAP_SELECTED_ID = "worldmap_selected";
export const WORLDMAP_SELECTED_TEXTURE = "tex_worldmap_selected";
export const WORLDMAP_SELECTED_ICONS = sheet.icons;
const PREFIX = "wmi-";
const REFERENCES = [...references, ...materialReferences] as unknown as TilesetReferenceCategory[];

/** EasyRPG 지형 480칸 + 사람 선택만. 시트의 기존 칸 위치는 바꾸지 않는다. */
export function createWorldmapSelectedTileset(world: TilesetDef): TilesetDef {
  const t = structuredClone(world);
  t.id = WORLDMAP_SELECTED_ID;
  t.name = "월드맵 · 사람 선택 아이콘";
  t.image = { type: "bundled", id: WORLDMAP_SELECTED_TEXTURE };
  t.family = "worldmap-kit";
  t.kind = "custom";
  t.tileSize = sheet.tileSize;
  t.tilesPerRow = sheet.tilesPerRow;
  t.count = sheet.count;
  t.tileMeta ??= [];
  for (let i = 480; i < sheet.count; i++) {
    t.passability[i] = { up: true, down: true, left: true, right: true };
    t.priority[i] = "upper";
    t.terrain[i] = 0;
    t.tileMeta[i] = { label: "비어 있는 예약 칸", description: "선택 아이콘 전용 슬롯. 직접 칠하지 않는다.", passage: "star", defaultLayer: "upper", source: "bundled-default" };
  }
  const groups: TileGroupMetadata[] = [];
  const kits: StructureKitDef[] = [];
  for (const icon of sheet.icons) {
    const id = PREFIX + icon.id;
    const description = `${icon.name} (${icon.theme}/${icon.role}, ${icon.width}×${icon.height}). 사람이 선택한 ${icon.decision === "pick" ? icon.candidate : "원본"}. stamp_worldmap_icon으로 전체 배열을 찍는다.`;
    groups.push({ id, name: icon.name, description, role: "prop", defaultLayer: "upper", tileIds: icon.rows.flat(),
      placementRules: "아래 지형 보존. 밑줄 중앙=출입구, 나머지 밑줄=막힘, 윗줄=★. 출입 이벤트는 별도.", source: "bundled-default", confidence: "high" });
    kits.push({ id, kind: "section", name: icon.name, tileSize: 16, width: icon.width, height: icon.height,
      rows: icon.rows.map((row) => ({ tiles: row.map(() => -1), upperTiles: [...row] })), learnedFrom: "db-authored",
      ai: { description, placementRules: "아래 지형 보존. 밑줄 중앙=출입구, 나머지 밑줄=막힘, 윗줄=★. 출입 이벤트는 별도.", role: "prop", repeatability: "fixed", layerHome: "upper", tags: ["worldmap-icon", icon.theme, icon.role], confidence: "high" } });
    for (let dy = 0; dy < icon.height; dy++) for (let dx = 0; dx < icon.width; dx++) {
      const tile = icon.rows[dy]![dx]!;
      const bottom = dy === icon.height - 1;
      const entrance = bottom && dx === Math.floor(icon.width / 2);
      const pass = !bottom || entrance;
      t.passability[tile] = { up: pass, down: pass, left: pass, right: pass };
      t.tileMeta[tile] = { label: icon.name, description, defaultLayer: "upper", layerBacking: "none",
        passage: !bottom ? "star" : entrance ? "passable" : "solid", tags: ["worldmap-icon", icon.theme, icon.role], source: "bundled-default", locked: true };
    }
  }
  t.tileGroups = [...(t.tileGroups ?? []).filter((g) => !g.id.startsWith(PREFIX)), ...groups];
  t.structureKits = [...(t.structureKits ?? []).filter((k) => !k.id.startsWith(PREFIX)), ...kits];
  t.referenceDocuments = [...(world.referenceDocuments ?? []).filter((cat) => !cat.id.startsWith(PREFIX)), ...structuredClone(REFERENCES)];
  return t;
}

/** 저자가 쓴 참고문서·기본 지형 메타는 남기고 번들 소유 꼬리만 보충한다. */
export function ensureWorldmapSelectedTileset(t: TilesetDef): boolean {
  if (t.id !== WORLDMAP_SELECTED_ID || t.image.type !== "bundled" || t.image.id !== WORLDMAP_SELECTED_TEXTURE
    || t.tilesPerRow !== sheet.tilesPerRow || t.count > sheet.count) return false;
  const fresh = createWorldmapSelectedTileset(t);
  let changed = false;
  for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) {
    const old = t[key] ?? [];
    const next = [...old.slice(0, 480), ...(fresh[key]?.slice(480) ?? [])];
    if (JSON.stringify(old) !== JSON.stringify(next)) { (t as unknown as Record<string, unknown>)[key] = next; changed = true; }
  }
  for (const key of ["tileGroups", "structureKits"] as const) {
    if (JSON.stringify(t[key]) !== JSON.stringify(fresh[key])) { (t as unknown as Record<string, unknown>)[key] = fresh[key]; changed = true; }
  }
  if (t.count !== sheet.count) { t.count = sheet.count; changed = true; }
  if (!t.referenceSourceTilesetId) {
    const cats = [...(t.referenceDocuments ?? [])];
    for (const shipped of REFERENCES) {
      const index = cats.findIndex((cat) => cat.id === shipped.id);
      if (index < 0) { cats.push(structuredClone(shipped)); changed = true; continue; }
      const current = cats[index]!;
      const next = { ...current, documents: [...current.documents.filter((doc) => !doc.id.startsWith(PREFIX)), ...shipped.documents],
        images: [...current.images.filter((image) => !image.id.startsWith(PREFIX)), ...shipped.images] };
      if (JSON.stringify(current) !== JSON.stringify(next)) { cats[index] = structuredClone(next); changed = true; }
    }
    if (changed) t.referenceDocuments = cats;
  }
  return changed;
}
