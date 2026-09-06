import assert from "node:assert/strict";
import { join } from "node:path";

/** Subscribe before input; DOM changes and engine frames expose the observed state. */
async function arm(page, expression, timeoutMs = 15000) {
  await page.evaluate(({ expression, timeoutMs }) => {
    window.__exportQaWait = new Promise((resolve) => {
      const test = Function(`return (${expression})`);
      let observer;
      const game = window.Phaser?.Display.Canvas.CanvasPool.pool.find((p) => p.parent?.game)?.parent.game;
      const finish = (ok) => {
        clearTimeout(timer);
        observer?.disconnect();
        game?.events.off("poststep", check);
        resolve(ok);
      };
      const check = () => { if (test()) finish(true); };
      const timer = setTimeout(() => finish(false), timeoutMs);
      observer = new MutationObserver(check);
      observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      game?.events.on("poststep", check);
      check();
    });
  }, { expression, timeoutMs });
}

async function signal(page, expression) {
  assert.equal(await page.evaluate(() => window.__exportQaWait), true, `State deadline: ${expression}`);
}

async function until(page, expression, timeoutMs) {
  await arm(page, expression, timeoutMs);
  await signal(page, expression);
}

async function keyTo(page, key, expression) {
  await arm(page, expression);
  await page.keyboard.press(key);
  await signal(page, expression);
}

async function state(page) {
  return page.evaluate(() => {
    const s = window.__oprnDebug.readState();
    return {
      map: s.currentMapId, x: s.x, y: s.y, gold: s.gold, inventory: s.inventory,
      quest: s.switches.sw_lantern_quest_started,
    };
  });
}

async function walk(page, target, actions) {
  for (let count = 0; count < 80; count += 1) {
    const before = await state(page);
    if (before.x === target.x && before.y === target.y) return;
    await until(page, `(() => {
      const scene = Phaser.Display.Canvas.CanvasPool.pool
        .find(p => p.parent?.game)?.parent.game.scene.getScene("PlayScene");
      return scene?.inputEnabled && !scene.running && !scene.moving
        && !scene.cameras.main.fadeEffect.isRunning;
    })()`);
    const dx = Math.sign(target.x - before.x);
    const dy = dx === 0 ? Math.sign(target.y - before.y) : 0;
    const key = dx > 0 ? "ArrowRight" : dx < 0 ? "ArrowLeft" : dy > 0 ? "ArrowDown" : "ArrowUp";
    // Input retains direction taps until the next logic tick. Observe committed
    // position, not a transient moving=true frame that can disappear under load.
    await keyTo(page, key, `window.__oprnDebug.readState().x !== ${before.x}
      || window.__oprnDebug.readState().y !== ${before.y}`);
    await until(page, "!window.__oprnPlayerSprite().moving");
    const after = await state(page);
    actions.push({ key, from: [before.x, before.y], to: [after.x, after.y] });
  }
  throw new Error(`Walking did not reach (${target.x},${target.y})`);
}

async function face(page, key, direction) {
  const faced = `Phaser.Display.Canvas.CanvasPool.pool
    .find(p => p.parent?.game)?.parent.game.scene.getScene("PlayScene").facing === ${JSON.stringify(direction)}`;
  await keyTo(page, key, faced);
}

async function finishDialogue(page, actions) {
  for (let count = 0; count < 16; count += 1) {
    const box = page.getByTestId("dialogue-box");
    if (await box.count() === 0) return;
    await until(page, `!!document.querySelector('[data-testid="dialogue-box"].page-ready')
      || !!document.querySelector('[data-testid="runtime-choices"]')`);
    const before = await box.textContent();
    actions.push({ key: "Enter", dialogue: before });
    await keyTo(page, "Enter", `document.querySelector('[data-testid="dialogue-box"]')?.textContent !== ${JSON.stringify(before)}`);
  }
  throw new Error("Authored dialogue did not finish");
}

async function readPartyImages(page) {
  return page.evaluate(async () => {
    const images = [...document.querySelectorAll('[data-testid^="battle-actor-"] img')];
    return await Promise.all(images.map(async (image) => {
      await image.decode();
      const animation = image.style.getPropertyValue("--battler-anim-url").trim();
      if (animation) {
        const strip = new Image();
        strip.src = animation.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
        await strip.decode();
      }
      return { id: image.closest('[data-testid^="battle-actor-"]').dataset.testid, width: image.naturalWidth };
    }));
  });
}

export async function installExportObservations(context) {
  await context.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { qaInstrumentation: true };
    window.__exportQaAudio = [];
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(...args) {
        super(...args);
        window.__exportQaAudio.push(this);
      }
    };
  });
}

export async function verifyEditorTestPlay(page) {
  const scene = `Phaser.Display.Canvas.CanvasPool.pool
    .map(p => p.parent?.game?.scene.keys.PlayScene).find(Boolean)`;
  await until(page, `!!window.Phaser && !!(${scene})?.getSession()?.currentMapId`);
  const before = await page.evaluate(`(() => {
    const s = (${scene}).getSession(); return {map: s.currentMapId, x: s.x, y: s.y};
  })()`);
  const moved = `(() => { const s = (${scene}).getSession(); return s.x !== ${before.x} || s.y !== ${before.y}; })()`;
  await arm(page, moved);
  await page.keyboard.down("ArrowUp");
  try { await signal(page, moved); }
  finally { await page.keyboard.up("ArrowUp"); }
  const after = await page.evaluate(`(() => {
    const s = (${scene}).getSession(); return {map: s.currentMapId, x: s.x, y: s.y};
  })()`);
  assert.equal(after.map, before.map);
  assert.notDeepEqual(after, before);
  return { before, after };
}

/** Real input only: no teleport, event invocation, inventory writes, or forced results. */
export async function exerciseExport(page, { url, kind, outDir }) {
  const actions = [];
  const failures = [];
  const errors = [];
  page.on("requestfailed", (r) => failures.push({ url: r.url().slice(0, 200), type: r.resourceType(), error: r.failure()?.errorText }));
  page.on("response", (r) => { if (r.status() >= 400) failures.push({ url: r.url(), status: r.status() }); });
  page.on("pageerror", (error) => errors.push(String(error)));
  const shot = async (name) => page.screenshot({ path: join(outDir, `${kind}-${name}.png`) });
  const result = { kind, actions, failures, errors };
  try {
    await page.goto(url, { waitUntil: "load" });
    await page.getByTestId("title-screen").waitFor({ state: "visible" });
    result.titleImage = await page.getByTestId("title-screen").evaluate(async (title) => {
      const url = getComputedStyle(title).backgroundImage.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
      const image = new Image();
      image.src = url;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    });
    result.fonts = await page.evaluate(async () => {
      const fonts = ['16px "NeoDunggeunmo"', '16px "Galmuri9"', '16px "Galmuri11"', '700 16px "Galmuri11"'];
      return await Promise.all(fonts.map(async (font) => {
        const faces = await document.fonts.load(font, "RPG 가나다");
        return { font, loaded: faces.length > 0 && faces.every((face) => face.status === "loaded") };
      }));
    });
    assert.ok(result.fonts.every((font) => font.loaded), "Packaged fonts must decode");
    await keyTo(page, "Enter", "!!window.__oprnDebug && !!document.querySelector('canvas')");
    await until(page, `window.__exportQaAudio.some(a => a.loop && !a.paused && a.readyState >= 2 && !a.error)`);
    result.bgmDecodedAndPlaying = true;
    result.validatedMediaUrls = await page.evaluate(() => window.__exportQaAudio
      .filter(a => a.loop && !a.paused && a.readyState >= 2 && !a.error)
      .map(a => a.currentSrc || a.src).filter(url => /^https?:/.test(url)));
    await walk(page, { x: 14, y: 16 }, actions);
    await face(page, "ArrowUp", "up");
    await keyTo(page, "Enter", `!!document.querySelector('[data-testid="dialogue-box"]')`);
    await finishDialogue(page, actions);
    assert.equal((await state(page)).quest, true);
    await shot("quest");
    await walk(page, { x: 19, y: 16 }, actions);
    await walk(page, { x: 19, y: 14 }, actions);
    await face(page, "ArrowRight", "right");
    await keyTo(page, "Enter", `!!document.querySelector('[data-testid="dialogue-box"]')`);
    await finishDialogue(page, actions);
    await until(page, `!!document.querySelector('[data-testid="actor-command-attack"]')`);
    result.partyImages = await readPartyImages(page);
    assert.equal(result.partyImages.length, 4);
    assert.ok(result.partyImages.every((image) => image.width > 0));
    await shot("battle");
    for (let turn = 0; turn < 12; turn += 1) {
      const phase = await page.getByTestId("battle-scene").getAttribute("data-battle-phase");
      if (phase === "resolved") break;
      await keyTo(page, "Enter", `document.querySelector('[data-testid="battle-scene"]')?.dataset.battlePhase === "targetSelect"`);
      await keyTo(page, "Enter", `document.querySelector('[data-testid="battle-scene"]')?.dataset.battlePhase !== "targetSelect"`);
      await until(page, `["actorCommand", "resolved"].includes(document.querySelector('[data-testid="battle-scene"]')?.dataset.battlePhase)
        && document.querySelector('[data-testid="battle-scene"]').dataset.battleSequenceBusy === "false"`);
      actions.push({ battle: await page.getByTestId("battle-message-window").textContent() });
    }
    assert.match(await page.getByTestId("battle-message-window").textContent(), /승리/);
    await shot("victory");
    await keyTo(page, "Enter", `!document.querySelector('[data-testid="battle-scene"]')`);
    await until(page, `!!document.querySelector('[data-testid="dialogue-box"]')`);
    await finishDialogue(page, actions);
    assert.equal(await page.evaluate(() => window.__oprnDebug.readState().battleResult), "victory");
    await walk(page, { x: 19, y: 24 }, actions);
    await walk(page, { x: 14, y: 24 }, actions);
    await face(page, "ArrowDown", "down");
    await keyTo(page, "Enter", `window.__oprnDebug.readState().currentMapId === "map_moonwell_forest"`);
    await walk(page, { x: 14, y: 4 }, actions);
    result.saved = await state(page);
    assert.equal(result.saved.gold, 10);
    await keyTo(page, "Escape", `!!document.querySelector('[data-testid="main-menu"]')`);
    for (let index = 0; index < 5; index += 1) {
      const before = await page.getByTestId("main-menu").textContent();
      await keyTo(page, "ArrowDown", `document.querySelector('[data-testid="main-menu"]').textContent !== ${JSON.stringify(before)}`);
    }
    await keyTo(page, "Enter", `!!document.querySelector('[data-testid="status-menu-group-command-save"]')`);
    await keyTo(page, "Enter", `!!document.querySelector('[data-testid="save-slot-1"]')`);
    await keyTo(page, "Enter", `/저장됨/.test(document.querySelector('[data-testid="save-slot-1"]').textContent)`);
    await shot("saved");
    await page.reload({ waitUntil: "load" });
    await page.getByTestId("title-screen").waitFor({ state: "visible" });
    const options = await page.locator(".rm-title-menu-button").evaluateAll((nodes) => nodes.map((n) => n.dataset.testid));
    for (let index = 0; index < options.indexOf("title-load-game"); index += 1) await page.keyboard.press("ArrowDown");
    await keyTo(page, "Enter", `!!document.querySelector('[data-testid="player-load-window"]')`);
    await keyTo(page, "ArrowDown", `document.querySelector('[data-testid="save-slot-1"]').classList.contains("selected")`);
    await keyTo(page, "Enter", `!!window.__oprnDebug && !document.querySelector('[data-testid="title-screen"]')`);
    result.loaded = await state(page);
    assert.deepEqual(result.loaded, result.saved);
    await until(page, `window.__exportQaAudio.some(a => a.loop && !a.paused && a.readyState >= 2 && !a.error)`);
    await shot("loaded");
    await walk(page, { x: 15, y: 4 }, actions);
    // Browsers cancel an already-playing media stream when BGM changes or the
    // page reloads. Keep those events visible, but require prior decode/play proof
    // for that exact URL; missing, decode and other network failures remain fatal.
    const cancelled = failure => failure.type === "media" && failure.error === "net::ERR_ABORTED"
      && result.validatedMediaUrls.includes(failure.url);
    result.cancelledMedia = failures.filter(cancelled);
    result.failures = failures.filter(failure => !cancelled(failure));
    assert.deepEqual(result.failures, [], "Required resources must not fail");
    assert.deepEqual(errors, [], "No uncaught runtime errors");
    result.pass = true;
  } catch (error) {
    result.pass = false;
    result.error = String(error);
    if (await page.evaluate(() => !!window.__oprnDebug)) result.finalState = await state(page);
    await shot("failure");
  }
  return result;
}
