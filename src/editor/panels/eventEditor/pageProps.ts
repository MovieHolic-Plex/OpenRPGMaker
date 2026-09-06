import { renderDetectionEncounter } from "./pageNpcBehavior";
import { renderObjectInteraction } from "./pageHorror";
import { hasRecursivePageCondition, type EventDraftValidation } from "@/editor/eventDraftValidator";
import { el } from "@/util/dom";
import { renderEditorIcon } from "./editorIcons";
import {
  addEventPage,
  addEventPageCommand,
  copyEventPage,
  copyEventPageToClipboard,
  deleteEventPage,
  hasCopiedEventPage,
  moveEventPage,
  normalizeEventPage,
  pasteEventPage,
  subscribeCopiedEventPage,
  triggerFromKind,
  updateEventPage,
} from "@/editor/eventPages";
import { editorState } from "@/editor/editorState";
import { showConfirm } from "@/editor/ui/modal";
import { toast } from "@/util/toast";
import { updateEvent } from "@/editor/eventActions";
import { setEventDraftCharacterName } from "@/editor/eventDraftActions";
import { eventDraftCharacterName } from "@/project/eventDraftAuthored";
import { storyFlagOptionLabel } from "@/project/storyFlags";
import { store } from "@/project/store";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { openNewEventCommandKindDialog } from "./commandEditDialog";
import { renderEventGraphicPreview } from "./eventGraphicPreview";
import { openNpcGraphicDialog } from "./graphicDialog";
import { renderPageAnimationType } from "./pageAnimationType";
import { renderPageConditions } from "./pageConditions";
import { pageConditionSentence } from "./pageConditionSentence";
import { renderPageFootprint } from "./pageFootprint";
import { UNIT_FOOTPRINT, normalizeCharacterFootprint, normalizePassRows } from "@/project/footprint";
import { renderPageMovement } from "./pageMovement";
import { openPageTabContextMenu } from "./pageTabContextMenu";
import { enablePageTabDrag, enablePageTabDropTarget } from "./pageTabDragDrop";
import {
  type EventEditorTriggerKind,
  EVENT_PRIORITY_OPTIONS,
  PAGE_COMMAND_BUTTONS,
  TRIGGER_OPTIONS,
  commandKindLabel,
  compareAmountLabel,
  runResultLabel,
  timerIdLabel,
} from "./options";
import { openCharacterIdPicker } from "./characterIdPickerDialog";
import { attachCharacterIdAutocomplete } from "./characterIdAutocomplete";
import type { Command, EventPage, EventPageCondition, GameEvent, MapId, Trigger } from "@/project/types";
import {
  activeEventRailGroup,
  activeRailGroupSlug,
  bindEventSectionOpenState,
  eventEditorOpenKey,
  openEventConditions,
  openEventMovement,
} from "./eventEditorOpenState";

import { relationshipStateName } from "@/project/relationshipState";
export function renderEventNameControl(
  mapId: MapId,
  eventId: string,
  page: EventPage,
): HTMLElement {
  const name = el("input", {
    attrs: { type: "text", placeholder: "이벤트 이름" },
    value: page.name,
    dataset: { testid: "event-page-name-input" },
  }) as HTMLInputElement;
  name.addEventListener("change", () => updateEventPage(mapId, eventId, page.id, { name: name.value }));
  return el("div", {
    class: "event-editor-identity-row",
    dataset: { testid: "event-classic-name" },
    children: [
      el("label", {
        class: "event-editor-name-field",
        children: [el("span", { text: "이벤트 이름" }), name],
      }),
    ],
  });
}

/**
 * 페이지 관리 버튼 줄. 탭 바로 오른쪽에 **접힌 것 없이** 서있다.
 *
 * 예전엔 모달 오른쪽 끝의 접힌 `<details>`(`페이지 ▾`) 었다 — 실측(1600×1000): 탭 줄은
 * x=12..639 인데 이 개출석은 x=1514 에 있었고 기본 상태가 닫힘이라 복사·삭제가 화면에
 * 아예 없었다. 기능이 없다고 재발견되는 이유다.
 *
 * 계약:
 * - 여섯 버튼은 **항상 마운트**된다. 못 쓰는 상황은 `disabled` + 이유를 담은 `title` 이다 —
 *   조건부 마운트는 버튼이 나타났다 사라지며 이웃 버튼 자리를 밀어 혼동을 만들었다.
 * - 복제/붙여넣기/삭제/순서는 상태를 실제로 바꿨을 때만 `toast` 로 결과를 말한다.
 */
export function renderPageActions(mapId: MapId, ev: GameEvent, activePage: EventPage): HTMLElement {
  const wrap = el("div", {
    class: "event-page-tabs event-page-actions-row",
    dataset: { testid: "event-page-tabs" },
  });
  const pages = ev.pages ?? [];
  const activeIndex = pages.findIndex((page) => page.id === activePage.id);
  const canPaste = hasCopiedEventPage();
  const canDelete = pages.length > 1;
  const canMoveBack = activeIndex > 0;
  const canMoveForward = activeIndex >= 0 && activeIndex < pages.length - 1;
  const rerender = () => wrap.replaceWith(renderPageActions(mapId, ev, activePage));
  // 클립보드는 store 도 editorState 도 아니어서 아무도 "이제 붙여넣을 게 있다"를 듣지 못했다.
  // 버튼으로 복사하든 탭 우클릭 메뉴로 복사하든 이 한 경로로 다시 그려진다 — 예전엔 버튼만
  // 자기 핸들러에서 다시 그렸고, 메뉴가 암묵적으로 의지하던 선택 변경은 이미 활성인 페이지를
  // 복사하면 no-op 이라 "복사했어요" 토스트와 동시에 붙여넣기가 버튼이 끌진 채로 남았다.
  const unsubscribeClipboard = subscribeCopiedEventPage(() => {
    unsubscribeClipboard();
    // happy-dom · 브라우저만 `isConnected` 를 주므로 값이 없는 환경(페이크 DOM)은 연결로 본다.
    if (wrap.isConnected === false) return;
    rerender();
  });

  const actions: HTMLElement[] = [
    pageButton(
      "복제",
      "event-page-duplicate",
      "이 페이지를 바로 앞(낮은 우선순위)에 하나 더 만들어요",
      () => {
        if (!copyEventPage(mapId, ev.id, activePage.id)) return;
        toast(`"${activePage.name}" 페이지를 바로 앞(낮은 우선순위)에 복제했어요 — 지금은 원본이 먼저 이겨요.`, "ok");
      },
      false,
      "페이지 복제"
    ),
    pageButton(
      "복사",
      "event-page-copy",
      "이 페이지를 복사해 둔다 — 다른 이벤트에도 붙여넣을 수 있어요",
      () => {
        if (!copyEventPageToClipboard(mapId, ev.id, activePage.id)) return;
        toast(`"${activePage.name}" 페이지를 복사해 뒀어요. 붙여넣기로 사용하세요.`, "ok");
      },
      false,
      "페이지 복사"
    ),
    pageButton(
      "붙여넣기",
      "event-page-paste",
      canPaste
        ? "복사해 둔 페이지를 지금 페이지 바로 앞(낮은 우선순위)에 넣어요"
        : "붙여넣을 페이지가 없어요. 먼저 복사를 누르세요",
      () => {
        if (!pasteEventPage(mapId, ev.id)) return;
        toast("복사해 둔 페이지를 바로 앞(낮은 우선순위)에 붙여넣었어요.", "ok");
      },
      !canPaste,
      "페이지 붙여넣기"
    ),
    pageButton(
      "←",
      "event-page-move-back",
      canMoveBack
        ? "이 페이지를 한 칸 앞으로 — 뒤에 있는 페이지가 먼저 이깁니다"
        : "이미 첫 페이지예요",
      () => {
        if (!moveEventPage(mapId, ev.id, activePage.id, -1)) return;
        toast(`"${activePage.name}" 페이지를 앞으로 옮겼어요.`, "ok");
      },
      !canMoveBack,
      "페이지를 앞으로 이동",
      "move"
    ),
    pageButton(
      "→",
      "event-page-move-forward",
      canMoveForward
        ? "이 페이지를 한 칸 뒤로 — 뒤에 있을수록 조건이 맞을 때 이깁니다"
        : "이미 마지막 페이지예요",
      () => {
        if (!moveEventPage(mapId, ev.id, activePage.id, 1)) return;
        toast(`"${activePage.name}" 페이지를 뒤로 옮겼어요.`, "ok");
      },
      !canMoveForward,
      "페이지를 뒤로 이동",
      "move"
    ),
    pageButton(
      "삭제",
      "event-page-delete",
      canDelete ? "이 페이지와 여기 들어있는 명령을 지워요" : "페이지가 하나뿐이라 지울 수 없어요",
      () => void requestEventPageDeletion(mapId, ev.id, activePage),
      !canDelete,
      "페이지 삭제",
      "danger"
    ),
  ];

  wrap.append(
    el("span", {
      class: "event-page-actions-label",
      text: "페이지",
      attrs: { "aria-hidden": "true" },
      dataset: { testid: "event-classic-page-controls" },
    }),
    el("div", {
      class: "event-page-action-buttons",
      attrs: { role: "group", "aria-label": "페이지 관리" },
      dataset: { count: String(actions.length) },
      children: actions,
    })
  );
  return wrap;
}

export async function requestEventPageDeletion(
  mapId: MapId,
  eventId: string,
  page: EventPage
): Promise<boolean> {
  const confirmed = await showConfirm({
    title: "페이지 삭제",
    message: `"${page.name}" 페이지와 그 안의 모든 명령을 삭제할까요?`,
    confirmLabel: "삭제",
    cancelLabel: "취소",
    danger: true,
  });
  if (!confirmed) return false;
  if (!deleteEventPage(mapId, eventId, page.id)) return false;
  toast(`"${page.name}" 페이지를 지웠어요.`, "ok");
  return true;
}

export function renderClassicPageTabStrip(
  mapId: MapId,
  ev: GameEvent,
  activePage: EventPage,
  validation?: EventDraftValidation,
): HTMLElement {
  const pages = ev.pages ?? [];
  const pageButtons = el("div", {
    class: "evt-page-segments",
    attrs: { role: "tablist", "aria-label": "이벤트 페이지" },
    dataset: { testid: "evt-header-page-tabs" },
  });
  const canDrag = pages.length > 1;
  pages.forEach((page, index) => {
    const isActive = page.id === activePage.id;
    const pageErrors = validation?.issues.filter((i) => i.pageId === page.id && (i.severity === "error" || i.severity === "warning")).length ?? 0;
    const tab = el("button", {
      class: "btn evt-page-segment" + (isActive ? " active" : ""),
      dataset: { testid: `evt-page-segment-${index + 1}`, pageId: page.id },
      attrs: {
        type: "button",
        role: "tab",
        // role=tab 은 aria-selected 만 사용한다. aria-pressed 는 toggle 버튼 속성이라 같이 쓰면
        // 스크린리더가 "눌림/선택됨"을 이중으로 읽는다.
        "aria-selected": isActive ? "true" : "false",
        // roving tabindex: 탭 줄 전제가 Tab 하나로 진입하고 방향키로 움직인다.
        tabindex: isActive ? "0" : "-1",
        title: pageTabTooltip(page, index, canDrag),
      },
      children: [
        el("span", { class: "evt-page-segment-number", text: String(index + 1) }),
        el("span", { class: "evt-page-segment-title", text: (page.name ?? "").trim() || `페이지 ${index + 1}` }),
        el("span", {
          class: "evt-page-segment-cond",
          text: pageTabConditionText(page),
          dataset: { testid: `evt-page-cond-${index + 1}` },
        }),
        ...(pageErrors > 0 ? [el("i", { class: "warn" })] : []),
      ],
      on: {
        click: (event) => {
          const button = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
          const container = button?.parentElement;
          container?.querySelectorAll<HTMLElement>(".evt-page-segment").forEach((node) => {
            const active = node === button;
            node.classList.toggle("active", active);
            node.setAttribute("aria-selected", active ? "true" : "false");
            node.setAttribute("tabindex", active ? "0" : "-1");
          });
          editorState.set({ selectedEventPageId: page.id });
        },
        keydown: (event) => handlePageTabKeydown(event, mapId, ev, pages, index),
        contextmenu: (event) => {
          if (!(event instanceof MouseEvent)) return;
          event.preventDefault();
          openPageTabContextMenu({
            x: event.clientX,
            y: event.clientY,
            mapId,
            event: ev,
            page,
            index,
            requestDelete: (target) => void requestEventPageDeletion(mapId, ev.id, target),
          });
        },
      },
    }) as HTMLButtonElement;
    enablePageTabDrag(tab, { mapId, eventId: ev.id, page, canDrag });
    enablePageTabDropTarget(tab, { mapId, eventId: ev.id, pageId: page.id, pages });
    pageButtons.append(tab);
  });
  pageButtons.append(
    el("button", {
      class: "btn evt-page-segment-add",
      text: "+",
      attrs: { type: "button", title: "새 페이지 추가", "aria-label": "새 페이지 추가" },
      dataset: { testid: "evt-page-add" },
      on: { click: () => addEventPage(mapId, ev.id) },
    })
  );

  const warningCount = validation?.warningCount ?? 0;
  if (warningCount > 0) {
    pageButtons.append(
      el("div", {
        class: "pages-meta",
        children: [el("span", { class: "warn-text", text: `경고 ${warningCount}` })],
      })
    );
  }

  return pageButtons;
}

/**
 * 탭 줄 방향키 이동(WAI-ARIA tablist 계약). 예전엔 `role="tab"` 을 달고도 tabindex와
 * 방향키 처리가 없어서 키보드만으로는 페이지를 바꿀 수 없었다(실측: ArrowRight 를 눌러도
 * 포커스·선택 모두 제자리).
 *
 * Ctrl/Cmd 를 같이 누르면 이동 대신 **순서를 바꾼다** — 뒤에 있는 페이지가 이기므로
 * 저작자가 자주 하는 작업이다.
 */
function handlePageTabKeydown(
  event: Event,
  mapId: MapId,
  ev: GameEvent,
  pages: readonly EventPage[],
  index: number
): void {
  if (!(event instanceof KeyboardEvent)) return;
  const reorder = event.ctrlKey || event.metaKey;
  let nextIndex: number | null = null;
  switch (event.key) {
    case "ArrowLeft":
      nextIndex = index - 1;
      break;
    case "ArrowRight":
      nextIndex = index + 1;
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = pages.length - 1;
      break;
    default:
      return;
  }
  if (nextIndex === null || nextIndex < 0 || nextIndex >= pages.length) return;
  event.preventDefault();
  const page = pages[index];
  if (!page) return;
  if (reorder && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    if (!moveEventPage(mapId, ev.id, page.id, event.key === "ArrowLeft" ? -1 : 1)) return;
    toast(`"${page.name}" 페이지를 ${event.key === "ArrowLeft" ? "앞" : "뒤"}로 옮겼어요.`, "ok");
    focusRenderedPageTab(page.id);
    return;
  }
  const target = pages[nextIndex];
  if (!target) return;
  editorState.set({ selectedEventPageId: target.id });
  focusRenderedPageTab(target.id);
}

/** 상태 구독 렌더가 기존 탭 트리를 교체한 뒤 새로 마운트된 같은 페이지 탭을 찾는다. */
function focusRenderedPageTab(pageId: string): void {
  for (const tab of document.querySelectorAll<HTMLElement>(".evt-page-segment[data-page-id]")) {
    if (tab.dataset.pageId !== pageId) continue;
    tab.focus({ preventScroll: true });
    return;
  }
}

function pageTabConditionText(page: EventPage): string {
  const conditions = page.conditions ?? [];
  if (conditions.length === 0) return "조건 없음";
  const first = pageConditionCompactSummary(conditions[0]!);
  return conditions.length === 1 ? first : `${first} 외 ${conditions.length - 1}`;
}

function pageTabTooltip(page: EventPage, index: number, canDrag: boolean): string {
  const name = (page.name ?? "").trim() || "(이름 없음)";
  const conditions = page.conditions ?? [];
  const summary = conditions.length > 0 ? conditions.map(pageConditionSummary).join(" / ") : "조건 없음";
  const dragHint = canDrag ? "\n끌어다 놓아 순서를 바꿉니다 (뒤에 있을수록 조건이 맞을 때 이깁니다)" : "";
  return `페이지 ${index + 1} — ${name}\n${summary}${dragHint}`;
}

function pageConditionSummary(condition: EventPageCondition): string {
  switch (condition.kind) {
    case "switch":
      return `${switchVariableName("switch", condition.switchId).replace(/^\d{4}:\s*/u, "")} ${condition.value ? "켜짐" : "꺼짐"}`;
    case "variable":
      return `${switchVariableName("variable", condition.variableId).replace(/^\d{4}:\s*/u, "")} ${compareAmountLabel(condition.op, condition.value)}`;
    case "selfSwitch":
      return `이 이벤트 기억 ${condition.key} ${condition.value ? "켜짐" : "꺼짐"}`;
    case "actor":
      return `주인공 [${recordName(store.getCurrent().database.actors, condition.actorId)}] ${condition.present ? "파티에 있음" : "파티에 없음"}`;
    case "item":
      return `아이템 ${recordName(store.getCurrent().database.items, condition.itemId)} ${condition.present ? "보유 중" : "보유 안 함"}`;
    case "gold":
      return `소지금 ${compareAmountLabel(condition.op, condition.amount)}`;
    case "timer":
      return `${timerIdLabel(condition.timerId)} ${condition.seconds}초 이하`;
    case "timePhase":
      return `시간대 ${timePhaseLabel(condition.phase)}`;
    case "season":
      return `계절 ${seasonLabel(condition.season)}`;
    case "npcActivity":
      return `활동 ${condition.activity}`;
    case "friendshipAtLeast":
      return `호감도 ${condition.npcKey || "이 이벤트"} ${condition.value} 이상`;
    case "relationshipAtLeast":
      return `관계 ${condition.npcKey || "이 이벤트"} ${relationshipStateName(condition.state)} 이상`;
    case "battleResult":
      return `전투 ${condition.result === "victory" ? "승리" : condition.result === "defeat" ? "패배" : "도망"}`;
    case "run":
      return runConditionText(condition);
    case "all":
      return condition.conditions.length ? `모두 맞을 때(${condition.conditions.length})` : "모두 맞을 때(없음)";
    case "any":
      return condition.conditions.length ? `하나라도 맞을 때(${condition.conditions.length})` : "하나라도 맞을 때(없음)";
    case "not":
      return "아닐 때";
  }
}

function pageConditionCompactSummary(condition: EventPageCondition): string {
  switch (condition.kind) {
    case "switch": {
      const named = switchVariableName("switch", condition.switchId).replace(/^\d{4}:\s*/u, "").trim();
      return `${named || "스위치"} ${condition.value ? "켜짐" : "꺼짐"}`;
    }
    case "selfSwitch":
      return `이 이벤트 기억 ${condition.key} ${condition.value ? "켜짐" : "꺼짐"}`;
    case "variable": {
      const named = switchVariableName("variable", condition.variableId).replace(/^\d{4}:\s*/u, "").trim();
      return `${named || "변수"} ${compareAmountLabel(condition.op, condition.value)}`;
    }
    case "item":
      return condition.present ? "아이템 보유 중" : "아이템 보유 안 함";
    case "actor":
      return condition.present ? "파티에 있음" : "파티에 없음";
    case "gold": {
      return `소지금 ${compareAmountLabel(condition.op, condition.amount)}`;
    }
    case "timer":
      return `${timerIdLabel(condition.timerId)} ${condition.seconds}초`;
    default:
      return pageConditionBadgeText(condition);
  }
}

function timePhaseLabel(phase: Extract<EventPageCondition, { kind: "timePhase" }>["phase"]): string {
  switch (phase) {
    case "morning":
      return "아침";
    case "day":
      return "낮";
    case "evening":
      return "저녁";
    case "night":
      return "밤";
  }
}

function seasonLabel(season: Extract<EventPageCondition, { kind: "season" }>["season"]): string {
  switch (season) {
    case "spring":
      return "봄";
    case "summer":
      return "여름";
    case "fall":
      return "가을";
    case "winter":
      return "겨울";
  }
}

function switchVariableName(kind: "switch" | "variable", id: string): string {
  const project = store.getCurrent();
  const records = kind === "switch" ? project.switches : project.variables;
  const index = records.findIndex((record) => record.id === id);
  return index >= 0 ? storyFlagOptionLabel(project, kind, records[index]!, index) : id;
}

function recordName(records: readonly { id: string; name: string }[], id: string): string {
  return records.find((record) => record.id === id)?.name ?? id;
}

/**
 * 한 동작은 모든 표면에서 **한 단어**만 쓴다(버튼·좁은 포트·우클릭 메뉴 동일).
 *
 * 예전엔 좁은 포트에서 `font-size: 0` 으로 진짜 텍스트를 집어삼키고 `::after` 로 다른 말을
 * 그렸다 — 화면엔 «보관», DOM 과 접근성 이름은 «복사해 두기» 여서 보이는 라벨이 접근성 이름에
 * 들어 있지 않았고(WCAG 2.5.3 Label in Name 실패), 음성 제어가 «복사해 두기 클릭» 을 못 찾았다.
 * 짧은 단어 하나로 통일해 지우기·다시 그리기 자심를 없었다. 복제·복사·붙여넣기의 시각 구분은
 * 장식용 CSS 글리프(`::before`)가 맡는다 — 라벨 텍스트를 건드리지 않는다.
 */
function pageButton(
  text: string,
  testId: string,
  title: string,
  onClick?: () => void,
  disabled = false,
  accessibleName?: string,
  variant?: "move" | "danger"
): HTMLButtonElement {
  const attrs: Record<string, string> = {
    type: "button",
    title,
    "aria-label": accessibleName ?? text,
    draggable: "false",
  };
  if (disabled) attrs.disabled = "";
  const variantClass = variant ? ` event-page-action-${variant}` : "";
  // 이동 화살표는 글리프 문자가 아니라 SVG 로 — 접근성 이름은 accessibleName 이 이미 말한다.
  const arrowIcon = text === "←" ? "arrowLeft" : text === "→" ? "arrowRight" : null;
  return el("button", {
    class: `btn event-page-action-button${variantClass} ${disabled ? "disabled" : ""}`,
    children: [arrowIcon ? renderEditorIcon(arrowIcon) : el("span", { class: "event-page-button-label", text })],
    dataset: { testid: testId },
    attrs,
    on: {
      // 복제 글리프(⧉)와 짧은 라벨은 브라우저가 기본 텍스트/링크 드래그로 가져간다.
      // 떨어뜨린 곳이 주소창·파일 대화상자면 「브라우즈」로 이어지고, 클릭(복제)은 삼킨다.
      dragstart: (event) => event.preventDefault(),
      ...(onClick
        ? {
            click: (event) => {
              event.preventDefault();
              event.stopPropagation();
              onClick();
            },
          }
        : {}),
    },
  }) as HTMLButtonElement;
}

export function renderPageCommandCatalog(
  mapId: MapId,
  eventId: string,
  page: EventPage,
  resolvePageId: () => string | null = () => page.id,
): HTMLElement {
  const wrap = el("div", {
    class: "panel-section page-command-catalog",
    dataset: { testid: "page-command-catalog" },
  });
  wrap.append(el("h3", { text: "명령 삽입" }));
  const row = el("div", { class: "command-catalog-row" });
  for (const button of PAGE_COMMAND_BUTTONS) {
    row.append(
      el("button", {
        class: "btn small",
        text: button.label,
        dataset: { testid: button.testId },
        on: {
          click: () => {
            const pageId = resolvePageId();
            if (!pageId) return;
            openNewEventCommandKindDialog(button.kind, (command) =>
              addEventPageCommand(mapId, eventId, pageId, command)
            );
          },
        },
      })
    );
  }
  wrap.append(row, renderPageCommandSummary(page));
  return wrap;
}

export function renderPageCommandSummary(page: EventPage): HTMLElement {
  return el("div", {
    class: "empty-hint",
    text: page.commands.map((command) => commandLabel(command.kind)).join(" -> "),
    dataset: { testid: "page-command-summary" },
  });
}

function commandLabel(kind: Command["kind"]): string {
  return commandKindLabel(kind);
}

const CHARACTER_ID_HELP =
  "NPC 관계를 연결하면 같은 캐릭터가 등장하는 여러 이벤트에서 호감도와 선물 기록을 공유합니다.";

export function renderEventCharacterIdField(mapId: MapId, event: GameEvent): HTMLElement {
  const characterId = event.characterId?.trim();
  const profileName = characterId
    ? eventDraftCharacterName(store.getCurrent(), event, characterId).trim()
    : "";
  const connected = Boolean(characterId);
  const openPicker = () => openCharacterIdPicker({
    mapId,
    eventId: event.id,
    currentId: characterId,
  });

  return el("div", {
    class: `event-character-id-field event-character-id-field-inline ${connected ? "is-linked" : "is-unlinked"}`,
    dataset: { testid: "event-character-id-field" },
    children: [
      el("span", {
        class: "event-character-id-label-text",
        text: "NPC 관계",
        attrs: { title: CHARACTER_ID_HELP },
      }),
      el("button", {
        class: `event-character-link-control ${connected ? "is-linked" : "is-unlinked"}`,
        attrs: {
          type: "button",
          title: connected ? `${CHARACTER_ID_HELP} 클릭하여 연결을 변경합니다.` : CHARACTER_ID_HELP,
          "aria-label": connected
            ? `NPC 관계 연결됨: ${profileName || characterId}. 연결 변경`
            : "NPC 관계 연결 안 됨. 호감도와 선물 기능 연결",
        },
        dataset: {
          testid: connected ? "event-character-id-picker-open" : "event-character-id-connect",
        },
        on: { click: openPicker },
        children: [
          el("span", {
            class: "event-character-link-dot",
            attrs: { "aria-hidden": "true" },
          }),
          el("span", {
            class: "event-character-link-copy",
            children: [
              el("strong", {
                text: connected ? (profileName || characterId || "") : "연결 안 됨",
              }),
              el("small", {
                text: connected
                  ? (profileName ? characterId : "호감도 · 선물 기록 공유 중")
                  : "현재는 일회용 이벤트",
              }),
            ],
          }),
          el("span", {
            class: "event-character-link-action",
            text: connected ? "변경" : "연결",
          }),
        ],
      }),
    ],
  });
}

export function renderEventCharacterSocialExtras(mapId: MapId, event: GameEvent): HTMLElement | null {
  const characterId = event.characterId?.trim();
  if (!characterId) return null;

  const talkCheckbox = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "event-talk-friendship-checkbox" },
  }) as HTMLInputElement;
  talkCheckbox.checked = event.talkFriendship === true
    || (typeof event.talkFriendship === "object" && event.talkFriendship !== null);
  talkCheckbox.addEventListener("change", () => {
    updateEvent(mapId, event.id, { talkFriendship: talkCheckbox.checked ? true : undefined });
  });

  const profileName = eventDraftCharacterName(store.getCurrent(), event, characterId);
  const characterIdInput = el("input", {
    attrs: {
      type: "text",
      placeholder: "예: village_herbalist",
      title: "같은 연결 키를 쓰는 이벤트끼리 호감도와 선물 기록을 공유합니다.",
      spellcheck: "false",
    },
    value: characterId,
    dataset: { testid: "event-character-id-input" },
  }) as HTMLInputElement;
  characterIdInput.addEventListener("change", () => {
    const next = characterIdInput.value.trim() || undefined;
    updateEvent(
      mapId,
      event.id,
      next ? { characterId: next } : { characterId: undefined, talkFriendship: undefined },
    );
  });
  const characterIdInputRow = el("span", {
    class: "event-character-id-input-row",
    children: [characterIdInput],
  });
  attachCharacterIdAutocomplete({
    input: characterIdInput,
    getProject: () => store.getCurrent(),
    onSelect: () => {},
  });

  const displayNameInput = el("input", {
    attrs: {
      type: "text",
      placeholder: "게임에 표시할 이름",
    },
    value: profileName,
    dataset: { testid: "event-character-display-name-input" },
  }) as HTMLInputElement;
  displayNameInput.addEventListener("change", () => {
    setEventDraftCharacterName(mapId, event.id, characterId, displayNameInput.value);
  });

  return el("details", {
    class: "event-character-social-extras event-character-social-disclosure",
    dataset: { testid: "event-character-social-extras" },
    children: [
      el("summary", {
        class: "event-character-social-header",
        children: [
          el("div", {
            class: "event-character-social-heading",
            children: [
              el("span", { text: "NPC 관계 설정" }),
              el("strong", { text: profileName.trim() || characterId }),
            ],
          }),
          el("span", {
            class: "event-character-social-status",
            text: "연결됨",
          }),
        ],
      }),
      el("div", {
        class: "event-character-social-body",
        children: [
          el("label", {
            class: "event-talk-friendship-label",
            dataset: { testid: "event-talk-friendship-field" },
            children: [
              talkCheckbox,
              el("span", {
                class: "event-character-social-option-copy",
                children: [
                  el("strong", { text: "대화 보너스" }),
                  el("small", { text: "하루 첫 대화에 호감도를 올립니다." }),
                ],
              }),
            ],
          }),
          el("label", {
            class: "event-character-display-name-label",
            dataset: { testid: "event-character-display-name-field" },
            children: [
              el("span", { text: "표시 이름" }),
              displayNameInput,
            ],
          }),
          el("details", {
            class: "event-character-social-advanced",
            dataset: { testid: "event-character-social-advanced" },
            children: [
              el("summary", {
                children: [
                  el("span", { text: "고급 설정" }),
                  el("code", { text: characterId }),
                ],
              }),
              el("div", {
                class: "event-character-social-advanced-body",
                children: [
                  el("label", {
                    class: "event-character-id-advanced-label",
                    children: [
                      el("span", { text: "연결 키" }),
                      characterIdInputRow,
                    ],
                  }),
                  el("p", {
                    text: "같은 키를 쓰는 이벤트끼리 호감도와 선물 기록을 공유합니다.",
                  }),
                  el("button", {
                    class: "btn small danger event-character-social-unlink",
                    text: "연결 해제",
                    attrs: { type: "button" },
                    dataset: { testid: "event-character-social-unlink" },
                    on: {
                      click: () => updateEvent(mapId, event.id, {
                        characterId: undefined,
                        talkFriendship: undefined,
                      }),
                    },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function triggerLabel(trigger: Trigger): string {
  switch (trigger.kind) {
    case "action": return "말을 걸면";
    case "touch":
    case "playerTouch": return "닿으면";
    case "eventTouch": return "이벤트가 닿으면";
    case "auto": return "자동 실행";
    case "parallel": return "병렬 처리";
  }
}

function priorityLabel(priority: EventPage["priority"]): string {
  switch (priority) {
    case "same": return "같은 층";
    case "below": return "아래";
    case "above": return "위";
  }
}

export function renderEventPageProps(mapId: MapId, eventId: string, page: EventPage, event?: GameEvent): HTMLElement {
  page = normalizeEventPage(page);
  const wrap = el("div", { class: "event-page-props", dataset: { testid: "event-page-props" } });
  const trigger = selectWithOptions(TRIGGER_OPTIONS, eventEditorTriggerKind(page.trigger), "event-page-trigger-select");
  trigger.addEventListener("change", () => {
    const kind = selectedOptionValue(trigger, TRIGGER_OPTIONS, eventEditorTriggerKind(page.trigger));
    updateEventPage(mapId, eventId, page.id, { trigger: triggerFromKind(kind) });
  });

  const priority = selectWithOptions(EVENT_PRIORITY_OPTIONS, page.priority, "event-page-priority-select");
  priority.addEventListener("change", () => {
    updateEventPage(mapId, eventId, page.id, {
      priority: selectedOptionValue(priority, EVENT_PRIORITY_OPTIONS, page.priority),
    });
  });

  const overlap = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "event-page-overlap-forbidden" },
  }) as HTMLInputElement;
  overlap.checked = page.overlapForbidden ?? true;
  // 런타임 통행 판정은 `priority === "same" && overlapForbidden` 이다 — 다른 층에서는 이 체크가
  // 아무 일도 하지 않는다. 살아있는 것처럼 보이게 두면 «켰는데 안 막힌다» 가 된다.
  overlap.disabled = !overlapForbiddenApplies(page);
  overlap.addEventListener("change", () => {
    updateEventPage(mapId, eventId, page.id, { overlapForbidden: overlap.checked });
  });

  const openKey = eventEditorOpenKey(mapId, eventId, page.id);
  const conditions = page.conditions ?? [];

  const presence = el("div", {
    class: "presence",
    children: [
      el("div", {
        class: "sprite",
        children: [renderEventGraphicPreview(page.graphic, page.movement.type)],
      }),
      el("div", {
        children: [
          el("div", { class: "kicker", text: "이 페이지" }),
          el("div", { class: "value", text: triggerLabel(page.trigger) }),
          el("div", { class: "sub", text: `${priorityLabel(page.priority)} · ${movementTypeChipLabel(page.movement.type)}` }),
        ],
      }),
    ],
  });

  const factOverlap = el("div", {
    class: "fact",
    dataset: { testid: "event-page-fact-overlap" },
    children: [
      el("label", { text: "겹침" }),
      el("span", { class: "chip", text: overlapSummary(page) }),
    ],
  });

  wrap.append(
    presence,
    factOverlap,
    collapsibleSection({
      title: "조건",
      testId: "event-classic-conditions",
      openSet: openEventConditions,
      openKey,
      summaryExtra: renderConditionSummaryBadges(conditions),
      body: el("div", {
        class: "event-conditions-body",
        children: [
          renderConditionSentence(conditions),
          el("div", { class: "event-conditions-grid", children: renderPageConditions(mapId, eventId, page, event) }),
        ],
      }),
    }),
    rm2k3Fieldset("모습", graphicControl(mapId, eventId, page), "event-classic-graphic"),
    rm2k3Fieldset("크기와 통행", renderPageFootprint(mapId, eventId, page), "event-classic-footprint"),
    el("div", {
      class: "event-page-behavior-sections",
      dataset: { testid: "event-page-trigger-priority-stack" },
      children: [
        rm2k3Fieldset("시작 방식", trigger, "event-classic-trigger"),
        renderEventPageSafetyWarning(page),
      ],
    }),
    // 우선순위와 겹침은 한 판정식(`priority === "same" && overlapForbidden`)의 두 반쪽이다.
    // 예전에는 우선순위가 «언제 보이나요» 그룹, 겹침이 «겹침과 통행» 그룹에 떨어져 있어서
    // 저작자가 둘의 관계를 볼 수 없었다.
    el("div", {
      class: "event-page-behavior-sections",
      dataset: { testid: "event-page-priority-overlap-stack" },
      children: [
        rm2k3Fieldset("우선순위", priority, "event-classic-priority"),
        rm2k3Fieldset(
          "겹침",
          el("div", {
            class: "event-priority-block",
            children: [
              el("label", {
                class: "event-overlap-label",
                attrs: { title: "켜면 다른 주인공·NPC 가 이 칸을 지나갈 수 없습니다" },
                children: [overlap, el("span", { text: "겹침 금지(같은 칸 통행 차단)" })],
              }),
              renderOverlapPriorityHint(page),
            ],
          }),
          "event-classic-overlap"
        ),
      ],
    }),
    collapsibleSection({
      title: "움직임",
      testId: "event-classic-movement-section",
      openSet: openEventMovement,
      openKey,
      summaryExtra: renderMovementSummaryChips(page),
      body: el("div", {
        class: "event-page-movement-stack",
        children: [
          rm2k3Fieldset("물체 동작", renderObjectInteraction(mapId, eventId, page), "event-classic-object-interaction"),
          rm2k3Fieldset("플레이어 발견", renderDetectionEncounter(mapId, eventId, page), "event-classic-detection"),
          rm2k3Fieldset("이동 유형", renderPageMovement(mapId, eventId, page), "event-classic-movement-type"),
          rm2k3Fieldset("애니메이션 유형", renderPageAnimationType(mapId, eventId, page), "event-classic-animation-type"),
          rm2k3Fieldset("이동 속도", movementSpeedSelect(mapId, eventId, page), "event-classic-movement-speed"),
        ],
      }),
    })
  );
  return wrapPageSettingsAsAccordion(wrap, page, conditions, openKey);
}

/**
 * 켜진 조건을 한 문장으로 되읽어 준다.
 *
 * 조건 12행을 다 채워도 "그래서 이 페이지는 언제 보이지?"는 저작자가 머릿속에서
 * 조립해야 했다. 저장 직전에 눈으로 확인할 한 줄이 없었다. 값 조각만 강조해
 * 무엇이 저작자가 고른 값인지 구분한다.
 */
function renderConditionSentence(conditions: readonly EventPageCondition[]): HTMLElement {
  const sentence = pageConditionSentence(conditions);
  return el("p", {
    class: `event-conditions-sentence${conditions.length === 0 ? " is-empty" : ""}`,
    dataset: { testid: "event-conditions-sentence" },
    children: sentence.parts.map((part) =>
      part.kind === "value"
        ? el("em", { class: "event-conditions-sentence-value", text: part.text })
        : el("span", { text: part.text }),
    ),
  });
}

type EventRailGroupSpec = {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly open: boolean;
  /**
   * 저작자가 이 그룹에 손댄 값이 있는가(기본값이 아닌가).
   *
   * 레일은 한 번에 한 그룹만 연다 — 나머지 넷은 접혀 있으므로, 어디에 내용이 있는지
   * 열어 보지 않고 알 수 있어야 한다.
   */
  readonly authored?: boolean;
};

/**
 * 레일 그룹 한 칸.
 *
 * 예전에는 `<details>/<summary>` 였고 본문이 233px 컬럼 안에서 그대로 펼쳐졌다. 조건 12행이
 * 그 폭에 들어가지 못해 라벨과 컨트롤이 서로를 밀어냈고(실측 잘림 3건), 레일 높이는 1370px 로
 * 흘러넘쳤다. 지금은 `<div>/<button>` 이고, CSS 가 헤더를 좌측 레일에·본문을 우측 넓은 면에
 * 배치한다(`display: contents`). 한 번에 한 그룹만 열린다.
 *
 * DOM 계층(그룹이 헤더와 본문을 모두 소유)은 그대로다 — 그룹 소속 계약을 고정한
 * `eventRailGroupComposition.test.ts` 가 이에 의존한다.
 */
function railGroup(spec: EventRailGroupSpec, body: HTMLElement, openKey: string): HTMLElement {
  const header = el("button", {
    class: "event-editor-settings-accordion-header event-editor-settings-accordion-summary",
    attrs: { type: "button", "aria-expanded": spec.open ? "true" : "false" },
    children: [
      el("span", {
        class: "event-editor-settings-accordion-title",
        children: [
          el("span", { text: spec.title }),
          ...(spec.authored
            ? [el("i", {
                class: "event-editor-settings-accordion-dot",
                attrs: { title: "이 그룹에 설정한 값이 있습니다", "aria-label": "설정 있음" },
                dataset: { testid: `evt-rail-dot-${spec.slug}` },
              })]
            : []),
        ],
      }),
      el("span", {
        class: "event-editor-settings-accordion-meta",
        text: spec.summary,
        dataset: { testid: `evt-rail-meta-${spec.slug}` },
      }),
    ],
  });
  const group = el("div", {
    class: `event-editor-settings-accordion-group${spec.open ? " is-open" : ""}`,
    dataset: { testid: `evt-rail-group-${spec.slug}`, railGroup: spec.slug },
    children: [header, body],
  });
  header.addEventListener("click", () => selectRailGroup(group, spec.slug, openKey));
  return group;
}

/** 형제 그룹을 모두 닫고 이 그룹만 연다. 다시 그리지 않으므로 포커스·스크롤이 유지된다. */
function selectRailGroup(group: HTMLElement, slug: string, openKey: string): void {
  const rail = group.parentElement;
  if (!rail) return;
  for (const sibling of Array.from(rail.children)) {
    if (!(sibling instanceof HTMLElement)) continue;
    const active = sibling === group;
    sibling.classList.toggle("is-open", active);
    sibling
      .querySelector(".event-editor-settings-accordion-header")
      ?.setAttribute("aria-expanded", active ? "true" : "false");
  }
  activeEventRailGroup.set(openKey, slug);
}

/**
 * 이 앵커를 가진 레일 그룹을 열어 준다. 그룹은 `<details>` 가 아니라 CSS 해생(`is-open`) 이라
 * 검증 이슈 네뱄게이션의 details 여는 로직은 그룹을 못 여는다 — 닫힌 그룹 속 입력에 포서스를 주면
 * 사용자 눈에는 아무 일도 안 어나나는 것으로 보인다.
 */
export function openEventRailGroupFor(target: HTMLElement): void {
  const group = target.closest<HTMLElement>(".event-editor-settings-accordion-group");
  const slug = group?.dataset.railGroup;
  if (!group || !slug) return;
  selectRailGroup(group, slug, group.parentElement?.dataset.railKey ?? "");
}

export function appendEventRailGroup(
  propsRoot: HTMLElement,
  spec: EventRailGroupSpec,
  nodes: readonly HTMLElement[],
): void {
  const rail = propsRoot.querySelector<HTMLElement>(".event-editor-settings-accordion");
  if (!rail || nodes.length === 0) return;
  const body = el("div", { class: "event-editor-settings-accordion-body" });
  nodes.forEach((node) => body.append(node));
  const openKey = rail.dataset.railKey ?? "";
  // 나중에 붙는 그룹(NPC와 일정)도 저장된 활성 slug 를 존중해야 한다.
  const open = activeEventRailGroup.get(openKey) === spec.slug;
  const group = railGroup({ ...spec, open }, body, openKey);
  rail.append(group);
  if (open) selectRailGroup(group, spec.slug, openKey);
}

function wrapPageSettingsAsAccordion(
  source: HTMLElement,
  page: EventPage,
  conditions: EventPageCondition[],
  openKey: string,
): HTMLElement {
  const look = Array.from(source.querySelectorAll<HTMLElement>(".presence, [data-testid='event-classic-graphic']"));
  const when = Array.from(source.querySelectorAll<HTMLElement>("[data-testid='event-classic-conditions'], [data-testid='event-page-trigger-priority-stack']"));
  const move = Array.from(source.querySelectorAll<HTMLElement>("[data-testid='event-classic-movement-section']"));
  // 우선순위는 겹침과 한 판정식이라 memory 그룹이 함께 claim 한다(예전에는 when 그룹이었다).
  // 「크기와 통행」도 같은 그룹이다 — 미분류로 남기면 "기타" 그룹이 생겨 레일이 4칸 계약을
  // 깬다(eventRailGroupComposition.test.ts 가 그 계약을 고정한다).
  const memory = Array.from(source.querySelectorAll<HTMLElement>("[data-testid='event-page-priority-overlap-stack'], [data-testid='event-classic-overlap'], [data-testid='event-classic-footprint'], [data-testid='event-page-fact-overlap']"));
  // 레일은 한 번에 한 그룹만 연다 — 저장된 활성 slug 가 없으면 「모습과 대화」로 시작한다.
  const activeSlug = activeRailGroupSlug(openKey, "look-talk");
  const groups = [
    { slug: "look-talk", title: "모습과 대화", summary: page.graphic.sprite ? "그래픽 있음" : "그래픽 없음", authored: Boolean(page.graphic.sprite), nodes: look },
    { slug: "when", title: "언제 보이나요", summary: conditions.length === 0 ? "조건 없음" : `조건 ${conditions.length}개`, authored: conditions.length > 0, nodes: when },
    // RM 계약상 새 이벤트의 기본 이동은 «정지»다. 그 밖이면 저작자가 고른 값이다.
    { slug: "move", title: "움직임과 속도", summary: movementSummaryText(page), authored: page.movement.type !== "fixed", nodes: move },
    // 기본값은 «캐릭터와 같은 층 + 겹침 금지 + 1x1 몸». 통행을 허용했거나 층을 옮겼거나
    // 몸을 키웠다면 손댄 것이다.
    {
      slug: "memory",
      title: "겹침과 통행",
      summary: passageRailSummary(page),
      authored: page.overlapForbidden === false || page.priority !== "same" || bodyAuthored(page),
      nodes: memory,
    },
  ].map((group) => ({ ...group, open: group.slug === activeSlug }));
  const rail = el("div", {
    class: "event-editor-settings-accordion",
    dataset: { testid: "event-editor-settings-accordion", railKey: openKey },
  });
  const claimed = new Set<HTMLElement>();
  for (const group of groups) {
    const body = el("div", { class: "event-editor-settings-accordion-body" });
    for (const node of group.nodes) {
      const closestHost = node.closest(".event-page-props > *");
      const host = node.parentElement === source
        ? node
        : closestHost instanceof HTMLElement
          ? closestHost
          : node;
      if (claimed.has(host) || host.parentElement !== source) continue;
      claimed.add(host);
      body.append(host);
    }
    rail.append(railGroup(group, body, openKey));
  }
  const leftovers = Array.from(source.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child !== rail,
  );
  if (leftovers.length > 0) {
    const body = el("div", { class: "event-editor-settings-accordion-body" });
    leftovers.forEach((child) => body.append(child));
    rail.append(railGroup({ slug: "other", title: "기타", summary: `분류 없음 ${leftovers.length}개`, open: false }, body, openKey));
  }
  rail.querySelectorAll("details").forEach((node) => {
    if (node.classList.contains("event-editor-settings-accordion-group")) return;
    const replacement = el("div", {
      class: node.className,
      dataset: Object.fromEntries(
        Object.entries(node.dataset).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      ),
    });
    Array.from(node.childNodes).forEach((child) => replacement.append(child));
    node.replaceWith(replacement);
  });
  source.replaceChildren(rail);
  return source;
}

const CONDITION_BADGE_LIMIT = 3;

/** 겹침 금지가 실제로 통행을 막는 조건. 런타임 판정식과 같은 자리에서 한 번만 정한다. */
function overlapForbiddenApplies(page: EventPage): boolean {
  return page.priority === "same";
}

/** 우선순위 select 에 실제로 적힌 라벨. 안내문이 화면과 다른 말을 쓰면 안 된다. */
function priorityOptionLabel(priority: EventPage["priority"]): string {
  return EVENT_PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? priorityLabel(priority);
}

function overlapSummary(page: EventPage): string {
  if (!overlapForbiddenApplies(page)) return `${priorityOptionLabel(page.priority)} · 통행 허용`;
  return page.overlapForbidden !== false ? "겹침 금지" : "겹침 허용";
}

/**
 * 우선순위가 «같은 층» 이 아닐 때 겹침 체크가 왜 죽어 있는지 말해 준다.
 * 자리는 항상 잡아 둔다 — 나타났다 사라지면 레일 높이가 튄다.
 */
function renderOverlapPriorityHint(page: EventPage): HTMLElement {
  const applies = overlapForbiddenApplies(page);
  return el("p", {
    class: `event-page-overlap-hint${applies ? " is-quiet" : ""}`,
    dataset: { testid: "event-page-overlap-priority-hint" },
    text: applies
      ? "같은 층이므로 이 설정이 통행 판정에 쓰입니다."
      : `우선순위가 «${priorityOptionLabel(page.priority)}» 라 통행을 막지 않습니다. 막으려면 «캐릭터와 같은 층» 으로 바꾸세요.`,
  });
}

/** 몸을 1x1 밖으로 키웠는가. 레일 헤더의 «손댔음» 배지 판정에 쓴다. */
function bodyAuthored(page: EventPage): boolean {
  const body = normalizeCharacterFootprint(page.footprint);
  return body.width !== UNIT_FOOTPRINT.width || body.height !== UNIT_FOOTPRINT.height;
}

/**
 * 레일 헤더 요약. 1x1 은 `overlapSummary` 그대로 — 몸 크기를 안 만진 페이지의 요약 문구가
 * 바뀌면 안 된다(기존 계약이 문자열 동등으로 고정돼 있다). 다중 타일일 때만 크기를 덧붙인다.
 */
function passageRailSummary(page: EventPage): string {
  const body = normalizeCharacterFootprint(page.footprint);
  if (!bodyAuthored(page)) return overlapSummary(page);
  const rows = normalizePassRows(page.passRows, body.height);
  return `${overlapSummary(page)} · ${body.width}x${body.height} 중 ${rows}행`;
}

function renderConditionSummaryBadges(conditions: readonly EventPageCondition[]): HTMLElement {
  if (conditions.length === 0) {
    return el("span", {
      class: "event-condition-summary-empty",
      text: "항상",
      dataset: { testid: "event-condition-summary-empty" },
    });
  }
  const badges = el("span", {
    class: "event-condition-summary-badges",
    dataset: { testid: "event-condition-summary-badges" },
  });
  for (const condition of conditions.slice(0, CONDITION_BADGE_LIMIT)) {
    badges.append(
      el("span", {
        class: `event-condition-badge event-condition-badge-${condition.kind}`,
        text: pageConditionBadgeText(condition),
        attrs: { title: pageConditionSummary(condition) },
        dataset: { testid: "event-condition-badge" },
      })
    );
  }
  if (conditions.length > CONDITION_BADGE_LIMIT) {
    badges.append(
      el("span", {
        class: "event-condition-badge event-condition-badge-overflow",
        text: `+${conditions.length - CONDITION_BADGE_LIMIT}`,
        dataset: { testid: "event-condition-badge-overflow" },
      })
    );
  }
  return badges;
}

function pageConditionBadgeText(condition: EventPageCondition): string {
  switch (condition.kind) {
    case "switch": {
      const id = truncateBadgeToken(switchVariableName("switch", condition.switchId), 12);
      return `${id} ${condition.value ? "켜짐" : "꺼짐"}`;
    }
    case "selfSwitch":
      return `기억 ${condition.key} ${condition.value ? "켜짐" : "꺼짐"}`;
    case "variable": {
      const id = truncateBadgeToken(switchVariableName("variable", condition.variableId), 10);
      return `${id} ${compareAmountLabel(condition.op, condition.value)}`;
    }
    case "actor": {
      const name = truncateBadgeToken(recordName(store.getCurrent().database.actors, condition.actorId), 10);
      return condition.present ? name : `!${name}`;
    }
    case "item": {
      const name = truncateBadgeToken(recordName(store.getCurrent().database.items, condition.itemId), 10);
      return condition.present ? name : `!${name}`;
    }
    case "gold":
      return `소지금 ${compareAmountLabel(condition.op, condition.amount)}`;
    case "timer":
      return `${timerIdLabel(condition.timerId)} ${condition.seconds}초`;
    case "timePhase":
      return timePhaseLabel(condition.phase);
    case "season":
      return seasonLabel(condition.season);
    case "npcActivity":
      return truncateBadgeToken(condition.activity, 10);
    case "friendshipAtLeast":
      return `호감≥${condition.value}`;
    case "relationshipAtLeast":
      return `관계 ${relationshipStateName(condition.state)}+`;
    case "battleResult":
      return `전투${condition.result === "victory" ? "승" : condition.result === "defeat" ? "패" : "도"}`;
    case "run":
      return runConditionText(condition);
    case "all":
      return condition.conditions.length ? `모두 맞을 때 ${condition.conditions.length}` : "모두 맞을 때";
    case "any":
      return condition.conditions.length ? `하나라도 맞을 때 ${condition.conditions.length}` : "하나라도 맞을 때";
    case "not":
      return "아닐 때";
  }
}

function runConditionText(condition: Extract<EventPageCondition, { kind: "run" }>): string {
  switch (condition.query) {
    case "active":
      return condition.value === false ? "탐험 중이 아님" : "탐험 중";
    case "floor":
      return `탐험 층 ${compareAmountLabel(condition.op, condition.value)}`;
    case "flag":
      return `탐험 기억 ${condition.flag || "기억"} ${condition.value ? "켜짐" : "꺼짐"}`;
    case "result":
      return `탐험 결과 ${runResultLabel(condition.result)}`;
  }
}

function truncateBadgeToken(value: string, max: number): string {
  const text = value.trim() || "?";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

function renderMovementSummaryChips(page: EventPage): HTMLElement {
  const typeLabel = movementTypeChipLabel(page.movement.type);
  const isStationary = page.movement.type === "fixed";
  const speedLabel = movementSpeedChipLabel(page.movement.speed);
  return el("span", {
    class: "event-movement-summary-chips",
    text: isStationary ? typeLabel : `${typeLabel} · ${speedLabel}`,
    dataset: { testid: "event-movement-summary-chips" },
  });
}

function movementTypeChipLabel(type: EventPage["movement"]["type"]): string {
  switch (type) {
    case "fixed":
      return "정지";
    case "random":
      return "무작위";
    case "approach":
      return "접근";
    case "chase":
      return "추격";
    case "custom":
      return "사용자 지정";
    case "living":
      return "생활 이동";
    default:
      return String(type);
  }
}

function movementSummaryText(page: EventPage): string {
  const type = movementTypeChipLabel(page.movement.type);
  if (page.movement.type === "fixed") return type;
  return `${type} · ${movementSpeedChipLabel(page.movement.speed)}`;
}

function movementSpeedChipLabel(speed: number): string {
  switch (speed) {
    case 1:
      return "x8 느림";
    case 2:
      return "x4 느림";
    case 3:
      return "x2 느림";
    case 4:
      return "보통";
    case 5:
      return "x2 빠름";
    case 6:
      return "x4 빠름";
    case 7:
      return "x6 빠름";
    case 8:
      return "x8 빠름";
    default:
      return String(speed);
  }
}

function collapsibleSection(options: {
  readonly title: string;
  readonly testId: string;
  readonly openSet: Set<string>;
  readonly openKey: string;
  readonly meta?: string;
  readonly summaryExtra?: HTMLElement;
  readonly body: HTMLElement;
}): HTMLElement {
  const details = el("details", {
    class: "event-oprn-fieldset event-collapsible-section",
    dataset: { testid: options.testId },
  }) as HTMLDetailsElement;
  const summaryChildren: (Node | string)[] = [
    el("span", { class: "event-collapsible-title", text: options.title }),
  ];
  if (options.summaryExtra) summaryChildren.push(options.summaryExtra);
  if (options.meta !== undefined) {
    summaryChildren.push(el("span", { class: "event-collapsible-meta", text: options.meta }));
  }
  details.append(
    el("summary", {
      class: "event-collapsible-summary",
      children: summaryChildren,
    }),
    el("div", { class: "event-collapsible-body", children: [options.body] })
  );
  bindEventSectionOpenState(details, options.openSet, options.openKey);
  return details;
}

function renderEventPageSafetyWarning(page: EventPage): HTMLElement {
  const riskyTrigger = page.trigger.kind === "auto" || page.trigger.kind === "parallel";
  const hasGateCondition = hasRecursivePageCondition(page.conditions);
  return el("div", {
    class: "event-page-safety-warning" + (riskyTrigger && !hasGateCondition ? "" : " hidden"),
    text: "조건 없는 자동/병렬 이벤트는 반복 실행될 수 있습니다.",
    dataset: { testid: "event-page-safety-warning" },
  });
}

function rm2k3Fieldset(title: string, content: HTMLElement, testId?: string): HTMLElement {
  const fieldset = el("fieldset", {
    class: "event-oprn-fieldset",
    dataset: testId ? { testid: testId } : undefined,
  });
  fieldset.append(el("legend", { text: title }), content);
  return fieldset;
}

function movementSpeedSelect(mapId: MapId, eventId: string, page: EventPage): HTMLSelectElement {
  const select = el("select", { dataset: { testid: "event-page-movement-speed-select" } }) as HTMLSelectElement;
  for (let speed = 1; speed <= 8; speed += 1) {
    select.append(el("option", { attrs: { value: String(speed) }, text: movementSpeedLabel(speed) }));
  }
  select.value = String(page.movement.speed);
  select.addEventListener("change", () => {
    updateEventPage(mapId, eventId, page.id, {
      movement: { ...page.movement, speed: parseInt(select.value, 10) || page.movement.speed },
    });
  });
  return select;
}

function movementSpeedLabel(speed: number): string {
  switch (speed) {
    case 1:
      return "1: x8 느림";
    case 2:
      return "2: x4 느림";
    case 3:
      return "3: x2 느림";
    case 4:
      return "4: 보통";
    case 5:
      return "5: x2 빠름";
    case 6:
      return "6: x4 빠름";
    case 7:
      return "7: x6 빠름";
    case 8:
      return "8: x8 빠름";
    default:
      return String(speed);
  }
}

function graphicControl(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const control = el("div", { class: "event-graphic-control", dataset: { testid: "event-page-graphic-control" } });
  const spriteInput = el("input", {
    attrs: { type: "text", placeholder: "모습" },
    value: page.graphic.sprite?.id ?? "",
    dataset: { testid: "event-page-sprite-input" },
  });
  spriteInput.addEventListener("change", () => {
    const id = spriteInput.value.trim();
    updateEventPage(mapId, eventId, page.id, {
      graphic: id ? { ...page.graphic, sprite: { type: "bundled", id } } : graphicWithoutSprite(page),
    });
  });
  const transparent = el("input", { attrs: { type: "checkbox" } }) as HTMLInputElement;
  transparent.checked = page.graphic.transparent ?? false;
  transparent.addEventListener("change", () => {
    updateEventPage(mapId, eventId, page.id, { graphic: { ...page.graphic, transparent: transparent.checked } });
  });
  control.append(
    renderEventGraphicPreview(page.graphic, page.movement.type),
    el("div", {
      class: "event-graphic-control-actions",
      children: [
        el("button", {
          class: "btn",
          text: "이미지 선택",
          dataset: { testid: "event-page-graphic-set" },
          on: { click: () => openNpcGraphicDialog(mapId, eventId, page) },
        }),
        el("label", { class: "event-graphic-transparent", attrs: { title: "체크하면 맵에서 모습을 숨깁니다. 해제하면 다시 보입니다." }, children: [transparent, el("span", { text: "맵에서 숨기기" })] }),
      ],
    }),
    spriteInput
  );
  return control;
}

function graphicWithoutSprite(page: EventPage): EventPage["graphic"] {
  return page.graphic.transparent === undefined ? {} : { transparent: page.graphic.transparent };
}

function eventEditorTriggerKind(trigger: Trigger): EventEditorTriggerKind {
  switch (trigger.kind) {
    case "touch":
      return "playerTouch";
    case "action":
    case "playerTouch":
    case "eventTouch":
    case "auto":
    case "parallel":
      return trigger.kind;
  }
}
