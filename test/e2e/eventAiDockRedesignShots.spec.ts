import { mkdir } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

/**
 * 보고서용 화면 증거. 기능 검증은 event-ai-command-dock.spec.ts 가 한다 — 여기서는 «사람이 볼
 * 그림» 만 남긴다. 같은 목 응답을 쓰므로 두 스펙의 화면은 같은 상태를 가리킨다.
 */
const SHOT_DIR = "output/evidence/event-ai-dock-redesign";

const EXISTING_COMMANDS: readonly Command[] = [
  { kind: "text", body: "나무 상자를 열어본다.", speaker: "" } as Command,
  { kind: "text", body: "잠겨 있다.", speaker: "" } as Command,
];

const ADDED: readonly Command[] = [
  { kind: "text", body: "나무 상자를 열었다.", speaker: "" } as Command,
  { kind: "wait", ms: 500 } as Command,
  { kind: "setSelfSwitch", key: "A", value: true } as Command,
];

const FINAL_APPEND: readonly Command[] = [...EXISTING_COMMANDS, ...ADDED];

const FINAL_EDIT: readonly Command[] = [
  EXISTING_COMMANDS[0],
  { kind: "text", body: "굳게 잠겨 있다. 열쇠가 있어야 한다.", speaker: "" } as Command,
];

async function mockLlm(page: Page, commands: readonly Command[]): Promise<void> {
  await page.route("**/v1/chat/completions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{ message: { role: "assistant", content: JSON.stringify(commands) } }],
      }),
    });
  });
}

test.setTimeout(180_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-ai-dock-shots");
    window.localStorage.setItem("oprn:editor-ui-mode", "standard");
  });
  await mkdir(SHOT_DIR, { recursive: true });
});

function probeProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("blank project has no start map");
  const commands: Command[] = structuredClone(EXISTING_COMMANDS) as Command[];
  const eventPage: EventPage = {
    id: "p1",
    name: "상자",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  map.events = [
    { id: "ev_ai_dock", x: 4, y: 4, pages: [eventPage], commands } as (typeof map.events)[number],
  ];
  return project;
}

async function openDock(page: Page): Promise<Locator> {
  const project = probeProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await page.evaluate(async (mapId) => {
    const modalModule = await import("/src/editor/panels/eventEditor/modal.ts");
    modalModule.openEventEditorModal(mapId, "ev_ai_dock");
  }, project.startMapId);
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  await editor.getByTestId("event-view-toggle-list").click();
  await editor.getByTestId("event-command-quick-ai").click();
  await expect(editor.getByTestId("ai-event-assist")).toHaveJSProperty("open", true);
  return editor;
}

/** 명령 목록 + 도크가 같이 잡히는 세로 열. 모달 전체보다 글자가 크게 보인다. */
function commandsColumn(editor: Locator): Locator {
  return editor.locator(".event-editor-commands-column");
}

test("after: 도크를 열면 목록은 그대로 남고 프롬프트만 뜬다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const editor = await openDock(page);
  await expect(editor.getByTestId("ai-event-target")).toHaveText("이 페이지의 명령 목록을 고칩니다");
  await expect(editor.getByTestId("ai-event-examples")).toBeVisible();
  await editor.screenshot({ path: `${SHOT_DIR}/after-01-dock-open.png` });
  await commandsColumn(editor).screenshot({ path: `${SHOT_DIR}/after-01b-column.png` });
});

test("after: 새로 넣는 초안은 목록 자리에 유령 행으로 겹쳐 보인다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await mockLlm(page, FINAL_APPEND);
  const editor = await openDock(page);

  await editor.getByTestId("ai-event-input").fill("상자를 열면 «열었다»를 말하고 잠금 기억을 켠다");
  await editor.getByTestId("ai-event-generate").click();
  await expect(editor.locator('[data-staged-status="add"][data-staged-id]')).toHaveCount(ADDED.length);
  await expect(editor.getByTestId("ai-event-chip-status")).toHaveText(`새로 ${ADDED.length}개`);

  await editor.screenshot({ path: `${SHOT_DIR}/after-02-staged-add.png` });
  await commandsColumn(editor).screenshot({ path: `${SHOT_DIR}/after-02b-column.png` });
  await editor.getByTestId("ai-event-staged").screenshot({ path: `${SHOT_DIR}/after-02c-staged-only.png` });

  // 한 줄만 빼면 그 줄에 취소선이 그어지고 개수가 줄어든다.
  await editor.locator('[data-staged-status="add"][data-staged-id]').last().locator(".cmd-staged-toggle").click();
  await expect(editor.getByTestId("ai-event-chip-status")).toHaveText(`새로 ${ADDED.length - 1}개`);
  await editor.getByTestId("ai-event-staged").screenshot({ path: `${SHOT_DIR}/after-03-staged-excluded.png` });
  await commandsColumn(editor).screenshot({ path: `${SHOT_DIR}/after-03b-column.png` });
});

test("after: 고치는 초안은 한 줄 안에서 before→after 로 보인다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await mockLlm(page, FINAL_EDIT);
  const editor = await openDock(page);
  const rows = editor.locator(".event-contents-fieldset .cmd-list [data-cmd-path]");

  await editor.getByTestId("ai-event-input").fill("둘째 줄 대사를 더 단단한 말투로 고쳐 줘");
  await editor.getByTestId("ai-event-generate").click();
  await expect(editor.locator('[data-staged-status="change"][data-staged-id]')).toHaveCount(1);

  await editor.getByTestId("ai-event-staged").screenshot({ path: `${SHOT_DIR}/after-04-staged-change.png` });
  await commandsColumn(editor).screenshot({ path: `${SHOT_DIR}/after-04b-column.png` });

  await editor.getByTestId("ai-event-apply").click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("굳게 잠겨 있다");
  await expect(editor.getByTestId("ai-event-status")).toContainText("되돌리기");
  await editor.screenshot({ path: `${SHOT_DIR}/after-05-applied.png` });
  await commandsColumn(editor).screenshot({ path: `${SHOT_DIR}/after-05b-column.png` });
});

test("after: 3개를 넣어도 되돌리기 한 번이면 원래대로 돌아온다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await mockLlm(page, FINAL_APPEND);
  const editor = await openDock(page);
  const rows = editor.locator(".event-contents-fieldset .cmd-list [data-cmd-path]");

  await editor.getByTestId("ai-event-input").fill("상자를 열면 «열었다»를 말하고 잠금 기억을 켠다");
  await editor.getByTestId("ai-event-generate").click();
  await expect(editor.locator('[data-staged-status="add"][data-staged-id]')).toHaveCount(ADDED.length);
  await editor.getByTestId("ai-event-apply").click();
  await expect(rows).toHaveCount(FINAL_APPEND.length);
  await commandsColumn(editor).screenshot({ path: `${SHOT_DIR}/after-06-applied-5rows.png` });

  await editor.getByTestId("event-command-toolbar-undo").click();
  await expect(rows).toHaveCount(EXISTING_COMMANDS.length);
  await commandsColumn(editor).screenshot({ path: `${SHOT_DIR}/after-07-undo-once.png` });
  console.info(`after undo: applied=${FINAL_APPEND.length} clicks=1 rows=${EXISTING_COMMANDS.length}`);
});
