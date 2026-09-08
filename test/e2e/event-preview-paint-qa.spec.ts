import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createBlankProject } from "@/project/defaults";
import { openCommandPicker, showCommandList } from "./eventStoryboardPicker";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

const EVIDENCE = resolve("output/evidence/event-preview-paint/browser");
const EVENT_ID = "event_preview_paint_qa";
const LONG_BODY = Array.from({ length: 40 }, (_, i) => `긴대사 ${String(i + 1).padStart(2, "0")}`).join("\n");
const PROJECT = paintProject();
const TILE = reviewTile(PROJECT);

test.describe.configure({ timeout: 180_000 });

test("event preview paint surfaces at 1024/1440 normal and max", async ({ page }) => {
  const actions: string[] = [];
  const blockedWrites: string[] = [];
  await mkdir(EVIDENCE, { recursive: true });
  await page.route("**/rest/v1/**", async (route) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      blockedWrites.push(`${route.request().method()} ${route.request().url()}`);
      await route.abort("blockedbyclient");
    } else {
      await route.continue();
    }
  });
  page.setDefaultTimeout(20_000);
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  });
  await seedProjectFromSupabaseCanonical(page, PROJECT, "/?blankProject=1");
  actions.push("goto http://127.0.0.1:9829/?blankProject=1 with local e2e seed; rest writes aborted");
  const skip = page.getByTestId("coach-mark-skip");
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    actions.push("dismissed coach-mark-skip");
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId("layer-event").click();
  const eventRow = page.getByTestId(`event-list-row-${EVENT_ID}`);
  await expect(eventRow).toBeVisible();
  await eventRow.click();
  const openEditor = page.getByTestId("event-editor-open");
  await expect(openEditor).toBeVisible();
  await openEditor.click();
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  actions.push(`opened event editor from list row ${EVENT_ID} at tile ${TILE.x},${TILE.y}`);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ] as const) {
    await page.setViewportSize(viewport);
    for (const maximized of [false, true]) {
      const full = editor.getByTestId("event-editor-window-fullscreen");
      const pressed = await full.getAttribute("aria-pressed");
      if ((pressed === "true") !== maximized) {
        await full.click();
        await expect(full).toHaveAttribute("aria-pressed", maximized ? "true" : "false");
      }
      const tag = `${viewport.width}x${viewport.height}-${maximized ? "max" : "normal"}`;
      actions.push(`viewport ${tag}`);
      await capturePreviewMatrix(page, editor, tag, actions);
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  const full = editor.getByTestId("event-editor-window-fullscreen");
  if ((await full.getAttribute("aria-pressed")) === "true") {
    await full.click();
    await expect(full).toHaveAttribute("aria-pressed", "false");
  }

  await showCommandList(editor);
  actions.push("switched to command list");
  await captureInspectorAndDialog(page, editor, actions);

  await writeFile(
    resolve(EVIDENCE, "action-log.json"),
    JSON.stringify({ actions, blockedWrites, url: page.url() }, null, 2),
  );
  expect(blockedWrites, "no remote mutations").toEqual([]);
});

async function capturePreviewMatrix(page: Page, editor: Locator, tag: string, actions: string[]): Promise<void> {
  const previewTab = editor.getByTestId("event-view-toggle-preview");
  await previewTab.click();
  await expect(previewTab).toHaveAttribute("aria-selected", "true");
  const preview = editor.getByTestId("event-page-preview");
  await expect(preview).toBeVisible();
  const status = preview.locator('[role="status"]');
  await expect(status).toHaveAttribute("data-current", /./);
  const restart = editor.getByTestId("event-script-live-restart");
  if (await restart.isEnabled()) {
    await restart.click();
    await expect(status).toHaveAttribute("data-current", "1");
  }
  await expect(status).toHaveAttribute("data-current", "1");
  await shot(page, preview.getByTestId("ecp-message-speaker"), `preview-nameplate-${tag}.png`);
  const nameplate = await preview.getByTestId("ecp-message-speaker").evaluate((node) => {
    const style = getComputedStyle(node);
    return { backgroundImage: style.backgroundImage, color: style.color, boxShadow: style.boxShadow };
  });
  expect(nameplate.backgroundImage).toMatch(/linear-gradient/i);
  actions.push(`${tag} nameplate CSSOM backgroundImage has linear-gradient`);

  await goToStep(editor, preview, 3);
  await expect(preview.locator(".ecp-message-body")).toContainText("얼굴과 대사");
  await shot(page, preview, `preview-face-text-${tag}.png`);

  await goToStep(editor, preview, 4);
  await roundtripPrevNext(editor, preview, 4);
  actions.push(`${tag} Prev→Next roundtrip 4→3→4`);
  const stage = editor.getByTestId("event-script-live-stage");
  await expect(preview.locator(".ecp-message-body")).toContainText("긴대사 01");
  const geom = await stage.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    void node.offsetHeight;
    const needle = "긴대사 40";
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let target: Text | null = null;
    let start = -1;
    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      const at = textNode.data.indexOf(needle);
      if (at >= 0) {
        target = textNode;
        start = at;
      }
    }
    if (!target || start < 0) {
      return { scrollTop: node.scrollTop, found: false, lastInside: false };
    }
    const range = document.createRange();
    range.setStart(target, start);
    range.setEnd(target, start + needle.length);
    const stageRect = node.getBoundingClientRect();
    const lastInside = [...range.getClientRects()].some(
      (rect) =>
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top >= stageRect.top - 0.5 &&
        rect.bottom <= stageRect.bottom + 0.5 &&
        rect.left >= stageRect.left - 0.5 &&
        rect.right <= stageRect.right + 0.5,
    );
    return { scrollTop: node.scrollTop, found: true, lastInside };
  });
  expect(geom.found, `${tag} last line Range exists`).toBe(true);
  expect(geom.scrollTop, `${tag} stage actually scrolled`).toBeGreaterThan(0);
  expect(geom.lastInside, `${tag} 긴대사 40 Range inside stage`).toBe(true);
  await shot(page, preview, `preview-40line-${tag}.png`);
  actions.push(`${tag} 40-line scrollTop=${geom.scrollTop} last Range inside stage`);

  await goToStep(editor, preview, 5);
  await expect(preview.locator(".ecp-choice").first()).toBeVisible();
  await shot(page, preview, `preview-choices-${tag}.png`);

  await goToStep(editor, preview, 6);
  await shot(page, preview, `preview-transfer-${tag}.png`);

  await goToStep(editor, preview, 7);
  await expect(preview.locator(".ecp-audio-icon.play")).toBeVisible();
  await shot(page, preview.locator(".ecp-audio"), `preview-play-${tag}.png`);

  await goToStep(editor, preview, 8);
  await expect(preview.locator(".ecp-audio-icon.stop")).toBeVisible();
  await shot(page, preview.locator(".ecp-audio"), `preview-stop-${tag}.png`);

  await goToStep(editor, preview, 9);
  await expect(preview.locator(".ecp-result-screen.gameover")).toBeVisible();
  await shot(page, preview.locator(".ecp-result-screen.gameover"), `preview-gameover-${tag}.png`);

  await goToStep(editor, preview, 10);
  await expect(preview.locator(".ecp-result-screen.title")).toBeVisible();
  await shot(page, preview.locator(".ecp-result-screen.title"), `preview-title-${tag}.png`);

  await goToStep(editor, preview, 11);
  await expect(preview.locator(".ecp-result-screen.ending")).toBeVisible();
  const next = editor.getByTestId("event-script-live-next");
  await expect(next).toBeDisabled();
  await expect(status).toHaveAttribute("data-current", "11");
  await shot(page, preview, `preview-ending-last-${tag}.png`);
  await shot(page, editor.locator(".event-script-live-controls"), `preview-transport-last-${tag}.png`);
  actions.push(`${tag} last step 11/11 next disabled`);
}

async function captureInspectorAndDialog(page: Page, editor: Locator, actions: string[]): Promise<void> {
  const textCmd = editor.getByTestId("event-command-text").first();
  await textCmd.scrollIntoViewIfNeeded();
  await textCmd.locator(".cmd-head").click();
  const inspector = editor.getByTestId("event-editor-inspector");
  const live = inspector.locator(".event-command-text-preview-canvas .ecp-message-speaker-nameplate");
  await expect(live).toBeVisible();
  const liveCss = await live.evaluate((node) => getComputedStyle(node).backgroundImage);
  expect(liveCss).toMatch(/linear-gradient/i);
  await shot(page, inspector.locator(".event-command-text-preview-canvas"), "inspector-text-live.png");
  actions.push("inspector text LIVE nameplate has glass image");

  const picker = await openCommandPicker(page, "toolbar-add");
  const search = picker.getByTestId("event-command-picker-search");
  await expect(search).toBeVisible();
  await search.fill("게임 오버");
  const gameOverBtn = picker.getByRole("button", { name: /게임 오버/ }).first();
  await expect(gameOverBtn).toBeVisible();
  await gameOverBtn.click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".ecp-result-screen.gameover")).toBeVisible();
  await shot(page, dialog, "dialog-gameover.png");
  actions.push("gameOver edit-dialog result screen visible");
  await dialog.getByTestId("event-command-edit-cancel").click();
  await expect(dialog).toHaveCount(0);
}

async function roundtripPrevNext(editor: Locator, preview: Locator, step: number): Promise<void> {
  const status = preview.locator('[role="status"]');
  const next = editor.getByTestId("event-script-live-next");
  const prev = editor.getByTestId("event-script-live-prev");
  await expect(status).toHaveAttribute("data-current", String(step));
  await expect(prev).toBeEnabled();
  await prev.click();
  await expect(status).toHaveAttribute("data-current", String(step - 1));
  await expect(next).toBeEnabled();
  await next.click();
  await expect(status).toHaveAttribute("data-current", String(step));
}

async function goToStep(editor: Locator, preview: Locator, step: number): Promise<void> {
  const status = preview.locator('[role="status"]');
  const next = editor.getByTestId("event-script-live-next");
  const restart = editor.getByTestId("event-script-live-restart");
  const current = Number(await status.getAttribute("data-current"));
  if (current > step) {
    await expect(restart).toBeEnabled();
    await restart.click();
    await expect(status).toHaveAttribute("data-current", "1");
  }
  for (let target = Number(await status.getAttribute("data-current")); target < step; target += 1) {
    await expect(next).toBeEnabled();
    await next.click();
    await expect(status).toHaveAttribute("data-current", String(target + 1));
  }
  await expect(status).toHaveAttribute("data-current", String(step));
}

async function shot(page: Page, target: Locator, name: string): Promise<void> {
  await expect(target).toBeVisible();
  await target.screenshot({ path: resolve(EVIDENCE, name), animations: "disabled" });
}

function paintProject(): Project {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  if (!map) throw new Error("missing start map");
  const commands: Command[] = [
    { kind: "text", speaker: "촌장", body: "마을에 온 걸 환영하네." },
    { kind: "changeFace", resourceId: "easyrpg-faceset-actor2-00", position: "left", flipHorizontally: false },
    { kind: "text", speaker: "촌장", body: "얼굴과 대사" },
    { kind: "text", speaker: "촌장", body: LONG_BODY },
    {
      kind: "choices",
      prompt: "어디로 갈까?",
      options: [
        { text: "동문", branch: [] },
        { text: "여관", branch: [] },
      ],
    },
    { kind: "transfer", mapId, x: 7, y: 10, direction: "down", fade: "white" },
    { kind: "playAudio", resourceId: "bgm-demo-town", loop: true },
    { kind: "stopAudio" },
    { kind: "gameOver" },
    { kind: "returnToTitle" },
    { kind: "ending", title: "THE END", message: "끝" },
  ];
  const page: EventPage = {
    id: `${EVENT_ID}_page`,
    name: "페인트 QA",
    conditions: [],
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_actor2" }, direction: "down", pattern: 1 },
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  const event: GameEvent = {
    id: EVENT_ID,
    x: Math.floor(map.width / 2),
    y: Math.floor(map.height / 2),
    trigger: { kind: "action" },
    commands,
    pages: [page],
  };
  map.events.push(event);
  return project;
}

function reviewTile(project: Project): { readonly x: number; readonly y: number } {
  const event = Object.values(project.maps)
    .flatMap((map) => map.events)
    .find((candidate) => candidate.id === EVENT_ID);
  if (!event) throw new Error("missing seeded event");
  return { x: event.x, y: event.y };
}
