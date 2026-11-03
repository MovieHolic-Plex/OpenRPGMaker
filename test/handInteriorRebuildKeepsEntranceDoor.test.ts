// 실내 둘을 잇는 문은 다시 짓기 뒤에도 방 입구에 남고, 다른 맵으로 이어진 사다리를 빼앗지 않는다
// (2026-11-04 조수 대조 B1 Opus r3: 감방 계단 ↔ 막사 입구 문이 막사 다시 짓기 때 밤 광장으로 가는 사다리 탈 자리로 끌려가,
// 감방에서 올라오면 사다리 앞에 내리고 광장에서 오면 막사 입구에 내렸다 — scene-transfer-off-door·scene-transfer-pair).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

describe("build_hand_interior_room 다시 짓기 — 실내끼리 잇는 입구 문", () => {
  it("입구 문과 그 착지를 사다리로 옮기지 않는다", () => {
    const ctx = { project: createBlankProject() };
    const outdoor = ctx.project.startMapId;
    const parts = runTool(ctx, "list_hand_interior_parts", {}).data as { floors?: ({ id: string } | string)[]; walls?: ({ id: string } | string)[] };
    const pick = (x: { id: string } | string | undefined) => (typeof x === "string" ? x : x?.id);
    const room = (mapId: string, name: string, plan: string[], objects: { id: string; x: number; y: number }[] = []) => ({
      tileset: "atlas_biome_interior", mapId, name, plan, floor: pick(parts.floors?.[0]), wall: pick(parts.walls?.[0]), objects,
    });
    expect(runTool(ctx, "build_hand_interior_room", room("cell", "감방", ["########", "#......#", "#......#", "#......#", "###.####"])).ok).toBe(true);
    const bar = room("barracks", "막사", ["##########", "#........#", "#........#", "#........#", "#........#", "#........#", "####.#####"], [{ id: "ship ladder", x: 7, y: 3 }]);
    expect(runTool(ctx, "build_hand_interior_room", bar).ok).toBe(true);
    expect(runTool(ctx, "create_transfer_pair", { a: { mapId: "cell", x: 3, y: 4 }, b: { mapId: "barracks", x: 4, y: 6 } }).ok).toBe(true);
    expect(runTool(ctx, "create_transfer_pair", { a: { mapId: "barracks", x: 7, y: 3 }, b: { mapId: outdoor, x: 5, y: 5 } }).ok).toBe(true);
    const gates = () => ctx.project.maps.barracks!.events
      .map((e) => `${e.x},${e.y}->${(e.pages ?? []).flatMap((p) => p.commands).find((c) => c.kind === "transfer")?.mapId ?? ""}`).sort();
    const before = gates();
    expect(before).toEqual(["4,6->cell", `7,3->${outdoor}`].sort());
    expect(runTool(ctx, "build_hand_interior_room", { ...bar, replace: true }).ok).toBe(true);
    expect(gates()).toEqual(before);
    const fromCell = ctx.project.maps.cell!.events.flatMap((e) => (e.pages ?? []).flatMap((p) => p.commands))
      .filter((c): c is Extract<typeof c, { kind: "transfer" }> => c.kind === "transfer");
    expect(fromCell.map((c) => `${c.mapId}(${c.x},${c.y})`)).toEqual(["barracks(4,5)"]);
  });
});
