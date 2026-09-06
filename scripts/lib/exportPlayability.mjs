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

export async function readPartyImages(page) {
  const images = await page.evaluate(async () => {
    const actors = [...document.querySelectorAll('[data-testid="battle-actor-sprites"] > .battle-actor')];
    return await Promise.all(actors.map(async (actor) => {
      const id = actor.dataset.testid;
      const sprites = actor.querySelectorAll(".battle-actor-image, .battle-actor-sprite");
      if (sprites.length !== 1) throw new Error(`${id}: expected one party sprite, found ${sprites.length}`);
      const sprite = sprites[0];
      const style = getComputedStyle(sprite);
      const rect = sprite.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0) || !sprite.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
        throw new Error(`${id}: party sprite has no visible geometry`);
      }
      // Read the computed background, not the saved sheet URL or idle variable:
      // sheets replace their background for idle; image strips can be disabled
      // by dead-pose/reduced-motion CSS while their custom property stays set.
      const background = style.backgroundImage;
      const isImage = sprite instanceof HTMLImageElement;
      if (background === "none" && (!isImage || style.objectPosition === "-99999px -99999px")) {
        throw new Error(`${id}: party sprite has no rendered art`);
      }
      let image = isImage ? sprite : null;
      let timer;
      try {
        await Promise.race([
          (async () => {
            // Keep validating the static image too: it supplies intrinsic sizing
            // and is the renderer's fallback when image-strip animation stops.
            if (image) await image.decode();
            if (background !== "none") {
              const url = background.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
              if (!url) throw new Error(`${id}: unsupported party sprite background ${background}`);
              image = new Image();
              image.src = url;
              await image.decode();
            }
          })(),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${id}: party art decode deadline`)), 15000); }),
        ]);
      } catch (error) {
        throw new Error(`${id}: ${String(error)}`);
      } finally {
        clearTimeout(timer);
      }
      return { id, src: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight,
        renderedWidth: rect.width, renderedHeight: rect.height };
    }));
  });
  assert.equal(images.length, 4, "All four party actors must render");
  assert.ok(images.every((image) => image.width > 0 && image.height > 0), "Party art must decode to nonzero dimensions");
  return images;
}

export function requiredRuntimePngPattern(runtime) {
  const png = runtime.requiredAssets.find((path) => path.endsWith(".png"));
  assert.ok(png, "The retained runtime must declare a required PNG for export rejection QA");
  return `**/runtime-archive/${runtime.runtimeTarget}/public/${png}`;
}

export async function rejectBadExport(page, pattern, body, status) {
  let downloaded = false;
  let interceptions = 0;
  let onDownload;
  const invalidDownload = new Promise((resolve) => {
    onDownload = () => { downloaded = true; resolve(); };
  });
  page.on("download", onDownload);
  const inject = (route) => {
    interceptions += 1;
    return route.fulfill({ status, contentType: "text/html", body });
  };
  try {
    await page.route(pattern, inject);
    if (await page.getByTestId("toast").count()) {
      await page.getByTestId("toast").evaluate((node) => node.setAttribute("data-qa-previous-toast", "true"));
    }
    const error = page.locator('[data-testid="toast"].error:not([data-qa-previous-toast])');
    // Subscribe before input. A download is a failure signal, not a reason to
    // spend the entire toast deadline waiting for an error that never happened.
    const outcome = Promise.race([error.waitFor({ state: "visible", timeout: 180000 }), invalidDownload]);
    await page.getByTestId("menu-project").click();
    await page.getByTestId("menu-project-export-standalone").click();
    await outcome;
    assert.equal(downloaded, false, `Invalid export downloaded: ${pattern}`);
    assert.ok(interceptions > 0, `Required failure injection was never requested: ${pattern}`);
    const message = await error.textContent();
    return { pattern, status, message, downloaded, interceptions, pass: true };
  } finally {
    page.off("download", onDownload);
    await page.unroute(pattern, inject);
  }
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

export async function verifyExportBattleStyle(page) {
  const style = await page.evaluate(async () => {
    // Match exportEntry's project selection, including file:// standalone HTML.
    const embedded = document.getElementById("oprn-standalone-project")?.textContent;
    let project;
    if (embedded?.trim()) project = JSON.parse(embedded);
    else {
      const response = await fetch(window.__OPENRPG_BOOT__?.projectUrl ?? new URL("project.json", location.href),
        { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`QA project could not load: ${response.status}`);
      project = await response.json();
    }
    return project.system?.battleUiStyle;
  });
  assert.equal(style, "rm2003", "Four-party-art QA requires an explicitly exported rm2003 sideview project; export a new private QA release");
  return style;
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
    result.battleUiStyle = await verifyExportBattleStyle(page);
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
