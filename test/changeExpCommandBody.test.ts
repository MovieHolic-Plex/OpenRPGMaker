import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { runCommandContract } from "./commandContracts/harness";

describe("changeExp modern form + variable operand", () => {
  let restoreDom: (() => void) | undefined;
  let staged: Command;

  const actions: CommandListActions = {
    addCommand: () => undefined,
    insertCommand: () => undefined,
    deleteCommand: () => undefined,
    moveCommand: () => undefined,
    moveCommandTo: () => undefined,
    replaceCommand: (_path, command) => {
      staged = command;
    },
  };

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    if (project.variables[0]) project.variables[0].name = "Quest EXP";
    store.replace(project);
    staged = { kind: "changeExp", actorId: "", op: "+=", amount: 10 };
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("폼에 대상/연산/경험치 소스/변수 피커를 노출한다", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    expect(findByTestId(body, "event-command-exp-form")).toBeTruthy();
    expect(findByTestId(body, "change-exp-target-mode")).toBeTruthy();
    expect(findByTestId(body, "change-exp-amount-source")).toBeTruthy();
    expect(findByTestId(body, "change-exp-amount-input")).toBeTruthy();
    expect(findByTestId(body, "change-exp-hint")).toBeNull();
  });

  it("경험치 소스를 변수로 바꾸면 amount 가 {kind:var} 로 저장된다", () => {
    const variableId = store.getCurrent().variables[0]?.id ?? "var_0001";
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const source = findByTestId(body, "change-exp-amount-source") as unknown as HTMLSelectElement;
    source.value = "variable";
    source.dispatchEvent(new Event("change"));
    expect(staged.kind).toBe("changeExp");
    if (staged.kind !== "changeExp") return;
    expect(typeof staged.amount).toBe("object");
    if (typeof staged.amount === "number") return;
    expect(staged.amount.kind).toBe("var");

    const operand = findByTestId(body, "change-exp-amount-variable") as unknown as HTMLElement;
    expect(operand.hidden).toBe(false);
    const select = operand.querySelector("select") as HTMLSelectElement | null;
    expect(select).toBeTruthy();
    if (!select) return;
    select.value = variableId;
    select.dispatchEvent(new Event("change"));
    if (staged.kind !== "changeExp" || typeof staged.amount === "number") return;
    expect(staged.amount.id).toBe(variableId);
  });

  it("대상 주인공 모드에서 actorId 를 저장한다", () => {
    const actorId = store.getCurrent().database.actors[0]?.id ?? "actor_hero";
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const target = findByTestId(body, "change-exp-target-mode") as unknown as HTMLSelectElement;
    target.value = "actor";
    target.dispatchEvent(new Event("change"));
    const actorSelect = findByTestId(body, "change-exp-actor-select") as unknown as HTMLSelectElement;
    actorSelect.value = actorId;
    actorSelect.dispatchEvent(new Event("change"));
    expect(staged.kind).toBe("changeExp");
    if (staged.kind !== "changeExp") return;
    expect(staged.actorId).toBe(actorId);
  });

  it("preserves a variable operand while changing the operation on an existing command", () => {
    const variableId = store.getCurrent().variables[0]?.id;
    if (!variableId) throw new Error("missing variable fixture");
    staged = { kind: "changeExp", actorId: "", op: "+=", amount: { kind: "var", id: variableId } };
    const body = renderWithFakeDom(() => renderCommandBody({ path: [0], actions, lockKind: true }, staged));
    const operation = findByTestId(body, "change-exp-op-select");
    if (!operation) throw new Error("missing operation");
    operation.value = "-=";
    operation.dispatchEvent(new Event("change"));
    expect(staged).toEqual({ kind: "changeExp", actorId: "", op: "-=", amount: { kind: "var", id: variableId } });
  });

  it("요약에 파티 전체와 변수 경험치를 표시한다", () => {
    const variableId = store.getCurrent().variables[0]?.id ?? "var_0001";
    expect(commandSummary({
      kind: "changeExp",
      actorId: "",
      op: "+=",
      amount: { kind: "var", id: variableId },
    })).toContain("파티 전체");
    expect(commandSummary({
      kind: "changeExp",
      actorId: "",
      op: "+=",
      amount: { kind: "var", id: variableId },
    })).toContain("Quest EXP");
  });

  it("런타임: 변수 경험치로 단일 액터를 증가시킨다", () => {
    const actorId = "actor_hero";
    const result = runCommandContract([
      { kind: "setVariable", variableId: "var_exp_pay", op: "=", value: 40 },
      { kind: "changeExp", actorId, op: "+=", amount: { kind: "var", id: "var_exp_pay" } },
    ], {
      mutateSession: (session) => {
        session.actorExperience = { [actorId]: 10 };
      },
    });
    expect(result.session.actorExperience?.[actorId]).toBe(50);
    expect(result.finished).toBe(true);
  });

  it("런타임: 파티 전체에 숫자 경험치를 적용한다", () => {
    const result = runCommandContract([
      { kind: "changeExp", actorId: "", op: "+=", amount: 25 },
    ], {
      mutateSession: (session) => {
        session.partyActorIds = ["actor_a", "actor_b"];
        session.actorExperience = { actor_a: 5, actor_b: 15 };
      },
    });
    expect(result.session.actorExperience?.actor_a).toBe(30);
    expect(result.session.actorExperience?.actor_b).toBe(40);
  });

  it("런타임: 숫자 금액 레거시 형태도 유지한다", () => {
    const result = runCommandContract([
      { kind: "changeExp", actorId: "actor_hero", op: "-=", amount: 25 },
    ], {
      mutateSession: (session) => {
        session.actorExperience = { actor_hero: 30 };
      },
    });
    expect(result.session.actorExperience?.actor_hero).toBe(5);
  });
});
