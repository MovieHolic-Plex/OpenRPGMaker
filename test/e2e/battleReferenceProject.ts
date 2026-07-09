import { expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { deserialize } from "@/project/io";
import { reseedSessionRng } from "@/project/session";
import type { PlaySessionLike } from "@/player/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

type BattleProject = ReturnType<typeof deserialize>;

const referenceActors = [
  { id: "actor_hero", name: "아린", battleResourceId: "generated-actor-hero-01-battle", faceResourceId: "generated-actor-hero-01-face" },
  { id: "actor_guardian", name: "수호자", battleResourceId: "generated-actor-hero-02-battle", faceResourceId: "generated-actor-hero-02-face" },
  { id: "actor_mage", name: "마도사", battleResourceId: "generated-actor-hero-03-battle", faceResourceId: "generated-actor-hero-03-face" },
  { id: "actor_scout", name: "정찰병", battleResourceId: "generated-actor-hero-04-battle", faceResourceId: "easyrpg-faceset-people2" },
] as const;

export async function seedReferenceBattleProject(page: Page): Promise<void> {
  const fixture = await readFile(new URL("../fixtures/projects/battle-v3.json", import.meta.url), "utf8");
  const project = deserialize(fixture);
  prepareReferenceBattleProject(project);
  await seedProjectFromSupabaseCanonical(page, project);
}

export async function seedLayoutResultBattleProject(page: Page): Promise<void> {
  const fixture = await readFile(new URL("../fixtures/projects/battle-v3.json", import.meta.url), "utf8");
  const project = deserialize(fixture);
  prepareReferenceBattleProject(project);
  const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
  if (!enemy) throw new Error("missing enemy_slime fixture");
  enemy.stats.maxHp = 14;
  await seedProjectFromSupabaseCanonical(page, project);
}

export function prepareReferenceBattleProject(project: BattleProject): void {
  setReferenceBattleback(project);
  setReferenceEnemy(project);
  ensureReferenceParty(project);
  reseedSessionRng(project.session as unknown as PlaySessionLike, 42_001);
}

export async function startReferenceBattle(page: Page): Promise<void> {
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.locator('[data-testid="event-battle-start"]')).toBeVisible({ timeout: 5_000 });
  await page.click('[data-testid="event-battle-start"]');
  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("battle-enemy-hp-enemy-1")).toBeVisible({ timeout: 5_000 });
}

export async function confirmBattleTarget(page: Page, enemyId = "enemy-1"): Promise<void> {
  const scene = page.getByTestId("battle-scene");
  const fieldTarget = scene.locator(`.battle-enemy[data-testid='${enemyId}'][data-battle-targetable='true']`);
  if (await fieldTarget.count()) {
    await fieldTarget.click();
    return;
  }
  await scene.getByTestId(`battle-target-${enemyId}`).click();
}

export async function waitForActorCommand(page: Page): Promise<void> {
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "actorCommand", { timeout: 45_000 });
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 5_000 });
}

export async function performBattleAttack(page: Page, enemyId = "enemy-1"): Promise<void> {
  await waitForActorCommand(page);
  await page.getByTestId("actor-command-attack").click();
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "targetSelect");
  await confirmBattleTarget(page, enemyId);
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-director-step", /acting|impact|result/, { timeout: 10_000 });
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-sequence-busy", "false", { timeout: 20_000 });
}

export async function performBattleSkill(page: Page, enemyId = "enemy-1"): Promise<void> {
  await waitForActorCommand(page);
  await expect(page.getByTestId("actor-command-skill")).toBeVisible({ timeout: 5_000 });
  await page.getByTestId("actor-command-skill").click();
  const skillButton = page.getByTestId("actor-skill-skill_fire");
  if (await skillButton.count()) {
    await skillButton.click();
  }
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "targetSelect", { timeout: 10_000 });
  await confirmBattleTarget(page, enemyId);
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-director-step", /acting|impact|result/, { timeout: 10_000 });
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-sequence-busy", "false", { timeout: 20_000 });
}

function ensureReferenceParty(project: BattleProject): void {
  const hero = project.database.actors[0];
  if (!hero) throw new Error("missing actor fixture");
  project.database.actors = referenceActors.map((actor) => ({
    ...hero,
    id: actor.id,
    name: actor.name,
    faceResourceId: actor.faceResourceId,
    battleCharacterResourceId: actor.battleResourceId,
  }));
  project.session.partyActorIds = referenceActors.map((actor) => actor.id);
}

function setReferenceBattleback(project: BattleProject): void {
  const troop = project.database.troops.find((record) => record.id === "troop_slime");
  if (!troop) throw new Error("missing troop_slime fixture");
  troop.previewBackgroundResourceId = "easyrpg-backdrop-sky1";
  troop.enemyIds = ["enemy_slime"];
  troop.members = [{ enemyId: "enemy_slime", x: 112, y: 122, hidden: false }];
}

function setReferenceEnemy(project: BattleProject): void {
  const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
  if (!enemy) throw new Error("missing enemy_slime fixture");
  enemy.name = "달빛 숲 파수군";
  enemy.monsterResourceId = "generated-enemy-sylph-hornet";
  enemy.stats.maxHp = 220;
  enemy.stats.maxMp = 0;
  enemy.stats.attack = 12;
  enemy.stats.defense = 8;
  enemy.stats.mind = 9;
  enemy.stats.agility = 8;
  enemy.rewards = { ...enemy.rewards, exp: 12, gold: 7 };
}
