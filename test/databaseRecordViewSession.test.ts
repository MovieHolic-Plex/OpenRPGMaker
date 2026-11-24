import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type DatabaseCollection, addDatabaseRecord, deleteDatabaseRecord } from "@/editor/databaseActions";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { setViewModeForCollection, searchQueryForCollection, setCategoryFilterForCollection, setShowsPresetRecords, setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { FakeElement, findByTestId, installFakeDom, FakeNode } from "./fakeDom";
import { DATABASE_FOOTER_ACTION_TEST_IDS } from "@/editor/panels/databaseWorkbench";
import { isolateTimers } from "./mergedTeardown";

describe("databaseGalleryView", () => {
  isolateTimers();
  // 갤러리 뷰 fakeDom 테스트 — 정적 import 를 쓴다(vi.resetModules + 동적 import 는 이
  // 머신에서 모듈 그래프 재평가에 ~9초가 걸려 기본 15초 타임아웃을 넘긴다). 세션 모듈은
  // import 시점(window 미정의)에 localStorage 기본값(gallery)을 읽으므로 items 탭은 항상
  // 갤러리 기본값으로 렌더된다.
  type ProjectStoreLike = {
    replace(project: ReturnType<typeof createBlankProject>): void;
    update(mutator: (project: ReturnType<typeof createBlankProject>) => void): void;
  };
  const GALLERY_FIXTURE_COUNT = 133;
  let restoreDom: (() => void) | undefined;
  let previousWindow: typeof globalThis.window | undefined;
  let storage: Storage;
  beforeEach(() => {
    restoreDom = installFakeDom();
    previousWindow = globalThis.window;
    storage = createFakeLocalStorage();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        clearTimeout,
        localStorage: storage,
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
    (store as unknown as ProjectStoreLike).replace(createBlankProject());
    resetDatabaseRecordViewSession();
    // 뷰 모드는 세션 리셋을 가로질러 지속되므로(설계) 각 테스트가 갤러리 기본값에서 시작하게
    // 명시적으로 되돌린다 — 앞선 토글 테스트가 items 를 list 로 바꿔도 뒤 테스트가 안 깨진다.
    setViewModeForCollection("items", "gallery");
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
    restoreBrowserGlobal("window", previousWindow);
    Reflect.deleteProperty(globalThis, "requestAnimationFrame");
  });
  describe("database gallery view", () => {
    it("renders cards by default for items and windows the grid so card count < total", () => {
      seedItems(GALLERY_FIXTURE_COUNT);
      const host = renderHost("items");

      // 갤러리 기본값: 카드가 렌더되고 리스트 행은 없다.
      const cards = host.querySelectorAll(".db-gallery-card");
      expect(cards.length).toBe(GALLERY_FIXTURE_COUNT);
      expect(host.querySelectorAll(".db-list-row")).toHaveLength(0);

      // 뷰포트 높이를 주면 가상화가 켜진다 — 렌더 카드 수 < 전체 레코드 수.
      const list = requireList(host);
      (list as unknown as { clientHeight: number }).clientHeight = 400;
      (list as unknown as { scrollTop: number }).scrollTop = 0;
      list.dispatchEvent(new Event("scroll"));
      const windowed = host.querySelectorAll(".db-gallery-card");
      expect(windowed.length).toBeGreaterThan(0);
      expect(windowed.length).toBeLessThan(GALLERY_FIXTURE_COUNT);
    });

    it("card testids follow db-record-card-<id> and carry recordId/recordName datasets", () => {
      seedItems(10);
      const host = renderHost("items");

      const cards = host.querySelectorAll(".db-gallery-card");
      expect(cards.length).toBe(10);
      for (const card of cards) {
        const id = card.dataset.recordId ?? "";
        expect(card.dataset.testid).toBe(`db-record-card-${id}`);
        expect(card.dataset.recordName).toBe(`아이템 ${id.slice(1)}`);
        expect(card.className).toContain("db-gallery-card");
        expect(card.tagName).toBe("BUTTON");
        expect(card.querySelector(".db-gallery-name")?.textContent).toBe(`아이템 ${id.slice(1)}`);
      }
    });

    it("cards show the category tag from existing record fields (items type / equipment slot)", () => {
      seedItems(5, { weaponCount: 3 });
      const host = renderHost("items");

      const weaponCards = host.querySelectorAll(".db-gallery-card").filter((card) => {
        const id = Number(card.dataset.recordId?.slice(1));
        return id >= 1 && id <= 3;
      });
      expect(weaponCards.length).toBe(3);
      for (const card of weaponCards) {
        expect(card.querySelector(".db-gallery-tag")?.textContent).toBe("무기");
      }
      const normalCards = host.querySelectorAll(".db-gallery-card").filter((card) => {
        const id = Number(card.dataset.recordId?.slice(1));
        return id > 3;
      });
      for (const card of normalCards) {
        expect(card.querySelector(".db-gallery-tag")?.textContent).toBe("일반 물품");
      }
    });

    it("clicking a card selects it (.active) and swaps the detail pane without rebuilding the list", () => {
      seedItems(20);
      const host = renderHost("items");
      const listElBefore = host.querySelector(".db-list");

      const card = findByTestId(host, "db-record-card-g5");
      if (!card) throw new Error("missing card g5");
      card.click();

      // 선택 카드만 active — 전체 리스트 재빌드 없이(같은 .db-list 노드) 디테일만 교체.
      // (fake DOM 은 복합 클래스 셀렉터를 지원하지 않으므로 필터로 확인한다.)
      const activeCards = host.querySelectorAll(".db-gallery-card").filter((card) => card.classList.contains("active"));
      expect(activeCards.map((card) => card.dataset.recordId)).toEqual(["g5"]);
      expect(host.querySelector(".db-list")).toBe(listElBefore);
      // 디테일 교체 검증: 디테일 팬(recordIdentity + 폼)에 선택한 레코드의 이름/ID가 보인다.
      // (recordIdentity 는 db-detail-form 섹션 밖 형제 노드라 팬 기준으로 확인한다.)
      const detailPane = host.querySelector(".db-detail-pane");
      expect(detailPane?.textContent).toContain("아이템 5");
      expect(detailPane?.textContent).toContain("g5");
    });

    it("search narrows the rendered cards", () => {
      seedItems(GALLERY_FIXTURE_COUNT);
      const host = renderHost("items");

      const search = host.querySelector(".db-search input");
      if (!(search instanceof FakeElement)) throw new Error("missing search input");
      search.value = "아이템 77";
      search.dispatchEvent(new Event("input"));

      const ids = cardIds(host);
      expect(ids).toEqual(["g77"]);
    });

    it("toggling to list mode re-renders db-list-row instead of cards", () => {
      seedItems(GALLERY_FIXTURE_COUNT);
      const host = renderHost("items");
      expect(host.querySelectorAll(".db-gallery-card").length).toBe(GALLERY_FIXTURE_COUNT);

      const listToggle = findByTestId(host, "db-view-toggle-list");
      if (!listToggle) throw new Error("missing list toggle");
      listToggle.click();

      expect(host.querySelectorAll(".db-gallery-card")).toHaveLength(0);
      expect(host.querySelectorAll(".db-list-row").length).toBe(GALLERY_FIXTURE_COUNT);
      expect(findByTestId(host, "db-record-row-g1")).not.toBeNull();
    });

    it("restores the gallery scroll position on remount", () => {
      seedItems(GALLERY_FIXTURE_COUNT);
      const host = renderHost("items");
      const list = requireList(host);
      (list as unknown as { clientHeight: number }).clientHeight = 400;
      (list as unknown as { scrollTop: number }).scrollTop = 500;
      list.dispatchEvent(new Event("scroll"));

      // 탭 전환 후 복귀 — 새 호스트에서 스크롤 위치가 복원된다.
      const freshHost = renderHost("items");
      const freshList = requireList(freshHost);
      expect(freshList.scrollTop).toBe(500);

      // 복원된 스크롤 위치에서 뷰포트 높이를 주면 윈도잉이 유지된다 (카드 수 < 전체).
      (freshList as unknown as { clientHeight: number }).clientHeight = 400;
      freshList.dispatchEvent(new Event("scroll"));
      expect(freshHost.querySelectorAll(".db-gallery-card").length).toBeLessThan(GALLERY_FIXTURE_COUNT);
    });

    it("derives columns from the modal window width (3 @<=1100px, 4 above)", () => {
      seedItems(GALLERY_FIXTURE_COUNT);
      const modal = document.createElement("div") as unknown as FakeElement;
      modal.className = "database-modal-window";
      (modal as unknown as { clientWidth: number }).clientWidth = 1024;

      const host = document.createElement("div") as unknown as FakeElement;
      modal.append(host);
      const rerender = (): void => {
        host.replaceChildren();
        renderRecordTab(host, "items", rerender);
      };
      rerender();
      expect(requireList(host).style.getPropertyValue("--db-gallery-columns")).toBe("3");

      // 모달 폭이 1100px 을 넘으면 열 수가 4 로 갱신된다 (scroll 이벤트가 render() 를 연결).
      (modal as unknown as { clientWidth: number }).clientWidth = 1280;
      const list = requireList(host);
      list.dispatchEvent(new Event("scroll"));
      expect(list.style.getPropertyValue("--db-gallery-columns")).toBe("4");
    });

    it("empty collection renders an empty gallery without crashing", () => {
      (store as unknown as ProjectStoreLike).update((project) => {
        project.database.items = [];
      });
      const host = renderHost("items");
      expect(host.querySelectorAll(".db-gallery-card")).toHaveLength(0);
      expect(host.querySelector(".db-list")).not.toBeNull();
      expect(host.textContent).toContain("0개");
    });
  });
  // 시드 픽스처: 기본 normalGoods + 앞쪽 weaponCount 개는 weapon 타입(태그 검증용).
  // 리소스 미지정이라 썸네일은 빈 슬롯 — fake DOM 에서 이미지 로딩/크로마키 경로를 피한다.
  function seedItems(count: number, options: { readonly weaponCount?: number } = {}): void {
    const weaponCount = options.weaponCount ?? 0;
    (store as unknown as ProjectStoreLike).update((project) => {
      project.database.items = Array.from({ length: count }, (_, index) => {
        const number = index + 1;
        return normalizeItemRecord({
          id: `g${number}`,
          name: `아이템 ${number}`,
          type: number <= weaponCount ? "weapon" : "normalGoods",
        });
      });
    });
  }
  function renderHost(collection: DatabaseCollection): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      renderRecordTab(host, collection, rerender);
    };
    rerender();
    return host;
  }
  function requireList(host: FakeElement): FakeElement {
    const list = host.querySelector(".db-list");
    if (list instanceof FakeElement) return list;
    throw new Error("missing .db-list container");
  }
  function cardIds(host: FakeElement): string[] {
    return host.querySelectorAll(".db-gallery-card").map((card) => card.dataset.recordId ?? "");
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
  function restoreBrowserGlobal(name: "window", value: typeof globalThis.window | undefined): void {
    if (value === undefined) {
      Reflect.deleteProperty(globalThis, name);
      return;
    }
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
});

describe("databaseRecordSearch", () => {
  isolateTimers();
  // 목록 검색은 80ms 뒤에 탭을 다시 그린다. 타이머를 즉시 돌리면, 그 사이에 옮긴 커서와
  // 조합 중인 음절을 구분할 수 없다.
  type PendingTimer = { id: number; run: () => void };
  let restoreDom: (() => void) | undefined;
  let previousWindow: typeof globalThis.window | undefined;
  let storage: Storage;
  let timers: PendingTimer[] = [];
  let nextTimerId = 1;
  beforeEach(() => {
    restoreDom = installFakeDom();
    previousWindow = globalThis.window;
    storage = createFakeLocalStorage();
    timers = [];
    nextTimerId = 1;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: storage,
        setTimeout: (handler: TimerHandler): number => {
          const id = nextTimerId;
          nextTimerId += 1;
          if (typeof handler === "function") timers.push({ id, run: () => handler() });
          return id;
        },
        clearTimeout: (id: number): void => {
          timers = timers.filter((timer) => timer.id !== id);
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
    setViewModeForCollection("items", "list");
    setCategoryFilterForCollection("items", "all");
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
    restoreBrowserGlobal("window", previousWindow);
    Reflect.deleteProperty(globalThis, "requestAnimationFrame");
  });
  describe("database record scope — 이 게임 것만", () => {
    it("기본 프리셋 사이에 이 게임 레코드가 있으면 그것만 보이고, 개수 단추로 프리셋까지 펼친다", () => {
      setShowsPresetRecords("items", false);
      const presetCount = store.getCurrent().database.items.length;
      store.update((project) => {
        project.database.items = [...project.database.items, normalizeItemRecord({ id: "it_game_sword", name: "동검", type: "medicine" })];
      });
      const host = document.createElement("div") as unknown as FakeElement;
      document.body.append(host);
      const rerender = (): void => {
        host.replaceChildren();
        renderRecordTab(host, "items", rerender);
      };
      rerender();

      expect(visibleRecordIds(host)).toEqual(["it_game_sword"]);
      const scope = findByTestId(host, "db-record-scope");
      if (!(scope instanceof FakeElement)) throw new Error("missing scope toggle");
      expect(scope.textContent).toBe("이 게임 것 1개");
      expect(scope.dataset.scope).toBe("game");

      scope.click();
      const widened = findByTestId(host, "db-record-scope");
      if (!(widened instanceof FakeElement)) throw new Error("missing scope toggle");
      expect(widened.dataset.scope).toBe("all");
      expect(widened.textContent).toBe(`기본 포함 ${presetCount + 1}개`);
      expect(visibleRecordIds(host).length).toBeGreaterThan(1);
      setShowsPresetRecords("items", false);
    });

    it("기본 프리셋뿐이면 가리지 않고 단추도 없다", () => {
      const host = document.createElement("div") as unknown as FakeElement;
      document.body.append(host);
      renderRecordTab(host, "items", () => undefined);
      expect(findByTestId(host, "db-record-scope")).toBeFalsy();
      expect(visibleRecordIds(host).length).toBeGreaterThan(1);
    });
  });
  describe("database record search", () => {
    it("puts the caret back where it was when the list rebuilds", () => {
      const host = renderItems();
      const search = searchInput(host);
      search.value = "회복약";
      search.setSelectionRange(1, 1);
      search.dispatchEvent(new Event("input", { bubbles: true }));
      expect(searchInput(host)).toBe(search);
      expect(searchQueryForCollection("items")).toBe("");

      // 디바운스 안에 커서를 옮긴다. 예전의 구현은 첫 input 시점의 칸(1)으로 되돌렸다.
      search.setSelectionRange(2, 2);
      flushTimers();

      const next = searchInput(host);
      expect(next).not.toBe(search);
      expect(next.value).toBe("회복약");
      expect(next.selectionStart).toBe(2);
      expect(next.selectionEnd).toBe(2);
      expect(visibleRecordIds(host)).toEqual(["it_potion"]);
    });

    it("keeps the search field while an IME composition is in progress", () => {
      const host = renderItems();
      const search = searchInput(host);
      search.dispatchEvent(new Event("compositionstart"));
      search.value = "회";
      const composing = new Event("input", { bubbles: true });
      Object.defineProperty(composing, "isComposing", { value: true });
      search.dispatchEvent(composing);
      flushTimers();
      expect(searchInput(host)).toBe(search);
      expect(searchQueryForCollection("items")).toBe("");
      expect(visibleRecordIds(host)).toEqual(["it_potion", "it_ether"]);

      search.value = "회복";
      search.setSelectionRange(1, 1);
      search.dispatchEvent(new Event("compositionend", { bubbles: true }));
      const next = searchInput(host);
      expect(next).not.toBe(search);
      expect(next.value).toBe("회복");
      expect(next.selectionStart).toBe(1);
      expect(next.selectionEnd).toBe(1);
      expect(visibleRecordIds(host)).toEqual(["it_potion"]);

      // 조합이 끝난 칸에 같은 값의 input 이 한 번 더 와도 커서를 끝으로 밀지 않는다.
      search.setSelectionRange(search.value.length, search.value.length);
      search.dispatchEvent(new Event("input", { bubbles: true }));
      flushTimers();
      expect(searchInput(host).selectionStart).toBe(1);
      expect(searchInput(host).selectionEnd).toBe(1);
    });

    it("does not bake an in-progress syllable when the debounce fires during composition", () => {
      const host = renderItems();
      const search = searchInput(host);
      search.value = "회";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      search.dispatchEvent(new Event("compositionstart"));
      search.value = "회복";
      flushTimers();
      expect(searchInput(host)).toBe(search);
      expect(searchQueryForCollection("items")).toBe("");

      search.value = "회";
      search.setSelectionRange(1, 1);
      search.dispatchEvent(new Event("compositionend", { bubbles: true }));
      const next = searchInput(host);
      expect(next.value).toBe("회");
      expect(next.selectionStart).toBe(1);
      expect(searchQueryForCollection("items")).toBe("회");
      expect(visibleRecordIds(host)).toEqual(["it_potion"]);
    });

    it("forgets an unfinished syllable when IME composition is cancelled", () => {
      const host = renderItems();
      const search = searchInput(host);
      search.dispatchEvent(new Event("compositionstart"));
      search.value = "회";
      const composing = new Event("input", { bubbles: true });
      Object.defineProperty(composing, "isComposing", { value: true });
      search.dispatchEvent(composing);
      search.value = "";
      search.dispatchEvent(new Event("compositionend", { bubbles: true }));
      expect(searchQueryForCollection("items")).toBe("");
      expect(searchInput(host)).toBe(search);
      expect(search.value).toBe("");
      expect(visibleRecordIds(host)).toEqual(["it_potion", "it_ether"]);
    });
  });
  function flushTimers(): void {
    const pending = timers.splice(0);
    for (const timer of pending) timer.run();
  }
  function renderItems(): FakeElement {
    store.update((project) => {
      project.database.items = [
        normalizeItemRecord({ id: "it_potion", name: "회복약", type: "medicine" }),
        normalizeItemRecord({ id: "it_ether", name: "마력약", type: "medicine" }),
      ];
    });
    const host = document.createElement("div") as unknown as FakeElement;
    document.body.append(host);
    const rerender = (): void => {
      host.replaceChildren();
      renderRecordTab(host, "items", rerender);
    };
    rerender();
    return host;
  }
  function searchInput(host: FakeElement): FakeElement {
    const input = findByTestId(host, "db-record-search");
    if (!(input instanceof FakeElement)) throw new Error("missing record search");
    return input;
  }
  function visibleRecordIds(host: FakeElement): string[] {
    return [
      ...host.querySelectorAll(".db-list-row"),
      ...host.querySelectorAll(".db-gallery-card"),
    ].map((row) => row.dataset.recordId ?? "");
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
  function restoreBrowserGlobal(name: "window", value: typeof globalThis.window | undefined): void {
    if (value === undefined) {
      Reflect.deleteProperty(globalThis, name);
      return;
    }
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
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
