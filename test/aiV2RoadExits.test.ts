// 바깥 맵 사이 출구는 길이 맵 끝에 닿는 자리(길 입구)에 선다 — 구성기가 주문받은 변까지 길을 내고, 잇기가 그 길 끝에 길 폭 전체로 출구를 둔다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import type { ToolContext } from "@/editor/tools/types";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { edgeRoadMouths, layExitRoad, linkAtRoadMouths, roadEndToward, roadNetwork } from "@/ai/v2/place/roadMouths";
import { isRoadGround } from "@/ai/v2/place/surface";
import { WORLDS } from "@/ai/v2/place/world";

/** 세계의 장소 종류 하나를 그 세계의 구성 도구로 짓는다(씨앗 3). */
function worldRun(worldId: string) {
  const world = WORLDS.find((w) => w.id === worldId)!;
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const run = createBuildRun(ctx);
  const compose = (name: string, kindId: string): string => {
    const kind = world.kinds.find((k) => k.id === kindId)!, made = kind.compose!, composer = world.composer!;
    const mapId = composer.newMap ? undefined : (run.call("create_map", { name, width: made.size[0], height: made.size[1], tilesetId: world.tilesetId }).data as { mapId: string }).mapId;
    const res = run.call(made.tool ?? composer.tool, { ...(mapId ? { mapId } : { newMap: { name } }), [composer.param]: made.value, seed: 3 });
    expect(res.ok, String(res.summary)).toBe(true);
    return mapId ?? (res.data as { mapId: string }).mapId;
  };
  return { run, compose };
}

type TransferCmd = { kind?: string; mapId?: string; x?: number; y?: number; direction?: string };
function transfersIn(node: unknown, out: TransferCmd[] = []): TransferCmd[] {
  if (Array.isArray(node)) node.forEach((n) => transfersIn(n, out));
  else if (node && typeof node === "object") {
    if ((node as TransferCmd).kind === "transfer") out.push(node as TransferCmd);
    for (const v of Object.values(node)) if (v && typeof v === "object") transfersIn(v, out);
  }
  return out;
}

function desertRun() {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const run = createBuildRun(ctx);
  const compose = (name: string, kind: string, width: number, height: number, exits?: readonly string[]): string => {
    const mapId = (run.call("create_map", { name, width, height, tilesetId: "desert_east" }).data as { mapId: string }).mapId;
    const res = run.call("compose_desert_east_map", { mapId, kind, seed: 3, ...(exits ? { exits } : {}) });
    expect(res.ok, String(res.summary)).toBe(true);
    return mapId;
  };
  const sides = (mapId: string) => edgeRoadMouths(run.ctx.project, run.ctx.project.maps[mapId]!).map((m) => m.side);
  return { run, compose, sides };
}

describe("조수 v2 — 출구와 길", () => {
  it("구성기는 주문받은 변까지 길을 낸다(주문이 없으면 제 길만)", () => {
    const { compose, sides } = desertRun();
    expect(sides(compose("대상 숙소 그대로", "caravanserai", 40, 34))).toEqual(["south"]);
    expect(sides(compose("대상 숙소", "caravanserai", 40, 34, ["east"])).sort()).toEqual(["east", "south"]);
  }, 60_000);

  it("바깥 맵 둘을 길 입구끼리 잇고 출구가 길 폭을 다 덮는다", () => {
    const { run, compose } = desertRun();
    const inn = compose("대상 숙소", "caravanserai", 40, 34, ["east"]), palace = compose("궁전", "palace", 48, 40);
    const linked = linkAtRoadMouths(run, inn, palace, "east", {});
    expect(linked?.ok, linked?.note).toBe(true);
    for (const [mapId, side] of [[inn, "east"], [palace, "south"]] as const) {
      const project = run.ctx.project, map = project.maps[mapId]!;
      const gates = map.events.filter((e) => e.id.startsWith("ev_world_gate"));
      expect(gates.length).toBeGreaterThan(1);
      expect(gates.every((g) => isRoadGround(project, map, g.x, g.y))).toBe(true);
      const mouth = edgeRoadMouths(project, map).find((m) => m.side === side)!;
      expect(mouth.cells.every((c) => gates.some((g) => g.x === c.x && g.y === c.y))).toBe(true);
      // 넘어간 사람은 상대 맵의 가장자리 줄에서 한 칸 안쪽 길 위에, 맵 안쪽을 보고 선다(가장자리 줄은 돌아가는 칸이다).
      const arrivals = gates.flatMap((g) => transfersIn(g.pages)).filter((t) => t.mapId !== mapId);
      expect(arrivals.every((t) => {
        const dest = project.maps[t.mapId!]!;
        return t.x! > 0 && t.y! > 0 && t.x! < dest.width - 1 && t.y! < dest.height - 1 && isRoadGround(project, dest, t.x!, t.y!) && !!t.direction;
      })).toBe(true);
    }
  }, 60_000);

  it("길 재료를 선언한 칩셋은 길이 닿지 않는 변까지 길을 내 입구를 만든다(해적 요새 — 성문 길은 남쪽 해변으로만 난다)", () => {
    const { run, compose } = worldRun("pirate_isles");
    const fort = compose("요새", "fort");
    expect(edgeRoadMouths(run.ctx.project, run.ctx.project.maps[fort]!)).toEqual([]);
    const mouth = layExitRoad(run, fort, "west")!;
    const project = run.ctx.project, map = project.maps[fort]!, network = roadNetwork(project, map);
    expect(mouth.side).toBe("west");
    expect(mouth.cells.length).toBe(2);
    expect(mouth.cells.every((c) => c.x === 0 && isRoadGround(project, map, c.x, c.y) && network.has(c.y * map.width + c.x))).toBe(true);
  }, 60_000);

  it("가장자리에 길이 없는 섬은 길 끝끼리 잇는다 — 출구도 도착 칸도 길 위, 도착하면 출구를 등진다", () => {
    const { run, compose } = worldRun("sky_island");
    const village = compose("하늘 마을", "village"), dock = compose("비공정 부두", "dock");
    expect(edgeRoadMouths(run.ctx.project, run.ctx.project.maps[village]!)).toEqual([]);
    expect(roadEndToward(run.ctx.project, run.ctx.project.maps[village]!, "east")).toBeDefined();
    const linked = linkAtRoadMouths(run, village, dock, "east", {});
    expect(linked?.ok, linked?.note).toBe(true);
    for (const [here, there] of [[village, dock], [dock, village]] as const) {
      const project = run.ctx.project, map = project.maps[here]!, other = project.maps[there]!;
      const gates = map.events.filter((e) => e.id.startsWith("ev_world_gate"));
      expect(gates.length).toBeGreaterThan(0);
      expect(gates.every((g) => isRoadGround(project, map, g.x, g.y))).toBe(true);
      const arrivals = gates.flatMap((g) => transfersIn(g.pages)).filter((t) => t.mapId === there);
      expect(arrivals.length).toBeGreaterThan(0);
      expect(arrivals.every((t) => isRoadGround(project, other, t.x!, t.y!) && !!t.direction)).toBe(true);
    }
  }, 60_000);

  it("길 입구가 어느 쪽에도 없으면 잇지 않고 넘긴다(부르는 쪽이 예전 길로 잇는다)", () => {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const run = createBuildRun(ctx);
    const blank = (name: string) => (run.call("create_map", { name, width: 20, height: 20, tilesetId: "desert_east" }).data as { mapId: string }).mapId;
    expect(linkAtRoadMouths(run, blank("빈 땅 하나"), blank("빈 땅 둘"), "east", {})).toBeUndefined();
  }, 60_000);
});
