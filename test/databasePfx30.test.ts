import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEnemyRecordForm, renderTroopRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom, findByTestId } from "./fakeDom";
import { getDatabaseActiveTab, setDatabaseActiveTab } from "@/editor/panels/database";
import { resetRecordViewSessionState, selectedRecordIdForSession, inventoryCatalogSession } from "@/editor/panels/databaseRecordViewSession";
import { isolateTimers } from "./mergedTeardown";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { createDatabaseCommandListActions } from "@/editor/panels/databaseCommandListAdapter";
import { deserialize, serialize } from "@/project/io";
import type { Command, ItemRecord } from "@/project/types";
import { commonEventReferenceMessage } from "@/editor/databaseReferences";
import { renderCommonEventsTab } from "@/editor/panels/databaseCommonEventViews";
import { normalizeTimeSystemConfig, normalizeItemRecord } from "@/project/databaseRecordModel";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { itemEffectStory, renderItemRecordForm } from "@/editor/panels/databaseItemRecordView";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { FARM_TOOLS } from "@/project/farmModel";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { startModalDrag, stopModalDrag } from "@/editor/panels/databaseModalWindowDrag";

describe("databaseAdvancedRecordViews", () => {
  isolateTimers();
  describe("databaseEnemyResourceSlot", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      store.replace(project);
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    function enemyWithMonsterResource(resourceId: string | undefined) {
      const project = store.getCurrent();
      const troop = project.database.troops[0]!;
      const enemyId = troop.members?.[0]?.enemyId ?? troop.enemyIds[0];
      const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
      if (!enemy) throw new Error("enemy fixture missing");
      enemy.monsterResourceId = resourceId;
      return enemy;
    }
    function previewButtons(form: FakeElement): FakeElement[] {
      return form.querySelectorAll("button").filter((node) => node.className.includes("db-resource-set-button"));
    }
    describe("몬스터 그래픽 미리보기 슬롯", () => {
      it("generated 리소스를 해석할 수 없으면 클릭 불가능한 정적 라벨을 보여준다 (데드 버튼 금지)", () => {
        const enemy = enemyWithMonsterResource("generated-nonexistent-sheet");
        const form = new FakeElement("div");
        renderEnemyRecordForm(form as unknown as HTMLElement, enemy);
        const dead = previewButtons(form);
        expect(dead.length, "리소스 선택 불가 컨텍스트에서 버튼을 렌더하면 안 된다").toBe(0);
        const text = form.textContent ?? "";
        expect(text).toContain("generated-nonexistent-sheet");
      });

      it("리소스가 없으면 (없음) 라벨만 보여준다", () => {
        const enemy = enemyWithMonsterResource(undefined);
        const form = new FakeElement("div");
        renderEnemyRecordForm(form as unknown as HTMLElement, enemy);
        expect(previewButtons(form).length).toBe(0);
        expect(form.textContent ?? "").toContain("(없음)");
      });
    });
  });
  describe("databaseTroopOpenEnemy", () => {
    isolateTimers();
    // 적 그룹 인스펙터의 몬스터 열기 링크 — enemy view "종족 열기"의 거울 패턴
    // (setSelectedRecordId + switchDatabaseActiveTab). troops[0]의 enemy_slime은
    // records[0] 폴백과 동일해서 setSelectedRecordId 누락을 못 잡으므로 non-first
    // 적(enemy_meadow_slime)을 쓰는 troop_slime_pair로 구동하고, 탭 전환까지 단언한다.
    describe("database troop record view — open enemy link", () => {
      let cleanupDom: (() => void) | undefined;

      beforeEach(() => {
        cleanupDom = installFakeDom();
        store.replace(createBlankProject());
        resetRecordViewSessionState();
        setDatabaseActiveTab("troops");
      });

      afterEach(() => {
        cleanupDom?.();
        cleanupDom = undefined;
      });

      function troopSlimePair() {
        const troop = store.getCurrent().database.troops.find((entry) => entry.id === "troop_slime_pair");
        if (!troop) throw new Error("missing troop_slime_pair");
        const memberEnemyId = troop.members?.[0]?.enemyId;
        if (memberEnemyId !== "enemy_meadow_slime") throw new Error(`expected non-first enemy, got ${memberEnemyId}`);
        return { troop, memberEnemyId };
      }

      function mountInDatabaseBody(form: FakeElement): void {
        const root = document.createElement("div") as unknown as FakeElement;
        root.className = "database-modal-body";
        const body = document.createElement("div") as unknown as FakeElement;
        body.className = "db-body";
        body.append(form);
        root.append(body);
        (document.body as unknown as FakeElement).append(root);
      }

      it("renders an open-enemy button naming the selected slot enemy", () => {
        const { troop } = troopSlimePair();
        const enemy = store.getCurrent().database.enemies.find((entry) => entry.id === "enemy_meadow_slime");
        if (!enemy) throw new Error("missing enemy_meadow_slime");

        const form = document.createElement("section");
        renderTroopRecordForm(form, troop, () => {});

        const button = findByTestId(form as unknown as FakeElement, "db-troop-open-enemy");
        expect(button).not.toBeNull();
        expect(button?.textContent).toContain(enemy.name);
      });

      it("clicking the button selects the slot enemy and switches to the monster tab", () => {
        const { troop, memberEnemyId } = troopSlimePair();
        const form = document.createElement("section") as unknown as FakeElement;
        mountInDatabaseBody(form);
        renderTroopRecordForm(form as unknown as HTMLElement, troop, () => {});

        const button = findByTestId(form, "db-troop-open-enemy");
        expect(button).not.toBeNull();
        button?.click();

        expect(selectedRecordIdForSession("enemies")).toBe(memberEnemyId);
        expect(getDatabaseActiveTab()).toBe("enemies");
      });
    });
  });
  describe("databaseTroopRecordViewNameSync", () => {
    isolateTimers();
    // fix(db): troops는 공용 nameField(onRename→updateRecordRowLabel) 경로 밖에 있어(자체
    // textField 사용) 이름을 타이핑해도 좌측 레코드 리스트 라벨이 갱신되지 않았다
    // (qa-troops-report.md m5). 리스트 행을 다른 파일이 만드는 실제 구조와 동일한
    // data-testid="db-record-row-<id>" + ".db-list-name"으로 흉내내 검증한다.
    describe("database troop record view — list row name sync", () => {
      let cleanupDom: (() => void) | undefined;

      beforeEach(() => {
        cleanupDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => {
        cleanupDom?.();
        cleanupDom = undefined;
      });

      it("updates the left-side list row label while typing in the name field, without a full rerender", () => {
        const troop = store.getCurrent().database.troops[0];
        if (!troop) throw new Error("missing default troop");

        const row = document.createElement("button");
        row.dataset.testid = `db-record-row-${troop.id}`;
        const nameNode = document.createElement("span");
        nameNode.className = "db-list-name";
        nameNode.textContent = troop.name;
        row.append(nameNode);
        document.body.append(row);

        const form = document.createElement("section");
        let rerenderCalls = 0;
        renderTroopRecordForm(form, troop, () => {
          rerenderCalls += 1;
        });

        const nameInput = form.querySelector("[data-testid='db-field-name']") as (HTMLInputElement & { dispatchEvent: (event: Event) => boolean }) | null;
        if (!nameInput) throw new Error("missing name field");
        nameInput.value = "새 부대이름";
        nameInput.dispatchEvent(new Event("input"));

        expect(nameNode.textContent).toBe("새 부대이름");
        expect(store.getCurrent().database.troops.find((entry) => entry.id === troop.id)?.name).toBe("새 부대이름");
        // typing must not trigger a full rerender (that would drop focus mid-keystroke)
        expect(rerenderCalls).toBe(0);
      });
    });
  });
});

describe("databaseCommonEvent", () => {
  isolateTimers();
  describe("databaseCommonEventCommandListAdapter", () => {
    isolateTimers();
    describe("database common event command-list adapter", () => {
      beforeEach(() => {
        store.replace(createBlankProject());
      });

      it("adds non-text commands to database-owned common event arrays and persists them", () => {
        const commonEventId = "ce_command_adapter";
        const switchId = store.getCurrent().switches[0]?.id ?? "";
        seedCommonEvent(commonEventId, [{ kind: "text", body: "seed" }]);
        const actions = adapterFor(commonEventId);

        actions.addCommand([], { kind: "setSwitch", switchId, value: true });

        const commands = restoredCommands(commonEventId);
        expect(commands).toEqual([{ kind: "text", body: "seed" }, { kind: "setSwitch", switchId, value: true }]);
      });

      it("persists nested commands created under common event branches", () => {
        const commonEventId = "ce_command_adapter_nested";
        const switchId = store.getCurrent().switches[1]?.id ?? "";
        seedCommonEvent(commonEventId, [
          { kind: "fork", condition: { kind: "switch", switchId, value: true }, then: [], else: [] },
        ]);
        const actions = adapterFor(commonEventId);

        actions.addCommand([0, FORK_THEN_BRANCH_INDEX], { kind: "setSwitch", switchId, value: false });

        expect(restoredCommands(commonEventId)[0]).toEqual({
          kind: "fork",
          condition: { kind: "switch", switchId, value: true },
          then: [{ kind: "setSwitch", switchId, value: false }],
          else: [],
        });
      });
    });
    function seedCommonEvent(commonEventId: string, commands: Command[]): void {
      store.update((draft) => {
        draft.commonEvents = [{ id: commonEventId, name: "Adapter", trigger: "none", commands: structuredClone(commands) }];
      });
    }
    function adapterFor(commonEventId: string): ReturnType<typeof createDatabaseCommandListActions> {
      return createDatabaseCommandListActions({
        commands: store.getCurrent().commonEvents.find((record) => record.id === commonEventId)?.commands ?? [],
        replaceCommands: (commands: Command[]) => {
          store.update((draft) => {
            const commonEvent = draft.commonEvents.find((record) => record.id === commonEventId);
            if (commonEvent) commonEvent.commands = commands;
          });
        },
      });
    }
    function restoredCommands(commonEventId: string): readonly Command[] {
      return deserialize(serialize(store.getCurrent())).commonEvents.find((record) => record.id === commonEventId)?.commands ?? [];
    }
  });
  describe("databaseCommonEventOnDayEndGuard", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    let previousWindow: typeof globalThis.window | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      previousWindow = globalThis.window;
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          setTimeout: (handler: TimerHandler): number => {
            if (typeof handler === "function") handler();
            return 0;
          },
          clearTimeout,
        },
      });
      const project = createBlankProject();
      project.commonEvents = [{ id: "ce_day_end", name: "하루가 끝날 때", trigger: "none", commands: [] }];
      project.system.timeSystem = normalizeTimeSystemConfig({
        enabled: true,
        onDayEnd: "ce_day_end",
      });
      store.replace(project);
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
      if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    });
    describe("common event onDayEnd delete guard", () => {
      it("names the time-system day-end hook in the block message", () => {
        expect(commonEventReferenceMessage("ce_day_end")).toContain("시간 시스템(하루 끝)");
        expect(commonEventReferenceMessage("ce_other")).toBeNull();
      });

      it("blocks the common-event delete button while onDayEnd points at it", () => {
        const host = document.createElement("div") as unknown as FakeElement;
        const rerender = (): void => {
          host.replaceChildren();
          renderCommonEventsTab(host as unknown as HTMLElement, rerender);
        };
        rerender();

        const deleteButton = findByTestId(host, "db-common-event-delete-ce_day_end");
        if (!deleteButton) throw new Error("missing delete button");
        deleteButton.click();
        deleteButton.click();

        expect(store.getCurrent().commonEvents.map((event) => event.id)).toEqual(["ce_day_end"]);
        expect(deleteButton.textContent).not.toBe("정말 삭제?");
      });
    });
  });
  describe("databaseCommonEventViews", () => {
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
    describe("database common events view", () => {
      let cleanupDom: (() => void) | undefined;

      beforeEach(() => {
        cleanupDom = installFakeDom();
        stubWindowTimers();
        const project = createBlankProject();
        project.commonEvents = [];
        store.replace(project);
        resetMapEditHistory();
      });

      afterEach(() => {
        cleanupDom?.();
        cleanupDom = undefined;
        restoreWindow();
      });

      // fix(db): 0001~0010 빈 행은 실레코드가 아닌 순수 장식이었다(클릭/편집 전부 무반응 —
      // qa-commonev-report.md 결함 3). 레코드가 없으면 목록은 비어 있어야 한다.
      it("shows no decorative placeholder rows when there are zero common events", () => {
        const host = renderUtility(renderCommonEventsTab);
        expect(host.querySelectorAll(".db-common-event-empty-row")).toHaveLength(0);
        expect(host.querySelectorAll("button.db-list-row")).toHaveLength(0);
      });

      it("wires undo snapshots for add/name/trigger/conditionSwitch/delete", () => {
        const host = renderUtility(renderCommonEventsTab);
        expect(getMapEditHistoryState().canUndo).toBe(false);

        const addButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "+ 공통 이벤트 추가");
        if (!addButton) throw new Error("missing add button");
        addButton.click();
        expect(getMapEditHistoryState().canUndo).toBe(true);
        expect(store.getCurrent().commonEvents).toHaveLength(1);

        const undoAfterAdd = undoMapEdit();
        expect(undoAfterAdd).toBe(true);
        expect(store.getCurrent().commonEvents).toHaveLength(0);
      });

      it("coalesces keystroke name edits into a single undo snapshot", () => {
        const host = renderUtility(renderCommonEventsTab);
        const addButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "+ 공통 이벤트 추가");
        addButton?.click();
        resetMapEditHistory(); // isolate the name-typing snapshot count from the add snapshot

        const nameInput = findByTestId(host, "db-common-event-name");
        if (!nameInput) throw new Error("missing name input");
        const original = store.getCurrent().commonEvents[0]?.name ?? "";
        for (const next of ["U", "UN", "UND", "UNDO"]) {
          nameInput.value = next;
          nameInput.dispatchEvent(new Event("input"));
        }
        expect(store.getCurrent().commonEvents[0]?.name).toBe("UNDO");

        const undone = undoMapEdit();
        expect(undone).toBe(true);
        expect(store.getCurrent().commonEvents[0]?.name).toBe(original);
        // a second undo must not exist — the whole keystroke stream collapsed to one snapshot
        expect(getMapEditHistoryState().canUndo).toBe(false);
      });

      it("duplicates with a 사본 suffix and requires two clicks to delete", () => {
        const host = renderUtility(renderCommonEventsTab);
        const addButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "+ 공통 이벤트 추가");
        addButton?.click();

        const duplicateButton = findByTestId(host, "db-common-event-duplicate");
        duplicateButton?.click();
        const events = store.getCurrent().commonEvents;
        expect(events).toHaveLength(2);
        expect(events[1]?.name).toBe("새 공통 이벤트 사본");

        const id = events[1]!.id;
        const deleteButton = findByTestId(host, `db-common-event-delete-${id}`);
        if (!deleteButton) throw new Error("missing delete button");
        deleteButton.click();
        expect(deleteButton.textContent).toBe("정말 삭제?");
        expect(store.getCurrent().commonEvents).toHaveLength(2);

        deleteButton.click();
        expect(store.getCurrent().commonEvents).toHaveLength(1);
      });
    });
  });
});

// DB UI 현대화 W4 P3 — 아이템 폼 인스펙터 전환 계약 검증(fakeDom).
//
// todo 9: databaseItemRecordView.ts 가 모던 컨트롤(T8 프리미티브)로 전환된 뒤에도
// 저장 필드명/스키마는 그대로여야 한다. 이 파일이 검증하는 불변식:
//   1. HP/MP 회복 % 슬라이더+스테퍼 → updateDatabaseRecord 로 클램프·스텝 정규화 값 저장.
//   2. 대상(scope) 세그먼트 → 저장된 ItemScope enum 값 그대로 재작성.
//   3. 사용 가능 배우 아바타 칩 → usableActorIds 배열 토글(직업 체크박스 계약 유지).
//   4. 메뉴/전투 토글 스위치 → 기존 boolean 필드명 그대로 저장.
//   5. 종류(type) 변경 → updateItemType + 전체 재렌더 계약 유지(패널 스왑).
describe("databaseItemInspector", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    project.database.actors[0]!.faceResourceId = "easyrpg-faceset-actor1-00";
    if (project.database.actors[1]) {
      project.database.actors[1]!.faceResourceId = "easyrpg-faceset-actor1-01";
    }
    const item = project.database.items[0];
    if (!item) throw new Error("fixture needs at least one item");
    item.hpRecovery = { flat: 30, percentMax: 40 };
    item.mpRecovery = { flat: 10, percentMax: 20 };
    item.usableActorIds = [project.database.actors[0]!.id];
    item.usableClassIds = [];
    item.scope = "ally";
    item.onlyUsableInMenu = false;
    store.replace(project);
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  describe("database item inspector form", () => {
    // Break caught: removing the effect-story model would return the author to reading raw
    // scope/occasion/charge/recovery fields one by one.
    it("summarizes a finite-use party medicine from live item fields", () => {
      const project = store.getCurrent();
      const item = normalizeItemRecord({
        ...currentItem(),
        scope: "allAllies",
        occasion: "always",
        occasionField: true,
        occasionBattle: true,
        consumable: true,
        consumptionLimit: 3,
        hpRecovery: { flat: 30, percentMax: 40 },
        mpRecovery: { flat: 0, percentMax: 20 },
        healStateIds: [project.database.states[0]!.id],
      });

      const story = itemEffectStory(project, item);

      expect(story.target).toBe("아군 전체");
      expect(story.occasion).toBe("필드 · 전투");
      expect(story.consumption).toBe("1개당 3회 사용");
      expect(story.effects).toContain("HP 최대치 40% + 30 회복");
      expect(story.effects).toContain("MP 최대치 20% 회복");
      expect(story.effects.some((effect) => effect.startsWith("상태 회복:"))).toBe(true);
    });

    // Break caught: a special item with a live activateSkillId must name the triggered
    // skill instead of showing a generic "special" ledger row.
    it("resolves a special item's triggered skill name", () => {
      const project = store.getCurrent();
      const skill = project.database.skills[0];
      if (!skill) throw new Error("fixture needs a skill");
      const item = normalizeItemRecord({
        ...currentItem(),
        type: "special",
        activateSkillId: skill.id,
        skillId: undefined,
        hpRecovery: { flat: 0, percentMax: 0 },
        mpRecovery: { flat: 0, percentMax: 0 },
      });

      expect(itemEffectStory(project, item).effects).toContain(`스킬 발동: ${skill.name}`);
    });

    // Break caught: special items bypass isItemActorEligible, so populated legacy/AI
    // restriction ids must not be presented as an enforced actor/class allowlist.
    it("does not present special item actor and class ids as runtime restrictions", () => {
      const project = store.getCurrent();
      const actor = project.database.actors[0]!;
      const klass = project.database.classes[0]!;
      const item = normalizeItemRecord({
        ...currentItem(),
        type: "special",
        usableActorIds: [actor.id],
        usableClassIds: [klass.id],
      });

      const story = itemEffectStory(project, item);

      expect(story.notes.some((note) => note.startsWith("사용 허용:"))).toBe(false);
    });

    // Break caught: battle runtime ignores onlyUsableInMenu when the canonical occasion is
    // always, so the summary must not claim this inconsistent legacy record is menu-only.
    it("keeps an always item battle-usable when the legacy menu-only flag is also set", () => {
      const project = store.getCurrent();
      const item = normalizeItemRecord({
        ...currentItem(),
        occasion: "always",
        occasionField: false,
        occasionBattle: false,
        onlyUsableInMenu: true,
      });

      expect(itemEffectStory(project, item).occasion).toBe("필드 · 전투");
    });

    // Break caught: editing a recovery value without refreshing the story would leave a
    // polished but stale summary that contradicts the saved record.
    it("renders the effect story and refreshes it in place after recovery edits", () => {
      const form = renderForm();
      const storyHost = byTestId(form, "db-item-effect-story");
      expect(byTestId(form, "db-item-story-target").textContent).toContain("아군 1명");
      expect(storyHost.textContent).toContain("HP 최대치 40% + 30 회복");

      const hpStepper = byTestId(form, "db-field-item-hp-percent-stepper");
      hpStepper.value = "65";
      hpStepper.dispatchEvent(new Event("input"));

      expect(findByTestId(form, "db-item-effect-story")).toBe(storyHost);
      expect(storyHost.textContent).toContain("HP 최대치 65% + 30 회복");
      expect(storyHost.textContent).not.toContain("HP 최대치 40% + 30 회복");
    });

    it("renders the inspector header with 96px icon, name edit (db-field-name), and type tag", () => {
      const form = renderForm();
      expect(byTestId(form, "db-item-inspector-header")).toBeTruthy();
      const icon = form.querySelector(".db-item-inspector-icon");
      expect(icon).toBeTruthy();
      expect(icon?.style.backgroundImage).toContain("url(");
      expect(form.querySelector(".db-item-inspector-type-tag")?.textContent).toBe("약");

      const nameInput = byTestId(form, "db-field-name");
      expect(nameInput.value).toBe("회복약");
      nameInput.value = "고급 회복약";
      nameInput.dispatchEvent(new Event("input"));
      expect(currentItem().name).toBe("고급 회복약");
    });

    it("HP/MP recovery % input writes clamped step-5 values to the store", () => {
      const form = renderForm();
      const hpStepper = byTestId(form, "db-field-item-hp-percent-stepper");
      expect(hpStepper.attrs.min).toBe("0");
      expect(hpStepper.attrs.max).toBe("100");
      expect(hpStepper.attrs.step).toBe("5");
      expect(hpStepper.value).toBe("40");

      // % 101 → 100 클램프(adversarial: malformed input).
      hpStepper.value = "101";
      hpStepper.dispatchEvent(new Event("input"));
      expect(currentItem().hpRecovery.percentMax).toBe(100);
      expect(hpStepper.value).toBe("100");

      // 스텝 5 정규화: 37 → 35.
      hpStepper.value = "37";
      hpStepper.dispatchEvent(new Event("input"));
      expect(currentItem().hpRecovery.percentMax).toBe(35);

      // MP 쪽도 같은 계약.
      const mpStepper = byTestId(form, "db-field-item-mp-percent-stepper");
      mpStepper.value = "95";
      mpStepper.dispatchEvent(new Event("input"));
      expect(currentItem().mpRecovery.percentMax).toBe(95);
    });

    // Break caught: 회복량 하나를 슬라이더+숫자+± 로 세 번 조작하게 되돌리면 한 줄 문장 배치가 깨진다.
    it("renders each recovery as one line — flat + percent inputs, no slider", () => {
      const form = renderForm();
      const base = form.querySelector("[data-testid='db-field-item-hp-percent']");
      expect(base).toBeTruthy();
      expect(findByTestId(form, "db-field-item-hp-percent-slider")).toBeNull();
      expect(byTestId(form, "db-field-item-hp-percent-stepper")).toBeTruthy();
      expect(byTestId(form, "db-field-item-hp-flat")).toBeTruthy();
      expect(byTestId(form, "db-field-item-mp-flat")).toBeTruthy();
      const flat = byTestId(form, "db-field-item-hp-flat");
      flat.value = "1200";
      flat.dispatchEvent(new Event("input"));
      expect(currentItem().hpRecovery.flat).toBe(999);
    });

    it("segmented scope radio rewrites the stored ItemScope enum", () => {
      const form = renderForm();
      const radios = form.querySelectorAll("[data-testid='db-field-item-scope-option']");
      expect(radios).toHaveLength(2);
      const [allyRadio, allAlliesRadio] = radios as [FakeElement, FakeElement];
      expect(allyRadio.checked).toBe(true);
      expect(currentItem().scope).toBe("ally");

      allAlliesRadio.checked = true;
      allAlliesRadio.dispatchEvent(new Event("change", { bubbles: true }));
      expect(currentItem().scope).toBe("allAllies");

      allyRadio.checked = true;
      allyRadio.dispatchEvent(new Event("change", { bubbles: true }));
      expect(currentItem().scope).toBe("ally");
    });

    it("avatar chip toggles an actor id in usableActorIds and keeps class checkboxes", () => {
      const form = renderForm();
      const actor2 = store.getCurrent().database.actors[1];
      if (!actor2) throw new Error("fixture needs 2 actors");
      const chips = form.querySelectorAll("[data-testid='db-field-item-usable-actors-chip']");
      expect(chips.length).toBeGreaterThanOrEqual(2);
      const chip2 = chips.find((chip) => chip.dataset.actorId === actor2.id);
      if (!chip2) throw new Error(`missing chip for actor ${actor2.id}`);

      expect(chip2.getAttribute("aria-pressed")).toBe("false");
      expect(currentItem().usableActorIds).not.toContain(actor2.id);
      chip2.click();
      expect(currentItem().usableActorIds).toContain(actor2.id);
      expect(chip2.getAttribute("aria-pressed")).toBe("true");
      expect(chip2.classList.contains("dimmed")).toBe(false);

      chip2.click();
      expect(currentItem().usableActorIds).not.toContain(actor2.id);
      expect(chip2.getAttribute("aria-pressed")).toBe("false");
      expect(chip2.classList.contains("dimmed")).toBe(true);

      // 직업(usableClassIds) 체크박스 계약은 그대로 유지된다.
      const klassId = store.getCurrent().database.classes[0]?.id;
      if (klassId) {
        const classCheck = byTestId(form, `db-field-item-usable-class-${klassId}`);
        expect(classCheck.attrs.type).toBe("checkbox");
        classCheck.checked = true;
        classCheck.dispatchEvent(new Event("input"));
        expect(currentItem().usableClassIds).toContain(klassId);
      }
    });

    it("occasion selection synchronizes menu and battle flags", () => {
      const form = renderForm();
      const occasion = byTestId(form, "db-field-item-occasion");
      occasion.value = "field";
      occasion.dispatchEvent(new Event("change"));
      expect(currentItem()).toMatchObject({ occasion: "field", onlyUsableInMenu: true, occasionField: true, occasionBattle: false });
      occasion.value = "always";
      occasion.dispatchEvent(new Event("change"));
      expect(currentItem()).toMatchObject({ occasion: "always", onlyUsableInMenu: false, occasionField: true, occasionBattle: true });
      const deadToggle = byTestId(form, "db-field-item-only-dead");
      deadToggle.checked = true;
      deadToggle.dispatchEvent(new Event("change"));
      expect(currentItem().onlyEffectiveOnDeadActors).toBe(true);
    });

    it("switch items use the same occasion authority", () => {
      updateDatabaseRecord("items", firstItem().id, { type: "switch", occasion: "never" });
      const occasion = byTestId(renderForm(), "db-field-item-occasion");
      occasion.value = "field";
      occasion.dispatchEvent(new Event("change"));
      expect(currentItem()).toMatchObject({ occasion: "field", occasionField: true, occasionBattle: false });
    });

    it("type change calls updateItemType + full rerender and swaps type panels", () => {
      let rerenderCount = 0;
      const form = renderForm(() => {
        rerenderCount += 1;
      });
      const typeSelect = byTestId(form, "db-field-item-type");
      typeSelect.value = "special";
      typeSelect.dispatchEvent(new Event("change"));

      expect(rerenderCount).toBe(1);
      const item = currentItem();
      expect(item.type).toBe("special");
      expect(item.consumable).toBe(true);
      expect(item.scope).toBe("ally");

      // 전체 재렌더 계약: 새 렌더는 메디신 패널 대신 스페셜 패널을 그린다.
      const secondForm = document.createElement("section") as unknown as FakeElement;
      renderItemRecordForm(secondForm as unknown as HTMLElement, item, () => undefined);
      expect(findByTestId(secondForm, "db-items-medicine-panel")).toBeNull();
      expect(findByTestId(secondForm, "db-items-special-panel")).not.toBeNull();
    });

    // Break caught: 같은 record.scope 를 쓰는 컨트롤이 한 화면에 둘(수치 카드의 "범위"
    // 셀렉트 + 대상 세그먼트) 있으면 한쪽을 바꿔도 다른 쪽은 재렌더 전까지 옛 값을 보여준다
    // — 장비 부위(slot) 중복 P0 와 같은 모양이다.
    it("draws one scope control for usable items and none for ordinary goods", () => {
      // 픽스처 item[0] 은 약 계열 — 2지 세그먼트가 권위자다.
      const medicineForm = renderForm();
      expect(findByTestId(medicineForm, "db-field-item-scope")).not.toBeNull();
      expect(findByTestId(medicineForm, "db-field-scope")).toBeNull();

      updateDatabaseRecord("items", firstItem().id, { type: "normalGoods" });
      const goodsForm = renderForm();
      expect(findByTestId(goodsForm, "db-field-scope")).toBeNull();
      expect(findByTestId(goodsForm, "db-field-item-scope")).toBeNull();
    });

    // Break caught: "사용 가능" 카드가 약/책/씨앗/특수 패널에 각각 복제돼 있어 종류를 바꿀
    // 때마다 같은 카드가 다른 자리에 나타났다. 이제 한 장이 위계상 "사용 제한" 구역을 소유한다.
    it("renders one shared usable card placed under the limits section", () => {
      const form = renderForm();
      expect(form.querySelectorAll("[data-testid='db-item-card-usable']")).toHaveLength(1);
      const order = workbenchTestids(form);
      expect(order.indexOf("db-item-section-limits")).toBeLessThan(order.indexOf("db-item-card-usable"));
    });

    // Break caught: 카드가 오름차순으로 쌓이면 그래픽 카드가 효과 카드 사이에 끼고, 가격·포획
    // 배율·연결 스킬이 "수치" 한 장에 섞여 이름이 내용을 설명하지 못한다.
    it("orders workbench cards as summary → definition → effect → limits", () => {
      expect(workbenchTestids(renderForm())).toEqual([
        "db-item-card-story",
        "db-item-section-definition",
        "db-item-card-basics",
        "db-item-section-effect",
        "db-items-medicine-panel",
        "db-item-card-state-effects",
        "db-item-card-animation",
        "db-item-card-targeting",
        "db-item-section-limits",
        "db-item-card-usable",
        "db-item-card-graphic",
        "db-field-support-notice",
      ]);
    });

    // btn-trim-r2: 드문 카드는 「기본」 카드의 「고급」 단추 뒤에 있다. 펼친 상태는 다시 그려도 유지한다.
    it("keeps rare cards behind the basics 고급 toggle and remembers it across rerenders", () => {
      const rare = ["db-item-card-state-effects", "db-item-card-animation", "db-item-card-targeting", "db-item-card-usable", "db-item-card-graphic", "db-field-item-key"];
      const form = renderForm();
      const toggle = byTestId(form, "db-item-advanced-toggle");
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      for (const testid of rare) expect(hiddenByAncestor(byTestId(form, testid)), testid).toBe(true);
      expect(byTestId(form, "db-items-medicine-panel").hidden).toBe(false);
      toggle.click();
      for (const testid of rare) expect(hiddenByAncestor(byTestId(form, testid)), testid).toBe(false);
      const again = renderForm();
      expect(byTestId(again, "db-item-advanced-toggle").getAttribute("aria-expanded")).toBe("true");
      // 모듈 상태라 다음 시험을 위해 접어 둔다.
      byTestId(again, "db-item-advanced-toggle").click();
      expect(byTestId(again, "db-item-card-targeting").hidden).toBe(true);
    });

    // Break caught: stateEffects 는 스키마·뮤테이터·전투 런타임에 모두 있는데 저작 UI 가 없어서
    // "적에게 맹독을 거는 아이템"을 에디터만으로는 만들 수 없었다(도구/JSON 편집 필요).
    it("authors item state effects through add, edit and delete rows", () => {
      const states = store.getCurrent().database.states;
      const firstState = states[0];
      const secondState = states[1];
      if (!firstState || !secondState) throw new Error("fixture needs two states");
      const form = renderLiveForm();

      byTestId(form, "db-item-state-effect-add").click();
      expect(currentItem().stateEffects).toEqual([{ stateId: firstState.id, chance: 100, operation: "add" }]);
      expect(findByTestId(form, "db-item-state-effect-row-0")).not.toBeNull();

      const statePicker = byTestId(form, "db-field-item-state-effect-state-0");
      statePicker.value = secondState.id;
      statePicker.dispatchEvent(new Event("change"));
      const chance = byTestId(form, "db-field-item-state-effect-chance-0");
      chance.value = "140";
      chance.dispatchEvent(new Event("input"));
      const operation = byTestId(form, "db-field-item-state-effect-op-0");
      operation.value = "remove";
      operation.dispatchEvent(new Event("change"));

      // 확률은 저장 전에 0..100 으로 클램프된다(스킬 탭과 같은 계약).
      expect(currentItem().stateEffects).toEqual([{ stateId: secondState.id, chance: 100, operation: "remove" }]);

      byTestId(form, "db-item-state-effect-delete-0").click();
      expect(currentItem().stateEffects).toEqual([]);
      expect(findByTestId(form, "db-item-state-effect-row-0")).toBeNull();
    });

    // Break caught: battle/runtime.ts 는 item.animationId 로 전투 연출을 재생하는데 아이템 탭에
    // 애니메이션 선택이 없어, 저작자가 만든 전투 아이템은 언제나 무연출이었다.
    it("assigns and clears the battle animation played when the item is used", () => {
      const animation = store.getCurrent().database.battleAnimations[0];
      if (!animation) throw new Error("fixture needs a battle animation");
      const form = renderForm();

      const picker = byTestId(form, "db-picker-item-animation");
      picker.value = animation.id;
      picker.dispatchEvent(new Event("change"));
      expect(currentItem().animationId).toBe(animation.id);

      picker.value = "";
      picker.dispatchEvent(new Event("change"));
      expect(currentItem().animationId).toBeUndefined();
    });

    // Break caught: careProfile 은 monsterCare 런타임이 소비하는데 저작 UI 가 없어 먹이·장난감
    // 아이템은 기본 카탈로그에만 존재하고 사용자가 새로 만들 수 없었다.
    it("authors the monster care profile and removes it when set to none", () => {
      updateDatabaseRecord("items", firstItem().id, { type: "special" });
      const form = renderLiveForm();

      const kind = byTestId(form, "db-field-item-care-kind");
      kind.value = "feed";
      kind.dispatchEvent(new Event("change"));
      expect(currentItem().careProfile).toEqual({ kind: "feed", friendshipDelta: 0 });

      const friendship = byTestId(form, "db-field-item-care-friendship");
      friendship.value = "8";
      friendship.dispatchEvent(new Event("input"));
      const exp = byTestId(form, "db-field-item-care-exp");
      exp.value = "20";
      exp.dispatchEvent(new Event("input"));
      expect(currentItem().careProfile).toEqual({ kind: "feed", friendshipDelta: 8, expDelta: 20 });

      const kindAfter = byTestId(form, "db-field-item-care-kind");
      kindAfter.value = "none";
      kindAfter.dispatchEvent(new Event("change"));
      expect(currentItem().careProfile).toBeUndefined();
    });

    it("round-trips edited state effects, animation and care profile through project persistence", () => {
      const project = store.getCurrent();
      const itemId = currentItem().id;
      const animationId = project.database.battleAnimations[0]!.id;
      const stateEffects = [{ stateId: project.database.states[0]!.id, chance: 75, operation: "add" as const }];
      const careProfile = { kind: "toy" as const, friendshipDelta: 8, expDelta: 20 };
      updateDatabaseRecord("items", itemId, { stateEffects, animationId, careProfile });

      const reloaded = deserialize(serialize(store.getCurrent()));
      expect(reloaded.database.items.find((item) => item.id === itemId)).toMatchObject({ stateEffects, animationId, careProfile });
      store.replace(reloaded);
      updateDatabaseRecord("items", itemId, { stateEffects: [], animationId: undefined, careProfile: undefined });
      const cleared = deserialize(serialize(store.getCurrent())).database.items.find((item) => item.id === itemId)!;
      expect(cleared.stateEffects).toEqual([]);
      expect(cleared.animationId).toBeUndefined();
      expect(cleared.careProfile).toBeUndefined();
    });

    // Break caught: 서사가 remove(상태 회복)만 읽어서, 맹독을 부여하는 아이템이 "직접 효과 없음"
    // 으로 요약됐다. 확률이 100 미만이면 확률도 밝혀야 저작자가 판정을 예측할 수 있다.
    it("narrates inflicted states with their chance and names the battle animation", () => {
      const project = store.getCurrent();
      const state = project.database.states[0];
      const animation = project.database.battleAnimations[0];
      if (!state || !animation) throw new Error("fixture needs a state and an animation");
      const item = normalizeItemRecord({
        ...currentItem(),
        hpRecovery: { flat: 0, percentMax: 0 },
        mpRecovery: { flat: 0, percentMax: 0 },
        healStateIds: [],
        animationId: animation.id,
        stateEffects: [{ stateId: state.id, chance: 75, operation: "add" }],
      });

      const story = itemEffectStory(project, item);

      expect(story.effects).toContain(`상태 부여: ${state.name} (75%)`);
      expect(story.notes).toContain(`전투 연출: ${animation.name}`);
    });

    it("omits the chance when an inflicted state always lands", () => {
      const project = store.getCurrent();
      const state = project.database.states[0];
      if (!state) throw new Error("fixture needs a state");
      const item = normalizeItemRecord({
        ...currentItem(),
        hpRecovery: { flat: 0, percentMax: 0 },
        mpRecovery: { flat: 0, percentMax: 0 },
        healStateIds: [],
        stateEffects: [{ stateId: state.id, chance: 100, operation: "add" }],
      });

      expect(itemEffectStory(project, item).effects).toContain(`상태 부여: ${state.name}`);
    });

    // 가격은 "수치" 대신 정의(기본) 카드가 소유한다. 종류를 바꿔도 사라지지 않아야 한다.
    it("keeps price and consumption in basics, without unrelated farming options on medicine", () => {
      const basics = byTestId(renderForm(), "db-item-card-basics");
      expect(findByTestId(basics, "db-field-price")).not.toBeNull();
      expect(findByTestId(basics, "db-field-item-type")).not.toBeNull();
      expect(findByTestId(basics, "db-field-item-consumption-limit")).not.toBeNull();
      expect(findByTestId(basics, "db-field-item-farm-tool")).toBeNull();
    });

    it("weapon type shows an equipment-tab door instead of the legacy equipment form", () => {
      updateDatabaseRecord("items", firstItem().id, { type: "weapon" });
      const form = document.createElement("section") as unknown as FakeElement;
      const panelRoot = document.createElement("div") as unknown as FakeElement;
      panelRoot.className = "database-modal-body";
      panelRoot.append(form as unknown as HTMLElement);
      renderItemRecordForm(form as unknown as HTMLElement, currentItem(), () => undefined);

      expect(findByTestId(form, "db-field-item-wield-type")).toBeNull();
      expect(findByTestId(form, "db-item-open-equipment-tab")).not.toBeNull();
      const catalog = inventoryCatalogSession();
      catalog.collection = "items";
      catalog.filter = "all";
      findByTestId(form, "db-item-open-equipment-tab")?.click();
      expect(getDatabaseActiveTab()).toBe("items");
      expect(catalog.collection).toBe("equipment");
      expect(catalog.filter).toBe("equipment");
    });

    it("legacy weapon item keeps its price but has no scope/capture editors", async () => {
      const { renderRecordTab } = await import("@/editor/panels/databaseRecordViews");
      updateDatabaseRecord("items", firstItem().id, { type: "weapon" });
      const host = document.createElement("div") as unknown as FakeElement;
      renderRecordTab(host as unknown as HTMLElement, "items", () => undefined);
      expect(findByTestId(host, "db-item-open-equipment-tab")).not.toBeNull();
      expect(findByTestId(host, "db-field-price")).not.toBeNull();
      expect(findByTestId(host, "db-field-item-capture-multiplier")).toBeNull();
    });

    // 농사 도구 드롭다운은 FARM_TOOLS 정본에서 파생되어야 한다. 하드코딩이면 axe/pickaxe 가
    // 빠져 나무 베기·채굴이 저작 불가가 된다(회귀 방지).
    it("farm tool dropdown offers every canonical FARM_TOOLS value with Korean labels", () => {
      updateDatabaseRecord("items", firstItem().id, { type: "normalGoods" });
      const form = renderForm();
      const select = byTestId(form, "db-field-item-farm-tool");
      expect(select.children.map((option) => option.attrs.value)).toEqual(["", ...FARM_TOOLS]);
      expect(select.children.map((option) => option.textContent)).toEqual(["(없음)", "괭이", "물뿌리개", "도끼", "곡괭이"]);

      select.value = "pickaxe";
      select.dispatchEvent(new Event("change"));
      expect(currentItem().farmTool).toBe("pickaxe");

      select.value = "";
      select.dispatchEvent(new Event("change"));
      expect(currentItem().farmTool).toBeUndefined();
    });
  });
  function renderForm(rerender: () => void = () => undefined): FakeElement {
    const form = document.createElement("section") as unknown as FakeElement;
    renderItemRecordForm(form as unknown as HTMLElement, currentItem(), rerender);
    return form;
  }
  /**
   * 실제 패널처럼 rerender 가 같은 노드를 다시 그리는 폼. 행 추가/삭제처럼 컨트롤 개수가
   * 바뀌는 편집은 rerender 계약까지 함께 검증해야 한다(no-op rerender 로는 새 행이
   * 화면에 없는데도 통과한다).
   */
  function renderLiveForm(): FakeElement {
    const form = document.createElement("section") as unknown as FakeElement;
    const paint = (): void => {
      form.replaceChildren();
      renderItemRecordForm(form as unknown as HTMLElement, currentItem(), paint);
    };
    paint();
    return form;
  }
  /** 워크벤치 격자의 직계 자식 testid 순서 = 화면에서 읽히는 카드 순서. */
  function workbenchTestids(form: FakeElement): string[] {
    const workbench = findByTestId(form, "db-items-oprn-workbench");
    if (!workbench) throw new Error("missing db-items-oprn-workbench");
    return workbench.children.map((child) => child.dataset.testid).filter((testid): testid is string => Boolean(testid));
  }
  function currentItem(): ItemRecord {
    const item = store.getCurrent().database.items.find((entry) => entry.id === firstItem().id);
    if (!item) throw new Error("fixture item missing from store");
    return item;
  }
  function firstItem(): ItemRecord {
    const item = store.getCurrent().database.items[0];
    if (!item) throw new Error("fixture needs at least one item");
    return item;
  }
  function hiddenByAncestor(node: FakeElement): boolean {
    for (let current: FakeElement | null = node; current; current = current.parentElement) if (current.hidden) return true;
    return false;
  }
  function byTestId(root: FakeElement, testid: string): FakeElement {
    const element = findByTestId(root, testid);
    if (!element) throw new Error(`missing test id ${testid}`);
    return element;
  }
});

describe("databaseModalDockMode", () => {
  isolateTimers();
  // DB 3파 M8 — 사이드 도킹.
  // ① 토글 시 클래스/aria 전환(도크: role=complementary + aria-modal 제거, 복원: 원상).
  // ② localStorage["oprn:db-dock-mode"] 저장/다음 오픈 시 복원.
  // ③ 도크 모드에서 backdrop 클릭(바깥 클릭)이 close 를 트리거하지 않는다 — 맵 조작이 곧 바깥 클릭.

  let restoreDom: (() => void) | undefined;
  let previousWindow: typeof globalThis.window | undefined;
  let fakeStorage: Storage;
  beforeEach(() => {
    restoreDom = installFakeDom();
    previousWindow = globalThis.window;
    fakeStorage = createFakeLocalStorage();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        clearTimeout,
        localStorage: fakeStorage,
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
    requestDatabaseModalClose("battleTest");
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
  function modalParts(): { backdrop: FakeElement; windowEl: FakeElement; dockToggle: FakeElement } {
    const backdrop = document.querySelector("[data-testid='database-modal']");
    if (!(backdrop instanceof FakeElement)) throw new Error("database modal not open");
    const windowEl = backdrop.querySelector(".database-modal-window");
    const dockToggle = findByTestId(backdrop, "database-dock-toggle");
    if (!(windowEl instanceof FakeElement) || !dockToggle) throw new Error("missing modal window or dock toggle");
    return { backdrop, windowEl, dockToggle };
  }
  describe("database modal dock mode (M8)", () => {
    it("toggles classes and aria between dialog and side dock", () => {
      openDatabaseModal("actors");
      const { backdrop, windowEl, dockToggle } = modalParts();
      expect(windowEl.attrs.role).toBe("dialog");
      expect(windowEl.attrs["aria-modal"]).toBe("true");
      expect(dockToggle.attrs["aria-label"]).toBe("사이드 도크로 전환");

      dockToggle.click();
      expect(backdrop.classList.contains("is-docked")).toBe(true);
      expect(windowEl.attrs.role).toBe("complementary");
      expect(windowEl.getAttribute("aria-modal")).toBeNull();
      expect(dockToggle.attrs["aria-label"]).toBe("창 모드로 복원");

      dockToggle.click();
      expect(backdrop.classList.contains("is-docked")).toBe(false);
      expect(windowEl.attrs.role).toBe("dialog");
      expect(windowEl.attrs["aria-modal"]).toBe("true");
      expect(dockToggle.attrs["aria-label"]).toBe("사이드 도크로 전환");
    });

    it("disables maximize while docked and clears maximized state on dock", () => {
      openDatabaseModal("actors");
      const { backdrop, windowEl, dockToggle } = modalParts();
      const maximize = findByTestId(backdrop, "database-modal-maximize");
      if (!maximize) throw new Error("missing maximize button");

      maximize.click();
      expect(windowEl.classList.contains("maximized")).toBe(true);

      dockToggle.click();
      // 도크 전환은 최대화 상태를 정리하고, 도크 중 최대화는 무시된다.
      expect(windowEl.classList.contains("maximized")).toBe(false);
      maximize.click();
      expect(windowEl.classList.contains("maximized")).toBe(false);
    });

    it("persists dock mode and restores it on next open", () => {
      openDatabaseModal("actors");
      modalParts().dockToggle.click();
      expect(fakeStorage.getItem("oprn:db-dock-mode")).toBe("1");
      requestDatabaseModalClose("battleTest");

      openDatabaseModal("actors");
      const { backdrop, windowEl } = modalParts();
      expect(backdrop.classList.contains("is-docked")).toBe(true);
      expect(windowEl.attrs.role).toBe("complementary");

      // 창 모드로 복원하면 저장값도 0 으로 돌아간다.
      modalParts().dockToggle.click();
      expect(fakeStorage.getItem("oprn:db-dock-mode")).toBe("0");
    });

    it("does not close on backdrop click while docked, but still does in window mode", () => {
      openDatabaseModal("actors");
      const { backdrop, dockToggle } = modalParts();
      dockToggle.click();

      backdrop.dispatchEvent(new Event("mousedown"));
      expect(document.querySelector("[data-testid='database-modal']")).not.toBeNull();

      // 창 모드로 복원하면 바깥 클릭 닫기가 다시 동작한다(dirty 아님 → 즉시 close).
      dockToggle.click();
      backdrop.dispatchEvent(new Event("mousedown"));
      expect(document.querySelector("[data-testid='database-modal']")).toBeNull();
    });

    it("starts drag with inline fixed position and ignores header button presses", () => {
      openDatabaseModal("actors");
      const { windowEl } = modalParts();
      const header = windowEl.querySelector(".database-modal-header");
      if (!header) throw new Error("missing modal header");
      const press = (target: unknown): void => {
        const event = new Event("mousedown") as MouseEvent;
        Object.defineProperties(event, {
          button: { value: 0 },
          clientX: { value: 100 },
          clientY: { value: 100 },
          target: { value: target },
          preventDefault: { value: () => undefined },
        });
        startModalDrag(windowEl as unknown as HTMLElement, event);
      };
      // 헤더 빈 영역: 드래그 시작 + 인라인 fixed (ai-bar.css relative 앵커를 이긴다).
      press(header);
      expect(windowEl.classList.contains("floating")).toBe(true);
      expect((windowEl as unknown as HTMLElement).style.position).toBe("fixed");
      stopModalDrag();
      windowEl.classList.remove("floating");
      (windowEl as unknown as HTMLElement).style.position = "";
      // 헤더 버튼 안 SVG 아이콘: event.target이 svg여도 드래그를 시작하지 않는다.
      const maximize = windowEl.querySelector("[data-testid='database-modal-maximize']");
      if (!maximize) throw new Error("missing maximize button");
      const icon = maximize.querySelector("svg") ?? maximize;
      press(icon);
      expect(windowEl.classList.contains("floating")).toBe(false);
      stopModalDrag();
    });

    it("maximizes with inline geometry and clears drag residue on dock", () => {
      openDatabaseModal("actors");
      const { windowEl, dockToggle } = modalParts();
      const maximize = windowEl.querySelector("[data-testid='database-modal-maximize']");
      if (!maximize) throw new Error("missing maximize button");
      const inline = windowEl as unknown as HTMLElement;
      // 최대화: sidebar 지오메트리 소유자를 인라인으로 이겨 창이 실제로 커진다.
      maximize.click();
      expect(windowEl.classList.contains("maximized")).toBe(true);
      expect(inline.style.position).toBe("fixed");
      expect(inline.style.width).toBe("calc(100vw - 16px)");
      expect(inline.style.maxWidth).toBe("none");
      // 복원: 인라인 잔재를 비워 CSS 기본 지오메트리로 돌아간다.
      maximize.click();
      expect(windowEl.classList.contains("maximized")).toBe(false);
      expect(inline.style.position).toBe("");
      expect(inline.style.width).toBe("");
      // 도크: 드래그/최대화가 남긴 인라인 상태까지 정리한다.
      inline.style.position = "fixed";
      inline.style.width = "100px";
      dockToggle.click();
      expect(inline.style.position).toBe("");
      expect(inline.style.width).toBe("");
      expect(inline.style.maxWidth).toBe("");
    });
  });
});
