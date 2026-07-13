import { chromium } from "playwright";
const dir = "C:/Users/hyeon/AppData/Local/Temp/claude/C--Users-hyeon-Downloads-rpg-zzu/31c5d6ab-77b5-4143-80bc-21af5139588b/scratchpad/";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1120, height: 1000 }, deviceScaleFactor: 1 });
const page = await p.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push("console.error: " + m.text()); });
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
await page.goto("file:///" + dir + "dungeon-harness-catalog.html");
await page.waitForTimeout(900);
// 카드/데모가 실제로 그려졌는지 DOM 검사
const stats = await page.evaluate(() => ({
  cards: document.querySelectorAll("#cards .card").length,
  cardCanvases: document.querySelectorAll("#cards canvas").length,
  paintW: document.getElementById("paint")?.width,
  demoBody: document.getElementById("demoBody")?.textContent,
  demoResult: document.getElementById("demoResult")?.textContent,
  zones: document.querySelectorAll(".zone").length,
  oldCards: document.querySelectorAll("#oldcards .oldcard").length,
  rows: document.querySelectorAll("#tbody tr").length,
}));
console.log("STATS", JSON.stringify(stats));
console.log("ERRORS", errs.length ? errs.join(" | ") : "none");
await page.screenshot({ path: dir + "shot-full.png", fullPage: true });
// 오토타일 카드 섹션만 크롭
const sec = await page.$$("section");
if (sec[3]) await sec[3].screenshot({ path: dir + "shot-cards.png" });
if (sec[2]) await sec[2].screenshot({ path: dir + "shot-demo.png" });
await b.close();
