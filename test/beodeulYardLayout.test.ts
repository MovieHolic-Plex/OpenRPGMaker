// 마당 먼저, 집은 그 테두리(editor/tools/beodeulYardLayout.ts): 코드 지형 자동 배치는 한 단 마른 터에 마당을 잡고 집이 그 가장자리에 문을 마당으로 내고 선다.
// 조수가 자리를 준 마을(layout.gather·houses)은 마당을 잡지 않고 그 자리 그대로다. 집 수·문 도달은 예전 고리 배치보다 나빠지지 않는다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { yardParts } from "@/editor/tools/beodeulYardLayout";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap, Project } from "@/project/types";

type Rect = { x0: number; y0: number; x1: number; y1: number };
type Yard = Rect & { level: number; lobes: Rect[]; courts: Rect[]; frame: { x: number; y: number; w: number; h: number; front: { x: number; y: number }; role: string; at: string }[] };
type Door = { kit: string; x: number; y: number; reached: boolean };
type Data = { mapId: string; houses: number; anchors: string[]; doors: Door[]; layout: { auto: boolean; gather: { x: number; y: number }; yard?: Yard; moved: string[]; houses?: { x: number; y: number }[] } };

function town(args: Record<string, unknown>): { project: Project; map: GameMap; data: Data } {
  const project = createBlankProject() as Project;
  const ctx = { project, currentMapId: project.startMapId } as ToolContext;
  const res = runTool(ctx, "author_beodeul_town", { theme: "river", ...args });
  expect(res.ok, res.summary).toBe(true);
  const data = res.data as unknown as Data;
  return { project: ctx.project, map: ctx.project.maps[data.mapId]!, data };
}
/** 마당(가운데 네모 + 날개)에서 6칸 안 · 같은 단에 문을 낸 살림집 수. */
function housesOnYard(map: GameMap, data: Data): number {
  const y = data.layout.yard!, W = map.width, lv = map.relief?.levels ?? [];
  const cells: number[] = [];
  for (const r of [y, ...y.lobes]) for (let Y = r.y0; Y <= r.y1; Y += 1) for (let X = r.x0; X <= r.x1; X += 1) cells.push(Y * W + X);
  const anchors = new Set(data.anchors);
  return data.doors.filter((d) => !anchors.has(d.kit)).filter((d) => cells.some((c) => (lv[c] ?? 0) === (lv[d.y * W + d.x] ?? 0) && Math.max(Math.abs((c % W) - d.x), Math.abs(Math.floor(c / W) - d.y)) <= 6)).length;
}

describe("코드 지형 자동 배치 — 마당 먼저", () => {
  it.each([
    ["강가 마을", { seed: 7, houseCount: 4 }],
    ["강 없는 들판 농가", { seed: 3, houseCount: 3, water: "none" }],
    ["포구", { seed: 5, houseCount: 4, theme: "coast" }],
  ] as const)("%s: 집 셋(집이 셋이면 전부)이 마당에 문을 내고, 요청한 집이 다 앉고, 문마다 길이 닿는다", (_name, args) => {
    const { map, data } = town(args);
    const yard = data.layout.yard;
    expect(yard, "자동 배치는 마당을 잡는다").toBeTruthy();
    expect(data.layout.auto).toBe(true);
    expect(data.houses).toBe(args.houseCount);
    expect(data.doors.filter((d) => !d.reached)).toEqual([]);
    expect(housesOnYard(map, data)).toBeGreaterThanOrEqual(3);
    // 우물은 마당 안에 서되 한가운데 축이 아니다
    const g = data.layout.gather;
    expect(g.x >= yard!.x0 && g.x <= yard!.x1 && g.y >= yard!.y0 && g.y <= yard!.y1).toBe(true);
    expect(g.x).not.toBe(Math.round((yard!.x0 + yard!.x1) / 2));
    // 테두리 건물은 마당 북쪽 가장자리에 서고(집 아랫줄이 마당 윗줄 위), 문 앞이 마당 줄에서 세 칸 안이다
    const onYard = yard!.frame.filter((f) => f.at === "yard");
    expect(onYard.length).toBeGreaterThanOrEqual(2);
    for (const f of onYard) {
      const rects = [yard!, ...yard!.lobes];
      expect(rects.some((r) => f.y + f.h - 1 < r.y0 && r.y0 - f.front.y <= 3 && f.front.x >= r.x0 - 9 && f.front.x <= r.x1 + 9), JSON.stringify(f)).toBe(true);
    }
    // 결과 data 에는 칸 목록을 싣지 않는다(조수가 읽는 결과가 불어나지 않게)
    expect(Object.keys(yard!)).not.toContain("cells");
  }, 120_000);

  it("언덕 마을: 집 수와 문 도달이 그대로이고 마당을 잡는다", () => {
    const { data } = town({ seed: 11, houseCount: 4, landform: "hill" });
    expect(data.houses).toBe(4);
    expect(data.doors.filter((d) => !d.reached)).toEqual([]);
    expect(data.layout.yard).toBeTruthy();
  }, 120_000);

  it("조수가 자리를 주면 마당을 잡지 않고 그 자리에 짓는다", () => {
    const auto = town({ seed: 7, houseCount: 4 });
    const layout = { gather: { x: 20, y: 30 }, houses: [{ x: 8, y: 30 }, { x: 30, y: 33 }, { x: 34, y: 20 }], exits: ["west", "east"] };
    const given = town({ seed: 7, houseCount: 4, layout });
    expect(given.data.layout.auto).toBe(false);
    expect(given.data.layout.yard).toBeUndefined();
    expect(given.data.layout.houses).toEqual(layout.houses);
    expect(given.data.houses).toBeLessThanOrEqual(3);
    expect(auto.data.layout.yard).toBeTruthy();
  }, 120_000);
});

describe("yardParts", () => {
  it("잇닿은 덩이로 나누고 첫 칸이 든 덩이를 맨 앞에 둔다", () => {
    const W = 10;
    const parts = yardParts([0, 1, 11, 5, 6, 30], W, 6);
    expect(parts.map((p) => [...p].sort((a, b) => a - b))).toEqual([[5, 6], [0, 1, 11], [30]]);
    // 줄 끝 칸과 다음 줄 첫 칸은 이웃이 아니다
    expect(yardParts([9, 10], W, 9).length).toBe(2);
  });
});
