// scripts/observe-structure-ux.mjs
// 구조물 편집기 저작 UX 실측 관찰기 — 팔레트 클릭→그리기 흐름에서 화면이 어떻게 흔들리는지 잰다.
//
// 왜 e2e 스펙이 아니라 스크립트인가: 판정이 아니라 "관찰"이다. 스크롤·포커스·노드 정체성처럼
// 사람이 눈으로만 알던 것을 숫자로 남기고 스크린샷을 붙인다. 결과는 OBS.json + PNG.
//
// 사용: node scripts/observe-structure-ux.mjs [--port 9841] [--out verify-shots/structure-ux]
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = argOf("--port", "9841");
const OUT = argOf("--out", "verify-shots/structure-ux");
const BASE = `http://127.0.0.1:${PORT}`;

const notes = [];
const note = (key, value) => {
  notes.push({ key, value });
  console.log(`[obs] ${key} = ${JSON.stringify(value)}`);
};

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(OUT, `${String(shotIndex).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  console.log(`[shot] ${file}`);
  return file;
}

/** 팔레트/캔버스 상태 스냅샷 — 흔들림은 이 값들의 변화로 드러난다. */
const probeScript = () => {
  const q = (id) => document.querySelector(`[data-testid="${id}"]`);
  const palette = q("structure-kit-editor-palette");
  const canvas = q("structure-kit-editor-canvas");
  const search = q("structure-kit-editor-search");
  const active = document.querySelector(".structure-kit-editor-swatch.active");
  return {
    paletteScrollTop: palette ? palette.scrollTop : null,
    paletteScrollHeight: palette ? palette.scrollHeight : null,
    paletteClientHeight: palette ? palette.clientHeight : null,
    swatchCount: document.querySelectorAll(".structure-kit-editor-swatch").length,
    activeTestid: active ? active.dataset.testid : null,
    focusTestid: document.activeElement ? (document.activeElement.dataset?.testid ?? document.activeElement.tagName) : null,
    searchValue: search ? search.value : null,
    canvasBox: canvas ? (() => { const b = canvas.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; })() : null,
    zoom: q("structure-kit-editor-zoom-value")?.textContent ?? null,
    parts: q("structure-kit-editor-parts")?.textContent?.slice(0, 40) ?? null,
  };
};

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200)); });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${String(err).slice(0, 200)}`));

  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto(`${BASE}/?freshProject=1`);
  await page.getByTestId("edit-canvas").waitFor({ timeout: 60_000 });
  await page.getByTestId("toolbar-database").waitFor({ timeout: 30_000 });
  await page.getByTestId("toolbar-database").click();

  // 사이드바는 아코디언이라 접힌 그룹의 탭은 먼저 펼쳐야 눌린다 (e2e 헬퍼와 같은 절차).
  const tabBtn = page.getByTestId("db-tab-structure-kits");
  await tabBtn.waitFor({ state: "attached", timeout: 20_000 });
  if (!(await tabBtn.isVisible())) {
    const groups = page.locator('[data-testid^="db-tab-group-"]');
    const total = await groups.count();
    for (let i = 0; i < total; i += 1) {
      await groups.nth(i).click();
      if (await tabBtn.isVisible()) break;
    }
  }
  await tabBtn.click({ force: true });
  await page.getByTestId("structure-kit-heading").waitFor({ timeout: 15_000 });
  await shot(page, "db-structure-tab");

  // 새 구조물 → 빈 킷
  await page.getByTestId("structure-kit-new").click();
  const blank = page.getByTestId("structure-kit-new-blank");
  if ((await blank.count()) > 0) await blank.click();
  await page.getByTestId("structure-kit-editor").waitFor({ timeout: 20_000 });
  await shot(page, "editor-opened-3x3");
  note("opened", await page.evaluate(probeScript));

  // 좀 더 큰 킷으로: 폭·높이를 12x10 으로
  await page.getByTestId("structure-kit-editor-width").fill("12");
  await page.getByTestId("structure-kit-editor-width").press("Enter");
  await page.getByTestId("structure-kit-editor-height").fill("10");
  await page.getByTestId("structure-kit-editor-height").press("Enter");
  await shot(page, "resized-12x10");
  note("after-resize", await page.evaluate(probeScript));

  // 팔레트를 아래로 스크롤한 뒤 타일을 고른다 — 스크롤이 유지되는가?
  await page.evaluate(() => {
    const p = document.querySelector('[data-testid="structure-kit-editor-palette"]');
    if (p) p.scrollTop = 400;
  });
  const beforePick = await page.evaluate(probeScript);
  note("before-tile-pick", beforePick);
  await shot(page, "palette-scrolled-400");

  // 스크롤된 위치에서 보이는 타일 하나를 클릭한다 (좌표 클릭 — 자동 스크롤 없이)
  const pickedTestid = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="structure-kit-editor-palette"]');
    if (!p) return null;
    const pb = p.getBoundingClientRect();
    for (const sw of p.querySelectorAll(".structure-kit-editor-swatch")) {
      const b = sw.getBoundingClientRect();
      if (b.top > pb.top + 20 && b.bottom < pb.bottom - 20) return sw.dataset.testid;
    }
    return null;
  });
  note("picked-swatch", pickedTestid);
  if (pickedTestid) {
    const box = await page.getByTestId(pickedTestid).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  const afterPick = await page.evaluate(probeScript);
  note("after-tile-pick", afterPick);
  note("SCROLL-JUMP", { before: beforePick.paletteScrollTop, after: afterPick.paletteScrollTop });
  await shot(page, "after-tile-pick");

  // 그 타일이 화면에서 어디로 갔는지 — 같은 좌표에 아직 같은 타일이 있는가?
  const atSameSpot = await page.evaluate((testid) => {
    const sw = document.querySelector(`[data-testid="${testid}"]`);
    if (!sw) return { gone: true };
    const b = sw.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return {
      gone: false,
      inView: b.height > 0,
      hitSelf: hit === sw || sw.contains(hit),
      hitTestid: hit?.dataset?.testid ?? hit?.className ?? null,
      top: Math.round(b.top),
    };
  }, pickedTestid);
  note("picked-swatch-after-click", atSameSpot);

  // 캔버스에 드래그로 한 줄 칠하기
  const cbox = await page.getByTestId("structure-kit-editor-canvas").boundingBox();
  note("canvas-box", cbox);
  const cell = Math.round(cbox.width / 12);
  await page.mouse.move(cbox.x + cell * 1.5, cbox.y + cell * 1.5);
  await page.mouse.down();
  for (let i = 2; i < 8; i += 1) await page.mouse.move(cbox.x + cell * (i + 0.5), cbox.y + cell * 1.5);
  await page.mouse.up();
  await shot(page, "after-drag-row");
  note("after-drag", await page.evaluate(probeScript));

  // 두 번째 타일을 고르고 다시 칠하기 — 연속 저작 리듬 확인
  await page.evaluate(() => {
    const p = document.querySelector('[data-testid="structure-kit-editor-palette"]');
    if (p) p.scrollTop = 250;
  });
  const before2 = await page.evaluate(probeScript);
  const picked2 = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="structure-kit-editor-palette"]');
    const pb = p.getBoundingClientRect();
    for (const sw of p.querySelectorAll(".structure-kit-editor-swatch")) {
      const b = sw.getBoundingClientRect();
      if (b.top > pb.top + 60 && b.bottom < pb.bottom - 20) return sw.dataset.testid;
    }
    return null;
  });
  if (picked2) {
    const box = await page.getByTestId(picked2).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  const after2 = await page.evaluate(probeScript);
  note("second-pick-scroll", { picked: picked2, before: before2.paletteScrollTop, after: after2.paletteScrollTop });
  await shot(page, "second-pick");

  // 검색 → 포커스가 유지되는가, 그리고 타일 클릭 후 검색어는 어떻게 되나
  await page.getByTestId("structure-kit-editor-search").click();
  await page.keyboard.type("문");
  note("after-typing-search", await page.evaluate(probeScript));
  await shot(page, "search-door");
  const firstVisible = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="structure-kit-editor-palette"]');
    for (const sw of p.querySelectorAll(".structure-kit-editor-swatch")) {
      if (!sw.classList.contains("is-filtered-out")) return sw.dataset.testid;
    }
    return null;
  });
  if (firstVisible) await page.getByTestId(firstVisible).click();
  note("after-pick-while-searching", await page.evaluate(probeScript));
  await shot(page, "search-then-pick");

  // 검색 상태에서 칠하기
  await page.mouse.move(cbox.x + cell * 1.5, cbox.y + cell * 4.5);
  await page.mouse.down();
  for (let i = 2; i < 6; i += 1) await page.mouse.move(cbox.x + cell * (i + 0.5), cbox.y + cell * 4.5);
  await page.mouse.up();
  await shot(page, "paint-while-searching");

  // 덧그림 레이어 전환 후 칠하기
  await page.getByTestId("structure-kit-editor-layer-upper").click();
  note("after-layer-switch", await page.evaluate(probeScript));
  await shot(page, "layer-upper");

  // 도구 전환(사각형) 후 드래그
  await page.getByTestId("structure-kit-editor-tool-rect").click();
  note("after-tool-rect", await page.evaluate(probeScript));
  await page.mouse.move(cbox.x + cell * 2.5, cbox.y + cell * 6.5);
  await page.mouse.down();
  await page.mouse.move(cbox.x + cell * 7.5, cbox.y + cell * 8.5);
  await shot(page, "rect-preview");
  await page.mouse.up();
  await shot(page, "rect-committed");

  // 되돌리기 두 번
  await page.getByTestId("structure-kit-editor-undo").click();
  await shot(page, "after-undo");
  note("after-undo", await page.evaluate(probeScript));

  // 줌 조작
  await page.getByTestId("structure-kit-editor-zoom-in").click();
  await shot(page, "zoom-in");
  note("after-zoom-in", await page.evaluate(probeScript));

  // 지금 쓰인 타일이 팔레트에서 구별되는가 + [안 쓴 타일만] 필터가 실제로 거르는가.
  const usedMarkers = await page.evaluate(() => ({
    swatchesWithUsedMark: document.querySelectorAll(".structure-kit-editor-swatch.is-used").length,
    unusedCheckbox: document.querySelector('[data-testid="structure-kit-editor-unused-only"]') ? true : false,
    usedCountText: document.querySelector('[data-testid="structure-kit-editor-used-count"]')?.textContent ?? null,
  }));
  note("used-tile-affordances", usedMarkers);
  await shot(page, "used-tile-marks");

  if (usedMarkers.unusedCheckbox) {
    await page.getByTestId("structure-kit-editor-unused-only").check();
    note("unused-only-on", await page.evaluate(() => ({
      hiddenSwatches: [...document.querySelectorAll(".structure-kit-editor-swatch")].filter((s) => s.hasAttribute("hidden")).length,
      usedStillVisible: [...document.querySelectorAll(".structure-kit-editor-swatch.is-used")].filter((s) => !s.hasAttribute("hidden")).length,
    })));
    await shot(page, "unused-only-on");
    await page.getByTestId("structure-kit-editor-unused-only").uncheck();
    note("unused-only-off", await page.evaluate(() => ({
      hiddenSwatches: [...document.querySelectorAll(".structure-kit-editor-swatch")].filter((s) => s.hasAttribute("hidden")).length,
    })));
  }

  // 격자선이 실제로 눈에 보이는가 — 캔버스 바탕(#101318) 위에 그은 선의 대비를 픽셀로 잰다.
  // 예전에는 var(--border-strong)(거의 검정)을 써서 격자를 켜도 아무것도 안 보였다.
  note("grid-line-paint", await page.evaluate(() => {
    const lines = document.querySelector(".structure-kit-editor-grid-lines");
    if (!lines) return { present: false };
    const style = getComputedStyle(lines);
    return {
      present: true,
      cell: style.getPropertyValue("--structure-kit-cell").trim(),
      backgroundImage: style.backgroundImage.slice(0, 160),
      stageOutline: getComputedStyle(document.querySelector(".structure-kit-editor-canvas-stage")).outline,
    };
  }));

  note("consoleErrors", consoleErrors.slice(0, 10));
  await writeFile(path.join(OUT, "OBS.json"), JSON.stringify(notes, null, 2));
  await browser.close();
  console.log(`\n[done] ${notes.length} observations → ${path.join(OUT, "OBS.json")}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
