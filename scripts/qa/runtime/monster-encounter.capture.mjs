// 야생 조우 연출 + 필드 도구 QA — 출하 플레이어(player.html)에서 풀밭 걸음 → 조우 전환(영상 프레임) → 「야생의 …」 문장 →
// 도망 → 무적 걸음 → 벌레퇴치(가방) → 탈출 로프(동굴 안/밖) → 낚시(낚싯대·물가)를 실제 입력으로 찍는다.
//
//   unshare -rn sh -c "ip link set lo up && node scripts/qa/runtime/monster-encounter.capture.mjs <campaign.json> <outDir>"
// 캠페인: `bun src/harnesses/assistant-capability/node/buildMonsterFixture.ts <out.json>` (모델 없이).
// 디버그 쓰기(report.debugWrites): 파티 몬스터 한 마리 주입, 시험 맵의 encounterRate 를 1000 으로(= 걸음마다 조우 — 무적·벌레퇴치가 아니면
// 다음 걸음에 반드시 전투가 열린다는 대조), 맵 사이 순간이동, 벌레퇴치 남은 걸음을 2 로 줄이기(끝 문장 확인용).
// 진단 전용 — 저장소 콘텐츠를 바꾸지 않는다. 게이트·vitest 아님.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: monster-encounter.capture.mjs <project.json> <outDir>");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/monster-encounter");
const project = JSON.parse(await readFile(resolve(projectArg), "utf8"));
const out = resolve(outArg ?? "qa-runs/monster-encounter");
await mkdir(out, { recursive: true });
const report = { steps: [], errors: [], debugWrites: ["party monster injected (coalbit Lv12) with 4 moves", "route map encounterRate forced 1000 (every step meets a wild unless guarded)", "teleport between maps", "switch mx_starter on (wild table condition)", "repelSteps reduced to 2 for the expiry sentence"] };
const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier"] });
const context = await browser.newContext({ viewport: { width: 960, height: 720 }, recordVideo: { dir: join(out, "raw-video"), size: { width: 960, height: 720 } } });
const page = await context.newPage();
const videoOrigin = Date.now();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
page.on("console", (m) => { if (m.type() === "error") report.errors.push("console: " + m.text()); });
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:monster-encounter", qaInstrumentation: true };
});
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(project) }));
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const step = (id, ok, detail) => { report.steps.push({ id, ok, detail }); console.log(ok ? "✓" : "✗", id, detail); };
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });
const live = () => page.evaluate(() => { const s = window.__oprnHooksScene.session; return { map: s.currentMapId, x: s.x, y: s.y, guard: s.encounterGuard ?? null, inv: s.inventory, gold: s.gold }; });
const lines = () => page.evaluate(() => [...document.querySelectorAll(".battle-message-lines, [data-testid='dialogue-box']")].filter((n) => n.getClientRects().length > 0).map((n) => (n.textContent ?? "").replace(/\s+/g, " ").trim()).filter(Boolean));
const dialogueText = () => page.evaluate(() => [...document.querySelectorAll("[data-testid='dialogue-box']")].map((n) => (n.textContent ?? "").trim()).join(" | "));
const teleport = async (mapId, x, y) => {
  await page.evaluate(([m, tx, ty]) => window.__oprnDebug.teleport(m, tx, ty), [mapId, x, y]);
  await page.waitForFunction(([m, tx, ty]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === m && Math.abs(s.x - tx) <= 2 && Math.abs(s.y - ty) <= 2; }, [mapId, x, y], { timeout: 20000 });
  await page.waitForTimeout(900);
};
const forceRate = (rate) => page.evaluate((r) => { window.__oprnHooksScene.map.encounterRate = r; }, rate);
const walkOnce = async (dir) => {
  // 정확히 한 칸: 입력을 누르고 떼는 방식은 부하에서 두세 칸을 간다 → 디버그 훅의 한 걸음 경로(playerRoute)를 쓴다.
  const before = await live();
  await page.evaluate((d) => window.__oprnDebug.playerRoute([{ kind: "move", dir: d }]), dir);
  for (let t = 0; t < 240; t++) { await page.waitForTimeout(25); const now = await live(); if (now.x !== before.x || now.y !== before.y || now.map !== before.map) break; if (await present("battle-scene")) break; }
  for (let t = 0, last = ""; t < 14; t++) { await page.waitForTimeout(110); const now = await live(); const key = `${now.x},${now.y}`; if (key === last) break; last = key; }
};
const closeDialogues = async (max = 40) => { for (let i = 0; i < max; i++) { if (!(await present("dialogue-box"))) { await page.waitForTimeout(250); if (!(await present("dialogue-box"))) return; } await page.keyboard.press("Enter"); await page.waitForTimeout(250); } };
const waitCmd = () => page.waitForFunction(() => { const r = document.querySelector('[data-testid="battle-scene"]'); return r?.dataset.battleDirectorStep === "command" && r.dataset.battleSequenceBusy === "false"; }, undefined, { timeout: 60000 }).then(() => true, () => false);
async function focusEntry(loc) {
  for (let i = 0; i < 60; i++) {
    const cls = (await loc.getAttribute("class")) ?? ""; const sel = await loc.getAttribute("aria-selected"); const cur = await loc.getAttribute("aria-current");
    if (cls.includes("selected") || cls.includes("active") || sel === "true" || cur === "true") return;
    await page.keyboard.press("ArrowDown"); await page.waitForTimeout(70);
  }
}
async function openBag() {
  await closeMenu();
  await page.keyboard.press("Escape");
  await page.waitForSelector("[data-testid^='status-menu-command-']", { timeout: 20000 });
  const rail = page.locator("[data-testid='status-menu-command-items']");
  for (let i = 0; i < 20; i++) { if ((await rail.first().getAttribute("class"))?.includes("selected")) break; await page.keyboard.press("ArrowDown"); await page.waitForTimeout(70); }
  await page.keyboard.press("Enter"); await page.waitForTimeout(600);
}
async function closeMenu() { for (let i = 0; i < 5; i++) { if (!(await present("main-menu"))) return; await page.keyboard.press("Escape"); await page.waitForTimeout(300); } }

// 풀밭 조우 칸 하나(1번길 서식지 안 이벤트 없는 칸) — 영상에서 걸어 다닐 자리.
const route = project.maps.mx_map_meadow;
const habitat = (route.locations ?? []).find((l) => route.encounterTable.some((e) => e.conditions?.locationId === l.id));
const free = (x, y) => !route.events.some((e) => Math.abs(e.x - x) <= 2 && Math.abs(e.y - y) <= 2); // 이벤트(트레이너 시야·말 걸기)에서 두 칸 이상 떨어진 칸
const meadowTiles = project.tilesets[route.tilesetId];
const isGrass = (x, y) => { const i = y * route.width + x; return meadowTiles.tileMeta?.[route.lowerTiles[i]]?.terrainTag === 5 || meadowTiles.tileMeta?.[route.upperTiles[i]]?.terrainTag === 5; };
const blocksTile = (tileset, tile) => { if (tile === undefined || tile < 0) return false; const p = tileset?.passability?.[tile]; return p && typeof p === "object" && !p.up && !p.down && !p.left && !p.right; };
const cx = habitat.x + habitat.w / 2, cy = habitat.y + habitat.h / 2;
const cells = [];
for (let y = habitat.y; y < habitat.y + habitat.h; y++) for (let x = habitat.x + 1; x < habitat.x + habitat.w - 2; x++) if ([-1, 0, 1, 2].every((d) => free(x + d, y) && isGrass(x + d, y))) cells.push({ x, y });
cells.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));

try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 180000 });
  for (let i = 0; i < 80; i++) { if (!(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen"))) { await page.waitForTimeout(500); if (!(await present("dialogue-box"))) break; } await page.keyboard.press("Enter"); await page.waitForTimeout(250); }
  const moves = ["mx_skill_normal_1", "mx_skill_normal_2", "mx_skill_normal_3", "mx_skill_poison_6"];
  await page.evaluate((moves) => {
    const s = window.__oprnHooksScene.session; const id = "qa_mon_1";
    s.monsterInstances = { ...(s.monsterInstances ?? {}), [id]: { instanceId: id, speciesId: "mx_species_coalbit", level: 12, exp: 0, skillIds: moves, skillPp: Object.fromEntries(moves.map((m) => [m, 30])), friendship: 70, caughtAt: { mapId: s.currentMapId, x: 1, y: 1 } } };
    s.monsterParty = [id];
    window.__oprnDebug.setSwitch("mx_starter", true); // 야생 조우표 조건(스타터를 받은 뒤)
    s.inventory = { ...(s.inventory ?? {}), mx_repel: 2, mx_escape_rope: 2, mx_repel_strong: 1 };
  }, moves);

  // ── A. 풀밭 걸음 → 조우 전환 ──
  await closeDialogues(80);
  let cell = null;
  for (const c of cells.slice(0, 30)) {
    await closeDialogues(10);
    await teleport("mx_map_meadow", c.x, c.y);
    await forceRate(0);
    await walkOnce("right"); const r = await live();
    if (r.x === c.x + 1) { await walkOnce("left"); cell = c; break; }
    console.log("cell-probe", JSON.stringify({ c, r: { x: r.x, y: r.y } }));
  }
  step("grass-cell", !!cell, JSON.stringify(cell));
  await teleport("mx_map_meadow", cell.x, cell.y);
  await forceRate(1000); // 순간이동이 맵을 다시 올리므로 이동 뒤에 올린다
  await shot("A1-field-grass");
  const encounterMark = { at: 0 };
  const watch = page.waitForSelector('[data-testid="battle-transition-overlay"]', { state: "attached", timeout: 15000 }).then(() => { encounterMark.at = Date.now() - videoOrigin; }, () => {});
  await page.evaluate((d) => window.__oprnInput.dir(d), "right");
  await watch;
  await page.evaluate(() => window.__oprnInput.dir(null));
  if (encounterMark.at === 0) {
    const diag = await page.evaluate(() => { const sc = window.__oprnHooksScene; return { rate: sc.map.encounterRate, mapId: sc.map.id, running: sc.running, input: sc.inputEnabled, tx: sc.tileX, ty: sc.tileY, table: sc.map.encounterTable?.length, party: sc.session.monsterParty, battle: !!document.querySelector('[data-testid="battle-scene"]') }; });
    console.log("DIAG", JSON.stringify(diag));
  }
  step("transition-overlay", encounterMark.at > 0, `video t=${encounterMark.at}ms`);
  // 문장까지 — 「야생의 …이(가) 나타났다!」가 뜨는 순간을 낚는다.
  let introShot = false, introLine = "";
  for (let t = 0; t < 60 && !introShot; t++) {
    const l = await lines();
    const hit = l.find((x) => /나타났다/.test(x));
    if (hit) { introLine = hit; await shot("B1-wild-intro"); await page.waitForTimeout(900); await shot("B1b-wild-intro-complete"); introShot = true; break; }
    await page.waitForTimeout(120);
  }
  step("wild-intro-sentence", introShot && /야생의/.test(introLine), introLine);
  await waitCmd();
  await shot("B2-command-prompt");

  // ── C. 도망 → 무적 걸음 ──
  // 도망은 확률이다 — 성공할 때까지 「도망간다」를 다시 고른다(최대 8번).
  for (let attempt = 0; attempt < 8 && (await present("battle-scene")); attempt++) {
    if (!(await waitCmd())) break;
    await page.locator('[data-testid="actor-command-run"]').focus(); await page.keyboard.press("Enter");
    for (let t = 0; t < 30 && (await present("battle-scene")); t++) {
      await page.waitForTimeout(300);
      if (await present("dialogue-box")) await page.keyboard.press("Enter");
      const st = await page.evaluate(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep ?? "");
      if (st === "command" && attempt >= 0 && t > 3) break;
    }
  }
  await page.waitForTimeout(1200);
  await closeDialogues();
  const afterRun = await live();
  step("escaped", !(await present("battle-scene")) && afterRun.guard?.graceSteps >= 1, JSON.stringify(afterRun.guard));
  await shot("C1-after-escape-field");
  const grace = afterRun.guard?.graceSteps ?? 0;
  let battleDuringGrace = false; const graceTrace = [];
  const dirs = ["left", "right"];
  for (let i = 0; i < grace; i++) {
    await walkOnce(dirs[i % 2]);
    const now = await live(); const inBattle = await present("battle-scene");
    graceTrace.push(`step ${i + 1}: (${now.x},${now.y}) guard=${JSON.stringify(now.guard)} battle=${inBattle}`);
    if (inBattle) battleDuringGrace = true;
    if (i === Math.max(0, grace - 2)) await shot("C2-grace-walking");
  }
  step("no-encounter-during-grace", !battleDuringGrace, graceTrace.join(" / "));
  await shot("C3-grace-last-step");
  // 무적이 끝난 다음 걸음은 (조우율 1000 이므로) 곧바로 전투가 열린다.
  await walkOnce(dirs[grace % 2]);
  const next = await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 6000 }).then(() => true, () => false);
  step("encounter-resumes-after-grace", next, `next step -> battle=${next}`);
  await shot("C4-encounter-after-grace");
  if (next) { await waitCmd(); await page.locator('[data-testid="actor-command-run"]').focus(); await page.keyboard.press("Enter"); for (let t = 0; t < 40 && (await present("battle-scene")); t++) { await page.waitForTimeout(300); if (await present("dialogue-box")) await page.keyboard.press("Enter"); } await closeDialogues(); }
  // 도망 무적 소진시키기(다음 장면이 깨끗하게)
  await page.evaluate(() => { const s = window.__oprnHooksScene.session; delete s.encounterGuard; });

  // ── D. 벌레퇴치 ──
  await forceRate(1000);
  await openBag();
  await shot("D1-bag-with-repel");
  const repel = page.locator("[data-testid='status-menu-item-mx_repel']");
  step("repel-listed", (await repel.count()) > 0, `entries=${await repel.count()}`);
  await focusEntry(repel.first()); await page.keyboard.press("Enter"); await page.waitForTimeout(600);
  await shot("D2-repel-detail");
  await page.keyboard.press("Enter"); // 「사용」
  await page.waitForTimeout(700);
  await shot("D2b-used-sentence"); // 사용 문장(대화창)이 뜬 순간
  // 쓴 문장은 가방 화면 아래 안내줄에 뜬다(일반 아이템 사용과 같은 길).
  const footer = () => page.evaluate(() => (document.querySelector("[data-testid='main-menu']")?.textContent ?? "").replace(/\s+/g, " "));
  let usedSentence = ""; for (let t = 0; t < 30 && !/뿌렸다/.test(usedSentence); t++) { usedSentence = await footer(); await page.waitForTimeout(150); }
  await shot("D2c-used-sentence-complete");
  step("repel-used-sentence", /뿌렸다! 앞으로 100걸음/.test(usedSentence), (usedSentence.match(/별빛 스프레이를 뿌렸다.*$/) ?? [""])[0]);
  const menuMessage = await page.evaluate(() => (document.querySelector("[data-testid='main-menu']")?.textContent ?? "").replace(/\s+/g, " ").slice(0, 400));
  const usedGuard = (await live()).guard;
  step("repel-used", usedGuard?.repelSteps === 100, `${JSON.stringify(usedGuard)} menu="${menuMessage.slice(0, 160)}"`);
  // 두 번째 쓰기 → 「아직 효과가 남아 있다」
  await openBag();
  const again = page.locator("[data-testid='status-menu-item-mx_repel']");
  if (await again.count()) { await focusEntry(again.first()); await page.keyboard.press("Enter"); await page.waitForTimeout(500); await page.keyboard.press("Enter"); await page.waitForTimeout(600); await shot("D3-repel-already-active"); }
  await closeMenu();
  let repelBattle = false; const repelTrace = [];
  for (let i = 0; i < 6; i++) { await walkOnce(dirs[i % 2]); const inBattle = await present("battle-scene"); repelTrace.push(inBattle); if (inBattle) repelBattle = true; }
  const mid = await live();
  step("no-encounter-while-repelled", !repelBattle && mid.guard?.repelSteps <= 94, `battles=${JSON.stringify(repelTrace)} guard=${JSON.stringify(mid.guard)}`);
  await shot("D4-walking-repelled");
  await openBag(); await shot("D5-bag-repel-remaining"); await closeMenu();
  // 끝 문장 — 남은 걸음을 2 로 줄여 걸어 본다.
  await page.evaluate(() => { const s = window.__oprnHooksScene.session; s.encounterGuard = { ...(s.encounterGuard ?? {}), repelSteps: 2 }; });
  await walkOnce("left"); await walkOnce("right");
  let expiry = ""; for (let t = 0; t < 40 && !/사라졌다/.test(expiry); t++) { expiry = await dialogueText(); await page.waitForTimeout(150); }
  await shot("D6-repel-expired");
  step("repel-expiry-sentence", /효과가 사라졌다/.test(expiry), expiry);
  await closeDialogues();
  const afterExpiry = await live();
  await walkOnce("left");
  const resumed = await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 6000 }).then(() => true, () => false);
  step("encounter-after-repel-expired", resumed && !afterExpiry.guard, `battle=${resumed} guard=${JSON.stringify(afterExpiry.guard)}`);
  await shot("D7-encounter-after-repel");
  if (resumed) { await waitCmd(); await page.locator('[data-testid="actor-command-run"]').focus(); await page.keyboard.press("Enter"); for (let t = 0; t < 40 && (await present("battle-scene")); t++) { await page.waitForTimeout(300); if (await present("dialogue-box")) await page.keyboard.press("Enter"); } await closeDialogues(); }
  await page.evaluate(() => { const s = window.__oprnHooksScene.session; delete s.encounterGuard; });
  await forceRate(0);

  // ── E. 탈출 로프 ──
  const home = project.startMapId;
  const dungeonId = "mx_map_cave";
  const dungeon = project.maps[dungeonId];
  const standing = await live();
  await teleport(home, project.startPos.x, project.startPos.y);
  await openBag();
  const rope = page.locator("[data-testid='status-menu-item-mx_escape_rope']");
  await focusEntry(rope.first()); await page.keyboard.press("Enter"); await page.waitForTimeout(600);
  await page.keyboard.press("Enter"); await page.waitForTimeout(600); // 행동 화면의 「사용」
  await shot("E1-rope-outside-no-effect");
  const outsideMsg = await page.evaluate(() => (document.querySelector("[data-testid='main-menu']")?.textContent ?? "").replace(/\s+/g, " "));
  step("rope-outside-no-effect", /효과가 없습니다/.test(outsideMsg) && (await live()).inv.mx_escape_rope === 2, `inv=${(await live()).inv.mx_escape_rope}`);
  await closeMenu();
  // 동굴 입구(마을 바깥 한 칸) → 동굴 안
  const outerBefore = await live();
  await teleport(dungeonId, Math.min(dungeon.width - 2, 4), Math.min(dungeon.height - 2, dungeon.height - 3));
  const inside = await live();
  step("entrance-recorded", inside.guard?.entrance?.mapId === home, JSON.stringify(inside.guard));
  await shot("E2-inside-dungeon");
  await openBag();
  const rope2 = page.locator("[data-testid='status-menu-item-mx_escape_rope']");
  await focusEntry(rope2.first()); await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  await page.keyboard.press("Enter"); // 행동 화면의 「사용」
  await page.waitForTimeout(700);
  await shot("E3-rope-used-sentence");
  let sentence = ""; for (let t = 0; t < 40 && !/빠져나왔다/.test(sentence); t++) { sentence = await dialogueText(); await page.waitForTimeout(150); }
  await shot("E3b-rope-sentence-complete");
  step("rope-sentence", /빠져나왔다/.test(sentence), sentence);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  await closeDialogues();
  const outside = await live();
  step("rope-escaped", outside.map === home && (outside.inv.mx_escape_rope ?? 0) === 1, `${outside.map} (${outside.x},${outside.y}) rope=${outside.inv.mx_escape_rope} guard=${JSON.stringify(outside.guard)}`);
  await shot("E4-after-rope-outside");

  // ── F. 낚시 ──
  const spot = project.system.fishing.spots[0];
  const pondMap = project.maps[spot.mapId];
  const angler = pondMap.events.find((e) => /angler$/.test(e.id));
  step("fishing-config", !!spot && !!angler, `spot=${spot.mapId} ${JSON.stringify(spot.area)} angler=(${angler?.x},${angler?.y})`);
  // 낚시꾼 옆에 서서 조사 → 낚싯대
  const beside = [[0, 1, "up"], [-1, 0, "right"], [1, 0, "left"], [0, -1, "down"]].map(([dx, dy, dir]) => ({ x: angler.x + dx, y: angler.y + dy, dir })).find((p) => !pondMap.events.some((e) => e.x === p.x && e.y === p.y));
  await teleport(spot.mapId, beside.x, beside.y);
  await shot("F1-angler-field");
  for (let a = 0; a < 6; a++) { await page.evaluate((d) => window.__oprnInput.face(d), beside.dir); await page.evaluate(() => window.__oprnInput.action()); await page.waitForTimeout(700); if (await present("dialogue-box")) break; }
  await shot("F2-angler-dialogue");
  await closeDialogues();
  const gotRod = (await live()).inv.mx_fishing_rod;
  step("rod-given", gotRod === 1, `rod=${gotRod}`);
  // 물가: 낚시 구역 둘레에서 걸어 설 수 있고 물을 바라보는 칸을 찾는다.
  const pondTiles = project.tilesets[pondMap.tilesetId];
  const standable = (x, y) => x >= 0 && y >= 0 && x < pondMap.width && y < pondMap.height && !pondMap.events.some((e) => e.x === x && e.y === y)
    && !blocksTile(pondTiles, pondMap.lowerTiles[y * pondMap.width + x]) && !blocksTile(pondTiles, pondMap.upperTiles[y * pondMap.width + x]);
  const shores = [];
  for (let y = spot.area.y; y < spot.area.y + spot.area.h; y++) { shores.push({ x: spot.area.x - 1, y, face: "right" }, { x: spot.area.x + spot.area.w, y, face: "left" }); }
  for (let x = spot.area.x; x < spot.area.x + spot.area.w; x++) { shores.push({ x, y: spot.area.y - 1, face: "down" }, { x, y: spot.area.y + spot.area.h, face: "up" }); }
  const shore = shores.filter((p) => standable(p.x, p.y)).sort((a, b) => Math.hypot(a.x - angler.x, a.y - angler.y) - Math.hypot(b.x - angler.x, b.y - angler.y))[0];
  report.shore = shore;
  await teleport(spot.mapId, shore.x, shore.y);
  await shot("F3-at-shore");
  let fished = false;
  for (let a = 0; a < 8 && !fished; a++) { await page.evaluate((d) => window.__oprnInput.face(d), shore.face); await page.evaluate(() => window.__oprnInput.action()); await page.waitForTimeout(900); fished = await present("battle-scene"); }
  const fishLines = fished ? await (async () => { for (let t = 0; t < 40; t++) { const l = await lines(); const hit = l.find((x) => /나타났다/.test(x)); if (hit) return hit; await page.waitForTimeout(120); } return ""; })() : "";
  step("fishing-encounter", fished, fishLines);
  await page.waitForTimeout(1500);
  await shot("F4-fishing-wild-intro");
  report.encounterMark = encounterMark;
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
  await page.screenshot({ path: join(out, "error.png") }).catch(() => {});
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
  const video = page.video();
  await context.close();
  try {
    const path = await video.path();
    report.video = path;
    if (report.encounterMark?.at) {
      const start = Math.max(0, report.encounterMark.at / 1000 - 0.4);
      execFileSync("ffmpeg", ["-y", "-ss", String(start), "-t", "2.6", "-i", path, "-vf", "fps=12", join(out, "T-%02d.png")], { stdio: "ignore" });
    }
  } catch (error) { report.errors.push("video: " + String(error?.message ?? error)); }
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
  await browser.close();
  await server.close();
}
console.log(report.errors.length ? "ERRORS:\n" + report.errors.join("\n") : "no page errors");
