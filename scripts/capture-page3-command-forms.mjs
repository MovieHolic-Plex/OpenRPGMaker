/**
 * Capture page-3 (맵·연출) command edit dialogs for visual QA.
 * Usage: node scripts/capture-page3-command-forms.mjs
 *
 * Requires a running dev server (default http://127.0.0.1:9999).
 * Screenshots land in output/evidence/page3-command-forms/.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9999";
const OUT = path.resolve("output/evidence/page3-command-forms");
fs.mkdirSync(OUT, { recursive: true });

/** @typedef {{ actorId: string, mapId: string, eventId: string, animationId: string, pictureResourceId: string, variableId: string }} ProjectIds */

/**
 * Page-3 native + key M2 맵·연출 commands.
 * `assert` prefers modern rich shells; falls back to known control testids.
 */
const COMMANDS = [
  // --- native page-3 extras ---
  {
    id: "01-set-lighting",
    label: "조명 설정",
    build: () => ({ kind: "setLighting", ambient: 0.45, color: "#1a1030", transitionMs: 400 }),
    assert:
      "[data-testid='set-lighting-command-body'], [data-testid='set-lighting-ambient-input'], [data-testid='page3-command-body']",
  },
  {
    id: "02-add-light",
    label: "광원 추가",
    build: () => ({
      kind: "addLight",
      source: { id: "torch_1", at: "player", radius: 6, intensity: 0.9, color: "#ffcc66", flicker: true },
    }),
    assert:
      "[data-testid='add-light-command-body'], [data-testid='add-light-id-input'], [data-testid='page3-command-body']",
  },
  {
    id: "03-remove-light",
    label: "광원 제거",
    build: () => ({ kind: "removeLight", id: "torch_1" }),
    assert:
      "[data-testid='remove-light-command-body'], [data-testid='remove-light-id-input'], [data-testid='page3-command-body']",
  },
  {
    id: "03b-show-emote",
    label: "이모트 표시",
    build: () => ({ kind: "showEmote", target: { eventId: "" }, emote: "heart", durationMs: 1200 }),
    assert:
      "[data-testid='show-emote-command-body'], [data-testid='show-emote-swatch-grid'], [data-testid='page3-command-body']",
  },
  {
    id: "04-set-weather",
    label: "날씨 설정",
    build: () => ({ kind: "setWeather", weather: "rain", intensity: 0.7, transitionMs: 600 }),
    assert:
      "[data-testid='set-weather-command-body'], [data-testid='set-weather-kind-select'], [data-testid='page3-command-body']",
  },
  {
    id: "05-show-animation",
    label: "애니메이션 표시",
    build: (ids) => ({
      kind: "showAnimation",
      target: "player",
      animationId: ids.animationId,
      wait: true,
    }),
    assert:
      "[data-testid='show-animation-command-body'], [data-testid='show-animation-m2-command-body'], [data-testid='show-animation-target-kind-select'], [data-testid='page3-command-body']",
  },
  {
    id: "06-show-picture",
    label: "그림 표시",
    build: (ids) => ({
      kind: "showPicture",
      pictureId: "pic1",
      resourceId: ids.pictureResourceId,
      x: 24,
      y: 32,
    }),
    assert:
      "[data-testid='show-picture-command-body'], [data-testid='show-picture-m2-command-body'], [data-testid='show-picture-id-input'], [data-testid='page3-command-body']",
  },
  {
    id: "07-erase-picture",
    label: "그림 삭제",
    build: () => ({ kind: "erasePicture", pictureId: "pic1" }),
    assert:
      "[data-testid='erase-picture-command-body'], [data-testid='erase-picture-m2-command-body'], [data-testid='erase-picture-id-input'], [data-testid='page3-command-body']",
  },
  {
    id: "08-change-tile",
    label: "타일 변경",
    build: (ids) => ({
      kind: "changeTile",
      mapId: ids.mapId,
      x: 4,
      y: 5,
      layer: "lower",
      tile: 12,
    }),
    assert:
      "[data-testid='change-tile-command-body'], [data-testid='change-tile-x-input'], [data-testid='page3-command-body'], [data-testid='m2-command-body-m2-071-change-tile']",
  },

  // --- key M2 page-3 (맵·연출) ---
  {
    id: "09-get-player-location",
    label: "주인공 위치 얻기",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-036-get-player-location",
      fields: { target: "player", variableId: ids.variableId },
    }),
    assert:
      "[data-testid='get-player-location-command-body'], [data-testid='m2-command-body-m2-036-get-player-location'], [data-testid='page3-command-body']",
  },
  {
    id: "10-set-event-location",
    label: "이벤트 위치 설정",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-040-set-event-location",
      fields: { target: ids.eventId || "this-event", mapId: ids.mapId, x: 3, y: 4 },
    }),
    assert:
      "[data-testid='set-event-location-command-body'], [data-testid='m2-command-body-m2-040-set-event-location'], [data-testid='page3-command-body']",
  },
  {
    id: "11-hide-screen",
    label: "화면 숨기기",
    build: () => ({ kind: "m2Command", commandId: "m2-044-hide-screen", fields: {} }),
    assert:
      "[data-testid='hide-screen-command-body'], [data-testid='m2-command-body-m2-044-hide-screen'], [data-testid='page3-command-body']",
  },
  {
    id: "12-show-screen",
    label: "화면 표시",
    build: () => ({ kind: "m2Command", commandId: "m2-045-show-screen", fields: {} }),
    assert:
      "[data-testid='show-screen-command-body'], [data-testid='m2-command-body-m2-045-show-screen'], [data-testid='page3-command-body']",
  },
  {
    id: "13-tint-screen",
    label: "화면 색조 변경",
    build: () => ({
      kind: "m2Command",
      commandId: "m2-046-tint-screen",
      fields: { color: "warm", value: "", durationMs: 300 },
    }),
    assert:
      "[data-testid='tint-screen-command-body'], [data-testid='m2-command-body-m2-046-tint-screen'], [data-testid='page3-command-body']",
  },
  {
    id: "14-flash-screen",
    label: "화면 플래시",
    build: () => ({
      kind: "m2Command",
      commandId: "m2-047-flash-screen",
      fields: { color: "white", durationMs: 200 },
    }),
    assert:
      "[data-testid='flash-screen-command-body'], [data-testid='m2-command-body-m2-047-flash-screen'], [data-testid='page3-command-body']",
  },
  {
    id: "15-shake-screen",
    label: "화면 흔들기",
    build: () => ({
      kind: "m2Command",
      commandId: "m2-048-shake-screen",
      fields: { intensity: 4, durationMs: 320 },
    }),
    assert:
      "[data-testid='shake-screen-command-body'], [data-testid='m2-command-body-m2-048-shake-screen'], [data-testid='page3-command-body']",
  },
  {
    id: "16-scroll-map",
    label: "맵 스크롤",
    build: () => ({
      kind: "m2Command",
      commandId: "m2-049-scroll-map",
      fields: { direction: "right", distance: 3, speed: 4, wait: "true", mode: "pan" },
    }),
    assert:
      "[data-testid='scroll-map-command-body'], [data-testid='m2-command-body-m2-049-scroll-map'], [data-testid='page3-command-body']",
  },
  {
    id: "17-set-weather-effects",
    label: "날씨 효과 설정",
    build: () => ({
      kind: "m2Command",
      commandId: "m2-050-set-weather-effects",
      fields: { value: "rain", operation: "set", target: "" },
    }),
    assert:
      "[data-testid='set-weather-effects-command-body'], [data-testid='m2-command-body-m2-050-set-weather-effects'], [data-testid='page3-command-body']",
  },
  {
    id: "18-m2-show-picture",
    label: "그림 표시 (M2)",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-051-show-picture",
      fields: { pictureId: "pic1", resourceId: ids.pictureResourceId, x: 16, y: 20 },
    }),
    assert:
      "[data-testid='show-picture-command-body'], [data-testid='show-picture-m2-command-body'], [data-testid='m2-command-body-m2-051-show-picture'], [data-testid='page3-command-body'], [data-testid='show-picture-id-input']",
  },
  {
    id: "19-move-picture",
    label: "그림 이동",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-052-move-picture",
      fields: { pictureId: "pic1", resourceId: ids.pictureResourceId, x: 40, y: 12 },
    }),
    assert:
      "[data-testid='move-picture-command-body'], [data-testid='move-picture-m2-command-body'], [data-testid='m2-command-body-m2-052-move-picture'], [data-testid='page3-command-body']",
  },
  {
    id: "20-erase-picture-m2",
    label: "그림 삭제 (M2)",
    build: () => ({
      kind: "m2Command",
      commandId: "m2-053-erase-picture",
      fields: { pictureId: "pic1" },
    }),
    assert:
      "[data-testid='erase-picture-command-body'], [data-testid='erase-picture-m2-command-body'], [data-testid='m2-command-body-m2-053-erase-picture'], [data-testid='page3-command-body']",
  },
  {
    id: "21-m2-show-animation",
    label: "애니메이션 표시 (M2)",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-054-show-animation",
      fields: { target: "this-event", animationId: ids.animationId },
    }),
    assert:
      "[data-testid='show-animation-command-body'], [data-testid='show-animation-m2-command-body'], [data-testid='m2-command-body-m2-054-show-animation'], [data-testid='page3-command-body']",
  },
  {
    id: "22-flash-event",
    label: "이벤트 플래시",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-056-flash-event",
      fields: { target: ids.eventId || "this-event", value: "white" },
    }),
    assert:
      "[data-testid='flash-event-command-body'], [data-testid='m2-command-body-m2-056-flash-event'], [data-testid='page3-command-body']",
  },
  {
    id: "23-stop-all-movement",
    label: "모든 이동 중단",
    build: () => ({ kind: "m2Command", commandId: "m2-059-stop-all-movement", fields: {} }),
    assert:
      "[data-testid='stop-all-movement-command-body'], [data-testid='m2-command-body-m2-059-stop-all-movement'], [data-testid='page3-command-body']",
  },
  {
    id: "24-key-input-processing",
    label: "키 입력 처리",
    build: (ids) => ({
      kind: "m2Command",
      commandId: "m2-067-key-input-processing",
      fields: { target: "", operation: "set", value: ids.variableId },
    }),
    assert:
      "[data-testid='key-input-processing-command-body'], [data-testid='m2-command-body-m2-067-key-input-processing'], [data-testid='page3-command-body']",
  },
  {
    id: "25-change-tileset",
    label: "타일셋 변경",
    build: () => ({
      kind: "m2Command",
      commandId: "m2-068-change-tileset",
      fields: { target: "", operation: "set", value: "" },
    }),
    assert:
      "[data-testid='change-tileset-command-body'], [data-testid='m2-command-body-m2-068-change-tileset'], [data-testid='page3-command-body']",
  },
  {
    id: "26-change-parallax-back",
    label: "패럴랙스 배경 변경",
    build: () => ({
      kind: "m2Command",
      commandId: "m2-069-change-parallax-back",
      fields: { target: "", operation: "set", value: "" },
    }),
    assert:
      "[data-testid='change-parallax-back-command-body'], [data-testid='m2-command-body-m2-069-change-parallax-back'], [data-testid='page3-command-body']",
  },
  {
    id: "27-set-encounter-rate",
    label: "인카운트율 설정",
    build: () => ({
      kind: "m2Command",
      commandId: "m2-070-set-encounter-rate",
      fields: { target: "", operation: "set", value: "32" },
    }),
    assert:
      "[data-testid='set-encounter-rate-command-body'], [data-testid='m2-command-body-m2-070-set-encounter-rate'], [data-testid='page3-command-body']",
  },
];

async function dismissOverlays(page) {
  for (const t of ["건너뛰기", "닫기", "✕", "나중에"]) {
    const btn = page.getByRole("button", { name: t }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
    }
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
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click().catch(() => {});
  } else {
    await page.keyboard.press("Escape").catch(() => {});
  }
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    document.querySelectorAll("[data-testid='event-command-edit-dialog']").forEach((n) => n.remove());
    document.querySelectorAll(".modal-backdrop, .dialog-backdrop").forEach((n) => n.remove());
  });
}

/** @returns {Promise<ProjectIds>} */
async function resolveProjectIds(page) {
  return page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const project = store.getCurrent();
    const actorId = project.database.actors[0]?.id ?? "";
    const mapId = project.startMapId || Object.keys(project.maps)[0] || "";
    const map = mapId ? project.maps[mapId] : undefined;
    const eventId = map?.events?.[0]?.id ?? "";
    const animationId = project.database.battleAnimations?.[0]?.id ?? "";
    const pictureResource =
      project.resources?.find?.((r) => r.kind === "picture")?.id ??
      project.database?.actors?.[0]?.faceResourceId ??
      "picture_sample";
    const variableId = project.variables?.[0]?.id ?? "";
    return {
      actorId,
      mapId,
      eventId,
      animationId,
      pictureResourceId: pictureResource,
      variableId,
    };
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

  const ids = await resolveProjectIds(page);
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

      if (cmd.assert) {
        await page.waitForSelector(cmd.assert, { timeout: 8_000 }).catch(() => {});
      }

      const shotPath = path.join(OUT, `${cmd.id}.png`);
      await dialog.screenshot({ path: shotPath });
      await page.screenshot({ path: path.join(OUT, `${cmd.id}-full.png`), fullPage: false });

      const bodyText = ((await dialog.innerText().catch(() => "")) || "").replace(/\s+/g, " ").slice(0, 220);
      const hasModern = await page.locator(cmd.assert).count().catch(() => 0);
      const richShell = await page
        .locator(
          "[data-testid$='-command-body'].page3-command-body, [data-testid$='-command-body'].actor-m2-command-body, [data-testid='page3-command-body']"
        )
        .count()
        .catch(() => 0);

      results.push({
        id: cmd.id,
        label: cmd.label,
        kind: initial.kind,
        commandId: initial.kind === "m2Command" ? initial.commandId : undefined,
        ok: hasModern > 0,
        hasModern,
        richShell,
        bodyText,
        shot: shotPath,
      });
      console.log(hasModern > 0 ? "OK" : "WARN", cmd.id, cmd.label, "modern=", hasModern, "richShell=", richShell);
    } catch (err) {
      results.push({ id: cmd.id, label: cmd.label, ok: false, error: String(err) });
      console.log("FAIL", cmd.id, err);
      await page.screenshot({ path: path.join(OUT, `${cmd.id}-error.png`), fullPage: false }).catch(() => {});
    }
  }

  const summary = {
    base: BASE,
    capturedAt: new Date().toISOString(),
    ids,
    commandCount: COMMANDS.length,
    okCount: results.filter((r) => r.ok).length,
    results,
  };
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  console.log("wrote", OUT, `ok=${summary.okCount}/${summary.commandCount}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
