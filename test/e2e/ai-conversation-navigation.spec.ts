import { expect, test, type Locator, type Page } from "@playwright/test";
import { Agent, get } from "node:http";

interface Camera {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

declare global {
  interface Window {
    __oprnEditCamera?: () => Camera;
    conversationScrollEnded: Promise<boolean>;
    cancelConversationScroll: () => void;
    conversationNavigationEvent?: KeyboardEvent;
  }
}

async function measure(page: Page) {
  return page.getByTestId("ai-chat-log").evaluate(node => ({
    top: node.scrollTop,
    height: node.clientHeight,
    scrollHeight: node.scrollHeight,
    camera: window.__oprnEditCamera?.(),
    target: window.conversationNavigationEvent?.target instanceof HTMLElement
      ? window.conversationNavigationEvent.target.dataset.testid || window.conversationNavigationEvent.target.tagName : null,
    prevented: window.conversationNavigationEvent?.defaultPrevented,
  }));
}

async function armScroll(target: Locator) {
  await target.evaluate(node => {
    window.conversationScrollEnded = new Promise(resolve => {
      const timer = setTimeout(() => finish(false), 5_000);
      function finish(ended: boolean) {
        clearTimeout(timer);
        node.removeEventListener("scrollend", done);
        resolve(ended);
      }
      function done(event: Event) {
        if (event.target === node) finish(true);
      }
      window.cancelConversationScroll = () => finish(false);
      node.addEventListener("scrollend", done);
    });
  });
}

async function navigate(page: Page, target: Locator, key: string, direction: "up" | "down") {
  const log = page.getByTestId("ai-chat-log");
  const before = await measure(page);
  await armScroll(log);
  await target.press(key);
  const ended = await page.evaluate(() => window.conversationScrollEnded);
  const after = await measure(page);
  await test.info().attach(`native-${key}-${after.target}`, {
    body: JSON.stringify({ key, before, after, scrollend: ended }, null, 2), contentType: "application/json",
  });
  expect(after.camera).toEqual(before.camera);
  expect(after.prevented).toBe(false);
  expect(ended, `${key} must produce native scrollend`).toBe(true);
  if (direction === "down") expect(after.top).toBeGreaterThan(before.top);
  else expect(after.top).toBeLessThan(before.top);
}

for (const owner of ["region", "descendant"] as const) {
test(`conversation navigation hands ${owner} focus directly back to the clicked map`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({ agentMode: "chat" }));
    window.addEventListener("keydown", event => { window.conversationNavigationEvent = event; });
  });
  // Optional unchanged static-GET relay for shared-host Chromium netlink failures.
  // No retry, idle socket reuse, altered UI response, or production server reuse.
  if (process.env.E2E_STATIC_RELAY === "1") {
    const origin = new URL(test.info().project.use.baseURL!).origin;
    const agent = new Agent({ keepAlive: false, maxSockets: 8 });
    page.once("close", () => agent.destroy());
    await page.route(`${origin}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() !== "GET" || !(url.pathname === "/" || /^\/(src|assets|@vite|@id|@fs|node_modules)\//.test(url.pathname))) return route.fallback();
      const response = await new Promise<{ status: number; headers: Record<string, string>; body: Buffer }>((resolve, reject) => {
        const request = get(url, { agent }, (incoming) => {
          const chunks: Buffer[] = [];
          incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
          incoming.once("error", reject);
          incoming.once("end", () => resolve({ status: incoming.statusCode!, headers: Object.fromEntries(Object.entries(incoming.headers).filter((entry): entry is [string, string] => typeof entry[1] === "string")), body: Buffer.concat(chunks) }));
        });
        request.once("error", reject);
        request.setTimeout(60_000, () => request.destroy(new Error(`Static GET timeout: ${url.pathname}`)));
      });
      await route.fulfill(response);
    });
  }
  await page.route("**/rest/v1/**", route => route.fulfill({ json: [] }));
  await page.route("**/__oprn/ai-activity", route => route.fulfill({ json: { ok: true } }));
  const transcript = Array.from({ length: 40 }, (_, i) => `NAVIGATION-PARAGRAPH-${i}: Read this conversation without moving the map camera.`).join("\n\n");
  await page.route("**/v1/chat/completions", async route => {
    const request = route.request().postDataJSON();
    const content = request.tools?.length ? transcript : JSON.stringify({ action: "direct", reason: "read-only conversation" });
    if (request.stream) {
      await route.fulfill({ contentType: "text/event-stream", body: `data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n` });
    } else await route.fulfill({ json: { choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] } });
  });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  await guest.or(page.getByTestId("ai-input")).first().waitFor({ state: "visible", timeout: 60_000 });
  if (await guest.isVisible()) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const instruction = "NAVIGATION_TRANSCRIPT";
  const completed = page.waitForRequest(request => request.url().endsWith("/__oprn/ai-activity")
    && request.method() === "POST" && request.postDataJSON().instruction === instruction
    && request.postDataJSON().result?.stoppedReason !== undefined, { timeout: 60_000 });
  await page.getByTestId("ai-input").fill(instruction);
  await page.getByTestId("ai-send").click();
  expect((await completed).postDataJSON().result.stoppedReason).toBe("final");
  const log = page.getByTestId("ai-chat-log");
  await expect(log).toContainText("NAVIGATION-PARAGRAPH-39");
  await log.focus();
  await expect(log).toBeFocused();
  // Settle the reset before arming the first navigation action. Never let the
  // previous scroll's completion accidentally satisfy the next key's promise.
  if ((await measure(page)).top > 0) {
    await armScroll(log);
    await log.press("Control+Home");
    expect(await page.evaluate(() => window.conversationScrollEnded)).toBe(true);
  }
  const initial = await measure(page);
  expect(initial.top).toBe(0);
  expect(initial.scrollHeight).toBeGreaterThan(initial.height * 2);
  expect(initial.camera).toBeDefined();

  for (const [key, direction] of [
    ["ArrowDown", "down"], ["ArrowUp", "up"],
    ["PageDown", "down"], ["PageUp", "up"],
    ["End", "down"], ["Home", "up"],
    ["Space", "down"], ["Shift+Space", "up"],
    ["Control+End", "down"], ["Control+Home", "up"],
  ] as const) await navigate(page, log, key, direction);

  // Shift+Arrow extends native selection rather than guaranteeing scrolling.
  // The editor must still yield it instead of performing its 16-tile fast pan.
  for (const key of ["Shift+ArrowDown", "Shift+ArrowUp", "ArrowLeft", "ArrowRight"]) {
    const before = await measure(page);
    await log.press(key);
    const after = await measure(page);
    expect(after.camera).toEqual(before.camera);
    expect(after.prevented).toBe(false);
    await test.info().attach(`native-${key}`, {
      body: JSON.stringify({ key, before, after }, null, 2), contentType: "application/json",
    });
  }

  // A real rendered conversation action, not an injected keyboard handler.
  const descendant = log.locator("button").first();
  await descendant.evaluate(node => node.focus({ preventScroll: true }));
  await expect(descendant).toBeFocused();
  await navigate(page, descendant, "ArrowDown", "down");
  await test.info().attach("conversation-navigation", { body: await page.screenshot(), contentType: "image/png" });

  // No composer detour: clicking the real canvas must release either the log
  // itself or its focused action, even though Phaser's canvas is not focusable.
  const focused = owner === "region" ? log : descendant;
  await focused.evaluate(node => node.focus({ preventScroll: true }));
  await expect(focused).toBeFocused();
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const width = await canvas.evaluate(node => node.clientWidth);
  await canvas.click({ position: { x: width - 20, y: 20 } });
  const conversationStillFocused = await log.evaluate(node => node.contains(document.activeElement));
  const beforeCanvas = await measure(page);
  // On regression the key scrolls the log; await that exact completion before
  // measuring. On success it is prevented by map panning, so cancel the wait.
  await armScroll(log);
  await page.keyboard.press("ArrowDown");
  await page.evaluate(() => {
    if (window.conversationNavigationEvent?.defaultPrevented) window.cancelConversationScroll();
    return window.conversationScrollEnded;
  });
  const afterCanvas = await measure(page);
  await test.info().attach("canvas-negative-control", {
    body: JSON.stringify({ owner, conversationStillFocused, beforeCanvas, afterCanvas }, null, 2), contentType: "application/json",
  });
  expect(afterCanvas.camera?.scrollY).toBe((beforeCanvas.camera?.scrollY ?? NaN) + 96);
  expect(afterCanvas.camera?.scrollX).toBe(beforeCanvas.camera?.scrollX);
  expect(afterCanvas.top).toBe(beforeCanvas.top);
  expect(afterCanvas.prevented).toBe(true);
  expect(conversationStillFocused).toBe(false);
});
}
