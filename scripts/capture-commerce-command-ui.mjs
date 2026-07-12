import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = path.resolve("output/evidence/commerce-command-ui");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await page.goto("http://localhost:9173/?freshProject=1", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);

await page.screenshot({ path: path.join(OUT, "00-editor.png"), fullPage: false });

const openShop = await page.evaluate(async () => {
  try {
    document.querySelectorAll(".event-subdialog-backdrop").forEach((n) => n.remove());
    const mod = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
    const storeMod = await import("/src/project/store.ts");
    const project = storeMod.store.getCurrent();
    const ids = project.database.items.slice(0, 3).map((item) => item.id);
    mod.openEventCommandEditDialog({
      initial: {
        kind: "shop",
        itemIds: ids,
        shopType: "normal",
        messageType: "welcome",
      },
      lockKind: true,
      onApply: () => {},
    });
    return { ok: true, itemCount: ids.length };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
});
console.log("open shop", openShop);
await page.waitForTimeout(600);
if (openShop.ok) {
  await page.locator('[data-testid="shop-command-body"]').waitFor({ timeout: 8000 });
  await page.screenshot({ path: path.join(OUT, "01-shop-processing.png"), fullPage: false });
  await page.locator("section.event-subdialog-window.wide").last().screenshot({
    path: path.join(OUT, "01b-shop-dialog-only.png"),
  });
}

const openText = await page.evaluate(async () => {
  try {
    document.querySelectorAll(".event-subdialog-backdrop").forEach((n) => n.remove());
    const mod = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
    mod.openEventCommandEditDialog({
      initial: {
        kind: "text",
        speaker: "상인",
        body: "어서 오세요.\n필요한 물건을 골라 주세요.",
      },
      lockKind: true,
      onApply: () => {},
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
});
console.log("open text", openText);
await page.waitForTimeout(600);
if (openText.ok) {
  await page.screenshot({ path: path.join(OUT, "02-text-command.png"), fullPage: false });
  await page.locator("section.event-subdialog-window.wide").last().screenshot({
    path: path.join(OUT, "02b-text-dialog-only.png"),
  });
}

const openStandalone = await page.evaluate(async () => {
  try {
    document.querySelectorAll(".event-subdialog-backdrop").forEach((n) => n.remove());
    const mod = await import("/src/editor/panels/eventEditor/textCommandDialog.ts");
    mod.openTextCommandDialog(
      { kind: "text", speaker: "촌장", body: "마을에 온 걸 환영하네." },
      () => {}
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
});
console.log("standalone text", openStandalone);
await page.waitForTimeout(500);
if (openStandalone.ok) {
  await page.screenshot({ path: path.join(OUT, "03-text-standalone.png"), fullPage: false });
  await page.locator("section.event-subdialog-window.wide").last().screenshot({
    path: path.join(OUT, "03b-text-standalone-only.png"),
  });
}

await browser.close();
console.log("wrote evidence to", OUT);
