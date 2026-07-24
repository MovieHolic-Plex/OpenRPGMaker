import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, Project } from "@/project/types";
import { openEventEditor, screenshotEvidence } from "./eventEditorCertEvidence";
import { expandEventConditions, expandEventMovementSection } from "./eventEditorExpandHelpers";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = "output/evidence/event-editor-ux-progressive";

function evidenceProject(): Project {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  if (!map) throw new Error("missing start map");

  const commands: Command[] = [
    { kind: "text", body: "나무 상자를 열어본다. 잠화가 들어 있다.", speaker: "" },
    {
      kind: "fork",
      condition: { kind: "switch", switchId: "sw_opened", value: true },
      then: [{ kind: "text", body: "이미 열었다.", speaker: "" }],
      else: [{ kind: "text", body: "아이템을 얻었다.", speaker: "" }],
    },
  ];

  const page: EventPage = {
    id: "p1",
    name: "상자",
    conditions: [{ kind: "switch", switchId: "sw_chest_ready", value: true }],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };

  map.events = [
    {
      id: "ev_chest_demo",
      x: 4,
      y: 4,
      pages: [page],
      commands,
    } as (typeof map.events)[number],
  ];
  map.name = "증거 맵";
  return project;
}

async function modalShot(page: Page, name: string): Promise<void> {
  await page.locator('[data-testid="event-editor-modal"] .event-editor-modal-window').screenshot({
    path: `${EVIDENCE_DIR}/${name}`,
  });
}

async function defaultMetrics(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const q = (s: string) => document.querySelector(s) as HTMLDetailsElement | HTMLElement | null;
    const conditions = q('[data-testid="event-classic-conditions"]') as HTMLDetailsElement | null;
    const movement = q('[data-testid="event-classic-movement-section"]') as HTMLDetailsElement | null;
    const movementBody = movement?.querySelector(".event-collapsible-body");
    return {
      conditionsOpen: conditions?.open ?? null,
      movementOpen: movement?.open ?? null,
      hasGraphic: !!q('[data-testid="event-classic-graphic"]'),
      hasBottomLeft: !!q('[data-testid="event-page-bottom-left"]'),
      hasBottomRight: !!q('[data-testid="event-page-bottom-right"]'),
      badgeText:
        q('[data-testid="event-condition-summary-badges"]')?.textContent ??
        q('[data-testid="event-condition-summary-empty"]')?.textContent ??
        null,
      hasTriggerSelect: !!q('[data-testid="event-page-trigger-select"]'),
      triggerInsideMovement: !!movementBody?.querySelector('[data-testid="event-page-trigger-select"]'),
      hasCharacterIdField: !!q('[data-testid="event-character-id-field"]'),
      hasCharacterIdInput: !!q('[data-testid="event-character-id-input"]'),
      hasCharacterConnect: !!q('[data-testid="event-character-id-connect"]'),
      characterIdInTopStrip: !!q('.event-editor-top-strip [data-testid="event-character-id-field"]'),
      hasFriendshipRequiresChar: !!q('[data-testid="event-page-friendship-requires-character-id"]'),
      movementSummaryText: movement?.querySelector("summary")?.textContent ?? null,
      auxLabels: Array.from(
        document.querySelectorAll('[data-testid="event-editor-aux-tools"] .event-aux-chip-label')
      ).map((n) => n.textContent?.trim() ?? ""),
      cmdListMinHeight: (() => {
        const list = document.querySelector(".event-contents-fieldset .cmd-list") as HTMLElement | null;
        return list ? getComputedStyle(list).minHeight : null;
      })(),
    };
  });
}

test("capture event editor progressive disclosure evidence", async ({ page }) => {
  test.setTimeout(90_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  });
  await seedProjectFromSupabaseCanonical(page, evidenceProject());

  // Dismiss first-run coach marks / edit-lock / confirm overlays if present.
  const skipCoach = page.getByRole("button", { name: "건너뛰기" });
  if (await skipCoach.isVisible().catch(() => false)) await skipCoach.click();
  const takeEdit = page.getByRole("button", { name: "편집 권한 가져오기" }).first();
  if (await takeEdit.isVisible().catch(() => false)) {
    await takeEdit.click();
    await page.waitForTimeout(200);
  }
  const confirmModal = page.getByTestId("app-confirm-modal");
  if (await confirmModal.isVisible().catch(() => false)) {
    const confirmBtn = page.getByTestId("app-modal-confirm");
    if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click();
    else await confirmModal.click({ position: { x: 8, y: 8 } });
    await expect(confirmModal).toBeHidden({ timeout: 5_000 }).catch(() => {});
  }

  await page.getByTestId("layer-event").click({ force: true });
  const toolEvent = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await toolEvent.count()) > 0) await toolEvent.click({ force: true });

  const namedRow = page.getByTestId("event-list-row-ev_chest_demo");
  if (await namedRow.isVisible().catch(() => false)) {
    await namedRow.click();
    await page.getByTestId("event-editor-open").click();
  } else if ((await page.locator(".event-list-row").count()) > 0) {
    await page.locator(".event-list-row").first().click();
    await page.getByTestId("event-editor-open").click();
  } else {
    const canvas = page.getByTestId("edit-canvas").locator("canvas").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("missing canvas");
    await canvas.dblclick({
      position: { x: Math.floor(box.width * 0.45), y: Math.floor(box.height * 0.45) },
    });
  }
  await expect(page.getByTestId("event-editor-modal")).toBeVisible({ timeout: 15_000 });

  // 1) Default progressive disclosure
  await screenshotEvidence(page, EVIDENCE_DIR, "01-default-progressive-disclosure.png");
  await modalShot(page, "01b-modal-only-default.png");
  const metrics = await defaultMetrics(page);
  await writeFile(`${EVIDENCE_DIR}/metrics-default.json`, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
  expect(metrics.conditionsOpen).toBe(false);
  expect(metrics.movementOpen).toBe(false);
  expect(metrics.hasGraphic).toBe(true);
  expect(metrics.hasBottomLeft).toBe(false);
  expect(metrics.hasBottomRight).toBe(false);
  expect(metrics.hasTriggerSelect).toBe(true);
  expect(metrics.triggerInsideMovement).toBe(false);
  expect(metrics.hasCharacterIdField).toBe(true);
  expect(metrics.hasCharacterIdInput).toBe(true);
  expect(metrics.hasCharacterConnect).toBe(false);
  expect(metrics.characterIdInTopStrip).toBe(true);
  expect(metrics.hasFriendshipRequiresChar).toBe(false);
  expect(String(metrics.badgeText ?? "")).toMatch(/ON|OFF|sw_|셀프/i);
  expect(String(metrics.badgeText ?? "")).not.toBe("스위치");

  // 2) Expand conditions
  const modal = page.getByTestId("event-editor-modal");
  await modal.getByTestId("event-classic-conditions").locator("summary.event-collapsible-summary").click({ force: true });
  await page.waitForTimeout(250);
  await screenshotEvidence(page, EVIDENCE_DIR, "02-conditions-expanded.png");
  await modalShot(page, "02b-modal-only-conditions-open.png");

  // 3) Collapse conditions, expand movement
  await modal.getByTestId("event-classic-conditions").locator("summary.event-collapsible-summary").click({ force: true });
  await modal.getByTestId("event-classic-movement-section").locator("summary.event-collapsible-summary").click({ force: true });
  await page.waitForTimeout(250);
  await screenshotEvidence(page, EVIDENCE_DIR, "03-movement-expanded.png");
  await modalShot(page, "03b-modal-only-movement-open.png");

  // 4) Aux preview open
  const preview = modal.getByTestId("event-script-live-preview");
  await preview.locator("summary").click({ force: true });
  await page.waitForTimeout(250);
  await screenshotEvidence(page, EVIDENCE_DIR, "04-aux-preview-open.png");
  await modalShot(page, "04b-modal-only-aux-preview.png");

  // 5) Flow exclusive
  const flow = modal.getByTestId("event-script-flowchart");
  await flow.locator("summary").click({ force: true });
  await page.waitForTimeout(250);
  await screenshotEvidence(page, EVIDENCE_DIR, "05-aux-flow-open-exclusive.png");
  await modalShot(page, "05b-modal-only-aux-flow.png");

  // 6) AI chip
  const ai = modal.getByTestId("ai-event-assist");
  await ai.locator("summary").click({ force: true });
  await page.waitForTimeout(250);
  await screenshotEvidence(page, EVIDENCE_DIR, "06-aux-ai-open.png");
  await modalShot(page, "06b-modal-only-aux-ai.png");

  await writeFile(
    `${EVIDENCE_DIR}/README.md`,
    [
      "# Event editor UX progressive disclosure evidence (P0–P2)",
      "",
      `Captured: ${new Date().toISOString()}`,
      "",
      "## Shots",
      "- 01-default — conditions/movement folded; trigger+priority always visible; character connect CTA; rich condition badge",
      "- 02-conditions-expanded — active-only + condition add toolbar",
      "- 03-movement-expanded — type/anim/speed only (no trigger)",
      "- 04-aux-preview-open — preview overlay",
      "- 05-aux-flow-open-exclusive — exclusive flow",
      "- 06-aux-ai-open — AI chip open",
      "",
      "Also `*b-modal-only-*.png` crops. See metrics-default.json.",
      "",
      "",
    ].join("\n"),
    "utf8"
  );
});
