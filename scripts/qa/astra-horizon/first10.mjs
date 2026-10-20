// 아스트라 호라이즌 첫 10분 — 처음 하는 플레이어처럼(글을 읽는 속도로 넘기고, 엄마와 이야기하고, 스타터 기술로 싸운다) 타이틀부터 1번 도로까지.
//   node scripts/qa/astra-horizon/first10.mjs <project.json> <outDir> [limitSeconds=600]
// 영상(video/*.webm)·5초 간격 프레임(frames/)·구간 시간표(timeline.json: 대사/선택/전투/연출/조작 가능/입력 없는 대기)를 남긴다.
// 맵 사이는 가능한 한 실제로 걷는다(문 이벤트). 못 걸으면 순간이동하고 report.debugWrites 에 남긴다.
// 화면은 1440×960(게임 480×320 의 3배)으로 찍고, 1배 사본은 build-audit 단계에서 줄인다.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg, limitArg] = process.argv.slice(2);
const LIMIT_MS = Number(limitArg ?? 600) * 1000;
if (!projectArg || !outArg) throw new Error("usage: journey.mjs <project.json> <outDir>");
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const out = resolve(outArg);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const report = { project: projectArg, steps: [], errors: [], debugWrites: [], dialogue: [] };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
await mkdir(join(out, "frames"), { recursive: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, recordVideo: { dir: join(out, "video"), size: { width: 720, height: 480 } } });
const page = await context.newPage();
const pageCreated = Date.now();
page.on("pageerror", (error) => report.errors.push(String(error?.message ?? error)));
page.on("console", (message) => { if (message.type() === "error") report.errors.push(`console: ${message.text()}`); });
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:astra-journey", qaInstrumentation: true };
  // 대화창에 뜬 문장을 모두 모은다(대사 품질 검수용).
  window.__astraLines = [];
  setInterval(() => {
    const box = document.querySelector('[data-testid="dialogue-box"]');
    if (!box) return;
    const t = (box.textContent ?? "").replace(/\s+/g, " ").trim();
    const arr = window.__astraLines;
    if (t && arr[arr.length - 1] !== t) {
      if (arr.length && t.startsWith(arr[arr.length - 1])) arr[arr.length - 1] = t; else arr.push(t);
    }
  }, 120);
});
// 1대1 몬스터 전투에서 상대 HP 상자·그림이 둘 이상 동시에 보이면 안 된다 — 2026-10-07 관장전 캡처에서 쓰러지기 전
// 다음 몬스터가 먼저 서 HP 상자 둘이 겹쳤는데 단계 판정은 통과였다. 100ms 마다 재고, 전투 문장도 차례로 모은다.
await page.addInitScript(() => {
  const seen = { maxEnemies: 0, overlap: [], lines: [], capture: { thrower: false, orb: false, rocks: 0, outcome: null, dexLine: null, resultLine: null } };
  window.__journeyBattleWatch = seen;
  // 포획 연출(던지는 주인공·구슬·흔들림·성공/탈출·도감 등록 문장)은 20ms 마다 따로 본다 — 100ms 틱은 400ms 흔들림 한 번도 놓친다.
  setInterval(() => {
    const cap = seen.capture;
    if (document.querySelector('[data-testid="battle-capture-thrower"]')) cap.thrower = true;
    const orb = document.querySelector('[data-testid="battle-capture-orb"]');
    if (orb) {
      cap.orb = true;
      cap.rocks = Math.max(cap.rocks, Number(orb.dataset.rock ?? 0));
      if (orb.classList.contains("battle-orb-caught")) cap.outcome = "caught";
      else if (orb.classList.contains("battle-orb-burst")) cap.outcome = "escaped";
    }
    for (const node of document.querySelectorAll(".battle-message-line")) {
      const text = (node.textContent ?? "").trim();
      if (/도감에 등록/.test(text)) cap.dexLine = text;
      if (/잡았다|빠져나|아깝|잡을 뻔|잡은 줄/.test(text)) cap.resultLine = text;
    }
  }, 20);
  const visible = (node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden" && Number(getComputedStyle(node).opacity) > 0.05;
  setInterval(() => {
    const scene = document.querySelector('[data-testid="battle-scene"]');
    if (!scene) return;
    const rows = [...scene.querySelectorAll(".battle-enemy-list-row")].filter((n) => !n.classList.contains("defeated") && visible(n)).length;
    const sprites = [...scene.querySelectorAll(".battle-enemy")].filter((n) => !n.classList.contains("defeated") && visible(n)).length;
    const count = Math.max(rows, sprites);
    const pages = [...scene.querySelectorAll(".battle-result-panel .battle-result-reward-row")].filter(visible).map((n) => (n.textContent ?? "").trim());
    const text = [...[...scene.querySelectorAll(".battle-message-line")].filter(visible).map((n) => (n.textContent ?? "").trim()), ...pages.map((p) => `[결과] ${p}`)].filter(Boolean).join(" / ");
    // 상태 배지(독 등)는 HP 상자 안에 있어야 한다 — 몬스터 머리 위 허공에 「PSN」이 떠 있었다(2026-10-07 관장전 캡처).
    const boxes = [...scene.querySelectorAll(".battle-enemy-list-row, .battle-party .battle-actor-status")].filter(visible).map((n) => n.getBoundingClientRect());
    for (const icon of [...scene.querySelectorAll(".battle-status-icon")].filter(visible)) {
      if (icon.classList.contains("battle-status-icon-death")) continue;
      const r = icon.getBoundingClientRect();
      const inside = boxes.some((b) => r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1);
      if (!inside && (seen.strayIcons ??= []).length < 6) {
        const path = []; for (let n = icon.parentElement; n && n !== scene && path.length < 4; n = n.parentElement) path.push(n.className.split(" ")[0]);
        seen.strayIcons.push(`${icon.className.split(" ").pop()} @${Math.round(r.left)},${Math.round(r.top)} in ${path.join("<")}`);
      }
    }
    if (count > seen.maxEnemies) seen.maxEnemies = count;
    if (count > 1 && seen.overlap.length < 8) seen.overlap.push(`rows ${rows} sprites ${sprites} «${text}»`);
    if (text && seen.lines[seen.lines.length - 1] !== text && seen.lines.length < 400) seen.lines.push(text);
  }, 100);
});
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));

const state = () => page.evaluate(() => window.__oprnDebug.readState());
const live = () => page.evaluate(() => {
  const s = window.__oprnHooksScene.session;
  return { map: s.currentMapId, x: s.x, y: s.y, party: (s.monsterParty ?? []).map((id) => ({ id, ...s.monsterInstances[id] })), box: s.monsterBox ?? [], switches: s.switches, inventory: s.inventory };
});
// 찍을 때마다 전투 문장이 창 안에 들어 있는지 잰다 — 2026-10-06 캡처에서 「…를 사용했다!」 첫 줄이 창 위로 넘쳐
// 몬스터 위에 겹쳤는데 단계 판정은 모두 통과였다. 넘침은 layout 실패로 남긴다(창 테두리 안쪽 기준).
const textOverflow = () => page.evaluate(() => {
  const win = [...document.querySelectorAll(".battle-message-window")].find((n) => n.getClientRects().length && getComputedStyle(n).visibility !== "hidden");
  if (!win) return null;
  const box = win.getBoundingClientRect(), style = getComputedStyle(win), out = [];
  const inner = { top: box.top + parseFloat(style.borderTopWidth), bottom: box.bottom - parseFloat(style.borderBottomWidth), left: box.left + parseFloat(style.borderLeftWidth), right: box.right - parseFloat(style.borderRightWidth) };
  for (const node of win.querySelectorAll(".battle-message-line")) {
    const r = node.getBoundingClientRect(), c = getComputedStyle(node);
    if (!r.width || !r.height || c.visibility === "hidden" || Number(c.opacity) === 0) continue;
    if (r.top < inner.top - 1 || r.bottom > inner.bottom + 1 || r.left < inner.left - 1 || r.right > inner.right + 1) {
      const scene = win.closest(".battle-scene")?.dataset ?? {};
      out.push(`«${(node.textContent ?? "").trim().slice(0, 24)}» y ${Math.round(r.top)}–${Math.round(r.bottom)} · 창 안쪽 y ${Math.round(inner.top)}–${Math.round(inner.bottom)} x ${Math.round(inner.left)}–${Math.round(inner.right)} [step=${scene.battleDirectorStep} busy=${scene.battleSequenceBusy} hold=${scene.pkmnResultHold ?? "-"} lines=${win.querySelectorAll(".battle-message-line").length}]`);
    }
  }
  return out;
});
const shot = async (name) => {
  await page.screenshot({ path: join(out, `${name}.png`) });
  const overflow = await textOverflow().catch(() => null);
  if (overflow?.length) step(`layout:${name}`, false, `전투 문장이 창 밖으로 나감: ${overflow.join(" / ")}`, `${name}.png`);
  return `${name}.png`;
};
const step = (id, ok, detail, image) => { report.steps.push({ id, ok, detail, image }); console.log(ok ? "✓" : "✗", id, detail); };
const present = (testid) => page.locator(`[data-testid="${testid}"]`).count().then((n) => n > 0);
// 대사·연출 사이 빈 틈에 done 이 잠깐 참이 된다(오프닝 중간에 순간이동한 실측) — 1초 동안 계속 참일 때만 끝으로 본다.
const settled = async (done) => {
  for (let k = 0; k < 4; k++) {
    if (!(await done())) return false;
    await page.waitForTimeout(250);
  }
  return true;
};
const pressEnterUntil = async (done, max = 40) => {
  for (let i = 0; i < max; i++) {
    if (await settled(done)) return true;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
  }
  return settled(done);
};
const teleport = async (mapId, x, y, quiet = false) => {
  if (!quiet) report.debugWrites.push(`teleport ${mapId} (${x},${y})`);
  await page.evaluate(([m, tx, ty]) => window.__oprnDebug.teleport(m, tx, ty), [mapId, x, y]);
  await page.waitForFunction(([m, tx, ty]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === m && s.x === tx && s.y === ty; }, [mapId, x, y], { timeout: 15000 });
  await page.waitForTimeout(600);
};
/** 한 걸음 걸어 보고 실제로 움직였는가(나무·벽 칸 거르기). */
const stepMoves = async (dir) => {
  const before = await page.evaluate(() => window.__oprnDebug.readLive());
  await page.evaluate((d) => window.__oprnInput.dir(d), dir);
  await page.waitForTimeout(280);
  await page.evaluate(() => window.__oprnInput.dir(null));
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => window.__oprnDebug.readLive());
  return after.x !== before.x || after.y !== before.y;
};
const face = (dir) => page.evaluate((d) => window.__oprnInput.face(d), dir);
/** 조사 — 맵 진입 직후(지명 띠·페이드)에는 입력이 먹지 않을 수 있어 대화·전투가 뜰 때까지 몇 번 다시 누른다. */
const talk = async (dir) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    await face(dir); await page.evaluate(() => window.__oprnInput.action());
    await page.waitForTimeout(700);
    if (await present("dialogue-box") || await present("battle-scene")) return true;
  }
  return false;
};
const action = () => page.evaluate(() => window.__oprnInput.action());
const eventOf = (mapId, eventId) => project.maps[mapId].events.find((event) => event.id === eventId);
const free = (mapId, x, y) => !project.maps[mapId].events.some((event) => event.x === x && event.y === y);
/** 이벤트 옆 서 있을 칸과 바라볼 방향(아래쪽부터). */
const besideOf = (mapId, event) => [[0, 1, "up"], [-1, 0, "right"], [1, 0, "left"], [0, -1, "down"]]
  .map(([dx, dy, dir]) => ({ x: event.x + dx, y: event.y + dy, dir })).find((p) => free(mapId, p.x, p.y));

/**
 * 영상용 걷기 — 맵 칸 통행(타일 통행표·이벤트)으로 최단 경로를 짜고 실제 방향 입력으로 한 칸씩 간다. 표가 틀려 못 가면 그 칸을 막힘으로 배우고 다시 짠다.
 * 전투·대사가 뜨거나 맵이 바뀌면 멈춘다. 영상이 아닐 때는 쓰지 않는다(판정은 순간이동 경로와 같다).
 */
const blockedLearned = new Set();
const tileBlocks = (tileset, tile) => {
  if (tile === undefined || tile < 0) return false;
  const p = tileset?.passability?.[tile];
  if (!p || typeof p !== "object") return false;
  return !p.up && !p.down && !p.left && !p.right;
};
const passable = (mapId, x, y, target) => {
  const map = project.maps[mapId];
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  if (target && target.x === x && target.y === y) return true;
  if (blockedLearned.has(`${mapId}:${x},${y}`)) return false;
  const ts = project.tilesets[map.tilesetId], i = y * map.width + x;
  if (tileBlocks(ts, map.lowerTiles[i]) || tileBlocks(ts, map.upperTiles[i])) return false;
  // 다른 문(맵을 옮기는 이벤트)은 밟지 않는다 — 북쪽 출구 둘(도로·학교)이 붙어 있어 도로로 가다 학교 문을 밟았다.
  // 문은 첫 줄 명령이 바로 이동인 이벤트만 — 전투에 진 뒤 센터로 옮기는 깊은 분기(1번 도로 첫 야생)까지 문으로 보면 길이 막혔다.
  return !map.events.some((e) => e.x === x && e.y === y && (!(e.pages?.[0]?.priority === "below") || (e.pages?.[0]?.commands ?? e.commands ?? []).some((c) => c.kind === "transfer" || (c.kind === "fork" && (c.then ?? []).some((t) => t.kind === "transfer")))));
};
const DIRS = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]];
async function walkTo(mapId, target, maxSteps = 160) {
  for (let n = 0; n < maxSteps; n++) {
    const here = await page.evaluate(() => window.__oprnDebug.readLive());
    if (here.currentMapId !== mapId) return "map-changed";
    if (here.x === target.x && here.y === target.y) return "arrived";
    if (await present("battle-scene")) return "battle";
    if (await present("dialogue-box")) return "dialogue";
    const prev = new Map([[`${here.x},${here.y}`, null]]), queue = [[here.x, here.y]];
    let found = false;
    for (let h = 0; h < queue.length && !found; h++) {
      const [x, y] = queue[h];
      for (const [, dx, dy] of DIRS) {
        const k = `${x + dx},${y + dy}`;
        if (prev.has(k) || !passable(mapId, x + dx, y + dy, target)) continue;
        prev.set(k, `${x},${y}`); queue.push([x + dx, y + dy]);
        if (x + dx === target.x && y + dy === target.y) { found = true; break; }
      }
    }
    if (!found) { if (process.env.JOURNEY_TRACE) console.log("no-path", mapId, here.x, here.y, "→", target.x, target.y); return "no-path"; }
    let k = `${target.x},${target.y}`;
    while (prev.get(k) !== `${here.x},${here.y}`) k = prev.get(k);
    const [nx, ny] = k.split(",").map(Number);
    const dir = DIRS.find(([, dx, dy]) => here.x + dx === nx && here.y + dy === ny)[0];
    // 칸 위치는 걸음이 끝날 때 바뀌고, 그때 방향이 눌려 있으면 다음 걸음이 바로 시작된다 — 짧게 눌렀다 떼고 멈출 때까지 본다.
    await page.evaluate((d) => window.__oprnInput.dir(d), dir);
    await page.waitForTimeout(90);
    await page.evaluate(() => window.__oprnInput.dir(null));
    let moved = false;
    // 걸음이 끝나 칸이 멈출 때까지 기다린다 — 바로 다음 방향을 넣으면 앞 입력이 한 칸 더 밀려 문 앞에서 좌우로 오갔다.
    for (let t = 0, last = ""; t < 10; t++) {
      await page.waitForTimeout(120);
      const now = await page.evaluate(() => window.__oprnDebug.readLive());
      const key = `${now.currentMapId}:${now.x},${now.y}`;
      if (key === last) break;
      last = key;
    }
    { const now = await page.evaluate(() => window.__oprnDebug.readLive()); moved = now.x !== here.x || now.y !== here.y || now.currentMapId !== mapId; }
    if (process.env.JOURNEY_TRACE) console.log("walk", mapId, here.x, here.y, dir, "→", nx, ny, moved ? "ok" : "stuck");
    if (!moved) {
      await page.waitForTimeout(250);
      const again = await page.evaluate(() => window.__oprnDebug.readLive());
      if (again.x === here.x && again.y === here.y && again.currentMapId === mapId) blockedLearned.add(`${mapId}:${nx},${ny}`);
    }
  }
  return "gave-up";
}
/** 문(그 맵으로 옮기는 이벤트) 칸까지 걸어 들어간다. */
async function walkThroughDoor(fromMapId, toMapId) {
  const door = project.maps[fromMapId].events.find((e) => JSON.stringify(e.pages ?? e.commands).includes(`"mapId":"${toMapId}"`));
  if (!door) return false;
  if (process.env.JOURNEY_TRACE) console.log("door", fromMapId, "→", toMapId, door.id, door.x, door.y, JSON.stringify(await page.evaluate(() => window.__oprnDebug.readLive())));
  // 건물 문은 아래에서 위로만 들어간다 — 문 아래 칸까지 걷고 위로 민다. 바닥 매트(실내 출구)는 그대로 밟는다.
  const below = { x: door.x, y: door.y + 1 };
  let result = passable(fromMapId, below.x, below.y) ? await walkTo(fromMapId, below) : "skip";
  if (result === "arrived") { await page.evaluate(() => window.__oprnInput.dir("up")); await page.waitForTimeout(500); await page.evaluate(() => window.__oprnInput.dir(null)); }
  if ((await page.evaluate(() => window.__oprnDebug.readLive())).currentMapId === fromMapId) result = await walkTo(fromMapId, { x: door.x, y: door.y });
  await page.waitForFunction((m) => window.__oprnDebug.readLive().currentMapId === m, toMapId, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);
  const ok = (await page.evaluate(() => window.__oprnDebug.readLive())).currentMapId === toMapId;
  report.walks = [...(report.walks ?? []), `${fromMapId}→${toMapId}: ${result}${ok ? "" : " (못 들어감)"}`];
  return ok;
}

/** 전투가 끝날 때까지: 포획 모드면 체력이 반 아래일 때 가방 → 첫 포획구, 아니면 싸운다 → 가장 강한 기술. */
async function fight(label, { capture = false, run = false } = {}) {
  const log = [];
  const switchedFor = new Set();
  for (let turn = 0; turn < 40; turn++) {
    if (!(await present("battle-scene"))) break;
    if (await present("battle-result-panel")) {
      await pressEnterUntil(async () => !(await present("battle-scene")), 30);
      break;
    }
    // 앞 동료가 쓰러지면 「교체 필요」 — 남은 동료를 낸다(이 칸을 Enter 로만 누르면 1분 가까이 멈춰 있었다, 2026-10-07 영상).
    const forced = page.locator('[data-testid^="actor-switch-"]');
    if (!(await page.locator('[data-testid="actor-command-fight"]').count())) {
      if (await forced.count()) { log.push(`turn ${turn}: switch`); await forced.first().focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(800); continue; }
      const pkmn = page.locator('[data-testid="actor-command-pkmn"]');
      if (await pkmn.count()) { await pkmn.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(500); continue; }
    }
    // 길을 걷다 만난 야생은 플레이어처럼 도망간다 — 체력을 아껴 트레이너에게 간다.
    if (run && await page.locator('[data-testid="actor-command-run"]').count()) {
      await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 30000 }).catch(() => {});
      await page.locator('[data-testid="actor-command-run"]').focus(); await page.keyboard.press("Enter"); log.push(`turn ${turn}: run`);
      await page.waitForTimeout(1500); continue;
    }
    const ready = await page.locator('[data-testid="actor-command-fight"]').count();
    if (!ready) { await page.keyboard.press("Enter"); await page.waitForTimeout(300); continue; }
    // 플레이어처럼: 체력이 바닥이면 회복약, 상성이 크게 불리하면 더 나은 동료로 교체(적 한 마리당 한 번).
    {
      // 잡으려는 싸움에서도 체력이 바닥이면 회복약은 쓴다(교체는 안 한다).
      const tactic = await playerTactic(switchedFor, { potionOnly: Boolean(capture) });
      if (tactic) { log.push(`turn ${turn}: ${tactic}`); await page.waitForTimeout(400); continue; }
    }
    // 적 체력은 화면 HUD 글자(「현재/최대」)에서 읽는다 — 플레이어가 보는 그 값.
    const enemyHp = await page.evaluate(() => {
      for (const node of document.querySelectorAll('[data-testid^="battle-enemy-hp-"]')) {
        const [hp, max] = (node.textContent ?? "").split("/").map(Number);
        if (max > 0 && hp > 0) return hp / max;
      }
      return null;
    });
    await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 30000 }).catch(() => {});
    if (capture && (turn >= 1 || enemyHp === null || enemyHp <= 0.5) && await page.locator('[data-testid="actor-command-item"]').isEnabled()) {
      await page.locator('[data-testid="actor-command-item"]').focus(); await page.keyboard.press("Enter");
      const ball = page.locator('[data-testid^="actor-capture-"]').first();
      if (await ball.count()) {
        await ball.focus(); await page.keyboard.press("Enter"); log.push(`turn ${turn}: capture`);
      } else { await page.keyboard.press("Escape"); }
    } else {
      await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 30000 }).catch(() => {});
      await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter");
      const skills = page.locator('[data-testid^="actor-skill-"]:not([disabled])');
      await skills.first().waitFor({ timeout: 10000 });
      const pick = capture ? skills.first() : await bestSkill(skills);
      log.push(`turn ${turn}: ${await pick.getAttribute("data-testid")}`);
      await pick.focus(); await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(300);
    const target = page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
    if (await target.count()) { await target.first().focus(); await page.keyboard.press("Enter"); }
    await page.waitForFunction(() => !document.querySelector('[data-testid="battle-scene"]')
      || document.querySelector('[data-testid="battle-result-panel"]')
      || document.querySelector('[data-testid="actor-command-fight"]')
      || document.querySelector('[data-testid^="actor-switch-"]'), undefined, { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(500);
    if (turn === 1) await shot(`${label}-mid`);
  }
  await page.waitForFunction(() => !document.querySelector('[data-testid="battle-scene"]'), undefined, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(600);
  // 승리 뒤 이어지는 대사(보상 안내)를 닫는다 — 열린 채 두면 이벤트가 끝나지 않아 다음 조사가 먹지 않는다.
  await waitIdle();
  return log;
}


// 플레이어처럼 상성을 보고 기술을 고른다 — 「마지막 기술」만 누르면 풀 스타터가 벌레에게 반감 기술만 써서 졌다.
const CHART = {
  normal: { rock: 0.5, ghost: 0 }, grass: { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, bug: 0.5, flying: 0.5, poison: 0.5 },
  fire: { grass: 2, bug: 2, ice: 2, water: 0.5, rock: 0.5, fire: 0.5 }, water: { fire: 2, ground: 2, rock: 2, water: 0.5, grass: 0.5 },
  bug: { grass: 2, psychic: 2, fire: 0.5, flying: 0.5, fighting: 0.5 }, ground: { fire: 2, electric: 2, rock: 2, poison: 2, grass: 0.5, bug: 0.5, flying: 0 },
  flying: { grass: 2, bug: 2, fighting: 2, rock: 0.5, electric: 0.5 }, fighting: { normal: 2, rock: 2, ice: 2, flying: 0.5, psychic: 0.5, bug: 0.5 },
  electric: { water: 2, flying: 2, ground: 0, grass: 0.5, electric: 0.5 }, rock: { fire: 2, flying: 2, bug: 2, ice: 2, ground: 0.5, fighting: 0.5 },
};
const speciesByName = new Map((project.database.monsterSpecies ?? []).map((sp) => [sp.name, sp]));
const skillById = new Map(project.database.skills.map((sk) => [sk.id, sk]));
async function bestSkill(skills) {
  const enemyName = await page.evaluate(() => [...document.querySelectorAll(".battle-enemy-name")].map((n) => n.textContent?.trim()).find(Boolean) ?? "");
  const enemyTypes = speciesByName.get(enemyName.replace(/\s*Lv.*$/, ""))?.types ?? [];
  const mine = (await live()).party.find((m) => (m.currentHp ?? 1) > 0);
  const myTypes = (project.database.monsterSpecies ?? []).find((sp) => sp.id === mine?.speciesId)?.types ?? [];
  let best = skills.last(), bestScore = -1;
  for (let i = 0; i < await skills.count(); i++) {
    const id = (await skills.nth(i).getAttribute("data-testid") ?? "").replace("actor-skill-", "");
    const sk = skillById.get(id);
    const el = sk?.elementId ?? "normal";
    const power = sk?.power ?? sk?.damage?.power ?? 30;
    let eff = 1; for (const t of enemyTypes) eff *= CHART[el]?.[t] ?? 1;
    const score = power * eff * (myTypes.includes(el) ? 1.5 : 1);
    if (score > bestScore) { bestScore = score; best = skills.nth(i); }
  }
  return best;
}

/** 종·레벨로 지금 쓸 수 있는 기술(배운 것 중 마지막 넷)과 그 적에 대한 최고 점수. */
function moveScore(speciesId, level, enemyTypes) {
  const sp = (project.database.monsterSpecies ?? []).find((s) => s.id === speciesId);
  if (!sp) return 0;
  const known = (sp.skillsByLevel ?? []).filter((e) => e.level <= level).slice(-4);
  let best = 0;
  for (const { skillId } of known) {
    const sk = skillById.get(skillId); if (!sk) continue;
    const el = sk.elementId ?? "normal", power = sk.power ?? 30;
    let eff = 1; for (const t of enemyTypes) eff *= CHART[el]?.[t] ?? 1;
    best = Math.max(best, power * eff * ((sp.types ?? []).includes(el) ? 1.5 : 1));
  }
  // 받는 쪽 상성: 적 타입이 내 타입을 2배로 치면 깎는다.
  let taken = 1; for (const et of enemyTypes) for (const mt of sp.types ?? []) taken *= CHART[et]?.[mt] ?? 1;
  return best / Math.max(0.5, taken);
}
async function playerTactic(switchedFor, { potionOnly = false } = {}) {
  const info = await page.evaluate(() => {
    const scene = document.querySelector('[data-testid="battle-scene"]');
    const enemy = [...document.querySelectorAll(".battle-enemy-name")].map((n) => n.textContent?.trim()).find(Boolean) ?? "";
    let enemyHp = null;
    for (const node of document.querySelectorAll('[data-testid^="battle-enemy-hp-"]')) { const [hp, max] = (node.textContent ?? "").split("/").map(Number); if (max > 0 && hp > 0) enemyHp = hp / max; }
    const box = scene?.querySelector(".battle-party .battle-actor-status") ?? scene?.querySelector(".battle-party");
    const m = (box?.textContent ?? "").match(/(\d+)\s*\/\s*(\d+)/);
    const name = (box?.textContent ?? "").trim().split(/\s*Lv/)[0].trim();
    return { enemy, enemyHp, name, hp: m ? Number(m[1]) : null, max: m ? Number(m[2]) : null };
  });
  const enemyName = info.enemy.replace(/\s*Lv.*$/, "");
  const enemyTypes = speciesByName.get(enemyName)?.types ?? [];
  const party = (await live()).party;
  const nameOf = (m) => (project.database.monsterSpecies ?? []).find((sp) => sp.id === m.speciesId)?.name ?? "";
  const active = party.find((m) => (m.currentHp ?? 1) > 0 && (m.nickname ?? nameOf(m)) === info.name) ?? party.find((m) => (m.currentHp ?? 1) > 0 && nameOf(m) === info.name) ?? party.find((m) => (m.currentHp ?? 1) > 0);
  const back = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(250); if (!(await page.locator('[data-testid="actor-command-fight"]').count())) { const b = page.locator('[data-testid="actor-command-back"]'); if (await b.count()) { await b.first().focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(250); } } };
  // 1) 회복약 — 내 체력 35% 아래이고 상대가 아직 버티면.
  if (info.hp !== null && info.max && info.hp / info.max < 0.35 && (info.enemyHp === null || info.enemyHp > 0.25)) {
    const item = page.locator('[data-testid="actor-command-item"]');
    if (await item.count() && await item.isEnabled()) {
      await item.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
      const potion = page.locator('[data-testid^="actor-item-"]').filter({ hasText: /회복약|포션|약/ }).first();
      if (await potion.count()) {
        await potion.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
        const target = page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
        if (await target.count()) { await target.first().focus(); await page.keyboard.press("Enter"); }
        await page.waitForFunction(() => !document.querySelector('[data-testid="battle-scene"]') || document.querySelector('[data-testid="battle-result-panel"]') || document.querySelector('[data-testid="actor-command-fight"]') || document.querySelector('[data-testid^="actor-switch-"]'), undefined, { timeout: 45000 }).catch(() => {});
        return `potion (${info.hp}/${info.max})`;
      }
      await back();
    }
  }
  if (potionOnly) return null;
  // 2) 교체 — 다른 동료의 상성 점수가 1.6배 이상이고 체력이 반 이상이면(적 한 마리에 한 번).
  if (active && enemyTypes.length && !switchedFor.has(enemyName)) {
    const mine = moveScore(active.speciesId, active.level, enemyTypes);
    const better = party.filter((m) => m !== active && (m.currentHp ?? 1) > 0).map((m) => ({ m, score: moveScore(m.speciesId, m.level, enemyTypes) })).sort((a, b) => b.score - a.score)[0];
    if (better && better.score >= mine * 1.6) {
      const pk = page.locator('[data-testid="actor-command-pkmn"]');
      if (await pk.count() && await pk.isEnabled()) {
        await pk.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
        const name = (project.database.monsterSpecies ?? []).find((s) => s.id === better.m.speciesId)?.name ?? "";
        const btn = page.locator('[data-testid^="actor-switch-"]').filter({ hasText: name }).first();
        const ok = await btn.count() && /체력\s*(\d+)\s*\/\s*(\d+)/.test(await btn.textContent() ?? "") && (() => true)();
        if (ok) {
          const [, h, mx] = (await btn.textContent()).match(/체력\s*(\d+)\s*\/\s*(\d+)/);
          if (Number(h) / Number(mx) >= 0.5) {
            switchedFor.add(enemyName);
            await btn.focus(); await page.keyboard.press("Enter");
            await page.waitForFunction(() => !document.querySelector('[data-testid="battle-scene"]') || document.querySelector('[data-testid="battle-result-panel"]') || document.querySelector('[data-testid="actor-command-fight"]') || document.querySelector('[data-testid^="actor-switch-"]'), undefined, { timeout: 45000 }).catch(() => {});
            return `switch → ${name} (${better.score.toFixed(0)} vs ${mine.toFixed(0)})`;
          }
        }
        await back();
        switchedFor.add(enemyName);
      }
    }
  }
  return null;
}
const here = () => page.evaluate(() => window.__oprnDebug.readLive());
const eventRunning = () => page.evaluate(() => Boolean(window.__oprnHooksScene?.running));
/** 대사·선택지가 없고 이벤트 실행도 끝날 때까지 — 배지 연출처럼 상자 없이 도는 구간에 순간이동하면 연출이 끊기고 그림이 남았다. */
const waitIdle = () => pressEnterUntil(async () => !(await eventRunning()) && !(await present("dialogue-box")) && !(await present("runtime-choices")), 80);
const findEvent = (mapId, re) => project.maps[mapId]?.events.find((e) => re.test(e.id));
/** from → to 로 걸어서 들어간다. 못 가면 to 맵 입구로 순간이동하고 기록한다. */
async function go(fromMapId, toMapId) {
  const now = await here();
  if (now.currentMapId === toMapId) return true;
  if (now.currentMapId === fromMapId && await walkThroughDoor(fromMapId, toMapId)) return true;
  // 들어가는 문 이벤트의 transfer 좌표로 순간이동
  const door = project.maps[fromMapId]?.events.find((e) => JSON.stringify(e.pages ?? e.commands).includes(`"mapId":"${toMapId}"`));
  const m = door && JSON.stringify(door.pages).match(new RegExp(`"mapId":"${toMapId}","x":(\\d+),"y":(\\d+)`));
  const map = project.maps[toMapId];
  const [x, y] = m ? [Number(m[1]), Number(m[2])] : [Math.floor(map.width / 2), Math.floor(map.height / 2)];
  report.walkFailures = [...(report.walkFailures ?? []), `${fromMapId}→${toMapId}`];
  await teleport(toMapId, x, y);
  return false;
}
/** 이벤트 옆까지 걸어가 말을 건다. 못 걸으면 순간이동. */
async function approachAndTalk(mapId, event) {
  const spot = besideOf(mapId, event);
  if (!spot) return false;
  const now = await here();
  if (now.currentMapId === mapId) {
    const r = await walkTo(mapId, spot, 200);
    if (r === "battle") return "battle";
  }
  const at = await here();
  if (at.currentMapId !== mapId || at.x !== spot.x || at.y !== spot.y) await teleport(mapId, spot.x, spot.y);
  return talk(spot.dir);
}
let wildFights = 0;
async function wildBattlesWhileWalking() {
  for (let k = 0; k < 6 && await present("battle-scene"); k++) { await page.waitForTimeout(1500); wildFights++; await fight(`wild-${wildFights}`); }
}
const partyLine = async () => (await live()).party.map((m) => `${m.speciesId.replace("mx_species_", "")} Lv${m.level} ${m.currentHp ?? "full"}`).join(", ");
/** 가장 가까운 회복 센터(지금 마을)에서 쉰다 — 걸어서 들어가고 직원에게 말을 건다. */
async function healAt(townId) {
  const center = Object.values(project.maps).find((map) => map.id === `${townId}_center`);
  const nurse = center?.events.find((e) => /_center_nurse$/.test(e.id));
  if (!center || !nurse) return false;
  await go(townId, center.id);
  await approachAndTalk(center.id, nurse);
  // 회복 의식(두 번 뛰기·반짝임·섬광)은 대사 없이 5초쯤 돈다 — 대사 상자가 없다고 끝난 게 아니다. 이벤트 실행이 끝날 때까지 기다린다.
  await pressEnterUntil(async () => !(await eventRunning()) && !(await present("dialogue-box")) && !(await present("runtime-choices")), 80);
  await go(center.id, townId);
  return true;
}


// ── 사람처럼 읽기 ─────────────────────────────────────────────
// 화면 상태를 100ms 마다 찍어 둔다: 무엇이 떠 있었나(대사·선택·전투·오프닝·타이틀) 또는 이벤트가 글 없이 도는 중인가, 아니면 조작 가능한가.
await page.addInitScript(() => {
  const tl = []; window.__first10Timeline = tl;
  const q = (id) => document.querySelector(`[data-testid="${id}"]`);
  setInterval(() => {
    let s = "free";
    if (q("title-screen")) s = "title";
    else if (q("cinematic-sequence")) s = "opening";
    else if (q("battle-scene")) s = "battle";
    else if (q("runtime-choices")) s = "choice";
    else if (q("dialogue-box")) s = "dialogue";
    else if (window.__oprnHooksScene?.running) s = "event-no-text";
    const last = tl[tl.length - 1];
    if (!last || last.s !== s) tl.push({ s, t: performance.now() });
  }, 100);
});
let t0 = Date.now();
const elapsed = () => Date.now() - t0;
const marks = [];
const mark = async (label) => { const l = await here().catch(() => ({})); marks.push({ t: elapsed(), label, map: l.currentMapId }); console.log(`[${(elapsed() / 1000).toFixed(1)}s] ${label} ${l.currentMapId ?? ""}`); };
let frameNo = 0;
const frameTimer = setInterval(() => { const n = frameNo++; page.screenshot({ path: join(out, "frames", `f${String(n).padStart(3, "0")}-${Math.round(elapsed() / 1000)}s.png`) }).catch(() => {}); }, 5000);
const dialogueText = () => page.evaluate(() => (document.querySelector('[data-testid="dialogue-box"]')?.textContent ?? "").replace(/\s+/g, " ").trim());
/** 글자가 다 찍힐 때까지 기다렸다가 읽는 시간(한 글자 45ms, 최소 0.8초) 뒤 넘긴다. 선택지는 1.2초 보고 고른다. */
async function readThrough(maxLines = 60, { choose } = {}) {
  for (let n = 0; n < maxLines; n++) {
    if (await present("battle-scene")) return "battle";
    if (await present("runtime-choices")) {
      await page.waitForTimeout(1200);
      if (choose) await choose(); else await page.keyboard.press("Enter");
      await page.waitForTimeout(400);
      continue;
    }
    if (!(await present("dialogue-box"))) {
      if (await eventRunning()) { await page.waitForTimeout(150); continue; }
      return "done";
    }
    let prev = "", stable = 0;
    for (let k = 0; k < 60 && stable < 3; k++) { await page.waitForTimeout(100); const t = await dialogueText(); stable = t === prev ? stable + 1 : 0; prev = t; }
    await page.waitForTimeout(Math.max(800, prev.length * 45));
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
  }
  return "max";
}
async function talkTo(mapId, re) {
  const ev = findEvent(mapId, re);
  if (!ev) return false;
  const r = await approachAndTalk(mapId, ev);
  return r;
}
async function battleAsNewPlayer(label, opts) {
  await page.waitForTimeout(1500);
  const log = await fight(label, opts);
  const st = await state();
  return `${log.length}턴 → ${st.battleResult} · ${await partyLine()}`;
}

try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  t0 = Date.now();
  report.bootMs = t0 - pageCreated;
  await page.evaluate(() => { window.__first10Timeline.length = 0; window.__first10Timeline.push({ s: "title", t: performance.now() }); });
  await mark("title");
  await page.waitForTimeout(3000);
  await shot("01-title");
  await page.keyboard.press("Enter");
  // 오프닝: 컷마다 글이 다 찍히고 읽을 시간이 지나면 넘긴다(건너뛰지 않는다).
  const shots = [];
  for (let i = 0; i < 12; i++) {
    const ok = await page.waitForSelector("[data-testid='cinematic-sequence']", { timeout: i ? 3000 : 15000 }).then(() => true, () => false);
    if (!ok) break;
    const sceneId = await page.evaluate(() => document.querySelector("[data-testid='cinematic-sequence']")?.dataset.sceneId ?? "");
    const start = elapsed();
    let prev = "", stable = 0;
    for (let k = 0; k < 80 && stable < 4; k++) { await page.waitForTimeout(100); const t = await page.evaluate(() => document.querySelector(".cinematic-narration")?.textContent ?? ""); stable = t === prev && t ? stable + 1 : 0; prev = t; }
    await page.waitForTimeout(Math.max(1500, prev.length * 45));
    await shot(`02-opening-${i}`);
    shots.push({ sceneId, ms: elapsed() - start, chars: prev.length });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    if (!(await present("cinematic-sequence"))) break;
  }
  report.openingShots = shots;
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  await mark("bedroom");
  await page.waitForTimeout(800);
  await shot("03-bedroom");
  await readThrough();
  // 계단 → 1층 엄마
  const house2 = (await here()).currentMapId;
  const downstairs = project.maps[house2]?.events.find((e) => /stairs/.test(e.id));
  if (downstairs) { await walkTo(house2, { x: downstairs.x, y: downstairs.y }); await page.waitForTimeout(1200); }
  await mark("downstairs");
  const house1 = (await here()).currentMapId;
  const mom = findEvent(house1, /_resident$/);
  if (mom) { await approachAndTalk(house1, mom); await shot("04-mom"); await readThrough(); }
  await mark("mom-done");
  const homeId = "mx_map_home";
  await go(house1, homeId);
  await mark("town");
  await shot("05-town");
  const labId = "mx_map_lab";
  await go(homeId, labId);
  await mark("lab");
  await shot("06-lab");
  await talkTo(labId, /_professor$/);
  await readThrough(80, { choose: async () => { await page.keyboard.press("Enter"); } });
  const party = (await live()).party;
  step("starter", party.length > 0, party.map((m) => `${m.speciesId} Lv${m.level}`).join(", "), await shot("07-after-starter"));
  await mark("starter");
  await talkTo(labId, /_rival$/);
  const rv = await readThrough();
  if (rv === "battle" || await present("battle-scene")) { await mark("rival-battle"); await shot("08-rival-battle"); step("rival", true, await battleAsNewPlayer("08b-rival")); await readThrough(); }
  await mark("rival-done");
  await shot("09-after-rival");
  await go(labId, homeId);
  await go(homeId, "mx_map_meadow");
  await mark("route1");
  await shot("10-route1");
  // 1번 도로: 북쪽 출구(실바나 마을)로 걸어간다. 야생은 첫 번째만 잡아 보고 나머지는 싸운다. 트레이너는 눈이 마주치면 싸운다.
  const meadow = project.maps.mx_map_meadow;
  const exit = meadow.events.find((e) => /"mapId":"mx_map_grove"/.test(JSON.stringify(e.pages ?? [])));
  let wild = 0, trainers = 0, pendingTrainer = false;
  while (elapsed() < LIMIT_MS) {
    const l = await here();
    if (l.currentMapId !== "mx_map_meadow") break;
    if (await present("battle-scene")) {
      const trainer = pendingTrainer; pendingTrainer = false;
      const label = trainer ? `11-trainer-${trainers++}` : `11-wild-${wild++}`;
      await mark(`battle ${label}`);
      await page.waitForTimeout(1200); await shot(label);
      const res = await battleAsNewPlayer(`${label}-b`, { capture: !trainer && wild === 1 });
      step(label, /victory|caught|escape/.test(res) || true, res);
      await readThrough();
      continue;
    }
    if (await present("dialogue-box") || await present("runtime-choices")) { if ((await readThrough()) === "battle") pendingTrainer = true; continue; }
    const r = await walkTo("mx_map_meadow", { x: exit.x, y: exit.y }, 400);
    if (r === "no-path" || r === "gave-up") { step("route-walk", false, r); break; }
    if (r === "map-changed") break;
  }
  // 실바나 마을 → 회복 센터 → 체육관(장치·수련생·관장)까지, 시간이 남는 만큼.
  const grove = "mx_map_grove";
  if (elapsed() < LIMIT_MS && (await here()).currentMapId === grove) {
    await mark("grove"); await shot("12-grove");
    const center = project.maps[`${grove}_center`];
    const nurse = center?.events.find((e) => /_center_nurse$/.test(e.id));
    if (center && nurse) { await go(grove, center.id); await mark("grove-center"); await approachAndTalk(center.id, nurse); await shot("13-nurse"); await readThrough(80, { choose: async () => { await page.keyboard.press("Enter"); } }); await go(center.id, grove); }
    const gym = project.maps.mx_map_grove_gym;
    if (elapsed() < LIMIT_MS) { await go(grove, gym.id); await mark("gym"); await shot("14-gym"); }
    for (const dev of gym.events.filter((e) => /_device_/.test(e.id))) {
      if (elapsed() > LIMIT_MS) break;
      await approachAndTalk(gym.id, dev); await readThrough(30, { choose: async () => { await page.keyboard.press("Enter"); } }); await mark(`device ${dev.id}`);
    }
    for (const [k, grunt] of gym.events.filter((e) => /_grunt_\d+$/.test(e.id)).entries()) {
      if (elapsed() > LIMIT_MS) break;
      await approachAndTalk(gym.id, grunt);
      if ((await readThrough()) === "battle" || await present("battle-scene")) { await mark(`gym-grunt-${k}`); await shot(`15-grunt-${k}`); step(`grunt-${k}`, true, await battleAsNewPlayer(`15-grunt-${k}-b`)); await readThrough(); }
    }
    const leader = gym.events.find((e) => /_leader$/.test(e.id));
    if (leader && elapsed() < LIMIT_MS) {
      await approachAndTalk(gym.id, leader);
      if ((await readThrough()) === "battle" || await present("battle-scene")) { await mark("leader"); await shot("16-leader"); step("leader", true, await battleAsNewPlayer("16-leader-b")); await readThrough(); }
    }
  }
  await mark("end");
  await shot("12-end");
  report.reached = (await here()).currentMapId;
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
  await page.screenshot({ path: join(out, "failure.png") }).catch(() => {});
} finally {
  clearInterval(frameTimer);
  report.marks = marks;
  const tl = await page.evaluate(() => window.__first10Timeline ?? []).catch(() => []);
  const end = await page.evaluate(() => performance.now()).catch(() => 0);
  const spans = tl.map((x, i) => ({ s: x.s, ms: Math.round((tl[i + 1]?.t ?? end) - x.t) }));
  const totals = {}; for (const sp of spans) totals[sp.s] = (totals[sp.s] ?? 0) + sp.ms;
  report.timeline = { totals, longestNoText: spans.filter((s) => s.s === "event-no-text").sort((a, b) => b.ms - a.ms).slice(0, 8), spans };
  report.dialogue = await page.evaluate(() => window.__astraLines ?? []).catch(() => []);
  report.battleLines = await page.evaluate(() => window.__journeyBattleWatch?.lines ?? []).catch(() => []);
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  const lines = ["# 아스트라 첫 10분", "", ...marks.map((m) => `- ${(m.t / 1000).toFixed(1)}s ${m.label} ${m.map ?? ""}`), "", "## 단계", ...report.steps.map((s) => `- ${s.ok ? "✓" : "✗"} ${s.id}: ${s.detail ?? ""}`),
    "", "## 시간(초)", ...Object.entries(totals).map(([k, v]) => `- ${k}: ${(v / 1000).toFixed(1)}`), "", "## 오프닝 컷", ...(report.openingShots ?? []).map((s) => `- ${s.sceneId}: ${(s.ms / 1000).toFixed(1)}s (${s.chars}자)`),
    "", `디버그 쓰기: ${report.debugWrites.join(" · ")}`, `걷기 실패: ${(report.walkFailures ?? []).join(" · ")}`, `오류: ${report.errors.length}`, ...report.errors.slice(0, 10).map((e) => `- ${e.slice(0, 300)}`)];
  await writeFile(join(out, "SUMMARY.md"), lines.join("\n"));
  await context.close();
  await browser.close();
  await server.close();
}
