import { addSwitch, addVariable, deleteSwitch, deleteVariable } from "@/editor/actions";
import { bulkRenameSwitches, bulkRenameVariables, type DeleteResult } from "@/editor/databaseActions";
import { switchVariableReferenceLocations } from "@/editor/databaseCommandReferences";
import { switchVariableReferenceMessage } from "@/editor/databaseReferences";
import { recordCoalescedSnapshot } from "@/editor/mapEditHistory";
import {
  field,
  matchesNameOrId,
} from "@/editor/panels/databaseControls";
import {
  detailHero,
  emptyState,
  listPane,
  listRow,
  listSearch,
  listToolbar,
  detailPane as makeDetailPane,
  sectionCard,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { storyFlagListLabel } from "@/project/storyFlags";
import { store } from "@/project/store";
import { defaultTermValue, TERM_KEYS, type TermKey } from "@/project/terms";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

const DELETE_CONFIRM_LABEL = "정말 삭제?";
const DELETE_IDLE_LABEL = "삭제";
const DELETE_CONFIRM_WINDOW_MS = 3000;

let switchSearch = "";
let selectedSwitchId = "";
let variableSearch = "";
let selectedVariableId = "";
let pendingUtilityFocusId = "";

// 스위치/변수 이름 입력란은 키 입력마다 호출된다 — editor/actions.ts의 renameSwitch/
// renameVariable을 그대로 쓰면 매번 recordProjectSnapshot()(비-코얼레스)이 실행돼
// 5글자 타이핑에 Ctrl+Z 5번이 필요해진다(qa-system-report.md). terms 필드와 동일하게
// recordCoalescedSnapshot으로 직접 마무리한다.
function renameSwitchCoalesced(id: string, name: string): void {
  recordCoalescedSnapshot(`db-utility:switch-name:${id}`);
  store.update((project) => {
    const record = project.switches.find((entry) => entry.id === id);
    if (record) record.name = name;
  }, { scope: "database", collection: "switches" });
}

function renameVariableCoalesced(id: string, name: string): void {
  recordCoalescedSnapshot(`db-utility:variable-name:${id}`);
  store.update((project) => {
    const record = project.variables.find((entry) => entry.id === id);
    if (record) record.name = name;
  }, { scope: "database", collection: "variables" });
}

// 삭제 자체(참조 가드 + undo 스냅샷)는 기존 deleteSwitch/deleteVariable을 그대로 쓰되,
// 성공한 뒤에는 세션 런타임 값(session.switches[id]/variables[id])도 함께 지운다 — 그러지
// 않으면 슬롯을 "+ 추가"로 재사용할 때 이전 값(true/숫자)을 그대로 물려받는다
// (qa-system-report.md). deleteSwitch가 이미 recordProjectSnapshot을 호출했으므로 이
// 후속 store.update는 별도 스냅샷 없이 같은 undo 묶음에 들어간다.
function deleteSwitchWithCleanup(id: string): DeleteResult {
  const result = deleteSwitch(id);
  if (result.ok) {
    store.update((project) => {
      delete project.session.switches[id];
    }, { scope: "database", collection: "switches" });
  }
  return result;
}

function deleteVariableWithCleanup(id: string): DeleteResult {
  const result = deleteVariable(id);
  if (result.ok) {
    store.update((project) => {
      delete project.session.variables[id];
    }, { scope: "database", collection: "variables" });
  }
  return result;
}

type TermFieldOptions = {
  readonly key: TermKey;
  readonly label: string;
  readonly testid?: string;
  readonly value?: string;
  /** 값이 커밋된 뒤 호출 — 미리보기 국소 갱신용. 전체 재렌더가 아니다. */
  readonly onCommit?: () => void;
};

export function renderSwitchesTab(host: HTMLElement, rerender: () => void): void {
  renderFlagTab(host, rerender, SWITCH_KIND);
}

export function renderVariablesTab(host: HTMLElement, rerender: () => void): void {
  renderFlagTab(host, rerender, VARIABLE_KIND);
}

// ---------------------------------------------------------------------------
// 스위치 / 변수 — 하나의 워크스페이스로 통합
//
// 예전 구조는 "추가 버튼 / 범위 접기 / 검색 / 목록 / 상세 / 스토리 플래그"를 한 섹션에
// 세로로 쌓은 폼 덤프였다. 감사 결과 A(레이아웃) 1/3, H(밀도) 0/3 — 본문의 60% 이상이
// 빈 흰색이었고 "+ 추가"는 1320px 전폭 바였다. 변수는 더 심해서, 런타임 값
// (session.variables[id])이 존재하는데 UI 어디에도 안 나왔다.
// ---------------------------------------------------------------------------

type FlagKind = {
  readonly kind: "switch" | "variable";
  readonly label: string;
  readonly eyebrow: string;
  readonly icon: string;
  readonly addTestId: string;
  readonly searchPlaceholder: string;
  readonly emptyTitle: string;
  readonly emptyBody: string;
  readonly nameLabel: string;
  readonly rangePrefix: string;
};

const SWITCH_KIND: FlagKind = {
  kind: "switch",
  label: "스위치",
  eyebrow: "스위치",
  icon: "⏻",
  addTestId: "db-add-switch",
  searchPlaceholder: "스위치 검색",
  emptyTitle: "아직 스위치가 없습니다",
  emptyBody: "스위치는 이벤트가 켜고 끄는 on/off 값입니다. 상한이 없으니 필요할 때마다 만드세요.",
  nameLabel: "스위치 이름",
  rangePrefix: "스위치",
};

const VARIABLE_KIND: FlagKind = {
  kind: "variable",
  label: "변수",
  eyebrow: "변수",
  icon: "＃",
  addTestId: "db-add-variable",
  searchPlaceholder: "변수 검색",
  emptyTitle: "아직 변수가 없습니다",
  emptyBody: "변수는 이벤트가 읽고 쓰는 숫자입니다. 상한이 없으니 필요할 때마다 만드세요.",
  nameLabel: "변수 이름",
  rangePrefix: "변수",
};

function flagRecords(kind: FlagKind): readonly { readonly id: string; readonly name: string }[] {
  const project = store.getCurrent();
  return kind.kind === "switch" ? project.switches : project.variables;
}

function flagSelectedId(kind: FlagKind): string {
  return kind.kind === "switch" ? selectedSwitchId : selectedVariableId;
}

function setFlagSelectedId(kind: FlagKind, id: string): void {
  if (kind.kind === "switch") selectedSwitchId = id;
  else selectedVariableId = id;
}

function flagQuery(kind: FlagKind): string {
  return kind.kind === "switch" ? switchSearch : variableSearch;
}

function setFlagQuery(kind: FlagKind, value: string): void {
  if (kind.kind === "switch") switchSearch = value;
  else variableSearch = value;
}

function flagDelete(kind: FlagKind, id: string): DeleteResult {
  return kind.kind === "switch" ? deleteSwitchWithCleanup(id) : deleteVariableWithCleanup(id);
}

function flagRename(kind: FlagKind, id: string, name: string): void {
  if (kind.kind === "switch") renameSwitchCoalesced(id, name);
  else renameVariableCoalesced(id, name);
}

/** 런타임 초기값. 변수의 이 값은 예전 UI 에 아예 노출되지 않았다. */
function flagRuntimeValue(kind: FlagKind, id: string): string {
  const session = store.getCurrent().session;
  if (kind.kind === "switch") return session.switches[id] === true ? "ON" : "OFF";
  return String(session.variables[id] ?? 0);
}

function renderFlagTab(host: HTMLElement, rerender: () => void, kind: FlagKind): void {
  const records = flagRecords(kind);
  const named = records.filter((record) => record.name.trim().length > 0);
  setFlagSelectedId(kind, selectedRecordId(records, flagSelectedId(kind)));
  const selectedId = flagSelectedId(kind);
  const selected = records.find((record) => record.id === selectedId);
  const query = flagQuery(kind);

  const rows: HTMLElement[] = [];
  for (const [index, record] of records.entries()) {
    if (record.name.trim().length === 0) continue;
    if (query && !matchesNameOrId(record.name, record.id, query)) continue;
    rows.push(flagListRow(kind, record, index, records.length, rerender));
  }

  const list = listPane({
    title: `${kind.label} 목록`,
    count: named.length,
    search: listSearch({
      placeholder: kind.searchPlaceholder,
      value: query,
      testid: `db-${kind.kind}-search`,
      onInput: (value) => {
        setFlagQuery(kind, value);
        rerender();
      },
    }),
    rows,
    empty: query.length > 0
      ? emptyState({ icon: "⌕", title: "검색 결과가 없습니다", body: `"${query}" 와 일치하는 ${kind.label}가 없습니다.`, compact: true })
      : emptyState({ icon: kind.icon, title: kind.emptyTitle, compact: true }),
    toolbar: listToolbar([
      {
        label: "+ 추가",
        kind: "primary",
        testid: kind.addTestId,
        title: "필요한 만큼 자동으로 늘어납니다 (고정 상한 없음)",
        onClick: () => {
          const id = kind.kind === "switch" ? addSwitch("새 스위치") : addVariable("새 변수");
          setFlagSelectedId(kind, id);
          pendingUtilityFocusId = id;
          rerender();
        },
      },
    ]),
    testid: `db-${kind.kind}-list-pane`,
  });

  const detail = selected
    ? makeDetailPane({
      hero: detailHero({
        eyebrow: kind.eyebrow,
        title: selected.name,
        tags: [
          `#${records.findIndex((record) => record.id === selected.id) + 1}`,
          `초기값 ${flagRuntimeValue(kind, selected.id)}`,
        ],
        testid: `db-${kind.kind}-hero`,
      }),
      body: flagInspector(kind, selected, rerender),
      testid: `db-${kind.kind}-detail-pane`,
    })
    : makeDetailPane({
      body: emptyState({
        icon: kind.icon,
        title: kind.emptyTitle,
        body: kind.emptyBody,
        action: {
          label: `첫 ${kind.label} 만들기`,
          kind: "primary",
          testid: `db-${kind.kind}-empty-create`,
          onClick: () => {
            const id = kind.kind === "switch" ? addSwitch("새 스위치") : addVariable("새 변수");
            setFlagSelectedId(kind, id);
            pendingUtilityFocusId = id;
            rerender();
          },
        },
      }),
      testid: `db-${kind.kind}-detail-pane`,
    });

  host.append(workspaceShell({ list, detail, testid: `db-${kind.kind}-workspace` }));
  focusPendingUtilityName(host);
}

function flagListRow(
  kind: FlagKind,
  record: { readonly id: string; readonly name: string },
  index: number,
  total: number,
  rerender: () => void,
): HTMLElement {
  const row = listRow({
    name: record.name,
    number: index + 1,
    sub: kind.kind === "variable" ? flagRuntimeValue(kind, record.id) : undefined,
    active: record.id === flagSelectedId(kind),
    title: record.id,
    dataset: {
      recordId: record.id,
      recordIndex: String(index + 1),
      recordName: record.name,
      recordTotal: String(total),
    },
    onSelect: () => {
      setFlagSelectedId(kind, record.id);
      rerender();
    },
  });
  // qa-system.spec.ts 가 `.db-utility-row.active` 로 선택을 확인한다 — 클래스 계약 유지.
  row.classList.add("db-row", "db-utility-row");

  // 행별 삭제는 남기되(계약: `db-delete-<id>`), 빨간 버튼이 목록 전체에 줄지어 서는
  // 예전 모습은 없앤다 — 평소엔 조용한 고스트 아이콘이고 hover/선택/확인 대기 때만
  // 붉어진다(workspace-modern.css 의 .db-ws-row-delete).
  const deleteButton = twoStepDeleteButton({
    className: "db-ws-row-delete",
    ariaLabel: `${record.name} 삭제`,
    testid: `db-delete-${record.id}`,
    onDelete: () => flagDelete(kind, record.id),
    onDeleted: () => {
      if (selectedSwitchId === record.id) selectedSwitchId = "";
      if (selectedVariableId === record.id) selectedVariableId = "";
      rerender();
    },
  });
  return el("div", { class: "db-ws-row-wrap db-utility-row-wrap", children: [row, deleteButton] });
}

/**
 * 상세 인스펙터. 서브탭으로 나누지 않고 카드 스택으로 둔 이유: 섹션이 3~4 개뿐이고,
 * 범위 도구와 스토리 플래그는 "지금 보이는가"가 중요한 참조 정보다 — 예전 `<details>`
 * 안에 접혀 있어 존재를 모르는 사용자가 많았다(감사 E 축 1/3).
 */
function flagInspector(
  kind: FlagKind,
  record: { readonly id: string; readonly name: string },
  rerender: () => void,
): HTMLElement {
  const index = flagRecords(kind).findIndex((entry) => entry.id === record.id);
  const usage = switchVariableReferenceMessage(kind.kind, record.id);
  return el("div", {
    class: "db-ws-stack",
    children: [
      sectionCard({
        title: "이름",
        hint: `이벤트 목록에서는 #${index + 1} 로도 표시됩니다.`,
        children: [flagNameField(kind, record)],
        testid: `db-${kind.kind}-name-card`,
      }),
      sectionCard({
        title: "런타임 초기값",
        hint: kind.kind === "switch"
          ? "테스트 플레이를 시작할 때의 on/off 상태입니다."
          : "테스트 플레이를 시작할 때의 숫자 값입니다.",
        children: [
          el("div", {
            class: `db-ws-readout db-ws-readout-${kind.kind}`,
            dataset: { testid: `db-${kind.kind}-runtime-value` },
            text: flagRuntimeValue(kind, record.id),
          }),
        ],
        testid: `db-${kind.kind}-runtime-card`,
      }),
      usageCard(kind, record.id, usage),
      sectionCard({
        title: `${kind.label} 범위 이름 변경`,
        hint: "시작 번호부터 개수만큼 접두사를 붙여 한 번에 이름을 매깁니다.",
        children: [rangeControls(kind, rerender)],
        testid: `db-${kind.kind}-range-card`,
      }),
      storyFlagList(),
      sectionCard({
        title: "삭제",
        hint: "되돌리려면 Ctrl+Z 를 누르세요.",
        children: [flagDeleteButton(kind, record, rerender)],
        testid: `db-${kind.kind}-delete-card`,
      }),
    ],
  });
}

/**
 * 사용처. 예전에는 "이벤트/조건이 이 스위치를 사용 중입니다" 한 줄이 전부라, 정작
 * 어느 맵의 어느 이벤트인지 알 수 없어 찾아갈 수가 없었다(감사 E 축 1/3). 실제 위치를
 * 나열한다 — 삭제 가드가 참조를 막을 때 무엇을 먼저 끊어야 하는지도 여기서 보인다.
 */
function usageCard(kind: FlagKind, id: string, fallbackMessage: string | null): HTMLElement {
  const locations = switchVariableReferenceLocations(store.getCurrent(), kind.kind, id);
  const rows = locations.map((location) => {
    const [where, what] = location.kind === "mapEvent"
      ? [location.mapName, `${location.eventName} (${location.eventId})`]
      : location.kind === "commonEvent"
        ? ["공용 이벤트", `${location.eventName} (${location.eventId})`]
        : ["전투 이벤트", `${location.troopName} · ${location.pageName}`];
    return el("div", {
      class: "db-ws-usage-row",
      children: [
        el("span", { class: "db-ws-usage-where", text: where }),
        el("span", { class: "db-ws-usage-what", text: what }),
      ],
    });
  });

  const body = rows.length > 0
    ? rows
    : [el("p", {
      class: `db-ws-usage${fallbackMessage ? " db-ws-usage-active" : ""}`,
      text: fallbackMessage ?? `아직 이 ${kind.label}를 쓰는 이벤트·조건이 없습니다.`,
    })];

  // 참조 위치를 못 잡는 경로(생활 기술 보상·지역 해금·꾸러미 보상)는 문구로만 오므로
  // 목록이 비어 있어도 메시지가 있으면 함께 보여 준다.
  if (rows.length > 0 && fallbackMessage) {
    body.push(el("p", { class: "db-ws-usage db-ws-usage-active", text: fallbackMessage }));
  }

  return sectionCard({
    title: "사용처",
    hint: rows.length > 0 ? `${rows.length}곳` : undefined,
    children: [el("div", {
      class: "db-ws-usage-list",
      dataset: { testid: `db-${kind.kind}-usage` },
      children: body,
    })],
    testid: `db-${kind.kind}-usage-card`,
  });
}

function flagNameField(kind: FlagKind, record: { readonly id: string; readonly name: string }): HTMLElement {
  const input = el("input", {
    attrs: { type: "text" },
    dataset: { testid: "db-utility-selected-name" },
    value: record.name,
  });
  input.addEventListener("input", () => flagRename(kind, record.id, input.value));
  return field(kind.nameLabel, input);
}

function flagDeleteButton(
  kind: FlagKind,
  record: { readonly id: string; readonly name: string },
  rerender: () => void,
): HTMLElement {
  return twoStepDeleteButton({
    className: "db-ws-btn db-ws-btn-danger",
    testid: "db-utility-selected-delete",
    onDelete: () => flagDelete(kind, record.id),
    onDeleted: () => {
      if (selectedSwitchId === record.id) selectedSwitchId = "";
      if (selectedVariableId === record.id) selectedVariableId = "";
      rerender();
    },
  });
}

// ---------------------------------------------------------------------------
// 용어
//
// 예전에는 fieldset 4 개를 세로로 늘어놓은 폼 덤프였다. 여기 있는 값은 전부 **실제
// 게임 화면에 그대로 찍히는 문자열**인데(전투 명령 메뉴, 상점 인사말, 여관 예/아니오,
// HP/MP/레벨 라벨), 미리보기가 하나도 없어서 '포획' 을 고쳐도 전투 메뉴가 어떻게 보일지
// 알 수 없었다(감사 F 축 0/3). 이제 분류 레일 + 전체 검색 + 라이브 미리보기를 준다.
// ---------------------------------------------------------------------------

type TermGroup = {
  readonly id: string;
  readonly label: string;
  readonly eyebrow: string;
  readonly hint: string;
  readonly entries: readonly { readonly key: TermKey; readonly label: string; readonly testid?: string }[];
};

const TERM_GROUPS: readonly TermGroup[] = [
  {
    id: "battle",
    label: "전투",
    eyebrow: "전투",
    hint: "전투 중 명령 메뉴와 대상 선택에 쓰이는 말입니다.",
    entries: [
      { key: "attack", label: "공격" },
      { key: "skill", label: "스킬", testid: "db-field-skill-term" },
      { key: "item", label: "아이템" },
      { key: "capture", label: "포획" },
      { key: "back", label: "뒤로" },
      { key: "target", label: "대상" },
    ],
  },
  {
    id: "shop",
    label: "상점",
    eyebrow: "상점",
    hint: "상점 창의 인사말과 버튼 문구입니다.",
    entries: [
      { key: "shopGreeting", label: "인사" },
      { key: "shopBuy", label: "구입" },
      { key: "shopSell", label: "판매" },
      { key: "shopCancel", label: "취소" },
      { key: "shopSellPrompt", label: "판매 질문" },
    ],
  },
  {
    id: "inn",
    label: "여관",
    eyebrow: "여관",
    hint: "여관 숙박 확인 창의 문구입니다.",
    entries: [
      { key: "innTitle", label: "제목" },
      { key: "yes", label: "예" },
      { key: "no", label: "아니오" },
      { key: "notEnoughGold", label: "소지금 부족" },
    ],
  },
  {
    id: "common",
    label: "공통",
    eyebrow: "공통",
    hint: "상태 창과 금액 표시에 두루 쓰이는 라벨입니다.",
    entries: [
      { key: "gold", label: "돈 단위", testid: "db-field-gold" },
      { key: "goldPrefix", label: "돈 접두사" },
      { key: "level", label: "레벨" },
      { key: "hp", label: "HP" },
      { key: "mp", label: "MP" },
    ],
  },
];

let selectedTermGroupId = TERM_GROUPS[0].id;
let termSearch = "";

function termValue(key: TermKey): string {
  return store.getCurrent().meta.terms[key] ?? defaultTermValue(key);
}

export function renderTermsTab(host: HTMLElement, rerender?: () => void): void {
  const repaint = rerender ?? (() => {
    // 탭 렌더러가 rerender 를 안 넘겨주는 경로(용어는 원래 정적 폼이었다)를 위해
    // 호스트만 다시 그린다. 스토어 변경은 필드가 직접 커밋하므로 여기서는 UI 만 갱신.
    host.replaceChildren();
    renderTermsTab(host);
  });

  const query = termSearch.trim().toLowerCase();
  const matches = (entry: { readonly key: TermKey; readonly label: string }): boolean =>
    query === ""
    || entry.label.toLowerCase().includes(query)
    || entry.key.toLowerCase().includes(query)
    || termValue(entry.key).toLowerCase().includes(query);

  const searching = query !== "";
  const visibleGroups = TERM_GROUPS
    .map((group) => ({ group, entries: group.entries.filter(matches) }))
    .filter((slot) => !searching || slot.entries.length > 0);

  if (!visibleGroups.some((slot) => slot.group.id === selectedTermGroupId)) {
    selectedTermGroupId = visibleGroups[0]?.group.id ?? TERM_GROUPS[0].id;
  }
  const active = visibleGroups.find((slot) => slot.group.id === selectedTermGroupId);

  const list = listPane({
    title: "용어 분류",
    count: `${TERM_KEYS.length}개`,
    search: listSearch({
      placeholder: "용어 검색",
      value: termSearch,
      testid: "db-terms-search",
      onInput: (value) => {
        termSearch = value;
        repaint();
      },
    }),
    rows: visibleGroups.map((slot) => listRow({
      name: slot.group.label,
      sub: searching ? `${slot.entries.length}건` : undefined,
      number: `${slot.group.entries.length}`,
      active: slot.group.id === selectedTermGroupId,
      testid: `db-terms-group-${slot.group.id}`,
      onSelect: () => {
        selectedTermGroupId = slot.group.id;
        repaint();
      },
    })),
    empty: emptyState({ icon: "⌕", title: "검색 결과가 없습니다", compact: true }),
    testid: "db-terms-list-pane",
  });

  // 분류를 골라 보게 하되, **네 그룹의 입력을 전부 DOM 에 만들고** 비활성 그룹만
  // `hidden` 으로 감춘다. 이유가 둘이다:
  //  1) db-field-gold / db-field-skill-term 같은 testid 는 서로 다른 그룹에 흩어져
  //     있는데, 탭 계약(databaseRecordPartialRender.test.ts:242, qa-system.spec.ts:112)은
  //     용어 탭이 열리면 값을 읽을 수 있다고 본다.
  //  2) 20 개 입력을 다 만들어도 비용이 없다. 지연 생성할 이유가 없다.
  const detail = active
    ? makeDetailPane({
      hero: detailHero({
        eyebrow: active.group.eyebrow,
        title: `${active.group.label} 용어`,
        subtitle: active.group.hint,
        tags: [`${active.entries.length}개 항목`],
        testid: "db-terms-hero",
      }),
      body: visibleGroups.map((slot) => {
        const editor = termEditor(slot.group, slot.entries);
        if (slot.group.id !== active.group.id) editor.setAttribute("hidden", "");
        return editor;
      }),
      testid: "db-terms-detail-pane",
    })
    : makeDetailPane({
      body: emptyState({ icon: "⌕", title: "검색 결과가 없습니다", body: `"${termSearch}" 와 일치하는 용어가 없습니다.` }),
      testid: "db-terms-detail-pane",
    });

  // 예전 마크업의 `db-detail-form` 계약(databaseRecordPartialRender.test.ts 등)은
  // 상세 창 안쪽에 그대로 살려 둔다.
  detail.querySelector(".db-ws-detail-body")?.setAttribute("data-testid", "db-detail-form");
  host.append(workspaceShell({ list, detail, testid: "db-terms-workspace" }));
}

/**
 * 문구 카드 + 미리보기 카드. 타이핑 중에는 **미리보기 노드만** 갈아끼운다 — 탭 전체를
 * 다시 그리면 입력 포커스와 캐럿을 잃는다(예전 검색 입력이 겪던 문제와 같은 함정).
 */
function termEditor(group: TermGroup, entries: readonly { readonly key: TermKey; readonly label: string; readonly testid?: string }[]): HTMLElement {
  const preview = el("div", { class: "db-term-preview", dataset: { testid: "db-terms-preview" } });
  const paintPreview = (): void => preview.replaceChildren(...termPreviewRows(group.id));
  paintPreview();

  return el("div", {
    class: "db-ws-stack db-terms-group",
    dataset: { groupId: group.id },
    children: [
      sectionCard({
        title: "문구",
        hint: "비워 두면 기본값이 그대로 쓰입니다.",
        children: entries.map((entry) => termField({
          label: entry.label,
          key: entry.key,
          testid: entry.testid,
          onCommit: paintPreview,
        })),
        testid: `db-terms-fields-${group.id}`,
      }),
      sectionCard({
        title: "미리보기",
        hint: "지금 값으로 게임 화면에 이렇게 나옵니다.",
        children: [preview],
        testid: "db-terms-preview-card",
      }),
      overriddenTermsCard(),
    ],
  });
}

/**
 * 프로젝트 전체에서 기본값을 덮어쓴 용어만 모아 보여준다. 분류를 하나씩 눌러 보지 않고도
 * "이 게임이 손댄 말"이 한눈에 들어와야 한다 — 스무 개 중 몇 개만 바꾸는 게 보통이다.
 */
function overriddenTermsCard(): HTMLElement {
  const terms = store.getCurrent().meta.terms;
  const changed = TERM_GROUPS.flatMap((group) =>
    group.entries
      .filter((entry) => {
        const value = terms[entry.key];
        return value !== undefined && value.trim().length > 0 && value !== defaultTermValue(entry.key);
      })
      .map((entry) => ({ group, entry, value: terms[entry.key] as string })),
  );

  const body = changed.length === 0
    ? [el("p", { class: "db-ws-usage", text: "아직 바꾼 용어가 없습니다 — 전부 기본값을 씁니다." })]
    : changed.map(({ group, entry, value }) => el("div", {
      class: "db-term-diff-row",
      children: [
        el("span", { class: "db-term-diff-group", text: group.label }),
        el("span", { class: "db-term-diff-label", text: entry.label }),
        el("s", { class: "db-term-diff-from", text: defaultTermValue(entry.key) }),
        el("strong", { class: "db-term-diff-to", text: value }),
      ],
    }));

  return sectionCard({
    title: "바꾼 용어",
    hint: `${changed.length} / ${TERM_KEYS.length}개`,
    children: [el("div", { class: "db-term-diff", dataset: { testid: "db-terms-overrides" }, children: body })],
    testid: "db-terms-overrides-card",
  });
}

/**
 * 라이브 미리보기. 실제 런타임 창을 띄우는 대신, 같은 문자열로 조립한 축소 모형을
 * 보여준다 — '포획' 을 고치면 전투 명령 목록이 즉시 바뀌는 게 보여야 한다.
 */
function termPreviewRows(groupId: string): readonly HTMLElement[] {
  const rows: HTMLElement[] = [];
  const menu = (title: string, items: readonly string[]): HTMLElement => el("div", {
    class: "db-term-preview-window",
    children: [
      el("div", { class: "db-term-preview-title", text: title }),
      el("ul", {
        class: "db-term-preview-menu",
        children: items.map((item) => el("li", { class: "db-term-preview-item", text: item })),
      }),
    ],
  });
  const line = (title: string, text: string): HTMLElement => el("div", {
    class: "db-term-preview-window",
    children: [
      el("div", { class: "db-term-preview-title", text: title }),
      el("p", { class: "db-term-preview-line", text }),
    ],
  });

  if (groupId === "battle") {
    rows.push(menu("전투 명령", [
      termValue("attack"),
      termValue("skill"),
      termValue("item"),
      termValue("capture"),
      termValue("back"),
    ]));
    rows.push(line("대상 선택", `${termValue("target")}을(를) 고르세요`));
  } else if (groupId === "shop") {
    rows.push(line("상점 인사", termValue("shopGreeting")));
    rows.push(menu("상점 메뉴", [termValue("shopBuy"), termValue("shopSell"), termValue("shopCancel")]));
    rows.push(line("판매 질문", termValue("shopSellPrompt")));
  } else if (groupId === "inn") {
    rows.push(line(termValue("innTitle"), `하룻밤 묵으시겠습니까?`));
    rows.push(menu("선택", [termValue("yes"), termValue("no")]));
    rows.push(line("소지금 부족", termValue("notEnoughGold")));
  } else {
    rows.push(menu("상태 창", [
      `${termValue("level")} 12`,
      `${termValue("hp")}  248 / 248`,
      `${termValue("mp")}   64 / 64`,
    ]));
    rows.push(line("소지금", `${termValue("goldPrefix")} 1,250${termValue("gold")}`));
  }
  return rows;
}




/**
 * 범위 일괄 이름 매기기. `.db-range` 와 그 안 input 순서(시작/개수/접두사)는
 * qa-system.spec.ts / oprn-database-t1-easy-tabs.spec.ts 가 의존하는 계약이라 유지한다.
 * 예전에는 `<details>` 로 접혀 있어 존재 자체가 잘 안 보였는데, 이제 상세 창의
 * "범위 만들기" 서브탭이 그 역할을 한다.
 */
function rangeControls(kind: FlagKind, rerender: () => void): HTMLElement {
  const start = el("input", { attrs: { type: "number", min: "1", "aria-label": "시작 번호" }, value: 1 });
  const count = el("input", { attrs: { type: "number", min: "1", "aria-label": "개수" }, value: 10 });
  const prefix = el("input", { attrs: { type: "text", "aria-label": "이름 접두사" }, value: kind.rangePrefix });
  const button = el("button", {
    class: "db-ws-btn db-ws-btn-primary",
    text: "범위 적용",
    attrs: { type: "button" },
    dataset: { testid: `db-${kind.kind}-range-apply` },
    on: {
      click: () => {
        const startNumber = Number(start.value);
        if (kind.kind === "switch") {
          bulkRenameSwitches(startNumber, Number(count.value), prefix.value);
          selectedSwitchId = store.getCurrent().switches[startNumber - 1]?.id ?? selectedSwitchId;
        } else {
          bulkRenameVariables(startNumber, Number(count.value), prefix.value);
          selectedVariableId = store.getCurrent().variables[startNumber - 1]?.id ?? selectedVariableId;
        }
        rerender();
      },
    },
  });
  return el("div", {
    class: "db-range db-ws-range",
    children: [
      labelled("시작 번호", start),
      labelled("개수", count),
      labelled("이름 접두사", prefix),
      button,
    ],
  });
}

function labelled(text: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "db-ws-range-field",
    children: [el("span", { class: "db-ws-range-label", text }), control],
  });
}



type TwoStepDeleteButtonOptions = {
  readonly ariaLabel?: string;
  readonly className: string;
  readonly onDelete: () => DeleteResult;
  readonly onDeleted: () => void;
  readonly testid: string;
};

// 다른 레코드 탭과 동일한 2단계 확인 패턴 — 스위치/변수는 DatabaseCollection 밖이라
// 공용 deleteButton(databaseAdvancedRecordViews.ts)을 재사용할 수 없으므로 여기서
// 같은 계약을 재현한다(qa-system-report.md Minor: 2단계 확인 없음).
function twoStepDeleteButton(options: TwoStepDeleteButtonOptions): HTMLElement {
  let armedUntil = 0;
  let resetTimer: number | null = null;
  const button = el("button", {
    class: options.className,
    text: DELETE_IDLE_LABEL,
    attrs: { type: "button", ...(options.ariaLabel ? { "aria-label": options.ariaLabel } : {}) },
    dataset: { testid: options.testid },
    on: {
      click: () => {
        const now = Date.now();
        if (now > armedUntil) {
          armedUntil = now + DELETE_CONFIRM_WINDOW_MS;
          button.textContent = DELETE_CONFIRM_LABEL;
          button.classList.add("confirming");
          if (resetTimer !== null) window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            resetTimer = null;
            if (Date.now() >= armedUntil) {
              armedUntil = 0;
              button.textContent = DELETE_IDLE_LABEL;
              button.classList.remove("confirming");
            }
          }, DELETE_CONFIRM_WINDOW_MS + 100);
          return;
        }
        armedUntil = 0;
        button.textContent = DELETE_IDLE_LABEL;
        button.classList.remove("confirming");
        const result = options.onDelete();
        if (!result.ok) {
          toast(result.message, "error");
          return;
        }
        toast("삭제했습니다 — Ctrl+Z로 되돌릴 수 있습니다.", "ok");
        options.onDeleted();
      },
    },
  });
  return button;
}

function storyFlagList(): HTMLElement {
  const project = store.getCurrent();
  const flags = project.storyFlags ?? [];
  return el("section", {
    class: "db-story-flag-list",
    children: [
      el("div", { class: "db-utility-heading", text: "스토리 플래그 (읽기 전용)" }),
      ...(flags.length > 0
        ? flags.map((flag) => el("div", {
          class: "db-row db-story-flag-row",
          children: [
            el("span", { class: "db-id", text: storyFlagListLabel(project, flag) }),
            el("span", { class: "db-list-name", text: flag.description }),
          ],
        }))
        : [el("div", { class: "empty-hint", text: "등록된 스토리 플래그 없음" })]),
    ],
  });
}



function selectedRecordId(records: readonly { readonly id: string; readonly name: string }[], currentId: string): string {
  if (records.some((record) => record.id === currentId && record.name.trim().length > 0)) return currentId;
  return records.find((record) => record.name.trim().length > 0)?.id ?? "";
}

function focusPendingUtilityName(form: HTMLElement): void {
  if (!pendingUtilityFocusId) return;
  const input = form.querySelector<HTMLInputElement>("[data-testid='db-utility-selected-name']");
  input?.focus();
  pendingUtilityFocusId = "";
}



/**
 * 용어 한 줄. 입력 옆에 **기본값 대비 상태**를 붙인다 — 이 화면의 값은 전부 기본값을
 * 덮어쓰는 것이라, "내가 이걸 바꿨던가?" 와 "원래 뭐였지?" 가 가장 자주 나오는 질문이다.
 * 바꾼 항목만 되돌리기 버튼이 뜨고, 빈 값은 기본값으로 되돌아간다(기존 동작 유지).
 */
function termField(options: TermFieldOptions): HTMLElement {
  const fallback = defaultTermValue(options.key);
  const input = el("input", {
    attrs: { type: "text", placeholder: fallback },
    value: options.value ?? store.getCurrent().meta.terms[options.key] ?? "",
  });
  if (options.testid) input.dataset.testid = options.testid;

  const status = el("span", { class: "db-term-status", dataset: { testid: `db-term-status-${options.key}` } });
  const revert = el("button", {
    class: "db-term-revert",
    text: "되돌리기",
    attrs: { type: "button", title: `기본값 "${fallback}" 으로 되돌립니다` },
    dataset: { testid: `db-term-revert-${options.key}` },
  });

  const isOverridden = (): boolean => {
    const value = store.getCurrent().meta.terms[options.key];
    return value !== undefined && value.trim().length > 0 && value !== fallback;
  };
  const paintStatus = (): void => {
    const overridden = isOverridden();
    status.textContent = overridden ? `기본값 ${fallback}` : "기본값";
    status.classList.toggle("is-overridden", overridden);
    revert.hidden = !overridden;
  };

  const commit = (next: string): void => {
    recordCoalescedSnapshot(`db-utility:term:${options.key}`);
    store.update((project) => {
      if (next.trim().length === 0) delete project.meta.terms[options.key];
      else project.meta.terms[options.key] = next;
    });
    paintStatus();
    // 미리보기를 즉시 따라오게 한다. 입력 중 재렌더로 포커스를 잃지 않도록 미리보기
    // 노드만 갈아끼운다.
    options.onCommit?.();
  };

  input.addEventListener("input", () => commit(input.value));
  revert.addEventListener("click", () => {
    input.value = "";
    commit("");
  });
  paintStatus();

  const row = field(options.label, input);
  row.append(el("div", { class: "db-term-meta", children: [status, revert] }));
  return row;
}
