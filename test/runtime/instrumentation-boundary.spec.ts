import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";

const PROJECT_URL = "/__instrumentation/project.json";

let server: Awaited<ReturnType<typeof startPlayerQaServer>>;
let projectJson: string;

test.beforeAll(async () => {
  server = await startPlayerQaServer();
  projectJson = await readFile("test/fixtures/projects/oprn-sample-v3.json", "utf8");
});

test.afterAll(async () => {
  await server.close();
});

async function bootExportPlayer(page: Page, qaInstrumentation: boolean): Promise<void> {
  await page.addInitScript(([projectUrl, qa]) => {
    localStorage.clear();
    const boot: Record<string, unknown> = { projectUrl, saveNamespace: "instrumentation" };
    if (qa) boot.qaInstrumentation = true;
    window.__OPENRPG_BOOT__ = boot;
  }, [PROJECT_URL, qaInstrumentation] as const);
  await page.route(`**${PROJECT_URL}`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: projectJson,
  }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("title-screen").waitFor();
  await page.keyboard.press("Enter");
}

test("a normal export boot ships no debug globals, hooks, or hidden state mirrors", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error.message)));
  await bootExportPlayer(page, false);

  // Await the play surface through a player-visible signal, since no debug hook exists.
  await page.locator(".play-stage canvas").waitFor();
  // Count exactly 120 animation frames: any per-frame debug write would land inside this window.
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let frames = 0;
      const tick = (): void => {
        frames += 1;
        if (frames >= 120) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });

  const observed = await page.evaluate(() => ({
    globals: [
      "__oprnDebug",
      "__oprnInput",
      "__oprnPlayerSprite",
      "__oprnCharacterSprites",
      "__oprnCamera",
      "__oprnActionCombat",
      "__oprnSetActorVitals",
      "__oprnSetMediaState",
    ].filter((name) => (window as unknown as Record<string, unknown>)[name] !== undefined),
    debugNodes: [
      "runtime-state-json",
      "audio-state-json",
      "event-town-npc",
      "event-sprite-town-npc",
    ].filter((testid) => document.querySelector(`[data-testid='${testid}']`) !== null),
    debugMarkers: document.querySelectorAll(".runtime-debug-marker").length,
  }));

  expect(observed).toEqual({ globals: [], debugNodes: [], debugMarkers: 0 });
  expect(pageErrors).toEqual([]);
});

test("an explicit QA boot retains the read and mutate capability the harness needs", async ({ page }) => {
  await bootExportPlayer(page, true);
  await page.waitForFunction(() => typeof window.__oprnDebug?.readState === "function");

  // Subscribe to the exact state change before triggering it, then await that signal.
  const switchId = await page.evaluate(() => {
    const before = window.__oprnDebug.readState();
    const id = Object.keys(before.switches)[0] ?? "sw_gate_open";
    window.__oprnDebug.setSwitch(id, true);
    return id;
  });
  await page.waitForFunction(
    (id) => window.__oprnDebug.readState().switches[id] === true,
    switchId,
  );

  await expect(page.getByTestId("runtime-state-json")).toHaveCount(1);
});
