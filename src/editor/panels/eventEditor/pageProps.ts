import { hasRecursivePageCondition, type EventDraftValidation } from "@/editor/eventDraftValidator";
import { el } from "@/util/dom";
import {
  addEventPage,
  addEventPageCommand,
  copyEventPageToClipboard,
  deleteEventPage,
  hasCopiedEventPage,
  pasteEventPage,
  triggerFromKind,
  updateEventPage,
} from "@/editor/eventPages";
import { editorState } from "@/editor/editorState";
import { updateEvent } from "@/editor/eventActions";
import { recordCoalescedSnapshot } from "@/editor/mapEditHistory";
import { storyFlagOptionLabel } from "@/project/storyFlags";
import { store } from "@/project/store";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { openNewEventCommandKindDialog } from "./commandEditDialog";
import {
  PAGE_TAB_ICON_PREVIEW_SCALE,
  renderEventGraphicIcon,
  renderEventGraphicPreview,
} from "./eventGraphicPreview";
import { openNpcGraphicDialog } from "./graphicDialog";
import { renderPageAnimationType } from "./pageAnimationType";
import { renderPageConditions } from "./pageConditions";
import { renderPageMovement } from "./pageMovement";
import {
  type EventEditorTriggerKind,
  EVENT_PRIORITY_OPTIONS,
  PAGE_COMMAND_BUTTONS,
  TRIGGER_OPTIONS,
  commandKindLabel,
} from "./options";
import { openCharacterIdPicker } from "./characterIdPickerDialog";
import { attachCharacterIdAutocomplete } from "./characterIdAutocomplete";
import type { Command, EventPage, EventPageCondition, GameEvent, MapId, Trigger } from "@/project/types";
import {
  bindEventSectionOpenState,
  eventEditorOpenKey,
  openEventConditions,
  openEventMovement,
} from "./eventEditorOpenState";

export function renderEventNameControl(mapId: MapId, eventId: string, page: EventPage, event: GameEvent): HTMLElement {
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
        children: [el("span", { text: "이름" }), name],
      }),
      renderEventCharacterIdField(mapId, event),
    ],
  });
}

export function renderPageTabs(mapId: MapId, ev: GameEvent, activePage: EventPage): HTMLElement {
  const wrap = el("div", { class: "event-page-tabs", dataset: { testid: "event-page-tabs" } });
  const pages = ev.pages ?? [];
  const canPaste = hasCopiedEventPage();
  const canDelete = pages.length > 1;
  const actions: HTMLElement[] = [
    pageButton("새 페이지", "event-page-add", "페이지 추가", "new", () => addEventPage(mapId, ev.id)),
    pageButton("페이지 복사", "event-page-copy", "페이지 복사", "copy", () => copyEventPageToClipboard(mapId, ev.id, activePage.id)),
  ];
  // 비활성 버튼은 자리만 차지하므로 사용 가능할 때만 노출한다.
  if (canPaste) {
    actions.push(
      pageButton("붙여넣기", "event-page-paste", "페이지 붙여넣기", "paste", () => pasteEventPage(mapId, ev.id))
    );
  }
  if (canDelete) {
    actions.push(
      pageButton("페이지 삭제", "event-page-delete", "페이지 삭제", "delete", () => deleteEventPage(mapId, ev.id, activePage.id))
    );
  }
  wrap.append(
    el("span", {
      class: "event-classic-marker",
      attrs: { "aria-hidden": "true" },
      dataset: { testid: "event-classic-page-controls" },
    }),
    el("div", {
      class: "event-page-action-buttons",
      dataset: { count: String(actions.length) },
      children: actions,
    })
  );
  return wrap;
}

export function renderClassicPageTabStrip(
  mapId: MapId,
  ev: GameEvent,
  activePage: EventPage,
  validation?: EventDraftValidation,
): HTMLElement {
  const pages = ev.pages ?? [];
  const pageButtons = el("div", {
    class: "event-page-number-tabs",
    dataset: { testid: "event-classic-page-tabs" },
  });
  pages.forEach((page, index) => {
    pageButtons.append(
      el("button", {
        class: "btn event-page-tab-rich" + (page.id === activePage.id ? " active" : ""),
        dataset: { testid: `event-page-tab-${index + 1}` },
        attrs: { title: pageTabTooltip(page, index) },
        children: [
          pageTabThumbnail(page),
          el("span", { class: "event-page-tab-number", text: String(index + 1) }),
          // 탭을 눌러 보지 않고도 "이 페이지가 언제 실행되는가"를 읽을 수 있게 한다.
          // 4페이지짜리 NPC 에서 감독이 왕복하는 주된 이유였다.
          el("span", {
            class: "event-page-tab-meta",
            children: [
              el("span", { class: "event-page-tab-title", text: page.name.trim() || "(이름 없음)" }),
              el("span", {
                class: "event-page-tab-cond",
                text: pageTabConditionText(page),
                dataset: { testid: `event-page-tab-cond-${index + 1}` },
              }),
            ],
          }),
          pageTabConditionBadges(page),
          pageValidationBadge(page.id, validation),
        ],
        on: { click: () => editorState.set({ selectedEventPageId: page.id }) },
      })
    );
  });
  pageButtons.append(
    el("button", {
      class: "btn event-page-tab-add",
      text: "+",
      attrs: { type: "button", title: "새 페이지 추가", "aria-label": "새 페이지 추가" },
      dataset: { testid: "event-page-tab-add" },
      on: { click: () => addEventPage(mapId, ev.id) },
    })
  );
  return pageButtons;
}

function pageValidationBadge(pageId: string, validation?: EventDraftValidation): HTMLElement {
  const issues = validation?.issues.filter((issue) => issue.pageId === pageId) ?? [];
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const count = errors + warnings;
  return el("span", {
    class: `event-page-validation-badge${errors > 0 ? " error" : warnings > 0 ? " warning" : " hidden"}`,
    text: "",
    attrs: { "aria-label": count > 0 ? `페이지 검사 문제 ${count}개` : "페이지 검사 문제 없음" },
    dataset: {
      testid: `event-page-validation-badge-${pageId}`,
      errors: String(errors),
      warnings: String(warnings),
      label: errors > 0 ? `!${errors}` : warnings > 0 ? `△${warnings}` : "",
    },
  });
}

const PAGE_TAB_BADGE_LIMIT = 3;

const PAGE_TAB_BADGE_LETTERS: Record<EventPageCondition["kind"], string> = {
  switch: "S",
  variable: "V",
  selfSwitch: "S",
  actor: "A",
  item: "I",
  gold: "G",
  timer: "T",
  timePhase: "P",
  season: "S",
  npcActivity: "A",
  friendshipAtLeast: "F",
  battleResult: "B",
  all: "&",
  any: "|",
  not: "!",
};

function pageTabThumbnail(page: EventPage): HTMLElement {
  return el("span", {
    class: "event-page-tab-thumb",
    attrs: { "aria-hidden": "true" },
    dataset: { testid: "event-page-tab-thumb" },
    children: [renderEventGraphicIcon(page.graphic, { scale: PAGE_TAB_ICON_PREVIEW_SCALE })],
  });
}

function pageTabConditionBadges(page: EventPage): HTMLElement {
  const badges = el("span", {
    class: "event-page-tab-badges",
    attrs: { "aria-hidden": "true" },
    dataset: { testid: "event-page-tab-badges" },
  });
  const conditions = page.conditions ?? [];
  for (const condition of conditions.slice(0, PAGE_TAB_BADGE_LIMIT)) {
    badges.append(
      el("span", {
        class: `event-page-tab-badge event-page-tab-badge-${condition.kind}`,
        text: PAGE_TAB_BADGE_LETTERS[condition.kind],
      })
    );
  }
  if (conditions.length > PAGE_TAB_BADGE_LIMIT) {
    badges.append(
      el("span", {
        class: "event-page-tab-badge event-page-tab-badge-more",
        text: `+${conditions.length - PAGE_TAB_BADGE_LIMIT}`,
      })
    );
  }
  return badges;
}

/** 탭에 직접 보이는 조건 요약. 길면 첫 조건 + 나머지 개수로 줄인다. */
function pageTabConditionText(page: EventPage): string {
  const conditions = page.conditions ?? [];
  if (conditions.length === 0) return "조건 없음";
  const first = pageConditionSummary(conditions[0]!);
  return conditions.length === 1 ? first : `${first} 외 ${conditions.length - 1}`;
}

function pageTabTooltip(page: EventPage, index: number): string {
  const name = page.name.trim() || "(이름 없음)";
  const conditions = page.conditions ?? [];
  const summary = conditions.length > 0 ? conditions.map(pageConditionSummary).join(" / ") : "조건 없음";
  return `페이지 ${index + 1} — ${name}\n${summary}`;
}

function pageConditionSummary(condition: EventPageCondition): string {
  switch (condition.kind) {
    case "switch":
      return `스위치 [${switchVariableName("switch", condition.switchId)}] ${condition.value ? "ON" : "OFF"}`;
    case "variable":
      return `변수 [${switchVariableName("variable", condition.variableId)}] ${condition.op} ${condition.value}`;
    case "selfSwitch":
      return `셀프 스위치 ${condition.key} ${condition.value ? "ON" : "OFF"}`;
    case "actor":
      return `주인공 [${recordName(store.getCurrent().database.actors, condition.actorId)}] ${condition.present ? "파티에 있음" : "파티에 없음"}`;
    case "item":
      return `아이템 [${recordName(store.getCurrent().database.items, condition.itemId)}] ${condition.present ? "보유 중" : "미보유"}`;
    case "gold":
      return `소지금 ${condition.op} ${condition.amount}`;
    case "timer":
      return `${condition.timerId === "timer1" ? "타이머 1" : "타이머 2"} ${condition.seconds}초 이하`;
    case "timePhase":
      return `시간대 ${timePhaseLabel(condition.phase)}`;
    case "season":
      return `계절 ${seasonLabel(condition.season)}`;
    case "npcActivity":
      return `활동 ${condition.activity}`;
    case "friendshipAtLeast":
      return `호감도 ${condition.npcKey || "이 이벤트"} >= ${condition.value}`;
    case "battleResult":
      return `전투 ${condition.result === "victory" ? "승리" : condition.result === "defeat" ? "패배" : "도망"}`;
    case "all":
      return condition.conditions.length ? `모두(${condition.conditions.length})` : "모두(비어있음)";
    case "any":
      return condition.conditions.length ? `하나(${condition.conditions.length})` : "하나(비어있음)";
    case "not":
      return `아님`;
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

function pageButton(
  text: string,
  testId: string,
  title: string,
  icon: "new" | "copy" | "paste" | "delete",
  onClick?: () => void,
  disabled = false
): HTMLButtonElement {
  const attrs: Record<string, string> = disabled ? { title, disabled: "" } : { title };
  return el("button", {
    class: `btn event-page-action-button ${disabled ? "disabled" : ""}`,
    children: [
      el("span", { class: `event-page-button-icon event-page-button-icon-${icon}`, attrs: { "aria-hidden": "true" } }),
      el("span", { class: "event-page-button-label", text }),
    ],
    dataset: { testid: testId },
    attrs,
    on: onClick ? { click: onClick } : undefined,
  }) as HTMLButtonElement;
}

export function renderPageCommandCatalog(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
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
          click: () =>
            openNewEventCommandKindDialog(button.kind, (command) =>
              addEventPageCommand(mapId, eventId, page.id, command)
            ),
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
  "같은 키를 여러 맵 이벤트에 쓰면 호감·선물을 공유합니다. 비우면 일회용 NPC로 취급되어 호감·선물은 동작하지 않습니다. 활동(npcActivity)은 이벤트별입니다.";

/** Compact optional characterId control for the top identity row (name + characterId). */
export function renderEventCharacterIdField(mapId: MapId, event: GameEvent): HTMLElement {
  const input = el("input", {
    attrs: {
      type: "text",
      placeholder: "선택 (일회용 NPC)",
      title: CHARACTER_ID_HELP,
    },
    value: event.characterId ?? "",
    dataset: { testid: "event-character-id-input" },
  }) as HTMLInputElement;
  input.addEventListener("change", () => {
    // Free-type attaches characterId only. Unknown ids do NOT auto-create a profile.
    const next = input.value.trim() || undefined;
    updateEvent(
      mapId,
      event.id,
      next ? { characterId: next } : { characterId: undefined, talkFriendship: undefined },
    );
  });
  const pickerButton = el("button", {
    class: "btn small event-character-id-picker-open",
    text: "...",
    attrs: {
      type: "button",
      title: "캐릭터 ID 찾기 / 새로 만들기",
      "aria-label": "캐릭터 ID 찾기",
    },
    dataset: { testid: "event-character-id-picker-open" },
    on: {
      click: () => openCharacterIdPicker({
        mapId,
        eventId: event.id,
        currentId: event.characterId,
      }),
    },
  });

  const inputRow = el("span", {
    class: "event-character-id-input-row",
    children: [input, pickerButton],
  });

  attachCharacterIdAutocomplete({
    input,
    getProject: () => store.getCurrent(),
    onSelect: () => {},
  });

  return el("div", {
    class: "event-character-id-field event-character-id-field-inline",
    dataset: { testid: "event-character-id-field" },
    children: [
      el("label", {
        class: "event-character-id-label",
        children: [
          el("span", {
            text: "캐릭터 ID",
            attrs: { title: CHARACTER_ID_HELP },
          }),
          inputRow,
        ],
      }),
    ],
  });
}

/** Talk-friendship / profile display name — only when characterId is linked. */
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

  const profileName = store.getCurrent().characters?.[characterId]?.displayName ?? "";
  const displayNameInput = el("input", {
    attrs: {
      type: "text",
      placeholder: "상태 메뉴 표시용 (선택)",
    },
    value: profileName,
    dataset: { testid: "event-character-display-name-input" },
  }) as HTMLInputElement;
  displayNameInput.addEventListener("change", () => {
    const name = displayNameInput.value.trim();
    recordCoalescedSnapshot(`event-character-display-name:${characterId}`);
    store.update((project) => {
      const next = { ...(project.characters ?? {}) };
      const existing = { ...(next[characterId] ?? {}) };
      if (name) {
        existing.displayName = name;
        next[characterId] = existing;
      } else {
        delete existing.displayName;
        if (Object.keys(existing).length === 0) delete next[characterId];
        else next[characterId] = existing;
      }
      if (Object.keys(next).length === 0) delete project.characters;
      else project.characters = next;
    }, { scope: "project" });
  });

  return el("div", {
    class: "event-character-social-extras",
    dataset: { testid: "event-character-social-extras" },
    children: [
      el("label", {
        class: "event-talk-friendship-label",
        dataset: { testid: "event-talk-friendship-field" },
        children: [
          talkCheckbox,
          el("span", { text: "대화 시 호감도 상승 (하루 1회)" }),
        ],
      }),
      el("label", {
        class: "event-character-display-name-label",
        dataset: { testid: "event-character-display-name-field" },
        children: [
          el("span", { text: "프로필 표시 이름" }),
          displayNameInput,
        ],
      }),
    ],
  });
}

export function renderEventPageProps(mapId: MapId, eventId: string, page: EventPage, event?: GameEvent): HTMLElement {
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
  overlap.addEventListener("change", () => {
    updateEventPage(mapId, eventId, page.id, { overlapForbidden: overlap.checked });
  });

  const openKey = eventEditorOpenKey(mapId, eventId, page.id);
  const conditions = page.conditions ?? [];
  wrap.append(
    collapsibleSection({
      title: "조건",
      testId: "event-classic-conditions",
      openSet: openEventConditions,
      openKey,
      summaryExtra: renderConditionSummaryBadges(conditions),
      body: el("div", { class: "event-conditions-grid", children: renderPageConditions(mapId, eventId, page, event) }),
    }),
    rm2k3Fieldset("그래픽", graphicControl(mapId, eventId, page), "event-classic-graphic"),
    // Trigger + priority always visible under graphic (do not bury under movement collapsible).
    el("div", {
      class: "event-page-trigger-priority-stack",
      dataset: { testid: "event-page-trigger-priority-stack" },
      children: [
        rm2k3Fieldset("트리거", trigger, "event-classic-trigger"),
        rm2k3Fieldset("우선순위", el("div", {
          class: "event-priority-block",
          children: [
            priority,
            el("label", { class: "event-overlap-label", children: [overlap, el("span", { text: "이벤트 겹침 금지" })] }),
          ],
        })),
        renderEventPageSafetyWarning(page),
      ],
    }),
    collapsibleSection({
      title: "이동/기타",
      testId: "event-classic-movement-section",
      openSet: openEventMovement,
      openKey,
      summaryExtra: renderMovementSummaryChips(page),
      body: el("div", {
        class: "event-page-movement-stack",
        children: [
          rm2k3Fieldset("이동 유형", renderPageMovement(mapId, eventId, page), "event-classic-movement-type"),
          rm2k3Fieldset("애니메이션 유형", renderPageAnimationType(mapId, eventId, page), "event-classic-animation-type"),
          rm2k3Fieldset("이동 속도", movementSpeedSelect(mapId, eventId, page), "event-classic-movement-speed"),
        ],
      }),
    })
  );
  return wrap;
}

const CONDITION_BADGE_LIMIT = 3;

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
      return `${id} ${condition.value ? "ON" : "OFF"}`;
    }
    case "selfSwitch":
      return `셀프${condition.key} ${condition.value ? "ON" : "OFF"}`;
    case "variable": {
      const id = truncateBadgeToken(switchVariableName("variable", condition.variableId), 10);
      return `${id} ${condition.op} ${condition.value}`;
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
      return `G ${condition.op} ${condition.amount}`;
    case "timer":
      return `T${condition.timerId === "timer1" ? "1" : "2"} ${condition.seconds}s`;
    case "timePhase":
      return timePhaseLabel(condition.phase);
    case "season":
      return seasonLabel(condition.season);
    case "npcActivity":
      return truncateBadgeToken(condition.activity, 10);
    case "friendshipAtLeast":
      return `호감≥${condition.value}`;
    case "battleResult":
      return `전투${condition.result === "victory" ? "승" : condition.result === "defeat" ? "패" : "도"}`;
    case "all":
      return `AND(${condition.conditions.length})`;
    case "any":
      return `OR(${condition.conditions.length})`;
    case "not":
      return `NOT`;
  }
}

function truncateBadgeToken(value: string, max: number): string {
  const text = value.trim() || "?";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

function renderMovementSummaryChips(page: EventPage): HTMLElement {
  const typeLabel = movementTypeChipLabel(page.movement.type);
  const speedLabel = movementSpeedChipLabel(page.movement.speed);
  return el("span", {
    class: "event-movement-summary-chips",
    text: `${typeLabel} · ${speedLabel}`,
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
    class: "event-rm2k3-fieldset event-collapsible-section",
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
    class: "event-rm2k3-fieldset",
    dataset: testId ? { testid: testId } : undefined,
  });
  fieldset.append(el("legend", { text: title }), content);
  return fieldset;
}

function movementSpeedSelect(mapId: MapId, eventId: string, page: EventPage): HTMLSelectElement {
  const select = el("select", { dataset: { testid: "event-page-movement-speed-select" } }) as HTMLSelectElement;
  for (let speed = 1; speed <= 6; speed += 1) {
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
    default:
      return String(speed);
  }
}

function graphicControl(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const control = el("div", { class: "event-graphic-control", dataset: { testid: "event-page-graphic-control" } });
  const spriteInput = el("input", {
    attrs: { type: "text", placeholder: "그래픽 ID" },
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
    el("label", { class: "event-graphic-transparent", children: [transparent, el("span", { text: "투명" })] }),
    el("button", {
      class: "btn",
      text: "설정",
      dataset: { testid: "event-page-graphic-set" },
      on: { click: () => openNpcGraphicDialog(mapId, eventId, page) },
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
