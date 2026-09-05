// Real exported-player traversal. No teleport, fixed sleeps, or cross-map movement shortcuts.
import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { createServer as createNetServer } from "node:net";

const out = "output/evidence/inn-exploration-v4";
const projectFile = process.argv.includes("--reloaded") ? "reloaded-project.json" : "preview-project.json";
const port = await new Promise((resolve, reject) => {
  const probe = createNetServer();
  probe.on("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const port = probe.address().port;
    probe.close(() => resolve(port));
  });
});
// The shared node_modules symlink is not a safe location for Vite's temporary bundled config.
const vite = await createServer({
  configFile: "vite.player-qa.config.ts", configLoader: "runner",
  cacheDir: `${out}/.vite-qa`, server: { host: "127.0.0.1", port, strictPort: true }, logLevel: "warn",
});
await vite.listen();
const server = { url: `http://127.0.0.1:${port}`, close: () => vite.close() };
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
const visits = [];
page.on("pageerror", error => errors.push(error.message));
page.on("requestfailed", request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
try {
  // This host changes network interfaces during QA. Forward unchanged local Vite responses
  // through Node so Chromium's ERR_NETWORK_CHANGED does not cancel module loading.
  await page.route(`${server.url}/**`, async route => {
    const response = await fetch(route.request().url());
    await route.fulfill({
      status: response.status,
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  await page.addInitScript(projectUrl => {
    window.__OPENRPG_BOOT__ = { projectUrl, qaInstrumentation: true, saveNamespace: "inn-exploration-v4" };
  }, `/${out}/${projectFile}`);
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("title-new-game").waitFor({ state: "visible", timeout: 120_000 });
  await page.keyboard.press("Enter");
  await page.getByTestId("runtime-state-json").waitFor({ state: "attached", timeout: 120_000 });
  await page.evaluate(async projectUrl => {
    window.__innProject = await (await fetch(projectUrl)).json();
    const { canMove } = await import("/src/project/collision.ts");
    window.__innSignal = (predicate, trigger) => new Promise((resolve, reject) => {
      const node = document.querySelector('[data-testid="runtime-state-json"]');
      let timer;
      const observer = new MutationObserver(check);
      function check() {
        const state = JSON.parse(node.textContent);
        if (!predicate(state)) return;
        observer.disconnect();
        clearTimeout(timer);
        window.__oprnInput.dir(null);
        resolve(state);
      }
      observer.observe(node, { childList: true, characterData: true, subtree: true });
      timer = setTimeout(() => {
        observer.disconnect();
        window.__oprnInput.dir(null);
        reject(new Error(`Runtime signal timed out: ${node.textContent.slice(0,150)}`));
      }, 15_000);
      trigger();
      check();
    });
    window.__innApproach = async eventId => {
      const state = window.__oprnDebug.readState();
      const map = window.__innProject.maps[state.currentMapId];
      const event = map.events.find(event => event.id === eventId);
      if (!event) throw new Error(`Missing event ${eventId}`);
      const candidates = [
        { x: event.x, y: event.y + 1, face: "up" },
        { x: event.x, y: event.y - 1, face: "down" },
        { x: event.x - 1, y: event.y, face: "right" },
        { x: event.x + 1, y: event.y, face: "left" },
      ];
      const start = [state.x, state.y];
      const queue = [start];
      const seen = new Map([[start.join(","), null]]);
      let end;
      for (let i = 0; i < queue.length; i++) {
        const point = queue[i];
        const candidate = candidates.find(p => p.x === point[0] && p.y === point[1]);
        if (candidate) { end = candidate; break; }
        for (const [dx, dy, dir] of [[1,0,"right"],[-1,0,"left"],[0,1,"down"],[0,-1,"up"]]) {
          const next = [point[0] + dx, point[1] + dy];
          if (seen.has(next.join(",")) || !canMove(window.__innProject, map, ...point, ...next)) continue;
          seen.set(next.join(","), { point, dir });
          queue.push(next);
        }
      }
      if (!end) throw new Error(`No walkable approach to ${eventId}`);
      const path = [];
      for (let point = [end.x, end.y]; seen.get(point.join(","));) {
        const previous = seen.get(point.join(","));
        path.unshift({ x: point[0], y: point[1], dir: previous.dir });
        point = previous.point;
      }
      for (const point of path) {
        await window.__innSignal(state => state.player.x === point.x && state.player.y === point.y,
          () => window.__oprnDebug.playerRoute([{ kind: "move", dir: point.dir }]));
      }
      window.__oprnInput.face(end.face);
      return { steps: path.length, eventId, mapId: map.id };
    };
  }, `/${out}/${projectFile}`);
  const capture = async name => page.screenshot({ path: `${out}/${name}.png` });
  const interact = async (needle, shot, targetMap) => {
    const eventId = await page.evaluate(needle => {
      const state = window.__oprnDebug.readState();
      return window.__innProject.maps[state.currentMapId].events.find(event => event.id.includes(needle))?.id;
    }, needle);
    assert.ok(eventId, needle);
    const movement = await page.evaluate(eventId => window.__innApproach(eventId), eventId);
    await page.keyboard.press("z");
    await page.locator(".dialogue-box.page-ready").waitFor({ state: "visible", timeout: 15_000 });
    await capture(shot);
    // Observe each dialogue-page change before advancing it, including the final transfer.
    for (let pageIndex = 0; pageIndex < 8; pageIndex++) {
      await page.evaluate(targetMap => {
        window.__innAdvance = new Promise((resolve, reject) => {
          const current = document.querySelector(".dialogue-box")?.textContent;
          const observer = new MutationObserver(() => {
            const state = JSON.parse(document.querySelector('[data-testid="runtime-state-json"]').textContent);
            const box = document.querySelector(".dialogue-box");
            if ((!state.running && (!targetMap || state.mapId === targetMap)) ||
              (box?.classList.contains("page-ready") && box.textContent !== current)) {
              observer.disconnect(); clearTimeout(timer); resolve({ done: !state.running, mapId: state.mapId });
            }
          });
          const timer = setTimeout(() => { observer.disconnect(); reject(new Error("Dialogue advance timeout")); }, 15_000);
          observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
        });
      }, targetMap ?? null);
      await page.keyboard.press("z");
      const advance = await page.evaluate(() => window.__innAdvance);
      if (advance.done) {
        visits.push({ ...movement, resultingMap: advance.mapId, screenshot: `${shot}.png` });
        return;
      }
      await page.locator(".dialogue-box.page-ready").waitFor({ state: "visible", timeout: 15_000 });
    }
    throw new Error(`Dialogue did not end: ${eventId}`);
  };
  await capture("play-ground");
  await interact("_main_stair_", "play-stairs-up", "map_inn_wander_2f");
  await capture("play-upper");
  await interact("_dorm_bed_b_", "play-dorm");
  await interact("_merchant_ledger_", "play-merchant");
  await interact("_single_box_", "play-single");
  await interact("_suite_tea_", "play-suite");
  await interact("_upper_stair_", "play-attic-stairs", "map_inn_wander_3f");
  await capture("play-attic");
  await interact("_old_sign_", "play-old-sign");
  await interact("_travel_records_", "play-travel-records");
  await interact("ev_entrance_", "play-attic-descent", "map_inn_wander_2f");
  await interact("ev_entrance_", "play-upper-descent", "map_inn_wander");
  assert.deepEqual(errors, []);
  const proof = { projectFile, playerSurface: "player.html", teleports: 0, visits, errors, passed: true };
  fs.writeFileSync(`${out}/runtime-proof.json`, JSON.stringify(proof, null, 2));
  fs.writeFileSync(`${out}/SUMMARY.md`, `# 여관 실제 플레이 검증\n\n${visits.length}개 상호작용 통과. 순간이동 없이 1층 → 2층 → 다락 → 2층 → 1층.\n\n즉시 확인: play-upper.png, play-merchant.png, play-attic.png, play-old-sign.png.\n`);
  console.log(JSON.stringify(proof));
} catch (error) {
  console.error(JSON.stringify({ errors, body: (await page.locator("body").innerText()).slice(0,2000) }));
  await page.screenshot({ path: `${out}/qa-failure.png` });
  throw error;
} finally {
  await browser.close();
  await server.close();
}
