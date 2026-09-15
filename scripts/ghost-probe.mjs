/**
 * 고스트 프리뷰 회귀 경계 계측 프로브 (일회성 진단).
 *
 * agent-ghost-sequence.spec.ts 와 같은 목업 턴을 돌리되, 실패 지점을 하나로 말하지 않고
 * 경계마다 증거를 남긴다:
 *   B1 tool_started/tool_call 이 실제로 발화하는가 (브리지 이벤트)
 *   B2 setAgentGhostRunningTool → state.runningToolName / runningToolMapId
 *   B3 replaceAgentGhostPreviewFromProjectDiff → state.previews[].cells.length
 *   B4 렌더러가 보는 mapId 와 runningToolMapId 가 일치하는가
 *   B5 DOM 칩·마커가 붙는가
 *
 * 실행: DEV_SERVER_PORT=9861 node scripts/ghost-probe.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const PORT = process.env.DEV_SERVER_PORT ?? "9861";
const ORIGIN = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve("evidence/ghost-probe");
mkdirSync(OUT, { recursive: true });

const log = [];
const note = (line) => {
  log.push(line);
  console.log(line);
};

const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on("console", (msg) => {
  const text = msg.text();
  if (text.startsWith("[probe]") || text.startsWith("[agent-ghost]")) note(`  console> ${text}`);
});
page.on("pageerror", (err) => note(`  PAGEERROR> ${err.message}`));

// ── 목업 LLM: 플래너 → set_build_spec → fill_region → 마무리 ────────────────
const plan = { mapId: "", rect: { x: 26, y: 13, w: 10, h: 8 } };
let toolRounds = 0;
// WIKI_OK=1 이면 위키 추출 라운드에 유효한 빈 패치를 준다(A/B 의 B 쪽).
const WIKI_OK = process.env.WIKI_OK === "1";
await page.route("**/v1/chat/completions", async (route) => {
  const body = route.request().postDataJSON();
  const hasTools = (body?.tools ?? []).length > 0;
  const systemText = String(body?.messages?.[0]?.content ?? "");
  const isWikiRound = systemText.startsWith("Extract new project knowledge into JSON");
  let message;
  if (isWikiRound) {
    note(`  [mock] wiki round → ${WIKI_OK ? '{"upserts":[]}' : "planner JSON (회귀 재현)"}`);
    message = {
      role: "assistant",
      content: WIKI_OK ? JSON.stringify({ upserts: [] }) : JSON.stringify({ action: "direct", reason: "단일 지형 채우기로 충분" }),
    };
    await route.fulfill({ contentType: "application/json", status: 200, body: JSON.stringify({ choices: [{ message }] }) });
    return;
  }
  if (!hasTools) {
    message = { role: "assistant", content: JSON.stringify({ action: "direct", reason: "단일 지형 채우기로 충분" }) };
  } else if (toolRounds === 0) {
    toolRounds += 1;
    message = {
      role: "assistant",
      content: "",
      tool_calls: [{
        id: "call_spec",
        type: "function",
        function: {
          name: "set_build_spec",
          arguments: JSON.stringify({
            mapId: plan.mapId,
            title: "광장 연못 초안",
            assets: [{ id: "pond", kind: "terrain", ...plan.rect, shape: "circle", layer: "lower", overExisting: "keep" }],
            density: "normal",
          }),
        },
      }],
    };
  } else if (toolRounds === 1) {
    toolRounds += 1;
    message = {
      role: "assistant",
      content: "",
      tool_calls: [{
        id: "call_fill",
        type: "function",
        function: {
          name: "fill_region",
          arguments: JSON.stringify({ mapId: plan.mapId, rect: plan.rect, material: "물", shape: "circle", layer: "lower" }),
        },
      }],
    };
  } else {
    message = { role: "assistant", content: "연못 초안을 올렸습니다." };
  }
  await route.fulfill({ contentType: "application/json", status: 200, body: JSON.stringify({ choices: [{ message }] }) });
});

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:ai-config", JSON.stringify({ agentMode: "chat" }));
});

note(`== boot ${ORIGIN} ==`);
await page.goto(`${ORIGIN}/?freshProject=1`, { waitUntil: "domcontentloaded" });
const guest = page.getByTestId("login-guest");
if (await guest.isVisible().catch(() => false)) await guest.click();
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 30_000 });
await page.waitForFunction(() => typeof window.__oprnEditWorldToClient === "function", null, { timeout: 30_000 });

plan.mapId = await page.evaluate(() => window.__oprnRegionTaskHarness?.currentMapId());
note(`B0 mapId = ${plan.mapId}`);

// 카메라 시야 안의 영역 고르기
plan.rect = await page.evaluate(({ id }) => {
  const toClient = window.__oprnEditWorldToClient;
  const harness = window.__oprnRegionTaskHarness;
  const TILE = 16;
  const size = { w: 10, h: 8 };
  for (let ty = 0; ty < 200; ty += 1) {
    for (let tx = 0; tx < 200; tx += 1) {
      const p = toClient(tx * TILE, ty * TILE);
      if (p.x < 1040 || p.x > 1120 || p.y < 100 || p.y > 170) continue;
      if (harness.readCell(id, "lower", tx + size.w - 1, ty + size.h - 1) === null) continue;
      return { x: tx, y: ty, ...size };
    }
  }
  return null;
}, { id: plan.mapId });
note(`B0 rect = ${JSON.stringify(plan.rect)}`);

// ── 계측 설치: 고스트 스토어를 직접 구독한다(같은 모듈 인스턴스) ─────────────
const installed = await page.evaluate(async () => {
  const w = window;
  w.__probe = { states: [], importError: null, moduleKeys: [] };
  try {
    const mod = await import("/src/editor/agentGhostPreview.ts");
    w.__probe.moduleKeys = Object.keys(mod);
    w.__probeUnsub = mod.subscribeAgentGhostPreview((state) => {
      w.__probe.states.push({
        t: Math.round(performance.now()),
        runningToolName: state.runningToolName,
        runningToolMapId: state.runningToolMapId ?? null,
        revision: state.revision,
        previews: state.previews.map((p) => ({ mapId: p.mapId, tool: p.toolName, cells: p.cells.length })),
      });
    });
    w.__probe.subscriberCount = mod.hasAgentGhostPreviewSubscribers?.() ?? null;
    return { ok: true, keys: w.__probe.moduleKeys.length };
  } catch (error) {
    w.__probe.importError = String(error);
    return { ok: false, error: String(error) };
  }
});
note(`B-instrument import: ${JSON.stringify(installed)}`);

// 브리지 이벤트 계측(있으면)
await page.evaluate(() => {
  const w = window;
  w.__probeEvents = [];
});

// 채팅 도크가 캔버스 우측을 덮으면 고스트가 스크린샷에서 가려진다 — 미리 접는다.
const collapse = page.getByTestId("ai-collapse");
if (await collapse.isVisible().catch(() => false)) {
  const panel = page.getByTestId("ai-panel");
  const already = await panel.evaluate((n) => n.classList.contains("is-collapsed")).catch(() => false);
  if (!already) {
    await collapse.click();
    await page.waitForTimeout(400);
  }
}

await page.screenshot({ path: path.join(OUT, "01-before-turn.png") });
note(`B1 pre-turn chip count = ${await page.locator("[data-testid='ai-ghost-phase-chip']").count()}`);
note(`B1 pre-turn marker count = ${await page.locator("[data-testid='agent-ghost-preview']").count()}`);

// ── 턴 시작 (기다리지 않는다) ───────────────────────────────────────────────
const turnPromise = page.evaluate((prompt) => {
  const bridge = window.__oprnAiBridge;
  if (!bridge) throw new Error("__oprnAiBridge 미등록");
  return bridge.send(prompt);
}, "광장 가운데에 둥근 연못을 만들어줘");

// 턴 진행 중 주기 샘플링
const tag = process.env.SHOT_TAG ?? (WIKI_OK ? "B-wiki-ok" : "A-broken");
let sawChip = false;
let sawMarker = false;
for (let i = 0; i < 60; i += 1) {
  await page.waitForTimeout(250);
  const snap = await page.evaluate(() => ({
    chip: document.querySelectorAll("[data-testid='ai-ghost-phase-chip']").length,
    chipText: document.querySelector("[data-testid='ai-ghost-phase-chip']")?.textContent ?? "",
    marker: document.querySelectorAll("[data-testid='agent-ghost-preview']").length,
  }));
  if (snap.chip > 0 && !sawChip) {
    sawChip = true;
    note(`B5 CHIP at ${i * 0.25}s: "${snap.chipText}"`);
    await page.screenshot({ path: path.join(OUT, `02-${tag}-chip.png`) });
  }
  if (snap.marker > 0 && !sawMarker) {
    sawMarker = true;
    note(`B5 MARKER at ${i * 0.25}s: marker=${snap.marker} chip="${snap.chipText}"`);
    await page.screenshot({ path: path.join(OUT, `03-${tag}-ghost.png`) });
    break;
  }
}
if (!sawChip && !sawMarker) note(`B5 NONE: 턴 내내 칩·마커가 한 번도 안 붙었다`);

let turnResult;
try {
  turnResult = await Promise.race([
    turnPromise,
    new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 60_000)),
  ]);
} catch (error) {
  turnResult = { error: String(error) };
}
note(`B1 turn result = ${JSON.stringify(turnResult)}`);

const finalProbe = await page.evaluate(() => ({
  states: window.__probe?.states ?? [],
  importError: window.__probe?.importError ?? null,
  moduleKeys: window.__probe?.moduleKeys?.length ?? 0,
  chip: document.querySelectorAll("[data-testid='ai-ghost-phase-chip']").length,
  marker: document.querySelectorAll("[data-testid='agent-ghost-preview']").length,
  canvasHostChildren: (() => {
    const c = document.querySelector("canvas");
    const host = c?.parentElement;
    return host ? [...host.children].map((n) => `${n.tagName}.${n.className || "(none)"}`) : null;
  })(),
}));

note(`\n== B2/B3 고스트 스토어 방출 (${finalProbe.states.length} 건) ==`);
for (const s of finalProbe.states) {
  note(`  t=${s.t} rev=${s.revision} runningTool="${s.runningToolName}" runningMap=${s.runningToolMapId} previews=${JSON.stringify(s.previews)}`);
}
note(`\n== B5 DOM ==`);
note(`  chip=${finalProbe.chip} marker=${finalProbe.marker}`);
note(`  canvas host children: ${JSON.stringify(finalProbe.canvasHostChildren)}`);
note(`  importError=${finalProbe.importError} moduleKeys=${finalProbe.moduleKeys}`);

await page.screenshot({ path: path.join(OUT, `04-${tag}-after-turn.png`) });
writeFileSync(path.join(OUT, `probe-${tag}.log`), log.join("\n") + "\n", "utf8");
note(`\n증거: ${OUT}`);

await browser.close();
