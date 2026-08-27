// 대각선 코너컷 프로브: 양쪽 직교가 열린 코너에서 대각선 목적지만 통행 불가일 때
// 플레이어가 그 칸으로 들어가는지 실제 브라우저(에디터 시연 실행)에서 판정한다.
// usage: node qa-diagonal/probe-diagonal-cornercut.cjs <port> <shot.png>
const { chromium } = require("@playwright/test");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.argv[2] || "9826";
const SHOT = process.argv[3] || "qa-diagonal/cornercut.png";

(async () => {
  const browser = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="mode-play"]', { timeout: 60000 });
  await page.waitForFunction(() => !!window.__oprnEditorStore?.getCurrent()?.startMapId, null, { timeout: 60000 });

  // 코너 지형: S=(px,py) 기준 (px+1,py)·(px,py-1) 통행 가능, (px+1,py-1) 통행 불가.
  const geo = await page.evaluate(() => {
    const store = window.__oprnEditorStore;
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const ts = project.tilesets[map.tilesetId];
    const open = ts.passability.findIndex((p) => p && p.up && p.down && p.left && p.right);
    const solid = ts.passability.findIndex((p) => p && !p.up && !p.down && !p.left && !p.right);
    if (open < 0 || solid < 0) return { ok: false, open, solid };
    const px = Math.min(map.width - 3, Math.max(2, Math.floor(map.width / 2)));
    const py = Math.min(map.height - 2, Math.max(2, Math.floor(map.height / 2)));
    const at = (x, y) => y * map.width + x;
    store.update((draft) => {
      const m = draft.maps[mapId];
      // 코너 주변을 넓게 열어두고(미끄러짐 여지) 대각선 목적지 한 칸만 막는다.
      for (let dy = -2; dy <= 1; dy++) {
        for (let dx = -1; dx <= 2; dx++) {
          m.lowerTiles[at(px + dx, py + dy)] = open;
          m.upperTiles[at(px + dx, py + dy)] = -1;
        }
      }
      m.lowerTiles[at(px + 1, py - 1)] = solid;
      m.upperTiles[at(px + 1, py - 1)] = -1;
      if (Array.isArray(m.events)) {
        m.events = m.events.filter((e) => !(Math.abs(e.x - px) <= 2 && Math.abs(e.y - py) <= 2));
      }
      draft.startPos = { x: px, y: py };
      // 4방향 모드가 켜져 있으면 대각선 입력이 직교화되어 판정 자체가 일어나지 않는다.
      m.actionCombat = false;
    }, { scope: "map", mapId });
    return { ok: true, mapId, px, py, open, solid, blocked: { x: px + 1, y: py - 1 },
      actionCombatEnabled: project.system.actionCombat?.enabled === true,
      mapActionCombat: map.actionCombat === true,
      movesInPlace: typeof window.__oprnEditorStore.getCurrent === "function" };
  });
  console.log("geometry:", JSON.stringify(geo));
  if (!geo.ok) throw new Error("no open/solid tile pair in tileset");

  await sleep(2000);
  for (let i = 0; i < 4; i++) {
    const skipped = await page.evaluate(() => {
      const skip = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "건너뛰기");
      if (!skip) return false;
      skip.click();
      return true;
    });
    if (!skipped) break;
    await sleep(500);
  }
  await page.evaluate(() => document.querySelector('[data-testid="mode-play"]')?.click());
  await sleep(3000);
  let ready = false;
  for (let i = 0; i < 12 && !ready; i++) {
    await page.keyboard.press("Enter");
    for (let j = 0; j < 10; j++) {
      await sleep(500);
      ready = await page.evaluate(() => !!window.__oprnDebug?.readState?.());
      if (ready) break;
    }
  }
  const state = () => page.evaluate(() => {
    const s = window.__oprnDebug?.readState?.();
    return s ? { x: s.x, y: s.y, map: s.currentMapId } : null;
  });
  const place = async () => {
    await settle();
    await page.evaluate((g) => window.__oprnDebug.teleport(g.mapId, g.px, g.py), geo);
    await sleep(300);
  };
  // 진행 중인 이동이 끝나 좌표가 멈출 때까지 기다린다(텔레포트 직후 잔여 이동 오염 방지).
  async function settle() {
    let last = null;
    let stable = 0;
    for (let i = 0; i < 40 && stable < 3; i++) {
      const s = await state();
      const key = s ? `${s.x},${s.y}` : "none";
      stable = key === last ? stable + 1 : 0;
      last = key;
      await sleep(120);
    }
  }
  console.log("ready:", ready, "state:", JSON.stringify(await state()));
  if (!ready) throw new Error("play session never started");

  // 방향키를 잡고 좌표가 바뀔 때까지(최대 timeoutMs) 기다린다. 고정 sleep 으로 판정하지 않는다.
  const walk = async (keys, timeoutMs, holdAfterChangeMs = 0) => {
    const start = await state();
    const startKey = start ? `${start.x},${start.y}` : "none";
    const seen = new Set([startKey]);
    for (const k of keys) await page.keyboard.down(k);
    const until = Date.now() + timeoutMs;
    let changedAt = null;
    while (Date.now() < until) {
      const s = await state();
      if (s) {
        const key = `${s.x},${s.y}`;
        if (key !== startKey && changedAt === null) changedAt = Date.now();
        seen.add(key);
      }
      if (changedAt !== null && Date.now() - changedAt >= holdAfterChangeMs) break;
      await sleep(50);
    }
    for (const k of keys) await page.keyboard.up(k);
    await settle();
    const end = await state();
    if (end) seen.add(`${end.x},${end.y}`);
    return { seen: [...seen], end, moved: changedAt !== null };
  };

  // 1) 전제 확인: 오른쪽 한 칸, 위 한 칸이 실제로 열려 있다.
  await place();
  const right = await walk(["ArrowRight"], 6000);
  await place();
  const up = await walk(["ArrowUp"], 6000);
  const horizontalOpen = right.seen.includes(`${geo.px + 1},${geo.py}`);
  const verticalOpen = up.seen.includes(`${geo.px},${geo.py - 1}`);
  console.log("precondition horizontalOpen:", horizontalOpen, "verticalOpen:", verticalOpen,
    JSON.stringify({ rightSeen: right.seen, upSeen: up.seen }));

  // 2) 코너컷 시도: 도착 지점에서 대각선 판정을 받도록 두 방향 keydown 을 한 태스크에 넣는다.
  // (Playwright keyboard.down 은 순차 전송되어 첫 키로 직교 이동이 먼저 시작해버린다.)
  await place();
  const holdBoth = (type) => page.evaluate((t) => {
    for (const key of ["ArrowRight", "ArrowUp"]) {
      document.dispatchEvent(new KeyboardEvent(t, { key, bubbles: true }));
    }
  }, type);
  await holdBoth("keydown");
  const diagSeen = new Set([`${geo.px},${geo.py}`]);
  const until = Date.now() + 2000;
  while (Date.now() < until) {
    const s = await state();
    if (s) diagSeen.add(`${s.x},${s.y}`);
    await sleep(50);
  }
  await holdBoth("keyup");
  await settle();
  const diag = { seen: [...diagSeen], end: await state() };
  const blockedKey = `${geo.blocked.x},${geo.blocked.y}`;
  const entered = diag.seen.includes(blockedKey);
  console.log("diagonal visited:", JSON.stringify(diag.seen), "end:", JSON.stringify(diag.end));
  await page.screenshot({ path: SHOT });
  const pass = ready && horizontalOpen && verticalOpen && !entered;
  console.log(`blockedTile: ${blockedKey} entered: ${entered}`);
  console.log("VERDICT:", pass ? "CORNER CUT BLOCKED (PASS)" : entered ? "CORNER CUT BUG (FAIL)" : "INCONCLUSIVE (precondition)");
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch((e) => {
  console.error("PROBE FAIL:", String(e).slice(0, 500));
  process.exit(2);
});
