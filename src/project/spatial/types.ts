import type { GameMap, InteriorRoomKindRecord, TilesetDef } from "../types";

declare const spatialId: unique symbol;
/** Opaque identity; labels and legacy qualified names are never identity parsers. */
export type SpatialId = string & { readonly [spatialId]: true };
export type SpatialKind = "object" | "space" | "place" | "region" | "world";
export const SPATIAL_SIZE_MAX = 256;
export type SpatialPoint = { readonly x: number; readonly y: number };
export type SpatialRect = SpatialPoint & { readonly width: number; readonly height: number };
export type SpatialPort = SpatialPoint & { readonly id: SpatialId; readonly name: string };
export type SpatialSource<K extends SpatialKind = SpatialKind> = {
  readonly kind: K; readonly id: SpatialId; readonly revision: number;
};
export type SpatialDesignReference<K extends SpatialKind = SpatialKind> = Omit<SpatialSource<K>, "revision">;
export type SpatialProvenance = {
  readonly origin: "user" | "builtin" | "legacy" | "ai";
  readonly sourceId?: string;
};
export type SpatialDesignBase = {
  readonly id: SpatialId; readonly name: string; readonly revision: number;
  readonly tags: readonly string[]; readonly provenance: SpatialProvenance;
};
export type SpatialGraphic = { readonly tilesetId: string; readonly kitId: string };
export type ObjectDesign = SpatialDesignBase & {
  readonly graphic: SpatialGraphic;
  readonly anchors: readonly SpatialPort[];
  readonly chips: readonly string[];
};
export type SpatialObjectSlot = {
  readonly id: SpatialId; readonly objectDesignId: SpatialId;
  readonly quantity: number; readonly required: boolean;
  readonly placement: { readonly mode: "auto" } | ({ readonly mode: "fixed" } & SpatialPoint);
  readonly chipOverrides?: readonly string[];
  /** Optional activity zone inside one shared interior shell. */
  readonly zoneId?: SpatialId;
};
export type SpatialFloorArea =
  | ({ readonly kind: "rect"; readonly material: string } & SpatialRect)
  | { readonly kind: "polygon"; readonly material: string; readonly points: readonly SpatialPoint[] };
export type SpatialInteriorZone = SpatialRect & {
  readonly id: SpatialId; readonly name: string; readonly floor: string;
};
export type SpaceDesign = SpatialDesignBase & {
  readonly tilesetId: string; readonly shape: "rect" | "l" | "alcove";
  readonly width: number; readonly height: number; readonly floor: string; readonly wall: string;
  readonly objectSlots: readonly SpatialObjectSlot[]; readonly ports: readonly SpatialPort[];
} & (
  | { readonly environment: "interior"; readonly role: "entrance" | "walkway" | "room"; readonly zones?: readonly SpatialInteriorZone[] }
  | { readonly environment: "outdoor"; readonly floorAreas: readonly SpatialFloorArea[] }
);
export type SpatialChildSlot<K extends SpatialKind> = SpatialPoint & {
  readonly id: SpatialId; readonly source: SpatialDesignReference<K>; readonly level: number;
};
/** childId=null addresses a port on the enclosing design, not an arbitrary library record. */
export type SpatialLocalEndpoint = { readonly childId: SpatialId | null; readonly portId: SpatialId };
export type SpatialLocalConnection = {
  readonly id: SpatialId; readonly from: SpatialLocalEndpoint; readonly to: SpatialLocalEndpoint;
  readonly bidirectional: boolean;
};
export type SpatialRoute = SpatialLocalConnection & { readonly points: readonly SpatialPoint[] };
export type PlaceDesign = SpatialDesignBase & {
  readonly kind: "facility" | "settlement" | "natural";
  readonly children: readonly SpatialChildSlot<"space" | "place">[];
  readonly layout: "row" | "double-row" | "manual";
  readonly ports: readonly SpatialPort[]; readonly connections: readonly SpatialLocalConnection[];
  readonly exterior?: SpatialGraphic;
};
export type SpatialTerrain = {
  readonly tilesetId: string; readonly width: number; readonly height: number;
  readonly floor: string; readonly areas: readonly SpatialFloorArea[];
};
/** 정주지 본문 — 지역 지형을 슬롯 배치 대신 마을 설계서(villagePresets 레코드)와 시드로 채운다. */
export type RegionSettlement = {
  readonly presetId: string;
  readonly seed: number;
};
export type RegionDesign = SpatialDesignBase & {
  readonly terrain: SpatialTerrain; readonly places: readonly SpatialChildSlot<"place">[];
  readonly ports: readonly SpatialPort[]; readonly routes: readonly SpatialRoute[];
  /** 있으면 정주지 지역 — 지형은 combined_town 칩셋이어야 하고 맵 본체를 마을 시공기가 채운다. */
  readonly settlement?: RegionSettlement;
};
export type WorldDesign = SpatialDesignBase & {
  readonly terrain: SpatialTerrain; readonly regions: readonly SpatialChildSlot<"region">[];
  readonly ports: readonly SpatialPort[]; readonly connections: readonly SpatialLocalConnection[];
  readonly entryPort: SpatialLocalEndpoint;
};
export type SpatialLibrary = {
  readonly objects: Readonly<Record<string, ObjectDesign>>;
  readonly spaces: Readonly<Record<string, SpaceDesign>>;
  readonly places: Readonly<Record<string, PlaceDesign>>;
  readonly regions: Readonly<Record<string, RegionDesign>>;
  readonly worlds: Readonly<Record<string, WorldDesign>>;
};
export type SpatialKitSnapshot = SpatialGraphic & {
  readonly width: number; readonly height: number;
  readonly cells: readonly (SpatialPoint & { readonly layer: "lower" | "upper"; readonly tile: number })[];
};
/** Closed transitive definitions retain ordered slots, selections, overrides and layout inputs.
 * kitCells is keyed by the owning object or exterior place design ID, never a live kit.
 * Concrete ports have fresh occurrence-owned IDs. Atlas pixels/passage metadata stay shared.
 */
export type SpatialOccurrencePort = SpatialPort & { readonly localPortId: SpatialId };
export type SpatialParentSlot = { readonly slotId: SpatialId; readonly index: number };
export type SpatialCompositionSnapshot<P extends SpatialPort = SpatialPort> = {
  readonly root: SpatialSource; readonly library: SpatialLibrary;
  readonly kitCells: Readonly<Record<string, SpatialKitSnapshot>>;
  readonly ports: readonly P[];
};
type SpatialBindingExtent = {
  readonly mapId: string; readonly rect: SpatialRect;
  readonly ports: readonly (SpatialPoint & { readonly portId: SpatialId })[];
};
/** Historical untagged raster/event ownership; absence of kind is preserved by IO. */
export type SpatialOwnedBinding = SpatialBindingExtent & {
  readonly kind?: never; readonly eventIds: readonly string[];
  readonly connectionIds: readonly SpatialId[]; readonly contentDigest: string;
  readonly overviewEntries?: readonly SpatialOverviewEntry[];
};
/** Non-owning placement/port extent, not proof of painted cells or passability. */
export type SpatialProjectionBinding = SpatialBindingExtent & {
  readonly kind: "projection";
  readonly eventIds?: never; readonly connectionIds?: never; readonly contentDigest?: never;
  readonly overviewEntries?: never;
};
export type SpatialCompiledBinding = SpatialOwnedBinding | SpatialProjectionBinding;
type SpatialOccurrenceBase = {
  readonly [K in SpatialKind]: SpatialPoint & {
    readonly id: SpatialId; readonly kind: K;
    readonly source: SpatialSource<K>; readonly level: number; readonly seed: number;
    readonly generatorVersion: string; readonly bindings: readonly SpatialCompiledBinding[];
  }
}[SpatialKind];
/** Presence of parentSlot requires complete frozen local-port associations, even for roots. */
export type SpatialAssociatedOccurrence = SpatialOccurrenceBase & {
  readonly snapshot: SpatialCompositionSnapshot<SpatialOccurrencePort>;
} & (
  | { readonly parentId: null; readonly parentSlot: null }
  | { readonly parentId: SpatialId; readonly parentSlot: SpatialParentSlot }
);
/** Readable historical v1 data; IO never guesses associations or rewrites the archive. */
export type SpatialLegacyOccurrence = SpatialOccurrenceBase & {
  readonly parentId: SpatialId | null; readonly parentSlot?: never;
  readonly snapshot: SpatialCompositionSnapshot<SpatialPort & { readonly localPortId?: never }>;
};
export type SpatialOccurrence = SpatialLegacyOccurrence | SpatialAssociatedOccurrence;
export type SpatialOverviewRoute = {
  readonly occurrenceId: SpatialId; readonly localConnectionId: SpatialId;
};
export type SpatialOverviewEntry = SpatialPoint & {
  readonly target: SpatialConnection["from"];
  readonly eventId: string; readonly returnEventId: string;
};
export type SpatialConnection = {
  readonly id: SpatialId;
  readonly from: { readonly occurrenceId: SpatialId; readonly portId: SpatialId };
  readonly to: { readonly occurrenceId: SpatialId; readonly portId: SpatialId };
  readonly bidirectional: boolean;
  readonly overviewRoute?: SpatialOverviewRoute;
};
export type LegacySpatialImportReceipt = {
  readonly version: 1; readonly sourceHash: string;
  /** Original legacy compatibility constraints; qualifiers and repetitions are historical. */
  readonly roomKinds?: readonly { readonly tilesetId: string; readonly record: InteriorRoomKindRecord }[];
  /** Qualified legacy keys are historical, not strong references into the active library. */
  readonly mapping: readonly { readonly sourceKey: string; readonly target: SpatialDesignReference }[];
  /** Never parse, normalize or recursively traverse this archive during ordinary project IO. */
  readonly backup: { readonly encoding: "raw-json"; readonly json: string; readonly sha256: string };
};
export type SpatialAuthoringDocument = {
  readonly version: 1; readonly library: SpatialLibrary;
  readonly occurrences: Readonly<Record<string, SpatialOccurrence>>;
  readonly rootOccurrenceIds: readonly SpatialId[];
  readonly connections: readonly SpatialConnection[];
  readonly legacyImport: LegacySpatialImportReceipt;
};
export type SpatialAssetContext = {
  readonly tilesets: Readonly<Record<string, TilesetDef>>;
  readonly maps: Readonly<Record<string, GameMap>>;
};
