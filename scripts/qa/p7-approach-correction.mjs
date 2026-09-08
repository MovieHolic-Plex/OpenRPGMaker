#!/usr/bin/env node
// Prospective regression: recorded-model responses at the HTTP wire, native shipped panel/session/dispatcher.
// Synthetic project imported through the normal file chooser. No historical ledger, provider or remote DB.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { firefox } from "playwright";
import { isWikiExtraction } from "../../test/wikiTransportFixture.ts";

const root = resolve(process.argv[2] ?? ".");
const port = Number(process.env.P7_QA_PORT ?? 9876);
assert(![9841, 9901, 9338].includes(port), "Protected runtime port");
const base = process.env.P7_QA_BASE === "1";
const output = resolve(process.env.P7_QA_OUTPUT ?? "output/evidence/cr-p7-1", base ? "browser-red" : "browser-green");
const origin = `http://127.0.0.1:${port}`;
await mkdir(output, { recursive: true });
let serverLog = "", server, browser, page;
const inFlight = new Set();
const routeErrors = [];
const report = { scope: "Recorded-model wire regression, synthetic imported project, prospective session only. Historical P7 remains blocked; no physical-game or live-provider credit.", base, root, port, requests: [], networkBlocked: [], consoleErrors: [] };
function bounded(promise, label, ms = 60000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Missing ${label}`)), ms); })]).finally(() => clearTimeout(timer));
}

// Install an exact DOM-state observer before its triggering action. No polling or sleeps.
async function transition(page, selector, attribute, expected, action) {
  const token = `p7-dom-${crypto.randomUUID()}`;
  const observed = page.waitForEvent("console", { predicate: message => message.text() === token, timeout: 60000 });
  // Handle rejection immediately while the action runs, then propagate after draining it.
  const result = observed.then(() => null, error => error);
  await page.evaluate(({ selector, attribute, expected, token }) => {
    const abort = AbortSignal.timeout(60000);
    const observer = new MutationObserver(check);
    function check() {
      const node = document.querySelector(selector);
      if (attribute === "absent" ? !node : node && (attribute === null || node.getAttribute(attribute) === expected)) {
        observer.disconnect(); abort.removeEventListener("abort", cancel); console.info(token);
      }
    }
    function cancel() { observer.disconnect(); }
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    abort.addEventListener("abort", cancel, { once: true });
    check();
  }, { selector, attribute, expected, token });
  await action();
  const error = await result;
  if (error) throw error;
}

try {
  server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--configLoader", "runner", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: root, env: { ...process.env, DEV_SERVER_NO_TLS: "1", VITE_CACHE_DIR: resolve(output, "vite-cache"), E2E_FREEZE_DEV_SERVER: "1" }, stdio: ["ignore", "pipe", "pipe"],
  });
  await bounded(new Promise((resolve, reject) => {
    const capture = chunk => { serverLog += chunk; if (serverLog.includes(`127.0.0.1:${port}`)) resolve(); };
    server.stdout.on("data", capture); server.stderr.on("data", capture);
    server.once("error", reject); server.once("exit", code => reject(new Error(`Vite exited ${code}`)));
  }), "owned Vite listen");
  browser = await firefox.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  page.on("console", message => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
  page.on("pageerror", error => report.consoleErrors.push(error.message));
  let fixture, calls = [], sequence = 0;
  const checkId = "acceptance-1:acceptance-contract:13";
  await page.route("**/*", route => {
    const task = (async () => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname.endsWith("/v1/chat/completions")) {
        const body = request.postDataJSON();
        const tools = (body.tools ?? []).map(tool => tool.function.name);
        if (!tools.length) report.requests.push({ tools, response: "recorded intent/resume" });
        let message;
        if (isWikiExtraction(body.messages)) message = { role: "assistant", content: JSON.stringify({ upserts: [] }) };
        else if (!tools.length) message = { role: "assistant", content: JSON.stringify({
          mode: "modify", space: "none", targetMapId: null, useSelection: false, needsPlan: false,
          tools: [], summary: "기록된 검증 회귀", action: "resume",
        }) };
        else {
          const batch = calls.splice(0).map(call => {
            if (!call.useApprovedRevision) return call;
            // Consume authorization from the normal outbound model request, not the read-only harness.
            const revisions = body.messages.flatMap(entry => typeof entry.content === "string" ? entry.content.split("\n") : [])
              .filter(line => line.startsWith("{") && line.endsWith("}"))
              .map(line => JSON.parse(line))
              .filter(value => value.revisionId && value.confirmation?.source === "user" && value.checkId === checkId && value.args);
            assert.equal(revisions.length, 1, "Approved revision must reach the normal model request");
            report.approvedRequestRevision = revisions[0];
            return { name: "correct_verification", args: { checkId, args: revisions[0].args } };
          });
          report.requests.push({ tools, calls: batch });
          message = batch.length ? { role: "assistant", content: null, tool_calls: batch.map(call => ({
            id: `recorded-p7-${++sequence}`, type: "function", function: { name: call.name, arguments: JSON.stringify({ ...call.args, reason: "기록된 모델 응답을 이용한 전용 회귀 검증입니다." }) },
          })) } : { role: "assistant", content: "기록된 회귀 응답입니다. 원래 기준의 미통과 상태를 유지합니다." };
        }
        return route.fulfill({ json: { choices: [{ message, finish_reason: message.tool_calls ? "tool_calls" : "stop" }] } });
      }
      if (url.pathname.includes("/auth/status")) return route.fulfill({ json: { connected: true, authKind: "oauth", expired: false, env: false } });
      if (url.pathname.includes("/rest/v1/") || url.pathname.includes("/supabase/")) {
        report.networkBlocked.push({ method: request.method(), url: request.url() });
        return route.fulfill({ json: [] });
      }
      if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) {
        report.networkBlocked.push({ method: request.method(), url: request.url() });
        return route.fulfill({ status: 200, json: {} });
      }
      return route.continue();
    })();
    inFlight.add(task);
    task.then(() => inFlight.delete(task), error => {
      inFlight.delete(task); routeErrors.push(String(error));
    });
    return task;
  });
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({ configVersion: 2, agentMode: "chat", maxToolCalls: 4, autonomyLevel: "balanced" }));
    const observer = new MutationObserver(() => {
      if (document.querySelector("[data-testid=login-guest], [data-testid=ai-input]")) { observer.disconnect(); console.info("P7_BOOT_READY"); }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  const ready = page.waitForEvent("console", { predicate: message => message.text() === "P7_BOOT_READY", timeout: 60000 });
  await page.goto(`${origin}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded" });
  await ready;
  if (await page.getByTestId("login-guest").count()) await transition(page, "[data-testid=ai-input]", null, null, () => page.getByTestId("login-guest").click());
  await transition(page, "[data-testid=edit-canvas]", null, null, async () => {});
  fixture = await page.evaluate(async () => {
    const { p7Approach } = await import("/test/fixtures/p7Approach.ts");
    const { project, criteria, args, corrected } = p7Approach();
    return { project, criteria, args, corrected };
  });
  await page.getByTestId("menu-project").click();
  const choosing = page.waitForEvent("filechooser");
  await page.getByTestId("menu-project-import").click();
  const chooser = await choosing;
  const storeToken = `p7-import-${crypto.randomUUID()}`;
  const imported = page.waitForEvent("console", { predicate: message => message.text() === storeToken, timeout: 30000 });
  await page.evaluate(async token => {
    const { store } = await import("/src/project/store.ts");
    const abort = AbortSignal.timeout(30000);
    const unsubscribe = store.subscribe(() => {
      if (!store.getCurrent().maps.map_blank_start?.events.some(event => event.id === "ev_door")) return;
      unsubscribe(); abort.removeEventListener("abort", unsubscribe); console.info(token);
    });
    abort.addEventListener("abort", unsubscribe, { once: true });
  }, storeToken);
  await chooser.setFiles({ name: "prospective-p7-regression.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture.project)) });
  await imported;
  // Project imports reset the real panel/session normally; no private owner restoration.
  await transition(page, "[data-testid=ai-input]", null, null, async () => {});
  async function send(batch, text) {
    calls = batch;
    const terminal = page.waitForRequest(request => {
      if (!request.url().includes("/ai-activity") || request.method() !== "POST") return false;
      const record = request.postDataJSON();
      return record.instruction === text && record.result?.pending !== true && record.result?.stoppedReason !== undefined;
    }, { timeout: 60000 }).then(request => request.postDataJSON());
    const settled = terminal.then(value => ({ value }), error => ({ error }));
    await page.getByTestId("ai-input").fill(text);
    await page.getByTestId("ai-send").click();
    const outcome = await settled;
    if (outcome.error) throw outcome.error;
    report.lastTurn = outcome.value;
    assert.equal(calls.length, 0);
    return outcome.value;
  }
  report.failedTurn = await send([
    { name: "set_work_plan", args: { goal: "새 세션 접근 보정 회귀 · 과거 P7 완료 아님", requirements: [{ id: "acceptance-contract", title: "기록된 원래 15개 기준", criteria: fixture.criteria }],
      layers: [{ title: "검증", items: [{ id: "verify", title: "기준 검증", instruction: "전체 기준 유지", requirementIds: ["acceptance-contract"] }] }] } },
    { name: "run_scene_test", args: fixture.args },
    { name: "correct_verification", args: { checkId, args: fixture.corrected } },
  ], "기록된 모델 응답으로 원래 15개 기준의 먼 문 상호작용 실패를 재현해 주세요.");
  const harness = () => page.evaluate(() => window.__oprnAiBridge.harness());
  report.before = await harness();
  const verification = report.before.verification;
  const outcomes = report.before.messages.filter(message => message.role === "tool" && typeof message.content === "string").map(message => JSON.parse(message.content));
  assert(outcomes.some(result => result.data?.failedStepIndex === 1 && result.data?.failedSelection?.eventId === "ev_door"));
  assert(outcomes.some(result => result.issues?.some(issue => issue.code === "invalid-verification-correction")));
  assert.equal(report.before.acceptance.items.find(item => item.id === "acceptance-contract").evidence.length, 15);
  const review = page.getByTestId("ai-approach-review");
  report.reviewActionCount = await review.count();
  await page.screenshot({ path: resolve(output, "failure.png") });
  if (base) {
    assert.equal(report.reviewActionCount, 0, "Base unexpectedly exposes the correction action");
    report.expectedRed = "Native canonical failure and rejected movement retained; shipped correction UI action absent.";
  } else {
    assert.equal(report.reviewActionCount, 1);
    report.smallScreenActions = [];
    // At the supported 1024px floor the floating chat can cover the checklist.
    // Exercise the shipped collapse/expand affordances, never forced clicks or CSS relocation.
    await transition(page, "[data-testid=ai-collapse]", "aria-expanded", "false", () => page.getByTestId("ai-collapse").click());
    report.smallScreenActions.push("collapse-chat");
    await transition(page, "[data-testid=ai-sticky-toggle]", "aria-expanded", "true", () => page.getByTestId("ai-sticky-toggle").click());
    report.smallScreenActions.push("expand-checklist");
    const row = page.locator('[data-testid=ai-sticky-item][data-item-id="acceptance-contract"]');
    await row.locator(":scope > summary").click();
    report.smallScreenActions.push("expand-original-criterion-bundle");
    await review.scrollIntoViewIfNeeded();
    report.reviewHit = await review.evaluate(node => {
      const box = node.getBoundingClientRect();
      return { viewport: { width: innerWidth, height: innerHeight }, box: box.toJSON(), hit: node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
    });
    assert.equal(report.reviewHit.hit, true);
    await page.screenshot({ path: resolve(output, "review-action-1024.png") });
    await transition(page, "[data-testid=ai-approach-confirm]", null, null, () => review.click());
    report.smallScreenActions.push("review-approach");
    report.preview = await page.getByTestId("ai-approach-confirm").evaluate(node => node.parentElement.textContent);
    await page.getByTestId("ai-approach-confirm").scrollIntoViewIfNeeded();
    report.confirmHit = await page.getByTestId("ai-approach-confirm").evaluate(node => {
      const box = node.getBoundingClientRect();
      return { viewport: { width: innerWidth, height: innerHeight }, box: box.toJSON(), hit: node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
    });
    assert.equal(report.confirmHit.hit, true);
    await page.screenshot({ path: resolve(output, "preview.png") });
    report.previewRecipes = await page.getByTestId("ai-approach-confirm").evaluate(node =>
      Array.from(node.parentElement.querySelectorAll(":scope > details > p"), entry => JSON.parse(entry.textContent)));
    assert.deepEqual(report.previewRecipes[0], fixture.args);
    assert.deepEqual(report.previewRecipes[1], { stepIndex: 1, mapId: fixture.args.mapId, step: fixture.corrected.steps[1] });
    assert.deepEqual(report.previewRecipes[2], fixture.args.steps.filter(step => step.kind === "expect"));
    assert.deepEqual(report.previewRecipes[4], fixture.corrected);
    await transition(page, "[data-testid=ai-approach-confirm]", "absent", null, () => page.getByTestId("ai-approach-confirm").click());
    report.smallScreenActions.push("confirm-approach");
    report.approved = await harness();
    assert.equal(report.approved.verification.approaches.length, 1);
    assert.equal(report.approved.verification.resolutions.length, 0);
    assert.equal(report.approved.verification.requirements.find(entry => entry.checkId === checkId).status, "unverified");
    assert.deepEqual(report.approved.verification.approaches[0].args, fixture.corrected);
    await transition(page, "[data-testid=ai-collapse]", "aria-expanded", "true", () => page.getByTestId("ai-collapsed-restore").click());
    report.smallScreenActions.push("restore-chat");
    report.correctedTurn = await send([{ useApprovedRevision: true }], "사용자가 승인한 접근 보정의 정확한 인자와 원래 기준 ID로 새 검증을 실행해 주세요.");
    assert.deepEqual(report.approvedRequestRevision.args, fixture.corrected);
    report.smallScreenActions.push("send-normal-verification");
    report.after = await harness();
    assert.equal(report.after.verification.requirements.find(entry => entry.checkId === checkId).status, "passed");
    assert.deepEqual(report.after.verification.findings, verification.findings);
    assert.deepEqual(report.after.verification.attempts.slice(0, verification.attempts.length), verification.attempts);
    assert.equal(report.after.verification.resolutions.length, 1);
    assert.equal(report.after.acceptance.items.find(item => item.id === "acceptance-contract").evidence[4].passed, false);
    await page.screenshot({ path: resolve(output, "fresh-owned-proof.png") });
    report.layout = [];
    for (const size of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size);
      const box = await page.getByTestId("ai-sticky-checklist").boundingBox();
      assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height);
      report.layout.push({ ...size, box });
      await page.screenshot({ path: resolve(output, `layout-${size.width}.png`) });
    }
    await transition(page, "[data-testid=ai-sticky-checklist]", "absent", null, () => page.getByTestId("ai-new-chat").click());
    assert.equal(await page.getByTestId("ai-approach-confirm").count(), 0);
    report.newSessionCleared = true;
  }
  assert.deepEqual(routeErrors, []);
  report.ok = true;
} catch (error) {
  report.error = error.stack ?? String(error);
  throw error;
} finally {
  // Keep the network fence installed until the browser is closed, then drain every owned route.
  if (browser) await browser.close();
  await bounded(Promise.allSettled([...inFlight]), "route draining", 10000);
  report.routeErrors = routeErrors;
  if (routeErrors.length) report.ok = false;
  if (server && server.exitCode === null) { const stopped = once(server, "exit"); server.kill("SIGTERM"); await bounded(stopped, "owned server shutdown", 10000); }
  await writeFile(resolve(output, "server.log"), serverLog);
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  assert.deepEqual(routeErrors, []);
}
console.log(`PASS ${base ? "expected base red" : "prospective preview -> user confirmation -> real dispatcher"}: ${output}`);
