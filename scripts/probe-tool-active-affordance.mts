/**
 * 「지금 어떤 도구로 그리는지」가 실제 픽셀에서 구분되는지 확인한다.
 *
 * 왜 스크립트인가: 스타일시트 텍스트를 읽는 유닛 테스트는 `.active` 와 `:hover` 가 각자
 * 선언 블록을 가졌다는 것만 증명한다. 정작 사용자가 겪는 것은 **명시도 싸움의 결과**다.
 * `:hover:not(:disabled)`(클래스 5개)가 `.active`(4개)를 이기면, 선언을 분리해도 마우스를
 * 올린 순간 선택 표시가 사라진다. 그건 브라우저에서 computed style 로만 잡힌다.
 *
 * 사용: npx tsx scripts/probe-tool-active-affordance.mts [--port 9814] [--mode standard]
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = process.argv.includes("--port") ? process.argv[process.argv.indexOf("--port") + 1]! : "9814";
const MODE = process.argv.includes("--mode") ? process.argv[process.argv.indexOf("--mode") + 1]! : "standard";
const OUT = ".omo/evidence/left-sidebar-repair";

type Style = { active: boolean; bg: string; fg: string; border: string };

function relativeLuminance(color: string): number {
  const parts = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const linear = parts.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return +(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05))).toFixed(2);
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript((mode) => {
  localStorage.setItem("oprn:editor-ui-mode", mode as string);
  localStorage.setItem("rpg-zzu:editor-ui-mode", mode as string);
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
}, MODE);
await page.goto(`http://127.0.0.1:${PORT}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 90_000 });
await page.waitForTimeout(800);

const styleOf = (testid: string): Promise<Style> => page.evaluate((id) => {
  const el = document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
  const cs = getComputedStyle(el);
  return { active: el.classList.contains("active"), bg: cs.backgroundColor, fg: cs.color, border: cs.borderColor };
}, testid);

await page.getByTestId("tool-paint").click();
await page.mouse.move(1000, 700);
await page.waitForTimeout(300);
const activeAway = await styleOf("tool-paint");
const inactiveIdle = await styleOf("tool-select");

await page.getByTestId("tool-select").hover();
await page.waitForTimeout(300);
const inactiveHover = await styleOf("tool-select");
const activeWhileOtherHovered = await styleOf("tool-paint");

await page.getByTestId("tool-paint").hover();
await page.waitForTimeout(300);
const activeHovered = await styleOf("tool-paint");

const checks: Array<{ id: string; label: string; pass: boolean; detail: string }> = [
  { id: "A1", label: "고른 도구는 안 고른 도구와 배경이 다르다", pass: activeAway.bg !== inactiveIdle.bg, detail: `active=${activeAway.bg} inactive=${inactiveIdle.bg}` },
  { id: "A2", label: "다른 도구에 마우스를 올려도 고른 도구는 계속 채워져 있다", pass: activeWhileOtherHovered.bg === activeAway.bg, detail: `active=${activeWhileOtherHovered.bg} (기준 ${activeAway.bg})` },
  { id: "A3", label: "고른 도구는 hover 색과 구분된다", pass: activeAway.bg !== inactiveHover.bg, detail: `active=${activeAway.bg} inactiveHover=${inactiveHover.bg}` },
  { id: "A4", label: "고른 도구에 마우스를 올려도 선택 표시가 사라지지 않는다", pass: activeHovered.bg !== inactiveHover.bg, detail: `activeHover=${activeHovered.bg} inactiveHover=${inactiveHover.bg}` },
  { id: "A5", label: "채워진 상태의 글자 대비가 4.5:1 이상", pass: contrastRatio(activeAway.bg, activeAway.fg) >= 4.5, detail: `contrast=${contrastRatio(activeAway.bg, activeAway.fg)} (${activeAway.bg} / ${activeAway.fg})` },
];

const out = { mode: MODE, at: new Date().toISOString(), states: { activeAway, inactiveIdle, inactiveHover, activeWhileOtherHovered, activeHovered }, checks };
mkdirSync(OUT, { recursive: true });
const file = join(OUT, `after-${MODE}-tool-affordance.json`);
writeFileSync(file, JSON.stringify(out, null, 2));
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.id}  ${c.label}\n        ${c.detail}`);
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} PASS (mode=${MODE})  -> ${file}`);
await browser.close();
process.exit(failed.length ? 1 : 0);
