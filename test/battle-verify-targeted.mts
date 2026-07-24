import { chromium, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://127.0.0.1:9173";
const EVIDENCE_DIR = path.resolve("evidence/battle-fixes-targeted");
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page: Page, label: string) {
  shotIndex++;
  const file = path.join(EVIDENCE_DIR, `${String(shotIndex).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`📸 ${label}`);
  return file;
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // === DEFEND TIMING: capture at 400ms ===
  console.log("=== DEFEND at 400ms ===");
  await page.evaluate(async () => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal("troop_slime");
  });
  await page.waitForTimeout(2000);

  const defendBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "방어" }).first();
  await defendBtn.click();
  await page.waitForTimeout(400);
  await shot(page, "defend-at-400ms");
  const defendState = await page.evaluate(() => {
    const msg = document.querySelector(".battle-message-window");
    const scene = document.querySelector("[data-testid='battle-scene']");
    return {
      message: msg?.textContent?.trim(),
      directorStep: scene?.getAttribute("data-battle-director-step"),
      msgDisplay: msg ? getComputedStyle(msg).display : "N/A",
    };
  });
  console.log("Defend at 400ms:", JSON.stringify(defendState));
  await page.waitForTimeout(600);
  await shot(page, "defend-at-1000ms");
  const defendState2 = await page.evaluate(() => {
    const msg = document.querySelector(".battle-message-window");
    const scene = document.querySelector("[data-testid='battle-scene']");
    return {
      message: msg?.textContent?.trim(),
      directorStep: scene?.getAttribute("data-battle-director-step"),
    };
  });
  console.log("Defend at 1000ms:", JSON.stringify(defendState2));

  await page.evaluate(async () => {
    const { closeTestPlayModal } = await import("/src/editor/panels/testPlayModal.ts");
    closeTestPlayModal();
  });
  await page.waitForTimeout(500);

  // === DAMAGE VARIANCE: use correct target selector ===
  console.log("\n=== DAMAGE VARIANCE ===");
  await page.evaluate(async () => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal("troop_golem_guard");
  });
  await page.waitForTimeout(2000);

  const damages: (number | null)[] = [];
  for (let i = 0; i < 5; i++) {
    // Check if command grid is visible
    const gridVisible = await page.locator("[data-testid='battle-command-grid']").isVisible().catch(() => false);
    if (!gridVisible) break;

    // Click attack
    const atkBtn = page.locator("[data-testid='actor-command-attack']");
    if (await atkBtn.isVisible().catch(() => false)) {
      await atkBtn.click();
      await page.waitForTimeout(400);

      // Now in target select - click first enemy button in the field
      const enemyBtn = page.locator(".battle-enemy[data-battle-targetable='true']").first();
      if (await enemyBtn.isVisible().catch(() => false)) {
        await enemyBtn.click();
        await page.waitForTimeout(2500);

        // Read damage from message or action log
        const dmg = await page.evaluate(() => {
          const msg = document.querySelector(".battle-message-window");
          const text = msg?.textContent ?? "";
          const match = text.match(/(\d+)\s*피해/);
          if (match) return parseInt(match[1]);
          // Try damage popup
          const popup = document.querySelector(".battle-damage-popup");
          if (popup) return parseInt(popup.textContent ?? "0");
          return null;
        });
        damages.push(dmg);
        console.log(`  Turn ${i + 1}: damage = ${dmg}`);
      } else {
        console.log(`  Turn ${i + 1}: no targetable enemy`);
        break;
      }
    } else {
      break;
    }

    // Check if battle ended
    const ended = await page.evaluate(() => !!document.querySelector("[data-testid='battle-result-panel']"));
    if (ended) break;
  }
  await shot(page, "damage-variance-final");
  console.log("All damages:", damages);
  const uniqueDamages = new Set(damages.filter(d => d !== null));
  console.log(`Unique damage values: ${uniqueDamages.size} out of ${damages.length} hits`);
  console.log(`Variance working: ${uniqueDamages.size > 1 ? "YES ✅" : "NO ❌ (or not enough data)"}`);

  await page.evaluate(async () => {
    const { closeTestPlayModal } = await import("/src/editor/panels/testPlayModal.ts");
    closeTestPlayModal();
  });
  await page.waitForTimeout(500);

  // === SKILL TEXT SPACING VISUAL ===
  console.log("\n=== SKILL TEXT SPACING ===");
  await page.evaluate(async () => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal("troop_slime");
  });
  await page.waitForTimeout(2000);
  const skillBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "기술" }).first();
  await skillBtn.click();
  await page.waitForTimeout(500);
  await shot(page, "skill-spacing-final");

  await browser.close();
  console.log("\n🏁 Targeted verification complete!");
}

main().catch(console.error);
