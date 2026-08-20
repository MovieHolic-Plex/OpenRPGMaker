import {
  COMMON_EVENT_TRIGGER_OPTIONS,
  commonEventTriggerLabel,
  ordinalLabel,
} from "@/editor/panels/databaseDisplay";
import { duplicateInto } from "@/editor/databaseCopy";
import { emptyToUndefined } from "@/editor/panels/databaseControls";
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
  listPane.append(el("div", { class: "db-toolbar", children: [addCommonEventButton(rerender), duplicateCommonEventButton(rerender)] }));

  // 0001:~0010: 빈 행은 실레코드가 아니다 — 클릭/편집이 전부 무반응인 순수 장식이었다
  // (qa-commonev-report.md 결함 3). 실제 레코드가 없으면 목록은 비워두고
  // "+ 공통 이벤트 추가"만 노출한다(다른 레코드 탭의 "레코드가 없습니다" 관례와 동일).
  const list = el("div", { class: "db-list db-common-event-list" });
  for (const [index, commonEvent] of commonEvents.entries()) {
    list.append(commonEventListRow(commonEvent, index, commonEvent.id === selected?.id, rerender));
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

function emptyCommonEventEditor(): HTMLElement {
  return el("section", {
    class: "db-subpanel db-common-event-editor db-common-event-empty-editor",
    text: "공용 이벤트가 없습니다 — \"+ 공통 이벤트 추가\"로 만드세요.",
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
        recordProjectSnapshot();
        store.update((project) => {
          project.commonEvents.push(next);
        });
        selectedCommonEventId = next.id;
        rerender();
      },
    },
  });
}

function duplicateCommonEventButton(rerender: () => void): HTMLElement {
  return el("button", {
    class: "btn small",
    text: "복제",
    dataset: { testid: "db-common-event-duplicate" },
    on: {
      click: () => {
        const id = selectedCommonEventId;
        if (!id) return;
        const copyId = genId("ce");
        recordProjectSnapshot();
        store.update((project) => {
          duplicateInto(project.commonEvents, id, copyId);
        });
        selectedCommonEventId = copyId;
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

  const commands = el("div", { class: "cmd-list", dataset: { testid: "db-common-event-command-list" } });
  renderDatabaseCommandListEditor(commands, {
    commands: commonEvent.commands,
    rerender,
    // 공통 이벤트 명령 배지는 common 컨텍스트 판정을 쓴다.
    runtimeSupport: (command) => commandRuntimeSupport(command, "common"),
    pickerContext: "common",
    replaceCommands: (next: Command[]) => updateCommonEventCommands(commonEvent.id, next),
  });
  block.append(el("fieldset", {
    class: "rm2k3-db-fieldset db-common-event-command-shell event-contents-fieldset",
    children: [el("legend", { text: "이벤트 명령" }), commands],
  }));
  return block;
}

function updateCommonEventCommands(commonEventId: string, commands: Command[]): void {
  store.update((project) => {
    const target = project.commonEvents.find((record) => record.id === commonEventId);
    if (target) target.commands = structuredClone(commands);
  });
}

function commonEventNameRow(commonEvent: CommonEvent, index: number, rerender: () => void): HTMLElement {
  return namedRow(
    ordinalLabel(index),
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
    class: "btn danger small",
    text: DELETE_IDLE_LABEL,
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
  return el("div", {
    class: "db-row",
    children: [
      el("span", { class: "db-id", text: `${ordinal}:` }),
      input,
      el("span", { class: "db-meta", text: id.slice(0, 12) }),
      deleteButton,
    ],
  });
}
