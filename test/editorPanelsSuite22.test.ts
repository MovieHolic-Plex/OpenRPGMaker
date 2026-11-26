import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateDatabaseRecord, addDatabaseRecord, deleteDatabaseRecord } from "@/editor/databaseActions";
import { renderClassRecordForm } from "@/editor/panels/databaseClassRecordView";
import { renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { renderStateRecordForm } from "@/editor/panels/databaseStateRecordView";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { FakeElement, findByTestId, installFakeDom, FakeNode } from "./fakeDom";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { setSelectedRecordId, setViewModeForCollection } from "@/editor/panels/databaseRecordViewSession";
import { DATABASE_FOOTER_ACTION_TEST_IDS } from "@/editor/panels/databaseWorkbench";
import { buildDemonstrationMessage, type DemonstrationPayload } from "@/ai/demonstrationPrompt";
import { openDemoTeachModal } from "@/editor/panels/demoTeachCanvas";
import { TILE } from "@/project/defaults/constants";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { editorState } from "@/editor/editorState";
import { renderCanvasToolbar } from "@/editor/panels/editorZoomToolbar";
import { resetCanvasToolPillForTests } from "@/editor/panels/canvasToolPill";
import { _resetEditorGameSuspensionForTest, configureEditorGameAccessor, isEditorGameSuspended, resumeEditorGame, suspendEditorGame } from "@/editor/panels/editorGameSuspension";
import { createEditorModalDirtyCloseController, EDITOR_MODAL_DIRTY_DECISION, type EditorModalCloseAttempt, type EditorModalDirtyDecision } from "@/editor/panels/editorModalDirtyState";
import { equipmentSlotManager } from "@/editor/panels/equipmentSlotManager";
import { isolateTimers } from "./mergedTeardown";

describe("databaseWave2BatchC", () => {
  isolateTimers();
  // 2파 배치 C(P10) 회귀 스펙:
  //  - 상태 참조 패널이 switch 스킬 대신 실제 stateEffects 참조를 보여준다
  //  - 상태 수치 필드가 뷰 레벨에서 클램프된다
  //  - 장비 효과 필드군(effectFlags/속성/상태 방어)이 UI에 노출되고 store 에 반영된다
  //  - 장착 허용 패널이 배우/직업 구분 헤더를 가진다
  //  - 직업 허용 장비가 다중 체크박스로 배열을 보존한다(6→1 파괴 회귀 방지)
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    project.database.states = [
      { id: "state_poison", name: "독" },
      { id: "state_sleep", name: "수면" },
    ];
    project.database.elements = [
      { id: "element_fire", name: "화염", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
    ];
    const baseSkill = project.database.skills[0];
    if (!baseSkill) throw new Error("expected default skill in blank project");
    // 상태와 무관한 스위치 스킬(과거 오탐 대상) + 상태를 실제 참조하는 스킬.
    project.database.skills = [
      { ...baseSkill, id: "skill_switch", name: "스위치 스킬", effect: { kind: "switch", switchId: "sw_0001" }, stateEffects: [] },
      { ...baseSkill, id: "skill_poison", name: "독침", effect: { kind: "damage", statistic: "attack", affects: "hp" }, stateEffects: [{ stateId: "state_poison", chance: 50, operation: "add" }] },
    ];
    project.database.equipment = [
      normalizeEquipmentRecord({ id: "equip_sword", name: "검" }),
      normalizeEquipmentRecord({ id: "equip_shield", name: "방패" }),
      normalizeEquipmentRecord({ id: "equip_armor", name: "갑옷" }),
    ];
    store.replace(project);
    resetMapEditHistory();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function renderStateForm(stateId: string): FakeElement {
    const state = store.getCurrent().database.states.find((entry) => entry.id === stateId);
    if (!state) throw new Error("missing state");
    const form = el("div") as unknown as FakeElement;
    renderStateRecordForm(form as unknown as HTMLElement, state);
    return form;
  }
  describe("state reference panel shows actual stateEffects references (P10)", () => {
    it("lists skills whose stateEffects target this state, not switch-kind skills", () => {
      const form = renderStateForm("state_poison");
      const references = findByTestId(form, "db-state-references");
      if (!references) throw new Error("missing reference panel");
      const text = references.textContent;
      expect(text).toContain("독침");
      expect(text).not.toContain("스위치 스킬");
    });

    it("shows the empty hint for a state no skill references", () => {
      const form = renderStateForm("state_sleep");
      const references = findByTestId(form, "db-state-references");
      if (!references) throw new Error("missing reference panel");
      expect(references.textContent).toContain("(참조하는 스킬 없음)");
    });
  });
  describe("state rare panels sit behind 「고급」 (btn-trim-r2)", () => {
    it("keeps 기본 설정·참조 visible and toggles the rare panels with one button", () => {
      const form = renderStateForm("state_poison");
      const toggle = findByTestId(form, "db-state-advanced-toggle");
      const runtime = findByTestId(form, "db-state-runtime-hint")?.parentElement;
      const references = findByTestId(form, "db-state-references");
      if (!toggle || !runtime || !references) throw new Error("missing state panels");
      expect(references.hidden).toBe(false);
      expect(runtime.hidden).toBe(true);
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      toggle.click();
      expect(runtime.hidden).toBe(false);
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      toggle.click();
      expect(runtime.hidden).toBe(true);
    });
  });
  describe("state numeric fields clamp at the view level (P10)", () => {
    it("clamps 회복 확률 999 → 100 and 명중률 보정 -50 → 0 with display write-back", () => {
      const form = renderStateForm("state_poison");
      const recover = findByTestId(form, "db-state-recover-chance");
      const accuracy = findByTestId(form, "db-state-accuracy");
      if (!recover || !accuracy) throw new Error("missing state numeric fields");

      recover.value = "999";
      recover.dispatchEvent(new Event("input"));
      expect(recover.value).toBe("100");
      accuracy.value = "-50";
      accuracy.dispatchEvent(new Event("input"));
      expect(accuracy.value).toBe("0");

      const state = store.getCurrent().database.states.find((entry) => entry.id === "state_poison");
      expect(state?.recoverNaturallyChance).toBe(100);
      expect(state?.accuracyModifier).toBe(0);
    });
  });
  describe("equipment effect field group ported from the item tab (P10)", () => {
    function renderEquipmentForm(id: string): FakeElement {
      const record = store.getCurrent().database.equipment.find((entry) => entry.id === id);
      if (!record) throw new Error("missing equipment");
      const form = el("div") as unknown as FakeElement;
      renderEquipmentRecordForm(form as unknown as HTMLElement, record);
      return form;
    }

    it("renders the three supported effect flags and commits toggles to the store", () => {
      const form = renderEquipmentForm("equip_sword");
      for (const testid of [
        "db-field-equipment-effect-double",
        "db-field-equipment-effect-all",
        "db-field-equipment-effect-fixed",
      ]) {
        expect(findByTestId(form, testid), testid).not.toBeNull();
      }
      const double = findByTestId(form, "db-field-equipment-effect-double");
      if (!double) throw new Error("missing doubleAttack flag");
      double.checked = true;
      double.dispatchEvent(new Event("change"));
      expect(store.getCurrent().database.equipment[0]?.effectFlags.doubleAttack).toBe(true);
    });

    it("renders attack/defense element choices and state defense fields", () => {
      const form = renderEquipmentForm("equip_sword");
      const attackElement = findByTestId(form, "db-field-equipment-attack-element");
      if (!attackElement) throw new Error("missing attack element select");
      attackElement.value = "element_fire";
      attackElement.dispatchEvent(new Event("change"));
      expect(store.getCurrent().database.equipment[0]?.attackElementIds).toEqual(["element_fire"]);

      const stateDefense = findByTestId(form, "db-field-equipment-state-defense-state_poison");
      if (!stateDefense) throw new Error("missing state defense checkbox");
      stateDefense.checked = true;
      stateDefense.dispatchEvent(new Event("change"));
      expect(store.getCurrent().database.equipment[0]?.stateDefenseIds).toEqual(["state_poison"]);

      expect(findByTestId(form, "db-field-equipment-state-defense-mode")).toBeNull();
      const resistance = findByTestId(form, "db-field-equipment-state-resistance");
      if (!resistance) throw new Error("missing state resistance field");
      resistance.value = "250";
      resistance.dispatchEvent(new Event("input"));
      expect(resistance.value).toBe("100");
      expect(store.getCurrent().database.equipment[0]?.stateResistanceChance).toBe(100);
    });

    it("separates equippable actors and classes with group headings", () => {
      const form = renderEquipmentForm("equip_sword");
      const actorGroup = findByTestId(form, "db-equipment-actor-permission-group");
      const classGroup = findByTestId(form, "db-equipment-class-permission-group");
      if (!actorGroup || !classGroup) throw new Error("missing permission groups");
      expect(actorGroup.textContent).toContain("주인공별 허용");
      expect(classGroup.textContent).toContain("직업별 허용");
    });
  });
  describe("class equipment permissions keep the array intact (P10 Critical)", () => {
    function renderClassForm(id: string): FakeElement {
      const record = store.getCurrent().database.classes.find((entry) => entry.id === id);
      if (!record) throw new Error("missing class");
      const form = el("div") as unknown as FakeElement;
      renderClassRecordForm(form as unknown as HTMLElement, record);
      return form;
    }

    it("renders one checkbox per equipment and toggling one preserves the others", () => {
      const klass = store.getCurrent().database.classes[0];
      if (!klass) throw new Error("expected default class in blank project");
      updateDatabaseRecord("classes", klass.id, {
        equipmentPermissions: { ...klass.equipmentPermissions, equipmentIds: ["equip_sword", "equip_shield", "equip_armor"] },
      });

      const form = renderClassForm(klass.id);
      const checklist = findByTestId(form, "db-class-equipment-checklist");
      if (!checklist) throw new Error("missing equipment checklist");

      const shield = findByTestId(form, "db-field-class-equipment-equip_shield");
      if (!shield) throw new Error("missing shield checkbox");
      expect(shield.checked).toBe(true);
      shield.checked = false;
      shield.dispatchEvent(new Event("change"));

      const after = store.getCurrent().database.classes.find((entry) => entry.id === klass.id);
      expect(after?.equipmentPermissions.equipmentIds).toEqual(["equip_sword", "equip_armor"]);

      shield.checked = true;
      shield.dispatchEvent(new Event("change"));
      const restored = store.getCurrent().database.classes.find((entry) => entry.id === klass.id);
      expect(restored?.equipmentPermissions.equipmentIds).toEqual(["equip_sword", "equip_armor", "equip_shield"]);
    });
  });
});

describe("databaseWorkbench", () => {
  isolateTimers();
  type FakeBrowserGlobals = {
    readonly window: typeof globalThis.window | undefined;
    readonly requestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
  };
  let restoreDom: (() => void) | undefined;
  let previousBrowserGlobals: FakeBrowserGlobals;
  beforeEach(() => {
    restoreDom = installFakeDom();
    previousBrowserGlobals = {
      requestAnimationFrame: globalThis.requestAnimationFrame,
      window: globalThis.window,
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        clearTimeout,
        localStorage: createFakeLocalStorage(),
        setTimeout: (handler: TimerHandler): number => {
          if (typeof handler === "function") handler();
          return 0;
        },
      },
    });
    Object.defineProperty(globalThis, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback): number => {
        callback(0);
        return 0;
      },
    });
    store.replace(createBlankProject());
    resetDatabaseRecordViewSession();
    // 이 테스트는 리스트 행 계약(부분 렌더/검색/삭제 2단계)을 검증한다 — 갤러리 기본값
    // 컬렉션(skills/actors/classes)을 명시적으로 list 로 고정한다.
    setViewModeForCollection("skills", "list");
    setViewModeForCollection("actors", "list");
    setViewModeForCollection("classes", "list");
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
    restoreBrowserGlobal("window", previousBrowserGlobals.window);
    restoreBrowserGlobal("requestAnimationFrame", previousBrowserGlobals.requestAnimationFrame);
  });
  describe("Database RM2K3 workbench context", () => {
    it("keeps the footer actions stable", () => {
      expect(DATABASE_FOOTER_ACTION_TEST_IDS).toEqual({
        apply: "database-footer-apply",
      });
    });

    it("Given a stale deleted selection When a modal session restarts Then it selects the first live record", () => {
      const firstSkill = store.getCurrent().database.skills[0];
      const secondSkillId = addDatabaseRecord("skills");
      expect(firstSkill).toBeDefined();

      const selectedRow = findByTestId(renderRecordHost("skills"), `db-record-row-${secondSkillId}`);
      selectedRow?.click();

      expect(findByTestId(renderRecordHost("skills"), `db-record-row-${secondSkillId}`)?.attrs["aria-pressed"]).toBe("true");

      const deleteResult = deleteDatabaseRecord("skills", secondSkillId);
      expect(deleteResult.ok).toBe(true);
      resetDatabaseRecordViewSession();

      const reopened = renderRecordHost("skills");
      expect(findByTestId(reopened, `db-record-row-${secondSkillId}`)).toBeNull();
      expect(findByTestId(reopened, `db-record-row-${firstSkill.id}`)?.attrs["aria-pressed"]).toBe("true");
    });

    it("Given a search on one record tab When another tab renders Then the new tab has an isolated blank search", () => {
      const actorSearch = searchInput(renderRecordHost("actors"));
      actorSearch.value = "Hero";
      actorSearch.dispatchEvent(new Event("input"));

      expect(searchInput(renderRecordHost("actors")).value).toBe("Hero");
      expect(searchInput(renderRecordHost("skills")).value).toBe("");
    });

    // 가짜 직업 채움 행("마검사"/"기사"/... disabled aria-hidden 행)은 목록 아래를 시각적으로
    // 채우기만 하는 죽은 컨트롤이었다 — fix(db)에서 제거했다. classes 탭은 이제 다른 탭과
    // 동일하게 실제 레코드만 렌더하고 검색도 실동작한다.
    it("Given the classes tab When rendered Then no decorative filler rows or group tabs exist", () => {
      const host = renderRecordHost("classes");
      const recordRows = allElements(host).filter((node) => node.dataset.testid?.startsWith("db-record-row-"));
      const fillerRows = allElements(host).filter((node) => node.className.split(/\s+/u).includes("db-list-row-visual-filler"));

      expect(recordRows).toHaveLength(store.getCurrent().database.classes.length);
      expect(fillerRows).toHaveLength(0);
      expect(findByTestId(host, "db-classic-group-tabs")).toBeNull();
    });

    it("Given a search on the classes tab When a query is typed Then the record list actually filters (no more classes special-case)", () => {
      const classes = store.getCurrent().database.classes;
      expect(classes.length).toBeGreaterThan(1);
      const target = classes[0];

      // 검색어 저장은 세션 상태를 통해 이뤄지므로(디바운스된 rerender 콜백을 거치지 않고도),
      // 새로 렌더된 호스트에서 필터링 결과를 확인한다 — 다른 케이스("isolated blank search")와
      // 동일한 패턴.
      const searchHost = renderRecordHost("classes");
      const searchField = searchInput(searchHost);
      searchField.value = target.name;
      searchField.dispatchEvent(new Event("input"));

      const filteredHost = renderRecordHost("classes");
      const visibleRows = allElements(filteredHost).filter((node) => node.dataset.testid?.startsWith("db-record-row-"));
      expect(visibleRows.some((row) => row.dataset.recordId === target.id)).toBe(true);
      expect(visibleRows.length).toBeLessThan(classes.length);

      const noMatchField = searchInput(renderRecordHost("classes"));
      noMatchField.value = "존재하지않는검색어zzz";
      noMatchField.dispatchEvent(new Event("input"));
      const noMatchHost = renderRecordHost("classes");
      const noMatchRows = allElements(noMatchHost).filter((node) => node.dataset.testid?.startsWith("db-record-row-"));
      expect(noMatchRows).toHaveLength(0);
    });
  });
  // 69756ade51 (IS-091): 되돌릴 수 있는 삭제는 확인 없이 바로 실행한다 — Ctrl+Z 가 한 단계로 되살린다.
  describe("Database record deletion — immediate, undoable", () => {
    it("deletes on the first click without a confirm step and shows an undo-hint toast", () => {
      const skillId = addDatabaseRecord("skills");
      setSelectedRecordId("skills", skillId);
      const host = renderRecordHost("skills");

      const deleteButton = findByTestId(host, "db-delete-selected");
      expect(deleteButton?.textContent).toBe("삭제");
      deleteButton?.click();

      expect(deleteButton?.className.split(/\s+/u)).not.toContain("confirming");
      expect(store.getCurrent().database.skills.some((entry) => entry.id === skillId)).toBe(false);
      const toastEl = document.querySelector<HTMLElement>("[data-testid='toast']");
      expect(toastEl?.textContent).toContain("삭제했습니다");
      expect(toastEl?.textContent).toContain("Ctrl+Z");
    });

    it("deletes only the record that is selected when the button is pressed", () => {
      const firstSkillId = store.getCurrent().database.skills[0]?.id ?? "";
      const secondSkillId = addDatabaseRecord("skills");
      setSelectedRecordId("skills", firstSkillId);
      const host = renderRecordHost("skills");

      findByTestId(host, `db-record-row-${secondSkillId}`)?.click(); // 선택 전환

      findByTestId(host, "db-delete-selected")?.click();

      expect(store.getCurrent().database.skills.some((entry) => entry.id === secondSkillId)).toBe(false);
      expect(store.getCurrent().database.skills.some((entry) => entry.id === firstSkillId)).toBe(true);
    });

    it("still reports a reference-guard failure immediately on the first click (no confirm step needed)", () => {
      const actorId = store.getCurrent().database.actors[0]?.id ?? "";
      store.update((project) => {
        project.system.startActorIds = [actorId];
      });
      setSelectedRecordId("actors", actorId);
      const host = renderRecordHost("actors");

      const deleteButton = findByTestId(host, "db-delete-selected");
      deleteButton?.click();

      // 참조 가드 실패는 기존처럼 1클릭 즉시 에러 — 확인 상태로 넘어가지 않고, 레코드도 남는다.
      // (databaseReferenceMessage 자체의 가드 메시지/커버리지는 test/databaseReferenceGuards.test.ts 몫.)
      expect(deleteButton?.textContent).toBe("삭제");
      expect(deleteButton?.className.split(/\s+/u)).not.toContain("confirming");
      expect(store.getCurrent().database.actors.some((entry) => entry.id === actorId)).toBe(true);
    });
  });
  function renderRecordHost(collection: Parameters<typeof renderRecordTab>[1]): FakeElement {
    const host = document.createElement("div");
    renderRecordTab(host, collection, () => undefined);
    if (host instanceof FakeElement) return host;
    throw new Error("Expected fake database host");
  }
  function searchInput(host: FakeElement): FakeElement {
    const input = host.querySelector("input");
    if (input) return input;
    throw new Error("Expected database search input");
  }
  function allElements(root: FakeNode): FakeElement[] {
    const matches: FakeElement[] = [];
    for (const child of root.childNodes) {
      if (child instanceof FakeElement) matches.push(child, ...allElements(child));
    }
    return matches;
  }
  function restoreBrowserGlobal(name: keyof FakeBrowserGlobals, value: FakeBrowserGlobals[typeof name]): void {
    if (value === undefined) {
      Reflect.deleteProperty(globalThis, name);
      return;
    }
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
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
});

// 시연으로 가르치기 계약(2026-07-05): 붓질 기록 → 메시지 조립 → AI 해석 지침 내장.
// AI 추측이 틀렸을 때 말 대신 직접 깔아서 보여주는 교정 채널.
describe("demoTeach", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });
  describe("buildDemonstrationMessage", () => {
    const payload: DemonstrationPayload = {
      w: 3,
      h: 2,
      seed: { mapId: "map_v", x: 5, y: 7 },
      lower: [
        [240, 290, 290],
        [240, 290, 290],
      ],
      upper: [
        [-1, -1, -1],
        [-1, 87, -1],
      ],
      strokes: [
        { layer: "lower", x: 1, y: 0, tile: 290 },
        { layer: "lower", x: 2, y: 0, tile: 290 },
        { layer: "upper", x: 1, y: 1, tile: 87 },
      ],
      explanation: "나무는 2×2 이상 뭉쳐야 숲으로 보임",
    };

    it("최종 그리드·붓질 순서·설명·해석 지침(교정 툴 안내)을 담는다", () => {
      const message = buildDemonstrationMessage(payload);
      expect(message).toContain("[시연]");
      expect(message).toContain(payload.explanation);
      expect(message).toContain("240 290 290"); // 하위 그리드 행.
      expect(message).toContain(". 87 ."); // 상위 그리드(빈 칸은 .).
      expect(message).toContain("1) lower (1,0) ← 타일 290"); // 붓질 순서 보존.
      expect(message).toContain("set_tile_metadata");
      expect(message).toContain("upsert_tile_group");
      expect(message).toContain("show_tiles");
      expect(message).toContain("confirmedByUser=true");
      expect(message).toContain("placementRules");
      expect(message).toContain("map_v");
      expect(message).toContain("(5,7)");
      expect([...message.matchAll(/^(\d+)\) (lower|upper) \((\d+),(\d+)\) ← 타일 (\d+)$/gm)]
        .map((match) => ({ layer: match[2], x: Number(match[3]), y: Number(match[4]), tile: Number(match[5]) })))
        .toEqual(payload.strokes);
      expect(message).toContain("[선택지]"); // 배운 내용 확인 칩.
    });

    it("붓질이 많으면 60개까지만 나열하고 총횟수를 남긴다", () => {
      const many: DemonstrationPayload = {
        ...payload,
        strokes: Array.from({ length: 75 }, (_, index) => ({ layer: "lower" as const, x: index % 3, y: 0, tile: 240 })),
      };
      const message = buildDemonstrationMessage(many);
      expect(message).toContain("60)");
      expect(message).not.toContain("61)");
      expect(message).toContain("총 75회");
    });
  });
  describe("demoTeachCanvas 모달", () => {
    it("칠하면 붓질이 기록되고, 보내기 콜백이 최종 상태를 담는다", () => {
      const onSend = vi.fn();
      const modal = openDemoTeachModal({ seed: null, onSend }) as unknown as FakeElement;

      // 기본 붓은 잔디/하위 — (0,0)과 (1,0)을 칠한다.
      (findByTestId(modal, "demo-teach-cell-0-0") as unknown as HTMLElement).click();
      (findByTestId(modal, "demo-teach-cell-1-0") as unknown as HTMLElement).click();
      expect((findByTestId(modal, "demo-teach-count") as unknown as HTMLElement).textContent).toContain("2회");

      // 실행취소 한 번 → 1회.
      (findByTestId(modal, "demo-teach-undo") as unknown as HTMLElement).click();
      expect((findByTestId(modal, "demo-teach-count") as unknown as HTMLElement).textContent).toContain("1회");

      const explanation = findByTestId(modal, "demo-teach-explanation") as unknown as HTMLTextAreaElement;
      explanation.value = "잔디 시연";
      explanation.dispatchEvent(new Event("input"));

      (findByTestId(modal, "demo-teach-send") as unknown as HTMLElement).click();
      expect(onSend).toHaveBeenCalledTimes(1);
      const payload = onSend.mock.calls[0][0] as DemonstrationPayload;
      expect(payload.strokes).toHaveLength(1);
      expect(payload.strokes[0]).toEqual({ layer: "lower", x: 0, y: 0, tile: TILE.GRASS });
      expect(payload.explanation).toBe("잔디 시연");
      expect(payload.seed).toBeNull();
      expect(payload.lower[0][0]).toBe(TILE.GRASS);
    });

    it("붓질 없이 보내기는 거부한다(빈 시연 방지)", () => {
      const onSend = vi.fn();
      const modal = openDemoTeachModal({ seed: null, onSend }) as unknown as FakeElement;
      (findByTestId(modal, "demo-teach-send") as unknown as HTMLElement).click();
      expect(onSend).not.toHaveBeenCalled();
    });

    it("상위 지우개를 고르면 레이어가 상위로 바뀌고 -1 붓질이 기록된다", () => {
      const onSend = vi.fn();
      const modal = openDemoTeachModal({ seed: null, onSend }) as unknown as FakeElement;
      (findByTestId(modal, "demo-teach-eraser") as unknown as HTMLElement).click();
      (findByTestId(modal, "demo-teach-cell-2-1") as unknown as HTMLElement).click();
      (findByTestId(modal, "demo-teach-send") as unknown as HTMLElement).click();
      const payload = onSend.mock.calls[0][0] as DemonstrationPayload;
      expect(payload.strokes[0]).toEqual({ layer: "upper", x: 2, y: 1, tile: -1 });
    });
  });
});

describe("editorCanvasToolbarBasicZoom", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  function asFake(node: HTMLElement): FakeElement {
    if (node instanceof FakeElement) return node;
    throw new Error("expected FakeElement");
  }
  function render(): FakeElement {
    const host = document.createElement("div") as unknown as HTMLElement;
    renderCanvasToolbar(host);
    return asFake(host);
  }
  function ids(fake: FakeElement): string[] {
    return Array.from(fake.children as unknown as FakeElement[], (child) => child.dataset.testid ?? child.className);
  }
  beforeEach(() => {
    restoreDom = installFakeDom();
    resetCanvasToolPillForTests();
    const project = createBlankProject();
    store.replace(project);
    resetMapEditHistory();
    editorState.set({ currentMapId: project.startMapId, layer: "lower", paintShape: "pen", tool: "paint", zoom: 2 });
  });
  afterEach(() => {
    resetCanvasToolPillForTests();
    restoreDom?.();
    restoreDom = null;
  });
  describe("canvas tool pill", () => {
    it("keeps canvas tools, history, zoom and the contextual small task together", () => {
      const fake = render();
      expect(fake.classList.contains("canvas-tool-pill")).toBe(true);
      expect(ids(fake)).toEqual([
        "tool-paint",
        "tool-select",
        "tool-fill",
        "canvas-tool-pill-divider",
        "canvas-tool-undo",
        "editor-zoom-group",
        "small-task-open",
      ]);
      for (const gone of [
        "editor-canvas-toolbar-expand",
        "canvas-ai-workbench",
        "walk-encounter-list-open",
        "map-location-layer-toggle",
        "map-background-preview-toggle",
        "editor-grid-toggle",
        "editor-map-screenshot-button",
        "tool-rect",
        "tool-pan",
      ]) {
        expect(fake.querySelector(`[data-testid="${gone}"]`), gone).toBeNull();
      }
    });

    it("shows zoom as a percentage and keeps every editor-zoom-* level behind it", () => {
      const fake = render();
      const stepper = fake.querySelector('[data-testid="editor-zoom-stepper"]');
      expect(stepper?.textContent).toBe("200%");
      for (const z of [0.25, 0.5, 1, 2, 3, 4, 6, 8]) {
        expect(fake.querySelector(`[data-testid="editor-zoom-${z}"]`), String(z)).toBeTruthy();
      }
      (fake.querySelector('[data-testid="editor-zoom-4"]') as FakeElement).click();
      expect(editorState.get().zoom).toBe(4);
    });

    it("drives the shared tool state and reflects it as the pressed button", () => {
      let fake = render();
      (fake.querySelector('[data-testid="tool-select"]') as FakeElement).click();
      expect(editorState.get()).toMatchObject({ tool: "select" });
      fake = render();
      expect(fake.querySelector('[data-testid="tool-select"]')?.getAttribute("aria-pressed")).toBe("true");
      expect(fake.querySelector('[data-testid="tool-select"]')?.getAttribute("aria-label")).toBe("영역 선택");
      expect(fake.querySelector('[data-testid="tool-paint"]')?.getAttribute("aria-pressed")).toBe("false");
      (fake.querySelector('[data-testid="tool-fill"]') as FakeElement).click();
      expect(editorState.get().tool).toBe("fill");
    });

    it("disables undo while the history stack is empty", () => {
      const fake = render();
      const undo = fake.querySelector('[data-testid="canvas-tool-undo"]') as FakeElement | null;
      expect(undo?.disabled).toBe(true);
    });

    it("drops the tile tools on the event layer but keeps region select, undo and zoom", () => {
      editorState.set({ layer: "event", tool: "event" });
      const fake = render();
      expect(fake.querySelector('[data-testid="tool-paint"]')).toBeNull();
      expect(fake.querySelector('[data-testid="tool-fill"]')).toBeNull();
      expect(fake.querySelector('[data-testid="tool-select"]')).toBeTruthy();
      expect(fake.querySelector('[data-testid="canvas-tool-undo"]')).toBeTruthy();
      expect(fake.querySelector('[data-testid="editor-zoom-stepper"]')).toBeTruthy();
    });

    it("shows only region select on the terrain (relief) tool", () => {
      editorState.set({ layer: "lower", tool: "relief" });
      const fake = render();
      expect(fake.querySelector('[data-testid="tool-paint"]')).toBeNull();
      expect(fake.querySelector('[data-testid="tool-fill"]')).toBeNull();
      expect(fake.querySelector('[data-testid="tool-select"]')).toBeTruthy();
    });
  });
});

describe("editorGameSuspension", () => {
  isolateTimers();
  const modeHarness = { game: null as unknown };
  function fakeGame(): {
    loop: { running: boolean; sleep: ReturnType<typeof vi.fn>; wake: ReturnType<typeof vi.fn> };
    input: { keyboard: { enabled: boolean } };
    scale: { refresh: ReturnType<typeof vi.fn> };
  } {
    const game = {
      loop: {
        running: true,
        sleep: vi.fn(() => {
          game.loop.running = false;
        }),
        wake: vi.fn(() => {
          game.loop.running = true;
        }),
      },
      input: { keyboard: { enabled: true } },
      scale: { refresh: vi.fn() },
    };
    return game;
  }
  describe("editorGameSuspension", () => {
    beforeEach(() => {
      _resetEditorGameSuspensionForTest();
      modeHarness.game = null;
      configureEditorGameAccessor(() => modeHarness.game);
    });

    it("테스트 플레이 창이 열리면 편집기 게임 루프를 멈추고 키보드 매니저를 끈다", () => {
      const game = fakeGame();
      modeHarness.game = game;
      suspendEditorGame();
      expect(game.loop.sleep).toHaveBeenCalledTimes(1);
      expect(game.loop.running).toBe(false);
      expect(game.input.keyboard.enabled).toBe(false);
      expect(isEditorGameSuspended()).toBe(true);
    });

    it("창을 닫으면 루프를 이어서 깨우고(seamless) 키보드·크기를 되살린다", () => {
      const game = fakeGame();
      modeHarness.game = game;
      suspendEditorGame();
      resumeEditorGame();
      expect(game.loop.wake).toHaveBeenCalledWith(true);
      expect(game.loop.running).toBe(true);
      expect(game.input.keyboard.enabled).toBe(true);
      expect(game.scale.refresh).toHaveBeenCalledTimes(1);
      expect(isEditorGameSuspended()).toBe(false);
    });

    it("두 번 열어도 한 번만 잠재우고, 잠재운 적 없으면 닫기는 아무 일도 하지 않는다", () => {
      const game = fakeGame();
      modeHarness.game = game;
      resumeEditorGame();
      expect(game.loop.wake).not.toHaveBeenCalled();
      suspendEditorGame();
      suspendEditorGame();
      expect(game.loop.sleep).toHaveBeenCalledTimes(1);
    });

    it("편집기 게임이 없으면(플레이 전용 셸·접근자 미주입) 조용히 지나간다", () => {
      _resetEditorGameSuspensionForTest();
      expect(() => suspendEditorGame()).not.toThrow();
      expect(isEditorGameSuspended()).toBe(false);
      expect(() => resumeEditorGame()).not.toThrow();
    });

    it("잠든 사이 파괴된 게임(isRunning=false)은 깨우지 않는다", () => {
      const game = fakeGame() as ReturnType<typeof fakeGame> & { isRunning?: boolean };
      modeHarness.game = game;
      suspendEditorGame();
      game.isRunning = false;
      resumeEditorGame();
      expect(game.loop.wake).not.toHaveBeenCalled();
      expect(game.scale.refresh).not.toHaveBeenCalled();
      expect(isEditorGameSuspended()).toBe(false);
    });

    it("이미 꺼져 있던 키보드는 닫은 뒤에도 꺼진 채로 둔다", () => {
      const game = fakeGame();
      game.input.keyboard.enabled = false;
      modeHarness.game = game;
      suspendEditorGame();
      resumeEditorGame();
      expect(game.input.keyboard.enabled).toBe(false);
    });
  });
});

describe("editorModalDirtyState", () => {
  isolateTimers();
  type DirtyCloseHarness = {
    readonly backdrop: FakeElement;
    readonly cancelButton: FakeElement;
    readonly closeButton: FakeElement;
    readonly calls: readonly string[];
    readonly decisions: readonly EditorModalCloseAttempt[];
    readonly setDirty: (dirty: boolean) => void;
    readonly setDecision: (decision: EditorModalDirtyDecision) => void;
  };
  function createHarness(): DirtyCloseHarness {
    let dirty = false;
    let decision: EditorModalDirtyDecision = EDITOR_MODAL_DIRTY_DECISION.KeepEditing;
    const calls: string[] = [];
    const decisions: EditorModalCloseAttempt[] = [];
    const backdrop = new FakeElement("div");
    const cancelButton = new FakeElement("button");
    const closeButton = new FakeElement("button");
    const controller = createEditorModalDirtyCloseController({
      isDirty: () => dirty,
      promptUnsavedChanges: (attempt) => {
        decisions.push(attempt);
        return decision;
      },
      save: () => calls.push("save"),
      discard: () => calls.push("discard"),
      close: () => calls.push("close"),
    });
    controller.bindCancelButton(cancelButton);
    controller.bindCloseButton(closeButton);
    backdrop.addEventListener("mousedown", (event) => controller.handleBackdropMouseDown(event, backdrop));
    backdrop.addEventListener("keydown", controller.handleKeyDown);
    return {
      backdrop,
      cancelButton,
      closeButton,
      calls,
      decisions,
      setDirty: (nextDirty) => {
        dirty = nextDirty;
      },
      setDecision: (nextDecision) => {
        decision = nextDecision;
      },
    };
  }
  function eventWithTarget(type: string, target: object): Event {
    const event = new Event(type);
    Object.defineProperty(event, "target", { configurable: true, value: target });
    return event;
  }
  function escapeKeyDown(): Event {
    const event = new Event("keydown");
    Object.defineProperty(event, "key", { configurable: true, value: "Escape" });
    return event;
  }
  describe("editor modal dirty close controller", () => {
    let restoreDom: () => void;

    beforeEach(() => {
      restoreDom = installFakeDom();
    });

    afterEach(() => {
      restoreDom();
      vi.restoreAllMocks();
    });

    it("closes immediately without prompting when the modal is clean", () => {
      const harness = createHarness();

      harness.cancelButton.dispatchEvent(new Event("click"));

      expect(harness.calls).toEqual(["close"]);
      expect(harness.decisions).toEqual([]);
    });

    it("saves and closes when a dirty cancel attempt chooses Save", () => {
      const harness = createHarness();
      harness.setDirty(true);
      harness.setDecision(EDITOR_MODAL_DIRTY_DECISION.Save);

      harness.cancelButton.dispatchEvent(new Event("click"));

      expect(harness.decisions).toEqual(["cancel"]);
      expect(harness.calls).toEqual(["save", "close"]);
    });

    it("discards and closes when a dirty Escape attempt chooses Discard", () => {
      const harness = createHarness();
      harness.setDirty(true);
      harness.setDecision(EDITOR_MODAL_DIRTY_DECISION.Discard);

      harness.backdrop.dispatchEvent(escapeKeyDown());

      expect(harness.decisions).toEqual(["escape"]);
      expect(harness.calls).toEqual(["discard", "close"]);
    });

    it("keeps editing when a dirty backdrop attempt chooses Keep Editing", () => {
      const harness = createHarness();
      harness.setDirty(true);
      harness.setDecision(EDITOR_MODAL_DIRTY_DECISION.KeepEditing);

      harness.backdrop.dispatchEvent(eventWithTarget("mousedown", harness.backdrop));

      expect(harness.decisions).toEqual(["backdrop"]);
      expect(harness.calls).toEqual([]);
    });

    it("does not prompt when backdrop mousedown starts inside the dialog window", () => {
      const harness = createHarness();
      const windowEl = new FakeElement("section");
      harness.setDirty(true);
      harness.backdrop.append(windowEl);

      harness.backdrop.dispatchEvent(eventWithTarget("mousedown", windowEl));

      expect(harness.decisions).toEqual([]);
      expect(harness.calls).toEqual([]);
    });

    it("uses the same dirty prompt path for the X close button", () => {
      const harness = createHarness();
      harness.setDirty(true);
      harness.setDecision(EDITOR_MODAL_DIRTY_DECISION.Discard);

      harness.closeButton.dispatchEvent(new Event("click"));

      expect(harness.decisions).toEqual(["x"]);
      expect(harness.calls).toEqual(["discard", "close"]);
    });
  });
});

describe("equipmentSlotHistory", () => {
  isolateTimers();
  let restoreDom: () => void;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  afterEach(() => {
    resetMapEditHistory();
    restoreDom();
  });
  function control(root: FakeElement, id: string): FakeElement {
    const found = findByTestId(root, id);
    if (!found) throw new Error(`Missing control: ${id}`);
    return found;
  }
  describe("equipment slot authoring history", () => {
    it.each(["add", "rename", "remove"])("undoes the complete %s operation", (operation) => {
      // Given an unused custom slot and the selected equipment's original assignment.
      store.update((project) => {
        project.database.equipmentSlots = [{ id: "slot_boots", label: "Boots" }];
      });
      const before = structuredClone(store.getCurrent().database);
      const equipmentId = before.equipment[0]!.id;
      const manager = equipmentSlotManager(equipmentId, () => undefined) as unknown as FakeElement;

      // When one catalog operation is performed through its real editor control.
      switch (operation) {
        case "add":
          control(manager, "db-equipment-slot-new-label").value = "Cloak";
          control(manager, "db-equipment-slot-add").click();
          break;
        case "rename": {
          const input = control(manager, "db-equipment-slot-label-slot_boots");
          input.value = "Greaves";
          input.dispatchEvent(new Event("change"));
          break;
        }
        case "remove":
          control(manager, "db-equipment-slot-remove-slot_boots").click();
          break;
      }

      // Then undo restores both the catalog and the selected equipment atomically.
      expect(store.getCurrent().database).not.toEqual(before);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().database).toEqual(before);
    });
  });
});
