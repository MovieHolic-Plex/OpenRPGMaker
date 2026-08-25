import { expect, test, type Page, type Route } from "@playwright/test";

const TILESET_ID = "easyrpg_chipset_combined_town";

async function openKnowledgeWorkspace(page: Page): Promise<void> {
  await page.goto("/?freshProject=1");
  const coachSkip = page.getByTestId("coach-mark-skip");
  if (await coachSkip.isVisible()) await coachSkip.click();
  await page.getByTestId("menu-tools").click();
  await page.getByTestId("menu-tools-database").click();
  await page.getByTestId("db-tab-tilesets").click();
  await page.getByTestId("tileset-section-tab-knowledge").click();
  await page.getByTestId("tileset-edit-mode-group").click();
  if (await coachSkip.isVisible()) await coachSkip.click();
  await expect(page.getByTestId("tileset-knowledge-template-water-autotile-3x3")).toBeVisible();
}

function installAiRoute(page: Page, onPrompt: (prompt: PromptShape) => void): Promise<void> {
  return page.route("**/fake-ai/chat/completions", async (route) => fulfillAnalysis(route, onPrompt));
}

async function fulfillAnalysis(route: Route, onPrompt: (prompt: PromptShape) => void): Promise<void> {
  const body: unknown = route.request().postDataJSON();
  const prompt = readPrompt(body);
  if (prompt) onPrompt(prompt);
  const columns = prompt?.tileset?.tilesPerRow ?? 12;
  const answer = {
    summary: "칩셋에서 반복 절벽과 상위 레이어 나무 후보를 찾았습니다.",
    proposals: [
      {
        confidence: 0.96,
        description: "2×3 블록을 가로·세로로 반복할 수 있는 절벽",
        evidence: "두 열과 세 행의 경계 조각이 같은 간격으로 반복됩니다.",
        name: "AI 반복 절벽",
        passage: { down: false, left: false, right: false, up: false },
        placementRules: "2×3 단위를 양방향으로 반복",
        question: "이 6칸은 가로와 세로로 모두 반복되는 2×3 절벽인가요?",
        quickReplies: ["가로·세로 모두 반복", "가로로만 반복"],
        template: "repeatable-cliff-2x3",
        tileIds: [0, 1, columns, columns + 1, columns * 2, (columns * 2) + 1],
      },
      {
        cellLayers: ["upper", "upper", "lower", "lower"],
        confidence: 0.68,
        description: "윗부분은 상위, 줄기는 하위에 놓이는 나무 후보",
        evidence: "세로 실루엣은 분명하지만 줄기 경계를 한 번 확인해야 합니다.",
        name: "AI 레이어 나무",
        passage: { down: false, left: false, right: false, up: false },
        placementRules: "수관은 상위 레이어, 줄기는 하위 레이어",
        question: "이 4칸은 위쪽 수관만 상위 레이어에 놓이는 나무가 맞나요?",
        quickReplies: ["네, 수관은 전부 상위예요", "전체가 상위 레이어예요"],
        template: "tree",
        tileIds: [3, 4, columns + 3, columns + 4],
      },
      {
        confidence: 0.42,
        description: "가로로 긴 가구처럼 보이지만 용도를 확정하기 어렵습니다.",
        evidence: "다리가 있는 가로형 실루엣이지만 책상과 선반을 구분하기 어렵습니다.",
        name: "용도 미확인 가구",
        passage: { down: false, left: false, right: false, up: false },
        placementRules: "상위 레이어에 한 덩어리로 배치",
        question: "이 가구는 책상인가요, 선반인가요?",
        quickReplies: ["책상이에요", "선반이에요", "잘 모르겠어요"],
        template: "desk",
        tileIds: [6, 7],
      },
    ],
  };
  await new Promise((resolve) => setTimeout(resolve, 250));
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }),
    status: 200,
  });
}

type PromptShape = {
  readonly humanFeedback?: readonly string[];
  readonly tileset?: { readonly tilesPerRow?: number };
};

function readPrompt(body: unknown): PromptShape | null {
  if (!body || typeof body !== "object" || !("messages" in body)) return null;
  const messages = body.messages;
  if (!Array.isArray(messages)) return null;
  const user = messages.find((message) => message && typeof message === "object" && "role" in message && message.role === "user");
  if (!user || typeof user !== "object" || !("content" in user)) return null;
  const content = user.content;
  const text = Array.isArray(content)
    ? content.find((part) => part && typeof part === "object" && "type" in part && part.type === "text")
    : null;
  if (!text || typeof text !== "object" || !("text" in text) || typeof text.text !== "string") return null;
  const parsed: unknown = JSON.parse(text.text);
  return parsed && typeof parsed === "object" ? parsed as PromptShape : null;
}

test("opens a separate conversational AI workspace and only applies confirmed knowledge", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:ai-config", JSON.stringify({
      apiKey: "e2e-key",
      authMode: "apiKey",
      baseUrl: "/fake-ai",
      model: "cpen/gpt-5-6-luna",
    }));
  });
  const prompts: PromptShape[] = [];
  await installAiRoute(page, (prompt) => prompts.push(prompt));
  await openKnowledgeWorkspace(page);

  await expect(page.getByTestId("tileset-ai-review-inbox")).toHaveCount(0);
  await expect(page.getByTestId("tileset-knowledge-template-water-autotile-3x3")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("tileset-human-editor-1280x800.png"), fullPage: true });

  await page.getByTestId("tileset-ai-workspace-open").click();
  const workspace = page.getByTestId("tileset-ai-workspace");
  await expect(workspace).toBeVisible();
  await expect(workspace).toHaveAttribute("data-state", "analyzing");
  await expect(workspace).toHaveAttribute("data-step", "analyze");
  await expect(page.getByTestId("tileset-ai-workspace-analyze")).toBeVisible();
  const modalBox = await workspace.boundingBox();
  expect(modalBox?.width ?? 0).toBeGreaterThan(1040);
  expect(modalBox?.height ?? 0).toBeGreaterThan(650);
  await page.screenshot({ path: testInfo.outputPath("tileset-ai-workspace-analyzing-1280x800.png"), fullPage: true });

  await expect(workspace).toHaveAttribute("data-step", "questions");
  await expect(page.getByTestId("tileset-ai-workspace-question")).toContainText("위쪽 수관만 상위 레이어");
  await expect(page.getByTestId("tileset-ai-workspace-next")).toContainText("용도 미확인 가구");
  await expect(page.getByTestId("tileset-ai-workspace-apply")).toHaveCount(0);
  await expect(page.getByTestId("tileset-ai-workspace-to-summary")).toBeVisible();
  await expect.poll(() => page.getByTestId("tileset-ai-workspace-host").evaluate((host) =>
    Array.from(document.body.children)
      .filter((element) => element !== host)
      .every((element) => element instanceof HTMLElement && element.inert),
  )).toBe(true);
  await page.getByTestId("tileset-ai-workspace-close").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".tileset-ai-workspace button:not([disabled])").first()).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByTestId("tileset-ai-workspace-close")).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("tileset-ai-workspace-question-1280x800.png"), fullPage: true });
  await page.setViewportSize({ width: 1536, height: 1024 });
  await expect(workspace).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("tileset-ai-workspace-reference-size-1536x1024.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });

  const namesBeforeApply = await projectGroupNames(page);
  expect(namesBeforeApply).not.toContain("AI 반복 절벽");
  await page.getByTestId("tileset-ai-workspace-quick-0").click();
  await expect.poll(() => prompts.at(-1)?.humanFeedback ?? []).toContain(
    "AI 레이어 나무: 네, 수관은 전부 상위예요",
  );
  await expect(page.locator(".tileset-ai-chat-bubble.user").filter({ hasText: "네, 수관은 전부 상위예요" })).toBeVisible();
  await expect(page.getByTestId("tileset-ai-workspace-question")).toContainText("책상인가요, 선반인가요");
  await expect(page.getByTestId("tileset-ai-workspace-question")).toBeFocused();
  await expect(page.getByTestId("tileset-ai-workspace-apply")).toHaveCount(0);
  await expect(page.getByTestId("tileset-ai-workspace-to-summary")).toBeVisible();
  expect(await projectGroupNames(page)).not.toContain("AI 레이어 나무");
  await page.screenshot({ path: testInfo.outputPath("tileset-ai-workspace-conversation-1280x800.png"), fullPage: true });

  await page.getByTestId("tileset-ai-workspace-discard").click();
  await expect(page.getByTestId("tileset-ai-workspace-question")).toHaveCount(0);
  await expect(page.getByTestId("tileset-ai-workspace-finish")).toBeVisible();
  await page.getByTestId("tileset-ai-workspace-finish-goto-summary").click();
  await expect(workspace).toHaveAttribute("data-step", "summary");
  await expect(page.getByTestId("tileset-ai-summary-item-ai-review-tree-4-2")).toBeVisible();
  await page.getByTestId("tileset-ai-workspace-apply").click();
  await expect.poll(() => projectGroupNames(page)).toEqual(expect.arrayContaining(["AI 반복 절벽", "AI 레이어 나무"]));
  await expect(page.getByTestId("tileset-ai-workspace-status")).toContainText("적용했습니다");

  await page.setViewportSize({ width: 900, height: 800 });
  await expect(workspace).toBeVisible();
  const finalRowGeometry = await page.locator(".tileset-ai-next-question").evaluate((latest) => {
    const scroll = latest.closest(".tileset-ai-conversation-scroll");
    if (!(scroll instanceof HTMLElement)) return { visible: false };
    const latestBox = latest.getBoundingClientRect();
    const scrollBox = scroll.getBoundingClientRect();
    return {
      clientHeight: scroll.clientHeight,
      latestBottom: latestBox.bottom,
      latestHeight: latestBox.height,
      latestTop: latestBox.top,
      scrollBottom: scrollBox.bottom,
      scrollHeight: scroll.scrollHeight,
      scrollTop: scroll.scrollTop,
      scrollTopEdge: scrollBox.top,
      visible: latestBox.top >= scrollBox.top && latestBox.bottom <= scrollBox.bottom,
    };
  });
  expect(finalRowGeometry.visible, JSON.stringify(finalRowGeometry)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("tileset-ai-workspace-applied-900x800.png"), fullPage: true });
  await page.getByTestId("tileset-ai-workspace-close").click();
  await expect(workspace).toHaveCount(0);
  await expect(page.getByTestId("tileset-ai-workspace-open")).toBeFocused();
  await expect(page.getByTestId("tileset-knowledge-template-water-autotile-3x3")).toBeVisible();
});

async function projectGroupNames(page: Page): Promise<readonly string[]> {
  return page.getByTestId("project-export-json").evaluate((element, tilesetId) => {
    const parsed = JSON.parse(element.textContent ?? "{}");
    const groups = parsed.project?.tilesets?.[tilesetId]?.tileGroups ?? [];
    return groups.flatMap((group: { name?: string }) => typeof group.name === "string" ? [group.name] : []);
  }, TILESET_ID);
}
