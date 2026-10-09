/**
 * 데이터베이스 「맵」 그룹 탭(타일·오브젝트·장소·지역·세계)을 실앱에서 열어 보는 비용을 잰다.
 *
 * 세 숫자를 낸다.
 *  - 클릭차단: 탭 버튼 클릭이 동기로 붙잡는 시간. 사용자가 "멈췄다"고 느끼는 구간.
 *  - 보이는썸네일완료: 화면 안 자리표시자가 전부 그림으로 바뀔 때까지. 미룬 비용을 측정 밖으로
 *    숨기지 않으려고 같이 잰다.
 *  - 재렌더: 같은 탭을 다시 눌렀을 때. 셸은 카드 선택·검색 입력마다 통째로 다시 렌더된다.
 *
 * 쓰는 법:
 *   npm run dev:worktree -- --port 9973
 *   node scripts/measure-db-map-tabs.mjs http://127.0.0.1:9973 after
 *
 * 화면에 프로젝트가 이미 열려 있어야 한다(앱이 마지막 작업을 자동으로 연다).
 * 결과는 output/evidence/db-tab-perf/<라벨>.json 과 탭별 스크린샷으로 남는다.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const ORIGIN = process.argv[2] ?? "http://127.0.0.1:9973";
const LABEL = process.argv[3] ?? "before";
const OUT = "output/evidence/db-tab-perf";

const TABS = [
  ["db-tab-spatial-tiles", "타일"],
  ["db-tab-spatial-objects", "오브젝트"],
  ["db-tab-spatial-places", "장소"],
  ["db-tab-spatial-regions", "지역"],
  ["db-tab-spatial-worlds", "세계"],
];

const clickCost = (testid) => `(() => {
  const node = document.querySelector("[data-testid='${testid}']");
  if (!(node instanceof HTMLElement)) return null;
  const t0 = performance.now();
  node.click();
  return performance.now() - t0;
})()`;

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("pageerror", (error) => console.log("PAGEERROR", error.message));

await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid='toolbar-database']", { timeout: 60_000 }).catch(() => {});
await page.waitForTimeout(6000);

await mkdir(OUT, { recursive: true });

await page.locator("[data-testid='toolbar-database']").first().click();
await page.waitForSelector("[data-testid^='db-tab-']", { timeout: 30_000 });
await page.waitForTimeout(2000);

// 「맵」 그룹을 펼친다 — 아코디언이라 다른 그룹이 열려 있으면 탭 버튼이 숨어 있다.
const mapGroup = page.locator("[data-group-slug='world']").first();
if (await mapGroup.count() && (await mapGroup.getAttribute("aria-expanded")) === "false") {
  await mapGroup.click();
  await page.waitForTimeout(500);
}

const rows = [];
for (const [testid, label] of TABS) {
  if (!(await page.locator(`[data-testid='${testid}']`).count())) {
    rows.push({ label, testid, error: "탭 없음" });
    continue;
  }
  const cold = await page.evaluate(clickCost(testid));
  // 화면에 보이는 자리표시자가 전부 채워질 때까지 — 미룬 비용을 측정 밖으로 숨기지 않는다.
  const settled = await page.evaluate(async () => {
    const visiblePending = () => [...document.querySelectorAll("[data-thumb='pending']")]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
      }).length;
    const t0 = performance.now();
    while (visiblePending() > 0 && performance.now() - t0 < 60_000) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    return performance.now() - t0;
  });
  await page.waitForTimeout(800);
  const warm = await page.evaluate(clickCost(testid));
  await page.waitForTimeout(500);
  const counts = await page.evaluate(() => ({
    cards: document.querySelectorAll("[data-card-id], .asset-browser-card").length,
    canvases: document.querySelectorAll(".database-modal-body canvas").length,
  }));
  rows.push({ label, testid, cold: Math.round(cold ?? -1), settled: Math.round(settled ?? -1), warm: Math.round(warm ?? -1), ...counts });
  await page.screenshot({ path: `${OUT}/${LABEL}-${testid}.png` });
  process.stdout.write(`  ${label} cold=${Math.round(cold ?? -1)}ms settled=${Math.round(settled ?? -1)}ms warm=${Math.round(warm ?? -1)}ms\n`);
}

const table = rows.map((row) => row.error
  ? `${row.label.padEnd(8)} ${row.error}`
  : `${row.label.padEnd(8)} 클릭차단=${String(row.cold).padStart(6)}ms  보이는썸네일완료=${String(row.settled).padStart(6)}ms  재렌더=${String(row.warm).padStart(6)}ms  cards=${String(row.cards).padStart(4)}  canvases=${String(row.canvases).padStart(4)}`).join("\n");
console.log(`\n=== ${LABEL}: 실앱 데이터베이스 탭 전환 ===\n${table}\n`);
await writeFile(`${OUT}/${LABEL}.json`, JSON.stringify(rows, null, 2));
await browser.close();
