// ESC 상태 메뉴 레이아웃 기하 프로브 — 출하 player.html 을 실제로 띄워 명령 레일이
// 왼쪽 세로 레일인지, 파티·상세·트레이와 겹치지 않는지 사각으로 판정하고 스샷을 남긴다.
//
//   node scripts/qa/runtime/status-menu-layout.probe.mjs
//
// 결과: verify-shots/runtime-qa/status-menu-layout/{SUMMARY.md, *.png}
// 종료 코드 1 = 어느 판정이든 실패.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const OUT = join(REPO_ROOT, "verify-shots/runtime-qa/status-menu-layout");
const FIXTURE = join(REPO_ROOT, "test/fixtures/projects/item-runtime-qa-v3.json");
const PROJECT_URL = "/__qa/project.json";

function rectOf(page, testid) {
  return page.evaluate((id) => {
    const node = document.querySelector(`[data-testid='${id}']`);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
  }, testid);
}

function overlaps(a, b) {
  return a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
}
function inside(a, stage) {
  return a.x >= stage.x - 0.5 && a.y >= stage.y - 0.5 && a.right <= stage.right + 0.5 && a.bottom <= stage.bottom + 0.5;
}

const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const failures = [];
const lines = ["# ESC 메뉴 레이아웃 프로브", ""];
try {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 960, height: 720 });
  const projectJson = await readFile(FIXTURE, "utf8");
  await page.addInitScript(([projectUrl]) => {
    try { localStorage.clear(); } catch { /* ignore */ }
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: "runtime-qa:status-menu-layout", qaInstrumentation: true };
  }, [PROJECT_URL]);
  await page.route(`**${PROJECT_URL}`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug != null, undefined, { timeout: 120_000 });
  await page.waitForSelector("[data-testid='title-screen']", { state: "detached", timeout: 30_000 });
  await page.keyboard.press("x");
  await page.waitForSelector("[data-testid='main-menu']", { timeout: 30_000 });
  await page.waitForTimeout(250); // juice-menu-open 160ms 뒤 안정 프레임

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const stage = await rectOf(page, "main-menu");
  const rail = await rectOf(page, "status-menu-command-rail");
  const party = await rectOf(page, "status-menu-party");
  await page.screenshot({ path: join(OUT, "01-dock.png") });

  const check = (name, ok, detail) => {
    lines.push(`- ${ok ? "PASS" : "FAIL"} ${name} — ${detail}`);
    if (!ok) failures.push(name);
  };
  check("rail is vertical (h > w)", rail.h > rail.w, `rail ${rail.w.toFixed(0)}×${rail.h.toFixed(0)}`);
  check("rail hugs left edge", rail.x - stage.x < stage.w * 0.1, `rail.x-stage.x=${(rail.x - stage.x).toFixed(0)}`);
  check("party sits right of rail", rail.right <= party.x + 0.5 && !overlaps(rail, party), `rail.right=${rail.right.toFixed(0)} party.x=${party.x.toFixed(0)}`);
  check("party inside stage", inside(party, stage), JSON.stringify(party));

  // 아이템 상세
  await page.keyboard.press("z");
  await page.waitForSelector("[data-testid='status-menu-item-item_potion']", { timeout: 30_000 });
  await page.waitForTimeout(200);
  const detail = await rectOf(page, "status-menu-detail");
  await page.screenshot({ path: join(OUT, "02-items.png") });
  check("detail sits right of rail", rail.right <= detail.x + 0.5 && !overlaps(rail, detail), `detail.x=${detail.x.toFixed(0)}`);
  check("detail below party (no overlap)", !overlaps(detail, party), `party.bottom=${party.bottom.toFixed(0)} detail.y=${detail.y.toFixed(0)}`);
  check("detail inside stage", inside(detail, stage), JSON.stringify(detail));
  const clipped = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("[data-testid^='status-menu-item-item_']"));
    return rows.filter((r) => r.scrollWidth > r.clientWidth + 1).length;
  });
  check("no horizontally clipped item rows", clipped === 0, `clipped=${clipped}`);
  // 쇼케이스: 선택 항목의 큰 그림이 실제 그려지고(배경 이미지 있음) 상세 패널 안에 들어 있어야 한다.
  const showcase = await rectOf(page, "status-menu-detail-showcase");
  check("showcase present beside item list", showcase !== null && inside(showcase, detail), JSON.stringify(showcase));
  const showcaseInfo = await page.evaluate(() => {
    const art = document.querySelector("[data-testid='status-menu-showcase-art']");
    const desc = document.querySelector("[data-testid='status-menu-showcase-description']");
    const artRect = art?.getBoundingClientRect();
    return {
      hasImage: art ? getComputedStyle(art).backgroundImage !== "none" : false,
      artSize: artRect ? Math.round(artRect.width) : 0,
      descLen: desc?.textContent?.length ?? 0,
      descClipped: desc ? desc.scrollHeight > desc.clientHeight + 1 : false,
    };
  });
  check("showcase art is an image >= 24px logical", showcaseInfo.hasImage && showcaseInfo.artSize >= 24 * 3 - 2, JSON.stringify(showcaseInfo));
  check("showcase description present and not clipped", showcaseInfo.descLen > 0 && !showcaseInfo.descClipped, JSON.stringify(showcaseInfo));
  const listGeom = await page.evaluate(() => {
    const list = document.querySelector("[data-testid='status-menu-detail'] .status-menu-detail-list");
    if (!list) return null;
    const scale = list.getBoundingClientRect().height / list.clientHeight;
    const rows = Array.from(list.children).map((r) => Math.round(r.getBoundingClientRect().height / scale));
    const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
    return { clientH: list.clientHeight, scrollH: list.scrollHeight, rows, gap };
  });
  // 목록 높이가 행 높이의 정수배(행 h + 간격)에서 간격을 벀 값이어야 마지막 보이는 행이 온전하다.
  const rowStepOk = listGeom !== null && listGeom.rows.length > 0
    && (listGeom.clientH + listGeom.gap) % (listGeom.rows[0] + listGeom.gap) === 0;
  check("item list height is a whole number of rows", rowStepOk, JSON.stringify(listGeom));
  const fontPx = await page.evaluate(() => {
    const row = document.querySelector("[data-testid^='status-menu-item-item_']");
    return row ? parseFloat(getComputedStyle(row).fontSize) : 0;
  });
  check("list row type is 7px logical (was 8px)", Math.abs(fontPx - 7) < 0.01, `fontSize=${fontPx}`);

  // 파티 트레이
  // 뒤로 가도 상세 노드는 DOM 에 남아 미리보기로 보인다 — 포커스 복귀는 루트 클래스로 판정한다.
  await page.keyboard.press("x");
  await page.waitForFunction(() => {
    const menu = document.querySelector("[data-testid='main-menu']");
    return menu !== null && !menu.classList.contains("status-menu-detail-focus");
  }, undefined, { timeout: 30_000 });
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown");
  await page.keyboard.press("z");
  await page.waitForSelector("[data-testid='status-menu-group-command-status']", { timeout: 30_000 });
  await page.waitForTimeout(200);
  const tray = await rectOf(page, "status-menu-detail");
  await page.screenshot({ path: join(OUT, "03-party-tray.png") });
  check("tray sits right of rail", rail.right <= tray.x + 0.5 && !overlaps(rail, tray), `tray.x=${tray.x.toFixed(0)}`);
  check("tray inside stage", inside(tray, stage), JSON.stringify(tray));
  const trayClipped = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("[data-testid^='status-menu-group-command-']"));
    return rows.filter((r) => r.scrollWidth > r.clientWidth + 1 || r.scrollHeight > r.clientHeight + 1).length;
  });
  check("no clipped tray buttons", trayClipped === 0, `clipped=${trayClipped}`);

  // 시스템 트레이(파괴적 항목 포함) 스샷
  await page.keyboard.press("x");
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown");
  await page.keyboard.press("z");
  await page.waitForSelector("[data-testid='status-menu-group-command-to-title']", { timeout: 30_000 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, "04-system-tray.png") });

  // 장비 화면(스탯 델타 자리) 스샷
  await page.keyboard.press("x");
  await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowUp");
  await page.keyboard.press("z");
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, "05-equipment.png") });
} catch (error) {
  failures.push(`probe error: ${String(error?.message ?? error).split("\n")[0]}`);
  lines.push(`- ERROR ${failures.at(-1)}`);
} finally {
  await browser.close();
  await server.close();
}
lines.push("", `게이트: ${failures.length === 0 ? "통과" : "실패"}`);
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, "SUMMARY.md"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
process.exit(failures.length === 0 ? 0 : 1);
