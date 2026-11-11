import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runCheck } from "@/harnesses/assistant-capability/node/smallJobs/checks";
import { buildFixture, type FixtureId } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import { applyCalls, type SmallJob } from "@/harnesses/assistant-capability/node/smallJobs/suite";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";

// 장치 도구의 계약 — 싼 모델이 한 호출로 부르는 꼴이 거절되지 않고, 작은 일 셋째 묶음의 판정(결과만 본다)을 통과한다.
// 2026-11-11 전: define_crop 은 seasons 가 없으면 거절 · set_deadline_ending 은 시간 시스템이 꺼져 있으면 거절 ·
// make_action_enemy 는 트룹을 먼저 만들고 맵을 옵트인해야 했다 · configure_object_behavior 는 pageId 가 필수였다.

const JOBS = (JSON.parse(readFileSync("harness-data/assistant-capability/small-jobs-3.json", "utf8")) as { jobs: SmallJob[] }).jobs;
const job = (id: string): SmallJob => JOBS.find((entry) => entry.id === id)!;
function judge(id: string, calls: SmallJob["reference"]) {
  const fixture = buildFixture(job(id).fixture as FixtureId);
  const after = applyCalls(fixture, calls);
  return { after, verdict: runCheck(job(id).check, job(id).allow, fixture, after) };
}

describe("장치 도구 — 한 호출 꼴", () => {
  it("define_crop: 계절을 안 적은 새 작물은 사계절 자란다", () => {
    const [seed, harvest] = job("crop-turnip-starter").reference;
    const { after, verdict } = judge("crop-turnip-starter", [seed!, harvest!,
      { tool: "define_crop", args: { crop: { id: "crop_turnip", name: "순무", seedItemId: "item_ref_turnip_seed", harvestItemId: "item_ref_turnip", stages: [{ days: 1 }, { days: 2 }] } } }]);
    expect(verdict.pass, verdict.reason).toBe(true);
    expect(after.database.crops?.find((crop) => crop.id === "crop_turnip")?.seasons).toEqual(["spring", "summer", "fall", "winter"]);
  });

  it("define_crop: 있는 작물은 보낸 칸만 바뀐다(계절을 덮지 않는다)", () => {
    const ctx: ToolContext = { project: buildFixture("starter") };
    for (const item of [{ id: "item_seed", name: "씨앗", type: "seed", price: 5 }, { id: "item_crop", name: "열매", price: 9 }]) expect(runTool(ctx, "upsert_item", { item }).ok).toBe(true);
    expect(runTool(ctx, "define_crop", { crop: { id: "crop_a", name: "열매", seedItemId: "item_seed", harvestItemId: "item_crop", stages: [{ days: 2 }], seasons: ["summer"] } }).ok).toBe(true);
    expect(runTool(ctx, "define_crop", { crop: { id: "crop_a", name: "큰 열매" } }).ok).toBe(true);
    expect(ctx.project.database.crops?.find((crop) => crop.id === "crop_a")).toMatchObject({ name: "큰 열매", seasons: ["summer"] });
  });

  it("set_deadline_ending: 시간 시스템이 꺼져 있으면 기본 시계로 켜고 영어로 알린다", () => {
    const [, ending, deadline] = job("deadline-ending-starter").reference;
    const { after, verdict } = judge("deadline-ending-starter", [ending!, deadline!]);
    expect(verdict.pass, verdict.reason).toBe(true);
    expect(after.system.timeSystem).toMatchObject({ enabled: true, forceSleep: true, onDayEnd: "ce_deadline_ending" });
    const ctx: ToolContext = { project: buildFixture("starter") };
    expect(runTool(ctx, ending!.tool, ending!.args).ok).toBe(true);
    const result = runTool(ctx, deadline!.tool, deadline!.args);
    expect(result.diff?.warnings ?? []).toEqual(expect.arrayContaining([expect.stringMatching(/^The time system was off/u)]));
  });

  it("set_deadline_ending: 0 으로 채워 보낸 문턱은 기본 결말이다(싼 모델은 선택 칸을 0 · \"*\" 로 채운다)", () => {
    // Break(2026-11-12 셋째 묶음 Terra, 수리 뒤 실행): tiers:[{endingId, friendshipAtLeast:0, characterId:"*"}] 를 일곱 번 보내고 일곱 번 «마지막 항목은 문턱 없이»로 거절당했다.
    const [, ending] = job("deadline-ending-starter").reference;
    const endingId = (ending!.args as { id: string }).id;
    const filled = { endingId, friendshipAtLeast: 0, characterId: "*" };
    for (const tiers of [[filled], [filled, filled]]) {
      const { verdict } = judge("deadline-ending-starter", [ending!, { tool: "set_deadline_ending", args: { days: 3, characterId: "*", tiers } }]);
      expect(verdict.pass, verdict.reason).toBe(true);
    }
    // 문턱 없는 항목 뒤에 다른 엔딩이 있으면 여전히 거절한다 — 닿지 않는 엔딩을 말없이 버리지 않는다.
    const ctx: ToolContext = { project: buildFixture("starter") };
    runTool(ctx, ending!.tool, ending!.args);
    runTool(ctx, "define_ending", { id: "ending_other", name: "다른 끝" });
    expect(runTool(ctx, "set_deadline_ending", { days: 3, tiers: [filled, { endingId: "ending_other" }] }).ok).toBe(false);
  });

  it("set_deadline_ending: 켜 둔 시계는 건드리지 않고, 실패하면 시간 시스템도 켜지 않는다", () => {
    const [clock, ending, deadline] = job("deadline-ending-starter").reference;
    const ctx: ToolContext = { project: buildFixture("starter") };
    for (const call of [clock!, ending!, deadline!]) expect(runTool(ctx, call.tool, call.args).ok).toBe(true);
    expect(ctx.project.system.timeSystem).toMatchObject({ enabled: true, forceSleep: false });
    const bare: ToolContext = { project: buildFixture("starter") };
    expect(runTool(bare, "set_deadline_ending", { days: 3, tiers: [{ endingId: "ending_missing" }] }).ok).toBe(false);
    expect(bare.project.system.timeSystem).toBeUndefined();
  });

  it("make_action_enemy: 트룹·맵 옵트인 없이 한 호출로 덤벼드는 적을 푼다", () => {
    const { after, verdict } = judge("action-slimes-starter", [{ tool: "make_action_enemy", args: {
      enemyId: "enemy_slime", actionProfile: { contactDamage: 3 }, spawnMode: "add", spawn: { mapId: "map_blank_start", area: { x: 6, y: 4, w: 8, h: 6 }, maxAlive: 2 } } }]);
    expect(verdict.pass, verdict.reason).toBe(true);
    expect(after.maps.map_blank_start?.actionCombat).toBe(true);
    expect(after.system.actionCombat?.enabled).toBe(true);
    expect(after.database.troops.find((troop) => troop.id === "troop_enemy_slime_field")?.enemyIds).toEqual(["enemy_slime"]);
  });

  it("make_action_enemy: 실패한 호출은 트룹도 맵도 바꾸지 않는다", () => {
    const ctx: ToolContext = { project: buildFixture("starter") };
    const before = structuredClone(ctx.project);
    const result = runTool(ctx, "make_action_enemy", { enemyId: "enemy_slime", actionProfile: { contactDamage: 3 }, spawnMode: "add", spawn: { mapId: "map_blank_start", area: { x: 0, y: 0, w: 999, h: 2 } } });
    expect(result.ok).toBe(false);
    expect(ctx.project.database.troops).toEqual(before.database.troops);
    expect(ctx.project.maps.map_blank_start?.actionCombat).toBe(before.maps.map_blank_start?.actionCombat);
  });

  it("configure_object_behavior: pageId 를 안 적으면 첫 페이지를 밀 수 있게 한다", () => {
    const rock = structuredClone(job("push-rock-starter").reference[0]!) as { tool: string; args: { event: { pages: Record<string, unknown>[] } } };
    delete rock.args.event.pages[0]!.interaction;
    const { verdict } = judge("push-rock-starter", [rock as never, { tool: "configure_object_behavior", args: { mapId: "map_blank_start", eventId: "ev_ref_rock", kind: "pushable" } }]);
    expect(verdict.pass, verdict.reason).toBe(true);
  });
});
