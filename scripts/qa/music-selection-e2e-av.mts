#!/usr/bin/env bun
/**
 * Track B: 실제 조수 Pi v2 E2E + 맵 렌더 PNG·오디오 합성 MP4 블라인드 시청각 감사 러너
 *
 * 사용법:
 *   bun scripts/qa/music-selection-e2e-av.mts run --out <dir> [--seed 20261127]
 *   bun scripts/qa/music-selection-e2e-av.mts score --dir <dir> --verdicts <dir>/verdicts.json
 *
 * 흐름:
 *   1. 실제 Pi v2 조수(local-cli:claude · ASSISTANT_CLAUDE_MODEL)와 실서버 스토어(autoInstall:true)로 4개 시나리오 실행.
 *   2. 조수가 만든 실제 맵을 renderMapPng 로 PNG 렌더하고, project.assets.uploaded 에 설치된 실제 BGM 바이트를 추출.
 *   3. 맵 PNG + 설치된 BGM 을 ffmpeg 로 22초 MP4 로 합성(시청각 동시 판정용)하고, 숨긴 시청각 디코이 2건을 무작위 혼합.
 *   4. blind-av-packet.json(곡명·팩명·디코이 여부 마스킹)과 answer-key.json(정답지 밀봉)을 분리 저장.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ASSISTANT_CLAUDE_MODEL } from "@/ai/claudeDefault";
import { ASSISTANT_CHATGPT_MODEL } from "@/ai/chatgptDefault";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { resolveMapBgm } from "@/project/mapMusic";
import { storeMusicTracks, type StoreMusicTrack } from "@/assetStore/storeMusicPick";
import type { PiAgentEvent, PiAgentRequest } from "@/ai/piAgent/protocol";
import type { Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { resolveRequestApiKey } from "../lib/aiAuthRuntime";
import { runAssistantV2 } from "../lib/assistantV2Runtime";
import { configureWorkerStore } from "../lib/workerStore";
import { renderMapPng } from "../qa-game/render.mts";

const STORE_BASE = process.env.OPRN_STORE_URL?.trim() || "https://store.openrpgmaker.com";
const FFMPEG = existsSync("/home/main/.local/bin/ffmpeg") ? "/home/main/.local/bin/ffmpeg" : "ffmpeg";
const FFPROBE = existsSync("/home/main/.local/bin/ffprobe") ? "/home/main/.local/bin/ffprobe" : "ffprobe";

interface E2eScenario {
  readonly id: string;
  readonly title: string;
  readonly kind: "auto-map" | "explicit-roles";
  readonly prompt: string;
  readonly seedProject: () => Project;
}

function seedRoleProject(): Project {
  const project = createBlankProject();
  project.meta.title = "별빛의 서약";
  const ctx = { project };
  const startId = Object.keys(project.maps)[0]!;
  project.maps[startId]!.name = "버들 마을";
  runTool(ctx, "create_map", { id: "map_boss_chamber", name: "마왕의 성 최상층", width: 20, height: 15 }, { dryRun: false });
  runTool(ctx, "define_ending", {
    id: "ending_main",
    name: "별빛의 귀환",
    conditions: [],
    epilogue: [{ kind: "say", speaker: "주인공", text: "긴 여정이 마침내 끝났다." }],
  }, { dryRun: false });
  runTool(ctx, "upsert_event", {
    mapId: "map_boss_chamber",
    event: {
      id: "ev_boss",
      name: "붉은 드래곤",
      x: 10,
      y: 4,
      commands: [
        { kind: "text", body: "네 각오를 시험해 보겠다!" },
        { kind: "battleProcessing", troopId: "troop_dragon", canEscape: false, canLose: false },
        { kind: "triggerEnding", endingId: "ending_main" },
      ],
    },
  }, { dryRun: false });
  return ctx.project;
}

const SCENARIOS: readonly E2eScenario[] = [
  {
    id: "e2e-horror-school",
    title: "자동 맵 생성 · 폐교 공포 교실",
    kind: "auto-map",
    prompt: "폐교 2층 공포 교실 맵을 하나 만들어 줘.",
    seedProject: () => {
      const p = createBlankProject();
      p.meta.title = "폐교 괴담";
      return p;
    },
  },
  {
    id: "e2e-joseon-market",
    title: "자동 맵 생성 · 조선 한양 저잣거리",
    kind: "auto-map",
    prompt: "활기찬 조선 시대 한양 저잣거리 마을 맵을 하나 만들어 줘.",
    seedProject: () => {
      const p = createBlankProject();
      p.meta.title = "한양 기담";
      return p;
    },
  },
  {
    id: "e2e-fantasy-dungeon",
    title: "자동 맵 생성 · 고대 지하 동굴 던전",
    kind: "auto-map",
    prompt: "어둡고 신비로운 고대 지하 동굴 던전 맵을 하나 만들어 줘.",
    seedProject: () => {
      const p = createBlankProject();
      p.meta.title = "심연의 유적";
      return p;
    },
  },
  {
    id: "e2e-explicit-boss-ending",
    title: "명시 요청 · 심포닉 보스전 + 투더문 엔딩곡",
    kind: "explicit-roles",
    prompt: "이 게임의 붉은 드래곤 보스전에는 웅장한 심포닉 판타지 최종 보스전 음악을, 엔딩(ending_main)에는 투더문 느낌의 잔잔한 피아노 엔딩곡을 스토어에서 찾아서 바로 설치하고 연결해 줘.",
    seedProject: seedRoleProject,
  },
];

function decodeDataUrlToFile(dataUrl: string, outPath: string): boolean {
  const m = /^data:[^;]+;base64,(.+)$/su.exec(dataUrl);
  if (!m) return false;
  writeFileSync(outPath, Buffer.from(m[1]!, "base64"));
  return true;
}

function probeDurationSec(audioPath: string): number {
  const res = spawnSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioPath], { encoding: "utf8" });
  const val = Number.parseFloat((res.stdout ?? "").trim());
  return Number.isFinite(val) ? Math.round(val * 10) / 10 : 0;
}

function muxPngAndAudioToMp4(pngPath: string, audioPath: string, mp4Path: string, maxSec = 22): void {
  const res = spawnSync(FFMPEG, [
    "-y", "-v", "error",
    "-loop", "1", "-framerate", "2", "-i", pngPath,
    "-i", audioPath,
    "-t", String(maxSec),
    "-vf", "scale=w='min(960,iw*2)':h=-2:flags=neighbor,pad=ceil(iw/2)*2:ceil(ih/2)*2",
    "-c:v", "libx264", "-tune", "stillimage", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-shortest",
    mp4Path,
  ], { encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(`ffmpeg mux failed: ${res.stderr}`);
  }
}

async function downloadStoreBlobTo(slug: string, assetId: string, outPath: string): Promise<{ titleKo: string; genre: string }> {
  const itemRes = await fetch(`${STORE_BASE}/api/v1/items/${encodeURIComponent(slug)}`);
  const item = (await itemRes.json()) as { latestVersion: number };
  const mRes = await fetch(`${STORE_BASE}/api/v1/items/${encodeURIComponent(slug)}/versions/${item.latestVersion}/manifest`);
  const manifest = (await mRes.json()) as { content: { assets: Record<string, { id: string; blob: string; name: string; meta?: any }> } };
  const asset = manifest.content.assets[assetId];
  if (!asset) throw new Error(`Decoy asset ${slug}/${assetId} not found`);
  const bRes = await fetch(`${STORE_BASE}/api/v1/blobs/${encodeURIComponent(asset.blob)}`);
  writeFileSync(outPath, Buffer.from(await bRes.arrayBuffer()));
  return {
    titleKo: asset.meta?.oprnMusic?.title?.ko ?? asset.name,
    genre: asset.meta?.oprnMusic?.genre ?? slug,
  };
}

async function runSingleScenario(sc: E2eScenario, workDir: string, provider: string, model: string, apiKey?: string) {
  const baseProject = sc.seedProject();
  const baseMapIds = new Set(Object.keys(baseProject.maps));
  const events: PiAgentEvent[] = [];
  const storeNotes: unknown[] = [];
  const toolCalls: { name: string; ok?: boolean; summary?: string }[] = [];

  configureWorkerStore({ url: STORE_BASE, autoInstall: true }, sc.prompt);

  const req: PiAgentRequest = {
    task: sc.prompt,
    project: baseProject,
    mapIds: [],
    scopeStrict: false,
    currentMapId: baseProject.startMapId,
    provider,
    model,
    thinkingLevel: "medium",
    assistantVersion: "v2",
    store: { url: STORE_BASE, autoInstall: true },
    dialoguePolish: false,
    assistantRoles: { advisor: "off" },
    maxTurns: 18,
  };

  console.log(`\n[E2E] Running real Pi v2 assistant (${provider}/${model}): ${sc.id} ("${sc.prompt}")`);
  const t0 = Date.now();
  const done = await runAssistantV2(req, {
    apiKey,
    signal: AbortSignal.timeout(180_000),
    onEvent: (ev) => {
      events.push(ev);
      if (ev.type === "tool_start") {
        console.log(`  [tool_start] ${ev.name}`);
      } else if (ev.type === "tool_end") {
        console.log(`  [tool_end] ${ev.name} ok=${ev.ok} — ${(ev.summary ?? "").slice(0, 90)}`);
        toolCalls.push({ name: ev.name, ok: ev.ok, summary: ev.summary });
        const data = (ev.result as { data?: { kind?: string } } | undefined)?.data;
        if (data?.kind === "store-music-choice") {
          storeNotes.push(data);
        }
      } else if (ev.type === "error") {
        console.log(`  [error] ${ev.message}`);
      } else if (ev.type === "execution_status") {
        console.log(`  [status] ${ev.name}: ${(ev.summary ?? "").slice(0, 100)}`);
      }
    },
  });
  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[E2E] Done ${sc.id} in ${elapsedSec}s | turns=${done.stats.turns} toolCalls=${done.stats.toolCalls} storeNotes=${storeNotes.length}`);

  const proj = done.project;
  const scDir = resolve(workDir, sc.id);
  mkdirSync(scDir, { recursive: true });
  writeFileSync(resolve(scDir, "summary.json"), JSON.stringify({
    scenario: sc.id,
    elapsedSec: Number(elapsedSec),
    stats: done.stats,
    stoppedEarly: done.stoppedEarly ?? null,
    toolCalls,
    storeNotesCount: storeNotes.length,
    storeNotes,
    uploadedMusic: Object.entries(proj.assets.uploaded)
      .filter(([, a]) => a.kind === "music")
      .map(([id, a]) => ({ id, name: a.name, meta: (a as any).meta?.oprnMusic ?? null })),
  }, null, 2));

  return { sc, baseMapIds, proj, storeNotes, toolCalls, elapsedSec: Number(elapsedSec) };
}

interface AvPending {
  readonly isDecoy: boolean;
  readonly caseId: string;
  readonly scenarioTitle: string;
  readonly prompt: string;
  readonly role: string;
  readonly mapName: string;
  readonly pngPath: string;
  readonly rawAudioPath: string;
  readonly resourceId: string;
  readonly trackTitle: string;
  readonly packOrGenre: string;
  readonly decoyReason?: string;
  readonly storeNoteEmitted?: boolean;
}

async function cmdRun(outDir: string, seedNum: number, onlySet?: Set<string>, providerFlag?: string, modelFlag?: string) {
  mkdirSync(outDir, { recursive: true });
  const runsDir = resolve(outDir, "runs");
  const mp4Dir = resolve(outDir, "mp4");
  const rawDir = resolve(outDir, "raw");
  const pngDir = resolve(outDir, "png");
  for (const d of [runsDir, mp4Dir, rawDir, pngDir]) mkdirSync(d, { recursive: true });

  const codexKey = await resolveRequestApiKey("openai-codex").catch(() => undefined);
  const provider = providerFlag ?? (codexKey ? "openai-codex" : "local-cli:claude");
  const model = modelFlag ?? (provider === "openai-codex" ? ASSISTANT_CHATGPT_MODEL : ASSISTANT_CLAUDE_MODEL);
  const apiKey = provider.startsWith("local-cli:") ? undefined : await resolveRequestApiKey(provider).catch(() => undefined);

  const pending: AvPending[] = [];
  const e2eChecks: { id: string; ok: boolean; detail: string }[] = [];
  let horrorPngForDecoy: { pngPath: string; mapName: string; prompt: string } | null = null;
  let joseonPngForDecoy: { pngPath: string; mapName: string; prompt: string } | null = null;

  for (const sc of SCENARIOS) {
    if (onlySet && !onlySet.has(sc.id)) continue;
    const res = await runSingleScenario(sc, runsDir, provider, model, apiKey);
    const { proj, baseMapIds, storeNotes } = res;

    if (sc.kind === "auto-map") {
      // Find newly created map(s) or modified start map
      const newMaps = Object.values(proj.maps).filter((m) => !baseMapIds.has(m.id));
      const targetMap = newMaps[0] ?? proj.maps[proj.startMapId]!;
      const resolvedBgm = resolveMapBgm(proj, targetMap);
      const uploaded = resolvedBgm ? proj.assets.uploaded[resolvedBgm] : undefined;
      const isStoreUploaded = Boolean(uploaded && uploaded.kind === "music");
      const pngPath = resolve(pngDir, `${sc.id}.png`);
      writeFileSync(pngPath, renderMapPng(proj, targetMap).png);

      if (sc.id === "e2e-horror-school") horrorPngForDecoy = { pngPath, mapName: targetMap.name, prompt: sc.prompt };
      if (sc.id === "e2e-joseon-market") joseonPngForDecoy = { pngPath, mapName: targetMap.name, prompt: sc.prompt };

      e2eChecks.push({
        id: sc.id,
        ok: isStoreUploaded && storeNotes.length > 0,
        detail: `map="${targetMap.name}" (${targetMap.width}x${targetMap.height}) | bgm=${resolvedBgm ?? "none"} | uploaded=${isStoreUploaded} | noteCards=${storeNotes.length}`,
      });

      if (isStoreUploaded && uploaded?.dataUrl) {
        const audioPath = resolve(rawDir, `${sc.id}.ogg`);
        decodeDataUrlToFile(uploaded.dataUrl, audioPath);
        const oprn = (uploaded as any).meta?.oprnMusic;
        pending.push({
          isDecoy: false,
          caseId: sc.id,
          scenarioTitle: sc.title,
          prompt: sc.prompt,
          role: "map-auto-bgm",
          mapName: targetMap.name,
          pngPath,
          rawAudioPath: audioPath,
          resourceId: resolvedBgm!,
          trackTitle: oprn?.title?.ko || uploaded.name,
          packOrGenre: oprn?.genre || "store",
          storeNoteEmitted: storeNotes.length > 0,
        });
      }
    } else {
      // Explicit roles: boss troop BGM + ending BGM
      const bossMap = proj.maps["map_boss_chamber"] ?? Object.values(proj.maps)[0]!;
      const bossPng = resolve(pngDir, `${sc.id}-boss.png`);
      writeFileSync(bossPng, renderMapPng(proj, bossMap).png);

      const startMap = proj.maps[proj.startMapId]!;
      const endingPng = resolve(pngDir, `${sc.id}-ending.png`);
      writeFileSync(endingPng, renderMapPng(proj, startMap).png);

      const dragonTroop = (proj.database.troops as any[]).find((t) => t.id === "troop_dragon");
      const bossBgmId: string | undefined = dragonTroop?.battleBgmResourceId ?? proj.system.battleBgmResourceId;
      const endingObj = (proj.database.endings as any[] | undefined)?.find((e) => e.id === "ending_main");
      const endingBgmId: string | undefined = endingObj?.bgmResourceId ?? endingObj?.musicResourceId ?? (proj.system as any).endingBgmResourceId;

      const bossAsset = bossBgmId ? proj.assets.uploaded[bossBgmId] : undefined;
      const endingAsset = endingBgmId ? proj.assets.uploaded[endingBgmId] : undefined;

      e2eChecks.push({
        id: `${sc.id}-boss`,
        ok: Boolean(bossAsset && bossAsset.kind === "music"),
        detail: `bossBgm=${bossBgmId ?? "none"} | uploaded=${Boolean(bossAsset)}`,
      });
      e2eChecks.push({
        id: `${sc.id}-ending`,
        ok: Boolean(endingAsset && endingAsset.kind === "music"),
        detail: `endingBgm=${endingBgmId ?? "none"} | uploaded=${Boolean(endingAsset)}`,
      });

      if (bossAsset?.dataUrl && bossBgmId) {
        const audioPath = resolve(rawDir, `${sc.id}-boss.ogg`);
        decodeDataUrlToFile(bossAsset.dataUrl, audioPath);
        const oprn = (bossAsset as any).meta?.oprnMusic;
        pending.push({
          isDecoy: false,
          caseId: `${sc.id}-boss`,
          scenarioTitle: "실제 조수 명시 지정 · 심포닉 최종 보스전",
          prompt: "붉은 드래곤 보스전 — 웅장한 심포닉 판타지 최종 보스전 음악",
          role: "boss",
          mapName: bossMap.name,
          pngPath: bossPng,
          rawAudioPath: audioPath,
          resourceId: bossBgmId,
          trackTitle: oprn?.title?.ko || bossAsset.name,
          packOrGenre: oprn?.genre || "store",
        });
      }
      if (endingAsset?.dataUrl && endingBgmId) {
        const audioPath = resolve(rawDir, `${sc.id}-ending.ogg`);
        decodeDataUrlToFile(endingAsset.dataUrl, audioPath);
        const oprn = (endingAsset as any).meta?.oprnMusic;
        pending.push({
          isDecoy: false,
          caseId: `${sc.id}-ending`,
          scenarioTitle: "실제 조수 명시 지정 · 투더문 피아노 엔딩곡",
          prompt: "별빛의 귀환 엔딩 — 투더문 느낌의 잔잔한 피아노 엔딩곡",
          role: "ending",
          mapName: startMap.name,
          pngPath: endingPng,
          rawAudioPath: audioPath,
          resourceId: endingBgmId,
          trackTitle: oprn?.title?.ko || endingAsset.name,
          packOrGenre: oprn?.genre || "store",
        });
      }
    }
  }

  // Inject 2 hidden audio-visual decoys using the exact real rendered map PNGs!
  if (horrorPngForDecoy) {
    const decoyAudio = resolve(rawDir, "decoy-horror-cafe.ogg");
    const info = await downloadDecoyTrack((t) => t.music.genre === "romance" && t.music.scenes.includes("town"), decoyAudio);
    pending.push({
      isDecoy: true,
      caseId: "av-decoy-1",
      scenarioTitle: "자동 맵 생성 · 폐교 공포 교실",
      prompt: horrorPngForDecoy.prompt,
      role: "map-auto-bgm",
      mapName: horrorPngForDecoy.mapName,
      pngPath: horrorPngForDecoy.pngPath,
      rawAudioPath: decoyAudio,
      resourceId: "decoy-romance",
      trackTitle: info.titleKo,
      packOrGenre: info.genre,
      decoyReason: "어두운 폐교 공포 교실 렌더 화면에 밝은 연애 일상곡 합성",
    });
  }
  if (joseonPngForDecoy) {
    const decoyAudio = resolve(rawDir, "decoy-joseon-scifi.ogg");
    const info = await downloadDecoyTrack((t) => t.music.genre === "scifi" && t.music.scenes.includes("dungeon"), decoyAudio);
    pending.push({
      isDecoy: true,
      caseId: "av-decoy-2",
      scenarioTitle: "자동 맵 생성 · 조선 한양 저잣거리",
      prompt: joseonPngForDecoy.prompt,
      role: "map-auto-bgm",
      mapName: joseonPngForDecoy.mapName,
      pngPath: joseonPngForDecoy.pngPath,
      rawAudioPath: decoyAudio,
      resourceId: "decoy-scifi",
      trackTitle: info.titleKo,
      packOrGenre: info.genre,
      decoyReason: "조선 한양 저잣거리 렌더 화면에 어두운 SF 우주 던전 전자음 합성",
    });
  }

  // Shuffle deterministically
  const rng = mulberry32(seedNum);
  for (let i = pending.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pending[i], pending[j]] = [pending[j]!, pending[i]!];
  }

  const blindItems = [];
  const answerKey: Record<string, unknown> = {};

  console.log(`\n[mux] Rendering ${pending.length} blinded audio-visual MP4 clips...`);
  for (let i = 0; i < pending.length; i += 1) {
    const p = pending[i]!;
    const sampleId = `av${String(i + 1).padStart(2, "0")}`;
    const mp4Path = resolve(mp4Dir, `${sampleId}.mp4`);
    const durationSec = probeDurationSec(p.rawAudioPath);
    muxPngAndAudioToMp4(p.pngPath, p.rawAudioPath, mp4Path, 22);

    blindItems.push({
      sampleId,
      prompt: p.prompt,
      role: p.role,
      mapName: p.mapName,
      fullAudioDurationSec: durationSec,
      mp4Path,
    });
    answerKey[sampleId] = {
      sampleId,
      ...p,
      fullAudioDurationSec: durationSec,
      mp4Path,
    };
  }

  console.log("\n=== Track B Mechanical E2E Checks ===");
  for (const c of e2eChecks) {
    console.log(`  [${c.ok ? "PASS" : "FAIL"}] ${c.id} — ${c.detail}`);
  }

  writeFileSync(resolve(outDir, "blind-av-packet.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    model: `${provider}/${model}`,
    totalSamples: blindItems.length,
    note: "BLIND AV PACKET: Watch & listen to each MP4 before opening answer-key.json.",
    items: blindItems,
  }, null, 2));

  writeFileSync(resolve(outDir, "answer-key.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    e2eChecks,
    entries: answerKey,
  }, null, 2));

  console.log(`\n[done] Blind AV packet: ${resolve(outDir, "blind-av-packet.json")}`);
  console.log(`[done] Answer key sealed: ${resolve(outDir, "answer-key.json")}`);
}

interface AvVerdict {
  readonly sampleId: string;
  readonly score: number;
  readonly pass: boolean;
  readonly seenAndHeard: string;
  readonly reason: string;
  readonly failCode?: string;
}

function cmdScore(dir: string, verdictsPath: string) {
  const keyDoc = JSON.parse(readFileSync(resolve(dir, "answer-key.json"), "utf8")) as {
    e2eChecks: { id: string; ok: boolean; detail: string }[];
    entries: Record<string, any>;
  };
  const vDoc = JSON.parse(readFileSync(verdictsPath, "utf8")) as { verdicts: AvVerdict[] };
  const byId = new Map(vDoc.verdicts.map((v) => [v.sampleId, v]));
  const ids = Object.keys(keyDoc.entries).sort();

  const decoys: any[] = [];
  const reals: any[] = [];
  for (const id of ids) {
    const t = keyDoc.entries[id]!;
    const v = byId.get(id);
    if (!v) { console.error(`Missing verdict for ${id}`); process.exit(1); }
    const effectivePass = v.pass && v.score >= 3.5;
    const merged = { ...t, verdict: v, effectivePass };
    if (t.isDecoy) decoys.push(merged);
    else reals.push(merged);
  }

  const leaked = decoys.filter((d) => d.effectivePass);
  const valid = leaked.length === 0;
  const passed = reals.filter((r) => r.effectivePass);
  const mean = reals.reduce((s, r) => s + r.verdict.score, 0) / Math.max(1, reals.length);

  console.log("\n========================================================");
  console.log(`  TRACK B AV-MP4 BLIND AUDIT — ${valid ? "VALID BATCH (100% DECOY CATCH)" : "INVALID BATCH (DECOY LEAKED!)"}`);
  console.log("========================================================");
  console.log(`Decoys caught: ${decoys.length - leaked.length} / ${decoys.length}`);
  console.log(`Real E2E AV cases passed: ${passed.length} / ${reals.length} | Mean score: ${mean.toFixed(2)} / 5.00`);
  console.log("\n--- Real E2E Results ---");
  for (const r of reals) {
    console.log(`  [${r.effectivePass ? "PASS" : "FAIL"}] ${r.caseId} (${r.sampleId}) score=${r.verdict.score} | map="${r.mapName}" | track="${r.trackTitle}" (${r.packOrGenre}, ${r.fullAudioDurationSec}s)`);
    console.log(`         AV: ${r.verdict.seenAndHeard}`);
  }
  console.log("\n--- Decoy Catch Results ---");
  for (const d of decoys) {
    console.log(`  [${!d.effectivePass ? "CAUGHT" : "LEAKED"}] ${d.caseId} (${d.sampleId}) score=${d.verdict.score} | ${d.decoyReason}`);
  }
  writeFileSync(resolve(dir, "graded-av-report.json"), JSON.stringify({
    gradedAt: new Date().toISOString(),
    batchValid: valid,
    decoyCaught: decoys.length - leaked.length,
    decoyTotal: decoys.length,
    realPassed: passed.length,
    realTotal: reals.length,
    realMeanScore: Number(mean.toFixed(2)),
    e2eChecks: keyDoc.e2eChecks,
    reals,
    decoys,
  }, null, 2));
  if (!valid) process.exit(2);
}

async function fetchAllStoreTracks(): Promise<StoreMusicTrack[]> {
  const r = await fetch(`${STORE_BASE}/api/v1/items?kind=music&limit=100`);
  const items = ((await r.json()) as { items: any[] }).items ?? [];
  const all: StoreMusicTrack[] = [];
  for (const item of items) {
    const mRes = await fetch(`${STORE_BASE}/api/v1/items/${encodeURIComponent(item.slug)}/versions/${item.latestVersion}/manifest`);
    if (!mRes.ok) continue;
    const manifest = (await mRes.json()) as any;
    all.push(...storeMusicTracks(item, manifest));
  }
  return all;
}

async function downloadDecoyTrack(
  matcher: (track: StoreMusicTrack) => boolean,
  outPath: string,
  allTracks?: readonly StoreMusicTrack[],
): Promise<{ titleKo: string; genre: string }> {
  const list = allTracks ?? await fetchAllStoreTracks();
  const hit = list.find(matcher);
  if (!hit) throw new Error("No matching decoy track found on store");
  const bRes = await fetch(`${STORE_BASE}/api/v1/blobs/${encodeURIComponent(hit.blob)}`);
  writeFileSync(outPath, Buffer.from(await bRes.arrayBuffer()));
  return { titleKo: hit.titleKo || hit.name, genre: hit.music.genre };
}

async function cmdMuxFromRuns(outDir: string, seedNum: number) {
  const runsDir = resolve(outDir, "runs");
  const mp4Dir = resolve(outDir, "mp4");
  const rawDir = resolve(outDir, "raw");
  const pngDir = resolve(outDir, "png");
  for (const d of [mp4Dir, rawDir]) mkdirSync(d, { recursive: true });

  const allTracks = await fetchAllStoreTracks();

  const pending: AvPending[] = [];
  const e2eChecks: { id: string; ok: boolean; detail: string }[] = [];
  let horrorPng: { pngPath: string; mapName: string; prompt: string } | null = null;
  let joseonPng: { pngPath: string; mapName: string; prompt: string } | null = null;

  const findTrack = (u: { id: string; name: string; meta: any } | undefined) =>
    u
      ? (allTracks.find((t) => u.id.endsWith(t.assetId))
        ?? allTracks.find((t) => u.meta?.title?.ko && t.titleKo === u.meta.title.ko && (!u.meta?.genre || t.music.genre === u.meta.genre)))
      : undefined;

  for (const sc of SCENARIOS) {
    const sumPath = resolve(runsDir, sc.id, "summary.json");
    if (!existsSync(sumPath)) continue;
    const sum = JSON.parse(readFileSync(sumPath, "utf8")) as any;
    const uploaded: { id: string; name: string; meta: any }[] = sum.uploadedMusic ?? [];

    if (sc.kind === "auto-map") {
      const u = uploaded[0];
      const pngPath = resolve(pngDir, `${sc.id}.png`);
      const mapName = sum.storeNotes?.[0]?.need?.replace(/^「|」.*$/gu, "") || sc.title;
      if (sc.id === "e2e-horror-school") horrorPng = { pngPath, mapName, prompt: sc.prompt };
      if (sc.id === "e2e-joseon-market") joseonPng = { pngPath, mapName, prompt: sc.prompt };

      const storeHit = findTrack(u);
      e2eChecks.push({
        id: sc.id,
        ok: Boolean(u && storeHit && sum.storeNotesCount > 0),
        detail: `map="${mapName}" | uploaded=${u?.id ?? "none"} | noteCards=${sum.storeNotesCount}`,
      });
      if (u && storeHit && existsSync(pngPath)) {
        const audioPath = resolve(rawDir, `${sc.id}.ogg`);
        const bRes = await fetch(`${STORE_BASE}/api/v1/blobs/${encodeURIComponent(storeHit.blob)}`);
        writeFileSync(audioPath, Buffer.from(await bRes.arrayBuffer()));
        pending.push({
          isDecoy: false,
          caseId: sc.id,
          scenarioTitle: sc.title,
          prompt: sc.prompt,
          role: "map-auto-bgm",
          mapName,
          pngPath,
          rawAudioPath: audioPath,
          resourceId: u.id,
          trackTitle: storeHit.titleKo || u.name,
          packOrGenre: storeHit.music.genre,
          storeNoteEmitted: sum.storeNotesCount > 0,
        });
      }
    } else {
      const roles = [
        { key: "boss", png: resolve(pngDir, `${sc.id}-boss.png`), mapName: "마왕의 성 최상층", prompt: "붉은 드래곤 보스전 — 웅장한 심포닉 판타지 최종 보스전 음악", match: (u: any) => u.meta?.scenes?.includes("boss") || /boss|symphonic/iu.test(u.id) },
        { key: "ending", png: resolve(pngDir, `${sc.id}-ending.png`), mapName: "버들 마을 (엔딩)", prompt: "별빛의 귀환 엔딩 — 투더문 느낌의 잔잔한 피아노 엔딩곡", match: (u: any) => u.meta?.scenes?.includes("ending") || /piano|ending/iu.test(u.id) },
      ];
      for (const role of roles) {
        const u = uploaded.find(role.match);
        const storeHit = findTrack(u);
        e2eChecks.push({
          id: `${sc.id}-${role.key}`,
          ok: Boolean(u && storeHit),
          detail: `role=${role.key} | uploaded=${u?.id ?? "none"} | noteCards=${sum.storeNotesCount}`,
        });
        if (u && storeHit && existsSync(role.png)) {
          const audioPath = resolve(rawDir, `${sc.id}-${role.key}.ogg`);
          const bRes = await fetch(`${STORE_BASE}/api/v1/blobs/${encodeURIComponent(storeHit.blob)}`);
          writeFileSync(audioPath, Buffer.from(await bRes.arrayBuffer()));
          pending.push({
            isDecoy: false,
            caseId: `${sc.id}-${role.key}`,
            scenarioTitle: `실제 조수 명시 지정 · ${role.key}`,
            prompt: role.prompt,
            role: role.key,
            mapName: role.mapName,
            pngPath: role.png,
            rawAudioPath: audioPath,
            resourceId: u.id,
            trackTitle: storeHit.titleKo || u.name,
            packOrGenre: storeHit.music.genre,
          });
        }
      }
    }
  }

  // Inject 2 hidden AV decoys on the real rendered PNGs
  if (horrorPng && existsSync(horrorPng.pngPath)) {
    const decoyAudio = resolve(rawDir, "decoy-horror-cafe.ogg");
    const info = await downloadDecoyTrack((t) => t.music.genre === "romance" && t.music.scenes.includes("town"), decoyAudio, allTracks);
    pending.push({
      isDecoy: true, caseId: "av-decoy-1", scenarioTitle: "자동 맵 생성 · 폐교 공포 교실",
      prompt: horrorPng.prompt, role: "map-auto-bgm", mapName: horrorPng.mapName,
      pngPath: horrorPng.pngPath, rawAudioPath: decoyAudio, resourceId: "decoy-romance",
      trackTitle: info.titleKo, packOrGenre: info.genre,
      decoyReason: "폐교 공포 교실 렌더 화면에 밝은 연애 일상 카페곡 합성",
    });
  }
  if (joseonPng && existsSync(joseonPng.pngPath)) {
    const decoyAudio = resolve(rawDir, "decoy-joseon-scifi.ogg");
    const info = await downloadDecoyTrack((t) => t.music.genre === "scifi" && t.music.scenes.includes("dungeon"), decoyAudio, allTracks);
    pending.push({
      isDecoy: true, caseId: "av-decoy-2", scenarioTitle: "자동 맵 생성 · 조선 한양 저잣거리",
      prompt: joseonPng.prompt, role: "map-auto-bgm", mapName: joseonPng.mapName,
      pngPath: joseonPng.pngPath, rawAudioPath: decoyAudio, resourceId: "decoy-scifi",
      trackTitle: info.titleKo, packOrGenre: info.genre,
      decoyReason: "조선 한양 저잣거리 렌더 화면에 어두운 SF 우주 던전 전자음 합성",
    });
  }

  const rng = mulberry32(seedNum);
  for (let i = pending.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pending[i], pending[j]] = [pending[j]!, pending[i]!];
  }

  const blindItems = [];
  const answerKey: Record<string, unknown> = {};
  console.log(`\n[mux] Muxing ${pending.length} blinded audio-visual MP4 clips (${pending.filter((p) => !p.isDecoy).length} real E2E + ${pending.filter((p) => p.isDecoy).length} hidden AV decoys)...`);
  for (let i = 0; i < pending.length; i += 1) {
    const p = pending[i]!;
    const sampleId = `av${String(i + 1).padStart(2, "0")}`;
    const mp4Path = resolve(mp4Dir, `${sampleId}.mp4`);
    const durationSec = probeDurationSec(p.rawAudioPath);
    muxPngAndAudioToMp4(p.pngPath, p.rawAudioPath, mp4Path, 20);
    blindItems.push({ sampleId, prompt: p.prompt, role: p.role, mapName: p.mapName, fullAudioDurationSec: durationSec, mp4Path });
    answerKey[sampleId] = { sampleId, ...p, fullAudioDurationSec: durationSec, mp4Path };
  }

  console.log("\n=== Track B Mechanical E2E Checks ===");
  for (const c of e2eChecks) console.log(`  [${c.ok ? "PASS" : "FAIL"}] ${c.id} — ${c.detail}`);

  writeFileSync(resolve(outDir, "blind-av-packet.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    model: `openai-codex/${ASSISTANT_CHATGPT_MODEL}`,
    totalSamples: blindItems.length,
    note: "BLIND AV PACKET: Watch & listen to each MP4 before opening answer-key.json.",
    items: blindItems,
  }, null, 2));
  writeFileSync(resolve(outDir, "answer-key.json"), JSON.stringify({ generatedAt: new Date().toISOString(), e2eChecks, entries: answerKey }, null, 2));
  console.log(`\n[done] Blind AV packet: ${resolve(outDir, "blind-av-packet.json")}`);
  console.log(`[done] Answer key sealed: ${resolve(outDir, "answer-key.json")}`);
}

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };

if (cmd === "run") {
  const out = resolve(flag("out") ?? "qa-runs/music-audit-trackb");
  const seed = Number.parseInt(flag("seed") ?? "20261127", 10);
  const onlyRaw = flag("only");
  const onlySet = onlyRaw ? new Set(onlyRaw.split(",").map((s) => s.trim()).filter(Boolean)) : undefined;
  await cmdRun(out, seed, onlySet, flag("provider"), flag("model"));
} else if (cmd === "mux-from-runs") {
  const out = resolve(flag("out") ?? "qa-runs/music-audit-trackb");
  const seed = Number.parseInt(flag("seed") ?? "20261127", 10);
  await cmdMuxFromRuns(out, seed);
} else if (cmd === "score") {
  const dir = resolve(flag("dir") ?? "qa-runs/music-audit-trackb");
  const verdicts = resolve(flag("verdicts") ?? resolve(dir, "verdicts.json"));
  cmdScore(dir, verdicts);
} else {
  console.error("Usage:\n  bun scripts/qa/music-selection-e2e-av.mts run --out <dir> [--seed N]\n  bun scripts/qa/music-selection-e2e-av.mts score --dir <dir> --verdicts <file>");
  process.exit(1);
}
