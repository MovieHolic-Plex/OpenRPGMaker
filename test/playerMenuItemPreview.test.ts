import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { menuItemUnavailableReason, previewMenuItemTarget, useItemFromMenu } from "@/player/playerItemUse";

function fixture() {
  const project = createBlankProject();
  const session = startSession(project);
  const actorId = session.partyActorIds[0]!;
  const item = project.database.items.find((item) => item.id === "item_potion")!;
  Object.assign(item, { type: "medicine", occasion: "always", scope: "ally", hpRecovery: { flat: 50, percentMax: 0 } });
  session.actorVitals[actorId] = { hp: 80, maxHp: 100, mp: 5, maxMp: 20 };
  session.inventory[item.id] = 2;
  return { project, session, actorId, item };
}

describe("menu item previews share the execution rules", () => {
  it("predicts clamped recovery without mutating the session or its random stream", () => {
    const { project, session, actorId, item } = fixture();
    const before = structuredClone(session);
    const preview = previewMenuItemTarget(project, session, item, actorId);
    expect(preview).toMatchObject({ hp: 80, hpAfter: 100, mp: 5, mpAfter: 5, reason: undefined });
    expect(session).toEqual(before);
    expect(useItemFromMenu(project, session, item.id, actorId).kind).toBe("used");
    expect(session.actorVitals[actorId]!.hp).toBe(preview.hpAfter);
    expect(session.inventory[item.id]).toBe(1);
  });

  it("does not advertise saved medicine effects after changing an item to goods", () => {
    const { project, session, actorId, item } = fixture();
    item.type = "normalGoods";
    const preview = previewMenuItemTarget(project, session, item, actorId);
    expect(preview.reason).toBeTruthy();
    expect(preview.hpAfter).toBe(80);
    expect(useItemFromMenu(project, session, item.id, actorId)).toEqual({ kind: "unusable", message: preview.reason });
    expect(session.inventory[item.id]).toBe(2);
  });

  it("explains battle-only items before opening a target list", () => {
    const { item } = fixture();
    item.occasion = "battle";
    expect(menuItemUnavailableReason(item)).toBe("전투 중에만 사용할 수 있습니다");
  });

  it("keeps state-removal targets usable even with full HP and MP", () => {
    const { project, session, actorId, item } = fixture();
    const state = project.database.states[0]!;
    item.healStateIds = [state.id];
    session.actorVitals[actorId] = { hp: 100, maxHp: 100, mp: 20, maxMp: 20 };
    session.actorStateIds[actorId] = [state.id];
    expect(previewMenuItemTarget(project, session, item, actorId).reason).toBeUndefined();
    expect(useItemFromMenu(project, session, item.id, actorId).kind).toBe("used");
    expect(session.actorStateIds[actorId]).toEqual([]);
  });

  it("explains dead-only and full-health targets without consuming a charge", () => {
    const { project, session, actorId, item } = fixture();
    item.onlyEffectiveOnDeadActors = true;
    expect(previewMenuItemTarget(project, session, item, actorId).reason).toContain("전투불능 대상");
    item.onlyEffectiveOnDeadActors = false;
    session.actorVitals[actorId]!.hp = 100;
    expect(previewMenuItemTarget(project, session, item, actorId).reason).toBe("적용할 효과가 없습니다");
    expect(session.inventory[item.id]).toBe(2);
  });
});
