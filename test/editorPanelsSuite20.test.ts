import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory, getMapEditHistoryState, undoMapEdit } from "@/editor/mapEditHistory";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { documentListenerCount, installFakeDom, FakeElement, findByTestId } from "./fakeDom";
import { avatarChipRow, segmentedControl, sliderStepperField, toggleSwitch, type AvatarChipActor } from "@/editor/panels/databaseControls";
import { renderTroopBattleEventPanel } from "@/editor/panels/databaseTroopBattleEventPanel";
import { captureDifficulty } from "@/editor/panels/databaseCapturePreview";
import { setMonsterSpeciesSection } from "@/editor/panels/databaseMonsterSpeciesSections";
import { renderMonsterSpeciesTab } from "@/editor/panels/databaseMonsterSpeciesView";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { isolateTimers } from "./mergedTeardown";

describe("databaseModalReopenLeak", () => {
  isolateTimers();
  // P10(1파 리뷰 이관): openDatabaseModal 이 재오픈 시 이전 인스턴스의 DOM 만
  // querySelector(...).remove() 로 뜯어내면 document keydown 리스너 2개(dirty-close
  // Escape 핸들러 + undo/redo 히스토리 핸들러)가 인스턴스마다 누적된다.
  // 기존 인스턴스의 정식 close() 를 경유해야 한다.
  let restoreDom: (() => void) | undefined;
  let previousWindow: typeof globalThis.window | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        clearTimeout,
        localStorage: createFakeLocalStorage(),
        setTimeout: (handler: TimerHandler): number => {
          if (typeof handler === "function") handler();
          return 0;
        },
      },
    });
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  afterEach(() => {
    document.querySelector("[data-testid='database-modal']")?.remove();
    restoreDom?.();
    restoreDom = undefined;
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  });
  function createFakeLocalStorage(): Storage {
    const values = new Map<string, string>();
    return {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      removeItem: (key: string) => void values.delete(key),
      setItem: (key: string, value: string) => void values.set(key, value),
    } as Storage;
  }
  describe("database modal reopen path closes the previous instance (P10)", () => {
    it("restores the attached opener after close without stealing focus on cross-tab reuse", () => {
      const opener = document.createElement("button");
      document.body.append(opener);
      opener.focus();
      openDatabaseModal("actors");
      openDatabaseModal("troops");
      expect(document.activeElement).not.toBe(opener);
      requestDatabaseModalClose("battleTest");
      expect(document.activeElement).toBe(opener);
    });

    it("restores the logical opener after a topbar replacement", () => {
      const opener = document.createElement("button");
      opener.dataset.testid = "toolbar-database";
      document.body.append(opener);
      opener.focus();
      openDatabaseModal("actors");
      opener.remove();
      const replacement = document.createElement("button");
      replacement.dataset.testid = "toolbar-database";
      document.body.append(replacement);
      requestDatabaseModalClose("battleTest");
      expect(document.activeElement).toBe(replacement);
    });

    it("does not focus a disconnected opener without a replacement", () => {
      const opener = document.createElement("button");
      document.body.append(opener);
      opener.focus();
      openDatabaseModal("actors");
      opener.remove();
      requestDatabaseModalClose("battleTest");
      expect(document.activeElement).not.toBe(opener);
    });

    // 3 = 모달 인스턴스의 2개(dirty-close Escape + undo/redo 히스토리)
    //   + modalStack 의 공유 캡처 리스너 1개.
    // 공유 리스너는 document 당 한 번만 붙고(ensureListening) 모달을 닫아도 남는다 —
    // 그래서 재오픈해도 총량이 늘지 않는다는 이 테스트의 취지는 그대로다.
    // (2026-09-19: DB 모달이 창 모드에서 modalStack 에 등록되면서 2 → 3 이 됐다. 등록은
    //  포커스 트랩·Escape 층 소유권을 위한 것이다 — 리뷰 P0-2.)
    it("keeps exactly 3 document keydown listeners after repeated reopen", () => {
      openDatabaseModal("actors");
      expect(documentListenerCount("keydown")).toBe(3);

      openDatabaseModal("actors");
      // 재오픈이 정식 close() 를 경유하지 않으면 여기서 5가 된다.
      expect(documentListenerCount("keydown")).toBe(3);

      openDatabaseModal("troops");
      expect(documentListenerCount("keydown")).toBe(3);
      expect(document.querySelectorAll("[data-testid='database-modal']").length).toBe(1);
    });
  });
});

// DB UI 현대화 W4 — 모던 컨트롤 프리미티브 4종 계약 검증(fakeDom).
//
// databaseControls.ts 신규 프리미티브의 불변식:
//   1. sliderStepperField — range/number 쌍이 클램프·스텝 정규화된 값으로 양방향 동기화.
//   2. segmentedControl — 네이티브 radio 그룹(방향키 내비게이션 = 브라우저 기본 동작,
//      컨트롤은 keydown 리스너를 하나도 달지 않는다). change 는 선택된 옵션 id 로 발화.
//   3. toggleSwitch — checkbox 원형(checked 자체가 상태).
//   4. avatarChipRow — faceset 칩 버튼(aria-pressed/dimmed), 클릭 토글.
//   5. 모든 컨트롤은 Escape 를 삼키지 않는다 — 모달 최상층 dirty-close 라우팅은
//      document 레벨 keydown 리스너(버블 도착)로 동작하므로, 컨트롤이 preventDefault/
//      stopPropagation 하면 닫기 가드가 깨진다. 여기선 버블이 document 까지 도달하는지로 검증한다.
describe("databaseModernControls", () => {
  isolateTimers();
  const ACTORS: AvatarChipActor[] = [
    { id: "actor-1", name: "알렉스", faceResourceId: "easyrpg-faceset-actor1-00" },
    { id: "actor-2", name: "브라이언", faceResourceId: "easyrpg-faceset-actor1-01" },
    { id: "actor-3", name: "캐럴", faceResourceId: undefined },
  ];
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function keydown(key: string): Event {
    const event = new Event("keydown", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "key", { configurable: true, value: key });
    return event;
  }
  type DocumentTarget = {
    readonly addEventListener: (type: string, listener: EventListener) => void;
    readonly removeEventListener: (type: string, listener: EventListener) => void;
  };
  /** document 레벨 keydown 리스너(모달 dirty-close 라우팅)가 이벤트를 여전히 받는지. */
  function escapeStillReachesDocumentLayer(control: FakeElement): boolean {
    const doc = globalThis.document as unknown as DocumentTarget;
    let reached = false;
    const listener = (): void => {
      reached = true;
    };
    doc.addEventListener("keydown", listener);
    try {
      control.dispatchEvent(keydown("Escape"));
    } finally {
      doc.removeEventListener("keydown", listener);
    }
    return reached;
  }
  describe("sliderStepperField", () => {
    function render(value = 50, bounds = { min: 0, max: 100, step: 1 }) {
      const committed: number[] = [];
      const node = sliderStepperField("HP 회복", "db-field-item-heal-percent", value, (next) => committed.push(next), bounds);
      const fieldNode = node as unknown as FakeElement;
      const range = findByTestId(fieldNode, "db-field-item-heal-percent-slider");
      const stepper = findByTestId(fieldNode, "db-field-item-heal-percent-stepper");
      if (!range || !stepper) throw new Error("sliderStepperField 가 range/number 쌍을 렌더하지 않음");
      return { fieldNode, range, stepper, committed };
    }

    it("renders a range + number pair in a field with testids", () => {
      const { fieldNode, range, stepper } = render();
      expect(fieldNode.tagName).toBe("DIV");
      expect(fieldNode.className).toContain("db-field");
      expect(range.attrs.type).toBe("range");
      expect(stepper.attrs.type).toBe("number");
      expect(range.attrs.min).toBe("0");
      expect(range.attrs.max).toBe("100");
      expect(range.attrs.step).toBe("1");
      expect(range.value).toBe("50");
      expect(stepper.value).toBe("50");
    });

    it("moving the slider clamps to max and syncs the stepper (101 → 100)", () => {
      const { range, stepper, committed } = render();
      range.value = "101";
      range.dispatchEvent(new Event("input"));
      expect(committed.at(-1)).toBe(100);
      expect(stepper.value).toBe("100");
      expect(range.value).toBe("100");
    });

    it("typing below min in the stepper clamps and syncs the slider (-1 → 0)", () => {
      const { range, stepper, committed } = render();
      stepper.value = "-1";
      stepper.dispatchEvent(new Event("input"));
      expect(committed.at(-1)).toBe(0);
      expect(range.value).toBe("0");
      expect(stepper.value).toBe("0");
    });

    it("typing above max clamps and rewrites the visible value", () => {
      const { range, stepper, committed } = render();
      stepper.value = "500000";
      stepper.dispatchEvent(new Event("input"));
      expect(committed.at(-1)).toBe(100);
      expect(range.value).toBe("100");
      expect(stepper.value).toBe("100");
    });

    it("normalizes the display on blur(change) — cleared stepper shows the floor", () => {
      const { range, stepper, committed } = render(20, { min: 5, max: 95, step: 1 });
      stepper.value = "";
      stepper.dispatchEvent(new Event("input"));
      stepper.dispatchEvent(new Event("change"));
      expect(stepper.value).toBe("5");
      expect(range.value).toBe("5");
      expect(committed.at(-1)).toBe(5);
    });

    it("quantizes to the step (37 → 35 with step 5)", () => {
      const { range, stepper, committed } = render(30, { min: 0, max: 100, step: 5 });
      stepper.value = "37";
      stepper.dispatchEvent(new Event("input"));
      expect(committed.at(-1)).toBe(35);
      expect(range.value).toBe("35");
      expect(stepper.value).toBe("35");
    });

    it("clamps the initial value to bounds", () => {
      const { range, stepper } = render(140);
      expect(range.value).toBe("100");
      expect(stepper.value).toBe("100");
    });

    it("keeps a leading minus until the signed number is complete", () => {
      const { range, stepper, committed } = render(0, { min: -400, max: 400, step: 5 });
      stepper.value = "-";
      stepper.dispatchEvent(new Event("input"));
      expect(committed).toEqual([]);
      expect(stepper.value).toBe("-");
      expect(range.value).toBe("0");
      stepper.value = "-20";
      stepper.dispatchEvent(new Event("input"));
      expect(committed.at(-1)).toBe(-20);
      expect(stepper.value).toBe("-20");
      expect(range.value).toBe("-20");
    });
  });
  describe("segmentedControl (native radio group)", () => {
    const OPTIONS = [
      { id: "singleTarget", name: "단일 대상" },
      { id: "allTargets", name: "전체 대상" },
    ];

    function render(value = "singleTarget") {
      const committed: string[] = [];
      const node = segmentedControl("대상", "db-field-item-scope", value, OPTIONS, (next) => committed.push(next));
      const fieldNode = node as unknown as FakeElement;
      const radios = fieldNode.querySelectorAll("input").filter((input) => input.attrs.type === "radio");
      if (radios.length !== 2) throw new Error("segmentedControl 이 radio 그룹을 렌더하지 않음");
      return { fieldNode, radios, committed };
    }

    it("renders one native radio group with a shared name and pill labels", () => {
      const { fieldNode, radios } = render();
      expect(fieldNode.className).toContain("db-field");
      expect(findByTestId(fieldNode, "db-field-item-scope")).toBeTruthy();
      expect(radios[0].attrs.name).toBe(radios[1].attrs.name);
      const pills = fieldNode.querySelectorAll(".db-segmented-pill");
      expect(pills).toHaveLength(2);
      expect(pills[0].textContent).toContain("단일 대상");
      expect(pills[1].textContent).toContain("전체 대상");
    });

    it("checks the option matching the value", () => {
      const { radios } = render("allTargets");
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });

    it("arrow-key navigation changes selection and fires onInput with the option id", () => {
      const { radios, committed } = render();
      // 브라우저 기본 동작 흉내: 방향키는 다음 radio 를 체크하고 change 를 발화한다.
      // 컨트롤 자체는 keydown 리스너가 없다(포커스 트랩 금지) — 네이티브 그룹 동작에 의존.
      radios[0].focus();
      radios[1].dispatchEvent(keydown("ArrowDown"));
      radios[1].checked = true;
      radios[1].dispatchEvent(new Event("change", { bubbles: true }));
      expect(committed).toEqual(["allTargets"]);
    });

    it("Escape keydown on a radio bubbles to the document layer unswallowed", () => {
      const { radios } = render();
      expect(escapeStillReachesDocumentLayer(radios[0])).toBe(true);
    });
  });
  describe("toggleSwitch", () => {
    function render(checked = false) {
      const committed: boolean[] = [];
      const node = toggleSwitch("전투 중 사용", "db-field-item-battle-usable", checked, (next) => committed.push(next));
      const fieldNode = node as unknown as FakeElement;
      const input = findByTestId(fieldNode, "db-field-item-battle-usable");
      if (!input) throw new Error("toggleSwitch 가 checkbox 를 렌더하지 않음");
      return { fieldNode, input, committed };
    }

    it("renders a checkbox styled as a switch under the label", () => {
      const { fieldNode, input } = render();
      expect(fieldNode.className).toContain("db-field");
      expect(input.attrs.type).toBe("checkbox");
      expect(input.attrs.role).toBe("switch");
      expect(input.checked).toBe(false);
      expect(fieldNode.querySelectorAll(".db-toggle-switch")).toHaveLength(1);
    });

    it("reflects the initial checked state", () => {
      const { input } = render(true);
      expect(input.checked).toBe(true);
    });

    it("Space toggles the checked boolean (native activation → change)", () => {
      const { input, committed } = render();
      input.focus();
      input.dispatchEvent(keydown(" "));
      // 합성 keydown 은 네이티브 체크박스 활성화를 일으키지 않는다(브라우저가 쏠 클릭 모사).
      input.checked = !input.checked;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      expect(committed.at(-1)).toBe(true);
    });

    it("Escape keydown on the switch bubbles to the document layer unswallowed", () => {
      const { input } = render();
      expect(escapeStillReachesDocumentLayer(input)).toBe(true);
    });
  });
  describe("avatarChipRow", () => {
    function render(selectedIds: string[] = ["actor-1"]) {
      const toggles: Array<[string, boolean]> = [];
      const node = avatarChipRow("사용 가능 배우", "db-field-item-usable-actors", ACTORS, selectedIds, (actorId, nextSelected) => {
        toggles.push([actorId, nextSelected]);
      });
      const fieldNode = node as unknown as FakeElement;
      const chips = fieldNode.querySelectorAll(".db-avatar-chip");
      if (chips.length !== ACTORS.length) throw new Error("avatarChipRow 가 칩 버튼을 렌더하지 않음");
      return { fieldNode, chips, toggles };
    }

    it("renders one button chip per actor with faceset crops and names", () => {
      const { fieldNode, chips } = render();
      expect(findByTestId(fieldNode, "db-field-item-usable-actors")).toBeTruthy();
      for (const [index, chip] of chips.entries()) {
        expect(chip.tagName).toBe("BUTTON");
        expect(chip.attrs.type).toBe("button");
        expect(chip.dataset.actorId).toBe(ACTORS[index].id);
        expect(chip.textContent).toContain(ACTORS[index].name);
        expect(chip.querySelectorAll(".db-avatar-chip-face")).toHaveLength(1);
      }
    });

    it("selected chip has aria-pressed=true and no dimmed class; unselected are dimmed", () => {
      const { chips } = render(["actor-1"]);
      expect(chips[0].getAttribute("aria-pressed")).toBe("true");
      expect(chips[0].classList.contains("dimmed")).toBe(false);
      expect(chips[1].getAttribute("aria-pressed")).toBe("false");
      expect(chips[1].classList.contains("dimmed")).toBe(true);
      expect(chips[2].classList.contains("dimmed")).toBe(true);
    });

    it("click toggles the actor id in/out of selectedIds and mirrors state on the chip", () => {
      const { chips, toggles } = render(["actor-1"]);
      chips[1].click();
      expect(toggles.at(-1)).toEqual(["actor-2", true]);
      expect(chips[1].getAttribute("aria-pressed")).toBe("true");
      expect(chips[1].classList.contains("dimmed")).toBe(false);
      chips[0].click();
      expect(toggles.at(-1)).toEqual(["actor-1", false]);
      expect(chips[0].getAttribute("aria-pressed")).toBe("false");
      expect(chips[0].classList.contains("dimmed")).toBe(true);
    });

    it("actor without a faceset resource renders a faceless chip without crashing", () => {
      const { chips } = render(["actor-3"]);
      const face = chips[2].querySelector(".db-avatar-chip-face");
      expect(face).toBeTruthy();
      expect(face.style.backgroundImage ?? "").toBe("");
      expect(chips[2].getAttribute("aria-pressed")).toBe("true");
    });

    it("empty actors array renders an empty row without crashing", () => {
      const node = avatarChipRow("사용 가능 배우", "db-field-item-usable-actors", [], [], () => {});
      const fieldNode = node as unknown as FakeElement;
      const row = findByTestId(fieldNode, "db-field-item-usable-actors");
      expect(row).toBeTruthy();
      expect(row.querySelectorAll(".db-avatar-chip")).toHaveLength(0);
    });

    it("Escape keydown on a chip bubbles to the document layer unswallowed", () => {
      const { chips } = render();
      expect(escapeStillReachesDocumentLayer(chips[0])).toBe(true);
    });
  });
  describe("Escape passthrough inside the modal surface", () => {
    it("Escape on every control inside .database-modal-backdrop reaches the document layer", () => {
      const slider = sliderStepperField("HP 회복", "db-field-item-heal-percent", 50, () => {}, { min: 0, max: 100, step: 1 });
      const segmented = segmentedControl("대상", "db-field-item-scope", "singleTarget", OPTIONS_FOR_ESCAPE, () => {});
      const toggle = toggleSwitch("전투 중 사용", "db-field-item-battle-usable", false, () => {});
      const chips = avatarChipRow("사용 가능 배우", "db-field-item-usable-actors", ACTORS_FOR_ESCAPE, [], () => {});
      const body = document.body as unknown as FakeElement;
      const backdrop = document.createElement("div") as FakeElement;
      backdrop.className = "database-modal-backdrop";
      const windowLayer = document.createElement("div") as FakeElement;
      windowLayer.className = "database-modal-window";
      windowLayer.append(slider, segmented, toggle, chips);
      backdrop.append(windowLayer);
      body.append(backdrop);

      const doc = globalThis.document as unknown as DocumentTarget;
      let reached = 0;
      const listener = (): void => {
        reached += 1;
      };
      doc.addEventListener("keydown", listener);
      try {
        const controls = [...windowLayer.querySelectorAll("input"), ...windowLayer.querySelectorAll("button")];
        expect(controls).toHaveLength(6); // range + stepper + radio×2 + checkbox + chip button
        for (const control of controls) control.dispatchEvent(keydown("Escape"));
      } finally {
        doc.removeEventListener("keydown", listener);
      }
      // 모든 컨트롤에서 Escape 가 document 레벨(모달 dirty-close 라우팅)까지 도달한다.
      expect(reached).toBe(6);
    });
  });
  const OPTIONS_FOR_ESCAPE = [
    { id: "singleTarget", name: "단일" },
    { id: "allTargets", name: "전체" },
  ];
  const ACTORS_FOR_ESCAPE: AvatarChipActor[] = [{ id: "actor-1", name: "알렉스" }];
});

describe("databaseMonsterEventEditing", () => {
  isolateTimers();
  let cleanup: () => void;
  let oldWindow: typeof window;
  beforeEach(() => {
    cleanup = installFakeDom(); oldWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout: () => 0, clearTimeout } });
    const project = createBlankProject();
    project.database.troops[0]!.battleEventPages = [];
    store.replace(project);
  });
  afterEach(() => {
    cleanup();
    if (oldWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: oldWindow });
  });
  const troop = () => store.getCurrent().database.troops[0]!;
  function render() {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = () => { host.replaceChildren(renderTroopBattleEventPanel(troop(), rerender) as unknown as FakeElement); };
    rerender(); return host;
  }
  function change(host: FakeElement, id: string, value: string) {
    const control = findByTestId(host, id)!;
    expect(control, id).toBeTruthy();
    control.value = value; control.dispatchEvent(new Event("change"));
  }
  describe("troop event editor", () => {
    it("adds unique page IDs after deleting a middle page and preserves explicit runOnce=false", () => {
      const host = render();
      const add = () => findByTestId(host, "db-troop-event-add-page")!.click();
      add(); add(); add();
      const kept = [troop().battleEventPages[0]!.id, troop().battleEventPages[2]!.id];
      findByTestId(host, "db-troop-event-page-tab-2")!.click();
      findByTestId(host, "db-troop-event-delete-page")!.click();
      add();
      const ids = troop().battleEventPages.map((p) => p.id);
      expect(new Set(ids).size).toBe(3);
      expect(ids.slice(0, 2)).toEqual(kept);
      const once = findByTestId(host, "db-field-troop-event-run-once")!;
      once.checked = false; once.dispatchEvent(new Event("change"));
      expect(troop().battleEventPages[2]!.runOnce).toBe(false);
      expect(findByTestId(host, "db-field-troop-event-run-once")!.checked).toBe(false);
    });
    it("edits switch polarity and variable operators without dropping additional conditions", () => {
      store.update((project) => {
        project.switches = [{ id: "actual_switch", name: "Gate" }];
        project.variables = [{ id: "actual_variable", name: "Score" }];
        project.database.troops[0]!.battleEventPages = [{ id: "condition-test", conditions: [{ kind: "switch", switchId: "actual_switch", value: true }, { kind: "onRound", round: 2 }], span: "turn", commands: [] }];
      });
      const host = render();
      change(host, "db-field-troop-event-condition-switch-value", "false");
      expect(troop().battleEventPages[0]!.conditions[0]).toEqual({ kind: "switch", switchId: "actual_switch", value: false });
      change(host, "db-field-troop-event-condition-kind", "variable");
      change(host, "db-field-troop-event-condition-variable-op", "<=");
      expect(troop().battleEventPages[0]!.conditions).toEqual([{ kind: "variable", variableId: "actual_variable", op: "<=", value: 0 }, { kind: "onRound", round: 2 }]);
    });
    it("keeps both displayed HP limits consistent with the saved range", () => {
      const host = render();
      findByTestId(host, "db-troop-event-add-page")!.click();
      change(host, "db-field-troop-event-condition-kind", "enemyHp");
      const setNumber = (suffix: string, value: string) => {
        const input = findByTestId(host, `db-field-troop-event-condition-enemy-hp-${suffix}`)!;
        input.value = value; input.dispatchEvent(new Event("input"));
      };
      setNumber("max", "30");
      setNumber("min", "60");
      expect(findByTestId(host, "db-field-troop-event-condition-enemy-hp-max")!.value).toBe("60");
      setNumber("max", "20");
      expect(findByTestId(host, "db-field-troop-event-condition-enemy-hp-min")!.value).toBe("20");
      expect(troop().battleEventPages[0]!.conditions[0]).toMatchObject({ minPercent: 20, maxPercent: 20 });
      setNumber("min", "100");
      expect(findByTestId(host, "db-field-troop-event-condition-enemy-hp-max-inc")!.disabled).toBe(true);
      setNumber("max", "90");
      const minIncrement = findByTestId(host, "db-field-troop-event-condition-enemy-hp-min-inc")!;
      expect(minIncrement.disabled).toBe(false);
      minIncrement.click();
      expect(troop().battleEventPages[0]!.conditions[0]).toMatchObject({ minPercent: 91, maxPercent: 91 });
    });

  });
});

describe("databaseMonsterSpeciesView", () => {
  isolateTimers();
  let previousWindow: typeof globalThis.window | undefined;
  function stubWindowTimers(): void {
    previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        setTimeout: (handler: TimerHandler): number => {
          if (typeof handler === "function") handler();
          return 0;
        },
        clearTimeout,
        dispatchEvent: () => true,
      },
    });
  }
  function restoreWindow(): void {
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
  function renderUtility(render: (host: HTMLElement, rerender: () => void) => void): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      render(host as unknown as HTMLElement, rerender);
    };
    rerender();
    return host;
  }
  describe("database monster species view", () => {
    let cleanupDom: (() => void) | undefined;

    beforeEach(() => {
      cleanupDom = installFakeDom();
      stubWindowTimers();
      store.replace(createBlankProject());
      resetMapEditHistory();
      setMonsterSpeciesSection("basic");
    });

    afterEach(() => {
      cleanupDom?.();
      cleanupDom = undefined;
      restoreWindow();
    });

    // fix(db): statFields/hue/resourcePicker 콜백이 렌더 시점 record를 클로저로 캡처한 채
    // baseStats를 스프레드해, rerender 없이 연속 편집하면 직전 편집이 스테일 스냅샷 위에
    // 덮여 사라졌다(HP→MP→공격 순서 입력 시 마지막 필드만 저장 — qa-enemies-report.md).
    it("preserves every stat field when edited sequentially without an intervening rerender", () => {
      const host = renderUtility(renderMonsterSpeciesTab);
      findByTestId(host, "db-monster-species-add")?.click();
      const id = store.getCurrent().database.monsterSpecies?.at(-1)?.id;
      if (!id) throw new Error("missing species id");

      const setNumber = (testid: string, value: string): void => {
        const input = findByTestId(host, testid);
        if (!input) throw new Error(`missing field ${testid}`);
        input.value = value;
        input.dispatchEvent(new Event("input"));
      };

      setNumber("db-monster-species-hp", "64");
      setNumber("db-monster-species-mp", "30");
      setNumber("db-monster-species-atk", "21");
      setNumber("db-monster-species-def", "22");
      setNumber("db-monster-species-mind", "23");
      setNumber("db-monster-species-agi", "24");

      const record = store.getCurrent().database.monsterSpecies?.find((entry) => entry.id === id);
      expect(record?.baseStats).toEqual({ maxHp: 64, maxMp: 30, attack: 21, defense: 22, mind: 23, agility: 24 });
      // 색조 칸은 2026-10-02 지웠다(전투가 읽지 않는다).
      expect(findByTestId(host, "db-monster-species-hue")).toBeNull();
    });

    it("duplicates with a 사본 suffix and blocks delete while an enemy references the species", () => {
      const host = renderUtility(renderMonsterSpeciesTab);
      const before = (store.getCurrent().database.monsterSpecies ?? []).length;
      findByTestId(host, "db-monster-species-add")?.click();
      const id = store.getCurrent().database.monsterSpecies?.at(-1)?.id;
      if (!id) throw new Error("missing species id");

      findByTestId(host, "db-monster-species-duplicate")?.click();
      const species = store.getCurrent().database.monsterSpecies ?? [];
      expect(species).toHaveLength(before + 2);
      const duplicatedId = species.at(-1)?.id;
      expect(species.at(-1)?.name).toBe("새 species 사본");
      if (!duplicatedId) throw new Error("missing duplicated species id");

      // duplicate is auto-selected — reference it (not the original) so the delete
      // button below targets the referenced record and the guard actually engages.
      const enemyId = store.getCurrent().database.enemies[0]?.id;
      if (!enemyId) throw new Error("missing default enemy");
      store.update((project) => {
        const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
        if (enemy) enemy.speciesId = duplicatedId;
      });

      const deleteButton = findByTestId(host, "db-monster-species-delete");
      if (!deleteButton) throw new Error("missing delete button");
      deleteButton.click();
      expect(deleteButton.textContent).toBe("삭제"); // blocked — never arms
      expect(store.getCurrent().database.monsterSpecies).toHaveLength(before + 2);
    });

    it("requires a second click before deleting an unreferenced species, and undo restores it", () => {
      const host = renderUtility(renderMonsterSpeciesTab);
      findByTestId(host, "db-monster-species-add")?.click();
      const before = (store.getCurrent().database.monsterSpecies ?? []).length;

      const deleteButton = findByTestId(host, "db-monster-species-delete");
      if (!deleteButton) throw new Error("missing delete button");
      deleteButton.click();
      expect(deleteButton.textContent).toBe("정말 삭제?");
      expect(store.getCurrent().database.monsterSpecies).toHaveLength(before);

      deleteButton.click();
      expect(store.getCurrent().database.monsterSpecies).toHaveLength(before - 1);

      expect(getMapEditHistoryState().canUndo).toBe(true);
      const undone = undoMapEdit();
      expect(undone).toBe(true);
      expect(store.getCurrent().database.monsterSpecies).toHaveLength(before);
    });

    it("uses type-chart chips: two stick, third does not, and outlier types warn", () => {
      store.update((project) => {
        project.system.typeChart = {
          types: ["fire", "water", "grass"],
          multipliers: {
            fire: { fire: 1, water: 0.5, grass: 2 },
            water: { fire: 2, water: 1, grass: 0.5 },
            grass: { fire: 0.5, water: 2, grass: 1 },
          },
        };
      });

      const host = renderUtility(renderMonsterSpeciesTab);
      findByTestId(host, "db-monster-species-add")?.click();
      const id = store.getCurrent().database.monsterSpecies?.at(-1)?.id;
      if (!id) throw new Error("missing species id");

      const toggleType = (type: string, checked: boolean): FakeElement => {
        const chip = findByTestId(host, `db-monster-species-type-${type}`);
        if (!chip) throw new Error(`missing type chip ${type}`);
        chip.checked = checked;
        chip.dispatchEvent(new Event("change"));
        return chip;
      };

      toggleType("fire", true);
      toggleType("water", true);
      expect(store.getCurrent().database.monsterSpecies?.find((entry) => entry.id === id)?.types).toEqual([
        "fire",
        "water",
      ]);

      const grass = toggleType("grass", true);
      expect(grass.checked).toBe(false);
      expect(store.getCurrent().database.monsterSpecies?.find((entry) => entry.id === id)?.types).toEqual([
        "fire",
        "water",
      ]);
      expect(store.getCurrent().system.typeChart?.types).toEqual(["fire", "water", "grass"]);

      // Outlier warn: store a type outside the chart without clearing chart types.
      store.update((project) => {
        const record = project.database.monsterSpecies?.find((entry) => entry.id === id);
        if (!record) throw new Error("missing species");
        record.types = ["fire", "ghost"];
      });
      const refreshed = renderUtility(renderMonsterSpeciesTab);
      const warn = findByTestId(refreshed, "db-monster-species-type-warn");
      expect(warn?.textContent).toContain("타입 상성표에 없는 타입");
      expect(warn?.textContent).toContain("ghost");
      expect(findByTestId(refreshed, "db-monster-species-type-fire")?.checked).toBe(true);
      expect(findByTestId(refreshed, "db-monster-species-type-water")?.checked).toBe(false);
      const orphan = findByTestId(refreshed, "db-monster-species-type-ghost")!;
      orphan.checked = false;
      orphan.dispatchEvent(new Event("change"));
      expect(store.getCurrent().database.monsterSpecies?.find((row) => row.id === id)?.types).toEqual(["fire"]);
    });

    it("falls back to free-text types when the type chart is empty", () => {
      store.update((project) => {
        delete project.system.typeChart;
      });

      const host = renderUtility(renderMonsterSpeciesTab);
      findByTestId(host, "db-monster-species-add")?.click();
      const id = store.getCurrent().database.monsterSpecies?.at(-1)?.id;
      if (!id) throw new Error("missing species id");

      expect(findByTestId(host, "db-monster-species-types-hint")).not.toBeNull();
      expect(findByTestId(host, "db-monster-species-type-fire")).toBeNull();

      const input = findByTestId(host, "db-monster-species-types");
      if (!input) throw new Error("missing free-text types field");
      input.value = "불, 물, 바람";
      input.dispatchEvent(new Event("input"));

      expect(store.getCurrent().database.monsterSpecies?.find((entry) => entry.id === id)?.types).toEqual([
        "불",
        "물",
      ]);
      expect(store.getCurrent().system.typeChart).toBeUndefined();
    });

    // Break caught: species fields do not show whether enemies, field spawns, and drops form a playable pipeline.
    it("shows the monster pipeline summary and direct navigation actions", () => {
      const host = renderUtility(renderMonsterSpeciesTab);
      expect(findByTestId(host, "db-monster-pipeline")).toBeTruthy();
      expect(findByTestId(host, "db-monster-pipeline-links")?.dataset.state).toBe("ready");
      expect(findByTestId(host, "db-monster-pipeline-spawns")?.dataset.state).toBe("needs-setup");
      // 기본 DB 는 이제 모든 적에 드롭 아이템을 생산한다(해골 궁수 = item_bone).
      // 이 칩이 다른 상태도 보고한다는 적은 위의 spawns(needs-setup) 가 직얰한다.
      expect(findByTestId(host, "db-monster-pipeline-drops")?.dataset.state).toBe("ready");
      expect(findByTestId(host, "db-monster-pipeline-links-action")).toBeTruthy();
      expect(findByTestId(host, "db-monster-pipeline-spawns-action")).toBeTruthy();
      expect(findByTestId(host, "db-monster-pipeline-drops-action")).toBeTruthy();
    });
    it("keeps skill row identity through sorting, blur, a later skill edit and deletion", () => {
      const initial = renderUtility(renderMonsterSpeciesTab);
      findByTestId(initial, "db-monster-species-add")!.click();
      const id = store.getCurrent().database.monsterSpecies!.at(-1)!.id;
      const [a, b, c] = store.getCurrent().database.skills;
      store.update((project) => {
        project.database.monsterSpecies!.find((row) => row.id === id)!.skillsByLevel = [
          { level: 1, skillId: a!.id }, { level: 10, skillId: b!.id },
        ];
      });
      const host = renderUtility(renderMonsterSpeciesTab);
      const first = findByTestId(host, "db-monster-species-skill-level-0")!;
      first.value = "20";
      first.dispatchEvent(new Event("input"));
      first.dispatchEvent(new Event("change"));
      const saved = () => store.getCurrent().database.monsterSpecies!.find((row) => row.id === id)!.skillsByLevel;
      expect(saved()).toEqual([{ level: 10, skillId: b!.id }, { level: 20, skillId: a!.id }]);
      const skill = findByTestId(host, "db-monster-species-skill-0")!;
      skill.value = c!.id;
      skill.dispatchEvent(new Event("change"));
      expect(saved()).toEqual([{ level: 10, skillId: b!.id }, { level: 20, skillId: c!.id }]);
      findByTestId(host, "db-monster-species-skill-delete-0")!.click();
      expect(saved()).toEqual([{ level: 10, skillId: b!.id }]);
    });

    it("does not overwrite externally changed skill rows", () => {
      const initial = renderUtility(renderMonsterSpeciesTab);
      findByTestId(initial, "db-monster-species-add")!.click();
      findByTestId(initial, "db-monster-species-skill-add")!.click();
      const id = store.getCurrent().database.monsterSpecies!.at(-1)!.id;
      const input = findByTestId(initial, "db-monster-species-skill-level-0")!;
      store.update((project) => { project.database.monsterSpecies!.find((row) => row.id === id)!.skillsByLevel[0]!.level = 30; });
      input.value = "20";
      input.dispatchEvent(new Event("input"));
      expect(store.getCurrent().database.monsterSpecies!.find((row) => row.id === id)!.skillsByLevel[0]!.level).toBe(30);
    });


    // Break caught: all nine cards were stacked at once (1372px) so beginners could not tell where to start.
    it("splits the detail into five section tabs that keep every field mounted", () => {
      const host = renderUtility(renderMonsterSpeciesTab);
      const tabs = ["basic", "capture", "growth", "evolution", "links"].map((id) => findByTestId(host, `db-monster-species-section-tab-${id}`)!);
      expect(tabs.map((tab) => tab.getAttribute("role"))).toEqual(["tab", "tab", "tab", "tab", "tab"]);
      expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false", "false", "false", "false"]);
      // Hidden panels still own their fields — tests and saved paths reach them without a tab click.
      for (const testid of ["db-monster-species-name", "db-monster-species-capture-rate", "db-monster-species-hp", "db-monster-species-evo-add", "db-monster-species-linked-enemies"]) {
        expect(findByTestId(host, testid), testid).toBeTruthy();
      }
      expect(findByTestId(host, "db-monster-species-section-basic")?.hidden).toBe(false);
      expect(findByTestId(host, "db-monster-species-section-growth")?.hidden).toBe(true);

      tabs[2]!.click();
      expect(findByTestId(host, "db-monster-species-section-growth")?.hidden).toBe(false);
      expect(findByTestId(host, "db-monster-species-section-basic")?.hidden).toBe(true);
      // The chosen section survives a rerender (edits that rebuild the tab must not jump back to 기본).
      const rerendered = renderUtility(renderMonsterSpeciesTab);
      expect(findByTestId(rerendered, "db-monster-species-section-tab-growth")?.getAttribute("aria-selected")).toBe("true");
      expect(findByTestId(rerendered, "db-monster-species-section-growth")?.hidden).toBe(false);

      const growthTab = findByTestId(rerendered, "db-monster-species-section-tab-growth")!;
      growthTab.dispatchEvent(Object.assign(new Event("keydown"), { key: "ArrowRight" }));
      expect(findByTestId(rerendered, "db-monster-species-section-tab-evolution")?.getAttribute("aria-selected")).toBe("true");
    });

    // Break caught: 「기본 포획 계수 0.45」 said nothing about how hard the monster is to catch.
    it("names capture difficulty and lets a difficulty step set the representative rate", () => {
      expect(captureDifficulty(1).label).toBe("매우 쉬움");
      expect(captureDifficulty(0.7).label).toBe("쉬움");
      expect(captureDifficulty(0.3).label).toBe("보통");
      expect(captureDifficulty(0.45).label).toBe("보통");
      expect(captureDifficulty(0.15).label).toBe("어려움");
      expect(captureDifficulty(0.02).label).toBe("전설");

      const host = renderUtility(renderMonsterSpeciesTab);
      findByTestId(host, "db-monster-species-add")!.click();
      const id = store.getCurrent().database.monsterSpecies!.at(-1)!.id;
      expect(findByTestId(host, "db-monster-species-capture-difficulty")?.textContent).toBe("보통");
      findByTestId(host, "db-monster-species-capture-step-hard")!.click();
      expect(store.getCurrent().database.monsterSpecies!.find((row) => row.id === id)!.captureRate).toBe(0.15);
      expect(findByTestId(host, "db-monster-species-capture-difficulty")?.textContent).toBe("어려움");
      expect(findByTestId(host, "db-monster-species-capture-step-hard")?.getAttribute("aria-pressed")).toBe("true");
      expect(findByTestId(host, "db-monster-species-section-tab-capture")?.textContent).toContain("어려움");
      expect(findByTestId(host, "db-monster-species-summary")?.textContent).toContain("잡기 어려움");
      expect(findByTestId(host, "db-monster-species-check-capture")?.dataset.done).toBe("true");
    });

    it("shows Korean type labels while storing raw type ids", () => {
      store.update((project) => {
        project.system.typeChart = {
          types: ["fire", "water", "shadow"],
          multipliers: { fire: {}, water: {}, shadow: {} },
        } as never;
      });
      const host = renderUtility(renderMonsterSpeciesTab);
      findByTestId(host, "db-monster-species-add")!.click();
      const id = store.getCurrent().database.monsterSpecies!.at(-1)!.id;
      const fire = findByTestId(host, "db-monster-species-type-fire")!;
      expect(fire.closest("label")?.textContent).toContain("불");
      expect(findByTestId(host, "db-monster-species-type-shadow")!.closest("label")?.textContent).toContain("shadow");
      fire.checked = true;
      fire.dispatchEvent(new Event("change"));
      expect(store.getCurrent().database.monsterSpecies!.find((row) => row.id === id)!.types).toEqual(["fire"]);
      expect(findByTestId(host, "db-monster-species-hero-types")?.textContent).toBe("불");
    });

    it("keeps the project-wide readiness collapsed into a counted pill", () => {
      const host = renderUtility(renderMonsterSpeciesTab);
      const details = findByTestId(host, "db-monster-pipeline-details")!;
      expect(details.tagName).toBe("DETAILS");
      expect((details as unknown as { open?: boolean }).open).toBe(false);
      expect(findByTestId(host, "db-monster-pipeline-toggle")?.textContent).toMatch(/프로젝트 준비\s*\d\/4/u);
      expect(details.contains(findByTestId(host, "db-monster-pipeline"))).toBe(true);
    });

    it("marks the fill-order checklist from real data and jumps to the item's section", () => {
      const host = renderUtility(renderMonsterSpeciesTab);
      findByTestId(host, "db-monster-species-add")!.click();
      expect(findByTestId(host, "db-monster-species-checklist")).not.toBeNull();
      expect(findByTestId(host, "db-monster-species-check-identity")?.dataset.done).toBe("false");
      expect(findByTestId(host, "db-monster-species-check-graphic")?.dataset.done).toBe("false");
      expect(findByTestId(host, "db-monster-species-check-capture")?.dataset.done).toBe("false");
      findByTestId(host, "db-monster-species-check-evolution")!.click();
      expect(findByTestId(host, "db-monster-species-section-evolution")?.hidden).toBe(false);
    });
  });
});

describe("databaseNestedModalEscape", () => {
  isolateTimers();
  // DB 모달은 자기 document keydown 리스너로 Escape 를 잡아 통째로 닫는다. 그 안에서
  // 연 중첩 다이얼로그가 모달 스택에 등록되지 않으면 Escape 가 그대로 흘러내려
  // "나중에 연 중첩창"이 아니라 "먼저 연 데이터베이스"가 닫힌다.
  let restoreDom: (() => void) | undefined;
  let previousWindow: typeof globalThis.window | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    resetModalStackForTest();
    previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        clearTimeout,
        localStorage: createFakeLocalStorage(),
        setTimeout: (handler: TimerHandler): number => {
          if (typeof handler === "function") handler();
          return 0;
        },
      },
    });
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  afterEach(() => {
    document.querySelector("[data-testid='database-modal']")?.remove();
    document.querySelector("[data-testid='resource-modal']")?.remove();
    resetModalStackForTest();
    restoreDom?.();
    restoreDom = undefined;
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  });
  function createFakeLocalStorage(): Storage {
    const values = new Map<string, string>();
    return {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      removeItem: (key: string) => void values.delete(key),
      setItem: (key: string, value: string) => void values.set(key, value),
    } as Storage;
  }
  function dispatchEscape(): void {
    const event = new Event("keydown", { bubbles: true, cancelable: true }) as Event & { key: string };
    Object.defineProperty(event, "key", { configurable: true, value: "Escape" });
    document.dispatchEvent(event);
  }
  function clickTestId(testid: string): void {
    const target = document.querySelector(`[data-testid='${testid}']`);
    expect(target, `${testid} 를 찾지 못했다`).toBeTruthy();
    (target as unknown as { click: () => void }).click();
  }
  function exists(testid: string): boolean {
    return document.querySelector(`[data-testid='${testid}']`) !== null;
  }
  describe("데이터베이스 중첩 다이얼로그의 Escape 계층", () => {
    it("직업 능력치 곡선 다이얼로그를 열면 Escape 가 그 다이얼로그만 닫는다", () => {
      openDatabaseModal("classes");
      clickTestId("db-class-curve-edit-maxHp");
      expect(exists("db-class-parameter-dialog")).toBe(true);

      dispatchEscape();

      // 버그일 때: 중첩창은 그대로 남고 데이터베이스가 닫힌다.
      expect({ nested: exists("db-class-parameter-dialog"), database: exists("database-modal") }).toEqual({
        nested: false,
        database: true,
      });

      // 계층이 하나씩 벗겨진다 — 중첩창이 사라진 뒤의 Escape 는 데이터베이스 몫이다.
      dispatchEscape();
      expect(exists("database-modal")).toBe(false);
    });

    // 배우 탭에도 같은 이름의 곡선 편집기가 따로 있다(actorRecordCurveEditors.ts).
    // 직업 탭만 고치고 여기를 빠뜨려 사용자가 같은 버그를 다시 만났다.
    it("배우 능력치 곡선 다이얼로그도 Escape 로 자기만 닫는다", () => {
      openDatabaseModal("actors");
      clickTestId("db-actor-curve-edit-maxHp");
      expect(exists("db-actor-parameter-dialog")).toBe(true);

      dispatchEscape();

      expect({ nested: exists("db-actor-parameter-dialog"), database: exists("database-modal") }).toEqual({
        nested: false,
        database: true,
      });
    });

    it("배우 경험치 곡선 다이얼로그도 Escape 로 자기만 닫는다", () => {
      openDatabaseModal("actors");
      clickTestId("db-actor-exp-edit");
      expect(exists("db-actor-exp-dialog")).toBe(true);

      dispatchEscape();

      expect({ nested: exists("db-actor-exp-dialog"), database: exists("database-modal") }).toEqual({
        nested: false,
        database: true,
      });
    });

    // 도크 모드 백드롭은 pointer-events: none 이라 데이터베이스를 켠 채로 툴바의
    // 리소스 관리자를 열 수 있다. 그때도 Escape 는 위층 창 몫이다.
    it("리소스 관리자를 데이터베이스 위에 열어도 Escape 는 리소스 관리자만 닫는다", () => {
      openDatabaseModal("actors");
      openResourceModal();
      expect(exists("resource-modal")).toBe(true);

      dispatchEscape();

      expect({ nested: exists("resource-modal"), database: exists("database-modal") }).toEqual({
        nested: false,
        database: true,
      });
    });

    it("속성 최대 개수 다이얼로그도 같은 계층 규칙을 따른다", () => {
      openDatabaseModal("elements");
      clickTestId("db-elements-maximum-number");
      expect(exists("db-elements-max-dialog")).toBe(true);

      dispatchEscape();

      expect({ nested: exists("db-elements-max-dialog"), database: exists("database-modal") }).toEqual({
        nested: false,
        database: true,
      });
    });
  });
});
