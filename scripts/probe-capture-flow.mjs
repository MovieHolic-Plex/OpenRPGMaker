// 포획 플로우 적대 프로브 — monsterCollection 활성화로 처음 열린 경로:
// 포획 커맨드 노출 → 구슬 서브메뉴 → 대상 선택 → 투척 연출 → 성공/실패 메시지·수량.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const URL_ =
  "https://localhost:9999/?project=rpg-zzu-house-template-gallery"
  + "&name=Scarloxy+%EB%AA%AC%EC%8A%A4%ED%84%B0+%EC%B4%88%EC%9B%90+%EB%8D%B0%EB%AA%A8"
  + "&map=map_scarloxy_ruins";
const sleep = (n) => new Promise((r) => setTimeout(r, n));
const OUT = ".omo/battle-runs/capture-probe-0803";

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("ERR_CONNECTION")) errors.push(m.text().slice(0, 200)); });
await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 90000 });
await sleep(9000);

await page.locator("[aria-label='랜덤 전투 테스트']").first().click({ timeout: 30000 });
await page.waitForSelector(".battle-scene", { timeout: 30000 });
await sleep(2500);

const state = () => page.evaluate(() => {
  const scene = document.querySelector(".battle-scene");
  return {
    phase: scene?.dataset.battlePhase, busy: scene?.dataset.battleSequenceBusy,
    msg: (document.querySelector(".battle-message-window")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
    enemies: [...document.querySelectorAll(".battle-enemy")].map((e) => ({ id: e.dataset.testid, pose: e.dataset.battlePose })),
    buttons: [...document.querySelectorAll("button.battle-command")].map((b) => ({
      id: b.dataset.testid, label: (b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 36),
      disabled: b.disabled, cursor: b.dataset.battleCommandCursor === "true",
    })),
    result: !!document.querySelector(".battle-result-panel"),
  };
});
let shot = 0;
const snap = (name) => page.screenshot({ path: `${OUT}/${String(shot++).padStart(2, "0")}-${name}.png` });

const start = await state();
console.log("commands:", JSON.stringify(start.buttons.map((b) => b.id)));
await snap("root");

const hasCapture = start.buttons.some((b) => b.id === "actor-command-capture");
if (!hasCapture) {
  console.log("!!! 포획 커맨드 없음");
} else {
  await page.evaluate(() => document.querySelector("[data-testid='actor-command-capture']")?.focus());
  await sleep(250);
  await page.keyboard.press("Enter"); await sleep(600);
  const submenu = await state();
  console.log("capture-submenu:", JSON.stringify(submenu.buttons));
  await snap("capture-submenu");
  await page.keyboard.press("Enter"); await sleep(600); // 첫 구슬
  const pick = await state();
  console.log("after-pick:", JSON.stringify({ phase: pick.phase, msg: pick.msg }));
  await snap("target");
  if (pick.phase === "targetSelect") { await page.keyboard.press("Enter"); await sleep(400); }
  // 시네마틱/연출 관찰
  for (let i = 0; i < 25; i++) {
    const s = await state();
    if (i % 3 === 0) await snap(`cine-${i}`);
    if (s.busy !== "true" && s.phase !== "targetSelect") { console.log(`t+${i * 400}ms:`, JSON.stringify({ msg: s.msg, enemies: s.enemies, result: s.result })); break; }
    await sleep(400);
  }
  const done = await state();
  console.log("done:", JSON.stringify({ msg: done.msg, enemies: done.enemies, result: done.result }));
  await snap("done");
}
console.log("errors:", errors);
await browser.close();
