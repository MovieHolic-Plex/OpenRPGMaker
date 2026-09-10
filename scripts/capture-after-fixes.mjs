/**
 * after 캡처: 수정된 8개 다이얼로그만 before와 같은 조건으로 재촬영.
 * Usage: RPG_ZZU_URL=http://127.0.0.1:9877 AFTER_OUT=output/evidence/all-commands-after node scripts/capture-after-fixes.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9877";
const OUT = path.resolve(process.env.AFTER_OUT ?? "output/evidence/all-commands-after");
fs.mkdirSync(OUT, { recursive: true });

// [파일명, kind, commandId?]
const TARGETS = [
  ["3-m2-066-play-movie", "m2", "m2-066-play-movie"],
  ["3-m2-087-call-event", "m2", "m2-087-call-event"],
  ["2-m2-013-change-level", "m2", "m2-013-change-level"],
  ["1-m2-058-wait-for-all-movement", "m2", "m2-058-wait-for-all-movement"],
  ["1-m2-085-end-event-processing", "m2", "m2-085-end-event-processing"],
  ["deprecated-m2-055-show-animation", "m2", "m2-055-show-animation"],
  ["1-m2-081-label", "m2", "m2-081-label"],
  ["1-m2-082-jump-to-label", "m2", "m2-082-jump-to-label"],
  ["native-callCommonEvent", "native", "callCommonEvent"],
];

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
  for (const [name, mode, id] of TARGETS) {
    try {
      await page.evaluate(() => {
        document.querySelectorAll("[data-testid='event-command-edit-dialog']").forEach((n) => n.remove());
        document.querySelectorAll(".modal-backdrop, .dialog-backdrop, .event-subdialog-backdrop").forEach((n) => n.remove());
      });
      await page.waitForTimeout(150);
      await page.evaluate(async ([m, cid]) => {
        const fac = await import("/src/editor/eventCommandFactory.ts");
        const edit = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
        // 피커와 같은 생성 경로: 별칭행(existingKind)은 네이티브 명령을 만든다.
        const { m2CommandById } = await import("/src/project/eventCommands/m2Catalog.ts");
        let initial;
        if (m === "m2") {
          const existing = m2CommandById(cid)?.existingKind;
          initial = existing ? fac.newCommand(existing) : fac.newM2Command(cid);
        } else {
          initial = fac.newCommand(cid);
        }
        edit.openEventCommandEditDialog({ initial, lockKind: true, onApply: () => {} });
      }, [mode, id]);
      const dialog = page.locator("[data-testid='event-command-edit-dialog']").last();
      await dialog.waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(400);
      await dialog.screenshot({ path: path.join(OUT, `${name}.png`) });
      // 리소스 셀렉트가 있으면 펼쳐서 후보 목록까지 찍는다(before와 같은 조건 비교용).
      const sel = dialog.locator("select").first();
      if (await sel.count()) {
        await sel.click().catch(() => {});
        await page.waitForTimeout(300);
        await dialog.screenshot({ path: path.join(OUT, `${name}-open.png`) });
      }
      console.log("OK", name);
    } catch (err) {
      console.log("FAIL", name, String(err).slice(0, 120));
    }
  }
  await browser.close();
}
main().catch((err) => { console.error(err); process.exit(1); });
