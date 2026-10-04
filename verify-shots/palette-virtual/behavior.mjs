import { chromium } from "playwright";
const TS = process.env.TS || "beodeul_city";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1"); });
const errs = []; page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
await page.goto("http://127.0.0.1:9863/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
await page.evaluate((t) => window.__oprnEditorStore.update((d) => { d.maps[d.startMapId].tilesetId = t; }), TS);
await page.waitForSelector("[data-testid^='chipset-tile-']", { timeout: 60000 });
await page.waitForTimeout(3000);
const log = (k, v) => console.log(k.padEnd(28), JSON.stringify(v));
const cellsInfo = () => page.evaluate(() => ({ cells: document.querySelectorAll(".chipset-tile").length, active: [...document.querySelectorAll(".chipset-tile.active")].map(c => c.dataset.tileIndex), pressed: document.querySelectorAll(".chipset-tile[aria-pressed=true]").length }));
log("initial", await cellsInfo());
// 툴팁·속성
log("attrs", await page.evaluate(() => { const c = document.querySelector(".chipset-tile"); return { testid: c.dataset.testid, idx: c.dataset.tileIndex, title: (c.title || "").slice(0, 40), aria: (c.getAttribute("aria-label") || "").slice(0, 40), type: c.type }; }));
// 선택
const first = page.locator(".chipset-tile").nth(40);
const idx1 = await first.getAttribute("data-tile-index");
await first.click(); await page.waitForTimeout(200);
log("click select", { clicked: idx1, ...(await cellsInfo()) });
// 스크롤 유지 + 재렌더
const sc = await page.evaluate(async () => { const s = document.querySelector("[data-testid='tile-palette']"); s.scrollTop = 1500; s.scrollLeft = 200; await new Promise(r => setTimeout(r, 400)); return { top: s.scrollTop, left: s.scrollLeft, cells: document.querySelectorAll(".chipset-tile").length, minIdx: Math.min(...[...document.querySelectorAll(".chipset-tile")].map(c => +c.dataset.tileIndex)) }; });
log("scrolled", sc);
await page.locator(".chipset-tile").nth(200).click(); await page.waitForTimeout(300);
log("after click keeps scroll", await page.evaluate(() => { const s = document.querySelector("[data-testid='tile-palette']"); return { top: s.scrollTop, left: s.scrollLeft, cells: document.querySelectorAll(".chipset-tile").length }; }));
// 필터: 검색
const search = page.locator("[data-testid='tile-search-input'], input[type=search]").first();
log("search input found", await search.count());
if (await search.count()) {
  await search.click(); await page.keyboard.type("잔디", { delay: 60 }); await page.waitForTimeout(700);
  log("after search", { focused: await page.evaluate(() => document.activeElement?.tagName + ":" + (document.activeElement?.value ?? "")), dim: await page.evaluate(() => document.querySelectorAll(".chipset-tile.is-filtered-out").length), total: await page.evaluate(() => document.querySelectorAll(".chipset-tile").length), status: await page.evaluate(() => document.querySelector(".palette-filter-status")?.textContent?.slice(0, 60)) });
  const clear = page.getByText("필터 해제").first();
  if (await clear.count()) { await clear.click(); await page.waitForTimeout(400); log("after clear", { input: await search.inputValue(), dim: await page.evaluate(() => document.querySelectorAll(".chipset-tile.is-filtered-out").length), status: await page.evaluate(() => document.querySelector(".palette-filter-status")?.textContent ?? null) }); }
}
// 필터: 분류
const sel = page.locator("[data-testid='tile-category-select']");
const opts = await sel.locator("option").evaluateAll(o => o.map(x => x.value));
log("category options", opts);
for (const v of opts.slice(0, 4)) { await sel.selectOption(v); await page.waitForTimeout(400); log("cat " + v, { dim: await page.evaluate(() => document.querySelectorAll(".chipset-tile.is-filtered-out").length), cells: await page.evaluate(() => document.querySelectorAll(".chipset-tile").length), status: await page.evaluate(() => document.querySelector(".palette-filter-status")?.textContent?.slice(0, 50) ?? null), selVal: await sel.inputValue() }); }
await sel.selectOption(opts[0]); await page.waitForTimeout(300);
// 키보드
await page.evaluate(() => { const s = document.querySelector("[data-testid='tile-palette']"); s.scrollTop = 0; s.scrollLeft = 0; }); await page.waitForTimeout(300);
const c0 = page.locator(".chipset-tile").first(); await c0.focus();
const foc = () => page.evaluate(() => document.activeElement?.dataset?.tileIndex ?? document.activeElement?.tagName);
const seq = [];
for (const k of ["ArrowRight", "ArrowRight", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowUp"]) { await page.keyboard.press(k); await page.waitForTimeout(80); seq.push(k.replace("Arrow", "") + ">" + await foc()); }
log("arrows", seq);
const seq2 = []; for (const k of ["End", "Home"]) { await page.keyboard.press(k); await page.waitForTimeout(400); seq2.push(k + ">" + await foc()); }
log("home/end", seq2);
// 렌더 밖 이동: PageDown 여러번/ArrowDown 40번
await c0.focus(); for (let i = 0; i < 40; i++) await page.keyboard.press("ArrowDown"); await page.waitForTimeout(400);
log("40x down", { focus: await foc(), scrollTop: await page.evaluate(() => document.querySelector("[data-testid='tile-palette']").scrollTop) });
await page.keyboard.press("Enter"); await page.waitForTimeout(200); log("enter select", await cellsInfo());
// 드래그
await page.evaluate(() => { const s = document.querySelector("[data-testid='tile-palette']"); s.scrollTop = 0; s.scrollLeft = 0; }); await page.waitForTimeout(300);
const A = await page.locator(".chipset-tile").nth(10).boundingBox(); const B = await page.locator(".chipset-tile").nth(10 + 128 * 2 + 3).boundingBox();
await page.mouse.move(A.x + 5, A.y + 5); await page.mouse.down(); await page.mouse.move(B.x + 5, B.y + 5, { steps: 6 });
log("drag preview", await page.evaluate(() => document.querySelectorAll(".chipset-tile.stamp-source").length));
await page.mouse.up(); await page.waitForTimeout(400);
log("after drag", { ...(await cellsInfo()), stampSource: await page.evaluate(() => document.querySelectorAll(".chipset-tile.stamp-source").length), txt: await page.evaluate(() => (document.querySelector("[data-testid='palette-work-shell']")?.textContent.match(/[0-9]+×[0-9]+[^ ]{0,10}/) || [null])[0]) });
// 줌: 셀 크기
log("cell size", await page.evaluate(() => { const c = document.querySelector(".chipset-tile").getBoundingClientRect(); return [c.width, c.height]; }));
// reveal
log("reveal fn", await page.evaluate(() => typeof window.__oprnEditorTool));
log("errors", errs);
await b.close();
