import { deleteSwitch, deleteVariable, renameSwitch, renameVariable } from "@/editor/actions";
import { bulkRenameSwitches, bulkRenameVariables } from "@/editor/databaseActions";
import {
  emptyToUndefined,
  matchesNameOrId,
  selectRecord,
  selectTextLiteral,
  textControl,
} from "@/editor/panels/databaseControls";
import { renderEventEditorInline } from "@/editor/panels/eventEditor";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import type { Command, CommonEvent } from "@/project/types";

let switchSearch = "";
let variableSearch = "";
let utilitySearchTimer: number | null = null;

export function renderSwitchesTab(host: HTMLElement, rerender: () => void): void {
  host.append(el("h3", { text: "스위치" }), utilityShell());
  const form = host.querySelector("[data-testid='db-detail-form']");
  if (!(form instanceof HTMLElement)) return;
  form.append(rangeControls("스위치 범위 이름 변경", "switch", rerender));
  form.append(searchInput("스위치 검색", switchSearch, (value) => {
    switchSearch = value;
    rerender();
  }));
  for (const record of store.getCurrent().switches) {
    if (switchSearch && !matchesNameOrId(record.name, record.id, switchSearch)) continue;
    form.append(namedRow(record.id, record.name, (value) => renameSwitch(record.id, value), () => {
      deleteSwitch(record.id);
      rerender();
    }));
  }
}

export function renderVariablesTab(host: HTMLElement, rerender: () => void): void {
  host.append(el("h3", { text: "변수" }), utilityShell());
  const form = host.querySelector("[data-testid='db-detail-form']");
  if (!(form instanceof HTMLElement)) return;
  form.append(rangeControls("변수 범위 이름 변경", "variable", rerender));
  form.append(searchInput("변수 검색", variableSearch, (value) => {
    variableSearch = value;
    rerender();
  }));
  for (const record of store.getCurrent().variables) {
    if (variableSearch && !matchesNameOrId(record.name, record.id, variableSearch)) continue;
    form.append(namedRow(record.id, record.name, (value) => renameVariable(record.id, value), () => {
      deleteVariable(record.id);
      rerender();
    }));
  }
}

export function renderCommonEventsTab(host: HTMLElement, rerender: () => void): void {
  host.append(el("h3", { text: "공통 이벤트" }), utilityShell());
  const form = host.querySelector("[data-testid='db-detail-form']");
  if (!(form instanceof HTMLElement)) return;
  form.append(
    el("button", {
      class: "btn small",
      text: "+ 공통 이벤트 추가",
      on: {
        click: () => {
          store.update((project) => {
            project.commonEvents.push({
              id: genId("ce"),
              name: "새 공통 이벤트",
              trigger: "none",
              commands: [{ kind: "text", body: "" }],
            });
          });
          rerender();
        },
      },
    })
  );
  for (const commonEvent of store.getCurrent().commonEvents) form.append(commonEventEditor(commonEvent, rerender));
}

export function renderSystemTab(host: HTMLElement): void {
  const project = store.getCurrent();
  const form = el("section", { class: "db-detail-form", dataset: { testid: "db-detail-form" } });
  form.append(
    textControl("타이틀 리소스", project.system.titleResourceId ?? "", (value) => {
      store.update((draft) => {
        draft.system.titleResourceId = emptyToUndefined(value);
      });
    }, "db-field-title-resource"),
    textControl("시스템 리소스", project.system.systemResourceId ?? "", (value) => {
      store.update((draft) => {
        draft.system.systemResourceId = emptyToUndefined(value);
      });
    }),
    textControl("전투 시스템 리소스", project.system.battleSystemResourceId ?? "", (value) => {
      store.update((draft) => {
        draft.system.battleSystemResourceId = emptyToUndefined(value);
      });
    }),
    selectRecord("시작 파티", project.system.startActorIds[0] ?? "", project.database.actors, (value) => {
      store.update((draft) => {
        draft.system.startActorIds = value ? [value] : [];
        draft.session.partyActorIds = value ? [value] : [];
      });
    }),
    selectRecord("초기 적 그룹", project.system.initialTroopId ?? "", project.database.troops, (value) => {
      store.update((draft) => {
        draft.system.initialTroopId = emptyToUndefined(value);
      });
    })
  );
  host.append(el("h3", { text: "시스템" }), form);
}

export function renderTermsTab(host: HTMLElement): void {
  const terms = store.getCurrent().meta.terms;
  const form = el("section", { class: "db-detail-form", dataset: { testid: "db-detail-form" } });
  form.append(
    termField("돈", "gold", terms.gold, "db-field-gold"),
    termField("레벨", "level", terms.level ?? "레벨"),
    termField("HP", "hp", terms.hp ?? "HP"),
    termField("MP", "mp", terms.mp ?? "MP"),
    termField("공격", "attack", terms.attack ?? "공격"),
    termField("스킬", "skill", terms.skill ?? "스킬", "db-field-skill-term"),
    termField("아이템", "item", terms.item ?? "아이템")
  );
  host.append(el("h3", { text: "용어" }), form);
}

function utilityShell(): HTMLElement {
  return el("section", { class: "db-detail-form", dataset: { testid: "db-detail-form" } });
}

function rangeControls(label: string, kind: "switch" | "variable", rerender: () => void): HTMLElement {
  const start = el("input", { attrs: { type: "number", min: "1" }, value: 1 });
  const count = el("input", { attrs: { type: "number", min: "1" }, value: 10 });
  const prefix = el("input", { attrs: { type: "text" }, value: kind === "switch" ? "스위치" : "변수" });
  const button = el("button", {
    class: "btn small",
    text: "범위 적용",
    on: {
      click: () => {
        if (kind === "switch") bulkRenameSwitches(Number(start.value), Number(count.value), prefix.value);
        else bulkRenameVariables(Number(start.value), Number(count.value), prefix.value);
        rerender();
      },
    },
  });
  return el("div", { class: "db-range", children: [el("span", { text: label }), start, count, prefix, button] });
}

function commonEventEditor(commonEvent: CommonEvent, rerender: () => void): HTMLElement {
  const block = el("section", { class: "db-subpanel" });
  block.append(namedRow(commonEvent.id, commonEvent.name, (value) => {
    store.update((project) => {
      const target = project.commonEvents.find((record) => record.id === commonEvent.id);
      if (target) target.name = value;
    });
  }, () => {
    store.update((project) => {
      project.commonEvents = project.commonEvents.filter((record) => record.id !== commonEvent.id);
    });
    rerender();
  }));
  const trigger = selectTextLiteral("트리거", commonEvent.trigger, ["none", "auto", "parallel"], (value) => {
    store.update((project) => {
      const target = project.commonEvents.find((record) => record.id === commonEvent.id);
      if (target) target.trigger = value;
    });
  });
  block.append(trigger, selectRecord("조건 스위치", commonEvent.conditionSwitchId ?? "", store.getCurrent().switches, (value) => {
    store.update((project) => {
      const target = project.commonEvents.find((record) => record.id === commonEvent.id);
      if (target) target.conditionSwitchId = emptyToUndefined(value);
    });
  }));
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

function namedRow(id: string, name: string, onName: (value: string) => void, onDelete: () => void): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, value: name });
  input.addEventListener("input", () => onName(input.value));
  return el("div", {
    class: "db-row",
    children: [
      el("span", { class: "db-id", text: id.slice(0, 12) }),
      input,
      el("button", { class: "btn danger small", text: "삭제", on: { click: onDelete } }),
    ],
  });
}

function searchInput(placeholder: string, value: string, onInput: (value: string) => void): HTMLElement {
  const input = el("input", { attrs: { type: "search", placeholder }, value });
  input.addEventListener("input", () => {
    const cursor = input.selectionStart ?? input.value.length;
    const nextValue = input.value;
    if (utilitySearchTimer !== null) window.clearTimeout(utilitySearchTimer);
    utilitySearchTimer = window.setTimeout(() => {
      utilitySearchTimer = null;
      onInput(nextValue);
      const next = document.querySelector<HTMLInputElement>(".db-body .db-search input");
      if (!next) return;
      next.focus();
      next.setSelectionRange(cursor, cursor);
    }, 80);
  });
  return el("div", { class: "db-search", children: [input] });
}

function termField(label: string, key: "attack" | "gold" | "hp" | "item" | "level" | "mp" | "skill", value: string, testid?: string): HTMLElement {
  return textControl(label, value, (next) => {
    store.update((project) => {
      project.meta.terms[key] = next;
    });
  }, testid);
}
