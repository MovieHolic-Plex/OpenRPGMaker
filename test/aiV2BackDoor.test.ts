// 뒷문 — 2026-11-11 작은 일 재측정(door-backdoor-built, 30가지 가운데 남은 하나): 「긴 집에 뒷문을 만들어 겨울 시장으로 나가게」 를 조수는
// edit_place 의 layoutPatch 로 내려다 «전체 배치를 보내라» 는 같은 거절을 다섯 번 받고 막혔다. 앞 측정에서는 place_door 의 재료 이름을 못 맞혀 포기했다.
// 맵을 잇는 것은 create_transfer_pair 한 번이면 된다 — 막다른 거절이 그 길을 일러야 한다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { layoutPatchRefusal, noDesignRefusal } from "@/ai/v2/tools/placeMemory";
import { V2Session } from "@/ai/v2/turn/session";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import type { GameMap, Project } from "@/project/types";

const mapNamed = (project: Project, name: string): GameMap => Object.values(project.maps).find((map) => map?.name === name)!;

describe("뒷문 — 막다른 거절이 한 번에 되는 길을 이른다", () => {
  it("layoutPatch 거절은 전체 배치를 권하지 않고 create_transfer_pair 를 그 맵 id 와 문 칸으로 준다", () => {
    const project = buildFixture("built");
    const hall = mapNamed(project, "족장의 긴 집");
    const text = layoutPatchRefusal(project, hall.id, { replace: { doors: [{ wall: "outer", x: 12, y: 1 }] } });
    expect(text).toContain(`create_transfer_pair({"a":{"mapId":"${hall.id}","x":12,"y":1}`);
    expect(text).toContain("nothing was changed");
    expect(text).not.toMatch(/Send patch\.set\.layout/u);
    expect(text).not.toContain('mapId":""');
    // 문이 아닌 고침은 그 맵을 먼저 보게 한다 — 다음 호출은 하나, 실제 맵 id 로.
    expect(layoutPatchRefusal(project, hall.id, { replace: {} })).toContain(`Next call: inspect({"mapId":"${hall.id}"})`);
    expect(noDesignRefusal(new V2Session(), project, hall.id)).toContain("create_transfer_pair");
  });

  it("place_door 가 재료를 못 맞히면 문 그림 없이 잇는 길을 같이 적는다", () => {
    const ctx = { project: buildFixture("built") };
    const hall = mapNamed(ctx.project, "족장의 긴 집");
    const result = runTool(ctx, "place_door", { mapId: hall.id, at: { x: 12, y: 2 }, material: "벽 통로" });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("create_transfer_pair");
  });

  it("create_transfer_pair 는 벽 칸을 받아 그 앞 걷는 칸에 출입구를 붙인다(한 번에 두 맵이 이어진다)", () => {
    const ctx = { project: buildFixture("built") };
    const hall = mapNamed(ctx.project, "족장의 긴 집"), market = mapNamed(ctx.project, "겨울 시장");
    const result = runTool(ctx, "create_transfer_pair", { a: { mapId: hall.id, x: 10, y: 1 }, b: { mapId: market.id, x: 21, y: 13 } });
    expect(result.ok, result.summary).toBe(true);
    const toMarket = mapNamed(ctx.project, "족장의 긴 집").events.filter((event) => !hall.events.some((old) => old.id === event.id))
      .flatMap((event) => (event.pages ?? []).flatMap((page) => page.commands)).filter((command) => command.kind === "transfer" && (command as { mapId?: string }).mapId === market.id);
    expect(toMarket.length).toBeGreaterThan(0);
    const back = mapNamed(ctx.project, "겨울 시장").events.filter((event) => !market.events.some((old) => old.id === event.id))
      .flatMap((event) => (event.pages ?? []).flatMap((page) => page.commands)).filter((command) => command.kind === "transfer" && (command as { mapId?: string }).mapId === hall.id);
    expect(back.length).toBeGreaterThan(0);
  });
});
