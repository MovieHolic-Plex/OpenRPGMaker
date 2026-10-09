// editor/tools/webSearchTool.ts
// 조수의 웹 검색 툴. 레지스트리에 들어가지만 **프로젝트를 건드리지 않는다** — mode:"read".
//
// 왜 read 인가: 이 툴은 draft 를 읽지도 쓰지도 않는다. 실제 검색은 세션/Pi 런타임이 네트워크로
// 수행하고(`src/ai/webSearch/`), 여기 `run` 은 **네트워크 없는 환경(단위 테스트·헤드리스)에서의
// 핸드오프** 만 만든다 — `generate_image_asset` 이 쓰는 것과 같은 `status:"ui-required"` 규약이다.
// write 로 두면 승인·diff 회계·읽기선행 게이트가 "변경 없는 변경" 을 추적하게 된다.

import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

export const WEB_SEARCH_TOOL = "web_search";
export const WEB_SEARCH_TOOL_VERSION = 1;

const QUERY_MIN_LENGTH = 2;
const QUERY_MAX_LENGTH = 400;

export function prepareWebSearchRequest(args: Record<string, unknown>): { readonly query: string } {
  const raw = typeof args.query === "string" ? args.query.replace(/\s+/gu, " ").trim() : "";
  if (raw.length < QUERY_MIN_LENGTH) {
    throw new ToolError(`query 는 ${QUERY_MIN_LENGTH}자 이상이어야 합니다.`, { code: "invalid-args" });
  }
  if (raw.length > QUERY_MAX_LENGTH) {
    throw new ToolError(`query 는 ${QUERY_MAX_LENGTH}자 이하여야 합니다.`, { code: "invalid-args" });
  }
  return { query: raw };
}

const WEB_SEARCH_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: {
      type: "string",
      minLength: QUERY_MIN_LENGTH,
      maxLength: QUERY_MAX_LENGTH,
      description: "찾을 내용을 한 문장이나 검색어로. 예: \"PostgREST 최신 버전\", \"2024 인디 게임 픽셀 아트 팔레트 관행\"",
    },
  },
};

const webSearch: ToolDefinition = {
  name: WEB_SEARCH_TOOL,
  description:
    "인터넷을 검색해 최신 사실과 출처 URL을 가져온다. "
    + "학습 시점 이후의 정보(최신 버전·릴리스·요금·뉴스·현행 표준·실존 작품의 구체 사실)가 필요할 때 쓴다. "
    + "프로젝트 안의 사실(맵·이벤트·DB·위키)은 이 툴이 아니라 read_project_wiki·get_database_records 로 읽는다. "
    + "검색은 프로젝트를 바꾸지 않는다. 답을 사용자에게 전할 때는 근거 URL을 함께 밝힌다.",
  mode: "read",
  domains: ["core"],
  version: WEB_SEARCH_TOOL_VERSION,
  parameters: WEB_SEARCH_SCHEMA,
  run(_project, args): ToolExecResult {
    const request = prepareWebSearchRequest(args);
    return {
      summary: `웹 검색 요청을 준비했습니다: ${request.query}`,
      data: { status: "ui-required", ...request },
    };
  },
};

export const WEB_SEARCH_TOOLS: readonly ToolDefinition[] = [webSearch];
