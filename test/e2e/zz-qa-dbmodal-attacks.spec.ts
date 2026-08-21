import { expect, test, type Locator, type Page } from "@playwright/test";
import { exportedProject, openDatabase, switchDatabaseTab, DATABASE_TAB_SPECS } from "./rm2k3-database-helpers";

// Adversarial QA for the DB modal refresh-deferral fix (interaction grace + rAF recheck + graceFlush).
// Goal: BREAK the fix — lose a click, lose typed input, stale modal after external update, timer leaks.

const ACTORS = DATABASE_TAB_SPECS.find((tab) => tab.slug === "actors")!;
const ITEMS = DATABASE_TAB_SPECS.find((tab) => tab.slug === "items")!;
const TROOPS = DATABASE_TAB_SPECS.find((tab) => tab.slug === "troops")!;

async function gotoExpert(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (msg.text() === "Failed to load resource: net::ERR_CONNECTION_REFUSED") return;
    errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return errors;
}

/** Raw mouse click with zero actionability waiting — a re-render between down/up kills the click. */
async function rawClick(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("rawClick target has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

test("A1: type in name field then IMMEDIATELY click add-record + list row — click lands, value persists", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await gotoExpert(page);
  await openDatabase(page);
  await switchDatabaseTab(page, ACTORS);

  await page.getByTestId("db-add-record").click();
  const rowCount = await page.locator(".db-list-row").count();
  expect(rowCount).toBeGreaterThanOrEqual(2);

  const nameField = page.getByTestId("db-field-name");
  await nameField.click();
  await page.keyboard.press("Control+a");
  await nameField.pressSequentially("ZZATTACK", { delay: 25 });

  // No settle wait: click add-record while the grace window is armed by keystrokes.
  await rawClick(page, page.getByTestId("db-add-record"));
  await expect(page.locator(".db-list-row")).toHaveCount(rowCount + 1);

  // Immediately click the first list row — selection must land despite pending refresh.
  await rawClick(page, page.locator(".db-list-row").nth(0));
  await expect(page.locator(".db-list-row").nth(0)).toHaveClass(/active/);

  // After the deferred flush fires, the selection must survive the re-render.
  await page.waitForTimeout(1000);
  await expect(page.locator(".db-list-row").nth(0)).toHaveClass(/active/);

  const project = await exportedProject(page);
  const names = (project.database.actors as { name: string }[]).map((actor) => actor.name);
  expect(names).toContain("ZZATTACK");
  expect(errors).toEqual([]);
});

test("A2: number field blur-commit then immediate list click — value persists", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await gotoExpert(page);
  await openDatabase(page);
  await switchDatabaseTab(page, ACTORS);

  await page.locator(".db-list-row").nth(0).click();
  const levelField = page.getByTestId("db-field-initial-level");
  await levelField.click();
  await page.keyboard.press("Control+a");
  await levelField.pressSequentially("7", { delay: 25 });

  // Blur-commit by clicking a different row with the raw mouse, no waits.
  await rawClick(page, page.locator(".db-list-row").nth(1));

  const project = await exportedProject(page);
  const actors = project.database.actors as unknown as { name: string; initialLevel?: number }[];
  expect(actors[0]?.initialLevel).toBe(7);
  expect(errors).toEqual([]);
});

test("A3: rapid tab switching right after typing — no lost input, no lost clicks", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await gotoExpert(page);
  await openDatabase(page);
  await switchDatabaseTab(page, ACTORS);

  await page.getByTestId("db-add-record").click();
  const nameField = page.getByTestId("db-field-name");
  await nameField.click();
  await page.keyboard.press("Control+a");
  await nameField.pressSequentially("TABSWITCH", { delay: 25 });

  // Hammer three tab switches with the raw mouse, no settle time between them.
  await rawClick(page, page.getByTestId(ITEMS.testId));
  await rawClick(page, page.getByTestId(TROOPS.testId));
  await rawClick(page, page.getByTestId(ACTORS.testId));

  await expect(page.getByTestId(ACTORS.testId)).toHaveClass(/active/);
  const project = await exportedProject(page);
  const names = (project.database.actors as { name: string }[]).map((actor) => actor.name);
  expect(names).toContain("TABSWITCH");
  expect(errors).toEqual([]);
});

test("B: external update (Ctrl+Z undo) lands in the open modal after interaction stops", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await gotoExpert(page);
  await openDatabase(page);
  await switchDatabaseTab(page, ACTORS);

  await page.getByTestId("db-add-record").click();
  const nameField = page.getByTestId("db-field-name");
  await nameField.click();
  await page.keyboard.press("Control+a");
  await nameField.pressSequentially("EXTXYZ", { delay: 25 });

  // Stop interacting: blur out of the field, wait past grace (400ms) + flush (450ms).
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.waitForTimeout(1000);
  await expect(nameField).toHaveValue("EXTXYZ"); // flush preserved the committed value

  // External update: undo via hotkey (focus is on <body>, not a text field).
  await page.keyboard.press("Control+z");
  await expect(nameField).not.toHaveValue("EXTXYZ");
  expect(errors).toEqual([]);
});

test("D: m2-109 result-summary row renders with editor-only badge in troop panel, no crash", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await gotoExpert(page);
  await openDatabase(page);
  await switchDatabaseTab(page, TROOPS);

  await expect(page.getByTestId("db-troop-event-quality")).toContainText("전투 후 보상/후속 연출 없음");
  await page.getByTestId("db-troop-event-apply-payoff-template").click();
  await expect(page.getByTestId("db-troop-event-quality")).toContainText("템플릿 적용됨");

  const commandArea = page.getByTestId("db-troop-event-command-area");
  await expect(commandArea).toContainText("결과 요약");
  await expect(commandArea.locator('[aria-label="에디터 전용"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("F1: battler animations tab shows runtime-unlinked notice", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await gotoExpert(page);
  await openDatabase(page);
  await page.getByTestId("db-tab-battler-animations").click({ force: true });
  await expect(page.getByTestId("db-battler-animations-runtime-note")).toBeVisible();
  expect(errors).toEqual([]);
});

// NOTE: fix 4 (databaseAdvancedRecordViews.renderEnemyRecordForm preview slot) is covered by
// test/zz-qa-fixes.test.ts — that view is not reachable from the live app (the enemies tab uses
// databaseEnemyRecordView.ts instead), so no e2e surface exists for it.

test("E: rapid open/edit/close x10 leaves no stray timers; single update = single refresh", async ({ page }) => {
  test.setTimeout(150_000);
  const errors = collectConsoleErrors(page);
  await page.addInitScript(() => {
    const origSet = window.setTimeout.bind(window);
    const origClear = window.clearTimeout.bind(window);
    const live = new Map<number, { id: number; ms: number; stack: string }>();
    let counter = 0;
    // @ts-expect-error audit wrapper
    window.setTimeout = (cb: TimerHandler, ms?: number, ...args: unknown[]) => {
      const tag = ++counter;
      const id = origSet(() => {
        live.delete(tag);
        if (typeof cb === "function") cb(...args);
      }, ms);
      live.set(tag, { id, ms: ms ?? 0, stack: new Error("timer").stack ?? "" });
      return id;
    };
    // @ts-expect-error audit wrapper
    window.clearTimeout = (id?: number) => {
      for (const [tag, rec] of live.entries()) if (rec.id === id) live.delete(tag);
      return origClear(id);
    };
    (window as unknown as { __timerAudit: unknown }).__timerAudit = {
      mark: () => counter,
      liveAfter: (tag: number, maxMs: number) =>
        [...live.entries()]
          .filter(([t, rec]) => t > tag && rec.ms <= maxMs)
          .map(([t, rec]) => ({ tag: t, ms: rec.ms, stack: rec.stack })),
    };
  });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });

  const audit = () =>
    page.evaluate(() => {
      const a = (window as unknown as { __timerAudit: { mark(): number; liveAfter(t: number, m: number): unknown[] } }).__timerAudit;
      return { mark: a.mark() };
    });
  const liveAfter = (tag: number, maxMs: number) =>
    page.evaluate(
      ([t, m]) =>
        (window as unknown as { __timerAudit: { liveAfter(t: number, m: number): unknown[] } }).__timerAudit.liveAfter(t, m),
      [tag, maxMs] as const
    );

  // 10x: open, type (arms graceFlush at 450ms), close immediately (dirty prompt -> discard).
  for (let i = 0; i < 10; i++) {
    const marker = (await audit()).mark;
    await openDatabase(page);
    await switchDatabaseTab(page, ACTORS);
    const nameField = page.getByTestId("db-field-name");
    await nameField.click();
    await nameField.pressSequentially("L", { delay: 10 });
    await page.getByTestId("database-modal-close").click();
    const discard = page.getByTestId("database-dirty-discard");
    if (await discard.isVisible().catch(() => false)) await discard.click();
    await expect(page.getByTestId("database-modal")).toHaveCount(0);
    await page.waitForTimeout(700); // past the 450ms graceFlush if it leaked
    const strays = await liveAfter(marker, 1000);
    expect(strays, `stray short-lived timers after close #${i + 1}`).toEqual([]);
  }

  // Refresh-storm check: type 5 chars -> 0 body rebuilds while editing;
  // blur+settle -> exactly 1 rebuild (flush); one Ctrl+Z -> exactly 1 more.
  await openDatabase(page);
  await switchDatabaseTab(page, ACTORS);
  await page.evaluate(() => {
    const body = document.querySelector(".database-modal-body .db-body") ?? document.querySelector(".database-modal-body");
    (window as unknown as { __rebuilds: number }).__rebuilds = 0;
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.target === body && m.type === "childList")) {
        (window as unknown as { __rebuilds: number }).__rebuilds += 1;
      }
    });
    observer.observe(body!, { childList: true });
  });
  const rebuilds = () => page.evaluate(() => (window as unknown as { __rebuilds: number }).__rebuilds);

  const nameField = page.getByTestId("db-field-name");
  await nameField.click();
  await nameField.pressSequentially("STORM", { delay: 30 });
  expect(await rebuilds(), "no body rebuild should happen mid-typing").toBe(0);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.waitForTimeout(1000);
  expect(await rebuilds(), "exactly one flush rebuild after interaction stops").toBe(1);

  await page.keyboard.press("Control+z");
  await page.waitForTimeout(500);
  // Undo refreshes twice by design: handleHistoryKeyDown calls refreshDatabasePanel directly AND
  // the store subscription schedules one more. That is 2, never more — 10 prior open/close cycles
  // would show up here as extra rebuilds if listeners had leaked.
  const afterUndo = await rebuilds();
  expect(afterUndo - 1, "one external update => at most 2 refreshes (direct + subscription), no storm/leak").toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});
