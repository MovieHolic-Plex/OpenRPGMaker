import { expect, test, type Page } from "@playwright/test";
import {
  bootDbLane,
  collectConsoleErrors,
  COMMON_DB_TAB_TEST_IDS,
  switchTabAnyMode,
} from "./dbAuditHelpers";
import { DATABASE_TAB_SPECS, exportedProject } from "./rm2k3-database-helpers";

const ELEMENTS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "elements")!;
const ACTIVE_TAB_KEY = "rpg-zzu.database.activeTab";
const HELP_TOAST = "데이터베이스에서 레코드와 시스템 설정을 조정합니다.";

// Observed beginner common-nav labels (database.ts COMMON_TAB_IDS + uiLabel).
const BEGINNER_COMMON_LABELS = ["개요", "주인공", "아이템", "몬스터", "적 그룹", "시스템"] as const;
// uiLabel("databaseShort", "plain") — the only jargon-switched string in database.ts.
const BEGINNER_NAV_ALL_SUMMARY = "모든 자료";
// Expert grouped chrome (TAB_GROUPS) — jargonStyle is "technical" but tab ids stay hardcoded.
const EXPERT_GROUP_LABELS = ["전투", "수집", "세계", "시스템"] as const;

test.describe("QA — beginner Database mode", () => {
  test.describe.configure({ timeout: 60_000 });

  test("G1 beginner boot shows exactly the 6 common tabs plus collapsed db-nav-all", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "beginner" });

    await expect(page.locator("body")).toHaveClass(/editor-ui-beginner/);
    await expect(page.getByTestId("toolbar-database")).toBeHidden();

    const nav = page.locator(".db-tabs");
    const directTabIds = await nav.locator(":scope > .db-tab").evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.testid ?? ""),
    );
    expect(directTabIds).toEqual([...COMMON_DB_TAB_TEST_IDS]);

    const all = page.getByTestId("db-nav-all");
    await expect(all).toBeVisible();
    await expect(all).not.toHaveAttribute("open");
    await expect(all.locator("summary")).toHaveText(BEGINNER_NAV_ALL_SUMMARY);
    await expect(page.getByTestId("db-tab-elements")).toBeHidden();
    await expect(page.getByTestId("db-tab-switches")).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("G2 hidden-tab elements edit stays on the same modal and persists deterministically", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "beginner" });

    const beforeWindow = await page.evaluateHandle(() => document.querySelector(".database-modal-window"));
    const beforeCount = (await exportedProject(page)).database.elements?.length ?? 0;
    expect(beforeCount).toBe(17);

    await switchTabAnyMode(page, ELEMENTS_TAB);
    await expect(page.getByTestId("db-nav-all")).toHaveAttribute("open", "");
    await expect(page.getByTestId("db-elements-classic")).toBeVisible();

    const nextCount = beforeCount + 1;
    await page.getByTestId("db-elements-maximum-number").click();
    await expect(page.getByTestId("db-elements-max-dialog")).toBeVisible();
    await page.getByTestId("db-elements-max-count-input").fill(String(nextCount));
    await page.getByTestId("db-elements-max-ok").click();
    await expect(page.getByTestId("db-elements-max-dialog")).toHaveCount(0);
    await expect
      .poll(async () => (await exportedProject(page)).database.elements?.length ?? 0)
      .toBe(nextCount);

    const sameWindow = await page.evaluate(
      (el) => el === document.querySelector(".database-modal-window"),
      beforeWindow,
    );
    expect(sameWindow, "elements edit must keep the same .database-modal-window instance").toBe(true);
    await beforeWindow.dispose();

    await page.getByTestId("database-footer-apply").click();
    await expect(page.getByTestId("db-footer-status")).toContainText("적용했습니다");
    await page.getByTestId("database-modal-close").click();
    await expect(page.getByTestId("database-modal")).toBeHidden();

    await page.getByTestId("menu-tools").click();
    await page.getByTestId("menu-tools-database").click();
    await expect(page.getByTestId("database-modal")).toBeVisible();

    const stored = await page.evaluate((key) => localStorage.getItem(key), ACTIVE_TAB_KEY);
    expect(stored).toBe("elements");
    await expect(page.getByTestId("db-tab-elements")).toHaveClass(/active/);
    await expect(page.getByTestId("db-elements-classic")).toBeVisible();
    // Common nav rebuilds <details> closed. The persisted hidden tab stays active in
    // the body; the rail does not auto-expand db-nav-all on reopen.
    await expect(page.getByTestId("db-nav-all")).not.toHaveAttribute("open");
    expect(errors).toEqual([]);
  });

  test("G3 beginner nav uses the plain uiLabel pair and differs from expert", async ({ browser }) => {
    const beginnerContext = await browser.newContext();
    const beginnerPage = await beginnerContext.newPage();
    const beginnerErrors = collectConsoleErrors(beginnerPage);
    await bootDbLane(beginnerPage, { mode: "beginner" });
    const beginnerLabels = await visibleDbNavLabels(beginnerPage);
    expect(beginnerLabels.slice(0, BEGINNER_COMMON_LABELS.length)).toEqual([...BEGINNER_COMMON_LABELS]);
    expect(beginnerLabels).toContain(BEGINNER_NAV_ALL_SUMMARY);
    expect(beginnerLabels).not.toContain("모든 DB");
    expect(beginnerErrors).toEqual([]);
    await beginnerContext.close();

    const expertContext = await browser.newContext();
    const expertPage = await expertContext.newPage();
    const expertErrors = collectConsoleErrors(expertPage);
    await bootDbLane(expertPage, { mode: "expert" });
    const expertLabels = await visibleDbNavLabels(expertPage);
    expect(expertLabels).toEqual(expect.arrayContaining([...EXPERT_GROUP_LABELS]));
    expect(expertLabels).not.toContain(BEGINNER_NAV_ALL_SUMMARY);
    await expect(expertPage.getByTestId("db-nav-all")).toHaveCount(0);
    await expect(expertPage.getByTestId("toolbar-database")).toHaveText("DB");
    expect(expertLabels).not.toEqual(beginnerLabels);
    expect(expertErrors).toEqual([]);
    await expertContext.close();
  });

  test("G4 first-visit beginner reaches Database from the Tools menu and help toasts", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "beginner" });

    await expect(page.getByTestId("basic-left-rail")).toBeVisible();
    await expect(page.getByTestId("toolbar-database")).toBeHidden();
    await expect(page.getByTestId("menu-tools")).toBeVisible();

    await page.getByTestId("database-modal-close").click();
    await expect(page.getByTestId("database-modal")).toBeHidden();

    await page.getByTestId("menu-tools").click();
    await expect(page.getByTestId("menu-tools-database")).toBeVisible();
    await page.getByTestId("menu-tools-database").click();
    await expect(page.getByTestId("database-modal")).toBeVisible();

    await page.locator(".database-modal-footer").getByRole("button", { name: "도움말", exact: true }).click();
    await expect(page.getByTestId("toast")).toContainText(HELP_TOAST);
    expect(errors).toEqual([]);
  });

  test("G5 beginner dock at 1024x768 does not overflow horizontally", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "beginner", viewport: { width: 1024, height: 768 } });

    await page.getByTestId("database-dock-toggle").click();
    await expect(page.getByTestId("database-modal")).toHaveClass(/is-docked/);

    const overflow = await page.evaluate(() => {
      const modal = document.querySelector(".database-modal-window");
      if (!(modal instanceof HTMLElement)) return { ok: false, scrollWidth: 0, clientWidth: 0 };
      return {
        ok: modal.scrollWidth <= modal.clientWidth + 1,
        scrollWidth: modal.scrollWidth,
        clientWidth: modal.clientWidth,
      };
    });
    expect(overflow.ok, `horizontal overflow ${overflow.scrollWidth} > ${overflow.clientWidth}+1`).toBe(true);
    expect(errors).toEqual([]);
  });

  test("malformed rpg-zzu.database.activeTab still opens the beginner modal", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, {
      mode: "beginner",
      localStorageSeed: { [ACTIVE_TAB_KEY]: "{{not-a-tab" },
    });
    await expect(page.getByTestId("database-modal")).toBeVisible();
    await expect(page.getByTestId("db-tab-actors")).toHaveClass(/active/);
    expect(errors).toEqual([]);
  });
});

async function visibleDbNavLabels(page: Page): Promise<string[]> {
  return page.locator(".db-tabs").evaluate((root) => {
    const texts: string[] = [];
    const visit = (node: Element): void => {
      if (!(node instanceof HTMLElement) || node.hidden) return;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return;
      if (node.matches(".db-tab, .db-tab-group, summary")) {
        const text = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
        if (text) texts.push(text);
        return;
      }
      for (const child of Array.from(node.children)) visit(child);
    };
    visit(root);
    return texts;
  });
}
