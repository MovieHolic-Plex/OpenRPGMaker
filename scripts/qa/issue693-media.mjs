import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, firefox } from "playwright";
import { installMediaWriteGuard, observeMediaUi } from "./issue693-media-guard.mjs";

// Default is read-only remotely. The lead may explicitly permit creating ONE NEW
// project; this script never selects or writes an existing/shared remote project.
const permitRemoteCopy = process.argv.includes("--permit-new-remote-project");
const baseUrl = process.env.MEDIA_QA_URL ?? "http://127.0.0.1:38421";
const output = resolve(process.env.MEDIA_QA_OUTPUT ?? "output/evidence/issue693-media/browser");
await mkdir(output, { recursive: true });
const browserName = process.env.MEDIA_QA_BROWSER ?? "chromium";
const relayGets = process.env.MEDIA_QA_GET_RELAY === "1";
const report = { permitRemoteCopy, browser: browserName, relayGets, baseUrl, checks: [], blockedMutations: [], bodyObservations: [], remoteProjectId: null, remoteWrites: 0, completed: false };
let configuredTarget;
let browser;
let page;
let guard;

/** Subscribe to a real DOM state transition before triggering the UI action. */
async function observe(selector, fresh = false, rejectOnError = false) {
  return observeMediaUi(page, selector, { fresh, rejectOnError,
    guardFailure: guard?.failure });
}

const audio = Buffer.alloc(8 * 1024 * 1024);
audio.write("RIFF", 0); audio.writeUInt32LE(audio.length - 8, 4); audio.write("WAVEfmt ", 8);
audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
audio.writeUInt32LE(8000, 24); audio.writeUInt32LE(16000, 28);
audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34); audio.write("data", 36);
audio.writeUInt32LE(audio.length - 44, 40);
const fileName = `issue693-media-${Date.now()}.wav`;

try {
  const browserType = { firefox, chromium }[browserName];
  assert(browserType, `Unsupported MEDIA_QA_BROWSER: ${browserName}`);
  browser = await browserType.launch({ headless: true,
    ...(process.env.MEDIA_QA_CHANNEL ? { channel: process.env.MEDIA_QA_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
  page = await context.newPage();
  page.setDefaultTimeout(90_000);
  guard = await installMediaWriteGuard(context, {
    report, permitRemoteCopy, getConfig: () => configuredTarget,
    relayOrigin: relayGets ? new URL(baseUrl).origin : undefined,
  });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  });
  await page.goto(`${baseUrl}/?devProject=1&sampleAdventure=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await (await observe('[data-testid="toolbar-resource-manager"]'))();
  configuredTarget = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { supabaseProjectConfig } = await import("/src/project/supabaseProjectConfig.ts");
    const { saveDevProjectOverride } = await import("/src/project/devProjectPersistence.ts");
    assertLocal();
    function assertLocal() {
      if (!store.isLoaded() || store.isRemotePersistenceEnabled()) throw new Error("Expected loaded showcase");
    }
    saveDevProjectOverride(store.getCurrent());
    window.mediaQaBefore = JSON.stringify(store.getCurrent());
    window.mediaQaRecovery = Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith("oprn:dev-project:")));
    const config = supabaseProjectConfig();
    return config ? { projectId: config.projectId,
      restUrl: new URL(`${config.url.replace(/\/$/, "")}/rest/v1/`, location.href).href } : null;
  });
  const quota = await page.evaluate(async dataUrl => {
    const { store } = await import("/src/project/store.ts");
    const { saveDevProjectOverride } = await import("/src/project/devProjectPersistence.ts");
    let filled = 0;
    for (; filled < 32; filled++) {
      try { localStorage.setItem(`media-qa-fill-${filled}`, "x".repeat(256 * 1024)); }
      catch (error) { if (error.name !== "QuotaExceededError") throw error; break; }
    }
    const candidate = structuredClone(store.getCurrent());
    candidate.assets.uploaded["qa-unaccepted"] = { id: "qa-unaccepted", kind: "music", name: "unaccepted", dataUrl, meta: {} };
    try { saveDevProjectOverride(candidate); throw new Error("Expected real Web Storage quota rejection"); }
    catch (error) {
      if (error.code !== "storage-quota") throw error;
      return { code: error.code, nativeName: error.cause.name, filled };
    }
  }, `data:audio/wav;base64,${audio.toString("base64")}`);
  report.checks.push({ name: "real-browser-near-quota", ...quota });
  await page.getByTestId("toolbar-resource-manager").click();
  await page.getByTestId("resource-category-list").getByRole("option", { name: "음악 (BGM)", exact: true }).click();
  const confirmShown = await observe('[data-testid="app-confirm-modal"]', true);
  await page.getByTestId("resource-file-input").setInputFiles({ name: fileName, mimeType: "audio/wav", buffer: audio });
  await confirmShown();
  await page.screenshot({ path: `${output}/save-copy-confirm-1440.png` });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: `${output}/save-copy-confirm-1024.png` });
  const geometry = await page.getByTestId("app-confirm-modal").evaluate(overlay => {
    const card = overlay.querySelector(".app-modal-card");
    const bounds = card.getBoundingClientRect();
    return { width: innerWidth, height: innerHeight, left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
      contentFits: card.scrollHeight <= card.clientHeight };
  });
  assert(geometry.left >= 0 && geometry.right <= geometry.width && geometry.top >= 0 && geometry.bottom <= geometry.height && geometry.contentFits,
    "Confirmation is not contained at the desktop floor");
  report.checks.push({ name: "confirmation-1024-containment", ...geometry });
  const unchanged = () => page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    return JSON.stringify(store.getCurrent()) === window.mediaQaBefore
      && Object.entries(window.mediaQaRecovery).every(([key, value]) => localStorage.getItem(key) === value);
  });
  assert(await unchanged(), "Import published before consent/durability");
  await page.getByTestId("app-modal-cancel").click();
  assert(await unchanged(), "Cancellation changed source/recovery");
  report.checks.push({ name: "8MiB-consent-cancel-preserves-source", passed: true });
  await page.evaluate(() => {
    for (let i = 0; i < 32; i++) localStorage.removeItem(`media-qa-fill-${i}`);
  });
  const secondConfirm = await observe('[data-testid="app-confirm-modal"]', true);
  await page.getByTestId("resource-file-input").setInputFiles({ name: fileName, mimeType: "audio/wav", buffer: audio });
  await secondConfirm();
  const completed = await observe(`[data-testid="toast"].${permitRemoteCopy ? "ok" : "error"}`, true, permitRemoteCopy);
  await page.getByTestId("app-modal-confirm").click();
  await completed();
  await page.screenshot({ path: `${output}/${permitRemoteCopy ? "durable-copy" : "network-denied"}.png` });
  if (!permitRemoteCopy) {
    assert(await unchanged(), "Denied network promotion changed source/recovery");
    report.checks.push({ name: "network-denied-preserves-source", passed: true, injection: "request aborted; not remote durability proof" });
  } else {
    assert.equal(new URL(page.url()).searchParams.get("project"), report.remoteProjectId);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 180_000 });
    await (await observe('[data-testid="toolbar-resource-manager"]'))();
    const persisted = await page.evaluate(async name => {
      const { store } = await import("/src/project/store.ts");
      const asset = Object.values(store.getCurrent().assets.uploaded).find(asset => asset.name === name.replace(/\.[^.]+$/, ""));
      if (!asset) throw new Error("Missing media after reload");
      const bytes = await (await fetch(asset.dataUrl)).arrayBuffer();
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
      return { identity: store.getProjectIdentity(), byteLength: bytes.byteLength, hash };
    }, fileName);
    const { createHash } = await import("node:crypto");
    assert.equal(persisted.byteLength, audio.length);
    assert.equal(persisted.hash, createHash("sha256").update(audio).digest("hex"));
    assert.equal(persisted.identity.id, report.remoteProjectId);
    const playReady = await observe('[data-testid="test-play-modal-backdrop"] canvas');
    await page.getByTestId("mode-play").click();
    await playReady();
    await page.screenshot({ path: `${output}/test-play-after-reload.png` });
    report.checks.push({ name: "new-target-reload-byte-identity-and-test-play", passed: true, ...persisted });
  }
  report.completed = true;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = { code: error.code ?? "qa-failed", message: error.message };
  throw error;
} finally {
  // Retain the new target ID even if later verification fails. Never auto-delete it.
  try { await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); }
  finally { await browser?.close(); }
}
