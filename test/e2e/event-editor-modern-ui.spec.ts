import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import { openEventEditor, screenshotEvidence, writeEvidenceJson } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import type { Command, Project } from "@/project/types";

const EVIDENCE_DIR = "output/evidence/event-editor-modern-ui";

test("event editor modern target surface", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1586, height: 992 });
  await seedProjectFromSupabaseCanonical(page, targetProject());
  await openEventEditor(page, "event_starter_sera");

  const command = await activeChangeFaceCommand(page);

  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await expect(command.getByTestId("event-command-face-preview")).toBeVisible();
  await expect(command.getByTestId("event-command-face-crop")).toHaveCSS("background-size", "280px 280px");
  await expect(command.getByTestId("event-command-face-crop")).toHaveCSS("background-position", "-70px -70px");
  await screenshotEvidence(page, EVIDENCE_DIR, "event-editor-modern-ui-actual.png");
  await writeEvidenceJson(EVIDENCE_DIR, "event-editor-modern-ui-actual.json", {
    viewport: { width: 1586, height: 992 },
    state: "changeFace row expanded, text row collapsed",
    layout: await eventEditorLayoutMetrics(page),
    cleanup: "Playwright closes the browser context and dev-server webServer after the test.",
  });
});

async function activeChangeFaceCommand(page: Page): Promise<Locator> {
  const command = page.getByTestId("event-command-changeFace").first();
  await command.scrollIntoViewIfNeeded();
  await command.evaluate((node) => node.classList.add("editing"));
  await expect(command).toHaveClass(/editing/);
  return command;
}

async function eventEditorLayoutMetrics(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const metric = (selector: string) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) return null;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
      };
    };
    return {
      workbench: metric(".event-editor-workbench"),
      settings: metric(".event-editor-settings-column"),
      commands: metric(".event-editor-commands-column"),
      contents: metric(".event-contents-fieldset"),
      commandList: metric(".event-contents-fieldset .cmd-list"),
      faceCrop: metric("[data-testid='event-command-face-crop']"),
    };
  });
}

function targetProject(): Project {
  const project = createBlankProject();
  const event = Object.values(project.maps).flatMap((map) => map.events).find((candidate) => candidate.id === "event_starter_sera");
  const page = event?.pages?.[0];
  if (!event || !page) throw new Error("missing starter event page");
  const commands: Command[] = [
    { kind: "changeFace", resourceId: "easyrpg-faceset-actor1", faceIndex: 5, position: "left", flipHorizontally: false },
    { kind: "text", body: "", speaker: "" },
  ];
  page.commands = commands;
  event.commands = commands;
  page.name = "세라";
  return project;
}
