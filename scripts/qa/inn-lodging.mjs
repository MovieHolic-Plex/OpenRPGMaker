// Lodging QA against the freshly loaded remote inn. Keyboard-only; event-based waits.
import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { createServer as createNetServer } from "node:net";

const out = "output/evidence/inn-inspection-v5";
const projectFile = "project.json";
const audit = JSON.parse(fs.readFileSync(`${out}/audit.json`, "utf8"));
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
const cases = [];
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
    window.__OPENRPG_BOOT__ = { projectUrl, qaInstrumentation: true, saveNamespace: "inn-inspection-v5" };
  }, `/${out}/${projectFile}`);
  await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded" });
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
  await page.evaluate(() => {
    window.__lodgingRead = () => {
      const state = JSON.parse(document.querySelector('[data-testid="runtime-state-json"]').textContent);
      return { gold: state.gold, actorVitals: state.actorVitals, partyActorIds: state.partyActorIds,
        inventory: state.inventory, switches: state.switches, variables: state.variables, selfSwitches: state.selfSwitches ?? {} };
    };
    window.__lodgingArm = kind => {
      window.__lodgingPending = new Promise((resolve, reject) => {
        const observer = new MutationObserver(check);
        const timer = setTimeout(() => { observer.disconnect(); reject(new Error('Lodging state timeout: ' + kind)); }, 15000);
        function check() {
          const state = JSON.parse(document.querySelector('[data-testid="runtime-state-json"]').textContent);
          const ready = kind === 'offer' ? Boolean(document.querySelector('[data-testid="inn-stay"].selected'))
            : kind === 'notEnough' ? Boolean(document.querySelector('[data-inn-status="not-enough"]'))
            : !document.querySelector('[data-testid="inn-scene"]') && state.inputEnabled && !state.running;
          if (ready) { observer.disconnect(); clearTimeout(timer); resolve(window.__lodgingRead()); }
        }
        observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
      });
    };
    window.__lodgingPhases = [];
    window.__lodgingObserver = new MutationObserver(() => {
      const phase = document.querySelector('[data-testid="inn-resting"]') ? 'resting'
        : document.querySelector('[data-testid="inn-wake"]') ? 'wake'
        : document.querySelector('[data-inn-status="not-enough"]') ? 'notEnough'
        : document.querySelector('[data-testid="inn-scene"]') ? 'offer' : 'field';
      if (window.__lodgingPhases.at(-1) !== phase) window.__lodgingPhases.push(phase);
    });
    window.__lodgingObserver.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  const movement = await page.evaluate(eventId => window.__innApproach(eventId), audit.inn.eventId);
  for (const scenario of [
    { id: 'paid', label: '정상 숙박', gold: 100, action: 'stay' },
    { id: 'exact', label: '요금과 같은 소지금', gold: audit.inn.price, action: 'stay' },
    { id: 'short', label: '1G 부족', gold: audit.inn.price - 1, action: 'stay' },
    { id: 'zero', label: '소지금 0G', gold: 0, action: 'stay' },
    { id: 'cancel', label: '아니오 선택', gold: 100, action: 'cancel' },
    { id: 'escape', label: 'Esc 취소', gold: 100, action: 'escape' },
  ]) {
    await page.evaluate(gold => {
      window.__oprnDebug.setGold(gold);
      for (const id of window.__oprnDebug.readState().partyActorIds) window.__oprnSetActorVitals(id, 7, 3);
      window.__lodgingPhases = [];
    }, scenario.gold);
    const before = await page.evaluate(() => window.__lodgingRead());
    await page.evaluate(() => window.__lodgingArm('offer'));
    await page.keyboard.press('z');
    await page.evaluate(() => window.__lodgingPending);
    const offer = out + '/' + scenario.id + '-offer.png';
    await page.screenshot({ path: offer });
    let after;
    if (scenario.action === 'stay' && scenario.gold < audit.inn.price) {
      await page.evaluate(() => window.__lodgingArm('notEnough'));
      await page.keyboard.press('Enter');
      after = await page.evaluate(() => window.__lodgingPending);
      assert.deepEqual(after, before, scenario.id + ': rejected payment changed state');
      assert.equal(await page.getByTestId('inn-stay').count(), 1);
      await page.screenshot({ path: out + '/' + scenario.id + '-result.png' });
      await page.evaluate(() => window.__lodgingArm('field'));
      await page.keyboard.press('Escape');
      assert.deepEqual(await page.evaluate(() => window.__lodgingPending), before);
    } else {
      await page.evaluate(() => window.__lodgingArm('field'));
      if (scenario.action === 'cancel') await page.keyboard.press('ArrowRight');
      await page.keyboard.press(scenario.action === 'escape' ? 'Escape' : 'Enter');
      after = await page.evaluate(() => window.__lodgingPending);
      if (scenario.action === 'stay') {
        assert.equal(after.gold, before.gold - audit.inn.price);
        for (const id of before.partyActorIds) {
          assert.equal(after.actorVitals[id].hp, before.actorVitals[id].maxHp);
          assert.equal(after.actorVitals[id].mp, before.actorVitals[id].maxMp);
        }
        for (const key of ['inventory','switches','variables','selfSwitches']) assert.deepEqual(after[key], before[key]);
      } else assert.deepEqual(after, before, scenario.id + ': cancellation changed state');
      await page.screenshot({ path: out + '/' + scenario.id + '-result.png' });
    }
    const phases = await page.evaluate(() => window.__lodgingPhases);
    if (scenario.action === 'stay' && scenario.gold >= audit.inn.price) {
      assert.ok(phases.includes('resting') && phases.includes('wake'), 'Missing rest/wake sequence');
    } else assert.ok(!phases.includes('resting'), 'Cancelled/rejected stay entered resting');
    cases.push({ ...scenario, before, after, phases, passed: true, offer: scenario.id + '-offer.png', result: scenario.id + '-result.png' });
    console.log('PASS ' + scenario.id);
  }
  assert.deepEqual(errors, []);
  const proof = { projectId: audit.projectId, projectSha256: audit.projectSha256, price: audit.inn.price,
    remoteProjectUnmodified: true, preconditions: 'QA hooks set session gold and HP/MP only',
    surface: 'player.html', movement, teleports: 0, cases, errors, passed: true, checkedAt: new Date().toISOString() };
  fs.writeFileSync(out + '/lodging-proof.json', JSON.stringify(proof, null, 2));
  fs.writeFileSync(out + '/SUMMARY.md', '# 숙박 실제 플레이 검증\n\n6개 시나리오 통과. 정상 결제·정확한 요금·부족·0G·아니오·Esc.\n\n즉시 확인: paid-offer.png, paid-result.png, short-result.png, cancel-offer.png.\n');
  console.log(JSON.stringify({ passed: true, cases: cases.length, price: audit.inn.price }));
} catch (error) {
  console.error(JSON.stringify({ errors, body: (await page.locator('body').innerText()).slice(0,2000) }));
  await page.screenshot({ path: out + '/qa-failure.png' });
  throw error;
} finally {
  await page.unrouteAll({ behavior: 'wait' });
  await browser.close();
  await server.close();
}
