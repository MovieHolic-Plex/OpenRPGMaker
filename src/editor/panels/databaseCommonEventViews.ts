import {
  COMMON_EVENT_TRIGGER_OPTIONS,
  commonEventTriggerLabel,
} from "@/editor/panels/databaseDisplay";
import { duplicateInto } from "@/editor/databaseCopy";
import { emptyToUndefined, matchesNameOrId } from "@/editor/panels/databaseControls";
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
import { renderDatabaseCommandListEditor } from "@/editor/panels/databaseCommandListAdapter";
import { commonEventReferenceMessage } from "@/editor/databaseReferences";
import { commandRuntimeSupport } from "@/project/eventCommands/runtimeSupport";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { storyFlagOptionLabel } from "@/project/storyFlags";
import { store } from "@/project/store";
import type { Command, CommonEvent } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

const DELETE_CONFIRM_LABEL = "정말 삭제?";
const DELETE_IDLE_LABEL = "삭제";
const DELETE_CONFIRM_WINDOW_MS = 3000;
const ADD_LABEL = "+ 공통 이벤트 추가";

let selectedCommonEventId: string | null = null;
let commonEventSearch = "";

// ---------------------------------------------------------------------------
// 공통 이벤트 — 워크스페이스 프리미티브로 재조립 (2026-08 모던 개편)
//
// 감사에서 나온 것들:
//  - "+ 공통 이벤트 추가" 가 좁게 눌린 `.btn.small` 이라 라벨이 '추 가' 로 단어 중간에서
//    줄바꿈됐다. listToolbar 의 `.db-ws-btn` 은 white-space:nowrap + flex:0 0 auto 라
//    같은 폭에서도 안 깨진다.
//  - 목록 창에 검색이 없었고, 레코드가 0 이면 거대한 빈 상자만 남았다.
//  - 상세 창 빈 상태가 좌측 정렬 생 텍스트였다(다른 탭은 아이콘+CTA 카드).
//  - 본문의 68% 가 아무것도 없는 흰 면이었다 — 빈 상태에서도 트리거 3종과 호출 경로를
//    알려주는 온보딩 카드를 함께 보여 그 공간을 실제 정보로 채운다.
//
// 유지해야 하는 계약(스펙이 직접 의존):
//  - `.db-common-event-detail-pane .db-row input` = 이름, 그 안 첫 `select` = 트리거
//    (oprn-database-t1-easy-tabs.spec.ts)
//  - `.db-common-event-editor` 안의 `.db-row input` / `.db-field select` / 유일한
//    `input[type=checkbox]` / `.db-row button:has-text(삭제)` (qa-commonev.spec.ts)
//  - `.db-common-event-empty-editor` 와 정확히 "+ 공통 이벤트 추가" 라벨
//    (_db-audit-commands.spec.ts, databaseCommonEventViews.test.ts)
//  - `db-common-event-command-list` / `db-common-event-name` /
//    `db-common-event-duplicate` / `db-common-event-delete-<id>` testid
// ---------------------------------------------------------------------------

export function renderCommonEventsTab(host: HTMLElement, rerender: () => void): void {
  const commonEvents = store.getCurrent().commonEvents;
  if (!commonEvents.some((record) => record.id === selectedCommonEventId)) {
    selectedCommonEventId = commonEvents[0]?.id ?? null;
  }
  const selected = commonEvents.find((record) => record.id === selectedCommonEventId);
  const query = commonEventSearch.trim();

  // 0001:~0010: 빈 행은 실레코드가 아니다 — 클릭/편집이 전부 무반응인 순수 장식이었다
  // (qa-commonev-report.md 결함 3). 실제 레코드가 없으면 목록은 비워두고 빈 상태를 준다.
  const rows: HTMLElement[] = [];
  for (const [index, commonEvent] of commonEvents.entries()) {
    if (query && !matchesNameOrId(commonEvent.name, commonEvent.id, query)) continue;
    rows.push(commonEventListRow(commonEvent, index, commonEvent.id === selected?.id, rerender));
  }

  const list = listPane({
    title: "공통 이벤트",
    count: commonEvents.length,
    search: listSearch({
      placeholder: "공통 이벤트 검색",
      value: commonEventSearch,
      testid: "db-common-event-search",
      onInput: (value) => {
        commonEventSearch = value;
        rerender();
      },
    }),
    rows,
    empty: query.length > 0
      ? emptyState({ icon: "⌕", title: "검색 결과가 없습니다", body: `"${query}" 와 일치하는 공통 이벤트가 없습니다.`, compact: true })
      : emptyState({ icon: "⟳", title: "아직 공통 이벤트가 없습니다", compact: true }),
    toolbar: listToolbar([
      {
        label: ADD_LABEL,
        kind: "primary",
        title: "맵과 무관하게 어디서든 호출할 수 있는 이벤트를 만듭니다",
        onClick: () => addCommonEvent(rerender),
      },
      {
        label: "복제",
        testid: "db-common-event-duplicate",
        title: "선택한 공통 이벤트를 복사합니다",
        onClick: () => duplicateCommonEvent(rerender),
      },
    ]),
    testid: "db-common-event-list-pane",
  });

  const detail = selected
    ? makeDetailPane({
      hero: commonEventHero(selected, commonEvents.indexOf(selected)),
      body: commonEventEditor(selected, commonEvents.indexOf(selected), rerender),
      legacyClass: "db-common-event-detail-pane",
      testid: "db-detail-form",
    })
    : makeDetailPane({
      body: emptyCommonEventBody(rerender),
      legacyClass: "db-common-event-detail-pane",
      testid: "db-detail-form",
    });

  host.append(workspaceShell({ list, detail, testid: "db-common-events-workspace" }));
}

function addCommonEvent(rerender: () => void): void {
  const next: CommonEvent = {
    id: genId("ce"),
    name: "새 공통 이벤트",
    trigger: "none",
    commands: [{ kind: "text", body: "" }],
  };
  recordProjectSnapshot();
  store.update((project) => {
    project.commonEvents.push(next);
  });
  selectedCommonEventId = next.id;
  // 새 레코드가 검색 필터에 걸려 목록에서 사라지는 상황을 만들지 않는다.
  commonEventSearch = "";
  rerender();
}

function duplicateCommonEvent(rerender: () => void): void {
  const id = selectedCommonEventId;
  if (!id) return;
  const copyId = genId("ce");
  recordProjectSnapshot();
  store.update((project) => {
    duplicateInto(project.commonEvents, id, copyId);
  });
  selectedCommonEventId = copyId;
  commonEventSearch = "";
  rerender();
}

/**
 * 빈 상태. 예전에는 좌측 정렬 생 텍스트 3 줄이 1000×690 상세 창 왼쪽 위에 붙어 있고
 * 나머지가 전부 흰 면이었다(감사 H 축 68%). 정규 빈 상태 카드 + "트리거 3종 / 호출 경로"
 * 온보딩 카드로 바꿔, 처음 여는 사람이 여기서 뭘 해야 하는지 화면에서 바로 읽게 한다.
 */
function emptyCommonEventBody(rerender: () => void): readonly HTMLElement[] {
  const empty = emptyState({
    icon: "⟳",
    title: "아직 공통 이벤트가 없습니다",
    body: "공통 이벤트는 맵에 놓지 않고도 어디서든 부를 수 있는 이벤트입니다. 상점 정산, 하루 종료 처리처럼 여러 곳에서 반복되는 로직을 한 곳에 모아 두세요.",
    action: {
      label: "첫 공통 이벤트 만들기",
      kind: "primary",
      testid: "db-common-event-empty-create",
      onClick: () => addCommonEvent(rerender),
    },
  });
  // _db-audit-commands.spec.ts 가 이 클래스로 "빈 창에 안내가 있는가" 를 판정한다.
  empty.classList.add("db-common-event-empty-editor", "db-ws-span");

  return [
    el("div", {
      class: "db-ws-stack",
      children: [
        empty,
        sectionCard({
          title: "트리거 3종",
          hint: "언제 실행할지 정합니다. 만든 뒤에도 바꿀 수 있습니다.",
          children: TRIGGER_GUIDE.map((entry) => guideRow(entry.label, entry.detail)),
          testid: "db-common-event-trigger-guide",
        }),
        sectionCard({
          title: "어디서 부르나요",
          hint: "'호출' 트리거는 스스로 실행되지 않습니다 — 아래 경로 중 하나로 불러야 합니다.",
          children: CALL_GUIDE.map((entry) => guideRow(entry.label, entry.detail)),
          testid: "db-common-event-call-guide",
        }),
        sectionCard({
          title: "이런 데 씁니다",
          hint: "같은 로직이 두 군데 이상 필요해지면 공통 이벤트로 빼세요.",
          children: EXAMPLE_GUIDE.map((entry) => guideRow(entry.label, entry.detail)),
          testid: "db-common-event-example-guide",
        }),
        sectionCard({
          title: "만든 다음 할 일",
          hint: "레코드를 만들면 오른쪽 창이 편집기로 바뀝니다.",
          children: NEXT_STEP_GUIDE.map((entry) => guideRow(entry.label, entry.detail)),
          testid: "db-common-event-next-guide",
        }),
      ],
    }),
  ];
}

const TRIGGER_GUIDE: readonly { readonly label: string; readonly detail: string }[] = [
  { label: "호출", detail: "스스로 실행되지 않습니다. 다른 이벤트의 [공통 이벤트 호출] 명령으로만 실행됩니다." },
  { label: "자동 실행", detail: "조건 스위치가 켜져 있는 동안 맵에 들어가면 즉시 한 번 실행되고, 끝날 때까지 조작이 멈춥니다." },
  { label: "병렬 처리", detail: "조건 스위치가 켜져 있는 동안 플레이어 조작과 동시에 계속 돕니다. 타이머·날씨처럼 상시 감시에 씁니다." },
];

const CALL_GUIDE: readonly { readonly label: string; readonly detail: string }[] = [
  { label: "맵 이벤트 명령", detail: "이벤트 편집기에서 [공통 이벤트 호출] 을 넣고 이 레코드를 고릅니다." },
  { label: "조건 스위치", detail: "자동 실행·병렬 처리는 아래 [조건 스위치 사용] 에 스위치를 지정해 켜고 끕니다." },
  { label: "시스템 훅", detail: "하루 종료 같은 시스템 훅에 연결하면 해당 시점마다 실행됩니다." },
];

const EXAMPLE_GUIDE: readonly { readonly label: string; readonly detail: string }[] = [
  { label: "회복 지점", detail: "여관·세이브 포인트마다 같은 회복 연출을 붙일 때. 맵마다 복사하지 않고 한 번만 만듭니다." },
  { label: "퀘스트 판정", detail: "스위치·변수를 읽어 진행도를 갱신하는 로직. 대화 이벤트 여러 개가 같은 판정을 부릅니다." },
  { label: "상시 감시", detail: "병렬 처리로 소지금·시간·날씨를 감시해 조건이 맞으면 연출을 시작합니다." },
];

const NEXT_STEP_GUIDE: readonly { readonly label: string; readonly detail: string }[] = [
  { label: "1. 이름 짓기", detail: "이름은 [공통 이벤트 호출] 목록에 그대로 나옵니다 — '축복', '하루 종료'처럼 목적이 보이게 씁니다." },
  { label: "2. 명령 넣기", detail: "[이벤트 명령] 카드에서 위에서 아래로 실행할 명령을 쌓습니다. 맵 이벤트와 같은 편집기입니다." },
  { label: "3. 호출 연결", detail: "'호출' 이면 맵 이벤트에서 부르고, '자동 실행'·'병렬 처리' 면 조건 스위치를 지정합니다." },
];

function guideRow(label: string, detail: string): HTMLElement {
  return el("div", {
    class: "db-common-event-guide-row",
    children: [
      el("strong", { class: "db-common-event-guide-label", text: label }),
      el("p", { class: "db-ws-usage", text: detail }),
    ],
  });
}

function commonEventListRow(
  commonEvent: CommonEvent,
  index: number,
  isSelected: boolean,
  rerender: () => void
): HTMLElement {
  return listRow({
    name: commonEvent.name,
    sub: commonEventTriggerLabel(commonEvent.trigger),
    number: index + 1,
    active: isSelected,
    title: `${commonEvent.name} (${commonEvent.id})`,
    testid: `db-common-event-row-${commonEvent.id}`,
    dataset: { recordId: commonEvent.id },
    onSelect: () => {
      selectedCommonEventId = commonEvent.id;
      rerender();
    },
  });
}

function commonEventHero(commonEvent: CommonEvent, index: number): HTMLElement {
  return detailHero({
    eyebrow: "COMMON EVENT",
    title: commonEvent.name || "(이름 없음)",
    // 레코드 id 를 상세 창 텍스트로 노출한다 — 예전에는 목록 행의 title 속성에만 있었다.
    subtitle: commonEvent.id,
    tags: [
      `#${index + 1}`,
      commonEventTriggerLabel(commonEvent.trigger),
      `명령 ${commonEvent.commands.length}개`,
      commonEvent.conditionSwitchId ? "조건 스위치 사용" : "조건 없음",
    ],
    testid: "db-common-event-hero",
  });
}

function commonEventEditor(commonEvent: CommonEvent, index: number, rerender: () => void): HTMLElement {
  const commands = el("div", { class: "cmd-list", dataset: { testid: "db-common-event-command-list" } });
  renderDatabaseCommandListEditor(commands, {
    commands: commonEvent.commands,
    rerender,
    // 공통 이벤트 명령 배지는 common 컨텍스트 판정을 쓴다.
    runtimeSupport: (command) => commandRuntimeSupport(command, "common"),
    pickerContext: "common",
    replaceCommands: (next: Command[]) => updateCommonEventCommands(commonEvent.id, next),
  });

  const basics = sectionCard({
    title: "기본",
    hint: "이름은 [공통 이벤트 호출] 목록에 그대로 나옵니다.",
    children: [
      commonEventNameRow(commonEvent, index, rerender),
      commonEventTriggerControl(commonEvent),
      commonEventConditionSwitchControl(commonEvent),
    ],
    testid: "db-common-event-basics-card",
  });
  const commandsCard = sectionCard({
    title: "이벤트 명령",
    hint: "위에서 아래로 순서대로 실행됩니다.",
    children: [commands],
    testid: "db-common-event-commands-card",
  });

  const editor = el("section", {
    // `db-common-event-editor` 는 qa-commonev.spec.ts 의 앵커이자 05-dense-workbenches.css
    // 의 입력/명령 목록 스타일 훅이다 — 카드 스택 위에 그대로 유지한다.
    class: "db-common-event-editor db-ws-stack",
    children: [basics, commandsCard],
  });

  // 명령 목록이 상세 창의 남는 높이를 쓰게 한다. 프리미티브 기본값(카드 스택은
  // `align-content:start`, 명령 목록은 05-dense-workbenches.css 의 `max-height:420px`)으로
  // 두면 640px 짜리 인스펙터 안에 250px 카드 두 장만 떠 있고 아래 절반이 흰 면이 된다
  // (선택 상태 인스펙터 여백 88%). 여기 값들은 전부 이 뷰가 만든 노드에만 건다 —
  // 공용 스타일시트를 건드리지 않고 이 탭만 채우기 위해서다.
  editor.style.alignContent = "stretch";
  editor.style.flex = "1 1 auto";
  editor.style.gridTemplateRows = "auto minmax(0, 1fr)";
  editor.style.minHeight = "0";
  basics.style.alignSelf = "start";
  // 명령 목록은 이벤트 편집기와 같은 폭이 필요하다(들여쓰기 + 긴 명령 요약) — 한 행을 다 쓴다.
  commandsCard.classList.add("db-ws-span");
  commandsCard.style.alignContent = "stretch";
  commandsCard.style.gridTemplateRows = "auto minmax(0, 1fr)";
  commandsCard.style.minHeight = "0";
  const commandsBody = commandsCard.querySelector(".db-ws-card-body");
  if (commandsBody instanceof HTMLElement) {
    commandsBody.style.gridTemplateRows = "minmax(0, 1fr)";
    commandsBody.style.minHeight = "0";
  }
  commands.style.height = "100%";
  commands.style.maxHeight = "none";
  commands.style.minHeight = "0";
  return editor;
}

function updateCommonEventCommands(commonEventId: string, commands: Command[]): void {
  store.update((project) => {
    const target = project.commonEvents.find((record) => record.id === commonEventId);
    if (target) target.commands = structuredClone(commands);
  });
}

function commonEventNameRow(commonEvent: CommonEvent, index: number, rerender: () => void): HTMLElement {
  return namedRow(
    `#${index + 1}`,
    commonEvent.id,
    commonEvent.name,
    (value) => {
      // 텍스트 입력 스트림 — 키 입력마다 호출되므로 커밋 단위(1 스냅샷)로 병합한다.
      recordCoalescedSnapshot(`db-commonevent:name:${commonEvent.id}`);
      store.update((project) => {
        const target = project.commonEvents.find((record) => record.id === commonEvent.id);
        if (target) target.name = value;
      });
    },
    () => commonEventReferenceMessage(commonEvent.id),
    () => {
      const remaining = store.getCurrent().commonEvents.filter((record) => record.id !== commonEvent.id);
      selectedCommonEventId = remaining[0]?.id ?? null;
      recordProjectSnapshot();
      store.update((project) => {
        project.commonEvents = project.commonEvents.filter((record) => record.id !== commonEvent.id);
      });
      toast("삭제했습니다 — Ctrl+Z로 되돌릴 수 있습니다.", "ok");
      rerender();
    }
  );
}

function commonEventTriggerControl(commonEvent: CommonEvent): HTMLElement {
  const select = el("select");
  for (const option of COMMON_EVENT_TRIGGER_OPTIONS) {
    select.append(el("option", { text: option.label, attrs: { value: option.value } }));
  }
  select.value = commonEvent.trigger;
  select.addEventListener("change", () => {
    const next = COMMON_EVENT_TRIGGER_OPTIONS.find((option) => option.value === select.value);
    if (!next) return;
    recordProjectSnapshot();
    store.update((project) => {
      const target = project.commonEvents.find((record) => record.id === commonEvent.id);
      if (target) target.trigger = next.value;
    });
  });
  return el("label", { class: "db-field", children: [el("span", { text: "트리거" }), select] });
}

function commonEventConditionSwitchControl(commonEvent: CommonEvent): HTMLElement {
  const checkbox = el("input", { attrs: { type: "checkbox" } });
  const project = store.getCurrent();
  const select = numberedSelect(project.switches, commonEvent.conditionSwitchId ?? "");
  checkbox.checked = !!commonEvent.conditionSwitchId;
  select.disabled = !checkbox.checked;
  const apply = () => {
    select.disabled = !checkbox.checked;
    recordProjectSnapshot();
    store.update((project) => {
      const target = project.commonEvents.find((record) => record.id === commonEvent.id);
      if (target) target.conditionSwitchId = checkbox.checked ? emptyToUndefined(select.value) : undefined;
    });
  };
  checkbox.addEventListener("change", apply);
  select.addEventListener("change", apply);
  return el("label", {
    class: "db-field db-checkbox-field",
    children: [el("span", { text: "조건 스위치 사용" }), checkbox, select],
  });
}

function numberedSelect(options: readonly { readonly id: string; readonly name: string }[], value: string): HTMLSelectElement {
  const project = store.getCurrent();
  const select = el("select");
  select.append(el("option", { text: "(없음)", attrs: { value: "" } }));
  for (const [index, option] of options.entries()) {
    select.append(el("option", { text: storyFlagOptionLabel(project, "switch", option, index), attrs: { value: option.id } }));
  }
  select.value = value;
  return select;
}

// 다른 레코드 탭과 동일한 2단계 확인 패턴 — 공통 이벤트는 DatabaseCollection 밖이라
// 공용 deleteButton을 재사용할 수 없으므로 이 뷰에서 같은 계약을 재현한다.
// checkBlocked는 참조 가드(commonEventReferenceMessage) 결과를 매 클릭마다 재확인한다
// (armed 상태에서도 그 사이 참조가 생겼을 수 있으므로).
function namedRow(
  ordinal: string,
  id: string,
  name: string,
  onName: (value: string) => void,
  checkBlocked: () => string | null,
  performDelete: () => void
): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, value: name, dataset: { testid: "db-common-event-name" } });
  input.addEventListener("input", () => onName(input.value));

  let armedUntil = 0;
  let resetTimer: number | null = null;
  const deleteButton = el("button", {
    class: "db-ws-btn db-ws-btn-danger",
    text: DELETE_IDLE_LABEL,
    attrs: { type: "button" },
    dataset: { testid: `db-common-event-delete-${id}` },
    on: {
      click: () => {
        const blocked = checkBlocked();
        if (blocked) {
          toast(blocked, "error");
          return;
        }
        const now = Date.now();
        if (now > armedUntil) {
          armedUntil = now + DELETE_CONFIRM_WINDOW_MS;
          deleteButton.textContent = DELETE_CONFIRM_LABEL;
          deleteButton.classList.add("confirming");
          if (resetTimer !== null) window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            resetTimer = null;
            if (Date.now() >= armedUntil) {
              armedUntil = 0;
              deleteButton.textContent = DELETE_IDLE_LABEL;
              deleteButton.classList.remove("confirming");
            }
          }, DELETE_CONFIRM_WINDOW_MS + 100);
          return;
        }
        armedUntil = 0;
        deleteButton.textContent = DELETE_IDLE_LABEL;
        deleteButton.classList.remove("confirming");
        performDelete();
      },
    },
  });
  // 05-dense-workbenches.css:610 은 이 행을 `52px | 1fr | auto | 76px` 그리드로 잡는다.
  // 예전 DOM 순서(input, 번호, 삭제)는 이름 입력을 52px 열에 밀어 넣어 두 글자도 안 보였다.
  // 번호를 먼저 두면 그리드/flex 어느 쪽으로 계산되든 이름이 넓은 열을 차지한다.
  return el("div", {
    class: "db-row",
    children: [
      el("span", { class: "db-id", text: ordinal }),
      input,
      deleteButton,
    ],
  });
}
