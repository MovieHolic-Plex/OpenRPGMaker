import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

// Default is read-only remotely. The lead may explicitly permit creating ONE NEW
// project; this script never selects or writes an existing/shared remote project.
const permitRemoteCopy = process.argv.includes("--permit-new-remote-project");
const baseUrl = process.env.MEDIA_QA_URL ?? "http://127.0.0.1:38421";
const output = resolve(process.env.MEDIA_QA_OUTPUT ?? "output/evidence/issue693-media/browser");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(90_000);
const report = { permitRemoteCopy, baseUrl, checks: [], remoteProjectId: null, remoteWrites: 0, completed: false };
let configuredProjectId;

/** Subscribe to a real DOM state transition before triggering the UI action. */
async function observe(selector, fresh = false) {
  const token = crypto.randomUUID();
  await page.evaluate(({ selector, token, fresh }) => {
    window.mediaQaSignals ??= {};
    const previous = fresh ? new Set(document.querySelectorAll(selector)) : new Set();
    window.mediaQaSignals[token] = new Promise((resolve, reject) => {
      const deadline = setTimeout(() => { observer.disconnect(); reject(new Error(`Missing ${selector}`)); }, 90_000);
      const check = () => {
        if (![...document.querySelectorAll(selector)].some(node => !previous.has(node))) return;
        clearTimeout(deadline);
        observer.disconnect();
        resolve();
      };
      const observer = new MutationObserver(check);
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      check();
    }).then(() => ({ ok: true }), error => ({ ok: false, message: error.message }));
  }, { selector, token, fresh });
  return async () => {
    const result = await page.evaluate(token => window.mediaQaSignals[token], token);
    assert.equal(result.ok, true, result.message);
  };
}

const audio = Buffer.alloc(8 * 1024 * 1024);
audio.write("RIFF", 0); audio.writeUInt32LE(audio.length - 8, 4); audio.write("WAVEfmt ", 8);
audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
audio.writeUInt32LE(8000, 24); audio.writeUInt32LE(16000, 28);
audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34); audio.write("data", 36);
audio.writeUInt32LE(audio.length - 44, 40);
const fileName = `issue693-media-${Date.now()}.wav`;

try {
  await context.route("**/*", route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.includes("/rest/v1/") || ["GET", "HEAD", "OPTIONS"].includes(request.method())) return route.continue();
    if (!permitRemoteCopy) return route.abort("blockedbyclient");
    const body = request.postDataJSON();
    const target = url.searchParams.get("project_id")?.replace(/^eq\./, "")
      ?? (Array.isArray(body) ? body[0]?.project_id : body?.project_id);
    assert(target && /^oprn-[a-f0-9]{10}$/.test(target), "Refuse non-new-project mutation");
    assert.notEqual(target, configuredProjectId, "Refuse configured/shared project mutation");
    report.remoteProjectId ??= target;
    assert.equal(target, report.remoteProjectId, "Refuse a second remote target");
    report.remoteWrites += 1;
    return route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  });
  await page.goto(`${baseUrl}/?devProject=1&sampleAdventure=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await (await observe('[data-testid="toolbar-resource-manager"]'))();
  configuredProjectId = await page.evaluate(async () => {
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
    return supabaseProjectConfig()?.projectId;
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
  const completed = await observe(`[data-testid="toast"].${permitRemoteCopy ? "ok" : "error"}`, true);
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
} finally {
  // Retain the new target ID even if later verification fails. Never auto-delete it.
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
