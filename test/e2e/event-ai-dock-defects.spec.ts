import { expect, test, type Locator, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";

/**
 * 「AI로 명령 만들기」 도크가 **보기 방식과 무관하게** 초안을 보여야 한다는 계약.
 *  1) 보기 방식을 건드리지 않은 기본 상태(스토리)에서 초안이 화면에 보인다.
 *  2) 생성 도중 스토어가 갱신돼 본문이 다시 그려져도 초안이 보인다(명령 영역이 비지 않는다).
 */
const EXISTING_COMMANDS: readonly Command[] = [
  { kind: "text", body: "나무 상자를 열어본다.", speaker: "" } as Command,
  { kind: "text", body: "잠겨 있다.", speaker: "" } as Command,
];

const MOCK_FINAL: readonly Command[] = [
  ...EXISTING_COMMANDS,
  { kind: "text", body: "상자가 열렸다.", speaker: "" } as Command,
  { kind: "setSelfSwitch", key: "A", value: true } as Command,
];

test.setTimeout(180_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-event-ai-dock-defects");
    window.localStorage.setItem("oprn:editor-ui-mode", "standard");
  });
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
  map.events = [{ id: "ev_ai_dock", x: 4, y: 4, pages: [eventPage], commands } as (typeof map.events)[number]];
  return project;
}

async function mockLlm(page: Page, commands: readonly Command[]): Promise<void> {
  await page.route("**/v1/chat/completions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify(commands) } }] }),
    });
  });
}

/** 응답을 브라우저 신호(window.__releaseLlm)까지 붙잡아 두는 목 — 「생성 중」 상태를 만든다. */
async function mockLlmGated(page: Page, commands: readonly Command[]): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __llmGate: Promise<void>; __releaseLlm: () => void }).__llmGate = new Promise<void>(
      (resolve) => {
        (window as unknown as { __releaseLlm: () => void }).__releaseLlm = resolve;
      },
    );
  });
  await page.route("**/v1/chat/completions", async (route) => {
    await page.evaluate(() => (window as unknown as { __llmGate: Promise<void> }).__llmGate);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify(commands) } }] }),
    });
  });
}

async function openDock(page: Page, project: Project): Promise<Locator> {
  await seedProjectForEditor(page, project);
  await page.evaluate(async (mapId) => {
    const modalPath = "/src/editor/panels/eventEditor/modal.ts";
    const modalModule = (await import(modalPath)) as typeof import("@/editor/panels/eventEditor/modal");
    modalModule.openEventEditorModal(mapId, "ev_ai_dock");
  }, project.startMapId);
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  await page.evaluate(() => {
    window.localStorage.setItem(
      "oprn:ai-config",
      JSON.stringify({ version: 2, authMode: "chatgpt", model: "gemini-3.7-flash", liteModel: "gemini-3.7-flash" }),
    );
  });
  const dock = editor.getByTestId("ai-event-assist");
  await dock.getByTestId("ai-event-assist-summary").or(dock.locator("summary")).first().click();
  await expect(editor.getByTestId("ai-event-input")).toBeVisible();
  return editor;
}

test("기본 보기(스토리)에서 만든 초안이 화면에 보인다", async ({ page }) => {
  await mockLlm(page, MOCK_FINAL);
  const project = probeProject();
  await page.goto("/");
  const editor = await openDock(page, project);

  await expect(editor.getByTestId("event-view-toggle-storyboard")).toHaveAttribute("aria-pressed", "true");

  await editor.getByTestId("ai-event-input").fill("상자가 열리면 기억 A를 켜 줘");
  await editor.getByTestId("ai-event-generate").click();
  await expect(editor.getByTestId("ai-event-result")).toBeVisible();

  const stagedHost = editor.getByTestId("ai-event-staged-host");
  await expect(stagedHost).toBeVisible();
  await expect(stagedHost.getByTestId("ai-event-staged")).toBeVisible();
  await expect(stagedHost.locator("[data-testid^='ai-event-staged-row-']").first()).toBeVisible();
});

test("생성 중 본문이 다시 그려져도 초안이 보인다", async ({ page }) => {
  await mockLlmGated(page, MOCK_FINAL);
  const project = probeProject();
  await page.goto("/");
  const editor = await openDock(page, project);
  await editor.getByTestId("event-view-toggle-list").click();

  await editor.getByTestId("ai-event-input").fill("상자가 열리면 기억 A를 켜 줘");
  await editor.getByTestId("ai-event-generate").click();
  await expect(editor.getByTestId("ai-event-status")).toHaveClass(/busy/);

  await page.evaluate(async () => {
    const storePath = "/src/project/store.ts";
    const storeModule = (await import(storePath)) as typeof import("@/project/store");
    storeModule.store.update((draft) => {
      draft.meta.title = `${draft.meta.title} (편집 중)`;
    });
  });
  await page.evaluate(() => (window as unknown as { __releaseLlm: () => void }).__releaseLlm());

  const stagedHost = editor.getByTestId("ai-event-staged-host");
  await expect(stagedHost).toBeVisible();
  await expect(stagedHost.getByTestId("ai-event-staged")).toBeVisible();
  await expect(stagedHost.locator("[data-testid^='ai-event-staged-row-']").first()).toBeVisible();
});
