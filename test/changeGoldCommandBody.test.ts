import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { runCommandContract } from "./commandContracts/harness";

describe("changeGold amount variable operand", () => {
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
    project.session.gold = 100;
    if (project.variables[0]) project.variables[0].name = "Reward Gold";
    store.replace(project);
    staged = { kind: "changeGold", op: "+=", amount: 10 };
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("폼에 금액 소스(숫자/변수)와 변수 피커를 노출한다", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    expect(findByTestId(body, "event-command-gold-form")).toBeTruthy();
    expect(findByTestId(body, "change-gold-amount-source")).toBeTruthy();
    expect(findByTestId(body, "change-gold-amount-input")).toBeTruthy();
    expect(findByTestId(body, "change-gold-hint")).toBeTruthy();
  });

  it("금액 소스를 변수로 바꾸면 amount 가 {kind:var} 로 저장된다", () => {
    const variableId = store.getCurrent().variables[0]?.id ?? "var_0001";
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const source = findByTestId(body, "change-gold-amount-source") as unknown as HTMLSelectElement;
    source.value = "variable";
    source.dispatchEvent(new Event("change"));
    expect(staged.kind).toBe("changeGold");
    if (staged.kind !== "changeGold") return;
    expect(typeof staged.amount).toBe("object");
    if (typeof staged.amount === "number") return;
    expect(staged.amount.kind).toBe("var");

    const operand = findByTestId(body, "change-gold-amount-variable") as unknown as HTMLElement;
    expect(operand.hidden).toBe(false);
    const select = operand.querySelector("select") as HTMLSelectElement | null;
    expect(select).toBeTruthy();
    if (!select) return;
    select.value = variableId;
    select.dispatchEvent(new Event("change"));
    if (staged.kind !== "changeGold" || typeof staged.amount === "number") return;
    expect(staged.amount.id).toBe(variableId);
  });

  it("요약에 변수 금액을 표시한다", () => {
    const variableId = store.getCurrent().variables[0]?.id ?? "var_0001";
    expect(commandSummary({
      kind: "changeGold",
      op: "+=",
      amount: { kind: "var", id: variableId },
    })).toContain("Reward Gold");
  });

  it("런타임: 변수 금액으로 소지금을 증가시킨다", () => {
    const result = runCommandContract([
      { kind: "setVariable", variableId: "var_gold_pay", op: "=", value: 40 },
      { kind: "changeGold", op: "+=", amount: { kind: "var", id: "var_gold_pay" } },
    ], {
      mutateSession: (session) => {
        session.gold = 10;
      },
    });
    expect(result.session.gold).toBe(50);
    expect(result.finished).toBe(true);
  });

  it("런타임: 숫자 금액 레거시 형태도 유지한다", () => {
    const result = runCommandContract([
      { kind: "changeGold", op: "-=", amount: 25 },
    ], {
      mutateSession: (session) => {
        session.gold = 30;
      },
    });
    expect(result.session.gold).toBe(5);
  });
});
