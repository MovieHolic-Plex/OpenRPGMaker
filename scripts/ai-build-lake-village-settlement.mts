/**
 * 호수 마을 프로젝트 맵을 **전부 버리고** 내장 에디터 AI로 처음부터 시공.
 * (빈 mapTree는 스키마 불가라, 시드용 빈 맵 1장만 잠깐 둔 뒤 AI가 마을 맵을 새로 만든다.)
 *
 * npx tsx scripts/ai-build-lake-village-settlement.mts
 */
import fs from "node:fs";
import path from "node:path";
import { AssistantSession, type SessionEvent } from "../src/ai/assistantSession.ts";
import { chatCompletion, DEFAULT_LITE_MODEL, type AiConfig } from "../src/ai/llmClient.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types.ts";

const PROJECT_ID = "rpg-zzu-dungeon-example";
const MAP_ID = "map_lake_village";
const SEED_MAP_ID = "map_blank_start";
const OUT_DIR = path.resolve("output/evidence/ai-lake-village-settlement");

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

/**
 * 원격/로컬 기존 맵을 전부 폐기하고, 스키마 통과용 빈 시드 맵만 남긴 새 프로젝트.
 * DB 레코드 등은 blank 기본값을 쓴다(옛 맵 의존 상태 제거).
 */
function freshSeedProject(previous: Project | null): Project {
  const project = createBlankProject();
  project.meta = {
    ...project.meta,
    title: "호수 마을",
    description: "맵 전량 폐기 후 내장 AI 재시공",
    author: previous?.meta?.author ?? "",
  };
  // 시드 맵만 존재
  const seed = project.maps[SEED_MAP_ID];
  if (!seed) {
    throw new Error("createBlankProject missing map_blank_start");
  }
  project.maps = { [SEED_MAP_ID]: seed };
  project.mapTree = { mapId: SEED_MAP_ID, children: [] };
  project.mapConnections = [];
  project.startMapId = SEED_MAP_ID;
  project.startPos = { x: 2, y: 2 };
  project.villagePlans = {};
  project.villageInfoDocuments = [];
  return project;
}

function snapshot(project: Project) {
  const mapIds = Object.keys(project.maps);
  const village = project.maps[MAP_ID];
  const interiors = mapIds.filter((id) => id !== MAP_ID && id !== SEED_MAP_ID && /interior|house/i.test(id));
  const events = (village?.events ?? []).map((e) => {
    const page = e.pages?.[0];
    return { id: e.id, x: e.x, y: e.y, name: page?.name ?? "" };
  });
  return {
    title: project.meta?.title ?? null,
    startMapId: project.startMapId,
    startPos: project.startPos,
    mapIds,
    mapCount: mapIds.length,
    villageSize: village ? `${village.width}x${village.height}` : null,
    eventCount: events.length,
    events,
    interiorCount: interiors.length,
    interiors,
  };
}

function instructionFromScratch(): string {
  return [
    "이 프로젝트에는 시드용 빈 맵(map_blank_start)만 있다. 예전 호수 마을/공원/실내는 **없다**.",
    "처음부터 호숫가 거주 마을을 새로 만든다.",
    "",
    "고정 절차 (성공한 뒤 다음 단계, 각 툴 1회 원칙):",
    `1) create_map({ id: "${MAP_ID}", name: "호수 마을", width: 50, height: 50 })`,
    "   — 외곽 마을 맵 id는 반드시 map_lake_village.",
    "2) plan_village 1회:",
    '   theme: "호숫가 작은 마을", pathStyle: "sand", kitMix: "mixed",',
    '   yardStyle: "mixed", plazaStyle: "garden", plazaLayout: "center",',
    '   edgeTrees: "conifer", interior: true, fences: true, decor: true,',
    "   houseCount: 6, seed: 91, width: 50, height: 50,",
    '   mapName: "호수 마을",',
    "   houses: 촌장 미르(garden), 어부 한솔(workshop), 상인 리코(market),",
    "           연금술사 세린(garden), 농부 도윤(garden), 여관주인 하나(minimal)",
    "   npcs: 위 6명 + 광장 태식·보라 (한국어 대사 1~2줄)",
    `3) build_village({ planId, mapId: "${MAP_ID}", interior: true, doorEvent: true, fences: true, decor: true })`,
    "   — **build_village 는 정확히 1회만**. 재호출 금지.",
    "4) set_start_position: mapId=map_lake_village, 광장/길 통행 가능 칸.",
    "5) (선택) critique_village 1회. 실패해도 build_village 재실행 금지.",
    "6) map_blank_start 는 더 이상 쓰지 않는다. 시작맵을 map_lake_village 로 둔다.",
    "",
    "금지: 두 번째 create_map(다른 외곽맵), 두 번째 build_village, place_npc만으로 끝내기, 전체 fill_region.",
    "완료: 집 6채급 키트 건물 + 문/실내 + 주민 6명 이상.",
  ].join("\n");
}

/** AI가 남긴 시드 맵 제거 + 트리를 마을 루트로 정리 */
function finalizeProject(draft: Project): Project {
  if (!draft.maps[MAP_ID]) {
    throw new Error("map_lake_village missing after AI");
  }
  if (draft.maps[SEED_MAP_ID]) {
    delete draft.maps[SEED_MAP_ID];
  }
  // 마을 외 맵만 자식
  const children = Object.keys(draft.maps)
    .filter((id) => id !== MAP_ID)
    .sort()
    .map((mapId) => ({ mapId, children: [] as [] }));
  draft.mapTree = { mapId: MAP_ID, children };
  draft.startMapId = MAP_ID;
  if (!draft.startPos || (draft.startPos.x === 0 && draft.startPos.y === 0)) {
    draft.startPos = { x: 25, y: 25 };
  }
  draft.mapConnections = (draft.mapConnections ?? []).filter(
    (c) => draft.maps[c.fromMapId] && draft.maps[c.toMapId],
  );
  draft.meta = {
    ...draft.meta,
    title: "호수 마을",
    description: "맵 전량 폐기 후 내장 AI from-scratch 시공",
  };
  return draft;
}

async function main() {
  const env = loadEnv();
  const config = {
    url: (env.VITE_SUPABASE_URL || "http://dbserver:8100").replace(/\/$/, ""),
    anonKey: env.VITE_SUPABASE_ANON_KEY!,
    projectId: PROJECT_ID,
  };
  if (!config.anonKey) {
    console.error("VITE_SUPABASE_ANON_KEY missing");
    process.exit(2);
  }

  let previous: Project | null = null;
  try {
    previous = await loadProjectFromSupabase(config);
  } catch (err) {
    console.warn("[remote] load failed (likely empty mapTree from prior wipe):", err);
  }
  console.log("[remote before]", previous ? snapshot(previous) : null);

  const seed = freshSeedProject(previous);
  console.log("[seed]", snapshot(seed));
  const seedSave = await saveProjectToSupabase(seed, config);
  console.log("[seed saved]", seedSave.kind);
  const seedReload = await loadProjectFromSupabase(config);
  if (!seedReload?.maps[SEED_MAP_ID] || Object.keys(seedReload.maps).length !== 1) {
    console.error("seed reload unexpected", seedReload ? Object.keys(seedReload.maps) : null);
    process.exit(1);
  }
  console.log("[seed verified] maps=", Object.keys(seedReload.maps));

  const aiConfig: AiConfig = {
    baseUrl: (env.VITE_LLM_API_URL || env.VITE_VITE_LLM_API_URL || "https://example.invalid/v1").replace(
      /\/$/,
      "",
    ),
    model: env.VITE_LLM_MODEL || env.VITE_VITE_LLM_MODEL || DEFAULT_LITE_MODEL,
    liteModel: env.VITE_LLM_MODEL || env.VITE_VITE_LLM_MODEL || DEFAULT_LITE_MODEL,
    apiKey: env.VITE_LLM_API_KEY || env.VITE_LLM_API_KEY || "",
    maxToolCalls: 36,
    maxTokens: 16384,
    reasoningEffort: "low",
    autoApprove: false,
  };
  if (!aiConfig.apiKey) {
    console.error("VITE_LLM_API_KEY missing");
    process.exit(2);
  }

  const session = new AssistantSession(seedReload, {
    config: aiConfig,
    chat: chatCompletion,
  });

  let buildVillageOk = 0;
  let createMapOk = 0;
  const onEvent = (ev: SessionEvent) => {
    if (ev.type === "tool_call") {
      if (ev.name === "build_village" && ev.result.ok) buildVillageOk += 1;
      if (ev.name === "create_map" && ev.result.ok) createMapOk += 1;
      console.log(
        `  tool ${ev.result.ok ? "OK" : "FAIL"} ${ev.name}: ${String(ev.result.summary ?? "").slice(0, 200)}`,
      );
      if (!ev.result.ok && ev.result.issues?.length) {
        console.log(`    issues: ${JSON.stringify(ev.result.issues).slice(0, 280)}`);
      }
    } else if (ev.type === "status" || ev.type === "phase") {
      const text =
        "text" in ev
          ? String((ev as { text?: string }).text ?? "")
          : String((ev as { value?: string }).value ?? "");
      if (text) console.log(`  ${ev.type}: ${text.slice(0, 140)}`);
    }
  };

  const message = [`프로젝트 id=${PROJECT_ID}. 시드 맵만 존재.`, instructionFromScratch()].join("\n");
  console.log("\n[ai] from-scratch village…");
  const started = Date.now();
  const result = await session.sendUserMessage(message, onEvent);
  console.log(
    `[ai] done ${Date.now() - started}ms reason=${result.stoppedReason} create_map=${createMapOk} build_village=${buildVillageOk}`,
  );
  console.log(`[ai] assistant: ${(result.assistantText ?? "").slice(0, 700)}`);
  console.log("[ai] tools:", result.proposedCalls.map((c) => c.name).join(", ") || "(none)");
  if (result.error) console.error("[ai] error:", result.error);

  let draft: Project;
  try {
    draft = finalizeProject(session.getProposedProject());
  } catch (err) {
    console.error(err);
    process.exit(1);
  }

  const after = snapshot(draft);
  console.log("[after draft]", JSON.stringify(after, null, 2));

  if (after.eventCount < 8 || after.interiorCount < 1) {
    console.error("settlement incomplete — not saving over seed");
    process.exit(1);
  }

  const saved = await saveProjectToSupabase(draft, config);
  console.log("[saved]", saved.kind);

  const verify = await loadProjectFromSupabase(config);
  if (!verify?.maps[MAP_ID]) {
    console.error("reload missing village");
    process.exit(1);
  }
  if (verify.maps[SEED_MAP_ID]) {
    console.error("seed map still present after finalize");
    process.exit(1);
  }
  const verified = snapshot(verify);
  console.log("[verify]", JSON.stringify(verified, null, 2));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "from-scratch-report.json"),
    `${JSON.stringify(
      {
        projectId: PROJECT_ID,
        wipedToSeed: true,
        elapsedMs: Date.now() - started,
        stoppedReason: result.stoppedReason,
        createMapOk,
        buildVillageOk,
        assistantText: result.assistantText,
        proposedCalls: result.proposedCalls.map((c) => ({
          name: c.name,
          summary: c.summary,
          ok: c.result.ok,
        })),
        after: verified,
        savedKind: saved.kind,
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(path.join(OUT_DIR, "project-after.json"), `${JSON.stringify(verify, null, 2)}\n`);

  console.log("[ok]", {
    projectId: PROJECT_ID,
    maps: verified.mapCount,
    events: verified.eventCount,
    interiors: verified.interiorCount,
    startPos: verified.startPos,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
