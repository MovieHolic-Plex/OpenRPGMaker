import { expect, test, type Page } from "@playwright/test";
import {
  bootDbLane,
  collectConsoleErrors,
  dirtyGuardOracle,
  switchTabAnyMode,
} from "./dbAuditHelpers";
import { exportedProject, type DatabaseTabSpec } from "./oprn-database-helpers";

const OVERVIEW_TAB = { label: "Overview", slug: "overview", testId: "db-tab-overview" } as const satisfies DatabaseTabSpec;
const ACTIVE_TAB_KEY = "oprn:database.activeTab";

// STAT_COLLECTIONS in databaseOverviewView.ts — 9 chips, testid suffix = collection key.
const STAT_CHIPS = [
  { testId: "db-overview-stat-actors", countOf: (project: Awaited<ReturnType<typeof exportedProject>>) => project.database.actors.length },
  { testId: "db-overview-stat-classes", countOf: (project: Awaited<ReturnType<typeof exportedProject>>) => project.database.classes.length },
  { testId: "db-overview-stat-skills", countOf: (project: Awaited<ReturnType<typeof exportedProject>>) => project.database.skills.length },
  { testId: "db-overview-stat-items", countOf: (project: Awaited<ReturnType<typeof exportedProject>>) => project.database.items.length },
  { testId: "db-overview-stat-equipment", countOf: (project: Awaited<ReturnType<typeof exportedProject>>) => project.database.equipment.length },
  { testId: "db-overview-stat-enemies", countOf: (project: Awaited<ReturnType<typeof exportedProject>>) => project.database.enemies.length },
  { testId: "db-overview-stat-troops", countOf: (project: Awaited<ReturnType<typeof exportedProject>>) => project.database.troops.length },
  { testId: "db-overview-stat-states", countOf: (project: Awaited<ReturnType<typeof exportedProject>>) => project.database.states.length },
  { testId: "db-overview-stat-battleAnimations", countOf: (project: Awaited<ReturnType<typeof exportedProject>>) => project.database.battleAnimations.length },
] as const;

const ISSUE_JUMP_TAB: Record<string, string> = {
  overheal: "db-tab-items",
  "boss-hp-spike": "db-tab-enemies",
  "skill-stagnation": "db-tab-classes",
};

const EMPTY_ISSUES_TEXT = "감지된 밸런스 문제가 없습니다.";

test.describe("QA — Database Overview dashboard", () => {
  test.describe.configure({ timeout: 60_000 });

  test("fresh open: 9 stat chips match exportedProject, lazy charts, issues, read-only Escape", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });

    // W5: overview is never the default open tab when no last-used tab is stored.
    // bootDbLane clears oprn:database.activeTab, so readStoredActiveTab falls back to actors.
    await expect(page.getByTestId("db-tab-actors")).toHaveClass(/active/);
    await expect(page.getByTestId("db-tab-overview")).not.toHaveClass(/active/);
    await expect(page.getByTestId("db-overview-stat-items")).toHaveCount(0);

    await switchTabAnyMode(page, OVERVIEW_TAB);

    // Chips render on the first overview paint — assert them before awaiting idle charts.
    const project = await exportedProject(page);
    for (const chip of STAT_CHIPS) {
      const stat = page.getByTestId(chip.testId);
      await expect(stat).toBeVisible();
      await expect(stat.locator(".db-overview-stat-count")).toHaveText(String(chip.countOf(project)));
    }

    // requestIdleCallback + 200ms setTimeout fallback — wait on the injected nodes, never sleep.
    await expect(page.getByTestId("db-overview-curve")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("db-overview-scatter")).toBeVisible({ timeout: 10_000 });

    await assertIssuesOrJump(page);

    const close = await dirtyGuardOracle(page, "escape");
    expect(close.promptShown, "overview is read-only — Escape must not raise a dirty prompt").toBe(false);
    await expect(page.getByTestId("database-modal")).toBeHidden();
    await expect(page.getByTestId("database-dirty-prompt")).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test("seeded oprn:database.activeTab=overview persists as last-used tab", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, {
      mode: "expert",
      localStorageSeed: { [ACTIVE_TAB_KEY]: "overview" },
    });

    // Documented W5: last-used tab persists. overview is a valid DatabaseTab, so a
    // stored "overview" reopens the dashboard (it is only skipped as the *default*
    // when the key is absent — covered by the unseeded boot above).
    const stored = await page.evaluate((key) => localStorage.getItem(key), ACTIVE_TAB_KEY);
    expect(stored).toBe("overview");
    await expect(page.getByTestId("db-tab-overview")).toHaveClass(/active/);
    await expect(page.getByTestId("db-overview-stat-items")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

async function assertIssuesOrJump(page: Page): Promise<void> {
  const empty = page.getByTestId("db-overview-issues-empty");
  const jump = page.locator("[data-testid^='db-overview-issue-jump-']").first();
  const emptyVisible = await empty.isVisible().catch(() => false);
  if (emptyVisible) {
    await expect(empty).toHaveText(EMPTY_ISSUES_TEXT);
    return;
  }

  await expect(jump).toBeVisible({ timeout: 10_000 });
  const jumpTestId = await jump.getAttribute("data-testid");
  const kind = jumpTestId?.replace("db-overview-issue-jump-", "") ?? "";
  const targetTab = ISSUE_JUMP_TAB[kind];
  expect(targetTab, `issue jump ${jumpTestId} must map to a known tab`).toBeTruthy();

  const beforeWindow = await page.evaluateHandle(() => document.querySelector(".database-modal-window"));
  await jump.click();
  await expect(page.getByTestId(targetTab)).toHaveClass(/active/);

  const sameWindow = await page.evaluate(
    (el) => el === document.querySelector(".database-modal-window"),
    beforeWindow,
  );
  expect(sameWindow, "G006: issue-card jump must keep the same .database-modal-window instance").toBe(true);
  await beforeWindow.dispose();

  // Return to overview so the read-only Escape assertion still applies to this tab.
  await switchTabAnyMode(page, OVERVIEW_TAB);
  await expect(page.getByTestId("db-overview-stat-items")).toBeVisible();
}
