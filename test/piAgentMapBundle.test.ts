import { describe, expect, it } from "vitest";
import { mapBundleIds, mapBundleSpill, mergeMapBundles } from "@/ai/piAgent/mapBundle";
import { changedProjectKeys, createPiAgentLineDecoder, encodePiAgentEvent } from "@/ai/piAgent/protocol";
import { commitChangeset } from "@/editor/tools";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function seed(): Project {
  const ctx = { project: createBlankProject() };
  for (const [id, name] of [["map_east", "동쪽"], ["map_west", "서쪽"]] as const) {
    const result = runTool(ctx, "create_map", { id, name, width: 20, height: 16 });
    if (!result.ok) throw new Error(result.summary);
  }
  return ctx.project;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("piAgent mapBundle", () => {
  it("묶음은 맵 + mapTree 아래 파생 맵이다", () => {
    const base = seed();
    const result = clone(base);
    result.maps.map_east_inner = { ...clone(result.maps.map_east!), id: "map_east_inner", name: "실내" };
    const eastNode = result.mapTree.children.find((node) => node.mapId === "map_east")!;
    eastNode.children.push({ mapId: "map_east_inner", children: [] });
    expect(mapBundleIds(result, "map_east").sort()).toEqual(["map_east", "map_east_inner"]);
    expect(mapBundleIds(result, "map_west")).toEqual(["map_west"]);
    expect(mapBundleIds(result, "nope")).toEqual(["nope"]);
  });

  it("실내 맵과 mapTree 항목까지 함께 옮기고, 다른 결과와 합쳐도 게이트를 통과한다", () => {
    const base = seed();
    const a = clone(base);
    a.maps.map_east!.name = "동쪽 (A)";
    a.maps.map_east_inner = { ...clone(a.maps.map_east!), id: "map_east_inner", name: "동쪽 실내" };
    a.mapTree.children.find((node) => node.mapId === "map_east")!.children.push({ mapId: "map_east_inner", children: [] });
    const b = clone(base);
    b.maps.map_west!.name = "서쪽 (B)";

    const merged = mergeMapBundles(base, [
      { mapIds: ["map_east"], project: a },
      { mapIds: ["map_west"], project: b },
    ]);
    expect(merged.spills).toEqual([]);
    expect(merged.conflicts).toEqual([]);
    expect(merged.project.maps.map_east!.name).toBe("동쪽 (A)");
    expect(merged.project.maps.map_west!.name).toBe("서쪽 (B)");
    expect(merged.project.maps.map_east_inner?.name).toBe("동쪽 실내");
    expect(mapBundleIds(merged.project, "map_east").sort()).toEqual(["map_east", "map_east_inner"]);
    expect(changedProjectKeys(base, merged.project).sort()).toEqual(["mapTree", "maps.map_east", "maps.map_east_inner", "maps.map_west"]);
    const gate = commitChangeset(merged.project, base);
    expect(gate.ok).toBe(true);
  });

  it("묶음 밖 변경은 버리고 spill 로 보고한다", () => {
    const base = seed();
    const a = clone(base);
    a.maps.map_east!.name = "동쪽 (A)";
    a.maps.map_west!.name = "남의 맵";
    (a as { startMapId?: string }).startMapId = "map_west";
    const merged = mergeMapBundles(base, [{ mapIds: ["map_east"], project: a }]);
    expect(merged.spills).toEqual([{ mapIds: ["map_east"], keys: ["maps.map_west", "startMapId"] }]);
    expect(merged.project.maps.map_west!.name).toBe(base.maps.map_west!.name);
    expect(merged.project.startMapId).toBe(base.startMapId);
    expect(mapBundleSpill(base, a, ["map_east", "map_west"])).toEqual(["startMapId"]);
  });

  it("같은 맵을 두 결과가 주장하면 뒤의 것이 이기고 conflicts 로 보고한다", () => {
    const base = seed();
    const a = clone(base); a.maps.map_east!.name = "A";
    const b = clone(base); b.maps.map_east!.name = "B";
    const merged = mergeMapBundles(base, [{ mapIds: ["map_east"], project: a }, { mapIds: ["map_east"], project: b }]);
    expect(merged.conflicts).toEqual(["map_east"]);
    expect(merged.project.maps.map_east!.name).toBe("B");
  });

  it("NDJSON 디코더는 조각 경계와 깨진 줄을 견딘다", () => {
    const events: string[] = [];
    const decoder = createPiAgentLineDecoder((event) => events.push(event.type));
    const wire = encodePiAgentEvent({ type: "turn", index: 1 }) + encodePiAgentEvent({ type: "assistant", text: "안녕" });
    decoder.push(wire.slice(0, 7));
    decoder.push(wire.slice(7));
    decoder.push("{not json\n");
    decoder.push('{"type":"error","message":"x"}');
    decoder.flush();
    expect(events).toEqual(["turn", "assistant", "error"]);
  });
});
