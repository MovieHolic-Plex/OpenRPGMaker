import type { Project, TilesetDef, GameMap } from './types';
import type { PlaceDesign } from './spatial/types';
export const SHARED_CONTENT_ENDPOINT = '/__oprn/shared-content';
export interface SharedRegionReference {
  id: string; name: string; kind: "completed-map"; regionKind: "settlement" | "terrain";
  revision: number; width: number; height: number; tilesetId: string; preview: string;
  sourceProjectId: string; sourceMapId: string; snapshotProjectId: string;
  rules: string[]; limitations: string;
}
export interface SharedContentLibrary {
  version: 1;
  roots: string[];
  /** Complete, saved region examples; keys address maps in this same library. */
  regions?: Record<string, SharedRegionReference>;
  places: Record<string, PlaceDesign>;
  tilesets: Record<string, TilesetDef>;
  assets: Project['assets']['uploaded'];
  /** Full authored source is retained, including events, alongside reusable raster kits. */
  maps: Record<string, GameMap>;
  sourceProjectId: string;
  previews: Record<string,string>;
}
export interface SharedContentSnapshot { revision: string; libraries: Record<string, SharedContentLibrary> }
