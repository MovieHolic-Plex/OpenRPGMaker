/**
 * 라이브 검증: 실내 오두막 맵에 "상점 NPC 랑 탁자 만들어줘" 영역 작업.
 * 실행: bun scripts/verify-shop-npc-table-live.mts
 * 키는 .env.local VITE_LLM_API_KEY (로그에 출력하지 않음).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AssistantSession, type SessionEvent } from "../src/ai/assistantSession.ts";
import { chatCompletion, DEFAULT_LITE_MODEL, DEFAULT_MODEL, type AiConfig } from "../src/ai/llmClient.ts";
import { buildRegionTaskMessage } from "../src/editor/regionTask/runRegionTask.ts";
import { INTERIOR_ROOM_TILESET_ID } from "../src/editor/interiorRoomPipeline.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { TILE } from "../src/project/defaults/constants.ts";
import type { Project } from "../src/project/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENV_PATH = resolve(ROOT, ".env.local");
const OUT_DIR = resolve(ROOT, "output/verify");

function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function interiorHutProject(): Project {
  const project = createBlankProject();
  const mapId = "map_rp_hut_v1";
  const w = 10;
  const h = 9;
  const size = w * h;
  project.maps[mapId] = {
    id: mapId,
    name: "연습 · 오두막 (10×9)",
    width: w,
    height: h,
    tilesetId: INTERIOR_ROOM_TILESET_ID,
    tileSize: 16,
    lowerTiles: new Array(size).fill(72),
    upperTiles: new Array(size).fill(TILE.EMPTY),
    events: [],
  };
  project.startMapId = mapId;
  project.meta = { ...(project.meta ?? {}), title: "방 연습 검증" };
  return project;
}

function summarize(project: Project, mapId: string) {
  const map = project.maps[mapId]!;
  const upperFilled = map.upperTiles.filter((t) => t !== TILE.EMPTY && t !== 0).length;
  const events = map.events.map((e) => ({
    id: e.id,
    x: e.x,
    y: e.y,
    name: e.pages?.[0]?.name ?? e.id,
  }));
  return {
    tilesetId: map.tilesetId,
    eventCount: map.events.length,
    upperFilled,
    events,
  };
}

async function runOnce(label: string, config: AiConfig, instruction: string) {
  const project = interiorHutProject();
  const mapId = "map_rp_hut_v1";
  const map = project.maps[mapId]!;
  const region = { x: 2, y: 4, width: 5, height: 2 };
  const message = buildRegionTaskMessage(
    instruction,
    map.name,
    mapId,
    region,
    project.tilesets[map.tilesetId],
  );

  const session = new AssistantSession(project, {
    config,
    chat: chatCompletion,
  });

  const events: Array<{ type: string; text?: string; name?: string; ok?: boolean }> = [];
  const onEvent = (ev: SessionEvent) => {
    if (ev.type === "status" || ev.type === "phase") {
      events.push({ type: ev.type, text: "text" in ev ? String((ev as { text?: string }).text ?? (ev as { value?: string }).value ?? "") : "" });
    } else if (ev.type === "tool_call") {
      events.push({
        type: "tool_call",
        name: ev.name,
        ok: ev.result.ok,
        text: ev.result.summary?.slice(0, 160),
      });
      console.log(`  [${label}] tool ${ev.result.ok ? "OK" : "FAIL"} ${ev.name}: ${ev.result.summary?.slice(0, 120)}`);
    } else if (ev.type === "assistant_message") {
      events.push({ type: "assistant_message", text: ev.content.slice(0, 200) });
    }
  };

  console.log(`\n=== ${label} ===`);
  console.log(`model=${config.model} lite=${config.liteModel ?? "(same)"}`);
  const started = Date.now();
  const result = await session.sendUserMessage(message, onEvent);
  const elapsed = Date.now() - started;
  const proposed = session.getProposedProject?.() ?? (session as unknown as { ctx: { project: Project } }).ctx?.project;
  // Prefer draft from harness
  const harness = session.getHarnessSnapshot();
  const draft = (session as unknown as { ctx: { project: Project } }).ctx.project;
  const summary = summarize(draft, mapId);
  const toolNames = result.proposedCalls.map((c) => c.name);
  const report = {
    label,
    model: config.model,
    liteModel: config.liteModel,
    elapsedMs: elapsed,
    stoppedReason: result.stoppedReason,
    assistantText: result.assistantText?.slice(0, 500),
    proposedCalls: result.proposedCalls.map((c) => ({
      name: c.name,
      summary: c.summary,
      args: c.args,
    })),
    toolNames,
    mapAfter: summary,
    harnessModel: harness.model,
    harnessLite: harness.liteModel,
    uiEvents: events.slice(0, 80),
  };
  console.log(`[${label}] done ${elapsed}ms reason=${result.stoppedReason}`);
  console.log(`[${label}] events=${summary.eventCount} upperFilled=${summary.upperFilled} tools=${toolNames.join(",")}`);
  console.log(`[${label}] assistant: ${(result.assistantText ?? "").slice(0, 240)}`);
  return report;
}

async function main() {
  const env = parseEnv(readFileSync(ENV_PATH, "utf8"));
  const apiKey = env.VITE_LLM_API_KEY || env.VITE_LLM_API_KEY;
  if (!apiKey) {
    console.error("VITE_LLM_API_KEY missing in .env.local");
    process.exit(2);
  }
  const baseUrl = (env.VITE_LLM_API_URL || "https://example.invalid/v1").replace(/\/$/, "");
  const instruction = "상점 NPC 랑 탁자 만들어줘";

  const splitConfig: AiConfig = {
    baseUrl,
    model: DEFAULT_MODEL,
    liteModel: DEFAULT_LITE_MODEL,
    apiKey,
    maxToolCalls: 40,
    maxTokens: 8192,
    reasoningEffort: "low",
    autoApprove: false,
  };

  // 사용자 로그와 같은 형태: 둘 다 flash-lite
  const bothLite: AiConfig = {
    ...splitConfig,
    model: DEFAULT_LITE_MODEL,
    liteModel: DEFAULT_LITE_MODEL,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const reports = [];
  // 1) 기본 이원화 (감독 DEFAULT_MODEL + 실행 DEFAULT_LITE_MODEL)
  reports.push(await runOnce("split-supervisor", splitConfig, instruction));
  // 2) 둘 다 실행 모델 (로그 thrash 재현 조건)
  reports.push(await runOnce("both-lite", bothLite, instruction));

  const outPath = resolve(OUT_DIR, `shop-npc-table-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify(reports, null, 2), "utf8");
  console.log(`\nwrote ${outPath}`);

  for (const r of reports) {
    const okNpc = r.mapAfter.eventCount === 1;
    const okTable = r.mapAfter.upperFilled >= 1;
    console.log(
      `RESULT ${r.label}: npc=${r.mapAfter.eventCount} (want1=${okNpc}) tableCells=${r.mapAfter.upperFilled} (want>=1=${okTable}) tools=${r.toolNames.join("|")}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
