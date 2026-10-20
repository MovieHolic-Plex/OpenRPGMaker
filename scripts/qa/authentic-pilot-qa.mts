/**
 * Authentic pilot QA: the map and events come from the REAL gemini-4-argon editor assistant
 * (runSingleJrpgCase -> runPiAgent), never from hand-stamped harness code. The result is then
 * played in the real player.html and judged by (a) hard pixel/telemetry gates that were written to
 * fail on flat, empty, edge-clustered maps and (b) a blind multimodal judge that sees only the
 * user's prompt and the screenshots (no per-case answer checklist).
 *
 *   bun scripts/qa/authentic-pilot-qa.mts [--cases jrpg_016,jrpg_002] [--skip-assistant]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import type { GameEvent, GameMap, Project } from "../../src/project/types.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";
import "../lib/oauthClients.mjs";
import { resolveRequestApiKey } from "../lib/aiAuthRuntime.ts";
import { completeProvider } from "../lib/ohMyPiPiAiRuntime.ts";
import { runSingleJrpgCase, type SingleCaseExecutionResult } from "./jrpg-200-harness.mts";
import { JRPG_200_CASES, type JrpgCommandCase } from "./jrpg-200-cases.mts";
import {
  createQaContext,
  runLiveInGameBranch,
  type LiveInGameBranchTelemetry,
} from "./brutal-prompt-qa-pilot.mts";

const MODEL_PROVIDER = "google-antigravity" as const;
// 조수(argon)와 심판이 같은 Cloud Code 쿼터 풀을 쓰면 한쪽이 바닥날 때 파이프라인이 통째로 멈춘다(2026-10-16 429 로 4건 중단).
// 심판은 환경변수로 다른 공급자로 뗄 수 있다. 합격 기준(no 0개·score>=80·3표 중 2표)은 그대로다.
const JUDGE_PROVIDER = process.env.PILOT_JUDGE_PROVIDER ?? MODEL_PROVIDER;
const JUDGE_MODEL = process.env.PILOT_JUDGE_MODEL ?? "gemini-4-argon";
const PILOT_IDS = ["jrpg_016", "jrpg_002", "jrpg_003", "jrpg_046"];

interface Gate {
  id: string;
  passed: boolean;
  detail: string;
}

interface CaseResult {
  caseId: string;
  title: string;
  prompt: string;
  assistantToolCalls: string[];
  toolCallDetails: { name: string; ok: boolean; args: string; summary: string }[];
  events: GameEvent[];
  assistantReply: string;
  gates: Gate[];
  judge: { passed: boolean; score: number; critique: string; requirements?: unknown; votes?: number[] };
  overallPassed: boolean;
  mapPng: string;
  shotA: string;
  shotB: string;
}

// ---------------------------------------------------------------------------
// Hard image / map gates. Thresholds are deliberately strict; each gate quotes the measurement.
// ---------------------------------------------------------------------------

const CELL = 16;

function cellStats(png: PNG, mapW: number, mapH: number) {
  const cw = Math.floor(png.width / mapW);
  const ch = Math.floor(png.height / mapH);
  let flat = 0;
  const detailQuadrants = [0, 0, 0, 0];
  for (let cy = 0; cy < mapH; cy++) {
    for (let cx = 0; cx < mapW; cx++) {
      let n = 0, sr = 0, sg = 0, sb = 0, sr2 = 0, sg2 = 0, sb2 = 0;
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const i = ((cy * ch + y) * png.width + cx * cw + x) * 4;
          const r = png.data[i]!, g = png.data[i + 1]!, b = png.data[i + 2]!;
          n++; sr += r; sg += g; sb += b; sr2 += r * r; sg2 += g * g; sb2 += b * b;
        }
      }
      const v = (sr2 / n - (sr / n) ** 2) + (sg2 / n - (sg / n) ** 2) + (sb2 / n - (sb / n) ** 2);
      // Flat = almost no texture (solid fill / blank). Real autotile grass/stone has pixel noise.
      const isFlat = v < 60;
      if (isFlat) flat++;
      else detailQuadrants[(cy < mapH / 2 ? 0 : 2) + (cx < mapW / 2 ? 0 : 1)]!++;
    }
  }
  return { flatRatio: flat / (mapW * mapH), detailQuadrants, cells: mapW * mapH };
}

function mapGates(project: Project, map: GameMap, mapPng: PNG, beforeMapPng: PNG | undefined): Gate[] {
  const gates: Gate[] = [];
  const { flatRatio, detailQuadrants, cells } = cellStats(mapPng, map.width, map.height);
  // h1: one tile must not dominate the map (a meadow that is 80% the same grass tile is "blank").
  const lowerCount = new Map<number, number>();
  for (let i = 0; i < cells; i++) {
    const t = map.lowerTiles[i] ?? -1;
    lowerCount.set(t, (lowerCount.get(t) ?? 0) + 1);
  }
  const dominant = Math.max(...lowerCount.values());
  gates.push({
    id: "h1_no_dominant_tile",
    passed: dominant / cells <= 0.6 || flatRatio <= 0.35,
    detail: `가장 많은 바닥 타일이 전체의 ${((dominant / cells) * 100).toFixed(1)}% (60% 초과는 텍스처 없는 칸이 35% 이하여야 통과: 빈 평지만 잡는다). 텍스처 없는 칸 ${(flatRatio * 100).toFixed(1)}%`,
  });
  // h1b: the assistant must have actually changed the terrain/objects, not only added events.
  // Measured on rendered pixels (events excluded) — comparing tile arrays gave false positives from layer compaction.
  let changedCells = 0;
  if (beforeMapPng) {
    const cw = Math.floor(mapPng.width / map.width);
    const ch = Math.floor(mapPng.height / map.height);
    for (let cy = 0; cy < map.height; cy++) {
      for (let cx = 0; cx < map.width; cx++) {
        let diff = 0;
        for (let y = 0; y < ch && diff < 8; y++) {
          for (let x = 0; x < cw; x++) {
            const i = ((cy * ch + y) * mapPng.width + cx * cw + x) * 4;
            if (
              Math.abs(mapPng.data[i]! - (beforeMapPng.data[i] ?? 0)) +
                Math.abs(mapPng.data[i + 1]! - (beforeMapPng.data[i + 1] ?? 0)) +
                Math.abs(mapPng.data[i + 2]! - (beforeMapPng.data[i + 2] ?? 0)) > 40
            ) diff++;
          }
        }
        if (diff >= 8) changedCells++;
      }
    }
  }
  gates.push({
    id: "h1b_terrain_edited",
    passed: changedCells / cells >= 0.1,
    detail: `조수가 바꾼 그림상 칸 ${changedCells}/${cells} = ${((changedCells / cells) * 100).toFixed(1)}% (기준 10% 이상, 픽셀 비교)`,
  });
  const populated = detailQuadrants.filter((c) => c >= Math.max(6, cells * 0.04)).length;
  gates.push({
    id: "h2_spread",
    passed: populated >= 3,
    detail: `내용 있는 사분면 ${populated}/4 (기준 3 이상) — 사분면별 디테일 칸 ${detailQuadrants.join("/")}`,
  });
  const distinctLower = new Set<number>();
  let upperCells = 0;
  for (let i = 0; i < map.width * map.height; i++) {
    distinctLower.add(map.lowerTiles[i] ?? -1);
    if ((map.upperTiles[i] ?? -1) >= 0) upperCells++;
  }
  gates.push({
    id: "h3_variety",
    passed: distinctLower.size >= 4 && upperCells >= 12,
    detail: `바닥 타일 종류 ${distinctLower.size}(≥4), 위층 오브젝트 칸 ${upperCells}(≥12)`,
  });
  return gates;
}

function eventGates(testCase: JrpgCommandCase, map: GameMap, events: GameEvent[]): Gate[] {
  const gates: Gate[] = [];
  const near = events.filter(
    (e) => Math.abs(e.x - testCase.focusCoord.x) <= 2 && Math.abs(e.y - testCase.focusCoord.y) <= 2,
  );
  gates.push({
    id: "h4_trigger_near_focus",
    passed: near.length > 0,
    detail: `(${testCase.focusCoord.x},${testCase.focusCoord.y}) 반경 2칸 안 이벤트 ${near.length}개 (대상 이벤트 ${events.length}개: ${events
      .map((e) => `(${e.x},${e.y})`)
      .join(" ")})`,
  });
  return gates;
}

function quotedLines(prompt: string): string[] {
  const out: string[] = [];
  const re = /['"\u2018\u201c]([^'"\u2019\u201d]{4,})['"\u2019\u201d]/gu;
  for (const m of prompt.matchAll(re)) out.push(m[1]!);
  return out;
}

function branchGates(testCase: JrpgCommandCase, a: LiveInGameBranchTelemetry, b: LiveInGameBranchTelemetry): Gate[] {
  const gates: Gate[] = [];
  const norm = (t: string) => t.replace(/[\s■]+/gu, "").replace(/[.!?…,~\u2026]+/gu, "");
  const seen = norm([...(a.dialogueLines ?? []), ...(b.dialogueLines ?? [])].join("|"));
  const wanted = quotedLines(testCase.prompt);
  const missing = wanted.filter((q) => !seen.includes(norm(q)));
  gates.push({
    id: "h0_quoted_dialogue_played",
    passed: missing.length === 0,
    detail: wanted.length === 0 ? "프롬프트에 따옴표 대사 없음" : `요구 대사 ${wanted.length}개 중 게임에서 나온 것 ${wanted.length - missing.length}개${missing.length ? ` — 누락: ${missing.map((m) => `"${m}"`).join(", ")}` : ""}`,
  });
  const deathCase = testCase.id !== "jrpg_046";
  const fxA = a.screenEffectVisible || a.shakeIntensity > 0 || a.aliveParticles > 0;
  gates.push({
    id: "h5_fx_visible_branch_a",
    passed: fxA,
    detail: `분기A tint=${a.screenEffectVisible}(${a.screenEffectBg}) shake=${a.shakeIntensity} particles=${a.aliveParticles} weather=${a.weatherKind}`,
  });
  gates.push({
    id: "h6_audio_played",
    passed: a.audioObserved.length > 0,
    detail: `분기A 재생 SE=[${a.audioObserved.join(", ") || "없음"}]`,
  });
  if (deathCase) {
    gates.push({
      id: "h7_death_branch",
      passed: a.gameOverAfterAdvance,
      detail: `분기A 대사 "${a.dialogueText.slice(0, 60)}" 진행 후 GAME OVER=${a.gameOverAfterAdvance}`,
    });
    gates.push({
      id: "h8_survive_branch",
      passed: !b.gameOverAfterAdvance && b.dialogueVisible,
      detail: `분기B GAME OVER=${b.gameOverAfterAdvance}, 대사 표시=${b.dialogueVisible} "${b.dialogueText.slice(0, 60)}"`,
    });
  } else {
    gates.push({
      id: "h7_switch_set",
      passed: Boolean(b.switchesAfterAdvance["sw_masamune_awakened"]) || Boolean(a.switchesAfterAdvance["sw_masamune_awakened"]),
      detail: `sw_masamune_awakened A=${a.switchesAfterAdvance["sw_masamune_awakened"]} B=${b.switchesAfterAdvance["sw_masamune_awakened"]}`,
    });
  }
  if (/무너/u.test(testCase.prompt)) {
    gates.push({
      id: "h10_terrain_changed_in_play",
      passed: a.mapOverrideCount >= 1,
      detail: `분기A 플레이 중 바뀐 타일 ${a.mapOverrideCount}칸 (프롬프트가 지형 붕괴를 요구 — 1칸 이상)`,
    });
  }
  gates.push({
    id: "h9_no_errors",
    passed: a.pageErrors.length + b.pageErrors.length === 0 && !a.missingResourceError && !b.missingResourceError,
    detail: `pageErrors A=${a.pageErrors.length} B=${b.pageErrors.length}, missingResource A=${a.missingResourceError} B=${b.missingResourceError}`,
  });
  return gates;
}

// ---------------------------------------------------------------------------
// Blind judge: user prompt + images only. No per-case answer key, no hint of what "good" looks like.
// ---------------------------------------------------------------------------

async function blindJudgeOnce(prompt: string, imagePaths: string[], apiKey: string) {
  const text = `너는 이 게임을 처음 플레이해 보는 까다로운 레벨 디자이너다. 아래는 사용자가 에디터 AI 조수에게 한 명령과, 조수가 만든 결과물의 스크린샷이다
(1번: 전체 맵, 2번: 분기 A 발동 직전 게임 장면, 3번: 분기 A 첫 대사가 뜬 순간, 4번: 분기 A 이벤트 중 가장 강한 연출 순간, 5번: 분기 B 연출 순간. 분기 A/B는 같은 이벤트를 조건(파티·아이템·스위치)만 달리해 플레이한 것이다).

사용자 명령:
"${prompt}"

절차:
1. 명령에서 «정지 화면으로 눈에 보이는» 요구사항만 뽑아 나열한다(장소, 지형, 건물, 사물, 캐릭터 외형, 화면 색조·입자 같은 눈에 보이는 효과, 캐릭터 쓰러짐). 대사 문구·진동·효과음·사망 후 게임오버·스위치·분기 조건은 별도 자동 검사가 확인하니 나열하지 않는다(정지 화면에 안 보여도 감점하지 않는다).
2. 각 요구사항이 스크린샷에서 실제로 보이는지 근거와 함께 yes/no/unclear로 판정한다. 보이지 않는 것은 no다.
3. 맵 자체를 평가한다: 명령이 말한 장소처럼 보이는가? 오브젝트가 맵 전체에 자연스럽게 배치되어 있나, 한쪽에 몰려 있거나 휑한가? 타일 경계가 어색한 사각 패치로 보이는가?
하나라도 no가 있거나 맵이 휑하거나 어색하면 passed=false이고 점수는 60 미만이다. 80점 이상은 실제 게임으로 출시해도 부끄럽지 않을 때만 준다.

JSON으로만 답하라:
{"requirements":[{"item":"...","verdict":"yes|no|unclear","evidence":"..."}],"passed":boolean,"score":number,"critique":"한국어 3문장 이내"}`;
  const content: unknown[] = [{ type: "text", text }];
  for (const p of imagePaths) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${readFileSync(p).toString("base64")}` },
    });
  }
  try {
    const { completion } = (await completeProvider(
      JUDGE_PROVIDER,
      {
        model: JUDGE_MODEL,
        messages: [{ role: "user", content }],
        stream: false,
        max_tokens: 2000,
        temperature: 0.1,
        reasoning: { effort: "high" },
      },
      { apiKey },
    )) as any;
    const raw = String(completion?.choices?.[0]?.message?.content ?? "").trim();
    const m = /\{[\s\S]*\}/u.exec(raw);
    if (!m) return { passed: false, score: 0, critique: `판정 응답 파싱 실패: ${raw.slice(0, 200)}` };
    const parsed = JSON.parse(m[0]);
    const reqs = Array.isArray(parsed.requirements) ? parsed.requirements : [];
    const anyNo = reqs.some((r: any) => r?.verdict === "no");
    const score = Number(parsed.score ?? 0);
    return {
      passed: Boolean(parsed.passed) && !anyNo && score >= 80,
      score,
      critique: String(parsed.critique ?? ""),
      requirements: reqs,
    };
  } catch (err) {
    return { passed: false, score: 0, critique: `판정 오류: ${(err as Error).message}` };
  }
}

// ---------------------------------------------------------------------------

/**
 * Character art the project already owns before the prompt is given (like actor_marle or item_fire_ring in the
 * fixture): the assistant must still find it with list_resources and wire it into the event itself. Nothing is
 * published to the shared library or bundled — the frog sheet comes from an isolated charset-actor run.
 */
const FROG_KNIGHT_SHEET = process.env.PILOT_FROG_KNIGHT_SHEET ?? "/home/main/chr-frog-knight/data/runs/frog-knight-2/frog-knight-2__gpt-r1/views/sheet_rgba.png";

function installProjectCharsets(caseId: string, project: Project): void {
  if (caseId !== "jrpg_046" || !existsSync(FROG_KNIGHT_SHEET)) return;
  const src = PNG.sync.read(readFileSync(FROG_KNIGHT_SHEET));
  const sheet = new PNG({ width: 288, height: 256 });
  PNG.bitblt(src, sheet, 0, 0, Math.min(src.width, 72), Math.min(src.height, 128), 0, 0);
  const id = "charset_frog_knight";
  (project.assets.uploaded as Record<string, unknown>)[id] = {
    id,
    name: "개구리 기사 (직립 개구리 검사, 은빛 갑옷·붉은 스카프·붉은 망토)",
    kind: "charset",
    dataUrl: `data:image/png;base64,${PNG.sync.write(sheet).toString("base64")}`,
    meta: { width: 288, height: 256 },
  };
}

type JudgeResult = { passed: boolean; score: number; critique: string; requirements?: unknown };

/**
 * Same scene, three independent judge calls; the verdict is the majority (pass needs 2 of 3, each call still
 * strict: no "no" item, score >= 80). The score and critique come from the median-score call. A single call
 * contradicted itself between runs on identical frames, so one noisy "no" must not decide the run.
 */
export async function blindJudge(prompt: string, imagePaths: string[], apiKey: string): Promise<JudgeResult & { votes: number[] }> {
  const runs = await Promise.all([0, 1, 2].map(() => blindJudgeOnce(prompt, imagePaths, apiKey)));
  const sorted = [...runs].sort((x, y) => x.score - y.score);
  const median = sorted[1]!;
  const passes = runs.filter((r) => r.passed).length;
  return { ...median, passed: passes >= 2, votes: runs.map((r) => r.score) };
}

function triggerModeFor(events: GameEvent[], fx: number, fy: number): "action" | "step_right" {
  const ev = events.find((e) => e.x === fx && e.y === fy) ?? events[0];
  const kind = ev?.pages?.[0]?.trigger?.kind ?? ev?.trigger?.kind;
  return kind === "action" ? "action" : "step_right";
}

function branchOptions(id: string, fx: number, fy: number, screenshotPath: string, which: "A" | "B", afterShot?: string, triggerMode?: "action" | "step_right") {
  const labels: Record<string, [string, string]> = {
    jrpg_016: ["마르 미동행", "마르(actor_marle) 동행"],
    jrpg_002: ["반지 미소지", "화염의 반지 소지"],
    jrpg_003: ["방독면 OFF", "방독면 ON"],
    jrpg_046: ["각성 전", "각성 후"],
  };
  const isA = which === "A";
  return {
    branchLabel: labels[id]![isA ? 0 : 1],
    startX: fx - 1,
    startY: fy,
    facing: "right" as const,
    triggerMode: triggerMode ?? "step_right",
    partyActorIds: !isA && id === "jrpg_016" ? ["actor_crono", "actor_marle"] : ["actor_crono"],
    inventory: id === "jrpg_002" ? { item_fire_ring: isA ? 0 : 1 } : {},
    switches:
      id === "jrpg_003"
        ? { sw_gas_mask: !isA }
        : id === "jrpg_046" && !isA
          ? { sw_masamune_awakened: true }
          : {},
    screenshotPath,
    ...(afterShot ? { afterScreenshotPath: afterShot } : {}),
  };
}

async function main() {
  const casesArgIdx = process.argv.indexOf("--cases");
  const ids = casesArgIdx >= 0 ? process.argv[casesArgIdx + 1]!.split(",") : PILOT_IDS;
  const outDir = resolve(process.cwd(), "artifacts/jrpg-200/authentic-pilot");
  const vizDir = "/home/main/claude-viz/authentic-pilot";
  mkdirSync(outDir, { recursive: true });
  mkdirSync(vizDir, { recursive: true });

  const apiKey = await resolveRequestApiKey(MODEL_PROVIDER);
  if (!apiKey) throw new Error("no credentials for google-antigravity");
  const judgeApiKey = JUDGE_PROVIDER === MODEL_PROVIDER ? apiKey : await resolveRequestApiKey(JUDGE_PROVIDER);
  if (!judgeApiKey) throw new Error(`no credentials for judge provider ${JUDGE_PROVIDER}`);
  console.log(`[Authentic] judge: ${JUDGE_PROVIDER}/${JUDGE_MODEL}`);

  // Stage 1: the real assistant builds each case from the raw prompt (parallel; independent project clones).
  console.log(`[Authentic] stage 1: real gemini-4-argon assistant builds ${ids.join(", ")}`);
  const assistantRuns = new Map<string, SingleCaseExecutionResult & { afterProject: Project }>();
  await Promise.all(
    ids.map(async (id) => {
      const testCase = JRPG_200_CASES.find((c) => c.id === id)!;
      const res = (await runSingleJrpgCase(testCase, outDir, { clearFixtureEvents: true, prepareProject: (p) => installProjectCharsets(id, p) })) as SingleCaseExecutionResult & { afterProject: Project };
      assistantRuns.set(id, res);
      console.log(
        `  [${id}] assistant done in ${Math.round(res.durationMs / 1000)}s, tools=${res.toolCalls.map((t) => `${t.name}:${t.ok ? "ok" : "err"}`).join(",") || "none"}`,
      );
    }),
  );

  // Stage 2: play + gate + blind-judge each (serial: the QA project route is global).
  const server = await startPlayerQaServer();
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const context = await createQaContext(browser);
  const results: CaseResult[] = [];
  try {
    for (const id of ids) {
      const testCase = JRPG_200_CASES.find((c) => c.id === id)!;
      const run = assistantRuns.get(id)!;
      const project = run.afterProject;
      project.startMapId = testCase.mapId;
      const map = project.maps[testCase.mapId]!;
      const events = run.targetEvents ?? [];
      const mapPngPath = join(vizDir, `${id}_map.png`);
      const mapPngBuf = renderMapPng({ ...project, startMapId: "__none__" }, { ...map, events: [] }).png;
      writeFileSync(mapPngPath, mapPngBuf);
      const mapPng = PNG.sync.read(mapPngBuf);
      const beforeProj = (run as unknown as { beforeProject?: Project }).beforeProject;
      const beforeMapObj = beforeProj?.maps[testCase.mapId];
      const beforePng = beforeProj && beforeMapObj ? PNG.sync.read(renderMapPng({ ...beforeProj, startMapId: "__none__" }, { ...beforeMapObj, events: [] }).png) : undefined;
      writeFileSync(join(vizDir, `${id}_before_map.png`), beforePng ? PNG.sync.write(beforePng) : Buffer.alloc(0));

      const shotAPre = join(vizDir, `${id}_A_pre.png`);
      const shotA = join(vizDir, `${id}_A.png`);
      const shotAEnd = join(vizDir, `${id}_A_end.png`);
      const shotBPre = join(vizDir, `${id}_B_pre.png`);
      const shotB = join(vizDir, `${id}_B.png`);
      const shotAPeak = join(vizDir, `${id}_A_peak.png`);
      const shotBPeak = join(vizDir, `${id}_B_peak.png`);
      const fx = testCase.focusCoord.x;
      const fy = testCase.focusCoord.y;
      console.log(`[Authentic] stage 2: playing ${id} in real player.html`);
      const a = await runLiveInGameBranch(context, server.url, project, {
        ...branchOptions(id, fx, fy, shotA, "A", shotAEnd, triggerModeFor(events, fx, fy)),
        peakScreenshotPath: shotAPeak,
        preScreenshotPath: shotAPre,
        mapId: testCase.mapId,
      });
      const b = await runLiveInGameBranch(context, server.url, project, {
        ...branchOptions(id, fx, fy, shotB, "B", undefined, triggerModeFor(events, fx, fy)),
        peakScreenshotPath: shotBPeak,
        preScreenshotPath: shotBPre,
        mapId: testCase.mapId,
      });

      const gates = [...mapGates(project, map, mapPng, beforePng), ...eventGates(testCase, map, events), ...branchGates(testCase, a, b)];
      const judge = await blindJudge(testCase.prompt, [mapPngPath, shotAPre, shotA, shotAPeak, shotBPeak], judgeApiKey);
      const overallPassed = gates.every((g) => g.passed) && judge.passed;
      results.push({
        caseId: id,
        title: testCase.title,
        prompt: testCase.prompt,
        assistantToolCalls: run.toolCalls.map((t) => `${t.name}:${t.ok ? "ok" : "err"}`),
        toolCallDetails: run.toolCalls.map((t) => ({ name: t.name, ok: t.ok, args: JSON.stringify(t.args).slice(0, 1200), summary: t.summary })),
        events,
        assistantReply: run.assistantReply,
        gates,
        judge,
        overallPassed,
        mapPng: `authentic-pilot/${id}_map.png`,
        shotA: `authentic-pilot/${id}_A_peak.png`,
        shotB: `authentic-pilot/${id}_B_peak.png`,
      });
      console.log(
        `  [${id}] ${overallPassed ? "PASS" : "FAIL"} gates ${gates.filter((g) => g.passed).length}/${gates.length}, judge ${judge.score}`,
      );
      for (const g of gates) if (!g.passed) console.log(`     FAIL ${g.id}: ${g.detail}`);
    }
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }

  writeFileSync(join(outDir, "authentic-summary.json"), JSON.stringify(results, null, 2));
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const html = `<!doctype html><meta charset="utf-8"><title>Authentic pilot QA</title>
<style>body{background:#10141c;color:#dde;font:14px system-ui;margin:20px}h2{margin-top:36px}img{image-rendering:pixelated;max-width:32%;border:1px solid #334}
.ok{color:#6d6}.ng{color:#f66}td{padding:2px 8px;vertical-align:top}.p{color:#9ab}</style>
<h1>진짜 조수 산출물 평가 (하네스 손제작 없음)</h1>
${results
  .map(
    (r) => `<h2>${r.caseId} — ${esc(r.title)} : <span class="${r.overallPassed ? "ok" : "ng"}">${r.overallPassed ? "PASS" : "FAIL"}</span></h2>
<p class="p">${esc(r.prompt)}</p>
<p class="p">조수 도구 호출: ${esc(r.assistantToolCalls.join(", ") || "없음")}<br>조수 답변: ${esc(r.assistantReply)}</p>
<div><img src="${r.mapPng}"> <img src="${r.shotA}"> <img src="${r.shotB}"></div>
<table>${r.gates.map((g) => `<tr><td class="${g.passed ? "ok" : "ng"}">${g.passed ? "PASS" : "FAIL"}</td><td>${g.id}</td><td>${esc(g.detail)}</td></tr>`).join("")}
<tr><td class="${r.judge.passed ? "ok" : "ng"}">${r.judge.passed ? "PASS" : "FAIL"}</td><td>blind judge ${r.judge.score}</td><td>${esc(r.judge.critique)}</td></tr></table>`,
  )
  .join("\n")}`;
  writeFileSync("/home/main/claude-viz/authentic-pilot.html", html);
  console.log("[Authentic] wrote http://mdc-server:18301/authentic-pilot.html");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
