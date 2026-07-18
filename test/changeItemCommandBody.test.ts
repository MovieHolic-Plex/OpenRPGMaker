import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { runCommandContract } from "./commandContracts/harness";

describe("changeItem amount variable operand", () => {
  let restoreDom: (() => void) | undefined;
  let staged: Command;
  let itemId = "";
  let variableId = "";

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
    itemId = project.database.items[0]?.id ?? "item_potion";
    if (project.variables[0]) project.variables[0].name = "Loot Count";
    variableId = project.variables[0]?.id ?? "var_0001";
    store.replace(project);
    staged = { kind: "changeItem", itemId, op: "+=", amount: 1 };
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("폼에 개수 소스(숫자/변수)와 변수 피커를 노출한다", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    expect(findByTestId(body, "event-command-item-form")).toBeTruthy();
    expect(findByTestId(body, "change-item-amount-source")).toBeTruthy();
    expect(findByTestId(body, "change-item-amount-input")).toBeTruthy();
    expect(findByTestId(body, "change-item-hint")).toBeTruthy();
  });

  it("개수 소스를 변수로 바꾸면 amount 가 {kind:var} 로 저장된다", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const source = findByTestId(body, "change-item-amount-source") as unknown as HTMLSelectElement;
    source.value = "variable";
    source.dispatchEvent(new Event("change"));
    expect(staged.kind).toBe("changeItem");
    if (staged.kind !== "changeItem") return;
    expect(typeof staged.amount).toBe("object");

    const operand = findByTestId(body, "change-item-amount-variable") as unknown as HTMLElement;
    expect(operand.hidden).toBe(false);
    const select = operand.querySelector("select") as HTMLSelectElement | null;
    expect(select).toBeTruthy();
    if (!select) return;
    select.value = variableId;
    select.dispatchEvent(new Event("change"));
    if (staged.kind !== "changeItem" || typeof staged.amount === "number") return;
    expect(staged.amount.id).toBe(variableId);
  });

  it("요약에 변수 개수를 표시한다", () => {
    const text = commandSummary({
      kind: "changeItem",
      itemId,
      op: "+=",
      amount: { kind: "var", id: variableId },
    });
    expect(text).toContain("Loot Count");
  });

  it("런타임: 변수 개수로 아이템을 증가시킨다", () => {
    const result = runCommandContract([
      { kind: "setVariable", variableId: "var_item_qty", op: "=", value: 3 },
      { kind: "changeItem", itemId, op: "+=", amount: { kind: "var", id: "var_item_qty" } },
    ], {
      mutateSession: (session) => {
        session.inventory[itemId] = 1;
      },
    });
    expect(result.session.inventory[itemId]).toBe(4);
    expect(result.finished).toBe(true);
  });

  it("런타임: 숫자 개수 레거시 형태도 유지한다", () => {
    const result = runCommandContract([
      { kind: "changeItem", itemId, op: "-=", amount: 2 },
    ], {
      mutateSession: (session) => {
        session.inventory[itemId] = 5;
      },
    });
    expect(result.session.inventory[itemId]).toBe(3);
  });
});
