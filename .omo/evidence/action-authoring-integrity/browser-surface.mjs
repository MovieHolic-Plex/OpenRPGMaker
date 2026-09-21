import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import baseline from "./spawn-surface.json" with { type: "json" };

const projectId = "oprn-1a8ac23163";
const browser = await chromium.connectOverCDP("http://127.0.0.1:45994");
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const forward = async (route) => {
  try {
    await route.fulfill({ response: await route.fetch({ timeout: 120000, maxRetries: 1 }) });
  } catch (error) {
    const code = String(error).match(/\b(?:ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND)\b/)?.[0];
    errors.push({ url: route.request().url().split("?")[0], error: code ?? "TransportError" });
    await route.abort();
  }
};
try {
  const editor = await context.newPage();
  editor.on("pageerror", (error) => errors.push({ page: "editor", error: String(error) }));
  await editor.route("**/*", forward);
  await editor.goto(`http://127.0.0.1:45991/?project=${projectId}&skipWelcome=1`, { waitUntil: "domcontentloaded" });
  await editor.getByTestId("ai-input").waitFor({ state: "visible", timeout: 60000 });
  console.log("EDITOR_READY");

  const load = async () => editor.evaluate(async () => {
    const { legacyDbProjectConfig } = await import("/src/project/legacyDbProjectConfig.ts");
    const { loadProjectFromLegacyDb } = await import("/src/project/legacyDbProjectSync.ts");
    const { serialize } = await import("/src/project/io.ts");
    const config = legacyDbProjectConfig();
    const project = await loadProjectFromLegacyDb(config);
    const headers = {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Accept-Profile": "rpg_zzu",
    };
    await fetch(`${config.url}/rest/v1/ai_conversations?select=conversation_id,project_id,saved_at&order=saved_at.desc&limit=5`, { headers });
    const response = await fetch(`${config.url}/rest/v1/ai_conversations?select=entries_json&project_id=eq.${config.projectId}&order=saved_at.desc&limit=5`, { headers });
    if (!response.ok) throw new Error(`AI audit read failed: ${response.status}`);
    const conversations = await response.json();
    return {
      id: config.projectId,
      json: serialize(project),
      calls: conversations.flatMap((conversation) => conversation.entries_json
        .filter((entry) => entry.kind === "tool" && entry.name === "make_action_enemy")
        .map((entry) => ({ args: entry.args, ok: entry.ok, at: entry.at }))),
    };
  });
  let saved = await load();
  const matchingCall = (entry) => entry.ok && entry.args.enemyId === "qa_enemy"
    && entry.args.spawnMode === "update" && entry.args.spawn?.id === "qa_spawn_1"
    && entry.args.actionProfile?.aggroRange === 7
    && Object.keys(entry.args.actionProfile).length === 1;

  if (!saved.calls.some(matchingCall)) {
    await editor.getByTestId("ai-new-chat").click();
    const completed = editor.evaluate(() => new Promise((resolve) => {
      let seenBusy = false;
      const check = () => {
        const busy = ["ai-abort", "ai-run-stop"].some((id) => document.querySelector(`[data-testid="${id}"]`)?.getClientRects().length);
        if (busy) seenBusy = true;
        if (seenBusy && !busy) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(true);
        }
      };
      const observer = new MutationObserver(check);
      observer.observe(document.body, { subtree: true, childList: true, attributes: true });
      const timer = setTimeout(() => { observer.disconnect(); resolve(false); }, 360000);
      check();
    }));
    await editor.getByTestId("ai-input").fill(
      "현재 QA 프로젝트만 수정해. qa_enemy와 현재 맵 스폰을 먼저 조회해. make_action_enemy에 enemyId:qa_enemy, actionProfile:{aggroRange:7}만 보내 기존 공격·HP·보상을 보존해. spawnMode:update를 명시하고 qa_spawn_1을 현재 맵의 (6,5) 2x2로 이동해. troopId는 qa_troop이다. 새 스폰이나 다른 변경은 하지 말고 chase 등 생략 설정도 유지해. 위키는 읽기만 하고 데이터만 적용·저장해줘.",
    );
    await editor.getByTestId("ai-send").click();
    assert.equal(await completed, true, "AI request did not reach a terminal UI state");
    await editor.evaluate(async () => {
      const { store } = await import("/src/project/store.ts");
      const result = await store.flush();
      if (result.kind !== "saved") throw new Error(`Save did not complete: ${result.kind}`);
    });
    saved = await load();
  }

  const project = JSON.parse(saved.json);
  const enemy = project.database.enemies.find((entry) => entry.id === "qa_enemy");
  const spawn = project.maps[project.startMapId].fieldSpawns.find((entry) => entry.id === "qa_spawn_1");
  assert.equal(saved.id, projectId);
  assert.ok(saved.calls.some(matchingCall), "No actual AI partial update with explicit spawnMode was recorded");
  assert.deepEqual(enemy.actionProfile.attack, baseline.reloadedEnemy.actionProfile.attack);
  assert.deepEqual(enemy.stats, baseline.reloadedEnemy.stats);
  assert.deepEqual(enemy.rewards, baseline.reloadedEnemy.rewards);
  assert.equal(enemy.actionProfile.aggroRange, 7);
  assert.deepEqual(spawn.area, { x: 6, y: 5, w: 2, h: 2 });
  assert.equal(spawn.chase, false);
  assert.equal(project.maps[project.startMapId].fieldSpawns.length, 2);
  await editor.screenshot({ path: "output/action-integrity-final-editor.png" });
  console.log("AI_SAVE_RELOAD_PASS");

  const player = await context.newPage();
  player.on("pageerror", (error) => errors.push({ page: "player", error: String(error) }));
  await player.route("**/*", async (route) => {
    if (route.request().url().endsWith("/__integrity/project.json")) {
      await route.fulfill({ contentType: "application/json", body: saved.json });
    } else {
      await forward(route);
    }
  });
  await player.addInitScript(() => {
    window.__OPENRPG_BOOT__ = {
      projectUrl: "/__integrity/project.json",
      saveNamespace: "action-integrity-normal-player",
      qaInstrumentation: true,
    };
  });
  await player.goto("http://127.0.0.1:45992/player.html", { waitUntil: "domcontentloaded" });
  await player.getByTestId("title-screen").waitFor({ state: "visible", timeout: 60000 });
  await player.keyboard.press("Enter");
  await player.getByTestId("action-hud").waitFor({ state: "visible", timeout: 60000 });
  const moved = player.evaluate(() => new Promise((resolve) => {
    let frame;
    const timer = setTimeout(() => { cancelAnimationFrame(frame); resolve(false); }, 3000);
    const tick = () => {
      if (window.__oprnDebug?.readState().x <= 2) {
        clearTimeout(timer);
        resolve(true);
      } else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }));
  await player.keyboard.down("ArrowLeft");
  assert.equal(await moved, true, "Normal directional movement did not reach the observation position");
  await player.keyboard.up("ArrowLeft");
  const shot = await player.evaluate(() => new Promise((resolve) => {
    let frame;
    const timer = setTimeout(() => { cancelAnimationFrame(frame); resolve(null); }, 10000);
    const tick = () => {
      const combat = window.__oprnActionCombat?.();
      if (combat?.projectiles > 0) {
        clearTimeout(timer);
        resolve({ projectiles: combat.projectiles, enemies: combat.enemies, state: window.__oprnDebug?.readState() });
      } else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }));
  assert.ok(shot, "No real projectile appeared during normal play");
  assert.ok(shot.enemies.some((entry) => entry.eventId.startsWith("__field_spawn__qa_spawn_1")));
  await player.screenshot({ path: "output/action-integrity-normal-projectile.png" });
  assert.equal(errors.filter((entry) => entry.page).length, 0, "Browser page errors were observed");
  console.log("RESULT_JSON", JSON.stringify({
    projectId, aiCalls: saved.calls.filter(matchingCall), attack: enemy.actionProfile.attack,
    statsPreserved: true, rewardsPreserved: true, spawn, projectileCount: shot.projectiles,
    position: { x: shot.state.x, y: shot.state.y }, input: ["Enter", "ArrowLeft down", "ArrowLeft up"],
    pageErrors: errors.filter((entry) => entry.page), transportErrors: errors.filter((entry) => !entry.page),
    screenshots: ["output/action-integrity-final-editor.png", "output/action-integrity-normal-projectile.png"],
  }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await context.close();
  process.exit(process.exitCode ?? 0);
}
