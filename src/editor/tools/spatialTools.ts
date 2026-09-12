import { previewSpatialAuthoring } from "@/editor/spatial/preview";
import type { SpatialStampTarget } from "@/editor/spatial/compilerTypes";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { isWorldTileset } from "@/project/defaults/worldCoastMapping";
import { WORLD_TERRAIN_BLOCKS } from "@/project/defaults/worldTerrainAutotiles";
import { checkedDocument, designNode, designSlots, own } from "@/project/spatial/domain";
import { choice, id, integer, point, record, rect } from "@/project/spatial/guardValues";
import { resolveSpatialDesign } from "@/project/spatial/resolve";
import type { Project } from "@/project/types";
import type { SpatialDesignReference } from "@/project/spatial/types";
import { MAP_GENERATION_PROFILES } from "./mapGenerationProfiles";
import { authorizeSpatialToolChange, consumeSpatialToolPreview, issueSpatialToolPreview } from "./spatialToolState";
import { SPATIAL_APPLY_SCHEMA, SPATIAL_BUILD_SCHEMA, SPATIAL_GET_SCHEMA, SPATIAL_LIST_SCHEMA, SPATIAL_UPSERT_SCHEMA } from "./spatialToolSchemas";
import { ToolError, type ToolDefinition } from "./types";

const kinds = ["object", "space", "place", "region", "world"] as const;
const collections = { object: "objects", space: "spaces", place: "places", region: "regions", world: "worlds" } as const;
const parseKind = choice(kinds);
function source(args: Record<string, unknown>): SpatialDesignReference {
  return { kind: parseKind(args.kind, "kind"), id: id(args.id, "id") };
}
const SPATIAL_INACTIVE_MESSAGE = "이 프로젝트에는 canonical 공간 저작 문서(spatialAuthoring)가 없다 — 레거시 프로젝트다. "
  + "활성화는 데이터베이스 공간 탭의 「공간 설계 활성화」로만 할 수 있으며 AI 도구로는 못 한다. 비활성 상태에서는 레거시 도구(place_concept 등)를 쓴다.";
function requireSpatialDocument(project: Project) {
  if (project.spatialAuthoring === undefined) throw new ToolError(SPATIAL_INACTIVE_MESSAGE, { code: "spatial-inactive" });
  return checkedDocument(project.spatialAuthoring, project);
}
export function spatialToolDesigns(project: Project) {
  if (project.spatialAuthoring === undefined) return [];
  const document = checkedDocument(project.spatialAuthoring, project);
  return kinds.flatMap(kind => Object.keys(document.library[collections[kind]]).map(key => {
    const node = designNode(document.library, { kind, id: id(key, "designId") });
    return { ...node.design, kind, children: designSlots(node).map(slot => ({ id: slot.id, source: slot.source, quantity: slot.quantity })) };
  }));
}
function target(value: unknown): SpatialStampTarget | undefined {
  if (value === undefined) return undefined;
  const input = record(value, "target", "mapId rect entry");
  return { mapId: id(input.mapId, "target.mapId"), rect: rect(input.rect, "target.rect"), entry: point(input.entry, "target.entry") };
}
export const SPATIAL_TOOLS: readonly ToolDefinition[] = [
  { name: "list_spatial_designs", mode: "read", domains: ["world", "map", "database"],
    description: "Discover canonical object, space, place, region and world designs across all project tilesets. Read-only; never activates or seeds an empty library. When data.active is false the project has no spatialAuthoring document and every other spatial tool rejects with spatial-inactive — activation is a user-side editor action, not a tool.",
    parameters: SPATIAL_LIST_SCHEMA,
    run(project, args) {
      if (project.spatialAuthoring === undefined) {
        return { summary: "공간 저작 비활성 — canonical 문서가 없는 레거시 프로젝트(0 spatial designs)", data: { active: false, designs: [] } };
      }
      const kind = args.kind === undefined ? undefined : parseKind(args.kind, "kind");
      const query = typeof args.query === "string" ? args.query.toLocaleLowerCase() : "";
      const designs = spatialToolDesigns(project).filter(design => (!kind || design.kind === kind)
        && [design.id, design.name, ...design.tags].some(value => value.toLocaleLowerCase().includes(query)));
      return { summary: `${designs.length} spatial designs`, data: { active: true, designs } };
    },
  },
  { name: "get_geography_vocabulary", mode: "read", domains: ["world", "map"],
    description: "Allowed values for authoring region/world designs with upsert_spatial_design: accepted terrain tilesetIds, material names for terrain.floor/areas, mountain:<surface> structure materials, settlement presets for region.settlement, and route/connection rules. Read this BEFORE writing a region or world design — wrong tilesetId or material names are rejected by the compiler.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    run(project) {
      const worldTilesetIds = [...MAP_GENERATION_PROFILES.values()].filter(profile => profile.layout === "world")
        .map(profile => profile.tilesetId).filter(tilesetId => isWorldTileset(project.tilesets[tilesetId]));
      return { summary: `지형 어휘: 월드 칩셋 ${worldTilesetIds.length}종 · 재료 ${WORLD_TERRAIN_BLOCKS.length + 5}종`, data: {
        active: project.spatialAuthoring !== undefined,
        terrain: {
          worldTilesetIds,
          settlementTilesetId: DEFAULT_TILESET_ID,
          materials: ["ground", "water", ...WORLD_TERRAIN_BLOCKS.map(block => block.key)],
          structures: {
            "mountain:grass|dirt|snow": "rect 영역 하나가 계단 포함 한 단 산 — polygon 거부",
            bridge: "물 위를 지나는 직선 route 가 자동으로 석교를 시공한다",
          },
          rules: [
            "region.routes: 직교 polyline(points≥2), 끝점은 배치된 자식 좌표와 일치",
            "world.connections: points 없음 — 가로→세로 횡단은 컴파일러가 그린다",
            "world.entryPort 필수 — 세계 진입 선택자",
            "settlement 지역은 routes 거부 — 마을 도로는 생성된다",
            "settlement 지역 terrain.tilesetId 는 settlementTilesetId 여야 한다",
          ],
        },
        settlementPresets: (project.villagePresets ?? []).map(preset => ({ id: preset.id, name: preset.name })),
      } };
    },
  },
  { name: "get_spatial_design", mode: "read", domains: ["world", "map", "database"],
    description: "Read a canonical design and its resolved transitive source revisions, object selections and frozen kit cells. Use the returned kind-specific design as the starting point for upsert_spatial_design.",
    parameters: SPATIAL_GET_SCHEMA,
    run(project, args) {
      const ref = source(args);
      const document = requireSpatialDocument(project);
      return { summary: `Spatial ${ref.kind}: ${ref.id}`, data: {
        ...designNode(document.library, ref), resolved: resolveSpatialDesign(document, project, ref),
      } };
    },
  },
  { name: "upsert_spatial_design", mode: "write", domains: ["world", "map", "database"],
    description: "Author one canonical design in the detached AI proposal. Supply exactly the body named by kind (object/space/place/region/world). expectedRevision=0 creates a new id; updates require the current revision and design.revision=current+1. References must already exist — author bottom-up: objects before spaces, spaces before places, places before regions, regions before worlds. For region/world terrain read get_geography_vocabulary first. Never refreshes frozen occurrences or overwrites maps. Uses normal proposal acceptance.",
    parameters: SPATIAL_UPSERT_SCHEMA,
    run(project, args) {
      const kind = parseKind(args.kind, "kind");
      for (const other of kinds) if (other !== kind && args[other] !== undefined) throw new ToolError(`Unexpected ${other} body for ${kind}`, { code: "invalid-args" });
      const raw = record(args[kind], kind);
      const designId = id(raw.id, `${kind}.id`);
      const document = requireSpatialDocument(project);
      const collection = collections[kind];
      const previous = Object.hasOwn(document.library[collection], designId) ? designNode(document.library, { kind, id: designId }).design : undefined;
      const expected = integer([0, Number.MAX_SAFE_INTEGER])(args.expectedRevision, "expectedRevision");
      if (expected !== (previous?.revision ?? 0) || raw.revision !== expected + 1) throw new ToolError("Source revision conflict", { code: "spatial-stale-source" });
      const proposed = { ...project, spatialAuthoring: checkedDocument({ ...document, library: { ...document.library,
        [collection]: { ...document.library[collection], [designId]: raw },
      } }, project) };
      const preview = previewSpatialAuthoring(proposed, { operation: { kind: "edit" } }, { original: project, checkpoint: project });
      const before = { ...project };
      project.spatialAuthoring = preview.project.spatialAuthoring;
      authorizeSpatialToolChange(project, before);
      return { summary: `Spatial ${kind} ${designId} revision ${expected + 1}`, data: designNode(checkedDocument(project.spatialAuthoring, project).library, { kind, id: designId }) };
    },
  },
  { name: "preview_spatial_build", mode: "read", domains: ["world", "map"],
    description: "Preview a fresh frozen occurrence through the shared validated compiler without changing project data. Object requires an explicit compatible target map rectangle and entry; other kinds generate maps. Returns a draft-owned previewId for apply_spatial_build — exactly one preview is retained per draft and any other write tool call invalidates it, so preview right before applying. Existing occurrences are never implicitly refreshed.",
    parameters: SPATIAL_BUILD_SCHEMA,
    run(project, args) {
      requireSpatialDocument(project);
      const ref = source(args);
      const occurrenceId = id(args.occurrenceId, "occurrenceId");
      const stamp = target(args.target);
      const preview = previewSpatialAuthoring(project, {
        operation: { kind: "instantiate", request: { source: ref, rootId: occurrenceId, x: 0, y: 0, level: 0,
          seed: integer([-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER])(args.seed, "seed"), generatorVersion: "spatial-ai-v1" } },
        compile: { occurrenceId, ...(stamp ? { target: stamp } : {}) },
      }, { original: project, checkpoint: project });
      return { summary: `Preview ${ref.kind} ${ref.id}: ${preview.impact.mapIds.length} maps`, data: {
        previewId: issueSpatialToolPreview(project, preview), impact: preview.impact,
        source: own(checkedDocument(preview.project.spatialAuthoring, preview.project).occurrences, occurrenceId).source,
      } };
    },
  },
  { name: "apply_spatial_build", mode: "write", domains: ["map", "world"],
    description: "Accept an exact preview_spatial_build result into the detached AI proposal. Requires the issued previewId and unchanged draft. This does not publish the live store; the normal AI proposal acceptance path owns publication and undo.",
    parameters: SPATIAL_APPLY_SCHEMA,
    run(project, args) {
      const preview = consumeSpatialToolPreview(project, id(args.previewId, "previewId"));
      const before = { ...project };
      const accepted = structuredClone(preview.project);
      Object.assign(project, accepted);
      authorizeSpatialToolChange(project, before);
      return { summary: `Spatial build: ${preview.impact.mapIds.length} maps`, data: { impact: preview.impact } };
    },
  },
];
