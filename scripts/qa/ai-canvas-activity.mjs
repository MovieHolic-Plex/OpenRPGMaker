// Focused visual probe: real editor, scripted Pi events; no model calls or project writes.
import { firefox } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve("verify-shots/ai-canvas-activity");
mkdirSync(out, { recursive: true });
const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "network.notify.changed": false } });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [], checks = [];
page.on("pageerror", error => errors.push(error.message));
const check = (name, ok) => {
  checks.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) throw new Error(name);
};
const shot = name => page.screenshot({ path: resolve(out, `${name}.png`) });
try {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:ai-live-canvas", "on");
    localStorage.setItem("oprn:ai-activity-level", "brief");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
  await page.goto(`${process.env.QA_BASE_URL ?? "http://127.0.0.1:9866"}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__oprnAiBridge?.status?.().panelMounted, null, { timeout: 120000 });
  await shot("00-before");
  await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { createPiGhostBridge } = await import("/src/editor/panels/aiPiGhostBridge.ts");
    const { resolveCurrentMapId } = await import("/src/editor/mapSelection.ts");
    const project = store.getCurrent();
    const mapId = resolveCurrentMapId();
    window.__activityProbe = { bridge: createPiGhostBridge({ baseProject: project }), project, mapId };
  });
  const hud = page.getByTestId("ai-canvas-activity");
  await hud.waitFor({ state: "visible" });
  await shot("01-preparing");
  await page.evaluate(() => {
    const { bridge, project, mapId } = window.__activityProbe;
    bridge.handleEvent({ type: "start", provider: "scripted", model: "scripted", toolCount: 2 });
    bridge.handleEvent({ type: "tool_start", id: "refs", name: "read_tileset_reference", args: { tilesetId: project.maps[mapId].tilesetId } });
  });
  check("References have a specific action", (await hud.innerText()).includes("참고문서를 읽는 중"));
  await shot("02-reading");
  await page.evaluate(async () => {
    const { bridge, project, mapId } = window.__activityProbe;
    bridge.handleEvent({ type: "tool_end", id: "refs", name: "read_tileset_reference", ok: true, summary: "read" });
    bridge.handleEvent({ type: "tool_start", id: "road", name: "paint_road", args: { mapId, points: [{ x: 2, y: 3 }, { x: 8, y: 3 }] } });
    const { startConstructionReveal } = await import("/src/editor/agentConstructionReveal.ts");
    startConstructionReveal(mapId, undefined, project.maps[mapId], "paint_road");
  });
  check("Construction phase follows the actual tool", await hud.getAttribute("data-phase") === "building");
  await page.waitForTimeout(700);
  await shot("03-building");
  await page.evaluate(() => {
    const { bridge } = window.__activityProbe;
    bridge.handleEvent({ type: "tool_end", id: "road", name: "paint_road", ok: true, summary: "painted" });
    bridge.handleEvent({ type: "tool_end", id: "road", name: "paint_road", ok: true, summary: "replayed" });
  });
  check("Replayed completion is counted once", (await hud.innerText()).includes("처리한 작업 2건"));
  check("Status remains between tools", await hud.getAttribute("data-phase") === "thinking");
  await shot("04-between-steps");
  await page.evaluate(() => {
    const { bridge, mapId } = window.__activityProbe;
    bridge.handleEvent({ type: "agent_event", agentId: "a", event: { type: "tool_start", id: "same", name: "paint_road", args: { mapId } } });
    bridge.handleEvent({ type: "agent_event", agentId: "b", event: { type: "tool_start", id: "same", name: "get_map_region", args: { mapId } } });
    bridge.handleEvent({ type: "agent_event", agentId: "b", event: { type: "tool_end", id: "same", name: "get_map_region", ok: true, summary: "read" } });
  });
  check("Concurrent tools retain the other agent's activity", await hud.getAttribute("data-phase") === "building");
  await page.evaluate(() => {
    window.__activityProbe.bridge.handleEvent({ type: "agent_event", agentId: "a", event: { type: "tool_end", id: "same", name: "paint_road", ok: false, summary: "failed" } });
  });
  check("Failure uses the attention state", await hud.getAttribute("data-phase") === "attention");
  check("Recent history is bounded", await hud.locator(".ai-canvas-activity-recent li").count() === 3);
  await shot("05-attention");
  await hud.getByRole("button", { name: "작업 상태판 접기" }).click();
  check("Can collapse without hiding the clock", await hud.locator(".ai-canvas-activity-body").isHidden() && await hud.locator(".ai-canvas-activity-clock").isVisible());
  await shot("06-folded");
  await hud.getByRole("button", { name: "작업 상태판 펼치기" }).click();
  await page.evaluate(async () => {
    const prefs = await import("/src/editor/panels/aiActivityPreference.ts");
    prefs.setActivityLevel("none");
  });
  check("Respects hidden activity preference", await hud.isHidden());
  await page.evaluate(async () => {
    const prefs = await import("/src/editor/panels/aiActivityPreference.ts");
    prefs.setActivityLevel("brief");
    const live = await import("/src/editor/aiLiveCanvas.ts");
    live.setAiLiveCanvasEnabled(false);
  });
  check("Respects live canvas toggle", await hud.isHidden());
  await page.evaluate(async () => (await import("/src/editor/aiLiveCanvas.ts")).setAiLiveCanvasEnabled(true));
  await page.setViewportSize({ width: 1024, height: 768 });
  const fits = await hud.evaluate(node => {
    const r = node.getBoundingClientRect(), h = node.parentElement.getBoundingClientRect();
    return r.left >= h.left && r.right <= h.right && r.bottom <= h.bottom;
  });
  check("Fits compact editor canvas", fits);
  await shot("07-compact");
  await page.emulateMedia({ reducedMotion: "reduce" });
  check("Reduced motion stops the beacon", await hud.locator(".ai-canvas-activity-signal").evaluate(node => getComputedStyle(node).animationName) === "none");
  await page.evaluate(() => {
    const { bridge, project } = window.__activityProbe;
    bridge.observeActivity({ type: "done", project, stats: { ms: 1000, turns: 1, toolCalls: 4, toolErrors: 1 } });
  });
  check("Final event shows checking, never saved", await hud.getAttribute("data-phase") === "reviewing" && !(await hud.innerText()).includes("저장"));
  await page.evaluate(async () => {
    const { setLocale } = await import("/src/i18n/index.ts");
    window.__activityProbe.mapName = window.__activityProbe.project.maps[window.__activityProbe.mapId].name;
    await setLocale("en");
  });
  await page.waitForFunction(() => document.querySelector(".ai-canvas-activity-title")?.textContent === "AI activity");
  check("English translates status but preserves map names", (await hud.innerText()).includes("Checking the result") && (await hud.locator(".ai-canvas-worker-name").allTextContents()).includes(await page.evaluate(() => window.__activityProbe.mapName)));
  await shot("08-english");
  await page.evaluate(async () => (await import("/src/i18n/index.ts")).setLocale("ko"));
  await page.evaluate(async () => {
    const { createPiGhostBridge } = await import("/src/editor/panels/aiPiGhostBridge.ts");
    const old = window.__activityProbe.bridge;
    window.__activityProbe.bridge = createPiGhostBridge({ baseProject: window.__activityProbe.project });
    old.dispose();
  });
  check("Old run cleanup preserves the new run", await hud.count() === 1 && await hud.isVisible());
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(async () => {
    const { scopePiGhostEvent } = await import("/src/editor/panels/aiPiGhostBridge.ts");
    const { bridge, mapId } = window.__activityProbe;
    window.__activityProbe.scopePiGhostEvent = scopePiGhostEvent;
    for (const [id, label] of [["parallel-a", "길 작업"], ["parallel-b", "주민 작업"]]) {
      bridge.observeActivity({ type: "agent_spawn", agentId: id, label, role: "builder", mapId, mapName: null, task: "scripted" });
      bridge.handleEvent(scopePiGhostEvent({ type: "start", provider: "scripted", model: "scripted", toolCount: 1 }, id));
    }
    bridge.handleEvent(scopePiGhostEvent({ type: "tool_start", id: "collision", name: "paint_road", args: { mapId } }, "parallel-a"));
    bridge.handleEvent(scopePiGhostEvent({ type: "tool_start", id: "collision", name: "author_npc_cast", args: { mapId } }, "parallel-b"));
  });
  check("Flat map workers are scoped before canvas delivery", await hud.locator(".ai-canvas-activity-workers li").count() === 2 && (await hud.innerText()).includes("동시에 2개 작업 중"));
  await shot("09-parallel-both-working");
  await page.evaluate(() => {
    const { bridge, scopePiGhostEvent, project } = window.__activityProbe;
    bridge.handleEvent(scopePiGhostEvent({ type: "done", project, stats: { ms: 1000, turns: 1, toolCalls: 1, toolErrors: 0 } }, "parallel-a"));
  });
  check("One worker ending does not clear another's tool", await hud.locator('[data-agent-id="parallel-a"]').getAttribute("class") === "is-done" && await hud.locator('[data-agent-id="parallel-b"]').getAttribute("class") === "is-building");
  const stillRunning = await page.evaluate(async () => (await import("/src/editor/agentGhostPreview.ts")).getAgentGhostPreviewState().runningToolName);
  check("Canvas running chip retains the surviving worker", stillRunning === "author_npc_cast");
  await shot("10-parallel-one-finished");
  await page.evaluate(() => {
    const { bridge, scopePiGhostEvent } = window.__activityProbe;
    bridge.handleEvent(scopePiGhostEvent({ type: "tool_end", id: "collision", name: "author_npc_cast", ok: true, summary: "scripted" }, "parallel-b"));
  });
  check("Matching IDs in other workers do not lose completion", (await hud.innerText()).includes("처리한 작업 1건"));
  await page.evaluate(() => {
    const { bridge, scopePiGhostEvent, project } = window.__activityProbe;
    bridge.handleEvent(scopePiGhostEvent({ type: "done", project, stats: { ms: 1000, turns: 1, toolCalls: 1, toolErrors: 0 } }, "parallel-b"));
  });
  check("Checking starts after both workers finish", await hud.getAttribute("data-phase") === "reviewing");
  await page.evaluate(() => {
    const { bridge, scopePiGhostEvent, mapId } = window.__activityProbe;
    bridge.handleEvent(scopePiGhostEvent({ type: "tool_start", id: "same-a", name: "paint_road", args: { mapId } }, "one-worker"));
    bridge.handleEvent(scopePiGhostEvent({ type: "tool_start", id: "same-b", name: "get_map_region", args: { mapId } }, "one-worker"));
  });
  check("Concurrent calls by one worker each have a row", await hud.locator('[data-agent-id="one-worker"]').count() === 2 && (await hud.innerText()).includes("동시에 2개 작업 중"));
  await page.evaluate(() => {
    const { bridge, scopePiGhostEvent } = window.__activityProbe;
    bridge.handleEvent(scopePiGhostEvent({ type: "tool_end", id: "same-a", name: "paint_road", ok: true, summary: "scripted" }, "one-worker"));
  });
  check("Earlier call ending keeps the later call visible", await hud.locator('[data-tool-call-id="same-b"]').getAttribute("class") === "is-reading");
  check("Earlier call ending keeps the later canvas marker", await page.evaluate(async () => (await import("/src/editor/agentGhostPreview.ts")).getAgentGhostPreviewState().runningToolName) === "get_map_region");
  await page.evaluate(() => window.__activityProbe.bridge.dispose());
  check("Cleanup removes the status panel", await hud.count() === 0);
  check("No browser errors", errors.length === 0);
} finally {
  writeFileSync(resolve(out, "summary.json"), JSON.stringify({ mode: "scripted Pi events in actual editor; no project writes or live model", checks, errors }, null, 2));
  await browser.close();
}
