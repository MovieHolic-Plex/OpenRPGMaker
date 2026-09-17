/**
 * 캔버스 시공 표시(밑그림)의 눈 증거. 대본화한 Pi 턴을 돌리며 세 경계를 찍는다:
 * 턴 도중(증분 도착, `done` 전) · 검토 대기 · 버린 뒤.
 *
 * 실 LLM 없음 — `/v1/agent/run` 을 페이지 안에서 NDJSON 으로 대본화하고, `done` 직전에 스트림을
 * 붙잡아 「턴 도중」 창을 만든다(`route.fulfill` 은 본문을 한 덩어리로 줘서 이 창이 안 생긴다).
 *
 *   BASE=http://127.0.0.1:9173 node scripts/capture-pi-ghost-live.mjs
 *
 * 결과: output/evidence/pi-ghost-live/ (PNG 3장 + probe.json).
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9173";
const OUT = process.env.OUT ?? "output/evidence/pi-ghost-live";
mkdirSync(OUT, { recursive: true });
const shot = (name) => path.join(OUT, name);

// 크로미움이 호스트의 네트워크 변경 알림을 받으면 진행 중 요청을 전부 취소한다 — 127.0.0.1 도 같이 죽는다.
const browser = await chromium.launch({
  args: ["--disable-features=NetworkServiceInProcess2", "--disable-background-networking"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (error) => console.log(`pageerror: ${String(error).slice(0, 200)}`));

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");

  const probe = { calls: 0, streamed: false, doneSent: false, mapId: null, paintedCells: 0, release: null };
  window.__piGhostScript = probe;
  const originalFetch = window.fetch.bind(window);
  const headers = { "Content-Type": "application/x-ndjson" };
  const ndjson = (events) => `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("/v1/agent/run")) return originalFetch(input, init);
    const raw = typeof init?.body === "string" ? init.body : input instanceof Request ? await input.clone().text() : "{}";
    const body = JSON.parse(raw);
    probe.calls += 1;
    if (body.readOnly) {
      return new Response(ndjson([
        { type: "start", provider: "scripted", model: "scripted-plan", toolCount: 0 },
        { type: "turn", index: 1 },
        { type: "assistant", text: "1. 광장 자리에 바닥을 깐다. 2. 가장자리를 정리한다." },
        { type: "done", project: body.project, stats: { ms: 10, turns: 1, toolCalls: 0, toolErrors: 0 }, changedKeys: [] },
      ]), { status: 200, headers });
    }
    const mapId = body.currentMapId ?? body.mapIds?.[0] ?? Object.keys(body.project.maps)[0];
    const map = body.project.maps[mapId];
    probe.mapId = mapId;
    const cells = [];
    for (let y = 2; y < 8; y += 1) for (let x = 2; x < 12; x += 1) cells.push({ i: y * map.width + x, t: 17 });
    probe.paintedCells = cells.length;
    const after = JSON.parse(JSON.stringify(body.project));
    for (const cell of cells) after.maps[mapId].lowerTiles[cell.i] = cell.t;

    return new Response(new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const write = (event) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        write({ type: "start", provider: "scripted", model: "scripted-build", toolCount: 8 });
        write({ type: "turn", index: 1 });
        write({ type: "tool_start", id: "t1", name: "paint_tiles", args: { mapId } });
        write({ type: "tool_end", id: "t1", name: "paint_tiles", ok: true, summary: `${cells.length}칸을 칠했습니다` });
        write({ type: "map_delta", maps: [{ mapId, layers: [{ layer: "lower", cells }] }] });
        probe.streamed = true;
        await new Promise((resolve) => { probe.release = resolve; });
        write({ type: "assistant", text: "광장 바닥을 깔았습니다." });
        write({ type: "done", project: after, stats: { ms: 900, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: [`maps.${mapId}`] });
        probe.doneSent = true;
        controller.close();
      },
    }), { status: 200, headers });
  };
});

await page.route("**/v1/chat/completions", (route) => route.fulfill({ status: 503, json: { error: "scripted: 검수 없음" } }));
await page.route("**/__oprn/ai-activity", (route) => route.fulfill({ json: { ok: true } }));
await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
await page.route("**/auth/**", (route) => route.fulfill({ json: { ok: true, authenticated: true } }));

const ghostState = () => page.evaluate(async () => {
  const mod = await import("/src/editor/agentGhostPreview.ts");
  const state = mod.getAgentGhostPreviewState();
  return {
    cells: state.previews.reduce((sum, preview) => sum + preview.cells.length, 0),
    previews: state.previews.length,
    runningToolName: state.runningToolName,
    runningToolMapId: state.runningToolMapId,
    markers: document.querySelectorAll('[data-testid="agent-ghost-preview"]').length,
    chips: document.querySelectorAll('[data-testid="ai-ghost-phase-chip"]').length,
  };
});

await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "domcontentloaded" });
const guest = page.locator('[data-testid="login-guest"]');
await guest.or(page.locator('[data-testid="ai-input"]')).first().waitFor({ state: "visible", timeout: 120_000 });
if (await guest.isVisible()) await guest.click();
await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 60_000 });

const receipts = {};
await page.locator('[data-testid="ai-input"]').fill("/pi 광장 바닥을 깔아줘");
await page.locator('[data-testid="ai-send"]').click();

await page.waitForFunction(() => window.__piGhostScript?.streamed === true, undefined, { timeout: 120_000 });
await page.waitForSelector('[data-testid="agent-ghost-preview"]', { timeout: 20_000 });
await page.waitForTimeout(700); // 좌→우 와이프가 지나가게
receipts.duringTurn = { ...(await ghostState()), doneSent: await page.evaluate(() => window.__piGhostScript.doneSent) };
await page.screenshot({ path: shot("01-during-turn.png") });
// 조수 데크가 캔버스를 덮는다(펼치면 760×819) — 같은 순간을 데크 접은 채로도 한 장 남긴다.
// 같은 버튼이 양방향 토글이고, 접힌 뒤에는 레일 안으로 들어가 Playwright 의 가시성 검사에
// 걸린다. 여기서는 «버튼을 정말 누른다» 만 필요하므로 DOM 클릭으로 부른다.
const toggleDeck = () => page.evaluate(() => {
  const button = document.querySelector('[data-testid="ai-collapse"]');
  if (button instanceof HTMLElement) { button.click(); return true; }
  return false;
});
if (await toggleDeck()) {
  await page.waitForTimeout(600);
  receipts.duringTurnCollapsed = await ghostState();
  await page.screenshot({ path: shot("01b-during-turn-canvas.png") });
  await toggleDeck();
  await page.waitForTimeout(600);
}
console.log("턴 도중:", JSON.stringify(receipts.duringTurn));

await page.evaluate(() => window.__piGhostScript.release?.());
await page.locator('[data-testid="ai-team-phase"]').filter({ hasText: "검토 대기" }).waitFor({ timeout: 60_000 });
receipts.awaitingReview = await ghostState();
await page.screenshot({ path: shot("02-awaiting-review.png") });
console.log("검토 대기:", JSON.stringify(receipts.awaitingReview));

await page.locator('[data-testid="ai-team-discard"]').click();
await page.waitForTimeout(600);
receipts.discarded = await ghostState();
await page.screenshot({ path: shot("03-discarded.png") });
console.log("버린 뒤:", JSON.stringify(receipts.discarded));

writeFileSync(path.join(OUT, "probe.json"), `${JSON.stringify(receipts, null, 2)}\n`);
await browser.close();
