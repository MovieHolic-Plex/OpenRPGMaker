// show_spatial_design — 조수가 오브젝트 설계의 **그림**을 받는 읽기 도구(qa1124-space PR9).
//
// 조수는 지금까지 오브젝트를 이름·태그로만 골랐다(맵은 show_map_region 이 그림을 준다). 이 도구는 설계가
// 실제로 그리는 칸 배열을 돌려주고, 편집기 렌더러(toolImageRenderer)가 그 배열을 PNG 한 장으로 그린다.
// 그림은 공용 썸네일 캐시(thumbCache)를 거치므로 공간 탭이 이미 구운 그림이면 다시 그리지 않는다.
// 새 그림을 만들지 않는다 — 이미 있는 타일 칸을 그대로 늘어놓을 뿐이다.
import { resolveSpatialGraphic } from "@/project/spatial/assets";
import { TILE } from "@/project/defaults/constants";
import type { Project, SectionStructureKitDef } from "@/project/types";
import { sharedObjectDef } from "./sharedDesignCatalog";
import { ToolError, type ToolDefinition } from "./types";

export type SpatialDesignCell = { readonly dx: number; readonly dy: number; readonly layer: "lower" | "upper"; readonly tile: number };

export type SpatialDesignView =
  | {
    readonly kind: "cells";
    readonly id: string;
    readonly name: string;
    readonly tilesetId: string;
    readonly kitId: string;
    readonly width: number;
    readonly height: number;
    readonly cells: readonly SpatialDesignCell[];
    readonly source: "authored" | "builtin";
  }
  | { readonly kind: "preview"; readonly id: string; readonly name: string; readonly preview: string; readonly width: number; readonly height: number };

function sectionCells(kit: SectionStructureKitDef): SpatialDesignCell[] {
  const cells: SpatialDesignCell[] = [];
  for (let row = 0; row < kit.rows.length; row += 1) {
    const rowDef = kit.rows[row];
    if (!rowDef) continue;
    for (let column = 0; column < kit.width; column += 1) {
      const lower = rowDef.tiles[column] ?? TILE.EMPTY;
      const upper = rowDef.upperTiles?.[column] ?? TILE.EMPTY;
      if (lower !== TILE.EMPTY) cells.push({ dx: column, dy: row, layer: "lower", tile: lower });
      if (upper !== TILE.EMPTY) cells.push({ dx: column, dy: row, layer: "upper", tile: upper });
    }
  }
  return cells;
}

/** 이름으로 주어진 설계를 그림 재료(칸 배열 또는 공용 미리보기 그림)로 푼다. */
export function spatialDesignView(project: Project, args: { readonly id?: unknown; readonly tilesetId?: unknown; readonly kitId?: unknown }): SpatialDesignView {
  const id = typeof args.id === "string" ? args.id : undefined;
  if (id?.startsWith("shared-object:") || (id && !args.tilesetId && sharedObjectDef(id))) {
    const sharedId = id.replace(/^shared-object:/, "");
    const def = sharedObjectDef(sharedId);
    if (!def) throw new ToolError(`공용 오브젝트 ${sharedId} 가 없다`, { code: "not-found" });
    return { kind: "preview", id: sharedId, name: def.name, preview: def.preview, width: def.width, height: def.height };
  }
  let tilesetId = typeof args.tilesetId === "string" ? args.tilesetId : undefined;
  let kitId = typeof args.kitId === "string" ? args.kitId : undefined;
  let name: string | undefined;
  if (id && (!tilesetId || !kitId)) {
    const object = project.spatialAuthoring?.library.objects[id as keyof NonNullable<Project["spatialAuthoring"]>["library"]["objects"]];
    if (!object) throw new ToolError(`오브젝트 설계 ${id} 가 없다 — list_spatial_designs 의 id, 또는 tilesetId+kitId 를 준다`, { code: "not-found" });
    tilesetId = object.graphic.tilesetId;
    kitId = object.graphic.kitId;
    name = object.name;
  }
  if (!tilesetId || !kitId) throw new ToolError("id 또는 tilesetId+kitId 가 필요하다", { code: "invalid-args" });
  const resolved = resolveSpatialGraphic(project, { tilesetId, kitId });
  if (!resolved) throw new ToolError(`타일셋 ${tilesetId} 에 그림 ${kitId} 가 없다`, { code: "not-found" });
  if (resolved.source === "builtin") {
    const object = resolved.object;
    return { kind: "cells", id: id ?? kitId, name: name ?? object.label, tilesetId, kitId, width: Math.max(1, object.width), height: Math.max(1, object.height),
      cells: object.cells.map(cell => ({ dx: cell.dx, dy: cell.dy, layer: cell.layer, tile: cell.tile })), source: "builtin" };
  }
  if (resolved.kit.kind !== "section") throw new ToolError(`${kitId} 는 칸 그림이 아닌 킷(${resolved.kit.kind})이라 그릴 수 없다`, { code: "unsupported" });
  const kit = resolved.kit as SectionStructureKitDef;
  return { kind: "cells", id: id ?? kitId, name: name ?? kit.name ?? kitId, tilesetId, kitId, width: Math.max(1, kit.width), height: Math.max(1, kit.height),
    cells: sectionCells(kit), source: "authored" };
}

const showSpatialDesign: ToolDefinition = {
  name: "show_spatial_design",
  mode: "read",
  domains: ["world", "map", "database"],
  description: "Show one object design as a real picture (PNG of its tiles) — use it to check what an object looks like before stamping or choosing it, instead of guessing from the name. "
    + "Give the design id from list_spatial_designs (own library object, or a shared row id like shared-object:<id>), or tilesetId+kitId of a tileset kit / built-in interior object. "
    + "Returns size and tile cells; the editor attaches the rendered image. Reading only — nothing is created or changed.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "list_spatial_designs id (library object id or shared-object:<id>)" },
      tilesetId: { type: "string" },
      kitId: { type: "string", description: "structure kit id or built-in interior object id on that tileset" },
    },
    additionalProperties: false,
  },
  run(project, args) {
    const view = spatialDesignView(project, args);
    const size = `${view.width}×${view.height}칸`;
    return {
      summary: view.kind === "preview" ? `오브젝트 그림: ${view.name} (${size}, 공용 미리보기)` : `오브젝트 그림: ${view.name} (${size}, ${view.tilesetId}/${view.kitId})`,
      data: view,
    };
  },
};

export const SPATIAL_DESIGN_VIEW_TOOLS: readonly ToolDefinition[] = [showSpatialDesign];
