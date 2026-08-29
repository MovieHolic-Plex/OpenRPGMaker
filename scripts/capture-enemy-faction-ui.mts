// 몬스터 진영 선택의 정상/결손 상태를 실제 데이터베이스 표면에서 캡처한다.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOOT_BASE ?? "http://127.0.0.1:9187/";
const OUT = "verify-shots/faction-ui";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(60_000);
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await page.goto(`${BASE}?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 45_000 });
await page.getByTestId("toolbar-database").click();
await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 30_000 });
await page.getByTestId("db-tab-enemies").evaluate((node) => (node as HTMLElement).click());
await page.getByTestId("db-picker-enemy-faction").waitFor({ state: "visible" });

await page.screenshot({ path: `${OUT}/enemies.png` });

await page.evaluate(() => {
  const editorStore = (window as unknown as {
    __oprnEditorStore: {
      getCurrent(): { database: { enemies: Array<{ factionId?: string }> } };
      update(mutator: (draft: { database: { enemies: Array<{ factionId?: string }> } }) => void): void;
    };
  }).__oprnEditorStore;
  editorStore.update((draft) => {
    const enemy = draft.database.enemies[0];
    if (enemy) enemy.factionId = "deleted_guard";
  });
});
await page.getByTestId("db-enemy-faction-missing").waitFor({ state: "visible" });
await page.getByTestId("db-enemy-faction-clear-missing").waitFor({ state: "visible" });
await page.screenshot({ path: `${OUT}/enemies-dangling-faction.png` });

console.log(`shot ${OUT}/enemies.png`);
console.log(`shot ${OUT}/enemies-dangling-faction.png`);
await browser.close();
