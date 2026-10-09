import type { OntologyContract } from "./ontologyTypes";

export const ONTOLOGY_CONTRACTS = [
  contract({ id: "map-uses-existing-tileset", label: "Maps use existing tilesets", description: "Every GameMap.tilesetId points to an existing TilesetDef.id.", capabilityIds: ["MapEditing", "ProjectPersistence"], entityIds: ["GameMap", "TilesetDef"], severity: "error" }),
  contract({ id: "map-tile-array-size", label: "Map tile arrays match dimensions", description: "GameMap lower and upper tile arrays match width * height.", capabilityIds: ["MapEditing"], entityIds: ["GameMap"], severity: "error" }),
  contract({ id: "canonical-project-root", label: "SQLite is the project root", description: "Canonical project data, including maps, mapTree, database records, start position, and session defaults, lives in project.sqlite; the selected project folder is canonical; JSON exports are portable snapshots.", capabilityIds: ["MapEditing", "ProjectPersistence"], entityIds: ["Project", "GameMap", "MapTreeNode"], severity: "error" }),
  contract({ id: "tileset-runtime-array-size", label: "Tileset runtime arrays match tile count", description: "Tileset passability, priority, and terrain arrays match TilesetDef.count.", capabilityIds: ["TilesetSemantics"], entityIds: ["TilesetDef"], severity: "error" }),
  contract({ id: "tile-group-ids-in-range", label: "Tile groups reference in-range tiles", description: "TileGroupMetadata.tileIds stay inside the owning TilesetDef count.", capabilityIds: ["TilesetSemantics"], entityIds: ["TileGroupMetadata", "Tile"], severity: "error" }),
  contract({ id: "command-references-existing-map", label: "Map commands reference existing maps", description: "Transfer-style commands point to existing GameMap ids.", capabilityIds: ["EventAuthoring", "ProjectPersistence"], entityIds: ["Command", "GameMap"], severity: "error" }),
  contract({ id: "command-references-existing-record", label: "Commands reference existing records", description: "Commands reference existing switches, variables, actors, items, skills, troops, and common events.", capabilityIds: ["EventAuthoring", "ProjectPersistence"], entityIds: ["Command"], severity: "error" }),
  contract({ id: "database-record-references-exist", label: "Database references exist", description: "Database record ids such as skillId, enemyIds, and animationId point to existing records.", capabilityIds: ["DatabaseRecords", "BattleRuntime"], entityIds: ["SkillRecord", "ItemRecord", "EnemyRecord", "TroopRecord"], severity: "error" }),
  contract({ id: "resource-reference-exists", label: "Resource references exist", description: "Resource ids used by commands, records, or UI point to a project-owned uploaded payload, bundled bootstrap asset, or generated bootstrap asset.", capabilityIds: ["ResourcePipeline", "ProjectPersistence"], entityIds: ["ResourceProfile", "AssetRef"], severity: "error" }),
  contract({ id: "canonical-resource-root", label: "Project folder owns resources", description: "Persistent resource bytes must be restorable from project assets.uploaded and content-addressed assets/ files; bundled public files are bootstrap assets and must not be the only source for promoted generated resources.", capabilityIds: ["ResourcePipeline", "ProjectPersistence"], entityIds: ["UploadedAsset", "ResourceProfile", "Project"], severity: "error" }),
  contract({ id: "bundled-resource-not-user-deletable", label: "Bundled resources are protected", description: "Bundled resources are not treated as user-deletable assets.", capabilityIds: ["ResourcePipeline"], entityIds: ["AssetRef"], severity: "warning" }),
] satisfies readonly OntologyContract[];

function contract(seed: OntologyContract): OntologyContract {
  return seed;
}
