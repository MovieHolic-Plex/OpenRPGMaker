import { el } from "@/util/dom";
import {
  addEventPage,
  addEventPageCommand,
  copyEventPage,
  deleteEventPage,
  moveEventPage,
  setEventPageTextCommand,
  triggerFromKind,
  updateEventPage,
} from "@/editor/eventPages";
import { newCommand } from "@/editor/eventActions";
import { editorState } from "@/editor/editorState";
import { field, selectedOptionValue, selectWithOptions } from "./dom";
import { openNpcGraphicDialog } from "./graphicDialog";
import {
  BOOLEAN_OPTIONS,
  EVENT_PRIORITY_OPTIONS,
  PAGE_COMMAND_BUTTONS,
  TRIGGER_OPTIONS,
} from "./options";
import type { EventPage, EventPageCondition, GameEvent, MapId } from "@/project/types";

export function renderPageTabs(mapId: MapId, ev: GameEvent, activePage: EventPage): HTMLElement {
  const wrap = el("div", { class: "event-page-tabs", dataset: { testid: "event-page-tabs" } });
  const pages = ev.pages ?? [];
  pages.forEach((page, index) => {
    wrap.append(
      el("button", {
        class: "btn" + (page.id === activePage.id ? " active" : ""),
        text: String(index + 1),
        dataset: { testid: `event-page-tab-${index + 1}` },
        attrs: { title: page.name },
        on: { click: () => editorState.set({ selectedEventPageId: page.id }) },
      })
    );
  });
  wrap.append(
    el("button", {
      class: "btn",
      text: "+",
      dataset: { testid: "event-page-add" },
      attrs: { title: "페이지 추가" },
      on: { click: () => addEventPage(mapId, ev.id) },
    }),
    el("button", {
      class: "btn",
      text: "복사",
      dataset: { testid: "event-page-copy" },
      attrs: { title: "페이지 복사" },
      on: { click: () => copyEventPage(mapId, ev.id, activePage.id) },
    }),
    el("button", {
      class: "btn",
      text: "↑",
      dataset: { testid: "event-page-move-up" },
      attrs: { title: "앞 페이지로 이동" },
      on: { click: () => moveEventPage(mapId, ev.id, activePage.id, -1) },
    }),
    el("button", {
      class: "btn",
      text: "↓",
      dataset: { testid: "event-page-move-down" },
      attrs: { title: "뒤 페이지로 이동" },
      on: { click: () => moveEventPage(mapId, ev.id, activePage.id, 1) },
    }),
    el("button", {
      class: "btn danger",
      text: "×",
      dataset: { testid: "event-page-delete" },
      attrs: { title: "페이지 삭제" },
      on: { click: () => deleteEventPage(mapId, ev.id, activePage.id) },
    })
  );
  return wrap;
}

export function renderPageCommandCatalog(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const wrap = el("div", {
    class: "panel-section page-command-catalog",
    dataset: { testid: "page-command-catalog" },
  });
  wrap.append(el("h3", { text: "페이지 명령" }));
  const row = el("div", { class: "command-catalog-row" });
  for (const button of PAGE_COMMAND_BUTTONS) {
    row.append(
      el("button", {
        class: "btn small",
        text: button.label,
        dataset: { testid: button.testId },
        on: {
          click: () => addEventPageCommand(mapId, eventId, page.id, newCommand(button.kind)),
        },
      })
    );
  }
  wrap.append(row);
  // summary는 카탈로그와 분리되어 dynamic 영역에서 별도 렌더링한다
  // (renderPageCommandSummary). 카탈로그가 정적(stable) 영역에 있어도
  // summary는 매 store 변경 시 최신 commands를 반영한다.
  wrap.append(renderPageCommandSummary(page));
  return wrap;
}

// 페이지 명령 요약 — 카탈로그와 분리하여 dynamic 영역에서 개별 렌더링 가능.
export function renderPageCommandSummary(page: EventPage): HTMLElement {
  return el("div", {
    class: "empty-hint",
    text: page.commands.map((command) => command.kind).join(" -> "),
    dataset: { testid: "page-command-summary" },
  });
}

export function renderEventPageProps(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const wrap = el("div", { class: "event-page-props", dataset: { testid: "event-page-props" } });
  wrap.append(el("h3", { text: "페이지" }));

  const name = el("input", {
    attrs: { type: "text" },
    value: page.name,
    dataset: { testid: "event-page-name-input" },
  }) as HTMLInputElement;
  name.addEventListener("change", () => updateEventPage(mapId, eventId, page.id, { name: name.value }));
  wrap.append(field("이름", name));

  const trigger = selectWithOptions(TRIGGER_OPTIONS, page.trigger.kind, "event-page-trigger-select");
  trigger.addEventListener("change", () => {
    const kind = selectedOptionValue(trigger, TRIGGER_OPTIONS, page.trigger.kind);
    updateEventPage(mapId, eventId, page.id, { trigger: triggerFromKind(kind) });
  });
  wrap.append(field("트리거", trigger));

  const priority = selectWithOptions(EVENT_PRIORITY_OPTIONS, page.priority, "event-page-priority-select");
  priority.addEventListener("change", () => {
    updateEventPage(mapId, eventId, page.id, {
      priority: selectedOptionValue(priority, EVENT_PRIORITY_OPTIONS, page.priority),
    });
  });
  wrap.append(field("우선순위", priority));

  wrap.append(field("그래픽", graphicControl(mapId, eventId, page)));

  wrap.append(field("스위치 조건", switchConditionInputs(mapId, eventId, page)));
  wrap.append(field("텍스트 명령", textCommandInputs(mapId, eventId, page)));
  return wrap;
}

function graphicControl(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const control = el("div", { class: "event-graphic-control", dataset: { testid: "event-page-graphic-control" } });
  const spriteInput = el("input", {
    attrs: { type: "text", placeholder: "Graphic ID, e.g. tex_easyrpg_charset_people1" },
    value: page.graphic.sprite?.id ?? "",
    dataset: { testid: "event-page-sprite-input" },
  });
  spriteInput.addEventListener("change", () => {
    const id = spriteInput.value.trim();
    updateEventPage(mapId, eventId, page.id, {
      graphic: id ? { ...page.graphic, sprite: { type: "bundled", id } } : graphicWithoutSprite(page),
    });
  });
  control.append(
    el("div", { class: "event-graphic-summary", text: page.graphic.sprite?.id ?? "(none)" }),
    el("button", {
      class: "btn",
      text: "Set...",
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

function switchConditionInputs(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const switchCondition = page.conditions.find((condition) => condition.kind === "switch");
  const switchInput = el("input", {
    attrs: { type: "text", placeholder: "스위치 ID" },
    value: switchCondition?.kind === "switch" ? switchCondition.switchId : "",
    dataset: { testid: "event-page-switch-condition-input" },
  }) as HTMLInputElement;
  const switchValue = selectWithOptions(
    BOOLEAN_OPTIONS,
    switchCondition?.kind === "switch" ? String(switchCondition.value) : "true",
    "event-page-switch-condition-value"
  );
  const applySwitchCondition = () => {
    const next: EventPageCondition[] = page.conditions.filter((condition) => condition.kind !== "switch");
    const switchId = switchInput.value.trim();
    if (switchId) {
      next.push({ kind: "switch", switchId, value: switchValue.value === "true" });
    }
    updateEventPage(mapId, eventId, page.id, { conditions: next });
  };
  switchInput.addEventListener("change", applySwitchCondition);
  switchValue.addEventListener("change", applySwitchCondition);
  const conditionRow = el("div", {});
  conditionRow.append(switchInput, switchValue);
  return conditionRow;
}

function textCommandInputs(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const firstText = page.commands.find((command) => command.kind === "text");
  const speaker = el("input", {
    attrs: { type: "text", placeholder: "화자" },
    value: firstText?.kind === "text" ? firstText.speaker ?? "" : "",
    dataset: { testid: "event-page-speaker-input" },
  }) as HTMLInputElement;
  const body = el("textarea", {
    attrs: { placeholder: "대화 내용" },
    dataset: { testid: "event-page-textarea" },
  }) as HTMLTextAreaElement;
  body.value = firstText?.kind === "text" ? firstText.body : "";
  const applyText = () => {
    setEventPageTextCommand(mapId, eventId, page.id, speaker.value.trim() || undefined, body.value);
  };
  speaker.addEventListener("change", applyText);
  body.addEventListener("change", applyText);
  const textBox = el("div", {});
  textBox.append(speaker, body);
  return textBox;
}
