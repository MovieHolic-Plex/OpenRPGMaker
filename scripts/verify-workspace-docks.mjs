// 도킹 워크스페이스 실측 — 프리셋 전환·패널 이동·⌘K 표면화를 실제 브라우저에서 확인한다.
// 서브에이전트/테스트 자기보고를 믿지 않는다는 원칙에 따라 DOM 계약을 직접 재고 스샷을 남긴다.
// 사용: node scripts/verify-workspace-docks.mjs [baseUrl] [outDir]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:9433";
const OUT = process.argv[3] ?? "verify-shots/detsukuru-workspace";
const PALETTE_FLOOR = 260; // palette-tiles-come-first 계약과 같은 하한

mkdirSync(OUT, { recursive: true });

const log = [];
let failures = 0;
function say(line) {
  log.push(line);
  console.log(line);
}
function check(ok, line) {
  if (!ok) failures += 1;
  say(`${ok ? "OK  " : "FAIL"} ${line}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() !== "error") return;
  const text = msg.text();
  if (/17831|ERR_CONNECTION_REFUSED|\/api\/cliproxy/.test(text)) return;
  consoleErrors.push(text);
});

await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 30_000 });
await page.getByTestId("tile-palette").waitFor({ timeout: 20_000 });

const count = (testid) => page.locator(`[data-testid="${testid}"]`).count();

// ── 계약 1: 3단 모드 토글이 사라지고 작업 프리셋이 그 자리에 있다 ──────────
check((await count("editor-ui-mode-toggle")) === 0, "3단 모드 토글(editor-ui-mode-toggle) 제거됨");
check((await count("workspace-preset-toggle")) === 1, "작업 프리셋 세그먼트 1개");
for (const id of ["map", "event", "data"]) {
  check(await page.getByTestId(`workspace-preset-${id}`).isVisible(), `프리셋 버튼 보임: ${id}`);
}
const presetLabels = await page.locator('[data-testid="workspace-preset-toggle"] button').allInnerTexts();
say(`프리셋 라벨: ${JSON.stringify(presetLabels)}`);

// ── 계약 2: ⌘K 가 클릭 경로로 노출된다 (단축키만 있으면 없는 기능과 같다) ──
check((await count("workspace-command-palette-button")) === 1, "⌘K 칩이 탑바에 있다");
await page.getByTestId("workspace-command-palette-button").click();
await page.getByTestId("command-palette").waitFor({ timeout: 5_000 });
check(true, "칩 클릭으로 커맨드 팔레트 열림");
await page.getByTestId("command-palette-search").fill("프리셋");
const presetHits = await page.locator('[data-testid^="command-palette-item-command-workspace-preset-"]').count();
check(presetHits >= 3, `팔레트에서 "프리셋" 검색 → 프리셋 명령 ${presetHits}건 (3 이상)`);
await page.keyboard.press("Escape");
check((await count("command-palette")) === 0, "Esc 로 팔레트 닫힘");

// ── 계약 3: 기본(맵 그리기) 프리셋에서 두 패널이 좌측 도크에 있다 ─────────
const dockState = async () =>
  page.evaluate(() => {
    const nodes = [...document.querySelectorAll("[data-dock-panel]")];
    const box = (testid) => {
      const node = document.querySelector(`[data-testid="${testid}"]`);
      if (!(node instanceof HTMLElement)) return null;
      const r = node.getBoundingClientRect();
      return { x: Math.round(r.x), width: Math.round(r.width), height: Math.round(r.height) };
    };
    return {
      panels: nodes.map((n) => ({
        panel: n.dataset.dockPanel,
        zone: n.dataset.dockZone,
        testid: n.dataset.testid,
        height: Math.round(n.getBoundingClientRect().height),
      })),
      palette: box("tile-palette"),
      leftPanel: (() => {
        const node = document.querySelector(".left-panel");
        if (!(node instanceof HTMLElement)) return null;
        const r = node.getBoundingClientRect();
        return { width: Math.round(r.width), display: getComputedStyle(node).display };
      })(),
      resizers: document.querySelectorAll('[data-testid="map-tree-height-resizer"]').length,
    };
  });

let state = await dockState();
say(`맵 그리기 도크: ${JSON.stringify(state.panels)}`);
check(state.panels.length === 2, "좌측 도크에 패널 2개(타일·맵)");
check(state.panels[0]?.panel === "tiles" && state.panels[1]?.panel === "maps", "순서가 타일 → 맵");
check(state.resizers === 1, "패널 사이 리사이저 1개");
check(
  (state.palette?.height ?? 0) >= PALETTE_FLOOR,
  `팔레트 높이 ${state.palette?.height}px ≥ ${PALETTE_FLOOR}px (도크 리팩터가 세로를 먹지 않았다)`,
);
await page.screenshot({ path: join(OUT, "preset-map.png"), fullPage: false });

// ── 계약 4: 이벤트 연출 프리셋 = 팔레트가 접히고 맵 트리만 남는다 ──────────
await page.getByTestId("workspace-preset-event").click();
await page.waitForTimeout(500);
state = await dockState();
say(`이벤트 연출 도크: ${JSON.stringify(state.panels)}`);
check(state.panels.length === 1 && state.panels[0]?.panel === "maps", "좌측 도크에 맵 패널만");
check((await count("tile-palette")) === 0, "타일 팔레트가 화면에서 사라짐");
check(state.resizers === 0, "패널이 하나면 리사이저 없음");
check(
  await page.getByTestId("workspace-preset-event").getAttribute("aria-pressed") === "true",
  "선택된 프리셋이 aria-pressed 로 표시됨",
);
await page.screenshot({ path: join(OUT, "preset-event.png"), fullPage: false });

// ── 계약 5: 자료 밸런싱 프리셋 = 좌측 도크가 비고 캔버스가 넓어진다 ────────
const canvasBefore = await page.evaluate(() => {
  const node = document.querySelector(".canvas-area");
  return node instanceof HTMLElement ? Math.round(node.getBoundingClientRect().width) : 0;
});
await page.getByTestId("workspace-preset-data").click();
await page.waitForTimeout(600);
state = await dockState();
const canvasAfter = await page.evaluate(() => {
  const node = document.querySelector(".canvas-area");
  return node instanceof HTMLElement ? Math.round(node.getBoundingClientRect().width) : 0;
});
say(`자료 밸런싱 도크: ${JSON.stringify(state.panels)} · 캔버스 폭 ${canvasBefore} → ${canvasAfter}`);
check(state.panels.length === 0, "좌측 도크가 빈다");
check(canvasAfter > canvasBefore, "캔버스가 실제로 넓어진다(빈 열이 남지 않았다)");
await page.screenshot({ path: join(OUT, "preset-data.png"), fullPage: false });

// ── 계약 7: 패널 메뉴에서 도크를 옮길 수 있다 ────────────────────────────
await page.getByTestId("workspace-panels-button").click();
await page.getByTestId("workspace-panels-menu").waitFor({ state: "visible", timeout: 5_000 });
const menuVisible = await page.getByTestId("workspace-panels-menu").isVisible();
check(menuVisible, "패널 메뉴가 실제로 보인다(.open 없이 display:none 으로 죽지 않았다)");
await page.getByTestId("workspace-panel-dock-tiles-right").click();
await page.waitForTimeout(600);
state = await dockState();
say(`타일 → 오른쪽 이동 후: ${JSON.stringify(state.panels)}`);
check(
  state.panels.length === 1 && state.panels[0]?.panel === "maps",
  "타일 패널이 좌측 도크에서 빠졌다",
);
const storedLayout = await page.evaluate(() => window.localStorage.getItem("oprn:workspace:v1"));
say(`저장된 레이아웃: ${storedLayout}`);
check(
  typeof storedLayout === "string" && JSON.parse(storedLayout).docks.right.includes("tiles"),
  "이동이 oprn:workspace:v1 에 저장됐다",
);
check(!/"density"/.test(storedLayout ?? ""), "저장값에 density 가 없다(원천은 editor-ui-mode 하나)");
await page.screenshot({ path: join(OUT, "panel-moved.png"), fullPage: false });

// ── 계약 8: 새로고침 후 레이아웃이 복원된다 ──────────────────────────────
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 30_000 });
await page.waitForTimeout(800);
state = await dockState();
say(`새로고침 후 도크: ${JSON.stringify(state.panels)}`);
check(
  state.panels.length === 1 && state.panels[0]?.panel === "maps",
  "새로고침 후에도 타일 패널이 좌측에 없다",
);

// ── 계약 9: 패널을 다시 켤 수 있다 (막다른 길이 아니다) ──────────────────
await page.getByTestId("workspace-panels-button").click();
await page.getByTestId("workspace-panel-dock-tiles-left").click();
await page.waitForTimeout(700);
state = await dockState();
say(`복구 후 도크: ${JSON.stringify(state.panels)}`);
check(state.panels.some((p) => p.panel === "tiles"), "타일 패널을 좌측으로 되돌릴 수 있다");
check((await count("tile-palette")) === 1, "팔레트가 다시 렌더된다(빈 껍데기가 아니다)");
const restored = await dockState();
check(
  (restored.palette?.height ?? 0) >= PALETTE_FLOOR,
  `복구된 팔레트 높이 ${restored.palette?.height}px ≥ ${PALETTE_FLOOR}px`,
);
await page.screenshot({ path: join(OUT, "panel-restored.png"), fullPage: false });

say(`콘솔 에러: ${consoleErrors.length}건${consoleErrors.length ? ` — ${consoleErrors.slice(0, 3).join(" | ")}` : ""}`);
if (consoleErrors.length) failures += 1;

writeFileSync(join(OUT, "report.txt"), log.join("\n") + "\n", "utf8");
await browser.close();
say(failures ? `\n실패 ${failures}건` : "\n전부 통과");
process.exit(failures ? 1 : 0);
