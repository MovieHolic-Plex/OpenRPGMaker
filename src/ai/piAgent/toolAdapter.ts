import { PiTilesetReferenceGate } from "./tilesetReferenceGate";
import { spatialReferenceImages } from '@/editor/tools/spatialReferenceTools';
import { interiorPresetImages } from '@/editor/tools/interiorPresetExamples';
import { villageReferenceImages } from '@/ai/villageReferenceExamples';
import { retroChoreographyPreviewImages } from '@/assets/retroChoreographyPreviewImage';
import { cutscenePreviewImages } from '@/editor/tools/cutscenePreviewTools';
import { cutsceneArtImages } from '@/editor/tools/cutsceneArtTools';
import { worldTerrainImages } from '@/editor/tools/worldTerrainTools';
import { TILESET_REFERENCE_READ_TOOLS, TILESET_REFERENCE_WRITERS } from "@/editor/tools/tilesetReferenceTools";
// 레지스트리 툴 → Pi AgentTool 모양 어댑터. 순수 함수라 브라우저/Bun/Node 어디서나 같다.
//
// 설계 원칙: 툴 코드는 한 줄도 바꾸지 않는다. Pi 가 요구하는 것은 `execute` 가 실패 시 throw
// 하는 것뿐이므로, `runTool` 의 `ok:false` 를 예외로 옮기고 issues 를 본문에 실어 모델이
// 스스로 고치게 한다(기존 세션의 자가수정 루프와 같은 정보량).
//
// 이 파일은 @oh-my-pi 패키지를 import 하지 않는다. 그래서 vitest(Node)에서 검증되고,
// 원본 Pi 코어로 갈아탈 때도 이 모양은 그대로 쓸 수 있다(어댑터가 곧 퇴로다).

import { captureActivityVisuals, type ActivityVisual } from "@/ai/activityVisual";
import { TOOL_REGISTRY } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools";
import { EVENT_COMMAND_ASSIST_TOOL } from "@/editor/tools/eventCommandAssistTool";
import { prepareTool, runToolAsync } from "@/editor/tools/asyncToolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { synthesizeToolConstructionLogs, withConstructionLog, type ConstructionLog } from "@/editor/tools/constructionLog";
import type { Project } from "@/project/types";
import { mapBundleMapSpill } from "./mapBundle";
import { modernTilesetViolation, type ModernTilesetPolicy } from '../modernTilesetPolicy';

export interface PiToolTextContent {
  readonly type: "text";
  readonly text: string;
}

export interface PiToolExecResult {
  readonly content: (PiToolTextContent | { readonly type: "image"; readonly data: string; readonly mimeType: string })[];
  readonly details?: unknown;
}

export interface PiToolShape {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly parameters: unknown;
  /** Pi core schedules shared calls together and treats exclusive calls as ordered barriers. */
  readonly concurrency?: "shared" | "exclusive";
  execute(toolCallId: string, params: unknown, signal?: AbortSignal): Promise<PiToolExecResult>;
}

export interface PiToolCallRecord {
  readonly toolCallId?: string;
  readonly visuals?: readonly ActivityVisual[];
  readonly name: string;
  readonly args: unknown;
  readonly result: ToolResult;
  /** 쓰기 도구가 남긴 시공 단계(마을 짓기 등). 체크포인트에 실려 편집기 재생에만 쓰인다. */
  readonly constructionLogs?: readonly ConstructionLog[];
}

export interface CreatePiToolsetOptions {
  readonly modernTilesetPolicy?: ModernTilesetPolicy;
  readonly referenceGate?: PiTilesetReferenceGate;
  /** 노출 도메인. 비우면 살아 있는 레지스트리 전부. 도메인 없는(범용) 툴은 항상 포함. */
  readonly domains?: readonly string[];
  /** 읽기 툴만(검수 역할). */
  readonly readOnly?: boolean;
  /** 이름으로 딱 집어 노출(팀장 역할의 소수 읽기 툴). domains·readOnly 와 교집합. */
  readonly toolNames?: readonly string[];
  /** 툴 호출마다 호출. 이벤트 스트림·감사 로그용. */
  readonly onCall?: (record: PiToolCallRecord) => void;
  /** 읽기 툴 data 직렬화 상한(문자). 맵 전체 덤프가 컨텍스트를 삼키지 않게. */
  readonly maxDataChars?: number;
  /** 실패 본문에 실을 issues 상한. */
  readonly maxIssues?: number;
  /**
   * 맵 묶음 실행의 뿌리 맵들. 주면 쓰기 호출이 묶음 밖 기존 맵(`maps.<id>`)을 바꿀 때 그 호출을
   * 되돌리고 실패로 돌려준다 — 병합이 어차피 버릴 변경을 모델이 성공으로 믿지 않게.
   * 실측(run10): 묶음 밖 빈 시작 맵에 단 문이 병합에서 버려져 시작 맵→마을 길이 끊겼다.
   * 다른 키(mapTree·database 등)의 정책은 병합(`mergeMapBundles`)이 정한다 — 여기선 맵만 본다.
   */
  readonly scopeMapIds?: readonly string[];
  /** 평문 병합 실행(`piMapScopeGuard`) — 거부 문구가 「DB·시스템은 되고 다른 맵만 안 된다」고 말한다. */
  readonly scopeAllowsSystem?: boolean;
}

const DEFAULT_MAX_DATA_CHARS = 12_000;
/**
 * read_tileset_reference 한 쪽의 결과 상한. 쪽은 코드 울타리를 통째로 지키느라 최대 약 18,000자(JSON 으로 약 24,000)까지 갈 수 있는데,
 * 기본 상한 12,000 에서 잘린 쪽(dataTruncated)은 선행 읽기 게이트가 «읽은 증거»로 인정하지 않는다(tilesetReferenceGate.payload) —
 * 그 쪽은 몇 번을 다시 읽어도 영영 통과하지 못한다. 실측(2026-10-04): jp_city 입구 용도 jp-start 의 jp-dict-groups 첫 쪽(15,723자)이 그랬고
 * fill_region·paint_tiles 가 끝내 막혀 새 맵의 땅을 못 깔았다. 모든 번들 참고문서 1,403쪽 중 61쪽(12개 타일셋)이 12,000자를 넘는다(최대 15,776).
 */
const REFERENCE_PAGE_MAX_DATA_CHARS = 30_000;
const DEFAULT_MAX_ISSUES = 8;

export function selectPiToolDefinitions(
  domains?: readonly string[],
  options: { readonly readOnly?: boolean; readonly toolNames?: readonly string[] } = {},
) {
  const wanted = domains && domains.length > 0 ? new Set(domains) : null;
  const names = options.toolNames ? new Set(options.toolNames) : null;
  if (names && [...names].some(name => TILESET_REFERENCE_WRITERS.has(name))) TILESET_REFERENCE_READ_TOOLS.forEach(name => names.add(name));
  const seen = new Set<string>();
  return TOOL_REGISTRY.filter((tool) => {
    if (tool.deprecated || tool.supersededBy !== undefined || seen.has(tool.name)) return false;
    if (options.readOnly && tool.mode !== "read") return false;
    if (names && !names.has(tool.name)) return false;
    if (wanted && tool.domains?.length && !tool.domains.some(domain => wanted.has(domain))) return false;
    seen.add(tool.name);
    return true;
  });
}

function truncateJson(value: unknown, maxChars: number): { text: string; truncated: boolean } {
  const text = JSON.stringify(value);
  if (text === undefined) return { text: "null", truncated: false };
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}

export function formatPiToolSuccess(result: ToolResult, maxDataChars = DEFAULT_MAX_DATA_CHARS): string {
  const body: Record<string, unknown> = { ok: true, summary: result.summary };
  if (result.warnings && result.warnings.length > 0) body.warnings = result.warnings;
  if (result.issues && result.issues.length > 0) body.issues = result.issues.slice(0, DEFAULT_MAX_ISSUES);
  if (result.data !== undefined) {
    const { text, truncated } = truncateJson(result.data, maxDataChars);
    if (truncated) {
      body.dataTruncated = true;
      body.dataPreview = text;
      body.hint = "data 가 길어 잘렸습니다. 더 좁은 영역이나 필터로 다시 읽으세요.";
    } else {
      body.data = result.data;
    }
  }
  return JSON.stringify(body);
}

export function formatPiToolFailure(result: ToolResult, maxIssues = DEFAULT_MAX_ISSUES): string {
  return JSON.stringify({
    ok: false,
    summary: result.summary,
    issues: (result.issues ?? []).slice(0, maxIssues),
    ...(result.warnings && result.warnings.length > 0 ? { warnings: result.warnings } : {}),
  });
}

/**
 * find_tools 실행 결과에서 호출 가능해진 후보 이름을 수확한다 — Pi 에스컬레이션의 입력.
 * 실패·data 없음이면 빈 배열. 반환된 이름은 아직 실행 경계를 거치지 않은 “후보”다.
 */
export function harvestFindToolsNames(result: ToolResult): string[] {
  if (!result.ok) return [];
  const matches = (result.data as { readonly matches?: unknown } | undefined)?.matches;
  if (!Array.isArray(matches)) return [];
  const names: string[] = [];
  for (const match of matches) {
    const name = match && typeof match === "object" ? (match as { name?: unknown }).name : undefined;
    if (typeof name === "string" && name) names.push(name);
  }
  return names;
}

export interface ResolvePiToolOptions {
  readonly referenceGate?: PiTilesetReferenceGate;
  /** 읽기 전용 실행 — 쓰기 툴은 절대 셰이프가 되지 않는다. */
  readonly readOnly?: boolean;
  /** 실행의 하드 경계(팀 역할 제한 등). 설정되면 이 목록 안 이름만 만든다. */
  readonly toolNames?: readonly string[];
  readonly onCall?: (record: PiToolCallRecord) => void;
  readonly maxDataChars?: number;
  readonly scopeMapIds?: readonly string[];
  readonly scopeAllowsSystem?: boolean;
}

/**
 * 이름 하나의 실행 셰이프 — 에스컬레이션(find_tools 수확)·폴백(미노출 호출 구제)이 공유하는 해석기.
 * 레지스트리에 없거나 경계 밖(readOnly 중 쓰기·toolNames 목록 외·deprecated)이면 undefined —
 * 호출자는 undefined 를 “이 실행에서는 못 쓰는 툴”로 흘려 모델의 자가수정 루프에 태운다.
 */
export function resolvePiToolShape(ctx: ToolContext, name: string, options: ResolvePiToolOptions = {}): PiToolShape | undefined {
  if (options.toolNames && !options.toolNames.includes(name) && !(TILESET_REFERENCE_READ_TOOLS.some(n => n === name) && options.toolNames.some(n => TILESET_REFERENCE_WRITERS.has(n)))) return undefined;
  return createPiToolset(ctx, {
    toolNames: [name],
    referenceGate: options.referenceGate,
    readOnly: options.readOnly,
    onCall: options.onCall,
    scopeMapIds: options.scopeMapIds,
    scopeAllowsSystem: options.scopeAllowsSystem,
    ...(options.maxDataChars === undefined ? {} : { maxDataChars: options.maxDataChars }),
  }).find(tool => tool.name === name);
}

/**
 * 묶음 밖 기존 맵을 바꾼 호출이면 거부 결과를, 아니면 null. 묶음 밖에 **새로** 생긴 맵은 여기서 막지
 * 않는다 — 다음 호출에서 묶음 아래로 옮겨질 수 있다. 대신 `scopeNewMapWarnings` 가 경고를 붙인다.
 */
function scopeViolation(before: Project, after: Project, scopeMapIds: readonly string[], toolName: string, allowsSystem: boolean): ToolResult | null {
  const outside = mapBundleMapSpill(before, after, scopeMapIds)
    .map(key => key.slice("maps.".length))
    .filter(id => before.maps[id] !== undefined);
  if (outside.length === 0) return null;
  const names = outside.map(id => `${before.maps[id]!.name ?? id}(${id})`).join(", ");
  return {
    ok: false,
    summary: `${toolName} 호출을 되돌렸습니다: ${names} 은(는) 이번 작업 범위(${scopeMapIds.join(", ")}와 그 실내 맵) 밖이라 이 변경은 병합 때 버려집니다.`
      + (allowsSystem ? " DB·시스템(데이터베이스·설정·스위치 등)은 이번 작업에서도 편집할 수 있지만, 다른 맵은 바꿀 수 없습니다." : "")
      + ` 범위 밖 맵에 문·이벤트·타일을 달지 마세요. 게임 시작 지점이 범위 밖 맵이면 set_start_position 으로 시작 위치를 범위 안 맵(${scopeMapIds[0]})으로 옮기고,`
      + " 맵 사이 연결은 범위 안 맵끼리(실내는 build_hand_interior_room 으로 범위 안에 만든다) 만드세요.",
  };
}

/** 이 호출로 묶음 밖에 새로 생긴 맵마다 경고 — 묶음 아래로 달지 않으면 끝날 때 병합이 버린다. */
function scopeNewMapWarnings(before: Project, after: Project, scopeMapIds: readonly string[]): string[] {
  return mapBundleMapSpill(before, after, scopeMapIds)
    .map(key => key.slice("maps.".length))
    .filter(id => before.maps[id] === undefined && after.maps[id] !== undefined)
    .map(id => `맵 ${after.maps[id]!.name ?? id}(${id}) 는 작업 범위(묶음 ${scopeMapIds.join(", ")}) 밖에 생겼습니다.`
      + ` 묶음 맵 아래로 달지 않으면 끝날 때 버려집니다 — manage_map_tree 로 ${scopeMapIds[0]} 아래에 다세요.`);
}

export function createPiToolset(ctx: ToolContext, options: CreatePiToolsetOptions = {}): PiToolShape[] {
  const referenceGate = options.referenceGate ?? new PiTilesetReferenceGate();
  const maxDataChars = options.maxDataChars ?? DEFAULT_MAX_DATA_CHARS;
  const maxIssues = options.maxIssues ?? DEFAULT_MAX_ISSUES;
  return selectPiToolDefinitions(options.domains, { readOnly: options.readOnly, toolNames: options.toolNames }).map((tool) => ({
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    concurrency: tool.mode === "read" ? "shared" as const : "exclusive" as const,
    async execute(_toolCallId, params, signal) {
      const args = params && typeof params === "object" ? (params as Record<string, unknown>) : {};
      const before = tool.mode === "write" ? captureActivityVisuals(ctx.project, tool.name, args, undefined, "before") : [];
      const gate = tool.mode === "write" ? referenceGate.beforeWrite(ctx.project, tool.name, args) : null;
      const beforeProject = ctx.project;
      if (!gate && tool.prepare) await prepareTool(tool.name, args, ctx.project);
      let constructionLogs: readonly ConstructionLog[] = [];
      const writeStarted = Date.now();
      let result = gate ?? (tool.name === EVENT_COMMAND_ASSIST_TOOL
        ? await runToolAsync(ctx, tool.name, args, { signal })
        : tool.mode === "write"
          ? (({ value, logs }) => { constructionLogs = logs; return value; })(withConstructionLog(tool.name, () => runTool(ctx, tool.name, args)))
          : runTool(ctx, tool.name, args));
      if (tool.mode === 'write' && result.ok && options.modernTilesetPolicy) {
        const violation = modernTilesetViolation(beforeProject, ctx.project, options.modernTilesetPolicy);
        if (violation) { ctx.project = beforeProject; result = { ok: false, summary: violation }; }
      }
      // 러너는 draft 를 새로 만들어 ctx.project 를 갈아 끼운다 — 되돌리기는 이전 참조 복원이면 된다.
      if (tool.mode === "write" && result.ok && options.scopeMapIds?.length && ctx.project !== beforeProject) {
        const violation = scopeViolation(beforeProject, ctx.project, options.scopeMapIds, tool.name, options.scopeAllowsSystem === true);
        if (violation) {
          ctx.project = beforeProject;
          result = violation;
        } else {
          const warnings = scopeNewMapWarnings(beforeProject, ctx.project, options.scopeMapIds);
          if (warnings.length > 0) result = { ...result, warnings: [...(result.warnings ?? []), ...warnings] };
        }
      }
      // 시공 기록이 없는 쓰기 도구도 실제 변경을 아래층 → 위층 순서로 맵 위에서 다시 튼다(예전 밑그림, 2026-10-04).
      if (tool.mode === "write" && result.ok && ctx.project !== beforeProject) {
        constructionLogs = [...constructionLogs, ...synthesizeToolConstructionLogs(tool.name, beforeProject, ctx.project, constructionLogs, Date.now() - writeStarted)];
      }
      const after = captureActivityVisuals(ctx.project, tool.name, args, result, !result.ok ? "failed" : tool.mode === "write" ? "draft" : "read");
      options.onCall?.({ toolCallId: _toolCallId, name: tool.name, args, result, visuals: [...before, ...after],
        ...(result.ok && constructionLogs.length ? { constructionLogs } : {}) });
      if (!result.ok) throw new Error(formatPiToolFailure(result, maxIssues));
      const content: PiToolExecResult["content"] = [{ type: "text", text: formatPiToolSuccess(result, tool.name === "read_tileset_reference" ? Math.max(maxDataChars, REFERENCE_PAGE_MAX_DATA_CHARS) : maxDataChars) }];
      if (tool.name === "read_tileset_reference") {
        for (const image of await referenceGate.read(ctx.project, result)) {
          const comma = image.dataUrl.indexOf(",");
          content.push({ type: "image", mimeType: image.dataUrl.slice(5, image.dataUrl.indexOf(";")), data: image.dataUrl.slice(comma + 1) });
        }
      }
      if (tool.name === 'read_spatial_reference') for (const image of await spatialReferenceImages(ctx.project,args,result.data)) {
        content.push({type:'image',mimeType:image.dataUrl.slice(5,image.dataUrl.indexOf(';')),data:image.dataUrl.slice(image.dataUrl.indexOf(',')+1)});
      }
      if (tool.name === 'get_concept_facility') for (const image of await interiorPresetImages(result.data)) {
        content.push({type:'image',mimeType:image.dataUrl.slice(5,image.dataUrl.indexOf(';')),data:image.dataUrl.slice(image.dataUrl.indexOf(',')+1)});
      }
      if (tool.name === 'read_world_terrain' || tool.name === 'edit_world_terrain') for (const image of worldTerrainImages(tool.name)) {
        content.push({type:'image',mimeType:image.dataUrl.slice(5,image.dataUrl.indexOf(';')),data:image.dataUrl.slice(image.dataUrl.indexOf(',')+1)});
      }
      if (tool.name === 'generate_cutscene_art') for (const image of cutsceneArtImages(ctx.project, result.data)) {
        content.push({type:'image',mimeType:image.dataUrl.slice(5,image.dataUrl.indexOf(';')),data:image.dataUrl.slice(image.dataUrl.indexOf(',')+1)});
      }
      if (tool.name === 'preview_cutscene') for (const image of await cutscenePreviewImages(ctx.project, args)) {
        content.push({type:'image',mimeType:image.dataUrl.slice(5,image.dataUrl.indexOf(';')),data:image.dataUrl.slice(image.dataUrl.indexOf(',')+1)});
      }
      if (tool.name === 'preview_choreography') for (const image of await retroChoreographyPreviewImages(result.data)) {
        content.push({type:'image',mimeType:image.dataUrl.slice(5,image.dataUrl.indexOf(';')),data:image.dataUrl.slice(image.dataUrl.indexOf(',')+1)});
      }
      if (tool.name === 'author_village') for (const image of await villageReferenceImages(result.data)) {
        content.push({type:'image',mimeType:image.dataUrl.slice(5,image.dataUrl.indexOf(';')),data:image.dataUrl.slice(image.dataUrl.indexOf(',')+1)});
      }
      return { content, details: result };
    },
  }));
}
