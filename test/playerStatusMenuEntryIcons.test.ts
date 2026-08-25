import { describe, expect, it } from "vitest";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { renderStatusMenuDetailPanel } from "@/player/playerStatusMenuDetailRenderer";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
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
