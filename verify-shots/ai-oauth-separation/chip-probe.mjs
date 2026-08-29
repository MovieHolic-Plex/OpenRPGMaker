// 상태바 AI 연동 칩 실측 프로브.
// ① AI 패널을 열어도 칩이 화면에 남는지(예전에는 display:none 으로 사라졌다)
// ② 상태별 클래스·이모지·색이 실제로 다른지
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PROBE_BASE_URL ?? "http://127.0.0.1:9802";
mkdirSync(OUT, { recursive: true });

const log = [];
const say = (line) => { log.push(line); console.log(line); };

const browser = await chromium.launch();
// 1440×900 — 칩 숨김 규칙이 걸리던 @media (min-width: 1024px) 구간이다.
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  // chatDock:"side" 로 띄운다 — 옛 숨김 규칙(:has(.ai-chat-side-panel .ai-chat-panel:not(.is-collapsed)))
  // 이 걸리던 유일한 도크다. 기본값 "glass" 는 패널을 float host 로 띄워 규칙이 아예 안 걸린다.
  localStorage.setItem("rpg-zzu:editor-layout:v4", JSON.stringify({ chatDock: "side" }));
});
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(6500);

const readChip = async () => page.evaluate(() => {
  const chip = document.querySelector("[data-testid='ai-connection-status']");
  if (!chip) return { present: false };
  const box = chip.getBoundingClientRect();
  const style = getComputedStyle(chip);
  return {
    present: true,
    text: chip.textContent?.trim(),
    className: chip.className,
    width: Math.round(box.width),
    height: Math.round(box.height),
    color: style.color,
    display: style.display,
    title: chip.getAttribute("title")?.slice(0, 90),
  };
});

// 칩이 "확인 중" 을 벗어날 때까지 기다린다 — 동반 서비스 조회는 비동기다.
for (let i = 0; i < 20; i += 1) {
  const now = await readChip();
  if (!now.className?.includes("checking")) break;
  await page.waitForTimeout(700);
}

// AI 패널을 확실히 펼친다(접혀 있으면 복원 버튼을 누른다) — 칩 숨김 규칙이 걸리던 조건이다.
const restore = page.getByTestId("ai-collapsed-restore");
if (await restore.isVisible().catch(() => false)) {
  await restore.click();
  await page.waitForTimeout(900);
}

// 도크를 side 로 돌린다. 기본값은 glass 이고 그때 패널은 float host 에 들어가 옛 숨김 규칙이
// 아예 안 걸린다 — 규칙이 걸리던 유일한 도크에서 검증해야 의미가 있다. glass → side 는 1클릭.
const dockToggle = page.getByTestId("ai-dock-toggle");
for (let i = 0; i < 3; i += 1) {
  const isSide = await page.evaluate(() =>
    Boolean(document.querySelector(".right-panel.ai-chat-side-panel")));
  if (isSide) break;
  if (!(await dockToggle.isVisible().catch(() => false))) break;
  await dockToggle.click();
  await page.waitForTimeout(900);
}
const panel = await page.evaluate(() => {
  const node = document.querySelector(".ai-chat-panel");
  return {
    found: Boolean(node),
    collapsed: node?.classList.contains("is-collapsed") ?? null,
    parentClass: node?.parentElement?.className ?? null,
    hideRuleMatches: Boolean(
      document.querySelector(".editor-layout:has(.ai-chat-side-panel .ai-chat-panel:not(.is-collapsed))"),
    ),
  };
});
say(`[panel] found=${panel.found} collapsed=${panel.collapsed} parent="${panel.parentClass}"`);
say(`[panel] 옛 숨김 규칙 선택자 적중=${panel.hideRuleMatches}`);
const panelOpen = panel.hideRuleMatches;
const chip = await readChip();
say(`[chip] AI 패널 열림=${panelOpen}`);
say(`[chip] present=${chip.present} text="${chip.text}" class="${chip.className}"`);
say(`[chip] box=${chip.width}x${chip.height} display=${chip.display} color=${chip.color}`);
say(`[chip] title="${chip.title}…"`);

if (!chip.present) say("[FAIL] 칩이 DOM 에 없다");
else if (panelOpen && (chip.width === 0 || chip.height === 0 || chip.display === "none")) {
  say("[FAIL] AI 패널을 열었을 때 칩이 화면에서 사라졌다");
} else if (!panelOpen) {
  // 정직한 기록: 옛 숨김 규칙은 `.ai-chat-side-panel .ai-chat-panel:not(.is-collapsed)` 에만
  // 걸렸는데, 동시 진행된 컴포저 개편이 패널을 ai-chat-float-host 로 옮겨서 기본 도크(glass)
  // 에서는 선택자가 아예 안 맞는다. side 도크로 돌리는 UI 토글도 그 개편과 얽혀 있어
  // 이 프로브로는 규칙 조건을 재현하지 못했다 — 규칙 제거의 정당성은 코드로만 확인했다.
  say("[NOTE] 숨김 규칙 조건(side 도크)을 이 레이아웃에서 재현하지 못함 — 규칙 제거는 코드 확인만");
}
if (chip.className && /auth-/.test(chip.className)) say("[FAIL] 죽은 auth- 클래스가 남아 있다");
const kinds = ["ready", "checking", "disconnected", "offline", "error"];
const found = kinds.filter((kind) => (chip.className ?? "").split(/\s+/u).includes(kind));
say(`[chip] kind 클래스=${JSON.stringify(found)}`);
if (found.length !== 1) say("[FAIL] 상태 kind 클래스가 정확히 하나가 아니다");

await page.locator(".editor-statusbar").screenshot({ path: join(OUT, "chip-statusbar.png") });
writeFileSync(join(OUT, "chip-probe-log.txt"), `${log.join("\n")}\n`, "utf8");
await browser.close();
