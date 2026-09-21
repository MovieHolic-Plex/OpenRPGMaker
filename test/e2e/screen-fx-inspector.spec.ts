/**
 * 계약: **명령 행 한 번 클릭으로 열리는 우측 인스펙터도 `화면 효과`를 실제로 보여준다.**
 *
 * 회귀 배경(적대적 QA 3라운드 D5):
 *  - 인스펙터에는 프리뷰 스테이지가 아예 없었다. 스테이지는 Space 로 여는 편집 모달에만
 *    있었고, 인스펙터의 `↻ 미리보기 새로고침` 은 프리뷰 없는 패널을 다시 그리는 빈 약속이었다.
 *  - 인스펙터가 열리면 명령 목록 컬럼이 ~34px 로 접혀 글자를 읽을 수 없었다 →
 *    **실측 폭**으로만 잡힌다.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import type { Command, GameEvent, Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";

const AFTER_DIR = ".omo/evidence/screen-fx-3/after";
const EVENT_ID = "ev_screen_fx_inspector";
const PLAY_DURATION_MS = 1200;
/** 명령 요약 한 줄이 읽히는 최소 폭. before 는 ~34px 였다. */
const MIN_COMMAND_LIST_WIDTH = 140;

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

function screenEffectCommand(fields: Record<string, unknown>): Command {
  const entry = M2_COMMAND_CATALOG.find((row) => row.title === "Screen Effect");
  if (!entry) throw new Error("카탈로그에 Screen Effect 가 없다");
  return { kind: "m2Command", commandId: entry.id, fields } as unknown as Command;
}

function fxProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error(`시작 맵을 찾을 수 없다: ${project.startMapId}`);
  const commands: Command[] = [
    screenEffectCommand({ effect: "fadeOut", value: "", durationMs: PLAY_DURATION_MS }),
    screenEffectCommand({ effect: "tint", value: "#39ff14", durationMs: 600 }),
  ];
  const event = {
    id: EVENT_ID,
    x: 4,
    y: 5,
    trigger: { kind: "action" },
    commands,
    pages: [
      {
        id: `${EVENT_ID}_page`,
        name: `${EVENT_ID}_page`,
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands,
      },
    ],
  } as unknown as GameEvent;
  map.events = [event];
  return project;
}

async function openCommandList(page: Page): Promise<void> {
  await seedProjectForEditor(page, fxProject());
  const skip = page.getByRole("button", { name: "건너뛰기" });
  if (await skip.count()) await skip.click();
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await page.getByTestId(`event-list-row-${EVENT_ID}`).click();
  await page.getByTestId("event-editor-open").click();
  const listToggle = page.getByTestId("event-view-toggle-list");
  if (await listToggle.count()) await listToggle.click();
  await expect(page.getByTestId("event-command-m2Command").first()).toBeVisible({ timeout: 20_000 });
}

test.beforeEach(async ({ page }) => {
  await mkdir(AFTER_DIR, { recursive: true });
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
});

test("계약: 한 번 클릭한 화면 효과 행의 인스펙터가 프리뷰를 갖고, 명령 목록은 읽을 수 있는 폭을 유지한다", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !/Failed to load resource/u.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openCommandList(page);

  const commandsColumn = page.locator(".event-editor-commands-column");
  const beforeWidth = (await commandsColumn.boundingBox())?.width ?? 0;
  expect(beforeWidth, "인스펙터 열기 전 명령 목록 폭").toBeGreaterThan(MIN_COMMAND_LIST_WIDTH);

  // 한 번 클릭 = 인스펙터 경로(더블클릭은 편집 모달).
  await page.getByTestId("event-command-m2Command").first().locator(".cmd-head").click();
  const inspector = page.getByTestId("event-editor-inspector");
  await expect(inspector).toBeVisible({ timeout: 20_000 });

  // D5-1: 인스펙터도 편집 모달과 같은 스테이지를 갖는다.
  const stage = inspector.getByTestId("ecp-screen-effect-stage");
  await expect(stage).toBeVisible({ timeout: 20_000 });
  const overlay = inspector.getByTestId("ecp-screen-effect-overlay");
  const overlayBox = await overlay.boundingBox();
  expect(overlayBox?.width ?? 0, "인스펙터 오버레이 실측 폭").toBeGreaterThan(80);
  expect(overlayBox?.height ?? 0, "인스펙터 오버레이 실측 높이").toBeGreaterThan(60);
  await page.screenshot({ path: `${AFTER_DIR}/inspector-stage.png` });

  // D5-3: 인스펙터가 열려도 명령 목록은 읽을 수 있는 폭을 유지한다(before ~34px).
  const openWidth = (await commandsColumn.boundingBox())?.width ?? 0;
  expect(openWidth, `인스펙터 열린 뒤 명령 목록 폭 ${openWidth}px`).toBeGreaterThanOrEqual(
    MIN_COMMAND_LIST_WIDTH
  );
  const summaryBox = await page
    .getByTestId("event-command-m2Command")
    .first()
    .locator(".cmd-head")
    .boundingBox();
  expect(summaryBox?.width ?? 0, "명령 행 실측 폭").toBeGreaterThanOrEqual(MIN_COMMAND_LIST_WIDTH);

  // D5-2: 재생이 인스펙터 안에서 실제로 동작한다.
  const play = inspector.getByTestId("ecp-screen-effect-play");
  await expect(play).toBeVisible();
  await play.click();
  const startOpacity = await overlay.evaluate((node) => Number(getComputedStyle(node).opacity));
  await page.screenshot({ path: `${AFTER_DIR}/inspector-playing.png` });
  await expect(stage).toHaveAttribute("data-play-state", "idle", { timeout: PLAY_DURATION_MS + 10_000 });
  const endOpacity = await overlay.evaluate((node) => Number(getComputedStyle(node).opacity));
  expect(endOpacity - startOpacity, `재생 ${startOpacity} → ${endOpacity}`).toBeGreaterThan(0.3);

  // D5-1(b): 새로고침이 빈 패널을 그리지 않는다.
  await inspector.getByTestId("event-inspector-preview-restart").click();
  await expect(inspector.getByTestId("ecp-screen-effect-stage")).toBeVisible();
  await expect(inspector.getByTestId("ecp-screen-effect-play")).toBeVisible();
  await page.screenshot({ path: `${AFTER_DIR}/inspector-refreshed.png` });

  expect(consoleErrors, `콘솔 에러: ${consoleErrors.join(" | ")}`).toEqual([]);
  expect(pageErrors, `페이지 예외: ${pageErrors.join(" | ")}`).toEqual([]);
});

test("계약: 화면 효과 편집 모달은 의도 카드와 시간 프리셋 칩을 갖고, 값 입력은 효과에 따라 숨는다", async ({
  page,
}) => {
  await openCommandList(page);
  await page.getByTestId("event-command-m2Command").first().locator(".cmd-head").click();
  await page.keyboard.press("Space");
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible({ timeout: 20_000 });

  // D6: 의도 카드 + 시간 프리셋 칩.
  const intent = dialog.getByTestId("m2-screen-effect-intent");
  await expect(intent).toBeVisible();
  await expect(intent).toContainText("어두워");
  await dialog.getByTestId("m2-screen-effect-duration-slow").click();
  await expect(dialog.getByTestId("m2-command-durationMs-input")).toHaveValue("1600");
  await expect(intent).toContainText("1600ms");
  await page.screenshot({ path: `${AFTER_DIR}/modal-intent-presets.png` });

  // D9: fadeOut 은 값을 읽지 않는다 → 값 행이 보이지 않는다.
  await expect(dialog.getByTestId("m2-screen-effect-value-field")).toBeHidden();
  await dialog.getByTestId("m2-command-effect-option-select").selectOption("tint");
  await expect(dialog.getByTestId("m2-screen-effect-value-field")).toBeVisible();
  await expect(intent).toContainText("색조");
  await page.screenshot({ path: `${AFTER_DIR}/modal-tint-value-visible.png` });

  // D9: 뭉뚱그린 부분 실행 경고가 화면 효과 행에 붙지 않는다.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  const issueBadge = page.getByTestId("event-command-issue-badge-0");
  if (await issueBadge.count()) {
    await expect(issueBadge).not.toHaveAttribute("title", /일부 효과만/u);
  }
});
