/**
 * 보충 캡처: 전투 전용 11행(m2-098~108, context=troop) + 검색 전용/정보 행.
 * Usage: RPG_ZZU_URL=http://127.0.0.1:9877 node scripts/capture-all-commands-supplement.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9877";
const OUT = path.resolve("output/evidence/all-commands-sweep");
fs.mkdirSync(OUT, { recursive: true });

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
  for (const testid of ["editor-welcome-skip", "editor-welcome-close", "modal-close"]) {
    const el = page.getByTestId(testid);
    if (await el.isVisible().catch(() => false)) await el.click().catch(() => {});
  }

  // 1) 검색 전체 목록 (탭 그리드에 없는 정보행 포함)
  const searchEntries = await page.evaluate(async () => {
    const picker = await import("/src/editor/panels/eventEditor/commandPicker.ts");
    return picker.eventCommandPickerSearchEntries().map((e) => ({
      commandId: e.commandId, label: e.label, group: e.group, page: e.page,
      selectable: e.selectable, testId: e.testId, alternateRoute: e.alternateRoute,
    }));
  });
  const gridIds = new Set(JSON.parse(fs.readFileSync(path.join(OUT, "picker-entries.json"), "utf8")).map((e) => e.commandId));
  const searchOnly = searchEntries.filter((e) => !gridIds.has(e.commandId));
  console.log("search total:", searchEntries.length, "search-only:", searchOnly.length);
  fs.writeFileSync(path.join(OUT, "search-entries.json"), JSON.stringify(searchEntries, null, 2));
  fs.writeFileSync(path.join(OUT, "search-only-entries.json"), JSON.stringify(searchOnly, null, 2));

  // 2) 전투 컨텍스트 탭2 그리드 (m2-098~108)
  const troopEntries = await page.evaluate(async () => {
    const picker = await import("/src/editor/panels/eventEditor/commandPicker.ts");
    return picker.eventCommandPickerTabEntries(2).map((e) => ({
      commandId: e.commandId, label: e.label, group: e.group, testId: e.testId, selectable: e.selectable,
    }));
  });
  console.log("map-context tab2:", troopEntries.length);

  // 전투 피커를 직접 열어 탭2 찍기 (context=troop)
  await closeAllDialogs(page);
  await page.evaluate(async () => {
    const mod = await import("/src/editor/panels/eventEditor/commandPicker.ts");
    mod.openEventCommandPicker({ title: "명령 추가", context: "troop", onSelect: () => {} });
  });
  await page.waitForSelector("[data-testid='event-command-picker']", { timeout: 10_000 });
  await page.getByTestId("event-command-picker-tab-2").click();
  await page.waitForTimeout(500);
  await page.getByTestId("event-command-picker").screenshot({ path: path.join(OUT, "tab2-picker-troop.png") });

  // 3) m2-098~108 다이얼로그를 newM2Command로 직접 열기
  const battleIds = searchEntries.filter((e) => /^m2-0(98|99|10[0-8])[-]/.test(e.commandId));
  console.log("battle-only rows:", battleIds.map((e) => e.commandId).join(","));
  const results = [];
  for (const e of battleIds) {
    const safeId = `2-${e.commandId}`.replace(/[^a-zA-Z0-9가-힣_-]+/g, "-");
    try {
      await closeAllDialogs(page);
      await page.evaluate(async (commandId) => {
        const fac = await import("/src/editor/eventCommandFactory.ts");
        const edit = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
        edit.openEventCommandEditDialog({ initial: fac.newM2Command(commandId), lockKind: true, onApply: () => {} });
      }, e.commandId);
      const dialog = page.locator("[data-testid='event-command-edit-dialog']").last();
      await dialog.waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(400);
      await dialog.screenshot({ path: path.join(OUT, `${safeId}.png`) });
      const bodyText = ((await dialog.innerText().catch(() => "")) || "").replace(/\s+/g, " ").slice(0, 300);
      results.push({ ...e, ok: true, bodyText });
      console.log("OK", e.commandId, e.label);
    } catch (err) {
      results.push({ ...e, ok: false, error: String(err).slice(0, 200) });
      console.log("FAIL", e.commandId, String(err).slice(0, 120));
    }
  }

  // 4) 검색 전용(정보행) 다이얼로그 시도 — 열리는 것만 캡처
  const supResults = [];
  for (const e of searchOnly) {
    const safeId = `searchonly-${e.commandId}`.replace(/[^a-zA-Z0-9가-힣_-]+/g, "-");
    try {
      await closeAllDialogs(page);
      const opened = await page.evaluate(async (entry) => {
        try {
          const fac = await import("/src/editor/eventCommandFactory.ts");
          const edit = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
          const m2 = await import("/src/project/eventCommands/m2Catalog.ts");
          const cat = m2.m2CommandById(entry.commandId);
          if (!cat) return { ok: false, reason: "no catalog entry" };
          const initial = cat.existingKind ? fac.newCommand(cat.existingKind) : fac.newM2Command(entry.commandId);
          edit.openEventCommandEditDialog({ initial, lockKind: true, onApply: () => {} });
          return { ok: true };
        } catch (err) { return { ok: false, reason: String(err).slice(0, 150) }; }
      }, e);
      if (!opened.ok) { supResults.push({ ...e, ok: false, error: opened.reason }); continue; }
      const dialog = page.locator("[data-testid='event-command-edit-dialog']").last();
      await dialog.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
      if (!(await dialog.count())) { supResults.push({ ...e, ok: false, error: "no dialog" }); continue; }
      await page.waitForTimeout(300);
      await dialog.screenshot({ path: path.join(OUT, `${safeId}.png`) });
      const bodyText = ((await dialog.innerText().catch(() => "")) || "").replace(/\s+/g, " ").slice(0, 300);
      supResults.push({ ...e, ok: true, bodyText });
      console.log("OK(searchonly)", e.commandId, e.label);
    } catch (err) {
      supResults.push({ ...e, ok: false, error: String(err).slice(0, 200) });
      console.log("FAIL(searchonly)", e.commandId, String(err).slice(0, 120));
    }
  }

  fs.writeFileSync(path.join(OUT, "supplement-results.json"), JSON.stringify({ battleIds: results, searchOnly: supResults }, null, 2));
  console.log(`battle ok=${results.filter((r) => r.ok).length}/${results.length} searchonly ok=${supResults.filter((r) => r.ok).length}/${supResults.length}`);
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
