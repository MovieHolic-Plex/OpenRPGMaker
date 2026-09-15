import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { firefox } from "playwright";

// Isolated settings surface: real form/styles, no editor boot or project writes.
const output = resolve("output/evidence/image-options");
const port = Number(process.env.DEV_SERVER_PORT || 39159);
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false, resolve: { alias: { "@": resolve("src") } },
  server: { host: "127.0.0.1", port, strictPort: true },
});
let browser;
const observations = [];
try {
  await server.listen();
  browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();
  await page.route("**/auth/**", (route) => route.fulfill({ json: { connected: false } }));
  await page.route("**/__image-options-qa", (route) => route.fulfill({
    contentType: "text/html",
    body: '<html lang="ko"><head><meta charset="utf-8"></head><body><script type="module">import "/src/styles/index.css"; import {openAiSettingsModal} from "/src/editor/panels/aiSettingsModal.ts"; window.openSettings = openAiSettingsModal; openAiSettingsModal(); await document.fonts.ready; console.log("image-options-ready");</script></body></html>',
  }));
  for (const [width, height] of [[1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    const ready = page.waitForEvent("console", { predicate: (message) => message.text() === "image-options-ready", timeout: 30000 });
    await page.goto("http://127.0.0.1:" + port + "/__image-options-qa");
    await ready;
    const section = page.getByTestId("ai-settings-section-image");
    await section.scrollIntoViewIfNeeded();
    const geometry = await section.evaluate((element) => {
      const body = document.querySelector('[data-testid="ai-settings-body"]');
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, bodyClientWidth: body.clientWidth, bodyScrollWidth: body.scrollWidth };
    });
    assert(geometry.left >= 0 && geometry.right <= width);
    assert(geometry.bodyScrollWidth <= geometry.bodyClientWidth);
    await page.screenshot({ path: resolve(output, width + "-default.png") });
    const providerTrigger = page.locator('[data-custom-select-for="ai-config-image-provider"]');
    await providerTrigger.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const selected = await page.evaluate(() => JSON.parse(localStorage.getItem("oprn:ai-config")));
    assert.equal(selected.imageProviderId, "openai-codex");
    assert.equal(selected.imageModel, "codex-image-default");
    assert.equal(selected.providerId, "google-antigravity");
    assert.equal(await page.getByTestId("ai-config-image-status").getAttribute("data-availability"), "supported");
    await page.getByTestId("ai-auth-quick-openai-codex").click();
    const afterChat = await page.evaluate(() => JSON.parse(localStorage.getItem("oprn:ai-config")));
    assert.equal(afterChat.imageProviderId, selected.imageProviderId);
    assert.equal(afterChat.imageModel, selected.imageModel);
    await page.getByTestId("ai-settings-close").click();
    await page.evaluate(() => window.openSettings());
    await section.scrollIntoViewIfNeeded();
    assert.equal(await page.getByTestId("ai-config-image-model").inputValue(), "codex-image-default");
    await page.screenshot({ path: resolve(output, width + "-codex-default.png") });
    const wire = [];
    await page.route("**/v1/images/generations", async (route) => {
      const selection = { provider: route.request().headers()["x-oprn-provider"], model: route.request().postDataJSON().model };
      wire.push(selection);
      if (selection.model === "codex-image-default") {
        await route.fulfill({ json: { image: { dataUrl: "data:image/png;base64,AAAA", provider: selection.provider, model: "gpt-image-2" } } });
      } else {
        await route.fulfill({ status: 409, json: { error: "unsupported-test-route" } });
      }
    });
    const generated = await page.evaluate(async () => {
      const { generateAiImage } = await import("/src/ai/imageGenerationClient.ts");
      const image = await generateAiImage({ prompt: "routing check" });
      return { provider: image.provider, model: image.model };
    });
    assert.deepEqual(generated, { provider: "openai-codex", model: "gpt-image-2" });
    await page.getByTestId("ai-settings-close").click();
    await page.evaluate(() => {
      const config = JSON.parse(localStorage.getItem("oprn:ai-config"));
      localStorage.setItem("oprn:ai-config", JSON.stringify({ ...config, imageModel: "gpt-image-1" }));
      window.openSettings();
    });
    await section.scrollIntoViewIfNeeded();
    assert.equal(await page.getByTestId("ai-config-image-model").inputValue(), "gpt-image-1");
    assert.equal(await page.getByTestId("ai-config-image-status").getAttribute("data-availability"), "unsupported");
    await page.screenshot({ path: resolve(output, width + "-unsupported.png") });
    const rejected = await page.evaluate(async () => {
      const { generateAiImage } = await import("/src/ai/imageGenerationClient.ts");
      try { await generateAiImage({ prompt: "routing check" }); return false; }
      catch (error) { return error.status === 409; }
    });
    assert(rejected);
    assert.deepEqual(wire, [
      { provider: "openai-codex", model: "codex-image-default" },
      { provider: "openai-codex", model: "gpt-image-1" },
    ]);
    observations.push({ width, height, geometry, wire, supportedDefault: true, preservedUnsupported: true, keyboardSelection: true, persistedAfterReopen: true });
    await page.unroute("**/v1/images/generations");
    await page.evaluate(() => localStorage.clear());
  }
  await writeFile(resolve(output, "browser-observations.json"), JSON.stringify(observations, null, 2));
  console.log(JSON.stringify({ passed: true, viewports: observations.length, output }));
} finally {
  await browser?.close();
  await server.close();
}
