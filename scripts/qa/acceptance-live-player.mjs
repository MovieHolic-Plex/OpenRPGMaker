#!/usr/bin/env node
// Graphical-player comparison of the independently reloaded live-AI project.
// Inputs drive the shipping player; no teleport, inventory or gold mutation.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { firefox } from "playwright";
import { performObservedAction, runRuntimeQa, startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const evidenceRoot = resolve("output/evidence/acceptance-live");
const handoff = JSON.parse(await readFile(resolve(evidenceRoot, "handoff/evaluation.json"), "utf8"));
const projectPath = resolve(evidenceRoot, "handoff/project.json");
const bytes = await readFile(projectPath);
assert.equal(createHash("sha256").update(bytes).digest("hex"), handoff.fileSha256);
assert.equal(handoff.projectId, "oprn-qa-functional-48c68b5f-2d4");
const out = resolve(process.argv[2] ?? resolve(evidenceRoot, "lead-player"));
const server = await startPlayerQaServer();
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage();
const checkpoints = [];
const inputs = [];
const errors = [];
page.on("pageerror", error => errors.push(String(error)));

// Arm the exact DOM/runtime condition before input. No sleeps or timer polling.
async function observe(predicate, trigger, label) {
  const signal = await page.evaluateHandle(({ source, label }) => {
    const check = Function(`return (${source})`)();
    let cancel;
    const promise = new Promise(resolveSignal => {
      const finish = value => {
        clearTimeout(deadline);
        observer.disconnect();
        resolveSignal(value);
      };
      const observer = new MutationObserver(() => { if (check()) finish({ ok: true }); });
      const deadline = setTimeout(() => finish({ ok: false, label }), 15000);
      cancel = () => finish({ ok: false, label: `${label}: cancelled` });
      observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      if (check()) finish({ ok: true });
    });
    return { promise, cancel };
  }, { source: predicate.toString(), label });
  try {
    await trigger();
    const result = await signal.evaluate(entry => entry.promise);
    assert.equal(result.ok, true, JSON.stringify(result));
  } finally {
    await signal.evaluate(entry => entry.cancel());
    await signal.dispose();
  }
}
async function key(keyName, predicate, label) {
  inputs.push({ kind: "key", key: keyName, label });
  await observe(predicate, () => page.keyboard.press(keyName), label);
}
const present = id => Function(`return Boolean(document.querySelector('[data-testid="${id}"]'))`);
const absent = id => Function(`return !document.querySelector('[data-testid="${id}"]')`);
const goldIs = value => Function(`return window.__oprnDebug.readState().gold === ${value}`);
const selected = id => Function(`return document.querySelector('[data-testid="${id}"]')?.getAttribute('aria-current') === 'true'`);

async function finishDialogue(next, label) {
  for (let count = 0; count < 8; count++) {
    if (await page.evaluate(next)) return;
    const before = await page.evaluate(() => document.querySelector('[data-testid="dialogue-box"]')?.textContent ?? "");
    const changed = Function(`return (${next.toString()})() || (document.querySelector('[data-testid="dialogue-box"]')?.textContent ?? "") !== ${JSON.stringify(before)}`);
    await key("Enter", changed, `${label}: advance ${count + 1}`);
  }
  assert.equal(await page.evaluate(next), true, `${label}: dialogue did not finish`);
}
async function snapshot(id, expected) {
  const actual = await page.evaluate(() => {
    const state = window.__oprnDebug.readState();
    return { mapId: state.currentMapId, x: state.x, y: state.y, gold: state.gold,
      inventory: { item_potion: state.inventory.item_potion ?? 0, item_antidote: state.inventory.item_antidote ?? 0 } };
  });
  for (const [field, value] of Object.entries(expected)) assert.deepEqual(actual[field], value, `${id}: ${field}`);
  await page.screenshot({ path: resolve(out, `${id}.png`) });
  checkpoints.push({ id, expected, actual });
  console.log(`PLAYER_PASS ${id}: ${JSON.stringify(actual)}`);
}
async function faceUp() {
  inputs.push({ kind: "face", dir: "up" });
  await page.evaluate(() => window.__oprnInput.face("up"));
}
async function moveTo(dir, mapId, x, y) {
  inputs.push({ kind: "direction", dir, until: { mapId, x, y } });
  const result = await page.evaluate(({ dir, mapId, x, y }) => new Promise(resolveMovement => {
    const finish = value => {
      window.__oprnInput?.dir(null);
      clearTimeout(deadline);
      observer.disconnect();
      resolveMovement(value);
    };
    const inspect = () => {
      const state = window.__oprnDebug?.readState();
      if (state?.currentMapId !== mapId || state.x !== x || state.y !== y) return;
      // Release in the same browser callback as arrival. A host round trip can
      // otherwise leave the direction held long enough to start another tile.
      window.__oprnInput.dir(null);
      const sprite = window.__oprnPlayerSprite?.();
      if (sprite && !sprite.moving) finish({ ok: true });
    };
    const observer = new MutationObserver(inspect);
    const deadline = setTimeout(() => finish({
      ok: false, actual: window.__oprnDebug?.readState(), sprite: window.__oprnPlayerSprite?.(),
    }), 15000);
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    window.__oprnInput.dir(dir);
    inspect();
  }), { dir, mapId, x, y });
  assert.equal(result.ok, true, `walk ${mapId} ${x},${y}: ${JSON.stringify(result)}`);
}

let failure;
try {
  const boot = await runRuntimeQa(page, {
    id: "acceptance-live-player", projectFixture: projectPath, viewport: { width: 1280, height: 900 },
    beats: [{ id: "start", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }],
      expect: { mapId: "map_blank_start", x: 10, y: 8, gold: 100,
        inventoryCounts: { item_potion: 0, item_antidote: 0 } }, shot: true }],
  }, { serverUrl: server.url, outDir: resolve(out, "boot") });
  assert.equal(boot.errors.length + boot.beats.flatMap(beat => beat.failures).length, 0, JSON.stringify(boot));
  await mkdir(out, { recursive: true });
  await snapshot("01-start", { mapId: "map_blank_start", x: 10, y: 8, gold: 100, inventory: { item_potion: 0, item_antidote: 0 } });
  await faceUp();
  const purchaseReceipt = await performObservedAction(page, async () => {
    await observe(present("dialogue-box"), () => page.evaluate(() => window.__oprnInput.action()), "Mira greeting");
    await finishDialogue(present("shop-mode-buy"), "Mira greeting");
    await snapshot("02-shop", { gold: 100, inventory: { item_potion: 0, item_antidote: 0 } });
    await key("Enter", selected("shop-buy-item_potion"), "select potion stock");
    await key("Enter", goldIs(90), "buy first potion");
    await key("Enter", goldIs(80), "buy second potion");
    await snapshot("03-purchased", { gold: 80, inventory: { item_potion: 2, item_antidote: 0 } });
    await key("Escape", present("shop-mode-buy"), "leave stock");
    await key("Escape", absent("shop-scene"), "close shop");
  }, 60000);
  assert.equal(purchaseReceipt.receipt.handled, true, "Mira interaction was not handled");
  inputs.push({ kind: "actionReceipt", owner: "Mira", receipt: purchaseReceipt.receipt });

  await moveTo("right", "map_blank_start", 12, 8);
  for (const [id, label] of [["04-reward-first", "first"], ["05-reward-repeat", "repeat"]]) {
    await faceUp();
    const receipt = await performObservedAction(page, async () => {
      await observe(present("dialogue-box"), () => page.evaluate(() => window.__oprnInput.action()), `Rowan ${label}`);
      await finishDialogue(absent("dialogue-box"), `Rowan ${label}`);
    }, 60000);
    assert.equal(receipt.receipt.handled, true, `Rowan ${label} interaction was not handled`);
    inputs.push({ kind: "actionReceipt", owner: `Rowan ${label}`, receipt: receipt.receipt });
    await snapshot(id, { mapId: "map_blank_start", x: 12, y: 8, gold: 80, inventory: { item_potion: 2, item_antidote: 1 } });
  }
  await moveTo("right", "map_meadow", 2, 8);
  await snapshot("06-outgoing", { mapId: "map_meadow", x: 2, y: 8, gold: 80, inventory: { item_potion: 2, item_antidote: 1 } });
  await moveTo("left", "map_blank_start", 17, 8);
  await snapshot("07-returning", { mapId: "map_blank_start", x: 17, y: 8 });
  await moveTo("left", "map_blank_start", 10, 8);
  await snapshot("08-final", { mapId: "map_blank_start", x: 10, y: 8, gold: 80, inventory: { item_potion: 2, item_antidote: 1 } });
  assert.equal(errors.length, 0, JSON.stringify(errors));
} catch (error) {
  failure = String(error);
  await mkdir(out, { recursive: true });
  await page.screenshot({ path: resolve(out, "failure.png") });
  console.error(failure);
} finally {
  await mkdir(out, { recursive: true });
  await writeFile(resolve(out, "player-comparison.json"), JSON.stringify({
    ok: !failure, projectId: handoff.projectId, remoteSha256: handoff.sha256, fileSha256: handoff.fileSha256,
    surface: "player.html / export store shim", inputScope: "QA direction/action hooks plus real keyboard shop/dialogue controls; no state injection",
    checkpoints, inputs, errors, failure,
  }, null, 2) + "\n");
  await browser.close();
  await server.close();
}
process.exitCode = failure ? 1 : 0;
