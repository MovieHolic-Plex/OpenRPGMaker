import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { chromium } from "@playwright/test";
const source = readFileSync("test/e2e/saveWriteSignal.ts", "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { armSaveWriteSignal } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.route("http://task2.invalid/", route => route.fulfill({ contentType: "text/html", body: '<button id="save">Save</button>' }));
  await page.goto("http://task2.invalid/");
  await page.evaluate(() => {
    document.querySelector("#save").addEventListener("click", () => {
      localStorage.setItem("oprn:save-slot:v5:1", JSON.stringify({ schemaVersion: 5, session: { switches: { sw_quest_key: true } } }));
    });
  });
  // Await arming, not completion, before the click. Same function used by the adventure.
  await page.evaluate(armSaveWriteSignal, "oprn:save-slot:v5:1");
  try {
    await page.locator("#save").click();
    assert.equal(await page.evaluate(() => window.__saveWriteSignal.completion), "written");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("oprn:save-slot:v5:1")).session.switches.sw_quest_key), true);
  } finally { await page.evaluate(() => window.__saveWriteSignal.dispose()); }
  // Existing bytes alone and unrelated writes must not complete a new observation.
  await page.evaluate(armSaveWriteSignal, "oprn:save-slot:v5:1");
  const cancelled = await page.evaluate(async () => {
    const signal = window.__saveWriteSignal;
    localStorage.setItem("oprn:save-slot:1", "legacy");
    sessionStorage.setItem("oprn:save-slot:v5:1", "other storage");
    signal.dispose();
    return signal.completion;
  });
  assert.equal(cancelled, "cancelled");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  console.log(JSON.stringify({ browser: "chromium", exactAdventureHelper: true, armedBeforeClick: true, result: "written", originalKeyAssertion: true, unrelatedWrites: "cancelled", scope: "browser instrumentation; real player save authority separately exercised by playerOpenSaveMenu.test.ts" }));
} finally {
  await browser.close();
  console.log("Teardown: browser closed; no server, network request, or persistent storage.");
}
