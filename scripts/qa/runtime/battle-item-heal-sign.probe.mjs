// 전투 아이템 회복 표시 검증 프로브 (2026-09-15, 적대적 리뷰 후속).
// 리뷰어가 코드/하피돔으로만 주장한 두 가지를 **출하 플레이어 브라우저**에서 직접 잰다.
//   H1: MP 회복(마력약)이 표시 HP 에 가산되는가
//   H3: HP 회복(회복약) 메시지가 "N 피해!" 로 나오는가
//
//   node scripts/qa/runtime/battle-item-heal-sign.probe.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/battle-item-heal-sign");
await mkdir(out, { recursive: true });
const project = JSON.parse(
  await readFile(new URL("../../../test/fixtures/projects/item-runtime-qa-v3.json", import.meta.url), "utf8"),
);

const READ_PARTY = `(() => {
  const rows = [...document.querySelectorAll('.battle-party .battle-actor-status')];
  return rows.map((r) => ({
    hp: r.querySelector('.battle-actor-hp')?.textContent ?? null,
    mp: r.querySelector('.battle-actor-mp')?.textContent ?? null,
  }));
})()`;

const READ_TEXT = `(() => ({
  message: [...document.querySelectorAll('[data-testid="battle-message-window"] .battle-message-text, [data-testid="battle-message-window"] p, [data-testid="battle-message-window"]')].map(n=>n.textContent).filter(Boolean),
  popup: [...document.querySelectorAll('[data-testid="battle-damage-popup"], .battle-damage-popup')].map((n) => n.textContent),
  popupClass: [...document.querySelectorAll('.battle-damage-popup')].map((n) => n.className),
  itemList: [...document.querySelectorAll('[data-testid^="actor-item-"]')].map((n) => n.dataset.testid),
  phase: document.querySelector('[data-testid="battle-scene"]')?.dataset.battlePhase ?? null,
  step: document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep ?? null,
}))()`;

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const server = await startPlayerQaServer();
const log = { partyAtStart: null, uses: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  page.on("pageerror", (e) => log.errors.push(String(e)));
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { projectUrl: "/__heal/project.json", saveNamespace: "heal-qa", qaInstrumentation: true };
  });
  await page.route("**/__heal/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 60_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.().currentMapId, undefined, { timeout: 60_000 });
  // 전투 진입 전 파티 HP/MP 를 낮 둔다 — 회복이 화면에 보이도록.
  await page.evaluate(() => {
    const ids = window.__oprnDebug.readState().partyActorIds;
    ids.forEach((id, i) => window.__oprnSetActorVitals(id, 200 + i, 10));
  });

  await page.evaluate(() => window.__oprnDebug.teleport("map_moonwell_forest", 14, 3));
  await page.waitForFunction(() => {
    const s = window.__oprnDebug.readState();
    return s.currentMapId === "map_moonwell_forest" && s.x === 14 && s.y === 3;
  }, undefined, { timeout: 15_000 });
  await page.evaluate(() => { window.__oprnInput.face("up"); window.__oprnInput.action(); });
  for (let i = 0; i < 24; i++) {
    if (await page.locator('[data-testid="battle-scene"]').count()) break;
    await page.keyboard.press("z");
    await page.waitForTimeout(300);
  }
  await page.waitForSelector('[data-testid="actor-command-attack"]', { timeout: 30_000 });
  await page.waitForTimeout(600);

  async function openItemMenu() {
    // 루트 커맨드: 공격(0) 스킬(1) 방어(2) 아이템(3) 도주(4). 아이템은 3번 내려간 자리다.
    for (let i = 0; i < 3; i++) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(80); }
    await page.keyboard.press("z");
    await page.waitForTimeout(500);
    return await page.evaluate(READ_TEXT);
  }

  async function useItem(downPresses, label) {
    const menu = await openItemMenu();
    for (let i = 0; i < downPresses; i++) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(80); }
    const beforeShot = `C-before-${label}.png`;
    await page.screenshot({ path: resolve(out, beforeShot) });
    const partyBefore = await page.evaluate(READ_PARTY);
    await page.keyboard.press("z"); // 아이템 확정 → 대상 선택
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(out, `D-target-${label}.png`) });
    await page.keyboard.press("z"); // 주인공 확정
    // 임팩트 순간을 잡는다.
    let impact = null;
    for (let i = 0; i < 60; i++) {
      const t = await page.evaluate(READ_TEXT);
      if (t.popup.length || (t.message || []).join(" ").match(/피해|회복/)) {
        impact = { ...t, party: await page.evaluate(READ_PARTY) };
        if (i >= 0) break;
      }
      await page.waitForTimeout(100);
    }
    await page.screenshot({ path: resolve(out, `E-impact-${label}.png`) });
    // 다음 커맨드 국면(원장 해제 후) 값.
    let after = null;
    for (let i = 0; i < 80; i++) {
      if (await page.locator('[data-testid="actor-command-attack"]').count()) {
        await page.waitForTimeout(400);
        after = { party: await page.evaluate(READ_PARTY), text: await page.evaluate(READ_TEXT) };
        break;
      }
      await page.keyboard.press("z");
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: resolve(out, `F-after-${label}.png`) });
    const rec = { label, itemList: menu.itemList, partyBefore, impact, after };
    log.uses.push(rec);
    console.log(JSON.stringify(rec, null, 1));
  }

  // 아이템 목록 순서: item_potion(0), item_ether(1), ...
  await useItem(0, "potion");
  await useItem(1, "ether");
} finally {
  await browser.close();
  await server.close();
}
await writeFile(resolve(out, "result.json"), JSON.stringify(log, null, 1));
console.log("WROTE", resolve(out, "result.json"));