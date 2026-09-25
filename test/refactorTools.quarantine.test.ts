// test/refactorTools.test.ts
// rename_switch / prune_unused 전역 리팩토링 툴 검증.

import { describe, expect, it } from "vitest";
import { createEmberQuestProject, EMBER_SWITCH } from "@/project/defaults/emberQuestGame";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { findUnused } from "@/editor/tools/refactorTools";
import { runTool } from "@/editor/tools/toolRunner";
import { projectLint } from "@/project/lint/projectLint";
import type { ToolContext } from "@/editor/tools/types";
import type { Command, Project } from "@/project/types";

describe("rename_switch", () => {
  it("스위치 id를 전역 치환하고 lint를 깨지 않는다", () => {
    const ctx: ToolContext = { project: createEmberQuestProject() };
    const result = runTool(ctx, "rename_switch", { fromId: EMBER_SWITCH.q1Started, to: "sw_renamed_q1" }, { dryRun: false });
    expect(result.ok).toBe(true);
    const data = result.data as { replaced: number };
    expect(data.replaced).toBeGreaterThan(1); // 정의 + 세션 + 참조 여러 곳.
    // 기존 id는 정의에서 사라지고 새 id가 생김.
    expect(ctx.project.switches.some((def) => def.id === EMBER_SWITCH.q1Started)).toBe(false);
    expect(ctx.project.switches.some((def) => def.id === "sw_renamed_q1")).toBe(true);
    // lint 0 error(참조 깨짐 없음).
    expect(projectLint(ctx.project).filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("존재하지 않는 스위치는 실패", () => {
    const ctx: ToolContext = { project: createEmberQuestProject() };
    const result = runTool(ctx, "rename_switch", { fromId: "sw_nope", to: "sw_x" }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("switch-not-found");
  });

  it("이미 존재하는 대상 id로는 실패", () => {
    const ctx: ToolContext = { project: createEmberQuestProject() };
    const result = runTool(ctx, "rename_switch", { fromId: EMBER_SWITCH.q1Started, to: EMBER_SWITCH.q2Started }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("switch-exists");
  });

  it("fromName으로도 대상 스위치를 지정할 수 있다", () => {
    const ctx: ToolContext = { project: createEmberQuestProject() };
    const def = ctx.project.switches.find((entry) => entry.id === EMBER_SWITCH.q1Started);
    const result = runTool(ctx, "rename_switch", { fromName: def?.name, to: "sw_by_name" }, { dryRun: false });
    expect(result.ok).toBe(true);
    expect(ctx.project.switches.some((entry) => entry.id === "sw_by_name")).toBe(true);
    expect(projectLint(ctx.project).filter((issue) => issue.severity === "error")).toEqual([]);
  });

  // 2026-09-24 헤드리스 r0735: 모델이 {switchId, name} 으로 표시 이름을 붙이려다 인자 검증에서 두 번 거부됐다.
  it("switchId + name 으로 id·참조는 두고 표시 이름만 바꾼다", () => {
    const ctx: ToolContext = { project: createEmberQuestProject() };
    const result = runTool(ctx, "rename_switch", { switchId: EMBER_SWITCH.q1Started, name: "촌장 의뢰 수락" }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.switches.find((entry) => entry.id === EMBER_SWITCH.q1Started)?.name).toBe("촌장 의뢰 수락");
    expect(projectLint(ctx.project).filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("정의가 없는 스위치에 name 을 주면 정의를 만든다", () => {
    const ctx: ToolContext = { project: createEmberQuestProject() };
    const result = runTool(ctx, "rename_switch", { switchId: "sw_new_flag", name: "새 플래그" }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.switches.find((entry) => entry.id === "sw_new_flag")).toEqual({ id: "sw_new_flag", name: "새 플래그" });
  });

  it("바꿀 것이 없으면 받는 인자를 정확히 말한다", () => {
    const ctx: ToolContext = { project: createEmberQuestProject() };
    const result = runTool(ctx, "rename_switch", { switchId: EMBER_SWITCH.q1Started }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("name");
    expect(result.summary).toContain("to");
  });
});

describe("prune_unused", () => {
  it("미참조 아이템/트룹을 발견한다(보고 모드)", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    // 아무 데서도 참조 안 되는 아이템/트룹 추가.
    runTool(ctx, "create_map", { name: "m", width: 10, height: 10, id: "m1" }, { dryRun: false });
    runTool(ctx, "set_start_position", { mapId: "m1", x: 5, y: 5 }, { dryRun: false });
    runTool(ctx, "upsert_item", { item: { id: "it_orphan", name: "고아 아이템" } }, { dryRun: false });
    runTool(ctx, "upsert_enemy", { enemy: { id: "en_x", name: "적" } }, { dryRun: false });
    runTool(ctx, "upsert_troop", { troop: { id: "tr_orphan", name: "고아 트룹", enemyIds: ["en_x"] } }, { dryRun: false });

    const report = findUnused(ctx.project);
    expect(report.items).toContain("it_orphan");
    expect(report.troops).toContain("tr_orphan");
  });

  it("apply=true면 미참조 아이템/트룹을 제거하고 lint를 유지한다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    runTool(ctx, "create_map", { name: "m", width: 10, height: 10, id: "m1" }, { dryRun: false });
    runTool(ctx, "set_start_position", { mapId: "m1", x: 5, y: 5 }, { dryRun: false });
    runTool(ctx, "upsert_item", { item: { id: "it_orphan", name: "고아 아이템" } }, { dryRun: false });
    const before = ctx.project.database.items.length;
    const result = runTool(ctx, "prune_unused", { apply: true }, { dryRun: false });
    expect(result.ok).toBe(true);
    expect(ctx.project.database.items.some((item) => item.id === "it_orphan")).toBe(false);
    expect(ctx.project.database.items.length).toBeLessThan(before);
    expect(projectLint(ctx.project).filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("어떤 트룹도 참조하지 않는 적을 미사용으로 잡는다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    runTool(ctx, "create_map", { name: "m", width: 10, height: 10, id: "m1" }, { dryRun: false });
    runTool(ctx, "set_start_position", { mapId: "m1", x: 5, y: 5 }, { dryRun: false });
    runTool(ctx, "upsert_enemy", { enemy: { id: "en_lonely", name: "외톨이 적" } }, { dryRun: false });
    const report = findUnused(ctx.project);
    expect(report.enemies).toContain("en_lonely");
    const applied = runTool(ctx, "prune_unused", { apply: true }, { dryRun: false });
    expect(applied.ok).toBe(true);
    expect(ctx.project.database.enemies.some((enemy) => enemy.id === "en_lonely")).toBe(false);
  });

  it("참조되는 아이템/트룹은 미사용으로 잡지 않는다", () => {
    const ctx: ToolContext = { project: createEmberQuestProject() };
    const report = findUnused(ctx.project);
    // 잿불의 유산은 모든 트룹이 전투 블로커/드래곤에서 참조됨.
    expect(report.troops).toEqual([]);
  });
});

// 맵 1개 + 커맨드를 담은 이벤트 1개만 있는 최소 프로젝트. 이름을 부여한 첫 스위치/변수 슬롯을 함께 반환한다.
const REF_SWITCH = "sw_route";
const REF_VARIABLE = "var_input";

function projectWithEventCommands(commands: Command[]): Project {
  const ctx: ToolContext = { project: createEmptyToolProject() };
  runTool(ctx, "create_map", { name: "m", width: 10, height: 10, id: "m1" }, { dryRun: false });
  runTool(ctx, "set_start_position", { mapId: "m1", x: 5, y: 5 }, { dryRun: false });
  ctx.project.switches.push({ id: REF_SWITCH, name: "이동 경로 스위치" });
  ctx.project.variables.push({ id: REF_VARIABLE, name: "입력 결과" });
  ctx.project.session.switches[REF_SWITCH] = false;
  ctx.project.session.variables[REF_VARIABLE] = 0;
  ctx.project.maps.m1.events.push({ id: "ev_ref", x: 1, y: 1, trigger: { kind: "action" }, commands, pages: [] });
  return ctx.project;
}

describe("prune_unused 참조 수집 누락", () => {
  it("inputNumber만 참조하는 변수는 미사용이 아니다", () => {
    const project = projectWithEventCommands([{ kind: "inputNumber", variableId: REF_VARIABLE, digits: 3 }]);
    expect(findUnused(project).variables).not.toContain(REF_VARIABLE);
  });

  it("inputWait만 참조하는 변수는 미사용이 아니다", () => {
    const project = projectWithEventCommands([{ kind: "inputWait", variableId: REF_VARIABLE }]);
    expect(findUnused(project).variables).not.toContain(REF_VARIABLE);
  });

  it("wait의 대기시간 변수만 참조해도 미사용이 아니다", () => {
    const project = projectWithEventCommands([{ kind: "wait", ms: 100, variableId: REF_VARIABLE }]);
    expect(findUnused(project).variables).not.toContain(REF_VARIABLE);
  });

  it("moveEvent 경로의 setSwitch만 참조하는 스위치는 미사용이 아니다", () => {
    const project = projectWithEventCommands([
      { kind: "moveEvent", eventId: "ev_ref", route: { moves: [{ kind: "setSwitch", switchId: REF_SWITCH, value: true }], repeat: false } },
    ]);
    expect(findUnused(project).switches).not.toContain(REF_SWITCH);
  });

  it("회귀: 아무 데서도 참조되지 않는 명명 변수는 여전히 미사용으로 보고한다", () => {
    const project = projectWithEventCommands([{ kind: "wait", ms: 100 }]);
    const report = findUnused(project);
    expect(report.variables).toContain(REF_VARIABLE);
    expect(report.switches).toContain(REF_SWITCH);
  });
});
