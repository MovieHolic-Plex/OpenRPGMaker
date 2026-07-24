import { chromium, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://127.0.0.1:9173";
const EVIDENCE_DIR = path.resolve("evidence/battle-zoom-compare");
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

  // Open golem guard battle (3 different enemies)
  await page.evaluate(async () => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal("troop_golem_guard");
  });
  await page.waitForTimeout(2500);

  // Full battle screenshot
  await shot(page, "full-battle");

  // Crop just the battle field element
  const field = page.locator("[data-testid='battle-field']");
  const fieldFile = path.join(EVIDENCE_DIR, "03-field-crop.png");
  await field.screenshot({ path: fieldFile });
  console.log("📸 field-crop");

  // Zoom 2x on the enemy area (left half of field)
  const fieldBox = await field.boundingBox();
  if (fieldBox) {
    const enemyAreaFile = path.join(EVIDENCE_DIR, "04-enemy-area-2x.png");
    await page.screenshot({
      path: enemyAreaFile,
      clip: {
        x: fieldBox.x,
        y: fieldBox.y,
        width: fieldBox.width * 0.55,
        height: fieldBox.height,
      },
    });
    console.log("📸 enemy-area-2x");

    // Zoom on single enemy (first enemy - top-left area)
    const singleEnemyFile = path.join(EVIDENCE_DIR, "05-single-enemy-zoom.png");
    await page.screenshot({
      path: singleEnemyFile,
      clip: {
        x: fieldBox.x + fieldBox.width * 0.05,
        y: fieldBox.y + fieldBox.height * 0.1,
        width: fieldBox.width * 0.25,
        height: fieldBox.height * 0.4,
      },
    });
    console.log("📸 single-enemy-zoom");

    // Zoom on actor (right side)
    const actorFile = path.join(EVIDENCE_DIR, "06-actor-zoom.png");
    await page.screenshot({
      path: actorFile,
      clip: {
        x: fieldBox.x + fieldBox.width * 0.6,
        y: fieldBox.y,
        width: fieldBox.width * 0.35,
        height: fieldBox.height * 0.6,
      },
    });
    console.log("📸 actor-zoom");
  }

  // Now test with bat swarm
  await page.evaluate(async () => {
    const { closeTestPlayModal } = await import("/src/editor/panels/testPlayModal.ts");
    closeTestPlayModal();
  });
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal("troop_bat_swarm");
  });
  await page.waitForTimeout(2500);
  await shot(page, "bat-swarm-full");

  const field2 = page.locator("[data-testid='battle-field']");
  const fieldBox2 = await field2.boundingBox();
  if (fieldBox2) {
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "08-bat-enemy-zoom.png"),
      clip: {
        x: fieldBox2.x,
        y: fieldBox2.y,
        width: fieldBox2.width * 0.5,
        height: fieldBox2.height,
      },
    });
    console.log("📸 bat-enemy-zoom");
  }

  // Test attack animation smoothness - capture mid-animation
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

  // Click attack and capture at various points
  const atkBtn = page.locator("[data-testid='actor-command-attack']");
  if (await atkBtn.isVisible().catch(() => false)) {
    await atkBtn.click();
    await page.waitForTimeout(300);
    const enemyBtn = page.locator(".battle-enemy:not([disabled])").first();
    if (await enemyBtn.isVisible().catch(() => false)) {
      await enemyBtn.click();
      // Capture at 50ms, 150ms, 300ms, 600ms
      await page.waitForTimeout(50);
      await shot(page, "attack-50ms");
      await page.waitForTimeout(100);
      await shot(page, "attack-150ms");
      await page.waitForTimeout(150);
      await shot(page, "attack-300ms");
      await page.waitForTimeout(300);
      await shot(page, "attack-600ms");
      await page.waitForTimeout(1000);
      await shot(page, "attack-aftermath");
    }
  }

  await browser.close();
  console.log("\n🏁 Zoom comparison complete!");
}

main().catch(console.error);
