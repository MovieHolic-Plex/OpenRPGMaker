// ai/session/sessionTools.ts
// 세션이 직접 처리하는 툴(레지스트리 밖) 스키마와 쓰기 툴 판정.
// 이 툴들은 프로젝트를 바꾸지 않거나 세션 상태만 바꾸므로 레지스트리에 없다 —
// tools 배열에 스키마만 덧붙여 모델에 노출한다.

import { getTool } from "@/editor/tools";
import type { ToolResult } from "@/editor/tools";
import type { OpenAiToolSchema } from "../llmClient";
import { ACCEPTANCE_SCHEMA } from "../assistantAcceptanceTools";
import { APPEARANCE_GENERATION_TOOL } from "@/editor/tools/characterAppearanceTools";
import { OPENING_IMAGE_TOOL } from "@/editor/tools/cinematicTools";

// 이미지를 주입할 툴(명시적 '보여줘' 계열 + 미리보기). get_map_region 등 빈번 조회는 텍스트로 두어 토큰을 아낀다.
export const VISION_TOOLS = new Set(["show_tiles", "show_tile_grid", "show_map_region", "preview_house", "look_at_houses", "render_group_sample"]);

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
// 감사(test/toolSchemaProviderCompat.test.ts)가 레지스트리 툴과 함께 검사해야 하므로 export 한다.
export const SET_BUILD_SPEC_TOOL: OpenAiToolSchema = {
  type: "function",
  function: {
    name: "set_build_spec",
    description:
      "공간 빌드(집/마을/길/청소/NPC 배치/지형 채우기) 전 밑그림(명세)을 제출한다. 검증(경계/겹침) 통과 후 공간 빌드 툴을 실행한다. 명세 밖 빈 영역은 자동 확장 warning으로 통과하지만 기존 구조물 파괴 위험은 차단된다. 같은 층 영역(x,y,w,h)은 원칙적으로 겹치지 않게 배정하되 road-road 교차와 명시적 terrain-before-road 순서의 도로 덧칠은 허용한다(assets/buildOrder 참조).",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string" },
        title: { type: "string", description: "밑그림 이름(예: 잿불 마을 확장)" },
        assets: {
          type: "array",
          description:
            "에셋 목록. kind: house|road|npc|prop|clear|terrain 등, layer: lower(기본)|upper(장식). 길은 kind:\"road\"로 명시한다; id·style·재료 라벨로 kind를 추론하지 않는다. " +
            "같은 층 road-road는 교차 가능, terrain-road는 buildOrder에 terrain과 road를 모두 넣고 terrain을 먼저 둘 때만 겹칠 수 있다. terrain-terrain은 순서나 overExisting과 무관하게 겹침·중복 불가: 영역을 비겹침으로 분할하라. 다른 층이나 타일을 쓰지 않는 npc/event/transfer는 겹칠 수 있다. " +
            "clear 에셋이 기존 구조물(집 등)을 덮으면 confirmDestroy:true가 있어야 통과합니다 — '주변 청소'는 구조물을 피해 영역을 좁히세요. " +
            "배치 에셋 자리·주변에 기존 타일이 있으면 overExisting:\"clear\"|\"keep\"이 있어야 통과합니다.",
          // properties 를 선언하지 않으면(items:{type:"object"}) strict function-calling 경로에서
          // 모델이 필드를 표현할 방법이 없어 `assets:[{}]` 만 보낸다 — 2026-08-23 실측: 밑그림 검증 10회 연속 실패.
          //
          // 같은 벽을 필드 단위로 또 밟았다(2026-08-29 실측): 검증기가 overExisting 을 요구하는데
          // 여기 선언이 없어 모델이 9회 연속 재제출에서 단 한 번도 그 필드를 낼 수 없었다. 같은 턴에서
          // 선언돼 있던 confirmDestroy 는 정상적으로 나왔다 — 차이는 오직 이 목록에 있느냐였다.
          // 결과: 영역 턴이 24콜 예산을 태우고 max-tool-calls 로 잘렸다(313칸이 미적용으로 폐기).
          // 검증기가 요구하는 필드는 반드시 여기 선언한다 — properties 는 계약이고 description 은 주석이다.
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "에셋 식별자(예: house_1)" },
              kind: { type: "string", description: "house|road|npc|prop|clear|terrain 등. 도로는 road로 명시; id·style·재료 라벨은 kind를 바꾸지 않는다" },
              x: { type: "integer", description: "영역 좌상단 타일 x(칸 좌표)" },
              y: { type: "integer", description: "영역 좌상단 타일 y(칸 좌표)" },
              w: { type: "integer", description: "가로 칸 수 — 차지하는 마지막 칸은 x+w-1" },
              h: { type: "integer", description: "세로 칸 수 — 차지하는 마지막 칸은 y+h-1" },
              layer: { type: "string", enum: ["lower", "upper"], description: "기본 lower" },
              style: { type: "string", description: "종류별 스타일 힌트(선택)" },
              shape: {
                type: "string",
                enum: ["rect", "ellipse", "circle"],
                description: "면 채우기 형태 힌트(기본 rect). 원형 수역은 circle — fill_region.shape 와 맞춘다",
              },
              confirmDestroy: { type: "boolean", description: "clear가 기존 구조물을 덮을 때만 true" },
              overExisting: {
                type: "string",
                enum: ["clear", "keep"],
                description:
                  "배치(비-clear) 에셋 자리·주변에 기본 타일이 아닌 것이 있을 때의 정리 방침. " +
                  "clear=정리하고 배치, keep=그대로 위에 배치. 기존 내용 충돌 때만 요구되며 새 에셋끼리의 교차를 허용하지 않는다",
              },
            },
            required: ["id", "kind", "x", "y", "w", "h"],
          },
        },
        buildOrder: {
          type: "array",
          items: { type: "string" },
          description: "건설 순서(kind 목록, 예: [\"clear\",\"terrain\",\"road\",\"prop\"]). clear와 후속 kind를 모두 넣고 clear를 먼저 두면 후속 배치가 clear 영역을 덮을 수 있다. 같은 층 terrain-road 겹침도 두 kind를 모두 넣고 terrain을 먼저 둘 때만 허용한다. road-road 교차에는 순서가 필요 없다. 어떤 순서도 terrain-terrain 겹침·중복을 허용하지 않는다. 선언한 순서대로 시공하라.",
        },
        pathWidth: { type: "integer", description: "통로 너비(칸)" },
        density: { type: "string", enum: ["spacious", "normal", "dense"], description: "에셋 분배(넓찍/보통/다닥)" },
        layoutStyle: { type: "string", enum: ["straight", "curved", "random"], description: "배치 스타일" },
      },
      required: ["mapId", "assets"],
    },
  },
};

export const CORRECT_VERIFICATION_TOOL: OpenAiToolSchema = {
  type: "function", function: {
    name: "correct_verification",
    description: "Rerun an adopted requirement or unresolved finding by its session checkId with compatible original-tool args. No verdict, deletion, baseline or weakened assertions. Only facing repairs preserve scene scripts; map-qualified host receipts must match. Read check IDs from get_work_plan or verification results.",
    parameters: { type: "object", properties: {
      checkId: { type: "string" }, args: { type: "object", additionalProperties: true },
    }, required: ["checkId", "args"], additionalProperties: false },
  },
};

/**
 * Session-only WorkPlan tools (Claude TodoWrite / Anthropic task-list style).
 * Always available so the main model can plan/replan inside the ReAct loop;
 * the pre-turn planner also authors the first plan without tools.
 */
export const WORK_PLAN_TOOLS: readonly OpenAiToolSchema[] = [
  {
    type: "function",
    function: {
      name: "get_work_plan",
      description: "현재 다층 WorkPlan 진행 상태를 조회한다. 미완료 항목이 있으면 반드시 현재 항목만 실행한다.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "set_work_plan",
      description:
        "다층 작업 계획을 세우거나 기존 항목의 지시/성공 도구를 교정한다. " +
        "수정 시 get_work_plan으로 실제 ID를 확인하고 완료/건너뜀을 포함한 모든 기존 항목 ID를 유지한다. " +
        "항목 추가·재배치·레이어 재구성은 허용하지만 항목 삭제·통합·재시작은 불가. 새 사용자 목표 채택은 main 플래너가 담당한다. " +
        "한 항목 완료에는 complete_work_item을 쓴다.",
      parameters: {
        type: "object",
        properties: {
          goal: { type: "string", description: "전체 목표" },
          acceptance: ACCEPTANCE_SCHEMA,
          requirements: ACCEPTANCE_SCHEMA,
          plannerNote: { type: "string", description: "전략 메모(선택)" },
          layers: {
            type: "array",
            description: "2~6 레이어. 각 레이어는 title 과 items 를 가지며, 항목마다 구체적인 instruction 이 필요하다.",
            // items:{type:"object"} 로 두면 모델이 `layers:[{}]` 밖에 못 보낸다(2026-08-23 실측: 8회 연속 인자 오류).
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "생략 시 L1, L2 … 자동" },
                title: { type: "string", description: "레이어 제목" },
                items: {
                  type: "array",
                  description: "이 레이어의 작업 항목",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "최초 생성 시 생략하면 L1-1 … 자동. 수정 시 get_work_plan의 기존 항목 ID를 유지" },
                      title: { type: "string", description: "항목 제목" },
                      instruction: { type: "string", description: "실행 모델이 그대로 수행할 구체 지시" },
                      doneWhen: { type: "string", description: "완료 판정 기준(선택)" },
                      mapTargets: {
                        type: "array", items: { type: "string" },
                        description: "Required for spatial work: one exact map ID per authoring item. Linking declares exactly both endpoint IDs in its separate item.",
                      },
                      verificationChecks: {
                        type: "array", description: "Only for verification successTools lacking a resolved accepted criterion. Immutable validated specifications; missing scope stays pending.",
                        items: { type: "object", properties: {
                          tool: { type: "string" },
                          checkId: { type: "string", description: "Optional existing pending check ID to specify without changing its owner; valid scopes remain immutable." },
                          criterion: { type: "object", properties: { promiseId: { type: "string" }, criterionIndex: { type: "integer", minimum: 0 } }, required: ["promiseId", "criterionIndex"] },
                          args: { type: "object", additionalProperties: true },
                          interactionTargets: { type: "array", description: "Every scene interact step's frozen map/event ownership.", items: { type: "object", properties: {
                            stepIndex: { type: "integer", minimum: 0 }, mapId: { type: "string" }, eventId: { type: "string" },
                          }, required: ["stepIndex", "mapId", "eventId"] } },
                        }, required: ["tool"], additionalProperties: false },
                      },
                      requirementIds: { type: "array", items: { type: "string" } },
                      successTools: {
                        type: "array",
                        description: "이 항목의 성공을 증명하는 툴 이름(선택)",
                        items: { type: "string" },
                      },
                    },
                    required: ["title", "instruction"],
                  },
                },
              },
              required: ["title", "items"],
            },
          },
        },
        required: ["goal", "layers"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_work_item",
      description:
        "현재 또는 지정 항목을 완료하고 다음 항목으로 넘긴다. doneWhen 충족 또는 해당 단계 쓰기 툴 성공 후 호출.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "생략 시 현재 in_progress 항목" },
          note: { type: "string", description: "완료 메모" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "skip_work_item",
      description: "현재 또는 지정 항목을 건너뛰고 다음으로 간다(막혔을 때만). run_lint 등 필수 검증이 있는 항목은 건너뛸 수 없다. 오류를 수정하고 검증하거나 막힌 이유를 보고한다.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          note: { type: "string" },
        },
      },
    },
  },
];

/** 세션 전용 쓰기 툴(레지스트리 밖) — 질문 모드에서 함께 뺀다. */
const SESSION_WRITE_TOOL_NAMES: ReadonlySet<string> = new Set(["set_build_spec", "set_work_plan", "complete_work_item", "skip_work_item", "repair_acceptance", "review_acceptance", APPEARANCE_GENERATION_TOOL, OPENING_IMAGE_TOOL]);

/** 프로젝트를 바꾸는 툴인가 — 레지스트리 mode:"write" 또는 세션 전용 쓰기 툴. */
export function isWriteToolName(name: string): boolean {
  return getTool(name)?.mode === "write" || SESSION_WRITE_TOOL_NAMES.has(name);
}

export function composerAskRefusal(name: string): ToolResult {
  return {
    ok: false,
    summary: `질문 모드에서는 변경 도구(${name})를 실행하지 않습니다. 조회 도구로만 답하세요 — 변경이 필요하면 사용자가 지시 모드로 바꿔야 합니다.`,
    issues: [{ severity: "error", code: "composer-mode-ask", message: `${name} 은(는) 프로젝트를 바꾸는 도구라 질문 모드에서 거부됐습니다.` }],
  };
}
