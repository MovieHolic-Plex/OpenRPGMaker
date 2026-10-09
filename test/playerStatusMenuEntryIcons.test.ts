import { describe, expect, it } from "vitest";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { renderStatusMenuDetailPanel } from "@/player/playerStatusMenuDetailRenderer";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import type { StatusMenuDetailOptions } from "@/player/playerStatusMenuDetailTypes";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

type DetailOverrides = Omit<StatusMenuDetailOptions, "project" | "session" | "slots" | "waitModeEnabled">;

function renderDetail(project: Project, session: PlaySession, overrides: DetailOverrides) {
  const detail = createStatusMenuDetail({
    project,
    session,
    slots: [],
    waitModeEnabled: true,
    ...overrides,
  });
  return { detail, panel: renderWithFakeDom(() => renderStatusMenuDetailPanel(project, detail)) };
}

describe("status menu entry icons", () => {
  it.each([
    { frameWidth: 384, frameHeight: 384, columns: 10, width: 100, height: 100 },
    { frameWidth: 96, frameHeight: 48, columns: 3, width: 100, height: 50 },
    { frameWidth: 48, frameHeight: 96, columns: 3, width: 50, height: 100 },
    { frameWidth: 96, frameHeight: 96, columns: 5, width: 100, height: 100, legacy: true },
  ])("crops one skill animation cell in the row and showcase for $frameWidth x $frameHeight", (sheet) => {
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const skill = project.database.skills[0];
    if (!actor || !skill) throw new Error("The starter project must have an actor and skill");
    const animation = normalizeBattleAnimationRecord({
      id: "anim_menu_crop",
      name: "Menu crop",
      resourceId: "generated-battle-anim-fire-burst",
      sheet,
    });
    if ("legacy" in sheet) delete animation.sheet;
    project.database.battleAnimations.push(animation);
    skill.animationId = animation.id;
    actor.learnedSkills = [{ level: 1, skillId: skill.id }];
    const session = startSession(project);
    const detail = createStatusMenuDetail({
      project, session, slots: [], waitModeEnabled: true,
      selectedCommand: "skills", skillActorId: actor.id, onSelectSkill: () => {},
    });
    const restoreDom = installFakeDom();
    try {
      const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, detail, { showcase: true }));
      for (const testId of [`status-menu-entry-icon-skill-${skill.id}`, "status-menu-showcase-art"]) {
        const icon = findByTestId(panel, testId);
        const crop = icon?.children[0];
        expect(crop, `${testId} must isolate one cell instead of containing the entire sheet`).toBeDefined();
        expect(crop?.getAttribute("style")).toContain(`width:${sheet.width}%`);
        expect(crop?.getAttribute("style")).toContain(`height:${sheet.height}%`);
        expect(crop?.getAttribute("style")).toContain(`background-size:${sheet.columns * 100}% auto`);
        expect(crop?.getAttribute("style")).toContain("background-position:0 0");
        expect(crop?.getAttribute("style")).toContain('background-image:url("/assets/generated/effects/effect-fire-burst.png")');
      }
    } finally {
      restoreDom();
    }
  });

  it.each(["missing-animation", "missing-resource"])("keeps the skill placeholder for %s", (missing) => {
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const skill = project.database.skills[0];
    if (!actor || !skill) throw new Error("The starter project must have an actor and skill");
    skill.animationId = "anim_menu_missing";
    if (missing === "missing-resource") {
      project.database.battleAnimations.push({ id: skill.animationId, name: "Missing resource" });
    }
    actor.learnedSkills = [{ level: 1, skillId: skill.id }];
    const restoreDom = installFakeDom();
    try {
      const { panel } = renderDetail(project, startSession(project), {
        selectedCommand: "skills", skillActorId: actor.id,
      });
      const icon = findByTestId(panel, `status-menu-entry-icon-skill-${skill.id}`);
      expect(icon?.className).toContain("missing");
      expect(icon?.getAttribute("style") ?? "").not.toContain("background-image");
    } finally {
      restoreDom();
    }
  });

  it("carries the authored item icon resource id on every inventory row", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const potion = project.database.items.find((record) => record.id === "item_potion")!;
    session.inventory[potion.id] = 2;

    const detail = createStatusMenuDetail({
      project,
      session,
      slots: [],
      waitModeEnabled: true,
      selectedCommand: "items",
    });

    const entry = detail.entries.find((candidate) => candidate.testId === `status-menu-item-${potion.id}`);
    expect(potion.iconResourceId).toBeTruthy();
    expect(entry?.icon?.resourceId).toBe(potion.iconResourceId);
    expect(entry?.icon?.testId).toBe(`status-menu-entry-icon-item-${potion.id}`);
    expect(entry?.icon?.alt).toBe(potion.name);
  });

  it("paints the resolved item icon url inline on the rendered row", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const potion = project.database.items.find((record) => record.id === "item_potion")!;
      session.inventory[potion.id] = 3;
      const url = resolveAssetResourceUrl(potion.iconResourceId, { project });
      expect(url).toBeTruthy();

      const { panel } = renderDetail(project, session, { selectedCommand: "items" });

      const icon = findByTestId(panel, `status-menu-entry-icon-item-${potion.id}`);
      expect(icon).not.toBeNull();
      expect(icon?.className).toContain("status-menu-entry-icon");
      expect(icon?.className).not.toContain("missing");
      expect(icon?.getAttribute("style")).toContain(`background-image:url("${url}")`);
      expect(icon?.getAttribute("style")).toContain("image-rendering:pixelated");
      expect(icon?.getAttribute("role")).toBe("img");
      expect(icon?.getAttribute("aria-label")).toBe(potion.name);
    } finally {
      restoreDom();
    }
  });

  it("paints the resolved equipment icon url on candidate rows", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0]!;
      const weapon = project.database.equipment.find((record) => record.id === "equip_sword")!;
      session.inventory[weapon.id] = 1;
      const url = resolveAssetResourceUrl(weapon.iconResourceId, { project });
      expect(url).toBeTruthy();

      const { detail, panel } = renderDetail(project, session, {
        selectedCommand: "equipment",
        equipmentActorId: actorId,
        equipmentSlotId: "weapon",
      });

      const entry = detail.entries.find((candidate) => candidate.testId === `status-menu-equipment-item-${weapon.id}`);
      expect(entry?.icon?.resourceId).toBe(weapon.iconResourceId);
      const icon = findByTestId(panel, `status-menu-entry-icon-equipment-${weapon.id}`);
      expect(icon).not.toBeNull();
      expect(icon?.getAttribute("style")).toContain(`background-image:url("${url}")`);
      expect(icon?.getAttribute("aria-label")).toBe(weapon.name);
    } finally {
      restoreDom();
    }
  });

  it("marks a graphic-less record with the missing class and no background image", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project);
      const plain = project.database.items.find((record) => record.id === "item_old_key")!;
      delete plain.iconResourceId;
      delete plain.imageResourceId;
      session.inventory[plain.id] = 1;

      const { panel } = renderDetail(project, session, { selectedCommand: "items" });

      const icon = findByTestId(panel, `status-menu-entry-icon-item-${plain.id}`);
      expect(icon).not.toBeNull();
      expect(icon?.className).toContain("missing");
      expect(icon?.getAttribute("style") ?? "").not.toContain("background-image");
      expect(icon?.getAttribute("aria-label")).toBe(`${plain.name} missing`);
    } finally {
      restoreDom();
    }
  });
});
