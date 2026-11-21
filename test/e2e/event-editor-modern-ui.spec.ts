import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import { openEventEditor, screenshotEvidence, writeEvidenceJson } from "./eventEditorCertEvidence";
import { showCommandList } from "./eventStoryboardPicker";
import { seedProjectForEditor } from "./projectSeed";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

const EVIDENCE_DIR = "output/evidence/event-editor-modern-ui";
const REVIEW_EVENT_ID = "event_face_surface";
const FACE_RESOURCE_ID = "easyrpg-faceset-actor1-00";
const FACE_SHEET_SRC = "/assets/easyrpg/faceset/Actor1/00.png";

/**
 * 얼굴 바꾸기 명령의 현대 미리보기 표면.
 *
 * 옛 시작 마을 NPC `event_starter_sera` 는 제품에서 빠졌다. `createBlankProject` /
 * `createStarterMap` 은 그 이벤트를 만들지 않는다(test/defaults.test.ts). 이 스펙은
 * 그 NPC 가 아니라, 빈 맵에 심은 리뷰 이벤트의 얼굴 미리보기를 본다.
 * 편집 표면은 명령 행에 `.editing` 을 붙이는 인라인 펼침이 아니다. 목록에서 명령을
 * 누르면 오른쪽 미리보기가 대사 창 목업으로 얼굴 한 장(낱장 PNG)을 연다.
 * 걷기 그림 Actor1 0번의 검토된 짝은 `easyrpg-faceset-actor1-00` 이라 그 얼굴을 심는다.
 * 다른 얼굴을 넣으면 로드 교정(repairFaceMatches)이 이 짝으로 바꾼다.
 */
test("event editor modern target surface", async ({ page }) => {
  test.setTimeout(90_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1586, height: 992 });
  await seedProjectForEditor(page, targetProject());
  const editor = await openReviewEditor(page);

  const crop = await openChangeFaceInspector(editor);
  await expect(crop).toBeVisible();
  await expect(editor.getByTestId("event-editor-inspector").getByTestId("event-command-face-crop-shell")).toHaveAttribute("data-resource-id", FACE_RESOURCE_ID);
  // 얼굴 한 칸 = 파일 한 장. 시트 오프셋 크롭(background-position 음수)이 아니라
  // 낱장 PNG 한 장이 상자에 그대로 들어간다. 그림이 있으면 배경 폴백은 꺼진다.
  await expect(crop).toHaveCSS("background-image", "none");
  await expect(crop.getByTestId("faceset-crop-sheet")).toHaveAttribute("src", FACE_SHEET_SRC);
  await expect(editor.getByTestId("event-command-text").first().getByTestId("event-command-face-crop")).toHaveCount(0);

  await screenshotEvidence(page, EVIDENCE_DIR, "event-editor-modern-ui-actual.png");
  await writeEvidenceJson(EVIDENCE_DIR, "event-editor-modern-ui-actual.json", {
    viewport: { width: 1586, height: 992 },
    state: "changeFace selected in the inspector, text row stays a list row",
    layout: await eventEditorLayoutMetrics(page),
    cleanup: "Playwright closes the browser context and dev-server webServer after the test.",
  });
});

async function openReviewEditor(page: Page): Promise<Locator> {
  const skip = page.getByTestId("coach-mark-skip");
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await openEventEditor(page, REVIEW_EVENT_ID);
  const editor = page.getByTestId("event-editor-modal");
  await showCommandList(editor);
  return editor;
}

/** 목록에서 얼굴 바꾸기를 눌러 오른쪽 미리보기의 낱장 얼굴 상자를 연다. */
async function openChangeFaceInspector(editor: Locator): Promise<Locator> {
  const command = editor.getByTestId("event-command-changeFace").first();
  await command.scrollIntoViewIfNeeded();
  await command.locator(".cmd-head").click();
  const crop = editor.getByTestId("event-editor-inspector").getByTestId("event-command-face-crop");
  await expect(crop).toBeVisible();
  return crop;
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
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing blank project start map");
  const commands: Command[] = [
    { kind: "changeFace", resourceId: FACE_RESOURCE_ID, position: "left", flipHorizontally: false },
    { kind: "text", body: "", speaker: "" },
  ];
  const eventPage: EventPage = {
    id: `${REVIEW_EVENT_ID}_page`,
    name: "얼굴 표면",
    conditions: [],
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_actor1" }, direction: "down", pattern: 1 },
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  const event: GameEvent = {
    id: REVIEW_EVENT_ID,
    name: "얼굴 표면",
    x: Math.floor(map.width / 2),
    y: Math.floor(map.height / 2),
    trigger: { kind: "action" },
    commands,
    pages: [eventPage],
  };
  map.events.push(event);
  return project;
}
