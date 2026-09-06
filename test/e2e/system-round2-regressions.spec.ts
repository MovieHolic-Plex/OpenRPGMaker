import { expect, test, type Page } from "@playwright/test";
import type { SystemRecords } from "../../src/project/types";

async function openSystem(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.route("**/*", (route) => {
    const request = route.request();
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) && new URL(request.url()).origin !== new URL(page.url()).origin) return route.abort("blockedbyclient");
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
    const path = "/src/project/store.ts";
    const { store }: typeof import("../../src/project/store") = await import(path);
    return store.isRemotePersistenceEnabled();
  })).toBe(false);
}
async function system(page: Page): Promise<SystemRecords> {
  return page.evaluate(async () => {
    const path = "/src/project/store.ts";
    const { store }: typeof import("../../src/project/store") = await import(path);
    return structuredClone(store.getCurrent().system);
  });
}
async function nav(page: Page, slug: string): Promise<void> {
  await page.getByTestId(`db-system-nav-${slug}`).click();
  await expect(page.locator(`[data-system-section="${slug}"]`)).toBeVisible();
}
async function historyCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const path = "/src/editor/mapEditHistory.ts";
    const { getMapEditHistoryEntries }: typeof import("../../src/editor/mapEditHistory") = await import(path);
    return getMapEditHistoryEntries().length;
  });
}
async function canonicalCommit(page: Page, id: string, typed: number, expected: number, read: (system: SystemRecords) => number, bounds?: readonly [number, number]): Promise<void> {
  const input = page.getByTestId(id);
  const original = await input.elementHandle();
  await input.fill(String(typed));
  await input.press("Tab");
  const stored = read(await system(page));
  expect(stored).toBeCloseTo(expected, 10);
  expect(Number(await input.inputValue())).toBeCloseTo(stored, 10);
  expect(await original!.evaluate((e) => e.isConnected)).toBe(true);
  if (bounds) {
    expect(await page.getByTestId(`${id}-dec`).isDisabled()).toBe(stored <= bounds[0]);
    expect(await page.getByTestId(`${id}-inc`).isDisabled()).toBe(stored >= bounds[1]);
  }
}
type TransportProbe = { play: number; stop: number; stage: number; replay: number; click: string };

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test.describe(`System round-two boundaries ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    test.beforeEach(async ({ page }) => { test.setTimeout(420_000); await openSystem(page); });

    test("R1-FX one transport click after effect typing calls through exactly once", async ({ page }) => {
      await nav(page, "title");
      await page.getByTestId("db-field-title-screen-intro-logo").selectOption("fadeIn");
      const delay = page.getByTestId("db-field-title-screen-intro-delay");
      const oldInput = await delay.elementHandle();
      const oldPreview = await page.getByTestId("db-title-workbench-preview").elementHandle();
      const transports = ["db-title-bgm-play", "db-title-bgm-stop", "db-title-fx-replay"] as const;
      const handles = await Promise.all(transports.map((id) => page.getByTestId(id).elementHandle()));
      await page.evaluate(async () => {
        const path = "/src/player/audio/index.ts";
        const { getAudioEngine }: typeof import("../../src/player/audio") = await import(path);
        const engine = getAudioEngine(), play = engine.play, stop = engine.stopAll;
        const host = window as typeof window & { systemTransportProbe: TransportProbe };
        host.systemTransportProbe = { play: 0, stop: 0, stage: 0, replay: 0, click: "" };
        engine.play = function (...args) { host.systemTransportProbe.play++; return play.apply(this, args); };
        engine.stopAll = function (...args) { host.systemTransportProbe.stop++; return stop.apply(this, args); };
        document.addEventListener("click", (event) => {
          host.systemTransportProbe.click = event.target instanceof Element ? event.target.closest("button")?.dataset.testid ?? "" : "";
        }, true);
        const replace = Element.prototype.replaceWith;
        Element.prototype.replaceWith = function (...nodes) {
          if (this instanceof HTMLElement && this.dataset.testid === "db-title-workbench-stage") {
            host.systemTransportProbe.stage++;
            if (host.systemTransportProbe.click === "db-title-fx-replay") host.systemTransportProbe.replay++;
          }
          return replace.apply(this, nodes);
        };
      });
      const initialDelay = (await system(page)).titleScreen!.intro?.delayMs ?? 0;
      const initialHistory = await historyCount(page);
      for (const [index, id] of transports.entries()) {
        await page.evaluate(() => {
          const host = window as typeof window & { systemTransportProbe: TransportProbe };
          host.systemTransportProbe = { play: 0, stop: 0, stage: 0, replay: 0, click: "" };
        });
        await delay.fill(String(117 + index));
        await page.getByTestId(id).scrollIntoViewIfNeeded();
        const scroll = await page.getByTestId("db-system-sections").evaluate((e) => e.scrollTop);
        await page.getByTestId(id).click();
        const calls = await page.evaluate(() => (window as typeof window & { systemTransportProbe: TransportProbe }).systemTransportProbe);
        expect(calls[id === "db-title-bgm-play" ? "play" : id === "db-title-bgm-stop" ? "stop" : "replay"]).toBe(1);
        expect(calls.click).toBe(id);
        // Blur has its own stage refresh. It is not proof that Replay ran.
        expect(calls.stage).toBe(id === "db-title-fx-replay" ? 2 : 1);
        expect((await system(page)).titleScreen!.intro!.delayMs).toBe(117 + index);
        expect(await oldInput!.evaluate((e) => e.isConnected)).toBe(true);
        expect(await oldPreview!.evaluate((e) => e.isConnected)).toBe(true);
        for (const handle of handles) expect(await handle!.evaluate((e) => e.isConnected)).toBe(true);
        await expect(page.getByTestId(id)).toBeFocused();
        expect(Math.abs(await page.getByTestId("db-system-sections").evaluate((e) => e.scrollTop) - scroll)).toBeLessThanOrEqual(1);
      }
      expect(await historyCount(page)).toBe(initialHistory + 1);
      await page.getByTestId("db-system-nav-title").focus();
      await page.keyboard.press("Control+z");
      await expect(delay).toHaveValue(String(initialDelay));
    });

    test("R5 every title numeric domain writes its canonical value into the same input", async ({ page }) => {
      await nav(page, "title");
      await page.getByTestId("db-field-title-screen-presentation").selectOption("both");
      await page.getByTestId("db-field-title-screen-intro-logo").selectOption("fadeIn");
      await page.getByTestId("db-title-layer-add").click();
      for (const [suffix, property, maximum] of [["title-x", "titleX", 320], ["title-y", "titleY", 240], ["menu-x", "menuX", 320], ["menu-y", "menuY", 240]] as const) {
        for (const [typed, expected] of [[80.9, 80], [-1, 0], [maximum + 1, maximum]]) {
          await canonicalCommit(page, `db-field-title-screen-${suffix}`, typed!, expected!, (s) => s.titleScreen!.layout[property], [0, maximum]);
        }
      }
      for (const [axis, maximum] of [["x", 320], ["y", 240]] as const) {
        await canonicalCommit(page, `db-field-title-screen-logo-${axis}`, 80.9, 80, (s) => s.titleScreen!.titleGraphic![axis], [0, maximum]);
      }
      for (const [suffix, property, maximum, fallback] of [["intro-delay", "delayMs", 10000, 0], ["intro-stagger", "staggerMs", 2000, 90]] as const) {
        for (const [typed, expected] of [[maximum + 1, maximum], [-1, 0], [117.9, 117]]) {
          await canonicalCommit(page, `db-field-title-screen-${suffix}`, typed!, expected!, (s) => s.titleScreen!.intro?.[property] ?? fallback, [0, maximum]);
        }
      }
      for (const [axis, property] of [["x", "scrollXPerSec"], ["y", "scrollYPerSec"]] as const) {
        for (const [typed, expected] of [[481, 480], [-481, -480], [.125, .125], [0, 0]]) {
          await canonicalCommit(page, `db-field-title-screen-layer-0-scroll-${axis}`, typed!, expected!, (s) => s.titleScreen!.backgroundLayers![0]![property] ?? 0, [-480, 480]);
        }
        expect((await system(page)).titleScreen!.backgroundLayers![0]![property]).toBeUndefined();
      }
      for (const [typed, expected] of [[150, 100], [-1, 0], [33.25, 33.25]]) {
        await canonicalCommit(page, "db-field-title-screen-layer-0-opacity", typed!, expected!, (s) => (s.titleScreen!.backgroundLayers![0]!.opacity ?? 1) * 100, [0, 100]);
      }
      const speed = page.getByTestId("db-field-title-screen-layer-0-scroll-x");
      await speed.fill("");
      await speed.pressSequentially("0.125");
      await expect(speed).toHaveValue("0.125");
      expect((await system(page)).titleScreen!.backgroundLayers![0]!.scrollXPerSec).toBeUndefined();
      await speed.press("Tab");
      expect(await speed.evaluate((e) => (e as HTMLInputElement).validity.valid)).toBe(true);
      expect((await system(page)).titleScreen!.backgroundLayers![0]!.scrollXPerSec).toBe(.125);
      await page.getByTestId("db-system-nav-title").focus();
      await page.keyboard.press("Control+z");
      await expect(speed).toHaveValue("0");
      await page.getByTestId("db-tab-terms").click();
      await page.getByTestId("db-tab-system").click();
      await nav(page, "title");
      await canonicalCommit(page, "db-field-title-screen-layer-0-scroll-x", .125, .125, (s) => s.titleScreen!.backgroundLayers![0]!.scrollXPerSec ?? 0);
    });

    test("R5 startup, Time, action and care counters use their domain normalizers", async ({ page }) => {
      await nav(page, "startup");
      await canonicalCommit(page, "db-field-system-active-slots", 3.9, 3, (s) => s.activeSlots ?? 0);
      await canonicalCommit(page, "db-field-system-active-slots", -1, 0, (s) => s.activeSlots ?? 0);
      expect((await system(page)).activeSlots).toBeUndefined();
      await nav(page, "time");
      await page.getByTestId("db-field-system-time-enabled").check();
      await canonicalCommit(page, "db-field-system-time-minutes-per-second", 0, 1, (s) => s.timeSystem!.minutesPerRealSecond!);
      await canonicalCommit(page, "db-field-system-time-minutes-per-second", 2.5, 2.5, (s) => s.timeSystem!.minutesPerRealSecond!);
      await canonicalCommit(page, "db-field-system-time-day-start", 6.9, 6, (s) => s.timeSystem!.dayStartHour!, [0, 23]);
      await canonicalCommit(page, "db-field-system-time-day-end", 26.9, 26, (s) => s.timeSystem!.dayEndHour!, [7, 48]);
      await canonicalCommit(page, "db-field-system-time-days-per-season", 100, 99, (s) => s.timeSystem!.daysPerSeason!, [1, 99]);
      await canonicalCommit(page, "db-field-system-time-days-per-season", 1.9, 1, (s) => s.timeSystem!.daysPerSeason!, [1, 99]);
      await nav(page, "optin");
      await page.getByTestId("db-field-system-action-combat").check();
      for (const [suffix, key, typed, expected] of [
        ["iframes", "playerIframesMs", 117.6, 118], ["swing-cooldown", "swingCooldownMs", 117.6, 118],
        ["swing-bonus", "swingDamageBonus", 2.6, 3], ["dodge-stamina-cost", "dodgeStaminaCost", 2.6, 3],
        ["dodge-iframes", "dodgeIframesMs", 117.6, 118], ["guard-reduction", "guardDamageReductionPercent", 2.6, 3],
        ["guard-drain", "guardStaminaDrainPerSec", 2.6, 3],
      ] as const) await canonicalCommit(page, `db-field-system-action-combat-${suffix}`, typed, expected, (s) => s.actionCombat![key]!);
      await canonicalCommit(page, "db-field-system-action-combat-swing-bonus", 0, 0, (s) => s.actionCombat!.swingDamageBonus ?? 0);
      expect((await system(page)).actionCombat!.swingDamageBonus).toBeUndefined();
      await page.evaluate(async () => {
        const path = "/src/project/store.ts";
        const { store }: typeof import("../../src/project/store") = await import(path);
        store.update((draft) => { draft.system.monsterCare = { stepsPerTick: 50, walkFriendship: 1, walkExp: 1, dailyCareCap: 30 }; }, { scope: "system", label: "Numeric binding fixture" });
      });
      await nav(page, "resources");
      await page.getByTestId("db-system-refresh-previews").click();
      await nav(page, "optin");
      for (const [suffix, key, typed, expected] of [
        ["steps", "stepsPerTick", .8, 50], ["walk-friendship", "walkFriendship", 1001, 1000],
        ["walk-exp", "walkExp", 1.9, 1], ["daily-cap", "dailyCareCap", -1, 0],
      ] as const) await canonicalCommit(page, `db-field-system-monster-care-${suffix}`, typed, expected, (s) => s.monsterCare![key]!);
    });

    test("R6 mounted composition follows numeric, preset and default resolutions before Replay", async ({ page }) => {
      await nav(page, "display");
      const oldWidth = await page.getByTestId("db-field-system-resolution-width").elementHandle();
      const oldHeight = await page.getByTestId("db-field-system-resolution-height").elementHandle();
      const oldStage = await page.getByTestId("db-title-workbench-stage").elementHandle();
      const oldTransport = await page.getByTestId("db-title-fx-replay").elementHandle();
      const positions = (await system(page)).titleScreen!.layout;
      for (const [width, height, preset, ratio] of [[633, 355, "custom", "633 / 355"], [640, 360, "640x360", "16 / 9"], [320, 240, "320x240", "4 / 3"]] as const) {
        await nav(page, "display");
        if (preset === "custom") {
          await canonicalCommit(page, "db-field-system-resolution-width", 633.9, width, (s) => s.playResolution!.width);
          await canonicalCommit(page, "db-field-system-resolution-height", 355.9, height, (s) => s.playResolution!.height);
        } else await page.getByTestId("db-field-system-resolution-preset").selectOption(preset);
        await nav(page, "title");
        const stage = page.getByTestId("db-title-workbench-stage");
        await expect(stage).toHaveAttribute("data-play-resolution", `${width}x${height}`);
        expect(await stage.evaluate((e) => e.style.aspectRatio)).toBe(ratio);
        const box = await stage.boundingBox();
        expect(box!.width / box!.height).toBeCloseTo(width / height, 2);
        expect(await oldStage!.evaluate((e) => e.isConnected)).toBe(true);
        expect(await oldWidth!.evaluate((e) => e.isConnected)).toBe(true);
        expect(await oldHeight!.evaluate((e) => e.isConnected)).toBe(true);
        expect(await oldTransport!.evaluate((e) => e.isConnected)).toBe(true);
        // Compare exact CSSOM values: Firefox serializes percentage precision.
        const canonicalPositions = await page.evaluate(({ titleX, menuY }) => {
          const style = document.createElement("div").style;
          style.left = `${titleX / 320 * 100}%`;
          style.top = `${menuY / 240 * 100}%`;
          return { left: style.left, top: style.top };
        }, positions);
        expect(await page.getByTestId("db-title-workbench-title-text").evaluate((e) => e.style.left)).toBe(canonicalPositions.left);
        expect(await page.getByTestId("db-title-workbench-menu-preview").evaluate((e) => e.style.top)).toBe(canonicalPositions.top);
      }
      expect((await system(page)).playResolution).toBeUndefined();
      await page.getByTestId("db-title-fx-replay").click();
      expect(await oldStage!.evaluate((e) => e.isConnected)).toBe(false);
      await expect(page.getByTestId("db-title-workbench-stage")).toHaveAttribute("data-play-resolution", "320x240");
      expect(await oldTransport!.evaluate((e) => e.isConnected)).toBe(true);
    });
  });
}
