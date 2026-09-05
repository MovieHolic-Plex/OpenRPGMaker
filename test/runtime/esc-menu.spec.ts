import { expect, test } from "@playwright/test";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { startPlayerQaServer, runRuntimeQa } from "../../scripts/lib/runtimeQaRun.mjs";
import scenario from "../../scripts/qa/runtime/esc-menu.scenario.mjs";

let server: Awaited<ReturnType<typeof startPlayerQaServer>>;
test.beforeAll(async () => { server = await startPlayerQaServer(); });
test.afterAll(async () => { await server?.close(); });

test("ESC workbench: actions, focus, scroll, geometry, and interruptible exit", async ({ page }) => {
  page.on("pageerror", (error) => console.log("ESC page error:", error.message));
  page.on("console", (message) => { if (message.type() === "error") console.log("ESC console:", message.text()); });
  const report = await runRuntimeQa(page, scenario, { serverUrl: server.url });
  expect(report.errors).toEqual([]);
  expect(report.beats.flatMap((beat: { failures: string[] }) => beat.failures)).toEqual([]);
  const out = "verify-shots/runtime-qa/esc-menu";
  await appendFile(`${out}/SUMMARY.md`, "\n## 즉시 확인 — 디자인 검토\n- 03-preview.png\n- 04-targets.png\n- 10-equipment-comparison.png\n- 11-party.png\n- 12-system.png\n");

  await page.keyboard.press("Escape");
  await page.getByTestId("main-menu").waitFor();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("status-menu-item-item_potion")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("status-menu-item-target-actor_scout")).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("status-menu-item-item_potion")).toHaveCount(0);
  await expect(page.getByTestId("status-menu-item-target-actor_hero")).toHaveCount(0);
  await page.evaluate(() => {
    (window as any).__escList = document.querySelector(".status-menu-detail-list");
    (window as any).__escRoot = document.querySelector("[data-testid='main-menu']");
  });
  const count = await page.locator(".status-menu-detail-action:not(:disabled)").count();
  for (let i = 1; i < count; i++) await page.keyboard.press("ArrowDown");
  const selected = await page.locator(".status-menu-detail-action.selected").getAttribute("data-testid");
  const scroll = await page.locator(".status-menu-detail-list").evaluate((node) => node.scrollTop);
  expect(scroll).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).__escList === document.querySelector(".status-menu-detail-list"))).toBe(true);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".status-menu-detail-action.selected")).toHaveAttribute("data-testid", selected!);
  expect(await page.locator(".status-menu-detail-list").evaluate((node) => node.scrollTop)).toBe(scroll);

  for (const [width, height] of [[640,480], [1024,768], [1280,960]]) {
    await page.setViewportSize({ width, height });
    const geometry = await page.evaluate(() => {
      const menu = document.querySelector<HTMLElement>("[data-testid='main-menu']")!;
      const stage = menu.getBoundingClientRect();
      return Array.from(menu.querySelectorAll<HTMLElement>(".status-menu-header, .status-menu-command-rail, .status-menu-detail, .status-menu-footer")).map((node) => {
        const r = node.getBoundingClientRect();
        return { name: node.className, inside: r.left >= stage.left && r.top >= stage.top && r.right <= stage.right && r.bottom <= stage.bottom };
      });
    });
    expect(geometry.every((entry) => entry.inside), JSON.stringify(geometry)).toBe(true);
    await page.screenshot({ path: `${out}/viewport-${width}.png` });
  }
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-testid='main-menu']")!;
    const observer = new MutationObserver(() => {
      if (!root.dataset.statusMenuClosing) return;
      (window as any).__escExit = root.getAnimations().map((a) => ({
        frames: (a.effect as KeyframeEffect).getKeyframes(), timing: a.effect?.getTiming(),
      }));
      observer.disconnect();
    });
    observer.observe(root, { attributes: true });
  });
  await page.keyboard.press("Escape");
  await page.getByTestId("main-menu").waitFor({ state: "detached" });
  const exit = await page.evaluate(() => (window as any).__escExit);
  expect(exit[0].frames.at(-1).opacity).toBe("0");
  expect(exit[0].timing.duration).toBe(120);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await page.evaluate(async () => { await Promise.all(document.querySelector("[data-testid=main-menu]")!.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))); });
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("main-menu").waitFor({ state: "detached" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    (window as any).__escReduced = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function(frames, timing) {
      if (this.matches(".oprn-status-menu")) (window as any).__escReduced.push({ frames, timing });
      return original.call(this, frames, timing);
    };
  });
  await page.keyboard.press("Escape");
  await page.getByTestId("main-menu").waitFor();
  const reduced = await page.evaluate(() => (window as any).__escReduced);
  expect(reduced.length).toBeGreaterThan(0);
  expect(reduced.every((a: any) => a.timing.duration === 40 && a.frames.every((f: Keyframe) => !f.transform))).toBe(true);
  await mkdir(out, { recursive: true });
  await writeFile(`${out}/interaction.json`, JSON.stringify({ selected, scroll, exit, reduced }, null, 2));
});
