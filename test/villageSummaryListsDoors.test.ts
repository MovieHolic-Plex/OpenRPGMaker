// make_place 마을 결과에 집 문 앞 칸을 적는다 — 조수가 문 자리를 짐작하지 않게(2026-11-03 조수 대조 B8 서리나루 Opus:
// 광장 칸을 여관 문으로 짐작해 scene-transfer-off-door 2건, set_map_door 거절 6번).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { VILLAGE_BUILDER } from "@/ai/v2/builders/village";
import { lintScenePolish } from "@/project/lint/scenePolishLint";
import type { BuildRun, PlaceSpec } from "@/ai/v2/types";

describe("make_place 마을 요약의 문 앞 칸", () => {
  it("적힌 문 앞 칸으로 create_transfer_pair 하면 트리거가 문 그림에 선다", () => {
    const ctx = { project: createBlankProject() };
    const run = { ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) } as unknown as BuildRun;
    const built = VILLAGE_BUILDER.build(run, { type: "village", name: "시험", theme: "plain" } as PlaceSpec);
    expect(built.ok).toBe(true);
    const m = /집 문 앞 칸[^:]*: \S+?\((\d+),(\d+)\)/u.exec(built.summary);
    expect(m, built.summary).not.toBeNull();
    const mapId = built.mapIds[0]!;
    const parts = runTool(ctx, "list_hand_interior_parts", {}).data as { floors?: ({ id: string } | string)[]; walls?: ({ id: string } | string)[] };
    const pick = (x: { id: string } | string | undefined) => (typeof x === "string" ? x : x?.id);
    expect(runTool(ctx, "build_hand_interior_room", {
      tileset: "atlas_biome_interior", mapId: "inn", name: "여관",
      plan: ["########", "#......#", "#......#", "#......#", "###.####"], floor: pick(parts.floors?.[0]), wall: pick(parts.walls?.[0]),
    }).ok).toBe(true);
    const pair = runTool(ctx, "create_transfer_pair", { a: { mapId, x: Number(m![1]), y: Number(m![2]) }, b: { mapId: "inn", x: 3, y: 4 } });
    expect(pair.ok, pair.summary).toBe(true);
    expect(lintScenePolish(ctx.project).filter((i) => i.code === "scene-transfer-off-door" && i.mapId === mapId)).toEqual([]);
  });
});
