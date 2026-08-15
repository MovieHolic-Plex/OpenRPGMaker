import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { setViewModeForCollection } from "@/editor/panels/databaseRecordViewSession";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

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
