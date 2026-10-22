// 맵 배경(파노라마) 그림 «새로 만들기» 도구 — 견본(set_map_properties background.preset)에 없는 하늘·지평선을 이미지 모델로 만든다.
//
// 실행은 Pi 실행기(scripts/lib/piAgentRuntime.ts)가 맡는다: 브라우저의 이미지 계정으로 먼 층(+가까운 실루엣 층)을 만들고
// (src/editor/mapPanoramaGeneration.ts 가 도트화·가로 이음매·마젠타 분리), upsert_resource 로 등록한 뒤 set_map_properties 로 연결한다.
// 생성 경로가 없는 곳(헤드리스·옛 세션)에서는 run 이 실패한다 — 그림 없이 성공으로 보고하지 못하게.
// 배경 그림은 타일·기물이 아니라서 3/4 관문(object-gate) 대상이 아니다.

import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";
import { MAP_BACKGROUND_MOTIONS, type MapBackgroundMotion } from "@/project/mapBackground";
import type { Project } from "@/project/types";

export const MAP_BACKGROUND_GENERATION_TOOL = "generate_map_background";
const PROMPT_MIN_LENGTH = 6;

export type MapBackgroundGenerationArgs = {
  readonly mapId: string;
  readonly prompt: string;
  readonly name: string;
  readonly view: "horizon" | "surface";
  readonly layers: readonly ("far" | "near")[];
  readonly motion?: MapBackgroundMotion;
  readonly speed?: number;
  readonly clearForBackground?: Record<string, unknown>;
};

/** 인자 검사·기본값. 실행기와 도구 run 이 같은 검사를 쓴다. */
export function prepareMapBackgroundGeneration(project: Project, args: Record<string, unknown>): MapBackgroundGenerationArgs {
  const mapId = typeof args.mapId === "string" ? args.mapId : "";
  if (!project.maps[mapId]) throw new ToolError(`없는 맵 id: ${mapId || "(없음)"}`, { code: "map-not-found" });
  const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
  if (prompt.length < PROMPT_MIN_LENGTH) throw new ToolError(`prompt 는 ${PROMPT_MIN_LENGTH}자 이상의 배경 설명이어야 합니다(예: "붉은 보름달이 뜬 성 위의 밤하늘").`, { code: "invalid-args" });
  if (prompt.length > 1200) throw new ToolError("prompt 는 1200자 이하여야 합니다.", { code: "invalid-args" });
  const view = args.view === "surface" ? "surface" : "horizon";
  const near = args.nearLayer === undefined ? view === "horizon" : args.nearLayer === true;
  if (near && view === "surface") throw new ToolError("nearLayer 는 view:horizon(옆에서 본 지평선)에서만 쓸 수 있습니다.", { code: "invalid-args" });
  const motion = typeof args.motion === "string" && (MAP_BACKGROUND_MOTIONS as readonly string[]).includes(args.motion) ? args.motion as MapBackgroundMotion : undefined;
  const speed = typeof args.speed === "number" && Number.isFinite(args.speed) ? Math.max(0.1, Math.min(4, args.speed)) : undefined;
  const clear = args.clearForBackground && typeof args.clearForBackground === "object" && !Array.isArray(args.clearForBackground)
    ? args.clearForBackground as Record<string, unknown> : undefined;
  const name = (typeof args.name === "string" && args.name.trim() ? args.name.trim() : `맵 배경: ${prompt.slice(0, 24)}`).slice(0, 120);
  return { mapId, prompt, name, view, layers: near ? ["far", "near"] : ["far"], ...(motion ? { motion } : {}), ...(speed !== undefined ? { speed } : {}), ...(clear ? { clearForBackground: clear } : {}) };
}

const SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["mapId", "prompt"],
  properties: {
    mapId: { type: "string" },
    prompt: { type: "string", minLength: PROMPT_MIN_LENGTH, maxLength: 1200, description: "보일 먼 풍경 설명(무엇이·어디에·어떤 빛). 예: \"붉은 보름달이 뜬 밤하늘과 먼 성벽 실루엣\". 글자·인물 금지." },
    name: { type: "string", maxLength: 120, description: "리소스 표시 이름(생략하면 자동)." },
    view: { type: "string", enum: ["horizon", "surface"], description: "horizon=옆에서 본 하늘·지평선(절벽·지붕·성 뒤, 기본) / surface=위에서 본 면(섬 둘레 바다·우주·구름 바다, 사방 반복)." },
    nearLayer: { type: "boolean", description: "horizon 만: 가까운 실루엣 층(언덕·사구·탑 줄)을 한 장 더 만들어 시차를 준다. 기본 true(그림 2장)." },
    motion: { type: "string", enum: [...MAP_BACKGROUND_MOTIONS], description: "움직임 프리셋(생략하면 먼 층 천천히 흐름 + 가까운 층 깊이 0.2)." },
    speed: { type: "number", minimum: 0.1, maximum: 4, description: "흐름 속도 배율(1=기본, 느리게 0.5)." },
    clearForBackground: {
      type: "object",
      description: "배경이 비칠 자리를 함께 비운다 — set_map_properties 의 clearForBackground 와 같다. 사각형 {x,y,width,height} 또는 {water:true}. 해·달·실루엣은 화면 위 약 7줄(16px 칸) 안에 오니 하늘은 7줄쯤 비운다.",
      properties: {
        x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 },
        width: { type: "integer", minimum: 1 }, height: { type: "integer", minimum: 1 },
        water: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
};

const generateMapBackground: ToolDefinition = {
  name: MAP_BACKGROUND_GENERATION_TOOL,
  description:
    "견본(set_map_properties background.preset: 맑은 하늘·노을·밤하늘·바다·구름 바다)에 없는 맵 배경(파노라마)을 이미지 모델로 «새로» 만들어 바로 그 맵 배경에 연결한다 — "
    + "예: 붉은 달이 뜬 밤하늘, 모래폭풍 지평선, 오로라. 먼 층 1장(+horizon 은 가까운 실루엣 층 1장)을 만들고, 게임 도트(640×240·제한 팔레트)로 내리고, 좌우가 이어지게(가로 반복) 다듬어 등록한다. "
    + "그림 한 장에 수십 초가 걸리고 사용자의 이미지 계정 한도를 쓴다 — 견본으로 충분하면 견본을 쓴다. 먼 층이 실패하면 아무것도 연결하지 않는다(견본으로 몰래 대신하지 말고 사용자에게 알린다). 가까운 층만 쓸 수 없으면 먼 층만 연결하고 결과에 그렇게 적힌다. "
    + "가까운 층 띠는 비운 하늘의 바닥선(맵 바닥)에 세워진다. 결과에는 플레이어 첫 화면에 실제로 비치는 부분만 첨부되니 보고는 그 그림에 보이는 것만 적는다.",
  mode: "write",
  parameters: SCHEMA,
  run(project, args): ToolExecResult {
    prepareMapBackgroundGeneration(project, args);
    throw new ToolError("이 실행에는 그림 생성 경로가 연결되어 있지 않습니다(편집기 조수 실행에서만 가능). 새 배경 그림을 만들지 못했습니다 — 생성 성공으로 보고하지 마세요.", { code: "image-generation-unavailable" });
  },
};

export const MAP_BACKGROUND_GENERATION_TOOLS: readonly ToolDefinition[] = [generateMapBackground];
