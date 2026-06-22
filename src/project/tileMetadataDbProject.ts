import type initSqlJs from "sql.js";
import { deserialize, serialize } from "@/project/io";
import type { Project, TileAiMetadata, TileGroupMetadata, TileMetadataSource, TilesetDef } from "@/project/types";

export const TILE_METADATA_PROJECT_ID = "current";

type SqlDatabase = initSqlJs.Database;
type SqlValue = initSqlJs.SqlValue;

export type StoredProject = {
  readonly project: Project | null;
  readonly found: boolean;
};

export function readProjectSnapshot(db: SqlDatabase): StoredProject {
  const row = firstRow(db, "SELECT current_json FROM projects WHERE id = ?", [TILE_METADATA_PROJECT_ID]);
  const raw = stringValue(row?.current_json);
  if (!raw) return { project: null, found: false };
  return { project: hydrateProjectFromTables(db, deserialize(raw)), found: true };
}

export function writeProjectSnapshot(db: SqlDatabase, project: Project): void {
  const snapshot = normalizedProjectForJson(project);
  db.run("DELETE FROM tile_group_tiles WHERE project_id = ?", [TILE_METADATA_PROJECT_ID]);
  db.run("DELETE FROM tile_groups WHERE project_id = ?", [TILE_METADATA_PROJECT_ID]);
  db.run("DELETE FROM tile_metadata WHERE project_id = ?", [TILE_METADATA_PROJECT_ID]);
  db.run("DELETE FROM tilesets WHERE project_id = ?", [TILE_METADATA_PROJECT_ID]);
  db.run("REPLACE INTO projects(id, schema_version, current_json, updated_at) VALUES (?, ?, ?, ?)", [
    TILE_METADATA_PROJECT_ID,
    snapshot.version,
    serialize(snapshot),
    Date.now(),
  ]);
  Object.values(project.tilesets).forEach((tileset) => writeTileset(db, tileset));
}

function writeTileset(db: SqlDatabase, tileset: TilesetDef): void {
  db.run("INSERT INTO tilesets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    TILE_METADATA_PROJECT_ID,
    tileset.id,
    tileset.image.type,
    tileset.image.id,
    `${tileset.image.type}:${tileset.image.id}:${tileset.count}:${tileset.tileSize}`,
    tileset.tileSize,
    tileset.tilesPerRow,
    tileset.count,
    tileset.name,
  ]);
  tileset.tileMeta?.forEach((meta, tile) => {
    if (!meta || !hasMetadata(meta)) return;
    db.run("INSERT INTO tile_metadata VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      TILE_METADATA_PROJECT_ID,
      tileset.id,
      tile,
      meta.label,
      meta.description,
      meta.role ?? "",
      meta.repeatability ?? "auto",
      meta.defaultLayer ?? tileset.priority[tile] ?? "lower",
      meta.terrainTag ?? tileset.terrain[tile] ?? 0,
      meta.passage ?? "passable",
      meta.confidence ?? "medium",
      meta.source ?? "user",
      meta.userLocked ? 1 : 0,
      Date.now(),
    ]);
  });
  tileset.tileGroups?.forEach((group) => writeGroup(db, group, tileset.id));
}

function writeGroup(db: SqlDatabase, group: TileGroupMetadata, tilesetId: string): void {
  db.run("INSERT INTO tile_groups VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    TILE_METADATA_PROJECT_ID,
    tilesetId,
    group.id,
    group.name,
    group.role,
    group.defaultLayer,
    group.description,
    group.placementRules,
    group.confidence ?? "medium",
    JSON.stringify(group.sourceRect ?? null),
    JSON.stringify(group.previewMap ?? null),
    JSON.stringify(group.patternGrammar ?? null),
    group.source ?? "user",
  ]);
  group.tileIds.forEach((tile, ordinal) => {
    db.run("INSERT INTO tile_group_tiles VALUES (?, ?, ?, ?)", [TILE_METADATA_PROJECT_ID, group.id, tile, ordinal]);
  });
}

function hydrateProjectFromTables(db: SqlDatabase, project: Project): Project {
  Object.values(project.tilesets).forEach((tileset) => {
    const tileMeta = [...(tileset.tileMeta ?? [])];
    tileset.tileMeta = tileMeta;
    selectRows(db, "SELECT * FROM tile_metadata WHERE project_id = ? AND tileset_id = ?", [
      TILE_METADATA_PROJECT_ID,
      tileset.id,
    ]).forEach((row) => applyMetadataRow(tileMeta, row));
    tileset.tileGroups = groupRows(db, tileset.id);
  });
  return project;
}

function applyMetadataRow(tileMeta: TileAiMetadata[], row: Record<string, SqlValue>): void {
  const tile = numberValue(row.tile_id);
  if (tile === null) return;
  tileMeta[tile] = {
    label: stringValue(row.label) ?? "",
    description: stringValue(row.description) ?? "",
    role: stringValue(row.role) ?? "",
    repeatability: repeatabilityValue(row.repeatability),
    defaultLayer: layerValue(row.default_layer),
    terrainTag: numberValue(row.terrain_tag) ?? 0,
    passage: passageValue(row.passage),
    confidence: confidenceValue(row.confidence),
    source: sourceValue(row.source),
    userLocked: numberValue(row.user_locked) === 1,
  };
}

function groupRows(db: SqlDatabase, tilesetId: string): TileGroupMetadata[] {
  return selectRows(db, "SELECT * FROM tile_groups WHERE project_id = ? AND tileset_id = ?", [
    TILE_METADATA_PROJECT_ID,
    tilesetId,
  ]).map((row) => {
    const groupId = stringValue(row.group_id) ?? crypto.randomUUID();
    return {
      id: groupId,
      name: stringValue(row.name) ?? "타일 묶음",
      role: groupRoleValue(row.role),
      defaultLayer: groupLayerValue(row.default_layer),
      tileIds: selectRows(db, "SELECT tile_id FROM tile_group_tiles WHERE project_id = ? AND group_id = ? ORDER BY ordinal", [
        TILE_METADATA_PROJECT_ID,
        groupId,
      ]).map((tileRow) => numberValue(tileRow.tile_id) ?? -1).filter((tile) => tile >= 0),
      description: stringValue(row.description) ?? "",
      placementRules: stringValue(row.placement_rules) ?? "",
      confidence: confidenceValue(row.confidence),
      sourceRect: sourceRectValue(row.source_rect_json),
      previewMap: previewMapValue(row.preview_map_json),
      patternGrammar: patternGrammarValue(row.pattern_grammar_json),
      source: sourceValue(row.source),
    };
  });
}

function normalizedProjectForJson(project: Project): Project {
  const snapshot = structuredClone(project) as Project;
  Object.values(snapshot.tilesets).forEach((tileset) => {
    if (!tileset.tileMeta) return;
    tileset.tileMeta = Array.from({ length: tileset.count }, (_unused, index) => (
      tileset.tileMeta?.[index] ?? { label: "", description: "" }
    ));
  });
  return snapshot;
}

function hasMetadata(meta: TileAiMetadata): boolean {
  return meta.label.trim().length > 0 || meta.description.trim().length > 0;
}

function firstRow(db: SqlDatabase, sql: string, params: readonly SqlValue[]): Record<string, SqlValue> | null {
  return selectRows(db, sql, params)[0] ?? null;
}

function selectRows(db: SqlDatabase, sql: string, params: readonly SqlValue[]): readonly Record<string, SqlValue>[] {
  return db.exec(sql, [...params]).flatMap((result) =>
    result.values.map((values) => Object.fromEntries(result.columns.map((column, index) => [column, values[index] ?? null]))),
  );
}

function stringValue(value: SqlValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: SqlValue | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function sourceValue(value: SqlValue | undefined): TileMetadataSource {
  const source = stringValue(value);
  return source === "ai" || source === "bundled-default" || source === "imported" || source === "unknown" || source === "user"
    ? source
    : "unknown";
}

function repeatabilityValue(value: SqlValue | undefined): TileAiMetadata["repeatability"] {
  const repeatability = stringValue(value);
  return repeatability === "auto" || repeatability === "center" || repeatability === "fixed" || repeatability === "repeat"
    ? repeatability
    : "auto";
}

function layerValue(value: SqlValue | undefined): TileAiMetadata["defaultLayer"] {
  const layer = stringValue(value);
  return layer === "event" || layer === "lower" || layer === "mixed" || layer === "upper" ? layer : "lower";
}

function groupLayerValue(value: SqlValue | undefined): TileGroupMetadata["defaultLayer"] {
  return layerValue(value) ?? "lower";
}

function passageValue(value: SqlValue | undefined): TileAiMetadata["passage"] {
  const passage = stringValue(value);
  return passage === "solid" || passage === "star" ? passage : "passable";
}

function confidenceValue(value: SqlValue | undefined): TileAiMetadata["confidence"] {
  const confidence = stringValue(value);
  return confidence === "high" || confidence === "low" || confidence === "medium" ? confidence : "medium";
}

function groupRoleValue(value: SqlValue | undefined): TileGroupMetadata["role"] {
  const role = stringValue(value);
  return role === "building" || role === "castle" || role === "fence" || role === "roof" || role === "water" || role === "wall" || role === "prop"
    ? role
    : "terrain";
}

function parsedJson(value: SqlValue | undefined): unknown {
  const raw = stringValue(value);
  if (!raw || raw === "null") return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

function sourceRectValue(value: SqlValue | undefined): TileGroupMetadata["sourceRect"] {
  const parsed = parsedJson(value);
  if (!parsed || typeof parsed !== "object") return undefined;
  const record = parsed as Record<string, unknown>;
  const x = Number(record.x);
  const y = Number(record.y);
  const width = Number(record.width);
  const height = Number(record.height);
  return [x, y, width, height].every(Number.isFinite) ? { x, y, width, height } : undefined;
}

function previewMapValue(value: SqlValue | undefined): TileGroupMetadata["previewMap"] {
  const parsed = parsedJson(value);
  if (!parsed || typeof parsed !== "object") return undefined;
  const record = parsed as Record<string, unknown>;
  const width = Number(record.width);
  const height = Number(record.height);
  const lowerTiles = numberArray(record.lowerTiles);
  const upperTiles = numberArray(record.upperTiles);
  return Number.isInteger(width) && Number.isInteger(height) && lowerTiles && upperTiles
    ? { width, height, lowerTiles, upperTiles }
    : undefined;
}

function patternGrammarValue(value: SqlValue | undefined): TileGroupMetadata["patternGrammar"] {
  const parsed = parsedJson(value);
  if (!parsed || typeof parsed !== "object") return undefined;
  return parsed as TileGroupMetadata["patternGrammar"];
}

function numberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const numbers = value.map(Number);
  return numbers.every(Number.isInteger) ? numbers : null;
}
