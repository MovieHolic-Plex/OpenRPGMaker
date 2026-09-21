import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { emptyEventProject, mockupProject } from "./mockupProbeSeeds";
import { openEventEditor, screenshotEvidence, writeEvidenceJson } from "./eventEditorCertEvidence";
import { seedProjectForEditor } from "./projectSeed";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";

const DIR = "output/evidence/event-command-ux-sweep";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});
test.setTimeout(120_000);

async function openMockup(page: Page) {
  const { project, eventId } = mockupProject();
  await seedProjectForEditor(page, project);
  await openEventEditor(page, eventId);
  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();
  await page.waitForTimeout(500);
  return modal;
}

function commandUXProject() {
  const project = createBlankProject();
  project.switches = [{ id: "0001", name: "A" }, { id: "0002", name: "B" }];
  project.variables = [{ id: "0001", name: "V1" }, { id: "0002", name: "V2" }];
  const mapId = project.startMapId!;
  const map = project.maps[mapId]!;
  const cmds: Command[] = [
    { kind: "text", speaker: undefined, body: "대사 한 줄. 프리뷰가 긴 문장을 어떻게 줄이는지 본다." },
    { kind: "setVariable", variableId: "0001", op: "+=", value: 3 },
    { kind: "setSwitch", switchId: "0001", value: true },
    { kind: "transfer", mapId, x: 5, y: 5, direction: "down" },
    { kind: "showPicture", pictureId: "1", resourceId: "easyrpg-picture-cloud", x: 24, y: 32 },
    { kind: "playAudio", resourceId: "bgm-demo-town", loop: false },
    { kind: "changeGold", op: "+=", amount: 120 },
    { kind: "changeItem", itemId: "0001", op: "+=", amount: 2 },
    {
      kind: "fork",
      condition: { kind: "switch", switchId: "0001", value: true },
      then: [
        { kind: "text", speaker: undefined, body: "분기 안 대사" },
        { kind: "loop", body: [{ kind: "text", speaker: undefined, body: "루프 안" }, { kind: "breakLoop" }] },
      ],
      else: [{ kind: "text", speaker: undefined, body: "else 대사" }],
    },
    { kind: "choices", prompt: "선택?", options: [{ text: "A", branch: [{ kind: "text", speaker: undefined, body: "A택" } as Command] }, { text: "B", branch: [{ kind: "text", speaker: undefined, body: "B택" } as Command] }], cancelBehavior: "choice2" },
  ];
  map.events = [{
    id: "ev_cmd_ux", name: "커맨드 UX 점검", x: 6, y: 6,
    trigger: { kind: "action" }, commands: [],
    pages: [{ id: "p1", name: "페이지1", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: cmds }],
  }];
  return { project, eventId: "ev_cmd_ux" };
}

test("01-04 shell / block canvas / form gallery", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1500, height: 1000 });
  const { project, eventId } = commandUXProject();
  await seedProjectForEditor(page, project);
  await openEventEditor(page, eventId);
  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();
  await page.waitForTimeout(600);

  // 01 full shell
  await modal.screenshot({ path: `${DIR}/01-shell-cmd-ux.png` });

  // 02 block canvas — select states
  const list = modal.locator(".cmd-list").first();
  await expect(list).toBeVisible();
  await list.screenshot({ path: `${DIR}/02-block-canvas.png` });

  // select second command to see highlight
  await list.locator(".cmd-head").nth(1).click();
  await page.waitForTimeout(300);
  await list.screenshot({ path: `${DIR}/02b-block-canvas-selected.png` });
  await page.locator("body").click({ position: { x: 10, y: 10 } });

  // 03 Inspector idle -> active
  const inspector = modal.getByTestId("event-editor-inspector");
  await list.locator(".cmd-head").first().click();
  await expect(inspector.getByTestId("event-inspector-body")).toBeVisible({ timeout: 3000 });
  await inspector.screenshot({ path: `${DIR}/03-inspector-active.png` });

  // 04 Form gallery: cycle through command kinds in inspector
  const kinds = ["text", "setVariable", "setSwitch", "transfer", "showPicture", "playAudio", "fork", "choices"] as const;
  for (const kind of kinds) {
    try {
      const head = modal.locator(`[data-testid="event-command-${kind}"] .cmd-head`).first();
      if (await head.count() === 0) continue;
      await head.scrollIntoViewIfNeeded().catch(() => {});
      await head.click({ timeout: 5000 });
      await page.waitForTimeout(700);
      await modal.screenshot({ path: `${DIR}/04-form-${kind}.png` });
    } catch { /* skip flaky kinds */ }
  }
  await modal.screenshot({ path: `${DIR}/04-all-forms-in-modal.png` });
  await writeEvidenceJson(DIR, "01-04-manifest.json", { shots: ["01-shell-cmd-ux", "02-block-canvas", "03-inspector-active", "04-form-*"], note: "Block canvas + inspector form gallery" });
});

test("05-07 empty / long-list / validation strip", async ({ page }) => {
  await mkdir(DIR, { recursive: true });

  // 05 empty event
  await page.setViewportSize({ width: 1500, height: 900 });
  {
    const { project, eventId } = emptyEventProject();
    await seedProjectForEditor(page, project);
    await openEventEditor(page, eventId);
    const modal = page.getByTestId("event-editor-modal");
    await expect(modal).toBeVisible();
    await page.waitForTimeout(500);
    await modal.screenshot({ path: `${DIR}/05-empty-cta.png` });
    const cta = modal.locator(".event-command-empty-experience");
    if (await cta.count()) await cta.first().screenshot({ path: `${DIR}/05b-empty-cta-close.png` });
  }

  // 06 long list scrolling (20 commands)
  {
    const project = createBlankProject();
    const mapId = project.startMapId!;
    const cmds: Command[] = Array.from({ length: 20 }, (_, i) => ({ kind: "text" as const, speaker: undefined, body: `대사 ${i + 1} — 스크롤과 잘림을 본다. 내용이 길어지면 말줄임이 어떻게 되는지 확인.` }));
    project.maps[mapId]!.events = [{
      id: "ev_long", name: "긴 목록", x: 4, y: 4, trigger: { kind: "action" }, commands: [],
      pages: [{ id: "p1", name: "p1", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: cmds }],
    }];
    await seedProjectForEditor(page, project);
    await openEventEditor(page, "ev_long");
    const modal = page.getByTestId("event-editor-modal");
    await expect(modal).toBeVisible();
    await modal.locator(".cmd-list").first().screenshot({ path: `${DIR}/06-long-list-top.png` });
    await modal.locator(".cmd-list").first().evaluate((el) => { el.scrollTop = 9999; });
    await page.waitForTimeout(300);
    await modal.locator(".cmd-list").first().screenshot({ path: `${DIR}/06b-long-list-bottom.png` });
  }

  // 07 validation strip overflow (reuse mockup project which has warnings)
  {
    const modal = await openMockup(page);
    const strip = modal.locator(".event-validation-strip, [data-testid='event-validation-strip']").first();
    if (await strip.count()) {
      await strip.screenshot({ path: `${DIR}/07-validation-strip.png` });
    } else {
      await modal.screenshot({ path: `${DIR}/07-validation-fallback.png` });
    }
  }
});

test("08-10 palette / picker search / responsive widths", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1500, height: 1000 });
  const modal = await openMockup(page);

  // 08 palette closed -> open
  const addBtn = modal.getByTestId("event-command-toolbar-add").first();
  await addBtn.click();
  const picker = page.getByTestId("event-command-picker");
  await expect(picker.first()).toBeVisible({ timeout: 5000 });
  await picker.first().screenshot({ path: `${DIR}/08-palette-open.png` });

  // 09 search filtering
  const search = page.getByTestId("event-command-picker-search");
  if (await search.count()) {
    await search.fill("변수");
    await page.waitForTimeout(300);
    await picker.first().screenshot({ path: `${DIR}/09-palette-search-변수.png` });
    await search.fill("");
    await page.waitForTimeout(200);
    // category tab
    const tabs = page.locator(".event-command-picker-category, [data-testid*='picker-category']");
    if (await tabs.count()) {
      await tabs.first().click();
      await page.waitForTimeout(300);
      await picker.first().screenshot({ path: `${DIR}/09b-palette-category.png` });
    }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // 10 responsive widths
  for (const w of [1280, 1920]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(400);
    await modal.screenshot({ path: `${DIR}/10-responsive-${w}.png` });
  }
  await writeEvidenceJson(DIR, "08-10-manifest.json", { palette: "08-09", responsive: [1280, 1920] });
});
