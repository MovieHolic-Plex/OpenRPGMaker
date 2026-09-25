// editor/tools/types.ts
// Phase 1 Editor Command Layer의 공용 타입.
// 툴은 전부 순수 함수(브라우저 전역 접근 금지 — Node 헤드리스에서도 동일 동작)로 작성한다.

import type { LintIssue } from "@/project/lint/projectLint";
import type { ChangeSummary, Project } from "@/project/types";

// 최소 JSON Schema(OpenAI function calling 파라미터). 손으로 쓰되 object 타입을 강제한다.
export type JsonSchemaType = "object" | "array" | "string" | "number" | "integer" | "boolean";

export interface JsonSchema {
  readonly type?: JsonSchemaType | readonly JsonSchemaType[];
  readonly description?: string;
  readonly properties?: Record<string, JsonSchema>;
  readonly required?: readonly string[];
  readonly items?: JsonSchema;
  readonly enum?: readonly (string | number)[];
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  /** JSON Schema oneOf (툴 인자 유니온). type 없이 쓰일 수 있다. */
  readonly oneOf?: readonly JsonSchema[];
  // 깊은 구조(이벤트/커맨드 등)는 기존 shape 검증기에 위임하므로 스키마에선 자유 형태를 허용한다.
  readonly additionalProperties?: boolean;
}

export type { ChangeSummary } from "@/project/types";

// 툴 실행 결과 규약(handoff 그대로).
export interface ToolResult {
  ok: boolean;
  summary: string; // 사람/모델 공용 1-2문장
  diff?: ChangeSummary; // 쓰기 툴의 구조화된 diff
  issues?: LintIssue[]; // 게이트 실패 사유(모델 자가수정용)
  warnings?: string[]; // 읽기/쓰기 비차단 경고(영역 잘림 등)
  data?: unknown; // 읽기 툴 반환값
}

// 순수 실행 컨텍스트. 브라우저/스토어 접근 금지.
export interface ToolContext {
  project: Project;
  /**
   * 사용자가 지금 보고 있는 맵(2026-09-25). 실행기가 칩셋 계열 검사의 기준으로 쓰고, create_map 이 tilesetId 없이
   * 불리면 이 맵의 칩셋을 넣는다. 없으면 두 동작 모두 꺼진다(옛 호출자·헤드리스 스크립트 동작 그대로).
   */
  readonly currentMapId?: string;
  /** 사용자가 이 대화에서 승인한 목표 칩셋 계열(`tilesetFamily`). 이 계열로의 변경은 계열 검사가 통과시킨다. */
  readonly approvedTilesetFamilies?: readonly string[];
}

// 툴 내부 실행이 돌려주는 값. runner가 diff/lint/커밋을 처리한다.
export interface ToolExecResult {
  summary: string;
  warnings?: string[];
  issues?: LintIssue[];
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
  // 스키마 검증 실패 시 모델이 바로 재시도할 수 있도록 붙이는 최소 정답 예시.
  readonly invalidArgsExample?: Record<string, unknown>;
  // 스키마 검증 실패 시 예시와 별도로 붙이는 짧은 교정 힌트.
  readonly invalidArgsHint?: string;
  // Input-specific guidance only; the runner still rejects invalid arguments.
  readonly invalidArgsRepair?: (args: Readonly<Record<string, unknown>>) => {
    readonly path: string;
    readonly example: unknown;
  } | undefined;
  // 툴 버전(기본 1). 2026-07-07 타일 계열 v2 재구축부터 사용. 3 = 승인 보캐뷸러리 계열(v3).
  readonly version?: 1 | 2 | 3;
  // true면 LLM 노출(toOpenAiTools)에서 제외된다. getTool/실행 호환은 유지(구 세션·테스트).
  readonly deprecated?: boolean;
  // deprecated 툴을 대체하는 v2 툴 이름.
  readonly supersededBy?: string;
  // 이 툴이 노출되는 컨텍스트 모드(§2.2). 레지스트리가 패밀리 단위로 일괄 태깅한다.
  readonly domains?: readonly ToolDomain[];
  // run 앞에서 기다릴 지연 데이터(청크를 따로 받는 참고 자료 등). 비동기 실행 경로(prepareTool)만 부른다.
  readonly prepare?: (args: Record<string, unknown>) => Promise<void>;
  // true 면 실행기의 업로드 타일셋 바꿔치기 검사(toolRunner.rejectUploadedTilesetSwap)를 건너뛴다.
  // 프로젝트를 통째로 되돌리거나 갈아 끼우는 도구(revert_last_edit·reset_project)만 켠다 — 그 도구의 계약이
  // "이전/새 프로젝트 그대로"라 칩셋이 달라지는 것이 정상이고, tilesetId 인자를 받을 수도 없다.
  // 맵 하나를 시공하는 도구는 켜지 말고 인자에 새 tilesetId 를 명시하게 하라.
  readonly allowsTilesetChange?: boolean;
  // true 면 러너의 나무 짝 자동 수리를 건너뛴다 — 검토 끝난 원본 배열을 그대로 옮기는 툴(import_region_reference)용.
  readonly preservesAuthoredRaster?: boolean;
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
  /** 페이지 표시 이름. 생략 시 NPC 이름. */
  readonly name?: string;
  /**
   * 이 페이지의 캐릭터 그래픽. 생략 시 이벤트 공통 graphic.
   * 퀘스트 완료 후 외형 변경·합류 후 투명 등에 쓴다.
   */
  readonly graphic?: {
    readonly query?: string;
    readonly textureKey?: string;
    readonly characterIndex?: number;
    readonly transparent?: boolean;
  };
  /** 대화 페이스. 생략 시 place_npc graphic charset에서 자동 매핑. */
  readonly face?: {
    readonly resourceId?: string;
    readonly position?: "left" | "right";
    readonly flipHorizontally?: boolean;
    readonly textureKey?: string;
    readonly characterIndex?: number;
  };
  readonly choices?: readonly SimplePageChoice[];
  readonly commands?: readonly unknown[];
}
