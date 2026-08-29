import { expect, test, type Locator, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

/**
 * 「AI로 명령 만들기」 도크의 사용 계약. LLM 엔드포인트를 목으로 갈아끼워 생성 → 검토 → 삽입까지
 * 실제 브라우저에서 끝까지 태운다. 자격증명 없이 돌아야 하므로 `/v1/chat/completions` 를 가로챈다.
 */
const MOCK_COMMANDS: readonly Command[] = [
  { kind: "text", body: "나무 상자를 열었다.", speaker: "" } as Command,
  { kind: "wait", ms: 500 } as Command,
  { kind: "setSelfSwitch", key: "A", value: true } as Command,
];

test.setTimeout(180_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-event-ai-command-dock");
    window.localStorage.setItem("oprn:editor-ui-mode", "standard");
  });
});

function probeProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("blank project has no start map");
  const commands: Command[] = [
    { kind: "text", body: "나무 상자를 열어본다.", speaker: "" } as Command,
    { kind: "text", body: "잠겨 있다.", speaker: "" } as Command,
  ];
  const page: EventPage = {
    id: "p1",
    name: "상자",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  map.events = [{ id: "ev_ai_dock", x: 4, y: 4, pages: [page], commands } as (typeof map.events)[number]];
  return project;
}

async function openDock(page: Page, project: Project): Promise<Locator> {
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
  await expect(editor.getByTestId("event-command-quick-ai")).toHaveAttribute("aria-expanded", "true");
  return editor;
}

test("열린 도크는 반복 재렌더 뒤에도 단일 스택 항목과 선택 삽입 대상을 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const project = probeProject();
  const editor = await openDock(page, project);

  await editor.locator(".cmd-item .cmd-head").first().click();
  await expect(editor.getByTestId("ai-event-target")).toContainText("나무 상자를 열어본");

  for (let index = 0; index < 4; index += 1) {
    await editor.getByTestId("event-editor-name").fill(`상자 ${index}`);
    await editor.getByTestId("event-editor-name").dispatchEvent("change");
    await expect(editor.getByTestId("ai-event-assist")).toHaveJSProperty("open", true);
    await expect(editor.getByTestId("event-command-quick-ai")).toHaveAttribute("aria-expanded", "true");
    await expect(editor.getByTestId("ai-event-target")).toContainText("나무 상자를 열어본");
  }

  const stack = await page.evaluate(async () => {
    const aiAssist = await import("/src/editor/panels/eventEditor/aiAssist.ts");
    return aiAssist.eventAiDockModalStackForTest();
  });
  expect(stack).toEqual({ entries: 2, live: 2 });
  console.info(`event-ai-dock stack measurement: ${JSON.stringify(stack)}`);
});

test("툴바 버튼, 도크 summary, Escape 모두 aria-expanded를 실제 상태와 맞춘다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const editor = await openDock(page, probeProject());
  const button = editor.getByTestId("event-command-quick-ai");
  const dock = editor.getByTestId("ai-event-assist");

  await dock.locator(":scope > summary").click();
  await expect(dock).toHaveJSProperty("open", false);
  await expect(button).toHaveAttribute("aria-expanded", "false");

  await dock.locator(":scope > summary").click();
  await expect(dock).toHaveJSProperty("open", true);
  await expect(button).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(dock).toHaveJSProperty("open", false);
  await expect(button).toHaveAttribute("aria-expanded", "false");

  await button.click();
  await expect(dock).toHaveJSProperty("open", true);
  await expect(button).toHaveAttribute("aria-expanded", "true");
});

test("같은 map/event/page ids를 가진 새 프로젝트에 이전 초안과 열린 상태가 나타나지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const projectA = probeProject();
  projectA.meta.title = "Project A";
  const editorA = await openDock(page, projectA);
  await editorA.getByTestId("ai-event-input").fill("Project A confidential draft");
  await expect(editorA.getByTestId("ai-event-input")).toHaveValue("Project A confidential draft");
  await editorA.getByTestId("event-editor-modal-close").click();
  await expect(editorA).toHaveCount(0);

  const projectB = probeProject();
  projectB.meta.title = "Project B";
  await page.evaluate(async ({ project, mapId }) => {
    const [{ store }, modalModule] = await Promise.all([
      import("/src/project/store.ts"),
      import("/src/editor/panels/eventEditor/modal.ts"),
    ]);
    await store.loadNewRemoteProject(project, { title: project.meta.title });
    modalModule.openEventEditorModal(mapId, "ev_ai_dock");
  }, { project: projectB, mapId: projectB.startMapId });

  const editorB = page.getByTestId("event-editor-modal");
  await expect(editorB).toBeVisible();
  await editorB.getByTestId("event-view-toggle-list").click();
  await expect(editorB.getByTestId("ai-event-assist")).toHaveJSProperty("open", false);
  await expect(editorB.getByTestId("event-command-quick-ai")).toHaveAttribute("aria-expanded", "false");
  await editorB.getByTestId("event-command-quick-ai").click();
  await expect(editorB.getByTestId("ai-event-input")).toHaveValue("");
  console.info("event-ai-dock project isolation measurement: open=false draftLength=0");
});

test("AI 명령 도크는 생성한 초안을 실제로 명령 목록에 넣는다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let llmCalls = 0;
  await page.route("**/v1/chat/completions", async (route) => {
    llmCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{ message: { role: "assistant", content: JSON.stringify(MOCK_COMMANDS) } }],
      }),
    });
  });

  const project = probeProject();
  const editor = await openDock(page, project);
  const rows = editor.locator(".event-contents-fieldset .cmd-list [data-cmd-path]");
  await expect(rows).toHaveCount(2);

  await expect(editor.getByTestId("ai-event-input")).toBeFocused();
  await editor.getByTestId("ai-event-input").fill("보물상자를 열면 잠금 기억을 켠다");
  await editor.getByTestId("ai-event-input").press("Control+Enter");

  const preview = editor.getByTestId("ai-event-preview");
  await expect(preview.locator(".ai-event-preview-line")).toHaveCount(MOCK_COMMANDS.length);
  expect(llmCalls).toBe(1);
  await expect(editor.getByTestId("ai-event-chip-status")).toHaveText(`초안 ${MOCK_COMMANDS.length}개`);

  await expect(editor.getByTestId("ai-event-target")).toHaveText("맨 아래에 이어서 넣습니다");
  await expect(editor.getByTestId("ai-event-insert")).toHaveText("맨 아래에 넣기");

  await editor.getByTestId("ai-event-insert").click();
  await expect(rows).toHaveCount(2 + MOCK_COMMANDS.length);
  await expect(editor.getByTestId("ai-event-preview")).toBeHidden();
});

test("선택한 명령이 있으면 도크가 그 뒤에 넣겠다고 말하고 실제로 그 뒤에 넣는다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/v1/chat/completions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{ message: { role: "assistant", content: JSON.stringify([MOCK_COMMANDS[0]]) } }],
      }),
    });
  });

  const project = probeProject();
  const editor = await openDock(page, project);
  await editor.locator(".cmd-item .cmd-head").first().click();
  await expect(editor.getByTestId("ai-event-target")).toContainText("다음에 넣습니다");
  await expect(editor.getByTestId("ai-event-insert")).toHaveText("선택한 명령 다음에 넣기");

  await editor.getByTestId("ai-event-input").fill("문이 열렸다고 말한다");
  await editor.getByTestId("ai-event-generate").click();
  await expect(editor.getByTestId("ai-event-preview").locator(".ai-event-preview-line")).toHaveCount(1);
  await editor.getByTestId("ai-event-insert").click();

  const bodies = await editor.locator(".event-contents-fieldset .cmd-list [data-cmd-path]").allInnerTexts();
  expect(bodies.length).toBe(3);
  expect(bodies[1]).toContain("나무 상자를 열었다.");
});

test("지난 오류는 다시 입력하면 사라지고, Escape 는 도크만 닫는다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const project = probeProject();
  const editor = await openDock(page, project);
  const status = editor.getByTestId("ai-event-status");

  await editor.getByTestId("ai-event-generate").click();
  await expect(status).toHaveText("무엇을 하는 이벤트인지 한 줄 적어 주세요.");
  await expect(status).toHaveClass(/error/);

  await editor.getByTestId("ai-event-input").fill("상자를 연다");
  await expect(status).toHaveText("");
  await expect(editor.getByTestId("ai-event-chip-status")).toHaveText("작성 중");

  await page.keyboard.press("Escape");
  await expect(editor.getByTestId("ai-event-assist")).toHaveJSProperty("open", false);
  await expect(editor.getByTestId("event-command-quick-ai")).toHaveAttribute("aria-expanded", "false");
  await expect(editor).toBeVisible();

  // 두 번째 Escape 는 그때서야 이벤트 에디터에 닿는다.
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
});

test("예시 칩은 프롬프트를 채우기만 하고 생성을 부르지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let llmCalls = 0;
  await page.route("**/v1/chat/completions", async (route) => {
    llmCalls += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [] }) });
  });

  const project = probeProject();
  const editor = await openDock(page, project);
  await editor.getByTestId("ai-event-example-0").click();
  await expect(editor.getByTestId("ai-event-input")).toBeFocused();
  expect((await editor.getByTestId("ai-event-input").inputValue()).length).toBeGreaterThan(10);
  expect(llmCalls).toBe(0);
});
