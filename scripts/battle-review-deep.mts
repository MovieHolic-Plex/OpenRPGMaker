import { chromium, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://127.0.0.1:9173";
const EVIDENCE_DIR = path.resolve("evidence/battle-review-deep");
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

async function getBattleInfo(page: Page) {
  return page.evaluate(() => {
    const scene = document.querySelector("[data-testid='battle-scene']");
    const field = document.querySelector("[data-testid='battle-field']");
    const commandGrid = document.querySelector("[data-testid='battle-command-grid']");
    const messageWindow = document.querySelector(".battle-message-window");
    const partyStatus = document.querySelector(".battle-party-status");
    const enemyGroup = document.querySelector(".battle-enemy-group");
    const enemies = [...(enemyGroup?.querySelectorAll(".battle-enemy") ?? [])];
    const backdrop = document.querySelector("[data-testid='battle-backdrop']");
    const resultPanel = document.querySelector("[data-testid='battle-result-panel']");
    const skin = scene?.getAttribute("data-battle-skin");
    const uiStyle = scene?.getAttribute("data-battle-ui-style");
    return {
      hasScene: !!scene,
      hasField: !!field,
      hasCommandGrid: !!commandGrid,
      hasMessageWindow: !!messageWindow,
      hasPartyStatus: !!partyStatus,
      enemyCount: enemies.length,
      enemyNames: enemies.map(e => e.textContent?.trim()),
      enemyHPs: enemies.map(e => {
        const hpBar = e.querySelector(".battle-hp-bar-fill, .hp-bar-fill");
        return hpBar ? (hpBar as HTMLElement).style.width : "no-bar";
      }),
      commandButtons: [...(commandGrid?.querySelectorAll("button") ?? [])].map(b => b.textContent?.trim()),
      messageText: messageWindow?.textContent?.trim(),
      backdropStyle: backdrop?.getAttribute("style")?.substring(0, 200),
      backdropResourceId: backdrop?.getAttribute("data-backdrop-resource-id"),
      hasResult: !!resultPanel,
      resultText: resultPanel?.textContent?.trim()?.substring(0, 300),
      skin,
      uiStyle,
      sceneRect: scene ? { w: scene.clientWidth, h: scene.clientHeight } : null,
      fieldRect: field ? { w: field.clientWidth, h: field.clientHeight } : null,
    };
  });
}

async function clickAttackAndTarget(page: Page) {
  // Click attack
  const attackBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "공격" }).first();
  if (await attackBtn.isVisible().catch(() => false)) {
    await attackBtn.click();
    await page.waitForTimeout(500);
    // Click first target
    const targetBtn = page.locator(".battle-target-menu button, .battle-command-menu button").filter({ hasNotText: "취소" }).first();
    if (await targetBtn.isVisible().catch(() => false)) {
      await targetBtn.click();
      await page.waitForTimeout(2500);
      return true;
    }
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
    if (msg.type() === "warning") consoleWarnings.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  console.log("🚀 Loading editor...");
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Get project info
  const projectInfo = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const p = store.getCurrent();
    return {
      battleFlow: p.system.battleFlow,
      battleUiStyle: p.system.battleUiStyle,
      battleParty: p.system.battleParty,
      monsterBattleParty: p.system.monsterBattleParty,
      troops: p.database.troops.map((t: any) => ({
        id: t.id, name: t.name,
        memberCount: t.members?.length ?? 0,
        enemyIds: t.members?.map((m: any) => m.enemyId) ?? [],
        battleFlow: t.battleFlow,
      })),
      enemies: p.database.enemies.map((e: any) => ({
        id: e.id, name: e.name,
        hp: e.hp, mp: e.mp, attack: e.attack, defense: e.defense,
        speed: e.speed, exp: e.exp, gold: e.gold,
      })),
      actors: p.database.actors.map((a: any) => ({
        id: a.id, name: a.name,
        baseHp: a.baseHp, baseMp: a.baseMp,
        attack: a.attack, defense: a.defense,
        speed: a.speed,
      })),
      skills: p.database.skills.map((s: any) => ({
        id: s.id, name: s.name,
        power: s.power, mpCost: s.mpCost,
        scope: s.scope, kind: s.kind,
      })),
      items: p.database.items.slice(0, 10).map((i: any) => ({
        id: i.id, name: i.name, kind: i.kind,
      })),
    };
  });
  console.log("📋 Project battle data:", JSON.stringify(projectInfo, null, 2));

  // === TEST 1: Multi-enemy battle (동굴 박쥐 떼 - 3 enemies) ===
  console.log("\n=== TEST 1: Multi-enemy battle (troop_bat_swarm) ===");
  await openBattle(page, "troop_bat_swarm");
  await shot(page, "multi-enemy-start");
  let info = await getBattleInfo(page);
  console.log("Multi-enemy state:", JSON.stringify(info, null, 2));

  // Play through
  for (let turn = 0; turn < 5; turn++) {
    const did = await clickAttackAndTarget(page);
    if (!did) break;
    await shot(page, `multi-enemy-turn-${turn + 1}`);
    info = await getBattleInfo(page);
    if (info.hasResult) break;
  }
  console.log("Multi-enemy final:", JSON.stringify(info, null, 2));
  await closeBattle(page);

  // === TEST 2: Skill usage ===
  console.log("\n=== TEST 2: Skill usage (troop_slime) ===");
  await openBattle(page, "troop_slime");
  await shot(page, "skill-test-start");

  // Click skill button
  const skillBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "기술" }).first();
  if (await skillBtn.isVisible().catch(() => false)) {
    await skillBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "skill-submenu");
    
    const skillInfo = await page.evaluate(() => {
      const menu = document.querySelector("[data-testid='battle-command-grid']");
      return {
        buttons: [...(menu?.querySelectorAll("button") ?? [])].map(b => ({
          text: b.textContent?.trim(),
          disabled: b.hasAttribute("disabled"),
          className: b.className,
        })),
      };
    });
    console.log("Skill submenu:", JSON.stringify(skillInfo, null, 2));

    // Click first skill if available
    const firstSkill = page.locator("[data-testid='battle-command-grid'] button").first();
    if (await firstSkill.isVisible().catch(() => false)) {
      await firstSkill.click();
      await page.waitForTimeout(500);
      await shot(page, "skill-target-select");
      
      // Select target
      const tgt = page.locator(".battle-target-menu button, .battle-command-menu button").filter({ hasNotText: "취소" }).first();
      if (await tgt.isVisible().catch(() => false)) {
        await tgt.click();
        await page.waitForTimeout(3000);
        await shot(page, "skill-result");
      }
    }
  }
  info = await getBattleInfo(page);
  console.log("After skill:", JSON.stringify(info, null, 2));
  await closeBattle(page);

  // === TEST 3: Item usage ===
  console.log("\n=== TEST 3: Item usage ===");
  await openBattle(page, "troop_slime");
  await page.waitForTimeout(1000);
  
  const itemBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "아이템" }).first();
  if (await itemBtn.isVisible().catch(() => false)) {
    await itemBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "item-submenu");
    
    const itemInfo = await page.evaluate(() => {
      const menu = document.querySelector("[data-testid='battle-command-grid']");
      return {
        buttons: [...(menu?.querySelectorAll("button") ?? [])].map(b => ({
          text: b.textContent?.trim(),
          disabled: b.hasAttribute("disabled"),
        })),
      };
    });
    console.log("Item submenu:", JSON.stringify(itemInfo, null, 2));
  }
  await closeBattle(page);

  // === TEST 4: Flee ===
  console.log("\n=== TEST 4: Flee attempt ===");
  await openBattle(page, "troop_slime");
  await page.waitForTimeout(1000);
  
  const fleeBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "도주" }).first();
  if (await fleeBtn.isVisible().catch(() => false)) {
    await fleeBtn.click();
    await page.waitForTimeout(2000);
    await shot(page, "flee-result");
    info = await getBattleInfo(page);
    console.log("Flee result:", JSON.stringify(info, null, 2));
  }
  await closeBattle(page);

  // === TEST 5: Defend ===
  console.log("\n=== TEST 5: Defend ===");
  await openBattle(page, "troop_golem_guard");
  await page.waitForTimeout(1000);
  await shot(page, "golem-battle-start");
  info = await getBattleInfo(page);
  console.log("Golem battle:", JSON.stringify(info, null, 2));

  const defendBtn = page.locator("[data-testid='battle-command-grid'] button").filter({ hasText: "방어" }).first();
  if (await defendBtn.isVisible().catch(() => false)) {
    await defendBtn.click();
    await page.waitForTimeout(3000);
    await shot(page, "defend-result");
    info = await getBattleInfo(page);
    console.log("After defend:", JSON.stringify(info, null, 2));
  }
  await closeBattle(page);

  // === TEST 6: Visual/CSS analysis ===
  console.log("\n=== TEST 6: Visual analysis ===");
  await openBattle(page, "troop_forest_hornets");
  await page.waitForTimeout(1500);
  await shot(page, "forest-hornets-visual");
  
  const visualAnalysis = await page.evaluate(() => {
    const scene = document.querySelector("[data-testid='battle-scene']") as HTMLElement;
    const field = document.querySelector("[data-testid='battle-field']") as HTMLElement;
    const msgWin = document.querySelector(".battle-message-window") as HTMLElement;
    const cmdPanel = document.querySelector(".battle-command-panel") as HTMLElement;
    const enemies = [...document.querySelectorAll(".battle-enemy")];
    
    const getStyles = (el: HTMLElement | null) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        width: cs.width, height: cs.height,
        fontSize: cs.fontSize, fontFamily: cs.fontFamily,
        color: cs.color, backgroundColor: cs.backgroundColor,
        border: cs.border, borderRadius: cs.borderRadius,
        padding: cs.padding, margin: cs.margin,
        position: cs.position, display: cs.display,
        overflow: cs.overflow,
        zIndex: cs.zIndex,
      };
    };

    return {
      scene: getStyles(scene),
      field: getStyles(field),
      messageWindow: getStyles(msgWin),
      commandPanel: getStyles(cmdPanel),
      enemyPositions: enemies.map(e => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }),
      sceneChildren: scene ? [...scene.children].map(c => ({
        tag: c.tagName,
        class: c.className,
        testid: c.getAttribute("data-testid"),
        visible: (c as HTMLElement).offsetParent !== null,
        rect: { w: c.clientWidth, h: c.clientHeight },
      })) : [],
    };
  });
  console.log("Visual analysis:", JSON.stringify(visualAnalysis, null, 2));
  await closeBattle(page);

  // === TEST 7: Battle with different skins ===
  console.log("\n=== TEST 7: Battle skin check ===");
  const skinInfo = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const p = store.getCurrent();
    return {
      currentSkin: p.system.battleUiStyle,
      availableSkins: ["classic", "ff", "dragonquest", "pokemon", "chrono", "bravely", "goldensun", "octopath", "mother", "rm2000"],
    };
  });
  console.log("Skin info:", JSON.stringify(skinInfo));

  // === TEST 8: Rapid button mashing ===
  console.log("\n=== TEST 8: Rapid input stress test ===");
  await openBattle(page, "troop_slime_pair");
  await page.waitForTimeout(1000);
  
  // Mash buttons rapidly
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("z");
    await page.keyboard.press("Enter");
    await page.keyboard.press(" ");
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(2000);
  await shot(page, "stress-test-result");
  info = await getBattleInfo(page);
  console.log("After stress test:", JSON.stringify(info, null, 2));
  await closeBattle(page);

  // === TEST 9: Keyboard navigation ===
  console.log("\n=== TEST 9: Keyboard navigation ===");
  await openBattle(page, "troop_slime");
  await page.waitForTimeout(1000);
  
  // Try arrow keys and Enter
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(200);
  await shot(page, "keyboard-nav-1");
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);
  await shot(page, "keyboard-nav-2");
  
  // Press Enter to select
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await shot(page, "keyboard-nav-3");
  await closeBattle(page);

  // === TEST 10: Battle transition animation ===
  console.log("\n=== TEST 10: Full battle flow timing ===");
  await openBattle(page, "troop_golem_guard");
  const startTime = Date.now();
  await page.waitForTimeout(500);
  
  // Time the full battle
  let turnCount = 0;
  while (Date.now() - startTime < 30000) {
    const did = await clickAttackAndTarget(page);
    if (!did) break;
    turnCount++;
    info = await getBattleInfo(page);
    if (info.hasResult) break;
    await page.waitForTimeout(500);
  }
  const battleDuration = Date.now() - startTime;
  await shot(page, "full-battle-complete");
  console.log(`Battle took ${battleDuration}ms, ${turnCount} player turns`);
  info = await getBattleInfo(page);
  console.log("Full battle result:", JSON.stringify(info, null, 2));
  await closeBattle(page);

  // Summary
  console.log("\n========== SUMMARY ==========");
  console.log(`Console errors: ${consoleErrors.length}`);
  consoleErrors.slice(0, 10).forEach(e => console.log(`  ❌ ${e}`));
  console.log(`Console warnings: ${consoleWarnings.length}`);
  consoleWarnings.slice(0, 5).forEach(w => console.log(`  ⚠️ ${w}`));

  await browser.close();
  console.log("\n🏁 Deep battle review complete!");
}

main().catch(console.error);
