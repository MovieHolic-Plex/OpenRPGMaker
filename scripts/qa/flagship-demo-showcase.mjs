/**
 * Automated Playwright E2E Flagship Demo Showcase Runner
 *
 * Builds all 3 canonical flagship demo games (`chrono-bell`, `emerald-crown`, `shitamachi-fourth-season`),
 * validates their style locks & IP cleanliness, launches each in real `player.html`,
 * plays through Opening -> Exploration -> State-Mutating Puzzle (`changeTile`) -> Companion/Starter ->
 * Battle/Confession -> Ending, and captures high-resolution PNG screenshots + animated GIFs into
 * `/home/main/claude-viz/flagship-demo-game-1/`.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";
import { withTsModule } from "../ontology-ts-loader.mjs";

const OUT_DIR = path.resolve(process.argv[2] ?? "/home/main/claude-viz/flagship-demo-game-1");
fs.mkdirSync(OUT_DIR, { recursive: true });

function encodeGifFromFrames(framesDir, targetGif, fps = 8) {
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    String(fps),
    "-i",
    path.join(framesDir, "%03d.png"),
    "-vf",
    "scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
    "-loop",
    "0",
    targetGif,
  ]);
}

async function captureGifFrames(page, name, count, intervalMs, beforeEachFrame) {
  const framesDir = path.join(OUT_DIR, "_frames", name);
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  for (let i = 0; i < count; i++) {
    if (beforeEachFrame) await beforeEachFrame(i);
    await page.screenshot({
      path: path.join(framesDir, `${String(i).padStart(3, "0")}.png`),
      animations: "allow",
    });
    await page.waitForTimeout(intervalMs);
  }
  const gifPath = path.join(OUT_DIR, `${name}.gif`);
  encodeGifFromFrames(framesDir, gifPath, Math.max(4, Math.round(1000 / intervalMs)));
  fs.rmSync(framesDir, { recursive: true, force: true });
  return `${name}.gif`;
}

async function advanceDialogueToChoicesOrClose(page, maxSteps = 32) {
  for (let i = 0; i < maxSteps; i++) {
    const state = await page.evaluate(() => {
      if (document.querySelector('[data-testid="ending-screen"]')) return "ending";
      if (document.querySelector('[data-testid="battle-scene"]')) return "battle";
      if (document.querySelector('[data-testid="runtime-choices"] button')) return "choices";
      if (document.querySelector('[data-testid="dialogue-box"]')) return "dialogue";
      return "field";
    });
    if (state === "choices" || state === "battle" || state === "ending" || state === "field") {
      return state;
    }
    await page.keyboard.press("Enter");
    await page.waitForTimeout(220);
  }
  return "timeout";
}

async function clickChoiceButton(page, index = 0) {
  const btn = page.locator('[data-testid="runtime-choices"] button').nth(index);
  await btn.waitFor({ state: "visible", timeout: 15_000 });
  await btn.click();
  await page.waitForTimeout(260);
}

async function bootFlagshipInPlayer(browser, serverUrl, demoId, serializedJson, viewport = { width: 960, height: 540 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err?.message ?? err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.addInitScript(
    ([projectUrl, saveNamespace]) => {
      try {
        localStorage.clear();
      } catch {
        // ignore
      }
      window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace, qaInstrumentation: true };
    },
    ["/__runtime-qa/project.json", `flagship-qa:${demoId}:${Date.now()}`],
  );
  await page.route("**/__runtime-qa/project.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: serializedJson }),
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${serverUrl}/player.html`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    try {
      await page.waitForSelector('[data-testid="title-screen"]', { timeout: 60_000 });
      break;
    } catch (err) {
      if (attempt === 2) {
        const bodyText = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
        throw new Error(`[${demoId}] title-screen timeout. consoleErrors=${JSON.stringify(consoleErrors)} body=${bodyText} (${err.message})`);
      }
      consoleErrors.length = 0;
      await page.waitForTimeout(1000);
    }
  }
  const seqDeadline = Date.now() + 2400;
  while (Date.now() < seqDeadline) {
    const seqState = await page.evaluate(
      () => document.querySelector('[data-testid="title-screen"]')?.getAttribute("data-seq-state") ?? "done",
    );
    if (seqState !== "playing") break;
    await page.waitForTimeout(80);
  }
  const stillPlaying = await page.evaluate(
    () => document.querySelector('[data-testid="title-screen"]')?.getAttribute("data-seq-state") === "playing",
  );
  if (stillPlaying) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(350);
  } else {
    await page.waitForTimeout(250);
  }
  return { context, page, consoleErrors };
}

async function waitForOpeningReady(page) {
  const startMs = Date.now();
  const deadline = startMs + 20_000;
  let retriedEnter = false;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const title = document.querySelector('[data-testid="title-screen"]');
      const titleBusy = title?.getAttribute("aria-busy") === "true";
      const seq = document.querySelector('[data-testid="cinematic-sequence"]');
      const status = document.querySelector('[data-testid="cinematic-status"]')?.textContent?.trim() ?? "";
      const canvas = document.querySelector('[data-testid="opening-animatic-stage"]');
      if (!seq || seq.getAttribute("data-media-state") !== "ready" || status !== "") {
        return { ready: false, onTitle: Boolean(title), titleBusy };
      }
      if (canvas) {
        const t = Number(canvas.getAttribute("data-time-ms") ?? 0);
        return { ready: t >= 700 && t <= 3800, onTitle: false, titleBusy: false };
      }
      return { ready: true, onTitle: false, titleBusy: false };
    });
    if (state.ready) return;
    if (!retriedEnter && state.onTitle && !state.titleBusy && Date.now() - startMs >= 600) {
      retriedEnter = true;
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(80);
  }
  throw new Error("Timed out waiting for opening cinematic sequence to become ready");
}

async function waitForEndingReady(page, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const phase = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="ending-screen"]');
      return el ? el.getAttribute("data-phase") || "mounted" : null;
    });
    if (phase === "epilogue" || phase === "hall" || phase === "credits" || phase === "final") {
      await page.waitForTimeout(1600);
      return phase;
    }
    if (!phase) {
      await page.keyboard.press("Enter").catch(() => {});
    }
    await page.waitForTimeout(220);
  }
  throw new Error("Timed out waiting for ending-screen phase (epilogue/hall)");
}

async function waitForFieldReady(page) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const title = Boolean(document.querySelector('[data-testid="title-screen"]'));
      const cinematic = Boolean(document.querySelector('[data-testid="cinematic-sequence"]'));
      const loading = Boolean(document.querySelector('[data-testid="play-loading-overlay"]'));
      const dialogue = Boolean(document.querySelector('[data-testid="dialogue-box"]'));
      const hooks = Boolean(window.__oprnDebug && window.__oprnInput);
      return { title, cinematic, loading, dialogue, hooks };
    });
    if (!state.title && !state.cinematic && !state.loading && !state.dialogue && state.hooks) {
      await page.waitForTimeout(550);
      return;
    }
    if (state.cinematic) {
      await page.keyboard.press("Escape").catch(() => {});
    } else if (state.dialogue) {
      await page.keyboard.press("Enter").catch(() => {});
    }
    await page.waitForTimeout(350);
  }
  throw new Error("Timed out waiting for field runtime hooks");
}

const showcaseReport = {
  generatedAt: new Date().toISOString(),
  outDir: OUT_DIR,
  demos: {},
};

await withTsModule("src/project/flagship/index.ts", "flagship-showcase.mjs", async (flagshipMod) => {
  const {
    createChronoBellFlagshipDemo,
    createEmeraldCrownFlagshipDemo,
    createShitamachiFourthSeasonFlagshipDemo,
    validateFlagshipStyleLock,
  } = flagshipMod;

  const ONLY_DEMO = process.env.ONLY_DEMO ?? "";
  console.log(`1. Building flagship demo project(s)${ONLY_DEMO ? ` (${ONLY_DEMO})` : ""}...`);
  const chrono = !ONLY_DEMO || ONLY_DEMO === "chrono-bell" ? createChronoBellFlagshipDemo() : null;
  const emerald = !ONLY_DEMO || ONLY_DEMO === "emerald-crown" ? createEmeraldCrownFlagshipDemo() : null;
  const shitamachi = !ONLY_DEMO || ONLY_DEMO === "shitamachi-fourth-season" ? createShitamachiFourthSeasonFlagshipDemo() : null;

  for (const built of [chrono, emerald, shitamachi].filter(Boolean)) {
    const lockReport = validateFlagshipStyleLock(built.id, built.project);
    console.log(`[style-lock] ${built.id}:`, JSON.stringify(lockReport));
    assert.equal(lockReport.ok, true, `Style lock failed for ${built.id}: ${lockReport.violations.join(", ")}`);
    fs.rmSync(path.join(OUT_DIR, `${built.id}.project.json`), { force: true });
    showcaseReport.demos[built.id] = {
      title: built.manifest.title,
      subtitle: built.manifest.subtitle,
      mapCount: lockReport.mapCount,
      endingCount: lockReport.endingCount,
      changeTileCount: lockReport.changeTileCount,
      openingShotCount: lockReport.openingShotCount,
      styleLock: lockReport,
      screenshots: [],
      gifs: [],
      playthroughLog: [],
    };
  }

  const server = await startPlayerQaServer();
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--disable-gpu"],
  });

  try {
    // =========================================================================
    // FLAGSHIP #1: 폴른 스타: 추락한 별과 태엽의 성녀 (`chrono-bell`)
    // =========================================================================
    if (!ONLY_DEMO || ONLY_DEMO === "chrono-bell") {
      console.log("2. Playing Flagship #1: chrono-bell (Fallen Star) in player.html...");
      const { context, page, consoleErrors } = await bootFlagshipInPlayer(browser, server.url, "chrono-bell", chrono.serialized, {
        width: 960,
        height: 540,
      });
      const rec = showcaseReport.demos["chrono-bell"];

      await page.screenshot({ path: path.join(OUT_DIR, "chrono-01-title.png") });
      rec.screenshots.push("chrono-01-title.png");

      // Start New Game -> 6-shot pixel opening
      await page.keyboard.press("Enter");
      await waitForOpeningReady(page);

      const waitShotReady = async (expectedShotId) => {
        const dl = Date.now() + 15_000;
        while (Date.now() < dl) {
          const ok = await page.evaluate((shotId) => {
            const seq = document.querySelector('[data-testid="cinematic-sequence"]');
            const canvas = document.querySelector('[data-testid="opening-animatic-stage"]');
            if (!seq || !canvas) return false;
            if (seq.getAttribute("data-scene-id") !== shotId) return false;
            const t = Number(canvas.getAttribute("data-time-ms") ?? 0);
            return t >= 900;
          }, expectedShotId);
          if (ok) return;
          await page.waitForTimeout(80);
        }
      };

      await waitShotReady("cb_shot_1");
      const openingGif = await captureGifFrames(page, "chrono-bell-opening", 18, 220, async (i) => {
        if (i > 0 && i % 3 === 0) {
          const nextShotIdx = Math.floor(i / 3) + 1;
          await page.keyboard.press("Enter");
          await waitShotReady(`cb_shot_${nextShotIdx}`);
        }
        if (i === 10) {
          // Shot 4 (cb_shot_4): Kael & Elena meeting awakened Android Iris & Automaton Aegis-07
          await page.screenshot({ path: path.join(OUT_DIR, "chrono-02-opening.png") });
        }
      });
      rec.screenshots.push("chrono-02-opening.png");
      rec.gifs.push(openingGif);
      if (process.env.ONLY_OPENING === "1") {
        await context.close();
      } else {

      await waitForFieldReady(page);

      await page.screenshot({ path: path.join(OUT_DIR, "chrono-03-millennium-fair.png") });
      const startState = await page.evaluate(() => window.__oprnDebug.readState());
      for (const [slug, mapId] of [
        ["chrono-04-cathedral-organ.png", "ct_middle_ages_chapel"],
        ["chrono-05-future-aria-dome.png", "ct_future_hub"],
        ["chrono-06-prehistory-volcano.png", "ct_prehistory_canyon"],
      ]) {
        const m = chrono.project.maps[mapId];
        if (m) {
          await page.evaluate(
            ([id, x, y]) => window.__oprnDebug.teleport(id, x, y),
            [mapId, Math.floor(m.width / 2), Math.floor(m.height / 2)],
          );
          await page.waitForTimeout(650);
          await page.screenshot({ path: path.join(OUT_DIR, slug) });
        }
      }
      await page.evaluate(
        ([id, x, y]) => window.__oprnDebug.teleport(id, x, y),
        [startState.currentMapId, startState.x, startState.y],
      );
      await page.waitForTimeout(500);

      await page.evaluate(() => window.__oprnInput.face("up"));
      await page.evaluate(() => {
        void window.__oprnInput.action();
      });
      await page.waitForSelector('[data-testid="dialogue-box"]', { timeout: 15_000 });
      await page.waitForTimeout(2900);
      await page.screenshot({ path: path.join(OUT_DIR, "chrono-07-bell-dialogue.png") });

      let st = await advanceDialogueToChoicesOrClose(page);
      assert.equal(st, "choices", "Expected 1st stage Star Ark signal choices");
      await page.screenshot({ path: path.join(OUT_DIR, "chrono-08-bell-puzzle-step1.png") });
      await clickChoiceButton(page, 0);
      await page.waitForSelector('[data-testid="dialogue-box"], [data-testid="runtime-choices"]', { timeout: 15_000 });

      st = await advanceDialogueToChoicesOrClose(page);
      assert.equal(st, "choices", "Expected 2nd stage Iris core resonance choices");
      await page.screenshot({ path: path.join(OUT_DIR, "chrono-09-bell-puzzle-step2.png") });
      await clickChoiceButton(page, 0);
      await page.waitForSelector('[data-testid="dialogue-box"]', { timeout: 15_000 });
      await waitForFieldReady(page);

      await page.evaluate(() => window.__oprnInput.face("right"));
      await page.evaluate(() => {
        void window.__oprnInput.action();
      });
      await page.waitForSelector('[data-testid="dialogue-box"], [data-testid="runtime-choices"]', { timeout: 15_000 });
      st = await advanceDialogueToChoicesOrClose(page);
      assert.equal(st, "choices", "Expected Astral Gate choices");
      await page.screenshot({ path: path.join(OUT_DIR, "chrono-10-time-gate-choices.png") });
      await clickChoiceButton(page, 0);

      const battleDeadline = Date.now() + 25_000;
      while (Date.now() < battleDeadline) {
        if (await page.locator('[data-testid="battle-scene"]').count()) break;
        await page.keyboard.press("Enter");
        await page.waitForTimeout(250);
      }
      await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 15_000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT_DIR, "chrono-11-boss-battle.png") });

      await captureGifFrames(page, "chrono-bell-boss-battle", 18, 220, async (i) => {
        if (i % 2 === 0) await page.keyboard.press("Enter").catch(() => {});
      });

      rec.screenshots.push(
        "chrono-03-millennium-fair.png",
        "chrono-04-cathedral-organ.png",
        "chrono-05-future-aria-dome.png",
        "chrono-06-prehistory-volcano.png",
        "chrono-07-bell-dialogue.png",
        "chrono-08-bell-puzzle-step1.png",
        "chrono-09-bell-puzzle-step2.png",
        "chrono-10-time-gate-choices.png",
        "chrono-11-boss-battle.png",
      );
      rec.gifs.push("chrono-bell-boss-battle.gif");

      await waitForEndingReady(page, 45_000);
      await page.screenshot({ path: path.join(OUT_DIR, "chrono-12-ending.png") });
      rec.screenshots.push("chrono-12-ending.png");
      rec.consoleErrors = consoleErrors;
      await context.close();
      }
    }

    // =========================================================================
    // FLAGSHIP #2: 에메랄드 크라운: 새벽섬의 수호자 (`emerald-crown`)
    // =========================================================================
    if (!ONLY_DEMO || ONLY_DEMO === "emerald-crown") {
      console.log("3. Playing Flagship #2: emerald-crown in player.html...");
      const { context, page, consoleErrors } = await bootFlagshipInPlayer(browser, server.url, "emerald-crown", emerald.serialized, {
        width: 960,
        height: 640,
      });
      const rec = showcaseReport.demos["emerald-crown"];

      await page.screenshot({ path: path.join(OUT_DIR, "emerald-01-title.png") });
      rec.screenshots.push("emerald-01-title.png");

      await page.keyboard.press("Enter");
      await waitForOpeningReady(page);
      await page.screenshot({ path: path.join(OUT_DIR, "emerald-02-opening.png") });
      rec.screenshots.push("emerald-02-opening.png");

      const openingGif = await captureGifFrames(page, "emerald-crown-opening", 14, 240, async (i) => {
        if (i === 4 || i === 9) await page.keyboard.press("Enter").catch(() => {});
      });
      rec.gifs.push(openingGif);

      await waitForFieldReady(page);
      await page.screenshot({ path: path.join(OUT_DIR, "emerald-03-dawn-island.png") });
      rec.screenshots.push("emerald-03-dawn-island.png");

      // Tour key maps in the 8-map progression before returning to Dawn Island spawn
      const startState = await page.evaluate(() => window.__oprnDebug.readState());
      for (const [slug, mapId, tx, ty] of [
        ["emerald-04-bedroom-2f.png", "mx_map_home_house_2f", 7, 4],
        ["emerald-04b-house-1f-stairs.png", "mx_map_home_house", 9, 4],
        ["emerald-05-prof-lab.png", "mx_map_lab", 7, 7],
        ["emerald-05b-prof-lab-2f.png", "mx_map_lab_2f", 8, 5],
        ["emerald-06-route1-meadow.png", "mx_map_meadow", 10, 12],
        ["emerald-07-gym-vine-puzzle.png", "mx_map_grove_gym", 8, 16],
        ["emerald-08-emerald-cave.png", "mx_map_observatory", 10, 8],
      ]) {
        if (emerald.project.maps[mapId]) {
          await page.evaluate(([id, x, y]) => window.__oprnDebug.teleport(id, x, y), [mapId, tx, ty]);
          await page.waitForTimeout(550);
          await page.screenshot({ path: path.join(OUT_DIR, slug) });
          rec.screenshots.push(slug);
        }
      }

      // Verify 1F -> 2F stairs_up and 2F -> 1F stairs_down transfer in Orbis Lab
      await page.evaluate(() => window.__oprnDebug.teleport("mx_map_lab", 12, 4));
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__oprnInput.dir("up"));
      await page.waitForTimeout(280);
      await page.evaluate(() => window.__oprnInput.dir(null));
      await page.waitForTimeout(1300);
      const lab2fState = await page.evaluate(() => window.__oprnDebug.readState());
      assert.equal(lab2fState.currentMapId, "mx_map_lab_2f", "Expected 1F->2F lab stair transfer");
      await page.evaluate(() => window.__oprnInput.dir("up"));
      await page.waitForTimeout(280);
      await page.evaluate(() => window.__oprnInput.dir(null));
      await page.waitForTimeout(1300);
      const lab1fState = await page.evaluate(() => window.__oprnDebug.readState());
      assert.equal(lab1fState.currentMapId, "mx_map_lab", "Expected 2F->1F lab stair transfer");

      // Return to Dawning City spawn
      await page.evaluate(
        ([id, x, y]) => window.__oprnDebug.teleport(id, x, y),
        [startState.currentMapId, startState.x, startState.y],
      );
      await page.waitForTimeout(500);

      // Step 1: Talk to Professor (`ev_emerald_prof_starter`) -> Choose `토리프` + Follower Companion + Vine Gate `changeTile`
      await page.evaluate(() => window.__oprnInput.face("up"));
      await page.evaluate(() => {
        void window.__oprnInput.action();
      });
      await page.waitForSelector('[data-testid="dialogue-box"], [data-testid="runtime-choices"]', { timeout: 15_000 });
      const st1 = await advanceDialogueToChoicesOrClose(page);
      assert.equal(st1, "choices", "Expected starter selection choices");
      await page.screenshot({ path: path.join(OUT_DIR, "emerald-09-starter-choice.png") });
      rec.screenshots.push("emerald-09-starter-choice.png");
      await clickChoiceButton(page, 0);

      await advanceDialogueToChoicesOrClose(page);
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(OUT_DIR, "emerald-10-follower-and-vine-open.png") });
      rec.screenshots.push("emerald-10-follower-and-vine-open.png");

      const afterStarter = await page.evaluate(() => window.__oprnDebug.readState());
      rec.playthroughLog.push({
        step: "starter-and-vine-gate",
        mx_starter: afterStarter.switches.mx_starter,
        sw_emerald_vine_gate: afterStarter.switches.sw_emerald_vine_gate,
        partyActorIds: afterStarter.partyActorIds,
      });
      assert.equal(afterStarter.switches.mx_starter, true);
      assert.equal(afterStarter.switches.sw_emerald_vine_gate, true);

      // Step 2: Talk to Gym Leader Yoorim (`ev_emerald_expedition_hub`) -> Battle -> Hall of Fame Ending
      await page.evaluate(() => window.__oprnInput.face("right"));
      await page.evaluate(() => {
        void window.__oprnInput.action();
      });
      await page.waitForSelector('[data-testid="dialogue-box"], [data-testid="runtime-choices"]', { timeout: 15_000 });
      const st2 = await advanceDialogueToChoicesOrClose(page);
      assert.equal(st2, "choices", "Expected Gym Leader challenge choices");
      await clickChoiceButton(page, 0);
      const battleDeadline = Date.now() + 25_000;
      while (Date.now() < battleDeadline) {
        if (await page.locator('[data-testid="battle-scene"]').count()) break;
        await page.keyboard.press("Enter");
        await page.waitForTimeout(250);
      }
      await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 15_000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT_DIR, "emerald-11-gym-battle.png") });
      rec.screenshots.push("emerald-11-gym-battle.png");

      const battleGif = await captureGifFrames(page, "emerald-crown-gym-battle", 18, 220, async (i) => {
        if (i % 2 === 0) await page.keyboard.press("Enter").catch(() => {});
      });
      rec.gifs.push(battleGif);

      await waitForEndingReady(page, 55_000);
      await page.screenshot({ path: path.join(OUT_DIR, "emerald-12-ending.png") });
      rec.screenshots.push("emerald-12-ending.png");
      rec.consoleErrors = consoleErrors;
      await context.close();
    }

    // =========================================================================
    // FLAGSHIP #3: 시타마치의 네 번째 계절 (`shitamachi-fourth-season`)
    // =========================================================================
    if (!ONLY_DEMO || ONLY_DEMO === "shitamachi-fourth-season") {
      console.log("4. Playing Flagship #3: shitamachi-fourth-season in player.html...");
      const { context, page, consoleErrors } = await bootFlagshipInPlayer(
        browser,
        server.url,
        "shitamachi-fourth-season",
        shitamachi.serialized,
        { width: 1024, height: 768 },
      );
      const rec = showcaseReport.demos["shitamachi-fourth-season"];

      await page.screenshot({ path: path.join(OUT_DIR, "shitamachi-01-title.png") });
      rec.screenshots.push("shitamachi-01-title.png");

      await page.keyboard.press("Enter");
      await waitForOpeningReady(page);
      await page.screenshot({ path: path.join(OUT_DIR, "shitamachi-02-opening.png") });
      rec.screenshots.push("shitamachi-02-opening.png");

      const openingGif = await captureGifFrames(page, "shitamachi-opening", 12, 240);
      rec.gifs.push(openingGif);

      await waitForFieldReady(page);
      await page.screenshot({ path: path.join(OUT_DIR, "shitamachi-03-arcade-street.png") });
      rec.screenshots.push("shitamachi-03-arcade-street.png");

      // Tour key daily routine interior venues (#2944)
      const startState = await page.evaluate(() => window.__oprnDebug.readState());
      for (const [slug, mapId, tx, ty] of [
        ["shitamachi-04-council-room.png", "map_venue_council", 9, 7],
        ["shitamachi-05-bakery-cafe.png", "map_venue_bakery", 9, 7],
        ["shitamachi-06-rooftop-sunset.png", "map_venue_rooftop", 10, 7],
        ["shitamachi-07-sento-bathhouse.png", "map_venue_sento", 11, 8],
      ]) {
        if (shitamachi.project.maps[mapId]) {
          await page.evaluate(([id, x, y]) => window.__oprnDebug.teleport(id, x, y), [mapId, tx, ty]);
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(OUT_DIR, slug) });
          rec.screenshots.push(slug);
        }
      }

      await page.evaluate(
        ([id, x, y]) => window.__oprnDebug.teleport(id, x, y),
        [startState.currentMapId, startState.x, startState.y],
      );
      await page.waitForTimeout(500);

      // Talk to Seoyeon (`ev_shitamachi_seoyeon`) -> 1024x768 dual-fullbody-veil stage + lantern `changeTile`
      await page.evaluate(() => window.__oprnInput.face("up"));
      await page.evaluate(() => {
        void window.__oprnInput.action();
      });
      await page.waitForSelector('[data-testid="dialogue-box"]', { timeout: 15_000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT_DIR, "shitamachi-08-dual-fullbody-dialogue.png") });
      rec.screenshots.push("shitamachi-08-dual-fullbody-dialogue.png");

      const dialogueGif = await captureGifFrames(page, "shitamachi-dialogue-choice", 10, 220, async (i) => {
        if (i === 2) await page.keyboard.press("Enter").catch(() => {});
      });
      rec.gifs.push(dialogueGif);

      const st1 = await advanceDialogueToChoicesOrClose(page);
      if (st1 === "choices") {
        await page.screenshot({ path: path.join(OUT_DIR, "shitamachi-09-lantern-choice.png") });
        rec.screenshots.push("shitamachi-09-lantern-choice.png");
        await clickChoiceButton(page, 0);
      }
      await advanceDialogueToChoicesOrClose(page);
      await page.waitForTimeout(400);

      // Talk to Confession Stage (`ev_shitamachi_confession`) -> Seoyeon True Ending
      await page.evaluate(() => window.__oprnInput.face("right"));
      await page.evaluate(() => {
        void window.__oprnInput.action();
      });
      const st2 = await advanceDialogueToChoicesOrClose(page);
      assert.equal(st2, "choices", "Expected festival confession route choices");
      await page.screenshot({ path: path.join(OUT_DIR, "shitamachi-10-confession-choices.png") });
      rec.screenshots.push("shitamachi-10-confession-choices.png");
      await clickChoiceButton(page, 0);

      await waitForEndingReady(page, 30_000);
      await page.screenshot({ path: path.join(OUT_DIR, "shitamachi-11-ending.png") });
      rec.screenshots.push("shitamachi-11-ending.png");
      rec.consoleErrors = consoleErrors;
      await context.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }

  fs.writeFileSync(path.join(OUT_DIR, "showcase-report.json"), JSON.stringify(showcaseReport, null, 2));
  console.log("5. Flagship showcase E2E complete! Report written to", path.join(OUT_DIR, "showcase-report.json"));
});
