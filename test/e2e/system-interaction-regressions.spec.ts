import { expect, test, type Page } from "@playwright/test";

async function openSystem(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.route("**/*", (route) => {
    const request = route.request();
    const crossOrigin = new URL(request.url()).origin !== new URL(page.url()).origin;
    if (crossOrigin && !["GET", "HEAD", "OPTIONS"].includes(request.method())) return route.abort("blockedbyclient");
    return route.continue();
  });
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 120_000 });
  for (const [button, overlay] of [["login-guest", "login-modal"], ["standard-welcome-start", "standard-welcome-card"], ["coach-mark-skip", ""]] as const) {
    if (await page.getByTestId(button).isVisible()) {
      await page.getByTestId(button).click();
      if (overlay) await page.getByTestId(overlay).waitFor({ state: "hidden" });
    }
  }
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-group-system").click();
  await page.getByTestId("db-tab-system").click();
  expect(await page.evaluate(async () => {
    const modulePath = "/src/project/store.ts";
    const { store }: typeof import("../../src/project/store") = await import(modulePath);
    return store.isRemotePersistenceEnabled();
  })).toBe(false);
}

async function navigate(page: Page, slug: string): Promise<void> {
  await page.getByTestId(`db-system-nav-${slug}`).click();
  await expect(page.locator(`[data-system-section="${slug}"]`)).toBeVisible();
}

async function system(page: Page) {
  return page.evaluate(async () => {
    const modulePath = "/src/project/store.ts";
    const { store }: typeof import("../../src/project/store") = await import(modulePath);
    return structuredClone(store.getCurrent().system);
  });
}

async function number(page: Page, id: string, value: number): Promise<void> {
  await page.getByTestId(id).fill(String(value));
  await page.getByTestId(id).press("Tab");
}

async function historyCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const modulePath = "/src/editor/mapEditHistory.ts";
    const { getMapEditHistoryEntries }: typeof import("../../src/editor/mapEditHistory") = await import(modulePath);
    return getMapEditHistoryEntries().length;
  });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test.describe(`System interaction regressions ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    test.beforeEach(async ({ page }) => { test.setTimeout(240_000); await openSystem(page); });

    test("R1 numeric blur preserves the first pointer action, keyboard target, scroll and coalesced undo", async ({ page }) => {
      await navigate(page, "title");
      const id = "db-field-title-screen-title-x";
      const before = (await system(page)).titleScreen!.layout.titleX;
      const beforeHistory = await historyCount(page);
      const input = page.getByTestId(id);
      await input.scrollIntoViewIfNeeded();
      const oldInput = await input.elementHandle();
      const oldIncrement = await page.getByTestId(`${id}-inc`).elementHandle();
      const oldDecrement = await page.getByTestId(`${id}-dec`).elementHandle();
      const scrollBefore = await page.getByTestId("db-system-sections").evaluate((e) => e.scrollTop);
      await input.fill("80");
      await page.getByTestId(`${id}-inc`).click();
      expect((await system(page)).titleScreen!.layout.titleX).toBe(81);
      await expect(input).toHaveValue("81");
      expect(await oldInput!.evaluate((e) => e.isConnected)).toBe(true);
      expect(await oldIncrement!.evaluate((e) => e.isConnected)).toBe(true);
      await input.fill("80");
      await page.getByTestId(`${id}-dec`).click();
      expect((await system(page)).titleScreen!.layout.titleX).toBe(79);
      await expect(input).toHaveValue("79");
      expect(await oldDecrement!.evaluate((e) => e.isConnected)).toBe(true);
      expect(Math.abs(await page.getByTestId("db-system-sections").evaluate((e) => e.scrollTop) - scrollBefore)).toBeLessThanOrEqual(1);
      expect(await historyCount(page)).toBe(beforeHistory + 1); // Key-coalescing is not time-based.
      await page.getByTestId("db-system-nav-title").focus();
      await page.keyboard.press("Control+z");
      await expect(input).toHaveValue(String(before));
      expect((await system(page)).titleScreen!.layout.titleX).toBe(before);

      for (const [slug, numericId, value] of [
        ["title", "db-field-title-screen-title-x", 80],
        ["display", "db-field-system-resolution-width", 633],
        ["display", "db-field-system-resolution-height", 355],
      ] as const) {
        await navigate(page, slug);
        const field = page.getByTestId(numericId);
        await field.fill(String(value));
        const handle = await field.elementHandle();
        await field.press("Tab");
        await expect(page.getByTestId(`${numericId}-inc`)).toBeFocused();
        expect(await handle!.evaluate((e) => e.isConnected)).toBe(true);
        await field.fill(String(value + 1));
        await field.press("Shift+Tab");
        await expect(page.getByTestId(`${numericId}-dec`)).toBeFocused();
        expect(await handle!.evaluate((e) => e.isConnected)).toBe(true);
      }
    });

    test("R2 text-only title edits survive replay using current resolution, background and effects", async ({ page }) => {
      // Establish authored FX before the text-only reproduction. No structural
      // refresh or selector change is allowed between those edits and replay.
      await page.evaluate(async () => {
        const modulePath = "/src/project/store.ts";
        const { store }: typeof import("../../src/project/store") = await import(modulePath);
        store.update((draft) => {
          const title = draft.system.titleScreen!;
          title.backgroundLayers = [{ resourceId: title.backgroundResourceId!, scrollXPerSec: 12, opacity: .65, parallax: 2.5 }];
          title.particles = { preset: "snow", density: 25 };
          title.intro = { logo: "fadeIn", menu: "slideUp", delayMs: 113, staggerMs: 47 };
        }, { scope: "system", label: "System regression fixture" });
      });
      await navigate(page, "resources");
      await page.getByTestId("db-system-refresh-previews").click();
      await navigate(page, "title");
      const titleInput = page.getByTestId("db-field-title-screen-title");
      const titleHandle = await titleInput.elementHandle();
      await titleInput.fill("FRESH_TITLE");
      await page.getByTestId("db-field-title-screen-new-game").fill("FRESH_NEW_GAME");
      await page.getByTestId("db-field-title-screen-resume").fill("FRESH_RESUME");
      expect(await titleHandle!.evaluate((e) => e.isConnected)).toBe(true);
      await navigate(page, "display");
      await number(page, "db-field-system-resolution-width", 633);
      await number(page, "db-field-system-resolution-height", 355);
      await navigate(page, "title");
      const authored = await system(page);
      const stage = page.getByTestId("db-title-workbench-stage");
      const oldStage = await stage.elementHandle();
      // Subscribe before the real pointer action, with a bounded exact signal.
      await page.evaluate(() => {
        const old = document.querySelector('[data-testid="db-title-workbench-stage"]')!;
        document.documentElement.dataset.systemReplayReplaced = "pending";
        const observer = new MutationObserver(() => {
          if (document.querySelector('[data-testid="db-title-workbench-stage"]') === old) return;
          clearTimeout(timeout);
          observer.disconnect();
          document.documentElement.dataset.systemReplayReplaced = "true";
        });
        const timeout = setTimeout(() => {
          observer.disconnect();
          document.documentElement.dataset.systemReplayReplaced = "timeout";
        }, 10_000);
        observer.observe(old.parentElement!, { childList: true });
      });
      await page.getByTestId("db-title-fx-replay").click();
      await expect(page.locator("html")).toHaveAttribute("data-system-replay-replaced", "true");
      expect(await oldStage!.evaluate((e) => e.isConnected)).toBe(false);
      await expect(page.getByTestId("db-title-workbench-title-text")).toHaveText(authored.titleScreen!.title);
      await expect(stage.locator('[data-title-menu-option="newGame"]')).toHaveText(authored.titleScreen!.menuLabels.newGame);
      await expect(stage.locator('[data-title-menu-option="resume"]')).toHaveText(authored.titleScreen!.menuLabels.resume!);
      await expect(stage).toHaveAttribute("data-play-resolution", "633x355");
      await expect(page.getByTestId("db-title-workbench-title-text")).toHaveClass(/rm-title-intro-fade-in/);
      expect(await page.getByTestId("db-title-workbench-title-text").evaluate((e) => e.style.animationDelay)).toBe("113ms");
      await expect(stage.locator('[data-title-menu-option="newGame"]')).toHaveClass(/rm-title-intro-slide-up/);
      const layer = stage.locator('[data-testid="title-bg-layer"]');
      await expect(layer).toHaveAttribute("data-title-layer-resource", authored.titleScreen!.backgroundLayers![0]!.resourceId);
      expect(await layer.evaluate((e) => e.style.getPropertyValue("--title-layer-scroll-x"))).toBe("30");
      expect(await layer.evaluate((e) => e.style.opacity)).toBe("0.65");
      const background = await page.evaluate(async () => {
        const storePath = "/src/project/store.ts", resolverPath = "/src/assets/generatedAssetResourceResolver.ts";
        const { store }: typeof import("../../src/project/store") = await import(storePath);
        const { resolveAssetResourceUrl }: typeof import("../../src/assets/generatedAssetResourceResolver") = await import(resolverPath);
        const project = store.getCurrent();
        return resolveAssetResourceUrl(project.system.titleScreen?.backgroundResourceId ?? project.system.titleResourceId, { project });
      });
      expect(await stage.evaluate((e) => e.style.backgroundImage)).toContain(background!);
      expect((await system(page)).titleScreen).toEqual(authored.titleScreen);
    });

    test("R3 clock bounds, normalized end display and steppers follow every committed start", async ({ page }) => {
      await navigate(page, "time");
      await page.getByTestId("db-field-system-time-enabled").check();
      const start = "db-field-system-time-day-start", end = "db-field-system-time-day-end";
      const oldEnd = await page.getByTestId(end).elementHandle();
      await number(page, start, 0);
      await expect(page.getByTestId(end)).toHaveAttribute("min", "1");
      await number(page, end, 1);
      expect((await system(page)).timeSystem).toMatchObject({ dayStartHour: 0, dayEndHour: 1 });
      await expect(page.getByTestId(end)).toHaveValue("1");
      await expect(page.getByTestId(`${end}-dec`)).toBeDisabled();
      await page.getByTestId(`${end}-inc`).click();
      await expect(page.getByTestId(end)).toHaveValue("2");
      await page.getByTestId(`${end}-dec`).click();
      await expect(page.getByTestId(end)).toHaveValue("1");
      await number(page, start, 10);
      expect((await system(page)).timeSystem).toMatchObject({ dayStartHour: 10, dayEndHour: 11 });
      await expect(page.getByTestId(end)).toHaveValue("11");
      await expect(page.getByTestId(end)).toHaveAttribute("min", "11");
      await expect(page.getByTestId(`${end}-dec`)).toBeDisabled();
      expect(await oldEnd!.evaluate((e) => e.isConnected)).toBe(true);
      await expect(page.getByTestId("db-system-time-summary")).toContainText("10:00 → 11:00");
      await page.getByTestId("db-system-nav-time").focus();
      await page.keyboard.press("Control+z");
      await expect(page.getByTestId(start)).toHaveValue("0");
      await expect(page.getByTestId(end)).toHaveValue("1");
      await expect(page.getByTestId(end)).toHaveAttribute("min", "1");
      await page.getByTestId("db-tab-terms").click();
      await page.getByTestId("db-tab-system").click();
      await navigate(page, "time");
      await expect(page.getByTestId(end)).toHaveValue("1");
      await expect(page.getByTestId(end)).toHaveAttribute("min", "1");
      await expect(page.getByTestId(`${end}-dec`)).toBeDisabled();
      await page.getByTestId(`${end}-inc`).click();
      expect((await system(page)).timeSystem!.dayEndHour).toBe(2);
    });

    test("R4 bottom-right matrix focus is visible after Escape and Enter without losing horizontal position", async ({ page }) => {
      await navigate(page, "typechart");
      await page.getByTestId("db-field-system-type-chart-types").fill(Array.from({ length: 32 }, (_, i) => `t${i}`).join(","));
      await page.getByTestId("db-field-system-type-chart-types").press("Tab");
      const cell = page.getByTestId("db-type-chart-t31-t30");
      await cell.click();
      const matrix = page.locator(".db-type-chart-scroll");
      const left = await matrix.evaluate((e) => e.scrollLeft);
      expect(left).toBeGreaterThan(0);
      const value = (await system(page)).typeChart!.multipliers.t31!.t30;
      for (const key of ["Escape", "Enter"] as const) {
        await cell.focus();
        await page.keyboard.press("F2");
        await expect(page.getByTestId("db-type-chart-popover-input")).toBeFocused();
        await page.getByTestId("db-type-chart-popover-input").fill("1.25");
        await page.keyboard.press(key);
        await expect(cell).toBeFocused();
        await expect(page.getByTestId("database-modal")).toBeVisible();
        const visible = await cell.evaluate((e) => {
          const cell = e.getBoundingClientRect();
          const body = e.closest(".db-system-sections")!.getBoundingClientRect();
          const matrix = e.closest(".db-type-chart-scroll")!.getBoundingClientRect();
          return cell.top >= body.top && cell.bottom <= body.bottom && cell.left >= Math.max(body.left, matrix.left) && cell.right <= Math.min(body.right, matrix.right);
        });
        expect(visible).toBe(true);
        expect(Math.abs(await matrix.evaluate((e) => e.scrollLeft) - left)).toBeLessThanOrEqual(1);
        expect((await system(page)).typeChart!.multipliers.t31!.t30).toBe(key === "Escape" ? value : 1.25);
      }
    });
  });
}
