import { chromium, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://127.0.0.1:9173";
const EVIDENCE_DIR = path.resolve("evidence/battle-visual-fix");
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

  // Test 1: Golem guard (3 enemies + actor)
  console.log("=== Golem Guard Battle ===");
  await page.evaluate(async () => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal("troop_golem_guard");
  });
  await page.waitForTimeout(2500);
  await shot(page, "golem-guard-position");

  const posCheck = await page.evaluate(() => {
    const enemies = [...document.querySelectorAll(".battle-enemy")];
    const actors = [...document.querySelectorAll(".battle-actor-group .battle-actor")];
    const field = document.querySelector(".battle-field");
    const fieldRect = field?.getBoundingClientRect();
    return {
      fieldRect: fieldRect ? { w: fieldRect.width, h: fieldRect.height } : null,
      enemies: enemies.map(e => {
        const r = e.getBoundingClientRect();
        const img = e.querySelector(".battle-enemy-image") as HTMLImageElement;
        return {
          name: e.querySelector(".battle-enemy-name")?.textContent,
          x: Math.round(r.x - (fieldRect?.x ?? 0)),
          y: Math.round(r.y - (fieldRect?.y ?? 0)),
          w: Math.round(r.width),
          h: Math.round(r.height),
          bottom: Math.round(r.bottom - (fieldRect?.y ?? 0)),
          transform: getComputedStyle(e).transform,
          imgOpacity: img ? getComputedStyle(img).opacity : "no-img",
          imgFilter: img ? getComputedStyle(img).filter : "no-img",
        };
      }),
      actors: actors.map(a => {
        const r = a.getBoundingClientRect();
        return {
          x: Math.round(r.x - (fieldRect?.x ?? 0)),
          y: Math.round(r.y - (fieldRect?.y ?? 0)),
          w: Math.round(r.width),
          h: Math.round(r.height),
          bottom: Math.round(r.bottom - (fieldRect?.y ?? 0)),
          transform: getComputedStyle(a).transform,
        };
      }),
      enemyNameFontSize: getComputedStyle(enemies[0]?.querySelector(".battle-enemy-name") ?? document.body).fontSize,
      enemyHpFontSize: getComputedStyle(enemies[0]?.querySelector(".battle-enemy-hp-text") ?? document.body).fontSize,
    };
  });
  console.log("Position check:", JSON.stringify(posCheck, null, 2));

  await page.evaluate(async () => {
    const { closeTestPlayModal } = await import("/src/editor/panels/testPlayModal.ts");
    closeTestPlayModal();
  });
  await page.waitForTimeout(500);

  // Test 2: Bat swarm (3 bats)
  console.log("\n=== Bat Swarm ===");
  await page.evaluate(async () => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal("troop_bat_swarm");
  });
  await page.waitForTimeout(2500);
  await shot(page, "bat-swarm-position");

  await page.evaluate(async () => {
    const { closeTestPlayModal } = await import("/src/editor/panels/testPlayModal.ts");
    closeTestPlayModal();
  });
  await page.waitForTimeout(500);

  // Test 3: Forest hornets (mixed)
  console.log("\n=== Forest Hornets ===");
  await page.evaluate(async () => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal("troop_forest_hornets");
  });
  await page.waitForTimeout(2500);
  await shot(page, "forest-hornets-position");

  await page.evaluate(async () => {
    const { closeTestPlayModal } = await import("/src/editor/panels/testPlayModal.ts");
    closeTestPlayModal();
  });
  await page.waitForTimeout(500);

  // Test 4: Single slime
  console.log("\n=== Single Slime ===");
  await page.evaluate(async () => {
    const { openTroopBattleTestModal } = await import("/src/editor/panels/testPlayModal.ts");
    await openTroopBattleTestModal("troop_slime");
  });
  await page.waitForTimeout(2500);
  await shot(page, "single-slime-position");

  await page.evaluate(async () => {
    const { closeTestPlayModal } = await import("/src/editor/panels/testPlayModal.ts");
    closeTestPlayModal();
  });

  await browser.close();
  console.log("\n🏁 Visual verification complete!");
}

main().catch(console.error);
