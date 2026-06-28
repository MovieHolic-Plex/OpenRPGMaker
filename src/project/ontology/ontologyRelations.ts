import type { OntologyRelation } from "./ontologyTypes";

export const ONTOLOGY_RELATIONS = [
  relation({ id: "project-contains-map", label: "Project contains GameMap", fromEntityId: "Project", toEntityId: "GameMap", kind: "contains", sourceFiles: ["src/project/types/project.ts"], reverseLabel: "GameMap belongs to Project" }),
  relation({ id: "project-contains-tileset", label: "Project contains TilesetDef", fromEntityId: "Project", toEntityId: "TilesetDef", kind: "contains", sourceFiles: ["src/project/types/project.ts"], reverseLabel: "TilesetDef belongs to Project" }),
  relation({ id: "project-contains-database", label: "Project contains DatabaseRecords", fromEntityId: "Project", toEntityId: "ActorRecord", kind: "contains", sourceFiles: ["src/project/types/project.ts"], reverseLabel: "Database record belongs to Project" }),
  relation({ id: "map-uses-tileset", label: "GameMap uses TilesetDef", fromEntityId: "GameMap", toEntityId: "TilesetDef", kind: "uses", sourceFiles: ["src/project/types/project.ts"], reverseLabel: "TilesetDef is used by GameMap" }),
  relation({ id: "map-contains-event", label: "GameMap contains GameEvent", fromEntityId: "GameMap", toEntityId: "GameEvent", kind: "contains", sourceFiles: ["src/project/types/project.ts"], reverseLabel: "GameEvent belongs to GameMap" }),
  relation({ id: "event-has-page", label: "GameEvent has EventPage", fromEntityId: "GameEvent", toEntityId: "EventPage", kind: "contains", sourceFiles: ["src/project/types/events.ts"], reverseLabel: "EventPage belongs to GameEvent" }),
  relation({ id: "page-contains-command", label: "EventPage contains Command", fromEntityId: "EventPage", toEntityId: "Command", kind: "contains", sourceFiles: ["src/project/types/events.ts"], reverseLabel: "Command belongs to EventPage" }),
  relation({ id: "command-references-map", label: "Command references GameMap", fromEntityId: "Command", toEntityId: "GameMap", kind: "references", sourceFiles: ["src/project/types/events.ts"], reverseLabel: "GameMap is referenced by Command" }),
  relation({ id: "command-references-resource", label: "Command references ResourceProfile", fromEntityId: "Command", toEntityId: "ResourceProfile", kind: "references", sourceFiles: ["src/project/types/events.ts"], reverseLabel: "ResourceProfile is referenced by Command" }),
  relation({ id: "command-reads-switch", label: "Command reads SwitchDef", fromEntityId: "Command", toEntityId: "SwitchDef", kind: "reads", sourceFiles: ["src/project/types/events.ts"], reverseLabel: "SwitchDef is read by Command" }),
  relation({ id: "command-writes-switch", label: "Command writes SwitchDef", fromEntityId: "Command", toEntityId: "SwitchDef", kind: "writes", sourceFiles: ["src/project/types/events.ts"], reverseLabel: "SwitchDef is written by Command" }),
  relation({ id: "command-reads-variable", label: "Command reads VariableDef", fromEntityId: "Command", toEntityId: "VariableDef", kind: "reads", sourceFiles: ["src/project/types/events.ts"], reverseLabel: "VariableDef is read by Command" }),
  relation({ id: "command-writes-variable", label: "Command writes VariableDef", fromEntityId: "Command", toEntityId: "VariableDef", kind: "writes", sourceFiles: ["src/project/types/events.ts"], reverseLabel: "VariableDef is written by Command" }),
  relation({ id: "item-invokes-skill", label: "ItemRecord invokes SkillRecord", fromEntityId: "ItemRecord", toEntityId: "SkillRecord", kind: "uses", sourceFiles: ["src/project/types/database.ts"], reverseLabel: "SkillRecord is invoked by ItemRecord" }),
  relation({ id: "skill-toggles-switch", label: "SkillRecord toggles SwitchDef", fromEntityId: "SkillRecord", toEntityId: "SwitchDef", kind: "writes", sourceFiles: ["src/project/types/database.ts"], reverseLabel: "SwitchDef is toggled by SkillRecord" }),
  relation({ id: "enemy-uses-skill", label: "EnemyRecord uses SkillRecord", fromEntityId: "EnemyRecord", toEntityId: "SkillRecord", kind: "uses", sourceFiles: ["src/project/types/database.ts"], reverseLabel: "SkillRecord is used by EnemyRecord" }),
  relation({ id: "troop-contains-enemy", label: "TroopRecord contains EnemyRecord", fromEntityId: "TroopRecord", toEntityId: "EnemyRecord", kind: "contains", sourceFiles: ["src/project/types/database.ts"], reverseLabel: "EnemyRecord belongs to TroopRecord" }),
  relation({ id: "tileset-contains-tile-ai-metadata", label: "TilesetDef contains TileAiMetadata", fromEntityId: "TilesetDef", toEntityId: "TileAiMetadata", kind: "contains", sourceFiles: ["src/project/types/base.ts"], reverseLabel: "TileAiMetadata belongs to TilesetDef" }),
  relation({ id: "tileset-contains-tile-group", label: "TilesetDef contains TileGroupMetadata", fromEntityId: "TilesetDef", toEntityId: "TileGroupMetadata", kind: "contains", sourceFiles: ["src/project/types/base.ts"], reverseLabel: "TileGroupMetadata belongs to TilesetDef" }),
  relation({ id: "tile-group-groups-tile", label: "TileGroupMetadata groups Tile", fromEntityId: "TileGroupMetadata", toEntityId: "Tile", kind: "contains", sourceFiles: ["src/project/types/base.ts"], reverseLabel: "Tile belongs to TileGroupMetadata" }),
  relation({ id: "resource-profile-describes-asset", label: "ResourceProfile describes AssetRef", fromEntityId: "ResourceProfile", toEntityId: "AssetRef", kind: "dependsOn", sourceFiles: ["src/project/types/base.ts"], reverseLabel: "AssetRef is described by ResourceProfile" }),
] satisfies readonly OntologyRelation[];

function relation(seed: OntologyRelation): OntologyRelation {
  return seed;
}
