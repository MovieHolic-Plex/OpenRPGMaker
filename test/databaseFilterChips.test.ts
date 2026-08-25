import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { createBlankProject } from "@/project/defaults";
import { normalizeEquipmentRecord, normalizeItemRecord } from "@/project/databaseRecordModel";
import { store } from "@/project/store";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { renderSwitchesTab } from "@/editor/panels/databaseUtilityViews";
import * as session from "@/editor/panels/databaseRecordViewSession";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const CATEGORY_FILTER_STORAGE_KEY = "oprn:database.categoryFilter";

// 정적 import 를 쓴다(vi.resetModules + 동적 import 는 이 머신에서 모듈 그래프 재평가에
// ~9초가 걸려 기본 15초 타임아웃을 넘긴다 — databaseGalleryView.test.ts 와 같은 이유).
// localStorage 재읽기 검증(마지막 테스트)만 중간에 vi.resetModules 로 세션 모듈을
// 다시 읽고, 해당 테스트에만 명시적 타임아웃을 준다.
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
  store.replace(createBlankProject());
  resetDatabaseRecordViewSession();
  // 정적 import 로 모듈 상태가 테스트 간 생존하므로 beforeEach 에서 칩 필터를 초기화한다.
  session.setCategoryFilterForCollection("items", "all");
  session.setCategoryFilterForCollection("equipment", "all");
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  restoreBrowserGlobal("window", previousWindow);
  Reflect.deleteProperty(globalThis, "requestAnimationFrame");
});

describe("database category filter chips", () => {
  it("items tab renders chips and '무기' chip shows only weapon-type items; '전체' resets", () => {
    seedItems();
    const host = renderRecordHost("items");

    // 칩 행은 전체 + ITEM_TYPES 값 기준으로 렌더된다.
    expect(findByTestId(host, "db-filter-chip-all")).not.toBeNull();
    expect(findByTestId(host, "db-filter-chip-weapon")).not.toBeNull();
    expect(findByTestId(host, "db-filter-chip-medicine")).not.toBeNull();
    expect(findByTestId(host, "db-filter-chip-book")).not.toBeNull();
    expect(findByTestId(host, "db-filter-chip-switch")).not.toBeNull();
    expect(visibleRecordIds(host)).toHaveLength(20);

    // '무기' 칩 클릭 → weapon 타입 아이템만 보인다.
    const weaponChip = findByTestId(host, "db-filter-chip-weapon");
    if (!weaponChip) throw new Error("missing weapon chip");
    weaponChip.click();
    const weaponOnly = visibleRecordIds(host);
    expect(weaponOnly.length).toBeGreaterThan(0);
    expect(weaponOnly).toEqual(expect.arrayContaining(["it_sword1", "it_sword2", "it_sword3"]));
    for (const id of weaponOnly) {
      expect(ITEM_IDS_BY_TYPE.weapon).toContain(id);
    }
    expect(session.categoryFilterForCollection("items")).toBe("weapon");
    expect(findByTestId(host, "db-filter-chip-weapon")?.className).toContain("active");
    expect(findByTestId(host, "db-filter-chip-weapon")?.attrs["aria-pressed"]).toBe("true");
    expect(findByTestId(host, "db-filter-chip-all")?.className).not.toContain("active");

    // '전체' 칩 클릭 → 전체 복원.
    const allChip = findByTestId(host, "db-filter-chip-all");
    if (!allChip) throw new Error("missing all chip");
    allChip.click();
    expect(visibleRecordIds(host)).toHaveLength(20);
    expect(session.categoryFilterForCollection("items")).toBe("all");
  });

  it("chip + search combine with AND and narrow further", () => {
    seedItems();
    const host = renderRecordHost("items");
    expect(visibleRecordIds(host)).toHaveLength(20);

    // 무기 칩 → 3개.
    const weaponChip = findByTestId(host, "db-filter-chip-weapon");
    if (!weaponChip) throw new Error("missing weapon chip");
    weaponChip.click();
    expect(visibleRecordIds(host)).toHaveLength(3);

    // 검색어 '강철' 추가 → '강철검' 하나만 남는다 (칩 AND 검색).
    const search = host.querySelector(".db-search input");
    if (!(search instanceof FakeElement)) throw new Error("missing search input");
    search.value = "강철";
    search.dispatchEvent(new Event("input"));
    expect(visibleRecordIds(host)).toEqual(["it_sword2"]);
  });

  it("equipment chips filter by slot", () => {
    seedEquipment();
    const host = renderRecordHost("equipment");
    expect(visibleRecordIds(host)).toHaveLength(5);

    // 갑옷(armor) 칩 → armor slot 장비만.
    const armorChip = findByTestId(host, "db-filter-chip-armor");
    if (!armorChip) throw new Error("missing armor chip");
    armorChip.click();
    expect(visibleRecordIds(host)).toEqual(["eq_armor1"]);
    expect(findByTestId(host, "db-filter-chip-armor")?.className).toContain("active");

    // 머리(helmet) 칩 → helmet slot 장비만.
    const helmetChip = findByTestId(host, "db-filter-chip-helmet");
    if (!helmetChip) throw new Error("missing helmet chip");
    helmetChip.click();
    expect(visibleRecordIds(host)).toEqual(["eq_helmet1"]);
  });

  it("chips are absent on actors/skills/switches tabs", () => {
    seedItems();
    for (const collection of ["actors", "skills", "enemies", "states"] as const) {
      const host = renderRecordHost(collection);
      expect(host.querySelectorAll(".db-filter-chip")).toHaveLength(0);
      expect(findByTestId(host, "db-filter-chip-all")).toBeNull();
    }

    const switchesHost = document.createElement("div") as unknown as FakeElement;
    renderSwitchesTab(switchesHost, () => undefined);
    expect(switchesHost.querySelectorAll(".db-filter-chip")).toHaveLength(0);
  });

  it("filter persists across remount and localStorage re-read", { timeout: 60_000 }, async () => {
    seedItems();
    const host = renderRecordHost("items");
    const weaponChip = findByTestId(host, "db-filter-chip-weapon");
    if (!weaponChip) throw new Error("missing weapon chip");
    weaponChip.click();

    // 세션 상태 + localStorage JSON 맵.
    expect(session.categoryFilterForCollection("items")).toBe("weapon");
    const stored = storage.getItem(CATEGORY_FILTER_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? "{}")).toEqual({ items: "weapon" });

    // 완전히 새 renderRecordTab 호스트에서도 필터가 유지된다(탭 전환 후 복귀 시나리오).
    const freshHost = renderRecordHost("items");
    expect(findByTestId(freshHost, "db-filter-chip-weapon")?.className).toContain("active");
    expect(visibleRecordIds(freshHost)).toEqual(["it_sword1", "it_sword2", "it_sword3"]);

    // localStorage 재읽기: 모듈을 새로 import하면 저장된 필터를 복원한다.
    vi.resetModules();
    const freshSession = await import("@/editor/panels/databaseRecordViewSession");
    expect(freshSession.categoryFilterForCollection("items")).toBe("weapon");
  });

  it("corrupt localStorage filter JSON falls back to 'all'", { timeout: 60_000 }, async () => {
    storage.setItem(CATEGORY_FILTER_STORAGE_KEY, "{not valid json");
    vi.resetModules();
    const freshSession = await import("@/editor/panels/databaseRecordViewSession");
    expect(freshSession.categoryFilterForCollection("items")).toBe("all");
    expect(freshSession.categoryFilterForCollection("equipment")).toBe("all");
  });

  it("stored filter id not in current types is treated as 'all' without crash", () => {
    seedItems();
    storage.setItem(CATEGORY_FILTER_STORAGE_KEY, JSON.stringify({ items: "nonexistentType" }));
    // 정적 import 상태라 저장된 값을 직접 주입해 'all' 취급 경로를 검증한다.
    session.setCategoryFilterForCollection("items", "nonexistentType");

    const host = renderRecordHost("items");
    // 알 수 없는 필터 id는 'all'로 취급 — 전체 목록이 그대로 보이고 크래시하지 않는다.
    expect(visibleRecordIds(host)).toHaveLength(20);
    expect(findByTestId(host, "db-filter-chip-all")?.className).toContain("active");
  });

  it("filter state is only stored for items/equipment collections", () => {
    seedItems();
    // beforeEach 리셋이 비어 있는 맵을 기록하므로, 저장 검증 전에 깨끗한 상태로 되돌린다.
    storage.removeItem(CATEGORY_FILTER_STORAGE_KEY);
    session.setCategoryFilterForCollection("skills" as DatabaseCollection, "weapon");
    session.setCategoryFilterForCollection("actors" as DatabaseCollection, "medicine");
    expect(session.categoryFilterForCollection("skills")).toBe("all");
    expect(session.categoryFilterForCollection("actors")).toBe("all");
    expect(storage.getItem(CATEGORY_FILTER_STORAGE_KEY)).toBeNull();
  });

  it("chip with zero matching records renders empty list without crash", () => {
    seedItems();
    const host = renderRecordHost("items");
    const switchChip = findByTestId(host, "db-filter-chip-switch");
    if (!switchChip) throw new Error("missing switch chip");
    switchChip.click();
    // 시드에 switch 타입이 없음 → 빈 목록, 크래시 없음.
    expect(visibleRecordIds(host)).toHaveLength(0);
    expect(host.querySelector(".db-list")).not.toBeNull();
  });
});

// 시드 픽스처: 아이템 20개(weapon 3 / medicine 3 / book 2 / seed 2 / special 2 /
// normalGoods 2 / shield 2 / body 1 / head 1 / accessory 2).
const ITEM_IDS_BY_TYPE: Record<string, string[]> = {
  weapon: ["it_sword1", "it_sword2", "it_sword3"],
  medicine: ["it_med1", "it_med2", "it_med3"],
  book: ["it_book1", "it_book2"],
  seed: ["it_seed1", "it_seed2"],
  special: ["it_special1", "it_special2"],
  normalGoods: ["it_normal1", "it_normal2"],
  shield: ["it_shield1", "it_shield2"],
  body: ["it_body1"],
  head: ["it_head1"],
  accessory: ["it_acc1", "it_acc2"],
};

function seedItems(): void {
  store.update((project) => {
    project.database.items = [
      normalizeItemRecord({ id: "it_sword1", name: "철검", type: "weapon" }),
      normalizeItemRecord({ id: "it_sword2", name: "강철검", type: "weapon" }),
      normalizeItemRecord({ id: "it_sword3", name: "도끼", type: "weapon" }),
      normalizeItemRecord({ id: "it_med1", name: "회복약", type: "medicine" }),
      normalizeItemRecord({ id: "it_med2", name: "마력약", type: "medicine" }),
      normalizeItemRecord({ id: "it_med3", name: "해독초", type: "medicine" }),
      normalizeItemRecord({ id: "it_book1", name: "전술서", type: "book" }),
      normalizeItemRecord({ id: "it_book2", name: "요리책", type: "book" }),
      normalizeItemRecord({ id: "it_seed1", name: "감자씨앗", type: "seed" }),
      normalizeItemRecord({ id: "it_seed2", name: "호박씨앗", type: "seed" }),
      normalizeItemRecord({ id: "it_special1", name: "포획구슬", type: "special" }),
      normalizeItemRecord({ id: "it_special2", name: "비상탈출구슬", type: "special" }),
      normalizeItemRecord({ id: "it_normal1", name: "돌멩이", type: "normalGoods" }),
      normalizeItemRecord({ id: "it_normal2", name: "나뭇가지", type: "normalGoods" }),
      normalizeItemRecord({ id: "it_shield1", name: "목제 방패", type: "shield" }),
      normalizeItemRecord({ id: "it_shield2", name: "철 방패", type: "shield" }),
      normalizeItemRecord({ id: "it_body1", name: "가죽 갑옷", type: "body" }),
      normalizeItemRecord({ id: "it_head1", name: "가죽 모자", type: "head" }),
      normalizeItemRecord({ id: "it_acc1", name: "공격 반지", type: "accessory" }),
      normalizeItemRecord({ id: "it_acc2", name: "수호 목걸이", type: "accessory" }),
    ];
  });
}

function seedEquipment(): void {
  store.update((project) => {
    project.database.equipment = [
      normalizeEquipmentRecord({ id: "eq_weapon1", name: "청동 검", slot: "weapon" }),
      normalizeEquipmentRecord({ id: "eq_shield1", name: "목제 방패", slot: "shield" }),
      normalizeEquipmentRecord({ id: "eq_helmet1", name: "투구", slot: "helmet" }),
      normalizeEquipmentRecord({ id: "eq_armor1", name: "사슬 갑옷", slot: "armor" }),
      normalizeEquipmentRecord({ id: "eq_acc1", name: "마법 반지", slot: "accessory" }),
    ];
  });
}

function renderRecordHost(collection: DatabaseCollection): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    renderRecordTab(host, collection, rerender);
  };
  rerender();
  return host;
}

function visibleRecordIds(host: FakeElement): string[] {
  // 갤러리(카드) 또는 리스트(행) 중 활성 렌더 경로를 모두 커버한다. fake DOM 은
  // 복합(콤마) 셀렉터에서 마지막 클래스만 매칭하므로 각 경로를 별도로 조회해 합친다.
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
