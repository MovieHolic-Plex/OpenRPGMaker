import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { simulatePageCommands, getSimSwitch, getSimVariable, getSimItem, type PreviewSimState } from "@/editor/panels/eventEditor/previewSimulation";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";
import type { Command } from "@/project/types";

describe("previewSimulation", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("returns empty steps for empty commands", () => {
    const result = simulatePageCommands([]);
    expect(result.steps).toHaveLength(0);
  });

  it("tracks setSwitch state changes", () => {
    const project = store.getCurrent();
    const switchId = project.switches[0]?.id ?? "sw_test";
    const commands: Command[] = [
      { kind: "setSwitch", switchId, value: true },
      { kind: "setSwitch", switchId, value: false },
    ];
    const result = simulatePageCommands(commands);
    expect(result.steps).toHaveLength(2);
    expect(getSimSwitch(result.steps[0]!.simState, switchId)).toBe(false);
    expect(getSimSwitch(result.steps[1]!.simState, switchId)).toBe(true);
    expect(getSimSwitch(result.finalState, switchId)).toBe(false);
  });

  it("tracks setVariable state changes", () => {
    const project = store.getCurrent();
    const variableId = project.variables[0]?.id ?? "var_0001";
    const commands: Command[] = [
      { kind: "setVariable", variableId, op: "=", value: 10 },
      { kind: "setVariable", variableId, op: "+=", value: 5 },
      { kind: "setVariable", variableId, op: "*=", value: 2 },
    ];
    const result = simulatePageCommands(commands);
    expect(getSimVariable(result.steps[0]!.simState, variableId)).toBe(0);
    expect(getSimVariable(result.steps[1]!.simState, variableId)).toBe(10);
    expect(getSimVariable(result.steps[2]!.simState, variableId)).toBe(15);
    expect(getSimVariable(result.finalState, variableId)).toBe(30);
  });

  it("tracks changeGold state changes", () => {
    const commands: Command[] = [
      { kind: "changeGold", op: "=", amount: 100 },
      { kind: "changeGold", op: "+=", amount: 50 },
      { kind: "changeGold", op: "-=", amount: 30 },
    ];
    const result = simulatePageCommands(commands);
    expect(result.steps[0]!.simState.gold).toBe(0);
    expect(result.steps[1]!.simState.gold).toBe(100);
    expect(result.steps[2]!.simState.gold).toBe(150);
    expect(result.finalState.gold).toBe(120);
  });

  it("tracks changeItem state changes", () => {
    const project = store.getCurrent();
    const itemId = project.database.items[0]?.id ?? "item_test";
    const commands: Command[] = [
      { kind: "changeItem", itemId, op: "+=", amount: 3 },
      { kind: "changeItem", itemId, op: "-=", amount: 1 },
    ];
    const result = simulatePageCommands(commands);
    expect(getSimItem(result.steps[0]!.simState, itemId)).toBe(0);
    expect(getSimItem(result.steps[1]!.simState, itemId)).toBe(3);
    expect(getSimItem(result.finalState, itemId)).toBe(2);
  });

  it("evaluates fork condition and marks taken branch", () => {
    const project = store.getCurrent();
    const switchId = project.switches[0]?.id ?? "sw_test";
    const commands: Command[] = [
      { kind: "setSwitch", switchId, value: true },
      {
        kind: "fork",
        condition: { kind: "switch", switchId, value: true },
        then: [{ kind: "text", body: "참" }],
        else: [{ kind: "text", body: "거짓" }],
      },
    ];
    const result = simulatePageCommands(commands, "ev_test");
    expect(result.steps).toHaveLength(4);

    const forkStep = result.steps.find((s) => s.command.kind === "fork");
    expect(forkStep).toBeTruthy();
    expect(forkStep!.forkTaken).toBe("then");

    const thenStep = result.steps.find((s) => s.branchLabel === "조건이 맞을 때" && !s.skipped);
    expect(thenStep).toBeTruthy();
    expect(thenStep!.skipped).toBeFalsy();

    const elseStep = result.steps.find((s) => s.branchLabel === "조건이 맞지 않을 때");
    expect(elseStep).toBeTruthy();
    expect(elseStep!.skipped).toBe(true);
  });

  it("evaluates fork condition false and takes else branch", () => {
    const project = store.getCurrent();
    const switchId = project.switches[0]?.id ?? "sw_test";
    const commands: Command[] = [
      {
        kind: "fork",
        condition: { kind: "switch", switchId, value: true },
        then: [{ kind: "text", body: "참" }],
        else: [{ kind: "text", body: "거짓" }],
      },
    ];
    const result = simulatePageCommands(commands, "ev_test");
    const forkStep = result.steps.find((s) => s.command.kind === "fork");
    expect(forkStep!.forkTaken).toBe("else");

    const elseStep = result.steps.find((s) => s.branchLabel === "조건이 맞지 않을 때" && !s.skipped);
    expect(elseStep).toBeTruthy();

    const thenStep = result.steps.find((s) => s.branchLabel === "조건이 맞을 때");
    expect(thenStep).toBeTruthy();
    expect(thenStep!.skipped).toBe(true);
  });

  it("tracks changeParty state changes", () => {
    const project = store.getCurrent();
    const actorId = project.database.actors[1]?.id ?? "actor_2";
    const commands: Command[] = [
      { kind: "changeParty", actorId, action: "add" },
      { kind: "changeParty", actorId, action: "remove" },
    ];
    const result = simulatePageCommands(commands);
    expect(result.steps[0]!.simState.partyActorIds).not.toContain(actorId);
    expect(result.steps[1]!.simState.partyActorIds).toContain(actorId);
    expect(result.finalState.partyActorIds).not.toContain(actorId);
  });

  it("tracks setSelfSwitch for host event", () => {
    const commands: Command[] = [
      { kind: "setSelfSwitch", key: "A", value: true },
    ];
    const result = simulatePageCommands(commands, "ev_test_123");
    expect(result.finalState.selfSwitches["ev_test_123"]?.["A"]).toBe(true);
  });

  it("skips state mutations in skipped branches", () => {
    const project = store.getCurrent();
    const switchId = project.switches[0]?.id ?? "sw_test";
    const commands: Command[] = [
      {
        kind: "fork",
        condition: { kind: "switch", switchId, value: true },
        then: [{ kind: "setSwitch", switchId, value: true }],
        else: [{ kind: "setSwitch", switchId, value: true }],
      },
    ];
    const result = simulatePageCommands(commands, "ev_test");
    expect(getSimSwitch(result.finalState, switchId)).toBe(true);

    const thenStep = result.steps.find((s) => s.branchLabel === "조건이 맞을 때" && s.command.kind === "setSwitch");
    expect(thenStep).toBeTruthy();
    expect(thenStep!.skipped).toBe(true);
  });

  it("tracks toggle switch value", () => {
    const project = store.getCurrent();
    const switchId = project.switches[0]?.id ?? "sw_test";
    const commands: Command[] = [
      { kind: "setSwitch", switchId, value: true },
      { kind: "setSwitch", switchId, value: "toggle" as never },
    ];
    const result = simulatePageCommands(commands);
    expect(getSimSwitch(result.finalState, switchId)).toBe(false);
  });

  it("marks insideLocation fork unknown without a map — never a fabricated else", () => {
    const commands: Command[] = [
      {
        kind: "fork",
        condition: { kind: "insideLocation", locationId: "loc_missing", inside: true },
        then: [{ kind: "text", body: "안" }],
        else: [{ kind: "text", body: "밖" }],
      },
    ];
    // 맵을 넘기지 않으면 로케이션 기하가 없어 판정 불가다.
    const result = simulatePageCommands(commands, "ev_test");
    const forkStep = result.steps.find((s) => s.command.kind === "fork");
    expect(forkStep!.forkTaken).toBe("unknown");
    // 양쪽 다 skipped — 어느 쪽도 「실행된다」고 단정하지 않는다.
    const thenStep = result.steps.find((s) => s.branchLabel === "조건이 맞을 때");
    const elseStep = result.steps.find((s) => s.branchLabel === "조건이 맞지 않을 때");
    expect(thenStep!.skipped).toBe(true);
    expect(elseStep!.skipped).toBe(true);
  });

  it("does not leak taken-branch writes into sibling branch snapshots", () => {
    const project = store.getCurrent();
    const switchId = project.switches[0]?.id ?? "sw_test";
    const varId = project.variables[0]?.id ?? "var_test";
    const commands: Command[] = [
      {
        kind: "fork",
        condition: { kind: "switch", switchId, value: true },
        then: [{ kind: "setVariable", variableId: varId, op: "=", value: 7 }],
        else: [{ kind: "text", body: "거짓" }],
      },
    ];
    // 조건 거짓 → else taken. else 스텝의 before 스냅샷에 then 쓰기(7)가 스며들면 안 된다.
    const result = simulatePageCommands(commands, "ev_test");
    const forkStep = result.steps.find((s) => s.command.kind === "fork");
    expect(forkStep!.forkTaken).toBe("else");
    const elseStep = result.steps.find((s) => s.branchLabel === "조건이 맞지 않을 때");
    expect(getSimVariable(elseStep!.simState, varId)).toBe(0);
    expect(getSimVariable(result.finalState, varId)).toBe(0);
  });
});
