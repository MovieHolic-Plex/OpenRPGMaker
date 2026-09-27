import { stripResourceSearchIdPrefixes } from "./resourceSearchIdArgs";
import { normalizePlaceToolArgs } from "./spatialPlaceContract";
// editor/tools/toolRunner.ts
// 툴 실행기. runTool(ctx, name, args, {dryRun}) → ToolResult.
// - 인자를 JSON Schema로 최소 검증.
// - 읽기 툴: project를 읽기만 하고 data 반환.
// - 쓰기 툴: draft(구조적 복제)에 적용 → diff 요약 → commitChangeset(projectLint 게이트).
//   차단 error가 있으면 반영 거부(ok:false). cluster-rule hard error는 issues로 보고하되 통과한다.
//   dryRun이면 통과해도 ctx.project를 갱신하지 않는다.

import type { LintIssue } from "@/project/lint/projectLint";
import type { Project } from "@/project/types";
import { sameFamilyTilesets, tilesetFamily, tilesetFamilyLabel } from "@/project/tilesetFamily";
import { beginSpatialToolProposal, sealSpatialToolProposal } from "./spatialToolState";
import { verifyPostTilePlacement } from "@/project/lint/postTileVerify";
import { compactMapLayers, EXTRA_LAYER_KEYS, hasExtraLayers } from "@/project/mapLayers";
import { formatTreePairRepairSummary, repairTreePairsOnProject } from "@/project/lint/repairTreePairs";
import { resolveForestCanopyReplacementExemptTileIds } from "./forestComposition";
import { commitChangeset, createDraft, shareUnchangedTilesets, summarizeChanges, tileBuffersDiffer, tileChangedMapIds } from "./changeset";
import { normalizeArgsForSchema, validateArgs } from "./jsonSchema";
import { getTool } from "./toolRegistry";
import { ToolError, type ToolContext, type ToolDefinition, type ToolResult } from "./types";
import { assertHouseProtection, captureHouseProtection, newlyBuiltHouseSnapshots, type HouseSnapshot } from "./houseProtection";

export interface RunToolOptions {
  readonly dryRun?: boolean;
}

/**
 * 사용자가 올린 타일셋을 쓰던 기존 맵의 칩셋을 도구가 말없이 바꾸면 거부한다.
 * 실측(2026-09-25): Rasak 얼음 동굴 요청에 조수가 run_dungeon_room_pipeline 을 불러 맵이
 * easyrpg_chipset_dungeon 으로 바뀌었고, 사용자 타일셋과 그 참고문서는 한 번도 쓰이지 않았다.
 * 칩셋을 일부러 바꾸는 호출은 인자에 새 tilesetId 를 적으므로 통과한다.
 * 프로젝트를 통째로 되돌리거나 갈아 끼우는 도구는 ToolDefinition.allowsTilesetChange 로 빠진다(호출부에서 거른다).
 */
function rejectUploadedTilesetSwap(before: Project, draft: Project, name: string, args: Record<string, unknown>): void {
  for (const [id, previous] of Object.entries(before.maps)) {
    const next = draft.maps[id];
    if (!next || next.tilesetId === previous.tilesetId) continue;
    const tileset = before.tilesets[previous.tilesetId];
    if (tileset?.image.type !== "uploaded" || args.tilesetId === next.tilesetId) continue;
    throw new ToolError(
      `맵 ${id} 은 업로드 타일셋 「${tileset.name}」(${tileset.id}) 을 쓴다 — ${name} 이 칩셋을 ${next.tilesetId} 로 바꾸므로 거부했다. `
      + `이 타일셋의 참고문서(list_tileset_references)를 읽고 paint_tiles·stamp_layer_block 으로 직접 깔아라. 칩셋을 정말 바꾸려면 tilesetId 를 명시하라.`,
      { code: "uploaded-tileset-replaced", mapId: id },
    );
  }
}

/** 계열 검사 메시지에 싣는 같은 계열 후보 수 상한. */
const FAMILY_CANDIDATE_LIMIT = 8;

/**
 * 조수가 사용자가 보는 맵과 다른 그림체(칩셋 계열)로 맵을 만들거나 칩셋을 바꾸면 거부한다(2026-09-25 사용자 결정).
 * 기준 = ctx.currentMapId 맵의 칩셋 계열. 대상 = 이번에 새로 생긴 맵 + tilesetId 가 바뀐 맵.
 * 사용자가 이 대화에서 승인한 계열(ctx.approvedTilesetFamilies)은 통과한다. currentMapId 가 없으면 검사하지 않는다.
 * 같은 계열 후보를 알려 주고, 없으면 ask_tileset_change 로 견본을 보여 묻고 턴을 끝내라고 지시한다.
 */
function rejectTilesetFamilyChange(ctx: ToolContext, before: Project, draft: Project, name: string): void {
  const currentMap = ctx.currentMapId ? before.maps[ctx.currentMapId] : undefined;
  if (!currentMap) return;
  const baseFamily = tilesetFamily(before, currentMap.tilesetId);
  const approved = new Set(ctx.approvedTilesetFamilies ?? []);
  for (const [id, next] of Object.entries(draft.maps)) {
    const previous = before.maps[id];
    if (previous && previous.tilesetId === next.tilesetId) continue;
    const family = tilesetFamily(draft, next.tilesetId);
    if (family === baseFamily || approved.has(family)) continue;
    const fromName = before.tilesets[currentMap.tilesetId]?.name ?? currentMap.tilesetId;
    const toName = draft.tilesets[next.tilesetId]?.name ?? next.tilesetId;
    const candidates = sameFamilyTilesets(before, baseFamily).slice(0, FAMILY_CANDIDATE_LIMIT)
      .map((tileset) => `${tileset.id}(${tileset.name})`);
    const fromLabel = tilesetFamilyLabel(before, baseFamily);
    const toLabel = tilesetFamilyLabel(draft, family);
    throw new ToolError(
      `사용자가 보고 있는 맵 ${currentMap.id} 의 칩셋은 「${fromName}」(${currentMap.tilesetId}, ${fromLabel} 계열)인데 `
      + `${name} 이 맵 ${id} 에 「${toName}」(${next.tilesetId}, ${toLabel} 계열)을 쓰려 해 거부했다 — 사용자 승인 없이 타일 그림체를 바꾸지 않는다. `
      + `같은 계열 후보: ${candidates.length ? candidates.join(", ") : "없음"}. `
      + `같은 계열 후보 중 맞는 것을 tilesetId 로 지정해 다시 불러라(이 도구가 tilesetId 를 못 받으면 create_map(tilesetId=후보) 로 빈 맵을 만든 뒤 칠하기 도구로 직접 깔아라). `
      + `맞는 후보가 없으면 칠하지 말고 ask_tileset_change(toTilesetId="${next.tilesetId}") 로 사용자에게 견본을 보여 묻고 턴을 끝내라.`,
      { code: "tileset-family-change", mapId: id },
    );
  }
}

/**
 * tilesetId 없이 불린 create_map 류 도구에 지금 보는 맵의 칩셋을 채운다(ToolDefinition.defaultTilesetId 주석).
 * 도구 기본값이 지금 보는 맵과 같은 계열이면 그대로 둔다.
 */
function argsWithCurrentMapTileset(ctx: ToolContext, tool: ToolDefinition, args: Record<string, unknown>): Record<string, unknown> {
  if (tool.fillsCurrentMapId && ctx.currentMapId && !(typeof args.mapId === "string" && args.mapId.trim().length > 0)) {
    args = { ...args, mapId: ctx.currentMapId };
  }
  if (!tool.defaultTilesetId || !ctx.currentMapId) return args;
  if (typeof args.tilesetId === "string" && args.tilesetId.trim().length > 0) return args;
  const currentMap = ctx.project.maps[ctx.currentMapId];
  if (!currentMap || !ctx.project.tilesets[currentMap.tilesetId]) return args;
  const own = tool.defaultTilesetId(ctx.project);
  if (tilesetFamily(ctx.project, own) === tilesetFamily(ctx.project, currentMap.tilesetId)) return args;
  return { ...args, tilesetId: currentMap.tilesetId };
}

/**
 * 2·4층·그림자가 모두 비면 키를 뺀다(옛 맵 모양으로). setLower 처럼 여러 도구가 공유하는 헬퍼가 칸을 비우므로
 * 도구마다가 아니라 실행기에서 한 번 정리한다. 선택 칸이 있는 맵만 훑는다 — 옛 맵은 비용 없음.
 * 이 도구가 건드린 맵만 정리한다: 새 맵, 칸이 바뀐 맵, 이번에 선택 칸 키가 새로 생긴 맵(썼다가 다 비운 경우 —
 * tileBuffersDiffer 는 없는 칸 = 빈칸으로 봐서 같다고 한다). 손대지 않은 맵의 빈 배열은 그대로 둔다 —
 * 지우면 event_command_assist 의 "명령 외의 변경" 비교와 맵 단위 되돌리기 스냅샷이 어긋난다.
 */
function compactTouchedMapLayers(before: Project, draft: Project): void {
  for (const [id, map] of Object.entries(draft.maps)) {
    if (!hasExtraLayers(map)) continue;
    const previous = before.maps[id];
    const touched = !previous
      || EXTRA_LAYER_KEYS.some((key) => map[key] !== undefined && previous[key] === undefined)
      || tileBuffersDiffer(previous, map);
    if (touched) compactMapLayers(map);
  }
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

  const normalizedArgs = argsWithCurrentMapTileset(ctx, tool,
    normalizeArgsForSchema(tool.parameters, normalizePlaceToolArgs(tool.name, stripResourceSearchIdPrefixes(args))) as Record<string, unknown>);
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
    compactTouchedMapLayers(before, draft);
    if (!tool.allowsTilesetChange) {
      rejectUploadedTilesetSwap(before, draft, name, normalizedArgs);
      rejectTilesetFamilyChange(ctx, before, draft, name);
    }
  } catch (cause) {
    const error = cause instanceof Error ? cause : new ToolError(String(cause), { code: "tool-exception" });
    return { ok: false, summary: failureSummary(name, error), issues: [issueFromToolError(tool, normalizedArgs, error)] };
  }

  try {
    const builtHouses = newlyBuiltHouseSnapshots(draft, protectedHouses);
    // 후처리: 나무 밑동 위 수관(upper) 강제 — 고아 밑동(14,5 등) 방지.
    // Canonical maps include frozen, digest-owned output. Never repair unrelated raster implicitly.
    const treeRepairNote = draft.spatialAuthoring === undefined && tool.preservesAuthoredRaster !== true
      ? formatTreePairRepairSummary(repairTreePairsOnProject(draft, {
        canopyReplacementExemptTileIds: resolveForestCanopyReplacementExemptTileIds(draft),
      })) : null;
    assertHouseProtection(protectedHouses, draft, builtHouses);

    const diff = summarizeChanges(before, draft);
    if (exec.warnings) diff.warnings.push(...exec.warnings);
    if (treeRepairNote) diff.warnings.push(treeRepairNote);

    // baseline(before)을 넘겨 "이 변경이 새로 만든" 오류만 커밋을 막는다 — 선재 오류 프로젝트 편집 허용.
    // 타일 도구는 호출마다 프로젝트를 통째로 직렬화하고 모든 맵의 클러스터 규칙을 다시 훑었다.
    // 왕복은 적용 커밋에 남기고, 클러스터는 타일이 바뀐 맵만 본다.
    const commit = commitChangeset(draft, before, {
      skipRoundtrip: true,
      clusterMapIds: tileChangedMapIds(before, draft),
    });
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
    if (!options.dryRun) {
      shareUnchangedTilesets(before, draft);
      ctx.project = draft;
    }
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
