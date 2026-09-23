// 녹화 재생 — gen.mts 가 남긴 tools.jsonl 을 같은 씨앗(seed.json) 위에서 **지금의** 툴 코드로 다시 돌린다.
//
//   bun scripts/qa-game/replay.mts qa-runs/<id>            → qa-runs/<id>/replay/{project.json,tools.jsonl,diff.json,check.json}
//   옵션: --out <dir>  --no-check  --phase build           (기본: 계획 턴 plan 을 뺀 모든 단계)
//
// 모델 없이 몇 초 — 툴·정규화기·게이트를 고친 뒤 「같은 호출이면 이제 어떻게 되나」를 본다.
// 실행 경로는 Pi 런타임과 같다: 레지스트리 셰이프(resolvePiToolShape: 참고 문서 게이트·범위 가드·실패→예외)로 실행하고,
// 쓰기 툴이 성공할 때마다 체크포인트를 createPiPublication → applyProposedProject(스토어 커밋 게이트)로 발행한다.
//
// 다른 점: 모델이 없으므로 앞 호출의 결과가 달라져도 뒤 호출 인자는 녹화 그대로다(갈라지면 뒤쪽 차이는 연쇄 효과일 수 있다).
// 코어가 인자 검증에서 거절한 호출·레지스트리 밖 툴(set_build_spec·consult_writer·web_search)은 다시 돌리지 않는다.

import fs from "node:fs";
import path from "node:path";
import { readRecordedCalls, resultWarnings, type RecordedToolCall } from "./lib/recorder.ts";
import { store } from "../../src/project/store.ts";
import { deserialize, serialize } from "../../src/project/io.ts";
import { resolvePiToolShape, type PiToolCallRecord } from "../../src/ai/piAgent/toolAdapter.ts";
import { PiTilesetReferenceGate } from "../../src/ai/piAgent/tilesetReferenceGate.ts";
import { changedProjectKeys, piMapScopeGuard, restoreCheckpointProject, slimCheckpointProject, snapshotProjectKeepingHeavy, unchangedHeavyKeys, type PiAgentRequest } from "../../src/ai/piAgent/protocol.ts";
import { normalizePiApplyMode, isLiveApplyMode } from "../../src/ai/piAgent/applyMode.ts";
import { createPiPublication } from "../../src/editor/panels/aiPiPublication.ts";
import { exportSpatialToolProof, finishSpatialToolAcceptance } from "../../src/editor/tools/spatialToolState.ts";
import type { Project } from "../../src/project/types.ts";

let ARGV: readonly string[] = process.argv.slice(2);
const arg = (name: string): string | undefined => { const i = ARGV.indexOf(`--${name}`); return i >= 0 ? ARGV[i + 1] : undefined; };
const flag = (name: string): boolean => ARGV.includes(`--${name}`);

/** Pi 런타임이 레지스트리 밖에서 붙이는 툴 — 재생 대상이 아니다. */
const RUNTIME_TOOLS = new Set(["set_build_spec", "consult_writer", "web_search", "finish_stage"]);

export interface ReplayedCall {
  readonly order: number;
  readonly phase: string;
  readonly name: string;
  readonly status: "ran" | "skipped" | "unavailable" | "checkpoint-rejected";
  readonly ok?: boolean;
  readonly summary?: string;
  readonly warnings?: readonly string[];
  readonly recordedOk: boolean;
  readonly recordedWarnings: readonly string[];
  readonly differs: boolean;
  readonly note?: string;
  readonly ms?: number;
}

export interface ReplayResult {
  readonly calls: readonly ReplayedCall[];
  readonly project: Project;
  readonly publications: number;
  /** 체크포인트 발행(스토어 커밋 게이트)에 쓴 시간 합. */
  readonly publishMs: number;
  readonly stoppedAt?: number;
  readonly ms: number;
}

export async function replayRecording(dir: string, options: { readonly phases?: readonly string[] } = {}): Promise<ReplayResult> {
  const started = Date.now();
  const seed = deserialize(fs.readFileSync(path.join(dir, "seed.json"), "utf8"));
  const requestFile = path.join(dir, "request.json");
  const request = (fs.existsSync(requestFile) ? JSON.parse(fs.readFileSync(requestFile, "utf8")) : { mapIds: [], scopeStrict: false }) as Pick<PiAgentRequest, "mapIds" | "scopeStrict" | "mapBundleMerge" | "applyMode" | "currentMapId">;
  const recorded = readRecordedCalls(path.join(dir, "tools.jsonl"))
    .filter((call) => options.phases ? options.phases.includes(call.phase) : call.phase !== "plan");
  store.replaceProject(seed);
  const base = store.getCurrent();
  const applyMode = normalizePiApplyMode(request.applyMode);
  const live = isLiveApplyMode(applyMode) && applyMode !== "review";
  const publication = createPiPublication(base, applyMode, {
    appendBubble: () => undefined, appendCard: () => undefined, setStatus: () => undefined,
    getCurrentMapId: () => request.currentMapId ?? base.startMapId,
  });
  const ctx = { project: structuredClone(base) as Project };
  const gate = new PiTilesetReferenceGate();
  const scopeGuard = piMapScopeGuard({ mapIds: request.mapIds ?? [], scopeStrict: request.scopeStrict, mapBundleMerge: request.mapBundleMerge });
  let accepted = snapshotProjectKeepingHeavy(ctx.project);
  const calls: ReplayedCall[] = [];
  let stoppedAt: number | undefined;
  let publishMs = 0;

  const checkpoint = async (toolName: string): Promise<void> => {
    if (!live || changedProjectKeys(accepted, ctx.project).length === 0) return;
    // piAgentRuntime.checkpoint 와 같은 순서: 무거운 키는 빼고 발행 → 발행본으로 되돌려 받기 → 공간 증거 확정.
    const project = ctx.project;
    const unchangedKeys = unchangedHeavyKeys(accepted, project);
    const published = await publication.publish({
      project: structuredClone(slimCheckpointProject(project, unchangedKeys)) as Project,
      label: toolName, toolName, spatialProof: exportSpatialToolProof(project), unchangedKeys,
    });
    const merged = restoreCheckpointProject(project, published ?? project, unchangedKeys);
    ctx.project = merged;
    accepted = snapshotProjectKeepingHeavy(merged);
    finishSpatialToolAcceptance(ctx.project);
  };

  for (const call of recorded) {
    const base: Omit<ReplayedCall, "status" | "differs"> = { order: call.order, phase: call.phase, name: call.name, recordedOk: call.ok, recordedWarnings: call.warnings };
    if (RUNTIME_TOOLS.has(call.name)) { calls.push({ ...base, status: "skipped", differs: false, note: "Pi 런타임 전용 툴" }); continue; }
    if (!call.registry && !call.ok) { calls.push({ ...base, status: "skipped", differs: false, note: "녹화 때 코어가 인자 검증에서 거절" }); continue; }
    let record: PiToolCallRecord | undefined;
    const shape = resolvePiToolShape(ctx, call.name, { referenceGate: gate, onCall: (entry) => { record = entry; }, ...scopeGuard });
    if (!shape) { calls.push({ ...base, status: "unavailable", differs: true, note: "지금 레지스트리에 없는 툴(이름 변경·삭제·deprecated)" }); continue; }
    const t = Date.now();
    let thrown: string | undefined;
    try {
      await shape.execute(call.toolCallId || `replay-${call.order}`, call.args);
    } catch (error) {
      thrown = error instanceof Error ? error.message : String(error);
    }
    const result = record?.result;
    const ok = result ? result.ok && !thrown : !thrown;
    const warnings = resultWarnings(result);
    if (ok && call.name === "read_tileset_reference" && result) {
      // 녹화 때는 모델에게 실제로 보낸 페이로드가 증거가 됐다 — 재생에는 모델이 없으니 읽은 즉시 본 것으로 친다.
      gate.evidence.observe(result);
      gate.evidence.observeImageUrls(new Set(gate.evidence.imagesForRead(ctx.project, result).map((image) => image.dataUrl)));
    }
    const differs = ok !== call.ok || warningDelta(call.warnings, warnings).length > 0;
    const entry: ReplayedCall = {
      ...base, status: "ran", ok, summary: result?.summary ?? thrown?.slice(0, 400), warnings, differs, ms: Date.now() - t,
      ...(ok !== call.ok ? { note: `녹화 ${call.ok ? "성공" : "실패"} → 재생 ${ok ? "성공" : "실패"}` } : {}),
    };
    if (ok && shape.concurrency === "exclusive") {
      try {
        const p0 = Date.now();
        await checkpoint(call.name);
        publishMs += Date.now() - p0;
      } catch (error) {
        calls.push({ ...entry, status: "checkpoint-rejected", differs: true, note: `체크포인트 발행 거절: ${error instanceof Error ? error.message : String(error)}` });
        stoppedAt = call.order;
        break;
      }
    }
    calls.push(entry);
  }
  // 마무리 — 발행 안 된 변경이 남았으면 체크포인트 한 번 더(런타임의 「마지막 단계」).
  if (stoppedAt === undefined) {
    try { await checkpoint("finish_stage"); } catch { /* 마지막 발행 거절은 project.json 에 반영되지 않은 채 남는다 */ }
  }
  return { calls, project: live ? store.getCurrent() : ctx.project, publications: publication.count, publishMs, ...(stoppedAt !== undefined ? { stoppedAt } : {}), ms: Date.now() - started };
}

/** 다중집합 차이 — 녹화에만 있는 경고는 "-", 재생에만 있는 경고는 "+". */
/** 비교에서 빼는 경고 — 실행 시간 계측처럼 매번 달라지는 줄. */
const TIMING_WARNING = /^\[vperf\]/u;

export function warningDelta(recorded: readonly string[], replayed: readonly string[]): [string, string][] {
  const count = new Map<string, number>();
  for (const text of recorded) if (!TIMING_WARNING.test(text)) count.set(text, (count.get(text) ?? 0) + 1);
  const added: [string, string][] = [];
  for (const text of replayed) {
    if (TIMING_WARNING.test(text)) continue;
    const left = count.get(text) ?? 0;
    if (left > 0) count.set(text, left - 1); else added.push(["+", text]);
  }
  const removed: [string, string][] = [];
  for (const [text, left] of count) for (let i = 0; i < left; i += 1) removed.push(["-", text]);
  return [...removed, ...added];
}

export function formatReplaySummary(result: ReplayResult, recorded: readonly RecordedToolCall[]): string {
  const ran = result.calls.filter((call) => call.status === "ran");
  const differing = result.calls.filter((call) => call.differs);
  const lines = [
    `# 재생 — 호출 ${result.calls.length}개(실행 ${ran.length}, 건너뜀 ${result.calls.filter((c) => c.status === "skipped").length}) · 발행 ${result.publications}회(${result.publishMs}ms) · ${result.ms}ms`,
    `녹화 성공 ${recorded.filter((c) => c.ok).length}/${recorded.length} → 재생 성공 ${ran.filter((c) => c.ok).length}/${ran.length}`,
    differing.length ? `결과가 녹화와 다른 호출 ${differing.length}개:` : "녹화와 결과가 다른 호출 없음.",
  ];
  for (const call of differing.slice(0, 60)) {
    const warn = JSON.stringify(call.warnings ?? []) !== JSON.stringify(call.recordedWarnings)
      ? ` 경고 ${call.recordedWarnings.length}→${call.warnings?.length ?? 0}` : "";
    const okChange = call.status === "ran" && call.ok !== call.recordedOk ? ` ok ${call.recordedOk}→${call.ok}` : "";
    lines.push(`- #${call.order} ${call.name} [${call.status}]${okChange}${call.note ? ` ${call.note}` : ""}${warn}${call.summary ? ` — ${call.summary.replace(/\s+/g, " ").slice(0, 160)}` : ""}`);
    for (const [sign, text] of warningDelta(call.recordedWarnings, call.warnings ?? []).slice(0, 6)) lines.push(`    ${sign} ${text.replace(/\s+/g, " ").slice(0, 200)}`);
  }
  if (result.stoppedAt !== undefined) lines.push(`※ #${result.stoppedAt} 에서 체크포인트 게이트가 거절해 재생을 멈췄습니다(실행 중이었다면 런이 중단됐을 자리).`);
  return lines.join("\n");
}

export async function replayMain(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  ARGV = argv;
  const dir = argv.find((value, index) => !value.startsWith("--") && !(index > 0 && argv[index - 1]!.startsWith("--")));
  if (!dir || !fs.existsSync(path.join(dir, "tools.jsonl")) || !fs.existsSync(path.join(dir, "seed.json"))) {
    console.error("사용법: bun scripts/qa-game/replay.mts qa-runs/<id>   (<id>/seed.json · tools.jsonl 필요 — gen.mts 산출물)");
    return 2;
  }
  const out = arg("out") ?? path.join(dir, "replay");
  const phases = arg("phase")?.split(",");
  const result = await replayRecording(dir, phases ? { phases } : {});
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "project.json"), serialize(result.project));
  fs.writeFileSync(path.join(out, "tools.jsonl"), result.calls.map((call) => JSON.stringify(call)).join("\n") + "\n");
  const recorded = readRecordedCalls(path.join(dir, "tools.jsonl")).filter((call) => phases ? phases.includes(call.phase) : call.phase !== "plan");
  const summary = formatReplaySummary(result, recorded);
  fs.writeFileSync(path.join(out, "diff.json"), JSON.stringify({ ms: result.ms, publications: result.publications, stoppedAt: result.stoppedAt ?? null, differing: result.calls.filter((c) => c.differs) }, null, 2));
  fs.writeFileSync(path.join(out, "replay.txt"), `${summary}\n`);
  console.log(summary);
  if (!flag("no-check")) {
    const { checkMain } = await import("./check.mts");
    return checkMain([out, "--quiet"]);
  }
  return 0;
}

if (import.meta.main) process.exit(await replayMain());
