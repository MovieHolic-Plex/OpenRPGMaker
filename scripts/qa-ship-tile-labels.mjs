// 기준5 실표면 QA — 브라우저에서 배 칩셋의 타일 라벨이 마을 라벨이 아닌 배 전용 라벨로 나오는지 확인한다.
//
// 왜 이 QA 가 필요한가: 시맨틱 테이블을 resourceSearch/tileMetadataTools 에 배선하는 것만으로는
// 화면에 아무것도 바뀌지 않는다. 사용자가 읽는 라벨은 전부 tileset.tileMeta 를 지나간다
// (tilePalette.ts quickTileName, tilesetSemanticChecker.ts summarizeTileUsage). 그래서 이 스크립트는
// 배선이 아니라 **화면에 실제로 보이는 문자열**을 증거로 잡는다.
//
// 사용:
//   node scripts/qa-ship-tile-labels.mjs --base http://127.0.0.1:9843 --out .omo/evidence/qa-ship

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const base = value("--base", "http://127.0.0.1:9843");
const outDir = value("--out", ".omo/evidence/qa-ship");

const SHIP_TILESET_ID = "easyrpg_chipset_ship";
const log = [];
function step(message) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${message}`;
  log.push(line);
  console.log(line);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

  let verdict = "FAIL";
  let detail = "";
  try {
    step(`goto ${base}/?freshProject=1`);
    await page.goto(`${base}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    const coachSkip = page.getByTestId("coach-mark-skip");
    if (await coachSkip.isVisible().catch(() => false)) {
      step("click coach-mark-skip");
      await coachSkip.click();
    }

    step("wait for tile palette (editor booted)");
    await page.getByTestId("tile-palette").waitFor({ state: "visible", timeout: 30_000 });
    const beforeLabel = await page.locator(".selected-tile-label").first().textContent().catch(() => null);
    step(`baseline (town chipset) selected-tile-label = ${JSON.stringify(beforeLabel)}`);

    // 목표가 지정한 표면은 타일 그림판이다. 맵의 타일셋을 배로 바꾸면 팔레트가 배 라벨을 보여준다.
    // DB 모달 경로는 버렸다 — 그 상세 패널은 특정 편집 모드에서만 렌더되고, 칩 클릭이 선택을
    // 일으키지 않아 innerText 가 모달 뒤 배경만 읽었다(마을 라벨이 그래서 잡혔다).
    const shipTable = JSON.parse(fs.readFileSync(".omo/evidence/shipLabels.qa.json", "utf8"));

    step("open map properties modal");
    const firstNode = page.locator('[data-testid^="map-tree-node-"]').first();
    await firstNode.waitFor({ state: "visible", timeout: 20_000 });
    const nodeTestid = await firstNode.getAttribute("data-testid");
    const mapId = (nodeTestid ?? "").replace("map-tree-node-", "");
    step(`mapId = ${mapId}`);
    await firstNode.click();
    const moreBtn = page.getByTestId(`map-more-${mapId}`);
    const ctxBtn = page.getByTestId(`map-context-trigger-${mapId}`);
    if (await moreBtn.count() > 0) await moreBtn.click({ force: true }).catch(() => {});
    else if (await ctxBtn.count() > 0) await ctxBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
    const propsItem = page.getByRole("menuitem", { name: /맵 설정|속성|설정/ }).first();
    if (await propsItem.count() > 0) await propsItem.click().catch(() => {});
    await page.waitForTimeout(800);

    step("select ship tileset in map props");
    const select = page.getByTestId("map-props-tileset-select");
    await select.waitFor({ state: "visible", timeout: 20_000 });
    await select.selectOption(SHIP_TILESET_ID);
    await page.waitForTimeout(1000);
    const closeBtn = page.getByRole("button", { name: /닫기|확인/ }).first();
    if (await closeBtn.count() > 0) await closeBtn.click().catch(() => {});
    await page.waitForTimeout(1200);

    const paletteName = await page.getByTestId("palette-tileset-name").first().textContent().catch(() => null);
    step(`palette-tileset-name = ${JSON.stringify(paletteName)}`);

    // 가장 강한 증거: 같은 타일 인덱스의 라벨이 칩셋 전환으로 바뀌는지 본다.
    // 실측 - 전환 전 "360 흙길 중심"(합본 마을), 전환 후 "360 갈색 흙바닥"(배 테이블 360번).
    // 개별 칩 클릭은 필터/스크롤 상태에 따라 셀이 없을 수 있어 보조 증거로만 쓴다.
    const afterLabel = await page.locator(".selected-tile-label").first().textContent().catch(() => null);
    step(`ship chipset selected-tile-label = ${JSON.stringify(afterLabel)}`);

    const observed = [];
    for (const tile of [0, 6, 18, 120, 200]) {
      const cell = page.getByTestId(`chipset-tile-${tile}`).first();
      if ((await cell.count()) === 0) continue;
      await cell.click({ timeout: 2_500 }).catch(() => {});
      await page.waitForTimeout(250);
      const shown = await page.locator(".selected-tile-label").first().textContent().catch(() => null);
      const expected = shipTable[String(tile)];
      if (shown && expected && shown.includes(expected)) {
        observed.push({ tile, label: shown });
        step(`보조 증거 tile ${tile} -> ${JSON.stringify(shown)} (기대 ${JSON.stringify(expected)})`);
      }
    }

    const finalText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    fs.writeFileSync(path.join(outDir, "page-text.txt"), finalText, "utf8");
    const allLabels = Object.values(shipTable);
    const hits = allLabels.filter((l) => finalText.includes(l));
    step(`배 테이블 라벨 ${allLabels.length}개 중 화면에 ${hits.length}개: ${hits.slice(0, 5).join(" / ")}`);

    const shot = path.join(outDir, "ship-tile-labels.png");
    await page.screenshot({ path: shot, fullPage: false });
    step(`screenshot -> ${shot}`);

    const paletteShot = path.join(outDir, "ship-palette.png");
    await page.getByTestId("tile-palette").screenshot({ path: paletteShot }).catch(() => {});
    step(`palette screenshot -> ${paletteShot}`);

    // 판정: 배 칩셋에서 읽은 라벨이 존재하고, 마을 칩셋 대조군과 다르며, tileMeta 라벨 수가 464 여야 한다.
    // 판정: (1) 팔레트가 배 칩셋을 가리키고, (2) 같은 인덱스의 라벨이 마을 라벨에서 바뀌었고,
    // (3) 바뀐 라벨이 배 테이블의 해당 인덱스와 일치한다.
    const idxMatch = /^(\d+)/.exec((afterLabel ?? "").trim());
    const shownIndex = idxMatch ? idxMatch[1] : null;
    const expectedForShown = shownIndex ? shipTable[shownIndex] : undefined;
    const isShipPalette = (paletteName ?? "").includes("배");
    const changed = Boolean(afterLabel && beforeLabel && afterLabel !== beforeLabel);
    const matchesShipTable = Boolean(afterLabel && expectedForShown && afterLabel.includes(expectedForShown));
    step(`판정 근거: 팔레트=배 ${isShipPalette} | 라벨변경 ${changed} (${JSON.stringify(beforeLabel)} -> ${JSON.stringify(afterLabel)}) | 배테이블일치 ${matchesShipTable} (${shownIndex}번 기대 ${JSON.stringify(expectedForShown)})`);
    if (!isShipPalette) detail += `팔레트가 배 칩셋이 아니다 (${paletteName}). `;
    if (!changed) detail += "칩셋을 바꿨는데 라벨이 그대로다. ";
    if (!matchesShipTable) detail += "표시된 라벨이 배 테이블과 다르다. ";
    verdict = isShipPalette && changed && matchesShipTable ? "PASS" : "FAIL";
  } catch (error) {
    detail += `예외: ${(error instanceof Error ? error.message : String(error)).slice(0, 300)}`;
  } finally {
    await context.close();
    await browser.close();
    step("browser context + browser closed (cleanup)");
  }

  if (consoleErrors.length > 0) step(`console errors (${consoleErrors.length}): ${consoleErrors.slice(0, 3).join(" | ")}`);
  step(`VERDICT ${verdict}${detail ? " :: " + detail : ""}`);
  fs.writeFileSync(path.join(outDir, "action-log.txt"), log.join("\n") + "\n", "utf8");
  process.exit(verdict === "PASS" ? 0 : 1);
}

await main();
