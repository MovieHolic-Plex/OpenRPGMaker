// 데이터베이스 '개요' 밸런스 대시보드 뷰 (todo 15).
//
// todo 13 셸(9개 컬렉션 통계 칩)을 유지하고, 아래를 채운다:
//   - 파티 전투력 곡선  (partyPowerCurve → 인라인 SVG 라인 차트, 외부 라이브러리 없음)
//   - 몬스터 HP vs 한 방 피해 (enemyScatter → 인라인 SVG 산점도)
//   - 문제 감지 카드    (detectBalanceIssues → amber 카드 + '해당 탭' 점프, G006)
//   - AI 분석 버튼      (모달 헤더의 database-ai-toggle 을 같은 경로로 연다)
//
// 성능 계약: 첫 렌더는 셸+통계 칩만 그리고, 곡선/산점도/문제 카드/AI 버튼은
// requestIdleCallback(폴백 setTimeout 200ms)으로 지연 계산해 db-overview-charts 에
// 주입한다. 밸런스 계산은 idle callback 안에서만 실행해 첫 렌더를 막지 않는다.
// 읽기 전용: store 쓰기 경로가 전혀 없다(카운트/계산만 읽음).
import type { DatabaseCollection } from "@/editor/databaseActions";
import { databaseTabLabel, switchDatabaseActiveTab, type DatabaseTab } from "@/editor/panels/database";
import {
  detectBalanceIssues,
  enemyScatter,
  partyPowerCurve,
  type BalanceIssue,
  type BalanceIssueKind,
  type EnemyScatterPoint,
  type PartyPowerCurvePoint,
} from "@/editor/panels/databaseBalanceCompute";
import { makeDatabaseTabIcon } from "@/editor/panels/databaseTabIcons";
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
  const project = store.getCurrent();
  const database = project.database;
  const overview = el("div", {
    class: "db-overview-game-pulse",
    dataset: { testid: "db-overview-game-pulse" },
    children: [
      el("header", {
        class: "db-overview-hero",
        children: [
          el("div", {
            class: "db-overview-identity",
            children: [
              el("span", { class: "db-overview-eyebrow", text: "게임 개요" }),
              el("div", {
                class: "db-overview-title-row",
                children: [
                  el("h2", { text: project.meta.title || "새 프로젝트" }),
                  el("div", {
                    class: "db-overview-icon-chips",
                    attrs: { "aria-label": "프로젝트 개요 범위" },
                    children: [
                      overviewIconChip("세계", "tilesets"),
                      overviewIconChip("이야기", "commonEvents"),
                      overviewIconChip("등장인물", "characters"),
                      overviewIconChip("시스템", "system"),
                      overviewIconChip("시작 지점", "overview"),
                    ],
                  }),
                ],
              }),
            ],
          }),
          // 같은 CTA 가 헤더와 차트 그리드 끝에 두 번 렌더되고 있었다. 아래쪽 사본은
          // 그리드의 암묵 행에 auto-place 돼 1349px 전폭 바가 됐고, 접힘선 아래라
          // 대부분 보이지도 않았다. 헤더 하나로 합친다 — 테스트가 잡고 있는 계약은
          // `db-overview-ai` 쪽이라 그 testid 를 여기로 옮긴다.
          el("button", {
            class: "db-overview-assistant-cta db-overview-ai",
            text: "AI 어시스턴트에게 물어보기",
            attrs: { type: "button", title: "에디터 AI 어시스턴트 열기" },
            dataset: { testid: "db-overview-ai" },
            on: { click: openDatabaseAiBar },
          }),
        ],
      }),
      renderGamePulse(project),
    ],
  });
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
  overview.append(statsRow);

  // 무거운 계산(곡선/산점도/감지 + battlePredict 그래프)은 첫 렌더 이후로 미룬다 —
  // 모달 첫 진입을 늦추지 않고, overview 가 아닌 탭에서는 이 경로가 아예 실행되지 않는다.
  const charts = el("section", {
    class: "db-overview-charts",
    dataset: { testid: "db-overview-charts" },
  });
  overview.append(charts);
  host.append(overview);
  scheduleIdle(() => {
    if (!canInjectDashboard(charts, host)) return;
    charts.append(...renderDashboardContent(host));
  });
}

function overviewIconChip(label: string, tab: DatabaseTab): HTMLElement {
  return el("span", {
    class: "db-overview-icon-chip",
    attrs: { title: label },
    children: [makeDatabaseTabIcon(tab), el("span", { text: label })],
  });
}

function renderGamePulse(project: ReturnType<typeof store.getCurrent>): HTMLElement {
  const maps = Object.values(project.maps);
  const events = maps.reduce((sum, map) => sum + map.events.length, 0) + project.commonEvents.length;
  const cast = project.database.actors.length + Object.keys(project.characters ?? {}).length;
  const databaseRecords = STAT_COLLECTIONS.reduce((sum, { collection }) => sum + project.database[collection].length, 0);
  const startMap = project.maps[project.startMapId];
  const card = (testid: string, eyebrow: string, value: string, detail: string): HTMLElement =>
    el("article", {
      class: "db-overview-pulse-card",
      dataset: { testid },
      children: [
        el("span", { text: eyebrow }),
        el("strong", { text: value }),
        el("p", { text: detail }),
      ],
    });
  return el("section", {
    class: "db-overview-pulse-grid",
    children: [
      card("db-overview-world", "세계", `${maps.length}개 맵`, `${project.mapConnections?.length ?? 0}개 이동 연결`),
      card("db-overview-story", "이야기", `${events}개 이벤트`, `${project.quests?.length ?? 0}개 퀘스트 · ${project.endings?.length ?? 0}개 엔딩`),
      card("db-overview-cast", "등장인물", `${cast}명`, `플레이어 ${project.database.actors.length}명 · 주민 ${Object.keys(project.characters ?? {}).length}명`),
      card("db-overview-systems", "게임 데이터", `${databaseRecords}개 레코드`, `전투, 아이템, 성장, 생활 규칙`),
      card("db-overview-readiness", "시작 지점", startMap?.name ?? "미설정", `좌표 ${project.startPos.x}, ${project.startPos.y}`),
    ],
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

function renderDashboardContent(host: HTMLElement): HTMLElement[] {
  const project = store.getCurrent();
  return [
    renderCurveSection(partyPowerCurve(project)),
    renderScatterSection(enemyScatter(project)),
    renderIssuesSection(host, detectBalanceIssues(project)),
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

// --- 몬스터 HP vs 한 방 피해 산점도 ---
//
// y 축은 **몬스터가 파티에 주는** 피해다. enemyScatter 가 채우는 값은
// enemyDpsPerAction(project, enemySnapshot, partyAverageDefender) 이고, 그 함수는
// predictAttackDamage(공격자=몬스터, 방어자=파티) 의 최대치를 고른다. 예전 라벨은
// 이걸 "파티 DPS" 라고 불러서, 읽는 사람이 "우리 파티가 0~1 밖에 못 때린다" 로
// 정반대 결론을 내리게 만들었다.

function renderScatterSection(points: readonly EnemyScatterPoint[]): HTMLElement {
  const section = el("section", { class: "db-overview-section" });
  section.append(el("h3", { class: "db-overview-section-title", text: "몬스터 HP vs 한 방 피해" }));
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
  section.append(
    el("div", {
      class: "db-overview-legend",
      dataset: { testid: "db-overview-scatter-legend" },
      children: [
        el("span", { class: "db-overview-legend-normal", text: "일반" }),
        el("span", { class: "db-overview-legend-boss", text: "보스" }),
        el("span", { class: "db-overview-legend-note", text: "x축 HP(로그) · y축 몬스터가 파티에 주는 피해" }),
      ],
    }),
  );
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
    "aria-label": "몬스터 HP vs 몬스터가 파티에 주는 한 방 피해 산점도",
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
    const dot = svgElement("circle", {
      class: point.isBoss ? "db-overview-scatter-dot db-overview-scatter-dot-boss" : "db-overview-scatter-dot",
      cx: String(round2(xFor(point.hp))),
      cy: String(round2(yFor(point.dps))),
      r: point.isBoss ? "6" : "5",
    });
    // SVG 요소는 title 속성을 툴팁으로 쓰지 않는다 — <title> 자식이어야 브라우저가 띄운다.
    dot.append(
      svgElement(
        "title",
        {},
        `${point.name} — HP ${point.hp}, 한 방 피해 ${point.dps}, exp ${point.exp}, gold ${point.gold}`,
      ),
    );
    svg.append(dot);
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
