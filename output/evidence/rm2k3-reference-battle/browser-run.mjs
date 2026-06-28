import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const outDir = new URL("./", import.meta.url);
const route = "http://127.0.0.1:5173/";
const fixture = referenceFixture(JSON.parse(await readFile(new URL("../../../test/fixtures/projects/battle-v3.json", import.meta.url), "utf8")));

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: false });
try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await desktop.newPage();
  await seed(page);
  await enterBattle(page);
  await page.screenshot({ path: file("desktop-reference-entry.png"), fullPage: true });
  await writeJson("desktop-reference-state.json", await referenceState(page));
  assertReferenceState(await referenceState(page), "desktop");
  await page.getByTestId("actor-command-skill").click();
  await page.getByTestId("battle-animation").waitFor({ state: "visible", timeout: 5000 });
  await page.screenshot({ path: file("desktop-reference-skill.png"), fullPage: true });
  await playToVictory(page);
  await writeJson("runtime-after.json", await runtimeState(page));
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mobilePage = await mobile.newPage();
  await seed(mobilePage);
  await enterBattle(mobilePage);
  await mobilePage.screenshot({ path: file("mobile-reference-entry.png"), fullPage: true });
  const mobileState = await referenceState(mobilePage);
  await writeJson("mobile-reference-state.json", mobileState);
  assertReferenceState(mobileState, "mobile");
  await mobile.close();
} finally {
  await browser.close();
}

function referenceFixture(project) {
  const actorBase = project.database.actors[0];
  const names = ["Zack", "Albert", "Burns", "Klaus"];
  const battleResourceIds = [
    "generated-actor-hero-01-battle",
    "generated-actor-hero-02-battle",
    "generated-actor-hero-03-battle",
    "generated-actor-hero-04-battle",
  ];
  const fire = project.database.skills.find((skill) => skill.id === "skill_fire");
  if (fire) {
    fire.power = 999;
    fire.scope = "allEnemies";
  }
  project.database.actors = names.map((name, index) => ({
    ...actorBase,
    id: `actor_${name.toLowerCase()}`,
    name,
    battleCharacterResourceId: battleResourceIds[index],
    skillIds: ["skill_fire"],
    parameterCurves: {
      maxHp: Array.from({ length: 99 }, () => 385 - index * 23),
      maxMp: Array.from({ length: 99 }, () => 43),
      attack: Array.from({ length: 99 }, () => 160),
      defense: Array.from({ length: 99 }, () => 28),
      mind: Array.from({ length: 99 }, () => 64),
      agility: Array.from({ length: 99 }, () => 42 + index * 4),
    },
  }));
  const slime = project.database.enemies.find((enemy) => enemy.id === "enemy_slime");
  if (!slime) throw new Error("missing enemy_slime");
  const weakStats = { ...slime.stats, maxHp: 1, attack: 1, defense: 1, mind: 1, agility: 1 };
  project.database.enemies = [
    { ...slime, id: "enemy_slime_a", name: "Slime", monsterResourceId: "generated-enemy-slime-01", stats: weakStats },
    { ...slime, id: "enemy_slime_b", name: "Slime", monsterResourceId: "generated-enemy-ontology-8da61312", stats: weakStats },
    { ...slime, id: "enemy_sylph_a", name: "Sylph", monsterResourceId: "generated-enemy-sylph-hornet", stats: weakStats },
    { ...slime, id: "enemy_sylph_b", name: "Sylph", monsterResourceId: "generated-enemy-sylph-hornet", stats: weakStats },
  ];
  const troop = project.database.troops.find((record) => record.id === "troop_slime");
  troop.enemyIds = ["enemy_sylph_a", "enemy_sylph_b", "enemy_slime_a", "enemy_slime_b"];
  troop.members = [
    { enemyId: "enemy_sylph_a", x: 60, y: 64, hidden: false },
    { enemyId: "enemy_sylph_b", x: 28, y: 112, hidden: false },
    { enemyId: "enemy_slime_a", x: 112, y: 118, hidden: false },
    { enemyId: "enemy_slime_b", x: 64, y: 166, hidden: false },
  ];
  troop.previewBackgroundResourceId = undefined;
  project.system.initialTroopId = "troop_slime";
  project.system.startActorIds = project.database.actors.map((actor) => actor.id);
  project.session.partyActorIds = project.system.startActorIds;
  return project;
}

async function seed(page) {
  await page.addInitScript((project) => {
    window.__RPG_ZZU_E2E_PROJECT__ = project;
    window.localStorage.clear();
  }, fixture);
  await page.goto(route);
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 15000 });
  const modal = page.getByTestId("event-editor-modal");
  if (await modal.count()) {
    await page.keyboard.press("Escape");
  }
}

async function enterBattle(page) {
  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await page.locator('[data-testid="event-battle-start"]').click();
  await page.getByTestId("battle-scene").waitFor({ state: "visible", timeout: 10000 });
}

async function runtimeState(page) {
  return JSON.parse(await page.getByTestId("runtime-state-json").textContent());
}

async function playToVictory(page) {
  for (let turn = 0; turn < 10; turn += 1) {
    await page.waitForFunction(() => {
      const state = JSON.parse(document.querySelector("[data-testid='runtime-state-json']")?.textContent ?? "{}");
      return state.battleResult === "victory" || document.querySelector("[data-testid='actor-command-skill']") !== null;
    }, undefined, { timeout: 10000 });
    const state = await runtimeState(page);
    if (state.battleResult === "victory") return;
    await page.getByTestId("actor-command-skill").click();
  }
  const state = await runtimeState(page);
  throw new Error(`battle did not reach victory: ${JSON.stringify(state.battleResult ?? null)}`);
}

async function referenceState(page) {
  return page.evaluate(() => {
    const rect = (node) => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const actors = Array.from(document.querySelectorAll(".battle-actor[data-testid^='battle-actor-']")).map((node) => ({
      ...rect(node),
      resourceId: node.getAttribute("data-battle-charset-resource-id"),
      facing: node.getAttribute("data-facing"),
      name: node.getAttribute("aria-label"),
    }));
    const enemies = Array.from(document.querySelectorAll("[data-testid^='enemy-']")).map((node) => ({
      ...rect(node),
      resourceId: node.getAttribute("data-monster-resource-id"),
      facing: node.getAttribute("data-facing"),
    }));
    const enemyList = Array.from(document.querySelectorAll(".battle-enemy-list-row")).map((node) => node.textContent?.trim());
    const icons = Array.from(document.querySelectorAll(".battle-status-icon")).map((node) => rect(node));
    const actorRows = Array.from(document.querySelectorAll(".battle-actor-status")).map((node) => node.textContent?.trim());
    const scene = rect(document.querySelector("[data-testid='battle-scene']"));
    const field = rect(document.querySelector(".battle-field"));
    const leftHud = rect(document.querySelector(".battle-command-panel"));
    const rightHud = rect(document.querySelector("[data-testid='battle-party']"));
    return { actors, enemies, enemyList, icons, actorRows, scene, field, leftHud, rightHud };
  });
}

function assertReferenceState(state, label) {
  if (state.actors.length !== 4) throw new Error(`${label}: expected 4 actor sprites, got ${state.actors.length}`);
  if (state.enemies.length !== 4) throw new Error(`${label}: expected 4 enemies, got ${state.enemies.length}`);
  if (new Set(state.actors.map((actor) => actor.resourceId)).size !== 4) {
    throw new Error(`${label}: expected 4 distinct actor battle resources, got ${state.actors.map((actor) => actor.resourceId).join(", ")}`);
  }
  if (!state.actors.every((actor) => actor.facing === "left")) throw new Error(`${label}: actors are not facing left`);
  if (!state.enemies.every((enemy) => enemy.facing === "right")) throw new Error(`${label}: enemies are not facing right`);
  if (state.actorRows.length !== 4) throw new Error(`${label}: expected 4 actor status rows, got ${state.actorRows.length}`);
  if (state.enemyList.length !== 4) throw new Error(`${label}: expected 4 enemy list rows, got ${state.enemyList.length}`);
  if (state.icons.length < 4) throw new Error(`${label}: expected visible state icons, got ${state.icons.length}`);
  if (!state.enemies.every((enemy) => enemy.right < state.actors[0].left)) throw new Error(`${label}: enemies are not left of actors`);
  if (!(state.leftHud.left < state.rightHud.left && Math.abs(state.leftHud.top - state.rightHud.top) < 8)) throw new Error(`${label}: HUD split mismatch`);
  if (state.actorRows.some((row) => !row || !/HP|T/.test(row))) throw new Error(`${label}: actor HUD text is not readable: ${state.actorRows.join(" | ")}`);
}

async function writeJson(name, value) {
  await writeFile(new URL(name, outDir), `${JSON.stringify(value, null, 2)}\n`);
}

function file(name) {
  return new URL(name, outDir).pathname.replace(/^\/([A-Za-z]:)/, "$1");
}
