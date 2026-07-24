import { chromium, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://127.0.0.1:9173";
const EVIDENCE_DIR = path.resolve("evidence/battle-fixes-verified");
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page: Page, label: string) {
  shotIndex++;
  const file = path.join(EVIDENCE_DIR, `${String(shotIndex).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`📸 ${label}`);
  return file;
}

async function openBattle(page: Page, troopId: string) {
  await page.evaluate(async (tid) => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal(tid);
  }, troopId);
  await page.waitForTimeout(2000);
}

async function closeBattle(page: Page) {
  await page.evaluate(async () => {
    const { closeTestPlayModal } = await import("/src/editor/panels/testPlayModal.ts");
    closeTestPlayModal();
  });
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  console.log("🚀 Loading editor...");
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // === VERIFY 1: Party status panel visible ===
  console.log("\n=== VERIFY 1: Party status panel ===");
  await openBattle(page, "troop_golem_guard");
  await shot(page, "party-panel-visible");
  const partyCheck = await page.evaluate(() => {
    const party = document.querySelector(".battle-party");
    const actorStatus = document.querySelector(".battle-actor-status");
    return {
      partyVisible: !!party && getComputedStyle(party).display !== "none",
      actorName: actorStatus?.querySelector(".battle-actor-name")?.textContent?.trim(),
      actorHp: actorStatus?.querySelector(".battle-actor-hp")?.textContent?.trim(),
      actorMp: actorStatus?.querySelector(".battle-actor-mp")?.textContent?.trim(),
      hpBar: actorStatus?.querySelector(".battle-stat-bar-hp")?.getAttribute("style"),
      atbBar: !!actorStatus?.querySelector(".battle-atb-bar"),
    };
  });
  console.log("Party panel:", JSON.stringify(partyCheck, null, 2));
  await closeBattle(page);

  // === VERIFY 2: Enemy HP bars visible ===
  console.log("\n=== VERIFY 2: Enemy HP bars ===");
  await openBattle(page, "troop_bat_swarm");
  await shot(page, "enemy-hp-bars");
  const enemyCheck = await page.evaluate(() => {
    const huds = document.querySelectorAll(".battle-enemy-hud");
    const bars = document.querySelectorAll(".battle-enemy-hp-bar");
    const texts = document.querySelectorAll(".battle-enemy-hp-text");
    return {
      hudCount: huds.length,
      barCount: bars.length,
      barStyles: [...bars].map(b => (b as HTMLElement).style.getPropertyValue("--battle-stat")),
      textValues: [...texts].map(t => t.textContent),
    };
  });
  console.log("Enemy HP bars:", JSON.stringify(enemyCheck, null, 2));
  await closeBattle(page);

  // === VERIFY 3: Item button shows "없음" when empty ===
  console.log("\n=== VERIFY 3: Item button state ===");
  await openBattle(page, "troop_slime");
  await shot(page, "item-button-state");
  const itemCheck = await page.evaluate(() => {
    const grid = document.querySelector("[data-testid='battle-command-grid']");
    const itemBtn = grid?.querySelector("[data-testid='actor-command-item']") as HTMLButtonElement;
    return {
      exists: !!itemBtn,
      text: itemBtn?.textContent?.trim(),
      previewOnly: itemBtn?.dataset.previewOnly,
      disabled: itemBtn?.hasAttribute("disabled"),
      computedOpacity: itemBtn ? getComputedStyle(itemBtn).opacity : "N/A",
    };
  });
  console.log("Item button:", JSON.stringify(itemCheck, null, 2));
  await closeBattle(page);

  // === VERIFY 4: Skill submenu text spacing ===
  console.log("\n=== VERIFY 4: Skill submenu spacing ===");
  await openBattle(page, "troop_slime");
  const skillBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "기술" }).first();
  if (await skillBtn.isVisible().catch(() => false)) {
    await skillBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "skill-submenu-spacing");
    const skillCheck = await page.evaluate(() => {
      const grid = document.querySelector("[data-testid='battle-command-grid']");
      const buttons = [...(grid?.querySelectorAll("button") ?? [])];
      return buttons.map(b => {
        const strong = b.querySelector("strong");
        const small = b.querySelector("small");
        return {
          text: b.textContent?.trim(),
          strongText: strong?.textContent,
          smallText: small?.textContent,
          hasGap: !!small && getComputedStyle(small).display === "block",
        };
      });
    });
    console.log("Skill submenu:", JSON.stringify(skillCheck, null, 2));
  }
  await closeBattle(page);

  // === VERIFY 5: Defend feedback ===
  console.log("\n=== VERIFY 5: Defend feedback ===");
  await openBattle(page, "troop_slime");
  await page.waitForTimeout(500);
  const defendBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "방어" }).first();
  if (await defendBtn.isVisible().catch(() => false)) {
    await defendBtn.click();
    await page.waitForTimeout(1500);
    await shot(page, "defend-feedback");
    const defendCheck = await page.evaluate(() => {
      const msg = document.querySelector(".battle-message-window");
      const scene = document.querySelector("[data-testid='battle-scene']");
      const actorNode = document.querySelector(".battle-actor");
      return {
        message: msg?.textContent?.trim(),
        directorStep: scene?.getAttribute("data-battle-director-step"),
        actorHasDefendClass: actorNode?.classList.contains("battle-juice-defend"),
        msgDisplay: msg ? getComputedStyle(msg).display : "N/A",
      };
    });
    console.log("Defend feedback:", JSON.stringify(defendCheck, null, 2));
  }
  await closeBattle(page);

  // === VERIFY 6: Damage variance ===
  console.log("\n=== VERIFY 6: Damage variance ===");
  await openBattle(page, "troop_golem_guard");
  const damages: number[] = [];
  for (let i = 0; i < 4; i++) {
    const attackBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "공격" }).first();
    if (await attackBtn.isVisible().catch(() => false)) {
      await attackBtn.click();
      await page.waitForTimeout(300);
      const targetBtn = page.locator(".battle-command-menu button, .battle-target-menu button").filter({ hasNotText: "취소" }).first();
      if (await targetBtn.isVisible().catch(() => false)) {
        await targetBtn.click();
        await page.waitForTimeout(2000);
        const dmg = await page.evaluate(() => {
          const msg = document.querySelector(".battle-message-window");
          const match = msg?.textContent?.match(/(\d+)\s*피해/);
          return match ? parseInt(match[1]) : null;
        });
        if (dmg) damages.push(dmg);
      }
    }
    // Check if battle ended
    const ended = await page.evaluate(() => !!document.querySelector("[data-testid='battle-result-panel']"));
    if (ended) break;
  }
  await shot(page, "damage-variance-result");
  console.log("Damage values:", damages);
  const hasVariance = new Set(damages).size > 1;
  console.log(`Variance present: ${hasVariance} (${damages.length} hits)`);
  await closeBattle(page);

  // === VERIFY 7: Victory presentation ===
  console.log("\n=== VERIFY 7: Victory presentation ===");
  await openBattle(page, "troop_slime");
  // Kill the slime quickly
  const atkBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "공격" }).first();
  if (await atkBtn.isVisible().catch(() => false)) {
    await atkBtn.click();
    await page.waitForTimeout(300);
    const tgt = page.locator(".battle-command-menu button, .battle-target-menu button").filter({ hasNotText: "취소" }).first();
    if (await tgt.isVisible().catch(() => false)) {
      await tgt.click();
      await page.waitForTimeout(3000);
    }
  }
  await shot(page, "victory-presentation");
  const victoryCheck = await page.evaluate(() => {
    const panel = document.querySelector("[data-testid='battle-result-panel']");
    const title = panel?.querySelector(".battle-result-title");
    const cards = panel?.querySelectorAll(".battle-result-reward-card");
    const crest = panel?.querySelector(".battle-result-crest");
    return {
      hasPanel: !!panel,
      resultType: panel?.getAttribute("data-battle-result"),
      titleText: title?.textContent,
      titleColor: title ? getComputedStyle(title).color : "N/A",
      rewardCount: cards?.length ?? 0,
      hasCrest: !!crest,
      panelInnerHTML: panel?.innerHTML?.substring(0, 400),
    };
  });
  console.log("Victory presentation:", JSON.stringify(victoryCheck, null, 2));
  await closeBattle(page);

  // === VERIFY 8: Full battle flow ===
  console.log("\n=== VERIFY 8: Full multi-turn battle ===");
  await openBattle(page, "troop_forest_hornets");
  await shot(page, "full-battle-start");
  for (let turn = 0; turn < 6; turn++) {
    const btn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "공격" }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(300);
      const t = page.locator(".battle-command-menu button, .battle-target-menu button").filter({ hasNotText: "취소" }).first();
      if (await t.isVisible().catch(() => false)) {
        await t.click();
        await page.waitForTimeout(2500);
        await shot(page, `full-battle-turn-${turn + 1}`);
      }
    }
    const ended = await page.evaluate(() => !!document.querySelector("[data-testid='battle-result-panel']"));
    if (ended) break;
  }
  await shot(page, "full-battle-end");
  const finalCheck = await page.evaluate(() => {
    const panel = document.querySelector("[data-testid='battle-result-panel']");
    const msg = document.querySelector(".battle-message-window");
    return {
      result: panel?.getAttribute("data-battle-result"),
      resultText: panel?.textContent?.trim()?.substring(0, 200),
      message: msg?.textContent?.trim(),
    };
  });
  console.log("Full battle result:", JSON.stringify(finalCheck, null, 2));
  await closeBattle(page);

  // Summary
  console.log("\n========== VERIFICATION SUMMARY ==========");
  console.log(`Console errors: ${consoleErrors.length}`);
  consoleErrors.filter(e => !e.includes("ERR_CONNECTION_REFUSED")).forEach(e => console.log(`  ❌ ${e}`));

  await browser.close();
  console.log("\n🏁 Verification complete!");
}

main().catch(console.error);
