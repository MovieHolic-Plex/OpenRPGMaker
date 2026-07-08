import type { OntologyEntity } from "./ontologyTypes";

export const ONTOLOGY_ENTITIES = [
  entity({ id: "Project", label: "Project", description: "The root RPG ZZU project document.", typeFiles: ["src/project/types/project.ts"], ownerCapabilityIds: ["ProjectPersistence"] }),
  entity({ id: "GameMap", label: "Game Map", description: "A tile map with lower/upper layers and events.", typeFiles: ["src/project/types/project.ts"], ownerCapabilityIds: ["MapEditing", "ProjectPersistence"] }),
  entity({ id: "MapTreeNode", label: "Map Tree Node", description: "The hierarchical map tree entry.", typeFiles: ["src/project/types/project.ts"], ownerCapabilityIds: ["MapEditing"] }),
  entity({ id: "TilesetDef", label: "Tileset Definition", description: "Runtime and semantic definition for a tileset.", typeFiles: ["src/project/types/base.ts"], ownerCapabilityIds: ["TilesetSemantics", "MapEditing"] }),
  entity({ id: "Tile", label: "Tile", description: "A single indexed tile inside a tileset.", typeFiles: ["src/project/types/base.ts"], ownerCapabilityIds: ["TilesetSemantics"] }),
  entity({ id: "TileAiMetadata", label: "Tile AI Metadata", description: "AI-readable meaning and runtime hints for one tile.", typeFiles: ["src/project/types/base.ts"], ownerCapabilityIds: ["TilesetSemantics"] }),
  entity({ id: "TileGroupMetadata", label: "Tile Group Metadata", description: "A semantic group of tiles with placement grammar.", typeFiles: ["src/project/types/base.ts"], ownerCapabilityIds: ["TilesetSemantics"], relationIds: ["tileset-contains-tile-group"], validationRuleIds: ["tile-group-ids-in-range"] }),
  entity({ id: "GameEvent", label: "Game Event", description: "A map event with pages and commands.", typeFiles: ["src/project/types/events.ts"], ownerCapabilityIds: ["EventAuthoring", "MapEditing"] }),
  entity({ id: "EventPage", label: "Event Page", description: "Conditional event page state and command list.", typeFiles: ["src/project/types/events.ts"], ownerCapabilityIds: ["EventAuthoring"] }),
  entity({ id: "Command", label: "Event Command", description: "A discriminated command executed by the interpreter.", typeFiles: ["src/project/types/events.ts"], ownerCapabilityIds: ["EventAuthoring", "ProjectPersistence"] }),
  entity({ id: "CommonEvent", label: "Common Event", description: "Reusable command list triggered by event commands or switches.", typeFiles: ["src/project/types/events.ts"], ownerCapabilityIds: ["EventAuthoring"] }),
  entity({ id: "SwitchDef", label: "Switch", description: "Named boolean project switch.", typeFiles: ["src/project/types/base.ts"], ownerCapabilityIds: ["EventAuthoring"] }),
  entity({ id: "VariableDef", label: "Variable", description: "Named numeric project variable.", typeFiles: ["src/project/types/base.ts"], ownerCapabilityIds: ["EventAuthoring"] }),
  entity({ id: "ResourceProfile", label: "Resource Profile", description: "Renderable/audio profile for a Supabase-root, bundled, or bootstrap asset.", typeFiles: ["src/project/types/base.ts"], ownerCapabilityIds: ["ResourcePipeline", "ProjectPersistence"] }),
  entity({ id: "AssetRef", label: "Asset Reference", description: "Reference to bundled or uploaded asset storage.", typeFiles: ["src/project/types/base.ts"], ownerCapabilityIds: ["ResourcePipeline"] }),
  entity({ id: "UploadedAsset", label: "Uploaded Asset", description: "Supabase current_json.assets.uploaded payload and metadata; local generated files are cache/bootstrap copies.", typeFiles: ["src/project/types/base.ts"], ownerCapabilityIds: ["ResourcePipeline"] }),
  entity({ id: "ActorRecord", label: "Actor", description: "Database actor record.", typeFiles: ["src/project/types/database.ts"], ownerCapabilityIds: ["DatabaseRecords"] }),
  entity({ id: "SkillRecord", label: "Skill", description: "Database skill record and effect.", typeFiles: ["src/project/types/database.ts"], ownerCapabilityIds: ["DatabaseRecords", "BattleRuntime"] }),
  entity({ id: "ItemRecord", label: "Item", description: "Database item record.", typeFiles: ["src/project/types/database.ts"], ownerCapabilityIds: ["DatabaseRecords", "BattleRuntime"] }),
  entity({ id: "EquipmentRecord", label: "Equipment", description: "Database equipment record.", typeFiles: ["src/project/types/database.ts"], ownerCapabilityIds: ["DatabaseRecords"] }),
  entity({ id: "EnemyRecord", label: "Enemy", description: "Database enemy record and action pattern.", typeFiles: ["src/project/types/database.ts"], ownerCapabilityIds: ["DatabaseRecords", "BattleRuntime"] }),
  entity({ id: "TroopRecord", label: "Troop", description: "Database troop record and battle events.", typeFiles: ["src/project/types/database.ts"], ownerCapabilityIds: ["DatabaseRecords", "BattleRuntime"] }),
  entity({ id: "StateRecord", label: "State", description: "Database state record.", typeFiles: ["src/project/types/database.ts"], ownerCapabilityIds: ["DatabaseRecords"] }),
  entity({ id: "BattleAnimationRecord", label: "Battle Animation", description: "Database animation record used by battle actions.", typeFiles: ["src/project/types/database.ts"], ownerCapabilityIds: ["DatabaseRecords", "BattleRuntime"] }),
  entity({ id: "ProjectSession", label: "Project Session", description: "Runtime save/session state.", typeFiles: ["src/project/types/project.ts"], ownerCapabilityIds: ["ProjectPersistence"] }),
  entity({ id: "SaveSlot", label: "Save Slot", description: "Persisted player save state.", typeFiles: ["src/project/types/project.ts"], ownerCapabilityIds: ["ProjectPersistence"] }),
] satisfies readonly OntologyEntity[];

type EntitySeed = Omit<OntologyEntity, "relationIds" | "validationRuleIds"> & {
  readonly relationIds?: readonly string[];
  readonly validationRuleIds?: readonly string[];
};

function entity(seed: EntitySeed): OntologyEntity {
  return { ...seed, relationIds: seed.relationIds ?? [], validationRuleIds: seed.validationRuleIds ?? [] };
}
