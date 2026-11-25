import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, firefox } from "@playwright/test";
import { runRuntimeQa, startPlayerQaServer } from "../scripts/lib/runtimeQaRun.mjs";
import { audioDescriptionsScenario } from "../scripts/qa/runtime/audio-descriptions.scenario.mjs";

test("fails playback evidence when the real local SE cannot load", { timeout: 180000 }, async () => {
  // Given
  const projectFixture = process.env.AUDIO_QA_PROJECT;
  const outDir = process.env.AUDIO_QA_FAILURE_OUT;
  assert.ok(projectFixture);
  assert.ok(outDir);
  const browserName = process.env.AUDIO_QA_BROWSER ?? "chromium";
  assert.ok(["chromium", "firefox"].includes(browserName));
  const browserType = browserName === "firefox" ? firefox : chromium;
  const server = await startPlayerQaServer();
  console.log(JSON.stringify({ qaFailureBrowser: browserName, qaFailurePort: server.port }));
  try {
    const browser = await browserType.launch({
      headless: true,
      args: browserName === "chromium" ? ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] : [],
    });
    try {
      const page = await browser.newPage();
      await page.route("**/assets/cc0/audio/ui-confirm.wav", (route) => route.abort("failed"));
      // When
      const report = await runRuntimeQa(page, {
        ...audioDescriptionsScenario,
        projectFixture,
      }, { serverUrl: server.url, outDir });
      // Then
      const bgm = report.beats.find((beat) => beat.id === "starter-bgm-playing");
      const se = report.beats.find((beat) => beat.id === "local-se-playing");
      assert.ok(bgm);
      assert.ok(se);
      assert.deepEqual(bgm.failures, []);
      assert.equal(bgm.audio?.[0]?.playing?.trusted, true);
      assert.ok(se.failures.length > 0);
      assert.equal(se.audio?.[0]?.playing, null);
      assert.match(se.audio?.[0]?.error ?? "", /^media-error:/);
      assert.equal(se.shot, "03-local-se-playing.png");
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
    console.log(JSON.stringify({ qaFailureCleanup: true, qaFailurePort: server.port }));
  }
});
