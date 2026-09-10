/**
 * 보충 캡처 2: 그리드 미노출 네이티브 22종(newCommand) + 은퇴 M2 2행(newM2Command).
 * Usage: RPG_ZZU_URL=http://127.0.0.1:9877 node scripts/capture-all-commands-supplement2.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9877";
const OUT = path.resolve("output/evidence/all-commands-sweep");

const NATIVES = [
  "advanceTime", "advanceCropGrowth", "setTime", "sleepUntilMorning",
  "callMapEvent", "cutsceneControl", "setSelfSwitch",
  "giveMonster", "moveMonster", "evolveMonster",
  "addFollower", "removeFollower", "promoteActor",
  "changeFriendship", "setRelationship", "changeFactionStance", "getFriendship",
  "setEventGraphicPattern", "checkpointSave", "killPlayer", "triggerEnding", "setFlag",
];
const DEPRECATED_M2 = ["m2-055-show-animation", "m2-209-advanced-dialogue"];

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

  const results = [];
  for (const kind of NATIVES) {
    const safeId = `native-${kind}`;
    try {
      await closeAllDialogs(page);
      const r = await page.evaluate(async (k) => {
        try {
          const fac = await import("/src/editor/eventCommandFactory.ts");
          const edit = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
          edit.openEventCommandEditDialog({ initial: fac.newCommand(k), lockKind: true, onApply: () => {} });
          return { ok: true };
        } catch (err) { return { ok: false, reason: String(err).slice(0, 150) }; }
      }, kind);
      if (!r.ok) { results.push({ id: kind, ok: false, error: r.reason }); console.log("FAIL", kind, r.reason); continue; }
      const dialog = page.locator("[data-testid='event-command-edit-dialog']").last();
      await dialog.waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(400);
      await dialog.screenshot({ path: path.join(OUT, `${safeId}.png`) });
      const bodyText = ((await dialog.innerText().catch(() => "")) || "").replace(/\s+/g, " ").slice(0, 300);
      results.push({ id: kind, ok: true, bodyText });
      console.log("OK", kind);
    } catch (err) {
      results.push({ id: kind, ok: false, error: String(err).slice(0, 200) });
      console.log("FAIL", kind, String(err).slice(0, 120));
    }
  }
  for (const cid of DEPRECATED_M2) {
    const safeId = `deprecated-${cid}`;
    try {
      await closeAllDialogs(page);
      const r = await page.evaluate(async (c) => {
        try {
          const fac = await import("/src/editor/eventCommandFactory.ts");
          const edit = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
          edit.openEventCommandEditDialog({ initial: fac.newM2Command(c), lockKind: true, onApply: () => {} });
          return { ok: true };
        } catch (err) { return { ok: false, reason: String(err).slice(0, 150) }; }
      }, cid);
      if (!r.ok) { results.push({ id: cid, ok: false, error: r.reason }); console.log("FAIL", cid, r.reason); continue; }
      const dialog = page.locator("[data-testid='event-command-edit-dialog']").last();
      await dialog.waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(400);
      await dialog.screenshot({ path: path.join(OUT, `${safeId}.png`) });
      const bodyText = ((await dialog.innerText().catch(() => "")) || "").replace(/\s+/g, " ").slice(0, 300);
      results.push({ id: cid, ok: true, bodyText });
      console.log("OK", cid);
    } catch (err) {
      results.push({ id: cid, ok: false, error: String(err).slice(0, 200) });
      console.log("FAIL", cid, String(err).slice(0, 120));
    }
  }
  fs.writeFileSync(path.join(OUT, "supplement2-results.json"), JSON.stringify(results, null, 2));
  console.log(`ok=${results.filter((r) => r.ok).length}/${results.length}`);
  await browser.close();
}
main().catch((err) => { console.error(err); process.exit(1); });
