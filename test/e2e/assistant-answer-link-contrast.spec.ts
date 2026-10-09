import { expect, test, type Locator } from "@playwright/test";
import { Agent, get } from "node:http";

// Run with DEV_SERVER_PORT=9917 E2E_RETRIES=0. Model/persistence transports are mocked;
// the live answer renderer, reference index/decorator, navigation and CSS are shipped code.
const DUPLICATE = "ContrastDuplicate";
const UNIQUE = "ContrastUnique";

async function measure(link: Locator) {
  return link.evaluate(node => {
    const deck = node.closest(".ai-deck")!;
    const chain: Element[] = [];
    for (let parent: Element | null = node; parent; parent = parent.parentElement) {
      chain.unshift(parent);
      if (parent === deck) break;
    }
    // Parse CSS floats directly: a canvas readback would quantize alpha to 8 bits
    // (78% becomes 199/255), which can turn a near-threshold failure into a pass.
    const rgba = (value: string): number[] => {
      const srgb = value.startsWith("color(srgb ");
      if (!srgb && !/^rgba?\(/.test(value)) throw new Error(`Unsupported color: ${value}`);
      const values = value.slice(value.indexOf("(") + 1, -1).replace("srgb", "").match(/[\d.e+-]+/g)!.map(Number);
      return [...values.slice(0, 3).map(v => srgb ? v * 255 : v), values[3] ?? 1];
    };
    const over = (fg: number[], bg: number[]) => fg.slice(0, 3).map((v, i) => v * fg[3]! + bg[i]! * (1 - fg[3]!));
    const lum = (rgb: number[]) => rgb.map(v => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const style = getComputedStyle(node);
    const layers = chain.map(element => {
      const s = getComputedStyle(element);
      if (s.backgroundImage !== "none" || s.filter !== "none" || s.mixBlendMode !== "normal") throw new Error(`Unmodelled paint layer: ${element.className}`);
      return { class: element.className, background: rgba(s.backgroundColor), opacity: Number(s.opacity) };
    });
    const foreground = rgba(style.color);
    const ratios = [0, 255].map(bound => {
      // Uniform black/white remain invariant under the deck's blur/saturation.
      // Include EVERY layer from deck to button, including native hover/focus tint.
      const paint = (i: number, bg: number[], text: boolean): number[] => {
        if (i === layers.length) return text ? over(foreground, bg) : bg;
        const layer = layers[i]!;
        return over([...paint(i + 1, over(layer.background, bg), text), layer.opacity], bg);
      };
      const background = paint(0, [bound, bound, bound], false);
      const ink = paint(0, [bound, bound, bound], true);
      const a = lum(ink), b = lum(background);
      return { bound, background, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
    return { foreground, layers, ratios, fontSize: style.fontSize, opacity: layers.reduce((n, l) => n * l.opacity, 1), underline: style.textDecorationLine, decoration: style.textDecorationStyle, hover: node.matches(":hover"), focus: node.matches(":focus-visible"), backdrop: getComputedStyle(deck).backdropFilter };
  });
}

test("decorated ambiguous answer links retain AA contrast and disambiguation at every glass density", async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
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
  await page.route("**/rest/v1/**", route => route.fulfill({ json: [] }));
  await page.route("**/__oprn/ai-activity", route => route.fulfill({ json: { ok: true } }));
  await page.route("**/v1/chat/completions", async route => {
    const request = route.request().postDataJSON();
    const content = request.tools?.length ? `${DUPLICATE} / ${UNIQUE}` : JSON.stringify({ action: "direct", reason: "read-only conversation" });
    if (request.stream === true) {
      await route.fulfill({ contentType: "text/event-stream", body: `data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n` });
    } else await route.fulfill({ json: { choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] } });
  });
  await page.goto("/?blankProject=1", { waitUntil: "commit" });
  const guest = page.getByTestId("login-guest");
  await guest.or(page.getByTestId("ai-input")).first().waitFor({ state: "visible", timeout: 120_000 });
  if (await guest.isVisible()) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await page.evaluate(async ({ duplicate, unique }) => {
    const modulePath = "/src/project/store.ts";
    const { store } = await import(/* @vite-ignore */ modulePath);
    // Minimal local-only map-name fixture; real indexing must detect the collision.
    store.update((project: import("../../src/project/types").Project) => {
      const map = project.maps[project.startMapId]!;
      map.name = duplicate;
      project.maps.contrast_duplicate = { ...structuredClone(map), id: "contrast_duplicate", name: duplicate };
      project.maps.contrast_unique = { ...structuredClone(map), id: "contrast_unique", name: unique };
    }, { scope: "project", label: "contrast reference fixture" });
  }, { duplicate: DUPLICATE, unique: UNIQUE });
  const instruction = "LINK_CONTRAST_TURN";
  const done = page.waitForRequest(request => request.url().endsWith("/__oprn/ai-activity") && request.method() === "POST" && request.postDataJSON().instruction === instruction && request.postDataJSON().result?.stoppedReason !== undefined, { timeout: 60_000 });
  await page.getByTestId("ai-input").fill(instruction);
  await page.getByTestId("ai-send").click();
  expect((await done).postDataJSON().result.stoppedReason).toBe("final");
  const ambiguous = page.locator('.ai-deck .ai-answer-link[data-ref-kind="ambiguous"]');
  const normal = page.locator('.ai-deck .ai-answer-link[data-ref-kind="map"]');
  await expect(ambiguous).toHaveCount(1);
  await expect(normal).toHaveCount(1);
  await expect(ambiguous).toHaveAttribute("data-ref-label", DUPLICATE);
  const samples: unknown[] = [];
  for (const density of [82, 78, 100]) {
    await page.getByTestId("topbar-ai-settings").click();
    const slider = page.getByRole("slider", { name: "배경 농도", exact: true });
    await expect(slider).toHaveAttribute("min", "78");
    await expect(slider).toHaveAttribute("max", "100");
    if (density === 82) await expect(slider).toHaveValue("82");
    else await slider.press(density === 78 ? "Home" : "End");
    await expect(slider).toHaveValue(String(density));
    await page.getByTestId("ai-settings-close").click();
    for (const [kind, link] of [["ambiguous", ambiguous], ["normal", normal]] as const) {
      await expect(link).toBeVisible();
      await expect(link).toBeEnabled();
      await expect(link).toHaveAttribute("type", "button");
      for (const state of ["rest", "hover", "focus"] as const) {
        await page.mouse.move(0, 0);
        await page.getByTestId("ai-chat-log").focus();
        if (state === "hover") await link.hover();
        if (state === "focus") {
          await (kind === "ambiguous" ? normal : ambiguous).focus();
          await page.keyboard.press(kind === "ambiguous" ? "Shift+Tab" : "Tab");
          await expect(link).toBeFocused();
        }
        const sample = await measure(link);
        samples.push({ density, kind, state, ...sample });
        expect(sample.hover).toBe(state === "hover");
        expect(sample.focus).toBe(state === "focus");
        expect(sample.opacity).toBe(1);
        expect(sample.fontSize).toBe("14px");
        expect(sample.underline).toBe("underline");
        expect(sample.decoration).toBe(state === "rest" ? "dotted" : "solid");
        expect(sample.backdrop).toBe("blur(20px) saturate(1.08)");
        expect(sample.layers[0]!.background[3]).toBe(density / 100);
        expect(sample.layers.at(-1)!.background[3]).toBe(state === "rest" ? 0 : 0.12);
        if (kind === "normal") expect(sample.foreground).toEqual([47, 58, 174, 1]);
        for (const bound of sample.ratios) expect.soft(bound.ratio, `${density}% ${kind} ${state} over ${bound.bound}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // Actual click opens the real chooser with BOTH collision candidates, not a mock callback.
    await ambiguous.click();
    await expect(page.getByTestId("map-event-search-modal")).toBeVisible();
    await expect(page.getByTestId("map-event-search-input")).toHaveValue(DUPLICATE);
    await expect(page.locator('[data-testid^="map-event-search-result-"]')).toHaveCount(2);
    await page.getByTestId("map-event-search-close").click();
    await expect(ambiguous).toBeVisible();
    await normal.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(ambiguous).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("map-event-search-input")).toHaveValue(DUPLICATE);
    await page.getByTestId("map-event-search-close").click();
  }
  await info.attach("layered-link-contrast", { body: JSON.stringify(samples, null, 2), contentType: "application/json" });
  await page.screenshot({ path: info.outputPath("answer-links.png") });
});
