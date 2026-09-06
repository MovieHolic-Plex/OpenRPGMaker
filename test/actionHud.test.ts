/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { ActionHud } from "@/player/actionHud";
import { mountHandSlotChip } from "@/player/handSlotChip";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { ACTION_CONTROL_BINDINGS, ACTION_CONTROLS_GUIDE } from "@/player/keyBindings";

afterEach(() => document.body.replaceChildren());

describe("action combat HUD identity", () => {
  it("ships the same attack and moving-dodge guide as the authored controls", () => {
    const host = document.createElement("div");
    const hud = new ActionHud(host);
    const guide = ACTION_CONTROLS_GUIDE.split("\n").filter((_line, index) =>
      ["attack", "dodge"].includes(ACTION_CONTROL_BINDINGS[index].id)).join("\n");

    hud.update({
      hp: 30, maxHp: 40, stamina: 80, staminaMax: 100,
      showStamina: true, skillSlotNames: [], activeSkillSlot: 0, guarding: false,
    });

    expect(host.querySelector('[data-testid="action-hud-controls"]')?.textContent).toBe(guide);
    hud.destroy();
  });

  it("renders the equipped weapon and updates it when equipment changes", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const hud = new ActionHud(host);
    const model = {
      hp: 30, maxHp: 40, stamina: 80, staminaMax: 100,
      showStamina: true, skillSlotNames: [], activeSkillSlot: 0, guarding: false,
      weaponName: "Practice sword",
    };

    hud.update(model);

    expect(host.querySelector('[data-testid="action-hud-weapon"]')?.textContent).toBe(model.weaponName);
    const reequipped = { ...model, weaponName: "Iron sword" };
    hud.update(reequipped);
    expect(host.querySelector('[data-testid="action-hud-weapon"]')?.textContent).toBe("Iron sword");
    hud.destroy();
    expect(host.children).toHaveLength(0);
  });

  it("hides the farming hand chip only on action maps without farming", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const map = project.maps[session.currentMapId];
    project.system.actionCombat = { enabled: true };
    map.actionCombat = true;
    const host = document.createElement("div");
    const chip = mountHandSlotChip(host);

    chip?.update(project, session);

    expect(host.querySelector<HTMLElement>('[data-testid="hand-slot"]')?.hidden).toBe(true);
    map.farmableArea = [{ x: 1, y: 1, w: 2, h: 2 }];
    chip?.update(project, session);
    expect(host.querySelector<HTMLElement>('[data-testid="hand-slot"]')?.hidden).toBe(false);
    expect(host.querySelector('[data-testid="hand-slot"]')?.getAttribute("aria-label")).toBe("농사 도구");
    map.actionCombat = false;
    chip?.update(project, session);
    expect(host.querySelector<HTMLElement>('[data-testid="hand-slot"]')?.hidden).toBe(false);
    expect(host.querySelector('[data-testid="hand-slot-label"]')?.textContent).toBe("빈 손");
    chip?.destroy();
  });
});
