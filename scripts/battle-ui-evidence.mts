/**
 * scripts/battle-ui-evidence.mts
 *
 * Drives the real editor -> play mode -> reference battle in headless Chromium
 * and captures battle UI evidence (full stage + HUD close-ups + computed font
 * metrics) for the three main phases: command, target-select, result.
 *
 * Usage:
 *   npx vite-node scripts/battle-ui-evidence.mts <label>
 * e.g.
 *   npx vite-node scripts/battle-ui-evidence.mts before
 *   npx vite-node scripts/battle-ui-evidence.mts after
 *
 * Requires the dev server on 127.0.0.1:9173 (playwright.config webServer URL).
 * Output: evidence/browser-screenshots/<ts>-battle-ui-<label>/
 */
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { deserialize } from "@/project/io";
import { reseedSessionRng } from "@/project/session";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"

const BASE_URL = "http://127.0.0.1:9173";
const label = process.argv[2] ?? "shot";
const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
const OUT = `evidence/browser-screenshots/${stamp}-battle-ui-${label}`;

const referenceActors = [
  { id: "actor_hero", name: "히로", battleResourceId: "generated-actor-hero-01-battle", faceResourceId: "generated-actor-hero-01-face" },
  { id: "actor_guardian", name: "가디언", battleResourceId: "generated-actor-hero-02-battle", faceResourceId: "generated-actor-hero-02-face" },
  { id: "actor_mage", name: "메이지", battleResourceId: "generated-actor-hero-03-battle", faceResourceId: "generated-actor-hero-03-face" },
  { id: "actor_scout", name: "스카우트", battleResourceId: "generated-actor-hero-04-battle", faceResourceId: "easyrpg-faceset-people2" },
] as const;

async function buildSeedProject(): Promise<unknown> {
  const fixture = await readFile(new URL("../test/fixtures/projects/battle-v3.json", import.meta.url), "utf8");
  const project = deserialize(fixture);
  const troop = project.database.troops.find((record) => record.id === "troop_slime");
  if (!troop) throw new Error("missing troop_slime fixture");
  troop.previewBackgroundResourceId = "easyrpg-backdrop-sky1";
  troop.enemyIds = ["enemy_slime"];
  troop.members = [{ enemyId: "enemy_slime", x: 112, y: 122, hidden: false }];
  const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
  if (!enemy) throw new Error("missing enemy_slime fixture");
  enemy.name = "숲 말벌";
  enemy.monsterResourceId = "generated-enemy-sylph-hornet";
  // Low HP so a single attack resolves the fight and the result panel appears.
  enemy.stats.maxHp = 14;
  enemy.stats.maxMp = 0;
  enemy.stats.attack = 12;
  enemy.stats.defense = 8;
  enemy.stats.mind = 9;
  enemy.stats.agility = 8;
  enemy.rewards = { ...enemy.rewards, exp: 12, gold: 7 };
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
  reseedSessionRng(project.session as unknown as PlaySessionLike, 42_001);
  return project;
}

type FontMetric = {
  selector: string;
  testId?: string;
  text: string;
  fontSize: string;
  fontFamily: string;
  color: string;
  w: number;
  h: number;
};

async function collectFontMetrics(page: import("@playwright/test").Page): Promise<FontMetric[]> {
  return page.evaluate(() => {
    const pick = (selector: string): HTMLElement | null => document.querySelector<HTMLElement>(selector);
    const byTestId = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-testid='${id}']`);
    const targets: { selector: string; el: HTMLElement | null; testId?: string }[] = [
      { selector: ".battle-command-text strong", el: pick(".battle-command-text strong") },
      { selector: ".battle-command-text small", el: pick(".battle-command-text small") },
      { selector: ".battle-command-help", el: pick(".battle-command-help") },
      { selector: ".battle-actor-name", el: pick(".battle-actor-name") },
      { selector: ".battle-actor-hp", el: pick(".battle-actor-hp") },
      { selector: ".battle-actor-mp", el: pick(".battle-actor-mp") },
      { selector: ".battle-message-line", el: pick(".battle-message-line") },
      { selector: ".battle-target-prompt", el: pick(".battle-target-prompt") },
      { selector: ".battle-key-prompts", el: pick(".battle-key-prompts") },
      { selector: ".battle-analysis-line strong", el: pick(".battle-analysis-line strong") },
      { selector: ".battle-analysis-small", el: pick(".battle-analysis-small") },
      { selector: ".battle-target-analysis", el: byTestId("battle-target-analysis"), testId: "battle-target-analysis" },
      { selector: ".battle-result-title", el: pick(".battle-result-title") },
      { selector: ".battle-result-reward-label", el: pick(".battle-result-reward-label") },
      { selector: ".battle-result-reward-value", el: pick(".battle-result-reward-value") },
      { selector: ".battle-result-confirm", el: pick(".battle-result-confirm") },
      { selector: ".battle-enemy-name", el: pick(".battle-enemy-name") },
      { selector: ".battle-submenu-header", el: pick(".battle-submenu-header") },
    ];
    return targets
      .filter((t): t is { selector: string; el: HTMLElement; testId?: string } => Boolean(t.el))
      .map((t) => {
        const cs = getComputedStyle(t.el);
        const rect = t.el.getBoundingClientRect();
        return {
          selector: t.selector,
          testId: t.testId,
          text: (t.el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
          fontSize: cs.fontSize,
          fontFamily: cs.fontFamily.split(",")[0]?.trim() ?? cs.fontFamily,
          color: cs.color,
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        };
      });
  });
}

async function collectBattleLayout(page: import("@playwright/test").Page): Promise<unknown> {
  return page.evaluate(() => {
    const rect = (selector: string): Record<string, number> | null => {
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
    };
    const style = (selector: string): Record<string, string> | null => {
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) return null;
      const css = getComputedStyle(node);
      return { display: css.display, gridTemplateRows: css.gridTemplateRows, gridTemplateColumns: css.gridTemplateColumns, lineHeight: css.lineHeight };
    };
    return {
      scene: rect("[data-testid='battle-scene']"),
      field: rect(".battle-field"),
      party: rect(".battle-party"),
      row: rect(".battle-actor-status"),
      rowStyle: style(".battle-actor-status"),
      name: rect(".battle-actor-name"),
      vitals: rect(".battle-actor-vitals"),
      hpBar: rect(".battle-stat-bar-hp"),
      mpBar: rect(".battle-stat-bar-mp"),
      atb: rect(".battle-actor-gauge"),
      atbLabel: rect(".battle-atb-label"),
      atbBar: rect(".battle-atb-bar"),
    };
  });
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const project = await buildSeedProject();

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
  });
  const page = await browser.newPage({ viewport: { width: 1360, height: 768 } });
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
  });

  await page.addInitScript((seed) => {
    (window as unknown as { __RPG_ZZU_E2E_PROJECT__: unknown }).__RPG_ZZU_E2E_PROJECT__ = seed;
    window.localStorage.clear();
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  }, project);
  await page.goto(BASE_URL);
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 20_000 });

  // Enter play mode (test play window) and start a new game from the title.
  await page.getByTestId("mode-play").click();
  await page.waitForTimeout(300);
  if (!(await page.getByTestId("test-play-window").isVisible())) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("rpgzzu:test-play-window")));
  }
  await page.getByTestId("test-play-window").waitFor({ state: "visible", timeout: 15_000 });
  await page.getByTestId("title-screen").waitFor({ state: "visible", timeout: 15_000 });
  await page.keyboard.press("Enter");
  await page.getByTestId("runtime-state-json").waitFor({ state: "visible", timeout: 15_000 });
  await page.getByTestId("play-canvas").waitFor({ state: "visible", timeout: 15_000 });

  // Trigger the reference battle event on the map.
  await page.locator('[data-testid="event-battle-start"]').waitFor({ state: "visible", timeout: 10_000 });
  await page.click('[data-testid="event-battle-start"]');
  await page.getByTestId("battle-scene").waitFor({ state: "visible", timeout: 15_000 });
  await page.getByTestId("actor-command-attack").waitFor({ state: "visible", timeout: 20_000 });

  const scene = page.getByTestId("battle-scene");
  const stage = page.getByTestId("test-play-window");

  // --- Phase 1: command ---
  await page.waitForTimeout(700);
  await stage.screenshot({ path: `${OUT}/01-command-stage.png` });
  await page.locator(".battle-command-panel").first().screenshot({ path: `${OUT}/02-command-hud.png` });
  const commandMetrics = await collectFontMetrics(page);
  const commandLayout = await collectBattleLayout(page);

  // --- Phase 2: target select (attack -> z confirms first target) ---
  await page.getByTestId("actor-command-attack").click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="battle-scene"]')?.getAttribute("data-battle-phase") === "targetSelect",
    undefined,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(400);
  await stage.screenshot({ path: `${OUT}/03-target-stage.png` });
  await page.locator(".battle-command-panel").first().screenshot({ path: `${OUT}/04-target-hud.png` });
  const analysis = page.locator('[data-testid="battle-target-analysis"]');
  if (await analysis.count()) {
    await analysis.first().screenshot({ path: `${OUT}/04-target-analysis.png` });
  }
  const targetMetrics = await collectFontMetrics(page);

  // --- Phase 3: result (confirm target by clicking the field enemy; the 14 HP
  // enemy dies to one attack and the victory panel appears) ---
  const fieldTarget = scene.locator(".battle-enemy[data-testid='enemy-1'][data-battle-targetable='true']");
  if (await fieldTarget.count()) {
    await fieldTarget.first().click();
  } else {
    await scene.getByTestId("battle-target-enemy-1").click();
  }
  await page.getByTestId("battle-result-panel").waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForFunction(
    () => [...document.querySelectorAll<HTMLElement>(".battle-result-reward-card")].every((row) => !row.hidden),
    undefined,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(200);
  await stage.screenshot({ path: `${OUT}/05-result-stage.png` });
  await page.locator('[data-testid="battle-result-panel"]').first().screenshot({ path: `${OUT}/06-result-panel.png` });
  const resultMetrics = await collectFontMetrics(page);

  const skin = await scene.getAttribute("data-battle-skin");
  const uiStyle = await scene.getAttribute("data-battle-ui-style");

  const report = {
    label,
    capturedAt: new Date().toISOString(),
    url: BASE_URL,
    skin,
    uiStyle,
    phases: {
      command: commandMetrics,
      target: targetMetrics,
      result: resultMetrics,
    },
    layout: commandLayout,
    consoleErrors: consoleErrors.slice(0, 10),
  };
  await writeFile(`${OUT}/metrics.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[battle-ui-evidence] label=${label} skin=${skin} uiStyle=${uiStyle}`);
  console.log(`[battle-ui-evidence] output=${OUT}`);
  console.log(JSON.stringify(report.phases, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
