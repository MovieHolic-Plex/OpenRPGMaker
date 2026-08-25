import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { buildStoryFlagUsageIndex, usageBucketFor } from "@/project/storyFlagUsage";
import type { Project, StoryFlagKind, TitleScreenSettings } from "@/project/types";
import { el } from "@/util/dom";

type SystemStudioTarget = "party" | "display" | "resources" | "startup" | "optin" | "time" | "typechart" | "title";

type StudioCard = {
  readonly id: string;
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  readonly status: string;
  readonly statusKind: "ok" | "warn" | "neutral";
  readonly target?: SystemStudioTarget;
  readonly details?: readonly StudioCardDetail[];
};

type StudioCardDetail = {
  readonly label: string;
  readonly status: string;
  readonly statusKind: "ok" | "warn";
};

type StateRow = {
  readonly key: string;
  readonly kind: StoryFlagKind;
  readonly defaultValue: string;
  readonly usage: string;
  readonly description?: string;
};

export function renderSystemStudioOverview(project: Project): HTMLElement {
  const titleScreen = resolvedTitleScreen(project);
  const stateRows = semanticStateRows(project);
  const warnings = systemWarningCount(project);
  const search = el("input", {
    class: "db-system-studio-search-input",
    attrs: {
      type: "search",
      placeholder: "명령 검색 (예: 세이브, 시간 정지)",
      "aria-label": "시스템 명령 검색",
    },
    dataset: { testid: "db-system-studio-command-search" },
  }) as HTMLInputElement;

  const studio = el("section", {
    class: "db-system-studio",
    dataset: { testid: "db-system-studio" },
    children: [
      studioHeader(project, warnings, search),
      el("div", {
        class: "db-system-studio-layout",
        children: [
          el("main", {
            class: "db-system-studio-main",
            children: [
              primaryCardGrid(project),
              stateRegistry(stateRows),
              ruleCardGrid(project),
            ],
          }),
          livePreview(project, titleScreen, stateRows),
        ],
      }),
    ],
  });

  search.addEventListener("input", () => filterStudio(studio, search.value));
  return studio;
}

function resolvedTitleScreen(project: Project): TitleScreenSettings {
  const defaults = defaultTitleScreenSettings();
  const authored = project.system.titleScreen;
  if (!authored) return defaults;
  return {
    ...defaults,
    ...authored,
    layout: { ...defaults.layout, ...authored.layout },
    menuLabels: { ...defaults.menuLabels, ...authored.menuLabels },
    menuVisibility: { ...defaults.menuVisibility, ...authored.menuVisibility, newGame: true },
    sounds: { ...defaults.sounds, ...authored.sounds },
  };
}

export function wireSystemStudioOverview(root: HTMLElement): void {
  for (const entry of Array.from(root.querySelectorAll<HTMLButtonElement>("button"))) {
    const systemTarget = entry.dataset.systemTarget;
    if (systemTarget) {
      entry.addEventListener("click", () => {
        const button = root.querySelector<HTMLElement>(`[data-testid="db-system-nav-${systemTarget}"]`);
        button?.click();
      });
    }
    const databaseTarget = entry.dataset.databaseTarget;
    if (databaseTarget) {
      entry.addEventListener("click", () => {
        const button = document.querySelector<HTMLElement>(`[data-testid="db-tab-${databaseTarget}"]`);
        button?.click();
      });
    }
  }
  root.querySelector<HTMLElement>("[data-testid='db-system-studio-play-test']")?.addEventListener("click", () => {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("oprn:test-play-window"));
  });
}

function studioHeader(project: Project, warnings: number, search: HTMLInputElement): HTMLElement {
  return el("header", {
    class: "db-system-studio-header",
    dataset: { testid: "db-system-studio-header" },
    children: [
      el("div", {
        class: "db-system-studio-heading",
        children: [
          el("div", {
            children: [
              el("p", { class: "db-system-studio-eyebrow", text: "GAME SYSTEMS" }),
              el("h2", { text: "시스템 개요" }),
            ],
          }),
          el("div", {
            class: "db-system-studio-health",
            attrs: { "aria-label": "프로젝트 시스템 상태" },
            children: [
              statusDot("프로젝트 상태: 양호", "ok"),
              statusDot(warnings > 0 ? `경고 ${warnings}개` : "경고 없음", warnings > 0 ? "warn" : "ok"),
              statusDot(`상태 정의 ${namedStateCount(project)}개`, "neutral"),
            ],
          }),
        ],
      }),
      el("div", {
        class: "db-system-studio-actions",
        children: [
          el("label", {
            class: "db-system-studio-search",
            children: [search],
          }),
          el("span", { class: "db-system-studio-autosave", text: "자동 저장" }),
          el("button", {
            class: "db-system-studio-play",
            text: "플레이 테스트",
            attrs: { type: "button" },
            dataset: { testid: "db-system-studio-play-test" },
          }),
        ],
      }),
    ],
  });
}

function primaryCardGrid(project: Project): HTMLElement {
  const timeEnabled = project.system.timeSystem?.enabled === true;
  const cards: readonly StudioCard[] = [
    {
      id: "startup",
      icon: "↗",
      title: "시작 설정",
      description: "게임 시작 흐름과 초기 전투",
      status: project.system.initialTroopId ? "구성 완료" : "검토 필요",
      statusKind: project.system.initialTroopId ? "ok" : "warn",
      target: "startup",
    },
    {
      id: "party",
      icon: "◎",
      title: "파티",
      description: "초기 멤버와 플레이어 구성",
      status: `${project.system.startActorIds.length}명 구성`,
      statusKind: project.system.startActorIds.length > 0 ? "ok" : "warn",
      target: "party",
    },
    {
      id: "save",
      icon: "▣",
      title: "세이브",
      description: "저장 슬롯과 자동 저장 정책",
      status: "자동 저장 사용",
      statusKind: "ok",
      target: "title",
    },
    {
      id: "time",
      icon: "◷",
      title: "시간",
      description: "시간 흐름, 달력, 타임스케일",
      status: timeEnabled ? "구성 완료" : "선택 기능",
      statusKind: timeEnabled ? "ok" : "neutral",
      target: "time",
    },
  ];
  return el("section", {
    class: "db-system-studio-card-grid",
    attrs: { "aria-label": "핵심 시스템" },
    children: cards.map((card) => studioCard(card, "primary")),
  });
}

function stateRegistry(rows: readonly StateRow[]): HTMLElement {
  const tableBody = rows.length > 0
    ? rows.map(stateTableRow)
    : [
        el("div", {
          class: "db-system-studio-state-empty",
          text: "아직 이름 붙인 진행 상태가 없습니다. 스위치나 변수에 의미 있는 이름을 붙여 보세요.",
        }),
      ];
  return el("section", {
    class: "db-system-studio-panel db-system-studio-state db-system-studio-searchable",
    dataset: { testid: "db-system-studio-state-table", searchText: "진행 상태 플래그 변수 조건 스토리" },
    children: [
      el("header", {
        class: "db-system-studio-panel-header",
        children: [
          el("div", {
            children: [
              el("h3", { text: "진행 상태" }),
              el("p", { text: "숫자 슬롯 대신 이야기와 시스템의 의미로 상태를 관리합니다." }),
            ],
          }),
          el("div", {
            class: "db-system-studio-state-actions",
            children: [
              el("button", {
                class: "db-system-studio-filter active",
                text: "전체",
                attrs: { type: "button", "aria-pressed": "true" },
              }),
              el("button", {
                class: "db-system-studio-filter",
                text: "플래그",
                attrs: { type: "button", "aria-pressed": "false" },
                dataset: { databaseTarget: "switches" },
              }),
              el("button", {
                class: "db-system-studio-filter",
                text: "변수",
                attrs: { type: "button", "aria-pressed": "false" },
                dataset: { databaseTarget: "variables" },
              }),
              el("button", {
                class: "db-system-studio-add-state",
                text: "+ 상태 추가",
                attrs: { type: "button" },
                dataset: { databaseTarget: "switches" },
              }),
            ],
          }),
        ],
      }),
      el("div", {
        class: "db-system-studio-table",
        attrs: { role: "table", "aria-label": "진행 상태 레지스트리" },
        children: [
          el("div", {
            class: "db-system-studio-table-head",
            attrs: { role: "row" },
            children: ["이름", "종류", "기본값", "사용 위치"].map((label) =>
              el("span", { text: label, attrs: { role: "columnheader" } }),
            ),
          }),
          ...tableBody,
        ],
      }),
      el("button", {
        class: "db-system-studio-view-all",
        text: "전체 상태 보기",
        attrs: { type: "button" },
        dataset: { databaseTarget: "switches" },
      }),
    ],
  });
}

function ruleCardGrid(project: Project): HTMLElement {
  const combatFlow = project.system.battleFlow === "strict" ? "라운드 전투" : "게이지 전투";
  const cards: readonly StudioCard[] = [
    {
      id: "combat",
      icon: "⚔",
      title: "전투 규칙",
      description: `${combatFlow} · 참전 ${project.system.activeSlots ?? "자동"}`,
      status: "구성 완료",
      statusKind: "ok",
      target: "startup",
      details: [
        { label: "턴 구조", status: "구성 완료", statusKind: "ok" },
        { label: "행동 및 자원", status: "구성 완료", statusKind: "ok" },
        { label: "데미지 계산", status: "주의 1개", statusKind: "warn" },
        { label: "상태 이상", status: "구성 완료", statusKind: "ok" },
      ],
    },
    {
      id: "economy",
      icon: "◉",
      title: "경제",
      description: "화폐, 상점, 가격, 보상",
      status: project.system.rewardPolicy ? "정책 적용" : "기본 정책",
      statusKind: "ok",
      target: "optin",
      details: [
        { label: "화폐 및 수급", status: "구성 완료", statusKind: "ok" },
        { label: "상점 규칙", status: "구성 완료", statusKind: "ok" },
        { label: "가격 정책", status: "주의 1개", statusKind: "warn" },
        { label: "보상 테이블", status: "구성 완료", statusKind: "ok" },
      ],
    },
    {
      id: "input",
      icon: "⌘",
      title: "입력",
      description: "컨트롤러, 키보드, UI 이동",
      status: "구성 완료",
      statusKind: "ok",
      target: "display",
      details: [
        { label: "컨트롤러 매핑", status: "구성 완료", statusKind: "ok" },
        { label: "키보드 단축키", status: "구성 완료", statusKind: "ok" },
        { label: "UI 포커스 규칙", status: "구성 완료", statusKind: "ok" },
        { label: "입력 버퍼", status: "구성 완료", statusKind: "ok" },
      ],
    },
  ];
  return el("section", {
    class: "db-system-studio-rule-grid",
    attrs: { "aria-label": "규칙 시스템" },
    children: cards.map((card) => studioCard(card, "rule")),
  });
}

function studioCard(card: StudioCard, variant: "primary" | "rule"): HTMLElement {
  const details = variant === "rule"
    ? el("span", {
        class: "db-system-studio-card-details",
        children: (card.details ?? []).map((detail, index) =>
          el("span", {
            class: "db-system-studio-card-detail",
            dataset: { testid: `db-system-studio-card-${card.id}-detail-${index}` },
            children: [
              el("span", { text: detail.label }),
              el("strong", {
                class: `is-${detail.statusKind}`,
                text: detail.status,
              }),
            ],
          }),
        ),
      })
    : null;
  return el("button", {
    class: `db-system-studio-card is-${variant} db-system-studio-searchable`,
    attrs: { type: "button" },
    dataset: {
      testid: `db-system-studio-card-${card.id}`,
      searchText: `${card.title} ${card.description}`,
      ...(card.target ? { systemTarget: card.target } : {}),
    },
    children: [
      el("span", { class: "db-system-studio-card-icon", text: card.icon, attrs: { "aria-hidden": "true" } }),
      el("span", {
        class: "db-system-studio-card-copy",
        children: [
          el("strong", { text: card.title }),
          el("small", { text: card.description }),
          el("em", { class: `is-${card.statusKind}`, text: card.status }),
        ],
      }),
      el("span", { class: "db-system-studio-card-arrow", text: "", attrs: { "aria-hidden": "true" } }),
      ...(details ? [details] : []),
      ...(variant === "rule"
        ? [
            el("span", {
              class: "db-system-studio-card-open",
              text: "자세히 보기",
              dataset: { testid: `db-system-studio-card-${card.id}-open` },
            }),
          ]
        : []),
    ],
  });
}

function stateTableRow(row: StateRow): HTMLElement {
  return el("div", {
    class: "db-system-studio-table-row",
    attrs: { role: "row", title: row.description ?? row.key },
    children: [
      el("span", {
        class: "db-system-studio-state-name",
        attrs: { role: "cell" },
        children: [el("i", { text: row.kind === "switch" ? "⚑" : "◇", attrs: { "aria-hidden": "true" } }), row.key],
      }),
      el("span", {
        attrs: { role: "cell" },
        children: [el("b", { class: `is-${row.kind}`, text: row.kind === "switch" ? "플래그" : "변수" })],
      }),
      el("code", { text: row.defaultValue, attrs: { role: "cell" } }),
      el("span", { class: "db-system-studio-usage", text: row.usage, attrs: { role: "cell" } }),
    ],
  });
}

function livePreview(project: Project, titleScreen: TitleScreenSettings, rows: readonly StateRow[]): HTMLElement {
  const backgroundResourceId = titleScreen.backgroundResourceId ?? project.system.titleResourceId;
  const backgroundUrl = resolveAssetResourceUrl(backgroundResourceId, { project });
  const menuLabels = [
    titleScreen.menuLabels.newGame,
    ...(titleScreen.menuVisibility.continueGame === false ? [] : [titleScreen.menuLabels.continueGame]),
    ...(titleScreen.menuVisibility.quit === false ? [] : [titleScreen.menuLabels.quit]),
  ];
  const previewStage = el("div", {
    class: "db-system-studio-preview-stage",
    attrs: {
      ...(backgroundUrl ? { style: `background-image: linear-gradient(rgba(8,12,20,.22), rgba(8,12,20,.76)), url('${backgroundUrl}')` } : {}),
    },
    children: [
      el("strong", { text: titleScreen.title || project.meta.title }),
      el("div", {
        class: "db-system-studio-preview-menu",
        children: menuLabels.map((label, index) => el("span", { class: index === 0 ? "active" : "", text: label })),
      }),
      el("small", { text: "Ver. 0.1.0" }),
    ],
  });
  const resolution = project.system.playResolution;
  const impacts = [
    ["▣", "타이틀 메뉴", `${menuLabels.length}개 항목`],
    ["▤", "저장/불러오기", "자동 저장"],
    ["⌗", "인게임 HUD", resolution ? `${resolution.width}×${resolution.height}` : "320×240"],
    ["⚔", "전투 화면", project.system.battleFlow === "strict" ? "라운드" : "게이지"],
    ["⚑", "퀘스트 로그", `${rows.length}개 상태`],
  ];
  return el("aside", {
    class: "db-system-studio-preview",
    dataset: { testid: "db-system-studio-live-preview" },
    children: [
      el("header", {
        children: [el("h3", { text: "라이브 프리뷰" })],
      }),
      previewStage,
      el("section", {
        class: "db-system-studio-impact",
        dataset: { testid: "db-system-studio-impact-list" },
        children: [
          el("h4", { text: "영향 받는 화면" }),
          ...impacts.map(([icon, title, detail]) =>
            el("button", {
              class: "db-system-studio-impact-row",
              attrs: { type: "button" },
              children: [
                el("span", { text: icon, attrs: { "aria-hidden": "true" } }),
                el("span", { children: [el("strong", { text: title }), el("small", { text: detail })] }),
                el("i", { text: "›", attrs: { "aria-hidden": "true" } }),
              ],
            }),
          ),
          el("button", { class: "db-system-studio-all-screens", text: "모든 화면 보기", attrs: { type: "button" } }),
        ],
      }),
    ],
  });
}

function semanticStateRows(project: Project): readonly StateRow[] {
  const usageIndex = buildStoryFlagUsageIndex(project);
  const flaggedTargets = new Set<string>();
  const rows: StateRow[] = [];
  for (const flag of (project.storyFlags ?? []).filter((entry) => entry.retired !== true)) {
    flaggedTargets.add(`${flag.kind}:${flag.targetId}`);
    const bucket = usageBucketFor(usageIndex, flag.kind, flag.targetId);
    rows.push({
      key: flag.questId ? `${flag.questId}.${flag.id}` : flag.id,
      kind: flag.kind,
      defaultValue: flag.kind === "switch" ? "false" : "0",
      usage: usageSummary(bucket.reads.length, bucket.writes.length),
      description: flag.description,
    });
  }
  for (const record of project.switches) {
    if (!record.name.trim() || flaggedTargets.has(`switch:${record.id}`)) continue;
    const bucket = usageBucketFor(usageIndex, "switch", record.id);
    rows.push({ key: record.name, kind: "switch", defaultValue: "false", usage: usageSummary(bucket.reads.length, bucket.writes.length) });
  }
  for (const record of project.variables) {
    if (!record.name.trim() || flaggedTargets.has(`variable:${record.id}`)) continue;
    const bucket = usageBucketFor(usageIndex, "variable", record.id);
    rows.push({ key: record.name, kind: "variable", defaultValue: "0", usage: usageSummary(bucket.reads.length, bucket.writes.length) });
  }
  return rows.slice(0, 3);
}

function usageSummary(reads: number, writes: number): string {
  const total = reads + writes;
  if (total === 0) return "아직 사용되지 않음";
  return `읽기 ${reads} · 쓰기 ${writes}`;
}

function statusDot(label: string, kind: "ok" | "warn" | "neutral"): HTMLElement {
  return el("span", { class: `is-${kind}`, text: label });
}

function namedStateCount(project: Project): number {
  const namedSwitches = project.switches.filter((entry) => entry.name.trim()).length;
  const namedVariables = project.variables.filter((entry) => entry.name.trim()).length;
  return namedSwitches + namedVariables;
}

function systemWarningCount(project: Project): number {
  let count = 0;
  if (project.system.startActorIds.length === 0) count += 1;
  if (!project.system.initialTroopId) count += 1;
  if (project.system.timeSystem?.enabled && !project.system.timeSystem.onDayEnd) count += 1;
  return count;
}

function filterStudio(studio: HTMLElement, rawQuery: string): void {
  const query = rawQuery.trim().toLocaleLowerCase("ko");
  for (const item of Array.from(studio.querySelectorAll<HTMLElement>(".db-system-studio-searchable"))) {
    const haystack = `${item.dataset.searchText ?? ""} ${item.textContent ?? ""}`.toLocaleLowerCase("ko");
    item.hidden = query !== "" && !haystack.includes(query);
  }
}
