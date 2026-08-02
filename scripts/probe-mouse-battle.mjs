// 코덱스 리뷰 C1 검증 — 마우스만으로 전투가 진행되는지: 커맨드 버튼 클릭 →
// 타깃 선택 → 필드 적 클릭 → 액션 재생 → (반복) → 결과 확인 클릭.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const URL_ =
  "https://localhost:9999/?project=rpg-zzu-house-template-gallery"
  + "&name=Scarloxy+%EB%AA%AC%EC%8A%A4%ED%84%B0+%EC%B4%88%EC%9B%90+%EB%8D%B0%EB%AA%A8"
  + "&map=map_scarloxy_ruins";
const sleep = (n) => new Promise((r) => setTimeout(r, n));

await mkdir(".omo/battle-runs/mouse-probe-0803", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 90000 });
await sleep(9000);

await page.locator("[aria-label='랜덤 전투 테스트']").first().click({ timeout: 30000 });
await page.waitForSelector(".battle-scene", { timeout: 30000 });
await sleep(2500);

const state = () => page.evaluate(() => {
  const scene = document.querySelector(".battle-scene");
  return {
    phase: scene?.dataset.battlePhase, busy: scene?.dataset.battleSequenceBusy,
    msg: (document.querySelector(".battle-message-window")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60),
    result: !!document.querySelector(".battle-result-panel"),
    scene: !!scene,
  };
});

let shot = 0;
const snap = (name) => page.screenshot({ path: `.omo/battle-runs/mouse-probe-0803/${String(shot++).padStart(2, "0")}-${name}.png` });

// 마우스 전투 루프: 명령 화면이면 공격 클릭 → 타깃이면 필드 적 클릭
for (let i = 0; i < 60; i++) {
  const s = await state();
  if (!s.scene || s.result) break;
  if (s.busy === "true") { await sleep(400); continue; }
  if (s.phase === "actorCommand") {
    const attack = page.locator("[data-testid='actor-command-attack']");
    if (await attack.count()) {
      await attack.first().click({ timeout: 3000 });
      console.log("clicked 공격 →", JSON.stringify(await state()));
      await snap("after-attack-click");
    }
  } else if (s.phase === "targetSelect") {
    // 필드의 타깃 가능 적을 직접 클릭
    const enemy = page.locator(".battle-field [data-battle-targetable='true']");
    if (await enemy.count()) {
      await enemy.first().click({ timeout: 3000 });
      console.log("clicked 필드 적 →", JSON.stringify(await state()));
      await snap("after-enemy-click");
    }
  }
  await sleep(400);
}
const end = await state();
console.log("end:", JSON.stringify(end));
await snap("end");
if (end.result) {
  await page.locator(".battle-result-confirm").first().click({ timeout: 3000 }).catch(() => {});
  await sleep(800);
  console.log("after-confirm-click:", JSON.stringify(await state()));
}
console.log("errors:", errors);
await browser.close();
