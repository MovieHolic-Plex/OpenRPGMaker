import { describe, expect, it } from "vitest";
import { createBlankProject, createFarmingDemoProject } from "@/project/defaults";
import { calendarDayKey } from "@/project/gameTime";
import { startSession } from "@/project/session";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { renderStatusMenuDetailPanel } from "@/player/playerStatusMenuDetailRenderer";
import { listStatusMenuCommandIds } from "@/player/playerStatusMenuModel";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function renderAnimals(project: ReturnType<typeof createFarmingDemoProject>, session: ReturnType<typeof startSession>, mutations: boolean[] = []) {
  return renderWithFakeDom(() => renderStatusMenuDetailPanel(project, createStatusMenuDetail({
    project,
    session,
    selectedCommand: "life-ledger",
    lifeLedgerTab: "animals",
    slots: [],
    waitModeEnabled: true,
    onLifeLedgerMutation: (ok) => mutations.push(ok),
  })));
}

describe("P1 animal life-ledger runtime UI", () => {
  it("exposes the ledger for an animals-only project and renders generated animal artwork", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createFarmingDemoProject();
      project.system.shipping = undefined;
      project.system.bundles = undefined;
      project.system.makers = undefined;
      project.system.skillSystem = undefined;
      project.database.lifeSkills = undefined;
      const session = startSession(project, 801);

      expect(listStatusMenuCommandIds(project, session)).toContain("life-ledger");
      const detail = createStatusMenuDetail({
        project,
        session,
        selectedCommand: "life-ledger",
        lifeLedgerTab: "animals",
        slots: [],
        waitModeEnabled: true,
      });
      expect(detail.entries[0]?.testId).toBe("life-ledger-animal-summary-farm_animal_bori");
      const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, detail));
      expect(findByTestId(panel, "life-ledger-tab-animals")?.getAttribute("aria-selected")).toBe("true");
      expect(findByTestId(panel, "life-ledger-artwork")?.getAttribute("src")).toContain("animals-card.png");
      expect(panel.textContent).toContain("보리");
      expect(panel.textContent).toContain("닭");
    } finally {
      restoreDom();
    }
  });

  it("feeds, pets, and collects through the farm-animal authorities", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createFarmingDemoProject();
      const session = startSession(project, 802);
      const mutations: boolean[] = [];
      const dayKey = calendarDayKey(session.gameTime!);
      session.inventory.item_hay = 1;

      findByTestId(renderAnimals(project, session, mutations), "life-ledger-animal-feed-farm_animal_bori")?.click();
      expect(session.inventory.item_hay).toBeUndefined();
      expect(session.farmAnimals?.farm_animal_bori?.lastFedDayKey).toBe(dayKey);

      findByTestId(renderAnimals(project, session, mutations), "life-ledger-animal-pet-farm_animal_bori")?.click();
      expect(session.farmAnimals?.farm_animal_bori?.lastPettedDayKey).toBe(dayKey);
      expect(session.farmAnimals?.farm_animal_bori?.friendship).toBe(15);

      session.farmAnimals!.farm_animal_bori!.readyProductCount = 2;
      findByTestId(renderAnimals(project, session, mutations), "life-ledger-animal-collect-farm_animal_bori")?.click();
      expect(session.farmAnimals?.farm_animal_bori?.readyProductCount).toBe(0);
      expect(session.inventory.item_egg).toBe(2);
      expect(mutations).toEqual([true, true, true]);
    } finally {
      restoreDom();
    }
  });

  it("keeps the ledger absent for a truly legacy project", () => {
    const project = createBlankProject();
    expect(listStatusMenuCommandIds(project, startSession(project))).not.toContain("life-ledger");
  });
});
