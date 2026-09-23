// 타일셋 참고문서 선행 읽기는 모델이 타일을 직접 고르는 도구에만 걸린다.
// 2026-09-24 헤드리스 「등대지기의 겨울」: 22×18 보스방 create_map 한 번에 34건, 던전 파이프라인에 11건 읽기를 요구해
// read_tileset_reference 14회·거부 4회가 났다. 두 도구 모두 타일을 코드가 고른다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TilesetReferenceEvidence } from "@/ai/tilesetReferenceEvidence";
import { listTools } from "@/editor/tools";
import { referenceOwner } from "@/project/tilesetReferences";
import type { Project } from "@/project/types";

function tilesetWithReferences(project: Project): string {
  const tileset = Object.values(project.tilesets).find(t => (referenceOwner(project, t).referenceDocuments ?? []).length > 0);
  if (!tileset) throw new Error("fixture: no tileset with reference documents");
  return tileset.id;
}

describe("tileset reference gate scope", () => {
  it("does not gate writers whose tiles are chosen by code", () => {
    const project = createBlankProject();
    const tilesetId = tilesetWithReferences(project);
    const gate = new TilesetReferenceEvidence();
    expect(gate.beforeWrite(project, "create_map", { name: "등대 꼭대기", width: 22, height: 18, tilesetId })).toBeNull();
    expect(gate.beforeWrite(project, "run_dungeon_room_pipeline", { mapId: "map_ice_cave", theme: "ice", path: "cave" })).toBeNull();
    expect(gate.beforeWrite(project, "run_interior_room_pipeline", { mapId: "map_top", theme: "study", rooms: [{ id: "r", x: 1, y: 1, w: 6, h: 6, floorTile: 12 }] })).toBeNull();
    expect(gate.beforeWrite(project, "generate_map", { theme: "cave", width: 30, height: 20 })).toBeNull();
    expect(gate.beforeWrite(project, "resize_map", { mapId: project.startMapId, width: 30, height: 30 })).toBeNull();
  });

  it("still requires reading before the model hand-picks tiles", () => {
    const project = createBlankProject();
    const tilesetId = tilesetWithReferences(project);
    const mapId = project.startMapId;
    project.maps[mapId]!.tilesetId = tilesetId;
    const blocked = new TilesetReferenceEvidence().beforeWrite(project, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: 12, cells: [{ x: 1, y: 1 }] });
    expect(blocked?.ok).toBe(false);
    expect(blocked?.issues?.[0]?.code).toBe("tileset-reference-read-required");
  });

  it("only tile-choosing tools tell the model to read references first", () => {
    const byName = new Map(listTools().map(tool => [tool.name, tool]));
    for (const name of ["create_map", "run_dungeon_room_pipeline", "run_interior_room_pipeline"]) {
      const tool = byName.get(name)!;
      expect(tool.description).not.toContain("먼저 조회한다");
      expect(JSON.stringify(tool.parameters.properties.referencePurpose)).toContain("읽지 않아도 된다");
    }
    expect(byName.get("paint_tiles")!.description).toContain("먼저 조회한다");
  });
});
