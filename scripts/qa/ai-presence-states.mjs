// AI 존재감(지도 이름표·상태 줄·받은함) 실화면 재생 — 모델 호출 없이 실제 팀 보드 상태를 먹인다.
// 사용: QA_BASE_URL=http://127.0.0.1:<포트> node scripts/qa/ai-presence-states.mjs   (크로미움 netns 필요 시 openwiki/testing.md)
// 결과: verify-shots/ai-presence/ 아래 PNG. 라이브 모델·SQLite 저장 검수가 아니다.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:9816";
const out = "verify-shots/ai-presence";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--disable-features=NetworkChangeNotifier", "--disable-network-change-notifier"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("dialog", d => d.accept());
await page.goto(`${base}/?freshProject=1&lang=ko`, { waitUntil: "commit", timeout: 300000 });
await page.waitForSelector('[data-testid="edit-canvas"]', { state: "attached", timeout: 540000 });
await page.waitForSelector('[data-testid="ai-panel"]', { state: "attached", timeout: 540000 });
await page.waitForTimeout(3000);

const seed = (phase, builderState) => page.evaluate(async ({ phase, builderState }) => {
  const ta = await import("/src/ai/piAgent/teamActivity.ts");
  const tb = await import("/src/ai/piAgent/teamBoardState.ts");
  const st = await import("/src/editor/editorState.ts");
  const gp = await import("/src/editor/agentGhostPreview.ts");
  const { store } = await import("/src/project/store.ts");
  const mapId = st.editorState.get().currentMapId;
  const now = Date.now();
  let s = tb.createTeamBoardState("team", "시장 광장을 정리하고 길 연결도 확인해 줘");
  s = tb.reduceTeamBoard(s, { type: "agent_spawn", agentId: "b", role: "builder", mapId, mapName: "시장 마을", task: "광장 바닥 정리", at: now - 72000 });
  s = tb.reduceTeamBoard(s, { type: "agent_spawn", agentId: "r", role: "reviewer", mapId, mapName: "시장 마을", task: "길 연결 확인", at: now - 60000 });
  for (const [name, sum] of [["get_map_region", "광장 둘레 확인"], ["paint_tiles", "바닥 12칸 교체"], ["scatter_object", "모닥불 2개 배치"]]) {
    s = tb.reduceTeamBoard(s, { type: "agent_event", agentId: "b", event: { type: "tool_start", id: name, name, args: {}, at: now - 30000 } });
    s = tb.reduceTeamBoard(s, { type: "agent_event", agentId: "b", event: { type: "tool_end", id: name, name, ok: true, summary: sum, at: now - 20000 } });
  }
  if (builderState === "working") s = tb.reduceTeamBoard(s, { type: "agent_event", agentId: "b", event: { type: "tool_start", id: "t9", name: "paint_tiles", args: {}, at: now - 2000 } });
  else s = tb.reduceTeamBoard(s, { type: "agent_done", agentId: "b", ok: builderState !== "failed", summary: builderState === "failed" ? "동쪽 문 앞길을 열지 못했어요" : "광장 바닥 12칸을 바꿨어요", stats: { turns: 3, toolCalls: 4 }, changedKeys: [], spills: [], conflicts: [], at: now - 1000 });
  s = tb.reduceTeamBoard(s, { type: "agent_event", agentId: "r", event: { type: "turn", index: 1, at: now - 3000 } });
  s = { ...s, phase, reviewChips: ["바닥 12칸", "모닥불 2개"] };
  const base = store.getCurrent();
  const m = base.maps[mapId];
  const lower = [...m.lowerTiles];
  for (let y = 46; y <= 52; y++) for (let x = 44; x <= 53; x++) lower[y * m.width + x] = 360;
  gp.replaceAgentGhostPreviewFromProjectDiff(base, { ...base, maps: { ...base.maps, [mapId]: { ...m, lowerTiles: lower } } });
  ta.setTeamReviewActions(phase === "검토 대기" ? { apply: () => {}, discard: () => {}, openReport: () => {} } : null);
  ta.publishTeamActivity(s);
}, { phase, builderState });

const shot = async name => { await page.waitForTimeout(600); await page.screenshot({ path: `${out}/${name}.png` }); };

await seed("실행 중", "working");
await shot("01-working");
await page.click('[data-testid="ai-status-chip"][data-state="working"]');
await shot("02-popover");
await page.keyboard.press("Escape");

await page.evaluate(() => window.dispatchEvent(new CustomEvent("oprn:region-task-status", { detail: { mapId: "map_village_30_100x100", region: { x: 36, y: 40, width: 6, height: 5 }, running: true, runId: 7 } })));
await shot("03-drag-region-thread");

await seed("검토 대기", "done");
await page.evaluate(() => document.querySelector('[data-testid="ai-collapsed-restore"]')?.click());
await shot("04-review-inbox");

await seed("실행 중", "failed");
await shot("05-failed");
await browser.close();
console.log("done ->", out);
