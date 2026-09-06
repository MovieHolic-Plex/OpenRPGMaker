import { createServer } from "vite";
import { firefox } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile, rm } from "node:fs/promises";
const root = process.cwd(), out = `${root}/.omo/evidence/life-full-20260906/14`;
const cache = `${out}/editor-cache`, port = 39841;
process.env.DEV_SERVER_NO_TLS = "1";
const server = await createServer({ root, cacheDir: cache, server: { host: "127.0.0.1", port, strictPort: true, watch: null }, logLevel: "warn" });
const receipt = { cwd: root, port, surface: "native Firefox editor controls", remoteWrites: [], writes: [], errors: [], runs: [], limits: ["Life navigation group is an existing pointer-only div", "Project roundtrip uses public serialize/deserialize and local Storage, not the remote save dialog"] };
let browser;
try {
  await server.listen();
  // Complete the cold module graph before starting the browser's bounded DOM signal.
  // These are Vite request-completion promises, not timed sleeps or UI retries.
  await server.warmupRequest("/src/main.ts");
  await server.waitForRequestsIdle();
  browser = await firefox.launch({ headless: true });
  for (const viewport of [{ width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    const run = { viewport, actions: [] }; receipt.runs.push(run);
    const context = await browser.newContext({ viewport, serviceWorkers: "block" });
    const page = await context.newPage();
    run.requestFailures = [];
    page.on("requestfailed", request => run.requestFailures.push({ url: request.url(), failure: request.failure() }));
    page.setDefaultTimeout(60000);
    page.on("pageerror", e => receipt.errors.push(e.message));
    await context.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        const entry = { method: request.method(), origin: url.origin, path: url.pathname };
        receipt.writes.push(entry);
        if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) { receipt.remoteWrites.push(entry); return route.abort(); }
      }
      return route.continue();
    });
    await page.addInitScript(() => {
      localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
      window.task14Dom = selector => new Promise((resolve, reject) => {
        const check = () => selector === "ready" ? (() => { const el = document.querySelector('[data-testid="perf-metrics-json"]'); return el && JSON.parse(el.textContent).initialEditRenderMs !== undefined; })() : document.querySelector(selector);
        const done = () => { if (!check()) return; observer.disconnect(); clearTimeout(timer); resolve(true); };
        const observer = new MutationObserver(done);
        const timer = setTimeout(() => { observer.disconnect(); reject(new Error(`DOM timeout ${selector}`)); }, 120000);
        observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true }); done();
      });
      window.task14Boot = window.task14Dom("ready");
    });
    try {
      await page.goto(`http://127.0.0.1:${port}/?blankProject=1`, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => window.task14Boot);
      const key = async id => { await page.getByTestId(id).focus(); await page.keyboard.press("Enter"); };
      for (const id of ["login-guest", "standard-welcome-start", "coach-mark-skip"]) if (await page.getByTestId(id).isVisible()) await key(id);
      await page.evaluate(async () => {
        const { store } = await import("/src/project/store.ts");
        const { createBlankProject } = await import("/src/project/defaults.ts");
        const { serialize, deserialize } = await import("/src/project/io.ts");
        const p = createBlankProject();
        p.system.timeSystem = { enabled: true, daysPerSeason: 40 };
        p.characters = { resident: { displayName: "Task14 resident", birthday: { season: "spring", day: 39 } } };
        p.database.lifeSkills = [{ id: "skill", name: "Task14 skill", skillType: "farming", maxLevel: 10, levelUpRewards: [{ level: 1, switchId: p.switches[0].id }] }];
        p.system.dailyWeather = { enabled: true, seasons: { spring: [{ kind: "rain", weight: 1 }] } };
        p.database.crops = [{ id: "unlinked", name: "Task14 crop", seedItemId: p.database.items[0].id, harvestItemId: p.database.items[0].id, harvestCount: 1, seasons: ["spring"], stages: [{ days: 2 }] }];
        store.replace(deserialize(serialize(p)));
        (await import("/src/editor/mapEditHistory.ts")).resetMapEditHistory();
        window.task14Store = store;
        window.task14Wire = () => serialize(store.getCurrent());
        window.task14Project = () => structuredClone({ characters: store.getCurrent().characters, weather: store.getCurrent().system.dailyWeather, skills: store.getCurrent().database.lifeSkills, crops: store.getCurrent().database.crops });
      });
      assert.equal(await page.evaluate(() => window.task14Store.isRemotePersistenceEnabled()), false);
      const armDom = async id => page.evaluate(id => { window.task14NextDom = window.task14Dom(`[data-testid="${id}"]`); }, id);
      await armDom("database-modal"); await key("toolbar-database"); await page.evaluate(() => window.task14NextDom);
      if (!await page.getByTestId("db-tab-characters").isVisible()) await page.getByTestId("db-tab-group-life").click();
      const beforeRender = await page.evaluate(() => window.task14Wire());
      await key("db-tab-characters"); await key("db-character-row-resident");
      assert.equal(await page.getByTestId("db-character-birthday-day").getAttribute("max"), "40");
      assert.equal(await page.evaluate(() => window.task14Wire()), beforeRender);
      const changed = async (label, action, expected) => {
        await page.evaluate(expected => {
          window.task14Change = new Promise((resolve, reject) => {
            const timer = setTimeout(() => { unsubscribe(); reject(new Error("store event timeout")); }, 15000);
            const unsubscribe = window.task14Store.subscribe(() => {
              const state = window.task14Project();
              const value = expected.path.reduce((v, k) => v?.[k], state);
              if (JSON.stringify(value) !== JSON.stringify(expected.value)) return;
              unsubscribe(); clearTimeout(timer); resolve(state);
            });
          });
        }, expected);
        await action();
        const state = await page.evaluate(() => window.task14Change);
        run.actions.push({ label, state }); return state;
      };
      const type = async (id, value) => { await page.getByTestId(id).focus(); await page.keyboard.press("Control+a"); await page.keyboard.type(value); await page.keyboard.press("Tab"); };
      await changed("keyboard birthday40", () => type("db-character-birthday-day", "40"), { path: ["characters", "resident", "birthday", "day"], value: 40 });
      await page.getByTestId("db-character-add").focus();
      await changed("Ctrl+Z birthday", () => page.keyboard.press("Control+z"), { path: ["characters", "resident", "birthday", "day"], value: 39 });
      await changed("Ctrl+Y birthday", () => page.keyboard.press("Control+y"), { path: ["characters", "resident", "birthday", "day"], value: 40 });
      await page.screenshot({ path: `${out}/editor-birthday-${viewport.width}.png` });
      await key("db-tab-daily-weather");
      assert.equal(await page.getByTestId("db-weather-forecast-days").inputValue(), "1");
      assert.equal(await page.locator('[data-testid="db-weather-rule-spring-0"] input[type="range"]').inputValue(), "0.5");
      await changed("keyboard explicit forecast3", () => type("db-weather-forecast-days", "3"), { path: ["weather", "forecastDays"], value: 3 });
      await page.getByTestId("db-weather-add-spring").focus();
      await changed("Ctrl+Z forecast restores omission", () => page.keyboard.press("Control+z"), { path: ["weather", "forecastDays"], value: undefined });
      await changed("Ctrl+Y forecast3", () => page.keyboard.press("Control+y"), { path: ["weather", "forecastDays"], value: 3 });
      const range = page.locator('[data-testid="db-weather-rule-spring-0"] input[type="range"]');
      await range.focus();
      await changed("keyboard explicit intensity0.65", async () => { await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); }, { path: ["weather", "seasons", "spring", 0, "intensity"], value: 0.65 });
      await page.getByTestId("db-weather-add-spring").focus();
      await changed("Ctrl+Z intensity restores omission", () => page.keyboard.press("Control+z"), { path: ["weather", "seasons", "spring", 0, "intensity"], value: undefined });
      await changed("Ctrl+Y intensity0.65", () => page.keyboard.press("Control+y"), { path: ["weather", "seasons", "spring", 0, "intensity"], value: 0.65 });
      await page.screenshot({ path: `${out}/editor-weather-${viewport.width}.png` });
      await key("db-tab-life-crafting"); await key("db-life-section-skills");
      assert.equal(await page.getByTestId("db-life-skill-reward-level-0").inputValue(), "1");
      await changed("keyboard new reward2", () => key("db-life-skill-reward-add"), { path: ["skills", 0, "levelUpRewards", 1, "level"], value: 2 });
      await page.getByTestId("db-life-skill-reward-add").focus();
      await changed("Ctrl+Z new reward", () => page.keyboard.press("Control+z"), { path: ["skills", 0, "levelUpRewards", "length"], value: 1 });
      await changed("Ctrl+Y new reward2", () => page.keyboard.press("Control+y"), { path: ["skills", 0, "levelUpRewards", 1, "level"], value: 2 });
      const select = page.getByTestId("db-life-skill-reward-switch-1");
      await select.focus();
      const switchId = await page.evaluate(() => window.task14Store.getCurrent().switches[0].id);
      await changed("keyboard reward switch", () => page.keyboard.press("ArrowDown"), { path: ["skills", 0, "levelUpRewards", 1, "switchId"], value: switchId });
      await type("db-life-skill-max-level", "11");
      assert.equal(await page.getByTestId("db-life-skill-max-level").inputValue(), "10");
      await page.screenshot({ path: `${out}/editor-skills-${viewport.width}.png` });
      run.roundtrip = await page.evaluate(() => {
        const wire = window.task14Wire(); localStorage.setItem("task14-project", wire);
        return import("/src/project/io.ts").then(({ serialize, deserialize }) => {
          const loaded = deserialize(localStorage.getItem("task14-project"));
          window.task14Store.replace(loaded);
          localStorage.removeItem("task14-project");
          const after = serialize(loaded);
          return { stable: after === wire, beforeParsed: JSON.parse(wire), afterParsed: JSON.parse(after), weatherKeyOrder: { before: Object.keys(JSON.parse(wire).system.dailyWeather), after: Object.keys(loaded.system.dailyWeather) }, canonicalStable: serialize(deserialize(after)) === after, state: window.task14Project(), version: loaded.version };
        });
      });
      assert.deepEqual(run.roundtrip.afterParsed, run.roundtrip.beforeParsed);
      delete run.roundtrip.beforeParsed; delete run.roundtrip.afterParsed;
      assert.equal(run.roundtrip.canonicalStable, true); assert.equal(run.roundtrip.version, 4);
      assert.equal(run.roundtrip.state.weather.forecastDays, 3); assert.equal(run.roundtrip.state.weather.seasons.spring[0].intensity, 0.65);
      assert.deepEqual(run.roundtrip.state.skills[0].levelUpRewards.map(r => r.level), [1, 2]);
      // Existing invalid data is a fixture setup, not a user edit or a normalizing repair.
      await page.evaluate(() => {
        window.task14Store.update(p => { p.system.timeSystem.daysPerSeason = 28; p.characters.resident = { ...p.characters.resident, birthday: { season: "spring", day: 29 } }; });
      });
      const invalidBefore = await page.evaluate(() => window.task14Wire());
      await key("db-tab-characters"); await key("db-character-row-resident");
      assert.equal(await page.getByTestId("db-character-birthday-day").inputValue(), "29");
      assert.equal(await page.getByTestId("db-character-birthday-day").getAttribute("aria-invalid"), "true");
      assert.equal(await page.getByTestId("db-character-birthday-warning").isVisible(), true);
      assert.equal(await page.evaluate(() => window.task14Wire()), invalidBefore);
      await page.screenshot({ path: `${out}/editor-warning-${viewport.width}.png` });
      await page.evaluate(() => window.task14Store.update(p => { p.system.dailyWeather.seasons.spring = Array.from({ length: 127 }, () => ({ kind: "rain", weight: 1 })); }));
      await key("db-tab-daily-weather");
      await changed("keyboard 128th rule", () => key("db-weather-add-spring"), { path: ["weather", "seasons", "spring", "length"], value: 128 });
      await page.getByTestId("db-weather-add-spring").focus();
      await changed("Ctrl+Z 128th rule", () => page.keyboard.press("Control+z"), { path: ["weather", "seasons", "spring", "length"], value: 127 });
      await changed("Ctrl+Y 128th rule", () => page.keyboard.press("Control+y"), { path: ["weather", "seasons", "spring", "length"], value: 128 });
      const maxBefore = await page.evaluate(() => window.task14Wire());
      await page.evaluate(() => { window.task14RejectedMutations = 0; window.task14Unsubscribe = window.task14Store.subscribe(() => window.task14RejectedMutations++); });
      await key("db-weather-add-spring"); await key("db-weather-add-rule-spring");
      run.ruleLimit = await page.evaluate(() => { window.task14Unsubscribe(); return { mutations: window.task14RejectedMutations, count: window.task14Project().weather.seasons.spring.length }; });
      assert.deepEqual(run.ruleLimit, { mutations: 0, count: 128 });
      assert.equal(await page.evaluate(() => window.task14Wire()), maxBefore);
      await key("db-tab-crops");
      run.cropLabel = await page.getByTestId("db-crop-graphic-auto-notice").innerText();
      await page.getByTestId("db-crop-graphic-card").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/editor-crop-${viewport.width}.png` });
      run.finalRemote = await page.evaluate(() => window.task14Store.isRemotePersistenceEnabled());
      assert.equal(run.finalRemote, false); run.pass = true;
    } catch (e) {
      run.failure = String(e.stack ?? e); await page.screenshot({ path: `${out}/editor-failure-${viewport.width}.png` });
      run.body = await page.locator("body").innerText(); throw e;
    } finally { await context.close(); run.contextClosed = true; }
  }
  assert.deepEqual(receipt.remoteWrites, []); assert.deepEqual(receipt.errors, []); receipt.pass = true;
} finally {
  await browser?.close(); await server.close(); await rm(cache, { recursive: true, force: true });
  receipt.cleanup = { browserClosed: true, serverClosed: true, cacheRemoved: true };
  await writeFile(`${out}/editor-state.json`, JSON.stringify(receipt, null, 2) + "\n");
}
