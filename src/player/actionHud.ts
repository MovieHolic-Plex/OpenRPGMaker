import type { ActionHudModel } from "@/player/actionCombatTypes";
import { ACTION_CONTROL_BINDINGS, ACTION_CONTROLS_GUIDE } from "@/player/keyBindings";

function el(tag: string, className: string, testId?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (testId) node.dataset.testid = testId;
  return node;
}

export class ActionHud {
  private readonly root: HTMLElement;
  private readonly weapon: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly hpRow: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly staminaRow: HTMLElement;
  private readonly staminaFill: HTMLElement;
  private readonly slotRow: HTMLElement;

  constructor(host: HTMLElement) {
    this.root = el("div", "action-hud", "action-hud");
    this.weapon = el("div", "action-hud-num", "action-hud-weapon");
    this.controls = el("div", "action-hud-num action-hud-controls", "action-hud-controls");
    this.hpRow = el("div", "action-hud-row action-hud-hp");
    const hpIcon = el("span", "action-hud-icon");
    hpIcon.textContent = "HP";
    const hpBar = el("div", "action-hud-bar");
    this.hpFill = el("div", "action-hud-bar-fill");
    hpBar.append(this.hpFill);
    this.hpText = el("span", "action-hud-num", "action-hud-hp-text");
    this.hpRow.append(hpIcon, hpBar, this.hpText);

    this.staminaRow = el("div", "action-hud-row action-hud-stamina", "action-hud-stamina-row");
    const stIcon = el("span", "action-hud-icon action-hud-icon-st");
    stIcon.textContent = "ST";
    const stBar = el("div", "action-hud-bar action-hud-bar-st");
    this.staminaFill = el("div", "action-hud-bar-fill action-hud-bar-fill-st");
    stBar.append(this.staminaFill);
    this.staminaRow.append(stIcon, stBar);

    // 스킬 슬롯 줄. R 로 순환하는 활성 슬롯을 표시한다(슬롯이 없으면 줄 자체를 숨긴다).
    this.slotRow = el("div", "action-hud-row action-hud-slots", "action-hud-slot-row");

    this.root.append(this.weapon, this.hpRow, this.staminaRow, this.slotRow, this.controls);
    host.append(this.root);
  }

  setHpVisible(visible: boolean): void {
    this.hpRow.style.display = visible ? "" : "none";
  }

  update(model: ActionHudModel): void {
    this.weapon.textContent = model.weaponName ?? "맨손";
    this.controls.textContent = ACTION_CONTROLS_GUIDE.split("\n").filter((_line, index) => {
      const id = ACTION_CONTROL_BINDINGS[index].id;
      return id === "attack" || (id === "dodge" && model.showStamina);
    }).join("\n");
    const ratio = model.maxHp > 0 ? Math.max(0, Math.min(1, model.hp / model.maxHp)) : 0;
    this.hpFill.style.width = `${Math.round(ratio * 100)}%`;
    this.hpFill.classList.toggle("is-low", ratio <= 0.25);
    this.hpText.textContent = `${Math.max(0, model.hp)}/${model.maxHp}`;
    this.staminaRow.style.display = model.showStamina ? "" : "none";
    if (model.showStamina) {
      const stRatio = model.staminaMax > 0 ? Math.max(0, Math.min(1, model.stamina / model.staminaMax)) : 0;
      this.staminaFill.style.width = `${Math.round(stRatio * 100)}%`;
    }
    this.staminaRow.classList.toggle("is-guarding", model.guarding);
    this.renderSlots(model);
  }

  private renderSlots(model: ActionHudModel): void {
    this.slotRow.style.display = model.skillSlotNames.length > 0 ? "" : "none";
    this.slotRow.replaceChildren();
    model.skillSlotNames.forEach((name, index) => {
      const chip = el("span", "action-hud-slot", `action-hud-slot-${index}`);
      chip.textContent = `${index + 1} ${name}`;
      chip.classList.toggle("is-active", index === model.activeSkillSlot);
      if (index === model.activeSkillSlot) chip.dataset.active = "true";
      this.slotRow.append(chip);
    });
  }

  destroy(): void {
    this.root.remove();
  }
}

export function mountActionHud(host: HTMLElement | null): ActionHud | null {
  if (!host) return null;
  return new ActionHud(host);
}
