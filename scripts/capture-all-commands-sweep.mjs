/**
 * 전수 캡처: 이벤트 명령어 피커 탭 1~4 + 모든 명령어의 편집 다이얼로그.
 * playwright 실브라우저로 직접 눌러서 찍는다.
 * Usage: RPG_ZZU_URL=http://127.0.0.1:9877 node scripts/capture-all-commands-sweep.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9877";
const OUT = path.resolve("output/evidence/all-commands-sweep");
fs.mkdirSync(OUT, { recursive: true });

async function dismissOverlays(page) {
  for (const t of ["건너뛰기", "닫기", "✕", "나중에"]) {
    const btn = page.getByRole("button", { name: t }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
  for (const testid of ["editor-welcome-skip", "editor-welcome-close", "modal-close"]) {
    const el = page.getByTestId(testid);
    if (await el.isVisible().catch(() => false)) await el.click().catch(() => {});
  }
}

async function closeAllDialogs(page) {
  await page.evaluate(() => {
    document.querySelectorAll("[data-testid='event-command-edit-dialog']").forEach((n) => n.remove());
    document.querySelectorAll("[data-testid='event-command-picker']").forEach((n) => n.remove());
    document.querySelectorAll(".modal-backdrop, .dialog-backdrop, .event-subdialog-backdrop").forEach((n) => n.remove());
  });
  await page.waitForTimeout(150);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 920 } });
  page.setDefaultTimeout(30_000);

  await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("[data-testid='edit-canvas']", { timeout: 45_000 });
  await page.waitForTimeout(2000);
  await dismissOverlays(page);

  // 피커 항목 목록을 브라우저 안에서 직접 뽑는다 (원본 그대로)
  const entries = await page.evaluate(async () => {
    const picker = await import("/src/editor/panels/eventEditor/commandPicker.ts");
    const all = [];
    for (const tab of [1, 2, 3, 4]) {
      for (const e of picker.eventCommandPickerTabEntries(tab)) {
        all.push({ tab, commandId: e.commandId, label: e.label, group: e.group, testId: e.testId, selectable: e.selectable });
      }
    }
    return all;
  });
  console.log("picker entries total:", entries.length);
  fs.writeFileSync(path.join(OUT, "picker-entries.json"), JSON.stringify(entries, null, 2));

  // --- 1단계: 실제 피커를 열어 각 탭 화면을 직접 찍는다 ---
  for (const tab of [1, 2, 3, 4]) {
    await closeAllDialogs(page);
    await page.evaluate(() => {
      localStorage.removeItem("oprn:eventCommandPicker.viewMode");
    });
    await page.evaluate(async () => {
      const mod = await import("/src/editor/panels/eventEditor/commandPicker.ts");
      mod.openEventCommandPicker({ title: "명령 추가", context: "map", onSelect: () => {} });
    });
    await page.waitForSelector("[data-testid='event-command-picker']", { timeout: 10_000 });
    await page.getByTestId(`event-command-picker-tab-${tab}`).click();
    await page.waitForTimeout(500);
    const pickerEl = page.getByTestId("event-command-picker");
    await pickerEl.screenshot({ path: path.join(OUT, `tab${tab}-picker.png`) });
    // 그룹 헤딩별 스크롤 캡처: 항목이 화면 밖으로 넘치면 스크롤하면서 추가 컷
    const btnCount = await page.locator("#event-command-picker-panel button[data-testid^='command-picker-add-']").count().catch(() => 0);
    console.log(`tab${tab}: ${btnCount} buttons`);
    await closeAllDialogs(page);
  }

  // --- 2단계: 각 항목을 피커에서 직접 눌러 편집 다이얼로그를 연다 ---
  const results = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const safeId = `${e.tab}-${e.commandId}`.replace(/[^a-zA-Z0-9가-힣_-]+/g, "-");
    try {
      await closeAllDialogs(page);
      await page.evaluate(async () => {
        const mod = await import("/src/editor/panels/eventEditor/commandPicker.ts");
        mod.openEventCommandPicker({
          title: "명령 추가",
          context: "map",
          onSelect: async (command) => {
            const edit = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
            edit.openEventCommandEditDialog({ initial: command, lockKind: true, onApply: () => {} });
          },
        });
      });
      await page.waitForSelector("[data-testid='event-command-picker']", { timeout: 10_000 });
      await page.getByTestId(`event-command-picker-tab-${e.tab}`).click();
      await page.waitForTimeout(300);
      const btn = page.getByTestId(e.testId);
      if (!(await btn.count())) {
        results.push({ ...e, ok: false, error: "button not found" });
        console.log(`SKIP ${i + 1}/${entries.length} ${e.commandId} (no button)`);
        continue;
      }
      await btn.first().scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(200);
      await btn.first().click();
      await page.waitForTimeout(500);
      const dialog = page.locator("[data-testid='event-command-edit-dialog']").last();
      if (!(await dialog.count())) {
        results.push({ ...e, ok: false, error: "edit dialog did not open" });
        console.log(`FAIL ${i + 1}/${entries.length} ${e.commandId} (no dialog)`);
        continue;
      }
      await page.waitForTimeout(300);
      await dialog.screenshot({ path: path.join(OUT, `${safeId}.png`) });
      const bodyText = ((await dialog.innerText().catch(() => "")) || "").replace(/\s+/g, " ").slice(0, 300);
      results.push({ ...e, ok: true, bodyText });
      console.log(`OK ${i + 1}/${entries.length} ${e.commandId} ${e.label}`);
    } catch (err) {
      results.push({ ...e, ok: false, error: String(err).slice(0, 200) });
      console.log(`FAIL ${i + 1}/${entries.length} ${e.commandId} ${String(err).slice(0, 120)}`);
    }
  }

  fs.writeFileSync(path.join(OUT, "dialog-results.json"), JSON.stringify(results, null, 2));
  const ok = results.filter((r) => r.ok).length;
  console.log(`wrote ${OUT} ok=${ok}/${results.length}`);
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
