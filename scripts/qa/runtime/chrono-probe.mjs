// Chrono runtime probe — non-screenshot evidence from the shipped player (player.html).
// Reads engine hooks directly: followers, session party/followers, battle tech list, cutscene command outcome.
// Usage: node scripts/qa/runtime/chrono-probe.mjs <project.json> <out.json>
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectPath, outPath] = process.argv.slice(2);
const projectJson = readFileSync(projectPath, "utf8");
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const out = { probes: {}, errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  page.on("pageerror", (e) => out.errors.push(`pageerror: ${e.message}`));
  await page.addInitScript(([url]) => {
    try { localStorage.clear(); } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl: url, saveNamespace: "chrono-probe", qaInstrumentation: true };
  }, ["/__probe/project.json"]);
  await page.route("**/__probe/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  const press = async (key, n = 1) => { for (let i = 0; i < n; i += 1) { await page.keyboard.press(key); await page.waitForTimeout(120); } };
  const state = () => page.evaluate(() => {
    const d = window.__oprnDebug?.readState?.() ?? null;
    const s = window.__oprnCharacterSprites?.() ?? null;
    const scene = window.__oprnHooksScene;
    const session = scene?.session;
    return {
      mapId: d?.currentMapId, x: d?.x, y: d?.y,
      followerSprites: s ? Object.keys(s.followers ?? {}).length : null,
      followerPositions: s?.followers ?? null,
      sessionFollowers: session?.followers ? structuredClone(session.followers) : null,
      party: session?.partyActorIds ?? null,
      hp: session?.actorVitals ? Object.fromEntries(Object.entries(session.actorVitals).map(([k, v]) => [k, v?.hp])) : null,
      switches: session?.switches ? Object.keys(session.switches).filter((k) => session.switches[k]) : null,
    };
  });
  // New game → through opening → map.
  await press("Enter");
  for (let i = 0; i < 10 && await page.locator("[data-testid='cinematic-sequence']").count(); i += 1) await press("Enter");
  await page.waitForFunction(() => !!window.__oprnDebug?.readState?.()?.currentMapId, null, { timeout: 60_000 });
  for (let i = 0; i < 14 && await page.locator("[data-testid='dialogue-box']").count(); i += 1) await press("z");
  out.probes.afterBoot = await state();

  // Followers: walk a few steps; autorun join events are in the top-left corner of the town.
  await page.evaluate(() => window.__oprnDebug.teleport("map_era_present", 4, 4));
  await page.waitForTimeout(800);
  for (let i = 0; i < 6 && await page.locator("[data-testid='dialogue-box']").count(); i += 1) await press("z");
  for (const dir of ["ArrowRight", "ArrowRight", "ArrowDown", "ArrowDown"]) { await page.keyboard.down(dir); await page.waitForTimeout(260); await page.keyboard.up(dir); }
  await page.waitForTimeout(500);
  out.probes.followersAfterWalk = await state();
  await page.screenshot({ path: outPath.replace(/\.json$/, "-followers.png") });

  // Save point heal: damage party, interact with save point in cave.
  await page.evaluate(() => { for (const id of window.__oprnHooksScene.session.partyActorIds) window.__oprnSetActorVitals?.(id, 5, 0); });
  const cave = JSON.parse(projectJson).maps.map_cave;
  const save = cave?.events?.find((e) => /save|세이브/i.test(`${e.id} ${e.name}`));
  out.probes.savepointEvent = save ? { id: save.id, x: save.x, y: save.y } : null;
  if (save) {
    await page.evaluate(([x, y]) => window.__oprnDebug.teleport("map_cave", x, y + 1), [save.x, save.y]);
    await page.waitForTimeout(900);
    await page.evaluate(() => window.__oprnInput.face("up"));
    const before = await state();
    await page.evaluate(() => window.__oprnInput.action());
    await page.waitForTimeout(600);
    const dialogs = await page.locator("[data-testid='dialogue-box'], [data-testid='save-panel'], [data-testid^='save']").count();
    for (let i = 0; i < 6 && await page.locator("[data-testid='dialogue-box']").count(); i += 1) await press("z");
    await press("Escape");
    out.probes.savepoint = { hpBefore: before.hp, hpAfter: (await state()).hp, uiShown: dialogs };
  }

  // Battle: tech list. Back in town, face the field enemy (start pair) and fight.
  const project = JSON.parse(projectJson);
  await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, x, y), [project.startMapId, project.startPos.x, project.startPos.y]);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__oprnInput.face("up"));
  await page.evaluate(() => window.__oprnInput.action());
  for (let i = 0; i < 16 && !(await page.locator("[data-testid='battle-scene']").count()); i += 1) await press("z");
  await page.waitForSelector("[data-testid='actor-command-attack']", { timeout: 40_000 }).catch(() => {});
  const battle = await page.evaluate(() => {
    const root = document.querySelector("[data-testid='battle-scene']");
    const cmds = [...document.querySelectorAll("[data-testid^='actor-command-']")].map((n) => n.getAttribute("data-testid"));
    return { skin: root?.getAttribute("data-battle-skin"), commands: cmds, text: root?.textContent?.replace(/\s+/g, " ").slice(0, 400) };
  });
  const skillBtn = page.locator("[data-testid='actor-command-skill']");
  if (await skillBtn.count()) {
    await skillBtn.first().click().catch(() => {});
    await page.waitForTimeout(700);
    battle.skillMenu = await page.evaluate(() => [...document.querySelectorAll("[data-testid^='skill-'], [data-testid^='battle-skill'], [data-skill-id]")].map((n) => `${n.getAttribute("data-testid") ?? ""}|${n.getAttribute("data-skill-id") ?? ""}|${n.textContent?.trim().slice(0, 30)}`).slice(0, 20));
    await page.screenshot({ path: outPath.replace(/\.json$/, "-techs.png") });
  }
  out.probes.battle = battle;
} catch (error) {
  out.errors.push(String(error?.stack ?? error));
} finally {
  await browser.close();
  await server.close();
  writeFileSync(outPath, JSON.stringify(out, null, 1));
  console.log("PROBE_DONE");
}
