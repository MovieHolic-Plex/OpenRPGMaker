import { activeTools } from "./toolRegistry";
import { genreLockHidesTool } from "@/project/genreLock";
import { monsterToolHiddenInRun } from "@/project/genreLockMonsterAssets";
import { TOOL_ALIASES, aliasTermHit } from "./toolAliases";
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
  const lowered = description.toLocaleLowerCase();
  const at = lowered.indexOf(normalized);
  if (at >= 0) {
    // 설명에 통째로 든 툴끼리는 「그 툴이 무엇인지」 말하는 첫 문장에 든 쪽, 더 앞에 든 쪽이 먼저다.
    // 예전엔 모두 60 동점이라 등록 순서로 6개에서 잘려 「엔딩」 검색에 define_ending 이 빠지고
    // 설명 끝에 엔딩을 언급한 컷신 도구들이 자리를 채웠다(2026-10-02).
    const firstSentenceEnd = lowered.search(/[.。]\s|\n/u);
    const inFirstSentence = firstSentenceEnd < 0 || at < firstSentenceEnd;
    return 60 + (inFirstSentence ? 15 : 0) + 4 * (1 - at / Math.max(1, lowered.length));
  }
  const queryWords = words(normalized);
  const haystackWords = words(`${name} ${description}`);
  return queryWords.reduce((score, word) => {
    if (haystackWords.includes(word)) return score + 10;
    if (haystackWords.some((candidate) => candidate.includes(word) || word.includes(candidate))) return score + 5;
    return score;
  }, 0);
}

/** 정확한 이름 검색에서 이름처럼 보이지만(밑줄 포함) 없는 것 — 모델이 지어낸 이름을 알린다. */
function unknownNames(exact: readonly ToolDefinition[], named: ReadonlySet<string>): string {
  if (exact.length === 0) return "";
  const found = new Set(exact.map((tool) => tool.name));
  const missing = [...named].filter((word) => word.includes("_") && !found.has(word));
  return missing.length > 0 ? `. 없는 툴 이름: ${missing.join(", ")}` : "";
}

// ── 순위 매기기(2026-10-15) ─────────────────────────────────────────────────────────────────────
// 예전 매처는 「질의 낱말이 설명 낱말에 부분 문자열로 들면 +5」 라서 map·battle·create 같은 흔한 낱말이 긴 설명
// (author_dungeon·import_region_reference)을 아무 질의에나 끌어올렸다. 감사 역할극 코퍼스 적중 48%.
// 지금은 (1) 낱말 희귀도(IDF) 가중 (2) 이름 조각 일치 우대 (3) 용어 별칭 사전 (4) 첫 문장 우대로 매긴다.

interface IndexedTool {
  readonly tool: ToolDefinition;
  readonly index: number;
  readonly nameParts: readonly string[];
  readonly firstSentence: ReadonlySet<string>;
  readonly body: ReadonlySet<string>;
  readonly length: number;
}

export interface ToolSearchHit {
  readonly tool: ToolDefinition;
  readonly score: number;
  readonly why: string;
}

const STOP_WORDS = new Set(["the", "a", "an", "of", "to", "and", "or", "for", "in", "on", "is", "it", "with", "한", "를", "을", "이", "가", "은", "는", "의", "에", "도"]);

function indexTools(pool: readonly ToolDefinition[]): IndexedTool[] {
  return pool.map((tool, index) => {
    const lowered = tool.description.toLocaleLowerCase();
    const end = lowered.search(/[.。]\s|\n/u);
    const firstText = end < 0 ? lowered : lowered.slice(0, end);
    return {
      tool, index,
      nameParts: tool.name.toLocaleLowerCase().split("_").filter(Boolean),
      firstSentence: new Set(words(firstText)),
      body: new Set(words(lowered)),
      length: lowered.length,
    };
  });
}

function queryTerms(query: string): string[] {
  const out = new Set<string>();
  for (const word of words(query)) {
    for (const part of word.split(/[_-]+/u)) {
      if (part.length >= 2 && !STOP_WORDS.has(part)) out.add(part);
    }
  }
  return [...out];
}

/** 설명 낱말 중 한국어 조사가 붙은 형태(「스킬을」)까지 같은 낱말로 본다. */
function wordsHit(set: ReadonlySet<string>, term: string): "exact" | "fuzzy" | undefined {
  if (set.has(term)) return "exact";
  if (term.length < 2) return undefined;
  for (const candidate of set) {
    if (candidate.length >= 2 && (candidate.includes(term) || (candidate.length >= 2 && term.includes(candidate) && /[\u3131-\uD79D]/u.test(candidate)))) return "fuzzy";
  }
  return undefined;
}

export function searchTools(pool: readonly ToolDefinition[], query: string): ToolSearchHit[] {
  const queryLower = query.trim().toLocaleLowerCase();
  if (!queryLower) return [];
  const indexed = indexTools(pool);
  const terms = queryTerms(queryLower);
  const df = new Map<string, number>();
  for (const entry of indexed) {
    for (const term of terms) {
      if (entry.body.has(term) || entry.nameParts.includes(term)) df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const idf = (term: string) => Math.log(1 + indexed.length / (1 + (df.get(term) ?? 0)));
  const byName = new Map(indexed.map((entry) => [entry.tool.name, entry]));
  const bonus = new Map<string, { score: number; labels: string[] }>();
  for (const alias of TOOL_ALIASES) {
    const hit = alias.terms.find((term) => aliasTermHit(queryLower, term));
    if (hit === undefined) continue;
    alias.tools.forEach((toolName, position) => {
      if (!byName.has(toolName)) return;
      const slot = bonus.get(toolName) ?? { score: 0, labels: [] };
      slot.score = Math.min(30, slot.score + Math.max(6, 16 - 3 * position));
      if (!slot.labels.includes(alias.label ?? hit)) slot.labels.push(alias.label ?? hit);
      bonus.set(toolName, slot);
    });
  }
  const hits: ToolSearchHit[] = [];
  for (const entry of indexed) {
    const name = entry.tool.name;
    let score = 0;
    const nameHits: string[] = [];
    const bodyHits: string[] = [];
    if (name.includes(queryLower) && queryLower.length >= 3) { score += 30; nameHits.push(queryLower); }
    for (const term of terms) {
      if (entry.nameParts.includes(term)) { score += 5 + idf(term); nameHits.push(term); continue; }
      if (term.length >= 3 && entry.nameParts.some((part) => part.startsWith(term) || (part.length >= 4 && term.startsWith(part)))) { score += 2.5; nameHits.push(term); }
      const first = wordsHit(entry.firstSentence, term);
      if (first) { score += idf(term) * (first === "exact" ? 2.4 : 1.4); bodyHits.push(term); continue; }
      const rest = wordsHit(entry.body, term);
      if (rest) { score += idf(term) * (rest === "exact" ? 1.0 : 0.5); bodyHits.push(term); }
    }
    if (queryLower.length >= 3 && entry.tool.description.toLocaleLowerCase().includes(queryLower)) score += 6;
    score /= 1 + 0.12 * Math.log(Math.max(40, entry.length) / 40);
    const alias = bonus.get(name);
    if (alias) score += alias.score;
    if (score <= 0) continue;
    const reasons: string[] = [];
    if (alias) reasons.push(`별칭 ${alias.labels.slice(0, 2).join("/")}`);
    if (nameHits.length > 0) reasons.push(`이름 ${[...new Set(nameHits)].slice(0, 2).join("·")}`);
    if (bodyHits.length > 0 && reasons.length < 2) reasons.push(`설명 ${[...new Set(bodyHits)].slice(0, 2).join("·")}`);
    hits.push({ tool: entry.tool, score, why: reasons.join(", ") });
  }
  return hits.sort((left, right) => right.score - left.score || byName.get(left.tool.name)!.index - byName.get(right.tool.name)!.index);
}

function bigrams(text: string): Set<string> {
  const compact = text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const out = new Set<string>();
  for (let i = 0; i + 1 < compact.length; i += 1) out.add(compact.slice(i, i + 2));
  return out;
}

/** 아무 낱말도 안 맞았을 때 — 글자 쌍(bigram) 겹침이 가장 큰 툴 3개와 그 이유. */
export function nearestTools(pool: readonly ToolDefinition[], query: string, count = 3): ToolSearchHit[] {
  const q = bigrams(query);
  if (q.size < 2) return [];
  return pool
    .map((tool) => {
      const target = bigrams(`${tool.name.replace(/_/g, " ")} ${tool.description.slice(0, 160)}`);
      let shared = 0;
      for (const gram of q) if (target.has(gram)) shared += 1;
      return { tool, score: shared / q.size, why: "가장 가까운 글자 일치" };
    })
    .filter((hit) => hit.score >= 0.34)
    .sort((left, right) => right.score - left.score)
    .slice(0, count);
}

export const FIND_TOOLS: ToolDefinition = {
  name: "find_tools",
  description: "현재 라운드에 노출되지 않은 전체 편집기 기능을 검색한다. 기능 키워드(한국어·영어 모두 가능)나 정확한 툴 이름을 보내면 다음 라운드에서 호출할 수 있는 툴 스키마를 찾는다. 결과마다 왜 골랐는지 이유가 붙는다. 검색 결과는 다음 라운드에 추가된다. 결과가 없으면 가장 가까운 3개를 돌려주니 이름을 보고 다시 검색한다. 이미 아는 툴 이름이면 이름만 보내라(그 툴 스키마 하나만 온다).",
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
  run(project, args): ToolExecResult {
    const query = args.query as string;
    const domain = parseDomain(args.domain);
    const limit = normalizedLimit(args.limit);
    // 장르 잠금 중에는 허용 계열 밖 칩셋 전용 파이프라인(버들항·jp_city·캠퍼스… 시공 도구)이 결과에 나오지 않는다 — 조수가 애초에 고르지 않게(project/genreLock.ts).
    const visible = (tool: { name: string }) => !genreLockHidesTool(project, tool.name) && !monsterToolHiddenInRun(project, tool.name);
    const lockedNames = [...new Set(words(query))].filter((name) => genreLockHidesTool(project, name));
    // 몬스터 수집 도구를 이름으로 찾는데 이 프로젝트가 몬스터 게임이 아니면 이유와 다음 행동을 알린다(결과에는 나오지 않는다).
    const monsterLockedNames = [...new Set(words(query))].filter((name) => monsterToolHiddenInRun(project, name));
    const pool = activeTools()
      .filter(visible)
      .filter((tool) => tool.name !== FIND_TOOLS.name)
      .filter((tool) => domain === undefined || tool.domains?.includes(domain));
    // 정확한 툴 이름을 보냈으면 그 툴만 돌려준다. 예전엔 설명에 그 이름이 나오는 툴 5개가 스키마째 딸려 와
    // 한 번에 약 45k자였고, 그 결과가 이후 모든 턴 입력에 되실렸다(2026-09-24 헤드리스 「등대지기의 겨울」:
    // find_tools 6회 중 4회가 정확한 이름 검색).
    // 정확한 이름은 domain 필터보다 우선한다 — 모델은 domain 을 자주 틀리게 짚는다(evaluate_village_look 을 map 으로).
    const named = new Set(words(query));
    const exact = activeTools().filter((tool) => visible(tool) && tool.name !== FIND_TOOLS.name && named.has(tool.name));
    let hits: ToolSearchHit[];
    let nearest = false;
    if (exact.length > 0) {
      hits = exact.map((tool) => ({ tool, score: 100, why: "이름 일치" })).slice(0, limit);
    } else {
      hits = searchTools(pool, query).slice(0, limit);
      if (hits.length === 0) { hits = nearestTools(pool, query); nearest = hits.length > 0; }
    }
    const candidates = hits.map(({ tool, why }) => ({ name: tool.name, mode: tool.mode, domains: tool.domains ?? [], why, description: tool.description, parameters: tool.parameters }));
    const label = (hit: ToolSearchHit) => (hit.why && exact.length === 0 ? `${hit.tool.name} [${hit.why}]` : hit.tool.name);
    const lockNote = lockedNames.length ? ` 단 ${lockedNames.join(", ")} 는 장르 잠금 중이라 쓸 수 없다(허용 계열 칩셋 도구만 보인다).` : "";
    const monsterNote = monsterLockedNames.length ? ` 단 ${monsterLockedNames.join(", ")} 는 몬스터 수집(포켓몬식) 전용이라 이 프로젝트에서는 쓸 수 없다 — 일반 RPG 의 적·사냥터는 upsert_enemy·upsert_troop·place_field_enemy 로 만든다. 사용자가 몬스터 수집 게임을 원하는지 한 문장으로 되묻고 턴을 끝내라.` : "";
    return {
      summary: (candidates.length > 0
        ? nearest
          ? `"${query}"에 정확히 맞는 툴은 없어 가장 가까운 ${candidates.length}개를 돌려줍니다: ${hits.map(label).join(", ")}. 맞지 않으면 기능어를 바꾸거나 영문 툴 이름으로 다시 검색하세요.`
          : `편집기 툴 ${candidates.length}개 발견: ${hits.map(label).join(", ")}${unknownNames(exact, named)}`
        : `"${query}"에 맞는 활성 편집기 툴이 없습니다. 다른 기능어 또는 영문 툴 이름으로 다시 검색하세요.`) + lockNote + monsterNote,
      data: { matches: candidates, ...(nearest ? { nearest: true } : {}) },
    };
  },
};
