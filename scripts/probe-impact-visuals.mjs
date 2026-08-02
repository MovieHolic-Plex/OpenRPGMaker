// 타격/피격 순간 시각 검증 프로브 — rAF 단위로 씬 폭·히트스톱·적/아군 transform 기록.
// 가설: ① battle-hit-stop-pulse 키프레임(scale 1)이 씬의 --battle-stage-scale transform 을
// 덮어써 타격마다 씬이 통째로 축소된다 ② 포켓몬 스킨 적 노드는 정지 transform !important 에
// 눌려 넉백/쉐이크 이동이 전혀 없다.
import { chromium } from "playwright";

const URL_ =
  "https://localhost:9999/?project=rpg-zzu-house-template-gallery"
  + "&name=Scarloxy+%EB%AA%AC%EC%8A%A4%ED%84%B0+%EC%B4%88%EC%9B%90+%EB%8D%B0%EB%AA%A8"
  + "&map=map_scarloxy_ruins";
const sleep = (n) => new Promise((r) => setTimeout(r, n));

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 90000 });
await sleep(9000);
await page.locator("[aria-label='랜덤 전투 테스트']").first().click({ timeout: 30000 });
await page.waitForSelector(".battle-scene", { timeout: 30000 });
await sleep(2500);

// rAF 레코더 설치
await page.evaluate(() => {
  const scene = document.querySelector(".battle-scene");
  window.__rec = { frames: [], scale: getComputedStyle(scene).getPropertyValue("--battle-stage-scale").trim() };
  const tick = () => {
    const r = scene.getBoundingClientRect();
    const enemy = document.querySelector(".battle-enemy:not(.defeated)");
    const actor = document.querySelector(".battle-actor");
    window.__rec.frames.push({
      t: Math.round(performance.now()),
      w: Math.round(r.width),
      hitStop: scene.classList.contains("battle-hit-stop"),
      eCls: enemy ? [...enemy.classList].filter((c) => /motion|juice|pose/.test(c)).join(" ") : "",
      eTf: enemy ? getComputedStyle(enemy).transform : "",
      // 랜덤 트루프에서 피격 대상이 첫 노드가 아닐 수 있다 — 모션 클래스가 붙은 적 노드를 직접 추적.
      mv: (() => {
        const n = document.querySelector(".battle-enemy-group .battle-enemy.battle-motion-knockback, .battle-enemy-group .battle-enemy.battle-motion-lunge, .battle-enemy-group .battle-enemy.battle-juice-hit");
        return n ? `${[...n.classList].filter((c) => /motion|juice/.test(c)).join(" ")} => ${getComputedStyle(n).transform}` : "";
      })(),
      aCls: actor ? [...actor.classList].filter((c) => /motion|juice|pose/.test(c)).join(" ") : "",
      aTf: actor ? getComputedStyle(actor).transform : "",
    });
    if (window.__rec.frames.length < 2000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

// 키보드로 공격 실행: 공격(첫 커맨드) 확정 → 대상 확정, 라운드 재생을 기다린다.
await page.keyboard.press("Enter");
await sleep(400);
await page.keyboard.press("Enter");
await sleep(7000);

const rec = await page.evaluate(() => window.__rec);
const widths = [...new Set(rec.frames.map((f) => f.w))].sort((a, b) => a - b);
const hitFrames = rec.frames.filter((f) => f.hitStop);
const enemyMotion = rec.frames.filter((f) => f.eCls);
const actorMotion = rec.frames.filter((f) => f.aCls);
const restE = rec.frames.find((f) => !f.eCls && f.eTf)?.eTf;
console.log(JSON.stringify({
  stageScale: rec.scale,
  frameCount: rec.frames.length,
  sceneWidths: widths,
  hitStopFrameCount: hitFrames.length,
  hitStopWidths: [...new Set(hitFrames.map((f) => f.w))],
  enemyRestTransform: restE,
  enemyMotionSample: [...new Set(enemyMotion.map((f) => `${f.eCls} => ${f.eTf}`))].slice(0, 12),
  enemyMovingNode: [...new Set(rec.frames.filter((f) => f.mv).map((f) => f.mv))].slice(0, 12),
  actorMotionSample: [...new Set(actorMotion.map((f) => `${f.aCls} => ${f.aTf}`))].slice(0, 12),
}, null, 1));
await browser.close();
