import { activeTools } from "./toolRegistry";
import { ToolError, type ToolDefinition, type ToolDomain, type ToolExecResult } from "./types";

const TOOL_DOMAINS = ["core", "tile", "map", "event", "database", "world", "quest", "battle", "system"] as const;
const MAX_DISCOVERY_RESULTS = 6;

function parseDomain(value: unknown): ToolDomain | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string" && TOOL_DOMAINS.includes(value as ToolDomain)) return value as ToolDomain;
  throw new ToolError(`지원하지 않는 tool domain입니다: ${String(value)}`, { code: "invalid-args" });
}

function normalizedLimit(value: unknown): number {
  if (value === undefined) return MAX_DISCOVERY_RESULTS;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ToolError("limit은 1 이상의 정수여야 합니다.", { code: "invalid-args" });
  }
  return Math.min(MAX_DISCOVERY_RESULTS, value);
}

function words(value: string): readonly string[] {
  return value.toLocaleLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter(Boolean);
}

// 매처는 하나다 — find_tools 와 자연어 능력 승격(ai/capabilityEscalation.ts)이 같은 점수를 쓴다.
export function matchScore(name: string, description: string, query: string): number {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return 0;
  if (name === normalized) return 100;
  if (name.includes(normalized)) return 80;
  if (description.toLocaleLowerCase().includes(normalized)) return 60;
  const queryWords = words(normalized);
  const haystackWords = words(`${name} ${description}`);
  return queryWords.reduce((score, word) => {
    if (haystackWords.includes(word)) return score + 10;
    if (haystackWords.some((candidate) => candidate.includes(word) || word.includes(candidate))) return score + 5;
    return score;
  }, 0);
}

export const FIND_TOOLS: ToolDefinition = {
  name: "find_tools",
  description: "현재 라운드에 노출되지 않은 전체 편집기 기능을 검색한다. 기능 키워드나 정확한 툴 이름을 보내면 다음 라운드에서 호출할 수 있는 툴 스키마를 찾는다. 검색 결과는 다음 라운드에 추가된다. 결과가 없으면 다른 기능어나 영문 툴 이름으로 다시 검색한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1 },
      domain: { type: "string", enum: TOOL_DOMAINS },
      limit: { type: "integer", minimum: 1, maximum: MAX_DISCOVERY_RESULTS },
    },
    required: ["query"],
    additionalProperties: false,
  },
  run(_project, args): ToolExecResult {
    const query = args.query as string;
    const domain = parseDomain(args.domain);
    const limit = normalizedLimit(args.limit);
    const candidates = activeTools()
      .filter((tool) => tool.name !== FIND_TOOLS.name)
      .filter((tool) => domain === undefined || tool.domains?.includes(domain))
      .map((tool, index) => ({ tool, index, score: matchScore(tool.name, tool.description, query) }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, limit)
      .map(({ tool }) => ({ name: tool.name, mode: tool.mode, domains: tool.domains ?? [], description: tool.description, parameters: tool.parameters }));
    return {
      summary: candidates.length > 0 ? `편집기 툴 ${candidates.length}개 발견: ${candidates.map((candidate) => candidate.name).join(", ")}` : `"${query}"에 맞는 활성 편집기 툴이 없습니다. 다른 기능어 또는 영문 툴 이름으로 다시 검색하세요.`,
      data: { matches: candidates },
    };
  },
};
