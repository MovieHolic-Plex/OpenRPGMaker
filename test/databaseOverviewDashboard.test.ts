// test/databaseOverviewDashboard.test.ts
// todo 15 — '개요' 대시보드 뷰(곡선/산점도/문제 카드/AI 버튼 + 지연 로드) 검증.
// - 통계 칩은 셸 렌더에서 즉시, 곡선/산점도/문제 카드/AI 버튼은 requestIdleCallback 폴백
//   setTimeout(200ms) 플러시 후 db-overview-charts 에 주입된다(vi.useFakeTimers 로 결정적).
// - 파티 전투력 곡선: SVG path d 가 비어있지 않다 + 5레벨 그리드 + Lv1..Lv50 축 라벨.
// - 산점도: circle 수 === enemies 길이, 보스/일반 스타일 클래스, name/exp/gold title.
// - 문제 카드: 감지기 출력 수만큼 db-overview-issue-<kind> 카드 + 대상 탭 점프 버튼.
// - 점프 버튼: switchDatabaseActiveTab 경로로 실제 탭 전환(G006 — 재모달 없음).
// - AI 버튼: 모달의 database-ai-toggle 클릭을 디스패치한다(aria-expanded 켜짐).
// - 빈/말썽 픽스처: 빈 상태 카드, NaN 없는 path.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CLASS_ID, DEFAULT_ITEM_ID } from "@/project/defaults/constants";
import { createBlankProject } from "@/project/defaults";
import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import type { Project } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const ACTIVE_TAB_KEY = "oprn:database.activeTab";
// databaseOverviewView 의 IDLE_FALLBACK_MS 와 같은 값 — 플러시 지연을 결정적으로 맞춘다.
const IDLE_FALLBACK_MS = 200;

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;
let storage: Map<string, string>;

beforeEach(() => {
  vi.resetModules();
  // fake timers 를 항상 켠다 — 지연 주입이 실시간 200ms 경합 없이 결정적으로 플러시된다.
  vi.useFakeTimers();
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
  vi.useRealTimers();
  vi.resetModules();
});

function renderPanelHost(renderDatabasePanel: (container: HTMLElement) => void): FakeElement {
  // databaseModal.ts 는 모달 백드롭을 document.body 에 붙인다 — 대시보드의 지연 주입
  // 가드(canInjectDashboard: document.body.contains)를 통과하려면 테스트도 본문에 붙인다.
  const panelRoot = document.createElement("div") as unknown as FakeElement;
  panelRoot.className = "database-modal-body";
  renderDatabasePanel(panelRoot as unknown as HTMLElement);
  document.body.append(panelRoot as unknown as HTMLElement);
  return panelRoot;
}

// databaseBalanceCompute.test.ts 와 같은 이상값 3종 픽스처: 과잉 회복 / 보스 HP 급증 /
// 공격력 정체 → 감지기가 정확히 3건을 돌려준다.
function plantedAnomalies(): Project {
  const project = createEmberQuestProject();
  const db = project.database;
  // (a) 과잉 회복: 포션 고정 회복 999 > 임계 400.
  db.items = db.items.map((item) =>
    item.id === DEFAULT_ITEM_ID ? { ...item, hpRecovery: { flat: 999, percentMax: 0 } } : item
  );
  // (b) 보스 HP 급증: 드래곤(exp 160) HP 400, 같은 exp 대역(±30%) 일반 적 2종 HP 50.
  const slime = db.enemies.find((enemy) => enemy.id === "enemy_slime")!;
  const bandEnemy = (id: string, exp: number, maxHp: number) => ({
    ...slime,
    id,
    name: id,
    rewards: { ...slime.rewards, exp },
    stats: { ...slime.stats, maxHp },
  });
  db.enemies = [
    ...db.enemies.filter((enemy) => enemy.id !== "enemy_slime"),
    bandEnemy("enemy_band_a", 150, 50),
    bandEnemy("enemy_band_b", 155, 50),
  ].map((enemy) =>
    enemy.id === "enemy_dragon" ? { ...enemy, stats: { ...enemy.stats, maxHp: 400 } } : enemy
  );
  // (c) 공격력 정체: 영웅 클래스 공격 곡선이 Lv6 이후 45 고정(5레벨 이상 미증가).
  db.classes = db.classes.map((klass) =>
    klass.id === DEFAULT_CLASS_ID
      ? {
          ...klass,
          parameterCurves: {
            ...klass.parameterCurves,
            attack: Array.from({ length: 99 }, (_, index) => (index < 5 ? 20 + index : 45)),
          },
        }
      : klass
  );
  return project;
}

describe("database overview dashboard", () => {
  // 첫 테스트는 콜드 트랜스폼(emberQuestGame → battlePredict 전체 그래프)을 지불한다 —
  // 기본 15s 제한을 넘을 수 있어 명시적 타임아웃을 준다.
  it("renders stat chips immediately with counts from the project data", async () => {
    const { store } = await import("@/project/store");
    store.replace(createEmberQuestProject());
    storage.set(ACTIVE_TAB_KEY, "overview");

    const { renderDatabasePanel } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);

    const db = store.getCurrent().database;
    const collections = ["actors", "classes", "skills", "items", "equipment", "enemies", "troops", "states", "battleAnimations"] as const;
    for (const collection of collections) {
      const chip = findByTestId(panelRoot, `db-overview-stat-${collection}`);
      expect(chip, `missing chip db-overview-stat-${collection}`).not.toBeNull();
      expect(chip?.textContent).toContain(String(db[collection].length));
    }
  }, 60_000);

  it("lazy compute: charts container is empty before idle callback, populated after flush", async () => {
    // 동적 import 대상 모듈을 미리 웜업한다 — 이 테스트의 목적은 '빈 → 채움' 주입 시점이지
    // 모듈 변환 시간이 아니다. (fake timers 아래에서 vite-node 동적 import 의 콜드 변환이
    // advanceTimersByTimeAsync 의 대기 창을 넘을 수 있어 결정적으로 맞추기 위함.)
    await import("@/editor/panels/databaseBalanceCompute");
    const { store } = await import("@/project/store");
    store.replace(createEmberQuestProject());
    storage.set(ACTIVE_TAB_KEY, "overview");

    const { renderDatabasePanel } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);

    const charts = findByTestId(panelRoot, "db-overview-charts");
    expect(charts).not.toBeNull();
    // 첫 렌더 = 셸+통계 칩만 — 차트 영역은 비어 있다.
    expect(charts?.childElementCount).toBe(0);

    await vi.advanceTimersByTimeAsync(IDLE_FALLBACK_MS);

    expect(charts?.childElementCount).toBeGreaterThan(0);
    expect(findByTestId(panelRoot, "db-overview-curve")).not.toBeNull();
    expect(findByTestId(panelRoot, "db-overview-scatter")).not.toBeNull();
    expect(findByTestId(panelRoot, "db-overview-ai")).not.toBeNull();
  });

  it("curve chart renders two non-empty SVG paths with gridlines and Lv1..Lv50 labels", async () => {
    const { store } = await import("@/project/store");
    store.replace(createEmberQuestProject());
    storage.set(ACTIVE_TAB_KEY, "overview");

    const { renderDatabasePanel } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);
    await vi.advanceTimersByTimeAsync(IDLE_FALLBACK_MS);

    const curve = findByTestId(panelRoot, "db-overview-curve");
    expect(curve).not.toBeNull();
    const paths = curve?.querySelectorAll("path") ?? [];
    expect(paths.length).toBeGreaterThanOrEqual(2); // attack + HP
    for (const path of paths) {
      const d = path.getAttribute("d") ?? "";
      expect(d, "curve path d must be non-empty").not.toBe("");
      expect(d).not.toContain("NaN");
    }
    const lines = curve?.querySelectorAll("line") ?? [];
    expect(lines.length).toBeGreaterThanOrEqual(10); // 5레벨 간격 그리드 (Lv5..Lv50)
    const labels = curve?.querySelectorAll("text") ?? [];
    const labelTexts = labels.map((label) => label.textContent);
    expect(labelTexts).toContain("Lv1");
    expect(labelTexts).toContain("Lv10");
    expect(labelTexts).toContain("Lv50");
  });

  it("scatter chart draws one circle per enemy with a <title> tooltip and boss styling", async () => {
    const { store } = await import("@/project/store");
    store.replace(createEmberQuestProject());
    storage.set(ACTIVE_TAB_KEY, "overview");

    const { renderDatabasePanel } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);
    await vi.advanceTimersByTimeAsync(IDLE_FALLBACK_MS);

    const scatter = findByTestId(panelRoot, "db-overview-scatter");
    expect(scatter).not.toBeNull();
    const circles = scatter?.querySelectorAll("circle") ?? [];
    const enemyCount = store.getCurrent().database.enemies.length;
    expect(circles).toHaveLength(enemyCount);
    for (const circle of circles) {
      // 툴팁은 title 속성이 아니라 <title> 자식으로 생긴다 (SVG 사양).
      expect(circle.getAttribute("title"), "SVG circle must not rely on a title attribute").toBeNull();
      const titleNode = circle.querySelectorAll("title")[0];
      expect(titleNode, "scatter circle must carry a <title> child").toBeDefined();
      expect(titleNode?.textContent ?? "", "scatter <title> must name the enemy with HP/DPS/exp/gold").toMatch(
        /HP \d+.*DPS \d+.*exp \d+.*gold \d+/,
      );
    }
    const hasClass = (circle: FakeElement, token: string): boolean => (circle.getAttribute("class") ?? "").split(/\s+/).includes(token);
    const bossCircles = circles.filter((circle) => hasClass(circle, "db-overview-scatter-dot-boss"));
    expect(bossCircles.length).toBeGreaterThanOrEqual(1); // 드래곤(상위 10% exp)은 보스
    const normalCircles = circles.filter((circle) => !hasClass(circle, "db-overview-scatter-dot-boss"));
    expect(normalCircles.length).toBeGreaterThan(0);
  });

  it("renders issue cards matching the detector output with jump buttons", async () => {
    const { store } = await import("@/project/store");
    store.replace(plantedAnomalies());
    storage.set(ACTIVE_TAB_KEY, "overview");

    const { renderDatabasePanel } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);
    await vi.advanceTimersByTimeAsync(IDLE_FALLBACK_MS);

    const { detectBalanceIssues } = await import("@/editor/panels/databaseBalanceCompute");
    const issues = detectBalanceIssues(store.getCurrent());
    expect(issues.length).toBeGreaterThanOrEqual(3);
    for (const issue of issues) {
      const card = findByTestId(panelRoot, `db-overview-issue-${issue.kind}`);
      expect(card, `missing issue card db-overview-issue-${issue.kind}`).not.toBeNull();
      expect(card?.textContent).toContain(issue.title);
      expect(card?.textContent).toContain(issue.detail);
    }
    // 대상 탭이 명확한 3종에만 점프 버튼이 붙는다.
    expect(findByTestId(panelRoot, "db-overview-issue-jump-overheal")).not.toBeNull();
    expect(findByTestId(panelRoot, "db-overview-issue-jump-boss-hp-spike")).not.toBeNull();
    expect(findByTestId(panelRoot, "db-overview-issue-jump-skill-stagnation")).not.toBeNull();
  });

  it("jump button switches to the target tab via switchDatabaseActiveTab (G006)", async () => {
    const { store } = await import("@/project/store");
    store.replace(plantedAnomalies());
    storage.set(ACTIVE_TAB_KEY, "overview");

    const { renderDatabasePanel, getDatabaseActiveTab } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);
    await vi.advanceTimersByTimeAsync(IDLE_FALLBACK_MS);

    const jump = findByTestId(panelRoot, "db-overview-issue-jump-overheal");
    expect(jump).not.toBeNull();
    jump?.click();

    expect(getDatabaseActiveTab()).toBe("items");
    const itemsTab = findByTestId(panelRoot, "db-tab-items");
    expect(itemsTab?.classList.contains("active")).toBe(true);
    expect(panelRoot.querySelector(".db-search")).not.toBeNull();
  });

  it("attack-stagnation jump opens the classes tab, not skills", async () => {
    const { store } = await import("@/project/store");
    store.replace(plantedAnomalies());
    storage.set(ACTIVE_TAB_KEY, "overview");

    const { renderDatabasePanel, getDatabaseActiveTab } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);
    await vi.advanceTimersByTimeAsync(IDLE_FALLBACK_MS);

    findByTestId(panelRoot, "db-overview-issue-jump-skill-stagnation")?.click();
    expect(getDatabaseActiveTab()).toBe("classes");
  });

  it("curve section shows a visible HP/attack legend", async () => {
    const { store } = await import("@/project/store");
    store.replace(createEmberQuestProject());
    storage.set(ACTIVE_TAB_KEY, "overview");

    const { renderDatabasePanel } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);
    await vi.advanceTimersByTimeAsync(IDLE_FALLBACK_MS);

    const legend = findByTestId(panelRoot, "db-overview-curve-legend");
    expect(legend?.textContent).toContain("체력");
    expect(legend?.textContent).toContain("공격");
  });

  it("AI 분석 button dispatches the modal's database-ai-toggle click (aria-expanded)", async () => {
    const { store } = await import("@/project/store");
    store.replace(createEmberQuestProject());
    storage.set(ACTIVE_TAB_KEY, "overview");

    const { renderDatabasePanel } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);

    // databaseModal.ts 의 실제 토글 동작을 흉내낸다 — 클릭 시 aria-expanded 를 켠다.
    const aiToggle = document.createElement("button") as unknown as FakeElement;
    aiToggle.dataset.testid = "database-ai-toggle";
    aiToggle.addEventListener("click", () => aiToggle.setAttribute("aria-expanded", "true"));
    document.body.append(aiToggle as unknown as HTMLElement);

    await vi.advanceTimersByTimeAsync(IDLE_FALLBACK_MS);
    const aiButton = findByTestId(panelRoot, "db-overview-ai");
    expect(aiButton).not.toBeNull();
    aiButton?.click();

    expect(aiToggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("clean project shows empty-state cards instead of blank canvases", async () => {
    const { store } = await import("@/project/store");
    const project = createEmberQuestProject();
    project.database.enemies = [];
    store.replace(project);
    storage.set(ACTIVE_TAB_KEY, "overview");

    const { renderDatabasePanel } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);
    await vi.advanceTimersByTimeAsync(IDLE_FALLBACK_MS);

    // 빈 적 목록: 산점도 캔버스 대신 빈 상태 카드.
    expect(findByTestId(panelRoot, "db-overview-scatter")).toBeNull();
    expect(findByTestId(panelRoot, "db-overview-scatter-empty")).not.toBeNull();
    // 곡선은 파티만으로도 그려진다(적과 무관).
    expect(findByTestId(panelRoot, "db-overview-curve")).not.toBeNull();
    // 감지 문제 없음 → 빈 상태 카드.
    expect(findByTestId(panelRoot, "db-overview-issues-empty")).not.toBeNull();
    expect(findByTestId(panelRoot, "db-overview-ai")).not.toBeNull();
  });

  it("empty project renders empty states without NaN paths", async () => {
    const { store } = await import("@/project/store");
    const project = createBlankProject();
    project.database.enemies = [];
    project.database.items = [];
    store.replace(project);
    storage.set(ACTIVE_TAB_KEY, "overview");

    const { renderDatabasePanel } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);
    await vi.advanceTimersByTimeAsync(IDLE_FALLBACK_MS);

    const curve = findByTestId(panelRoot, "db-overview-curve");
    expect(curve).not.toBeNull();
    for (const path of curve?.querySelectorAll("path") ?? []) {
      const d = path.getAttribute("d") ?? "";
      expect(d).not.toBe("");
      expect(d).not.toContain("NaN");
    }
    expect(findByTestId(panelRoot, "db-overview-scatter-empty")).not.toBeNull();
    expect(findByTestId(panelRoot, "db-overview-issues-empty")).not.toBeNull();
  });
});
