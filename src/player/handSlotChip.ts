import { FieldHud, type HudRuntimeContext } from "./fieldHud";
import { normalizeFieldHud } from "@/project/fieldHud";
// player/handSlotChip.ts
// 손 슬롯 상시 HUD 칩. ActionHud 선례(작은 클래스 + mountX(host) 팩토리)를 따른다.
//
// 새 디자인은 FieldHud가 소유하고 legacy 선택만 기존 칩을 그린다.
import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { handSlotCurrent, handSlotIndex } from "@/player/handSlot";
import { isActionCombatMap } from "@/project/actionCombat";

const EMPTY_HAND_LABEL = "빈 손";

export class HandSlotChip {
  private readonly root: HTMLElement;
  private readonly label: HTMLElement;
  private readonly fieldHud: FieldHud;
  private lastText = "";

  constructor(host: HTMLElement) {
    this.fieldHud = new FieldHud(host);
    this.root = document.createElement("div");
    this.root.className = "hand-slot";
    this.root.dataset.testid = "hand-slot";
    this.root.setAttribute("aria-label", "손에 든 아이템");
    this.label = document.createElement("span");
    this.label.className = "hand-slot-label";
    this.label.dataset.testid = "hand-slot-label";
    this.label.setAttribute("role", "status");
    this.label.setAttribute("aria-live", "polite");
    this.root.append(this.label);
    host.append(this.root);
    this.render(EMPTY_HAND_LABEL, 0);
  }

  update(project: Project, session: PlaySession, context: HudRuntimeContext = {}): void {
    this.fieldHud.update(project, session, context);
    const config = normalizeFieldHud(project.system.fieldHud);
    const map = project.maps[session.currentMapId];
    const actionMap = isActionCombatMap(project, map);
    this.root.hidden = config.theme !== "legacy" || (actionMap && !map?.farmableArea?.length);
    this.root.setAttribute("aria-label", actionMap ? "농사 도구" : "손에 든 아이템");
    const entry = handSlotCurrent(project, session);
    const hand = entry ? `${entry.name} ×${entry.count}` : EMPTY_HAND_LABEL;
    const text = actionMap ? `농사: ${hand}` : hand;
    this.render(text, handSlotIndex(project, session));
  }

  destroy(): void {
    this.fieldHud.destroy();
    this.root.remove();
  }

  private render(text: string, index: number): void {
    this.root.dataset.slot = String(index);
    this.root.classList.toggle("is-empty", index === 0);
    if (text === this.lastText) return;
    this.lastText = text;
    this.label.textContent = text;
  }
}

export function mountHandSlotChip(host: HTMLElement | null): HandSlotChip | null {
  if (!host) return null;
  return new HandSlotChip(host);
}
