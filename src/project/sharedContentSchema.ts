import type { Project, TilesetDef, GameMap } from './types';
import type { PlaceDesign } from './spatial/types';
import type { TilesetReferenceCategory } from './tilesetReferences';
export const SHARED_CONTENT_ENDPOINT = '/__oprn/shared-content';
/** Preview bytes, split out of the catalog JSON. `?library=&kind=place|region&id=&v=` */
export const SHARED_CONTENT_PREVIEW_ENDPOINT = '/__oprn/shared-content/preview';
/** `defaults` = only projectDefaults libraries (the boot path); `all` = the whole catalog. */
export type SharedContentScope = 'defaults' | 'rest' | 'all';
export interface SharedRegionReference {
  id: string; name: string; kind: "completed-map"; regionKind: "settlement" | "terrain";
  revision: number; width: number; height: number; tilesetId: string; preview: string;
  sourceProjectId: string; sourceMapId: string; snapshotProjectId: string;
  rules: string[]; limitations: string;
  referenceDocuments?: TilesetReferenceCategory[];
}
export interface SharedContentLibrary {
  version: 1;
  /** User-installed local packs may make their reserved assets available in every project. */
  projectDefaults?: boolean;
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
  /** Human-kept sprites and their author descriptions; owned by this host's local catalog. */
  characters?: Record<string, SharedCharacter>;
}
export interface SharedCharacter {
  assetId: string;
  characterIndex: number;
  description: {
    label: string; gender?: string; role?: string; appearance?: string;
    tags?: string[]; fits?: string; attributes?: import('./characterGraphics').GraphicAttributes;
    [key: string]: unknown;
  };
  source: { candidateId: string; base: string; inspected: Record<string, unknown>; acceptance: Record<string, unknown>; [key: string]: unknown };
}
export interface SharedContentSnapshot {
  revision: string;
  libraries: Record<string, SharedContentLibrary>;
  /**
   * 편집기 응답에 호스트가 붙이는 기본 자산의 바이트 SHA-256(자산 id → hex). 없으면 편집기가 직접 센다.
   * HTTP 팀 참여 창은 crypto.subtle 이 없어 JS 로 셌다(2026-09-28 실측, 기본 자산 393장 · 65MB 에 약 1s).
   */
  assetBytesSha256?: Record<string, string>;
}
