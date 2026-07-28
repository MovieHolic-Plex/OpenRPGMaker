import { chromium, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://127.0.0.1:9173";
const EVIDENCE_DIR = path.resolve("evidence/battle-variance");
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

  // Open battle against golem (high HP so we get multiple turns)
  await page.evaluate(async () => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal("troop_golem_guard");
  });
  await page.waitForTimeout(2000);

  const damages: number[] = [];
  const messages: string[] = [];

  for (let i = 0; i < 6; i++) {
    // Wait for command grid
    const gridVisible = await page.locator("[data-testid='battle-command-grid']").isVisible().catch(() => false);
    if (!gridVisible) {
      console.log(`  Turn ${i + 1}: no command grid, battle may have ended`);
      break;
    }

    // Click attack button
    const atkBtn = page.locator("[data-testid='actor-command-attack']");
    if (!(await atkBtn.isVisible().catch(() => false))) {
      console.log(`  Turn ${i + 1}: attack button not visible`);
      break;
    }
    await atkBtn.click();
    await page.waitForTimeout(500);

    // Click first targetable enemy
    const enemyBtn = page.locator(".battle-enemy:not([disabled])").first();
    if (await enemyBtn.isVisible().catch(() => false)) {
      await enemyBtn.click();
    } else {
      // Try clicking enemy in the command menu
      const menuBtn = page.locator(".battle-command-menu button").first();
      if (await menuBtn.isVisible().catch(() => false)) {
        await menuBtn.click();
      }
    }

    // Wait for action to resolve and capture message at various points
    await page.waitForTimeout(800);
    const msg1 = await page.evaluate(() => document.querySelector(".battle-message-window")?.textContent?.trim() ?? "");
    await page.waitForTimeout(500);
    const msg2 = await page.evaluate(() => document.querySelector(".battle-message-window")?.textContent?.trim() ?? "");
    await page.waitForTimeout(700);
    const msg3 = await page.evaluate(() => document.querySelector(".battle-message-window")?.textContent?.trim() ?? "");

    // Also check enemy HP changes
    const enemyHps = await page.evaluate(() => {
      return [...document.querySelectorAll(".battle-enemy-hp-text")].map(t => t.textContent);
    });

    const allMsgs = [msg1, msg2, msg3].filter(m => m.length > 0);
    messages.push(...allMsgs);
    console.log(`  Turn ${i + 1}: msgs=[${allMsgs.join(" | ")}] enemyHPs=[${enemyHps.join(", ")}]`);

    // Extract damage numbers from any message
    for (const msg of allMsgs) {
      const matches = msg.matchAll(/(\d+)\s*피해/g);
      for (const m of matches) {
        damages.push(parseInt(m[1]));
      }
    }

    await shot(page, `variance-turn-${i + 1}`);

    // Check if battle ended
    const ended = await page.evaluate(() => !!document.querySelector("[data-testid='battle-result-panel']"));
    if (ended) {
      console.log(`  Battle ended at turn ${i + 1}`);
      break;
    }
  }

  console.log("\n=== VARIANCE RESULTS ===");
  console.log("All messages:", messages);
  console.log("Damage values:", damages);
  const unique = new Set(damages);
  console.log(`Unique values: ${unique.size} / ${damages.length}`);
  console.log(`Variance: ${unique.size > 1 ? "✅ CONFIRMED" : unique.size === 1 ? "⚠️ Only 1 value (may need more hits)" : "❌ No data"}`);

  // Also verify via runtime snapshot
  const runtimeCheck = await page.evaluate(async () => {
    const { createBattleRuntime } = await import("/src/battle/runtime.ts");
    const { advanceBattleRuntime } = await import("/src/battle/battleRuntimeAdvance.ts");
    const { store } = await import("/src/project/store.ts");
    const project = store.getCurrent();
    
    // Run 5 battles and collect damage
    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
      advanceBattleRuntime(runtime);
      const snap1 = runtime.snapshot();
      if (snap1.phase === "actorCommand") {
        runtime.performActorCommand({ kind: "attack", targetEnemyId: snap1.enemies[0]?.id ?? "" });
        const snap2 = runtime.snapshot();
        const lastResult = snap2.lastActionResult;
        if (lastResult) results.push(lastResult.amount);
      }
    }
    return results;
  });
  console.log("\nDirect runtime damage values:", runtimeCheck);
  const runtimeUnique = new Set(runtimeCheck);
  console.log(`Runtime variance: ${runtimeUnique.size > 1 ? "✅ CONFIRMED" : "❌ No variance"}`);

  await browser.close();
  console.log("\n🏁 Variance verification complete!");
}

main().catch(console.error);
