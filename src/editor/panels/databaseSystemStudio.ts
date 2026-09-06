import { listTitleMenuOptions } from "@/player/titleScreen";
import { resolveFontSelection, FONT_ROLE_LABELS, FONT_ROLES, fontOptionsForRole } from "@/project/fontRegistry";
import { listDatabaseResourceOptions } from "@/editor/panels/databaseResourcePickerDialog";
import { BATTLE_SKINS, resolveSkinId } from "@/battle/skins/registry";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { resolvePlayResolution } from "@/project/playResolution";
import { buildStoryFlagUsageIndex, usageBucketFor } from "@/project/storyFlagUsage";
import type { Project, StoryFlagKind, TitleScreenSettings } from "@/project/types";
import { el } from "@/util/dom";

type SystemStudioTarget = "party" | "display" | "font" | "resources" | "startup" | "optin" | "time" | "typechart" | "title";

type StudioCard = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: string;
  readonly statusKind: "ok" | "warn" | "neutral";
  readonly target?: SystemStudioTarget;
  readonly details?: readonly StudioCardDetail[];
  readonly openLabel?: string;
};

type StudioCardDetail = {
  readonly label: string;
  readonly value: string;
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
      placeholder: "설정 요약 검색",
      "aria-label": "시스템 설정 요약 검색",
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
              ruleCardGrid(project),
              el("div", {
                class: "db-system-studio-no-results", dataset: { testid: "db-system-studio-no-results" },
                children: [el("p", { text: "일치하는 설정이 없습니다." }), el("button", {
                  class: "btn", text: "검색 지우기", attrs: { type: "button" },
                  dataset: { testid: "db-system-studio-search-reset" },
                  on: { click: () => { search.value = ""; filterStudio(studio, ""); search.focus(); } },
                })],
              }),
              stateRegistry(stateRows),
            ],
          }),
          livePreview(project, titleScreen),
        ],
      }),
    ],
  });

  search.addEventListener("input", () => filterStudio(studio, search.value));
  filterStudio(studio, "");
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

export function wireSystemStudioOverview(root: HTMLElement, source: HTMLElement = root): void {
  for (const entry of Array.from(source.querySelectorAll<HTMLButtonElement>("button"))) {
    const systemTarget = entry.dataset.systemTarget;
    if (systemTarget) {
      entry.addEventListener("click", () => {
        const button = root.querySelector<HTMLElement>(`[data-testid="db-system-nav-${systemTarget}"]`);
        button?.click();
        button?.focus({ preventScroll: true });
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
  source.querySelector<HTMLElement>("[data-testid='db-system-studio-play-test']")?.addEventListener("click", () => {
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
            children: [el("h2", { text: "시스템 개요" })],
          }),
          el("div", {
            class: "db-system-studio-health",
            attrs: { "aria-label": "프로젝트 시스템 상태" },
            children: [
              statusDot(`초기 파티 ${project.system.startActorIds.length}명`, project.system.startActorIds.length > 0 ? "ok" : "warn"),
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
  const resolution = resolvePlayResolution(project.system);
  const cards: readonly StudioCard[] = [
    {
      id: "startup",
      title: "시작 설정",
      description: "게임 시작 흐름과 초기 전투",
      status: project.database.troops.find((troop) => troop.id === project.system.initialTroopId)?.name ?? "초기 전투 없음 (선택 사항)",
      statusKind: "neutral",
      target: "startup",
    },
    {
      id: "party",
      title: "파티",
      description: "초기 멤버와 플레이어 구성",
      status: project.system.startActorIds.map((id) => project.database.actors.find((actor) => actor.id === id)?.name ?? id).join(", ") || "초기 멤버 없음",
      statusKind: project.system.startActorIds.length > 0 ? "ok" : "warn",
      target: "party",
    },
    {
      id: "display",
      title: "화면",
      description: "플레이 화면의 논리 해상도",
      status: `${resolution.width}×${resolution.height}`,
      statusKind: "neutral",
      target: "display",
    },
    {
      id: "time",
      title: "시간",
      description: "시간 흐름, 달력, 타임스케일",
      status: timeEnabled ? `${project.system.timeSystem?.dayStartHour ?? 6}:00–${project.system.timeSystem?.dayEndHour ?? 26}:00 · 계절당 ${project.system.timeSystem?.daysPerSeason ?? 28}일` : "사용 안 함",
      statusKind: timeEnabled ? "ok" : "neutral",
      target: "time",
    },
  ];
  const fonts = resolveFontSelection(project.system.fonts);
  const resources = [project.system.titleResourceId, project.system.systemResourceId, project.system.battleSystemResourceId].filter(Boolean);
  const additional: StudioCard[] = [
    { id: "font", title: "폰트", description: "UI · 픽셀 · 고정폭 역할별 글꼴", status: FONT_ROLES.map((role) => `${FONT_ROLE_LABELS[role]} ${fontOptionsForRole(role).find((entry) => entry.id === fonts[role])?.label ?? fonts[role]}`).join(" · "), statusKind: "neutral", target: "font" },
    { id: "resources", title: "리소스", description: "타이틀 · 창 · 전투 공유 그래픽", status: `${resources.length}/3개 선택`, statusKind: "neutral", target: "resources" },
    { id: "typechart", title: "타입 상성", description: "공격 → 방어 배율", status: `${project.system.typeChart?.types.length ?? 0}개 타입`, statusKind: "neutral", target: "typechart" },
  ];
  return el("section", {
    class: "db-system-studio-card-grid",
    attrs: { "aria-label": "핵심 시스템" },
    children: [...cards, ...additional].map((card) => studioCard(card, "primary")),
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
  return el("details", {
    class: "db-system-studio-panel db-system-studio-state",
    dataset: { testid: "db-system-studio-state-table", searchText: "진행 상태 플래그 변수 조건 스토리" },
    children: [
      el("summary", { text: "진행 상태와 연결 데이터" }),
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
                class: "db-system-studio-filter",
                text: "플래그",
                attrs: { type: "button" },
                dataset: { databaseTarget: "switches" },
              }),
              el("button", {
                class: "db-system-studio-filter",
                text: "변수",
                attrs: { type: "button" },
                dataset: { databaseTarget: "variables" },
              }),
              el("button", {
                class: "db-system-studio-add-state",
                text: "스위치에서 관리",
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
  const combatFlow = project.system.battleFlow === "strict" ? "턴 전투" : "게이지 전투";
  const activeSlots = project.system.activeSlots ? `${project.system.activeSlots}명` : "자동";
  const battleSkin = BATTLE_SKINS[resolveSkinId(project.system.battleUiStyle)].label;
  const battleModel = project.system.battleModel === "gen1" ? "Gen1" : "기본";
  const enabledFeatureCount = [project.system.skillSystem?.enabled, project.system.actionCombat?.enabled]
    .filter((value) => value === true).length;
  const titleScreen = resolvedTitleScreen(project);
  const titleMenuCount = visibleTitleMenuLabels(titleScreen).length;
  const cards: readonly StudioCard[] = [
    {
      id: "combat",
      title: "전투 규칙",
      description: `${combatFlow} · 참전 ${activeSlots}`,
      status: `${combatFlow} · ${activeSlots}`,
      statusKind: "neutral",
      target: "startup",
      openLabel: "시작 설정에서 보기",
      details: [
        { label: "전투 흐름", value: combatFlow },
        { label: "참전 인원", value: activeSlots },
        { label: "전투 UI", value: battleSkin },
        { label: "규칙 모델", value: battleModel },
      ],
    },
    {
      id: "features",
      title: "기능 확장",
      description: "실제로 켠 선택 기능과 데이터 수",
      status: `활성 기능 ${enabledFeatureCount}개`,
      statusKind: enabledFeatureCount > 0 ? "ok" : "neutral",
      target: "optin",
      details: [
        { label: "생활 스킬", value: project.system.skillSystem?.enabled === true ? "사용" : "사용 안 함" },
        { label: "액션 전투", value: project.system.actionCombat?.enabled === true ? "사용" : "사용 안 함" },
        { label: "제작 레시피", value: `${project.system.craftRecipes?.length ?? 0}개` },
        { label: "판매가 재정의", value: `${project.system.sellPrices?.length ?? 0}개` },
      ],
    },
    {
      id: "title",
      title: "타이틀",
      description: "시작 화면의 표시·메뉴·오디오",
      status: `메뉴 ${titleMenuCount}개`,
      statusKind: "neutral",
      target: "title",
      details: [
        { label: "표시 방식", value: titlePresentationLabel(titleScreen) },
        { label: "메뉴 항목", value: `${titleMenuCount}개` },
        { label: "배경", value: titleScreen.backgroundResourceId || project.system.titleResourceId ? "설정됨" : "기본" },
        { label: "음악", value: titleScreen.musicResourceId ? listDatabaseResourceOptions("music", project).find((entry) => entry.id === titleScreen.musicResourceId)?.name ?? titleScreen.musicResourceId : "없음" },
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
                class: "is-value",
                text: detail.value,
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
              text: card.openLabel ?? "자세히 보기",
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
        children: [row.key],
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

function livePreview(project: Project, titleScreen: TitleScreenSettings): HTMLElement {
  const menuLabels = visibleTitleMenuLabels(titleScreen);
  const previewStage = el("div", {
    class: "db-system-studio-preview-stage",
    children: [
      el("strong", { text: titleScreen.title || project.meta.title }),
      el("p", { text: `${titlePresentationLabel(titleScreen)} · 설정된 메뉴` }),
      el("div", {
        class: "db-system-studio-preview-menu",
        children: listTitleMenuOptions(titleScreen, { autosaveAvailable: true }).map((option) => el("span", { text: option.label, dataset: { titleMenuOption: option.id } })),
      }),
      el("p", { text: "이어하기는 자동 저장이 있을 때 표시됩니다. 실제 배치와 연출은 타이틀에서 확인하세요." }),
      el("button", { class: "btn", text: "타이틀 구성 열기", attrs: { type: "button" }, dataset: { systemTarget: "title", testid: "db-system-studio-title-open" } }),
    ],
  });
  const resolution = resolvePlayResolution(project.system);
  const impacts = [
    ["타이틀 메뉴", `${menuLabels.length}개 설정`],
    ["플레이 화면", `${resolution.width}×${resolution.height}`],
    ["전투 흐름", project.system.battleFlow === "strict" ? "턴 전투" : "게이지 전투"],
    ["진행 상태", `${namedStateCount(project)}개 정의`],
  ];
  return el("aside", {
    class: "db-system-studio-preview",
    dataset: { testid: "db-system-studio-live-preview" },
    children: [
      el("header", {
        children: [el("h3", { text: "타이틀 요약" })],
      }),
      previewStage,
      el("section", {
        class: "db-system-studio-impact",
        dataset: { testid: "db-system-studio-impact-list" },
        children: [
          el("h4", { text: "현재 프로젝트 값" }),
          ...impacts.map(([title, detail]) =>
            el("div", {
              class: "db-system-studio-impact-row",
              children: [
                el("span", { children: [el("strong", { text: title }), el("small", { text: detail })] }),
              ],
            }),
          ),
        ],
      }),
    ],
  });
}

function visibleTitleMenuLabels(titleScreen: TitleScreenSettings): string[] {
  return listTitleMenuOptions(titleScreen, { autosaveAvailable: true }).map((option) => option.label);
}

function titlePresentationLabel(titleScreen: TitleScreenSettings): string {
  switch (titleScreen.titleGraphic?.mode) {
    case "graphic": return "그래픽";
    case "both": return "텍스트 + 그래픽";
    default: return "텍스트";
  }
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
  if (project.system.startActorIds.some((id) => !project.database.actors.some((actor) => actor.id === id))) count += 1;
  if (project.system.initialTroopId && !project.database.troops.some((troop) => troop.id === project.system.initialTroopId)) count += 1;
  return count;
}

function filterStudio(studio: HTMLElement, rawQuery: string): void {
  const query = rawQuery.trim().toLocaleLowerCase("ko");
  let matches = 0;
  for (const item of Array.from(studio.querySelectorAll<HTMLElement>(".db-system-studio-searchable"))) {
    const haystack = `${item.dataset.searchText ?? ""} ${item.textContent ?? ""}`.toLocaleLowerCase("ko");
    item.hidden = query !== "" && !haystack.includes(query);
    if (!item.hidden) matches += 1;
  }
  const empty = studio.querySelector<HTMLElement>('[data-testid="db-system-studio-no-results"]');
  if (empty) empty.hidden = matches > 0;
}
