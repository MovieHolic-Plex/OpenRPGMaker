// 데이터베이스 탭 공용 워크스페이스 프리미티브 (2026-08 모던 개편).
//
// 배경: 29 개 DB 탭 중 실제로 "모던 에디터"처럼 보이는 건 주인공/개요 둘뿐이었다. 나머지는
// 같은 3-pane 을 각자 손으로 재조립하거나(=미묘하게 다름), 아예 폼 덤프였다. 감사에서
// 반복된 P0 가 전부 그 손조립에서 나왔다:
//   - 상세 창을 grid `auto minmax(0,1fr)` 에 자식 1 개만 넣어 내용이 통째로 잘림
//     (몬스터 종족: 17 개 필드 중 12 개가 화면 밖)
//   - 서브탭 DOM 은 만들었는데 대응 CSS 가 없어 전부 동시에 보임 (직업)
//   - 목록 창 카운트를 `db-list-footer` 로 넣어 검색 행에 auto-place (작물/주민 관계)
//   - `.btn.small { flex: 1 }` 전역 규칙에 걸려 액션 버튼이 1320px 전폭 바가 됨 (스위치/변수)
//   - `.empty-state` 마크업을 뷰마다 복붙 → 아이콘/CTA 유무가 제각각
//
// 그래서 "레이아웃을 CSS 선택자로 추론"하는 대신 **빌더가 구조를 보장**한다. 각 탭은
// 무엇을 보여줄지만 정하고, 행/스크롤 경계/빈 상태/버튼 위계는 여기서 한 번만 정의한다.
//
// DOM 계약: 기존 스타일시트(record-list-modern.css / sidebar.css / desktop.css)가 이미
// 아는 클래스명(.db-record-workspace, .db-list-pane, .db-list-row …)을 그대로 쓰고,
// 여기서 관리하는 요소에는 `db-ws-*` 를 함께 붙인다. 새 규칙은 workspace-modern.css 가
// `db-ws-*` 로만 건다 — 기존 탭을 건드리지 않고 마이그레이션한 탭만 새 규칙을 받는다.

import { el } from "@/util/dom";

// ---------------------------------------------------------------------------
// 워크스페이스 셸
// ---------------------------------------------------------------------------

export type WorkspaceShellOptions = {
  /** 왼쪽 목록 창. 생략하면 상세만 있는 단일 창 레이아웃이 된다. */
  readonly list?: HTMLElement;
  /** 오른쪽 상세/검사 창. */
  readonly detail: HTMLElement;
  /** 워크스페이스 위에 얹는 헤더(히어로/준비 상태 스트립 등). */
  readonly header?: HTMLElement;
  /** `oprn-record-<collection>` 등 기존 스타일 훅을 유지하려는 경우. */
  readonly legacyClass?: string;
  readonly testid?: string;
};

/**
 * 탭 본문의 최상위 골격. `.db-body` 는 height 100% / overflow hidden 이므로 여기서
 * `minmax(0, 1fr)` 행을 명시해 **스크롤 경계를 상세 창 안쪽으로 밀어 넣는다**. 이걸
 * 안 하면 내용이 늘어난 만큼 셸이 커지고 조상 `overflow:hidden` 이 잘라먹는다.
 */
export function workspaceShell(options: WorkspaceShellOptions): HTMLElement {
  const panes = el("div", {
    class: `db-record-workspace db-ws${options.list ? "" : " db-ws-single"}${options.legacyClass ? ` ${options.legacyClass}` : ""}`,
    children: options.list ? [options.list, options.detail] : [options.detail],
  });
  if (!options.header) {
    if (options.testid) panes.dataset.testid = options.testid;
    return panes;
  }
  return el("div", {
    class: "db-ws-frame",
    ...(options.testid ? { dataset: { testid: options.testid } } : {}),
    children: [options.header, panes],
  });
}

// ---------------------------------------------------------------------------
// 목록 창
// ---------------------------------------------------------------------------

export type ListPaneOptions = {
  readonly title: string;
  /** 헤더 우측 카운트 배지. 숫자를 주면 "N개" 로 렌더한다. */
  readonly count?: number | string;
  /** 검색 상자. `listSearch()` 로 만든다. 목록이 있는 창은 항상 주는 게 원칙. */
  readonly search?: HTMLElement;
  /** 카테고리 필터 칩 행. */
  readonly chips?: HTMLElement;
  /** 행들. 비어 있으면 `empty` 가 대신 들어간다. */
  readonly rows: readonly HTMLElement[];
  /** 행이 하나도 없을 때 목록 자리에 넣을 안내. `emptyState()` 권장. */
  readonly empty?: HTMLElement;
  /** 하단 액션 툴바(추가/복제/삭제 등). `listToolbar()` 로 만든다. */
  readonly toolbar?: HTMLElement;
  readonly testid?: string;
};

/**
 * 목록 창. 행 순서를 **빌더가 고정**한다 — 제목 / 검색 / 칩 / 목록(1fr) / 툴바.
 * 카운트를 별도 행이 아니라 제목 줄 배지로 붙여, 예전 `db-list-footer` 가 검색 행을
 * 빼앗던 auto-place 사고를 구조적으로 없앤다.
 */
export function listPane(options: ListPaneOptions): HTMLElement {
  const head = el("div", {
    class: "db-ws-list-head",
    children: [
      el("h3", { class: "db-ws-list-title", text: options.title }),
      ...(options.count === undefined
        ? []
        : [el("span", {
          class: "db-ws-count",
          text: typeof options.count === "number" ? `${options.count}개` : options.count,
          dataset: { testid: "db-ws-count" },
        })]),
    ],
  });

  const list = el("div", {
    class: `db-list db-ws-list${options.rows.length === 0 ? " db-ws-list-empty" : ""}`,
    children: options.rows.length > 0
      ? options.rows
      : [options.empty ?? emptyState({ icon: "○", title: "아직 항목이 없습니다", compact: true })],
  });

  return el("div", {
    class: "db-list-pane oprn-record-list-pane db-ws-list-pane",
    ...(options.testid ? { dataset: { testid: options.testid } } : {}),
    children: [
      head,
      ...(options.search ? [options.search] : []),
      ...(options.chips ? [options.chips] : []),
      list,
      ...(options.toolbar ? [options.toolbar] : []),
    ],
  });
}

export type ListRowOptions = {
  readonly name: string;
  /** 이름 옆 보조 배지(직업/부위/계절 등). */
  readonly sub?: string;
  /** 우측 회색 `#n`. 숫자를 주면 `#n` 으로 렌더한다. */
  readonly number?: number | string;
  /** 24px 썸네일 노드. */
  readonly thumb?: HTMLElement;
  readonly active?: boolean;
  readonly title?: string;
  readonly onSelect: () => void;
  readonly testid?: string;
  readonly dataset?: Record<string, string>;
};

/** 정규 목록 행. 모든 탭이 같은 선택 어피던스(좌측 레일 마커 + 옅은 틴트)를 쓴다. */
export function listRow(options: ListRowOptions): HTMLElement {
  const children: HTMLElement[] = [];
  if (options.thumb) {
    options.thumb.classList.add("db-list-thumb");
    children.push(options.thumb);
  }
  children.push(el("span", { class: "db-list-name", text: options.name || "(이름 없음)" }));
  if (options.sub) children.push(el("span", { class: "db-list-sub", text: options.sub }));
  if (options.number !== undefined) {
    children.push(el("span", {
      class: "db-list-number",
      text: typeof options.number === "number" ? `#${options.number}` : options.number,
    }));
  }
  return el("button", {
    class: `db-list-row db-ws-row${options.thumb ? " db-list-row-has-thumb" : ""}${options.active ? " active" : ""}`,
    attrs: {
      type: "button",
      ...(options.title ? { title: options.title } : {}),
      "aria-pressed": options.active ? "true" : "false",
    },
    dataset: { ...(options.dataset ?? {}), ...(options.testid ? { testid: options.testid } : {}) },
    on: { click: options.onSelect },
    children,
  });
}

/** 디바운스된 목록 검색 상자. 포커스/캐럿 유지는 호출부의 rerender 정책에 맡긴다. */
export function listSearch(options: {
  readonly placeholder: string;
  readonly value: string;
  readonly onInput: (value: string) => void;
  readonly delayMs?: number;
  readonly testid?: string;
}): HTMLElement {
  let timer: number | null = null;
  const input = el("input", {
    attrs: { type: "search", placeholder: options.placeholder, "aria-label": options.placeholder },
    value: options.value,
    ...(options.testid ? { dataset: { testid: options.testid } } : {}),
  });
  input.addEventListener("input", () => {
    const next = input.value;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      options.onInput(next);
    }, options.delayMs ?? 90);
  });
  return el("div", { class: "db-search db-ws-search", children: [input] });
}

/**
 * 리렌더로 교체된 같은 `data-testid` 노드에 포커스를 되돌린다.
 *
 * 이 저장소의 상세 폼은 값이 바뀌면 노드를 통째로 교체한다. 그러면 방금 조작한 컨트롤이
 * 분리되고 포커스가 `<body>` 로 떨어져, 키보드 사용자는 다음 Tab 에서 문서 처음으로
 * 돌아간다(진영 태도 셀·치명타 체크박스에서 실측).
 *
 * **첫 성공에서 멈추면 안 된다.** 한 조작이 리렌더를 두 번 유발한다(직접 호출 + 스토어
 * 구독). 실측(2026-09-01, 진영 태도 셀 Enter): 프레임 1 에서 복원이 성공하지만 약 20ms 뒤
 * 두 번째 교체가 그 노드를 떼어내 포커스가 다시 `<body>` 로 간다. 그래서 성공 여부와
 * 무관하게 몇 프레임 더 지켜보며, 대상이 포커스를 잃으면 새 노드로 다시 얹는다.
 *
 * 테스트용 fake DOM 은 `focus()`/`requestAnimationFrame` 이 없을 수 있어 있을 때만 쓴다.
 */
export function restoreFocusAfterRerender(testid: string, frames = 8): void {
  if (typeof requestAnimationFrame !== "function") return;
  const tick = (remaining: number): void => {
    const next = document.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
    // 대상이 사라졌으면 되돌릴 자리가 없다 — 조용히 끝낸다.
    if (!next) return;
    if (document.activeElement !== next && typeof next.focus === "function") next.focus();
    if (remaining > 0) requestAnimationFrame(() => tick(remaining - 1));
  };
  requestAnimationFrame(() => tick(frames));
}

export type ToolbarAction = {
  readonly label: string;
  readonly onClick: () => void;
  /** primary: 채운 버튼 1 개만. ghost: 기본. danger: 파괴적(2 단계 확인은 호출부 책임). */
  readonly kind?: "primary" | "ghost" | "danger";
  readonly disabled?: boolean;
  readonly title?: string;
  readonly testid?: string;
  /**
   * 좁은 툴바용 짧은 라벨("삭제")과 보조기술용 이름("적 슬롯 삭제")이 달라야 할 때 쓴다.
   * 한 화면에 "삭제" 가 여러 개 있으면 접근명만으로는 무엇을 지우는지 구분할 수 없다.
   */
  readonly ariaLabel?: string;
};

/**
 * 목록 하단 액션 줄. 전역 `.btn.small { flex: 1 }` 에 걸리지 않도록 전용 클래스를 쓰고,
 * 위계를 강제한다 — primary 는 최대 1 개, 나머지는 ghost/danger.
 */
export function listToolbar(actions: readonly ToolbarAction[]): HTMLElement {
  return el("div", {
    class: "db-toolbar db-ws-toolbar",
    children: actions.map((action) => el("button", {
      class: `db-ws-btn db-ws-btn-${action.kind ?? "ghost"}`,
      text: action.label,
      attrs: {
        type: "button",
        ...(action.disabled ? { disabled: "true" } : {}),
        ...(action.title ? { title: action.title } : {}),
        ...(action.ariaLabel ? { "aria-label": action.ariaLabel } : {}),
      },
      ...(action.testid ? { dataset: { testid: action.testid } } : {}),
      on: { click: action.onClick },
    })),
  });
}

// ---------------------------------------------------------------------------
// 상세(검사) 창
// ---------------------------------------------------------------------------

export type DetailPaneOptions = {
  /** 고정 히어로 헤더. `detailHero()` 로 만든다. */
  readonly hero?: HTMLElement;
  /** 스크롤되는 본문. 섹션이 여러 개면 `inspectorTabs()` 를 넣는다. */
  readonly body: HTMLElement | readonly HTMLElement[];
  readonly legacyClass?: string;
  readonly testid?: string;
};

/**
 * 상세 창. **스크롤은 여기서 끝난다** — 히어로는 `auto` 행에 고정하고 본문만
 * `minmax(0,1fr)` + `overflow:auto` 로 둔다. 자식이 1 개뿐이어도 본문 래퍼를 항상
 * 만들기 때문에, 몬스터 종족처럼 "행이 하나 모자라 통째로 잘리는" 케이스가 안 생긴다.
 */
export function detailPane(options: DetailPaneOptions): HTMLElement {
  const body = Array.isArray(options.body) ? options.body : [options.body as HTMLElement];
  return el("div", {
    class: `db-detail-pane oprn-record-detail-pane db-ws-detail${options.legacyClass ? ` ${options.legacyClass}` : ""}`,
    ...(options.testid ? { dataset: { testid: options.testid } } : {}),
    children: [
      ...(options.hero ? [options.hero] : []),
      el("div", { class: "db-ws-detail-body", children: body }),
    ],
  });
}

export type DetailHeroOptions = {
  readonly title: string;
  /** 제목 위 소형 대문자 라벨. */
  readonly eyebrow?: string;
  readonly subtitle?: string;
  /** 제목 아래 배지들(직업 · Lv · 시작 파티 등). */
  readonly tags?: readonly string[];
  /** 좌측 아바타/스프라이트. */
  readonly media?: HTMLElement;
  /** 우측 상단 액션. */
  readonly actions?: readonly ToolbarAction[];
  readonly testid?: string;
};

/** 상세 창 상단 고정 헤더 — 지금 무엇을 편집 중인지 항상 보이게 한다. */
export function detailHero(options: DetailHeroOptions): HTMLElement {
  const text = el("div", {
    class: "db-ws-hero-text",
    children: [
      ...(options.eyebrow ? [el("span", { class: "db-ws-hero-eyebrow", text: options.eyebrow })] : []),
      el("h3", { class: "db-ws-hero-title", text: options.title }),
      ...(options.subtitle ? [el("p", { class: "db-ws-hero-sub", text: options.subtitle })] : []),
      ...(options.tags && options.tags.length > 0
        ? [el("div", {
          class: "db-ws-hero-tags",
          children: options.tags.map((tag) => el("span", { class: "db-ws-tag", text: tag })),
        })]
        : []),
    ],
  });
  return el("header", {
    class: "db-ws-hero",
    ...(options.testid ? { dataset: { testid: options.testid } } : {}),
    children: [
      ...(options.media ? [el("div", { class: "db-ws-hero-media", children: [options.media] })] : []),
      text,
      ...(options.actions && options.actions.length > 0
        ? [el("div", { class: "db-ws-hero-actions", children: [listToolbar(options.actions)] })]
        : []),
    ],
  });
}

export type InspectorSection = {
  readonly id: string;
  readonly label: string;
  /** 지연 생성 — 처음 열릴 때 한 번만 만든다. */
  readonly build: () => HTMLElement;
  /** 탭 라벨 옆 카운트/경고 배지. */
  readonly badge?: string;
};

/**
 * 상세 창 서브탭. 예전 직업 탭은 `.active` 클래스만 토글하고 대응 CSS 가 없어 네 섹션이
 * 동시에 보였다 — 여기서는 `hidden` 속성으로 직접 감추므로 스타일시트가 없어도 동작한다.
 */
export function inspectorTabs(options: {
  readonly sections: readonly InspectorSection[];
  readonly activeId?: string;
  readonly onChange?: (id: string) => void;
  readonly testidPrefix?: string;
}): HTMLElement {
  const sections = options.sections.filter((section) => section.label.length > 0);
  if (sections.length === 0) return el("div", { class: "db-ws-sections" });
  const initial = sections.some((section) => section.id === options.activeId)
    ? (options.activeId as string)
    : sections[0].id;

  const prefix = options.testidPrefix ?? "db-ws-section";
  const panels = new Map<string, HTMLElement>();
  const host = el("div", { class: "db-ws-section-panels" });

  const buttons = sections.map((section) => el("button", {
    class: `db-ws-section-tab${section.id === initial ? " active" : ""}`,
    attrs: { type: "button", role: "tab", "aria-selected": section.id === initial ? "true" : "false" },
    dataset: { testid: `${prefix}-tab-${section.id}`, sectionId: section.id },
    children: [
      el("span", { class: "db-ws-section-tab-label", text: section.label }),
      ...(section.badge ? [el("span", { class: "db-ws-section-badge", text: section.badge })] : []),
    ],
  }));

  const show = (id: string): void => {
    for (const [index, section] of sections.entries()) {
      const button = buttons[index];
      const selected = section.id === id;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
      if (!selected) {
        panels.get(section.id)?.setAttribute("hidden", "");
        continue;
      }
      let panel = panels.get(section.id);
      if (!panel) {
        panel = el("div", {
          class: "db-ws-section-panel",
          dataset: { testid: `${prefix}-panel-${section.id}`, sectionId: section.id },
          children: [section.build()],
        });
        panels.set(section.id, panel);
        host.append(panel);
      }
      panel.removeAttribute("hidden");
    }
    options.onChange?.(id);
  };

  for (const [index, section] of sections.entries()) {
    buttons[index].addEventListener("click", () => show(section.id));
  }

  const strip = el("div", {
    class: "db-ws-section-tabs",
    attrs: { role: "tablist" },
    dataset: { testid: `${prefix}-tabs` },
    children: buttons,
  });
  const wrap = el("div", { class: "db-ws-sections", children: [strip, host] });
  show(initial);
  return wrap;
}

export type SectionCardOptions = {
  readonly title?: string;
  readonly hint?: string;
  readonly children: readonly (HTMLElement | string)[];
  /** 접을 수 있는 카드. 기본은 펼침. */
  readonly collapsible?: boolean;
  readonly collapsed?: boolean;
  readonly testid?: string;
};

/**
 * 상세 창 안의 그룹 상자. `fieldset/legend` 대신 쓴다 — 감사에서 legend 가 이웃 상자와
 * 겹치거나(직업), `!important` 로 테두리가 통째로 지워지는(몬스터/상태) 사고가 전부
 * fieldset 에서 났다.
 */
export function sectionCard(options: SectionCardOptions): HTMLElement {
  const bodyChildren = options.children.map((child) => (typeof child === "string" ? document.createTextNode(child) : child));
  const body = el("div", { class: "db-ws-card-body", children: bodyChildren });
  if (!options.title) {
    return el("section", {
      class: "db-ws-card",
      ...(options.testid ? { dataset: { testid: options.testid } } : {}),
      children: [body],
    });
  }

  const heading = el("h4", { class: "db-ws-card-title", text: options.title });
  const head = el("div", {
    class: "db-ws-card-head",
    children: [heading, ...(options.hint ? [el("span", { class: "db-ws-card-hint", text: options.hint })] : [])],
  });

  const card = el("section", {
    class: `db-ws-card${options.collapsible ? " db-ws-card-collapsible" : ""}`,
    ...(options.testid ? { dataset: { testid: options.testid } } : {}),
    children: [head, body],
  });

  if (!options.collapsible) return card;

  const toggle = el("button", {
    class: "db-ws-card-toggle",
    attrs: {
      type: "button",
      "aria-expanded": options.collapsed ? "false" : "true",
      "aria-label": `${options.title} ${options.collapsed ? "펼치기" : "접기"}`,
    },
    text: options.collapsed ? "▸" : "▾",
  });
  toggle.addEventListener("click", () => {
    const collapsed = body.getAttribute("hidden") !== null;
    if (collapsed) body.removeAttribute("hidden");
    else body.setAttribute("hidden", "");
    toggle.textContent = collapsed ? "▾" : "▸";
    toggle.setAttribute("aria-expanded", collapsed ? "true" : "false");
    toggle.setAttribute("aria-label", `${options.title} ${collapsed ? "접기" : "펼치기"}`);
    card.classList.toggle("collapsed", !collapsed);
  });
  head.prepend(toggle);
  if (options.collapsed) {
    body.setAttribute("hidden", "");
    card.classList.add("collapsed");
  }
  return card;
}

// ---------------------------------------------------------------------------
// 빈 상태
// ---------------------------------------------------------------------------

export type EmptyStateOptions = {
  readonly title: string;
  readonly icon?: string;
  readonly body?: string;
  readonly action?: ToolbarAction;
  /** 보조 액션(문서 열기, 다른 탭으로 점프 등). */
  readonly secondary?: ToolbarAction;
  /** 목록 창 안처럼 좁은 자리에 넣을 때. */
  readonly compact?: boolean;
  readonly testid?: string;
};

/**
 * 정규 빈 상태. 감사 8 축 중 D(빈 상태)가 평균 1.00/3 으로 최악이었고, 원인은 마크업이
 * 뷰마다 복붙돼 아이콘/설명/CTA 유무가 제각각이었던 것 — 여기 하나로 모은다.
 */
export function emptyState(options: EmptyStateOptions): HTMLElement {
  const actions = [options.action, options.secondary].filter(Boolean) as ToolbarAction[];
  return el("div", {
    class: `empty-state db-ws-empty${options.compact ? " db-ws-empty-compact" : " empty-state--large"}`,
    dataset: { testid: options.testid ?? "db-ws-empty" },
    children: [
      el("span", { class: "empty-state__icon db-ws-empty-icon", text: options.icon ?? "＋", attrs: { "aria-hidden": "true" } }),
      el("h3", { class: "empty-state__title db-ws-empty-title", text: options.title }),
      ...(options.body ? [el("p", { class: "empty-state__desc db-ws-empty-desc", text: options.body })] : []),
      ...(actions.length > 0
        ? [el("div", {
          class: "empty-state__actions db-ws-empty-actions",
          children: actions.map((action) => el("button", {
            class: `db-ws-btn db-ws-btn-${action.kind ?? "primary"}`,
            text: action.label,
            attrs: { type: "button", ...(action.title ? { title: action.title } : {}) },
            ...(action.testid ? { dataset: { testid: action.testid } } : {}),
            on: { click: action.onClick },
          })),
        })]
        : []),
    ],
  });
}

// ---------------------------------------------------------------------------
// 상태/건강 스트립
// ---------------------------------------------------------------------------

export type StatTile = {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: "neutral" | "good" | "warn" | "bad";
  readonly onClick?: () => void;
  readonly testid?: string;
};

/**
 * 탭 상단 요약 타일 줄(작물 탭의 "농사 루프 준비 상태"를 일반화). 레코드만 만들어서는
 * 동작하지 않는 탭에서 "무엇이 더 필요한지"를 먼저 알려주는 자리다.
 */
export function statStrip(tiles: readonly StatTile[], options: { readonly testid?: string } = {}): HTMLElement {
  return el("div", {
    class: "db-ws-stats",
    ...(options.testid ? { dataset: { testid: options.testid } } : {}),
    children: tiles.map((tile) => {
      const children = [
        el("span", { class: "db-ws-stat-label", text: tile.label }),
        el("strong", { class: "db-ws-stat-value", text: tile.value }),
        ...(tile.hint ? [el("span", { class: "db-ws-stat-hint", text: tile.hint })] : []),
      ];
      const cls = `db-ws-stat db-ws-stat-${tile.tone ?? "neutral"}`;
      if (!tile.onClick) {
        return el("div", { class: cls, ...(tile.testid ? { dataset: { testid: tile.testid } } : {}), children });
      }
      return el("button", {
        class: `${cls} db-ws-stat-clickable`,
        attrs: { type: "button" },
        ...(tile.testid ? { dataset: { testid: tile.testid } } : {}),
        on: { click: tile.onClick },
        children,
      });
    }),
  });
}

/** 탭 상단 한 줄 안내/경고. */
export function noticeBar(options: {
  readonly text: string;
  readonly tone?: "info" | "warn" | "bad";
  readonly action?: ToolbarAction;
  readonly testid?: string;
}): HTMLElement {
  return el("div", {
    class: `db-ws-notice db-ws-notice-${options.tone ?? "info"}`,
    ...(options.testid ? { dataset: { testid: options.testid } } : {}),
    children: [
      el("span", { class: "db-ws-notice-text", text: options.text }),
      ...(options.action
        ? [el("button", {
          class: "db-ws-btn db-ws-btn-ghost",
          text: options.action.label,
          attrs: { type: "button" },
          ...(options.action.testid ? { dataset: { testid: options.action.testid } } : {}),
          on: { click: options.action.onClick },
        })]
        : []),
    ],
  });
}
