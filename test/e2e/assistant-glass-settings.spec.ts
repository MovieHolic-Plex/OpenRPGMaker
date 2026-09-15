import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { Agent, get } from "node:http";
import path from "node:path";

const EVIDENCE = path.resolve("output/evidence/assistant-clean-glass/phase-2");
const KEY = "oprn:ai-background-opacity";
const VIEWPORTS = [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }];
const PROMOTIONS = '.ai-quick-reply-chip, .ai-composer-chip, .ai-suggest-row, .ai-authoring-example-chip, .ai-start-visual-gallery, [data-testid="ai-studio-suggest"]';
const SENTINEL = "GLASS-P2-TRANSCRIPT-END";
const TRANSCRIPT = [
  ...Array.from({ length: 36 }, (_, i) => `GLASS-P2-PARAGRAPH-${i}: 지도와 대화를 함께 확인합니다. This is an actual assistant response retained by the conversation store.`),
  "```text\n" + "WIDE_CODE_".repeat(90) + "\n```",
  `| ${Array.from({ length: 24 }, (_, i) => `Column_${i}`).join(" | ")} |\n| ${Array(24).fill("---").join(" | ")} |\n| ${Array.from({ length: 24 }, (_, i) => `Value_${i}`).join(" | ")} |`,
  SENTINEL,
].join("\n\n");
type Log = unknown[];
type Background = { name: string; rgb: number[] };

async function ready(page: Page) {
  const guest = page.getByTestId("login-guest");
  await guest.or(page.getByTestId("ai-input")).first().waitFor({ state: "visible", timeout: 120_000 });
  if (await guest.isVisible()) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
}

async function boot(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({ agentMode: "chat" }));
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
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/__oprn/ai-activity", (route) => route.fulfill({ json: { ok: true } }));
  await page.goto("/?blankProject=1", { waitUntil: "commit" });
  await ready(page);
  await expect(page.getByTestId("ai-input")).toBeVisible();
}

async function noPromotions(page: Page) {
  await expect(page.locator(PROMOTIONS)).toHaveCount(0);
  await expect(page.getByTestId("ai-suggest-popover")).toBeHidden();
}

async function screenshot(page: Page, name: string, log: Log) {
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`), animations: "disabled" });
  log.push({ action: "screenshot", name, viewport: page.viewportSize(), url: page.url() });
}

async function measure(page: Page, backgrounds: Background[]) {
  return page.evaluate((backgrounds) => {
    const deck = document.querySelector<HTMLElement>(".ai-deck")!;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const rgba = (color: string) => {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
      const pixel = Array.from(ctx.getImageData(0, 0, 1, 1).data);
      return [pixel[0]!, pixel[1]!, pixel[2]!, pixel[3]! / 255];
    };
    const over = (fg: number[], bg: number[]) => fg.slice(0, 3).map((v, i) => v * fg[3]! + bg[i]! * (1 - fg[3]!));
    const luminance = (rgb: number[]) => rgb.map(v => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const ratio = (a: number[], b: number[]) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const deckStyle = getComputedStyle(deck);
    // Read shipped foreground colors, not injected test styles. All leaf text in the
    // deck is included, including offscreen transcript/code/table content.
    const texts = Array.from(deck.querySelectorAll<HTMLElement>("*"))
      .filter(node => node.getClientRects().length && !node.closest("[hidden], button:disabled") && (node.matches("textarea") || Array.from(node.childNodes).some(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())));
    const samples = texts.map(node => {
      const chain: HTMLElement[] = [];
      for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) { chain.unshift(parent); if (parent === deck) break; }
      const style = getComputedStyle(node);
      const layers = chain.map(parent => getComputedStyle(parent));
      const opacity = layers.reduce((v, layer) => v * Number(layer.opacity), 1);
      const color = rgba(style.color);
      const contrasts = backgrounds.map(background => {
        // Composite opacity groups as well as background alpha. Comparing raw text
        // color alone would incorrectly pass a faded but still enabled action.
        const paint = (index: number, backdrop: number[], withText: boolean): number[] => {
          if (index === layers.length) return withText ? over(color, backdrop) : backdrop;
          const layer = layers[index]!;
          const painted = paint(index + 1, over(rgba(layer.backgroundColor), backdrop), withText);
          return over([...painted, Number(layer.opacity)], backdrop);
        };
        const composited = paint(0, background.rgb, false);
        return { background: background.name, composited, ratio: ratio(paint(0, background.rgb, true), composited) };
      });
      return { tag: node.tagName, class: node.className, text: node.textContent?.trim().slice(0, 70), color: style.color, opacity, fontSize: style.fontSize, contrasts };
    });
    const log = document.querySelector<HTMLElement>('[data-testid="ai-chat-log"]')!;
    const input = document.querySelector<HTMLElement>('[data-testid="ai-input"]')!;
    const rect = (node: HTMLElement) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
    return { background: deckStyle.backgroundColor, rgba: rgba(deckStyle.backgroundColor), deckOpacity: deckStyle.opacity, backdropFilter: deckStyle.backdropFilter, token: document.querySelector<HTMLElement>(".ai-chat-panel")!.style.getPropertyValue("--ai-background-opacity"), samples, minContrast: Math.min(...samples.flatMap(sample => sample.contrasts.map(c => c.ratio))), viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollX, scrollY }, deck: rect(deck), composer: rect(input), log: { ...rect(log), clientHeight: log.clientHeight, scrollHeight: log.scrollHeight, scrollTop: log.scrollTop, clientWidth: log.clientWidth, scrollWidth: log.scrollWidth, overflowY: getComputedStyle(log).overflowY } };
  }, backgrounds);
}

async function focusEvidence(control: Locator, log: Log) {
  await expect(control).toBeFocused();
  const state = await control.evaluate(node => {
    const s = getComputedStyle(node);
    return { testid: (node as HTMLElement).dataset.testid, name: node.getAttribute("aria-label") || node.getAttribute("title"), focusVisible: node.matches(":focus-visible"), outline: s.outline, outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle, boxShadow: s.boxShadow };
  });
  log.push({ action: "keyboard-focus", state });
  expect(state.focusVisible).toBe(true);
  expect((state.outlineStyle !== "none" && parseFloat(state.outlineWidth) > 0) || state.boxShadow !== "none").toBe(true);
}

async function settings(page: Page) {
  await page.getByTestId("topbar-ai-settings").click();
  await page.getByTestId("ai-settings-tab-display").click();
  const slider = page.getByRole("slider", { name: "배경 농도", exact: true });
  await expect(slider).toBeVisible();
  // The native range must participate in the modal's actual Tab order.
  await page.getByTestId("ai-font-size").focus();
  await page.keyboard.press("Tab");
  await expect(slider).toBeFocused();
  return slider;
}

async function keyOpacity(page: Page, slider: Locator, key: string, value: number, log: Log) {
  await slider.press(key);
  await expect(slider).toHaveValue(String(value));
  await expect(page.getByTestId("ai-background-opacity-value")).toHaveText(`${value}%`);
  const immediate = await page.evaluate((key) => ({ storage: localStorage.getItem(key), token: document.querySelector<HTMLElement>(".ai-chat-panel")!.style.getPropertyValue("--ai-background-opacity"), background: getComputedStyle(document.querySelector(".ai-deck")!).backgroundColor }), KEY);
  log.push({ action: "native-range-key", key, value, immediate });
  expect(immediate.storage).toBe(String(value));
  expect(immediate.token).toBe(`${value}%`);
}

async function scrollAction(page: Page, target: Locator, action: () => Promise<void>) {
  // Subscribe before the native action; await its exact settled scroll event.
  await target.evaluate(node => {
    const state = window as unknown as { glassScroll: Promise<void> };
    state.glassScroll = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { node.removeEventListener("scrollend", done); reject(new Error("Missing native scrollend")); }, 10_000);
      function done() { clearTimeout(timer); resolve(); }
      node.addEventListener("scrollend", done, { once: true });
    });
  });
  await action();
  await page.evaluate(() => (window as unknown as { glassScroll: Promise<void> }).glassScroll);
}

async function longConversation(page: Page, log: Log) {
  const instruction = "GLASS_P2_LONG_TRANSCRIPT";
  await page.route("**/v1/chat/completions", async route => {
    const request = route.request().postDataJSON();
    const content = request.tools?.length ? TRANSCRIPT : JSON.stringify({ action: "direct", reason: "read-only conversation" });
    log.push({ action: "mock-model-transport", hasTools: Boolean(request.tools?.length), stream: request.stream });
    if (request.stream === true) {
      await route.fulfill({ contentType: "text/event-stream", body: `data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n` });
    } else await route.fulfill({ json: { choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] } });
  });
  const done = page.waitForRequest(request => request.url().endsWith("/__oprn/ai-activity") && request.method() === "POST" && request.postDataJSON().instruction === instruction && request.postDataJSON().result?.stoppedReason !== undefined, { timeout: 60_000 });
  await page.getByTestId("ai-input").fill(instruction);
  await page.getByTestId("ai-send").click();
  const result = (await done).postDataJSON().result;
  log.push({ action: "actual-turn-settled", result });
  expect(result.stoppedReason).toBe("final");
  expect(result.appliedCalls).toBe(0);
  await expect(page.getByTestId("ai-chat-log")).toContainText(SENTINEL);
  await expect(page.locator('[data-testid="ai-work-plan-checklist"], [data-testid="ai-plan-book"], [data-testid="ai-autonomous-feed"]')).toHaveCount(0);
  await noPromotions(page);
}

async function scrollMatrix(page: Page, id: string, log: Log, backgrounds: Background[]) {
  const conversation = page.getByTestId("ai-chat-log");
  const before = await measure(page, backgrounds);
  expect(before.log.scrollHeight).toBeGreaterThan(before.log.clientHeight * 2);
  await conversation.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const focusedTop = await conversation.evaluate(node => node.scrollTop);
  if (focusedTop > 0) await scrollAction(page, conversation, () => conversation.press("Control+Home"));
  await focusEvidence(conversation, log);
  const top = await measure(page, backgrounds);
  expect(top.log.scrollTop).toBe(0);
  await screenshot(page, `${id}-scroll-top`, log);
  await scrollAction(page, conversation, () => conversation.press("Control+End"));
  const bottom = await measure(page, backgrounds);
  expect(bottom.log.scrollTop + bottom.log.clientHeight).toBeGreaterThanOrEqual(bottom.log.scrollHeight - 1);
  expect(bottom.viewport.scrollX).toBe(top.viewport.scrollX);
  expect(bottom.viewport.scrollY).toBe(top.viewport.scrollY);
  expect(bottom.composer).toEqual(top.composer);
  expect(bottom.composer.bottom).toBeLessThanOrEqual(bottom.viewport.height);
  expect(bottom.viewport.scrollWidth).toBeLessThanOrEqual(bottom.viewport.width);
  log.push({ action: "independent-native-conversation-scroll", top, bottom });
  for (const selector of ["pre", "table"]) {
    const wide = conversation.locator(selector).last();
    const count = await wide.count();
    expect.soft(count, `${id}: actual transcript must render ${selector}`).toBe(1);
    if (count === 0) {
      log.push({ action: "missing-rendered-wide-content", selector, count });
      continue; // The soft assertion above fails the suite; preserve other evidence.
    }
    await wide.scrollIntoViewIfNeeded();
    const dimensions = await wide.evaluate(node => ({ scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, overflowX: getComputedStyle(node).overflowX, left: node.scrollLeft }));
    log.push({ action: "wide-content-before", selector, dimensions });
    expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
    expect(dimensions.overflowX).toBe("auto");
    const box = (await wide.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await scrollAction(page, wide, () => page.mouse.wheel(600, 0));
    const left = await wide.evaluate(node => node.scrollLeft);
    expect(left).toBeGreaterThan(dimensions.left);
    log.push({ action: "native-horizontal-wheel", selector, left });
  }
  await page.getByTestId("ai-input").click();
  await page.getByTestId("ai-input").fill("GLASS_P2_COMPOSER_REACHABLE");
  await expect(page.getByTestId("ai-input")).toHaveValue("GLASS_P2_COMPOSER_REACHABLE");
  await page.getByTestId("ai-input").fill("");
  await screenshot(page, `${id}-scroll-bottom-composer`, log);
}

async function mapBackgrounds(page: Page, id: string, log: Log): Promise<Background[]> {
  await page.getByTestId("ai-collapse").click();
  const image = await page.getByTestId("edit-canvas").screenshot({ path: path.join(EVIDENCE, `${id}-map-background.png`) });
  // Decode an actual map screenshot in an unattached canvas; no app DOM/style mutation.
  const pixels = await page.evaluate(async base64 => {
    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("Map screenshot decode failed")); });
    img.src = `data:image/png;base64,${base64}`;
    await loaded;
    const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(img, 0, 0);
    return [[0.25, 0.25], [0.5, 0.5], [0.75, 0.25]].map(([x, y]) => Array.from(ctx.getImageData(Math.floor(img.width * x!), Math.floor(img.height * y!), 1, 1).data).slice(0, 3));
  }, image.toString("base64"));
  await page.getByTestId("ai-collapsed-restore").click();
  const backgrounds = [...pixels.map((rgb, i) => ({ name: `actual-map-sample-${i}`, rgb })), { name: "dark-bound", rgb: [0, 0, 0] }, { name: "light-bound", rgb: [255, 255, 255] }, { name: "representative-grass", rgb: [65, 120, 45] }, { name: "representative-water", rgb: [40, 90, 160] }, { name: "representative-sand", rgb: [215, 190, 135] }];
  log.push({ action: "map-background-sampling-and-analytical-bounds", backgrounds });
  return backgrounds;
}

test.describe("adjustable assistant glass - real editor", () => {
  test.describe.configure({ timeout: 240_000, retries: 0 });
  test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));
  for (const viewport of VIEWPORTS) {
    test(`functional contrast and scroll matrix ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const id = `${viewport.width}x${viewport.height}`;
      const log: Log = [];
      try {
        await page.setViewportSize(viewport);
        await boot(page);
        await page.getByTestId("ai-input").focus();
        await noPromotions(page);
        const backgrounds = await mapBackgrounds(page, id, log);
        await longConversation(page, log);
        for (const [state, key, value] of [["default", null, 82], ["minimum", "Home", 78], ["opaque", "End", 100]] as const) {
          const slider = await settings(page);
          if (key) await keyOpacity(page, slider, key, value, log);
          else await expect(slider).toHaveValue("82");
          await focusEvidence(slider, log);
          await screenshot(page, `${id}-${state}-settings-focus`, log);
          await page.getByTestId("ai-settings-close").click();
          const measurements = await measure(page, backgrounds);
          log.push({ action: "state-matrix", state, value, measurements });
          expect(measurements.rgba[3]).toBeCloseTo(value / 100, 2);
          expect(measurements.deckOpacity).toBe("1");
          expect(measurements.samples.length).toBeGreaterThan(20);
          // Soft assertions keep the complete evidence matrix while still failing
          // the test for every product defect; there is no skipped acceptance gate.
          expect.soft(measurements.samples.filter(sample => sample.opacity !== 1), `${state}: foreground opacity`).toEqual([]);
          expect.soft(measurements.minContrast, `${state}: normal text contrast`).toBeGreaterThanOrEqual(4.5);
          expect(measurements.viewport.scrollWidth).toBeLessThanOrEqual(viewport.width);
          await screenshot(page, `${id}-${state}-conversation`, log);
        }
        let slider = await settings(page);
        await keyOpacity(page, slider, "ArrowRight", 100, log);
        await keyOpacity(page, slider, "ArrowLeft", 99, log);
        await keyOpacity(page, slider, "Home", 78, log);
        await keyOpacity(page, slider, "ArrowLeft", 78, log);
        await keyOpacity(page, slider, "ArrowRight", 79, log);
        await page.getByTestId("ai-settings-close").click();
        await scrollMatrix(page, `${id}-actual`, log, backgrounds);
        await page.reload({ waitUntil: "commit" });
        await ready(page);
        slider = await settings(page);
        await expect(slider).toHaveValue("79");
        expect((await measure(page, backgrounds)).rgba[3]).toBeCloseTo(0.79, 2);
        await keyOpacity(page, slider, "Home", 78, log);
        await page.getByTestId("ai-settings-close").click();
        await expect(page.getByTestId("ai-chat-log")).toContainText(SENTINEL);
        log.push({ action: "reload-restores-native-preference-and-actual-transcript", value: 79 });
        await scrollMatrix(page, id, log, backgrounds);
        for (const testid of ["ai-new-chat", "ai-open-conversations", "ai-command-menu-toggle", "ai-collapse"]) {
          const button = page.getByTestId(testid);
          await expect(button).toHaveAccessibleName(/\S/);
          await expect(button.locator("svg")).toHaveCount(1);
          await button.focus();
          await page.keyboard.press("Shift+Tab");
          await page.keyboard.press("Tab");
          await focusEvidence(button, log);
        }
        await page.getByTestId("ai-collapse").press("Enter");
        const pill = page.getByTestId("ai-collapsed-restore");
        await expect(pill).toBeVisible();
        const pillStyle = await pill.evaluate(node => ({ opacity: getComputedStyle(node).opacity, background: getComputedStyle(node).backgroundColor }));
        expect(pillStyle.opacity).toBe("1");
        await screenshot(page, `${id}-collapsed`, log);
        await pill.focus(); await pill.press("Enter");
        expect((await measure(page, backgrounds)).token).toBe("78%");
        log.push({ action: "collapse-restore-retains-setting", pillStyle, value: 78 });
        await page.getByTestId("ai-new-chat").press("Enter");
        await page.getByTestId("ai-input").focus(); await noPromotions(page);
        await page.getByTestId("ai-open-conversations").press("Enter");
        const history = page.getByTestId("ai-history-open").filter({ hasText: "GLASS_P2_LONG_TRANSCRIPT" });
        await expect(history).toBeVisible();
        await screenshot(page, `${id}-history`, log);
        await history.click();
        await expect(page.getByTestId("ai-chat-log")).toContainText(SENTINEL);
        await noPromotions(page);
        await scrollMatrix(page, `${id}-history-restored`, log, backgrounds);
        slider = await settings(page);
        await expect(slider).toHaveValue("78");
        await keyOpacity(page, slider, "ArrowRight", 79, log);
        await focusEvidence(slider, log);
        log.push({ action: "matrix-complete", viewport, inheritedNoPresets: true });
      } finally { writeFileSync(path.join(EVIDENCE, `${id}-actions-measurements.json`), JSON.stringify(log, null, 2)); }
    });
  }
  test("malformed stored opacity falls back on real reload", async ({ page }) => {
    const log: Log = [];
    try {
      await boot(page);
      for (const malformed of ["not-a-number", "NaN", "Infinity", "{}", " "]) {
        await page.evaluate(([key, value]) => localStorage.setItem(key!, value!), [KEY, malformed]);
        await page.reload({ waitUntil: "commit" });
        await ready(page);
        const slider = await settings(page);
        await expect(slider).toHaveValue("82");
        const measured = await measure(page, [{ name: "dark-bound", rgb: [0, 0, 0] }]);
        expect(measured.token).toBe("82%");
        expect(measured.rgba[3]).toBeCloseTo(0.82, 2);
        log.push({ action: "malformed-storage-reload-fallback", malformed, background: measured.background, token: measured.token });
        await page.getByTestId("ai-settings-close").click();
      }
      await screenshot(page, "malformed-storage-fallback", log);
    } finally { writeFileSync(path.join(EVIDENCE, "malformed-storage-actions.json"), JSON.stringify(log, null, 2)); }
  });
});
