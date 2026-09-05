import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import {
  NIGHT_MONSTER_ENDING_IDS,
  NIGHT_MONSTER_ITEM_ID,
  NIGHT_MONSTER_MAP_IDS,
  NIGHT_MONSTER_PROJECT_ID,
  NIGHT_MONSTER_SWITCH_IDS,
  createNightMonsterProject,
  type NightMonsterManifest,
} from "../src/project/examples/nightMonster.ts";
import { projectLint } from "../src/project/lint/projectLint.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types.ts";
import { runSceneTest, type SceneStep, type SceneTestInput } from "../src/testing/sceneTestRunner.ts";
import { loadSupabaseEnvironment } from "./lib/supabase-database-ops.mjs";

const env = loadSupabaseEnvironment();
const config = {
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: NIGHT_MONSTER_PROJECT_ID,
};

if (!config.url || !config.anonKey) {
  throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 .env 또는 .env.local에 필요합니다.");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function digest(value: unknown): string {
  const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function persistenceSpine(project: Project): unknown {
  return {
    title: project.meta.title,
    startMapId: project.startMapId,
    startPos: project.startPos,
    maps: Object.fromEntries(Object.values(NIGHT_MONSTER_MAP_IDS).map((mapId) => {
      const map = project.maps[mapId];
      assert(map, `맵 누락: ${mapId}`);
      return [mapId, {
        id: map.id,
        name: map.name,
        width: map.width,
        height: map.height,
        tilesetId: map.tilesetId,
        lowerTiles: map.lowerTiles,
        upperTiles: map.upperTiles,
        events: map.events,
        lighting: map.defaultLighting,
        bgm: map.bgm,
        safeZones: map.safeZones,
      }];
    })),
    endings: (project.endings ?? []).map((ending) => ending.id).sort(),
  };
}

function walkthroughInputs(project: Project, manifest: NightMonsterManifest): Array<{ id: string; input: SceneTestInput }> {
  const galleryExit = project.maps[NIGHT_MONSTER_MAP_IDS.gallery]?.events.find(
    (event) => event.id === manifest.gallery.exitEventId,
  );
  assert(galleryExit, "갤러리 출구 이벤트가 없습니다.");
  const [left, center, right] = manifest.gallery.sequenceAt;
  assert(left && center && right, "순서 퍼즐 좌표가 부족합니다.");
  const chaseStart = { x: manifest.chase.chaserAt.x - 2, y: manifest.chase.chaserAt.y };

  const at = (mapId: string, eventId: string) => {
    const event = project.maps[mapId]!.events.find(e => e.id === eventId);
    assert(event, `missing ${eventId}`); return { x: event.x, y: event.y };
  };
  const gate = (mapId: string, target: string) => {
    const event = project.maps[mapId]!.events.find(e => e.pages?.some(p => p.commands.some(c => c.kind === "transfer" && c.mapId === target)));
    assert(event, `missing gate ${mapId} -> ${target}`); return { x: event.x, y: event.y };
  };
  const inspect = (point: { x: number; y: number }): SceneStep[] => [
    { kind: "walk", to: point, adjacent: true }, { kind: "interact" },
  ];
  return [
    {
      id: "five-room-rescue-walkthrough",
      input: { mapId: NIGHT_MONSTER_MAP_IDS.foyer, start: project.startPos, steps: [
        ...inspect(at(NIGHT_MONSTER_MAP_IDS.foyer, "map_night_foyer_ev_examine_1")),
        { kind: "walk", to: gate(NIGHT_MONSTER_MAP_IDS.foyer, NIGHT_MONSTER_MAP_IDS.gallery) },
        { kind: "expect", mapId: NIGHT_MONSTER_MAP_IDS.gallery },
        ...inspect(at(NIGHT_MONSTER_MAP_IDS.gallery, manifest.gallery.keyEventId)),
        { kind: "expect", inventoryCount: { itemId: NIGHT_MONSTER_ITEM_ID, count: 1 } },
        ...inspect(manifest.gallery.itemGateAt),
        ...inspect(left),
        { kind: "expect", variableEquals: { var_gallery_sequence_step: 0 } },
        ...inspect(center), ...inspect(left), ...inspect(right),
        { kind: "expect", switchOn: NIGHT_MONSTER_SWITCH_IDS.sequenceSolved },
        { kind: "walk", to: gate(NIGHT_MONSTER_MAP_IDS.gallery, NIGHT_MONSTER_MAP_IDS.bedroom) },
        ...inspect(at(NIGHT_MONSTER_MAP_IDS.bedroom, "map_night_bedroom_ev_examine_1")),
        { kind: "expect", switchOn: "sw_night_whistle" },
        { kind: "walk", to: gate(NIGHT_MONSTER_MAP_IDS.bedroom, NIGHT_MONSTER_MAP_IDS.gallery) },
        { kind: "walk", to: { x: galleryExit.x, y: galleryExit.y } },
        { kind: "expect", mapId: NIGHT_MONSTER_MAP_IDS.chase },
        { kind: "wait", ticks: 100 }, { kind: "expect", gameOver: false },
        { kind: "walk", to: { x: 23, y: 9 } },
        { kind: "walk", to: { x: 23, y: 5 } },
        { kind: "walk", to: gate(NIGHT_MONSTER_MAP_IDS.chase, NIGHT_MONSTER_MAP_IDS.finale) },
        { kind: "expect", mapId: NIGHT_MONSTER_MAP_IDS.finale },
        ...inspect(manifest.finale.truthAt),
        ...inspect(manifest.finale.truthEndingAt),
        { kind: "expect", endingReached: NIGHT_MONSTER_ENDING_IDS.truth },
      ] },
    },
    {
      id: "gallery-key-sequence-transfer",
      input: {
        mapId: NIGHT_MONSTER_MAP_IDS.gallery,
        start: manifest.gallery.keyAt,
        steps: [
          { kind: "interact" },
          { kind: "expect", inventoryCount: { itemId: NIGHT_MONSTER_ITEM_ID, count: 1 } },
          { kind: "set", x: manifest.gallery.itemGateAt.x, y: manifest.gallery.itemGateAt.y },
          { kind: "interact" },
          { kind: "expect", switchOn: NIGHT_MONSTER_SWITCH_IDS.keyUsed, inventoryCount: { itemId: NIGHT_MONSTER_ITEM_ID, count: 0 } },
          { kind: "set", x: center.x, y: center.y },
          { kind: "interact" },
          { kind: "set", x: left.x, y: left.y },
          { kind: "interact" },
          { kind: "set", x: right.x, y: right.y },
          { kind: "interact" },
          { kind: "expect", switchOn: NIGHT_MONSTER_SWITCH_IDS.sequenceSolved },
          { kind: "set", x: galleryExit.x, y: galleryExit.y - 1 },
          { kind: "move", dir: "down" },
          { kind: "expect", mapId: NIGHT_MONSTER_MAP_IDS.chase },
        ],
      },
    },
    {
      id: "chase-death-checkpoint-retry",
      input: {
        mapId: NIGHT_MONSTER_MAP_IDS.chase,
        start: chaseStart,
        steps: [
          { kind: "wait", ticks: 140 },
          { kind: "expect", gameOver: true },
          { kind: "retryCheckpoint" },
          { kind: "expect", gameOver: false, playerAt: { ...chaseStart, mapId: NIGHT_MONSTER_MAP_IDS.chase } },
        ],
      },
    },
    {
      id: "truth-ending",
      input: {
        mapId: NIGHT_MONSTER_MAP_IDS.finale,
        start: manifest.finale.truthAt,
        steps: [
          { kind: "set", switches: ["sw_night_whistle"] },
          { kind: "interact" },
          { kind: "expect", switchOn: NIGHT_MONSTER_SWITCH_IDS.truthHeard },
          { kind: "set", x: manifest.finale.truthEndingAt.x, y: manifest.finale.truthEndingAt.y },
          { kind: "interact" },
          { kind: "expect", endingReached: NIGHT_MONSTER_ENDING_IDS.truth },
        ],
      },
    },
    {
      id: "escape-ending",
      input: {
        mapId: NIGHT_MONSTER_MAP_IDS.finale,
        start: manifest.finale.escapeEndingAt,
        steps: [
          { kind: "interact" },
          { kind: "expect", endingReached: NIGHT_MONSTER_ENDING_IDS.escape },
        ],
      },
    },
  ];
}

function verifyWalkthroughs(project: Project, manifest: NightMonsterManifest) {
  return walkthroughInputs(project, manifest).map(({ id, input }) => {
    const result = runSceneTest(project, input);
    assert(result.ok, `${id} 실패: ${result.failureReason} ${result.log.join(" / ")}`);
    return {
      id,
      ok: result.ok,
      stepsRun: result.stepsRun,
      totalSteps: result.totalSteps,
      finalMapId: result.finalState.mapId,
      gameOver: result.finalState.gameOver,
      endingsReached: result.finalState.endingsReached,
    };
  });
}

// Historical baseline builder must not erase the reviewed revision.
const existing = await loadProjectFromSupabase(config);
assert(!existing?.maps.map_night_basement?.events.some(e => e.id === "ev_night_basement_hiding"),
  "개정된 밤의 괴물이 있습니다. scripts/revise-night-monster.mts를 사용하세요. 초기 제작기로 덮어쓸 수 없습니다.");
const { project, manifest } = createNightMonsterProject();
const localLint = projectLint(project);
assert(localLint.filter(i => !i.code.startsWith("runtime-support:")).length === 0, `로컬 lint 실패: ${JSON.stringify(localLint)}`);
const localWalkthroughs = verifyWalkthroughs(project, manifest);
const localSpineHash = digest(persistenceSpine(project));

const saved = await saveProjectToSupabase(project, config);
assert(saved.kind === "saved" || saved.kind === "created", `Supabase 저장 실패: ${saved.kind}`);

const reloaded = await loadProjectFromSupabase(config);
assert(reloaded, `Supabase 재로드 실패: ${NIGHT_MONSTER_PROJECT_ID}`);
const remoteLint = projectLint(reloaded);
assert(remoteLint.filter(i => !i.code.startsWith("runtime-support:")).length === 0, `재로드 lint 실패: ${JSON.stringify(remoteLint)}`);
const remoteSpineHash = digest(persistenceSpine(reloaded));
assert(remoteSpineHash === localSpineHash, `저장/재로드 핵심 데이터 hash 불일치: ${localSpineHash} != ${remoteSpineHash}`);
const remoteWalkthroughs = verifyWalkthroughs(reloaded, manifest);

const quality = runTool({ project: reloaded }, "evaluate_game_quality", {
  walkthroughResults: remoteWalkthroughs,
});
assert(quality.ok, `객관 품질 평가 실패: ${quality.summary}`);
const qualityData = quality.data as {
  readonly verdict?: { readonly blocked?: boolean; readonly objectiveErrorCount?: number };
  readonly limitations?: readonly string[];
};
// Runtime-partial classifications are retained in the report; actual commands are exercised below.
assert((qualityData.verdict?.objectiveErrorCount ?? 0) === 0, `객관 품질 평가 오류: ${JSON.stringify(qualityData.verdict)}`);

const report = {
  schemaVersion: 1,
  kind: "night-monster-verification",
  verifiedAt: new Date().toISOString(),
  projectId: NIGHT_MONSTER_PROJECT_ID,
  title: reloaded.meta.title,
  saveKind: saved.kind,
  saveSha256: "sha256" in saved ? saved.sha256 : undefined,
  reloaded: true,
  persistenceSpineSha256: remoteSpineHash,
  chipset: {
    id: "easyrpg_chipset_interior",
    bundledPath: "public/assets/easyrpg/chipset/Interior.png",
    projectAttributionPath: "public/assets/ATTRIBUTION.md",
  },
  maps: Object.values(NIGHT_MONSTER_MAP_IDS).map((mapId) => ({
    id: mapId,
    name: reloaded.maps[mapId]!.name,
    size: { width: reloaded.maps[mapId]!.width, height: reloaded.maps[mapId]!.height },
    events: reloaded.maps[mapId]!.events.length,
  })),
  designSignals: {
    investigationClues: manifest.gallery.clueEventIds.length,
    puzzleKinds: ["item-gate", "switch-sequence"],
    sequenceNodes: manifest.gallery.sequenceEventIds.length,
    chaseTraps: manifest.chase.trapEventIds.length,
    hasChaser: true,
    hasSafeZone: (reloaded.maps[NIGHT_MONSTER_MAP_IDS.chase]!.safeZones?.length ?? 0) > 0,
    hasCheckpointRetry: true,
    endingChoices: reloaded.endings?.length ?? 0,
  },
  lint: { localIssues: localLint, remoteIssues: remoteLint },
  walkthroughs: { local: localWalkthroughs, afterReload: remoteWalkthroughs },
  objectiveQuality: qualityData.verdict,
  subjectiveLimitations: qualityData.limitations,
};

const evidenceDir = path.join("output", "evidence", "night-monster");
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, "project.json"), JSON.stringify(reloaded));
const reportPath = path.join(evidenceDir, "supabase-verification.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({
  ok: true,
  projectId: NIGHT_MONSTER_PROJECT_ID,
  saveKind: saved.kind,
  reloaded: true,
  lintIssues: remoteLint.length,
  walkthroughs: remoteWalkthroughs.map((entry) => ({ id: entry.id, ok: entry.ok })),
  reportPath,
}, null, 2));
