import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addDatabaseRecord, deleteDatabaseRecord } from "@/editor/databaseActions";
import { refreshDatabasePanel, renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { setViewModeForCollection, setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, FakeNode } from "./fakeDom";
import { renderTerrainTab } from "@/editor/panels/databaseUtilityRecordViews";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderSwitchesTab, renderTermsTab, renderVariablesTab } from "@/editor/panels/databaseUtilityViews";
import { DATABASE_FOOTER_ACTION_TEST_IDS } from "@/editor/panels/databaseWorkbench";
import { isolateTimers } from "./mergedTeardown";

describe("databaseRecordPartialRender", () => {
  isolateTimers();
  type FakeBrowserGlobals = {
    readonly Image: typeof globalThis.Image | undefined;
    readonly window: typeof globalThis.window | undefined;
    readonly requestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
  };
  let restoreDom: (() => void) | undefined;
  let previousBrowserGlobals: FakeBrowserGlobals;
  beforeEach(() => {
    restoreDom = installFakeDom();
    previousBrowserGlobals = {
      Image: globalThis.Image,
      requestAnimationFrame: globalThis.requestAnimationFrame,
      window: globalThis.window,
    };
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: class {
        addEventListener(): void {}
        set src(_value: string) {}
      },
    });
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
    setDatabaseActiveTab("terms");
    resetDatabaseRecordViewSession();
    // 스킬 탭은 갤러리 기본값이지만 이 테스트는 리스트 행 부분 렌더 계약을 검증한다 — 명시적으로 list.
    setViewModeForCollection("skills", "list");
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
    restoreBrowserGlobal("window", previousBrowserGlobals.window);
    restoreBrowserGlobal("Image", previousBrowserGlobals.Image);
    restoreBrowserGlobal("requestAnimationFrame", previousBrowserGlobals.requestAnimationFrame);
  });
  describe("Database record tab partial rendering", () => {
    it("Given the actors collection When the record tab renders Then it uses the studio table and contextual inspector contract", () => {
      // Break caught: actors still render as the old narrow roster beside a card-heavy form.
      const host = renderRecordHost("actors");

      expect(findByTestId(host, "db-actor-studio")).not.toBeNull();
      expect(findByTestId(host, "db-actor-studio")?.textContent).toContain("주인공");
      expect(findByTestId(host, "db-actor-studio-summary")).toBeNull();
      expect(findByTestId(host, "db-actor-table-header")?.textContent).toContain("캐릭터");
      // 75f5319ace: 직업은 목록 열이 아니라 행 부제·인스펙터가 말한다 — 표 머리는 캐릭터 열(+값이 갈리는 선택 열)만 갖는다.
      expect(findByTestId(host, "db-actor-table-header")?.textContent).not.toContain("직업");
      // 레벨·HP·맵 표시 열은 주인공마다 값이 다를 때만 선다(visibleActorColumns — databasePartySimplify.test.ts).
      expect(host.querySelector(".db-studio-table-pane")).not.toBeNull();
      expect(host.querySelector(".db-studio-inspector-pane")).not.toBeNull();

      const actorId = store.getCurrent().database.actors[0]?.id ?? "";
      expect(findByTestId(host, `db-record-row-${actorId}`)).not.toBeNull();
      expect(findByTestId(host, "db-detail-form")).not.toBeNull();
      // 얼굴 한 칸 = 파일 한 장 — 히어로 헤더는 시트 크롭이 아니라 그림 한 장을 그린다.
      expect(findByTestId(host, "db-record-hero")?.querySelector(".actor-face-image")).not.toBeNull();
      expect(findByTestId(host, "db-record-hero")?.querySelector(".actor-sheet-crop")).toBeNull();
    });

    it("Given an actor opens When the inspector renders Then hierarchy is expressed by direct tabs without guidance copy", () => {
      // Break caught: a tutorial card and numbered long-form document explain hierarchy instead of embodying it.
      const host = renderRecordHost("actors");

      expect(findByTestId(host, "db-actor-beginner-guide")).toBeNull();
      expect(host.querySelector(".actor-task-next")).toBeNull();
      expect(findByTestId(host, "db-actor-section-tabs")?.textContent).toBe("기본외형성장전투결과");
      expect(findByTestId(host, "db-actor-tab-identity")?.attrs["aria-selected"]).toBe("true");
      expect(findByTestId(host, "db-actor-panel-identity")?.hidden).toBe(false);
      expect(findByTestId(host, "db-actor-panel-appearance")?.hidden).toBe(true);
      expect(findByTestId(host, "db-record-hero")?.textContent).toContain("시작 파티");

      findByTestId(host, "db-actor-tab-battle")?.click();
      expect(findByTestId(host, "db-actor-tab-identity")?.attrs["aria-selected"]).toBe("false");
      expect(findByTestId(host, "db-actor-tab-battle")?.attrs["aria-selected"]).toBe("true");
      expect(findByTestId(host, "db-actor-panel-identity")?.hidden).toBe(true);
      expect(findByTestId(host, "db-actor-panel-battle")?.hidden).toBe(false);
      expect(findByTestId(host, "db-actor-panel-battle")?.textContent).toContain("크리티컬 공격");
    });

    it("Given the actors gallery preference When the tab renders Then it preserves the existing card gallery", () => {
      setViewModeForCollection("actors", "gallery");
      const host = renderRecordHost("actors");

      expect(findByTestId(host, "db-actor-studio")).toBeNull();
      const actorId = store.getCurrent().database.actors[0]?.id ?? "";
      expect(findByTestId(host, `db-record-card-${actorId}`)).not.toBeNull();
    });

    it("Given a record selection When another record row is clicked Then the list is not rebuilt and only the active row changes", () => {
      // 목록은 기본으로 「이 게임 것만」이라(#5026) 새 레코드가 생기면 기본 카탈로그 행은 가려진다 — 두 행 모두 더한 것으로 잰다.
      const firstId = addDatabaseRecord("skills");
      const secondId = addDatabaseRecord("skills");
      const host = renderRecordHost("skills");

      const firstRowBefore = findByTestId(host, `db-record-row-${firstId}`);
      const secondRowBefore = findByTestId(host, `db-record-row-${secondId}`);
      expect(firstRowBefore).not.toBeNull();
      expect(secondRowBefore).not.toBeNull();

      secondRowBefore?.click();

      // 리스트 행 노드는 재생성되지 않고 그대로 유지되어야 한다(스크롤/포커스 보존의 근거).
      expect(findByTestId(host, `db-record-row-${firstId}`)).toBe(firstRowBefore);
      expect(findByTestId(host, `db-record-row-${secondId}`)).toBe(secondRowBefore);
      // 활성 표시는 클릭한 행으로만 이동한다.
      expect(secondRowBefore?.attrs["aria-pressed"]).toBe("true");
      expect(firstRowBefore?.attrs["aria-pressed"]).toBe("false");
      // 디테일 폼은 선택한 레코드로 교체된다.
      expect(nameInputValue(host)).toBe(store.getCurrent().database.skills.find((entry) => entry.id === secondId)?.name);
    });

    it("Given a name field edit When the value changes Then the list row label updates without rebuilding the detail form", () => {
      const skillId = store.getCurrent().database.skills[0]?.id ?? "";
      const host = renderRecordHost("skills");

      const detailFormBefore = findByTestId(host, "db-detail-form");
      const nameInput = findByTestId(host, "db-field-name");
      expect(detailFormBefore).not.toBeNull();
      expect(nameInput).not.toBeNull();

      nameInput!.value = "번개 강타";
      nameInput!.dispatchEvent(new Event("input"));

      // 리스트 행 라벨이 즉시 갱신된다.
      const row = findByTestId(host, `db-record-row-${skillId}`);
      expect(row?.querySelector(".db-list-name")?.textContent).toBe("번개 강타");
      expect(row?.dataset.recordName).toBe("번개 강타");
      // 스토어에도 반영된다.
      expect(store.getCurrent().database.skills.find((entry) => entry.id === skillId)?.name).toBe("번개 강타");
      // 디테일 폼 노드는 재생성되지 않아 입력 포커스가 유지된다.
      expect(findByTestId(host, "db-detail-form")).toBe(detailFormBefore);
    });

    it("Given an actor name edit When the inspector changes Then the studio row updates without rebuilding", () => {
      setViewModeForCollection("actors", "list");
      const actorId = store.getCurrent().database.actors[0]?.id ?? "";
      const host = renderRecordHost("actors");
      const detailFormBefore = findByTestId(host, "db-detail-form");
      const nameInput = findByTestId(host, "db-field-name");

      nameInput!.value = "새 주인공 이름";
      nameInput!.dispatchEvent(new Event("input"));

      const row = findByTestId(host, `db-record-row-${actorId}`);
      expect(row?.querySelector(".db-list-name")?.textContent).toBe("새 주인공 이름");
      expect(store.getCurrent().database.actors[0]?.name).toBe("새 주인공 이름");
      expect(findByTestId(host, "db-detail-form")).toBe(detailFormBefore);
    });

    it("Given a scrolled record list When the tab is re-rendered Then the scroll position is restored", () => {
      const firstHost = renderRecordHost("skills");
      const listBefore = firstHost.querySelector(".db-list");
      expect(listBefore).not.toBeNull();

      (listBefore as unknown as { scrollTop: number }).scrollTop = 144;
      listBefore!.dispatchEvent(new Event("scroll"));

      const secondHost = renderRecordHost("skills");
      const listAfter = secondHost.querySelector(".db-list");
      expect((listAfter as unknown as { scrollTop: number }).scrollTop).toBe(144);
    });
  });
  describe("Database panel partial refresh (undo/redo path)", () => {
    it("Given a mounted panel When refreshDatabasePanel runs Then the tab scaffold is preserved and only the body re-renders", () => {
      const container = document.createElement("div") as unknown as FakeElement;
      renderDatabasePanel(container as unknown as HTMLElement);
      const headerBefore = container.querySelector(".db-tabs");
      const bodyBefore = container.querySelector(".db-body");
      expect(headerBefore).not.toBeNull();
      expect(bodyBefore).not.toBeNull();

      refreshDatabasePanel(container as unknown as HTMLElement);

      // 헤더 스캐폴드는 동일 인스턴스로 유지되고 본문만 다시 그려진다.
      expect(container.querySelector(".db-tabs")).toBe(headerBefore);
      expect(container.querySelector(".db-body")).toBe(bodyBefore);
      expect(container.querySelectorAll(".db-tabs").length).toBe(1);
      expect(bodyBefore?.childNodes.length).toBeGreaterThan(0);
    });
  });
  describe("Database tab render cache", () => {
    it("Given an unchanged project When a previously visited tab is reopened Then its rendered view is reused", () => {
      // Break caught: sidebar tab clicks discard a complete tab view and rebuild its list, thumbnails, and form.
      setDatabaseActiveTab("terms");
      const container = document.createElement("div") as unknown as FakeElement;
      renderDatabasePanel(container as unknown as HTMLElement);
      const termsViewBefore = container.querySelector(".db-body")?.firstChild;

      findByTestId(container, "db-tab-variables")?.click();
      findByTestId(container, "db-tab-terms")?.click();

      expect(container.querySelector(".db-body")?.firstChild).toBe(termsViewBefore);
    });

    it("Given a cached tab When project data changes Then reopening the tab renders fresh data", () => {
      // Break caught: a tab cache survives a project mutation and shows stale record data.
      setDatabaseActiveTab("terms");
      const container = document.createElement("div") as unknown as FakeElement;
      renderDatabasePanel(container as unknown as HTMLElement);
      const termsViewBefore = container.querySelector(".db-body")?.firstChild;

      findByTestId(container, "db-tab-variables")?.click();
      store.update((project) => {
        project.meta.terms.gold = "Cache invalidated gold";
      }, { scope: "database", collection: "terms" });
      findByTestId(container, "db-tab-terms")?.click();

      expect(container.querySelector(".db-body")?.firstChild).not.toBe(termsViewBefore);
      expect(findByTestId(container, "db-field-gold")?.value).toBe("Cache invalidated gold");
    });
  });
  function renderRecordHost(collection: Parameters<typeof renderRecordTab>[1]): FakeElement {
    const host = document.createElement("div");
    renderRecordTab(host, collection, () => undefined);
    if (host instanceof FakeElement) return host;
    throw new Error("Expected fake database host");
  }
  function nameInputValue(host: FakeElement): string | undefined {
    return findByTestId(host, "db-field-name")?.value;
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
  function restoreBrowserGlobal(name: keyof FakeBrowserGlobals, value: FakeBrowserGlobals[typeof name]): void {
    if (value === undefined) {
      Reflect.deleteProperty(globalThis, name);
      return;
    }
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
});

describe("databaseTerrainTab", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  describe("terrain tab copy and pickers", () => {
    it("drops RM2003 path copy and keeps backdrop/footstep field testids with pickers", () => {
      const host = document.createElement("div") as unknown as FakeElement;
      renderTerrainTab(host as unknown as HTMLElement);
      const form = findByTestId(host, "db-detail-form");
      if (!form) throw new Error("missing terrain form");

      expect(form.textContent).not.toContain("RM2003");
      expect(form.textContent).not.toContain("database.terrains");
      expect(findByTestId(form, "db-field-terrain-backdrop-0")).not.toBeNull();
      expect(findByTestId(form, "db-field-terrain-footstep-0")).not.toBeNull();
      expect(findByTestId(form, "db-field-terrain-backdrop-0-set")).not.toBeNull();
      expect(findByTestId(form, "db-field-terrain-footstep-0-set")).not.toBeNull();
      expect(form.querySelector(".db-resource-picker-inline-name")).not.toBeNull();
      expect(findByTestId(form, "db-field-terrain-backdrop-0")?.className).toContain("db-authoring-id");
    });
  });
});

describe("databaseUtilityViews", () => {
  isolateTimers();
  function namedSwitches(): { id: string; name: string }[] {
    return store.getCurrent().switches.filter((record) => record.name.trim().length > 0);
  }
  function namedVariables(): { id: string; name: string }[] {
    return store.getCurrent().variables.filter((record) => record.name.trim().length > 0);
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
  describe("database utility views", () => {
    let cleanupDom: (() => void) | undefined;

    beforeEach(() => {
      cleanupDom = installFakeDom();
      stubWindowTimers();
      store.replace(createBlankProject());
      resetMapEditHistory();
    });

    afterEach(() => {
      cleanupDom?.();
      cleanupDom = undefined;
      restoreWindow();
    });

    it("switch add button creates the next numbered switch and focuses name input", () => {
      const host = renderUtility(renderSwitchesTab);
      // #777: 기본 카탈로그의 기동석 아이템이 스위치를 선언하므로 빈 프로젝트도 목록이 비지 않는다.
      // 이 테스트가 보는 것은 "개수 슬롯 추가/포커스" 흐름이다.
      expect(store.getCurrent().switches.some((entry) => entry.name.trim().length > 0)).toBe(true);
      expect(host.querySelectorAll(".db-empty-row")).toHaveLength(0);

      findByTestId(host, "db-add-switch")?.click();
      const input = findByTestId(host, "db-utility-selected-name");
      if (!input) throw new Error("missing selected switch input");
      input.value = "문 열림";
      input.dispatchEvent(new Event("input"));

      expect(namedSwitches()).toContainEqual({ id: "sw_0001", name: "문 열림" });
      expect(document.activeElement).toBe(input);
    });

    it("variable add button creates the next numbered variable and supports rename", () => {
      const host = renderUtility(renderVariablesTab);

      findByTestId(host, "db-add-variable")?.click();
      const input = findByTestId(host, "db-utility-selected-name");
      if (!input) throw new Error("missing selected variable input");
      input.value = "퍼즐 점수";
      input.dispatchEvent(new Event("input"));

      expect(namedVariables()).toEqual([{ id: "var_0001", name: "퍼즐 점수" }]);
      expect(document.activeElement).toBe(input);
    });

    // fix(db): 스위치/변수 삭제에 2단계 확인이 없었다(qa-system-report.md Minor) — 다른 DB
    // 탭과 동일하게 첫 클릭은 무장만 하고, 확인 창 안의 두 번째 클릭이 실제 삭제를 확정한다.
    it("row delete button requires a second click to confirm before removing the switch", () => {
      const host = renderUtility(renderSwitchesTab);
      findByTestId(host, "db-add-switch")?.click();

      const deleteButton = findByTestId(host, "db-delete-sw_0001");
      if (!deleteButton) throw new Error("missing delete button");

      deleteButton.click();
      expect(deleteButton.textContent).toBe("정말 삭제?");
      expect(namedSwitches()).toContainEqual({ id: "sw_0001", name: "새 스위치" });

      deleteButton.click();
      expect(namedSwitches().some((entry) => entry.id === "sw_0001")).toBe(false);
    });

    // fix(db): deleteSwitch/deleteVariable이 session.switches[id]/variables[id] 값을 정리하지
    // 않아, 삭제된 슬롯을 "+ 추가"로 재사용하면 이전 값(true)을 그대로 물려받는 위험이 있었다
    // (qa-system-report.md). ensureSwitchVariableSlots가 매 store.update마다 결측 세션 값을
    // 기본값으로 채워 넣으므로, 삭제 후 세션 값을 지우면 다음 update에서 기본값(false)으로
    // 리셋된다는 것을 검증한다.
    it("clears the stale runtime session value when a switch is deleted", () => {
      const host = renderUtility(renderSwitchesTab);
      findByTestId(host, "db-add-switch")?.click();
      store.update((project) => {
        project.session.switches.sw_0001 = true;
      });
      expect(store.getCurrent().session.switches.sw_0001).toBe(true);

      const deleteButton = findByTestId(host, "db-delete-sw_0001");
      deleteButton?.click();
      deleteButton?.click();

      expect(store.getCurrent().session.switches.sw_0001).toBe(false);
    });

    it("shows story flags in a read-only section instead of decorating switch rows", () => {
      store.update((project) => {
        const first = project.switches.find((record) => record.id === "sw_0001");
        if (!first) throw new Error("missing sw_0001");
        first.name = "시장 만남";
        project.storyFlags = [{
          id: "met-mayor",
          kind: "switch",
          targetId: "sw_0001",
          description: "촌장을 만남",
        }];
      });

      const host = renderUtility(renderSwitchesTab);
      const row = host.querySelector(".db-utility-row");
      const storyFlags = host.querySelector(".db-story-flag-list");

      expect(row?.textContent).toContain("시장 만남");
      expect(row?.textContent).not.toContain("met-mayor");
      expect(storyFlags?.textContent).toContain("스토리 플래그 (읽기 전용)");
      expect(storyFlags?.textContent).toContain("met-mayor");
    });

    // fix(db): 스위치/변수 이름 입력란이 키 입력마다 recordProjectSnapshot(비-코얼레스)을
    // 부르는 renameSwitch/renameVariable을 직접 호출해, 5글자 타이핑을 되돌리려면 Ctrl+Z를
    // 5번 눌러야 했다(qa-system-report.md). terms 필드와 동일한 recordCoalescedSnapshot으로
    // 맞춰 키 입력 스트림 전체가 undo 1스텝으로 병합돼야 한다.
    it("coalesces keystroke-by-keystroke switch renames into a single undo snapshot", () => {
      const host = renderUtility(renderSwitchesTab);
      findByTestId(host, "db-add-switch")?.click();
      resetMapEditHistory(); // isolate the rename snapshot count from the add snapshot

      const input = findByTestId(host, "db-utility-selected-name");
      if (!input) throw new Error("missing selected switch input");
      for (const next of ["H", "HE", "HEL", "HELL", "HELLO"]) {
        input.value = next;
        input.dispatchEvent(new Event("input"));
      }
      expect(namedSwitches()).toContainEqual({ id: "sw_0001", name: "HELLO" });

      const undone = undoMapEdit();
      expect(undone).toBe(true);
      // one snapshot for the whole keystroke stream — reverts straight back to the
      // pre-typing name ("새 스위치"), not one letter at a time.
      expect(namedSwitches()).toContainEqual({ id: "sw_0001", name: "새 스위치" });
      expect(getMapEditHistoryState().canUndo).toBe(false);
    });

    // fix(db): 용어 탭의 직행 store.update가 undo 스냅샷을 안 남겼다 — 다른 유틸리티 뷰
    // 필드는 Ctrl+Z가 되는데 용어만 안 되는 비일관 상태였다.
    it("records an undo snapshot when a term field changes, and undo restores the previous value", () => {
      expect(getMapEditHistoryState().canUndo).toBe(false);
      const host = renderUtility(renderTermsTab);
      const before = store.getCurrent().meta.terms.skill;

      const skillTerm = findByTestId(host, "db-field-skill-term");
      if (!skillTerm) throw new Error("missing skill term field");
      skillTerm.value = "Arts";
      skillTerm.dispatchEvent(new Event("input"));

      expect(store.getCurrent().meta.terms.skill).toBe("Arts");
      expect(getMapEditHistoryState().canUndo).toBe(true);

      const undone = undoMapEdit();

      expect(undone).toBe(true);
      expect(store.getCurrent().meta.terms.skill).toBe(before);
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
