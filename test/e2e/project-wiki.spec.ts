import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("ordinary dialogue persists sourced wiki and a new chat recalls it", async ({ page }) => {
  test.setTimeout(180_000);
  const output = "output/evidence/project-wiki";
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({ agentMode: "chat", maxToolCalls: 4 }));
  });
  const base = new URL(String(test.info().project.use.baseURL)).origin;
  await page.route(`${base}/**`, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await fetch(route.request().url());
    const headers = Object.fromEntries(response.headers);
    delete headers["content-encoding"]; delete headers["content-length"];
    await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
  });
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  const receivedWikiIds: string[] = [];
  const correction = "전투를 액션 방식으로 바꿔줘";
  let releaseExtraction: (() => void) | undefined;
  const extractionGate = new Promise<void>((resolve) => { releaseExtraction = resolve; });
  let signalExtraction: (() => void) | undefined;
  const extractionStarted = new Promise<void>((resolve) => { signalExtraction = resolve; });
  await page.route("**/v1/chat/completions", async (route) => {
    const request = route.request().postDataJSON();
    const last = request.messages.at(-1)?.content;
    let payload;
    try { payload = typeof last === "string" ? JSON.parse(last) : null; } catch { payload = null; }
    let content: string;
    if (Array.isArray(payload?.sources)) {
      if (payload.userText === correction) {
        signalExtraction?.();
        await extractionGate;
        content = JSON.stringify({ upserts: [{
          id: "w_qa_action", type: "guideline", name: "새 전투", summary: "맵 위 직접 전투",
          wiki: { kind: "declaration", basis: "explicit", combatMode: "action", supersedes: ["w_qa_combat"], sourceIds: [payload.sources.at(-1).id] },
        }] });
      } else {
      const alreadyKnown = payload.currentDocuments.some((document: { id: string }) => document.id === "w_qa_combat");
      content = JSON.stringify({ upserts: alreadyKnown ? [] : [{
        id: "w_qa_combat", type: "guideline", name: "푸른별 전투", summary: "보이는 몬스터와 접촉하면 전투 화면에서 명령을 고른다.",
        body: "왕국 이름은 푸른별이다.",
        wiki: { kind: "declaration", basis: "explicit", combatMode: "contact", sourceIds: [payload.sources.at(-1).id] },
      }] });
      }
    } else if (!request.tools?.length) {
      content = JSON.stringify({
        mode: "question", space: "none", facility: null, targetMapId: null,
        useSelection: false, clarify: null, clarifyOptions: [], needsPlan: false,
        resetsContext: false, tools: [], summary: "위키 확인",
      });
    } else {
      const documents = request.messages.flatMap((message: { content: unknown }) => {
        if (typeof message.content !== "string") return [];
        return message.content.split("\n").flatMap((line: string) => {
          try { const value = JSON.parse(line); return value.id ? [value] : []; } catch { return []; }
        });
      });
      const remembered = documents.find((document: { id: string }) => document.id === "w_qa_combat");
      if (remembered) receivedWikiIds.push(remembered.id);
      content = remembered ? `${remembered.name}: ${remembered.combatMode}` : "기억된 설정 없음";
    }
    if (request.stream) {
      await route.fulfill({ contentType: "text/event-stream", body:
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] })}\n\n` +
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n` });
    } else await route.fulfill({ json: { choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] } });
  });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
  for (const id of ["login-guest", "standard-welcome-start", "coach-mark-skip"]) {
    if (await page.getByTestId(id).isVisible()) await page.getByTestId(id).click();
  }
  const send = async (text: string) => {
    const done = page.waitForRequest((request) => request.url().endsWith("/__oprn/ai-activity")
      && request.method() === "POST" && request.postDataJSON().instruction === text
      && request.postDataJSON().result?.stoppedReason !== undefined, { timeout: 60_000 });
    await page.getByTestId("ai-input").fill(text);
    await page.getByTestId("ai-send").click();
    expect((await done).postDataJSON().result.stoppedReason).toBe("final");
  };

  await send("몬스터에 닿으면 전투 화면에서 명령을 골라 싸우는 게임으로 만들자. 왕국 이름은 푸른별이야.");
  await expect(page.getByTestId("ai-chat-log")).toContainText("푸른별 전투: contact");
  await page.getByTestId("ai-new-chat").click();
  await send("이 게임의 전투 방식과 왕국 이름을 알려줘");
  await expect(page.getByTestId("ai-chat-log")).toContainText("푸른별 전투: contact");
  expect(receivedWikiIds).toEqual(["w_qa_combat", "w_qa_combat"]);
  await page.screenshot({ path: `${output}/new-chat-recall.png` });
  await test.info().attach("recalled-wiki-ids", { body: JSON.stringify(receivedWikiIds), contentType: "application/json" });

  const rejected = page.waitForRequest((request) => request.url().endsWith("/__oprn/ai-activity")
    && request.method() === "POST" && request.postDataJSON().instruction === correction
    && request.postDataJSON().result?.stoppedReason !== undefined, { timeout: 60_000 });
  await page.getByTestId("ai-input").fill(correction);
  await page.getByTestId("ai-send").click();
  await extractionStarted;
  try {
    await page.getByTestId("toolbar-database").click();
    if (!await page.getByTestId("db-tab-world-codex").isVisible()) await page.getByTestId("db-tab-group-lore").click();
    await page.getByTestId("db-tab-world-codex").click();
    await page.locator(".world-card").filter({ hasText: "푸른별 전투" }).click();
    await page.getByTestId("world-edit-toggle").click();
    await page.getByTestId("world-edit-summary").fill("사용자가 직접 확정한 전투 규칙");
    await page.getByTestId("world-edit-save").click();
  } finally { releaseExtraction?.(); }
  expect((await rejected).postDataJSON().result.stoppedReason).toBe("error");
  await expect(page.getByTestId("world-wiki-view")).toContainText("사용자가 직접 확정한 전투 규칙");
  await expect(page.locator(".world-card").filter({ hasText: "새 전투" })).toHaveCount(0);
  await page.screenshot({ path: `${output}/concurrent-manual-edit.png` });
});
