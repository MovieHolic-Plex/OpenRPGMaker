/**
 * Capture battleProcessing command form + preview for visual QA.
 * Usage: node scripts/capture-battle-processing-form.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env.OPRN_URL ?? "http://127.0.0.1:9999";
const OUT = path.resolve("output/evidence/battle-processing-form");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
page.setDefaultTimeout(30_000);

await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.waitForTimeout(2500);

// dismiss welcome / confirm overlays if present
for (const testId of ["editor-welcome-skip", "app-modal-confirm", "editor-welcome-confirm"]) {
  const el = page.getByTestId(testId);
  if (await el.isVisible().catch(() => false)) {
    await el.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

const ids = await page.evaluate(() => {
  const store = window.__oprnStore ?? null;
  return null;
});

const openEmpty = await page.evaluate(async () => {
  try {
    document.querySelectorAll(".event-subdialog-backdrop").forEach((n) => n.remove());
    const mod = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
    mod.openEventCommandEditDialog({
      initial: { kind: "battleProcessing", troopId: "", canEscape: true, canLose: false },
      lockKind: true,
      onApply: () => {},
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error?.stack ?? error) };
  }
});
console.log("open empty", openEmpty);
if (!openEmpty.ok) {
  await page.screenshot({ path: path.join(OUT, "00-open-failed.png"), fullPage: true });
  await browser.close();
  process.exit(1);
}

await page.getByTestId("event-command-battle-processing-form").waitFor({ timeout: 12_000 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, "01-battle-processing-empty.png"), fullPage: false });
await page.locator("section.event-subdialog-window.wide, .event-command-edit-dialog, [data-testid='event-command-edit-form']").last().screenshot({
  path: path.join(OUT, "01b-battle-processing-empty-dialog.png"),
}).catch(async () => {
  await page.locator('[data-testid="event-command-battle-processing-form"]').screenshot({
    path: path.join(OUT, "01b-battle-processing-empty-dialog.png"),
  });
});

// fill troop + boss preset
const filled = await page.evaluate(async () => {
  const storeMod = await import("/src/project/store.ts");
  const troopId = storeMod.store.getCurrent().database.troops[0]?.id ?? "";
  const select = document.querySelector('[data-testid="battle-processing-troop-select"]');
  if (select && troopId) {
    select.value = troopId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  document.querySelector('[data-testid="battle-processing-preset-boss"]')?.click();
  document.querySelector('[data-testid="battle-processing-branch-on-result"]')?.click();
  return { troopId, name: storeMod.store.getCurrent().database.troops[0]?.name ?? "" };
});
console.log("filled", filled);
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, "02-battle-processing-filled.png"), fullPage: false });
await page.locator('[data-testid="event-command-battle-processing-form"]').screenshot({
  path: path.join(OUT, "02b-form-only.png"),
});
const preview = page.locator('[data-testid="event-command-preview-body"], .event-command-preview').first();
if (await preview.count()) {
  await preview.screenshot({ path: path.join(OUT, "02c-preview-only.png") });
}

// also capture delete-restore toast path briefly
await page.evaluate(() => {
  document.querySelectorAll(".event-subdialog-backdrop, [data-testid='event-command-edit-form']").forEach((n) => {
    const root = n.closest(".event-subdialog-backdrop") ?? n;
    root.remove?.();
  });
});
await page.waitForTimeout(200);

const deleteShot = await page.evaluate(async () => {
  try {
    const { createBlankProject } = await import("/src/project/defaults.ts");
    const { store } = await import("/src/project/store.ts");
    const { deleteEditorEvent } = await import("/src/editor/eventDeletion.ts");
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    map.events = [
      {
        id: "ev_shot_delete",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "p1",
            name: "삭제 대상",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [{ kind: "text", body: "hi" }],
          },
        ],
      },
    ];
    store.replace(project);
    const ok = deleteEditorEvent(mapId, "ev_shot_delete", { silent: false });
    return { ok };
  } catch (error) {
    return { ok: false, error: String(error?.stack ?? error) };
  }
});
console.log("delete toast", deleteShot);
await page.waitForTimeout(300);
if (await page.getByTestId("toast").isVisible().catch(() => false)) {
  await page.screenshot({ path: path.join(OUT, "03-event-delete-restore-toast.png"), fullPage: false });
  await page.getByTestId("toast").screenshot({ path: path.join(OUT, "03b-toast-only.png") });
}

const manifest = {
  base: BASE,
  out: OUT,
  capturedAt: new Date().toISOString(),
  openEmpty,
  filled,
  deleteShot,
  files: fs.readdirSync(OUT),
};
fs.writeFileSync(path.join(OUT, "capture-manifest.json"), JSON.stringify(manifest, null, 2));
console.log("wrote", OUT, manifest.files);

await browser.close();
