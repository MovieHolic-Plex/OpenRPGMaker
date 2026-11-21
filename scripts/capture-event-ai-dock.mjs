import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { eventAiFixture, mockEventAi } from "./lib/event-ai-fixture.mjs";
import { gotoWithRetry } from "./lib/goto-retry.mjs";

const [phase, output = "output/evidence/event-ai-inline-assist"] = process.argv.slice(2);
if (phase !== "before" && phase !== "after") {
  throw new Error("Usage: node scripts/capture-event-ai-dock.mjs before|after [output-dir]");
}

const baseURL = "http://127.0.0.1:9495";
const original = [
  { kind: "text", body: "나무 상자를 살펴본다." },
  { kind: "text", body: "상자는 잠겨 있다." },
  { kind: "wait", ms: 1000 },
];
const generated = [
  original[0],
  { kind: "text", body: "철제 자물쇠가 굳게 잠겨 있다." },
  { kind: "setSelfSwitch", key: "A", value: true },
];
const prompt = "기다리기를 빼고, 잠겨 있다는 대사를 다듬은 뒤 이벤트 기억 A를 켜 줘.";
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });

try {
  await mkdir(output, { recursive: true });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    const page = await browser.newPage({ baseURL, viewport, locale: "ko-KR" });
    page.setDefaultTimeout(60_000);
    const { project, target } = eventAiFixture(original, { name: "잠긴 상자" });
    await page.addInitScript(project => {
      window.__OPRN_E2E_PROJECT__ = project;
      localStorage.setItem("oprn:editor-ui-mode", "standard");
    }, project);

    let modelStarted;
    let releaseModel;
    const modelRequested = new Promise(resolve => { modelStarted = resolve; });
    const modelGate = new Promise(resolve => { releaseModel = resolve; });
    await mockEventAi(page, target, generated, { gate: async () => {
      modelStarted();
      await modelGate;
    } });

    try {
      await gotoWithRetry(page, "/", { waitUntil: "domcontentloaded" });
      await page.getByTestId("edit-canvas").waitFor();
      await page.evaluate(async ({ project, target }) => {
        const { store } = await import("/src/project/store.ts");
        const { openEventEditorModal } = await import("/src/editor/panels/eventEditor/modal.ts");
        // Keep the editor's normalized boot resources out of assistant checkpoints.
        store.replaceProject(project);
        openEventEditorModal(target.mapId, target.eventId);
      }, { project, target });
      const editor = page.getByTestId("event-editor-modal");
      await editor.getByTestId("event-view-toggle-list").click();
      await editor.getByTestId("event-command-quick-ai").click();

      const capture = async state => {
        // Let the editor chrome and focus ring paint before each capture.
        await page.evaluate(() =>
          new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        if (phase === "after") {
          const overflow = await editor.evaluate(node => {
            const column = node.querySelector(".event-editor-commands-column");
            return {
              viewport: document.documentElement.scrollWidth - innerWidth,
              column: column.scrollWidth - column.clientWidth,
              form: [...column.querySelectorAll(".event-contents-fieldset, .ai-event-assist-body, .cmd-staged-host")]
                .filter(element => element.getClientRects().length)
                .some(element => element.scrollWidth - element.clientWidth > 1),
            };
          });
          assert(overflow.viewport <= 1 && overflow.column <= 1 && !overflow.form, JSON.stringify(overflow));
        }
        const path = resolve(output, `${phase}-${viewport.width}x${viewport.height}-${state}.png`);
        await page.screenshot({ path });
        console.log(path);
      };
      const input = editor.getByTestId("ai-event-input");
      await input.waitFor();
      // Leave the placeholder readable in the idle screenshot.
      await capture("idle");
      await input.fill(prompt);
      await input.press("Control+Enter");
      let requestTimeout;
      try {
        const timeout = new Promise((_, reject) => {
          requestTimeout = setTimeout(async () => {
            const status = await editor.getByTestId("ai-event-status").textContent().catch(() => "");
            reject(new Error(`Model was not called. ${status}`));
          }, 30_000);
        });
        await Promise.race([modelRequested, timeout]);
      } finally {
        clearTimeout(requestTimeout);
      }
      await editor.getByTestId("ai-event-stop").waitFor();
      if (phase === "after") {
        await page.waitForFunction(() => /[1-9]\d*초/.test(document.querySelector(".ai-event-elapsed")?.textContent ?? ""));
      }
      await capture("generating");
      releaseModel();
      for (const status of ["add", "change", "remove"]) {
        await editor.getByTestId(`ai-event-staged-row-${status}`).first().waitFor();
      }
      await capture("draft-with-diff");
      await editor.getByTestId("ai-event-apply").click();
      await editor.locator(".cmd-list").getByText(generated[1].body).waitFor();
      await capture("after-apply");
    } finally {
      releaseModel();
      await page.close();
    }
  }
} finally {
  await browser.close();
}
