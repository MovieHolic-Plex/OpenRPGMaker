import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { commandSummaryParts, commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent } from "@/project/types";
import type { CommandEditContext, CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { runCommandContract } from "./commandContracts/harness";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { editorState } from "@/editor/editorState";
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

describe("learnSkillCommandBody", () => {
  isolateTimers();
  describe("learnSkill modern form + forget/party", () => {
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
      if (project.database.skills[0]) project.database.skills[0].name = "파이어";
      store.replace(project);
      staged = { kind: "learnSkill", actorId: "", skillId: project.database.skills[0]?.id ?? "", action: "learn" };
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("폼에 액션/대상/특수기 픽커를 노출한다", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      expect(findByTestId(body, "event-command-learn-skill-form")).toBeTruthy();
      expect(findByTestId(body, "learn-skill-action-select")).toBeTruthy();
      expect(findByTestId(body, "learn-skill-target-mode")).toBeTruthy();
      expect(findByTestId(body, "learn-skill-skill-select")).toBeTruthy();
      expect(findByTestId(body, "learn-skill-preview")).toBeTruthy();
    });

    it("망각 액션을 저장한다", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const action = findByTestId(body, "learn-skill-action-select") as unknown as HTMLSelectElement;
      action.value = "forget";
      action.dispatchEvent(new Event("change"));
      expect(staged.kind).toBe("learnSkill");
      if (staged.kind !== "learnSkill") return;
      expect(staged.action).toBe("forget");
    });

    it("주인공 대상 모드에서 actorId 를 저장한다", () => {
      const actorId = store.getCurrent().database.actors[0]?.id ?? "actor_hero";
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const target = findByTestId(body, "learn-skill-target-mode") as unknown as HTMLSelectElement;
      target.value = "actor";
      target.dispatchEvent(new Event("change"));
      const actorSelect = findByTestId(body, "learn-skill-actor-select") as unknown as HTMLSelectElement;
      actorSelect.value = actorId;
      actorSelect.dispatchEvent(new Event("change"));
      expect(staged.kind).toBe("learnSkill");
      if (staged.kind !== "learnSkill") return;
      expect(staged.actorId).toBe(actorId);
    });

    it("요약에 파티/망각을 표시한다", () => {
      const skillId = store.getCurrent().database.skills[0]?.id ?? "skill_1";
      expect(commandSummary({
        kind: "learnSkill",
        actorId: "",
        skillId,
        action: "forget",
      })).toContain("파티 전체");
      expect(commandSummary({
        kind: "learnSkill",
        actorId: "",
        skillId,
        action: "forget",
      })).toContain("잊기");
      expect(commandSummary({
        kind: "learnSkill",
        actorId: "",
        skillId,
        action: "forget",
      })).toContain("파이어");
    });

    it("런타임: 파티 전체에 스킬을 습득시킨다", () => {
      const skillId = "skill_fire";
      const result = runCommandContract([
        { kind: "learnSkill", actorId: "", skillId, action: "learn" },
      ], {
        mutateSession: (session) => {
          session.partyActorIds = ["actor_a", "actor_b"];
          session.actorSkillIds = { actor_a: [], actor_b: ["skill_old"] };
        },
      });
      expect(result.session.actorSkillIds?.actor_a).toEqual([skillId]);
      expect(result.session.actorSkillIds?.actor_b).toEqual(["skill_old", skillId]);
    });

    it("런타임: 망각은 목록에서 제거한다", () => {
      const result = runCommandContract([
        { kind: "learnSkill", actorId: "actor_hero", skillId: "skill_fire", action: "forget" },
      ], {
        mutateSession: (session) => {
          session.actorSkillIds = { actor_hero: ["skill_fire", "skill_ice"] };
        },
      });
      expect(result.session.actorSkillIds?.actor_hero).toEqual(["skill_ice"]);
    });

    it("런타임: 레거시 action 없는 형태는 습득으로 유지한다", () => {
      const result = runCommandContract([
        { kind: "learnSkill", actorId: "actor_hero", skillId: "skill_fire" },
      ], {
        mutateSession: (session) => {
          session.actorSkillIds = { actor_hero: [] };
        },
      });
      expect(result.session.actorSkillIds?.actor_hero).toEqual(["skill_fire"]);
    });
  });
});

/**
 * 계약: **`화면 효과` 편집 폼과 목록 요약이 런타임과 같은 언어로 말한다.**
 *
 * 회귀 배경(적대적 QA `.omo/evidence/screen-fx-2/qa-before.md`):
 *  - D3: 색 값이 `input[type=text]` 단독이라 스와치/피커가 0개였고, `#xyz` 도 조용히 통과했다.
 *        런타임 `parseTintColor` 는 그 값을 흰색 45% 워시로 떨어뜨린다 — 에디터는 아무 말도 없었다.
 *  - D7: `시간(ms)` 에 min/max 가 없어 `-500`/`99999` 가 유효로 통과했다.
 *        런타임 `clampMs` 는 50~5000ms 로 자른다.
 *  - D8: 목록 요약이 `화면 효과: effect: fadeIn, durationMs: 300` 처럼 내부 키를 노출했다.
 */
describe("screenEffectFields", () => {
  isolateTimers();
  const SCREEN_EFFECT_ID = "m2-202-screen-effect";
  const noopActions: CommandListActions = {
    addCommand: () => {},
    insertCommand: () => {},
    replaceCommand: () => {},
    deleteCommand: () => {},
    moveCommand: () => {},
    moveCommandTo: () => {},
  };
  function screenEffect(fields: Record<string, unknown>): Command {
    return { kind: "m2Command", commandId: SCREEN_EFFECT_ID, fields } as unknown as Command;
  }
  function bodyOf(fields: Record<string, unknown>, actions: CommandListActions = noopActions): FakeElement {
    return renderWithFakeDom(() =>
      renderCommandBody({ path: [], actions, lockKind: true }, screenEffect(fields))
    );
  }
  describe("screen effect authoring — color field, duration range, list summary", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("value field offers a native color picker and preset swatches (D3)", () => {
      const body = bodyOf({ effect: "tint", value: "#39ff14", durationMs: 300 });
      const color = findByTestId(body, "m2-command-value-color");
      expect(color?.type).toBe("color");
      expect(color?.value).toBe("#39ff14");
      for (const preset of ["red", "green", "blue", "yellow", "purple", "white", "black"]) {
        expect(findByTestId(body, `m2-command-value-swatch-${preset}`)).toBeTruthy();
      }
    });

    it("preset swatch writes the color into the command (D3)", () => {
      let staged: Command | null = null;
      const body = bodyOf(
        { effect: "tint", value: "", durationMs: 300 },
        { ...noopActions, replaceCommand: (_path, command) => (staged = command) }
      );
      findByTestId(body, "m2-command-value-swatch-green")?.click();
      const applied = staged as Command | null;
      expect(applied?.kind).toBe("m2Command");
      if (applied?.kind !== "m2Command") return;
      expect(applied.fields.value).toBe("green");
    });

    it("invalid typed color marks the field aria-invalid with a short reason (D3)", () => {
      const body = bodyOf({ effect: "tint", value: "", durationMs: 300 });
      const text = findByTestId(body, "m2-command-value-input");
      expect(text).toBeTruthy();
      if (!text) return;
      text.value = "#xyz";
      text.dispatchEvent(new Event("input", { bubbles: true }));
      expect(text.getAttribute("aria-invalid")).toBe("true");
      expect(findByTestId(body, "m2-command-value-error")?.textContent).toContain("#rrggbb");

      text.value = "green";
      text.dispatchEvent(new Event("input", { bubbles: true }));
      expect(text.getAttribute("aria-invalid")).toBe("false");
    });

    it("durationMs input carries the runtime clamp range (D7)", () => {
      const body = bodyOf({ effect: "flash", value: "white", durationMs: 300 });
      const duration = findByTestId(body, "m2-command-durationMs-input");
      expect(duration?.min).toBe("50");
      expect(duration?.max).toBe("5000");
      expect(duration?.getAttribute("step")).toBe("100");

      if (!duration) return;
      duration.value = "99999";
      duration.dispatchEvent(new Event("input", { bubbles: true }));
      expect(duration.getAttribute("aria-invalid")).toBe("true");
      expect(findByTestId(body, "m2-command-durationMs-note")?.textContent).toContain("5000");
    });

    it("list summary uses catalog labels instead of raw field keys (D8)", () => {
      expect(commandSummary(screenEffect({ effect: "fadeIn", durationMs: 300 }))).toContain("페이드 인");
      expect(commandSummary(screenEffect({ effect: "fadeIn", durationMs: 300 }))).not.toContain("effect:");
      const tint = commandSummary(screenEffect({ effect: "tint", value: "#39ff14", durationMs: 1200 }));
      expect(tint).toContain("색조");
      expect(tint).toContain("#39ff14");
      expect(tint).toContain("1200ms");
      expect(tint).not.toContain("durationMs");
    });
  });
  /**
   * 3라운드 회귀:
   *  - D6: 화면 효과 모달이 `날씨 설정` 모달(의도 카드·프리셋 칩)에 비해 헐벗었다.
   *  - D9: fadeIn/fadeOut 은 `값` 을 읽지 않는데 입력이 그대로 보였다.
   *        (flash/tint/weather 는 런타임 applyScreenEffect 가 값을 읽으므로 남긴다.)
   */
  describe("screen effect authoring — intent card, duration presets, value visibility", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      restoreDom?.();
    });

    function effectSelect(body: FakeElement): FakeElement {
      const select = findByTestId(body, "m2-command-effect-option-select");
      if (!select) throw new Error("효과 select 가 없다");
      return select;
    }

    it("intent card explains the selected effect in one line, with the duration (D6)", () => {
      const body = bodyOf({ effect: "flash", value: "white", durationMs: 800 });
      const card = findByTestId(body, "m2-screen-effect-intent");
      expect(card).toBeTruthy();
      expect(card?.textContent).toContain("번쩍");
      expect(card?.textContent).toContain("800ms");
    });

    it("intent card follows the effect select (D6)", () => {
      const body = bodyOf({ effect: "flash", value: "white", durationMs: 800 });
      const select = effectSelect(body);
      select.value = "fadeOut";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const card = findByTestId(body, "m2-screen-effect-intent");
      expect(card?.textContent).toContain("어두워");
      expect(card?.textContent).not.toContain("번쩍");
    });

    it("duration preset chips write 300/800/1600ms into the number input (D6)", () => {
      let staged: Command | null = null;
      const body = bodyOf(
        { effect: "fadeOut", value: "", durationMs: 300 },
        { ...noopActions, replaceCommand: (_path, command) => (staged = command) }
      );
      const chips = [
        { testid: "m2-screen-effect-duration-fast", label: "빠른", ms: 300 },
        { testid: "m2-screen-effect-duration-normal", label: "보통", ms: 800 },
        { testid: "m2-screen-effect-duration-slow", label: "느린", ms: 1600 },
      ];
      for (const chip of chips) {
        const button = findByTestId(body, chip.testid);
        expect(button, chip.testid).toBeTruthy();
        expect(button?.textContent).toContain(chip.label);
        button?.click();
        expect(findByTestId(body, "m2-command-durationMs-input")?.value).toBe(String(chip.ms));
        const applied = staged as Command | null;
        expect(applied?.kind).toBe("m2Command");
        if (applied?.kind !== "m2Command") return;
        expect(applied.fields.durationMs).toBe(chip.ms);
        expect(findByTestId(body, "m2-screen-effect-intent")?.textContent).toContain(`${chip.ms}ms`);
      }
    });

    it("hides the 값 row for effects the runtime ignores and toggles it live (D9)", () => {
      const hiddenFor = (effect: string): boolean => {
        const row = findByTestId(bodyOf({ effect, value: "", durationMs: 300 }), "m2-screen-effect-value-field");
        if (!row) throw new Error("값 행이 없다");
        return row.hidden;
      };
      expect(hiddenFor("fadeIn")).toBe(true);
      expect(hiddenFor("fadeOut")).toBe(true);
      expect(hiddenFor("tint")).toBe(false);
      expect(hiddenFor("flash")).toBe(false);
      expect(hiddenFor("weather")).toBe(false);

      const body = bodyOf({ effect: "tint", value: "#39ff14", durationMs: 300 });
      const select = effectSelect(body);
      select.value = "fadeIn";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      expect(findByTestId(body, "m2-screen-effect-value-field")?.hidden).toBe(true);
      select.value = "tint";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      expect(findByTestId(body, "m2-screen-effect-value-field")?.hidden).toBe(false);
    });

    it("letterbox intent says the message window moves inside the bars", () => {
      const body = bodyOf({ effect: "letterbox", value: "12", durationMs: 600 });
      const card = findByTestId(body, "m2-screen-effect-intent");
      expect(card?.textContent).toContain("안쪽으로 밀린다");
      expect(card?.textContent).not.toContain("그대로");
      expect(card?.textContent).toContain("12%");
      expect(card?.textContent).toContain("600ms");
    });
  });
  /**
   * D9(3라운드): 모든 화면 효과 행에 `이 명령은 실제 게임에서 일부 효과만 실행됩니다` 라는
   * 뭉뚱그린 경고가 붙었다. fadeIn/fadeOut/flash/tint/weather 는 applyScreenEffect 가
   * 실제 렌더 경로에 얹으므로 그 문장은 거짓이고, 렌더러가 없는 값(blur)에만 참이다.
   */
  describe("screen effect authoring — runtime warning text (D9)", () => {
    const VAGUE = "이 명령은 실제 게임에서 일부 효과만 실행됩니다.";

    function validate(fields: Record<string, unknown>) {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const page = {
        id: "page-1",
        name: "화면 효과 페이지",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [screenEffect(fields)],
      } as unknown as EventPage;
      const event = { id: "event-fx", x: 3, y: 3, trigger: page.trigger, commands: [], pages: [page] } as unknown as GameEvent;
      project.maps[mapId].events = [event];
      return validateEventDraftBody(project, mapId, event);
    }

    it("drops the vague partial-runtime warning for effects the runtime renders", () => {
      for (const effect of ["fadeIn", "fadeOut", "flash", "tint", "weather"]) {
        const messages = validate({ effect, value: "", durationMs: 300 }).issues.map((issue) => issue.message);
        expect(messages, effect).not.toContain(VAGUE);
        expect(messages.join(" | "), effect).not.toContain("일부 효과만");
      }
    });

    it("names the unrenderable effect instead of hand-waving", () => {
      const issues = validate({ effect: "blur", value: "", durationMs: 300 }).issues;
      const warning = issues.find((issue) => issue.code === "runtime.screenEffect.unsupported");
      expect(warning?.severity).toBe("warning");
      expect(warning?.commandPath).toEqual([0]);
      expect(warning?.message).toContain("blur");
      expect(issues.map((issue) => issue.message)).not.toContain(VAGUE);
    });
  });
});

describe("transferCommandBody", () => {
  isolateTimers();
  const noopActions = {
    addCommand: () => undefined,
    deleteCommand: () => undefined,
    insertCommand: () => undefined,
    moveCommand: () => undefined,
    moveCommandTo: () => undefined,
    replaceCommand: () => undefined,
  };
  describe("transfer command body", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      store.replace(project);
      editorState.set({ currentMapId: project.startMapId });
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("embeds the map picker inline without a nested 장소 이동... button", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody(
          { path: [], actions: noopActions },
          { kind: "transfer", mapId: "", x: 0, y: 0, direction: "retain", fade: "black" } satisfies Command
        )
      );

      expect(findByTestId(body, "event-transfer-player-dialog")).not.toBeNull();
      expect(findByTestId(body, "transfer-player-map-tree")).not.toBeNull();
      expect(findByTestId(body, "transfer-player-map-preview")).not.toBeNull();
      expect(findByTestId(body, "transfer-player-open")).not.toBeNull();
      // No second nested "open picker" button with the same label friction.
      expect(body.textContent ?? "").not.toContain("장소 이동...");
      expect(findByTestId(body, "transfer-player-ok")?.textContent).toContain("선택 완료");
    });

    it("names a non-default fade and door in the command list, and hides the defaults", () => {
      const mapId = store.getCurrent().startMapId;
      const summary = commandSummary({
        kind: "transfer",
        mapId,
        x: 7,
        y: 10,
        direction: "down",
        fade: "white",
        door: true,
      });
      expect(summary).toContain("(7,10)");
      expect(summary).toContain("아래");
      expect(summary).toContain("페이드 흰색");
      expect(summary).toContain("문 열림");

      const defaults = commandSummary({
        kind: "transfer",
        mapId,
        x: 1,
        y: 1,
        direction: "retain",
        fade: "black",
      });
      expect(defaults).not.toContain("페이드");
      expect(defaults).not.toContain("문 열림");
      expect(defaults).not.toContain("문 연출");
      expect(commandSummary({ kind: "transfer", mapId, x: 1, y: 1, door: false })).toContain("문 연출 없음");
    });

    it("keeps the chosen direction and fade when the door setting changes", () => {
      const mapId = store.getCurrent().startMapId;
      let current: Command = { kind: "transfer", mapId, x: 2, y: 3, direction: "retain", fade: "black" };
      const body = renderWithFakeDom(() =>
        renderCommandBody(
          {
            path: [],
            actions: {
              ...noopActions,
              replaceCommand: (_path, command) => { current = command; },
            },
            getCurrentCommand: () => current,
          },
          current,
        ),
      );

      const direction = findByTestId(body, "transfer-player-direction-right") as HTMLInputElement | null;
      expect(direction).not.toBeNull();
      direction!.checked = true;
      direction!.dispatchEvent(new Event("change", { bubbles: true }));
      expect(current).toMatchObject({ x: 2, y: 3, direction: "right", fade: "black" });
      expect(findByTestId(body, "transfer-command-summary")?.textContent).toContain("오른쪽");

      const fade = findByTestId(body, "transfer-player-fade-none") as HTMLInputElement | null;
      expect(fade).not.toBeNull();
      fade!.checked = true;
      fade!.dispatchEvent(new Event("change", { bubbles: true }));
      expect(current).toMatchObject({ direction: "right", fade: "none" });
      expect(findByTestId(body, "transfer-command-summary")?.textContent).toContain("페이드: 없음");

      const door = findByTestId(body, "transfer-door-mode") as HTMLSelectElement | null;
      expect(door).not.toBeNull();
      door!.value = "on";
      door!.dispatchEvent(new Event("change", { bubbles: true }));
      expect(current).toMatchObject({ mapId, x: 2, y: 3, direction: "right", fade: "none", door: true });
      expect(findByTestId(body, "transfer-command-summary")?.textContent).toContain("문 열림");
    });
  });
});
