// 실내를 다시 지어도 벽에 박힌 사다리에 단 바깥 출구는 사다리에 남는다(2026-11-03 조수 대조 B1 Opus:
// 막사 끝 사다리 ↔ 밤 광장 출구가 edit_place 다시 짓기 뒤 막사 입구로 끌려가 사다리는 아무 데도 안 가고 입구가 광장으로 나갔다).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

describe("build_hand_interior_room 다시 짓기", () => {
  it("사다리 그림 칸의 바깥 출구를 가장자리 틈으로 옮기지 않는다", () => {
    const ctx = { project: createBlankProject() };
    const outdoor = ctx.project.startMapId;
    const parts = runTool(ctx, "list_hand_interior_parts", {});
    const data = parts.data as { floors?: ({ id: string } | string)[]; walls?: ({ id: string } | string)[] };
    const pick = (x: { id: string } | string | undefined) => (typeof x === "string" ? x : x?.id);
    const args = {
      tileset: "atlas_biome_interior", mapId: "barracks", name: "막사",
      plan: ["##########", "#........#", "#........#", "#........#", "#........#", "#........#", "####.#####"],
      floor: pick(data.floors?.[0]), wall: pick(data.walls?.[0]),
      objects: [{ id: "ship ladder", x: 2, y: 3 }],
    };
    expect(runTool(ctx, "build_hand_interior_room", args).ok).toBe(true);
    expect(runTool(ctx, "create_transfer_pair", { a: { mapId: "barracks", x: 2, y: 3 }, b: { mapId: outdoor, x: 5, y: 5 } }).ok).toBe(true);
    const exits = () => ctx.project.maps.barracks!.events
      .filter((e) => (e.pages ?? []).some((p) => p.commands.some((c) => c.kind === "transfer" && c.mapId === outdoor)))
      .map((e) => `${e.x},${e.y}`);
    expect(exits()).toEqual(["2,3"]);
    const again = runTool(ctx, "build_hand_interior_room", { ...args, replace: true });
    expect(again.ok, again.summary).toBe(true);
    expect(exits()).toEqual(["2,3"]);
  });
});
