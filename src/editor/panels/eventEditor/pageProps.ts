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
import type { Command, EventPage, EventPageCondition, GameEvent, MapId, Trigger } from "@/project/types";

export function renderEventNameControl(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const name = el("input", {
    attrs: { type: "text", placeholder: "이벤트 이름" },
    value: page.name,
    dataset: { testid: "event-page-name-input" },
  }) as HTMLInputElement;
  name.addEventListener("change", () => updateEventPage(mapId, eventId, page.id, { name: name.value }));
  return el("label", {
    class: "event-editor-name-field",
    dataset: { testid: "event-classic-name" },
    children: [el("span", { text: "이름" }), name],
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

export function renderClassicPageTabStrip(mapId: MapId, ev: GameEvent, activePage: EventPage): HTMLElement {
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
          pageTabConditionBadges(page),
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

export function renderEventPageProps(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
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

  // RM2003: 조건 패널은 항상 펼친다. 활성 개수만 메타로 표시.
  const activeConditionCount = page.conditions?.length ?? 0;
  wrap.append(
    collapsibleSection({
      title: "조건",
      testId: "event-classic-conditions",
      open: true,
      meta: activeConditionCount > 0 ? `${activeConditionCount}개 활성` : "항상",
      body: el("div", { class: "event-conditions-grid", children: renderPageConditions(mapId, eventId, page) }),
    }),
    el("div", {
      class: "event-page-bottom-grid",
      children: [
        el("div", {
          class: "event-page-bottom-left",
          dataset: { testid: "event-page-bottom-left" },
          children: [
            rm2k3Fieldset("그래픽", graphicControl(mapId, eventId, page), "event-classic-graphic"),
            rm2k3Fieldset("이동 유형", renderPageMovement(mapId, eventId, page), "event-classic-movement-type"),
          ],
        }),
        el("div", {
          class: "event-page-bottom-right",
          dataset: { testid: "event-page-bottom-right" },
          children: [
            rm2k3Fieldset("트리거", trigger, "event-classic-trigger"),
            renderEventPageSafetyWarning(page),
            rm2k3Fieldset("우선순위", el("div", {
              class: "event-priority-block",
              children: [
                priority,
                el("label", { class: "event-overlap-label", children: [overlap, el("span", { text: "이벤트 겹침 금지" })] }),
              ],
            })),
            rm2k3Fieldset("애니메이션 유형", renderPageAnimationType(mapId, eventId, page), "event-classic-animation-type"),
            rm2k3Fieldset("이동 속도", movementSpeedSelect(mapId, eventId, page), "event-classic-movement-speed"),
          ],
        }),
      ],
    })
  );
  return wrap;
}

function collapsibleSection(options: {
  readonly title: string;
  readonly testId: string;
  readonly open: boolean;
  readonly meta: string;
  readonly body: HTMLElement;
}): HTMLElement {
  const details = el("details", {
    class: "event-rm2k3-fieldset event-collapsible-section",
    dataset: { testid: options.testId },
  }) as HTMLDetailsElement;
  details.open = options.open;
  details.append(
    el("summary", {
      class: "event-collapsible-summary",
      children: [
        el("span", { class: "event-collapsible-title", text: options.title }),
        el("span", { class: "event-collapsible-meta", text: options.meta }),
      ],
    }),
    el("div", { class: "event-collapsible-body", children: [options.body] })
  );
  return details;
}

function renderEventPageSafetyWarning(page: EventPage): HTMLElement {
  const riskyTrigger = page.trigger.kind === "auto" || page.trigger.kind === "parallel";
  const hasGateCondition = page.conditions.some((condition) => condition.kind === "switch" || condition.kind === "variable");
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
