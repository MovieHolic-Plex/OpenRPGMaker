import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { commandSummaryParts, commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext, CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { runCommandContract } from "./commandContracts/harness";
import { isolateTimers } from "./mergedTeardown";

describe("actorM2CommandBodies", () => {
  isolateTimers();
  function ctx(replaceCommand = vi.fn()): CommandEditContext {
    return {
      path: [1],
      actions: {
        addCommand: vi.fn(),
        insertCommand: vi.fn(),
        replaceCommand,
        deleteCommand: vi.fn(),
        moveCommand: vi.fn(),
        moveCommandTo: vi.fn(),
      },
    };
  }
  function m2(commandId: string, fields: Record<string, string | number> = {}): Extract<Command, { kind: "m2Command" }> {
    return { kind: "m2Command", commandId, fields };
  }
  describe("actor m2 command body UX", () => {
    let restoreDom: (() => void) | undefined;
    let actorId = "";
    let variableId = "";
    let stateId = "";
    let classId = "";

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      actorId = project.database.actors[0]?.id ?? "";
      variableId = project.variables[0]?.id ?? "";
      stateId = project.database.states[0]?.id ?? "";
      classId = project.database.classes[0]?.id ?? "";
      if (!actorId) throw new Error("missing actor");
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("renders change-state rich form with party target + state picker", () => {
      const body = renderWithFakeDom(() =>
        renderM2CommandBody(ctx(), m2("m2-019-change-state", { target: "party", operation: "add", value: stateId }))!
      );
      expect(findByTestId(body, "change-state-command-body")).not.toBeNull();
      expect(findByTestId(body, "change-state-target-mode")).not.toBeNull();
      expect(findByTestId(body, "change-state-state-select")).not.toBeNull();
      expect(findByTestId(body, "change-state-preview")).not.toBeNull();
      expect(body.textContent).toContain("상태 변경");
    });

    it("writes damage value from variable source", () => {
      const replaceCommand = vi.fn();
      const body = renderWithFakeDom(() =>
        renderM2CommandBody(
          ctx(replaceCommand),
          m2("m2-021-damage-processing", {
            target: actorId,
            operation: "add",
            value: 10,
            valueSource: "number",
          })
        )!
      );
      expect(findByTestId(body, "damage-processing-command-body")).not.toBeNull();
      (findByTestId(body, "damage-processing-value-source-segment-variable") as FakeElement | null)?.dispatchEvent(
        new Event("click")
      )
      const variableRoot = findByTestId(body, "damage-processing-value-variable") as FakeElement | null;
      const variableSelect = variableRoot?.querySelector?.("select") as FakeElement | null;
      if (variableSelect && variableId) {
        variableSelect.value = variableId;
        variableSelect.dispatchEvent(new Event("change"));
      }
      expect(replaceCommand).toHaveBeenCalled();
      const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "m2Command" }>;
      expect(next.fields.valueSource).toBe("variable");
      if (variableId) expect(next.fields.valueVariableId).toBe(variableId);
    });

    it("renders name/nickname/class/graphic/faceset rich shells", () => {
      const cases = [
        ["m2-022-change-actor-name", "change-actor-name-command-body"],
        ["m2-023-change-actor-nickname", "change-actor-nickname-command-body"],
        ["m2-024-change-actor-graphic", "change-actor-graphic-command-body"],
        ["m2-025-change-actor-faceset", "change-actor-faceset-command-body"],
        ["m2-091-change-actor-class", "change-actor-class-command-body"],
      ] as const;
      for (const [commandId, testId] of cases) {
        const body = renderWithFakeDom(() =>
          renderM2CommandBody(ctx(), m2(commandId, { target: actorId, value: classId || "" }))!
        );
        expect(findByTestId(body, testId), commandId).not.toBeNull();
      }
    });

    it("summarizes damage and actor identity commands in Korean", () => {
      const damage = commandSummaryParts(
        m2("m2-021-damage-processing", {
          target: "party",
          operation: "add",
          value: 12,
          valueSource: "variable",
          valueVariableId: variableId || "var_0001",
        })
      )
        .map((part) => part.text)
        .join("");
      expect(damage).toContain("데미지");
      expect(damage).toContain("변수");

      const name = commandSummaryParts(
        m2("m2-022-change-actor-name", { target: actorId, value: "새이름" })
      )
        .map((part) => part.text)
        .join("");
      expect(name).toContain("주인공 이름 변경");
      expect(name).toContain("새이름");
    });
  });
});

describe("changeExpCommandBody", () => {
  isolateTimers();
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
});

describe("changeGoldCommandBody", () => {
  isolateTimers();
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
});

describe("changeItemCommandBody", () => {
  isolateTimers();
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
});
