import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";

/**
 * 「AI로 명령 만들기」 도크의 사용 계약. LLM 엔드포인트를 목으로 갈아끼워 생성 → 목록 자리에서
 * 검토 → 적용까지 실제 브라우저에서 끝까지 태운다. 자격증명 없이 돌아야 하므로
 * `/v1/chat/completions` 를 가로챈다.
 *
 * 모델 출력은 «고친 뒤 최종 목록 전체»다(삽입 배열이 아니다). 그래서 목에서도 기존 두 줄을
 * 다시 실어 준다 — 앱이 before/after 를 대조해 무엇이 달라지는지 계산한다.
 */
const EXISTING_COMMANDS: readonly Command[] = [
  { kind: "text", body: "나무 상자를 열어본다.", speaker: "" } as Command,
  { kind: "text", body: "잠겨 있다.", speaker: "" } as Command,
];

const MOCK_ADDED: readonly Command[] = [
  { kind: "text", body: "나무 상자를 열었다.", speaker: "" } as Command,
  { kind: "wait", ms: 500 } as Command,
  { kind: "setSelfSwitch", key: "A", value: true } as Command,
];

/** 기존 두 줄 + 새 세 줄 = 최종 목록. diff 는 keep 2 + add 3 이 된다. */
const MOCK_FINAL: readonly Command[] = [...EXISTING_COMMANDS, ...MOCK_ADDED];

async function mockLlm(page: Page, commands: readonly Command[]): Promise<() => number> {
  let calls = 0;
  await page.route("**/v1/chat/completions", async (route) => {
    calls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{ message: { role: "assistant", content: JSON.stringify(commands) } }],
      }),
    });
  });
  return () => calls;
}

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
  const commands: Command[] = structuredClone(EXISTING_COMMANDS) as Command[];
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
  await seedProjectForEditor(page, project);
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
  // 「삽입 위치」가 아니라 무엇을 하게 되는지를 말한다 — 선택은 이제 삽입 지점이 아니다.
  await expect(editor.getByTestId("ai-event-target")).toHaveText("이 페이지의 명령 목록을 고칩니다");

  for (let index = 0; index < 4; index += 1) {
    await editor.getByTestId("event-editor-name").fill(`상자 ${index}`);
    await editor.getByTestId("event-editor-name").dispatchEvent("change");
    await expect(editor.getByTestId("ai-event-assist")).toHaveJSProperty("open", true);
    await expect(editor.getByTestId("event-command-quick-ai")).toHaveAttribute("aria-expanded", "true");
    await expect(editor.getByTestId("ai-event-target")).toHaveText("이 페이지의 명령 목록을 고칩니다");
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

test("초안은 목록 자리에 유령 행으로 보이고, 적용은 되돌리기 한 번으로 끝난다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const llmCalls = await mockLlm(page, MOCK_FINAL);

  const project = probeProject();
  const editor = await openDock(page, project);
  const rows = editor.locator(".event-contents-fieldset .cmd-list [data-cmd-path]");
  const stagedRows = editor.locator('[data-testid="ai-event-staged"] [data-staged-id]');
  await expect(rows).toHaveCount(2);

  await expect(editor.getByTestId("ai-event-input")).toBeFocused();
  await editor.getByTestId("ai-event-input").fill("상자를 열면 잠금 기억을 켠다");
  await editor.getByTestId("ai-event-input").press("Control+Enter");

  // 초안이 뜨면 목록 자리를 초안이 차지한다 — 별도 카드가 아니라 같은 자리, 같은 카드 모양.
  await expect(editor.getByTestId("ai-event-staged-host")).toBeVisible();
  await expect(editor.locator(".event-contents-fieldset .cmd-list")).toBeHidden();
  await expect(stagedRows).toHaveCount(MOCK_FINAL.length);
  await expect(editor.locator('[data-staged-status="add"][data-staged-id]')).toHaveCount(MOCK_ADDED.length);
  expect(llmCalls()).toBe(1);
  await expect(editor.getByTestId("ai-event-chip-status")).toHaveText(`새로 ${MOCK_ADDED.length}개`);
  await expect(editor.getByTestId("ai-event-target")).toHaveText("이 페이지의 명령 목록을 고칩니다");

  await editor.getByTestId("ai-event-apply").click();
  await expect(editor.getByTestId("ai-event-staged-host")).toBeHidden();
  await expect(rows).toHaveCount(MOCK_FINAL.length);

  // 핵심: 명령 3개가 들어갔어도 되돌리기는 **한 번**이면 된다.
  await editor.getByTestId("event-command-toolbar-undo").click();
  await expect(rows).toHaveCount(2);
  console.info(`event-ai-dock undo measurement: applied=${MOCK_FINAL.length} undoClicks=1 rowsAfterUndo=2`);
});

test("«고쳐 달라»는 요청은 덧붙이지 않고 그 줄을 바뀜으로 표시한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // 둘째 줄 문구만 다른 최종 목록.
  const edited: Command[] = [
    structuredClone(EXISTING_COMMANDS[0]) as Command,
    { kind: "text", body: "굳게 잠겨 있다.", speaker: "" } as Command,
  ];
  await mockLlm(page, edited);

  const editor = await openDock(page, probeProject());
  const rows = editor.locator(".event-contents-fieldset .cmd-list [data-cmd-path]");

  await editor.getByTestId("ai-event-input").fill("둘째 줄 대사를 «굳게 잠겨 있다»로 고쳐 줘");
  await editor.getByTestId("ai-event-generate").click();

  const changeRow = editor.locator('[data-staged-status="change"][data-staged-id]');
  await expect(changeRow).toHaveCount(1);
  // 예전 계약이면 줄이 3개로 늘었다. 지금은 한 줄이 before→after 로 보인다.
  await expect(editor.locator('[data-testid="ai-event-staged"] [data-staged-id]')).toHaveCount(2);
  await expect(changeRow.locator(".cmd-staged-before")).toContainText("잠겨 있다");
  await expect(changeRow.locator(".cmd-staged-after")).toContainText("굳게 잠겨 있다");

  await editor.getByTestId("ai-event-apply").click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("굳게 잠겨 있다");
});

test("행마다 «이건 빼기»로 골라 적용할 수 있다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockLlm(page, MOCK_FINAL);

  const editor = await openDock(page, probeProject());
  const rows = editor.locator(".event-contents-fieldset .cmd-list [data-cmd-path]");

  await editor.getByTestId("ai-event-input").fill("상자를 열면 잠금 기억을 켠다");
  await editor.getByTestId("ai-event-generate").click();
  const addRows = editor.locator('[data-staged-status="add"][data-staged-id]');
  await expect(addRows).toHaveCount(MOCK_ADDED.length);

  // 마지막 추가 한 줄만 뺀다.
  await addRows.last().locator(".cmd-staged-toggle").click();
  await expect(editor.getByTestId("ai-event-chip-status")).toHaveText(`새로 ${MOCK_ADDED.length - 1}개`);

  await editor.getByTestId("ai-event-apply").click();
  await expect(rows).toHaveCount(MOCK_FINAL.length - 1);
  console.info(`event-ai-dock partial apply measurement: offered=${MOCK_ADDED.length} applied=${MOCK_ADDED.length - 1}`);
});

test("제외 토글 뒤 배지와 적용 예정 행 번호가 같은 결과를 말한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockLlm(page, MOCK_FINAL);

  const editor = await openDock(page, probeProject());
  await editor.getByTestId("ai-event-input").fill("상자를 열면 잠금 기억을 켠다");
  await editor.getByTestId("ai-event-generate").click();

  const addRows = editor.locator('[data-staged-status="add"][data-staged-id]');
  await expect(addRows).toHaveCount(MOCK_ADDED.length);
  await addRows.first().locator(".cmd-staged-toggle").click();

  const count = editor.getByTestId("event-editor-command-count");
  const numberedSteps = editor.locator('[data-testid="ai-event-staged"] .cmd-step');
  await expect(count).toHaveText(`${MOCK_FINAL.length - 1}개`);
  await expect(numberedSteps).toHaveText(["1", "2", "3", "4"]);
  const excludedAdd = editor.locator('[data-staged-reverted="true"][data-staged-id]');
  await expect(excludedAdd.locator(".cmd-step")).toHaveCount(0);

  const evidenceDir = "output/evidence/event-do-column/after";
  await mkdir(evidenceDir, { recursive: true });
  await editor.locator(".event-editor-commands-column").screenshot({
    path: `${evidenceDir}/staged-toggle-badge-row-numbers.png`,
  });
  await writeFile(
    `${evidenceDir}/staged-toggle-badge-row-numbers.json`,
    `${JSON.stringify({
      badge: await count.textContent(),
      numberedSteps: await numberedSteps.allTextContents(),
      excludedAddHasNumber: await excludedAdd.locator(".cmd-step").count() > 0,
    }, null, 2)}\n`,
    "utf8",
  );
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
