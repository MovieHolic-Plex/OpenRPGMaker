// 계약: upsert_event 로 만든 presentItem 이 run_scene_test 로 끝까지 검증된다.
// 추리 게임 도그푸딩에서 「증거를 들이민다」가 choices + 소지 조건 흉내뿐이라 틀린 증거·
// 안 낸 경우를 헤드리스로 가를 수 없었다. 이 테스트가 도구 → 저장 → 실행 → 검증 한 바퀴를 잠근다.
import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { getTool } from "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";

function fixture() {
  const ctx = { project: createBlankProject() };
  const template = ctx.project.database.items[0];
  assert(template);
  ctx.project.database.items.push(
    { ...template, id: "item_knife", name: "피 묻은 칼" },
    { ...template, id: "item_letter", name: "찢긴 편지" },
  );
  ctx.project.switches.push({ id: "sw_confessed", name: "자백" }, { id: "sw_wrong", name: "헛짚음" }, { id: "sw_silent", name: "안 냄" });
  const mapId = ctx.project.startMapId;
  const { x, y } = ctx.project.startPos;
  const upsert = runTool(ctx, "upsert_event", {
    mapId,
    event: {
      id: "ev_suspect", name: "용의자", x, y: y - 1,
      pages: [{
        id: "p1", name: "심문", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{
          kind: "presentItem",
          prompt: "증거를 제시하라",
          itemIds: ["item_knife", "item_letter"],
          options: [{ itemId: "item_knife", branch: [{ kind: "setSwitch", switchId: "sw_confessed", value: true }] }],
          otherwiseBranch: [{ kind: "setSwitch", switchId: "sw_wrong", value: true }],
          cancelBranch: [{ kind: "setSwitch", switchId: "sw_silent", value: true }],
          consume: true,
        }],
      }],
    },
  });
  assert(upsert.ok, upsert.summary);
  const scene = (steps: unknown[]) => {
    const tool = runTool(ctx, "run_scene_test", {
      mapId, start: { x, y },
      steps: [{ kind: "set", inventory: { item_knife: 1, item_letter: 1 }, facing: "up" }, { kind: "interact", eventId: "ev_suspect" }, ...steps],
    });
    assert(tool.ok, tool.summary);
    return tool.data as { ok: boolean; failureReason?: string; stepsRun: number; totalSteps: number };
  };
  return { ctx, mapId, scene };
}

describe("presentItem: upsert_event → run_scene_test", () => {
  it("도구 설명과 스키마가 presentItem 을 안내한다", () => {
    const upsert = getTool("upsert_event");
    expect(JSON.stringify(upsert?.parameters)).toContain("presentItem");
    expect(getTool("run_scene_test")?.description).toContain("{kind:'present',itemId?}");
  });

  it("맞는 증거 → 정답 분기, consume 으로 소모", () => {
    const { scene } = fixture();
    const result = scene([{ kind: "present", itemId: "item_knife" }, { kind: "expect", switchOn: "sw_confessed", switchOff: ["sw_wrong", "sw_silent"], inventoryCount: { item_knife: 0, item_letter: 1 }, interactionComplete: true }]);
    expect(result, result.failureReason).toMatchObject({ ok: true, stepsRun: result.totalSteps });
  });

  it("틀린 증거 → otherwiseBranch", () => {
    const { scene } = fixture();
    const result = scene([{ kind: "present", itemId: "item_letter" }, { kind: "expect", switchOn: "sw_wrong", switchOff: "sw_confessed", inventoryCount: { item_letter: 1 } }]);
    expect(result, result.failureReason).toMatchObject({ ok: true, stepsRun: result.totalSteps });
  });

  it("안 내고 닫음 → cancelBranch", () => {
    const { scene } = fixture();
    const result = scene([{ kind: "present" }, { kind: "expect", switchOn: "sw_silent" }]);
    expect(result, result.failureReason).toMatchObject({ ok: true, stepsRun: result.totalSteps });
  });

  it("목록에 없는 아이템을 내려 하면 그 스텝에서 실패한다", () => {
    const { scene } = fixture();
    const result = scene([{ kind: "present", itemId: "item_ghost" }]);
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/item_ghost/);
  });

  it("저장 왕복 후에도 같은 이벤트가 남는다", () => {
    const { ctx, mapId } = fixture();
    const restored = deserialize(serialize(ctx.project));
    const event = restored.maps[mapId]?.events.find((entry) => entry.id === "ev_suspect");
    expect(event?.pages?.[0]?.commands[0]).toMatchObject({ kind: "presentItem", consume: true, options: [{ itemId: "item_knife" }] });
  });

  it("없는 아이템을 정답으로 넣으면 upsert_event 가 거부한다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_event", {
      mapId: ctx.project.startMapId,
      event: { id: "ev_bad", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "presentItem", options: [{ itemId: "item_nope", branch: [] }] }] },
    });
    expect(result.ok).toBe(false);
  });
});

describe("presentItem lint", () => {
  it("없는 아이템은 참조 오류, 후보 밖 정답·정답 없음은 경고", async () => {
    const { projectLint } = await import("@/project/lint/projectLint");
    const { ctx, mapId } = fixture();
    const page = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_suspect")!.pages![0]!;
    expect(projectLint(ctx.project, { skipRoundtrip: true }).filter((issue) => issue.code.startsWith("presentItem"))).toEqual([]);

    page.commands = [
      { kind: "presentItem", itemIds: ["item_letter"], options: [{ itemId: "item_knife", branch: [] }] },
      { kind: "presentItem", options: [] },
      { kind: "presentItem", options: [{ itemId: "item_ghost", branch: [] }] },
    ];
    const issues = projectLint(ctx.project, { skipRoundtrip: true });
    expect(issues.filter((issue) => issue.code.startsWith("presentItem")).map((issue) => [issue.severity, issue.code]))
      .toEqual([["warning", "presentItem.option-not-offered"], ["warning", "presentItem.no-options"]]);
    expect(issues.some((issue) => issue.code === "reference-validation" && issue.message.includes("item_ghost"))).toBe(true);
  });
});
