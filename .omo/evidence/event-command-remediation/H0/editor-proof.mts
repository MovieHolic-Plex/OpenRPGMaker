import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { firefox } from "@playwright/test";
import { buildHarnessFixture } from "../../../../scripts/prepare-event-command-remediation.mts";
import { enterLocalEditor, openMapCommand, openCommandRow, confirmCommand, cancelCommand, readEditorProject, projectObservation, reimportProject } from "../../../../test/e2e/eventCommandRemediationHarness";
const out = ".omo/evidence/event-command-remediation/H0";
const cache = "/tmp/event-command-h0-editor-01a0760f";
process.env.VITE_CACHE_DIR = cache;
process.env.E2E_FREEZE_DEV_SERVER = "1";
// Use the normal Vite CLI in its own process, not a second Vite inside vite-node SSR.
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "39881", "--strictPort", "--configLoader", "runner"], {
  env: { ...process.env, VITE_CACHE_DIR: cache, E2E_FREEZE_DEV_SERVER: "1", VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", VITE_SUPABASE_USE_PROXY: "0" }, stdio: ["ignore", "pipe", "pipe"],
});
const ready = new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.once("exit", code => reject(new Error(`Editor server exited ${code}`)));
  server.stdout.on("data", data => { process.stdout.write(data); if (String(data).includes("http://127.0.0.1:39881/")) resolve(); });
  server.stderr.on("data", data => process.stderr.write(data));
});
let browser;
try {
  await ready;
  const cssResponse = await fetch("http://127.0.0.1:39881/src/styles/index.css", { signal: AbortSignal.timeout(30000) });
  assert.equal(cssResponse.status, 200);
  console.log("Editor CSS served:", (await cssResponse.text()).length);
  browser = await firefox.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => console.error("PAGEERROR", error.message));
  page.on("console", message => { if (message.type() === "error") console.error("CONSOLE", message.text()); });
  page.on("requestfailed", request => console.error("REQUESTFAILED", new URL(request.url()).pathname, request.failure()));
  page.on("response", response => { if (response.status() >= 400) console.error("RESPONSE", response.status(), new URL(response.url()).pathname); });
  const pending = new Set<string>();
  page.on("request", request => pending.add(new URL(request.url()).pathname));
  page.on("requestfinished", request => pending.delete(new URL(request.url()).pathname));
  const project = buildHarnessFixture();
  let local;
  try { local = await enterLocalEditor(page, project, "http://127.0.0.1:39881/"); }
  catch (error) {
    console.error("PENDING", [...pending]);
    console.error("BOOT_SURFACE", await page.locator("body").innerText());
    console.error("BOOT_HTML", (await page.content()).slice(0, 3000));
    await page.screenshot({ path: `${out}/editor-boot-failure.png`, fullPage: false });
    throw error;
  }
  try {
    console.log("Editor ready; remote persistence disabled");
    await openMapCommand(page);
    await page.getByTestId("event-command-edit-dialog").getByTestId("change-gold-amount-plus").click();
    assert.equal(await page.getByTestId("event-command-edit-dialog").getByTestId("change-gold-amount-input").inputValue(), "8");
    await page.screenshot({ path: `${out}/editor-confirm.png`, fullPage: false });
    const expected = { kind: "changeGold", op: "+=", amount: 8 };
    const trace = await confirmCommand(page, "map", [projectObservation(["maps", "map_intro", "events", 0, "pages", 0, "commands", 0], expected)]);
    console.log("Confirmed and applied amount 8");
    const saved = await readEditorProject(page);
    await openCommandRow(page, page.getByTestId("event-editor-modal"));
    assert.equal(await page.getByTestId("event-command-edit-dialog").getByTestId("change-gold-amount-input").inputValue(), "8");
    const geometry = [];
    for (const [width, height] of [[1024, 768], [1280, 800], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      const bounds = await page.getByTestId("event-command-edit-dialog").evaluate(node => {
        const rect = node.getBoundingClientRect();
        const ok = node.querySelector('[data-testid="event-command-edit-ok"]')?.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight,
          overflow: node.scrollWidth > node.clientWidth, confirmBottom: ok?.bottom };
      });
      assert.equal(bounds.overflow, false);
      assert.ok(bounds.confirmBottom && bounds.confirmBottom <= height);
      geometry.push(bounds);
      await page.screenshot({ path: `${out}/editor-reopen-${width}.png`, fullPage: false });
    }
    await page.getByTestId("event-command-edit-dialog").getByTestId("change-gold-amount-plus").click();
    await cancelCommand(page, saved);
    await page.getByTestId("event-editor-modal-close").click();
    console.log("Cancelled amount 9; importing saved amount 8");
    await reimportProject(page, saved);
    console.log("Real file import acknowledged");
    await openMapCommand(page);
    assert.equal(await page.getByTestId("event-command-edit-dialog").getByTestId("change-gold-amount-input").inputValue(), "8");
    await cancelCommand(page, saved);
    local.assertNoRemoteWrites();
    await writeFile(`${out}/editor-observation.json`, JSON.stringify({ source: project.maps.map_intro.events[0].pages?.[0].commands[0], confirmed: expected,
      confirm: trace, reopened: 8, cancelled: 9, retained: 8, serializedReload: true, realFileChooserImport: true, remoteWrites: [], geometry }, null, 2));
    console.log("Editor Confirm/Apply, Space reopen, Cancel, serializer and real file-chooser import: PASS");
  } catch (error) {
    await page.screenshot({ path: `${out}/editor-failure.png`, fullPage: false });
    console.error("EDITOR_ACTION_ERROR", error);
    console.error("EDITOR_SURFACE", await page.locator("body").innerText());
    throw error;
  } finally { await local.dispose(); }
} finally {
  await browser?.close();
  const exited = once(server, "exit", { signal: AbortSignal.timeout(10000) });
  server.kill("SIGTERM");
  await exited;
  await rm(cache, { recursive: true, force: true });
  console.log("Cleanup: editor browser/context closed, port 39881 server closed, owned Vite cache removed");
}
