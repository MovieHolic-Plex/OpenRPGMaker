import { applyEnemyActionBehaviourMode, enemyActionBehaviourMode, type EnemyActionBehaviourMode } from "@/editor/databaseEnemyActionMode";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { selectField } from "@/editor/panels/databaseControls";
import { openRecordPickerPanel } from "@/editor/panels/eventEditor/recordPickerDialog";
import { currentEnemy, openDialog, panel, replaceAction } from "@/editor/panels/databaseEnemyRecordSupport";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { storyFlagOptionLabel } from "@/project/storyFlags";
import { store } from "@/project/store";
import type { EnemyActionCondition, EnemyActionPattern, EnemyActionSwitchEffect, EnemyRecord, SkillId } from "@/project/types";
import { el } from "@/util/dom";

let actionClipboard: EnemyActionPattern | undefined;

export function openActionDialog(record: EnemyRecord, index: number, action: EnemyActionPattern, rerender: () => void): void {
  let nextAction: EnemyActionPattern = { ...action, condition: { ...action.condition } };
  let mode: EnemyActionBehaviourMode = enemyActionBehaviourMode(nextAction);
  const rating = numberInput("db-enemy-action-rating", 1, 100, nextAction.priority);
  const conditionType = conditionSelect(nextAction.condition.kind);
  const start = numberInput("db-enemy-action-turn-start", 1, 999, nextAction.condition.kind === "turn" ? nextAction.condition.start : 1);
  const interval = numberInput("db-enemy-action-turn-interval", 1, 999, nextAction.condition.kind === "turn" ? nextAction.condition.interval : 1);
  const skillHost = el("div", { class: "db-enemy-action-skill-host", dataset: { testid: "db-enemy-action-skill-host" } });
  const modeHost = el("div", { class: "db-enemy-behaviour-mode", dataset: { testid: "db-enemy-behaviour-mode" } });

  const rebuildSkill = (): void => {
    skillHost.replaceChildren(
      selectField("스킬", "db-enemy-action-dialog-skill", nextAction.skillId ?? "", store.getCurrent().database.skills, (skillId) => {
        nextAction = { ...nextAction, skillId: skillId as SkillId };
        mode = "skill";
        rebuildMode();
      }),
    );
    const select = skillHost.querySelector("select");
    if (select instanceof HTMLSelectElement) select.disabled = mode !== "skill";
  };

  const rebuildMode = (): void => {
    modeHost.replaceChildren(
      behaviourRadio("basic", "기본 행동", mode === "basic", () => {
        mode = "basic";
        nextAction = applyEnemyActionBehaviourMode(nextAction, "basic");
        rebuildMode();
        rebuildSkill();
      }),
      behaviourRadio("skill", "스킬", mode === "skill", () => {
        mode = "skill";
        const fallback = store.getCurrent().database.skills[0]?.id ?? "";
        nextAction = applyEnemyActionBehaviourMode(nextAction, "skill", nextAction.skillId || fallback);
        rebuildMode();
        rebuildSkill();
      }),
      skillHost,
    );
    rebuildSkill();
  };
  rebuildMode();

  const switchOn = switchEffectField("db-enemy-action-switch-on", nextAction.switchOnAfterAction, (effect) => {
    nextAction = { ...nextAction, switchOnAfterAction: effect };
  });
  const switchOff = switchEffectField("db-enemy-action-switch-off", nextAction.switchOffAfterAction, (effect) => {
    nextAction = { ...nextAction, switchOffAfterAction: effect };
  });
  const syncAction = (): void => {
    const condition: EnemyActionCondition = conditionType.value === "turn"
      ? { kind: "turn", start: Number(start.value), interval: Number(interval.value) }
      : { kind: "always" };
    nextAction = applyEnemyActionBehaviourMode(
      { ...nextAction, priority: Number(rating.value), condition },
      mode,
      nextAction.skillId ?? "",
    );
  };
  for (const input of [rating, conditionType, start, interval]) input.addEventListener("input", syncAction);
  openDialog("db-enemy-action-dialog", "공격 패턴", [
    panel("조건", [conditionHeader(conditionType, rating), conditionDetail(start, interval)]),
    panel("행동 후 스위치 ON", [switchOn]),
    panel("행동 후 스위치 OFF", [switchOff]),
    panel("행동", [modeHost]),
  ], [
    { label: "OK", testid: "db-enemy-action-ok", action: () => {
      syncAction();
      updateDatabaseRecord("enemies", record.id, { actions: replaceAction(currentEnemy(record).actions, index, nextAction) });
      rerender();
    } },
    { label: "Cancel", testid: "db-enemy-action-cancel" },
  ]);
}

export function openActionContextMenu(record: EnemyRecord, index: number, action: EnemyActionPattern, event: MouseEvent, rerender: () => void): void {
  event.preventDefault();
  document.querySelector(".db-enemy-context-menu")?.remove();
  document.querySelectorAll(".db-enemy-action-context-target").forEach((node) => node.classList.remove("db-enemy-action-context-target"));
  (event.currentTarget as HTMLElement | null)?.classList.add("db-enemy-action-context-target");
  const menu = el("div", {
    class: "db-enemy-context-menu",
    dataset: { testid: "db-enemy-action-context-menu" },
    children: contextMenuActions(record, index, action, rerender),
  });
  const close = (): void => {
    unregisterModal(menu);
    menu.remove();
    document.querySelectorAll(".db-enemy-action-context-target").forEach((node) => node.classList.remove("db-enemy-action-context-target"));
  };
  menu.addEventListener("click", close);
  setTimeout(() => document.addEventListener("click", close, { once: true }), 0);
  document.body.append(menu);
  // Escape 계층을 점유한다 — 등록하지 않으면 Escape 가 흘러 데이터베이스가 대신 닫힌다.
  registerModal(menu, close);
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(0, Math.min(event.clientX, window.innerWidth - rect.width - 4))}px`;
  menu.style.top = `${Math.max(0, Math.min(event.clientY, window.innerHeight - rect.height - 4))}px`;
}

function contextMenuActions(record: EnemyRecord, index: number, action: EnemyActionPattern, rerender: () => void): HTMLElement[] {
  return [
    contextMenuButton("edit", "편집...", "Enter", "db-enemy-action-context-edit", () => openActionDialog(record, index, action, rerender)),
    contextMenuButton("cut", "잘라내기", "Ctrl+X", "db-enemy-action-context-cut", () => {
      actionClipboard = cloneAction(action);
      updateDatabaseRecord("enemies", record.id, { actions: removeAction(currentEnemy(record).actions, index) });
      rerender();
    }),
    contextMenuButton("copy", "복사", "Ctrl+C", "db-enemy-action-context-copy", () => {
      actionClipboard = cloneAction(action);
    }),
    contextMenuButton("paste", "붙여넣기", "Ctrl+V", "db-enemy-action-context-paste", () => {
      if (!actionClipboard) return;
      updateDatabaseRecord("enemies", record.id, { actions: insertAction(currentEnemy(record).actions, index + 1, cloneAction(actionClipboard)) });
      rerender();
    }, !actionClipboard),
    contextMenuButton("delete", "삭제", "Del", "db-enemy-action-context-delete", () => {
      updateDatabaseRecord("enemies", record.id, { actions: removeAction(currentEnemy(record).actions, index) });
      rerender();
    }),
  ];
}

function behaviourRadio(mode: EnemyActionBehaviourMode, label: string, checked: boolean, onSelect: () => void): HTMLElement {
  const radio = el("input", {
    attrs: { type: "radio", name: "db-enemy-action-behaviour", value: mode },
    dataset: { testid: `db-enemy-action-mode-${mode}` },
  }) as HTMLInputElement;
  radio.checked = checked;
  radio.addEventListener("change", () => {
    if (radio.checked) onSelect();
  });
  return el("label", { class: "actor-check db-enemy-behaviour-row", children: [radio, el("span", { text: label })] });
}

function conditionSelect(value: EnemyActionCondition["kind"]): HTMLSelectElement {
  const select = el("select", { dataset: { testid: "db-enemy-action-condition-type" } }) as HTMLSelectElement;
  select.append(el("option", { text: "항상", attrs: { value: "always" } }), el("option", { text: "턴", attrs: { value: "turn" } }));
  select.value = value;
  return select;
}

function conditionHeader(conditionType: HTMLSelectElement, rating: HTMLInputElement): HTMLElement {
  return el("div", {
    class: "db-enemy-action-condition-grid",
    children: [el("label", { class: "db-field", children: [el("span", { text: "종류" }), conditionType] }), numberFieldNode("우선도", rating)],
  });
}

function conditionDetail(start: HTMLInputElement, interval: HTMLInputElement): HTMLElement {
  return el("div", { class: "db-enemy-condition-detail", children: [numberFieldNode("시작", start), numberFieldNode("간격", interval)] });
}

function switchEffectField(testid: string, effect: EnemyActionSwitchEffect, onChange: (effect: EnemyActionSwitchEffect) => void): HTMLElement {
  const options = switchOptions();
  const checkbox = el("input", { attrs: { type: "checkbox" }, dataset: { testid: `${testid}-enabled` } }) as HTMLInputElement;
  checkbox.checked = effect.enabled;
  checkbox.disabled = options.length === 0;
  const select = el("select", { dataset: { testid: `${testid}-id` } }) as HTMLSelectElement;
  for (const option of options) select.append(el("option", { text: option.name, attrs: { value: option.id } }));
  if (effect.switchId && !options.some((option) => option.id === effect.switchId)) {
    select.append(el("option", { text: `현재 값:${effect.switchId}`, attrs: { value: effect.switchId } }));
  }
  select.value = effect.switchId ?? options[0]?.id ?? "";
  select.disabled = options.length === 0;
  const sync = (): void => onChange({ enabled: checkbox.checked, switchId: select.value || undefined });
  const chooseSwitch = (switchId: string): void => {
    select.value = switchId;
    checkbox.checked = true;
    sync();
  };
  checkbox.addEventListener("change", sync);
  select.addEventListener("change", sync);
  return el("div", {
    class: "db-enemy-switch-effect",
    children: [
      el("label", { class: "actor-check", children: [checkbox, el("span", { text: "사용" })] }),
      select,
      switchPickerButton(`${testid}-picker`, switchPickerLabel(testid), options.length > 0, select.value, chooseSwitch),
    ],
  });
}

function switchPickerButton(testid: string, label: string, enabled: boolean, currentId: string, onSelect: (switchId: string) => void): HTMLButtonElement {
  const explanation = enabled ? `${label} 목록 열기` : `${label}할 스위치가 없습니다.`;
  const button = el("button", {
    class: "btn small",
    text: "...",
    attrs: { type: "button", title: explanation, "aria-label": label, ...(enabled ? {} : { disabled: "true", "aria-disabled": "true" }) },
    dataset: { testid },
    on: {
      click: () => {
        if (!enabled) return;
        openRecordPickerPanel({ kind: "switch", currentId, onSelect });
      },
    },
  }) as HTMLButtonElement;
  button.disabled = !enabled;
  return button;
}

function switchPickerLabel(testid: string): string {
  return testid.includes("switch-on") ? "스위치 ON 선택" : "스위치 OFF 선택";
}

function switchOptions(): readonly { readonly id: string; readonly name: string }[] {
  const project = store.getCurrent();
  return project.switches.map((entry, index) => ({ id: entry.id, name: storyFlagOptionLabel(project, "switch", entry, index) }));
}

function numberInput(testid: string, min: number, max: number, value: number): HTMLInputElement {
  return el("input", { attrs: { type: "number", min: String(min), max: String(max) }, value, dataset: { testid } }) as HTMLInputElement;
}

function numberFieldNode(label: string, input: HTMLInputElement): HTMLElement {
  return el("label", { class: "db-field", children: [el("span", { text: label }), input] });
}

function removeAction(actions: readonly EnemyActionPattern[], index: number): EnemyActionPattern[] {
  return actions.filter((_, actionIndex) => actionIndex !== index);
}

function insertAction(actions: readonly EnemyActionPattern[], index: number, action: EnemyActionPattern): EnemyActionPattern[] {
  const next = [...actions];
  next.splice(index, 0, action);
  return next;
}

function cloneAction(action: EnemyActionPattern): EnemyActionPattern {
  return {
    ...action,
    condition: { ...action.condition },
    switchOnAfterAction: { ...action.switchOnAfterAction },
    switchOffAfterAction: { ...action.switchOffAfterAction },
  };
}

function contextMenuButton(icon: string, label: string, shortcut: string, testid: string, action: () => void, disabled = false): HTMLElement {
  const button = el("button", {
    attrs: { type: "button" },
    dataset: { testid },
    children: [el("span", { class: `db-enemy-menu-icon ${icon}` }), el("span", { text: label }), el("kbd", { text: shortcut })],
    on: { click: () => {
      if (!disabled) action();
    } },
  }) as HTMLButtonElement;
  button.disabled = disabled;
  return button;
}
