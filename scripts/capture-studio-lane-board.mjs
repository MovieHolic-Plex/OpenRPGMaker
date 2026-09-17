// 스튜디오 레인 보드 실화면 캡처 (2026-09-17, §11 구현 증거).
//
// 동반 서비스(/v1/agent/run) 대신 로컬 NDJSON 스트리밍 서버가 Pi 워커 노릇을 한다 — Playwright 의
// route.continue({ url }) 로 요청을 그쪽으로 돌린다. 레인은 진짜 UI(＋ 새 레인 → 폼 → 레인 추가)로 만들고,
// start·turn·tool_start·map_delta·done 이 진짜 레인 매니저·고스트 싱크를 지난다. 모델 호출은 없다.
//
//   사용: dev 서버(127.0.0.1:9894, freshProject 데모)를 띄운 뒤
//        node scripts/capture-studio-lane-board.mjs [출력 폴더]
//   결과: impl-01 … impl-09 PNG (1440×900 기본, 07 은 1280×800).
import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:9894";
const OUT = process.argv[2] ?? "output/evidence/studio-lane-board";
mkdirSync(OUT, { recursive: true });
const PORT = 39871;

const SCRIPTS = {
  // mapId → 시나리오
  "map_b4967d0a-7784-4f0e-8021-8b9e7a2f402f": { agent: "시공A", turns: 11, stepMs: 1400, finish: false, tool: "paint_tiles", label: "숲길" },
  "map_mine_entrance": { agent: "시공B", turns: 8, stepMs: 600, finish: true, tool: "place_decor", label: "광차 레일" },
  "map_bell_shrine": { agent: "장식C", turns: 10, stepMs: 1600, finish: false, tool: "paint_road", label: "사당 앞 길" },
};

function pickPathTile(map) {
  const counts = new Map();
  for (const t of map.lowerTiles) if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return (sorted[1] ?? sorted[0] ?? [1])[0];
}

const server = createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", async () => {
    const request = JSON.parse(body);
    const mapId = request.mapIds[0];
    const script = SCRIPTS[mapId] ?? { agent: "?", turns: 3, stepMs: 800, finish: true, tool: "paint_tiles", label: "작업" };
    const map = request.project.maps[mapId];
    const tile = pickPathTile(map);
    res.writeHead(200, { ...cors, "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" });
    const send = (event) => { if (!res.destroyed) res.write(JSON.stringify(event) + "\n"); };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    send({ type: "start", provider: request.provider, model: request.model, toolCount: 206 });
    const x0 = Math.floor(map.width * 0.3), y0 = Math.floor(map.height * 0.25);
    const w = Math.max(6, Math.floor(map.width * 0.4)), h = Math.max(4, Math.floor(map.height * 0.35));
    const lower = [...map.lowerTiles];
    let toolSeq = 0;
    for (let turn = 1; turn <= script.turns && !res.destroyed; turn += 1) {
      send({ type: "turn", index: turn });
      send({ type: "delta", kind: "thinking", text: `${script.label} ${turn}단계 — 어디에 무엇을 놓을지 정하는 중` });
      await wait(script.stepMs * 0.4);
      const cells = [];
      const row = y0 + Math.floor(((turn - 1) / script.turns) * h);
      for (let x = x0; x < x0 + w; x += 1) {
        const i = row * map.width + x;
        if (lower[i] !== tile) { lower[i] = tile; cells.push({ i, t: tile }); }
      }
      const id = `t${++toolSeq}`;
      const args = { mapId, x: x0, y: row, width: w, height: 1, tile };
      send({ type: "tool_start", id, name: script.tool, args });
      await wait(script.stepMs * 0.3);
      if (cells.length > 0) send({ type: "map_delta", maps: [{ mapId, layers: [{ layer: "lower", cells }] }] });
      send({ type: "tool_end", id, name: script.tool, ok: true, summary: `${script.label} · ${cells.length} 타일` });
      if (turn % 3 === 0) {
        const id2 = `t${++toolSeq}`;
        send({ type: "tool_start", id: id2, name: "get_map_region", args: { mapId, x: x0, y: y0, width: w, height: h } });
        await wait(script.stepMs * 0.2);
        send({ type: "tool_end", id: id2, name: "get_map_region", ok: true, summary: `${w}×${h} 확인` });
      }
      send({ type: "assistant", text: `${script.label} ${turn}/${script.turns} — ${cells.length} 타일을 깔았습니다.` });
      await wait(script.stepMs * 0.3);
    }
    if (script.finish && !res.destroyed) {
      const project = { ...request.project, maps: { ...request.project.maps, [mapId]: { ...map, lowerTiles: lower } } };
      send({ type: "assistant", text: `${script.label} 배치를 마쳤습니다. 오두막 1 · 길 ${w * h} 타일 · 이벤트 2.` });
      send({ type: "done", project, stats: { ms: script.turns * script.stepMs, turns: script.turns, toolCalls: toolSeq, toolErrors: 0 }, changedKeys: [`maps.${mapId}`] });
      res.end();
      return;
    }
    // 끝나지 않는 레인 — 연결이 살아 있는 동안 heartbeat 만 흘린다(작업 중으로 남는다).
    const beat = setInterval(() => { if (res.destroyed) clearInterval(beat); else send({ type: "heartbeat", at: Date.now() }); }, 3000);
    req.on("close", () => clearInterval(beat));
  });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.emulateMedia({ reducedMotion: "reduce" });
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:ai-config", JSON.stringify({ agentMode: "chat" }));
});
await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
await page.route("**/__oprn/ai-activity", (route) => route.fulfill({ json: { ok: true } }));
await page.route(/\/v1\/agent\/run/, (route) => route.continue({ url: `http://127.0.0.1:${PORT}/run` }));
await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded" });
await page.locator("[data-testid='login-guest']:visible, [data-testid='ai-input']:visible, [data-testid='ai-collapsed-restore']:visible").first().waitFor({ state: "visible", timeout: 60_000 });
const guest = page.getByTestId("login-guest"); if (await guest.isVisible()) await guest.click();
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
await page.waitForTimeout(1500);
const shot = async (name) => { await page.mouse.move(5, 450); await page.waitForTimeout(120); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };

await shot("impl-01-standard-no-lanes");
await page.getByTestId("topbar-ai-studio").click();
await page.waitForTimeout(1000);
await shot("impl-02-studio-empty");
// 달빛 숲을 모니터에 먼저 — 시공A 의 고스트가 캔버스에 서는 것을 처음부터 본다.
await page.getByTestId("ai-studio-scene-fold").first().click();
await page.waitForTimeout(300);
await page.locator('[data-testid=ai-studio-scene][data-map-id="map_b4967d0a-7784-4f0e-8021-8b9e7a2f402f"]').click();
await page.waitForTimeout(800);

async function createLane(mapId, agent, instruction, turns) {
  await page.getByTestId("ai-studio-new-lane").click();
  await page.getByTestId("lane-form").waitFor({ state: "visible" });
  // 기본으로 켜진 현재 장면 칩을 끄고 대상 장면만 켠다.
  for (const on of await page.locator("[data-testid=lane-map-chip][aria-pressed=true]").all()) await on.click();
  await page.locator(`[data-testid=lane-map-chip][data-map-id="${mapId}"]`).click();
  await page.getByTestId("lane-agent").fill(agent);
  await page.getByTestId("lane-turns").fill(String(turns));
  await page.getByTestId("lane-instruction").fill(instruction);
  await page.getByTestId("lane-create").click();
  await page.waitForTimeout(500);
}
await createLane("map_b4967d0a-7784-4f0e-8021-8b9e7a2f402f", "시공A", "달빛 숲에 북쪽으로 난 숲길과 오두막 하나를 놓아줘. 길은 사당 쪽으로 이어지게.", 12);
await createLane("map_mine_entrance", "시공B", "폐광 입구 앞에 광차 레일과 버려진 광차, 안내 표지 이벤트를 배치해줘.", 8);
await createLane("map_bell_shrine", "장식C", "종탑 사당 앞 길을 정비하고 가로등과 벤치를 놓아줘.", 10);
await shot("impl-03-studio-lanes-just-started");

await page.waitForTimeout(9000);
await page.getByTestId("ai-studio-back-director").click().catch(() => undefined);
await page.waitForTimeout(400);
await shot("impl-04-studio-lanes-running-1440");
const rows = await page.evaluate(() => [...document.querySelectorAll("[data-testid=lane-row]")].map((r) => `${r.dataset.status} | ${r.textContent.replace(/\s+/g, " ").slice(0, 160)}`));
console.log(rows.join("\n"));
console.log("caption", await page.getByTestId("ai-studio-deck-caption").textContent());
console.log("ghost", await page.evaluate(() => document.querySelectorAll(".ai-ghost-marker, [class*=ghost]").length));

// 결과 도착 레인 행 → 오른쪽 열 스레드
await page.locator('[data-testid=lane-row][data-status=review]').first().click();
await page.waitForTimeout(600);
await shot("impl-05-lane-thread-review");

// 나가기 → 확인창
await page.getByTestId("ai-studio-exit").click();
await page.waitForTimeout(400);
await shot("impl-06-exit-confirm");
await page.getByTestId("ai-studio-exit-cancel").click();

// 1280
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(1200);
await shot("impl-07-studio-lanes-1280");
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(800);

// 나가기 확정 → 표준 편집기 + 요약 줄 + 캔버스 고스트
await page.getByTestId("ai-studio-exit").click();
await page.getByTestId("ai-studio-exit-confirm").click();
await page.waitForTimeout(1500);
await shot("impl-08-standard-summary-line");
console.log("summary", await page.getByTestId("ai-lane-summary").textContent());

// 다시 들어가기
await page.getByTestId("ai-lane-summary-open").click();
await page.waitForTimeout(1200);
await shot("impl-09-reenter-from-summary");

await browser.close();
server.close();
