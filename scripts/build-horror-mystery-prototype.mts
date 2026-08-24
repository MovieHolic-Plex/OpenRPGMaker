import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import {
  HORROR_MYSTERY_ENDING_IDS,
  HORROR_MYSTERY_ITEM_ID,
  HORROR_MYSTERY_MAP_IDS,
  HORROR_MYSTERY_PROJECT_ID,
  HORROR_MYSTERY_SWITCH_IDS,
  createHorrorMysteryPrototypeProject,
  type HorrorMysteryPrototypeManifest,
} from "../src/project/examples/horrorMysteryPrototype.ts";
import { projectLint } from "../src/project/lint/projectLint.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types.ts";
import { runSceneTest, type SceneTestInput } from "../src/testing/sceneTestRunner.ts";
import { loadSupabaseEnvironment } from "./lib/supabase-database-ops.mjs";

const env = loadSupabaseEnvironment();
const config = {
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: HORROR_MYSTERY_PROJECT_ID,
};

if (!config.url || !config.anonKey) {
  throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 .env 또는 .env.local에 필요합니다.");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function persistenceSpine(project: Project): unknown {
  return {
    title: project.meta.title,
    startMapId: project.startMapId,
    startPos: project.startPos,
    maps: Object.fromEntries(Object.values(HORROR_MYSTERY_MAP_IDS).map((mapId) => {
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
        eventIds: map.events.map((event) => event.id).sort(),
      }];
    })),
    endings: (project.endings ?? []).map((ending) => ending.id).sort(),
  };
}

function walkthroughInputs(project: Project, manifest: HorrorMysteryPrototypeManifest): Array<{ id: string; input: SceneTestInput }> {
  const galleryExit = project.maps[HORROR_MYSTERY_MAP_IDS.gallery]?.events.find(
    (event) => event.id === manifest.gallery.exitEventId,
  );
  assert(galleryExit, "갤러리 출구 이벤트가 없습니다.");
  const [left, center, right] = manifest.gallery.sequenceAt;
  assert(left && center && right, "순서 퍼즐 좌표가 부족합니다.");
  const chaseStart = { x: manifest.chase.chaserAt.x - 2, y: manifest.chase.chaserAt.y };

  return [
    {
      id: "gallery-key-sequence-transfer",
      input: {
        mapId: HORROR_MYSTERY_MAP_IDS.gallery,
        start: manifest.gallery.keyAt,
        steps: [
          { kind: "interact" },
          { kind: "expect", inventoryCount: { itemId: HORROR_MYSTERY_ITEM_ID, count: 1 } },
          { kind: "set", x: manifest.gallery.itemGateAt.x, y: manifest.gallery.itemGateAt.y },
          { kind: "interact" },
          { kind: "expect", switchOn: HORROR_MYSTERY_SWITCH_IDS.keyUsed, inventoryCount: { itemId: HORROR_MYSTERY_ITEM_ID, count: 0 } },
          { kind: "set", x: center.x, y: center.y },
          { kind: "interact" },
          { kind: "set", x: left.x, y: left.y },
          { kind: "interact" },
          { kind: "set", x: right.x, y: right.y },
          { kind: "interact" },
          { kind: "expect", switchOn: HORROR_MYSTERY_SWITCH_IDS.sequenceSolved },
          { kind: "set", x: galleryExit.x, y: galleryExit.y - 1 },
          { kind: "move", dir: "down" },
          { kind: "expect", mapId: HORROR_MYSTERY_MAP_IDS.chase },
        ],
      },
    },
    {
      id: "chase-death-checkpoint-retry",
      input: {
        mapId: HORROR_MYSTERY_MAP_IDS.chase,
        start: chaseStart,
        steps: [
          { kind: "wait", ticks: 140 },
          { kind: "expect", gameOver: true },
          { kind: "retryCheckpoint" },
          { kind: "expect", gameOver: false, playerAt: { ...chaseStart, mapId: HORROR_MYSTERY_MAP_IDS.chase } },
        ],
      },
    },
    {
      id: "truth-ending",
      input: {
        mapId: HORROR_MYSTERY_MAP_IDS.finale,
        start: manifest.finale.truthAt,
        steps: [
          { kind: "interact" },
          { kind: "expect", switchOn: HORROR_MYSTERY_SWITCH_IDS.truthHeard },
          { kind: "set", x: manifest.finale.truthEndingAt.x, y: manifest.finale.truthEndingAt.y },
          { kind: "interact" },
          { kind: "expect", endingReached: HORROR_MYSTERY_ENDING_IDS.truth },
        ],
      },
    },
    {
      id: "escape-ending",
      input: {
        mapId: HORROR_MYSTERY_MAP_IDS.finale,
        start: manifest.finale.escapeEndingAt,
        steps: [
          { kind: "interact" },
          { kind: "expect", endingReached: HORROR_MYSTERY_ENDING_IDS.escape },
        ],
      },
    },
  ];
}

function verifyWalkthroughs(project: Project, manifest: HorrorMysteryPrototypeManifest) {
  return walkthroughInputs(project, manifest).map(({ id, input }) => {
    const result = runSceneTest(project, input);
    assert(result.ok, `${id} 실패: ${result.failureReason ?? result.log.join(" / ")}`);
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

const { project, manifest } = createHorrorMysteryPrototypeProject();
const localLint = projectLint(project);
assert(localLint.length === 0, `로컬 lint 실패: ${JSON.stringify(localLint)}`);
const localWalkthroughs = verifyWalkthroughs(project, manifest);
const localSpineHash = digest(persistenceSpine(project));

const saved = await saveProjectToSupabase(project, config);
assert(saved.kind === "saved" || saved.kind === "created", `Supabase 저장 실패: ${saved.kind}`);

const reloaded = await loadProjectFromSupabase(config);
assert(reloaded, `Supabase 재로드 실패: ${HORROR_MYSTERY_PROJECT_ID}`);
const remoteLint = projectLint(reloaded);
assert(remoteLint.length === 0, `재로드 lint 실패: ${JSON.stringify(remoteLint)}`);
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
assert(qualityData.verdict?.blocked === false, `객관 품질 평가 차단: ${JSON.stringify(qualityData.verdict)}`);

const report = {
  schemaVersion: 1,
  kind: "horror-mystery-prototype-verification",
  verifiedAt: new Date().toISOString(),
  projectId: HORROR_MYSTERY_PROJECT_ID,
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
  maps: Object.values(HORROR_MYSTERY_MAP_IDS).map((mapId) => ({
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
    hasSafeZone: (reloaded.maps[HORROR_MYSTERY_MAP_IDS.chase]!.safeZones?.length ?? 0) > 0,
    hasCheckpointRetry: true,
    endingChoices: reloaded.endings?.length ?? 0,
  },
  lint: { localIssues: localLint.length, remoteIssues: remoteLint.length },
  walkthroughs: { local: localWalkthroughs, afterReload: remoteWalkthroughs },
  objectiveQuality: qualityData.verdict,
  subjectiveLimitations: qualityData.limitations,
};

const evidenceDir = path.join("output", "evidence", "horror-mystery-prototype");
fs.mkdirSync(evidenceDir, { recursive: true });
const reportPath = path.join(evidenceDir, "supabase-verification.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({
  ok: true,
  projectId: HORROR_MYSTERY_PROJECT_ID,
  saveKind: saved.kind,
  reloaded: true,
  lintIssues: remoteLint.length,
  walkthroughs: remoteWalkthroughs.map((entry) => ({ id: entry.id, ok: entry.ok })),
  reportPath,
}, null, 2));
