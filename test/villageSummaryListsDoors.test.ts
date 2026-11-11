// make_place 마을 결과에 집 문 앞 칸을 적는다 — 조수가 문 자리를 짐작하지 않게(2026-11-03 조수 대조 B8 서리나루 Opus:
// 광장 칸을 여관 문으로 짐작해 scene-transfer-off-door 2건, set_map_door 거절 6번).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { VILLAGE_BUILDER } from "@/ai/v2/place/builders/village";
import { lintScenePolish } from "@/project/lint/scenePolishLint";
import type { BuildRun, PlaceSpec } from "@/ai/v2/shared/types";

describe("make_place 마을 요약의 문 앞 칸", () => {
  it("적힌 문 앞 칸으로 create_transfer_pair 하면 트리거가 문 그림에 선다", () => {
    const ctx = { project: createBlankProject() };
    const run = { ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) } as unknown as BuildRun;
    // 씨앗을 고정한다 — 씨앗 없이 지으면 집 앞이 한 칸 길인 마을에서만 떨어져 실행마다 결과가 갈렸다.
    const built = VILLAGE_BUILDER.build(run, { type: "village", name: "시험", theme: "plain", salt: 21931 } as PlaceSpec);
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

  // 2026-11-11 탐침: 집 앞이 한 칸 길(두 구역을 잇는 유일한 통로)이면 문앞 칸을 트리거 자리로 보고 「한쪽이 막힌다」며 출입구를 옆 맨바닥으로 옮겼다
  // (문 71개 가운데 12개). 트리거는 문 그림 칸에 서므로 문앞 칸은 길을 막지 않는다. 아래 두 씨앗은 그때 다섯 문이 맨바닥에 섰다.
  it.each([99012, 11630])("씨앗 %i: 목록의 모든 문 앞 칸이 문 그림 칸에 출입구를 얻는다", (salt) => {
    const ctx = { project: createBlankProject() };
    const run = { ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) } as unknown as BuildRun;
    const built = VILLAGE_BUILDER.build(run, { type: "village", name: "시험", theme: "plain", salt } as PlaceSpec);
    expect(built.ok).toBe(true);
    const mapId = built.mapIds[0]!;
    const doors = (built.state as { doors: { x: number; y: number; kit?: string; reached?: boolean }[] }).doors;
    expect(doors.length).toBeGreaterThan(4);
    // 걸어 닿지 않는 집의 문은 목록에 없다.
    expect(doors.filter((d) => d.reached === false)).toEqual([]);
    const parts = runTool(ctx, "list_hand_interior_parts", {}).data as { floors?: ({ id: string } | string)[]; walls?: ({ id: string } | string)[] };
    const pick = (x: { id: string } | string | undefined) => (typeof x === "string" ? x : x?.id);
    expect(runTool(ctx, "build_hand_interior_room", {
      tileset: "atlas_biome_interior", mapId: "inn", name: "여관",
      plan: ["########", "#......#", "#......#", "#......#", "###.####"], floor: pick(parts.floors?.[0]), wall: pick(parts.walls?.[0]),
    }).ok).toBe(true);
    const base = ctx.project;
    const off: string[] = [];
    for (const door of doors) {
      const one = { project: structuredClone(base) };
      const pair = runTool(one, "create_transfer_pair", { a: { mapId, x: door.x, y: door.y }, b: { mapId: "inn", x: 3, y: 4 } });
      expect(pair.ok, pair.summary).toBe(true);
      const gate = one.project.maps[mapId]!.events.find((e) => !base.maps[mapId]!.events.some((o) => o.id === e.id));
      if (gate?.x !== door.x || gate?.y !== door.y - 1) off.push(`${door.kit}(${door.x},${door.y}) → (${gate?.x},${gate?.y})`);
      expect(lintScenePolish(one.project).filter((i) => i.code === "scene-transfer-off-door" && i.mapId === mapId)).toEqual([]);
    }
    expect(off).toEqual([]);
  });
});
