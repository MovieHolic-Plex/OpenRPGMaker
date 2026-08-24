/**
 * AI 에디터가 만든 원격 프로젝트의 정본·활동 로그·런타임을 한 번에 검증한다.
 *
 * 사용:
 *   npx tsx scripts/verify-ai-editor-project.mts <project-id>
 *   npx tsx scripts/verify-ai-editor-project.mts <project-id> --save
 *
 * --save 는 현재 원격 프로젝트를 공식 saveProjectToSupabase 경로로 다시 업서트한 뒤
 * 재로드 직렬화가 저장 결과와 같은지 확인한다. 키와 URL은 출력하지 않는다.
 */
import fs from "node:fs";
import { isRoadTile } from "../src/project/defaults/roadAutotile.ts";
import { serialize } from "../src/project/io.ts";
import {
  listSupabaseAiActivityLogs,
  loadProjectFromSupabase,
  saveProjectToSupabase,
} from "../src/project/supabaseProjectSync.ts";
import type { GameEvent, GameMap, Project } from "../src/project/types.ts";
import { runSceneTest } from "../src/testing/sceneTestRunner.ts";

function readEnvFile(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectKinds(value: unknown, kinds = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) collectKinds(entry, kinds);
    return kinds;
  }
  if (!isRecord(value)) return kinds;
  if (typeof value.kind === "string") kinds.add(value.kind);
  for (const entry of Object.values(value)) collectKinds(entry, kinds);
  return kinds;
}

function eventKinds(event: GameEvent): readonly string[] {
  return [...collectKinds([event.commands ?? [], event.pages ?? []])].sort();
}

function eventRows(map: GameMap): Array<{
  id: string;
  name: string;
  x: number;
  y: number;
  characterId?: string;
  pages: number;
  kinds: readonly string[];
  pageDetails: readonly Record<string, unknown>[];
}> {
  return map.events.map((event) => ({
    id: event.id,
    name: event.name,
    x: event.x,
    y: event.y,
    ...(event.characterId ? { characterId: event.characterId } : {}),
    pages: event.pages?.length ?? 0,
    kinds: eventKinds(event),
    pageDetails: (event.pages ?? []).map((page) => ({
      id: page.id,
      conditions: page.conditions,
      kinds: [...collectKinds(page.commands ?? [])].sort(),
    })),
  }));
}

function tileCounts(map: GameMap): Record<string, number> {
  const counts = new Map<number, number>();
  for (const tile of map.lowerTiles) counts.set(tile, (counts.get(tile) ?? 0) + 1);
  return Object.fromEntries(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tile, count]) => [String(tile), count]),
  );
}

function activitySummary(row: Record<string, unknown>): Record<string, unknown> {
  const payload = isRecord(row.payload_json) ? row.payload_json : {};
  const result = isRecord(payload.result) ? payload.result : {};
  const toolCalls = Array.isArray(payload.toolCalls) ? payload.toolCalls : [];
  return {
    id: row.log_id,
    at: row.created_at,
    instruction: typeof row.instruction === "string" ? row.instruction.slice(0, 180) : "",
    ok: result.ok,
    applied: result.applied,
    changedCells: result.changedCells,
    changedEvents: result.changedEvents,
    toolCalls: toolCalls.length,
  };
}

function runtimeChecks(project: Project): Record<string, unknown> {
  const startMap = project.maps[project.startMapId];
  if (!startMap) throw new Error(`시작 맵 없음: ${project.startMapId}`);
  const boot = runSceneTest(project, {
    mapId: startMap.id,
    start: project.startPos,
    steps: [{ kind: "wait", ticks: 2 }],
  });

  const chest = startMap.events.find((event) => eventKinds(event).includes("changeGold"));
  let chestInteraction: Record<string, unknown> | null = null;
  if (chest) {
    const scene = runSceneTest(project, {
      mapId: startMap.id,
      start: { x: chest.x, y: chest.y - 1 },
      steps: [{ kind: "face", dir: "down" }, { kind: "interact" }],
    });
    chestInteraction = {
      eventId: chest.id,
      ok: scene.ok,
      failureReason: scene.failureReason,
      goldAfter: scene.session.gold,
      selfSwitchesOn: Object.entries(scene.session.selfSwitches)
        .filter(([, value]) => value)
        .map(([key]) => key),
    };
  }

  const shop = startMap.events.find((event) => eventKinds(event).includes("shop"));
  const shopStock = shop
    ? runSceneTest(project, {
        mapId: startMap.id,
        start: project.startPos,
        steps: [{ kind: "expect", shopStock: { eventId: shop.id, itemIds: ["item_ether", "item_antidote"] } }],
      })
    : null;

  return {
    boot: { ok: boot.ok, failureReason: boot.failureReason, gameTime: boot.finalState.gameTime },
    chestInteraction,
    shopStock: shopStock
      ? { eventId: shop?.id, ok: shopStock.ok, failureReason: shopStock.failureReason }
      : null,
  };
}

const projectId = process.argv[2]?.trim();
const shouldSave = process.argv.includes("--save");
if (!projectId || projectId.startsWith("--")) {
  throw new Error("project id가 필요합니다: npx tsx scripts/verify-ai-editor-project.mts <project-id> [--save]");
}

const env = { ...readEnvFile(".env"), ...readEnvFile(".env.local") };
const url = (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const anonKey = env.VITE_SUPABASE_ANON_KEY ?? "";
if (!url || !anonKey) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 설정이 필요합니다.");
const config = { url, anonKey, projectId };

const loaded = await loadProjectFromSupabase(config);
if (!loaded) throw new Error(`Supabase 프로젝트 없음: ${projectId}`);
const activities = await listSupabaseAiActivityLogs(20, config);
const maps = Object.values(loaded.maps);
const events = maps.flatMap((map) => map.events);
const kinds = new Set(events.flatMap((event) => eventKinds(event)));
const capabilities = {
  road: maps.reduce((sum, map) => sum + map.lowerTiles.filter((tile) => isRoadTile(tile)).length, 0),
  npc: events.filter((event) => Boolean(event.characterId) || eventKinds(event).includes("text")).length,
  shop: events.filter((event) => eventKinds(event).includes("shop")).length,
  chest: events.filter((event) => eventKinds(event).includes("changeGold")).length,
  transfer: events.filter((event) => eventKinds(event).some((kind) => kind.toLowerCase().includes("transfer"))).length,
  questLike: events.filter((event) => /quest|퀘스트/i.test(`${event.id} ${event.name}`)).length,
  timeSystemEnabled: loaded.system.timeSystem?.enabled === true,
};

let saveReload: Record<string, unknown> | null = null;
if (shouldSave) {
  const saved = await saveProjectToSupabase(loaded, config);
  if (saved.kind !== "saved" || !saved.project) throw new Error(`원격 저장 실패: ${saved.kind}`);
  const reloaded = await loadProjectFromSupabase(config);
  if (!reloaded) throw new Error("저장 후 재로드 실패");
  const canonicalEqual = serialize(saved.project) === serialize(reloaded);
  if (!canonicalEqual) throw new Error("저장 결과와 재로드 정본이 다릅니다.");
  saveReload = { kind: saved.kind, sha256: saved.sha256, canonicalEqual };
}

const report = {
  projectId,
  title: loaded.meta.title,
  startMapId: loaded.startMapId,
  startPos: loaded.startPos,
  mapCount: maps.length,
  capabilities,
  commandKinds: [...kinds].sort(),
  maps: maps.map((map) => ({
    id: map.id,
    name: map.name,
    size: `${map.width}x${map.height}`,
    pathTiles: map.lowerTiles.filter((tile) => isRoadTile(tile)).length,
    tileCounts: tileCounts(map),
    events: eventRows(map),
  })),
  aiActivities: activities.map(activitySummary),
  runtime: runtimeChecks(loaded),
  saveReload,
};

console.log(JSON.stringify(report, null, 2));

const runtime = report.runtime;
if (!runtime.boot || !isRecord(runtime.boot) || runtime.boot.ok !== true) throw new Error("런타임 부팅 검증 실패");
if (capabilities.road <= 0 || capabilities.npc <= 0 || capabilities.shop <= 0 || capabilities.chest <= 0) {
  throw new Error("필수 저작 사례(길/NPC/상점/상자) 중 하나가 원격 정본에 없습니다.");
}
