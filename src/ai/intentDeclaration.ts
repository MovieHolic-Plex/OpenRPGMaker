// ai/intentDeclaration.ts
// 한 턴의 사용자 요청을 **모델이 한 번 읽어** 구조화된 의도로 선언한다. 코드는 그 선언만 소비한다.
//
// 2026-09-03 실측 감사(메모리 「의도 라우터 실측 감사」)로 키워드 substring 분류기 7개를 걷어냈다.
// 어휘 441개·정규화 4종이 같은 문장을 따로 읽었고, 패널이 붙인 「도구 규칙」 가이드(기계 텍스트)를
// 사용자 발화로 읽어 chat 모드 52문장 중 22개에 「집/건물을 어떻게 만들까요?」를 되물었으며, 「이 마을에
// 상인 하나 추가해줘」에서 플래너(LLM)가 direct 로 맞게 판정한 것을 정규식이 거부해 마을 통째를 지었다.
//
// 경계: 「무엇을 원하나」(수정/생성, 실내/야외, 시설, 되묻기, 계획 필요, 쓸 툴)는 이 선언이 정한다.
// 「무엇이 사실인가」(열린 모달, 선택 사각형, 현재 맵, 타일셋 라벨)와 「지켜졌나」(승인·클립·스펙·검증)는
// 코드가 그대로 맡는다. 이 모듈은 순수 함수만 둔다 — 네트워크는 intentDeclarationClient 가 안다.
import type { ToolDomain } from "@/editor/tools/types";
import { QUICK_REPLY_MARKER } from "./interviewPrompt";

export type IntentMode = "create" | "modify" | "question" | "other";
export type IntentSpace = "interior" | "outdoor" | "both" | "none" | "unclear";
export type IntentSource = "llm" | "fallback" | "continuation" | "empty";

export interface IntentDeclaration {
  /** 새로 만든다 / 있는 것을 고친다·지운다·옮긴다 / 질문·조회 / 그 외(인사·진행 지시·판단 불가). */
  readonly mode: IntentMode;
  /** 시설·집·방을 만들 때 어디에 — 들어가서 걷는 실내 맵인지, 맵 위 외장인지. 공간 시공이 아니면 none. */
  readonly space: IntentSpace;
  /** 프로젝트의 개념 꾸러미 시설 라벨 중 하나에 해당하면 그 라벨. */
  readonly facility: string | null;
  /** mode=modify 이고 대상 맵을 알 수 있으면 그 id. */
  readonly targetMapId: string | null;
  /** 선택 영역이 있고 그 안에서 작업해야 하면 true. 새 맵 시공이면 false. */
  readonly useSelection: boolean;
  /** 도구 선택이 갈릴 만큼 모호할 때만 사용자에게 할 한 문장 질문. */
  readonly clarify: string | null;
  readonly clarifyOptions: readonly string[];
  /** 한 번의 툴 호출로 끝나지 않는 다단계 요청인가. */
  readonly needsPlan: boolean;
  /** 이전 작업과 무관한 새 작업/처음부터를 명시했는가(최근 툴 도메인 기억을 비운다). */
  readonly resetsContext: boolean;
  /** 이 요청에 쓸 가능성이 높은 툴 이름(레지스트리에 있는 것만). */
  readonly tools: readonly string[];
  readonly summary: string;
  readonly source: IntentSource;
}

export interface IntentSelectionFact {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 모델에 넘기는 사실 — 전부 코드가 아는 값이다. 추측이 들어갈 자리가 없다. */
export interface IntentFacts {
  readonly userText: string;
  readonly currentMap: { readonly id: string; readonly name: string } | null;
  readonly selection: IntentSelectionFact | null;
  readonly maps: readonly { readonly id: string; readonly name: string }[];
  readonly facilityLabels: readonly string[];
  readonly toolNames: readonly string[];
  readonly hasActivePlan: boolean;
}

export const INTENT_MODES: readonly IntentMode[] = ["create", "modify", "question", "other"];
export const INTENT_SPACES: readonly IntentSpace[] = ["interior", "outdoor", "both", "none", "unclear"];
export const INTENT_MAX_TOOLS = 8;
export const INTENT_MAX_CLARIFY_OPTIONS = 4;

/** 진행 중 계획을 이어가는 한 마디 — 모델을 부르지 않고 continuation 으로 선언한다. */
const CONTINUATION_TOKENS: ReadonlySet<string> = new Set(["계속", "이어서", "다음", "계속해", "계속해줘", "go on", "continue", "next"]);

export function isContinuationText(text: string): boolean {
  return CONTINUATION_TOKENS.has(text.normalize("NFKC").trim().toLowerCase().replace(/[.!~]+$/u, ""));
}

export const INTENT_SYSTEM_PROMPT = `You classify ONE user request addressed to an RPG map/event editor assistant. Output JSON only — no prose, no fences.

Fields:
- "mode": "create" (새로 만든다) | "modify" (지금 있는 것을 고친다·지운다·옮긴다·추가로 얹는다) | "question" (질문·설명·조회, 변경 없음) | "other" (인사·진행 지시·판단 불가).
- "space": 시설·집·방을 세울 때 어디에 — "interior" (외장 없이 새로 짓는 독립 실내 방·시설 실내. 예: 여관 실내만, 빈 방 꾸미기) | "outdoor" (지금 맵 위에 건물 외장) | "both" (야외 외곽+들어가서 걷는 실내 둘 다. 예: 집 지어줘+들어갈 수 있게, 민가·상점·대장간을 짓고 안에도 들어가게) | "none" (공간 시공이 아닌 요청) | "unclear" (집·건물·방을 만들라는데 어느 쪽인지 표지가 없음).
- "facility": 입력의 개념 꾸러미 시설 라벨 중 하나를 만들라는 요청이면 그 라벨 그대로, 아니면 null. 모든 신규 실내는 get_concept_facility 로 꾸러미를 읽고 place_concept(plan) 로 짓는다. 등록되지 않은 실내도 sources의 장소·물건을 조합한다 — 야외 표지("맵 위에", "외장", "마을에 건물")가 없으면 space="interior".
- "targetMapId": mode=modify 이고 대상 맵을 알 수 있으면 id. 「여기/이 맵/이 마을/이 방」은 현재 열린 맵. 모르면 null.
- "useSelection": 선택 영역이 주어졌고 그 안에서 작업해야 하면 true. 새 맵을 만드는 요청이면 false. 선택 영역이 없으면 false.
- "clarify": 도구가 실제로 갈릴 만큼 모호할 때만(예: 실내/야외 표지 없는 「집 지어줘」) 사용자에게 할 한 문장 질문. 그 외 null. 진행할 수 있으면 되묻지 않는다.
- "clarifyOptions": clarify 가 있을 때 2~4개의 짧은 선택지 라벨. 없으면 [].
- "needsPlan": 여러 산출물·여러 맵·마을/도시/RPG/캠페인·퀘스트 체인처럼 한두 번의 툴 호출로 끝나지 않으면 true. NPC 한 명, 소품 몇 개, 시설 하나, 질문은 false.
- "resetsContext": 사용자가 이전 작업과 무관한 새 작업·처음부터·프로젝트 초기화를 명시하면 true.
- "tools": 입력 툴 목록에서 이 요청에 쓸 가능성이 높은 이름만, 최대 8개. 모르면 [].
- "summary": 요청을 한 문장으로.

Rules:
- 부정과 금지("X 말고", "X 는 만들지 마", "X 없이")를 그대로 존중한다. 금지된 X 를 tools·needsPlan·facility 의 근거로 쓰지 않는다.
- 「여관 주인 NPC」「대장간 주인」처럼 직업 이름에 든 건물 명사는 시공이 아니다 — NPC 배치(mode=create, space=none).
- 「수집」「편집」「완벽」「적당히」「낮게」처럼 다른 낱말의 일부는 시공·전투·시간 요청이 아니다. 문장 전체의 뜻으로 판단한다.
- 「추가해줘」「하나 더」는 있는 곳에 얹는 것이라 보통 mode=modify 이고, 마을을 새로 만드는 뜻이 아니다.
- 질문(뭐야, 몇 개야, 알려줘, 보여줘)은 mode=question, tools 는 조회 툴만.
- 사용자와 같은 언어로 clarify·summary 를 쓴다.

JSON schema:
{"mode":"create","space":"interior","facility":"여관","targetMapId":null,"useSelection":false,"clarify":null,"clarifyOptions":[],"needsPlan":false,"resetsContext":false,"tools":["get_concept_facility","place_concept"],"summary":"여관 실내 맵을 설계해 시공"}`;

export function buildIntentUserPayload(facts: IntentFacts): string {
  const lines: string[] = [`## 요청\n${facts.userText.trim()}`];
  const context: string[] = [];
  context.push(facts.currentMap ? `현재 열린 맵: ${facts.currentMap.name} (${facts.currentMap.id})` : "현재 열린 맵: 없음");
  context.push(
    facts.selection
      ? `선택 영역: ${facts.selection.mapId} (${facts.selection.x},${facts.selection.y}) ${facts.selection.width}×${facts.selection.height}`
      : "선택 영역: 없음",
  );
  context.push(`진행 중 계획: ${facts.hasActivePlan ? "있음" : "없음"}`);
  if (facts.maps.length > 0) {
    context.push(`맵 목록: ${facts.maps.slice(0, 16).map((map) => `${map.name}(${map.id})`).join(", ")}`);
  }
  lines.push(`## 사실\n${context.join("\n")}`);
  lines.push(`## 개념 꾸러미 시설 라벨\n${facts.facilityLabels.length > 0 ? facts.facilityLabels.join(", ") : "(없음)"}`);
  lines.push(`## 툴 목록\n${facts.toolNames.join(", ")}`);
  return lines.join("\n\n");
}

export interface IntentParseResult {
  readonly intent: IntentDeclaration | null;
  readonly error?: string;
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    const inner = fence[1].trim();
    if (inner.startsWith("{")) return inner;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, max = 400): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, max) : null;
}

function readStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const text = readString(entry, 120);
    if (text && !out.includes(text)) out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * 모델 응답을 검증해 선언으로 옮긴다. 모르는 툴 이름·맵 id 는 버리고, enum 밖 값은 실패로 돌려
 * 호출자가 폴백을 쓰게 한다. 관대하게 읽되 스키마 밖 값을 코드로 흘리지 않는다.
 */
export function parseIntentDeclaration(raw: string, facts: IntentFacts): IntentParseResult {
  const json = extractJsonObject(raw);
  if (!json) return { intent: null, error: "JSON 객체가 없다" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    return { intent: null, error: `JSON 파싱 실패: ${cause instanceof Error ? cause.message : String(cause)}` };
  }
  if (!isRecord(parsed)) return { intent: null, error: "JSON 최상위가 객체가 아니다" };
  const mode = parsed.mode;
  if (typeof mode !== "string" || !INTENT_MODES.includes(mode as IntentMode)) {
    return { intent: null, error: `mode 값이 잘못됨: ${String(mode)}` };
  }
  const spaceRaw = typeof parsed.space === "string" ? parsed.space : "none";
  const space: IntentSpace = INTENT_SPACES.includes(spaceRaw as IntentSpace) ? (spaceRaw as IntentSpace) : "none";
  const knownTools = new Set(facts.toolNames);
  const tools = readStringList(parsed.tools, INTENT_MAX_TOOLS * 2)
    .filter((name) => knownTools.has(name))
    .slice(0, INTENT_MAX_TOOLS);
  const facilityRaw = readString(parsed.facility, 60);
  const facility = facilityRaw && facts.facilityLabels.some((label) => label === facilityRaw) ? facilityRaw : facilityRaw
    ? facts.facilityLabels.find((label) => label.toLowerCase() === facilityRaw.toLowerCase()) ?? null
    : null;
  const targetRaw = readString(parsed.targetMapId, 120);
  const knownMaps = new Set(facts.maps.map((map) => map.id));
  const targetMapId = targetRaw && knownMaps.has(targetRaw) ? targetRaw : null;
  const clarify = readString(parsed.clarify, 300);
  const clarifyOptions = clarify ? readStringList(parsed.clarifyOptions, INTENT_MAX_CLARIFY_OPTIONS) : [];
  return {
    intent: {
      mode: mode as IntentMode,
      space,
      facility,
      targetMapId,
      useSelection: facts.selection !== null && parsed.useSelection === true,
      clarify,
      clarifyOptions,
      needsPlan: parsed.needsPlan === true,
      resetsContext: parsed.resetsContext === true,
      tools,
      summary: readString(parsed.summary, 200) ?? facts.userText.trim().slice(0, 200),
      source: "llm",
    },
  };
}

/**
 * 모델을 부르지 못했을 때의 중립 선언 — 아무 것도 추측하지 않는다. 되묻지 않고, 툴은 UI 도메인·핀·
 * 이름 언급·능력 승격으로만 노출된다. 계획 여부는 「모른다」이므로 플래너(main 모델)에게 넘긴다 —
 * 오케스트레이션이 켜진 세션은 플래너가 direct/new_plan 을 정하고, 꺼진 세션(chat)은 본문으로 간다.
 */
export function fallbackIntentDeclaration(facts: IntentFacts): IntentDeclaration {
  const text = facts.userText.trim();
  return {
    mode: "other",
    space: "unclear",
    facility: null,
    targetMapId: null,
    useSelection: facts.selection !== null,
    clarify: null,
    clarifyOptions: [],
    needsPlan: text.length > 0,
    resetsContext: false,
    tools: [],
    summary: text.slice(0, 200),
    source: "fallback",
  };
}

export function continuationIntentDeclaration(facts: IntentFacts): IntentDeclaration {
  return {
    ...fallbackIntentDeclaration(facts),
    needsPlan: facts.hasActivePlan,
    summary: "진행 중 작업을 이어간다",
    source: "continuation",
  };
}

export function emptyIntentDeclaration(): IntentDeclaration {
  return {
    mode: "other",
    space: "none",
    facility: null,
    targetMapId: null,
    useSelection: false,
    clarify: null,
    clarifyOptions: [],
    needsPlan: false,
    resetsContext: false,
    tools: [],
    summary: "",
    source: "empty",
  };
}

/**
 * 선언이 여는 툴 도메인. 선언한 툴의 레지스트리 도메인이 정본이고, 공간 시공은 tile, 수정은 편집
 * 3도메인(tile·map·event)을 함께 연다 — 선언 필드에서 도메인으로 가는 고정 사상이지 문장 스캔이 아니다.
 */
export function intentToolDomains(
  intent: IntentDeclaration,
  domainsOf: (toolName: string) => readonly ToolDomain[] | undefined,
): Set<ToolDomain> {
  const domains = new Set<ToolDomain>();
  for (const name of intent.tools) {
    for (const domain of domainsOf(name) ?? []) if (domain !== "core") domains.add(domain);
  }
  if (intent.space === "interior" || intent.space === "outdoor" || intent.space === "both" || intent.space === "unclear") {
    domains.add("tile");
  }
  if (intent.mode === "modify") {
    domains.add("tile");
    domains.add("map");
    domains.add("event");
  }
  return domains;
}

/**
 * 선택 영역 작업(하드 클립)으로 이행할 수 없는 요청 — 실내 신축·새 맵은 현재 맵 사각형 밖이 본업이다.
 * 수정 요청은 지금 이 맵을 고치는 일이라 영역 안에 남긴다.
 */
export function intentEscapesRegion(intent: IntentDeclaration): boolean {
  if (intent.source !== "llm") return false;
  if (intent.mode === "modify") return false;
  if (intent.space === "interior") return true;
  return intent.mode === "create" && !intent.useSelection;
}

export function formatIntentAudit(intent: IntentDeclaration, elapsedMs: number): string {
  const parts = [
    `intent:${intent.source}`,
    `mode=${intent.mode}`,
    `space=${intent.space}`,
    intent.facility ? `facility=${intent.facility}` : null,
    intent.targetMapId ? `target=${intent.targetMapId}` : null,
    intent.useSelection ? "selection" : null,
    intent.needsPlan ? "plan" : "single",
    intent.clarify ? "clarify" : null,
    intent.resetsContext ? "reset" : null,
    intent.tools.length > 0 ? `tools=${intent.tools.join(",")}` : null,
    `${elapsedMs}ms`,
  ];
  return parts.filter((part): part is string => part !== null).join(" ");
}

/** 되묻기 문장 — 선언이 낸 질문 그대로, 선택지가 둘 이상이면 원탭 마커를 붙인다. */
export function formatIntentClarifyMessage(intent: IntentDeclaration): string {
  const question = intent.clarify ?? "요청을 어떻게 진행할지 알려 주세요.";
  if (intent.clarifyOptions.length >= 2) {
    return `${question}\n${QUICK_REPLY_MARKER} ${intent.clarifyOptions.join(" | ")}`;
  }
  return question;
}

export interface ScopeNoteInput {
  readonly mapId: string;
  readonly region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

/**
 * 선택 사각형 노트 — 사실(맵 id·좌표)과 그에 따르는 경계다. 선언이 「그 안에서」라고 했으면 영역 밖 금지와
 * 마을 시공 시그니처를, 새 맵/실내 시공이면 참고용임을 알린다. 옛 가이드의 키워드 분기(bare 집 → 야외 집
 * 강제)는 없다 — 「수집 이벤트 놔줘」가 author_house 지시를 받던 경로다.
 */
export function formatScopeNote(scope: ScopeNoteInput, intent: IntentDeclaration): string {
  const { mapId, region } = scope;
  const where = `맵 \`${mapId}\` 의 (${region.x},${region.y}) ${region.width}×${region.height}`;
  const inside = intent.source !== "llm" || intent.useSelection;
  if (inside) {
    return [
      `[선택 영역] 이 작업의 대상은 ${where} 사각형이다.`,
      "- 영역 밖 타일·이벤트는 수정하지 말 것. create_map·duplicate_map 으로 새 맵을 만들지 말고 이 맵 안에서 끝낸다.",
      `- 마을 시공이면 author_village { target:{kind:"existing",mapId:"${mapId}",bounds:{x:${region.x},y:${region.y},w:${region.width},h:${region.height}}} } — 새 맵 금지. 선택이 16×16 미만이면 그 주변으로 넓혀 16 이상으로 맞출 것.`,
      `- tile_query ask:"labels" 는 mapId:"${mapId}" 를 넣어 이 맵 타일셋 라벨만 조회.`,
    ].join("\n");
  }
  return [
    `[선택 영역] 사용자가 ${where} 를 선택했지만 이 요청은 새 맵/실내 시공이다.`,
    "- 선택 영역은 참고용이며 영역 밖 작업을 허용한다. 현재 맵 타일은 불필요하면 건드리지 말 것.",
  ].join("\n");
}

/**
 * 본문 모델에게 주는 의도 노트 — 선언이 확정한 것을 한 번 더 묻지 않게 한다.
 * 2026-09-03 실측: 선언이 「대장간 = 개념 꾸러미 실내(place_concept)」라고 읽었는데 본문 모델은 여전히
 * 「야외/실내/둘 다?」를 되물었다. 선언은 코드만 읽고 모델은 못 봤기 때문이다. 모델이 읽은 선언이라
 * 폴백·이어가기에는 붙이지 않는다.
 */
export function formatIntentNote(intent: IntentDeclaration, options: { readonly clarifyBypassed?: boolean } = {}): string | null {
  if (intent.source !== "llm") return null;
  const lines: string[] = [];
  if (intent.clarify && options.clarifyBypassed) {
    lines.push(`[의도] 모호한 점: ${intent.clarify} — 자율 모드라 되묻지 않는다. 가장 그럴듯한 해석으로 진행하고 첫 문장에 어느 쪽을 택했는지 밝혀라.`);
  }
  if (intent.mode === "question") {
    lines.push("[의도] 질문·조회다. 프로젝트를 바꾸지 말고 조회 툴로 답한다.");
  } else if (intent.mode === "modify") {
    const target = intent.targetMapId ? `대상 맵은 \`${intent.targetMapId}\` 이다.` : "대상은 지금 열린 맵의 기존 산출물이다.";
    lines.push(
      `[의도] 있는 것을 고치는 요청이다. ${target} get_map_region/find_layout_regions 로 현재 상태를 먼저 보고 그 자리에서 고친다. `
      + "create_map·duplicate_map·start_interior_room_session·author_village(kind:\"new\") 로 새것을 만들지 말 것. 기존 실내 맵은 furnish_interior_space.",
    );
  } else if (intent.mode === "create" && !intent.clarify) {
    const facilityHow = intent.facility
      ? `개념 꾸러미 시설 「${intent.facility}」는 get_concept_facility(query:"${intent.facility}") 로 템플릿과 variants 를 읽고, 수식어가 없어도 규모·layout 을 정한 plan 을 place_concept(query:"${intent.facility}", plan) 로 새 mapId 에 시공한다`
      : null;
    if (intent.space === "both") {
      const how = facilityHow
        ?? "들어가서 걷는 집이면 author_house(interior:\"linked-interior\") 한 번으로 외장+실내+양방향 전이를 짓는다";
      lines.push(
        `[의도] 야외 외장과 실내 둘 다이다. ${how}. 이미 확인된 의도이므로 야외/실내를 다시 묻지 말고 진행하라.`,
      );
    } else if (intent.space === "interior") {
      const how = facilityHow ?? "get_concept_facility로 꾸러미의 장소·물건을 읽고 place_concept(plan, 새 mapId)으로 실내를 시공한다. 등록된 시설이 없어도 sources를 조합해 설계한다";
      lines.push(
        `[의도] 실내 시공이다(외장 없는 독립 실내). ${how}. 외장과 함께 짓는 들어가서 걷는 집이면 author_house(interior:"linked-interior")가 정답이다. `
        + "이미 확인된 의도이므로 야외/실내를 다시 묻지 말고 진행하라.",
      );
    } else if (intent.space === "outdoor") {
      lines.push("[의도] 지금 맵 위 야외 시공이다(author_house/author_village/fill_region/place_props). 집은 author_house(interior:\"linked-interior\")가 기본이다 — 실내맵과 양방향 전이가 함께 생긴다. 겉모습만 필요하면 명시적으로 interior:\"exterior-only\". 독립 실내 세션은 만들지 말 것. 이미 확인된 의도이므로 되묻지 말고 진행하라.");
    }
  }
  return lines.length > 0 ? lines.join("\n") : null;
}
