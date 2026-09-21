import { expect, test, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectForEditor } from "./projectSeed";

test.setTimeout(90_000);
test.use({ serviceWorkers: "block" });

type SpawnSprite = { readonly x: number; readonly y: number };
type CharacterDebug = { readonly events: Record<string, SpawnSprite> };
type DebugHook = {
  teleport: (mapId: string, x: number, y: number) => void;
  readState: () => { inventory: Record<string, number>; switches: Record<string, boolean> };
};
type InputHook = { action: () => void; attack: () => void; skill: () => void; dir: (d: string | null) => void };

const AMMO_ID = "item_e2e_9mm";
const GUN_SKILL_ID = "skill_e2e_handgun";
const KILL_SWITCH = "sw_e2e_kill";

function buildSurvivalProject() {
  const project = createBlankProject();
  project.system.actionCombat = { enabled: true, hud: { stamina: true, enemyHpBars: "always" } };
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("start map missing");
  map.actionCombat = true;
  const troop = project.database.troops[0];
  const enemy = project.database.enemies.find((entry) => entry.id === troop?.members?.[0]?.enemyId ?? troop?.enemyIds[0]);
  if (!troop || !enemy) throw new Error("troop/enemy fixture missing");
  enemy.stats = { ...enemy.stats, maxHp: 1 };
  enemy.rewards = { ...enemy.rewards, exp: 0, gold: 0 };

  project.database.items.push(normalizeItemRecord({
    id: AMMO_ID, name: "9mm", description: "", scope: "none", price: 1, type: "normal",
    occasion: "never", consumable: false,
  }));
  project.database.skills.push(normalizeSkillRecord({
    id: GUN_SKILL_ID, name: "권총", description: "",
    mpCost: { flat: 0, percentMax: 0 },
    actionSkill: { kind: "projectile", damage: 3, range: 6, itemCost: { itemId: AMMO_ID, amount: 1 } },
  }));
  const hero = project.database.actors[0];
  if (!hero) throw new Error("hero missing");
  hero.learnedSkills = [{ level: 1, skillId: GUN_SKILL_ID }];
  project.session.inventory = { ...(project.session.inventory ?? {}), [AMMO_ID]: 2 };

  const start = project.startPos;
  map.fieldSpawns = [{
    id: "spawn_e2e_persist",
    troopId: troop.id,
    area: { x: Math.max(0, start.x - 3), y: Math.max(0, start.y - 3), w: 5, h: 5 },
    maxAlive: 1,
    respawnSec: 60,
    chase: true,
    persistKill: true,
    onKillSwitchId: KILL_SWITCH,
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, direction: "down", pattern: 1 },
  }];
  map.events = [...map.events, {
    id: "ev_e2e_typewriter",
    x: start.x + 1,
    y: start.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: "ev_e2e_typewriter_page",
      name: "typewriter",
      conditions: [],
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, direction: "down", pattern: 36 },
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: true,
      animationType: "fixedGraphic",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "openSaveMenu" }],
    }],
  }];
  return { project, start, mapId: map.id };
}

function hooks(page: Page) {
  return {
    debug: () => page.evaluate(() => (window as unknown as { __oprnDebug?: DebugHook }).__oprnDebug!.readState()),
    skill: () => page.evaluate(() => (window as unknown as { __oprnInput?: InputHook }).__oprnInput?.skill()),
    action: () => page.evaluate(() => (window as unknown as { __oprnInput?: InputHook }).__oprnInput?.action()),
    attack: () => page.evaluate(() => (window as unknown as { __oprnInput?: InputHook }).__oprnInput?.attack()),
    teleport: (mapId: string, x: number, y: number) =>
      page.evaluate(([m, tx, ty]) => (window as unknown as { __oprnDebug?: DebugHook }).__oprnDebug?.teleport(m as string, tx as number, ty as number), [mapId, x, y]),
    faceDir: async (d: string) => {
      await page.evaluate((dir) => (window as unknown as { __oprnInput?: InputHook }).__oprnInput?.dir(dir), d);
      await page.waitForTimeout(140);
      await page.evaluate(() => (window as unknown as { __oprnInput?: InputHook }).__oprnInput?.dir(null));
    },
    projectiles: () => page.evaluate(() => {
      const state = (window as unknown as { __oprnActionCombat?: () => { projectiles?: number } | null }).__oprnActionCombat?.();
      return state?.projectiles ?? 0;
    }),
    spawnCount: () => page.evaluate(() => {
      const chars = (window as unknown as { __oprnCharacterSprites?: () => CharacterDebug }).__oprnCharacterSprites?.();
      return Object.keys(chars?.events ?? {}).filter((id) => id.includes("__field_spawn__")).length;
    }),
    nearestSpawnTile: () => page.evaluate(() => {
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
      return best ? { tx: best.tx, ty: best.ty, player: state.player as { x: number; y: number } } : null;
    }),
  };
}

test("survival: ammo economy, typewriter save menu, persistent kill", async ({ page }, testInfo) => {
  await page.addInitScript(() => window.localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1280, height: 900 });
  const { project, start, mapId } = buildSurvivalProject();
  await seedProjectForEditor(page, project);

  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("action-hud")).toBeVisible({ timeout: 10_000 });
  const h = hooks(page);

  expect((await h.debug()).inventory[AMMO_ID]).toBe(2);

  await h.skill();
  await page.waitForTimeout(300);
  expect(await h.projectiles()).toBeGreaterThan(0);
  expect((await h.debug()).inventory[AMMO_ID]).toBe(1);

  await expect.poll(() => h.projectiles(), { timeout: 8_000 }).toBe(0);
  await h.skill();
  await page.waitForTimeout(300);
  expect((await h.debug()).inventory[AMMO_ID]).toBe(0);

  await expect.poll(() => h.projectiles(), { timeout: 8_000 }).toBe(0);
  await h.skill();
  await page.waitForTimeout(400);
  expect(await h.projectiles()).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("01-ammo-empty-blocked.png") });

  await h.teleport(mapId, start.x, start.y);
  await page.waitForTimeout(600);
  await h.faceDir("right");
  await h.action();
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId("main-menu")).toContainText("저장");
  await page.screenshot({ path: testInfo.outputPath("02-typewriter-save-menu.png") });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  await expect.poll(() => h.spawnCount(), { timeout: 10_000 }).toBe(1);
  for (let i = 0; i < 40; i += 1) {
    const target = await h.nearestSpawnTile();
    if (!target) break;
    const dist = Math.max(Math.abs(target.tx - target.player.x), Math.abs(target.ty - target.player.y));
    if (dist > 1) {
      const dx = target.tx - target.player.x;
      const dy = target.ty - target.player.y;
      await h.faceDir(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
      continue;
    }
    await h.faceDir(target.tx > target.player.x ? "right" : target.tx < target.player.x ? "left" : target.ty > target.player.y ? "down" : "up");
    await h.attack();
    await page.waitForTimeout(450);
    if ((await h.spawnCount()) === 0) break;
  }
  await expect.poll(() => h.spawnCount(), { timeout: 15_000 }).toBe(0);
  expect((await h.debug()).switches[KILL_SWITCH]).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("03-persistent-kill.png") });

  await h.teleport(mapId, start.x, start.y);
  await page.waitForTimeout(800);
  expect(await h.spawnCount()).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("04-room-stays-cleared.png") });
});
