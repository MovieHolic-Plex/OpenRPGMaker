/**
 * 타겟 선택 표식 가시성 프로브 — "타겟팅 박스가 잘 안 보인다" 검증.
 * 전투 진입 → 공격 선택 → 대상 선택 단계에서 스크린샷 + 표식(.battle-target-brackets)
 * 계산 스타일/렉트/가림(elementFromPoint) 실측. 방향키로 대상 순환하며 각 프레임 저장.
 *
 *   node scripts/probe-target-visibility.mjs
 * 산출: .omo/battle-runs/target-vis/tNN.png + report.json
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const URL_ =
  "https://localhost:9999/?project=rpg-zzu-house-template-gallery"
  + "&name=Scarloxy+%EB%AA%AC%EC%8A%A4%ED%84%B0+%EC%B4%88%EC%9B%90+%EB%8D%B0%EB%AA%A8"
  + "&map=map_scarloxy_ruins";
const OUT = ".omo/battle-runs/target-vis";
const sleep = (n) => new Promise((r) => setTimeout(r, n));

const READ = () => {
  const scene = document.querySelector(".battle-scene");
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const brackets = Array.from(document.querySelectorAll(".battle-target-brackets")).map((b) => {
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const topEl = document.elementFromPoint(cx, cy);
    return {
      rect: rect(b),
      display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
      zIndex: cs.zIndex, borderTop: cs.borderTopWidth + " " + cs.borderTopColor,
      width: cs.width, height: cs.height,
      coveredBy: topEl && !b.contains(topEl) && topEl !== b ? (topEl.className || topEl.tagName).toString().slice(0, 80) : null,
      parentEnemy: b.closest(".battle-enemy")?.dataset.recordId ?? null,
    };
  });
  const candidates = Array.from(document.querySelectorAll(".battle-target-candidate")).map((n) => ({
    id: n.dataset.recordId ?? n.dataset.testid ?? null,
    selected: n.classList.contains("battle-target-selected"),
    rect: rect(n),
  }));
  return {
    phase: scene?.dataset.battlePhase ?? null,
    busy: scene?.dataset.battleSequenceBusy ?? null,
    uiStyle: scene?.dataset.battleUiStyle ?? null,
    skin: scene?.dataset.battleSkin ?? null,
    brackets, candidates,
    selectedId: candidates.find((c) => c.selected)?.id ?? null,
  };
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 90000 });
await sleep(9000);
await page.locator("[aria-label='랜덤 전투 테스트']").first().click({ timeout: 30000 });

// 커맨드 입력 가능해질 때까지 대기 → 공격 선택(Enter) → 대상 선택 단계
const deadline = Date.now() + 60000;
while (Date.now() < deadline) {
  const st = await page.evaluate(READ).catch(() => null);
  if (st?.phase === "actorCommand" && st.busy !== "true") break;
  await sleep(200);
}
await page.keyboard.press("Enter");
await sleep(500);

const shots = [];
let i = 0;
const snap = async (label) => {
  const file = `t${String(i).padStart(2, "0")}-${label}.png`;
  const [state] = await Promise.all([
    page.evaluate(READ),
    page.screenshot({ path: `${OUT}/${file}` }),
  ]);
  shots.push({ file, state });
  i += 1;
};

await snap("target-initial");
// 대상 순환하며 각 상태 캡처
for (let k = 0; k < 3; k += 1) {
  await page.keyboard.press("ArrowRight");
  await sleep(350);
  await snap(`cycle-${k}`);
}

await writeFile(`${OUT}/report.json`, JSON.stringify({ shots }, null, 1));
console.log(JSON.stringify(shots.map((s) => ({
  file: s.file, phase: s.state.phase, selected: s.state.selectedId,
  brackets: s.state.brackets,
})), null, 1));
await browser.close();
