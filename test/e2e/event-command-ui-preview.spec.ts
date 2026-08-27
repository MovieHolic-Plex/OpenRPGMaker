import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import { dispatchChange, screenshotEvidence, writeEvidenceJson } from "./eventEditorCertEvidence";
import { openSeededEventEditor, showCommandList } from "./eventStoryboardPicker";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

const EVIDENCE_DIR = "output/evidence/event-command-ui-preview";
const REVIEW_EVENT_ID = "event_command_ui_preview";
const REVIEW_PROJECT = reviewProject();
/** 시드 이벤트는 맵 중앙에 둔다 — 기본 카메라가 보는 자리다. */
const REVIEW_EVENT_TILE = reviewEventTile(REVIEW_PROJECT);

/**
 * 명령 편집기의 요약/미리보기 가독성 계약.
 *
 * 진입은 제품 표면을 따른다: 빈 프로젝트에 리뷰용 이벤트를 시드하고, 맵에서 그 이벤트를 열고,
 * 인라인 편집기를 보려고 보조 뷰인 목록으로 명시 전환한 뒤 명령을 눌러 인스펙터를 읽는다.
 * RM2003 `@>` 빈 줄 경로와 스타터 마을 NPC(`event_starter_sera`) 하드코딩은 쓰지 않는다.
 */

/** 명령별 기대 요약 — 한국어 카피 그대로. 영문 토큰이 새면 실패한다. */
const COMMAND_SUMMARIES = [
  { kind: "showPicture", summary: "그림 표시: 위치 (24, 32)" },
  { kind: "playAudio", summary: "소리 재생: demo-town" },
  { kind: "transfer", summary: "장소 이동: 빈 맵 (7,10) / 아래" },
  { kind: "changeTile", summary: "지형 변경: 빈 맵 덧그림 (4,5) → 그림 42" },
  { kind: "setVariable", summary: "변수 조작: (이름 없음) 이 값으로 7" },
  { kind: "setSwitch", summary: "스위치 조작: (이름 없음) 켜짐" },
  { kind: "changeGold", summary: "소지금 변경: 더하기 150" },
  { kind: "changeItem", summary: "아이템 변경: 회복약 더하기 2" },
  { kind: "shop", summary: "상점: 1개·100G" },
  { kind: "stopAudio", summary: "소리 정지: 설정 없음" },
  { kind: "gameOver", summary: "게임 오버" },
  { kind: "returnToTitle", summary: "타이틀 화면으로" },
] as const satisfies readonly { readonly kind: string; readonly summary: string }[];

test("Change Face command editor shows the selected face crop and command summary", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 926 });
  await seedProjectFromSupabaseCanonical(page, REVIEW_PROJECT);
  const editor = await openReviewEventCommandList(page);

  const inspector = await openCommandInspector(editor, "changeFace");
  const resource = inspector.getByTestId("event-command-face-resource");
  // 얼굴 한 칸 = 파일 한 장. 칸 번호 컨트롤은 없고 낱장 리소스 id 하나로 고른다
  // (…-05 = 예전 4×4 시트의 5번 칸 = 사람이 읽는 「얼굴 6」).
  await resource.fill("easyrpg-faceset-actor1-05");
  await dispatchChange(resource);

  const preview = inspector.getByTestId("event-command-face-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("data-resource-id", "easyrpg-faceset-actor1-05");
  await expect(inspector.getByTestId("event-command-face-index")).toHaveCount(0);
  await expect(preview).toContainText("얼굴 6");
  await expect(preview).toContainText("왼쪽");
  await expect(preview).not.toContainText("left");
  await expect(inspector.getByTestId("event-command-edit-summary")).toContainText("얼굴 바꾸기");
  await expect(editor.getByTestId("event-command-changeFace").first()).not.toContainText("faceIndex");
  await screenshotEvidence(page, EVIDENCE_DIR, "C001-face-command-preview.png");
  await writeEvidenceJson(EVIDENCE_DIR, "C001-face-command-preview.json", {
    cleanup: "Playwright closes the browser context and dev-server webServer after the test.",
    resourceId: await preview.getAttribute("data-resource-id"),
  });
});

test("Representative non-face command editors expose readable summaries", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 1200 });
  await seedProjectFromSupabaseCanonical(page, REVIEW_PROJECT);
  const editor = await openReviewEventCommandList(page);

  for (const { kind, summary } of COMMAND_SUMMARIES.slice(0, 4)) {
    await expectCommandSummary(editor, kind, summary);
  }
  await screenshotEvidence(page, EVIDENCE_DIR, "C004A-non-face-resource-map-review.png");

  for (const { kind, summary } of COMMAND_SUMMARIES.slice(4, 8)) {
    await expectCommandSummary(editor, kind, summary);
  }
  await screenshotEvidence(page, EVIDENCE_DIR, "C004B-non-face-database-command-review.png");

  for (const { kind, summary } of COMMAND_SUMMARIES.slice(8)) {
    await expectCommandSummary(editor, kind, summary);
  }

  // 상점/터미널 명령은 인스펙터에서도 한국어 저작 폼을 낸다.
  const shopInspector = await openCommandInspector(editor, "shop");
  await expect(shopInspector.getByTestId("shop-command-body")).toBeVisible();
  await expect(shopInspector).toContainText("판매 목록");
  await expect(shopInspector).toContainText("종류");
  await expect(await openCommandInspector(editor, "gameOver")).toContainText("설정 없음. 게임 오버 화면을 엽니다.");
  await expect(await openCommandInspector(editor, "returnToTitle")).toContainText("타이틀 화면으로 돌아갑니다.");

  // 영문 토큰 누출 금지 — 이 스펙의 본론이다.
  await expect(editor).not.toContainText("picture id");
  await expect(editor).not.toContainText("audio resource id");
  await expect(editor).not.toContainText("Fade:");
  await expect(editor).not.toContainText(" / down");
  await expect(editor).not.toContainText(" upper ");
  await expect(editor).not.toContainText("If Player bought or sold");
  await expect(editor).not.toContainText("Available Items");
  await screenshotEvidence(page, EVIDENCE_DIR, "C004C-non-face-commerce-terminal-review.png");
  await writeEvidenceJson(EVIDENCE_DIR, "C004-non-face-command-review.json", {
    commands: COMMAND_SUMMARIES.map((entry) => entry.kind),
    screenshots: [
      "C004A-non-face-resource-map-review.png",
      "C004B-non-face-database-command-review.png",
      "C004C-non-face-commerce-terminal-review.png",
    ],
    proves: "Non-face command editors render readable Korean summaries/labels in the real event editor surface.",
  });
});

async function openReviewEventCommandList(page: Page): Promise<Locator> {
  const skip = page.getByTestId("coach-mark-skip");
  if (await skip.isVisible().catch(() => false)) await skip.click();
  const editor = await openSeededEventEditor(page, REVIEW_EVENT_TILE);
  await showCommandList(editor);
  return editor;
}

/** 목록에서 명령을 눌러 인스펙터(우측 편집 열)를 연다. */
async function openCommandInspector(editor: Locator, kind: string): Promise<Locator> {
  const command = editor.getByTestId(`event-command-${kind}`).first();
  await command.scrollIntoViewIfNeeded();
  await command.locator(".cmd-head").click();
  const inspector = editor.getByTestId("event-editor-inspector");
  await expect(inspector.getByTestId("event-inspector-body")).toBeVisible();
  return inspector;
}

async function expectCommandSummary(editor: Locator, kind: string, summary: string): Promise<void> {
  const command = editor.getByTestId(`event-command-${kind}`).first();
  await command.scrollIntoViewIfNeeded();
  await expect(command).toContainText(summary);
}

/** 빈 프로젝트 + 리뷰용 이벤트 하나. 대표 명령을 한 페이지에 모아 요약/미리보기를 읽는다. */
function reviewProject(): Project {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  if (!map) throw new Error("missing blank project start map");
  const variableId = project.variables[0]?.id ?? "";
  const switchId = project.switches[0]?.id ?? "";
  const itemId = project.database.items[0]?.id ?? "";
  const commands: Command[] = [
    { kind: "changeFace", resourceId: "easyrpg-faceset-actor2-00", position: "left", flipHorizontally: false },
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
  const page: EventPage = {
    id: `${REVIEW_EVENT_ID}_page`,
    name: "명령 미리보기 리뷰",
    conditions: [],
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_actor2" }, direction: "down", pattern: 1 },
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  const event: GameEvent = {
    id: REVIEW_EVENT_ID,
    x: Math.floor(map.width / 2),
    y: Math.floor(map.height / 2),
    trigger: { kind: "action" },
    commands,
    pages: [page],
  };
  map.events.push(event);
  return project;
}

/** 시드 프로젝트에서 리뷰용 이벤트가 서 있는 타일. */
function reviewEventTile(project: Project): { readonly x: number; readonly y: number } {
  const event = Object.values(project.maps)
    .flatMap((map) => map.events)
    .find((candidate) => candidate.id === REVIEW_EVENT_ID);
  if (!event) throw new Error("missing seeded review event");
  return { x: event.x, y: event.y };
}
