import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AiBridgeTurnResult } from "../../src/editor/aiAssistantBridge";

// Playwright normally forces focus and disables timer throttling, hiding this defect.
test.use({
  launchOptions: {
    args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
    ignoreDefaultArgs: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
    ],
  },
});

for (const hidden of [false, true]) {
  test(`AI completes tools while ${hidden ? "hidden" : "unfocused"}, with paint and fallback timers stalled`, async ({ page, context }) => {
    test.setTimeout(120_000);
    const evidence = path.resolve("output/evidence/assistant-background");
    mkdirSync(evidence, { recursive: true });
    // Fetch dev modules through Playwright's Node transport. Host netlink changes
    // otherwise cancel Chromium's module graph with ERR_NETWORK_CHANGED mid-boot.
    await page.route("http://127.0.0.1:*/**", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({ response: await route.fetch({ maxRetries: 2 }) });
    });
    await page.addInitScript(() => {
      localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
      localStorage.setItem("oprn:editor-welcome-dismissed", "1");
      localStorage.setItem("oprn:standard-welcome-seen", "1");
      localStorage.setItem("oprn:coachmarks-basic-v1", "1");
      localStorage.setItem("oprn:ai-config", JSON.stringify({ configVersion: 2, agentMode: "chat" }));
    });
    // This exercises editor scheduling with scripted read-only tools; no live LLM or DB writes.
    await page.route("**/auth/status?*", (route) => route.fulfill({
      json: { connected: true, authKind: "oauth", expired: false, env: false },
    }));
    await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
    const toolNames = ["get_project_summary", "find_events", "list_resources"];
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });
    let requestSeen!: () => void;
    const firstRequest = new Promise<void>((resolve) => { requestSeen = resolve; });
    let rounds = 0;
    await page.route("**/v1/chat/completions", async (route) => {
      const body = route.request().postDataJSON() as { tools?: unknown[] };
      if (!body.tools?.length) {
        // Intent declaration and any planner call precede the actual tool round.
        await route.fulfill({ json: { choices: [{ finish_reason: "stop", message: {
          role: "assistant", content: JSON.stringify({
            mode: "question", space: "none", needsPlan: false, tools: toolNames,
            action: "direct", reason: "프로젝트 현황 조회", summary: "프로젝트 현황 조회",
          }),
        } }] } });
        return;
      }
      if (rounds++ === 0) {
        requestSeen();
        await responseGate;
        await route.fulfill({ json: { choices: [{ finish_reason: "tool_calls", message: {
          role: "assistant", content: "프로젝트와 이벤트, 리소스를 확인합니다.",
          tool_calls: toolNames.map((name, index) => ({
            id: `background_${index}`, type: "function", function: {
              name,
              arguments: JSON.stringify({
                reason: "프로젝트 현황을 조회합니다.",
                ...(name === "list_resources" ? { kind: "bgm", query: "마을" } : {}),
              }),
            },
          })),
        } }] } });
      } else {
        await route.fulfill({ json: { choices: [{ finish_reason: "stop", message: {
          role: "assistant", content: "백그라운드 조회를 완료했습니다.",
        } }] } });
      }
    });
    await page.goto("/?blankProject=1&aiBridge=0", { waitUntil: "domcontentloaded" });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible()) await guest.click();
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => page.evaluate(() => Boolean(window.__oprnAiBridge))).toBe(true);

    // Begin through the real panel session, hold the model response, then move focus away.
    await page.evaluate(() => {
      const state = window as typeof window & { backgroundTurn?: AiBridgeTurnResult };
      void window.__oprnAiBridge!.send("get_project_summary, find_events, list_resources로 현황을 조회해줘").then((result) => {
        state.backgroundTurn = result;
      });
    });
    await firstRequest;
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    const cover = await context.newPage();
    await cover.goto("about:blank");
    await cover.bringToFront();
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(false);

    // Reproduce a fully stalled paint queue and a minute-delayed timer without waiting
    // five minutes for Chromium intensive throttling. The message task queue stays real.
    await page.evaluate((hide) => {
      if (hide) Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      const raf = window.requestAnimationFrame;
      const cancelRaf = window.cancelAnimationFrame;
      const timeout = window.setTimeout;
      const pendingFrames = new Map<number, FrameRequestCallback>();
      let frameId = 0;
      const state = window as typeof window & { restoreBackgroundProbe?: () => void };
      window.requestAnimationFrame = (callback) => {
        pendingFrames.set(--frameId, callback);
        return frameId;
      };
      window.cancelAnimationFrame = (id) => {
        if (!pendingFrames.delete(id)) cancelRaf(id);
      };
      window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) =>
        timeout(handler, delay === 50 ? 60_000 : delay, ...args)) as typeof window.setTimeout;
      state.restoreBackgroundProbe = () => {
        window.requestAnimationFrame = raf;
        window.cancelAnimationFrame = cancelRaf;
        window.setTimeout = timeout;
        if (hide) Reflect.deleteProperty(document, "visibilityState");
        // Resume the paused Phaser/UI loops before capturing the restored surface.
        for (const callback of pendingFrames.values()) raf(callback);
        pendingFrames.clear();
      };
    }, hidden);
    releaseResponse();
    try {
      await expect.poll(() => page.evaluate(() => {
        const state = window as typeof window & { backgroundTurn?: AiBridgeTurnResult };
        return state.backgroundTurn?.lastAssistantText;
      }), { timeout: 15_000, intervals: [100, 250] }).toBe("백그라운드 조회를 완료했습니다.");
      const result = await page.evaluate(() => ({
        focused: document.hasFocus(),
        visibility: document.visibilityState,
        turn: (window as typeof window & { backgroundTurn: AiBridgeTurnResult }).backgroundTurn,
      }));
      expect(result.focused).toBe(false);
      expect(result.turn.ok).toBe(true);
      expect(result.turn.status.turnBusy).toBe(false);
      expect(result.turn.audit.filter((entry) => entry.kind === "tool" && entry.ok).map((entry) => entry.name)).toEqual(toolNames);
      writeFileSync(path.join(evidence, `${hidden ? "hidden" : "unfocused"}.json`), JSON.stringify(result, null, 2));
    } finally {
      await page.evaluate(() => (window as typeof window & { restoreBackgroundProbe?: () => void }).restoreBackgroundProbe?.());
      await cover.close();
      await page.bringToFront();
      await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    }
    await page.screenshot({ path: path.join(evidence, `${hidden ? "hidden" : "unfocused"}.png`) });
  });
}
