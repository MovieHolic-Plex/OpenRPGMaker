// editor/tools/types.ts
// Phase 1 Editor Command Layer의 공용 타입.
// 툴은 전부 순수 함수(브라우저 전역 접근 금지 — Node 헤드리스에서도 동일 동작)로 작성한다.

import type { LintIssue } from "@/project/lint/projectLint";
import type { Project } from "@/project/types";

// 최소 JSON Schema(OpenAI function calling 파라미터). 손으로 쓰되 object 타입을 강제한다.
export type JsonSchemaType = "object" | "array" | "string" | "number" | "integer" | "boolean";

export interface JsonSchema {
  readonly type: JsonSchemaType;
  readonly description?: string;
  readonly properties?: Record<string, JsonSchema>;
  readonly required?: readonly string[];
  readonly items?: JsonSchema;
  readonly enum?: readonly (string | number)[];
  // 깊은 구조(이벤트/커맨드 등)는 기존 shape 검증기에 위임하므로 스키마에선 자유 형태를 허용한다.
  readonly additionalProperties?: boolean;
}

// 변경 요약(모델이 다음 턴에 결과를 읽는다).
export interface ChangeSummary {
  tilesChanged: number;
  eventsAdded: number;
  eventsModified: number;
  eventsRemoved: number;
  mapsAdded: number;
  mapsRemoved: number;
  dbRecordsChanged: number;
  // 타일셋 정의 변경(메타데이터/그룹/통행성 등) 개수.
  tilesetsChanged: number;
  switchesAdded: number;
  variablesAdded: number;
  worldEntitiesAdded: number;
  worldEntitiesModified: number;
  palettePresetsAdded: number;
  palettePresetsModified: number;
  sessionChanged: boolean;
  systemChanged: boolean;
  warnings: string[];
}

// 툴 실행 결과 규약(handoff 그대로).
export interface ToolResult {
  ok: boolean;
  summary: string; // 사람/모델 공용 1-2문장
  diff?: ChangeSummary; // 쓰기 툴의 구조화된 diff
  issues?: LintIssue[]; // 게이트 실패 사유(모델 자가수정용)
  data?: unknown; // 읽기 툴 반환값
}

// 순수 실행 컨텍스트. 브라우저/스토어 접근 금지.
export interface ToolContext {
  project: Project;
}

// 툴 내부 실행이 돌려주는 값. runner가 diff/lint/커밋을 처리한다.
export interface ToolExecResult {
  summary: string;
  warnings?: string[];
  data?: unknown;
}

export type ToolMode = "read" | "write";

// 컨텍스트 모드 툴 스코핑(2026-07-07 타일 시공 흐름 재설계 §2.2) — 툴이 속한 도메인.
// "core"는 모든 모드에서 상시 노출. 도메인 없는 툴은 범용(모든 모드 노출)으로 취급한다.
export type ToolDomain = "core" | "tile" | "map" | "event" | "database" | "world" | "quest" | "battle" | "system";

// 툴 정의: 이름/설명(한국어)/파라미터 JSON Schema/실행 함수의 단일 형태.
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly mode: ToolMode;
  readonly parameters: JsonSchema;
  // 툴 버전(기본 1). 2026-07-07 타일 계열 v2 재구축부터 사용. 3 = 승인 보캐뷸러리 계열(v3).
  readonly version?: 1 | 2 | 3;
  // true면 LLM 노출(toOpenAiTools)에서 제외된다. getTool/실행 호환은 유지(구 세션·테스트).
  readonly deprecated?: boolean;
  // deprecated 툴을 대체하는 v2 툴 이름.
  readonly supersededBy?: string;
  // 이 툴이 노출되는 컨텍스트 모드(§2.2). 레지스트리가 패밀리 단위로 일괄 태깅한다.
  readonly domains?: readonly ToolDomain[];
  // write 툴은 draft(구조적 복제본)를 직접 변형한다. read 툴은 project를 읽기만 한다.
  run(draft: Project, args: Record<string, unknown>): ToolExecResult;
}

// 툴이 인자 검증/사전조건 위반 시 던지는 오류. runner가 issues로 변환한다.
export class ToolError extends Error {
  readonly code: string;
  readonly mapId?: string;
  readonly x?: number;
  readonly y?: number;

  constructor(message: string, opts: { code?: string; mapId?: string; x?: number; y?: number } = {}) {
    super(message);
    this.name = "ToolError";
    this.code = opts.code ?? "tool-error";
    this.mapId = opts.mapId;
    this.x = opts.x;
    this.y = opts.y;
  }
}

// place_npc 등이 받는 고수준 페이지 정의. EventPage로 컴파일된다.
// 컴파일러는 에이전트 출력의 흔한 변형을 warning과 함께 정규화한다:
// conditions 단수 객체/null, commands 단수 객체, command 또는 kind.command 문자열 alias.
export interface SimplePageChoice {
  readonly text: string;
  readonly commands?: readonly unknown[];
}

export interface SimplePage {
  readonly conditions?: readonly unknown[];
  readonly lines?: readonly string[];
  // LLM이 자주 쓰는 별칭 — lines와 동일하게 대사로 컴파일된다.
  // (감사 로그에서 showText/text로 보낸 대사가 조용히 유실되던 문제의 방지책.)
  readonly showText?: readonly string[];
  readonly messages?: readonly string[];
  readonly text?: string;
  readonly choices?: readonly SimplePageChoice[];
  readonly commands?: readonly unknown[];
}
