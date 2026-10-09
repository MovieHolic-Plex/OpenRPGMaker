// 몬스터 수집 캠페인 실플레이 여정 QA — 출하 플레이어(player.html, export shim)로
// 타이틀 → 교수에게 스타터 → 풀숲 조우 → 포획 → 도로 트레이너 → 1관 관장을 실제 입력으로 간다.
//
//   node scripts/qa/runtime/monster-journey.mjs <project.json> [outDir]
//   JOURNEY_VIDEO=1 … — 플레이 영상(outDir/journey.mp4)을 남기고, 시작 마을→연구소→도로→풀숲은 순간이동 대신 실제로 걷는다.
//
// 조작은 실제 입력 훅(__oprnInput: 방향·조사)과 전투 버튼(키보드 Enter)만 쓴다. 디버그 쓰기는 두 곳뿐이고
// SUMMARY 에 적는다: 맵 사이 이동(teleport — 길 걷기는 자동 플레이가 이미 증명), 관장전 직전 리더 레벨 맞춤.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: monster-journey.mjs <project.json> [outDir]");
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const out = resolve(outArg ?? "verify-shots/runtime-qa/monster-journey");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const report = { project: projectArg, steps: [], errors: [], debugWrites: [] };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const VIDEO = process.env.JOURNEY_VIDEO === "1";
const context = await browser.newContext({ viewport: { width: 960, height: 720 }, ...(VIDEO ? { recordVideo: { dir: join(out, "raw-video"), size: { width: 960, height: 720 } } } : {}) });
const page = await context.newPage();
const videoOrigin = Date.now();
page.on("pageerror", (error) => report.errors.push(String(error?.message ?? error)));
page.on("console", (message) => { if (message.type() === "error") report.errors.push(`console: ${message.text()}`); });
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:monster-journey", qaInstrumentation: true };
});
// 1대1 몬스터 전투에서 상대 HP 상자·그림이 둘 이상 동시에 보이면 안 된다 — 2026-10-07 관장전 캡처에서 쓰러지기 전
// 다음 몬스터가 먼저 서 HP 상자 둘이 겹쳤는데 단계 판정은 통과였다. 100ms 마다 재고, 전투 문장도 차례로 모은다.
await page.addInitScript(() => {
  const seen = { maxEnemies: 0, overlap: [], lines: [] };
  window.__journeyBattleWatch = seen;
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
  return !map.events.some((e) => e.x === x && e.y === y && (!(e.pages?.[0]?.priority === "below") || /"kind":"transfer"/.test(JSON.stringify(e.pages ?? e.commands))));
};
const DIRS = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]];
async function walkTo(mapId, target, maxSteps = 160) {
  for (let n = 0; n < maxSteps; n++) {
    const here = await page.evaluate(() => window.__oprnDebug.readLive());
    if (here.currentMapId !== mapId) return "map-changed";
    if (here.x === target.x && here.y === target.y) return "arrived";
    if (await present("battle-scene")) return "battle";
    if (await present("dialogue-box")) { await page.keyboard.press("Enter"); await page.waitForTimeout(300); continue; }
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
    if (!found) return "no-path";
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
    // 적 체력은 화면 HUD 글자(「현재/최대」)에서 읽는다 — 플레이어가 보는 그 값.
    const enemyHp = await page.evaluate(() => {
      for (const node of document.querySelectorAll('[data-testid^="battle-enemy-hp-"]')) {
        const [hp, max] = (node.textContent ?? "").split("/").map(Number);
        if (max > 0 && hp > 0) return hp / max;
      }
      return null;
    });
    await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 30000 }).catch(() => {});
    if (capture && (enemyHp === null || enemyHp <= 0.5) && await page.locator('[data-testid="actor-command-item"]').isEnabled()) {
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
      const pick = capture ? skills.first() : skills.last();
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
  await pressEnterUntil(async () => !(await present("dialogue-box")), 40);
  return log;
}

try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(1500);
  report.titleAtMs = Date.now() - videoOrigin;
  step("title", true, project.meta?.title ?? "", await shot("01-title"));

  // 새 게임 → 오프닝(시네마틱·대사)을 Enter 로 넘겨 조작 가능할 때까지.
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  await pressEnterUntil(async () => !(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen")), 80);
  const start = await state();
  step("new-game", start.currentMapId === project.startMapId, `${start.currentMapId} (${start.x},${start.y})`, await shot("02-start"));

  // 교수에게 첫 동료 — 연구소 교수 옆에 서서 조사, 선택지 첫 번째.
  const lab = Object.values(project.maps).find((map) => map.events.some((event) => /professor/.test(event.id)));
  const professor = lab.events.find((event) => /professor/.test(event.id));
  const spot = besideOf(lab.id, professor);
  if (VIDEO) {
    await page.waitForTimeout(1200);
    if (await walkThroughDoor(start.currentMapId, lab.id)) await walkTo(lab.id, spot);
  }
  const atSpot = await page.evaluate(() => window.__oprnDebug.readLive());
  if (atSpot.currentMapId !== lab.id || atSpot.x !== spot.x || atSpot.y !== spot.y) await teleport(lab.id, spot.x, spot.y);
  await talk(spot.dir);
  await page.waitForSelector("[data-testid='dialogue-box']", { timeout: 15000 });
  await shot("03-professor");
  // 대사 사이·선택지 전환 때 대사 상자가 잠깐 사라진다 — 상자만 보면 고르기 전에 멈춘다. 파티가 생기고 상자가 닫힐 때까지.
  await pressEnterUntil(async () => (await live()).party.length > 0 && !(await present("dialogue-box")), 80);
  const afterStarter = await live();
  step("starter", afterStarter.party.length === 1, afterStarter.party.map((m) => `${m.speciesId} Lv${m.level}`).join(", "), await shot("04-after-starter"));

  // 1번 도로 풀숲 — 서식지 안 오갈 수 있는 두 칸에서 좌우로 걸어 조우.
  const route = Object.values(project.maps).find((map) => (map.encounterTable ?? []).length > 0 && map.id !== lab.id
    && project.maps[project.startMapId].events.some((event) => JSON.stringify(event.pages).includes(`"mapId":"${map.id}"`)));
  const habitat = (route.locations ?? []).find((location) => route.encounterTable.some((entry) => entry.conditions?.locationId === location.id));
  const tiles = project.tilesets[route.tilesetId];
  // 서식지 가운데에 가까운 칸부터 — 들어가서 오른쪽으로 한 걸음 갈 수 있는 첫 칸(나무·바위 칸은 거른다).
  const cx = habitat.x + habitat.w / 2, cy = habitat.y + habitat.h / 2;
  const candidates = [];
  for (let y = habitat.y; y < habitat.y + habitat.h; y++) for (let x = habitat.x; x < habitat.x + habitat.w - 1; x++) {
    if (free(route.id, x, y) && free(route.id, x + 1, y)) candidates.push({ x, y });
  }
  candidates.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  let cell = null;
  // 영상: 연구소 → 마을 → 북쪽 도로까지 걸어 나가 풀숲 가운데로 걸어 들어간다.
  if (VIDEO && await walkThroughDoor(lab.id, start.currentMapId) && await walkThroughDoor(start.currentMapId, route.id)) {
    for (const candidate of candidates.slice(0, 8)) {
      const r = await walkTo(route.id, candidate, 80);
      if (r === "battle" || r === "arrived") { cell = candidate; break; }
    }
  }
  for (const candidate of cell ? [] : candidates.slice(0, 40)) {
    const landed = await teleport(route.id, candidate.x, candidate.y, true).then(() => true, () => false);
    if (landed && await stepMoves("right") && await stepMoves("left")) { cell = candidate; break; }
    if (await present("battle-scene")) { cell = candidate; break; }
  }
  report.debugWrites.push(`teleport ${route.id} grass (${cell?.x},${cell?.y})`);
  report.route = { map: route.id, habitat, cell, tileset: tiles?.id };
  await shot("05-route-grass");
  let encountered = false;
  for (let i = 0; i < 120 && !encountered; i++) {
    await page.evaluate((d) => window.__oprnInput.dir(d), i % 2 ? "left" : "right");
    await page.waitForTimeout(260);
    await page.evaluate(() => window.__oprnInput.dir(null));
    encountered = await present("battle-scene");
  }
  if (encountered) await page.waitForTimeout(2500);
  step("wild-encounter", encountered, encountered ? "battle-scene" : "120걸음 동안 조우 없음", await shot("06-wild-battle"));

  if (encountered) {
    const before = await live();
    const captureLog = await fight("07-capture", { capture: true });
    const after = await live();
    const owned = after.party.length + after.box.length;
    step("capture", owned > before.party.length + before.box.length, `${captureLog.join(" / ")} → 보유 ${owned}`, await shot("08-after-capture"));
  }

  // 포획전에서 지친 동료를 마을 회복 센터 직원에게 맡긴다(플레이어가 하듯) — 지친 채 트레이너에게 졌다.
  const heal = async () => {
    const center = Object.values(project.maps).find((map) => map.events.some((event) => /_center_nurse$/.test(event.id)) && map.id.startsWith(start.currentMapId));
    const nurse = center?.events.find((event) => /_center_nurse$/.test(event.id));
    if (!center || !nurse) return false;
    const spot = besideOf(center.id, nurse);
    await teleport(center.id, spot.x, spot.y);
    await talk(spot.dir);
    await pressEnterUntil(async () => !(await present("dialogue-box")), 40);
    const healthy = await live();
    return healthy.party.every((m) => m.currentHp === undefined || m.currentHp > 0);
  };
  step("heal", await heal(), "회복 센터 직원", await shot("08b-healed"));

  // 도로 트레이너 — 이 도로의 전투 이벤트 하나.
  const trainer = route.events.find((event) => JSON.stringify(event.pages).includes('"battleProcessing"'));
  if (trainer) {
    const near = besideOf(route.id, trainer);
    // 영상: 회복 센터에서 도로로 나가 트레이너에게 걸어간다(센터 → 마을 → 도로). 시선이 닿으면 트레이너가 먼저 말을 건다.
    if (VIDEO) {
      const centerMap = (await page.evaluate(() => window.__oprnDebug.readLive())).currentMapId;
      if (await walkThroughDoor(centerMap, start.currentMapId) && await walkThroughDoor(start.currentMapId, route.id)) {
        // 풀숲을 지나며 야생이 나오면 싸워 이기고 계속 간다.
        for (let k = 0; k < 4 && await walkTo(route.id, near, 120) === "battle"; k++) { await page.waitForTimeout(2000); await fight(`walk-wild-${k}`, { run: true }); }
        // 마지막 걸음에서 야생이 나올 수도 있다 — 트레이너 전투로 착각하지 않게 먼저 도망간다.
        await page.waitForTimeout(1500);
        if (await present("battle-scene")) { await page.waitForTimeout(1500); await fight("walk-wild-last", { run: true }); }
      }
    }
    const here = await page.evaluate(() => window.__oprnDebug.readLive());
    if (!(await present("dialogue-box")) && !(await present("battle-scene")) && (here.currentMapId !== route.id || here.x !== near.x || here.y !== near.y)) await teleport(route.id, near.x, near.y);
    await talk(near.dir);
    const started = await pressEnterUntil(() => present("battle-scene"), 30);
    if (started) await page.waitForTimeout(2500);
    await shot("09-trainer-battle");
    const log = started ? await fight("10-trainer") : [];
    const after = await state();
    step("trainer", started && after.battleResult === "victory", `${trainer.id}: ${log.length}턴 → battleResult ${after.battleResult}`, await shot("11-after-trainer"));
  }

  // 1관 관장 — 퍼즐 스위치와 리더 레벨은 디버그로 맞춘다(체육관 퍼즐·수련은 자동 플레이가 증명).
  const gym = Object.values(project.maps).find((map) => map.events.some((event) => /gym_leader$|_leader$/.test(event.id)) && /gym/.test(map.id));
  const leader = gym.events.find((event) => /_leader$/.test(event.id));
  const gymSwitches = JSON.stringify(leader.pages).match(/mx_gym_\d+_puzzle/g) ?? [];
  await page.evaluate((ids) => { for (const id of ids) window.__oprnDebug.setSwitch(id, true); }, [...new Set(gymSwitches)]);
  await page.evaluate(() => {
    const s = window.__oprnHooksScene.session;
    const lead = s.monsterInstances[s.monsterParty[0]];
    lead.level = Math.max(lead.level, 14); lead.exp = Math.max(lead.exp ?? 0, 2800); lead.currentHp = undefined;
  });
  report.debugWrites.push(`switches ${[...new Set(gymSwitches)].join(",")} on; lead level ≥14`);
  // 관장은 카운터 뒤에 서 있을 수 있다 — 바로 아래·카운터 너머(두 칸 아래)·좌우를 차례로 시도한다.
  let talked = false;
  for (const [dx, dy, dir] of [[0, 1, "up"], [0, 2, "up"], [-1, 0, "right"], [1, 0, "left"]]) {
    const at = { x: leader.x + dx, y: leader.y + dy };
    if (!free(gym.id, at.x, at.y)) continue;
    // 얼음 관장 단상처럼 못 서는 칸이면 순간이동이 다른 칸에 내려놓는다 — 다음 자리를 시도한다.
    try { await teleport(gym.id, at.x, at.y); } catch { continue; }
    await page.waitForTimeout(2000);
    if (await talk(dir)) { talked = true; report.leaderSpot = { ...at, dir }; break; }
  }
  const started = talked && await pressEnterUntil(() => present("battle-scene"), 40);
  if (started) await page.waitForTimeout(2500);
  await shot("12-leader-battle");
  const log = started ? await fight("13-leader") : [];
  await pressEnterUntil(async () => !(await present("dialogue-box")), 40);
  const badgeId = (JSON.stringify(leader.pages).match(/mx_badge_\d+/) ?? ["?"])[0];
  // 배지 수여 연출(페이드·대사)이 끝날 때까지 기다린다.
  for (let i = 0; i < 40 && (await state()).switches[badgeId] !== true; i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(500); }
  const finalState = await state();
  const badge = finalState.switches;
  report.leaderBattleResult = finalState.battleResult;
  step("gym-leader", started && badge[badgeId] === true, `${leader.id}: ${log.length}턴 → battleResult ${finalState.battleResult} · ${badgeId}=${badge[badgeId]}`, await shot("14-after-leader"));
  const watch = await page.evaluate(() => window.__journeyBattleWatch);
  report.battleLines = watch.lines;
  step("battle-status-in-box", !(watch.strayIcons ?? []).length, (watch.strayIcons ?? []).join(" | ") || "상태 배지는 모두 HP 상자 안");
  step("battle-one-foe", watch.maxEnemies <= 1, `동시에 보인 상대 최대 ${watch.maxEnemies}${watch.overlap.length ? ` — ${watch.overlap.join(" | ")}` : ""}`);
} catch (error) {
  report.failure = String(error?.stack ?? error);
  await shot("failure").catch(() => {});
  console.error(report.failure);
} finally {
  const failed = report.steps.filter((s) => !s.ok);
  report.ok = !report.failure && failed.length === 0 && report.errors.length === 0;
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(out, "SUMMARY.md"), [
    `# monster-journey — ${report.ok ? "통과" : "실패"}`, "",
    ...report.steps.map((s) => `- ${s.ok ? "✓" : "✗"} ${s.id}: ${s.detail}${s.image ? ` (${s.image})` : ""}`), "",
    `즉시 확인: ${report.steps.filter((s) => !s.ok).map((s) => s.image).filter(Boolean).join(", ") || "06-wild-battle.png, 08-after-capture.png, 12-leader-battle.png"}`, "",
    `디버그 쓰기: ${report.debugWrites.join(" · ")}`, "",
    report.failure ? `예외: ${report.failure}` : "", ...report.errors.slice(0, 15).map((e) => `- 오류: ${e}`),
  ].join("\n"));
  const video = page.video();
  await context.close();
  if (video) {
    const raw = await video.path();
    // 정지 화면이 길게 이어지는 구간(로딩·대기)도 그대로 둔다 — 실제 플레이 시간이다. H.264 + yuv420p 로 어디서나 열리게.
    try { execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(Math.max(0, ((report.titleAtMs ?? 0) - 1500) / 1000)), "-i", raw, "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(out, "journey.mp4")]); }
    catch (error) { report.errors.push(`ffmpeg: ${error}`); }
  }
  await browser.close();
  await server.close();
}
process.exit(report.ok ? 0 : 1);
