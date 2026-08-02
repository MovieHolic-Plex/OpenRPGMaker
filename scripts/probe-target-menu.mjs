// 타깃 선택 하단 패널 레이아웃 프로브 — 4항목(3마리+취소)에서 메뉴가 오른쪽으로
// 넘쳐 잘리는 원인을 계산 스타일로 확인한다.
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

for (let attempt = 0; attempt < 8; attempt++) {
  await page.locator("[aria-label='랜덤 전투 테스트']").first().click({ timeout: 30000 });
  try { await page.waitForSelector(".battle-scene", { timeout: 30000 }); } catch {}
  await sleep(2500);
  // 커맨드 화면에서 Enter → 타깃 선택 진입
  await page.keyboard.press("Enter");
  await sleep(600);
  const info = await page.evaluate(() => {
    const scene = document.querySelector(".battle-scene");
    const menu = document.querySelector(".battle-target-menu");
    if (!scene || !menu) return null;
    const items = menu.querySelectorAll("button.battle-command").length;
    const dump = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        display: cs.display, position: cs.position,
        gridTemplateColumns: cs.gridTemplateColumns, gridTemplateRows: cs.gridTemplateRows,
        gridColumn: cs.gridColumn, gridRow: cs.gridRow,
        alignSelf: cs.alignSelf, justifySelf: cs.justifySelf, order: cs.order,
        flex: cs.flex, width: cs.width, minWidth: cs.minWidth, overflow: cs.overflow,
        flexDirection: cs.flexDirection, flexWrap: cs.flexWrap,
        alignItems: cs.alignItems, justifyContent: cs.justifyContent, gap: cs.gap,
      };
    };
    const brackets = document.querySelector(".battle-enemy .battle-target-brackets");
    const panel = document.querySelector(".battle-command-panel");
    const prompt = document.querySelector(".battle-target-prompt");
    const keys = document.querySelector(".battle-key-prompts");
    const firstBtn = menu.querySelector("button.battle-command");
    return {
      items,
      panel: dump(panel), menu: dump(menu),
      prompt: prompt ? dump(prompt) : null,
      keys: keys ? dump(keys) : null,
      btn: firstBtn ? dump(firstBtn) : null,
      brackets: brackets ? {
        ...dump(brackets),
        borderTop: getComputedStyle(brackets).borderTop,
        top: getComputedStyle(brackets).top,
        zIndex: getComputedStyle(brackets).zIndex,
        parentOverflow: getComputedStyle(brackets.parentElement).overflow,
        parentFilter: getComputedStyle(brackets.parentElement).filter,
        imageFilter: (() => { const img = brackets.parentElement.querySelector(".battle-enemy-image"); return img ? getComputedStyle(img).filter : null; })(),
        parentRect: (() => { const r = brackets.parentElement.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
      } : "(no brackets element)",
      selectedEnemy: document.querySelector(".battle-enemy.battle-target-selected")?.dataset.testid ?? null,
      panelChildren: Array.from(panel.children).map((c) => c.className),
    };
  });
  if (info && info.items >= 3) {
    await page.screenshot({ path: ".omo/battle-runs/probe-target.png" });
    const b = info.brackets?.rect;
    if (b) {
      await page.screenshot({
        path: ".omo/battle-runs/probe-target-zoom.png",
        clip: { x: b.x - 60, y: Math.max(0, b.y - 40), width: 150, height: 130 },
      });
    }
    console.log(JSON.stringify(info, null, 1));
    break;
  }
  console.log(`attempt ${attempt}: items=${info?.items ?? "no-scene"} — 3마리 트룹이 아님, 재시도`);
  // 전투 닫기: Escape로 타깃 취소 후 헤더 X 클릭
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(300);
  await page.locator(".test-play-modal-backdrop .test-play-close, .test-play-modal-backdrop button").filter({ hasText: /^[xX✕]$/ }).first().click({ timeout: 3000 }).catch(() => {});
  await sleep(1200);
}
await browser.close();
