// battle-screen-shake / battle-hit-stop 이 스테이지 스케일을 보존하는지 직접 주입 검증.
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

const out = await page.evaluate(async () => {
  const scene = document.querySelector(".battle-scene");
  const sample = async (cls, ms) => {
    const widths = new Set();
    scene.classList.add(cls);
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        widths.add(Math.round(scene.getBoundingClientRect().width));
        if (performance.now() - t0 < ms) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    scene.classList.remove(cls);
    return [...widths].sort((a, b) => a - b);
  };
  return {
    scale: getComputedStyle(scene).getPropertyValue("--battle-stage-scale").trim(),
    shake: await sample("battle-screen-shake", 350),
    hitStop: await sample("battle-hit-stop", 200),
  };
});
console.log(JSON.stringify(out));
await browser.close();
