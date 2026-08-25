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
import { renderEventGraphicPreview } from "./eventGraphicPreview";
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

export function renderEventNameControl(
  mapId: MapId,
  eventId: string,
  page: EventPage,
  event: GameEvent,
  characterIdControl: HTMLElement = renderEventCharacterIdField(mapId, event),
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
        children: [el("span", { text: "이름" }), name],
      }),
      characterIdControl,
    ],
  });
}

export function renderPageTabs(mapId: MapId, ev: GameEvent, activePage: EventPage): HTMLElement {
  const wrap = el("details", { class: "event-page-tabs", dataset: { testid: "event-page-tabs" } });
  wrap.open = true;
  const pages = ev.pages ?? [];
  const canPaste = hasCopiedEventPage();
  const canDelete = pages.length > 1;
  // 페이지 추가는 탭 스트립의 [+](event-page-tab-add) 하나로 통일한다 —
  // 같은 동작이 두 곳에 있으면 초보가 "다른 기능인가?" 하고 헤맨다(적대 평가 스펙).
  const actions: HTMLElement[] = [
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
    el("summary", {
      class: "event-page-actions-summary",
      text: "페이지",
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
  run: "R",
  all: "&",
  any: "|",
  not: "!",
};

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
  const first = pageConditionCompactSummary(conditions[0]!);
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
      return `${switchVariableName("switch", condition.switchId).replace(/^\d{4}:\s*/u, "")} ${condition.value ? "켜짐" : "꺼짐"}`;
    case "variable":
      return `${switchVariableName("variable", condition.variableId).replace(/^\d{4}:\s*/u, "")} ${condition.op} ${condition.value}`;
    case "selfSwitch":
      return `이 이벤트 기억 ${condition.key} ${condition.value ? "켜짐" : "꺼짐"}`;
    case "actor":
      return `주인공 [${recordName(store.getCurrent().database.actors, condition.actorId)}] ${condition.present ? "파티에 있음" : "파티에 없음"}`;
    case "item":
      return `아이템 ${recordName(store.getCurrent().database.items, condition.itemId)} ${condition.present ? "있음" : "없음"}`;
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
    case "run":
      return runConditionText(condition);
    case "all":
      return condition.conditions.length ? `모두(${condition.conditions.length})` : "모두(비어있음)";
    case "any":
      return condition.conditions.length ? `하나(${condition.conditions.length})` : "하나(비어있음)";
    case "not":
      return `아님`;
  }
}

/** 탭/배지에 쓰는 조건 한 줄. 이름 + 켜짐/꺼짐. 번호 기호는 쓰지 않는다. */
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
      return `${named || "변수"} ${condition.op} ${condition.value}`;
    }
    case "item":
      return condition.present ? "아이템 보유" : "아이템 미보유";
    case "actor":
      return condition.present ? "주인공 참여" : "주인공 이탈";
    case "gold": {
      const op = condition.op === ">=" ? "≥" : condition.op === "<=" ? "≤" : condition.op;
      return `소지금 ${op} ${condition.amount}`;
    }
    case "timer":
      return `${condition.timerId === "timer1" ? "타이머 1" : "타이머 2"} ${condition.seconds}초`;
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

/** One-click relationship status/control for the top identity card. */
export function renderEventCharacterIdField(mapId: MapId, event: GameEvent): HTMLElement {
  const characterId = event.characterId?.trim();
  const profileName = characterId
    ? store.getCurrent().characters?.[characterId]?.displayName?.trim()
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

/** Relationship settings — only when a character profile is linked. */
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
      el("header", {
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
      title: "언제 보이나요",
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
        rm2k3Fieldset(
          "반응 방식",
          el("div", {
            class: "event-trigger-priority-block",
            children: [
              trigger,
              el("div", {
                class: "event-priority-block",
                dataset: { testid: "event-classic-priority" },
                children: [
                  priority,
                  el("label", { class: "event-overlap-label", children: [overlap, el("span", { text: "서로 겹치지 않음" })] }),
                ],
              }),
            ],
          }),
          "event-classic-trigger"
        ),
        renderEventPageSafetyWarning(page),
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
    case "run":
      return runConditionText(condition);
    case "all":
      return `AND(${condition.conditions.length})`;
    case "any":
      return `OR(${condition.conditions.length})`;
    case "not":
      return `NOT`;
  }
}

function runConditionText(condition: Extract<EventPageCondition, { kind: "run" }>): string {
  switch (condition.query) {
    case "active":
      return `런 ${condition.value === false ? "비활성" : "진행 중"}`;
    case "floor":
      return `런 층 ${condition.op} ${condition.value}`;
    case "flag":
      return `런 ${condition.flag || "플래그"} ${condition.value ? "ON" : "OFF"}`;
    case "result":
      return `런 결과 ${condition.result}`;
  }
}

function truncateBadgeToken(value: string, max: number): string {
  const text = value.trim() || "?";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

function renderMovementSummaryChips(page: EventPage): HTMLElement {
  const typeLabel = movementTypeChipLabel(page.movement.type);
  // 정지한 이벤트에 "x2 느림" 속도를 광고하지 않는다 — 움직이지 않는데 속도가 보이면
  // 초보는 "이거 왜 느리다는 거지?"를 고민하게 된다(적대 평가 스펙).
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
