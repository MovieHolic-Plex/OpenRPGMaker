/**
 * Load the authored "왕국의 유산" project into the running preview and verify it.
 * Also report why the status bar shows DB off.
 */
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:4173";
const OUT = "output/evidence/kingdom-legacy";
const EXPORT_PATH = path.join(OUT, "project-export.json");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("dialog", (d) => d.accept());

await mkdir(OUT, { recursive: true });
const projectJson = await readFile(EXPORT_PATH, "utf8");
const project = JSON.parse(projectJson);

// Seed as E2E project so the editor loads our JSON without remote DB.
await page.addInitScript((seed) => {
  window.__RPG_ZZU_E2E_PROJECT__ = seed;
}, project);

console.log("open editor with seeded kingdom project…");
await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
await page.waitForTimeout(1200);

const dbStatus = await page.getByTestId("db-connection-status").textContent();
const dbTitle = await page.getByTestId("db-connection-status").getAttribute("title");
console.log("DB status text:", dbStatus);
console.log("DB status title:", dbTitle);

const state = JSON.parse(await page.getByTestId("project-export-json").textContent());
const startMapId = state.project.startMapId;
const map = state.project.maps[startMapId];
console.log("loaded map:", map?.name, startMapId, "events:", map?.events?.length);
console.log("titleScreen:", state.project.system?.titleScreen?.title);
console.log("meta.title:", state.project.meta?.title);

// Select kingdom map if needed
const treeNode = page.getByTestId(`map-tree-node-${startMapId}`);
if (await treeNode.count()) {
  await treeNode.scrollIntoViewIfNeeded();
  await treeNode.click();
  await page.waitForTimeout(400);
}

await page.screenshot({ path: path.join(OUT, "07-reopen-editor.png"), fullPage: true });

// Play and talk to first NPC
console.log("play…");
await page.getByTestId("mode-play").click();
const newGame = page.getByTestId("title-new-game");
if (await newGame.isVisible({ timeout: 8000 }).catch(() => false)) {
  await newGame.click();
}
await page.getByTestId("play-canvas").waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(OUT, "08-reopen-play.png") });

// Click event markers if present
const eventIds = (map?.events ?? []).map((e) => e.id);
for (const id of eventIds) {
  const marker = page.getByTestId(`event-${id}`);
  if (await marker.isVisible().catch(() => false)) {
    await marker.click({ force: true });
    await page.waitForTimeout(400);
    const dialogue = page.getByTestId("dialogue-box");
    if (await dialogue.isVisible().catch(() => false)) {
      const text = await dialogue.textContent();
      console.log("dialogue:", text?.slice(0, 120));
      await page.screenshot({ path: path.join(OUT, `09-dialogue-${id}.png`) });
      await dialogue.click().catch(() => {});
      await page.waitForTimeout(200);
    }
  } else {
    console.log("no marker for", id);
  }
}

// Open DB settings and capture what the form says
await page.getByTestId("mode-edit").click().catch(async () => {
  // may need toggle
  await page.getByTestId("mode-play").click().catch(() => {});
});
await page.waitForTimeout(500);
// ensure edit mode
if (await page.getByTestId("mode-play").isVisible().catch(() => false)) {
  // if still in play, click edit toolbar if exists
  const editBtn = page.locator('[data-testid="mode-edit"], button:has-text("편집")').first();
  if (await editBtn.isVisible().catch(() => false)) await editBtn.click();
}
await page.waitForTimeout(400);
await page.getByTestId("db-connection-status").click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, "10-db-config-modal.png") });
const configLine = await page.getByTestId("db-config-status-line").textContent().catch(() => null);
console.log("db config line:", configLine);

const report = {
  dbStatusText: dbStatus,
  dbStatusTitle: dbTitle,
  dbConfigLine: configLine,
  titleScreen: state.project.system?.titleScreen?.title,
  metaTitle: state.project.meta?.title,
  startMapId,
  mapName: map?.name,
  eventCount: map?.events?.length ?? 0,
  events: (map?.events ?? []).map((e) => ({
    id: e.id,
    name: e.pages?.[0]?.name,
    x: e.x,
    y: e.y,
  })),
  explanation: {
    whyDbOff:
      "freshProject / 로컬 dev-showcase 모드에서는 remotePersistenceDisabledReason='dev-showcase'로 원격 DB 저장이 의도적으로 꺼집니다. 상태바 'DB: 꺼짐'은 연결 실패가 아니라 이 모드 표시입니다.",
    whenDbWouldConnect:
      "freshProject 없이 열면 .env.local의 VITE_SUPABASE_URL(http://dbserver:8100) + anon key로 Supabase REST(schema rpg_zzu)에 붙습니다. URL/키가 없거나 서버/스키마가 없으면 not-configured 또는 연결 실패입니다.",
  },
};

await writeFile(path.join(OUT, "reopen-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
await browser.close();
