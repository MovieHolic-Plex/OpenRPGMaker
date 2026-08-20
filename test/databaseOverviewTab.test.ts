// test/databaseOverviewTab.test.ts
// todo 13 — '개요' 탭 엔트리 + 대시보드 셸(통계 칩) 검증.
// - overview 탭은 9개 컬렉션(DatabaseCollection) 통계 칩을 프로젝트 데이터 카운트로 렌더한다.
// - 첫 진입 기본값은 그대로: localStorage 마지막 탭이 우선, overview 는 저장됐을 때만.
// - setDatabaseActiveTab('overview') + renderDatabasePanel 로 렌더 가능.
// exhaustiveness(모든 switch 가 컴파일)는 typecheck 가 커버한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeEnemyRecord, normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const ACTIVE_TAB_KEY = "rpg-zzu.database.activeTab";

// DatabaseRecords 의 9개 컬렉션 — DatabaseCollection(= keyof DatabaseRecords) 전체.
const STAT_COLLECTIONS: readonly DatabaseCollection[] = [
  "actors",
  "classes",
  "skills",
  "items",
  "equipment",
  "enemies",
  "troops",
  "states",
  "battleAnimations",
];

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;
let storage: Map<string, string>;

beforeEach(() => {
  // database.ts 의 모듈 스코프 activeTab = readStoredActiveTab() 이 import 시점 localStorage 를
  // 읽으므로, "저장된 탭이 기본값"을 진짜 재import 로 검증한다(viewToggle 테스트와 동일 패턴).
  vi.resetModules();
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  if (previousWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
  } else {
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
  vi.resetModules();
});

function renderPanelHost(
  renderDatabasePanel: (container: HTMLElement) => void
): FakeElement {
  const panelRoot = document.createElement("div") as unknown as FakeElement;
  panelRoot.className = "database-modal-body";
  renderDatabasePanel(panelRoot as unknown as HTMLElement);
  return panelRoot;
}

describe("database overview tab shell", () => {
  it("renders stat chips for all 9 collections with counts from the project data", async () => {
    const { store } = await import("@/project/store");
    store.replace(createBlankProject());
    // 픽스처: 기본 프로젝트에 아이템 2개 + 몬스터 1개를 추가해 카운트가 기본값과 다르게 만든다.
    store.update((draft) => {
      draft.database.items.push(normalizeItemRecord({ id: "fixture-item-1", name: "테스트" }));
      draft.database.items.push(normalizeItemRecord({ id: "fixture-item-2", name: "테스트" }));
      draft.database.enemies.push(normalizeEnemyRecord({ id: "fixture-enemy-1", name: "테스트" }));
    });
    storage.set(ACTIVE_TAB_KEY, "overview");

    const { renderDatabasePanel } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);

    const db = store.getCurrent().database;
    for (const collection of STAT_COLLECTIONS) {
      const chip = findByTestId(panelRoot, `db-overview-stat-${collection}`);
      expect(chip, `missing chip db-overview-stat-${collection}`).not.toBeNull();
      expect(chip?.textContent).toContain(String(db[collection].length));
    }
    // 차트 자리 표시자(todo 15 가 채움)도 함께 렌더된다.
    expect(findByTestId(panelRoot, "db-overview-charts")).not.toBeNull();
  }, 60_000);

  it("empty project renders chips with 0 counts without crashing", async () => {
    const { store } = await import("@/project/store");
    const project = createBlankProject();
    project.database.items = [];
    project.database.enemies = [];
    store.replace(project);
    storage.set(ACTIVE_TAB_KEY, "overview");

    const { renderDatabasePanel } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);

    expect(findByTestId(panelRoot, "db-overview-stat-items")?.textContent).toContain("0");
    expect(findByTestId(panelRoot, "db-overview-stat-enemies")?.textContent).toContain("0");
    // 다른 컬렉션도 여전히 렌더된다(카운트 0 이어도 칩 존재).
    expect(findByTestId(panelRoot, "db-overview-stat-actors")).not.toBeNull();
  });

  it("default open tab after modal open is the stored last tab, NOT overview unless stored", async () => {
    storage.set(ACTIVE_TAB_KEY, "system");
    const { store } = await import("@/project/store");
    store.replace(createBlankProject());

    const { renderDatabasePanel, getDatabaseActiveTab } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);

    expect(getDatabaseActiveTab()).toBe("system");
    const systemTab = findByTestId(panelRoot, "db-tab-system");
    expect(systemTab?.classList.contains("active")).toBe(true);
    // overview 는 렌더되지 않는다(본문에 칩/차트 자리 표시자 없음).
    expect(findByTestId(panelRoot, "db-overview-stat-actors")).toBeNull();
    expect(findByTestId(panelRoot, "db-overview-charts")).toBeNull();
  });

  it("persists across hard reload: stored 'overview' lands on the overview tab", async () => {
    storage.set(ACTIVE_TAB_KEY, "overview");
    const { store } = await import("@/project/store");
    store.replace(createBlankProject());

    const { renderDatabasePanel, getDatabaseActiveTab } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);

    expect(getDatabaseActiveTab()).toBe("overview");
    const overviewTab = findByTestId(panelRoot, "db-tab-overview");
    expect(overviewTab?.classList.contains("active")).toBe(true);
    expect(findByTestId(panelRoot, "db-overview-stat-items")).not.toBeNull();
    expect(findByTestId(panelRoot, "db-overview-charts")).not.toBeNull();
  });

  it("setDatabaseActiveTab('overview') + renderDatabasePanel renders the overview tab", async () => {
    const { store } = await import("@/project/store");
    store.replace(createBlankProject());
    storage.set(ACTIVE_TAB_KEY, "actors");

    const {
      renderDatabasePanel,
      setDatabaseActiveTab,
      getDatabaseActiveTab,
    } = await import("@/editor/panels/database");
    setDatabaseActiveTab("overview");
    expect(getDatabaseActiveTab()).toBe("overview");
    expect(storage.get(ACTIVE_TAB_KEY)).toBe("overview");

    const panelRoot = renderPanelHost(renderDatabasePanel);
    const overviewTab = findByTestId(panelRoot, "db-tab-overview");
    expect(overviewTab?.classList.contains("active")).toBe(true);
    // overview 버튼은 사이드바 맨 위(그룹 헤더보다 앞)에 있어야 한다.
    const buttons = panelRoot.querySelectorAll(".db-tab");
    expect(buttons[0]?.dataset.testid).toBe("db-tab-overview");
    expect(findByTestId(panelRoot, "db-overview-stat-actors")).not.toBeNull();
    expect(findByTestId(panelRoot, "db-overview-charts")).not.toBeNull();
  });

  it("stat chips are buttons that switch to the matching tab (G006)", async () => {
    const { store } = await import("@/project/store");
    store.replace(createBlankProject());
    storage.set(ACTIVE_TAB_KEY, "overview");

    const { renderDatabasePanel, getDatabaseActiveTab } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);

    const chip = findByTestId(panelRoot, "db-overview-stat-actors");
    expect(chip?.tagName).toBe("BUTTON");
    chip?.click();
    expect(getDatabaseActiveTab()).toBe("actors");
    expect(findByTestId(panelRoot, "db-tab-actors")?.classList.contains("active")).toBe(true);
  });

  it("databaseTabLabel resolves the overview label for the AI footer", async () => {
    const { store } = await import("@/project/store");
    store.replace(createBlankProject());
    const { databaseTabLabel } = await import("@/editor/panels/database");
    expect(databaseTabLabel("overview")).toBe("개요");
  });
});
