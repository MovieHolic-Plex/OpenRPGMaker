// 몬스터 디자인 v2 — 하네스 몬스터 그림이 출하 플레이어(player.html + export shim)의 포켓몬 전투 화면에서 어떻게 보이는지 원본 해상도(960x720)로 찍는다.
//   unshare -rn sh -c "ip link set lo up && node scripts/qa/runtime/monster-design-battle.capture.mjs <campaign.json> <outDir> [pairs]"
// 캠페인: `bun src/harnesses/assistant-capability/node/buildMonsterFixture.ts <out.json>` (모델 없이).
// pairs(선택): 「내몬스터:상대,내몬스터:상대」 하네스 종 id. 생략하면 15종이 한 번씩 내 몬스터(뒷모습)와 상대(앞모습)가 되도록 짝짓는다.
// 진단 전용 — 저장소 콘텐츠를 바꾸지 않는다. 디버그 쓰기: 파티에 몬스터를 직접 넣고 야생 troop 을 상대 하나로 바꾼다(report.debugWrites).
// 산출: <out>/<내>-vs-<상대>.png (전체), report.json (그림 요소 화면 상자·표시 배율 = 가로 화면 px / 112).
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg, pairsArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: monster-design-battle.capture.mjs <project.json> <outDir> [a:b,c:d]");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/monster-design-battle");
const project = JSON.parse(await readFile(resolve(projectArg), "utf8"));
const seed = JSON.parse(await readFile(resolve("harness-data/monster-collect-species/seed.json"), "utf8"));
const ids = seed.species.map((s) => s.id);
const campaignOf = Object.fromEntries(seed.species.map((s) => [s.id, s.campaignSpeciesId]));
const enemyOf = {};
for (const e of project.database.enemies) {
  const m = /^harness-monster-([a-z0-9-]+)-front$/.exec(e.monsterResourceId ?? "");
  if (m && !enemyOf[m[1]] && e.id.startsWith("mx_enemy_") && !/_(wild|gym|rival|trainer|leader)/.test(e.id)) enemyOf[m[1]] = e.id;
}
const pairs = pairsArg
  ? pairsArg.split(",").map((p) => p.split(":"))
  : ids.map((id, i) => [id, ids[(i + 7) % ids.length]]);
const baseTroop = project.database.troops.find((t) => t.id === "mx_troop_mx_map_meadow_wild_0");
// 상대는 오래 버티게(전투가 끝나지 않고 명령 입력에서 멈춘다)
for (const e of project.database.enemies) if (Object.values(enemyOf).includes(e.id)) e.stats = { ...e.stats, maxHp: 500, attack: 1, defense: 40, mind: 40, agility: 1 };
for (const id of ids) {
  const troopId = `qa_troop_${id}`;
  project.database.troops.push({ ...structuredClone(baseTroop), id: troopId, name: troopId, members: [{ ...baseTroop.members[0], enemyId: enemyOf[id] }] });
}
const out = resolve(outArg ?? "qa-runs/monster-design-battle");
await mkdir(out, { recursive: true });
const report = { debugWrites: ["party monster injected per pair", "wild troop replaced by qa_troop_<species> (HP 500, attack 1)"], shots: [], errors: [] };
const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier"] });
// VP=480x320 같은 창 크기와 DSF 로 출하 원본 해상도도 잰다(기본 960x720).
const [VW, VH] = (process.env.VP ?? "960x720").split("x").map(Number);
const page = await (await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: Number(process.env.DSF ?? 1) })).newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:monster-design-battle", qaInstrumentation: true };
});
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(project) }));
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const waitCmd = () => page.waitForFunction(() => { const r = document.querySelector('[data-testid="battle-scene"]'); return r?.dataset.battleDirectorStep === "command" && r.dataset.battleSequenceBusy === "false"; }, undefined, { timeout: 90000 }).then(() => true, () => false);
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 240000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 240000 });
  for (let i = 0; i < 60; i++) { if (!(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen"))) break; await page.keyboard.press("Enter"); await page.waitForTimeout(250); }
  for (const [mine, foe] of pairs) {
    const species = campaignOf[mine];
    await page.evaluate(({ species }) => {
      const s = window.__oprnHooksScene.session;
      const id = "qa_mon_" + species;
      s.monsterInstances = { ...(s.monsterInstances ?? {}), [id]: { instanceId: id, speciesId: species, level: 30, exp: 0, skillIds: ["mx_skill_normal_1"], skillPp: { mx_skill_normal_1: 30 }, friendship: 70, caughtAt: { mapId: s.currentMapId, x: 1, y: 1 } } };
      s.monsterParty = [id];
    }, { species });
    await page.evaluate((troopId) => { void window.__oprnHooksScene.playBattle({ kind: "battleProcessing", troopId, canEscape: true, canLose: true }); }, `qa_troop_${foe}`);
    await page.getByTestId("battle-scene").waitFor({ timeout: 90000 });
    const ok = await waitCmd();
    await page.waitForTimeout(1200);
    const file = `${mine}-vs-${foe}.png`;
    await page.screenshot({ path: join(out, file) });
    const boxes = await page.evaluate(() => {
      const found = [];
      for (const node of document.querySelectorAll("*")) {
        const bg = getComputedStyle(node).backgroundImage;
        const src = node instanceof HTMLImageElement ? node.currentSrc : "";
        const url = `${bg} ${src}`;
        const m = /monster-collect-species\/([a-z0-9-]+)\/(?:anim\/)?(front|back)/.exec(url);
        if (!m) continue;
        const r = node.getBoundingClientRect();
        if (r.width < 8) continue;
        found.push({ species: m[1], side: m[2], x: r.x, y: r.y, w: r.width, h: r.height, scale: r.width / (url.includes("-idle") ? 112 : 112) });
      }
      return found;
    });
    report.shots.push({ file, mine, foe, commandReached: ok, boxes });
    console.log(ok ? "ok" : "no-command", file, JSON.stringify(boxes.map((b) => `${b.species}/${b.side} ${Math.round(b.w)}x${Math.round(b.h)}`)));
    // 전투 끝내기: 도망
    for (let i = 0; i < 8 && (await present("battle-scene")); i++) {
      if (await present("actor-command-run")) { await page.locator('[data-testid="actor-command-run"]').focus(); await page.keyboard.press("Enter"); }
      await page.waitForTimeout(700);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(500);
  }
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
  await page.screenshot({ path: join(out, "error.png") }).catch(() => {});
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
  await browser.close();
  await server.close();
}
console.log(report.errors.length ? "ERRORS:\n" + report.errors.join("\n") : "no page errors");
