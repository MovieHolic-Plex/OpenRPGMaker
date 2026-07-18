import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { listBattleSkinIds } from "@/battle/skins/registry";
import {
  seedReferenceBattleProject,
  waitForActorCommand,
} from "./battleReferenceProject";
import { startNewGameFromTitle } from "./runtimeInput";
import {
  DATABASE_TAB_SPECS,
  applyDatabaseChanges,
  openDatabase,
  switchDatabaseTab,
} from "./rm2k3-database-helpers";

const OUT = "output/evidence/battle-skins";
const SYSTEM_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "system")!;

type SkinDiag = {
  present: boolean;
  skin?: string | null;
  overflowX?: number;
  overflowY?: number;
  clipped?: boolean;
  enemies?: number;
  /** true = another element covers the field enemy's center (pointer blocked) — QA datum for Task 8 */
  enemyPointerBlocked?: boolean;
  /** field size + rendered sprite rects (ground truth for battler placement tuning). */
  field?: { w: number; h: number } | null;
  partySprites?: { w: number; h: number; x: number; y: number }[];
  enemySprite?: { w: number; h: number; x: number; y: number } | null;
};

/**
 * No browser-global store is exposed (grep for window.*store/__rpgStore found
 * nothing), so the skin is applied through the real editor UI: the DB System
 * tab's battle-UI-style select (Task 5), then Apply + OK before entering play.
 */
async function applySkinViaDatabase(page: Page, skin: string): Promise<void> {
  await openDatabase(page);
  await switchDatabaseTab(page, SYSTEM_TAB);
  await page.getByTestId("db-field-system-battle-ui-style").selectOption(skin);
  await applyDatabaseChanges(page);
  await page.getByTestId("database-footer-ok").click();
  await expect(page.getByTestId("database-modal")).toBeHidden();
}

/**
 * Same boot beats as startReferenceBattle, but skin-tolerant: the pokemon skin
 * hides the in-field enemy HP HUD via CSS (battle.css `.battle-enemy-hud
 * { display: none }`), so the enemy HP node is asserted attached, not visible.
 */
async function startSkinBattle(page: Page): Promise<void> {
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.locator('[data-testid="event-battle-start"]')).toBeVisible({ timeout: 5_000 });
  await page.click('[data-testid="event-battle-start"]');
  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("battle-enemy-hp-enemy-1")).toBeAttached({ timeout: 5_000 });
}

/**
 * Attack beat via keyboard confirm ("z" confirms the selected target on a
 * window-level keydown listener) — skin-agnostic, unlike a pointer click on
 * the field enemy, which the pokemon skin's party panel overlaps.
 */
async function performSkinAttack(page: Page): Promise<void> {
  await waitForActorCommand(page);
  await page.getByTestId("actor-command-attack").click();
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "targetSelect");
  await page.keyboard.press("z");
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-director-step", /acting|impact|result/, { timeout: 10_000 });
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-sequence-busy", "false", { timeout: 20_000 });
}

async function diag(page: Page): Promise<SkinDiag> {
  return page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
    if (!scene) return { present: false };
    const overflowX = scene.scrollWidth - scene.clientWidth;
    const overflowY = scene.scrollHeight - scene.clientHeight;
    return {
      present: true,
      skin: scene.dataset.battleSkin ?? null,
      overflowX,
      overflowY,
      clipped: overflowX > 2 || overflowY > 2,
      enemies: document.querySelectorAll(".battle-enemy").length,
      field: (() => { const el = document.querySelector(".battle-field"); if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })(),
      partySprites: [...document.querySelectorAll(".battle-actor .battle-skin-actor-image")].map((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) }; }),
      enemySprite: (() => { const el = document.querySelector(".battle-enemy .battle-enemy-image"); if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) }; })(),
      partyImgCss: (() => { const el = document.querySelector<HTMLElement>(".battle-actor .battle-skin-actor-image"); if (!el) return "NO-SKIN-IMG"; const cs = getComputedStyle(el); const node = el.closest<HTMLElement>(".battle-actor"); return { cssW: cs.width, cssH: cs.height, cls: el.className, nodeTransform: node ? getComputedStyle(node).transform : "?", nodeScaleVar: node ? node.style.getPropertyValue("--battle-actor-scale") : "?" }; })(),
      enemyPointerBlocked: (() => {
        const enemy = document.querySelector<HTMLElement>(".battle-enemy");
        if (!enemy) return false;
        const rect = enemy.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit !== null && hit !== enemy && !enemy.contains(hit);
      })(),
    };
  });
}

for (const skin of listBattleSkinIds()) {
  test(`battle skin visual QA — ${skin}`, async ({ page }) => {
    test.setTimeout(120_000);
    const dir = `${OUT}/${skin}`;
    await mkdir(dir, { recursive: true });
    await page.setViewportSize({ width: 1360, height: 768 });
    await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));

    // seedReferenceBattleProject performs its own page.goto("/")
    await seedReferenceBattleProject(page);
    await applySkinViaDatabase(page, skin);
    await startSkinBattle(page);

    const scene = page.getByTestId("battle-scene");
    await expect(scene).toHaveAttribute("data-battle-skin", skin);
    await page.screenshot({ path: `${dir}/01-intro.png`, fullPage: true });

    await waitForActorCommand(page);
    await page.screenshot({ path: `${dir}/02-command.png`, fullPage: true });

    await performSkinAttack(page);
    await page.screenshot({ path: `${dir}/04-attack-impact.png`, fullPage: true });

    const d = await diag(page);
    await writeFile(`${dir}/diag.json`, `${JSON.stringify(d, null, 2)}\n`, "utf8");
    expect(d.present, `${skin}: battle-scene missing`).toBe(true);
    expect(d.skin, `${skin}: skin attribute mismatch after battle`).toBe(skin);
    expect(d.clipped, `${skin}: content clipped (${d.overflowX}x${d.overflowY})`).toBe(false);
  });
}
