// 데이터베이스 '개요' 밸런스 대시보드 뷰 (todo 15).
//
// todo 13 셸(9개 컬렉션 통계 칩)을 유지하고, 아래를 채운다:
//   - 파티 전투력 곡선  (partyPowerCurve → 인라인 SVG 라인 차트, 외부 라이브러리 없음)
//   - 몬스터 HP vs DPS  (enemyScatter → 인라인 SVG 산점도)
//   - 문제 감지 카드    (detectBalanceIssues → amber 카드 + '해당 탭' 점프, G006)
//   - AI 분석 버튼      (모달 헤더의 database-ai-toggle 을 같은 경로로 연다)
//
// 성능 계약: 첫 렌더는 셸+통계 칩만 그리고, 곡선/산점도/문제 카드/AI 버튼은
// requestIdleCallback(폴백 setTimeout 200ms)으로 지연 계산해 db-overview-charts 에
// 주입한다. 밸런스 계산 모듈(battlePredict 그래프)은 **동적 import** 로 지연 로드한다 —
// overview 가 아닌 탭은 물론, overview 첫 렌더 시점에도 파싱/계산 비용이 들지 않는다.
// 읽기 전용: store 쓰기 경로가 전혀 없다(카운트/계산만 읽음).
import type { DatabaseCollection } from "@/editor/databaseActions";
import { databaseTabLabel, switchDatabaseActiveTab, type DatabaseTab } from "@/editor/panels/database";
import type {
  BalanceIssue,
  BalanceIssueKind,
  EnemyScatterPoint,
  PartyPowerCurvePoint,
} from "@/editor/panels/databaseBalanceCompute";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";

// DatabaseRecords 의 9개 컬렉션 — DatabaseCollection(= keyof DatabaseRecords)과 동일한 집합.
const STAT_COLLECTIONS: readonly { readonly collection: DatabaseCollection; readonly label: string }[] = [
  { collection: "actors", label: "주인공" },
  { collection: "classes", label: "직업" },
  { collection: "skills", label: "스킬" },
  { collection: "items", label: "아이템" },
  { collection: "equipment", label: "장비" },
  { collection: "enemies", label: "몬스터" },
  { collection: "troops", label: "적 그룹" },
  { collection: "states", label: "상태" },
  { collection: "battleAnimations", label: "전투 애니메이션" },
];

// 지연 계산 폴백 지연(ms) — requestIdleCallback 이 없을 때(Safari 구버전/테스트 환경).
const IDLE_FALLBACK_MS = 200;
// 곡선 창 상한 — databaseBalanceCompute 의 PARTY_CURVE_LEVELS(50)과 같은 값.
const PARTY_CURVE_MAX_LEVEL = 50;

// 문제 종류 → '해당 탭' 점프 대상. 명확한 대상 탭이 없는 종류는 점프 버튼을 만들지 않는다
// (G006: 모달 내 크로스탭 점프는 switchDatabaseActiveTab 경로만).
const ISSUE_JUMP_TAB: Partial<Record<BalanceIssueKind, DatabaseTab>> = {
  overheal: "items",
  "boss-hp-spike": "enemies",
  "skill-stagnation": "classes",
};

const STAT_TAB: Record<DatabaseCollection, DatabaseTab> = {
  actors: "actors",
  classes: "classes",
  skills: "skills",
  items: "items",
  equipment: "equipment",
  enemies: "enemies",
  troops: "troops",
  states: "states",
  battleAnimations: "animations",
};

const SVG_NS = "http://www.w3.org/2000/svg";

export function renderOverviewTab(host: HTMLElement, _rerender: () => void): void {
  clearChildren(host);
  const database = store.getCurrent().database;
  const statsRow = el("div", { class: "db-overview-stats" });
  for (const { collection, label } of STAT_COLLECTIONS) {
    const count = database[collection].length;
    statsRow.append(
      el("button", {
        class: "db-overview-stat",
        attrs: { type: "button", title: `해당 탭: ${label}` },
        dataset: { testid: `db-overview-stat-${collection}` },
        on: { click: () => jumpToTab(host, STAT_TAB[collection]) },
        children: [
          el("span", { class: "db-overview-stat-label", text: label }),
          el("span", { class: "db-overview-stat-count", text: String(count) }),
        ],
      }),
    );
  }
  host.append(statsRow);

  // 무거운 계산(곡선/산점도/감지 + battlePredict 그래프)은 첫 렌더 이후로 미룬다 —
  // 모달 첫 진입을 늦추지 않고, overview 가 아닌 탭에서는 이 경로가 아예 실행되지 않는다.
  const charts = el("section", {
    class: "db-overview-charts",
    dataset: { testid: "db-overview-charts" },
  });
  host.append(charts);
  scheduleIdle(() => {
    if (!canInjectDashboard(charts, host)) return;
    void import("@/editor/panels/databaseBalanceCompute").then((compute) => {
      // 동적 import 를 기다리는 사이 모달이 닫혔을 수 있다 — 주입 직전에 재확인.
      if (!canInjectDashboard(charts, host)) return;
      charts.append(...renderDashboardContent(host, compute));
    });
  });
}

// 지연 스케줄러: requestIdleCallback 우선 + setTimeout 안전망(run-once).
// requestIdleCallback 만 쓰면 연속 rAF(맵 캔버스 렌더 루프)가 페이지를 계속 바쁘게 만들어
// idle 콜백이 굶길 수 있다(실측: 부팅 완료 후 15초+ 미발화) — 폴백 데드라인에 반드시
// 한 번은 실행을 보장한다.
function scheduleIdle(callback: () => void): void {
  let ran = false;
  const run = (): void => {
    if (ran) return;
    ran = true;
    callback();
  };
  const win =
    typeof window === "undefined"
      ? undefined
      : (window as Window & { readonly requestIdleCallback?: (cb: () => void) => void });
  if (win?.requestIdleCallback) win.requestIdleCallback(run);
  setTimeout(run, IDLE_FALLBACK_MS);
}

// 주입 전 생존 확인: (1) document 가 살아있고 (2) 차트 섹션이 아직 live document 에 있고
// (3) 재렌더/탭 전환으로 host 에서 분리되지 않았는지. 테스트의 분리된 패널(fakeDom)과
// 모달을 닫은 뒤 도착한 지연 콜백이 고아 DOM 에서 터지지 않게 한다.
function canInjectDashboard(charts: HTMLElement, host: HTMLElement): boolean {
  if (typeof document === "undefined") return false;
  if (!document.body.contains(charts)) return false;
  return host.contains(charts);
}

// --- 대시보드 본문(지연 주입) ---

type BalanceComputeModule = typeof import("@/editor/panels/databaseBalanceCompute");

function renderDashboardContent(host: HTMLElement, compute: BalanceComputeModule): HTMLElement[] {
  const project = store.getCurrent();
  return [
    renderCurveSection(compute.partyPowerCurve(project)),
    renderScatterSection(compute.enemyScatter(project)),
    renderIssuesSection(host, compute.detectBalanceIssues(project)),
    el("button", {
      class: "db-overview-ai",
      text: "✨ AI 분석",
      attrs: { type: "button", title: "데이터베이스 AI 바 열기" },
      dataset: { testid: "db-overview-ai" },
      on: { click: openDatabaseAiBar },
    }),
  ];
}

// --- 파티 전투력 곡선 (인라인 SVG 라인 차트) ---

function renderCurveSection(curve: readonly PartyPowerCurvePoint[]): HTMLElement {
  const section = el("section", { class: "db-overview-section" });
  section.append(el("h3", { class: "db-overview-section-title", text: "시작 파티 성장" }));
  section.append(
    el("div", {
      class: "db-overview-legend",
      dataset: { testid: "db-overview-curve-legend" },
      children: [
        el("span", { class: "db-overview-legend-hp", text: "체력" }),
        el("span", { class: "db-overview-legend-attack", text: "공격" }),
        el("span", { class: "db-overview-legend-note", text: "시작 파티 · 1–50레벨" }),
      ],
    }),
  );
  section.append(curveChart(curve));
  return section;
}

// 공격력+HP 를 공통 스케일로 정규화하고, 5레벨 간격 세로 그리드 + Lv1/Lv10/.../Lv50 축
// 라벨 + 좌측 Y축(0..max)을 그린다. path 는 수작업 폴리라인 — 외부 라이브러리 금지.
function curveChart(curve: readonly PartyPowerCurvePoint[]): SVGElement {
  const width = 520;
  const height = 220;
  const padLeft = 48;
  const padRight = 16;
  const padTop = 12;
  const padBottom = 32;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  // 공유 스케일: 두 시리즈의 최댓값. 전부 0 이어도 분모 0 방지.
  const maxValue = Math.max(1, ...curve.map((point) => Math.max(point.hp, point.attack)));
  const yTickCount = 4;
  const xFor = (level: number): number => padLeft + ((level - 1) / Math.max(1, curve.length - 1)) * plotWidth;
  const yFor = (value: number): number => padTop + plotHeight - (value / maxValue) * plotHeight;

  const svg = svgElement("svg", {
    class: "db-overview-curve",
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "xMidYMid meet",
    "data-testid": "db-overview-curve",
    role: "img",
    "aria-label": "파티 전투력 곡선 (공격력·HP, Lv1-50)",
  });
  // Y grid + Y labels (left axis) — horizontal hairlines
  for (let index = 0; index <= yTickCount; index += 1) {
    const value = Math.round((maxValue * index) / yTickCount);
    const y = round2(yFor(value));
    svg.append(
      svgElement("line", {
        class: "db-overview-grid db-overview-grid-y",
        x1: String(padLeft),
        y1: String(y),
        x2: String(padLeft + plotWidth),
        y2: String(y),
      }),
    );
    svg.append(
      svgElement(
        "text",
        {
          class: "db-overview-axis-label db-overview-axis-label-y",
          x: String(padLeft - 8),
          y: String(y + 3),
          "text-anchor": "end",
        },
        String(value),
      ),
    );
  }
  // X vertical grids
  for (let level = 5; level <= PARTY_CURVE_MAX_LEVEL; level += 5) {
    const x = round2(xFor(level));
    svg.append(
      svgElement("line", {
        class: "db-overview-grid db-overview-grid-x",
        x1: String(x),
        y1: String(padTop),
        x2: String(x),
        y2: String(padTop + plotHeight),
      }),
    );
  }
  for (const level of [1, 10, 20, 30, 40, 50]) {
    svg.append(
      svgElement(
        "text",
        {
          class: "db-overview-axis-label",
          x: String(round2(xFor(level))),
          y: String(height - 8),
          "text-anchor": "middle",
        },
        level === 1 ? "Lv1" : `Lv${level}`,
      ),
    );
  }
  svg.append(
    svgElement("path", {
      class: "db-overview-curve-attack",
      d: polylinePath(curve.map((point) => [xFor(point.level), yFor(point.attack)] as const)),
    }),
  );
  svg.append(
    svgElement("path", {
      class: "db-overview-curve-hp",
      d: polylinePath(curve.map((point) => [xFor(point.level), yFor(point.hp)] as const)),
    }),
  );
  return svg;
}

function polylinePath(points: readonly (readonly [number, number])[]): string {
  return points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${round2(x)} ${round2(y)}`)
    .join(" ");
}

// --- 몬스터 HP vs 파티 DPS 산점도 ---

function renderScatterSection(points: readonly EnemyScatterPoint[]): HTMLElement {
  const section = el("section", { class: "db-overview-section" });
  section.append(el("h3", { class: "db-overview-section-title", text: "몬스터 HP vs 파티 DPS" }));
  if (points.length === 0) {
    // 빈 적 목록: 빈 캔버스 대신 빈 상태 카드.
    section.append(
      el("div", {
        class: "empty-state empty-state--compact",
        dataset: { testid: "db-overview-scatter-empty" },
        text: "몬스터가 없어 산점도를 그릴 수 없습니다.",
      }),
    );
    return section;
  }
  section.append(scatterChart(points));
  return section;
}

// x = HP(log 스케일), y = DPS(선형). 보스=레드/일반=액센트, hover 시 name/exp/gold 툴팁.
// 좌측 Y축(DPS)과 하단 X축(HP)을 포함해 클리핑 없이 읽히게 한다.
function scatterChart(points: readonly EnemyScatterPoint[]): SVGElement {
  const width = 520;
  const height = 220;
  const padLeft = 48;
  const padRight = 16;
  const padTop = 12;
  const padBottom = 32;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const logHp = points.map((point) => Math.log10(Math.max(1, point.hp)));
  const minLog = Math.min(...logHp);
  const maxLog = Math.max(...logHp);
  const logSpan = Math.max(1e-6, maxLog - minLog);
  const maxDps = Math.max(1, ...points.map((point) => point.dps));
  const yTickCount = 4;
  const xFor = (hp: number): number => padLeft + ((Math.log10(Math.max(1, hp)) - minLog) / logSpan) * plotWidth;
  const yFor = (dps: number): number => padTop + plotHeight - (dps / maxDps) * plotHeight;

  const svg = svgElement("svg", {
    class: "db-overview-scatter",
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "xMidYMid meet",
    "data-testid": "db-overview-scatter",
    role: "img",
    "aria-label": "몬스터 HP vs 파티 DPS 산점도",
  });
  // Y grid + labels
  for (let index = 0; index <= yTickCount; index += 1) {
    const dps = Math.round((maxDps * index) / yTickCount);
    const y = round2(yFor(dps));
    svg.append(
      svgElement("line", {
        class: "db-overview-grid db-overview-grid-y",
        x1: String(padLeft),
        y1: String(y),
        x2: String(padLeft + plotWidth),
        y2: String(y),
      }),
    );
    svg.append(
      svgElement(
        "text",
        {
          class: "db-overview-axis-label db-overview-axis-label-y",
          x: String(padLeft - 8),
          y: String(y + 3),
          "text-anchor": "end",
        },
        String(dps),
      ),
    );
  }
  // X ticks — log HP scale (min / mid / max), de-duped
  const xTickHps: number[] = (() => {
    if (logSpan < 0.05) return [Math.round(Math.pow(10, minLog))];
    const midLog = (minLog + maxLog) / 2;
    const raw = [
      Math.round(Math.pow(10, minLog)),
      Math.round(Math.pow(10, midLog)),
      Math.round(Math.pow(10, maxLog)),
    ];
    return [...new Set(raw)];
  })();
  for (const hp of xTickHps) {
    const x = round2(xFor(hp));
    svg.append(
      svgElement("line", {
        class: "db-overview-grid db-overview-grid-x",
        x1: String(x),
        y1: String(padTop),
        x2: String(x),
        y2: String(padTop + plotHeight),
      }),
    );
    svg.append(
      svgElement(
        "text",
        {
          class: "db-overview-axis-label",
          x: String(x),
          y: String(padTop + plotHeight + 14),
          "text-anchor": "middle",
        },
        String(hp),
      ),
    );
  }
  // 축 기준선
  svg.append(
    svgElement("line", {
      class: "db-overview-grid db-overview-axis-line",
      x1: String(padLeft),
      y1: String(padTop + plotHeight),
      x2: String(padLeft + plotWidth),
      y2: String(padTop + plotHeight),
    }),
  );
  svg.append(
    svgElement("line", {
      class: "db-overview-grid db-overview-axis-line",
      x1: String(padLeft),
      y1: String(padTop),
      x2: String(padLeft),
      y2: String(padTop + plotHeight),
    }),
  );
  for (const point of points) {
    svg.append(
      svgElement("circle", {
        class: point.isBoss ? "db-overview-scatter-dot db-overview-scatter-dot-boss" : "db-overview-scatter-dot",
        cx: String(round2(xFor(point.hp))),
        cy: String(round2(yFor(point.dps))),
        r: point.isBoss ? "6" : "5",
        title: `${point.name} — exp ${point.exp}, gold ${point.gold}`,
      }),
    );
  }
  return svg;
}

// --- 문제 감지 카드 ---

function renderIssuesSection(host: HTMLElement, issues: readonly BalanceIssue[]): HTMLElement {
  const section = el("section", { class: "db-overview-section" });
  section.append(el("h3", { class: "db-overview-section-title", text: "문제 감지" }));
  if (issues.length === 0) {
    section.append(
      el("div", {
        class: "empty-state empty-state--compact",
        dataset: { testid: "db-overview-issues-empty" },
        text: "감지된 밸런스 문제가 없습니다.",
      }),
    );
    return section;
  }
  for (const issue of issues) {
    section.append(issueCard(host, issue));
  }
  return section;
}

function issueCard(host: HTMLElement, issue: BalanceIssue): HTMLElement {
  const jumpTab = ISSUE_JUMP_TAB[issue.kind];
  const children: (Node | string)[] = [
    el("span", { class: "db-overview-issue-icon", children: [warningIcon()] }),
    el("div", {
      class: "db-overview-issue-body",
      children: [
        el("strong", { class: "db-overview-issue-title", text: issue.title }),
        el("p", { class: "db-overview-issue-detail", text: issue.detail }),
      ],
    }),
  ];
  if (jumpTab) {
    children.push(
      el("button", {
        class: "db-overview-issue-jump",
        text: `해당 탭: ${databaseTabLabel(jumpTab)}`,
        attrs: { type: "button" },
        dataset: { testid: `db-overview-issue-jump-${issue.kind}` },
        on: { click: () => jumpToTab(host, jumpTab) },
      }),
    );
  }
  return el("article", {
    class: "db-overview-issue",
    dataset: { testid: `db-overview-issue-${issue.kind}` },
    children,
  });
}

// G006: 모달 내 크로스탭 점프는 openDatabaseModal 재호출 금지 — switchDatabaseActiveTab
// 경로만 쓴다. 패널 루트 해석은 databaseEnemyRecordView 의 databasePanelRootFrom 패턴을 따른다.
function jumpToTab(host: HTMLElement, tab: DatabaseTab): void {
  const panelRoot = databasePanelRootFrom(host);
  if (panelRoot) switchDatabaseActiveTab(tab, panelRoot);
}

function databasePanelRootFrom(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null;
  const modalBody = node.closest(".database-modal-body");
  if (modalBody instanceof HTMLElement) return modalBody;
  let current: HTMLElement | null = node;
  while (current) {
    if (current.querySelector(".db-body") && !current.classList.contains("db-body")) return current;
    current = current.parentElement;
  }
  return null;
}

// --- AI 분석 버튼 ---

// DB AI 바는 모달 헤더의 database-ai-toggle 버튼이 연다(databaseModal.ts — 클릭 시
// aiBar.hidden=false + aria-expanded=true). 대시보드에서 같은 토글을 클릭해 동일 경로를 탄다.
function openDatabaseAiBar(): void {
  document.querySelector<HTMLElement>("[data-testid='database-ai-toggle']")?.click();
}

// --- SVG 헬퍼 ---

function svgElement(tag: string, attrs: Record<string, string>, text?: string): SVGElement {
  const node = document.createElementNS(SVG_NS, tag) as SVGElement;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function warningIcon(): SVGElement {
  const svg = svgElement("svg", {
    class: "db-overview-warning-icon",
    viewBox: "0 0 16 16",
    width: "16",
    height: "16",
    "aria-hidden": "true",
  });
  svg.append(svgElement("path", { d: "M8 1.5 L15 14 H1 Z", fill: "currentColor" }));
  return svg;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
