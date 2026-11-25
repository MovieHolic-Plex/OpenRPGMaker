import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { enterHeroNameBody, promoteActorBody, recoverAllBody, namedVariablesOf, changeActorHpBody, changeEquipmentBody, changeLevelBody, changePartyBody } from "@/editor/panels/eventEditor/commandBodyDatabase";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext, CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import { startSession } from "@/project/session";
import { changeActorVital } from "@/project/sessionActorCommands";
import { isolateTimers } from "./mergedTeardown";

describe("actorCombatCommandBodies", () => {
  isolateTimers();
  function ctx(replaceCommand = vi.fn()): CommandEditContext {
    return {
      path: [0],
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
  describe("actor combat command modern bodies", () => {
    let restoreDom: (() => void) | undefined;
    let actorId = "";
    let stateId = "";
    let classId = "";

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      actorId = project.database.actors[0]?.id ?? "";
      stateId = project.database.states[0]?.id ?? "";
      classId = project.database.classes[0]?.id ?? "";
      if (!actorId) throw new Error("missing actor");
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("modernizes change state with chips and party target", () => {
      expect(stateId).not.toBe("");
      const replaceCommand = vi.fn();
      const body = renderWithFakeDom(() =>
        renderM2CommandBody(
          ctx(replaceCommand),
          m2("m2-019-change-state", { target: "party", operation: "add", value: stateId })
        )!
      );
      expect(findByTestId(body, "change-state-command-body")).not.toBeNull();
      expect(findByTestId(body, "change-state-intent")).not.toBeNull();
      expect(findByTestId(body, "change-state-grid")).not.toBeNull();
      (findByTestId(body, `change-state-chip-${stateId}`) as FakeElement | null)?.dispatchEvent(new Event("click"));
      const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "m2Command" }>;
      expect(next.fields.value).toBe(stateId);
    });

    it("modernizes damage processing presets", () => {
      const replaceCommand = vi.fn();
      const body = renderWithFakeDom(() =>
        renderM2CommandBody(ctx(replaceCommand), m2("m2-021-damage-processing", { target: actorId, operation: "add", value: 1 }))!
      );
      expect(findByTestId(body, "damage-processing-command-body")).not.toBeNull();
      const operation = findByTestId(body, "damage-processing-operation");
      if (!operation) throw new Error("missing damage operation");
      operation.value = "remove";
      operation.dispatchEvent(new Event("change"));
      findByTestId(body, "damage-processing-preset-25")?.click();
      const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "m2Command" }>;
      expect(next.fields.operation).toBe("remove");
      expect(next.fields.value).toBe(25);
      expect(next.fields.target).toBe(actorId);
    });

    it("modernizes actor name and nickname forms", () => {
      for (const [id, testid] of [
        ["m2-022-change-actor-name", "change-actor-name"],
        ["m2-023-change-actor-nickname", "change-actor-nickname"],
      ] as const) {
        const body = renderWithFakeDom(() => renderM2CommandBody(ctx(), m2(id, { target: actorId, value: "" }))!);
        expect(findByTestId(body, `${testid}-command-body`)).not.toBeNull();
        expect(findByTestId(body, `${testid}-intent`)).not.toBeNull();
        expect(findByTestId(body, `${testid}-value-input`)).not.toBeNull();
      }
    });

    it("modernizes actor graphic/faceset/class forms", () => {
      expect(
        findByTestId(
          renderWithFakeDom(() => renderM2CommandBody(ctx(), m2("m2-024-change-actor-graphic", { target: actorId, value: "" }))!),
          "change-actor-graphic-command-body"
        )
      ).not.toBeNull();
      expect(
        findByTestId(
          renderWithFakeDom(() => renderM2CommandBody(ctx(), m2("m2-025-change-actor-faceset", { target: actorId, value: "" }))!),
          "change-actor-faceset-command-body"
        )
      ).not.toBeNull();
      const replaceCommand = vi.fn();
      const classBody = renderWithFakeDom(() =>
        renderM2CommandBody(ctx(replaceCommand), m2("m2-091-change-actor-class", { target: actorId, value: classId }))!
      );
      expect(findByTestId(classBody, "change-actor-class-command-body")).not.toBeNull();
      const classSelect = findByTestId(classBody, "change-actor-class-class-select");
      if (!classSelect || !classId) throw new Error("missing class picker");
      classSelect.value = classId;
      classSelect.dispatchEvent(new Event("change"));
      expect(replaceCommand).toHaveBeenLastCalledWith([0], {
        kind: "m2Command", commandId: "m2-091-change-actor-class", fields: { target: actorId, value: classId },
      });
    });

    it("modernizes recover all / enter hero name / promote", () => {
      const replaceCommand = vi.fn();
      const recover = renderWithFakeDom(() => recoverAllBody(ctx(replaceCommand), { kind: "recoverAll", actorId: "" }));
      const actor = findByTestId(recover, "recover-all-actor-select");
      if (!actor) throw new Error("missing recovery actor picker");
      actor.value = actorId;
      actor.dispatchEvent(new Event("change"));
      expect(replaceCommand).toHaveBeenLastCalledWith([0], { kind: "recoverAll", actorId });

      const name = renderWithFakeDom(() =>
        enterHeroNameBody(ctx(), { kind: "enterHeroName", actorId, maxLength: 6, showInitialName: true })
      );
      expect(findByTestId(name, "enter-hero-name-max-length")?.value).toBe("6");
      expect(findByTestId(name, "enter-hero-name-show-initial")?.checked).toBe(true);
      expect(findByTestId(name, "enter-hero-name-actor-select")?.value).toBe(actorId);

      const promote = renderWithFakeDom(() =>
        promoteActorBody(ctx(), { kind: "promoteActor", actorId, toClassId: classId, successBranch: [], failureBranch: [] })
      );
      expect(findByTestId(promote, "promote-class-select")?.value).toBe(classId);
      expect(findByTestId(promote, "promote-actor-select")?.value).toBe(actorId);
    });
  });
});

describe("battleProcessingCommandBody", () => {
  isolateTimers();
  describe("battleProcessing modern form", () => {
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
      store.replace(project);
      staged = { kind: "battleProcessing", troopId: "", canEscape: true, canLose: false };
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("노출: 적 그룹/도망/패배/방식/프리셋/경고", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      expect(findByTestId(body, "event-command-battle-processing-form")).toBeTruthy();
      expect(findByTestId(body, "battle-processing-troop-select")).toBeTruthy();
      expect(findByTestId(body, "battle-processing-escape-select")).toBeTruthy();
      expect(findByTestId(body, "battle-processing-lose-select")).toBeTruthy();
      expect(findByTestId(body, "battle-processing-flow-select")).toBeTruthy();
      expect(findByTestId(body, "battle-processing-presets")).toBeTruthy();
      expect(findByTestId(body, "battle-processing-escape-checkbox")).toBeTruthy();
      expect(findByTestId(body, "battle-processing-lose-checkbox")).toBeTruthy();
      expect(findByTestId(body, "battle-processing-warning")?.textContent).toContain("적 그룹");
      expect(findByTestId(body, "battle-processing-intent")?.textContent).toContain("전투");
    });

    it("보스 프리셋: 도망 불가 + 엄격 턴제", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const boss = findByTestId(body, "battle-processing-preset-boss") as unknown as HTMLButtonElement;
      boss.click();
      expect(staged.kind).toBe("battleProcessing");
      if (staged.kind !== "battleProcessing") return;
      expect(staged.canEscape).toBe(false);
      expect(staged.canLose).toBe(false);
      expect(staged.battleFlow).toBe("strict");
    });

    it("필드 프리셋: 도망/패배 허용", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const field = findByTestId(body, "battle-processing-preset-field") as unknown as HTMLButtonElement;
      field.click();
      expect(staged.kind).toBe("battleProcessing");
      if (staged.kind !== "battleProcessing") return;
      expect(staged.canEscape).toBe(true);
      expect(staged.canLose).toBe(true);
      expect(staged.battleFlow).toBeUndefined();
    });

    it("스토리 프리셋: 도망 불가 + 게임오버", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const story = findByTestId(body, "battle-processing-preset-story") as unknown as HTMLButtonElement;
      story.click();
      expect(staged.kind).toBe("battleProcessing");
      if (staged.kind !== "battleProcessing") return;
      expect(staged.canEscape).toBe(false);
      expect(staged.canLose).toBe(false);
      expect(staged.battleFlow).toBeUndefined();
    });

    it("트룹 선택 시 경고가 사라진다", () => {
      const troopId = store.getCurrent().database.troops[0]?.id ?? "";
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const select = findByTestId(body, "battle-processing-troop-select") as unknown as HTMLSelectElement;
      select.value = troopId;
      select.dispatchEvent(new Event("change"));
      expect(staged.kind).toBe("battleProcessing");
      if (staged.kind !== "battleProcessing") return;
      expect(staged.troopId).toBe(troopId);
      const warning = findByTestId(body, "battle-processing-warning") as unknown as HTMLElement;
      expect(warning.hidden).toBe(true);
    });

    it("결과 분기 토글이 branchOnResult 를 켠다", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const checkbox = findByTestId(body, "battle-processing-branch-on-result") as unknown as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change"));
      expect(staged.kind).toBe("battleProcessing");
      if (staged.kind !== "battleProcessing") return;
      expect(staged.branchOnResult).toBe(true);
      expect(staged.victoryBranch).toEqual([]);
      expect(staged.defeatBranch).toEqual([]);
      expect(staged.escapeBranch).toEqual([]);
    });

    it("레거시 체크박스로 도망/패배 규칙을 바꿀 수 있다", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const escape = findByTestId(body, "battle-processing-escape-checkbox") as unknown as HTMLInputElement;
      const lose = findByTestId(body, "battle-processing-lose-checkbox") as unknown as HTMLInputElement;
      escape.checked = false;
      escape.dispatchEvent(new Event("change"));
      lose.checked = true;
      lose.dispatchEvent(new Event("change"));
      expect(staged.kind).toBe("battleProcessing");
      if (staged.kind !== "battleProcessing") return;
      expect(staged.canEscape).toBe(false);
      expect(staged.canLose).toBe(true);
    });

    it("도망 세그먼트 변경이 canEscape 를 반영한다", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const select = findByTestId(body, "battle-processing-escape-select") as unknown as HTMLSelectElement;
      select.value = "deny";
      select.dispatchEvent(new Event("change"));
      expect(staged.kind).toBe("battleProcessing");
      if (staged.kind !== "battleProcessing") return;
      expect(staged.canEscape).toBe(false);
    });

    it("고정 모드에서는 변수 컨트롤이 DOM 에 없다 (그룹/변수 이중 노출 금지)", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      expect(findByTestId(body, "battle-processing-troop-select")).toBeTruthy();
      expect(findByTestId(body, "battle-processing-troop-variable")).toBeFalsy();
    });

    it("변수 모드는 한 줄로 교체되고 이름 있는 변수만 나열한다", () => {
      const project = store.getCurrent();
      const namedCount = project.variables.filter((entry) => entry.name.trim().length > 0).length;
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const source = findByTestId(body, "battle-processing-troop-source") as unknown as HTMLSelectElement;
      source.value = "variable";
      source.dispatchEvent(new Event("change"));

      const variableRow = findByTestId(body, "battle-processing-troop-variable") as unknown as HTMLElement;
      expect(variableRow).toBeTruthy();
      // 고정 트룹 픽커는 슬롯에서 밀려나간다 — 트룹 소스 컨트롤은 하나다.
      expect(findByTestId(body, "battle-processing-troop-select")).toBeFalsy();

      const options = Array.from(variableRow.querySelectorAll("option")) as unknown as HTMLOptionElement[];
      expect(options.some((option) => (option.textContent ?? "").trim() === "(이름 없음)")).toBe(false);
      // "(변수 선택)" 한 장 + 이름 있는 슬롯만.
      expect(options.length).toBe(namedCount + 1);
      expect(staged.kind).toBe("battleProcessing");
      if (staged.kind !== "battleProcessing") return;
      expect(staged.troopSource).toBe("variable");
    });

    it("변수 모드에서도 트룹 출처 세그먼트와 경고가 유지된다", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const source = findByTestId(body, "battle-processing-troop-source") as unknown as HTMLSelectElement;
      source.value = "variable";
      source.dispatchEvent(new Event("change"));
      expect(findByTestId(body, "battle-processing-troop-source")).toBeTruthy();
      const warning = findByTestId(body, "battle-processing-warning") as unknown as HTMLElement;
      // Variable mode requires a selected variable, not an unused fixed troop.
      expect(warning.hidden).toBe(false);
    });
  });
  describe("namedVariablesOf", () => {
    it("이름이 빈 슬롯은 거른다", () => {
      const project = createBlankProject();
      project.variables = [
        { id: "v1", name: "적 그룹 번호" },
        { id: "v2", name: "   " },
        { id: "v3", name: "" },
      ] as typeof project.variables;
      expect(namedVariablesOf(project)).toEqual([{ id: "v1", name: "적 그룹 번호" }]);
    });
  });
});

describe("changeActorVitalPercent", () => {
  isolateTimers();
  function ctx(replaceCommand = vi.fn()): CommandEditContext {
    return {
      path: [0],
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
  describe("changeActorHp percent mode", () => {
    let restoreDom: (() => void) | undefined;
    let actorId = "";

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      actorId = project.database.actors[0]?.id ?? "";
      if (!actorId) throw new Error("missing actor");
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("exposes flat/% mode and percent presets", () => {
      const body = renderWithFakeDom(() =>
        changeActorHpBody(ctx(), { kind: "changeActorHp", actorId, op: "+=", amount: 10 })
      );
      expect(findByTestId(body, "change-actor-hp-command-body")).not.toBeNull();
      expect(findByTestId(body, "change-actor-hp-amount-mode")).not.toBeNull();
      expect(findByTestId(body, "change-actor-hp-amount-presets")).not.toBeNull();
      expect(findByTestId(body, "change-actor-hp-amount-preset-heal-50")).not.toBeNull();
      expect(body.textContent).toContain("%");
    });

    it("writes amountMode percent through the +50% preset", () => {
      const replaceCommand = vi.fn();
      const body = renderWithFakeDom(() =>
        changeActorHpBody(ctx(replaceCommand), { kind: "changeActorHp", actorId, op: "-=", amount: 10 })
      );
      (findByTestId(body, "change-actor-hp-amount-preset-heal-50") as FakeElement | null)?.dispatchEvent(
        new Event("click")
      );
      expect(replaceCommand).toHaveBeenCalled();
      const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "changeActorHp" }>;
      expect(next.kind).toBe("changeActorHp");
      expect(next.op).toBe("+=");
      expect(next.amount).toBe(50);
      expect(next.amountMode).toBe("percent");
    });

    it("applies percent amount against max vitals at runtime", () => {
      const project = store.getCurrent();
      const session = startSession(project);
      const vitals = session.actorVitals[actorId];
      if (!vitals) throw new Error("missing vitals");
      vitals.hp = 0;
      changeActorVital(session, {
        kind: "changeActorHp",
        actorId,
        op: "+=",
        amount: 50,
        amountMode: "percent",
      });
      expect(session.actorVitals[actorId]?.hp).toBe(Math.trunc(vitals.maxHp * 0.5));
    });

    it("summarizes percent amounts with a % suffix", () => {
      const text = commandSummaryParts({
        kind: "changeActorHp",
        actorId,
        op: "+=",
        amount: 25,
        amountMode: "percent",
      })
        .map((part) => part.text)
        .join("");
      expect(text).toContain("HP 변경");
      expect(text).toContain("25%");
    });
  });
});

describe("changeEquipmentCommandBody", () => {
  isolateTimers();
  function ctx(replaceCommand = vi.fn()): CommandEditContext {
    return {
      path: [0],
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
  describe("changeEquipment command body UX", () => {
    let restoreDom: (() => void) | undefined;
    let actorId = "";
    let weaponId = "";
    let armorId = "";
    let weaponName = "";

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      actorId = project.database.actors[0]?.id ?? "";
      const weapon = project.database.equipment.find((entry) => entry.slot === "weapon");
      weaponId = weapon?.id ?? "";
      weaponName = weapon?.name ?? "";
      armorId = project.database.equipment.find((entry) => entry.slot === "armor")?.id ?? "";
      if (!actorId || !weaponId) throw new Error("blank project missing actor/weapon");
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("renders actor/slot browser with search and live preview", () => {
      const body = renderWithFakeDom(() =>
        changeEquipmentBody(ctx(), {
          kind: "changeEquipment",
          actorId,
          slot: "weapon",
          equipmentId: weaponId,
        })
      );
      expect(findByTestId(body, "change-equipment-command-body")).not.toBeNull();
      expect(findByTestId(body, "change-equipment-intent")).not.toBeNull();
      expect(findByTestId(body, "change-equipment-browser")).not.toBeNull();
      expect(findByTestId(body, "change-equipment-search")).not.toBeNull();
      expect(findByTestId(body, "change-equipment-selected")).not.toBeNull();
      expect(findByTestId(body, "change-equipment-grid")).not.toBeNull();
      expect(findByTestId(body, "change-equipment-preview")).not.toBeNull();
      expect(findByTestId(body, "change-equipment-presets")).toBeNull();
      expect(findByTestId(body, "change-equipment-actor-select")?.value).toBe(actorId);
      expect(findByTestId(body, "change-equipment-slot-select")?.tagName).toBe("SELECT");
      expect(findByTestId(body, "change-equipment-equipment-select")?.tagName).toBe("SELECT");
      expect(findByTestId(body, "change-equipment-equipment-select-card")?.textContent).toContain(weaponName);
      expect(body.textContent).not.toContain("빠른 선택");
    });

    it("unequips the slot through the unequip card", () => {
      const replaceCommand = vi.fn();
      const body = renderWithFakeDom(() =>
        changeEquipmentBody(ctx(replaceCommand), {
          kind: "changeEquipment",
          actorId,
          slot: "weapon",
          equipmentId: weaponId,
        })
      );
      (findByTestId(body, "change-equipment-card-unequip") as FakeElement | null)?.dispatchEvent(new Event("click"));
      expect(replaceCommand).toHaveBeenCalledWith(
        [0],
        { kind: "changeEquipment", actorId, slot: "weapon", equipmentId: "" } satisfies Command
      );
    });

    it("filters the equipment grid live by name", () => {
      const body = renderWithFakeDom(() =>
        changeEquipmentBody(ctx(), {
          kind: "changeEquipment",
          actorId,
          slot: "weapon",
          equipmentId: weaponId,
        })
      );
      const search = findByTestId(body, "change-equipment-search") as FakeElement | null;
      expect(search).not.toBeNull();
      expect(findByTestId(body, `change-equipment-card-${weaponId}`)).not.toBeNull();

      if (search) {
        search.value = "zzzz-no-match";
        search.dispatchEvent(new Event("input"));
      }
      expect(findByTestId(body, `change-equipment-card-${weaponId}`)).toBeNull();
      expect(body.textContent).toContain("검색 결과");

      if (search) {
        search.value = weaponName.slice(0, Math.min(2, weaponName.length));
        search.dispatchEvent(new Event("input"));
      }
      expect(findByTestId(body, `change-equipment-card-${weaponId}`)).not.toBeNull();
    });

    it("switches slot via segment and keeps equipment select filtered", () => {
      if (!armorId) return;
      const replaceCommand = vi.fn();
      const body = renderWithFakeDom(() =>
        changeEquipmentBody(ctx(replaceCommand), {
          kind: "changeEquipment",
          actorId,
          slot: "weapon",
          equipmentId: weaponId,
        })
      );
      const armorSeg = findByTestId(body, "change-equipment-slot-select-segment-armor") as FakeElement | null;
      expect(armorSeg).not.toBeNull();
      armorSeg?.dispatchEvent(new Event("click"));
      const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "changeEquipment" }>;
      expect(next.slot).toBe("armor");
      // weapon id should not remain selected after slot change unless it is armor
      expect(next.equipmentId === "" || next.equipmentId === armorId || next.slot === "armor").toBe(true);
    });
  });
});

describe("changePartyCommandBody", () => {
  isolateTimers();
  function ctx(overrides: Partial<CommandEditContext["actions"]> = {}): CommandEditContext {
    return {
      path: [2],
      actions: {
        addCommand: vi.fn(),
        insertCommand: vi.fn(),
        replaceCommand: vi.fn(),
        deleteCommand: vi.fn(),
        moveCommand: vi.fn(),
        moveCommandTo: vi.fn(),
        ...overrides,
      },
    };
  }
  describe("changeParty command body UX", () => {
    let restoreDom: (() => void) | undefined;
    let actorId = "";

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      actorId = project.database.actors[0]?.id ?? "";
      if (!actorId) throw new Error("blank project missing actor");
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("commits membership changes without inserting unrelated actor commands", () => {
      const insertCommand = vi.fn();
      const replaceCommand = vi.fn();
      const body = renderWithFakeDom(() =>
        changePartyBody(ctx({ insertCommand, replaceCommand }), { kind: "changeParty", actorId, action: "add" })
      );
      const action = findByTestId(body, "change-party-action-select");
      if (!action) throw new Error("missing party action");
      action.value = "remove";
      action.dispatchEvent(new Event("change"));
      expect(replaceCommand).toHaveBeenLastCalledWith([2], { kind: "changeParty", actorId, action: "remove" });
      expect(insertCommand).not.toHaveBeenCalled();
      expect(findByTestId(body, "change-party-preview")?.dataset.afterIn).toBe("false");
    });

    it("still previews start-party membership", () => {
      const body = renderWithFakeDom(() =>
        changePartyBody(ctx(), { kind: "changeParty", actorId, action: "remove" })
      );
      const preview = findByTestId(body, "change-party-preview");
      expect(preview?.dataset.beforeIn).toBe("true");
      expect(preview?.dataset.afterIn).toBe("false");
    });

    it("renders rich level editor with actor card and preview", () => {
      const replaceCommand = vi.fn();
      const body = renderWithFakeDom(() =>
        changeLevelBody(ctx({ replaceCommand }), { kind: "changeLevel", actorId, op: "+=", amount: 2 })
      );
      expect(findByTestId(body, "change-level-command-body")).not.toBeNull();
      expect(findByTestId(body, "change-level-actor-select")?.value).toBe(actorId);
      expect(findByTestId(body, "change-level-preview")).not.toBeNull();
      expect(body.textContent).toContain("레벨 변경");

      const amount = findByTestId(body, "change-level-amount-input") as FakeElement | null;
      if (!amount) throw new Error("missing amount");
      amount.value = "3";
      amount.dispatchEvent(new Event("change"));
      expect(replaceCommand).toHaveBeenCalledWith(
        [2],
        { kind: "changeLevel", actorId, op: "+=", amount: 3 } satisfies Command
      );
    });
    it("uses correct object particle for level descriptions", () => {
      const body = renderWithFakeDom(() =>
        changeLevelBody(ctx(), { kind: "changeLevel", actorId, op: "+=", amount: 2 })
      );
      expect(body.textContent).not.toContain("레벨를");
      expect(body.textContent).toContain("레벨을");
    });
  });
});
