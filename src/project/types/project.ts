import type {
  AssetSet,
  ActorId,
  Dir,
  FlagName,
  MapId,
  ResourceProfile,
  SCHEMA_VERSION,
  SwitchDef,
  Terms,
  TilesetDef,
  TilesetId,
  TroopId,
  VariableDef,
} from "./base";
import type { ProjectDatabaseRecords, SystemRecords } from "./database";
import type {
  CommandV1,
  CommonEvent,
  ConditionV1,
  GameEvent,
  Trigger,
} from "./events";

export interface GameMap {
  id: MapId;
  name: string;
  width: number;
  height: number;
  tilesetId: TilesetId;
  tileSize: number;
  lowerTiles: number[];
  upperTiles: number[];
  lowerTileStacks?: Record<number, number[]>;
  upperTileStacks?: Record<number, number[]>;
  events: GameEvent[];
  // 랜덤 인카운트율. 0=발생 안 함. 클수록 자주(스텝당 발생 확률 가중치).
  encounterRate?: number;
  // 인카운트로 등장할 적 그룹 목록. encounterRate > 0 일 때만 사용.
  troopIds?: TroopId[];
}

export interface MapTreeNode {
  mapId: MapId;
  children: MapTreeNode[];
}

export interface ProjectSession {
  switches: Record<string, boolean>;
  selfSwitches?: Record<string, Partial<Record<string, boolean>>>;
  variables: Record<string, number>;
  timers?: Record<string, number>;
  inventory: Record<string, number>;
  partyActorIds: ActorId[];
  gold?: number;
}

export interface SaveSlot {
  schemaVersion: typeof SCHEMA_VERSION;
  projectTitle: string;
  session: ProjectSession;
  mapId: MapId;
  player: { x: number; y: number; direction: Dir };
}

export interface MapConnectionEndpoint {
  mapId: MapId;
  x: number;
  y: number;
  direction?: Dir;
}

export interface MapConnection {
  id: string;
  name?: string;
  from: MapConnectionEndpoint;
  to: MapConnectionEndpoint;
  playerEnabled: boolean;
  npcEnabled: boolean;
}

export interface VillageInfoDocument {
  id: string;
  mapId: MapId;
  title: string;
  markdown: string;
}

export interface Project {
  version: number;
  meta: { title: string; author: string; terms: Terms };
  assets: AssetSet;
  resourceProfiles: ResourceProfile[];
  tilesets: Record<TilesetId, TilesetDef>;
  switches: SwitchDef[];
  variables: VariableDef[];
  commonEvents: CommonEvent[];
  database: ProjectDatabaseRecords;
  system: SystemRecords;
  session: ProjectSession;
  maps: Record<MapId, GameMap>;
  mapConnections?: MapConnection[];
  villageInfoDocuments?: VillageInfoDocument[];
  mapTree: MapTreeNode;
  startMapId: MapId;
  startPos: { x: number; y: number };
  flags: Record<FlagName, boolean>;
}

export interface ProjectV2 {
  version: number;
  meta: { title: string; author: string; terms: Terms };
  assets: AssetSet;
  tilesets: Record<TilesetId, TilesetDef>;
  switches: SwitchDef[];
  variables: VariableDef[];
  commonEvents: CommonEvent[];
  maps: Record<MapId, GameMap>;
  mapTree: MapTreeNode;
  startMapId: MapId;
  startPos: { x: number; y: number };
  flags: Record<FlagName, boolean>;
}

export interface AssetRefV1 {
  type: "bundled";
  id: string;
}

export interface TilesetDefV1 {
  id: string;
  image: AssetRefV1;
  tileSize: number;
  tilesPerRow: number;
  count: number;
}

export interface SpriteDefV1 {
  id: string;
  image: AssetRefV1;
  frames: number;
  frameWidth: number;
  frameHeight: number;
}

export interface AssetSetV1 {
  tilesets: Record<string, TilesetDefV1>;
  sprites: Record<string, SpriteDefV1>;
}

export interface GameEventV1 {
  id: string;
  x: number;
  y: number;
  sprite?: AssetRefV1;
  trigger: Trigger;
  condition?: ConditionV1;
  commands: CommandV1[];
}

export interface GameMapV1 {
  id: MapId;
  name: string;
  width: number;
  height: number;
  tileset: AssetRefV1;
  tileSize: number;
  tiles: number[];
  collisions: boolean[];
  events: GameEventV1[];
}

export interface ProjectV1 {
  version: number;
  meta: { title: string; author: string };
  assets: AssetSetV1;
  maps: Record<MapId, GameMapV1>;
  startMapId: MapId;
  startPos: { x: number; y: number };
  flags: Record<FlagName, boolean>;
}
