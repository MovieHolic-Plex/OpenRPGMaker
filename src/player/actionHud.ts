import type { ActionHudModel } from "@/player/actionCombatTypes";

function el(tag: string, className: string, testId?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (testId) node.dataset.testid = testId;
  return node;
}

export class ActionHud {
  private readonly root: HTMLElement;
  private readonly hpRow: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly staminaRow: HTMLElement;
  private readonly staminaFill: HTMLElement;

  constructor(host: HTMLElement) {
    this.root = el("div", "action-hud", "action-hud");
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

    this.root.append(this.hpRow, this.staminaRow);
    host.append(this.root);
  }

  setHpVisible(visible: boolean): void {
    this.hpRow.style.display = visible ? "" : "none";
  }

  update(model: ActionHudModel): void {
    const ratio = model.maxHp > 0 ? Math.max(0, Math.min(1, model.hp / model.maxHp)) : 0;
    this.hpFill.style.width = `${Math.round(ratio * 100)}%`;
    this.hpFill.classList.toggle("is-low", ratio <= 0.25);
    this.hpText.textContent = `${Math.max(0, model.hp)}/${model.maxHp}`;
    this.staminaRow.style.display = model.showStamina ? "" : "none";
    if (model.showStamina) {
      const stRatio = model.staminaMax > 0 ? Math.max(0, Math.min(1, model.stamina / model.staminaMax)) : 0;
      this.staminaFill.style.width = `${Math.round(stRatio * 100)}%`;
    }
  }

  destroy(): void {
    this.root.remove();
  }
}

export function mountActionHud(host: HTMLElement | null): ActionHud | null {
  if (!host) return null;
  return new ActionHud(host);
}
