import { describe, expect, it } from "vitest";
import { startSession } from "@/project/session";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { renderStatusMenuDetailPanel } from "@/player/playerStatusMenuDetailRenderer";
import { listStatusMenuCommandIds } from "@/player/playerStatusMenuModel";
import { p2LifeProject } from "./fixtures/p2LifeSystems";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function renderLedger(tab: "collections" | "museum", inventory = 0) {
  const project = p2LifeProject();
  const trout = project.database.items.find((item) => item.id === "item_trout")!;
  trout.name = "은빛 비늘이 아침 햇살에 반짝이는 강송어 도감 기록".repeat(3);
  const session = startSession(project, 1701);
  session.inventory.item_trout = inventory;
  session.collections!.item_trout = { discovered: true, shippedCount: 12, caughtCount: 4, donated: false };
  const mutations: boolean[] = [];
  const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, createStatusMenuDetail({
    project,
    session,
    selectedCommand: "life-ledger",
    lifeLedgerTab: tab,
    slots: [],
    waitModeEnabled: true,
    onLifeLedgerMutation: (ok) => mutations.push(ok),
  })));
  return { project, session, trout, panel, mutations };
}

describe("P2 life ledger surface", () => {
  it("exposes collection and museum tabs with generated forage artwork and complete counts", () => {
    const restoreDom = installFakeDom();
    try {
      const { project, session, trout, panel } = renderLedger("collections");
      expect(listStatusMenuCommandIds(project, session)).toContain("life-ledger");
      for (const id of ["collections", "museum"]) {
        const tab = findByTestId(panel, `life-ledger-tab-${id}`);
        expect(tab?.tagName).toBe("BUTTON");
        expect(tab?.getAttribute("role")).toBe("tab");
      }
      expect(findByTestId(panel, "life-ledger-artwork")?.getAttribute("src")).toBe("/assets/farming/life-ui/foraging-card.png");
      expect(panel.textContent).toContain(trout.name);
      expect(panel.textContent).toContain("출하 12");
      expect(panel.textContent).toContain("낚시 4");
      expect(session.collections?.item_trout).toEqual({ discovered: true, shippedCount: 12, caughtCount: 4, donated: false });
    } finally {
      restoreDom();
    }
  });

  it("donates through the atomic museum API and disables repeated donation", () => {
    const restoreDom = installFakeDom();
    try {
      const first = renderLedger("museum", 1);
      findByTestId(first.panel, "life-ledger-museum-donate-item_trout")?.click();
      expect(first.mutations).toEqual([true]);
      expect(first.session.inventory.item_trout).toBeUndefined();
      expect(first.session.collections?.item_trout?.donated).toBe(true);
      expect(first.session.inventory.item_reward).toBe(2);
      expect(first.session.gold).toBe(50);

      const rerendered = renderWithFakeDom(() => renderStatusMenuDetailPanel(first.project, createStatusMenuDetail({
        project: first.project,
        session: first.session,
        selectedCommand: "life-ledger",
        lifeLedgerTab: "museum",
        slots: [],
        waitModeEnabled: true,
      })));
      expect(findByTestId(rerendered, "life-ledger-museum-donate-item_trout")?.getAttribute("disabled")).toBe("true");
      expect(rerendered.textContent).toContain("기부 완료");
    } finally {
      restoreDom();
    }
  });

  it("renders honest empty states without mutating the session", () => {
    const restoreDom = installFakeDom();
    try {
      const project = p2LifeProject();
      project.system.collections = { enabled: true, trackedItemIds: [] };
      project.database.fishSpecies = [];
      project.system.fishing = { enabled: false, spots: [] };
      project.system.seasonalForage = { enabled: false, areas: [] };
      project.system.museum = { enabled: true, eligibleItemIds: [], rewards: [] };
      const session = startSession(project, 1702);
      const frozen = structuredClone(session);
      const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, createStatusMenuDetail({
        project,
        session,
        selectedCommand: "life-ledger",
        lifeLedgerTab: "collections",
        slots: [],
        waitModeEnabled: true,
      })));
      expect(panel.textContent).toContain("수집 도감에 등록된 항목이 없습니다");
      expect(session).toEqual(frozen);
    } finally {
      restoreDom();
    }
  });
});
