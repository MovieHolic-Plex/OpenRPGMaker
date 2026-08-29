/**
 * 내장 에디터 AI 로 **맵 3개짜리 RPG** 를 처음부터 시공한다.
 *
 * 흐름: 빈 시드 프로젝트 → Supabase 저장/재로드 검증 → AssistantSession(툴 호출) 로
 *       마을/던전/실내 3맵 + NPC/상자/전이 저작 → Supabase 저장 → 재로드 검증.
 *
 * AGENTS.md 하드 규칙: 저작 콘텐츠는 Supabase 저장 + 재로드 성공까지가 완료다.
 *
 * 실행 (dev 서버가 /api/cpen 프록시를 제공해야 한다):
 *   npm run dev  # 별도 터미널, https://127.0.0.1:9999
 *   RPG_ZZU_AI_THREE_MAP=1 NODE_TLS_REJECT_UNAUTHORIZED=0 \
 *     node scripts/run-vitest.mjs run test/aiThreeMapRpg.live.test.ts --configLoader bundle
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { chatCompletion, type AiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { loadProjectFromSupabase, saveProjectToSupabase } from "@/project/supabaseProjectSync";
import type { Project } from "@/project/types";

const PROJECT_ID = "rpg-zzu-three-map-rpg";
const SEED_MAP_ID = "map_blank_start";
const OUT_DIR = path.resolve("output/evidence/ai-three-map-rpg");

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of [".env", ".env.local"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

/** 기존 맵을 전부 버리고 스키마 통과용 빈 시드 맵 1장만 남긴 프로젝트. */
function freshSeedProject(previous: Project | null): Project {
  const project = createBlankProject();
  project.meta = {
    ...project.meta,
    title: "세 갈래 여정",
    author: previous?.meta?.author ?? "",
  };
  const seed = project.maps[SEED_MAP_ID];
  if (!seed) throw new Error("createBlankProject missing map_blank_start");
  project.maps = { [SEED_MAP_ID]: seed };
  project.mapTree = { mapId: SEED_MAP_ID, children: [] };
  project.mapConnections = [];
  project.startMapId = SEED_MAP_ID;
  project.startPos = { x: 2, y: 2 };
  project.villageInfoDocuments = [];
  return project;
}

type MapSnapshot = {
  readonly id: string;
  readonly name: string;
  readonly size: string;
  readonly tilesetId: string;
  readonly eventCount: number;
  readonly paintedLower: number;
  readonly paintedUpper: number;
  readonly eventNames: readonly string[];
};

function snapshot(project: Project) {
  const mapIds = Object.keys(project.maps);
  const maps: MapSnapshot[] = mapIds.map((id) => {
    const map = project.maps[id]!;
    const events = map.events ?? [];
    return {
      id,
      name: map.name,
      size: `${map.width}x${map.height}`,
      tilesetId: map.tilesetId,
      eventCount: events.length,
      paintedLower: map.lowerTiles.filter((t) => t > 0).length,
      paintedUpper: (map.upperTiles ?? []).filter((t) => t > 0).length,
      eventNames: events.map((e) => e.pages?.[0]?.name ?? e.id),
    };
  });
  const transfers = mapIds.flatMap((id) =>
    (project.maps[id]!.events ?? []).flatMap((e) =>
      (e.pages ?? []).flatMap((p) =>
        (p.commands ?? [])
          .filter((c) => (c as { kind?: string }).kind === "transfer")
          .map((c) => ({ from: id, at: `${e.x},${e.y}`, to: (c as { mapId?: string }).mapId ?? "?" })),
      ),
    ),
  );
  return {
    title: project.meta?.title ?? null,
    startMapId: project.startMapId,
    startPos: project.startPos,
    mapCount: mapIds.length,
    mapIds,
    maps,
    totalEvents: maps.reduce((sum, m) => sum + m.eventCount, 0),
    transfers,
  };
}

function instruction(): string {
  return [
    "맵 3개로 이루어진 짧은 RPG 를 처음부터 만들어라. 반드시 툴 호출로 저작한다.",
    "",
    "1) 마을 맵 (40x30, 야외 칩셋): create_map 으로 만들고 build_village 또는 lay_path/place_props 로",
    "   길·집·나무를 배치한다. place_npc 로 주민 NPC 를 3명 이상 두고 각자 대사를 준다.",
    "2) 던전 맵 (30x30, 던전 칩셋): create_map 으로 만들고 fill_region/lay_path 로 통로와 방을 만든다.",
    "   place_chest 로 보물 상자를 1개 이상, set_encounter_table 로 몬스터 조우를 넣는다.",
    "3) 실내 맵 (16x12): create_map 으로 만들고 여관 또는 상점 실내를 꾸민다. NPC 1명을 둔다.",
    "",
    "그리고 create_transfer_pair 로 마을↔던전, 마을↔실내 왕복 이동을 반드시 연결한다.",
    "시작 위치는 마을 맵의 걸어갈 수 있는 칸으로 설정한다.",
    "빈 시드 맵 map_blank_start 는 쓰지 말고 새 맵 3장을 만들어라.",
    "각 단계 후 다음 단계를 이어서 진행하고, 3맵 + 전이 연결이 끝나면 요약을 보고해라.",
  ].join("\n");
}

/** AI 가 남긴 시드 맵을 제거하고 트리를 마을 루트로 정리 */
function finalizeProject(draft: Project): Project {
  const mapIds = Object.keys(draft.maps).filter((id) => id !== SEED_MAP_ID);
  if (mapIds.length < 3) throw new Error(`expected 3+ authored maps, got ${mapIds.length}: ${mapIds.join(",")}`);

  const pick = (re: RegExp): string | undefined => mapIds.find((id) => re.test(id) || re.test(draft.maps[id]!.name));
  const village = pick(/village|town|마을|장터/) ?? mapIds[0]!;
  const rest = mapIds.filter((id) => id !== village);

  const next: Project = { ...draft, maps: { ...draft.maps } };
  delete next.maps[SEED_MAP_ID];
  next.mapTree = { mapId: village, children: rest.map((mapId) => ({ mapId, children: [] })) };
  next.mapConnections = (draft.mapConnections ?? []).filter(
    (c) => c.from.mapId !== SEED_MAP_ID && c.to.mapId !== SEED_MAP_ID,
  );
  if (next.startMapId === SEED_MAP_ID || !next.maps[next.startMapId]) {
    next.startMapId = village;
    const map = next.maps[village]!;
    next.startPos = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  }
  return next;
}

declare const process: { readonly env: Record<string, string | undefined>; exit(code: number): never };

const describeLive = process.env.RPG_ZZU_AI_THREE_MAP === "1" ? describe : describe.skip;

describeLive("내장 AI 로 맵 3개 RPG 저작 (live)", () => {
  it("AI 툴 호출로 3맵 + 전이를 만들고 Supabase 저장 후 재로드로 검증한다", async () => {
  const env = loadEnv();
  const config = {
    url: (env.VITE_SUPABASE_URL || "http://dbserver:8100").replace(/\/$/, ""),
    anonKey: env.VITE_SUPABASE_ANON_KEY!,
    projectId: PROJECT_ID,
  };
  expect(config.anonKey, "VITE_SUPABASE_ANON_KEY 가 없다 — Supabase 없이는 완료로 치지 않는다").toBeTruthy();

  let previous: Project | null = null;
  try {
    previous = await loadProjectFromSupabase(config);
  } catch (err) {
    console.warn("[remote] load failed (new project is fine):", (err as Error).message);
  }
  console.log("[remote before]", previous ? { maps: Object.keys(previous.maps).length } : null);

  // 시드 덮어쓰기는 원격을 파괴한다. 실패한 재실행이 좋은 결과를 날리는 것을 막기 위해
  // **덮어쓰기 전에** 기존 프로젝트를 디스크로 백업한다(scripts/restore-three-map-rpg.mjs 로 복원).
  if (previous) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const backup = path.join(OUT_DIR, `project-backup-${Date.now()}.json`);
    fs.writeFileSync(backup, `${JSON.stringify(previous, null, 2)}\n`);
    console.log("[backup]", backup);
  }

  // 시드는 **로컬에서만** 만든다. 원격에 시드를 먼저 쓰면(옛 구현) AI 가 실패했을 때
  // 원격에는 빈 맵 1장만 남아 기존 결과가 사라진다 — 실측으로 그 사고를 겪었다.
  // 저장은 완성 게이트를 통과한 뒤 **딱 한 번**만 한다.
  const seedReload = freshSeedProject(previous);
  console.log("[seed local] maps=", Object.keys(seedReload.maps));

  const model = env.VITE_LLM_MODEL || "cpen/gpt-5-6-luna";
  const aiConfig: AiConfig = {
    // 상대 baseUrl 이 아니라 dev 서버 절대 URL 이므로 apiKey 모드 + 클라이언트 키를 쓴다.
    authMode: "apiKey",
    baseUrl: (env.AI_BASE_URL || "https://127.0.0.1:9999/api/cpen").replace(/\/$/, ""),
    model,
    liteModel: model,
    apiKey: env.CPENROUTER_API_KEY || env.VITE_LLM_API_KEY || "",
    maxToolCalls: 60,
    maxTokens: 8192,
    reasoningEffort: "off",
  };
  console.log("[ai config]", { baseUrl: aiConfig.baseUrl, model: aiConfig.model, keyLen: aiConfig.apiKey.length });

  const session = new AssistantSession(seedReload, { config: aiConfig, chat: chatCompletion });

  const toolLog: { name: string; ok: boolean; summary: string }[] = [];
  const onEvent = (ev: SessionEvent) => {
    if (ev.type === "tool_call") {
      const summary = String(ev.result.summary ?? "").slice(0, 180);
      toolLog.push({ name: ev.name, ok: ev.result.ok, summary });
      console.log(`  tool ${ev.result.ok ? "OK  " : "FAIL"} ${ev.name}: ${summary}`);
      if (!ev.result.ok && ev.result.issues?.length) {
        console.log(`    issues: ${JSON.stringify(ev.result.issues).slice(0, 260)}`);
      }
    } else if (ev.type === "status" || ev.type === "phase") {
      const text = "text" in ev ? String((ev as { text?: string }).text ?? "") : String((ev as { value?: string }).value ?? "");
      if (text) console.log(`  ${ev.type}: ${text.slice(0, 140)}`);
    }
  };

  const started = Date.now();
  console.log("\n[ai] authoring three-map rpg…");
  let result = await session.sendUserMessage(`프로젝트 id=${PROJECT_ID}. 시드 맵만 존재.\n${instruction()}`, onEvent);
  console.log(`[ai] turn1 ${Date.now() - started}ms reason=${result.stoppedReason}`);
  if (result.error) console.error("[ai] turn1 error:", result.error);

  // 3맵 + 전이가 아직이면 이어서 진행시킨다(툴 예산 안에서 최대 2회 추가 킥).
  for (let kick = 1; kick <= 3; kick += 1) {
    const draftNow = session.getProposedProject();
    const authored = Object.keys(draftNow.maps).filter((id) => id !== SEED_MAP_ID);
    const transferCount = snapshot(draftNow).transfers.length;
    console.log(`[check] authored maps=${authored.length} transfers=${transferCount}`);
    if (authored.length >= 3 && transferCount >= 2) break;
    const need: string[] = [];
    if (authored.length < 3) need.push(`맵이 ${authored.length}장뿐이다 — 3장이 되도록 남은 맵을 create_map 으로 계속 만들어라.`);
    if (transferCount < 2) need.push("create_transfer_pair 로 마을↔던전, 마을↔실내 왕복 전이를 아직 다 만들지 않았다. 마무리해라.");
    console.log(`\n[ai] kick ${kick}: ${need.join(" ")}`);
    result = await session.sendUserMessage(need.join("\n"), onEvent);
    if (result.error) console.error(`[ai] kick${kick} error:`, result.error);
  }

  console.log(`[ai] assistant: ${(result.assistantText ?? "").slice(0, 600)}`);

  const draft = finalizeProject(session.getProposedProject());
  const after = snapshot(draft);
  console.log("[after draft]", JSON.stringify(after, null, 2));

  // 저장 전 게이트 — **저장 후가 아니라 저장 전에** 완성도를 확인한다.
  //
  // 실측 사고: 이 게이트가 맵 수만 봤을 때, 전이 0개짜리 재실행이 전이 4개짜리 기존 결과를
  // Supabase 에서 덮어썼다(AI 가 그 턴에 create_transfer_pair 를 못 봤다고 응답). 저장 뒤에
  // 단정해도 원격은 이미 오염된다 — 그래서 완성 조건 전체를 저장 전에 통과시킨다.
  expect(after.mapCount, `3맵 미달 — 저장하지 않는다: ${after.mapIds.join(",")}`).toBeGreaterThanOrEqual(3);
  expect(after.transfers.length, "맵 사이 전이 미완 — 저장하지 않는다(기존 원격 결과 보호)").toBeGreaterThanOrEqual(2);
  expect(after.totalEvents, "이벤트 0개 — 저장하지 않는다").toBeGreaterThan(0);
  // 말하는 NPC 는 필수다. 실측: 맵/전이 게이트만 있던 재실행이 NPC 0명짜리 결과를
  // 저장해 "말 거는 주민" 증거를 잃었다. 대화 커맨드(text)를 가진 이벤트 수를 직접 센다.
  const talkers = Object.values(draft.maps).flatMap((map) =>
    (map.events ?? []).filter((event) =>
      (event.pages ?? []).some((page) => (page.commands ?? []).some((cmd) => cmd.kind === "text")),
    ),
  );
  expect(talkers.length, "말하는 NPC 0명 — 저장하지 않는다(런타임 대화 증거가 불가능해진다)").toBeGreaterThanOrEqual(2);
  for (const map of after.maps) {
    expect(map.paintedLower, `${map.name} 의 바닥이 비었다 — 저장하지 않는다`).toBeGreaterThan(0);
  }

  const saved = await saveProjectToSupabase(draft, config);
  console.log("[saved]", saved.kind);

  // AGENTS.md 하드 규칙: 저장만으로는 완료가 아니다 — 재로드로 존재를 증명한다.
  const verify = await loadProjectFromSupabase(config);
  expect(verify, "재로드가 null 을 반환했다 — Supabase 저장이 실제로 되지 않았다").not.toBeNull();
  expect(verify!.maps[SEED_MAP_ID], "finalize 후에도 시드 맵이 남아 있다").toBeUndefined();
  const verified = snapshot(verify!);
  expect(verified.mapCount, `재로드 결과가 3맵 미달: ${verified.mapIds.join(",")}`).toBe(3);
  expect(verified.transfers.length, "맵 사이 전이가 하나도 저장되지 않았다").toBeGreaterThanOrEqual(2);
  expect(verified.totalEvents, "이벤트(NPC/상자/출입구)가 하나도 없다").toBeGreaterThan(0);
  // 각 맵이 실제로 칠해졌는지 — 빈 맵 3장을 만들고 끝낸 게 아님을 증명한다.
  for (const map of verified.maps) {
    expect(map.paintedLower, `${map.name} 의 바닥 타일이 비어 있다`).toBeGreaterThan(0);
  }
  console.log("[verify]", JSON.stringify(verified, null, 2));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "build-report.json"),
    `${JSON.stringify(
      {
        projectId: PROJECT_ID,
        model: aiConfig.model,
        elapsedMs: Date.now() - started,
        stoppedReason: result.stoppedReason,
        toolCalls: toolLog,
        toolCallCount: toolLog.length,
        toolOkCount: toolLog.filter((t) => t.ok).length,
        assistantText: result.assistantText,
        verified,
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
    events: verified.totalEvents,
    transfers: verified.transfers.length,
    startMapId: verified.startMapId,
  });
  }, 1_800_000);
});
