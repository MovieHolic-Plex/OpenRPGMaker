/**
 * 에디터 AI(AssistantSession)로 아담한 침실의 의자·책상(사각 탁자) 위치를 바꾸게 한 뒤 Supabase 저장.
 * bun scripts/ai-swap-chair-desk-cozy-room.mts
 */
import fs from "node:fs";
import path from "node:path";
import { AssistantSession, type SessionEvent } from "../src/ai/assistantSession.ts";
import { chatCompletion, DEFAULT_LITE_MODEL, type AiConfig } from "../src/ai/llmClient.ts";
import { buildRegionTaskMessage } from "../src/editor/regionTask/runRegionTask.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { TILE } from "../src/project/defaults/constants.ts";
import type { Project } from "../src/project/types.ts";

const PROJECT_ID = "rpg-zzu-cozy-room";
const MAP_ID = "map_cozy_room_v1";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function furnitureSnapshot(project: Project) {
  const map = project.maps[MAP_ID]!;
  const meta = project.tilesets[map.tilesetId]?.tileMeta ?? [];
  const items: Array<{ x: number; y: number; tile: number; label: string }> = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = map.upperTiles[y * map.width + x]!;
      if (tile < 0) continue;
      const label = meta[tile]?.label ?? `tile ${tile}`;
      if (/의자|탁자|책상|table|chair|desk/i.test(label)) {
        items.push({ x, y, tile, label });
      }
    }
  }
  return items.sort((a, b) => a.y - b.y || a.x - b.x);
}

async function main() {
  const env = loadEnv();
  const config = {
    url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
    anonKey: env.VITE_SUPABASE_ANON_KEY!,
    projectId: PROJECT_ID,
  };
  const project = await loadProjectFromSupabase(config);
  if (!project?.maps[MAP_ID]) {
    console.error("project/map missing", PROJECT_ID, MAP_ID);
    process.exit(2);
  }

  const before = furnitureSnapshot(project);
  console.log("[before]", JSON.stringify(before, null, 2));

  const map = project.maps[MAP_ID]!;
  // 의자·탁자가 있는 y=6 행 주변 선택 영역
  const region = { x: 2, y: 5, width: 8, height: 3 };
  const instruction = [
    "의자랑 책상(사각 탁자) 위치를 서로 바꿔줘.",
    "현재 upper: 세트A (2,6)의자(우향) (3,6)사각 탁자 (4,6)의자(좌향) / 세트B (7,6)의자(우향) (8,6)사각 탁자 (9,6)의자(좌향).",
    "목표: 세트A (2,6)사각 탁자 (3,6)의자(우향) (4,6)의자(좌향) · 세트B (7,6)사각 탁자 (8,6)의자(우향) (9,6)의자(좌향).",
    "절차 고정: tile_erase upper로 (2,6)3x1 과 (7,6)3x1 비운 뒤 place_props로 칸마다 material 배치.",
    "material은 실내 라벨만: 사각 탁자 / 의자(우향) / 의자(좌향). 1x1 area count:1 minGap:0.",
    "금지: fill_region, 가로 탁자, Combined Town 라벨, 침대·거울·상자·문, 영역 밖.",
  ].join(" ");

  const message = buildRegionTaskMessage(
    instruction,
    map.name,
    MAP_ID,
    region,
    project.tilesets[map.tilesetId],
  );

  const aiConfig: AiConfig = {
    baseUrl: (env.VITE_LLM_API_URL || "https://example.invalid/v1").replace(/\/$/, ""),
    model: DEFAULT_LITE_MODEL,
    liteModel: DEFAULT_LITE_MODEL,
    apiKey: env.VITE_LLM_API_KEY || env.VITE_LLM_API_KEY || "",
    maxToolCalls: 50,
    maxTokens: 8192,
    reasoningEffort: "off",
    autoApprove: false,
  };
  if (!aiConfig.apiKey) {
    console.error("VITE_LLM_API_KEY missing");
    process.exit(2);
  }

  const session = new AssistantSession(project, {
    config: aiConfig,
    chat: chatCompletion,
  });

  const onEvent = (ev: SessionEvent) => {
    if (ev.type === "tool_call") {
      console.log(`  tool ${ev.result.ok ? "OK" : "FAIL"} ${ev.name}: ${ev.result.summary?.slice(0, 140)}`);
    } else if (ev.type === "status" || ev.type === "phase") {
      const text = "text" in ev ? String((ev as { text?: string }).text ?? "") : String((ev as { value?: string }).value ?? "");
      if (text) console.log(`  ${ev.type}: ${text.slice(0, 120)}`);
    }
  };

  console.log("\n[ai] sending region task…");
  const started = Date.now();
  const result = await session.sendUserMessage(message, onEvent);
  console.log(`[ai] done ${Date.now() - started}ms reason=${result.stoppedReason}`);
  console.log(`[ai] assistant: ${(result.assistantText ?? "").slice(0, 400)}`);
  console.log(
    "[ai] proposed",
    result.proposedCalls.map((c) => c.name).join(", ") || "(none)",
  );

  const draft = session.getProposedProject();
  const after = furnitureSnapshot(draft);
  console.log("[after draft]", JSON.stringify(after, null, 2));

  const changed =
    JSON.stringify(before) !== JSON.stringify(after) ||
    result.proposedCalls.some((c) => (c.result.diff?.tilesChanged ?? 0) > 0);

  if (!changed) {
    console.error("AI did not change chair/table layout — abort save");
    process.exit(1);
  }

  // 제안 초안을 프로젝트로 저장
  draft.meta = {
    ...(draft.meta ?? {}),
    title: project.meta?.title ?? "아담한 침실",
    description: "의자·책상 위치 교체 (에디터 AI)",
  };
  const saved = await saveProjectToSupabase(draft, config);
  console.log("[saved]", saved.kind, "sha", "sha256" in saved ? String(saved.sha256).slice(0, 12) : "");

  const verify = await loadProjectFromSupabase(config);
  if (!verify) {
    console.error("reload failed");
    process.exit(1);
  }
  const verified = furnitureSnapshot(verify);
  console.log("[verify furniture]", JSON.stringify(verified, null, 2));

  const outDir = path.resolve("output/maps");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "cozy-room-chair-desk-swap.json"),
    JSON.stringify(
      {
        projectId: PROJECT_ID,
        mapId: MAP_ID,
        before,
        after: verified,
        proposedCalls: result.proposedCalls.map((c) => ({ name: c.name, summary: c.summary })),
        assistantText: result.assistantText,
        elapsedMs: Date.now() - started,
      },
      null,
      2,
    ),
  );
  console.log("[ok] projectId=", PROJECT_ID, "map=", MAP_ID);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
