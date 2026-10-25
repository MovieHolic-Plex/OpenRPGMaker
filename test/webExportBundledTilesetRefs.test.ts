import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, ProjectFormatError } from "@/project/io";
import { prepareWebExport } from "@/project/webExport";
import { BUNDLED_TILESET_REF } from "@/project/bundledTilesetRefs";
import { jsonEqual } from "@/util/structuralJson";
import type { Project } from "@/project/types";

// 2026-10-25 심사 S4: 내보낸 project.json 이 쓰는 번들 타일셋 정의(칸 통행·tileMeta·킷, 하나에 수 MB)를 통째로 실어
// 98MB 급 게임이 출하 플레이어 부팅 중 렌더러를 잃었다. 번들 정의와 같은 타일셋은 참조로 싣고 플레이어가 되돌린다.

describe("web export references bundled tilesets", () => {
  it("a project using only bundled tilesets exports small and round-trips to the same tilesets", () => {
    const project = createBlankProject() as Project;
    const prepared = prepareWebExport(project);
    const wire = JSON.parse(prepared.projectJson) as { tilesets: Record<string, Record<string, unknown>> };
    const refs = Object.entries(wire.tilesets).filter(([, tileset]) => typeof tileset[BUNDLED_TILESET_REF] === "string");
    expect(refs.length).toBe(Object.keys(prepared.project.tilesets).length);
    for (const [, tileset] of refs) expect(tileset.passability).toBeUndefined();
    // 번들 정의를 통째로 실으면 10MB 를 넘는다(beodeul_city 하나가 8MB).
    expect(prepared.summary.projectJsonBytes).toBeLessThan(5_000_000);

    const reloaded = deserialize(prepared.projectJson);
    for (const id of Object.keys(prepared.project.tilesets)) expect(jsonEqual(reloaded.tilesets[id], prepared.project.tilesets[id])).toBe(true);
  });

  it("an edited bundled tileset is still inlined", () => {
    const project = createBlankProject() as Project;
    const id = Object.values(project.maps)[0]!.tilesetId!;
    const tileset = project.tilesets[id]!;
    tileset.tileMeta = tileset.tileMeta?.map((meta, index) => (index === 1 ? { ...meta, label: "저자가 고친 이름" } : meta));
    const wire = JSON.parse(prepareWebExport(project).projectJson) as { tilesets: Record<string, Record<string, unknown>> };
    expect(wire.tilesets[id]![BUNDLED_TILESET_REF]).toBeUndefined();
    expect(Array.isArray(wire.tilesets[id]!.passability)).toBe(true);
  });

  it("a reference whose digest differs from this player's bundle is refused, not silently remapped", () => {
    const prepared = prepareWebExport(createBlankProject() as Project);
    const wire = JSON.parse(prepared.projectJson) as { tilesets: Record<string, Record<string, unknown>> };
    const [id] = Object.entries(wire.tilesets).find(([, tileset]) => tileset[BUNDLED_TILESET_REF])!;
    wire.tilesets[id]![BUNDLED_TILESET_REF] = "0-0-0";
    expect(() => deserialize(JSON.stringify(wire))).toThrow(ProjectFormatError);
  });
});
