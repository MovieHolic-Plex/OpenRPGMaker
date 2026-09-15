/**
 * OPRN-OUT-013 — 「좌표로 이동」 저작 폼의 브라우저 증거.
 *
 * 실제 편집기 셸에서 명령 편집 다이얼로그를 열고, 스크린샷 뿐 아니라 **커밋된 명령 필드**를
 * 함께 기록한다. 그림만으로는 「눌렀는데 저장은 안 됐다」를 구별할 수 없다.
 *
 * Usage: OPRN_URL=http://127.0.0.1:9851 node scripts/capture-coordinate-move-form.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env.OPRN_URL ?? "http://127.0.0.1:9851";
const OUT = path.resolve("verify-shots/oprn-013");
fs.mkdirSync(OUT, { recursive: true });

const PATHFIND_ID = "m2-205-pathfind-move";

async function dismissOverlays(page) {
  for (const name of ["건너뛰기", "닫기", "✕", "나중에"]) {
    const btn = page.getByRole("button", { name }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
  for (const testid of ["editor-welcome-skip", "editor-welcome-close", "modal-close"]) {
    const el = page.getByTestId(testid);
    if (await el.isVisible().catch(() => false)) await el.click().catch(() => {});
  }
}

async function closeEditDialog(page) {
  const dialog = page.locator("[data-testid='event-command-edit-dialog']").last();
  if (!(await dialog.count())) return;
  const cancel = dialog.getByTestId("event-command-edit-cancel");
  if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {});
  else await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    document.querySelectorAll("[data-testid='event-command-edit-dialog']").forEach((n) => n.remove());
    document.querySelectorAll(".modal-backdrop, .dialog-backdrop").forEach((n) => n.remove());
  });
}

/** 다이얼로그를 열고, 커밋된 명령을 페이지에 노출시킨다. */
async function openDialog(page, fields) {
  await page.evaluate(async ({ commandId, fields }) => {
    const mod = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
    window.__oprn013 = { committed: null };
    mod.openEventCommandEditDialog({
      initial: { kind: "m2Command", commandId, fields },
      lockKind: true,
      onApply: (command) => { window.__oprn013.committed = command; },
    });
  }, { commandId: PATHFIND_ID, fields });
  const dialog = page.locator("[data-testid='event-command-edit-dialog']").last();
  await dialog.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForSelector("[data-testid='coordinate-move-command-body']", { timeout: 10_000 });
  await page.waitForTimeout(250);
  return dialog;
}

async function shot(dialog, page, id) {
  await dialog.screenshot({ path: path.join(OUT, `${id}.png`) });
  await page.screenshot({ path: path.join(OUT, `${id}-full.png`) });
}

/**
 * 세그먼트 선택은 **버튼**이 소유한다 — 네이티브 select 는 selectOption 호환을 위해
 * 숨겨져 있다. 사용자가 실제로 누르는 길로 진짜 증거를 남긴다.
 */
async function pressSegment(page, testid, key) {
  await page.click(`[data-testid='${testid}-segment-${key}']`);
  await page.waitForTimeout(150);
}

/** 레코드 픽커의 숨은 select 는 값 설정 + change 로 같은 폼 로직을 태운다. */
async function pickRecord(page, testid, id) {
  await page.evaluate(({ testid, id }) => {
    const select = document.querySelector(`[data-testid='${testid}'] select`);
    select.value = id;
    select.dispatchEvent(new Event("change"));
  }, { testid, id });
  await page.waitForTimeout(150);
}

/** 폼이 지금 들고 있는 명령 필드. 「그림은 바뀌었는데 저장은 안 됐다」를 배제한다. */
async function committedFields(page) {
  const dialog = page.locator("[data-testid='event-command-edit-dialog']").last();
  const apply = dialog.getByTestId("event-command-edit-ok");
  if (!(await apply.isVisible().catch(() => false))) throw new Error("확인 버튼이 없다 — 상태 보증이 안 된다");
  await apply.click();
  await page.waitForTimeout(200);
  const fields = await page.evaluate(() => window.__oprn013?.committed?.fields ?? null);
  if (!fields) throw new Error("확인을 누름도 명령이 커밋되지 않았다");
  return fields;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 980 } });
  page.setDefaultTimeout(30_000);
  const results = [];

  await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector("[data-testid='edit-canvas']", { timeout: 60_000 });
  await page.waitForTimeout(2000);
  await dismissOverlays(page);

  // 이 맵에 대상으로 고를 이벤트와, 좌표로 쓸 변수를 실제 프로젝트에 만든다.
  const ids = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    store.update((project) => {
      const map = project.maps[project.startMapId];
      if (!map.events.some((event) => event.id === "ev_oprn013_guard")) {
        map.events.push({
          id: "ev_oprn013_guard", name: "문지기", x: 4, y: 6,
          trigger: { kind: "action" }, commands: [],
        });
      }
      for (const [id, name] of [["var_oprn013_x", "목표 X"], ["var_oprn013_y", "목표 Y"], ["var_oprn013_result", "이동 결과"]]) {
        if (!project.variables.some((entry) => entry.id === id)) project.variables.push({ id, name });
      }
      if (!project.switches.some((entry) => entry.id === "sw_oprn013_arrived")) {
        project.switches.push({ id: "sw_oprn013_arrived", name: "도착함" });
      }
    }, { scope: "event", label: "OPRN-013 증거 준비" });
    const project = store.getCurrent();
    return {
      mapId: project.startMapId,
      eventId: "ev_oprn013_guard",
      variableCount: project.variables.length,
    };
  });
  console.log("prepared", ids);

  // 1) 옛 고정 좌표 명령을 그대로 연다 — 숫자 칸이 값을 들고 있어야 한다.
  {
    const dialog = await openDialog(page, { target: "this-event", x: 6, y: 4, speed: 4, wait: true });
    await shot(dialog, page, "01-legacy-fixed-coordinates");
    // `hidden` 속상만 재면 안 된다 — `display: grid` 가 UA `display: none` 을 이기면
    // 생감해도 아무 일도 안 일어나는 죽은 입력이 남는다. 계산된 스타일을 재다.
    const state = await page.evaluate(() => {
      const shown = (testid) => {
        const node = document.querySelector(`[data-testid='${testid}']`);
        return node ? getComputedStyle(node).display !== "none" : null;
      };
      return {
        xSource: document.querySelector("[data-testid='coordinate-move-x-source']")?.value,
        x: document.querySelector("[data-testid='coordinate-move-x-input']")?.value,
        y: document.querySelector("[data-testid='coordinate-move-y-input']")?.value,
        numberFieldShown: shown("coordinate-move-x-number-field"),
        variableFieldShown: shown("coordinate-move-x-variable-field"),
        eventFieldShown: shown("coordinate-move-event-field"),
        preview: document.querySelector("[data-testid='coordinate-move-preview']")?.innerText?.replace(/\s+/g, " "),
      };
    });
    if (state.variableFieldShown !== false || state.eventFieldShown !== false) {
      throw new Error(`죽은 입력이 보인다: ${JSON.stringify(state)}`);
    }
    results.push({ id: "01-legacy-fixed-coordinates", state });
    console.log("01", state);
    await closeEditDialog(page);
  }

  // 2) X 를 변수로 바꾸고 표준 변수 픽커로 고른다.
  {
    const dialog = await openDialog(page, { target: "player", x: 6, y: 4, speed: 4, wait: true });
    await pressSegment(page, "coordinate-move-x-source", "variable");
    await shot(dialog, page, "02-x-source-variable");
    // 표준 레코드 픽커 패널을 실제로 열어 그림으로 남긴다.
    await page.click("[data-testid='coordinate-move-x-variable'] .event-record-picker-trigger");
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "03-standard-variable-picker.png") });
    const picked = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("[data-testid='record-picker-panel'] button, .record-picker-row")];
      return rows.length;
    });
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(200);
    // 픽커 패널 자체의 행 testid 는 패널 구현 소관이므로, 저장은 정본 select 로 확정한다.
    await pickRecord(page, "coordinate-move-x-variable", "var_oprn013_x");
    await shot(dialog, page, "04-x-variable-selected");
    const state = await page.evaluate(() => {
      const shown = (testid) => {
        const node = document.querySelector(`[data-testid='${testid}']`);
        return node ? getComputedStyle(node).display !== "none" : null;
      };
      return {
        numberFieldShown: shown("coordinate-move-x-number-field"),
        variableFieldShown: shown("coordinate-move-x-variable-field"),
        preview: document.querySelector("[data-testid='coordinate-move-preview']")?.innerText?.replace(/\s+/g, " "),
      };
    });
    if (state.numberFieldShown !== false || state.variableFieldShown !== true) {
      throw new Error(`변수 전환 후 칸 가시성이 틀렸다: ${JSON.stringify(state)}`);
    }
    const fields = await committedFields(page);
    results.push({ id: "04-x-variable-selected", pickerRows: picked, state, fields });
    console.log("04", state, fields);
    await closeEditDialog(page);
  }

  // 3) 대상 「특정 이벤트」 + 이동 경로 설정과 같은 이벤트 픽커.
  {
    const dialog = await openDialog(page, { target: "this-event", x: 3, y: 3, speed: 4, wait: true });
    await pressSegment(page, "coordinate-move-target", "event");
    await page.click("[data-testid='move-route-event-picker-open']");
    await page.waitForTimeout(300);
    await shot(dialog, page, "05-target-event-picker");
    const option = page.locator(`[data-testid='move-route-event-option-${ids.eventId}']`);
    const optionVisible = await option.isVisible().catch(() => false);
    if (optionVisible) await option.click();
    await page.waitForTimeout(200);
    await shot(dialog, page, "06-target-event-selected");
    const fields = await committedFields(page);
    results.push({ id: "06-target-event-selected", optionVisible, fields });
    console.log("06", optionVisible, fields);
    await closeEditDialog(page);
  }

  // 4) 실패 정책 · 대체 목적지 · 결과 기록처.
  {
    const dialog = await openDialog(page, {
      target: "player", xSource: "variable", xVariableId: "var_oprn013_x",
      ySource: "variable", yVariableId: "var_oprn013_y", speed: 4, wait: true,
    });
    await pressSegment(page, "coordinate-move-failure", "stop");
    await pressSegment(page, "coordinate-move-fallback", "nearest");
    await pickRecord(page, "coordinate-move-result-variable", "var_oprn013_result");
    await pickRecord(page, "coordinate-move-result-switch", "sw_oprn013_arrived");
    await page.waitForTimeout(250);
    await shot(dialog, page, "07-failure-policy-and-result");
    const preview = await page.evaluate(() =>
      document.querySelector("[data-testid='coordinate-move-preview']")?.innerText?.replace(/\s+/g, " "));
    const fields = await committedFields(page);
    results.push({ id: "07-failure-policy-and-result", preview, fields });
    console.log("07", preview, fields);
    await closeEditDialog(page);
  }

  // 5) 「변수」를 골랐지만 정하지 않은 상태의 저작 경고.
  {
    const dialog = await openDialog(page, {
      target: "player", xSource: "variable", xVariableId: "", y: 4, speed: 4, wait: true,
    });
    await shot(dialog, page, "08-unselected-variable-warning");
    const warning = await page.evaluate(() =>
      document.querySelector("[data-testid='coordinate-move-preview-warning']")?.innerText ?? null);
    results.push({ id: "08-unselected-variable-warning", warning });
    console.log("08", warning);
    await closeEditDialog(page);
  }

  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({ base: BASE, ids, results }, null, 2));
  console.log("wrote", OUT);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
