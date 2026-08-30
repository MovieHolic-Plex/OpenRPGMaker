import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const PORT = process.env.DEV_PORT ?? "9845";
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = "verify-shots/fixture-derived";

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));

const notes = [];
const shot = async (name, note) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  notes.push({ name, note });
  console.log(`촬영 ${name} — ${note}`);
};

await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded" });
await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 60_000 });
await page.getByTestId("toolbar-database").click();
await page.getByTestId("db-tab-items").waitFor({ timeout: 30_000 });
await page.waitForTimeout(900);

const tabCounts = await page.evaluate(() =>
  Object.fromEntries(
    [...document.querySelectorAll("[data-testid^='db-tab-'][data-count]")].map((el) => [
      el.getAttribute("data-testid").replace("db-tab-", ""),
      Number(el.getAttribute("data-count")),
    ]),
  ),
);
console.log("탭이 표시하는 레코드 개수:", JSON.stringify(tabCounts, null, 2));

await page.getByTestId("db-tab-items").click();
await page.waitForTimeout(700);
await shot("01-items-tab", `아이템 탭 — 탭 배지가 ${tabCounts.items}개를 표시한다`);

await page.getByTestId("db-tab-equipment").click();
await page.waitForTimeout(700);
await shot("02-equipment-tab", `장비 탭 — 탭 배지가 ${tabCounts.equipment}개를 표시한다`);

const rowIds = await page.evaluate(() =>
  [...document.querySelectorAll("[data-testid^='db-record-row-']")].slice(0, 6).map((el) => el.getAttribute("data-testid")),
);
console.log("장비 탭에 보이는 행:", rowIds.join(", "));
const firstRow = rowIds[0];
if (firstRow) {
  await page.getByTestId(firstRow).click();
  await page.waitForTimeout(1000);
  await shot("03-equipment-stats", "장비 레코드 상세 — 명중/치명이 값을 갖는다 (파생 이전에는 비어 있었다)");
}

await page.getByTestId("db-tab-skills").click();
await page.waitForTimeout(700);
await shot("04-skills-tab", `스킬 탭 — ${tabCounts.skills}개 (skill_item_* 6종이 들어왔다)`);

await writeFile(`${OUT}/measured.json`, `${JSON.stringify({ tabCounts, rowIds, notes }, null, 2)}\n`, "utf8");
await context.close();
await browser.close();
console.log("증거 디렉터리:", OUT);
