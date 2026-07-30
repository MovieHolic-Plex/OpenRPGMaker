import { chromium, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://127.0.0.1:9173";
const EVIDENCE_DIR = path.resolve("evidence/battle-review");

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page: Page, label: string) {
  shotIndex++;
  const file = path.join(EVIDENCE_DIR, `${String(shotIndex).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`📸 ${label} → ${file}`);
  return file;
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  console.log("🚀 Loading editor...");
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);
  await shot(page, "editor-loaded");

  // Try to trigger battle test via the exposed function
  console.log("🔍 Looking for battle test entry points...");
  
  // Check what's available
  const hasEditor = await page.evaluate(() => {
    return {
      hasStore: typeof (window as any).__rpgzzuEditorUiMode !== "undefined",
      bodyClasses: document.body.className,
      mainContent: document.querySelector("[data-testid]")?.getAttribute("data-testid") ?? "none",
    };
  });
  console.log("Editor state:", JSON.stringify(hasEditor));

  // Try to open battle test modal directly via dynamic import
  console.log("⚔️ Attempting to trigger battle...");
  const battleTriggered = await page.evaluate(async () => {
    try {
      // The editor should have loaded modules - try to find the store and troops
      const storeModule = await import("/src/project/store.ts");
      const store = storeModule.store;
      const project = store.getCurrent();
      const troops = project.database.troops;
      return {
        success: true,
        troopCount: troops.length,
        troopNames: troops.slice(0, 5).map((t: any) => ({ id: t.id, name: t.name, members: t.members?.length ?? 0 })),
        systemBattleFlow: project.system.battleFlow,
        battleUiStyle: project.system.battleUiStyle,
        battleParty: project.system.battleParty,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });
  console.log("Battle info:", JSON.stringify(battleTriggered, null, 2));

  if (battleTriggered.success && battleTriggered.troopCount > 0) {
    // Open battle test modal
    console.log("⚔️ Opening battle test modal...");
    await page.evaluate(async () => {
      const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
      const { store } = await import("/src/project/store.ts");
      const project = store.getCurrent();
      const troop = project.database.troops.find((t: any) => (t.members?.length ?? 0) > 0 || (t.enemyIds?.length ?? 0) > 0);
      if (troop) {
        await openTroopBattleTestModal(troop.id);
      }
    });
    await page.waitForTimeout(2000);
    await shot(page, "battle-start");

    // Check battle scene state
    const battleState = await page.evaluate(() => {
      const scene = document.querySelector("[data-testid='battle-scene']");
      const field = document.querySelector("[data-testid='battle-field']");
      const commandGrid = document.querySelector("[data-testid='battle-command-grid']");
      const messageWindow = document.querySelector(".battle-message-window");
      const partyStatus = document.querySelector(".battle-party-status");
      return {
        hasScene: !!scene,
        hasField: !!field,
        hasCommandGrid: !!commandGrid,
        hasMessageWindow: !!messageWindow,
        hasPartyStatus: !!partyStatus,
        sceneHTML: scene?.innerHTML?.substring(0, 500) ?? "none",
        commandButtons: [...(commandGrid?.querySelectorAll("button") ?? [])].map(b => b.textContent?.trim()),
        messageText: messageWindow?.textContent?.trim(),
      };
    });
    console.log("Battle state:", JSON.stringify(battleState, null, 2));

    // Try clicking attack
    const attackBtn = page.locator("[data-testid='battle-command-grid'] button").first();
    if (await attackBtn.isVisible()) {
      console.log("🗡️ Clicking attack...");
      await attackBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, "after-attack-command");

      // Check if target selection appeared
      const targetState = await page.evaluate(() => {
        const targetBtns = document.querySelectorAll(".battle-target-menu button, .battle-enemy-list-panel button, [data-testid='battle-command-grid'] button");
        return {
          targetButtons: [...targetBtns].map(b => b.textContent?.trim()),
          phase: document.querySelector("[data-testid='battle-scene']")?.getAttribute("data-phase"),
        };
      });
      console.log("Target state:", JSON.stringify(targetState));

      // Click first target if available
      const targetBtn = page.locator(".battle-target-menu button, .battle-enemy-list-panel button").first();
      if (await targetBtn.isVisible().catch(() => false)) {
        console.log("🎯 Selecting target...");
        await targetBtn.click();
        await page.waitForTimeout(3000);
        await shot(page, "after-attack-resolution");
      }
    }

    // Wait and observe battle progression
    await page.waitForTimeout(3000);
    await shot(page, "battle-mid-state");

    // Try more interactions
    for (let i = 0; i < 3; i++) {
      const cmdBtn = page.locator("[data-testid='battle-command-grid'] button").first();
      if (await cmdBtn.isVisible().catch(() => false)) {
        await cmdBtn.click();
        await page.waitForTimeout(500);
        const tgt = page.locator(".battle-target-menu button, .battle-enemy-list-panel button").first();
        if (await tgt.isVisible().catch(() => false)) {
          await tgt.click();
        }
        await page.waitForTimeout(2000);
        await shot(page, `battle-turn-${i + 2}`);
      }
    }

    // Final state
    await page.waitForTimeout(2000);
    await shot(page, "battle-final-state");

    // Get final battle state
    const finalState = await page.evaluate(() => {
      const scene = document.querySelector("[data-testid='battle-scene']");
      const resultPanel = document.querySelector("[data-testid='battle-result-panel']");
      const messageWindow = document.querySelector(".battle-message-window");
      return {
        hasResult: !!resultPanel,
        resultText: resultPanel?.textContent?.trim()?.substring(0, 200),
        messageText: messageWindow?.textContent?.trim(),
        sceneVisible: scene ? getComputedStyle(scene).display !== "none" : false,
      };
    });
    console.log("Final state:", JSON.stringify(finalState, null, 2));
  }

  // Report console errors
  if (consoleErrors.length > 0) {
    console.log("\n❌ Console errors:");
    consoleErrors.forEach(e => console.log(`  - ${e}`));
  } else {
    console.log("\n✅ No console errors");
  }

  await browser.close();
  console.log("\n🏁 Battle review complete!");
}

main().catch(console.error);
