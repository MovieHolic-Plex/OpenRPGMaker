// 마을이 남기는 터(2026-11-15 명세 은행 전/후 — r3b-fun «버들마을»: 집을 마당 둘레로 모으자 광산 입구가 설 바탕 땅이 사라져 출입구가 맵 테두리 칸으로 밀려났고,
// 강 건너에 서 있던 집과 그 다리가 같이 사라졌다).
//  - 굴 입구 자리: 길 곁의 한 단 빈 땅 3×4 를 비워 둔다 — 던전 잇기(pickDungeonGateSpot)가 갱구를 세울 수 있다.
//  - 떨어진 터: 예전 고리 배치가 강 건너나 다른 단에 집·일터를 두었으면 그 터에 하나는 남긴다 — 문까지 걸어 닿는다(다리가 놓인다).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { canMove } from "@/project/collision";
import { runTool } from "@/editor/tools";
import { caveMouthSpotClear, pickDungeonGateSpot } from "@/editor/tools/dungeonLinkTools";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap, Project } from "@/project/types";

type Data = { mapId: string; houses: number; entrance: { x: number; y: number }; doors: { kit: string; x: number; y: number; reached: boolean }[]; gateNooks?: { x: number; y: number }[];
  layout?: { yard?: { x0: number; y0: number; x1: number; y1: number; frame: { role: string; at: string }[]; apart: { x: number; y: number; role: string; why: string }[] } } };

/** 명세 은행 r3b-fun 의 «버들마을» 이 받는 인자(강가 마을 38×48, 집 셋) — 강이 남동쪽 터를 갈라 놓는다. */
const BEODEUL = { theme: "river", water: "river", houseCount: 3, forestType: "broadleaf", width: 38, height: 48, seed: 68900, name: "버들마을" } as const;
const BEODEUL_KEY = JSON.stringify(["project", "154683ba-d3cf-4df7-93d2-14f4960debac"]);

function town(args: Record<string, unknown>, key?: string): { project: Project; map: GameMap; data: Data } {
  const project = createBlankProject() as Project; ensureBundledTilesets(project);
  const ctx = { project, currentMapId: project.startMapId, ...(key ? { assistantRun: true, lookKey: key } : {}) } as ToolContext;
  const res = runTool(ctx, "author_beodeul_town", args);
  expect(res.ok, res.summary).toBe(true);
  const data = res.data as unknown as Data;
  return { project: ctx.project, map: ctx.project.maps[data.mapId]!, data };
}
/** 입구에서 엔진 걸음으로 닿는 칸. */
function reached(project: Project, map: GameMap, from: { x: number; y: number }): Uint8Array {
  const W = map.width, H = map.height, seen = new Uint8Array(W * H), q = [from.y * W + from.x];
  seen[q[0]!] = 1;
  for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !canMove(project, map, x, y, nx, ny)) continue; seen[ny * W + nx] = 1; q.push(ny * W + nx); } }
  return seen;
}

describe("마을은 굴 입구가 설 자리를 길 곁에 남긴다", () => {
  it.each([
    ["강가 마을(은행 r3b-fun 버들마을)", BEODEUL, BEODEUL_KEY],
    ["언덕 마을", { theme: "river", seed: 11, houseCount: 4, landform: "hill" }, undefined],
    ["포구", { theme: "coast", seed: 5, houseCount: 4 }, undefined],
  ] as const)("%s: 남긴 자리에 갱구가 서고, 던전 잇기가 테두리 칸이 아니라 그 자리를 고른다", (_name, args, key) => {
    const { project, map, data } = town({ ...args }, key);
    const nooks = data.gateNooks ?? [];
    expect(nooks.length).toBeGreaterThanOrEqual(1);
    const seen = reached(project, map, data.entrance);
    for (const g of nooks) {
      expect(caveMouthSpotClear(project, map, g), `(${g.x},${g.y}) 에 갱구(3×4)가 선다`).toBe(true);
      expect(seen[g.y * map.width + g.x], `(${g.x},${g.y}) 문 칸에 걸어 닿는다`).toBe(1);
    }
    const at = pickDungeonGateSpot(project, map, (c) => c.x);
    expect(at?.why).toBe("갱구 자리·길 곁");
    expect(at!.x > 0 && at!.y > 0 && at!.x < map.width - 1 && at!.y < map.height - 1, "던전 문은 맵 테두리 칸이 아니다").toBe(true);
  }, 240_000);
});

describe("집을 마당 둘레로 모아도 강 건너 터를 비우지 않는다", () => {
  it("은행 r3b-fun 버들마을: 집 한 채가 강 건너에 남고 그 문까지 걸어 닿는다 — 마당에는 여관과 집 둘이 문을 낸다", () => {
    const { project, map, data } = town({ ...BEODEUL }, BEODEUL_KEY);
    const yard = data.layout?.yard;
    expect(yard, "마당 배치").toBeTruthy();
    const far = yard!.apart.filter((a) => a.why === "bank");
    expect(far.length).toBe(1);
    expect(far[0]!.role).toBe("house");
    const seen = reached(project, map, data.entrance);
    expect(seen[far[0]!.y * map.width + far[0]!.x], "강 건너 집의 문 앞에 걸어 닿는다(다리)").toBe(1);
    expect(data.doors.filter((d) => !d.reached)).toEqual([]);
    expect(yard!.frame.filter((f) => f.at === "yard").length).toBeGreaterThanOrEqual(3);
    expect(data.houses).toBe(3);
  }, 240_000);
});
