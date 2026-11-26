import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type DatabaseCollection, addDatabaseRecord } from "@/editor/databaseActions";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { setViewModeForCollection, searchQueryForCollection, setCategoryFilterForCollection, setShowsPresetRecords } from "@/editor/panels/databaseRecordViewSession";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { refreshDatabasePanel, renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
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
