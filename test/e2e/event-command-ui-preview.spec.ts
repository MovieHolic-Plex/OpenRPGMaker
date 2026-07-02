import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import { dispatchChange, openEventEditor, screenshotEvidence, writeEvidenceJson } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import type { Command, Project } from "@/project/types";

const EVIDENCE_DIR = "output/evidence/event-command-ui-preview";

test("Change Face command editor shows the selected face crop and command summary", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 926 });
  await seedProjectFromSupabaseCanonical(page, createBlankProject());
  await openEventEditor(page, "event_starter_sera");

  await editChangeFace(page, async (command) => {
    const resource = command.getByTestId("event-command-face-resource");
    await resource.fill("easyrpg-faceset-actor1");
    await dispatchChange(resource);
  });
  await editChangeFace(page, async (command) => {
    const faceIndex = command.getByTestId("event-command-face-index");
    await faceIndex.fill("6");
    await dispatchChange(faceIndex);
  });

  const command = await activeChangeFaceCommand(page);
  const preview = command.getByTestId("event-command-face-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("data-resource-id", "easyrpg-faceset-actor1");
  await expect(preview).toHaveAttribute("data-face-index", "5");
  await expect(preview).toContainText("얼굴 6");
  await expect(command.getByTestId("event-command-edit-summary")).toContainText("easyrpg-faceset-actor1");
  await expect(command.getByTestId("event-command-edit-summary")).toContainText("왼쪽");
  await expect(command.getByTestId("event-command-edit-summary")).not.toContainText("left");
  await screenshotEvidence(page, EVIDENCE_DIR, "C001-face-command-preview.png");
  await writeEvidenceJson(EVIDENCE_DIR, "C001-face-command-preview.json", {
    cleanup: "Playwright closes the browser context and dev-server webServer after the test.",
    faceIndex: await preview.getAttribute("data-face-index"),
    resourceId: await preview.getAttribute("data-resource-id"),
  });
});

test("Representative non-face command editors expose readable summaries", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 1200 });
  await seedProjectFromSupabaseCanonical(page, reviewProject());
  await openEventEditor(page, "event_starter_sera");

  for (const kind of [
    "showPicture",
    "playAudio",
    "transfer",
    "changeTile",
  ]) {
    await showInlineEditor(page, kind);
  }

  await screenshotEvidence(page, EVIDENCE_DIR, "C004A-non-face-resource-map-review.png");

  for (const kind of [
    "setVariable",
    "setSwitch",
    "changeGold",
    "changeItem",
  ]) {
    await showInlineEditor(page, kind);
  }

  await screenshotEvidence(page, EVIDENCE_DIR, "C004B-non-face-database-command-review.png");

  for (const kind of [
    "shop",
    "stopAudio",
    "gameOver",
    "returnToTitle",
  ]) {
    await showInlineEditor(page, kind);
  }

  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toContainText("그림 표시");
  await expect(editor).toContainText("소리 재생");
  await expect(editor).toContainText("장소 이동");
  await expect(editor).toContainText("타일 변경");
  await expect(editor).toContainText("변수 조작");
  await expect(editor).toContainText("아래");
  await expect(editor).toContainText("상위");
  await expect(editor).toContainText("상점 종류");
  await expect(editor).toContainText("판매 아이템");
  await expect(editor).toContainText("소리 정지: 설정 없음");
  await expect(editor).toContainText("설정 없음. 게임 오버 화면을 엽니다.");
  await expect(editor).toContainText("페이드");
  await expect(editor).not.toContainText("picture id");
  await expect(editor).not.toContainText("audio resource id");
  await expect(editor).not.toContainText("Fade:");
  await expect(editor).not.toContainText(" / down");
  await expect(editor).not.toContainText(" upper ");
  await expect(editor).not.toContainText("If Player bought or sold");
  await expect(editor).not.toContainText("Available Items");
  await screenshotEvidence(page, EVIDENCE_DIR, "C004C-non-face-commerce-terminal-review.png");
  await writeEvidenceJson(EVIDENCE_DIR, "C004-non-face-command-review.json", {
    commands: [
      "showPicture",
      "playAudio",
      "transfer",
      "changeTile",
      "setVariable",
      "setSwitch",
      "changeGold",
      "changeItem",
      "shop",
      "stopAudio",
      "gameOver",
      "returnToTitle",
    ],
    screenshots: [
      "C004A-non-face-resource-map-review.png",
      "C004B-non-face-database-command-review.png",
      "C004C-non-face-commerce-terminal-review.png",
    ],
    proves: "Non-face command editors render readable Korean summaries/labels in the real event editor surface.",
  });
});

async function editChangeFace(page: Page, action: (command: Locator) => Promise<void>): Promise<void> {
  const command = await activeChangeFaceCommand(page);
  await action(command);
}

async function activeChangeFaceCommand(page: Page): Promise<Locator> {
  const command = page.getByTestId("event-command-changeFace").first();
  await command.scrollIntoViewIfNeeded();
  await command.evaluate((node) => node.classList.add("editing"));
  await expect(command).toHaveClass(/editing/);
  return command;
}

async function showInlineEditor(page: Page, kind: string): Promise<void> {
  const command = page.getByTestId(`event-command-${kind}`).first();
  await command.scrollIntoViewIfNeeded();
  await command.evaluate((node) => node.classList.add("editing"));
  await expect(command).toHaveClass(/editing/);
}

function reviewProject(): Project {
  const project = createBlankProject();
  const event = Object.values(project.maps).flatMap((map) => map.events).find((candidate) => candidate.id === "event_starter_sera");
  const page = event?.pages?.[0];
  if (!page) throw new Error("missing starter event page");
  const mapId = project.startMapId;
  const variableId = project.variables[0]?.id ?? "";
  const switchId = project.switches[0]?.id ?? "";
  const itemId = project.database.items[0]?.id ?? "";
  const commands: Command[] = [
    { kind: "showPicture", pictureId: "pic_demo", resourceId: "easyrpg-picture-cloud", x: 24, y: 32 },
    { kind: "playAudio", resourceId: "bgm-demo-town", loop: true },
    { kind: "transfer", mapId, x: 7, y: 10, direction: "down", fade: "white" },
    { kind: "changeTile", mapId, layer: "upper", x: 4, y: 5, tile: 42 },
    { kind: "setVariable", variableId, op: "=", value: 7 },
    { kind: "setSwitch", switchId, value: true },
    { kind: "changeGold", op: "+=", amount: 150 },
    { kind: "changeItem", itemId, op: "+=", amount: 2 },
    { kind: "shop", itemIds: itemId ? [itemId] : [], shopType: "normal", messageType: "welcome", branchOnTransaction: true, transactionBranch: [] },
    { kind: "stopAudio" },
    { kind: "gameOver" },
    { kind: "returnToTitle" },
  ];
  page.commands = commands;
  event.commands = commands;
  return project;
}
