// 공용 레코드 픽커 — 스위치·변수·아이템·주인공을 같은 화면으로 고른다.
//
// 이전 구현(classicRecordPickerDialog)은 RM2003 창을 그대로 옮긴 것이었다:
//   · 20칸 블록 내비게이션이 좌측 절반을 차지하고, 항목이 5개여도 20줄을 그려
//     빈 껍데기가 목록의 3/4를 채웠다.
//   · 이름이 전부 "새 스위치"라 검색창이 있어도 무엇이 무엇인지 알 수 없었다.
//   · 푸터 버튼 3개(반영하고 닫기 / 닫기 / 적용)의 차이를 라벨로 알 수 없었다.
//     ("적용"은 이름 변경 전용이었다.)
//   · DESIGN.md 가 이벤트 편집기에 금지한 RM2K3 레트로 표현이었다.
//
// 지금은 검색 우선 목록 하나다. 있는 항목만 그리고, 행마다 참조 수를 보여 주며,
// 이름 변경은 그 자리에서 한다. 푸터는 기본 동작 하나만 남겼다.
//
// 유지되는 testid (e2e 3개 스펙이 의존): event-record-picker, -search, -add,
// -row-{n}, -ok, -name, -no-result.
import { ordinalLabel } from "@/editor/panels/databaseDisplay";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";
import { openEventSubdialog } from "./subdialog";
import {
  canCreateRecord,
  canRenameRecord,
  createRecord,
  createUsageCounter,
  recordIconOf,
  recordKindLabel,
  recordsOf,
  recordSubtitleOf,
  renameRecord,
  type RecordEntry,
  type RecordKind,
} from "./recordKinds";
import { initialBadge, recordIconElement } from "./recordPicker";

export type RecordPickerPanelRequest = {
  readonly kind: RecordKind;
  readonly currentId: string;
  readonly onSelect: (id: string) => void;
  /** Unavailable records remain visible, with this reason, but cannot be selected. */
  readonly disabledReason?: (id: string) => string | undefined;
};

type PanelState = {
  query: string;
  selectedId: string;
  /** 이름 상자를 펼친 레코드. 「이름 바꾸기」를 누르거나 「+ 새 …」로 방금 만든 것만 펼친다. */
  renamingId: string;
};

type PanelHosts = {
  readonly confirm: HTMLButtonElement;
  readonly list: HTMLElement;
  readonly search: HTMLInputElement;
  readonly summary: HTMLElement;
  /**
   * 참조 수 카운터. 창이 열려 있는 동안 한 번만 만든다.
   *
   * 렌더마다 새로 만들면 검색 키 한 번에 프로젝트 맵 전체가 다시 직렬화된다.
   * 창이 떠 있는 동안 레코드 생성·이름변경은 맵 쪽 참조를 건드리지 않으므로
   * 집계 원본은 그대로 유효하다.
   */
  readonly usageOf: (id: string) => number;
  /** 지금 편집 중인 맵 안에서의 참조 수. 관련 레코드를 위로 올리는 데 쓴다. */
  readonly mapUsageOf: (id: string) => number;
};

/** 검색 결과가 아무리 많아도 한 번에 그리는 행 수 상한. 넘치면 안내 문구로 알린다. */
const RENDER_LIMIT = 200;

export function openRecordPickerPanel(request: RecordPickerPanelRequest): void {
  openEventSubdialog({
    title: `${recordKindLabel(request.kind)} 선택`,
    testId: "event-record-picker",
    width: "narrow",
    render: (body, close) => renderPanel({ body, close, request }),
  });
}

function renderPanel(options: {
  readonly body: HTMLElement;
  readonly close: () => void;
  readonly request: RecordPickerPanelRequest;
}): void {
  const { request } = options;
  const state: PanelState = {
    query: "",
    renamingId: "",
    selectedId: resolveInitialId(
      recordsOf(request.kind).filter(record => !request.disabledReason?.(record.id)),
      request.currentId,
    ),
  };

  const search = el("input", {
    class: "event-record-picker-search",
    attrs: {
      type: "search",
      placeholder: `${recordKindLabel(request.kind)} 이름이나 번호로 검색`,
      "aria-label": `${recordKindLabel(request.kind)} 검색`,
    },
    dataset: { testid: "event-record-picker-search" },
  }) as HTMLInputElement;

  const confirm = el("button", {
    class: "btn primary",
    text: "선택",
    attrs: { type: "button" },
    dataset: { testid: "event-record-picker-ok" },
  }) as HTMLButtonElement;

  const hosts: PanelHosts = {
    confirm,
    list: el("div", {
      class: "event-record-picker-list",
      attrs: { role: "listbox", "aria-label": recordKindLabel(request.kind) },
    }),
    search,
    summary: el("div", { class: "event-record-picker-summary" }),
    usageOf: createUsageCounter(),
    mapUsageOf: createUsageCounter(store.getCurrent(), editorState.get().currentMapId),
  };

  const commit = (): void => {
    if (!state.selectedId || request.disabledReason?.(state.selectedId)) return;
    request.onSelect(state.selectedId);
    options.close();
  };

  confirm.addEventListener("click", commit);
  search.addEventListener("input", () => {
    state.query = search.value;
    renderList(hosts, request, state, commit);
  });

  const shell = panelShell({ close: options.close, hosts, request, state, commit });
  // 핸들러는 패널 루트에 둔다. 검색창에만 달면 행을 한 번 클릭한 뒤로는 ↑↓ 가 죽는다
  // (재렌더가 그 행을 파괴해 포커스가 body 로 떨어진다).
  shell.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    // 이름 입력 중에는 ↑↓·Enter 를 가로채지 않는다 — 그쪽이 자기 Enter 를 쓴다.
    if (event.target instanceof HTMLInputElement && event.target.type === "text") return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(hosts, request, state, commit, event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  });

  options.body.append(shell);
  renderList(hosts, request, state, commit);
  // 검색이 첫 조작이다 — 타이핑으로 바로 좁힐 수 있게 포커스를 준다.
  queueMicrotask(() => search.focus({ preventScroll: true }));
}

function panelShell(options: {
  readonly close: () => void;
  readonly hosts: PanelHosts;
  readonly request: RecordPickerPanelRequest;
  readonly state: PanelState;
  readonly commit: () => void;
}): HTMLElement {
  const { hosts, request, state } = options;
  const footerChildren: HTMLElement[] = [];

  if (canCreateRecord(request.kind)) {
    footerChildren.push(
      el("button", {
        class: "btn event-record-picker-add",
        text: `+ 새 ${recordKindLabel(request.kind)}`,
        attrs: { type: "button", title: "검색어가 있으면 그 이름으로 만듭니다" },
        dataset: { testid: "event-record-picker-add" },
        on: {
          click: () => {
            const created = createRecord(request.kind, state.query);
            state.selectedId = created;
            // 방금 만든 레코드는 이름을 지어야 쓸 수 있다 — 이름 상자를 펼치고 포커스를 준다.
            // 예전엔 포커스가 이 버튼에 남아 저작자가 상자를 못 봤다(2026-09-17 리뷰 #8).
            state.renamingId = canRenameRecord(request.kind) ? created : "";
            state.query = "";
            hosts.search.value = "";
            renderList(hosts, request, state, options.commit);
            if (state.renamingId) focusRenameField(hosts);
          },
        },
      }),
    );
  }

  footerChildren.push(
    el("div", { class: "event-record-picker-footer-spacer" }),
    el("button", {
      class: "btn",
      text: "닫기",
      attrs: { type: "button" },
      on: { click: options.close },
    }),
    hosts.confirm,
  );

  return el("div", {
    class: "event-record-picker",
    children: [
      el("div", { class: "event-record-picker-head", children: [hosts.search] }),
      hosts.summary,
      hosts.list,
      el("div", { class: "event-record-picker-footer", children: footerChildren }),
    ],
  });
}

function renderList(
  hosts: PanelHosts,
  request: RecordPickerPanelRequest,
  state: PanelState,
  commit: () => void,
): void {
  const records = recordsOf(request.kind);
  const matches = visibleEntries(records, state.query);
  clearChildren(hosts.list);

  const kindLabel = recordKindLabel(request.kind);
  if (records.length === 0) {
    hosts.summary.textContent = `${kindLabel}가 아직 없습니다.`;
  } else if (state.query.trim()) {
    hosts.summary.textContent = `일치 ${matches.length} / 전체 ${records.length}`;
  } else {
    hosts.summary.textContent = `전체 ${records.length}개`;
  }

  if (matches.length === 0) {
    hosts.list.append(
      el("div", {
        class: "empty-hint",
        text: state.query.trim()
          ? `"${state.query.trim()}" 와 일치하는 ${kindLabel}가 없습니다.`
          : `${kindLabel} 목록이 비어 있습니다.`,
        dataset: { testid: "event-record-picker-no-result" },
      }),
    );
    updateConfirm(hosts.confirm, state, request);
    return;
  }

  const shown = matches.slice(0, RENDER_LIMIT);
  // 지금 편집 중인 맵이 이미 쓰는 레코드를 위로 올린다 — 수십 개 중에서 관련 있는 것을
  // 먼저 보여 주는 유일한 단서다. 표시 순서만 바뀌고 행 testid 는 레코드 번호를 따른다.
  const inMap = shown.filter((entry) => hosts.mapUsageOf(entry.record.id) > 0);
  const rest = shown.filter((entry) => hosts.mapUsageOf(entry.record.id) === 0);
  // 구획 머리의 숫자는 **전체** 일치 수다. 예전엔 그려진 200개만 세어 「전체 1011 = 6 + 194」가 안 맞았다.
  const inMapTotal = matches.filter((entry) => hosts.mapUsageOf(entry.record.id) > 0).length;
  const restTotal = matches.length - inMapTotal;
  const truncated = matches.length > shown.length;

  const appendRow = (entry: VisibleEntry): void => {
    hosts.list.append(
      recordRow({
        entry,
        kind: request.kind,
        selected: entry.record.id === state.selectedId,
        usage: hosts.usageOf(entry.record.id),
        disabledReason: request.disabledReason?.(entry.record.id),
        renaming: entry.record.id === state.renamingId,
        onSelect: () => {
          state.selectedId = entry.record.id;
          // 다른 행을 고르면 펼쳐 둔 이름 상자는 접는다 — 개명은 명시 동작 뒤에만.
          if (state.renamingId !== entry.record.id) state.renamingId = "";
          renderList(hosts, request, state, commit);
          // 재렌더가 방금 누른 버튼을 없앤다. 포커스를 새로 그려진 같은 행으로 옮기지 않으면
          // body 로 떨어져 키보드 조작과 스크린리더 위치를 모두 잃는다.
          focusSelectedRow(hosts);
        },
        onConfirm: commit,
        onBeginRename: () => {
          state.selectedId = entry.record.id;
          state.renamingId = entry.record.id;
          renderList(hosts, request, state, commit);
          focusRenameField(hosts);
        },
        onRename: (name) => {
          renameRecord(request.kind, entry.record.id, name);
          state.renamingId = "";
          renderList(hosts, request, state, commit);
          focusSelectedRow(hosts);
        },
        onCancelRename: () => {
          state.renamingId = "";
          renderList(hosts, request, state, commit);
          focusSelectedRow(hosts);
        },
      }),
    );
  };

  if (inMap.length > 0) {
    hosts.list.append(sectionHeading("이 맵에서 쓰는 중", inMapTotal, "map"));
    inMap.forEach(appendRow);
    hosts.list.append(sectionHeading("그 밖의 " + kindLabel, restTotal, "rest", truncated ? `처음 ${rest.length}개만 표시 — 검색으로 좁히세요` : undefined));
  }
  rest.forEach(appendRow);
  if (truncated && inMap.length === 0) {
    hosts.list.append(el("p", {
      class: "event-record-picker-truncated",
      text: `${matches.length}개 중 처음 ${shown.length}개만 표시합니다. 검색으로 좁히세요.`,
      dataset: { testid: "event-record-picker-truncated" },
    }));
  }

  if (matches.length > RENDER_LIMIT) {
    hosts.list.append(
      el("div", {
        class: "empty-hint",
        text: `${matches.length - RENDER_LIMIT}개는 숨겼습니다. 검색어를 좁혀 주세요.`,
      }),
    );
  }
  updateConfirm(hosts.confirm, state, request);
}

function sectionHeading(label: string, count: number, slug: string, note?: string): HTMLElement {
  return el("div", {
    class: "event-record-picker-section",
    dataset: { testid: `event-record-picker-section-${slug}` },
    children: [
      el("span", { text: label }),
      ...(note ? [el("span", { class: "event-record-picker-section-note", text: note })] : []),
      el("span", { class: "event-record-picker-section-count", text: String(count) }),
    ],
  });
}

function updateConfirm(confirm: HTMLButtonElement, state: PanelState, request: RecordPickerPanelRequest): void {
  confirm.disabled = !state.selectedId || Boolean(request.disabledReason?.(state.selectedId));
}

type VisibleEntry = { readonly index: number; readonly record: RecordEntry };

function visibleEntries(records: readonly RecordEntry[], query: string): VisibleEntry[] {
  const all = records.map((record, index) => ({ index, record }));
  const needle = query.trim().toLowerCase();
  if (!needle) return all;
  return all.filter(({ index, record }) => {
    const ordinal = ordinalLabel(index);
    return (
      record.name.toLowerCase().includes(needle)
      || ordinal.includes(needle)
      || String(index + 1).includes(needle)
    );
  });
}

function moveSelection(
  hosts: PanelHosts,
  request: RecordPickerPanelRequest,
  state: PanelState,
  commit: () => void,
  delta: number,
): void {
  const matches = visibleEntries(recordsOf(request.kind), state.query).slice(0, RENDER_LIMIT)
    .filter(entry => !request.disabledReason?.(entry.record.id));
  if (matches.length === 0) return;
  const current = matches.findIndex((entry) => entry.record.id === state.selectedId);
  const nextIndex = current < 0
    ? (delta > 0 ? 0 : matches.length - 1)
    : Math.min(matches.length - 1, Math.max(0, current + delta));
  state.selectedId = matches[nextIndex]!.record.id;
  renderList(hosts, request, state, commit);
  focusSelectedRow(hosts);
}

/** 펼친 이름 상자에 포커스 — 「+ 새 …」·「이름 바꾸기」 직후. */
function focusRenameField(hosts: PanelHosts): void {
  const input = hosts.list.querySelector<HTMLInputElement>(".event-record-picker-rename");
  if (!input) return;
  input.scrollIntoView({ block: "nearest" });
  input.focus({ preventScroll: true });
  input.select();
}

/** 선택된 행으로 포커스와 스크롤을 맞춘다. 재렌더로 사라진 포커스를 복구하는 유일한 지점. */
function focusSelectedRow(hosts: PanelHosts): void {
  const row = hosts.list.querySelector<HTMLElement>(".event-record-picker-row.selected");
  if (!row) return;
  row.scrollIntoView({ block: "nearest" });
  row.focus({ preventScroll: true });
}

function recordRow(options: {
  readonly entry: VisibleEntry;
  readonly kind: RecordKind;
  readonly selected: boolean;
  readonly usage: number;
  readonly disabledReason?: string;
  readonly renaming: boolean;
  readonly onSelect: () => void;
  readonly onConfirm: () => void;
  readonly onBeginRename: () => void;
  readonly onRename: (name: string) => void;
  readonly onCancelRename: () => void;
}): HTMLElement {
  const { entry, kind } = options;
  const name = entry.record.name.trim();
  const icon = recordIconOf(kind, entry.record);
  const subtitle = recordSubtitleOf(kind, entry.record);

  const meta: string[] = [];
  if (subtitle) meta.push(subtitle);
  meta.push(options.usage > 0 ? `쓰는 곳 ${options.usage}곳` : "아직 안 쓰임");
  if (options.disabledReason) meta.push(options.disabledReason);

  const row = el("button", {
    class: `event-record-picker-row${options.selected ? " selected" : ""}`,
    attrs: {
      type: "button",
      role: "option",
      "aria-selected": options.selected ? "true" : "false",
      title: options.disabledReason ?? (name || "이름 없음"),
      ...(options.disabledReason ? { disabled: "" } : {}),
    },
    dataset: { testid: `event-record-picker-row-${entry.index + 1}` },
    children: [
      el("span", {
        class: "event-record-picker-row-icon",
        children: [icon ? recordIconElement(icon, name) : initialBadge(name || String(entry.index + 1))],
      }),
      el("span", {
        class: "event-record-picker-row-main",
        children: [
          el("span", {
            class: `event-record-picker-row-name${name ? "" : " unnamed"}`,
            text: name || "이름 없음",
          }),
          el("span", {
            class: `event-record-picker-row-meta${options.usage > 0 ? "" : " unused"}`,
            text: meta.join(" · "),
          }),
        ],
      }),
      el("span", { class: "event-record-picker-row-ordinal", text: ordinalLabel(entry.index) }),
    ],
    on: {
      click: options.onSelect,
      dblclick: options.onConfirm,
    },
  });

  // 이름 변경이 가능한 종류(스위치·변수)는 선택된 행에 「이름 바꾸기」 버튼을 두고, 누른 뒤에만
  // 행 아래에 이름 상자를 펼친다. 예전엔 선택만 해도 상자가 펼쳐져 있어서 9곳에서 쓰는 퀘스트
  // 스위치를 실수로 개명하기 좋았다(2026-09-17 적대적 리뷰 P0-2).
  if (options.selected && canRenameRecord(kind) && !options.disabledReason) {
    const renameButton = el("button", {
      class: "btn small event-record-picker-rename-open",
      text: "이름 바꾸기",
      attrs: { type: "button", title: `${recordKindLabel(kind)} 이름 바꾸기`, "aria-label": `${name || "이름 없음"} 이름 바꾸기` },
      dataset: { testid: "event-record-picker-rename-open" },
      on: {
        click: (event) => {
          event.stopPropagation();
          options.onBeginRename();
        },
        dblclick: (event) => event.stopPropagation(),
      },
    });
    row.insertBefore(renameButton, row.lastElementChild);
    return el("div", {
      class: "event-record-picker-row-group",
      children: options.renaming ? [row, renameField(entry, options.onRename, options.onCancelRename)] : [row],
    });
  }
  return row;
}

/**
 * 선택된 행 아래에 붙는 이름 입력. Enter·포커스 이탈 = 반영, Esc = 취소.
 * 구 구현의 "적용" 버튼(이름 변경 전용)을 대체한다.
 */
function renameField(entry: VisibleEntry, onRename: (name: string) => void, onCancel: () => void): HTMLElement {
  const input = el("input", {
    class: "event-record-picker-rename",
    attrs: { type: "text", placeholder: "이름", "aria-label": "이름" },
    value: entry.record.name,
    dataset: { testid: "event-record-picker-name" },
  }) as HTMLInputElement;
  let settled = false;
  const flush = (): void => {
    if (settled) return;
    settled = true;
    if (input.value === entry.record.name) onCancel();
    else onRename(input.value);
  };
  input.addEventListener("blur", flush);
  input.addEventListener("keydown", (event) => {
    // 목록의 ↑↓·Enter 처리와 섞이지 않게 여기서 멈춘다.
    event.stopPropagation();
    if (event.key === "Enter") { event.preventDefault(); flush(); }
    else if (event.key === "Escape") { event.preventDefault(); settled = true; onCancel(); }
  });
  return el("div", {
    class: "event-record-picker-rename-row",
    children: [el("span", { class: "event-record-picker-rename-label", text: "이름" }), input],
  });
}

/**
 * 처음 선택 상태. 지금 값이 목록에 있으면 그것, 없으면 **아무것도 고르지 않는다.**
 * 예전엔 첫 레코드를 미리 골라 놓아 「선택」 한 번에 0001 스위치가 걸렸다(2026-09-17 리뷰 P0-2).
 * 아무것도 안 고른 상태에서 ↓ 를 누르면 첫 행으로 간다(moveSelection).
 */
function resolveInitialId(records: readonly RecordEntry[], currentId: string): string {
  if (records.some((record) => record.id === currentId)) return currentId;
  return "";
}
