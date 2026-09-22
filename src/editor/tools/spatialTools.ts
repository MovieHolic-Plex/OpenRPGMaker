import { publicSpatialValue, publicSpatialKind, storageSpatialSource, storageSpatialDesign } from "./spatialPlaceContract";
import { REGION_REFERENCES, PLACE_REFERENCES } from "@/project/regionReferences";
import { readRegionReference } from "@/project/regionReferenceSnapshots";
import { previewSpatialAuthoring } from "@/editor/spatial/preview";
import type { SpatialAuthoringRequest } from "@/editor/spatial/authoringTypes";
import { SpatialCompileError, type SpatialStampTarget } from "@/editor/spatial/compilerTypes";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { isWorldTileset } from "@/project/defaults/worldCoastMapping";
import { WORLD_TERRAIN_BLOCKS } from "@/project/defaults/worldTerrainAutotiles";
import { checkedDocument, designNode, designSlots, own, SpatialOperationError } from "@/project/spatial/domain";
import { boolean, choice, coordinate, id, integer, point, record, rect } from "@/project/spatial/guardValues";
import { resolveSpatialDesign } from "@/project/spatial/resolve";
import type { Project } from "@/project/types";
import type { SpatialAuthoringDocument, SpatialConnection, SpatialId, SpatialOccurrence } from "@/project/spatial/types";
import { MAP_GENERATION_PROFILES } from "./mapGenerationProfiles";
import { authorizeSpatialToolChange, consumeSpatialToolPreview, issueSpatialToolPreview } from "./spatialToolState";
import { SPATIAL_APPLY_SCHEMA, SPATIAL_BUILD_SCHEMA, SPATIAL_GET_SCHEMA, SPATIAL_LIST_SCHEMA, SPATIAL_OCCURRENCE_SCHEMA, SPATIAL_UPSERT_SCHEMA } from "./spatialToolSchemas";
import { ToolError, type ToolDefinition } from "./types";

const kinds = ["object", "space", "place", "region", "world"] as const;
const collections = { object: "objects", space: "spaces", place: "places", region: "regions", world: "worlds" } as const;
const parseKind = choice(kinds);
const SPATIAL_INACTIVE_MESSAGE = "이 프로젝트에는 장소 저작 문서(spatialAuthoring)가 없다 — 레거시 프로젝트다. "
  + "활성화는 데이터베이스 장소의 「장소 설계 활성화」로만 할 수 있으며 AI 도구로는 못 한다. 비활성 상태에서는 레거시 도구(place_concept 등)를 쓴다.";
function requireSpatialDocument(project: Project) {
  if (project.spatialAuthoring === undefined) throw new ToolError(SPATIAL_INACTIVE_MESSAGE, { code: "spatial-inactive" });
  return checkedDocument(project.spatialAuthoring, project);
}
export function spatialToolDesigns(project: Project) {
  if (project.spatialAuthoring === undefined) return [];
  const document = checkedDocument(project.spatialAuthoring, project);
  return kinds.flatMap(kind => Object.keys(document.library[collections[kind]]).map(key => {
    const node = designNode(document.library, { kind, id: id(key, "designId") });
    return { ...node.design, ...(node.kind === "place" ? { placeKind: node.design.kind } : {}),
      kind, children: designSlots(node).map(slot => ({ id: slot.id, source: slot.source, quantity: slot.quantity })) };
  }));
}
function target(value: unknown): SpatialStampTarget | undefined {
  if (value === undefined) return undefined;
  const input = record(value, "target", "mapId rect entry");
  return { mapId: id(input.mapId, "target.mapId"), rect: rect(input.rect, "target.rect"), entry: point(input.entry, "target.entry") };
}
function lookupOccurrence(document: SpatialAuthoringDocument, occurrenceId: SpatialId): SpatialOccurrence {
  const found = document.occurrences[occurrenceId];
  if (!found) throw new ToolError(`Missing occurrence ${occurrenceId}`, { code: "invalid-args" });
  return found;
}
function ancestorChain(document: SpatialAuthoringDocument, occurrenceId: SpatialId): readonly SpatialOccurrence[] {
  const chain: SpatialOccurrence[] = [];
  for (let cursor: SpatialOccurrence | undefined = lookupOccurrence(document, occurrenceId); cursor !== undefined;
    cursor = cursor.parentId === null ? undefined : lookupOccurrence(document, cursor.parentId)) chain.push(cursor);
  return chain;
}
/** The containing root owns the write set: overview entries into a child live on their geography owner's binding. */
function connectionCompileRoot(document: SpatialAuthoringDocument, link: Pick<SpatialConnection, "from" | "to">): SpatialId {
  const fromRoot = ancestorChain(document, link.from.occurrenceId).at(-1);
  const toRoot = ancestorChain(document, link.to.occurrenceId).at(-1);
  if (!fromRoot || !toRoot || fromRoot.id !== toRoot.id) {
    throw new ToolError("link/unlink endpoints must share one occurrence tree — cross-tree connections have no compile scope", { code: "unsupported" });
  }
  return fromRoot.id;
}
export const SPATIAL_TOOLS: readonly ToolDefinition[] = [
  { name: "read_region_reference", mode: "read", domains: ["world", "map", "database"],
    description: "Read a completed region example: frozen tile rows, tile passage/priority, image and authoring lessons. Omit id to list examples. Works without spatial activation. Rows are zero-based; tile arrays are row-major and -1 means empty. Follow nextRow to recover the whole map; this is a reference, not a procedural design or build command.",
    parameters: { type: "object", properties: { id: { type: "string" }, row: { type: "integer", minimum: 0 }, rows: { type: "integer", minimum: 1, maximum: 16 } }, additionalProperties: false },
    run(_project, args) {
      if (args.id === undefined) return { summary: "완성 지역 사례", data: { references: structuredClone([...REGION_REFERENCES, ...PLACE_REFERENCES]) } };
      try { return { summary: "완성 지역 사례 원본", data: readRegionReference(String(args.id), args.row === undefined ? 0 : Number(args.row), args.rows === undefined ? 8 : Number(args.rows)) }; }
      catch (error) { throw new ToolError(error instanceof Error ? error.message : String(error), { code: "invalid-args" }); }
    },
  },
  { name: "list_spatial_designs", mode: "read", domains: ["world", "map", "database"],
    description: "Discover saved canonical designs across all project tilesets; query matches id, name or tags. object = reusable appearance/prop, including building exteriors; place = room, floor, yard, complete facility or settlement. Use environment:interior/outdoor for a direct place and placeKind:facility/settlement/natural for a grouped place. For a complete house search kind:place; for saved exteriors search kind:object with query:건물 외형 (or the authored name/tag). Context designs are only samples: search this full library before declaring an asset missing. List rows use kind:place plus placeKind:facility|settlement|natural; get_spatial_design returns the original upsert body. Read-only; never activates or seeds an empty library. When data.active is false the project has no spatialAuthoring document and canonical design/build tools reject with spatial-inactive; read_region_reference remains available — activation is a user-side editor action, not a tool.",
    parameters: SPATIAL_LIST_SCHEMA,
    run(project, args) {
      if (project.spatialAuthoring === undefined) {
        return { summary: "장소 저작 비활성 — canonical 문서가 없는 레거시 프로젝트(0 spatial designs)", data: { active: false, designs: [] } };
      }
      const kind = args.kind === undefined ? undefined : parseKind(args.kind, "kind");
      const query = typeof args.query === "string" ? args.query.toLocaleLowerCase() : "";
      const designs = spatialToolDesigns(project).filter(design => (!kind || design.kind === kind || (kind === "place" && design.kind === "space"))
        && [design.id, design.name, ...design.tags].some(value => value.toLocaleLowerCase().includes(query)));
      return { summary: `${designs.length} spatial designs`, data: { active: true, designs: publicSpatialValue(designs) } };
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
    description: "Read a canonical design and its resolved transitive source revisions, object selections and frozen kit cells. Use data.design as the starting point for upsert_spatial_design. Reuse an exterior object in an outdoor yard place's objectSlots to supply ground and an approach. Alternatively copy design.graphic {tilesetId,kitId} into place.exterior when the graphic supports painted passable port cells; this copy is not an objectDesignId link and does not inherit object anchors/chips or future object changes. A complete house is a place with authored rooms, ports and connections; facade height/labels do not establish usable floor count. Large designs can exceed the tool payload limit — when truncated re-read with resolved:false; the design body alone is enough for a revision round-trip.",
    parameters: SPATIAL_GET_SCHEMA,
    run(project, args) {
      const ref = storageSpatialSource(project, args);
      const document = requireSpatialDocument(project);
      return { summary: `Spatial ${publicSpatialKind(ref.kind)}: ${ref.id}`, data: publicSpatialValue({
        ...designNode(document.library, ref),
        ...(args.resolved === false ? {} : { resolved: resolveSpatialDesign(document, project, ref) }),
      }) };
    },
  },
  { name: "upsert_spatial_design", mode: "write", domains: ["world", "map", "database"],
    description: "Author one canonical design in the detached AI proposal. Supply exactly the body named by kind (object/place/region/world). Place bodies with environment:interior/outdoor describe a room/floor/yard; place bodies with kind:facility/settlement/natural describe a group of child places. expectedRevision=0 creates a new id; updates require the current revision and design.revision=current+1. References must already exist — author bottom-up: objects before child places, child places before enclosing places, places before regions, regions before worlds. A complete house uses place.kind:facility with explicit interior/outdoor place children. Put a saved exterior object into an outdoor yard place's objectSlots for ground/approach; direct place.exterior copies object.graphic only when painted passable port cells are available. Define usable floors from the requested plan, never infer them from facade height or names. For ordinary open-plan homes use interior zones and objectSlots[].zoneId to divide activities without partitions. For rooms sharing one interior map, author place.interiorLayout with floor-local rooms and doorways; the wall generator joins partitions to the outer shell. Interior children are separate maps even at the same level: author ports and connections for room doors, stairs and exterior entry/return. Enclosing place ports require painted passable outdoor surface. For region/world terrain read get_geography_vocabulary first. Never refreshes frozen occurrences or overwrites maps. Uses normal proposal acceptance.",
    parameters: SPATIAL_UPSERT_SCHEMA,
    run(project, args) {
      const requestedKind = parseKind(args.kind, "kind");
      for (const other of kinds) if (other !== requestedKind && args[other] !== undefined) throw new ToolError(`Unexpected ${other} body for ${requestedKind}`, { code: "invalid-args" });
      const { kind, design: raw } = storageSpatialDesign(project, requestedKind, args[requestedKind]);
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
      return { summary: `Spatial ${publicSpatialKind(kind)} ${designId} revision ${expected + 1}`, data: publicSpatialValue(designNode(checkedDocument(project.spatialAuthoring, project).library, { kind, id: designId })) };
    },
  },
  { name: "preview_spatial_build", mode: "read", domains: ["world", "map"],
    description: "Preview a fresh frozen occurrence through the shared validated compiler without changing project data. Object requires an explicit compatible target map rectangle and entry; other kinds generate maps. Returns a draft-owned previewId for apply_spatial_build — exactly one preview is retained per draft and any other write tool call invalidates it, so preview right before applying. Existing occurrences are never implicitly refreshed.",
    parameters: SPATIAL_BUILD_SCHEMA,
    run(project, args) {
      requireSpatialDocument(project);
      const ref = storageSpatialSource(project, args);
      const occurrenceId = id(args.occurrenceId, "occurrenceId");
      const stamp = target(args.target);
      const preview = previewSpatialAuthoring(project, {
        operation: { kind: "instantiate", request: { source: ref, rootId: occurrenceId, x: 0, y: 0, level: 0,
          seed: integer([-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER])(args.seed, "seed"), generatorVersion: "spatial-ai-v1", origin: "ai" } },
        compile: { occurrenceId, ...(stamp ? { target: stamp } : {}) },
      }, { original: project, checkpoint: project });
      return { summary: `Preview ${publicSpatialKind(ref.kind)} ${ref.id}: ${preview.impact.mapIds.length} maps`, data: {
        previewId: issueSpatialToolPreview(project, preview), impact: preview.impact,
        source: publicSpatialValue(own(checkedDocument(preview.project.spatialAuthoring, preview.project).occurrences, occurrenceId).source),
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
  { name: "edit_spatial_occurrence", mode: "write", domains: ["world", "map"],
    description: "Modify an already-built frozen occurrence in the detached AI proposal — source designs are never touched and occurrences never refresh silently. Operations: move (reposition a child inside its region/world parent; needs occurrenceId+x/y, optional level — the containing map recompiles), refresh (rebuild the subtree from the CURRENT source revision — the only way an upserted source edit reaches a built map; object occurrences stamp via preview_spatial_build+apply_spatial_build instead), delete (remove the subtree — externalConnections reject|remove, default reject fails safely while incoming links exist), detach (release compiled ownership, keep content), clone (standalone copy — needs newOccurrenceId; externalConnections omit|copy, default omit), link/unlink (create/remove a navigation connection — link needs connection {id,from:{occurrenceId,portId},to:{occurrenceId,portId},bidirectional}; unlink needs connectionId; the containing root occurrence recompiles). Returns actual impact; uses normal proposal acceptance.",
    parameters: SPATIAL_OCCURRENCE_SCHEMA,
    run(project, args) {
      const document = requireSpatialDocument(project);
      const operation = choice(["move", "delete", "refresh", "detach", "clone", "link", "unlink"] as const)(args.operation, "operation");
      const occurrenceId = args.occurrenceId === undefined ? undefined : id(args.occurrenceId, "occurrenceId");
      const occurrence = () => {
        if (occurrenceId === undefined) throw new ToolError(`${operation} requires occurrenceId`, { code: "invalid-args" });
        return lookupOccurrence(document, occurrenceId);
      };
      const policy = <T extends string>(allowed: readonly T[], fallback: T): T => args.externalConnections === undefined ? fallback
        : choice(allowed)(args.externalConnections, "externalConnections");
      let request: SpatialAuthoringRequest;
      let proposed = project;
      switch (operation) {
        case "move": {
          const child = occurrence();
          if (child.parentId === null) throw new ToolError("move repositions a child inside its region/world parent — root occurrences have no containing map", { code: "invalid-args" });
          const parent = own(document.occurrences, child.parentId);
          if (parent.kind !== "region" && parent.kind !== "world") throw new ToolError(`move only relocates geography children — ${child.id} sits inside ${parent.kind} ${parent.id}`, { code: "invalid-args" });
          proposed = { ...project, spatialAuthoring: checkedDocument({ ...document, occurrences: { ...document.occurrences,
            [child.id]: { ...child, x: coordinate(args.x, "x"), y: coordinate(args.y, "y"),
              level: args.level === undefined ? child.level : coordinate(args.level, "level") } } }, project) };
          request = { operation: { kind: "edit" }, compile: { occurrenceId: parent.id } };
          break;
        }
        case "delete":
          request = { operation: { kind: "delete-occurrence", request: { occurrenceId: occurrence().id,
            externalConnections: policy(["reject", "remove"] as const, "reject") } } };
          break;
        case "refresh": {
          const selected = occurrence();
          if (selected.kind === "object") throw new ToolError("object occurrences are stamped content — rebuild through preview_spatial_build + apply_spatial_build", { code: "unsupported" });
          request = { operation: { kind: "refresh", request: { occurrenceId: selected.id, externalConnections: policy(["reject", "remove"] as const, "reject") } },
            compile: { occurrenceId: selected.id } };
          break;
        }
        case "detach":
          request = { operation: { kind: "detach", occurrenceId: occurrence().id } };
          break;
        case "clone": {
          const selected = occurrence();
          if (args.newOccurrenceId === undefined) throw new ToolError("clone requires newOccurrenceId for the copy's root", { code: "invalid-args" });
          const rootId = id(args.newOccurrenceId, "newOccurrenceId");
          request = { operation: { kind: "clone-occurrence", request: { occurrenceId: selected.id, rootId,
              externalConnections: policy(["omit", "copy"] as const, "omit") } },
            ...(selected.kind === "object" ? {} : { compile: { occurrenceId: rootId } }) };
          break;
        }
        case "link": {
          const input = record(args.connection, "connection", "id from to bidirectional");
          const endpoint = (value: unknown, path: string) => { const entry = record(value, path, "occurrenceId portId");
            return { occurrenceId: id(entry.occurrenceId, `${path}.occurrenceId`), portId: id(entry.portId, `${path}.portId`) }; };
          const link = { id: id(input.id, "connection.id"), from: endpoint(input.from, "connection.from"),
            to: endpoint(input.to, "connection.to"), bidirectional: boolean(input.bidirectional, "connection.bidirectional") };
          request = { operation: { kind: "edit-connection", request: { kind: "create", connection: link } },
            compile: { occurrenceId: connectionCompileRoot(document, link) } };
          break;
        }
        case "unlink": {
          if (args.connectionId === undefined) throw new ToolError("unlink requires connectionId", { code: "invalid-args" });
          const connectionId = id(args.connectionId, "connectionId");
          const link = document.connections.find(entry => entry.id === connectionId);
          if (!link) throw new ToolError(`Missing connection ${connectionId}`, { code: "invalid-args" });
          if (link.overviewRoute !== undefined) throw new ToolError(`${connectionId} is a compiled geography route — remove it by editing the source design route or moving a child instead`, { code: "unsupported" });
          request = { operation: { kind: "edit-connection", request: { kind: "remove", connectionId } },
            compile: { occurrenceId: connectionCompileRoot(document, link) } };
          break;
        }
        default: throw new ToolError(`Unsupported operation ${String(operation)}`, { code: "invalid-args" });
      }
      const before = { ...project };
      let preview;
      try {
        preview = previewSpatialAuthoring(proposed, request, { original: project, checkpoint: project });
      } catch (error) {
        // Preserve the typed domain code so the model can self-correct (e.g. external-connection → "remove").
        if (error instanceof SpatialOperationError || error instanceof SpatialCompileError) {
          throw new ToolError(error.message, { code: error.code });
        }
        throw error;
      }
      Object.assign(project, structuredClone(preview.project));
      authorizeSpatialToolChange(project, before);
      return { summary: `Spatial ${operation}: ${preview.impact.occurrenceIds.length} occurrences · ${preview.impact.mapIds.length} maps`, data: { impact: preview.impact } };
    },
  },
];
