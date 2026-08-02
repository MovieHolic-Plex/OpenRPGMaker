// 아이템/포획 플로우 적대 프로브 — 인벤토리(회복약3·포획구슬2)가 생기며 처음 열린
// 경로를 키보드로 실제로 밟는다: 아이템 서브메뉴 → 회복약 사용 → HP/수량 변화,
// 그리고 포획 구슬 노출 여부.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const URL_ =
  "https://localhost:9999/?project=rpg-zzu-house-template-gallery"
  + "&name=Scarloxy+%EB%AA%AC%EC%8A%A4%ED%84%B0+%EC%B4%88%EC%9B%90+%EB%8D%B0%EB%AA%A8"
  + "&map=map_scarloxy_ruins";
const sleep = (n) => new Promise((r) => setTimeout(r, n));
const OUT = ".omo/battle-runs/item-probe-0803";

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
    msg: (document.querySelector(".battle-message-window")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 70),
    heroHp: (document.querySelector(".battle-party .battle-actor-hp")?.textContent || "").trim(),
    buttons: [...document.querySelectorAll("button.battle-command")].map((b) => ({
      id: b.dataset.testid, label: (b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
      disabled: b.disabled, cursor: b.dataset.battleCommandCursor === "true",
    })),
  };
});
let shot = 0;
const snap = (name) => page.screenshot({ path: `${OUT}/${String(shot++).padStart(2, "0")}-${name}.png` });

// 먼저 적에게 한 대 맞아 HP를 깎는다(회복약 효과 관찰용): 방어 1회
console.log("start:", JSON.stringify(await state()));
// 커맨드: 공격(커서) → ↓ 방어 → Enter
await page.keyboard.press("ArrowDown"); await sleep(200);
await page.keyboard.press("Enter"); await sleep(4000); // 방어 + 적 턴
console.log("after-defend:", JSON.stringify((({ msg, heroHp }) => ({ msg, heroHp }))(await state())));

// 아이템 서브메뉴 진입 — 커서 잔류에 흔들리지 않게 focus 로 정확히 놓는다
await page.evaluate(() => document.querySelector("[data-testid='actor-command-item']")?.focus()); await sleep(250);
const beforeOpen = await state();
console.log("cursor-on:", JSON.stringify(beforeOpen.buttons.find((b) => b.cursor)));
await snap("cursor-on-item");
await page.keyboard.press("Enter"); await sleep(600);
const submenu = await state();
console.log("item-submenu:", JSON.stringify(submenu.buttons));
await snap("item-submenu");

// 첫 아이템(회복약) 사용
await page.keyboard.press("Enter"); await sleep(600);
const afterPick = await state();
console.log("after-pick:", JSON.stringify({ phase: afterPick.phase, msg: afterPick.msg, buttons: afterPick.buttons.slice(0, 5) }));
await snap("after-pick");
// 대상 선택이 떴으면 확정
if (afterPick.phase === "targetSelect") {
  await page.keyboard.press("Enter"); await sleep(500);
}
// 연출 재생 대기
for (let i = 0; i < 15; i++) { const s = await state(); await sleep(400); if (s.busy !== "true") break; }
const done = await state();
console.log("after-use:", JSON.stringify({ msg: done.msg, heroHp: done.heroHp }));
await snap("after-use");

// 다시 아이템 열어 수량 확인
for (let i = 0; i < 12; i++) { const s = await state(); if (s.busy !== "true" && s.phase === "actorCommand") break; await sleep(400); }
await page.evaluate(() => document.querySelector("[data-testid='actor-command-item']")?.focus()); await sleep(250);
await page.keyboard.press("Enter"); await sleep(600);
const recheck = await state();
console.log("recheck-submenu:", JSON.stringify(recheck.buttons));
await snap("recheck-submenu");

console.log("errors:", errors);
await browser.close();
