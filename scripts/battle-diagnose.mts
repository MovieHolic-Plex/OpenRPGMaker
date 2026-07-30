import { chromium, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://127.0.0.1:9173";
const EVIDENCE_DIR = path.resolve("evidence/battle-diagnose");
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

  // Open battle
  await page.evaluate(async () => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal("troop_golem_guard");
  });
  await page.waitForTimeout(2500);
  await shot(page, "golem-battle-full");

  // Accurate DOM diagnosis
  const diag = await page.evaluate(() => {
    const scene = document.querySelector("[data-testid='battle-scene']") as HTMLElement;
    if (!scene) return { error: "no battle scene" };

    // Party panel
    const party = scene.querySelector(".battle-party") as HTMLElement;
    const partyByTestid = scene.querySelector("[data-testid='battle-party']") as HTMLElement;
    const actorStatuses = scene.querySelectorAll(".battle-actor-status");
    
    // Enemy HP bars
    const enemyHpBars = scene.querySelectorAll(".battle-enemy-hp-bar");
    const enemyHpTexts = scene.querySelectorAll(".battle-enemy-hp-text");
    const enemyHuds = scene.querySelectorAll(".battle-enemy-hud");
    
    // Command panel
    const cmdGrid = scene.querySelector("[data-testid='battle-command-grid']");
    
    // All direct children of scene
    const children = [...scene.children].map(c => ({
      tag: c.tagName,
      class: c.className,
      testid: c.getAttribute("data-testid"),
      visible: (c as HTMLElement).offsetParent !== null || getComputedStyle(c as HTMLElement).display !== "none",
      rect: (c as HTMLElement).getBoundingClientRect(),
      computedDisplay: getComputedStyle(c as HTMLElement).display,
      computedVisibility: getComputedStyle(c as HTMLElement).visibility,
      computedOpacity: getComputedStyle(c as HTMLElement).opacity,
    }));

    return {
      partyExists: !!party,
      partyByTestid: !!partyByTestid,
      partyRect: party?.getBoundingClientRect(),
      partyDisplay: party ? getComputedStyle(party).display : "N/A",
      partyVisibility: party ? getComputedStyle(party).visibility : "N/A",
      partyOpacity: party ? getComputedStyle(party).opacity : "N/A",
      partyInnerHTML: party?.innerHTML?.substring(0, 500),
      actorStatusCount: actorStatuses.length,
      actorStatusTexts: [...actorStatuses].map(s => s.textContent?.trim()),
      enemyHpBarCount: enemyHpBars.length,
      enemyHpBarWidths: [...enemyHpBars].map(b => (b as HTMLElement).style.getPropertyValue("--battle-stat")),
      enemyHpTextValues: [...enemyHpTexts].map(t => t.textContent),
      enemyHudCount: enemyHuds.length,
      cmdGridButtons: [...(cmdGrid?.querySelectorAll("button") ?? [])].map(b => b.textContent?.trim()),
      sceneChildren: children,
      sceneDataset: Object.fromEntries([...Object.entries(scene.dataset)]),
    };
  });
  console.log("=== DOM DIAGNOSIS ===");
  console.log(JSON.stringify(diag, null, 2));

  // Test item submenu
  console.log("\n=== ITEM SUBMENU TEST ===");
  const itemBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "아이템" }).first();
  if (await itemBtn.isVisible().catch(() => false)) {
    await itemBtn.click();
    await page.waitForTimeout(800);
    await shot(page, "after-item-click");
    
    const afterItem = await page.evaluate(() => {
      const grid = document.querySelector("[data-testid='battle-command-grid']");
      const scene = document.querySelector("[data-testid='battle-scene']");
      return {
        gridButtons: [...(grid?.querySelectorAll("button") ?? [])].map(b => ({
          text: b.textContent?.trim(),
          disabled: b.hasAttribute("disabled"),
          className: b.className,
        })),
        scenePhase: scene?.getAttribute("data-battle-phase"),
        directorStep: scene?.getAttribute("data-battle-director-step"),
      };
    });
    console.log("After item click:", JSON.stringify(afterItem, null, 2));
  }

  // Test skill submenu properly
  console.log("\n=== SKILL SUBMENU TEST ===");
  // Close and reopen
  await page.evaluate(async () => {
    const { closeTestPlayModal } = await import("/src/editor/panels/testPlayModal.ts");
    closeTestPlayModal();
  });
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal("troop_slime");
  });
  await page.waitForTimeout(2000);

  const skillBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "기술" }).first();
  if (await skillBtn.isVisible().catch(() => false)) {
    await skillBtn.click();
    await page.waitForTimeout(800);
    await shot(page, "skill-submenu-detail");
    
    const skillInfo = await page.evaluate(() => {
      const grid = document.querySelector("[data-testid='battle-command-grid']");
      return {
        buttons: [...(grid?.querySelectorAll("button") ?? [])].map(b => ({
          text: b.textContent?.trim(),
          innerHTML: b.innerHTML?.substring(0, 200),
          disabled: b.hasAttribute("disabled"),
        })),
      };
    });
    console.log("Skill submenu:", JSON.stringify(skillInfo, null, 2));
  }

  // Test flee
  console.log("\n=== FLEE TEST ===");
  await page.evaluate(async () => {
    const { closeTestPlayModal } = await import("/src/editor/panels/testPlayModal.ts");
    closeTestPlayModal();
  });
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal("troop_slime");
  });
  await page.waitForTimeout(2000);

  const fleeBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "도주" }).first();
  if (await fleeBtn.isVisible().catch(() => false)) {
    await fleeBtn.click();
    await page.waitForTimeout(2000);
    await shot(page, "flee-detail");
    const fleeInfo = await page.evaluate(() => {
      const msg = document.querySelector(".battle-message-window");
      const result = document.querySelector("[data-testid='battle-result-panel']");
      return {
        message: msg?.textContent?.trim(),
        result: result?.textContent?.trim()?.substring(0, 200),
      };
    });
    console.log("Flee result:", JSON.stringify(fleeInfo, null, 2));
  }

  // Test defend
  console.log("\n=== DEFEND TEST ===");
  await page.evaluate(async () => {
    const { closeTestPlayModal } = await import("/src/editor/panels/testPlayModal.ts");
    closeTestPlayModal();
  });
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal("troop_slime");
  });
  await page.waitForTimeout(2000);

  const defendBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "방어" }).first();
  if (await defendBtn.isVisible().catch(() => false)) {
    await defendBtn.click();
    await page.waitForTimeout(3000);
    await shot(page, "defend-detail");
    const defendInfo = await page.evaluate(() => {
      const msg = document.querySelector(".battle-message-window");
      const grid = document.querySelector("[data-testid='battle-command-grid']");
      return {
        message: msg?.textContent?.trim(),
        gridVisible: !!grid,
        gridButtons: [...(grid?.querySelectorAll("button") ?? [])].map(b => b.textContent?.trim()),
      };
    });
    console.log("Defend result:", JSON.stringify(defendInfo, null, 2));
  }

  await browser.close();
  console.log("\n🏁 Diagnosis complete!");
}

main().catch(console.error);
