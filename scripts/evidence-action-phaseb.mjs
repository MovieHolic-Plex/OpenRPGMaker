import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "output/evidence/action-combat-phaseb";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => {
  window.localStorage.setItem("oprn:editor-ui-mode", "expert");
});
await page.goto("http://localhost:9999/?project=rpg-zzu-dungeon-example", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 30_000 });
await page.getByTestId("mode-play").click({ force: true });
await page.getByTestId("title-screen").waitFor({ timeout: 20_000 });
await page.keyboard.press("Enter");
await page.getByTestId("runtime-state-json").waitFor({ timeout: 20_000 });
await page.waitForTimeout(1500);
console.log("on demo map");

const readState = () =>
  page.evaluate(() => {
    const state = JSON.parse(document.querySelector("[data-testid='runtime-state-json']")?.textContent ?? "{}");
    const chars = window.__rpgzzuCharacterSprites?.();
    const enemies = Object.entries(chars?.events ?? {})
      .filter(([id]) => id.includes("__field_spawn__"))
      .map(([id, s]) => ({ id, tx: Math.floor(s.x / 16), ty: Math.floor(s.y / 16) }));
    return { player: state.player, enemies, hp: document.querySelector("[data-testid='action-hud-hp-text']")?.textContent };
  });

const stepDir = async (dir, ms = 240) => {
  await page.evaluate((d) => window.__rpgzzuInput?.dir(d), dir);
  await page.waitForTimeout(ms);
  await page.evaluate(() => window.__rpgzzuInput?.dir(null));
  await page.waitForTimeout(100);
};

async function walkTo(tx, ty, maxSteps = 20) {
  for (let i = 0; i < maxSteps; i += 1) {
    const st = await readState();
    const dx = tx - st.player.x;
    const dy = ty - st.player.y;
    if (dx === 0 && dy === 0) return st;
    await stepDir(Math.abs(dx) >= Math.abs(dy) && dx !== 0 ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  }
  return readState();
}

async function burst(name, shots, intervalMs) {
  for (let i = 0; i < shots; i += 1) {
    await page.screenshot({ path: `${OUT}/${name}-${i}.png` });
    await page.waitForTimeout(intervalMs);
  }
  const st = await readState();
  console.log(name, "player:", JSON.stringify(st.player), "hp:", st.hp, "enemies:", st.enemies.length);
}

// A) 근접 슬라임 구역(4~9, 4~8) — 인접 대기 후 windup/텔레그래프 버스트
await walkTo(7, 7);
await burst("a-melee-windup", 8, 300);

// B) 원거리 초원 슬라임 구역(14~19, 9~13) — 4~6타일 거리에서 투사체 버스트
await walkTo(16, 13);
await burst("b-projectile", 10, 280);

// C) 박쥐 구역(4~9, 11~14) — 같은 열 정렬 후 돌진 버스트
await walkTo(6, 13);
await burst("c-dash", 10, 260);

await browser.close();
console.log("DONE");
