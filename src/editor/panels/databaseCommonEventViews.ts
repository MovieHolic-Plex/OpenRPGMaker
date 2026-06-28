import {
  COMMON_EVENT_TRIGGER_OPTIONS,
  commonEventTriggerLabel,
  numberedName,
  ordinalLabel,
} from "@/editor/panels/databaseDisplay";
import { emptyToUndefined } from "@/editor/panels/databaseControls";
import { renderEventEditorInline } from "@/editor/panels/eventEditor";
import { store } from "@/project/store";
import type { Command, CommonEvent } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";

let selectedCommonEventId: string | null = null;

export function renderCommonEventsTab(host: HTMLElement, rerender: () => void): void {
  const commonEvents = store.getCurrent().commonEvents;
  if (!commonEvents.some((record) => record.id === selectedCommonEventId)) {
    selectedCommonEventId = commonEvents[0]?.id ?? null;
  }
  const selected = commonEvents.find((record) => record.id === selectedCommonEventId);
  const shell = el("section", {
    class: "db-detail-form db-common-events-workspace",
    dataset: { testid: "db-detail-form" },
  });
  const listPane = el("div", { class: "db-common-event-list-pane" });
  const detailPane = el("div", { class: "db-common-event-detail-pane" });
  listPane.append(addCommonEventButton(rerender));

  const list = el("div", { class: "db-list db-common-event-list" });
  for (const [index, commonEvent] of commonEvents.entries()) {
    list.append(commonEventListRow(commonEvent, index, commonEvent.id === selected?.id, rerender));
  }
  if (list.childElementCount === 0) {
    for (let index = 0; index < 10; index += 1) list.append(commonEventEmptyRow(index));
  }
  listPane.append(list);

  if (selected) {
    detailPane.append(commonEventEditor(selected, commonEvents.indexOf(selected), rerender));
  } else {
    detailPane.append(emptyCommonEventEditor());
  }
  shell.append(listPane, detailPane);
  host.append(el("h3", { text: "공통 이벤트" }), shell);
}

function commonEventEmptyRow(index: number): HTMLElement {
  return el("div", {
    class: "db-list-row db-common-event-empty-row",
    children: [
      el("span", { class: "db-list-number", text: `${ordinalLabel(index)}:` }),
      el("span", { class: "db-list-name", text: "" }),
      el("span", { class: "db-list-meta", text: "" }),
    ],
  });
}

function emptyCommonEventEditor(): HTMLElement {
  return el("section", {
    class: "db-subpanel db-common-event-editor db-common-event-empty-editor",
    children: [
      el("fieldset", {
        class: "rm2k3-db-fieldset",
        children: [
          el("legend", { text: "기본 설정" }),
          disabledField("이름", ""),
          disabledField("트리거", "호출"),
          disabledField("조건 스위치", "(없음)"),
        ],
      }),
      el("fieldset", {
        class: "rm2k3-db-fieldset db-common-event-command-shell",
        children: [
          el("legend", { text: "이벤트 명령" }),
          el("div", { class: "cmd-list", children: [el("div", { class: "db-command-placeholder-row", text: "@>" })] }),
        ],
      }),
    ],
  });
}

function disabledField(label: string, value: string): HTMLElement {
  return el("label", {
    class: "db-field",
    children: [
      el("span", { text: label }),
      el("input", { attrs: { type: "text", disabled: "true" }, value }),
    ],
  });
}

function addCommonEventButton(rerender: () => void): HTMLElement {
  return el("button", {
    class: "btn small",
    text: "+ 공통 이벤트 추가",
    on: {
      click: () => {
        const next: CommonEvent = {
          id: genId("ce"),
          name: "새 공통 이벤트",
          trigger: "none",
          commands: [{ kind: "text", body: "" }],
        };
        store.update((project) => {
          project.commonEvents.push(next);
        });
        selectedCommonEventId = next.id;
        rerender();
      },
    },
  });
}

function commonEventListRow(
  commonEvent: CommonEvent,
  index: number,
  isSelected: boolean,
  rerender: () => void
): HTMLElement {
  return el("button", {
    class: `db-list-row${isSelected ? " active" : ""}`,
    attrs: { "aria-pressed": String(isSelected), title: `${commonEvent.name} (${commonEvent.id})`, type: "button" },
    on: {
      click: () => {
        selectedCommonEventId = commonEvent.id;
        rerender();
      },
    },
    children: [
      el("span", { class: "db-list-number", text: `${ordinalLabel(index)}:` }),
      el("span", { class: "db-list-name", text: commonEvent.name || "(이름 없음)" }),
      el("span", { class: "db-list-meta", text: commonEventTriggerLabel(commonEvent.trigger) }),
    ],
  });
}

function commonEventEditor(commonEvent: CommonEvent, index: number, rerender: () => void): HTMLElement {
  const block = el("section", { class: "db-subpanel db-common-event-editor" });
  block.append(commonEventNameRow(commonEvent, index, rerender));
  block.append(commonEventTriggerControl(commonEvent), commonEventConditionSwitchControl(commonEvent));

  const commands = el("div", { class: "cmd-list" });
  renderEventEditorInline(commands, commonEvent.commands, (next: Command[]) => {
    store.update((project) => {
      const target = project.commonEvents.find((record) => record.id === commonEvent.id);
      if (target) target.commands = structuredClone(next);
    });
  });
  block.append(el("label", { class: "db-field", children: [el("span", { text: "명령" }), commands] }));
  return block;
}

function commonEventNameRow(commonEvent: CommonEvent, index: number, rerender: () => void): HTMLElement {
  return namedRow(
    ordinalLabel(index),
    commonEvent.id,
    commonEvent.name,
    (value) => {
      store.update((project) => {
        const target = project.commonEvents.find((record) => record.id === commonEvent.id);
        if (target) target.name = value;
      });
    },
    () => {
      const remaining = store.getCurrent().commonEvents.filter((record) => record.id !== commonEvent.id);
      selectedCommonEventId = remaining[0]?.id ?? null;
      store.update((project) => {
        project.commonEvents = project.commonEvents.filter((record) => record.id !== commonEvent.id);
      });
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
    store.update((project) => {
      const target = project.commonEvents.find((record) => record.id === commonEvent.id);
      if (target) target.trigger = next.value;
    });
  });
  return el("label", { class: "db-field", children: [el("span", { text: "트리거" }), select] });
}

function commonEventConditionSwitchControl(commonEvent: CommonEvent): HTMLElement {
  const checkbox = el("input", { attrs: { type: "checkbox" } });
  const select = numberedSelect(store.getCurrent().switches, commonEvent.conditionSwitchId ?? "");
  checkbox.checked = !!commonEvent.conditionSwitchId;
  select.disabled = !checkbox.checked;
  const apply = () => {
    select.disabled = !checkbox.checked;
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
  const select = el("select");
  select.append(el("option", { text: "(없음)", attrs: { value: "" } }));
  for (const [index, option] of options.entries()) {
    select.append(el("option", { text: numberedName(index, option.name), attrs: { value: option.id } }));
  }
  select.value = value;
  return select;
}

function namedRow(
  ordinal: string,
  id: string,
  name: string,
  onName: (value: string) => void,
  onDelete: () => void
): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, value: name });
  input.addEventListener("input", () => onName(input.value));
  return el("div", {
    class: "db-row",
    children: [
      el("span", { class: "db-id", text: `${ordinal}:` }),
      input,
      el("span", { class: "db-meta", text: id.slice(0, 12) }),
      el("button", { class: "btn danger small", text: "삭제", on: { click: onDelete } }),
    ],
  });
}
