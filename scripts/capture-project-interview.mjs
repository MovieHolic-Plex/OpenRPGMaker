// Browser evidence for the real dialog modules. No AI requests, project host, or authored game writes.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.INTERVIEW_CAPTURE_URL ?? "http://127.0.0.1:9806";
const folder = "verify-shots/new-project-interview";
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const capture = async filename => {
    await page.locator(".project-interview-aside > img").evaluate(async image => { await image.decode(); });
    await page.screenshot({ path: `${folder}/${filename}` });
  };
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/__interview_capture", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' }));
  await page.goto(`${base}/__interview_capture`);
  await page.evaluate(async () => {
    await import("/src/styles/index.css");
    const { showNewProjectDialog } = await import("/src/editor/ui/newProjectDialog.ts");
    window.captureResult = null;
    void showNewProjectDialog({ defaultValue: "기억을 먹는 숲" }).then(result => { window.captureResult = result; });
  });
  await page.getByTestId("new-project-next").click();
  await page.getByTestId("new-project-genre-option-monster-collect").check();
  await page.getByTestId("new-project-next").click();
  await page.getByTestId("new-project-size-option-wide").check();
  await page.getByTestId("new-project-confirm").click();
  const answer = async index => {
    await page.getByTestId(`project-interview-option-${index}`).click();
    await page.getByTestId("project-interview-next").click();
  };
  await answer(3); await answer(0); await answer(1);
  const monsterQuestion = await page.locator("#project-interview-question").innerText();
  await capture("01-monster-horror.png");
  await answer(0); await answer(1);
  await capture("02-summary.png");
  await page.getByTestId("project-interview-confirm").click();
  const result = await page.evaluate(() => window.captureResult);
  await page.evaluate(async () => {
    const { showProjectInterview } = await import("/src/editor/ui/projectInterviewDialog.ts");
    void showProjectInterview("horror-gallery");
  });
  await answer(1); await answer(1); await answer(3);
  await page.setViewportSize({ width: 1024, height: 768 });
  const galleryQuestion = await page.locator("#project-interview-question").innerText();
  await capture("03-gallery-1024.png");
  const geometry = await page.evaluate(() => ({
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    dialog: document.querySelector(".project-interview-window").getBoundingClientRect().toJSON(),
  }));
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(async () => {
    const { presentEditorWelcome } = await import("/src/editor/editorWelcome.ts");
    window.capturedWelcomeSaves = [];
    void presentEditorWelcome(document.getElementById("root"), {
      applySystemPreset: async (plan, brief) => { window.capturedWelcomeSaves.push({ packId: plan.packId, brief }); },
      canGenerate: () => false,
    }).then(result => { window.capturedWelcomeResult = result; });
  });
  await page.getByTestId("editor-welcome-template-card-0").click();
  const savesBefore = await page.evaluate(() => window.capturedWelcomeSaves.length);
  await page.keyboard.press("Escape");
  const savesAfterCancel = await page.evaluate(() => window.capturedWelcomeSaves.length);
  await page.getByTestId("editor-welcome-template-card-0").click();
  await answer(3); await answer(0); await answer(1); await answer(0); await answer(1);
  await page.getByTestId("project-interview-confirm").click();
  const welcome = await page.evaluate(() => ({ saves: window.capturedWelcomeSaves, result: window.capturedWelcomeResult }));
  const report = { kind: "isolated-real-component-browser-evidence", monsterQuestion, galleryQuestion, result, geometry, savesBefore, savesAfterCancel, welcome, errors };
  writeFileSync(`${folder}/browser.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ monsterQuestion, galleryQuestion, geometry, savesBefore, savesAfterCancel, welcomeSaves: welcome.saves.length, errors }, null, 2));
} finally { await browser.close(); }
