/**
 * Capture modern actor/combat command edit dialogs for visual QA.
 * Usage: node scripts/capture-actor-command-forms.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9999";
const OUT = path.resolve("output/evidence/actor-command-forms");
fs.mkdirSync(OUT, { recursive: true });

const COMMANDS = [
  {
    id: "01-change-party",
    label: "파티 멤버 변경",
    build: (ids) => ({ kind: "changeParty", actorId: ids.actorId, action: "add" }),
    assert: "[data-testid='change-party-command-body'], [data-testid='change-party-intent']",
  },
  {
    id: "02-change-parameters",
    label: "능력치 변경",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-014-change-parameters",
      fields: { target: ids.actorId, parameter: "attack", operation: "add", value: 5 },
    }),
    assert: "[data-testid='change-parameters-command-body']",
  },
  {
    id: "03-change-equipment",
    label: "장비 변경",
    build: (ids) => ({
      kind: "changeEquipment",
      actorId: ids.actorId,
      slot: "weapon",
      equipmentId: ids.equipmentId,
    }),
    assert: "[data-testid='change-equipment-command-body']",
  },
  {
    id: "04-change-hp",
    label: "HP 변경",
    build: (ids) => ({ kind: "changeActorHp", actorId: ids.actorId, op: "+=", amount: 20 }),
    assert: "[data-testid='change-actor-hp-command-body'], [data-testid='change-actor-hp-actor-select']",
  },
  {
    id: "05-change-mp",
    label: "MP 변경",
    build: (ids) => ({ kind: "changeActorMp", actorId: ids.actorId, op: "+=", amount: 10 }),
    assert: "[data-testid='change-actor-mp-command-body'], [data-testid='change-actor-mp-actor-select']",
  },
  {
    id: "06-change-state",
    label: "상태 변경",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-019-change-state",
      fields: { target: ids.actorId, operation: "add", value: ids.stateId },
    }),
    assert: "[data-testid='change-state-command-body']",
  },
  {
    id: "07-recover-all",
    label: "모두 회복",
    build: () => ({ kind: "recoverAll", actorId: "" }),
    assert: "[data-testid='recover-all-command-body']",
  },
  {
    id: "08-damage-processing",
    label: "데미지 처리",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-021-damage-processing",
      fields: { target: ids.actorId, operation: "add", value: 25 },
    }),
    assert: "[data-testid='damage-processing-command-body']",
  },
  {
    id: "09-change-actor-name",
    label: "주인공 이름 변경",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-022-change-actor-name",
      fields: { target: ids.actorId, value: "용사" },
    }),
    assert: "[data-testid='change-actor-name-command-body']",
  },
  {
    id: "10-change-actor-nickname",
    label: "주인공 별명 변경",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-023-change-actor-nickname",
      fields: { target: ids.actorId, value: "전설" },
    }),
    assert: "[data-testid='change-actor-nickname-command-body']",
  },
  {
    id: "11-change-actor-graphic",
    label: "주인공 그래픽 변경",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-024-change-actor-graphic",
      fields: { target: ids.actorId, value: ids.charsetId },
    }),
    assert: "[data-testid='change-actor-graphic-command-body']",
  },
  {
    id: "12-change-actor-faceset",
    label: "주인공 얼굴 변경",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-025-change-actor-faceset",
      fields: { target: ids.actorId, value: `${ids.facesetId}#0` },
    }),
    assert: "[data-testid='change-actor-faceset-command-body']",
  },
  {
    id: "13-change-actor-class",
    label: "주인공 직업 변경",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-091-change-actor-class",
      fields: { target: ids.actorId, value: ids.classId },
    }),
    assert: "[data-testid='change-actor-class-command-body']",
  },
  {
    id: "14-promote-actor",
    label: "승급",
    build: (ids) => ({
      kind: "promoteActor",
      actorId: ids.actorId,
      toClassId: ids.classId,
      successBranch: [],
      failureBranch: [],
    }),
    assert: "[data-testid='promote-actor-command-body']",
  },
  {
    id: "15-enter-hero-name",
    label: "이름 입력 처리",
    build: (ids) => ({
      kind: "enterHeroName",
      actorId: ids.actorId,
      maxLength: 6,
      showInitialName: true,
    }),
    assert: "[data-testid='enter-hero-name-command-body']",
  },
];

async function dismissOverlays(page) {
  for (const t of ["건너뛰기", "닫기", "✕", "나중에"]) {
    const btn = page.getByRole("button", { name: t }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
    }
  }
  // welcome / modal close
  for (const testid of ["editor-welcome-skip", "editor-welcome-close", "modal-close"]) {
    const el = page.getByTestId(testid);
    if (await el.isVisible().catch(() => false)) await el.click().catch(() => {});
  }
}

async function closeEditDialog(page) {
  const dialog = page.locator("[data-testid='event-command-edit-dialog']").last();
  if (!(await dialog.count())) return;
  const cancel = dialog.getByTestId("event-command-edit-cancel");
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click().catch(() => {});
  } else {
    await page.keyboard.press("Escape").catch(() => {});
  }
  await page.waitForTimeout(200);
  // force remove leftover
  await page.evaluate(() => {
    document.querySelectorAll("[data-testid='event-command-edit-dialog']").forEach((n) => n.remove());
    document.querySelectorAll(".modal-backdrop, .dialog-backdrop").forEach((n) => n.remove());
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 920 } });
  page.setDefaultTimeout(30_000);

  await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("[data-testid='edit-canvas']", { timeout: 45_000 });
  await page.waitForTimeout(2000);
  await dismissOverlays(page);

  // Resolve project ids in page context
  const ids = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const project = store.getCurrent();
    const actorId = project.database.actors[0]?.id ?? "";
    const equipmentId = project.database.equipment.find((e) => e.slot === "weapon")?.id ?? project.database.equipment[0]?.id ?? "";
    const stateId = project.database.states[0]?.id ?? "";
    const classId = project.database.classes[0]?.id ?? "";
    const facesetId = project.database.actors[0]?.faceResourceId ?? "easyrpg-faceset-actor1";
    const charsetId = project.database.actors[0]?.characterResourceId ?? "easyrpg-charset-actor1";
    return { actorId, equipmentId, stateId, classId, facesetId, charsetId };
  });
  console.log("ids", ids);

  const results = [];
  for (const cmd of COMMANDS) {
    await closeEditDialog(page);
    const initial = cmd.build(ids);
    try {
      await page.evaluate(async (command) => {
        const mod = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
        mod.openEventCommandEditDialog({
          initial: command,
          lockKind: true,
          onApply: () => {},
        });
      }, initial);

      const dialog = page.locator("[data-testid='event-command-edit-dialog']").last();
      await dialog.waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(400);

      // wait for assert selector inside dialog if provided
      if (cmd.assert) {
        await page.waitForSelector(cmd.assert, { timeout: 8_000 }).catch(() => {});
      }

      const shotPath = path.join(OUT, `${cmd.id}.png`);
      await dialog.screenshot({ path: shotPath });
      // also full page for context
      await page.screenshot({ path: path.join(OUT, `${cmd.id}-full.png`), fullPage: false });

      const bodyText = ((await dialog.innerText().catch(() => "")) || "").replace(/\s+/g, " ").slice(0, 220);
      const hasModern = await page.locator(cmd.assert).count().catch(() => 0);
      results.push({
        id: cmd.id,
        label: cmd.label,
        ok: hasModern > 0,
        hasModern,
        bodyText,
        shot: shotPath,
      });
      console.log(hasModern > 0 ? "OK" : "WARN", cmd.id, cmd.label, "modern=", hasModern);
    } catch (err) {
      results.push({ id: cmd.id, label: cmd.label, ok: false, error: String(err) });
      console.log("FAIL", cmd.id, err);
      await page.screenshot({ path: path.join(OUT, `${cmd.id}-error.png`), fullPage: false }).catch(() => {});
    }
  }

  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({ base: BASE, ids, results }, null, 2));
  console.log("wrote", OUT);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
