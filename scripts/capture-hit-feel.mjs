import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SCRATCH = "C:\\Users\\hyeon\\AppData\\Local\\Temp\\grok-goal-51c4e6878dd4\\implementer";
const project = JSON.parse(fs.readFileSync("test/fixtures/projects/battle-v3.json", "utf8"));
project.system.systemResourceId = "windowskin-rm2003";
for (const t of project.database.troops || []) {
  t.previewBackgroundResourceId = "generated-battle-reference-forest";
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript((seed) => {
  window.__RPG_ZZU_E2E_PROJECT__ = seed;
  window.localStorage.clear();
}, project);
await page.goto("http://127.0.0.1:9173/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(1200);
await page.evaluate(() => window.dispatchEvent(new CustomEvent("rpgzzu:test-play-window")));
await page.waitForSelector('[data-testid="title-screen"]', { timeout: 20_000 });
await page.keyboard.press("Enter");
await page.waitForTimeout(800);

const result = await page.evaluate(async () => {
  const runtimeMod = await import("/src/battle/runtime.ts");
  const battleDom = await import("/src/player/battleDom.ts");
  const storeMod = await import("/src/project/store.ts");
  const project = storeMod.store.getCurrent();
  for (const e of project.database.enemies) {
    e.stats.maxHp = 500;
    e.stats.defense = 1;
  }
  const host = document.querySelector('[data-testid="test-play-window-body"]') || document.body;
  const rt = runtimeMod.createBattleRuntime({
    project,
    troopId: project.database.troops[0].id,
    canEscape: true,
    canLose: true,
    battleFlow: "gauge",
  });
  for (let i = 0; i < 20000; i++) {
    rt.tick(50);
    if (rt.snapshot().phase === "actorCommand") break;
  }
  battleDom.mountBattleScene({ host, runtime: rt, onResult: () => {} });
  await new Promise((r) => setTimeout(r, 200));
  document.querySelector('[data-testid="actor-command-attack"]')?.click();
  await new Promise((r) => setTimeout(r, 250));
  const enemy =
    document.querySelector(".battle-enemy[data-battle-targetable='true']") ||
    document.querySelector('[data-testid="enemy-1"]');
  enemy?.click();
  // Sample during resolve beat
  await new Promise((r) => setTimeout(r, 650));
  const scene = document.querySelector('[data-testid="battle-scene"]');
  return {
    hitFeel: scene?.getAttribute("data-battle-hit-feel"),
    hitStop: scene?.classList.contains("battle-hit-stop"),
    popup: Boolean(document.querySelector('[data-testid="battle-damage-popup"]')),
    poses: [...document.querySelectorAll("[data-battle-pose]")].map((n) => ({
      testid: n.getAttribute("data-testid"),
      pose: n.getAttribute("data-battle-pose"),
    })),
    last: rt.snapshot().lastActionResult,
  };
});

console.log(JSON.stringify(result, null, 2));
await page.screenshot({ path: path.join(SCRATCH, "battle-hit-feel.png") });
await page.screenshot({ path: path.join(SCRATCH, "battle-pose-hit.png") });
fs.writeFileSync(path.join(SCRATCH, "hit-feel-dom.json"), JSON.stringify(result, null, 2));
await browser.close();
