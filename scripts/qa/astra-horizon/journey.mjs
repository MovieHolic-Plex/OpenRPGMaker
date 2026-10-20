// 아스트라 호라이즌(emerald-crown) 실플레이 여정 — 출하 플레이어(player.html)로 타이틀부터 엔딩까지 간다.
//   node scripts/qa/astra-horizon/journey.mjs <project.json> <outDir>
// 맵 사이는 가능한 한 실제로 걷는다(문 이벤트). 못 걸으면 순간이동하고 report.debugWrites 에 남긴다.
// 화면은 1440×960(게임 480×320 의 3배)으로 찍고, 1배 사본은 build-audit 단계에서 줄인다.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg || !outArg) throw new Error("usage: journey.mjs <project.json> <outDir>");
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const out = resolve(outArg);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const report = { project: projectArg, steps: [], errors: [], debugWrites: [], dialogue: [] };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
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
    if (!capture) {
      const tactic = await playerTactic(switchedFor);
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
async function playerTactic(switchedFor) {
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

try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(3500);
  step("title", true, project.meta?.title ?? "", await shot("01-title"));

  // 새 게임 → 오프닝 몇 컷 찍기
  await page.keyboard.press("Enter");
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(i === 0 ? 2500 : 1800);
    if (!(await present("cinematic-sequence"))) break;
    await shot(`02-opening-${i}`);
    await page.keyboard.press("Enter");
  }
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  await pressEnterUntil(async () => !(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen")), 80);
  await page.waitForTimeout(800);
  const start = await state();
  step("new-game", true, `${start.currentMapId} (${start.x},${start.y})`, await shot("03-start"));

  // 집 안에서 시작했다면 마을로 걸어 나간다
  const home = project.maps.mx_map_home ? "mx_map_home" : project.startMapId;
  for (let hop = 0; hop < 3; hop++) {
    const now = await here();
    if (now.currentMapId === home) break;
    // 계단은 아래층으로만 — 1층에서 다시 2층으로 올라가지 않게, 바깥(home) 문을 먼저 고른다.
    const exits = project.maps[now.currentMapId].events.filter((e) => /"kind":"transfer"/.test(JSON.stringify(e.pages ?? e.commands)));
    // 페이지 id 에도 「_2f」가 들어 있다(계단 이벤트 이름) — 옮겨 가는 맵 id 만 본다.
    const target = (e) => JSON.stringify(e.pages ?? e.commands).match(/"kind":"transfer","mapId":"([^"]+)"/)?.[1];
    const exit = exits.find((e) => target(e) === home) ?? exits.find((e) => target(e) && !/_2f$/.test(target(e)));
    const m = exit && [null, target(exit)];
    if (!m) break;
    await go(now.currentMapId, m[1]);
  }
  step("town", (await here()).currentMapId === home, (await here()).currentMapId, await shot("04-town"));

  // 연구소 → 교수에게 첫 동료
  const lab = Object.values(project.maps).find((map) => map.events.some((e) => /_professor$/.test(e.id)));
  await go(home, lab.id);
  await shot("05-lab");
  const professor = findEvent(lab.id, /_professor$/);
  await approachAndTalk(lab.id, professor);
  await page.waitForSelector("[data-testid='dialogue-box']", { timeout: 15000 }).catch(() => {});
  await shot("06-professor");
  let choiceShot = false;
  for (let i = 0; i < 80; i++) {
    const l = await live();
    if (l.party.length > 0 && !(await present("dialogue-box")) && !(await present("runtime-choices"))) break;
    if (!choiceShot && await present("runtime-choices")) { choiceShot = true; await page.waitForTimeout(500); await shot("07-starter-choice"); }
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
  }
  const afterStarter = await live();
  step("starter", afterStarter.party.length >= 1, afterStarter.party.map((m) => `${m.speciesId} Lv${m.level}`).join(", "), await shot("08-after-starter"));

  // 연구소 라이벌
  const rival = findEvent(lab.id, /_rival$/);
  if (rival) {
    await approachAndTalk(lab.id, rival);
    const started = await pressEnterUntil(() => present("battle-scene"), 30);
    if (started) { await page.waitForTimeout(2500); await shot("09-rival-battle"); }
    const log = started ? await fight("09b-rival") : [];
    const st = await state();
    step("rival", started && st.battleResult === "victory", `${log.length}턴 → ${st.battleResult}`, await shot("10-after-rival"));
  }

  // 1번 도로
  await go(lab.id, home);
  const route = Object.values(project.maps).find((map) => (map.encounterTable ?? []).some((e) => e.conditions?.locationId) && project.maps[home].events.some((e) => JSON.stringify(e.pages).includes(`"mapId":"${map.id}"`) && /to_/.test(e.id)));
  await go(home, route.id);
  await wildBattlesWhileWalking();
  step("route", (await here()).currentMapId === route.id, route.id, await shot("11-route"));
  // 풀숲에서 조우
  const habitat = (route.locations ?? []).find((loc) => route.encounterTable.some((e) => e.conditions?.locationId === loc.id));
  const ts = project.tilesets[route.tilesetId];
  const grassTag = (t) => t >= 0 && ts?.terrainTags?.[t] !== undefined;
  const grassCells = [];
  for (let y = habitat.y; y < habitat.y + habitat.h; y++) for (let x = habitat.x; x < habitat.x + habitat.w - 1; x++) {
    const i = y * route.width + x;
    if (passable(route.id, x, y) && passable(route.id, x + 1, y)) grassCells.push({ x, y, grass: grassTag(route.lowerTiles[i]) || grassTag(route.upperTiles[i]) });
  }
  const now0 = await here();
  grassCells.sort((a, b) => (b.grass - a.grass) || (Math.abs(a.x - now0.x) + Math.abs(a.y - now0.y)) - (Math.abs(b.x - now0.x) + Math.abs(b.y - now0.y)));
  let encountered = false;
  for (const cell of grassCells.slice(0, 6)) {
    const r = await walkTo(route.id, cell, 120);
    if (r === "battle") { encountered = true; break; }
    if (r !== "arrived") continue;
    for (let i = 0; i < 80 && !encountered; i++) {
      await page.evaluate((d) => window.__oprnInput.dir(d), i % 2 ? "left" : "right");
      await page.waitForTimeout(260);
      await page.evaluate(() => window.__oprnInput.dir(null));
      encountered = await present("battle-scene");
    }
    if (encountered) break;
  }
  if (encountered) await page.waitForTimeout(2500);
  step("wild-encounter", encountered, encountered ? "battle-scene" : "조우 없음", await shot("12-wild-battle"));
  if (encountered) {
    const before = await live();
    const captureLog = await fight("13-capture", { capture: true });
    const after = await live();
    const owned = after.party.length + after.box.length;
    const cap = await page.evaluate(() => window.__journeyBattleWatch.capture);
    step("capture", owned > before.party.length + before.box.length, `${captureLog.join(" / ")} → 보유 ${owned} · ${JSON.stringify(cap)}`, await shot("14-after-capture"));
  }

  // 포획전으로 지친 동료를 마을 회복 센터에 맡기고 돌아온다(플레이어가 하듯)
  await go(route.id, home); await healAt(home); await go(home, route.id);
  step("heal-home", true, await partyLine());
  // 도로 트레이너 — 플레이어처럼 다 싸운다
  const trainers = route.events.filter((e) => /_trainer_\d+$/.test(e.id) && JSON.stringify(e.pages).includes('"battleProcessing"'));
  for (const [k, trainer] of trainers.entries()) {
    const r = await approachAndTalk(route.id, trainer);
    await wildBattlesWhileWalking();
    if (!(await present("dialogue-box")) && !(await present("battle-scene"))) await approachAndTalk(route.id, trainer);
    const started = await pressEnterUntil(() => present("battle-scene"), 30);
    if (started) { await page.waitForTimeout(2500); if (k === 0) await shot("15-trainer-battle"); }
    const log = started ? await fight(`15b-trainer-${k}`) : [];
    const st = await state();
    step(`trainer-${k}`, started && st.battleResult === "victory", `${trainer.id}: ${log.length}턴 → ${st.battleResult} (${r}) · ${await partyLine()}`, k === 0 ? await shot("16-after-trainer") : undefined);
    if (st.battleResult !== "victory") { await pressEnterUntil(async () => !(await present("dialogue-box")), 30); }
  }
  report.wildFights = wildFights;

  // 다음 마을
  const town2 = Object.values(project.maps).find((map) => map.id !== home && route.events.some((e) => JSON.stringify(e.pages).includes(`"mapId":"${map.id}"`)) && map.events.some((e) => /_gym/.test(JSON.stringify(e.pages))));
  if (town2) {
    await go(route.id, town2.id);
    await wildBattlesWhileWalking();
    step("town2", (await here()).currentMapId === town2.id, town2.id, await shot("17-town2"));
  }
  if (town2) { step("heal-town2", await healAt(town2.id), await partyLine()); }
  // 체육관 퍼즐 — 장치에 실제로 말을 걸어 연다
  const gym = Object.values(project.maps).find((map) => /gym/.test(map.id) && map.events.some((e) => /_leader$/.test(e.id)));
  await go(town2?.id ?? home, gym.id);
  await shot("18-gym-entry");
  const devices = gym.events.filter((e) => /_device_/.test(e.id));
  for (const [k, dev] of devices.entries()) {
    const r = await approachAndTalk(gym.id, dev);
    await pressEnterUntil(async () => !(await present("dialogue-box")) && !(await present("runtime-choices")), 30);
    await shot(`19-gym-device-${k}`);
    if (await present("battle-scene")) await fight(`gym-dev-battle-${k}`);
    step(`gym-device-${k}`, r === true, dev.id);
  }
  const puzzleSwitches = [...new Set((JSON.stringify(gym.events) .match(/mx_gym_\d+_puzzle\b/g) ?? []))];
  const st0 = await state();
  step("gym-puzzle", puzzleSwitches.every((s) => st0.switches[s] === true), puzzleSwitches.map((s) => `${s}=${st0.switches[s]}`).join(","), await shot("20-gym-solved"));
  // 수련생 셋 — 플레이어처럼 다 싸운다
  for (const [k, grunt] of gym.events.filter((e) => /_grunt_\d+$/.test(e.id)).entries()) {
    await approachAndTalk(gym.id, grunt);
    const started = await pressEnterUntil(() => present("battle-scene"), 30);
    if (started) { await page.waitForTimeout(2000); if (k === 0) await shot("20b-gym-trainer"); }
    const log = started ? await fight(`gym-grunt-${k}`) : [];
    const st = await state();
    step(`gym-trainer-${k}`, started && st.battleResult === "victory", `${grunt.id}: ${log.length}턴 → ${st.battleResult} · ${await partyLine()}`);
  }
  // 관장 — 회복은 플레이어가 하듯 마을 센터에서
  if (town2) { await go(gym.id, town2.id); await healAt(town2.id); await go(town2.id, gym.id); }
  const leader = findEvent(gym.id, /_leader$/);
  const lead = await live();
  report.levelBeforeLeader = lead.party.map((m) => `${m.speciesId} Lv${m.level}`);
  let talked = false;
  for (const [dx, dy, dir] of [[0, 1, "up"], [0, 2, "up"], [-1, 0, "right"], [1, 0, "left"]]) {
    const at = { x: leader.x + dx, y: leader.y + dy };
    if (!free(gym.id, at.x, at.y)) continue;
    const r = await walkTo(gym.id, at, 200);
    if (r !== "arrived") { try { await teleport(gym.id, at.x, at.y); } catch { continue; } }
    if (await talk(dir)) { talked = true; break; }
  }
  const started = talked && await pressEnterUntil(() => present("battle-scene"), 40);
  if (started) { await page.waitForTimeout(2500); await shot("21-leader-battle"); }
  const log = started ? await fight("21b-leader") : [];
  await waitIdle();
  const afterLeader = await state();
  step("gym-leader", started && afterLeader.battleResult === "victory", `${log.length}턴 → ${afterLeader.battleResult} · badge=${afterLeader.switches.mx_badge_1} · ${report.levelBeforeLeader.join(", ")}`, await shot("22-after-leader"));
  // 지면 회복 센터에서 깨어난다(눈앞이 캄캄 → 센터). 플레이어처럼 그대로 한 번 더 도전해 본다 — 디버그 없이.
  if (afterLeader.switches.mx_badge_1 !== true) {
    await pressEnterUntil(async () => !(await eventRunning()) && !(await present("dialogue-box")), 60);
    if ((await here()).currentMapId !== gym.id) { if (town2 && (await here()).currentMapId === `${town2.id}_center`) await go(`${town2.id}_center`, town2.id); await go(town2?.id ?? home, gym.id); }
    await approachAndTalk(gym.id, leader);
    const again = await pressEnterUntil(() => present("battle-scene"), 40);
    const log2 = again ? await fight("21d-leader-rematch") : [];
    await waitIdle();
    const st2 = await state();
    step("gym-leader-rematch", again && st2.switches.mx_badge_1 === true, `${log2.length}턴 → ${st2.battleResult} · badge=${st2.switches.mx_badge_1} · ${await partyLine()}`);
  }
  if ((await state()).switches.mx_badge_1 !== true) {
    await page.evaluate(() => { const s = window.__oprnHooksScene.session; for (const id of s.monsterParty) { const m = s.monsterInstances[id]; m.level = Math.max(m.level, 16); m.currentHp = undefined; } });
    report.debugWrites.push("관장 패배 뒤 파티 Lv16 으로 재도전");
    await approachAndTalk(gym.id, leader);
    if (await pressEnterUntil(() => present("battle-scene"), 40)) await fight("21c-leader-retry");
    await waitIdle();
  }

  // 엔딩까지 — 관측탑 보스 → 리그
  const tail = [["observatory", /_boss$/], ["league_0", /_champion$|_league|_boss$|_rival/]];
  for (const [key, re] of tail) {
    if ((await present("ending-screen"))) break;
    const map = project.maps[`mx_map_${key}`];
    if (!map) continue;
    const ev = map.events.find((e) => re.test(e.id) && JSON.stringify(e.pages).includes("battleProcessing"));
    if (!ev) continue;
    if (town2) await healAt(town2.id);
    await go(town2?.id ?? home, map.id);
    report.partyBefore = { ...(report.partyBefore ?? {}), [key]: await partyLine() };
    await shot(`23-${key}`);
    await approachAndTalk(map.id, ev);
    const st = await pressEnterUntil(() => present("battle-scene") || present("ending-screen"), 40);
    const fought = Boolean(st && await present("battle-scene"));
    if (fought) { await page.waitForTimeout(2000); await shot(`24-${key}-battle`); await fight(`24b-${key}`); }
    await waitIdle();
    // 싸우지 않았으면 battleResult 는 앞 전투 값이 남아 있다 — 전투가 실제로 열렸을 때만 결과로 친다.
    const res = fought ? (await state()).battleResult : "no-battle";
    step(`boss-${key}-result`, res === "victory", `${res} · ${await partyLine()}`);
    let res2 = res;
    if (res !== "victory") {
      // 진 경우: 센터에서 깨어나 그대로 한 번 더(플레이어처럼).
      await pressEnterUntil(async () => !(await eventRunning()) && !(await present("dialogue-box")), 60);
      await approachAndTalk(map.id, ev);
      if (await pressEnterUntil(() => present("battle-scene"), 40)) await fight(`24d-${key}-rematch`);
      res2 = (await state()).battleResult;
      step(`boss-${key}-rematch`, res2 === "victory", `${res2} · ${await partyLine()}`);
    }
    if (res2 !== "victory") {
      // 또 진 경우: 기록만 남기고, 엔딩 화면까지 보려고 레벨을 올려 다시 도전한다(디버그 쓰기로 적는다).
      await waitIdle();
      await page.evaluate(() => { const s = window.__oprnHooksScene.session; for (const id of s.monsterParty) { const m = s.monsterInstances[id]; m.level = Math.max(m.level, 20); m.currentHp = undefined; } });
      report.debugWrites.push(`${key}: 패배 뒤 파티 Lv20 으로 재도전`);
      if (town2) await go((await here()).currentMapId, map.id).catch(() => {});
      await approachAndTalk(map.id, ev);
      if (await pressEnterUntil(() => present("battle-scene"), 40)) await fight(`24c-${key}-retry`);
    }
    for (let i = 0; i < 40 && !(await present("ending-screen")); i++) {
      if (!(await present("dialogue-box"))) break;
      await page.keyboard.press("Enter"); await page.waitForTimeout(300);
    }
    step(`boss-${key}`, true, ev.id, await shot(`25-after-${key}`));
  }
  // 전당 등록 연출(보석·빛)은 대사 없이 길게 돈다 — 90초까지 기다린다.
  for (let i = 0; i < 220 && !(await present("ending-screen")); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(400); }
  const ending = await present("ending-screen");
  if (ending) { await page.waitForTimeout(3000); await shot("26-ending"); for (let i = 0; i < 4; i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(2500); await shot(`27-ending-${i}`); } }
  step("ending", ending, ending ? "ending-screen" : "엔딩 못 봄");
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
  await page.screenshot({ path: join(out, "failure.png") }).catch(() => {});
} finally {
  report.dialogue = await page.evaluate(() => window.__astraLines ?? []).catch(() => []);
  report.battleLines = await page.evaluate(() => window.__journeyBattleWatch?.lines ?? []).catch(() => []);
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  const lines = [`# 아스트라 여정`, "", ...report.steps.map((s) => `- ${s.ok ? "✓" : "✗"} ${s.id}: ${s.detail ?? ""}`), "", `디버그 쓰기: ${report.debugWrites.join(" · ")}`, `걷기 실패: ${(report.walkFailures ?? []).join(" · ")}`, "", `오류: ${report.errors.length}`, ...report.errors.slice(0, 10).map((e) => `- ${e.slice(0, 300)}`)];
  await writeFile(join(out, "SUMMARY.md"), lines.join("\n"));
  await browser.close();
  await server.close();
}
