import { normalizePlaceToolArgs } from "./spatialPlaceContract";
// editor/tools/toolRunner.ts
// 툴 실행기. runTool(ctx, name, args, {dryRun}) → ToolResult.
// - 인자를 JSON Schema로 최소 검증.
// - 읽기 툴: project를 읽기만 하고 data 반환.
// - 쓰기 툴: draft(구조적 복제)에 적용 → diff 요약 → commitChangeset(projectLint 게이트).
//   차단 error가 있으면 반영 거부(ok:false). cluster-rule hard error는 issues로 보고하되 통과한다.
//   dryRun이면 통과해도 ctx.project를 갱신하지 않는다.

import type { LintIssue } from "@/project/lint/projectLint";
import { beginSpatialToolProposal, sealSpatialToolProposal } from "./spatialToolState";
import { verifyPostTilePlacement } from "@/project/lint/postTileVerify";
import { formatTreePairRepairSummary, repairTreePairsOnProject } from "@/project/lint/repairTreePairs";
import { resolveForestCanopyReplacementExemptTileIds } from "./forestComposition";
import { commitChangeset, createDraft, summarizeChanges } from "./changeset";
import { normalizeArgsForSchema, validateArgs } from "./jsonSchema";
import { getTool } from "./toolRegistry";
import { ToolError, type ToolContext, type ToolDefinition, type ToolResult } from "./types";
import { assertHouseProtection, captureHouseProtection, newlyBuiltHouseSnapshots, type HouseSnapshot } from "./houseProtection";

export interface RunToolOptions {
  readonly dryRun?: boolean;
}

/**
 * 커밋 거부 요약에 첫 위반 사유를 싣는다. 예전에는 어느 lint 가 터졌든 `'<tool>' 커밋 거부(무결성 오류)`
 * 로 고정이라 DB AI 바·채팅 로그·모델 응답 어디에도 이유가 보이지 않았다(issues 에만 있었다 —
 * 2026-09-03 실측: `skill does not exist: skill_0001` 을 알아내려면 하네스를 뒤져야 했다).
 * 접두어는 그대로 둔다(기존 테스트·진단이 `커밋 거부` 로 잡는다).
 */
function commitRejectionSummary(name: string, blocking: readonly LintIssue[]): string {
  const base = `'${name}' 커밋 거부(무결성 오류)`;
  const head = blocking[0]?.message.split("\n")[0]?.trim();
  if (!head) return base;
  const clipped = head.length > 160 ? `${head.slice(0, 159)}…` : head;
  const rest = blocking.length - 1;
  return `${base} — ${clipped}${rest > 0 ? ` (+${rest}건)` : ""}`;
}

function issueFromError(cause: unknown): LintIssue {
  if (cause instanceof ToolError) {
    return { severity: "error", code: cause.code, mapId: cause.mapId, x: cause.x, y: cause.y, message: cause.message };
  }
  return { severity: "error", code: "tool-exception", message: cause instanceof Error ? cause.message : String(cause) };
}

// 실패 요약에 원인 한 줄을 포함한다 — 감사 로그만 보고도 원인을 알 수 있고,
// 모델도 summary 단계에서 바로 자가 수정 신호를 받는다.
function failureSummary(name: string, cause: unknown): string {
  const issue = issueFromError(cause);
  const message = issue.message.length > 200 ? `${issue.message.slice(0, 200)}…` : issue.message;
  return `'${name}' 실행 실패: ${message}`;
}

function postprocessFailureSummary(name: string, cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  const compact = message.length > 200 ? `${message.slice(0, 200)}…` : message;
  return `'${name}' 후처리 실패: ${compact}`;
}

function argErrorMessage(message: string, example: Record<string, unknown> | undefined, hint: string | undefined): string {
  const withHint = hint ? `${message} — ${hint}` : message;
  return example ? `${withHint} — 다시 보낼 형식 예시: ${JSON.stringify(example)}` : withHint;
}

// 인자 모양 오류는 스키마 검증(실행 전)과 툴 내부 검사(실행 중) 두 곳에서 나오는데, 교정 예시·힌트·repair 는
// 실행 전 경로에만 붙어 있었다. 그래서 `upsert_event` · `set_scene_mood` 의 "커맨드 형식 오류" 는 고칠 본을
// 받지 못해 같은 인자로 재시도되었다(F1). 거부는 그대로고, 동일한 교정 정보만 둘 다 실어 보낸다.
function issueFromToolError(tool: ToolDefinition, normalizedArgs: Record<string, unknown>, cause: unknown): LintIssue {
  const issue = issueFromError(cause);
  // 이미 교정본을 실어 보내는 문구는 그대로 둔다. 모델도 테스트도 그 메시지의 JSON 을 끝까지 읽어 그대로
  // 다시 부르므로(`test/aiNativePageContract.test.ts`), 뒤에 무엇을 붙이든 그 예시를 깨뜨린다.
  if (issue.code !== "invalid-args" || issue.message.includes("repair: ") || issue.message.includes('{"')) return issue;
  const repair = tool.invalidArgsRepair?.(normalizedArgs);
  return { ...issue, message: argErrorMessage(issue.message, tool.invalidArgsExample, tool.invalidArgsHint)
    + (repair ? `\nrepair: ${JSON.stringify(repair)}` : "") };
}

export function normalizeToolArgs(name: string, args: Record<string, unknown>): Record<string, unknown> {
  const tool = getTool(name);
  if (!tool) return args;
  return normalizeArgsForSchema(tool.parameters, normalizePlaceToolArgs(tool.name, args)) as Record<string, unknown>;
}

export function runTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
  options: RunToolOptions = {}
): ToolResult {
  const tool = getTool(name);
  if (!tool) {
    return { ok: false, summary: `알 수 없는 툴: ${name}`, issues: [{ severity: "error", code: "unknown-tool", message: `등록되지 않은 툴: ${name}` }] };
  }

  return runToolDefinition(ctx, tool, args, options);
}

export function runToolDefinition(
  ctx: ToolContext,
  tool: ToolDefinition,
  args: Record<string, unknown>,
  options: RunToolOptions = {},
): ToolResult {
  const name = tool.name;

  const normalizedArgs = normalizeArgsForSchema(tool.parameters, normalizePlaceToolArgs(tool.name, args)) as Record<string, unknown>;
  const argErrors = validateArgs(tool.parameters, normalizedArgs);
  if (argErrors.length > 0) {
    const repair = tool.invalidArgsRepair?.(normalizedArgs);
    return {
      ok: false,
      summary: `'${name}' 인자 검증 실패`,
      issues: argErrors.map((message) => ({
        severity: "error",
        code: "invalid-args",
        message: argErrorMessage(message, tool.invalidArgsExample, tool.invalidArgsHint)
          + (repair ? `\nrepair: ${JSON.stringify(repair)}` : ""),
      })),
    };
  }

  if (tool.mode === "read") {
    try {
      const exec = tool.run(ctx.project, normalizedArgs);
      return {
        ok: true,
        summary: exec.summary,
        ...(exec.issues && exec.issues.length > 0 ? { issues: exec.issues } : {}),
        ...(exec.warnings && exec.warnings.length > 0 ? { warnings: exec.warnings } : {}),
        data: exec.data,
      };
    } catch (cause) {
      const error = cause instanceof Error ? cause : new ToolError(String(cause), { code: "tool-exception" });
      return { ok: false, summary: failureSummary(name, error), issues: [issueFromToolError(tool, normalizedArgs, error)] };
    }
  }

  // 쓰기 툴: draft에 적용.
  const before = ctx.project;
  const draft = createDraft(before);
  let exec;
  let protectedHouses: HouseSnapshot[];
  try {
    protectedHouses = captureHouseProtection(before);
    beginSpatialToolProposal(draft, before);
    exec = tool.run(draft, normalizedArgs);
  } catch (cause) {
    const error = cause instanceof Error ? cause : new ToolError(String(cause), { code: "tool-exception" });
    return { ok: false, summary: failureSummary(name, error), issues: [issueFromToolError(tool, normalizedArgs, error)] };
  }

  try {
    const builtHouses = newlyBuiltHouseSnapshots(draft, protectedHouses);
    // 후처리: 나무 밑동 위 수관(upper) 강제 — 고아 밑동(14,5 등) 방지.
    // Canonical maps include frozen, digest-owned output. Never repair unrelated raster implicitly.
    const treeRepairNote = draft.spatialAuthoring === undefined
      ? formatTreePairRepairSummary(repairTreePairsOnProject(draft, {
        canopyReplacementExemptTileIds: resolveForestCanopyReplacementExemptTileIds(draft),
      })) : null;
    assertHouseProtection(protectedHouses, draft, builtHouses);

    const diff = summarizeChanges(before, draft);
    if (exec.warnings) diff.warnings.push(...exec.warnings);
    if (treeRepairNote) diff.warnings.push(treeRepairNote);

    // baseline(before)을 넘겨 "이 변경이 새로 만든" 오류만 커밋을 막는다 — 선재 오류 프로젝트 편집 허용.
    const commit = commitChangeset(draft, before);
    if (!commit.ok) {
      const blocking = commit.blocking.length > 0 ? commit.blocking : commit.issues;
      return {
        ok: false,
        summary: commitRejectionSummary(name, blocking),
        diff,
        issues: [...(exec.issues ?? []), ...blocking],
      };
    }

    sealSpatialToolProposal(draft);
    if (!options.dryRun) ctx.project = draft;
    const postTile = verifyPostTilePlacement(draft, { name, args: normalizedArgs, data: exec.data });
    if (postTile.length > 0) diff.warnings.push(...postTile.map((issue) => issue.message));
    const issues = [...(exec.issues ?? []), ...commit.issues, ...postTile];
    const summary = treeRepairNote ? `${exec.summary} · ${treeRepairNote}` : exec.summary;
    return {
      ok: true,
      summary,
      diff,
      issues: issues.length > 0 ? issues : undefined,
      data: exec.data,
    };
  } catch (cause) {
    return {
      ok: false,
      // Expected invariant rejections are tool failures, not postprocessor crashes.
      summary: cause instanceof ToolError ? failureSummary(name, cause) : postprocessFailureSummary(name, cause),
      issues: [cause instanceof ToolError ? issueFromError(cause)
        : { severity: "error", code: "tool-postprocess", message: cause instanceof Error ? cause.message : String(cause) }],
    };
  }
}
