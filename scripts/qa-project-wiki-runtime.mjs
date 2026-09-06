// Actual generated project -> exported player -> contact and action gameplay.
import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { startPlayerQaServer } from "./lib/runtimeQaRun.mjs";

const projectArg = process.argv.indexOf("--project");
const projectPath = resolve(projectArg >= 0 ? process.argv[projectArg + 1] : "output/evidence/project-wiki/qa-project.json");
const projectJson = await readFile(projectPath, "utf8");
const project = JSON.parse(projectJson);
const contact = Object.values(project.maps).find((map) => !map.actionCombat && map.fieldSpawns?.length);
const action = Object.values(project.maps).find((map) => map.actionCombat && map.fieldSpawns?.length);
if (!contact || !action || !project.system.actionCombat?.enabled) throw new Error("Generated project lacks both combat routes");
const out = resolve("output/evidence/project-wiki/runtime");
await mkdir(out, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const evidence = { projectSha256: createHash("sha256").update(projectJson).digest("hex"), scenarios: [], errors: [] };
try {
  for (const [kind, map, other] of [["contact", contact, action], ["action", action, contact]]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => evidence.errors.push(error.message));
      await page.route(`${server.url}/**`, async (route) => {
        const response = await fetch(route.request().url());
        await route.fulfill({ status: response.status, contentType: response.headers.get("content-type") ?? "application/octet-stream", body: Buffer.from(await response.arrayBuffer()) });
      });
      await page.route("**/__wiki-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
      await page.addInitScript(() => {
        window.__OPENRPG_BOOT__ = { projectUrl: "/__wiki-qa/project.json", saveNamespace: "wiki-qa", qaInstrumentation: true };
        window.wikiState = () => {
          const text = document.querySelector('[data-testid="runtime-state-json"]')?.textContent;
          return text ? JSON.parse(text) : null;
        };
        window.wikiSignal = (predicate, trigger, forbidBattle = false) => new Promise((resolveSignal, reject) => {
          let timeout;
          const battleSelector = '[data-testid="battle-scene"]';
          const containsBattle = (node) => node instanceof Element && (node.matches(battleSelector) || node.querySelector(battleSelector));
          const observer = new MutationObserver(check);
          function finish(error, value) {
            observer.disconnect(); clearTimeout(timeout); window.__oprnInput?.dir(null);
            error ? reject(error) : resolveSignal(value);
          }
          function check(records = []) {
            try {
              if (forbidBattle && (document.querySelector(battleSelector) || records.some((record) => [...record.addedNodes].some(containsBattle)))) throw new Error("Action attack opened a battle screen");
              const value = predicate();
              if (value) finish(null, value);
            } catch (error) { finish(error); }
          }
          observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
          timeout = setTimeout(() => finish(new Error("Runtime event deadline exceeded")), 30_000);
          try { trigger(); check(); } catch (error) { finish(error); }
        });
      });
      await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
      await page.getByTestId("title-new-game").waitFor({ state: "visible", timeout: 90_000 });
      await page.evaluate(() => {
        window.wikiBoot = window.wikiSignal(
          () => window.__oprnDebug && window.wikiState()?.inputEnabled, () => {},
        );
      });
      await page.keyboard.press("Enter");
      await page.evaluate(() => window.wikiBoot);
      await page.evaluate(() => window.__oprnDebug.setSeed(1));
      const teleport = (target, x, y) => page.evaluate(({ target, x, y }) => window.wikiSignal(
        () => { const state = window.wikiState(); return state?.mapId === target && state.player.x === x && state.player.y === y && state.inputEnabled ? state : false; },
        () => window.__oprnDebug.teleport(target, x, y),
      ), { target, x, y });
      const spawn = map.fieldSpawns[0];
      if (spawn.chase || spawn.area.w !== 1 || spawn.area.h !== 1 || spawn.maxAlive !== 1) throw new Error("Generated stationary one-cell target contract not met");
      await teleport(other.id, 1, 1);
      await teleport(map.id, spawn.area.x - 1, spawn.area.y);
      const before = await page.evaluate(({ x, y }) => {
        const state = window.wikiState();
        const target = Object.entries(state.events).find(([id, event]) => id.startsWith("__field_spawn__") && event.x === x && event.y === y);
        if (!target) throw new Error("Generated visible target not spawned");
        const sprite = window.__oprnCharacterSprites().events[target[0]];
        if (!sprite || sprite.alpha <= 0 || !sprite.textureKey) throw new Error("Target sprite is not visible");
        return { state, eventId: target[0], sprite, combat: window.__oprnActionCombat() };
      }, { x: spawn.area.x, y: spawn.area.y });
      await page.screenshot({ path: `${out}/${kind}-before.png` });
      let result;
      if (kind === "contact") {
        if (before.combat !== null) throw new Error("Contact map unexpectedly has action combat");
        result = await page.evaluate(() => window.wikiSignal(
          () => document.querySelector('[data-testid="battle-scene"]') ? { opened: true } : false,
          () => window.__oprnInput.dir("right"),
        ));
        await page.getByTestId("battle-scene").waitFor({ state: "visible" });
      } else {
        result = await page.evaluate((eventId) => {
          window.__oprnInput.face("right");
          const before = window.__oprnActionCombat();
          const hpBefore = before?.enemies.find((enemy) => enemy.eventId === eventId)?.hp;
          if (!hpBefore) throw new Error("Action enemy HP unavailable");
          return window.wikiSignal(() => {
            const enemy = window.__oprnActionCombat()?.enemies.find((entry) => entry.eventId === eventId);
            return enemy && enemy.hp > 0 && enemy.hp < hpBefore ? { eventId, hpBefore, hpAfter: enemy.hp } : false;
          }, () => window.__oprnInput.attack(), true);
        }, before.eventId);
      }
      await page.screenshot({ path: `${out}/${kind}-after.png` });
      evidence.scenarios.push({ kind, mapId: map.id, before, result, after: await page.evaluate(() => window.wikiState()) });
      console.log(`PASS runtime ${kind}: ${map.id}`);
    } finally { await context.close(); }
  }
  if (evidence.errors.length) throw new Error(evidence.errors.join("\n"));
} finally {
  await writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  await browser.close();
  await server.close();
  await writeFile(`${out}/SUMMARY.md`, `# Project wiki runtime QA\n\n${evidence.scenarios.map((row) => `- PASS ${row.kind}: ${row.mapId}`).join("\n")}\n\nErrors: ${evidence.errors.length}\nCleanup: browser, contexts and player server closed.\n`);
  console.log("CLEANUP runtime browser/context/server closed");
}
