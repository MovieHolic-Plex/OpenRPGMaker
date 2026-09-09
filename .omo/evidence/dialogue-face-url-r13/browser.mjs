import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { firefox } from "playwright";
import { startPlayerQaServer } from "../../../scripts/lib/runtimeQaRun.mjs";

const evidence = fileURLToPath(new URL("./", import.meta.url));
const snapshotPath = process.argv[2];
assert.ok(snapshotPath, "Pass the archived, unmodified round3 final-player-project.json");
const snapshot = await readFile(snapshotPath, "utf8");
const shippedPng = await readFile("public/assets/easyrpg/faceset/People1/06.png");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const server = await startPlayerQaServer();
let browser;
try {
  browser = await firefox.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  const errors = [];
  const steps = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: snapshot,
  }));
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", qaInstrumentation: true };
  });
  // Each observer is installed before its triggering input. Its only timer is a deadline.
  const observe = (condition, argument = null) => page.evaluateHandle(({ source, argument }) => {
    const matches = new Function("argument", `return (${source})(argument)`);
    const promise = new Promise((resolve) => {
      const finish = (result) => { observer.disconnect(); clearTimeout(deadline); resolve(result); };
      const check = () => { if (matches(argument)) finish({ ok: true }); };
      const observer = new MutationObserver(check);
      const deadline = setTimeout(() => finish({ error: `Observation timed out: ${source}` }), 120_000);
      observer.observe(document.documentElement, { attributes: true, childList: true, characterData: true, subtree: true });
      check();
    });
    return { promise };
  }, { source: condition.toString(), argument });
  const observed = async (handle) => {
    try { const result = await handle.evaluate((value) => value.promise); assert.equal(result.error, undefined); }
    finally { await handle.dispose(); }
  };
  const projectResponse = page.waitForResponse((response) => response.url().endsWith("/__runtime-qa/project.json"));
  await page.goto(`${server.url}/player.html`);
  const response = await projectResponse;
  assert.equal(response.status(), 200);
  assert.equal(await response.text(), snapshot);
  await observed(await observe(() => document.querySelector('[data-testid="title-new-game"]')));
  const ready = await observe(() => window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]'));
  await page.keyboard.press("Enter");
  await observed(ready);

  const walk = async (key, dx, dy) => {
    await observed(await observe(() => {
      const node = document.querySelector('[data-testid="runtime-state-json"]');
      const state = node && JSON.parse(node.textContent);
      return state?.inputEnabled && !state.running;
    }));
    const before = await page.evaluate(() => window.__oprnDebug.readState());
    const target = { x: before.x + dx, y: before.y + dy };
    const moved = await observe((target) => {
      const state = window.__oprnDebug.readState();
      return state.x === target.x && state.y === target.y;
    }, target);
    await page.keyboard.press(key);
    await observed(moved);
    steps.push({ key, ...target });
  };
  await walk("ArrowRight", 1, 0);
  for (let i = 0; i < 5; i++) await walk("ArrowDown", 0, 1);
  for (let i = 0; i < 7; i++) await walk("ArrowLeft", -1, 0);
  // Existing QA face hook, not a content edit or fabricated dialogue.
  await page.evaluate(() => window.__oprnInput.face("up"));
  const dialogueReady = await observe(() => document.querySelector(".dialogue-box.page-ready"));
  const portraitResponse = page.waitForResponse((response) => response.url().endsWith("/assets/easyrpg/faceset/People1/06.png"));
  await page.keyboard.press("Enter");
  await observed(dialogueReady);
  const portrait = await page.evaluate(async () => {
    const face = document.querySelector('[data-testid="dialogue-face"]');
    if (!(face instanceof HTMLElement)) throw new Error("Chief face missing");
    const backgroundImage = getComputedStyle(face).backgroundImage;
    const match = /^url\("(.*)"\)$/.exec(backgroundImage);
    if (!match) throw new Error(`Chief face has no image: ${face.outerHTML}`);
    const url = match[1];
    const image = new Image();
    // Subscribe before assigning src, including the browser cache-hit path.
    await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error("Portrait load timed out")), 15_000);
      image.onload = () => { clearTimeout(deadline); resolve(); };
      image.onerror = () => { clearTimeout(deadline); reject(new Error(`Portrait load failed: ${url}`)); };
      image.src = url;
    });
    await image.decode();
    return { className: face.className, backgroundImage, url,
      width: image.naturalWidth, height: image.naturalHeight,
      pageReady: Boolean(document.querySelector(".dialogue-box.page-ready")),
      state: window.__oprnDebug.readState() };
  });
  const pngResponse = await portraitResponse;
  const pngBytes = await pngResponse.body();
  assert.equal(pngResponse.status(), 200);
  assert.deepEqual(pngBytes, shippedPng);
  assert.ok(portrait.className.includes("dialogue-face-image"));
  assert.ok(!portrait.className.includes("missing"));
  assert.equal(portrait.pageReady, true);
  assert.equal(portrait.width, 48);
  assert.equal(portrait.height, 48);
  assert.equal(portrait.url, `${server.url}/assets/easyrpg/faceset/People1/06.png`);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${evidence}chief-portrait.png` });
  const report = { snapshotPath, snapshotSha256: sha256(snapshot), projectResponseStatus: response.status(),
    projectBodyEquality: true, playerUrl: page.url(), steps, qaFaceHook: "up", portrait,
    image: { status: pngResponse.status(), contentType: pngResponse.headers()["content-type"],
      bytes: pngBytes.length, shippedEquality: true, sha256: sha256(pngBytes) }, pageErrors: errors };
  await writeFile(`${evidence}browser.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, portrait: { ...portrait, state: undefined } }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
