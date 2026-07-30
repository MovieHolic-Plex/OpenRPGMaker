/* 임시 증거 수집 — 에디터 AI 패널이 실제로 cpen/gemini-3-flash 로 응답하는지. */
import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";

const OUT = "evidence/ai-gemini-proof";

test("에디터 AI 가 cpen/gemini-3-flash 로 응답한다", async ({ page }) => {
  test.setTimeout(240_000);

  // 네트워크 왕복을 그대로 기록한다 — 어떤 모델로, 어디로 갔는지가 증거의 핵심이다.
  const calls: { url: string; status: number; model?: string; reply?: string }[] = [];
  let dumped = false;
  page.on("request", (req) => {
    if (!req.url().includes("chat/completions")) return;
    const post = req.postData() ?? "";
    let shape = "(본문 없음)";
    try {
      const b = JSON.parse(post);
      shape = JSON.stringify({
        model: b.model, stream: b.stream, max_tokens: b.max_tokens,
        messages: Array.isArray(b.messages) ? b.messages.length : null,
        msgChars: Array.isArray(b.messages) ? JSON.stringify(b.messages).length : null,
        tools: Array.isArray(b.tools) ? b.tools.length : 0,
        toolChars: Array.isArray(b.tools) ? JSON.stringify(b.tools).length : 0,
        hasReasoning: b.reasoning !== undefined,
        totalBytes: post.length,
        keys: Object.keys(b),
      });
    } catch { shape = "(JSON 파싱 실패) " + post.slice(0, 200); }
    console.log("REQUEST_SHAPE " + shape);
    if (post && !dumped) {
      dumped = true;
      writeFileSync("evidence/ai-gemini-proof/actual-request.json", post, "utf8");
      console.log("REQUEST_DUMPED evidence/ai-gemini-proof/actual-request.json");
    }
  });
  page.on("response", async (res) => {
    const url = res.url();
    if (!/\/api\/(cpen|qwen|ai)\/|chat\/completions/.test(url)) return;
    const entry: { url: string; status: number; model?: string; reply?: string } = {
      url: url.replace(/^https?:\/\/[^/]+/, ""),
      status: res.status(),
    };
    try {
      const body = await res.json();
      if (typeof body?.model === "string") entry.model = body.model;
      const content = body?.choices?.[0]?.message?.content;
      if (typeof content === "string") entry.reply = content.slice(0, 400);
    } catch {
      const text = await res.text().catch(() => "");
      if (text) entry.reply = "(비JSON) " + text.slice(0, 300);
    }
    calls.push(entry);
  });

  // localStorage 의 기존 설정이 기본값을 덮으므로, 이번 프리셋을 명시적으로 심는다.
  // (apiKey 는 넣지 않는다 — 상대 baseUrl 이면 vite 프록시가 서버에서 Authorization 을 주입한다.)
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    localStorage.setItem(
      "rpg-zzu:ai-config",
      JSON.stringify({
        authMode: "apiKey",
        baseUrl: "/api/cpen",
        model: "cpen/gemini-3-flash",
        liteModel: "cpen/gemini-3-flash",
        apiKey: "",
        maxToolCalls: 4,
        maxTokens: 32768,
        reasoningEffort: "off",
      })
    );
  });
  await page.setViewportSize({ width: 1440, height: 960 });

  await page.goto("/");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 25_000 });

  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await expect(page.getByTestId("ai-command-bar")).toBeVisible({ timeout: 15_000 });

  const input = page.getByTestId("ai-input");
  await input.click();
  await input.fill("한 문장으로만 답해라: 너를 서비스하는 모델 이름이 무엇이냐?");
  await page.screenshot({ path: `${OUT}/01-prompt-typed.png`, fullPage: false });

  const send = page.getByTestId("ai-send");
  await send.click();

  // 응답이 도착할 때까지 기다린다 — 채팅 로그 길이가 늘거나 완성 응답이 잡히면 성공.
  const log = page.getByTestId("ai-chat-log");
  let replyText = "";
  for (let i = 0; i < 110; i += 1) {
    const done = calls.some((c) => c.status === 200 && (c.reply || c.model));
    replyText = (await log.innerText().catch(() => "")) ?? "";
    if (done && replyText.length > 40) break;
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: `${OUT}/02-response.png`, fullPage: false });
  await log.screenshot({ path: `${OUT}/03-chat-log.png` }).catch(() => undefined);

  console.log("NETWORK " + JSON.stringify(calls, null, 2));
  console.log("CHAT_LOG_TEXT >>> " + replyText.slice(0, 900));

  // 증거 단정: cpen 프록시로 갔고, 응답 모델이 gemini 이고, 화면에 글이 늘었다.
  const ok = calls.find((c) => c.status === 200 && c.url.includes("/api/cpen"));
  expect(ok, `cpen 프록시 200 응답이 없다. 관측된 호출: ${JSON.stringify(calls)}`).toBeTruthy();
  expect(ok?.model ?? "", "응답 모델이 gemini 계열이 아니다").toContain("gemini");
  expect(replyText.length, "채팅 로그에 응답 텍스트가 없다").toBeGreaterThan(40);
});
