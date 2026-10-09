// 좌패널 1면 통합 실측 — 스샷 + DOM 계약 검사.
// 서브에이전트/테스트 자기보고를 믿지 않고 실제 브라우저에서 확인한다.
// 사용: node scripts/verify-palette-surface.mjs [baseUrl] [outDir]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:9433";
const OUT = process.argv[3] ?? "verify-shots/detsukuru-palette";

mkdirSync(OUT, { recursive: true });

const log = [];
function say(line) {
  log.push(line);
  console.log(line);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() !== "error") return;
  const text = msg.text();
  // 17831 hello 폴링(MCP 브리지 미기동)·ERR_CONNECTION_REFUSED 스팸은 무시.
  if (/17831|ERR_CONNECTION_REFUSED|\/api\/cliproxy/.test(text)) return;
  consoleErrors.push(text);
});

await page.addInitScript(() => {
  window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  // 옛 탭 저장값이 남아 있어도 새 화면에 영향이 없어야 한다.
  window.localStorage.setItem("oprn:palette-work-tab", "props");
});
await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 30_000 });
await page.getByTestId("layer-lower").first().click({ force: true });
await page.getByTestId("tile-palette").waitFor({ timeout: 20_000 });

const count = (sel) => page.locator(sel).count();

// ── 계약 1: 탭이 사라졌다 ───────────────────────────────────────────────
const tabs = {
  paint: await count('[data-testid="palette-work-tab-paint"]'),
  find: await count('[data-testid="quick-tile-toggle"]'),
  props: await count('[data-testid="palette-work-tab-props"]'),
  tablist: await count('[data-testid="palette-work-tabs"]'),
  oldGrid: await count('[data-testid="quick-tile-picker"]'),
};
say(`탭 잔존: ${JSON.stringify(tabs)}  → 전부 0이어야 함`);

// ── 계약 2: 도구·필터·팔레트가 같은 면에 동시에 보인다 ──────────────────
const together = await page.evaluate(() => {
  const vis = (testid) => {
    const node = document.querySelector(`[data-testid="${testid}"]`);
    if (!(node instanceof HTMLElement)) return null;
    const r = node.getBoundingClientRect();
    return { top: Math.round(r.top), height: Math.round(r.height) };
  };
  return {
    chip: vis("selected-tile-status"),
    // testid 는 Phase 2b(DOM 지문 개명)에서 rpg-maker-* → oprn-* 로 바뀌었다.
    toolbar: vis("oprn-tile-toolbar"),
    filter: vis("palette-filter-bar"),
    palette: vis("tile-palette"),
    brush: vis("palette-brush-assist-section"),
  };
});
say(`한 면 배치(top/height): ${JSON.stringify(together)}`);

// ── 계약 3: 속성은 창으로 열리고, 지형 입력이 화면에 하나뿐 ─────────────
// 인라인 접이식으로 넣었다가 실측에서 되돌렸다 — 인스펙터 본문 346px 가 좌패널
// 526px 에서 팔레트를 273px → 2px 로 눌렀다. 팔레트 높이는 창을 열어도 그대로여야 한다.
await page.getByTestId("chipset-tile-342").click();
const paletteBeforeDialog = await page
  .getByTestId("tile-palette")
  .evaluate((n) => Math.round(n.getBoundingClientRect().height));
await page.getByTestId("selected-tile-props-open").click();
await page.getByTestId("tile-props-dialog").waitFor({ timeout: 5_000 });
const terrainInputs = {
  legacy: await count('[data-testid="terrain-tag-input"]'),
  inspector: await count('[data-testid="inspector-terrain-tag-input"]'),
};
const paletteWithDialog = await page
  .getByTestId("tile-palette")
  .evaluate((n) => Math.round(n.getBoundingClientRect().height));
say(`지형 입력 개수: ${JSON.stringify(terrainInputs)}  → legacy 0, inspector 1`);
say(`속성 창 열림 전/후 팔레트 높이: ${paletteBeforeDialog} → ${paletteWithDialog} (같아야 함)`);
if (paletteWithDialog !== paletteBeforeDialog) {
  say("  ✗ 속성 표면이 팔레트 높이를 건드린다 — 인라인으로 되돌아갔는지 확인하라.");
  process.exitCode = 1;
}
await page.screenshot({ path: join(OUT, "02-props-dialog.png"), fullPage: false });
await page.keyboard.press("Escape");
await page.locator('[data-testid="tile-props-dialog"]').waitFor({ state: "detached", timeout: 5_000 });
say("Esc 로 속성 창 닫힘 확인");

// ── 계약 4: 검색이 본 팔레트를 필터링 ──────────────────────────────────
const before = await count("[data-testid^='chipset-tile-']");
await page.getByTestId("tile-search-input").fill("132");
await page.waitForTimeout(300);
const after = await count("[data-testid^='chipset-tile-']");
const statusText = await page.getByTestId("palette-filter-status").textContent().catch(() => null);
say(`팔레트 칸 수: 필터 전 ${before} → "132" 검색 후 ${after} (상태: ${String(statusText).trim()})`);
await page.screenshot({ path: join(OUT, "03-search-132.png"), fullPage: false });

// ── 계약 5: 검색 결과에서 바로 칠할 수 있다 (탭 전환 0회) ───────────────
await page.getByTestId("chipset-tile-132").click();
const selectedAfterSearch = (await page.getByTestId("selected-tile-status").textContent()) ?? "";
const paintToolVisible = await page.getByTestId("tool-paint").isVisible();
say(`검색 결과 클릭 후 선택칩="${selectedAfterSearch.trim().slice(0, 40)}" · 그리기 도구 보임=${paintToolVisible}`);

// ── 계약 6: 번호 오버레이 토글 ─────────────────────────────────────────
await page.getByTestId("palette-filter-clear").click();
await page.waitForTimeout(200);
const beforeIdx = await page.getByTestId("tile-palette").getAttribute("class");
await page.getByTestId("tile-number-toggle").click();
await page.waitForTimeout(200);
const afterIdx = await page.getByTestId("tile-palette").getAttribute("class");
say(`번호 토글: show-index ${/show-index/.test(beforeIdx ?? "")} → ${/show-index/.test(afterIdx ?? "")}`);
await page.screenshot({ path: join(OUT, "04-numbers-on.png"), fullPage: false });
await page.getByTestId("tile-number-toggle").click();

// ── 계약 7: 이웃 연결 토글이 접이식 밖(칠할 때 보임) ────────────────────
const connectVisible = await page.getByTestId("auto-connect-mode-toggle").isVisible();
const brushOpen = await page
  .locator('[data-testid="palette-brush-assist-section"]')
  .evaluate((n) => n.dataset.open);
say(`이웃 연결 토글 보임=${connectVisible} (붓 보조 펼침=${brushOpen} — 접혀도 보여야 정상)`);
await page.screenshot({ path: join(OUT, "01-surface.png"), fullPage: false });

// ── 계약 9: 팔레트가 접힘선 위에 충분히 남는다 ──────────────────────────
// 이 패널의 희소 자원은 세로다. 필터 바를 추가하면서 실제로 여기를 두 번 깼다:
//   ① 분류 칩 3열 그리드가 7개 → 3줄(필터 바 109px) → 팔레트 200px
//   ② 이웃 연결 별도 줄(33px) → 팔레트 252px
// palette-tiles-come-first.spec.ts 가 260px 하한을 지킨다. 여기서도 실측으로 확인한다.
const paletteHeight = await page
  .getByTestId("tile-palette")
  .evaluate((n) => Math.round(n.getBoundingClientRect().height));
const filterHeight = await page
  .getByTestId("palette-filter-bar")
  .evaluate((n) => Math.round(n.getBoundingClientRect().height));
say(`팔레트 높이=${paletteHeight}px (하한 260) · 필터 바=${filterHeight}px`);
if (paletteHeight <= 260) {
  say(`  ✗ 팔레트가 ${paletteHeight}px — 접힘선 밑으로 밀렸다. 위쪽 줄 높이를 줄여라.`);
  process.exitCode = 1;
}

// ── 계약 8: 비기본 칩셋에서 속성 메타가 거짓이 아니다 ───────────────────
const interior = await page.evaluate(() => {
  const hook = window.__oprnEditorTool;
  return typeof hook?.listTilesets === "function" ? hook.listTilesets() : null;
});
say(`타일셋 훅: ${interior ? "사용 가능" : "없음(수동 확인 필요)"}`);

say(`콘솔 에러(필터 후): ${consoleErrors.length}건`);
for (const err of consoleErrors.slice(0, 10)) say(`  · ${err.slice(0, 200)}`);

writeFileSync(join(OUT, "_probe-log.txt"), log.join("\n") + "\n", "utf8");
await browser.close();
