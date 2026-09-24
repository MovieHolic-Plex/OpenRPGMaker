// 2026-09-24 추격 호러 r8 라운드에서 고친 결함의 회귀 고정.
// r7(qa-runs/chase-r7) 실측: 금고 inputNumber → fork(var == 7419) 의 변수를 「세터 없는 선행」으로
// 오판해 암호 이벤트·열쇠 사슬이 전부 unresolved 로 남고, 자동 플레이가 엔딩까지 못 갔다(막힘 1).
// 같은 라운드: rename_switch/rename_variable 이 대상 없이 to+name 만 온 인자를 연속 거부했다(r7 5회 반복 실패).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { runGameCheck } from "@/qa/gameCheck";
import type { ToolContext } from "@/editor/tools/types";
import type { Project } from "@/project/types";

const ok = (ctx: { project: Project }, name: string, args: Record<string, unknown>): void => {
  const result = runTool(ctx, name, args);
  expect(result.ok, `${name}: ${result.summary}`).toBe(true);
};

/** inputNumber 금고 + 열쇠/암호 조건의 문(엔딩) — r7「잿빛 저택의 술래」를 축약한 픽스처. */
function vaultEscapeProject(doorCondition: "item" | "variable"): { project: Project } {
  const ctx: { project: Project } = { project: createBlankProject() };
  const hall = ctx.project.startMapId;
  const { x, y } = ctx.project.startPos;
  const variableId = ctx.project.variables[0]!.id;
  if (doorCondition === "item") ok(ctx, "upsert_item", { item: { id: "item_key", name: "현관 열쇠" } });
  ok(ctx, "define_ending", { id: "ending_escape", name: "탈출", conditions: [] });
  ok(ctx, "upsert_event", { mapId: hall, event: {
    id: "ev_vault", x: x + 1, y,
    pages: [{ trigger: { kind: "action" }, conditions: [], commands: [
      { kind: "inputNumber", variableId, digits: 4 },
      { kind: "fork", condition: { kind: "variable", variableId, op: "==", value: 7419 },
        then: doorCondition === "item"
          ? [{ kind: "changeItem", itemId: "item_key", op: "+=", amount: 1 }]
          : [{ kind: "text", body: "금고가 열렸다." }],
        else: [
          { kind: "text", body: "암호가 틀렸다." },
          { kind: "setVariable", variableId, op: "=", value: 0 },
        ] },
    ] }],
  } });
  ok(ctx, "upsert_event", { mapId: hall, event: {
    id: "ev_front_door", x: x - 2, y,
    pages: [
      { trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "문이 잠겨 있다." }] },
      { trigger: { kind: "action" },
        conditions: doorCondition === "item"
          ? [{ kind: "item", present: true, itemId: "item_key" }]
          : [{ kind: "variable", variableId, op: "==", value: 7419 }],
        commands: [{ kind: "triggerEnding", endingId: "ending_escape" }] },
    ],
  } });
  return ctx;
}

describe("추격 호러 r8 — 자동 플레이 금고 암호", () => {
  it("fork 안에서 열쇠를 주는 금고도 세터 없이 계획에 넣고 엔딩까지 간다(문은 아이템 조건)", () => {
    const ctx = vaultEscapeProject("item");
    const report = runGameCheck(ctx.project, { autoPlayBudgetMs: 20_000 });
    const run = report.autoPlay!.runs[0]!;
    expect(run.ok, JSON.stringify(run.steps)).toBe(true);
    expect(run.endingReached).toBe("ending_escape");
  });

  it("문이 암호 변수를 직접 요구하면 inputNumber 페이지를 세터로 잡는다", () => {
    const ctx = vaultEscapeProject("variable");
    const report = runGameCheck(ctx.project, { autoPlayBudgetMs: 20_000 });
    const run = report.autoPlay!.runs[0]!;
    expect(run.ok, JSON.stringify(run.steps)).toBe(true);
    expect(run.endingReached).toBe("ending_escape");
    expect(report.autoPlay!.plan.join(" ")).toContain("만들기");
  });
});

describe("추격 호러 r8 — rename_switch/rename_variable 대상 없는 to+name", () => {
  it("switch: 대상 없이 to+name 으로 오면 그 id 로 새 스위치를 만든다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "rename_switch", { to: "sw_chase_active", name: "잿빛 술래 추격 활성화" });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.switches.find((def) => def.id === "sw_chase_active")).toEqual({ id: "sw_chase_active", name: "잿빛 술래 추격 활성화" });
    expect(ctx.project.session.switches["sw_chase_active"]).toBe(false);
  });

  it("switch: 이미 있는 id 는 겝침으로 거절하고 첫 이름을 남긴다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    expect(runTool(ctx, "rename_switch", { to: "sw_chase_active", name: "잿빛 술래 추격 활성화" }).ok).toBe(true);
    const second = runTool(ctx, "rename_switch", { to: "sw_chase_active", name: "덮어쓰기 시도" });
    expect(second.ok).toBe(false);
    expect(second.issues?.[0]?.code).toBe("switch-exists");
    expect(ctx.project.switches.find((def) => def.id === "sw_chase_active")?.name).toBe("잿빛 술래 추격 활성화");
  });

  it("switch: 대상 없이 name 만 오면 여전히 거부한다(to 없이는 어디에 둘지 모른다)", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "rename_switch", { name: "대상 없는 이름" });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("rename-target");
  });

  it("variable: 대상 없이 to+name 으로 오면 그 id 로 새 변수를 만든다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "rename_variable", { to: "var_code", name: "금고 암호" });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.variables.find((def) => def.id === "var_code")).toEqual({ id: "var_code", name: "금고 암호" });
    expect(ctx.project.session.variables["var_code"]).toBe(0);
  });
});
