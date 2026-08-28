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
};

type PanelState = {
  query: string;
  selectedId: string;
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
    selectedId: resolveInitialId(recordsOf(request.kind), request.currentId),
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
  };

  const commit = (): void => {
    if (!state.selectedId) return;
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
            state.query = "";
            hosts.search.value = "";
            renderList(hosts, request, state, options.commit);
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
    updateConfirm(hosts.confirm, state);
    return;
  }

  for (const entry of matches.slice(0, RENDER_LIMIT)) {
    hosts.list.append(
      recordRow({
        entry,
        kind: request.kind,
        selected: entry.record.id === state.selectedId,
        usage: hosts.usageOf(entry.record.id),
        onSelect: () => {
          state.selectedId = entry.record.id;
          renderList(hosts, request, state, commit);
          // 재렌더가 방금 누른 버튼을 없앤다. 포커스를 새로 그려진 같은 행으로 옮기지 않으면
          // body 로 떨어져 키보드 조작과 스크린리더 위치를 모두 잃는다.
          focusSelectedRow(hosts);
        },
        onConfirm: commit,
        onRename: (name) => {
          renameRecord(request.kind, entry.record.id, name);
          renderList(hosts, request, state, commit);
        },
      }),
    );
  }
  if (matches.length > RENDER_LIMIT) {
    hosts.list.append(
      el("div", {
        class: "empty-hint",
        text: `${matches.length - RENDER_LIMIT}개는 숨겼습니다. 검색어를 좁혀 주세요.`,
      }),
    );
  }
  updateConfirm(hosts.confirm, state);
}

function updateConfirm(confirm: HTMLButtonElement, state: PanelState): void {
  confirm.disabled = !state.selectedId;
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
  const matches = visibleEntries(recordsOf(request.kind), state.query).slice(0, RENDER_LIMIT);
  if (matches.length === 0) return;
  const current = matches.findIndex((entry) => entry.record.id === state.selectedId);
  const nextIndex = current < 0
    ? (delta > 0 ? 0 : matches.length - 1)
    : Math.min(matches.length - 1, Math.max(0, current + delta));
  state.selectedId = matches[nextIndex]!.record.id;
  renderList(hosts, request, state, commit);
  focusSelectedRow(hosts);
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
  readonly onSelect: () => void;
  readonly onConfirm: () => void;
  readonly onRename: (name: string) => void;
}): HTMLElement {
  const { entry, kind } = options;
  const name = entry.record.name.trim();
  const icon = recordIconOf(kind, entry.record);
  const subtitle = recordSubtitleOf(kind, entry.record);

  const meta: string[] = [];
  if (subtitle) meta.push(subtitle);
  meta.push(options.usage > 0 ? `쓰는 곳 ${options.usage}곳` : "아직 안 쓰임");

  const row = el("button", {
    class: `event-record-picker-row${options.selected ? " selected" : ""}`,
    attrs: {
      type: "button",
      role: "option",
      "aria-selected": options.selected ? "true" : "false",
      title: name || "이름 없음",
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

  // 이름 변경이 가능한 종류(스위치·변수)는 선택된 행 바로 아래에서 그 자리 편집한다.
  if (options.selected && canRenameRecord(kind)) {
    return el("div", {
      class: "event-record-picker-row-group",
      children: [row, renameField(entry, options.onRename)],
    });
  }
  return row;
}

/**
 * 선택된 행 아래에 이름 입력을 붙인다. 구 구현의 "적용" 버튼(이름 변경 전용)을 대체한다.
 * 버튼이 사라지는 대신 blur/Enter 로 반영되므로 저작자가 "적용이 뭐지"를 묻지 않아도 된다.
 */
function renameField(entry: VisibleEntry, onRename: (name: string) => void): HTMLElement {
  const input = el("input", {
    class: "event-record-picker-rename",
    attrs: { type: "text", placeholder: "이름", "aria-label": "이름" },
    value: entry.record.name,
    dataset: { testid: "event-record-picker-name" },
  }) as HTMLInputElement;
  const flush = (): void => {
    if (input.value === entry.record.name) return;
    onRename(input.value);
  };
  input.addEventListener("blur", flush);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    flush();
  });
  return el("div", {
    class: "event-record-picker-rename-row",
    children: [el("span", { class: "event-record-picker-rename-label", text: "이름" }), input],
  });
}

function resolveInitialId(records: readonly RecordEntry[], currentId: string): string {
  if (records.some((record) => record.id === currentId)) return currentId;
  return records[0]?.id ?? "";
}
