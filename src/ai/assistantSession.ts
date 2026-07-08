// ai/assistantSession.ts
// 어시스턴트 세션: user msg → LLM → tool_calls → runTool(dryRun 누적) → tool 메시지 → … → 최종 응답.
// - 쓰기 툴은 로컬 draft(ctx.project)에 누적되어 연쇄 툴콜이 이전 결과를 본다(store는 건드리지 않음).
// - 커밋 게이트/인자 검증 실패 시 issues를 tool 메시지로 모델에 되돌려 자가수정을 유도(최대 maxToolCalls 왕복).
// - 브라우저 비의존(순수). chat 함수는 주입 가능(테스트에서 모킹).

import { getTool, runTool } from "@/editor/tools";
import { toOpenAiTools } from "@/editor/tools";
import type { ToolContext, ToolDomain, ToolResult } from "@/editor/tools";
import type { LintIssue } from "@/project/lint/projectLint";
import { beginAssistantToolDomainTurn, computeActiveToolDomains, recordAssistantToolDomainUse } from "@/editor/assistantToolMode";
import type { Project } from "@/project/types";
import { buildSystemPrompt, type ContextOptions } from "./contextBuilder";
import {
  chatCompletion,
  isLlmAbortError,
  isRetryableLlmError,
  LLM_RETRY_BACKOFF_MS,
  loadAiConfig,
  type AiConfig,
  type ChatMessage,
  type ChatRequest,
  type ChatResult,
  type ContentPart,
  type OpenAiToolSchema,
  type ToolCall,
} from "./llmClient";
import {
  SPATIAL_BUILD_TOOLS,
  affectedRegions,
  boundarySlackForTool,
  checkRegionsAgainstSpecBoundary,
  implicitSpecFromContext,
  validateBuildSpec,
  type BuildSpec,
} from "./buildSpec";
import { proposalHasChangedMap, proposalScopeCarryoverWarning } from "./proposalCompleteness";

// UI 스트리밍/로그용 이벤트.
export type SessionEvent =
  | { type: "assistant_token"; delta: string }
  | { type: "reasoning_token"; delta: string }
  | { type: "assistant_message"; content: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown>; result: ToolResult }
  | { type: "status"; text: string };

// 승인+시공 융합(2026-07-07 §2.1.3): v3 프리미티브가 "미승인 어휘"로 실패한 호출을
// 어휘 제안 카드에 보류 시공으로 첨부한다 — 수락 한 번으로 어휘 커밋 + 시공이 끝난다.
export interface PendingBuild {
  readonly tool: string;
  readonly args: Record<string, unknown>;
  readonly label: string;
  // 시공이 소비하는 어휘 id 인자 이름(예: wallVocabId)과 원래 값 — 카드 교정 시 리바인드용.
  readonly vocabIdField: string;
  readonly vocabId?: string;
}

// 제안(changeset)에 담기는 개별 쓰기 툴콜.
export interface ProposedCall {
  name: string;
  args: Record<string, unknown>;
  summary: string;
  result: ToolResult;
  destructive: boolean; // remove_event 등 파괴적 작업.
  requiresApproval?: boolean;
  approvalWarning?: string;
  // 이 어휘 제안이 수락되면 같은 제스처로 실행할 보류 시공(§2.1.3).
  pendingBuilds?: readonly PendingBuild[];
}

export interface TurnResult {
  assistantText: string;
  proposedCalls: ProposedCall[]; // 성공한 쓰기 툴콜(수락 시 store에 적용할 시퀀스).
  stoppedReason: "final" | "max-tool-calls" | "token-budget" | "error" | "aborted";
  error?: string;
}

// 감사 로그 항목(Phase 1 헤드리스 러너로 리플레이 가능한 시퀀스).
// at: ISO 타임스탬프(결함 ⑬ — 상태 전이/툴 호출/오류 타임라인을 export 가능하게).
// kind:"status"는 턴 수명주기(시작/종료 사유/오류/재시도) 전이 기록이다.
export type AuditEntry =
  | { kind: "user"; text: string; at?: string }
  | { kind: "assistant"; text: string; toolCalls?: { name: string; args: string }[]; at?: string }
  | { kind: "tool"; name: string; args: Record<string, unknown>; ok: boolean; summary: string; issues?: string[]; at?: string }
  | { kind: "status"; text: string; at?: string };

type ChatFn = (config: AiConfig, req: ChatRequest) => Promise<ChatResult>;

// 파괴적으로 간주하는 툴 이름.
const DESTRUCTIVE_TOOLS = new Set(["remove_event", "remove_map"]);
// v3 공정 프리미티브 → 어휘 id 인자 이름(§2.1.3 보류 시공 리바인드용).
export const V3_PRIMITIVE_VOCAB_FIELDS: ReadonlyMap<string, string> = new Map([
  ["build_wall", "wallVocabId"],
  ["build_roof", "roofVocabId"],
  ["place_door", "doorVocabId"],
  ["place_window", "windowVocabId"],
  ["lay_path", "pathVocabId"],
  ["place_props", "propVocabId"],
]);

// 보류 시공 카드 라벨(예: "벽 (8,6) 6×5") — 사용자가 무엇이 시공될지 카드에서 본다.
export function pendingBuildLabel(tool: string, args: Record<string, unknown>): string {
  const rect = isRecord(args.rect) ? args.rect : undefined;
  const at = isRecord(args.at) ? args.at : undefined;
  switch (tool) {
    case "build_wall":
      return rect ? `벽 (${String(rect.x)},${String(rect.y)}) ${String(rect.w)}×${String(rect.h)}` : "벽";
    case "build_roof":
      return "지붕";
    case "place_door":
      return at ? `문 (${String(at.x)},${String(at.y)})` : "문";
    case "place_window":
      return at ? `창문 (${String(at.x)},${String(at.y)})` : "창문";
    case "lay_path":
      return Array.isArray(args.points) ? `길 경유점 ${args.points.length}개` : "길";
    case "place_props":
      return typeof args.count === "number" ? `소품 ${args.count}개` : "소품";
    default:
      return tool;
  }
}
export const RULE_TOOLS: ReadonlySet<string> = new Set(["set_cluster_rule", "set_group_junction", "set_group_overlay"]);
// v3 어휘 프로포절(2026-07-07, 원칙 0): 승인 = origin:"user" 마킹은 '사용자 명시 수락'으로만.
// requiresApproval 태깅이 메타데이터 자동 커밋·autoApprove 자동 수락 경로를 모두 차단하므로,
// 이 툴의 draft 마킹이 store에 반영되는 유일한 경로가 명시 수락이 된다(자동 수락 = 승인 불인정).
export const VOCABULARY_PROPOSAL_TOOLS: ReadonlySet<string> = new Set(["propose_tile_vocabulary"]);
const VOCABULARY_APPROVAL_WARNING = "🔒 어휘 승인 제안: 수락하면 해당 타일/그룹이 승인 보캐뷸러리(origin:user)에 편입됩니다. 자동 승인은 적용되지 않습니다.";
const HARD_CLUSTER_RULE_WARNING = "⚠️ 강한 규칙: 이 타일셋을 쓰는 모든 맵의 저장(커밋)이 규칙 위반 시 거부됩니다.";
export const TOKEN_BUDGET_STATUS_TEXT = "요청이 커서 이번 턴에는 일부만 제안합니다. 이어서 요청해 주세요.";

export function proposalNeedsExplicitApproval(calls: readonly ProposedCall[]): boolean {
  return calls.some((call) => call.requiresApproval === true);
}

export function proposalApprovalWarnings(calls: readonly ProposedCall[]): string[] {
  const warnings = calls
    .map((call) => call.approvalWarning)
    .filter((warning): warning is string => typeof warning === "string" && warning.length > 0);
  return [...new Set(warnings)];
}

export function ruleToolRejectionText(name: string, result: ToolResult): string | null {
  if (!RULE_TOOLS.has(name) || result.ok) return null;
  const issues = result.issues ?? [];
  if (issues.length === 0) return `실패 · ${name} — 커밋 거부: ${result.summary}`;
  const samples = issues
    .filter((issue) => typeof issue.mapId === "string" && typeof issue.x === "number" && typeof issue.y === "number")
    .slice(0, 2)
    .map((issue) => `${issue.mapId} ${issue.x},${issue.y}`);
  const coords = samples.length > 0 ? ` (${samples.join(" / ")}${issues.length > samples.length ? " …" : ""})` : "";
  return `실패 · ${name} — 커밋 거부: 위반 ${issues.length}곳${coords}`;
}

function approvalWarningFor(name: string, args: Record<string, unknown>): string | undefined {
  if (VOCABULARY_PROPOSAL_TOOLS.has(name)) return VOCABULARY_APPROVAL_WARNING;
  const rule = args.rule;
  if (name !== "set_cluster_rule" || !isRecord(rule)) return undefined;
  return rule.strength === "hard" ? HARD_CLUSTER_RULE_WARNING : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ── 비전(BUG C) ───────────────────────────────────────────────────
// 툴 결과는 지금까지 텍스트 JSON으로만 모델에 전달됐다 — 비전 모델이 타일을 '보지' 못해
// 의미를 지어냈다(예: 타일 80을 '탁자'로 오인). 렌더러가 있으면 '보여줘' 계열 툴의 이미지를
// 후속 user 메시지로 주입해 모델이 실제로 보게 한다. 렌더러는 브라우저 전용(패널이 주입).
export interface RenderedToolImage {
  dataUrl: string;
  label: string;
}
export type ToolImageRenderer = (
  project: Project,
  toolName: string,
  data: unknown
) => Promise<RenderedToolImage[]>;

// 이미지를 주입할 툴(명시적 '보여줘' 계열 + 미리보기). get_map_region 등 빈번 조회는 텍스트로 두어 토큰을 아낀다.
const VISION_TOOLS = new Set(["show_tiles", "show_tile_grid", "show_map_region", "preview_house", "render_group_sample"]);

// ── 스펙 게이트(2026-07-05, '모호도' 대체) ────────────────────────
// 자기 신고 수치([모호도 N%]) 대신 코드가 검증하는 밑그림(명세)을 쓴다:
// 공간 쓰기 툴은 set_build_spec으로 제출되어 결정적으로 검증(경계/겹침)된 명세의
// 할당 영역 안에서만 실행된다(구간 격리). 사용자가 맵에서 선택한 영역은 암묵적 명세.
// 검증 3회 실패 시 그 계획은 폐기하고 사용자에게 묻도록 유도한다.

// 타일 지식 기록(인터뷰/시연의 답 기록)은 맵/이벤트를 바꾸지 않는 계열 —
// 제안 카드 없이 즉시 저장되는 목록(패널이 자동 반영 판단에 공유한다).
export const METADATA_ONLY_TOOLS = new Set([
  "set_tile_metadata",
  "set_tile_rules",
  "upsert_tile_group",
  "set_tile_passability",
]);

// 세션 전용 툴: 공간 빌드 전 밑그림 제출. 레지스트리 툴이 아니라(프로젝트를 바꾸지 않음)
// 세션이 직접 처리하며, tools 배열에는 이 스키마를 덧붙여 모델에 노출한다.
const SET_BUILD_SPEC_TOOL: OpenAiToolSchema = {
  type: "function",
  function: {
    name: "set_build_spec",
    description:
      "공간 빌드(집/마을/길/청소/NPC 배치) 전 밑그림(명세)을 제출한다. 검증(경계/겹침) 통과 후에만 공간 빌드 툴이 열린다. 페인트/배치 호출은 할당 영역 +2칸까지 warning으로 통과하지만, clear_region은 slack 없이 명세 안에서만 실행된다. 에셋마다 겹치지 않는 영역(x,y,w,h)을 배정하라.",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string" },
        title: { type: "string", description: "밑그림 이름(예: 잿불 마을 확장)" },
        assets: {
          type: "array",
          description:
            "[{id,kind,x,y,w,h,layer?,style?,confirmDestroy?}] — kind: house|road|npc|prop|clear 등, layer: lower(기본)|upper(장식). " +
            "clear 에셋이 기존 구조물(집 등)을 덮으면 confirmDestroy:true가 있어야 통과합니다 — '주변 청소'는 구조물을 피해 영역을 좁히세요.",
          items: { type: "object" },
        },
        buildOrder: {
          type: "array",
          items: { type: "string" },
          description: "건설 순서(kind 목록, 예: [\"road\",\"house\",\"prop\"]). 마을 같은 복합 건축은 먼저 순서를 정해 사용자에게 확인하라 — 길 먼저? 집 먼저? 소품 먼저?",
        },
        pathWidth: { type: "integer", description: "통로 너비(칸)" },
        density: { type: "string", enum: ["spacious", "normal", "dense"], description: "에셋 분배(넓찍/보통/다닥)" },
        layoutStyle: { type: "string", enum: ["straight", "curved", "random"], description: "배치 스타일" },
      },
      required: ["mapId", "assets"],
    },
  },
};

// 검증 실패 허용 횟수(턴당). 초과하면 계획 폐기를 지시한다 — 루프 방지.
const MAX_SPEC_REJECTIONS = 3;
const ASSISTANT_TURN_RETRY_ATTEMPTS = 2;

function specGateResult(summary: string, guidance: readonly string[]): ToolResult {
  return {
    ok: false,
    summary,
    issues: [{ severity: "error", code: "spec-gate", message: guidance.join(" ") }],
  };
}

interface SpecGatePass {
  warnings: LintIssue[];
}

export interface AssistantSessionOptions {
  config?: AiConfig;
  contextOptions?: ContextOptions;
  // 테스트/대체용 chat 구현. 기본은 실제 OpenRouter 호출.
  chat?: ChatFn;
  // 비전 이미지 렌더러(브라우저 전용). 없으면 텍스트 전용(Node/테스트에서 동일 동작).
  renderImages?: ToolImageRenderer;
  // 이전 모드 스코핑 호환 옵션. 현재는 computeActiveToolDomains()가 UI 도메인을 직접 계산한다.
  toolMode?: () => ToolDomain | undefined;
}

export class AssistantSession {
  private config: AiConfig;
  private readonly chat: ChatFn;
  private readonly contextOptions: ContextOptions;
  // 비전 렌더러(브라우저 전용). 주입되면 '보여줘' 툴 이미지가 모델에 전달된다.
  private readonly renderImages?: ToolImageRenderer;
  // 누적 draft를 담는 툴 컨텍스트(연쇄 툴콜이 이전 변경을 본다).
  private ctx: ToolContext;
  private readonly messages: ChatMessage[] = [];
  private readonly audit: AuditEntry[] = [];
  // 세션 시작 시점 스냅샷(수락 시 store와 대조/리플레이용). rebaseProject로 갱신될 수 있다.
  baselineProject: Project;
  // 스펙 게이트 상태: 확정된 밑그림은 턴 간 유지된다(사용자가 "계속해"로 이어가도 재제출 불필요).
  // 새 set_build_spec이 검증을 통과하면 교체된다.
  private activeSpec: BuildSpec | null = null;
  private activeSpecTurnIndex = 0;
  private currentTurnIndex = 0;
  // 이번 턴 사용자 메시지의 [컨텍스트] 선택 영역에서 파생된 암묵적 명세(턴마다 재계산).
  private turnImplicitSpec: BuildSpec | null = null;
  // 이번 턴 시작 전에 이미 존재하던 명시 스펙. 이 스펙으로 변경 제안이 만들어지면
  // 카드에 이전 계획 포함 경고를 붙인다(D06).
  private carryoverSpecForTurn: BuildSpec | null = null;
  private carryoverWarningAdded = false;
  // 이번 턴의 명세 검증 실패 횟수 — MAX_SPEC_REJECTIONS 초과 시 폐기 지시.
  private specRejections = 0;
  // 이번 턴에 누적된 제안 — 오류 후 재시도(retryLastTurn)에서도 이어진다(결함 ⑥).
  private turnProposals = new Map<string, ProposedCall>();
  // 이번 턴에 "미승인 어휘"로 실패한 v3 시공 호출(§2.1.3) — 어휘 제안 카드에 첨부된다.
  private turnPendingBuilds = new Map<string, PendingBuild>();
  private eventBaseProposalKeys = new Map<string, string>();
  private currentTurnToolDomains: ReadonlySet<ToolDomain> | undefined;
  // 직전 턴이 LLM 오류로 끊겼는가(수동 재시도 허용 플래그).
  private lastTurnFailed = false;

  constructor(project: Project, options: AssistantSessionOptions = {}) {
    this.config = options.config ?? loadAiConfig();
    this.chat = options.chat ?? chatCompletion;
    this.contextOptions = options.contextOptions ?? {};
    this.renderImages = options.renderImages;
    this.baselineProject = structuredClone(project);
    this.ctx = { project: structuredClone(project) };
    this.messages.push({ role: "system", content: buildSystemPrompt(project, this.contextOptions) });
  }

  getMessages(): readonly ChatMessage[] {
    return this.messages;
  }

  // 설정 폼에서 저장한 새 설정(API 키/모델 등)을 진행 중인 세션에도 반영한다.
  // 세션이 생성 시점 설정을 캐시해 키를 저장해도 401이 반복되던 문제의 해법 —
  // 대화/초안은 보존하고 다음 요청부터 새 설정을 쓴다.
  updateConfig(config: AiConfig): void {
    this.config = config;
  }

  // 지금까지 누적된 draft(= 제안 프리뷰의 정확한 결과). 수락 시 이 스냅샷을 그대로 적용한다.
  // 연쇄 툴콜이 자동 생성 id를 참조하는 경우 재실행(applyToolSequenceToStore) 대신 이 값을 쓰면
  // "프리뷰 == 적용" 이 보장된다.
  getProposedProject(): Project {
    return structuredClone(this.ctx.project);
  }

  // 제안 수락/거부 후, 대화(메시지·감사 로그)를 유지한 채 프로젝트 기준만 store 최신 상태로 갱신한다.
  // 세션 폐기(dropSession)와 달리 대화 기억을 잃지 않는다 — "채팅 세션 단위 전체 기억"(#6)의 핵심.
  rebaseProject(project: Project): void {
    this.baselineProject = structuredClone(project);
    this.ctx = { project: structuredClone(project) };
  }

  // 현재 확정된 밑그림(없으면 null). 패널이 상태 표시/카드 렌더에 쓴다.
  getActiveSpec(): BuildSpec | null {
    return this.activeSpec;
  }

  // set_build_spec 처리: 검증 통과 시 활성화(턴 간 유지), 실패 시 사유를 되돌려 재제출 유도.
  // 프로젝트를 바꾸지 않으므로 diff가 없고 제안(changeset)에도 포함되지 않는다.
  private applyBuildSpec(args: Record<string, unknown>): ToolResult {
    const spec = args as unknown as BuildSpec;
    const errors = validateBuildSpec(this.ctx.project, spec).filter((issue) => issue.severity === "error");
    if (errors.length > 0) {
      this.specRejections += 1;
      const discarded = this.specRejections >= MAX_SPEC_REJECTIONS;
      const issues = errors.map((issue) => ({ severity: "error" as const, code: "spec-invalid", message: issue.message }));
      issues.push({
        severity: "error",
        code: "spec-invalid",
        message: discarded
          ? `검증 ${this.specRejections}회 실패 — 이 계획은 폐기하세요. 툴 호출을 멈추고 사용자에게 [선택지]로 배치를 확인받으세요.`
          : "겹치지 않게 좌표를 고쳐 set_build_spec을 재제출하세요.",
      });
      return {
        ok: false,
        summary: `밑그림 검증 실패(${this.specRejections}회)${discarded ? " — 계획 폐기" : ""}`,
        issues,
      };
    }
    this.activeSpec = spec;
    this.activeSpecTurnIndex = this.currentTurnIndex;
    this.carryoverSpecForTurn = null;
    this.specRejections = 0;
    const kinds = [...new Set(spec.assets.map((asset) => asset.kind))].join("·");
    return {
      ok: true,
      summary: `밑그림 확정: ${spec.title ?? spec.mapId} — 에셋 ${spec.assets.length}개(${kinds})`,
      data: spec,
    };
  }

  // 공간 쓰기 툴 게이트. 통과하면 warning 목록, 차단이면 사유가 담긴 ToolResult.
  private specGate(name: string, args: Record<string, unknown>): ToolResult | SpecGatePass {
    const regions = affectedRegions(name, args);
    if (regions.length === 0) return { warnings: [] }; // mapId 없는 인자 형태 — 현 공간 툴셋엔 없음.
    const mapId = regions[0].mapId;
    const specs = [this.activeSpec, this.turnImplicitSpec]
      .filter((spec): spec is BuildSpec => spec !== null && spec.mapId === mapId);
    if (specs.length === 0) {
      return specGateResult(`스펙 게이트: '${name}' 차단 — 이 맵의 밑그림(스펙)이 없습니다`, [
        "공간 빌드는 set_build_spec으로 밑그림을 제출해 검증을 통과한 뒤에만 실행됩니다.",
        "체크리스트: 대상 맵, 에셋별 영역(x,y,w,h)·종류·스타일, 통로 너비(pathWidth), 밀도(density), 배치 스타일(layoutStyle).",
        "사용자가 맵에서 선택한 영역([컨텍스트]의 '사용자 선택 영역')은 암묵적 명세로 인정됩니다 — 필요하면 영역 지정을 요청하세요.",
      ]);
    }
    // 명시 스펙 + 암묵 선택 영역(같은 맵)의 합집합으로 커버리지를 판정한다.
    const assets = specs.flatMap((spec) => spec.assets);
    const slackCells = boundarySlackForTool(name);
    const coverage = checkRegionsAgainstSpecBoundary(assets, regions, slackCells);
    if (!coverage.withinSlack) {
      const sample = coverage.sample ? `, 예: (${coverage.sample.x},${coverage.sample.y})` : "";
      const slackSummary = slackCells > 0 ? `허용 slack ±${slackCells}칸 초과` : "이 툴은 slack 없음";
      const slackGuidance = slackCells > 0
        ? `경계 근처 ${slackCells}칸까지는 warning으로 통과하지만, 이 호출은 허용 slack ±${slackCells}칸을 넘었습니다.`
        : "정리/파괴성 호출은 slack 없이 밑그림에 할당된 영역 안에서만 실행됩니다.";
      return specGateResult(`스펙 게이트: '${name}' 차단 — 할당 영역 밖(${coverage.outsideCells}칸${sample}, ${slackSummary})`, [
        "이 호출의 좌표가 밑그림에 할당된 영역을 벗어났습니다(구간 격리).",
        slackGuidance,
        "좌표를 명세 안으로 고치거나, 필요한 영역을 에셋으로 추가해 set_build_spec을 재제출하세요.",
      ]);
    }
    if (slackCells > 0 && !coverage.covered && coverage.slackWarning) {
      return {
        warnings: [{
          severity: "warning",
          code: "spec-gate-slack",
          message: coverage.slackWarning,
        }],
      };
    }
    return { warnings: [] };
  }

  exportAudit(): string {
    return JSON.stringify({ model: this.config.model, entries: this.audit }, null, 2);
  }

  // 패널이 세션을 폐기(수락/거부)하기 전에 감사 항목을 회수해 누적 보관할 수 있게 한다.
  getAuditEntries(): readonly AuditEntry[] {
    return this.audit;
  }

  // 한 턴 실행: 사용자 메시지 → (LLM ↔ 툴) 루프 → 최종 응답 + 제안 changeset.
  async sendUserMessage(
    text: string,
    onEvent: (event: SessionEvent) => void = () => {},
    signal?: AbortSignal
  ): Promise<TurnResult> {
    this.messages.push({ role: "user", content: text });
    this.pushAudit({ kind: "user", text });
    beginAssistantToolDomainTurn(text);
    this.currentTurnToolDomains = computeActiveToolDomains(text);

    // 스펙 게이트 턴 초기화: 사용자 선택 영역([컨텍스트])은 이 턴의 암묵적 명세가 된다.
    this.currentTurnIndex += 1;
    this.turnImplicitSpec = implicitSpecFromContext(text);
    this.carryoverSpecForTurn = this.activeSpec && this.activeSpecTurnIndex < this.currentTurnIndex
      ? structuredClone(this.activeSpec)
      : null;
    this.carryoverWarningAdded = false;
    this.specRejections = 0;
    this.turnProposals = new Map();
    this.turnPendingBuilds = new Map();
    this.eventBaseProposalKeys = new Map();

    return await this.runTurnLoop(onEvent, signal);
  }

  // 직전 턴이 LLM 오류로 끊긴 경우에만 재개 가능(도그푸딩 결함 ⑥ — 수동 재시도).
  canRetryLastTurn(): boolean {
    return this.lastTurnFailed;
  }

  // 오류로 끊긴 턴 재개: 새 사용자 메시지 없이 (LLM ↔ 툴) 루프만 다시 돈다.
  // 이미 누적된 제안(turnProposals)과 대화 문맥은 그대로 유지된다.
  async retryLastTurn(onEvent: (event: SessionEvent) => void = () => {}, signal?: AbortSignal): Promise<TurnResult> {
    if (!this.lastTurnFailed) {
      return { assistantText: "", proposedCalls: this.finalizeProposals(this.turnProposals), stoppedReason: "final" };
    }
    this.pushAudit({ kind: "status", text: "오류 후 재시도(retryLastTurn)" });
    return await this.runTurnLoop(onEvent, signal);
  }

  // 감사 항목에 ISO 타임스탬프를 붙여 기록한다(결함 ⑬ — 타임라인 export).
  private pushAudit(entry: AuditEntry): void {
    this.audit.push({ ...entry, at: new Date().toISOString() });
  }

  private withCarryoverWarningIfNeeded(proposal: ProposedCall): ProposedCall {
    const spec = this.carryoverSpecForTurn;
    if (spec === null || this.carryoverWarningAdded || !SPATIAL_BUILD_TOOLS.has(proposal.name)) return proposal;
    if (!proposalHasChangedMap([proposal], spec.mapId)) return proposal;

    this.carryoverWarningAdded = true;
    const warning = proposalScopeCarryoverWarning(buildSpecPlanLabel(spec));
    return { ...proposal, result: appendDiffWarning(proposal.result, warning) };
  }

  // 미승인 어휘로 실패한 v3 시공 호출을 보류 시공으로 기록한다(같은 호출 재시도는 1건으로 병합).
  private recordPendingBuildIfUnapproved(name: string, args: Record<string, unknown>, result: ToolResult): void {
    const vocabIdField = V3_PRIMITIVE_VOCAB_FIELDS.get(name);
    if (!vocabIdField || result.ok) return;
    if (!(result.issues ?? []).some((issue) => issue.code === "unapproved-vocabulary")) return;
    const vocabId = typeof args[vocabIdField] === "string" ? (args[vocabIdField] as string) : undefined;
    this.turnPendingBuilds.set(`${name}:${JSON.stringify(args)}`, {
      tool: name,
      args: structuredClone(args),
      label: pendingBuildLabel(name, args),
      vocabIdField,
      ...(vocabId !== undefined ? { vocabId } : {}),
    });
  }

  // 턴 종료 시 보류 시공을 마지막 어휘 제안 카드에 첨부한다(§2.1.3).
  // 어휘 제안이 없으면 첨부할 카드가 없으므로 버린다(다음 턴에서 다시 제안됨).
  private finalizeProposals(proposedByKey: Map<string, ProposedCall>): ProposedCall[] {
    const calls = [...proposedByKey.values()];
    if (this.turnPendingBuilds.size === 0) return calls;
    const lastProposeIndex = calls.map((call) => call.name).lastIndexOf("propose_tile_vocabulary");
    if (lastProposeIndex < 0) return calls;
    return calls.map((call, index) =>
      index === lastProposeIndex ? { ...call, pendingBuilds: [...this.turnPendingBuilds.values()] } : call
    );
  }

  private upsertProposal(proposedByKey: Map<string, ProposedCall>, proposal: ProposedCall): void {
    const move = moveEventTarget(proposal);
    if (move !== null) {
      const baseKey = this.eventBaseProposalKeys.get(eventTargetKey(move));
      const baseProposal = baseKey ? proposedByKey.get(baseKey) : undefined;
      if (baseKey && baseProposal) {
        proposedByKey.set(baseKey, withMovedEventBaseProposal(baseProposal, move));
        return;
      }
      proposedByKey.set(`move_event:${eventTargetKey(move)}`, proposal);
      return;
    }

    const key = proposalKey(proposal);
    proposedByKey.set(key, proposal);
    const eventTarget = eventBaseTarget(proposal);
    if (eventTarget !== null) this.eventBaseProposalKeys.set(eventTargetKey(eventTarget), key);
  }

  private async chatWithTransientRetry(
    req: ChatRequest,
    onEvent: (event: SessionEvent) => void,
    signal?: AbortSignal
  ): Promise<ChatResult> {
    let attempt = 0;
    while (true) {
      let streamedAny = false;
      try {
        return await this.chat(this.config, {
          ...req,
          onToken: (delta) => {
            streamedAny = true;
            onEvent({ type: "assistant_token", delta });
          },
          onReasoning: (delta) => {
            streamedAny = true;
            onEvent({ type: "reasoning_token", delta });
          },
          signal,
        });
      } catch (cause) {
        if (
          signal?.aborted ||
          isLlmAbortError(cause) ||
          !isRetryableLlmError(cause) ||
          streamedAny ||
          attempt >= ASSISTANT_TURN_RETRY_ATTEMPTS
        ) {
          throw cause;
        }
        attempt += 1;
        this.pushAudit({ kind: "status", text: `일시 오류 자동 재시도 ${attempt}/${ASSISTANT_TURN_RETRY_ATTEMPTS}` });
        await sleep(LLM_RETRY_BACKOFF_MS * attempt);
      }
    }
  }

  private async runTurnLoop(onEvent: (event: SessionEvent) => void, signal?: AbortSignal): Promise<TurnResult> {
    this.lastTurnFailed = false;
    // 컨텍스트 도메인 스코핑: 턴 시작 사용자 메시지 기준의 도메인 유니온으로 툴을 고정한다.
    const domains = this.currentTurnToolDomains ?? computeActiveToolDomains("");
    const tools = [...toOpenAiTools(undefined, { domains }), SET_BUILD_SPEC_TOOL];
    const proposedByKey = this.turnProposals;
    let assistantText = "";
    // 에이전틱 예산: 사용자 제한은 출력 토큰 하나뿐. 루프 깊이는 사실상 무제한이고
    // (maxToolCalls 기본 200은 폭주 방지 안전핀), 누적 출력 토큰이 maxTokens를 넘으면 멈춘다.
    let spentOutputTokens = 0;

    for (let round = 0; round < this.config.maxToolCalls; round += 1) {
      if (signal?.aborted) {
        this.pushAudit({ kind: "status", text: "턴 중단(aborted): 사용자가 중단했습니다" });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "aborted", error: "사용자가 중단했습니다" };
      }
      let result: ChatResult;
      try {
        result = await this.chatWithTransientRetry({
          messages: this.messages,
          tools,
          tool_choice: "auto",
        }, onEvent, signal);
      } catch (cause) {
        if (isLlmAbortError(cause) || signal?.aborted) {
          this.lastTurnFailed = false;
          this.pushAudit({ kind: "status", text: "턴 중단(aborted): 사용자가 중단했습니다" });
          return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "aborted", error: "사용자가 중단했습니다" };
        }
        const error = cause instanceof Error ? cause.message : String(cause);
        this.lastTurnFailed = true; // 수동 재시도(retryLastTurn) 허용 상태로 표시.
        this.pushAudit({ kind: "status", text: `턴 중단(error): ${error}` });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "error", error };
      }
      spentOutputTokens += result.usage?.completion_tokens ?? estimateOutputTokens(result.message);

      const assistantMsg = result.message;
      this.messages.push(assistantMsg);
      // assistant 응답은 항상 문자열 content다(멀티모달 파트는 우리가 넣는 user 메시지 전용).
      const messageText = typeof assistantMsg.content === "string" ? assistantMsg.content : null;
      this.pushAudit({
        kind: "assistant",
        text: messageText ?? "",
        toolCalls: assistantMsg.tool_calls?.map((tc) => ({ name: tc.function.name, args: tc.function.arguments })),
      });

      const toolCalls = assistantMsg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        // 최종 응답.
        assistantText = messageText ?? "";
        onEvent({ type: "assistant_message", content: assistantText });
        this.pushAudit({ kind: "status", text: `턴 종료(final) — 제안 ${proposedByKey.size}건` });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "final" };
      }

      // 이번 라운드에 렌더된 비전 이미지(있으면 툴 메시지 뒤에 user 메시지로 주입).
      const roundImages: RenderedToolImage[] = [];
      // 각 tool_call 실행 → role:"tool" 메시지로 결과 반환.
      for (const call of toolCalls) {
        const { name, args } = parseToolCall(call);
        const tool = getTool(name);
        // 스펙 게이트: set_build_spec은 세션이 직접 처리(검증·활성화)하고,
        // 공간 쓰기 툴은 검증된 밑그림의 할당 영역 안에서만 실행한다(구간 격리).
        let toolResult: ToolResult;
        if (name === "set_build_spec") {
          toolResult = this.applyBuildSpec(args);
        } else {
          const gate = tool?.mode === "write" && SPATIAL_BUILD_TOOLS.has(name) ? this.specGate(name, args) : { warnings: [] };
          toolResult = isSpecGatePass(gate)
            ? withSpecGateWarnings(runTool(this.ctx, name, args, { dryRun: false }), gate.warnings)
            : gate;
        }
        // 승인+시공 융합(§2.1.3): 미승인 어휘로 거부된 v3 시공은 보류 시공으로 기록해
        // 이번 턴의 어휘 제안 카드에 첨부한다(수락 한 번 = 어휘 커밋 + 시공).
        this.recordPendingBuildIfUnapproved(name, args, toolResult);
        if (toolResult.ok && tool) recordAssistantToolDomainUse(tool.domains);
        onEvent({ type: "tool_call", name, args, result: toolResult });
        this.pushAudit({
          kind: "tool",
          name,
          args,
          ok: toolResult.ok,
          summary: toolResult.summary,
          // 실패/경고 원인은 감사 로그에도 남긴다 — summary만으로 원인 추적이 안 되던 문제 방지.
          ...(toolResult.issues && toolResult.issues.length > 0 ? { issues: toolResult.issues.map((issue) => issue.message) } : {}),
        });

        // 성공한 쓰기 툴콜만 제안에 누적(동일 좌표 재편집은 최신 것으로 갱신).
        if (toolResult.ok && tool?.mode === "write" && toolResult.diff) {
          let proposal: ProposedCall = {
            name,
            args,
            summary: toolResult.summary,
            result: toolResult,
            destructive: DESTRUCTIVE_TOOLS.has(name),
            requiresApproval: RULE_TOOLS.has(name) || DESTRUCTIVE_TOOLS.has(name) || VOCABULARY_PROPOSAL_TOOLS.has(name),
          };
          const approvalWarning = approvalWarningFor(name, args);
          if (approvalWarning) proposal.approvalWarning = approvalWarning;
          proposal = this.withCarryoverWarningIfNeeded(proposal);
          this.upsertProposal(proposedByKey, proposal);
        }

        this.messages.push({
          role: "tool",
          tool_call_id: call.id,
          name,
          content: JSON.stringify(toolResultForModel(toolResult)),
        });

        // 비전(BUG C): '보여줘' 계열 툴이면 이미지를 렌더해 모아둔다. 렌더 실패는 무시(텍스트로 진행).
        if (this.renderImages && VISION_TOOLS.has(name) && toolResult.ok && toolResult.data !== undefined) {
          try {
            roundImages.push(...(await this.renderImages(this.ctx.project, name, toolResult.data)));
          } catch {
            /* 렌더 실패는 치명적이지 않다 */
          }
        }
      }

      // 비전 주입: tool 메시지들 뒤에 이미지를 담은 user 메시지를 넣어 모델이 실제로 보게 한다.
      // (OpenAI 순서 규약: assistant(tool_calls) → tool 응답들 → 그다음 다른 role 메시지)
      if (roundImages.length > 0) {
        const parts: ContentPart[] = [
          {
            type: "text",
            text: "방금 show_tiles/show_tile_grid로 조회한 이미지입니다. 타일의 의미·라벨·용도를 판단하거나 사용자에게 설명하기 전에 반드시 아래 이미지를 눈으로 확인하세요.",
          },
        ];
        for (const image of roundImages) {
          parts.push({ type: "text", text: image.label });
          parts.push({ type: "image_url", image_url: { url: image.dataUrl } });
        }
        this.messages.push({ role: "user", content: parts });
      }

      // 출력 토큰 예산 확인(라운드의 툴 실행까지 마친 뒤). 예산 소진이 유일한 사용자 제한이다.
      if (spentOutputTokens >= this.config.maxTokens) {
        onEvent({
          type: "status",
          text: TOKEN_BUDGET_STATUS_TEXT,
        });
        this.pushAudit({ kind: "status", text: `턴 종료(token-budget) — 제안 ${proposedByKey.size}건` });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "token-budget" };
      }
    }

    // 라운드 안전핀 도달(기본 200 — 정상 작업에선 도달하지 않음) — 현재까지의 changeset을 제시.
    onEvent({ type: "status", text: TOKEN_BUDGET_STATUS_TEXT });
    this.pushAudit({ kind: "status", text: `턴 종료(max-tool-calls) — 제안 ${proposedByKey.size}건` });
    return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "max-tool-calls" };
  }
}

interface EventTargetKey {
  readonly mapId: string;
  readonly eventId: string;
}

interface EventMoveTarget extends EventTargetKey {
  readonly x: number;
  readonly y: number;
}

function appendDiffWarning(result: ToolResult, warning: string): ToolResult {
  const diff = result.diff;
  if (!diff || diff.warnings.includes(warning)) return result;
  return { ...result, diff: { ...diff, warnings: [...diff.warnings, warning] } };
}

function buildSpecPlanLabel(spec: BuildSpec): string {
  const title = spec.title?.trim();
  if (title) return title;
  const assetLabels = spec.assets
    .slice(0, 3)
    .map((asset) => asset.id.trim() || asset.kind.trim())
    .filter((label) => label.length > 0);
  const suffix = spec.assets.length > assetLabels.length ? ` 외 ${spec.assets.length - assetLabels.length}개` : "";
  return assetLabels.length > 0 ? `${assetLabels.join(", ")}${suffix}` : spec.mapId;
}

function proposalKey(proposal: ProposedCall): string {
  return `${proposal.name}:${JSON.stringify(proposal.args)}`;
}

function moveEventTarget(proposal: ProposedCall): EventMoveTarget | null {
  if (proposal.name !== "move_event") return null;
  const mapId = stringValue(proposal.args.mapId);
  const eventId = stringValue(proposal.args.eventId);
  const x = numberValue(proposal.args.x);
  const y = numberValue(proposal.args.y);
  return mapId === null || eventId === null || x === null || y === null ? null : { mapId, eventId, x, y };
}

function eventBaseTarget(proposal: ProposedCall): EventTargetKey | null {
  if (proposal.name === "place_npc" || proposal.name === "place_battle_blocker") {
    const mapId = stringValue(proposal.args.mapId);
    const data = isRecord(proposal.result.data) ? proposal.result.data : null;
    const eventId = stringValue(data?.eventId) ?? stringValue(proposal.args.id);
    return mapId === null || eventId === null ? null : { mapId, eventId };
  }

  if (proposal.name === "upsert_event") {
    const mapId = stringValue(proposal.args.mapId);
    const event = isRecord(proposal.args.event) ? proposal.args.event : null;
    const eventId = stringValue(event?.id);
    return mapId === null || eventId === null ? null : { mapId, eventId };
  }

  if (proposal.name === "duplicate_event") {
    const mapId = stringValue(proposal.args.toMapId);
    const data = isRecord(proposal.result.data) ? proposal.result.data : null;
    const eventId = stringValue(data?.eventId) ?? stringValue(proposal.args.newId);
    return mapId === null || eventId === null ? null : { mapId, eventId };
  }

  return null;
}

function withMovedEventBaseProposal(base: ProposedCall, move: EventMoveTarget): ProposedCall {
  const args = structuredClone(base.args);

  if (base.name === "place_npc" || base.name === "place_battle_blocker" || base.name === "duplicate_event") {
    args.x = move.x;
    args.y = move.y;
  } else if (base.name === "upsert_event") {
    const event = isRecord(args.event) ? args.event : null;
    if (event !== null) args.event = { ...event, x: move.x, y: move.y };
  } else {
    return base;
  }

  return {
    ...base,
    args,
    summary: summaryWithFinalEventPosition(base.summary, move),
    result: { ...base.result, data: dataWithEventPosition(base.result.data, move) },
  };
}

function summaryWithFinalEventPosition(summary: string, move: EventMoveTarget): string {
  const coord = `(${move.x}, ${move.y})`;
  const replaced = summary.replace(/배치 \(-?\d+,\s*-?\d+\)/, `배치 ${coord}`);
  return replaced !== summary ? replaced : `${summary} — 최종 위치 ${coord}`;
}

function dataWithEventPosition(data: unknown, move: EventMoveTarget): unknown {
  return isRecord(data) ? { ...data, x: move.x, y: move.y } : data;
}

function eventTargetKey(target: EventTargetKey): string {
  return `${target.mapId}:${target.eventId}`;
}

function isSpecGatePass(result: ToolResult | SpecGatePass): result is SpecGatePass {
  return "warnings" in result;
}

function withSpecGateWarnings(result: ToolResult, warnings: readonly LintIssue[]): ToolResult {
  if (!result.ok || warnings.length === 0) return result;
  const warningMessages = warnings.map((warning) => warning.message);
  return {
    ...result,
    diff: result.diff
      ? { ...result.diff, warnings: [...result.diff.warnings, ...warningMessages] }
      : result.diff,
    issues: [...(result.issues ?? []), ...warnings],
  };
}

// usage가 없는 응답(일부 스트리밍)의 출력 토큰 추정 — 한국어 기준 보수적으로 3자당 1토큰.
function estimateOutputTokens(message: ChatMessage): number {
  const contentLength = message.content?.length ?? 0;
  const argsLength = (message.tool_calls ?? []).reduce((total, call) => total + call.function.arguments.length + call.function.name.length, 0);
  return Math.ceil((contentLength + argsLength) / 3);
}

// 모델에 되돌려줄 툴 결과(자가수정을 위해 issues를 포함).
function toolResultForModel(result: ToolResult): Record<string, unknown> {
  return {
    ok: result.ok,
    summary: result.summary,
    diff: result.diff,
    // issues가 있으면 원인을 읽고 인자를 고쳐 재시도하라는 신호.
    issues: result.issues?.map((issue) => ({ severity: issue.severity, code: issue.code, message: issue.message })),
    data: result.data,
  };
}

function parseToolCall(call: ToolCall): { name: string; args: Record<string, unknown> } {
  const name = call.function.name;
  let args: Record<string, unknown> = {};
  const raw = call.function.arguments?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") args = parsed as Record<string, unknown>;
    } catch {
      // 인자 JSON 파싱 실패 — 빈 인자로 두면 runTool이 검증 오류를 issues로 돌려줘 자가수정 유도.
    }
  }
  return { name, args };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
