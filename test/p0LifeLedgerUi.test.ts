import { describe, expect, it } from "vitest";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { renderStatusMenuDetailPanel } from "@/player/playerStatusMenuDetailRenderer";
import { listStatusMenuCommandIds } from "@/player/playerStatusMenuModel";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function ledgerRuntime() {
  const project = createBlankProject();
  const longName = "새벽 안개를 머금은 최고급 무지개 감자 ".repeat(5).trim();
  const item = normalizeItemRecord({ id: "item_ledger_crop", name: longName, scope: "none", price: 120 });
  project.database.items.push(item);
  project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28 };
  project.system.shipping = { enabled: true, allowedItemIds: [item.id] };
  project.system.bundles = [{
    id: "bundle_crop",
    name: "봄 작물 꾸러미",
    requirements: [{ itemId: item.id, count: 2 }],
  }];
  project.system.skillSystem = { enabled: true };
  project.database.lifeSkills = [{
    id: "life_farming",
    name: "농사",
    skillType: "farming",
    maxLevel: 10,
    levelUpRewards: [],
  }];
  project.system.makers = [{
    id: "maker_crop",
    name: "감자 가공기",
    inputs: [{ itemId: item.id, count: 1 }],
    outputs: [{ itemId: item.id, count: 1 }],
    durationMinutes: 30,
  }];
  const session = startSession(project, 301);
  session.inventory[item.id] = 5;
  return { project, session, item, longName };
}

describe("P0 life ledger status menu", () => {
  it("does not expose the optional record command for a legacy project", () => {
    const project = createBlankProject();
    expect(listStatusMenuCommandIds(project, startSession(project))).not.toContain("life-ledger");
  });

  it("renders five pointer/keyboard reachable tabs, generated artwork, and long names without truncating the text node", () => {
    const restoreDom = installFakeDom();
    try {
      const { project, session, longName } = ledgerRuntime();
      const selected: string[] = [];
      const detail = createStatusMenuDetail({
        project,
        session,
        selectedCommand: "life-ledger",
        lifeLedgerTab: "shipping",
        slots: [],
        waitModeEnabled: true,
        onSelectLifeLedgerTab: (tab) => selected.push(tab),
      });
      const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, detail));

      for (const tab of ["shipping", "bundles", "skills", "makers", "animals"]) {
        const button = findByTestId(panel, `life-ledger-tab-${tab}`);
        expect(button?.tagName).toBe("BUTTON");
        expect(button?.getAttribute("role")).toBe("tab");
      }
      expect(findByTestId(panel, "life-ledger-tab-shipping")?.getAttribute("aria-selected")).toBe("true");
      expect(findByTestId(panel, "life-ledger-artwork")?.getAttribute("src")).toContain("/assets/farming/life-ui/");
      expect(panel.textContent).toContain(longName);
      findByTestId(panel, "life-ledger-tab-bundles")?.click();
      expect(selected).toEqual(["bundles"]);
    } finally {
      restoreDom();
    }
  });

  it("deposits and withdraws real inventory through shipping APIs", () => {
    const restoreDom = installFakeDom();
    try {
      const { project, session, item } = ledgerRuntime();
      const mutations: boolean[] = [];
      const renderShipping = () => renderWithFakeDom(() => renderStatusMenuDetailPanel(project, createStatusMenuDetail({
        project,
        session,
        selectedCommand: "life-ledger",
        lifeLedgerTab: "shipping",
        slots: [],
        waitModeEnabled: true,
        onLifeLedgerMutation: (ok) => mutations.push(ok),
      })));

      findByTestId(renderShipping(), `life-ledger-shipping-deposit-${item.id}`)?.click();
      expect(session.inventory[item.id]).toBe(4);
      expect(session.shippingQueue?.[item.id]).toBe(1);
      findByTestId(renderShipping(), `life-ledger-shipping-withdraw-${item.id}`)?.click();
      expect(session.inventory[item.id]).toBe(5);
      expect(session.shippingQueue?.[item.id]).toBeUndefined();
      expect(mutations).toEqual([true, true]);
    } finally {
      restoreDom();
    }
  });

  it("contributes bundles and starts/collects makers through their pure APIs", () => {
    const restoreDom = installFakeDom();
    try {
      const { project, session, item } = ledgerRuntime();
      const detailFor = (lifeLedgerTab: "bundles" | "makers") => renderWithFakeDom(() => renderStatusMenuDetailPanel(project, createStatusMenuDetail({
        project,
        session,
        selectedCommand: "life-ledger",
        lifeLedgerTab,
        slots: [],
        waitModeEnabled: true,
      })));

      findByTestId(detailFor("bundles"), `life-ledger-bundle-bundle_crop-${item.id}`)?.click();
      expect(session.bundleContributions?.bundle_crop?.[item.id]).toBe(1);

      findByTestId(detailFor("makers"), "life-ledger-maker-maker_crop")?.click();
      expect(session.makerInstances?.["ledger:maker_crop"]?.status).toBe("processing");
      session.makerInstances!["ledger:maker_crop"] = {
        ...session.makerInstances!["ledger:maker_crop"]!,
        status: "ready",
      };
      const before = session.inventory[item.id];
      findByTestId(detailFor("makers"), "life-ledger-maker-maker_crop")?.click();
      expect(session.makerInstances?.["ledger:maker_crop"]?.status).toBe("idle");
      expect(session.inventory[item.id]).toBe(before + 1);
    } finally {
      restoreDom();
    }
  });

  it("shows empty tabs and stale records without crashing or mutating them", () => {
    const restoreDom = installFakeDom();
    try {
      const { project, session } = ledgerRuntime();
      project.system.makers = [];
      session.makerInstances = {
        stale: { instanceId: "stale", makerId: "deleted-maker", status: "ready", startedAtMinute: 0, readyAtMinute: 1 },
      };
      const frozen = structuredClone(session);
      const detail = createStatusMenuDetail({
        project,
        session,
        selectedCommand: "life-ledger",
        lifeLedgerTab: "makers",
        slots: [],
        waitModeEnabled: true,
      });
      const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, detail));
      expect(panel.textContent).toContain("등록된 가공 설비가 없습니다");
      expect(panel.textContent).toContain("삭제된 가공 설비");
      expect(session).toEqual(frozen);
    } finally {
      restoreDom();
    }
  });
});
