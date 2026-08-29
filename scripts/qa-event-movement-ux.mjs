// 「움직임과 속도」 레일 그룹 시각 QA + 부피 실측.
//
// 왜 필요한가: 이 그룹의 부피 문제는 "233px 레일에서 컨트롤이 몇 행으로 쌓이는가" 라서
// 코드를 읽어서는 판정할 수 없다. 실제 브라우저에서 섹션 높이·행 수·오버플로를 재고
// 사용자 지정/생활 이동/맵 찍기 세 상태를 캡처한다. 기준선(main)에서도 같은 스크립트가
// 돌아가야 하므로 새 testid 는 optional 로만 본다.
//
//   node scripts/qa-event-movement-ux.mjs --label after
//   QA_BASE_URL=http://127.0.0.1:9828 node scripts/qa-event-movement-ux.mjs --label before
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const label = (() => {
  const index = process.argv.indexOf("--label");
  return index > 0 ? (process.argv[index + 1] ?? "run") : "run";
})();
const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:9828";
const evidenceDir = `.omo/evidence/event-movement-ux/${label}`;
await mkdir(evidenceDir, { recursive: true });

const results = [];
const record = (id, title, detail) => {
  results.push({ id, title, detail });
  console.log(`${id} ${title} :: ${JSON.stringify(detail).slice(0, 500)}`);
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem("oprn:editor-session-id", "movement-ux-probe");
  window.localStorage.setItem("oprn:editor-ui-mode", "expert");
});
const page = await context.newPage();
const pageErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(`console: ${message.text().slice(0, 200)}`);
});
page.on("pageerror", (error) => pageErrors.push(`pageerror: ${String(error).slice(0, 200)}`));

try {
  await page.goto(`${baseUrl}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const editor = await openEventEditor(page);
  await openMovementGroup(page);
  await page.waitForTimeout(600);

  // 기본(정지) 상태.
  await shotSection(page, "01-move-group-default");
  record("M0", "정지 기본", await measureSection(page));

  // 사용자 지정 — 경로 되읽기.
  await selectMovement(page, "custom");
  await page.waitForTimeout(400);
  await seedRoute(page);
  await openMovementGroup(page);
  await page.waitForTimeout(500);
  await shotSection(page, "02-move-group-custom");
  record("M1", "사용자 지정 경로", {
    ...(await measureSection(page)),
    thumb: await exists(page, "event-page-route-thumb"),
    tape: await exists(page, "ecp-move-tape"),
    summaryText: await textOf(page, "event-page-movement-route-summary"),
  });

  // 생활 이동 — 같은 맵 목적지(맵 연결이 무의미한 경우).
  await selectMovement(page, "living");
  await page.waitForTimeout(700);
  await shotSection(page, "03-move-group-living-same-map");
  record("M2", "생활 이동 · 같은 맵", {
    ...(await measureSection(page)),
    linkPanelVisible: await visible(page, "event-page-map-link-panel"),
    linkStatus: await textOf(page, "event-page-map-link-status"),
    pickButton: await exists(page, "event-page-living-pick"),
  });

  // 맵에서 찍기 다이얼로그.
  const pick = page.getByTestId("event-page-living-pick");
  if (await pick.count()) {
    await pick.first().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${evidenceDir}/04-map-point-dialog.png` });
    const dialog = page.getByTestId("event-living-point-dialog");
    record("M3", "맵 찍기 다이얼로그", {
      open: await dialog.isVisible().catch(() => false),
      status: await textOf(page, "event-living-point-status"),
    });
    // 캔버스 한 칸 클릭 → 좌표가 실제로 바뀌는지.
    const canvas = page.getByTestId("event-living-point-canvas");
    if (await canvas.count()) {
      const box = await canvas.first().boundingBox();
      if (box) {
        await canvas.first().click({ position: { x: Math.min(box.width - 4, 90), y: Math.min(box.height - 4, 70) } });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${evidenceDir}/05-map-point-picked.png` });
        record("M4", "칸 클릭 반영", { status: await textOf(page, "event-living-point-status") });
        const ok = page.getByTestId("event-living-point-ok");
        if (await ok.count()) await ok.first().click();
        await page.waitForTimeout(700);
        await openMovementGroup(page);
        await page.waitForTimeout(400);
        await shotSection(page, "06-move-group-after-pick");
        record("M5", "찍은 좌표 반영", {
          x: await valueOf(page, "event-page-living-target-x"),
          y: await valueOf(page, "event-page-living-target-y"),
          linkStatus: await textOf(page, "event-page-map-link-status"),
          ...(await measureSection(page)),
        });
      }
    }
  } else {
    record("M3", "맵 찍기 다이얼로그", { skipped: "event-page-living-pick 없음(기준선)" });
  }

  // 다른 맵 목적지 — 맵 연결 상태 줄이 여기서만 떠야 한다.
  const otherMap = await pickOtherMap(page);
  if (otherMap) {
    await page.waitForTimeout(800);
    await openMovementGroup(page);
    await page.waitForTimeout(500);
    await shotSection(page, "08-move-group-living-other-map");
    record("M6", "생활 이동 · 다른 맵", {
      otherMap,
      ...(await measureSection(page)),
      linkStatus: await textOf(page, "event-page-map-link-status"),
      formVisible: await visible(page, "event-page-map-link-panel"),
      toggleText: await textOf(page, "event-page-map-link-toggle"),
    });
    const add = page.getByTestId("event-page-map-link-add");
    if (await add.count()) {
      await add.first().click();
      await page.waitForTimeout(900);
      await openMovementGroup(page);
      await page.waitForTimeout(500);
      await shotSection(page, "09-move-group-link-created");
      record("M7", "연결 생성 후", {
        linkStatus: await textOf(page, "event-page-map-link-status"),
        formVisible: await visible(page, "event-page-map-link-panel"),
        toggleText: await textOf(page, "event-page-map-link-toggle"),
        ...(await measureSection(page)),
      });
    }
  } else {
    record("M6", "생활 이동 · 다른 맵", { skipped: "프로젝트에 맵이 하나뿐" });
  }

  record("ERR", "콘솔 오류", { count: pageErrors.length, sample: pageErrors.slice(0, 5) });
  await editor.screenshot({ path: `${evidenceDir}/07-editor-full.png` }).catch(() => {});
} finally {
  await writeFile(`${evidenceDir}/results.json`, JSON.stringify({ label, baseUrl, results }, null, 2));
  await browser.close();
}

async function shotSection(page, name) {
  const section = page.locator("[data-testid='event-editor-settings-accordion']");
  if (await section.count()) {
    await section.first().screenshot({ path: `${evidenceDir}/${name}.png` }).catch(() => {});
  }
  await page.screenshot({ path: `${evidenceDir}/${name}-full.png` });
}

async function measureSection(page) {
  return page.evaluate(() => {
    const group = document.querySelector("[data-rail-group='move']") ?? document.querySelector("[data-testid='event-classic-movement-section']");
    const body = group?.querySelector(".event-editor-settings-accordion-body") ?? group;
    if (!body) return { missing: true };
    const rect = body.getBoundingClientRect();
    const controls = [...body.querySelectorAll("select, input, button")].filter((node) => node.getClientRects().length > 0);
    const rows = new Set(controls.map((node) => Math.round(node.getBoundingClientRect().top)));
    const overflowX = body.scrollWidth - body.clientWidth;
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      visibleControls: controls.length,
      controlRows: rows.size,
      overflowX,
    };
  });
}

async function openMovementGroup(page) {
  const summary = page.locator("[data-rail-group='move'] .event-editor-settings-accordion-summary, [data-rail-group='move'] button").first();
  if (await summary.count()) {
    await summary.click().catch(() => {});
    return;
  }
  const legacy = page.locator("[data-testid='event-classic-movement-section'] summary").first();
  if (await legacy.count()) await legacy.click().catch(() => {});
}

async function selectMovement(page, value) {
  const select = page.getByTestId("event-page-movement-type").first();
  await select.selectOption(value);
}

// 궤적/테이프를 보려면 경로에 실제 이동 명령이 있어야 한다. 저작자와 같은 경로로 심는다:
// 「사용자 지정 이동 경로 설정」 → 명령 버튼 몇 개 → 확인.
async function seedRoute(page) {
  const open = page.getByTestId("event-page-custom-route");
  if (!(await open.count())) return;
  await open.first().click();
  const dialog = page.getByTestId("event-page-move-route-dialog");
  if (!(await dialog.isVisible().catch(() => false))) return;
  const wanted = ["move-up", "move-up", "move-right", "move-lower-right", "move-down", "move-left"];
  for (const testId of wanted) {
    const button = dialog.locator(`[data-testid='event-page-move-route-add-${testId}']`).first();
    if (await button.count()) await button.click();
  }
  await dialog.getByTestId("event-page-move-route-ok").click();
  await page.waitForTimeout(500);
}

// 목적지를 현재 맵이 아닌 다른 맵으로 바꾼다. 값이 곧 현재 맵과 다르면 그걸로 충분하다.
async function pickOtherMap(page) {
  const select = page.getByTestId("event-page-living-target-map").first();
  if (!(await select.count())) return null;
  const options = await select.evaluate((node) => ({
    current: node.value,
    values: [...node.options].map((option) => ({ value: option.value, label: option.textContent })),
  }));
  const other = options.values.find((option) => option.value && option.value !== options.current);
  if (!other) return null;
  await select.selectOption(other.value);
  return other.label;
}

async function exists(page, testId) {
  return (await page.getByTestId(testId).count()) > 0;
}

async function visible(page, testId) {
  const locator = page.getByTestId(testId);
  if (!(await locator.count())) return false;
  return locator.first().isVisible().catch(() => false);
}

async function textOf(page, testId) {
  const locator = page.getByTestId(testId);
  if (!(await locator.count())) return null;
  return (await locator.first().textContent().catch(() => null))?.replace(/\s+/gu, " ").trim() ?? null;
}

async function valueOf(page, testId) {
  const locator = page.getByTestId(testId);
  if (!(await locator.count())) return null;
  return locator.first().inputValue().catch(() => null);
}

async function openEventEditor(page) {
  const canvas = page.getByTestId("edit-canvas").locator("canvas").last();
  const deadline = Date.now() + 240000;
  let booted = false;
  while (Date.now() < deadline) {
    booted = await page.evaluate(() => {
      const host = document.querySelector("[data-testid=edit-canvas]");
      const node = host?.querySelector("canvas");
      const layer = document.querySelector("[data-testid=layer-event]");
      return Boolean(node && node.getBoundingClientRect().width > 200 && layer && layer.getClientRects().length > 0);
    }).catch(() => false);
    if (booted) break;
    await page.waitForTimeout(2000);
  }
  if (!booted) {
    await page.screenshot({ path: `${evidenceDir}/00-boot-failure.png` }).catch(() => {});
    throw new Error("editor shell did not boot");
  }
  await page.getByTestId("layer-event").click();
  const tool = page.locator('[data-testid="tool-event"]:visible').first();
  if (await tool.count()) await tool.click();
  const editor = page.getByTestId("event-editor-modal");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  for (const offset of [0, 32, -32]) {
    await canvas.dblclick({ position: { x: Math.floor(box.width / 2) + offset, y: Math.floor(box.height / 2) + offset } });
    if (await editor.isVisible().catch(() => false)) break;
    const open = page.getByTestId("event-editor-open");
    if (await open.isVisible().catch(() => false)) {
      await open.click();
      if (await editor.isVisible().catch(() => false)) break;
    }
    await page.waitForTimeout(600);
  }
  if (!(await editor.isVisible().catch(() => false))) throw new Error("event editor did not open");
  await page.waitForTimeout(1200);
  return editor;
}
