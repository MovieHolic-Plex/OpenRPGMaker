import { expect, test, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(60_000);
test.use({ serviceWorkers: "block" });

type SpawnSprite = { readonly x: number; readonly y: number };
type CharacterDebug = { readonly events: Record<string, SpawnSprite> };

function buildActionProject() {
  const project = createBlankProject();
  project.system.actionCombat = {
    enabled: true,
    hud: { stamina: true, enemyHpBars: "always" },
  };
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("start map missing");
  map.actionCombat = true;
  const troop = project.database.troops[0];
  const enemy = project.database.enemies.find((entry) => entry.id === troop?.members?.[0]?.enemyId ?? troop?.enemyIds[0]);
  if (!troop || !enemy) throw new Error("troop/enemy fixture missing");
  enemy.actionProfile = { contactDamage: 1 };
  enemy.stats = { ...enemy.stats, maxHp: 5 };
  enemy.rewards = { ...enemy.rewards, exp: 7, gold: 3 };
  const start = project.startPos;
  map.fieldSpawns = [{
    id: "spawn_e2e_slime",
    troopId: troop.id,
    area: { x: Math.max(0, start.x - 2), y: Math.max(0, start.y - 2), w: 5, h: 5 },
    maxAlive: 1,
    respawnSec: 60,
    chase: true,
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, direction: "down", pattern: 1 },
  }];
  return project;
}

async function spawnCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const chars = (window as unknown as { __oprnCharacterSprites?: () => CharacterDebug }).__oprnCharacterSprites?.();
    return Object.keys(chars?.events ?? {}).filter((id) => id.includes("__field_spawn__")).length;
  });
}

async function playerPos(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const state = JSON.parse(document.querySelector("[data-testid='runtime-state-json']")?.textContent ?? "{}");
    return state.player;
  });
}

async function nearestSpawnTile(page: Page): Promise<{ tx: number; ty: number } | null> {
  return page.evaluate(() => {
    const chars = (window as unknown as { __oprnCharacterSprites?: () => CharacterDebug }).__oprnCharacterSprites?.();
    const state = JSON.parse(document.querySelector("[data-testid='runtime-state-json']")?.textContent ?? "{}");
    const spawns = Object.values(chars?.events ?? {})
      .filter((s, i) => Object.keys(chars?.events ?? {})[i]?.includes("__field_spawn__"))
      .map((s) => ({ tx: Math.floor(s.x / 16), ty: Math.floor(s.y / 16) }));
    let best: { tx: number; ty: number; d: number } | null = null;
    for (const s of spawns) {
      const d = Math.abs(s.tx - state.player.x) + Math.abs(s.ty - state.player.y);
      if (!best || d < best.d) best = { ...s, d };
    }
    return best ? { tx: best.tx, ty: best.ty } : null;
  });
}

async function stepDir(page: Page, dir: "down" | "left" | "right" | "up"): Promise<void> {
  await page.evaluate((d) => {
    const h = (window as unknown as { __oprnInput?: { dir: (x: string | null) => void } }).__oprnInput;
    h?.dir(d);
  }, dir);
  await page.waitForTimeout(240);
  await page.evaluate(() => {
    const h = (window as unknown as { __oprnInput?: { dir: (x: string | null) => void } }).__oprnInput;
    h?.dir(null);
  });
}

test("action combat: HUD, contact damage, swing kill, EXP grant", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, buildActionProject());

  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await startNewGameFromTitle(page);

  await expect(page.getByTestId("action-hud")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("action-hud-hp-text")).toHaveText(/^\d+\/\d+$/);
  await expect(page.getByTestId("action-hud-stamina-row")).toBeVisible();
  await expect.poll(() => spawnCount(page), { timeout: 10_000 }).toBe(1);
  await page.screenshot({ path: testInfo.outputPath("01-hud-and-spawn.png") });

  const hpText = page.getByTestId("action-hud-hp-text");
  const initialHp = Number((await hpText.textContent() ?? "0/1").split("/")[0]);

  await expect.poll(async () => {
    const text = await hpText.textContent();
    return Number((text ?? "0/1").split("/")[0]);
  }, { timeout: 20_000 }).toBeLessThan(initialHp);
  await page.screenshot({ path: testInfo.outputPath("02-contact-damage.png") });

  for (let i = 0; i < 40; i += 1) {
    const target = await nearestSpawnTile(page);
    const player = await playerPos(page);
    if (!target) break;
    const dist = Math.max(Math.abs(target.tx - player.x), Math.abs(target.ty - player.y));
    if (dist > 1) {
      const dx = target.tx - player.x;
      const dy = target.ty - player.y;
      await stepDir(page, Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
      continue;
    }
    const face = target.tx > player.x ? "right" : target.tx < player.x ? "left" : target.ty > player.y ? "down" : "up";
    await page.evaluate((d) => {
      const h = (window as unknown as { __oprnInput?: { dir: (x: string | null) => void } }).__oprnInput;
      h?.dir(d);
    }, face);
    await page.waitForTimeout(140);
    await page.evaluate(() => {
      const h = (window as unknown as { __oprnInput?: { dir: (x: string | null) => void } }).__oprnInput;
      h?.dir(null);
    });
    await page.evaluate(() => {
      const h = (window as unknown as { __oprnInput?: { attack: () => void } }).__oprnInput;
      h?.attack();
    });
    const before = await spawnCount(page);
    await page.waitForTimeout(430);
    if ((await spawnCount(page)) < before) break;
  }

  const debug = await page.evaluate(() => (window as unknown as { __oprnActionCombat?: () => unknown }).__oprnActionCombat?.());
  console.log("action state after swings:", JSON.stringify(debug));

  await expect.poll(() => spawnCount(page), { timeout: 15_000 }).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("03-kill.png") });

  await expect.poll(async () => {
    return page.evaluate(() => {
      const state = JSON.parse(document.querySelector("[data-testid='runtime-state-json']")?.textContent ?? "{}");
      return Object.values(state.actorExperience ?? {}).reduce((sum, v) => sum + Number(v), 0);
    });
  }, { timeout: 5_000 }).toBeGreaterThanOrEqual(7);
});
