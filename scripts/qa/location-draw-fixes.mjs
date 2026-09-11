// 적대적 리뷰 수정 검증 — 실제 브라우저 경로로 다섯 주장을 잰다.
//   npm run dev:worktree  (별도 터미널, 포트는 DEV_SERVER_PORT)
//   LOCATION_FIX_QA_URL=http://127.0.0.1:9871 node scripts/qa/location-draw-fixes.mjs
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const output = process.env.LOCATION_FIX_QA_OUTPUT ?? "verify-shots/loc-draw-fixes";
const baseUrl = process.env.LOCATION_FIX_QA_URL ?? "http://127.0.0.1:9871";
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.route("**/*", async (route) => {
  const request = route.request();
  if (request.method() !== "GET" || new URL(request.url()).origin !== new URL(baseUrl).origin) return route.continue();
  const response = await fetch(request.url(), { signal: AbortSignal.timeout(90000) });
  await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
});
page.setDefaultTimeout(90000);

const IGNORED = /WebSocket|ERR_CONNECTION_REFUSED|\[autosave\]|APITOPIA_API_KEY|vite\.dev\/config/;
const errors = [];
page.on("pageerror", (error) => errors.push("pageerror: " + error.message));
page.on("console", (message) => {
  if (message.type() !== "error") return;
  if (!IGNORED.test(message.text())) errors.push("console: " + message.text());
});

await page.addInitScript(() => {
  localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
  localStorage.setItem("oprn:ai-panel-collapsed", "1");
  // 새로고침 뒤의 「복원」 검사가 이 스크립트에 지워지면 안 된다 — 첫 로드에서만 초기화한다.
  if (!sessionStorage.getItem("loc-fix-qa-init")) {
    sessionStorage.setItem("loc-fix-qa-init", "1");
    localStorage.removeItem("oprn:map-location-layer");
  }
});

const checks = [];
const steps = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push({ name, ok, actual, expected });
  assert.ok(ok, name + "\n  실제: " + JSON.stringify(actual) + "\n  기대: " + JSON.stringify(expected));
}
function checkTruthy(name, actual) {
  checks.push({ name, ok: Boolean(actual), actual: Boolean(actual), expected: true });
  assert.ok(actual, name + " (실제: " + JSON.stringify(actual) + ")");
}
async function shot(name, note) {
  await page.screenshot({ path: output + "/" + name + ".png", fullPage: false });
  steps.push({ name, note });
}
const testId = (id) => page.getByTestId(id);

async function state() {
  return page.evaluate(async () => {
    const store = await import("/src/project/store.ts");
    const editor = await import("/src/editor/editorState.ts");
    const layer = await import("/src/editor/mapLocationLayerState.ts");
    const project = store.store.getCurrent();
    const st = editor.editorState.get();
    const map = project.maps[st.currentMapId] ?? project.maps[project.startMapId];
    return {
      tool: st.tool,
      layerEnabled: layer.locationLayerState().enabled,
      locCount: (map.locations ?? []).length,
      locations: (map.locations ?? []).map((l) => ({ id: l.id, name: l.name, x: l.x, y: l.y, w: l.w, h: l.h })),
      stored: localStorage.getItem("oprn:map-location-layer"),
      mapId: map.id,
    };
  });
}
async function tilePoint(tx, ty) {
  return page.evaluate(async ([x, y]) => {
    const module = await import("/src/editor/regionClientRect.ts");
    const rect = module.resolveRegionClientRect({ x, y, width: 1, height: 1 });
    return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
  }, [tx, ty]);
}
async function visibleTile() {
  return page.evaluate(async () => {
    const registry = await import("/src/editor/regionClientRect.ts");
    const shell = document.querySelector("[data-testid='edit-canvas']") ?? document.querySelector(".phaser-container");
    const rect = shell.getBoundingClientRect();
    return registry.resolveClientPointTile({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  });
}

await page.goto(baseUrl + "/?freshProject=1");
await testId("map-location-layer-toggle").waitFor({ state: "visible" });
await page.waitForFunction(() => Boolean(window.__oprnEditWorldToClient), null, { timeout: 120000 });
await page.waitForFunction(async () => {
  const registry = await import("/src/editor/regionClientRect.ts");
  return registry.resolveClientPointTile({ x: 700, y: 400 }) !== null;
}, null, { timeout: 120000, polling: 250 });

await testId("layer-lower").click().catch(() => {});
const boot = await state();
checkTruthy("전제: 예제 프로젝트가 열렸다", boot.mapId);
check("전제: 레이어는 꺼진 채 시작한다", boot.layerEnabled, false);

// ── 1. 켠 뒤 팔레트 칸을 고르면 그리기가 끝난다 ────────────────────────────────
await testId("map-location-layer-toggle").click();
await testId("map-location-inspector").waitFor({ state: "visible" });
check("1a. 켜면 레이어가 켜진다", (await state()).layerEnabled, true);

const paletteCell = page.locator("[data-testid^='chipset-tile-'], [data-testid^='palette-tile']").nth(6);
if (await paletteCell.count()) {
  await paletteCell.click();
  await page.waitForTimeout(250);
}
const afterPalette = await state();
check("1b. 팔레트 칸을 고르면 구역 그리기가 끝난다", afterPalette.layerEnabled, false);
await shot("01-palette-dismisses", "팔레트에서 타일을 고르면 로케이션 그리기가 꺼지고 브러시가 돌아온다.");

if (!(await state()).layerEnabled) {
  await testId("map-location-layer-toggle").click();
  await page.waitForTimeout(250);
}
check("2. 재개: 켠 상태에서 시작한다", (await state()).layerEnabled, true);

// ── 2. 사이드바 레이어 전환도 끝낸다 ───────────────────────────────────────────
const beforeUpper = await state();
await testId("layer-upper").click();
await page.waitForTimeout(250);
check("2a. 타일 레이어끼리의 전환은 그리기를 유지한다", (await state()).layerEnabled, beforeUpper.layerEnabled);
const eventLayer = page.locator("[data-testid='layer-event'], button:has-text('이벤트')").first();
if (await eventLayer.count()) await eventLayer.click();
await page.waitForTimeout(300);
const afterLayer = await state();
check("2b. 사이드바에서 이벤트 레이어로 가면 끝난다", afterLayer.layerEnabled, false);
await shot("02-sidebar-layer-dismisses", "사이드바에서 이벤트 레이어로 가면 구역 그리기가 끝난다.");
await testId("layer-lower").click().catch(() => {});

// ── 3. 팬은 그리기를 빼앗지 않는다 ────────────────────────────────────────────
await testId("map-location-layer-toggle").click();
await page.keyboard.down("Space");
await page.mouse.move(700, 500);
await page.mouse.down();
await page.mouse.move(640, 440, { steps: 6 });
await page.mouse.up();
await page.keyboard.up("Space");
await page.waitForTimeout(250);
check("3a. 스페이스 팬은 그리기를 유지한다", (await state()).layerEnabled, true);

// ── 4. 빈 상태 고스트가 팬을 따라온다 ─────────────────────────────────────────
const ghostBefore = await page.evaluate(() => {
  const ghost = document.querySelector("[data-testid='map-location-empty-ghost']");
  if (!ghost) return null;
  const rect = ghost.getBoundingClientRect();
  const shell = document.querySelector("[data-testid='edit-canvas']").getBoundingClientRect();
  return { left: Math.round(rect.left), top: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height), shellLeft: Math.round(shell.left), shellTop: Math.round(shell.top) };
});
checkTruthy("4a. 빈 맵에 고스트가 있다", ghostBefore);
// 휠 클릭(가운데 버튼)으로 민다 — 좌클릭 드래그는 구역을 그리므로 고스트가 사라진다.
await page.mouse.move(700, 500);
await page.mouse.down({ button: "middle" });
await page.mouse.move(560, 380, { steps: 8 });
await page.mouse.up({ button: "middle" });
await page.waitForTimeout(300);
const ghostAfter = await page.evaluate(() => {
  const ghost = document.querySelector("[data-testid='map-location-empty-ghost']");
  if (!ghost) return null;
  const rect = ghost.getBoundingClientRect();
  return { left: Math.round(rect.left), top: Math.round(rect.top) };
});
checkTruthy("4b. 팬 뒤에도 고스트가 있다", ghostAfter);
checkTruthy("4c. 고스트가 카메라를 따라 움직였다", ghostBefore && ghostAfter && (ghostBefore.left !== ghostAfter.left || ghostBefore.top !== ghostAfter.top));
await shot("03-ghost-follows-pan", "맵을 민 뒤에도 '여기를 드래그' 고스트가 타일 위에 남는다.");

// ── 5. Shift+클릭은 1칸 구역 ─────────────────────────────────────────────────
const anchor = await visibleTile();
checkTruthy("5a. 캔버스 중심 타일을 해석했다", anchor);
if (anchor) {
  const point = await tilePoint(anchor.x, anchor.y);
  await page.keyboard.down("Shift");
  await page.mouse.click(point.x, point.y);
  await page.keyboard.up("Shift");
  await page.waitForTimeout(350);
}
const afterShift = await state();
check("5b. Shift+클릭이 1칸 구역을 만든다", afterShift.locations.map((l) => l.w + "x" + l.h), ["1x1"]);
await shot("04-shift-click-one-tile", "Shift+클릭은 문·단상용 1칸 구역을 만든다.");

// 일반 클릭은 여전히 만들지 않는다.
const locCountBefore = (await state()).locCount;
if (anchor) {
  const point = await tilePoint(anchor.x + 2, anchor.y + 2);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(300);
}
check("5c. 일반 클릭은 여전히 구역을 만들지 않는다", (await state()).locCount, locCountBefore);

// ── 6. 드래그 중 패널이 재조립되지 않는다 ────────────────────────────────────
const paletteBefore = await page.evaluate(() => {
  const root = document.querySelector("[data-testid='left-palette-root']");
  window.__paletteProbe = root;
  return Boolean(root);
});
checkTruthy("6a. 좌측 팔레트 루트가 있다", paletteBefore);
if (anchor) {
  const start = await tilePoint(anchor.x - 6, anchor.y - 4);
  const end = await tilePoint(anchor.x - 1, anchor.y - 1);
  if (start && end) {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      await page.mouse.move(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t);
    }
    await page.mouse.up();
    await page.waitForTimeout(350);
  }
}
const paletteAfter = await page.evaluate(() => {
  const root = document.querySelector("[data-testid='left-palette-root']");
  return { same: root === window.__paletteProbe, exists: Boolean(root) };
});
check("6b. 드래그 후에도 좌측 팔레트가 같은 노드다", paletteAfter, { same: true, exists: true });
check("6c. 드래그로 구역이 늘었다", (await state()).locCount, locCountBefore + 1);
await shot("05-draw-keeps-panels", "구역을 드래그하는 동안 좌측 팔레트가 재조립되지 않는다.");

// ── 7. 복원된 레이어는 첫 클릭에 곧바로 꺼지지 않는다 ─────────────────────────
await page.evaluate(() => localStorage.setItem("oprn:map-location-layer", "1"));
await page.reload();
await testId("map-location-layer-toggle").waitFor({ state: "visible" });
await page.waitForFunction(() => Boolean(window.__oprnEditWorldToClient), null, { timeout: 120000 });
await page.waitForTimeout(400);
const restored = await state();
check("7a. 다시 열어도 레이어가 복원된다", restored.layerEnabled, true);
check("7b. 복원 직후에도 브러시가 살아 있다 (첫 상태 변화에 꺼지지 않는다)", restored.tool, "paint");
await shot("06-restored-still-on", "어제 켜 둔 레이어가 오늘도 켜진 채 열리고, 브러시가 살아 있다.");

check("8. 예상 밖 페이지 오류 없음", errors, []);

const summary = [
  "# 로케이션 그리기 결함 수정 — 브라우저 증거",
  "",
  "- 실행: " + new Date().toISOString(),
  "- URL: " + baseUrl + "/?freshProject=1 → 새로고침(?freshProject=1)",
  "- 검사 " + checks.length + "건 중 실패 " + checks.filter((c) => !c.ok).length + "건",
  "",
  "## 검사",
  "",
  "| 단언 | 결과 |",
  "|---|---|",
  ...checks.map((c) => "| " + c.name + " | " + (c.ok ? "PASS" : "FAIL") + " |"),
  "",
  "## 즉시 확인할 PNG",
  "",
  "| 파일 | 무엇을 보여 주는가 |",
  "|---|---|",
  ...steps.map((s) => "| " + s.name + ".png | " + s.note + " |"),
  "",
];
await writeFile(output + "/SUMMARY.md", summary.join("\n"));
await writeFile(output + "/checks.json", JSON.stringify({ checks, errors, steps }, null, 2));
await browser.close();
console.log(JSON.stringify({ failed: checks.filter((c) => !c.ok).length, checks: checks.length, errors }, null, 2));
