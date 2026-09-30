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
import { parseFunctionalRequirements, parseFunctionalRefinements, type FunctionalCriterion, type FunctionalRefinement, type UnresolvedFunctionalRequirement } from "./functionalAcceptance";
import type { AdventureRequirements } from "./adventureCompletion";
import { ADVENTURE_AUTHORING_GUIDE } from "./adventureCompletion";
import type { ToolDomain } from "@/editor/tools/types";
import type { RequestRequirement } from "./requestCoverage";
import { QUICK_REPLY_MARKER } from "./interviewPrompt";
import { parseActionCombatRequirements, type AcceptanceTarget } from "./assistantAcceptance";
import { estimateVillageSize, parseConstructionDeclaration, type ConstructionDeclaration } from "./constructionDeclaration";

export type IntentMode = "create" | "modify" | "question" | "other";
export type IntentSpace = "interior" | "outdoor" | "both" | "none" | "unclear";
export type IntentSource = "llm" | "fallback" | "continuation" | "empty";

export type NpcRewardTarget = (
  | { readonly eventId: string; readonly eventName?: never }
  | { readonly eventName: string; readonly eventId?: never }
) & { readonly mapId?: string };

export type NpcRewardGrant = (
  | { readonly kind: "gold"; readonly id?: never; readonly name?: never }
  | (({ readonly id: string; readonly name?: never } | { readonly name: string; readonly id?: never }) & {
    readonly kind: "item" | "monster";
  })
) & {
  /** Exact positive delta when specified; otherwise any positive delta. */
  readonly count?: number;
};

export interface NpcRewardRequirement {
  readonly target: NpcRewardTarget;
  readonly grants: readonly NpcRewardGrant[];
  readonly oneTime?: boolean;
  /** Zero-based choices for the first and second interaction, respectively. */
  readonly choices?: readonly number[];
  readonly repeatChoices?: readonly number[];
}

/** Invalid declarations stay opted in, rather than disappearing into a neutral fallback. */
export type NpcRewardRequirements = readonly NpcRewardRequirement[] | { readonly invalidReason: string };

export interface IntentDeclaration {
  /** 새로 만든다 / 있는 것을 고친다·지운다·옮긴다 / 질문·조회 / 그 외(인사·진행 지시·판단 불가). */
  readonly mode: IntentMode;
  /** 시설·집·방을 만들 때 어디에 — 들어가서 걷는 실내 맵인지, 맵 위 외장인지. 공간 시공이 아니면 none. */
  readonly space: IntentSpace;
  /** 프로젝트의 개념 꾸러미 시설 라벨 중 하나에 해당하면 그 라벨. */
  readonly facility: string | null;
  /** 생성·수정할 기존 대상 맵을 알 수 있으면 그 id. 새 맵 자체를 요청하면 null. */
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
  /** 사용자가 명시한 조회 선행 계약. 자연어 해석은 선언자가, 성공 근거 검사는 세션이 맡는다. */
  readonly readBeforeWrite?: {
    readonly project: boolean;
    readonly collections: readonly string[];
    readonly references: boolean;
  };
  readonly adventure?: AdventureRequirements;
  /** Explicit field-action behavior requested by the user, not inferred from genre words. */
  readonly actionCombat?: { readonly targets: readonly AcceptanceTarget[] };
  /** Only explicit state-dependent NPC behavior imposes a multipage outcome gate. */
  readonly statefulNpcs?: boolean;
  /**
   * 문장에 나온 시공 규모(크기어·집 수·주민 수·새 맵 이름). 코드가 권장 맵 크기로 환산한다.
   *
   * 2026-09-15: 이 필드가 없어서 「큰 마을로 넓혀줘」의 수량이 선언 계층에서 통째로 버려졌고,
   * 환산기(constructionDeclaration)는 호출자 0인 죽은 코드였다. 크기를 정하는 주체가 없으니
   * 수정 요청은 늘 현재 맵 사각형 안에서 풀렸다.
   */
  readonly construction?: ConstructionDeclaration;

  /** Only explicit create/modify NPC reward requests; never inferred from authored commands. */
  readonly npcRewards?: NpcRewardRequirements;
  readonly functionalAcceptance?: readonly FunctionalCriterion[];
  readonly functionalRefinements?: readonly FunctionalRefinement[];
  /** Host adapter's independent extraction, never accepted from worker/declaration JSON. */
  readonly requestRequirements?: readonly RequestRequirement[];
  /**
   * 사용자가 **실존 작품을 비유해** 말했는가("해리포터 같은", "스타덱 느낌으로").
   * 있으면 그 작품의 분위기·구조를 **검색으로 확인**한 뒤 설계에 쓴다 — 모델의 암기는 작품 해석이 부정확하고, 그렇게 만든 세계관은 사용자가 기대한 것과 어꺋난다.
   * 원작 고유명(해리포터·호그워즈 등)은 그대로 쓰지 않는다 — 분위기와 구조만 가져와 새 이름을 짓는다.
   */
  readonly referenceWork?: string | null;
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
  readonly wikiContext?: string;
  readonly actualStart?: { readonly mapId: string; readonly x: number; readonly y: number };
  readonly unresolvedFunctional?: readonly UnresolvedFunctionalRequirement[];
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
- "facility": 입력의 개념 꾸러미 시설 라벨 중 하나를 만들라는 요청이면 그 라벨 그대로, 아니면 null. 모든 신규 실내는 build_hand_interior_room(plan) 로 짓는다(손 도트 v5) — 야외 표지("맵 위에", "외장", "마을에 건물")가 없으면 space="interior".
- "targetMapId": mode=create/modify 모두 작업할 기존 대상 맵을 알 수 있으면 id. 「여기/이 맵/이 마을/이 방」은 현재 열린 맵. 새 맵 자체를 요청하거나 모르면 null.
- "useSelection": 선택 영역이 주어졌고 그 안에서 작업해야 하면 true. 새 맵을 만드는 요청이면 false. 선택 영역이 없으면 false.
- "clarify": 도구가 실제로 갈릴 만큼 모호할 때만(예: 실내/야외 표지 없는 「집 지어줘」) 사용자에게 할 한 문장 질문. 그 외 null. 진행할 수 있으면 되묻지 않는다.
- "clarifyOptions": clarify 가 있을 때 2~4개의 짧은 선택지 라벨. 없으면 [].
- "needsPlan": 여러 산출물·여러 맵·마을/도시/RPG/캠페인·퀘스트 체인처럼 한두 번의 툴 호출로 끝나지 않으면 true. NPC 한 명, 소품 몇 개, 시설 하나, 질문은 false. 생성/수정 분류와 작업 규모는 독립이다. 「이 맵에 집을 만들어라」는 현재 맵의 집 한 채 시공이므로 space="outdoor", targetMapId=현재 맵 id, clarify=null, needsPlan=false다. author_house 한 호출이 부속 실내와 출입구까지 만드는 것은 별도 다단계 계획의 근거가 아니다. 마을 전체나 여러 독립 시설을 조성하는 요청은 true.
- "resetsContext": 사용자가 이전 작업과 무관한 새 작업·처음부터·프로젝트 초기화를 명시하면 true.
- "tools": 입력 툴 목록에서 이 요청에 쓸 가능성이 높은 이름만, 최대 8개. 모르면 [].
- "readBeforeWrite": 사용자가 '기존 데이터를 먼저 읽고 이어 작업', '조회 후 실제 ID만 참조'를 명시하면 {"project":true,"collections":["items","enemies","troops"],"references":true}. project 는 프로젝트/기존 맵·이벤트 선행 조회, collections 는 작업에 필요한 DB 컬렉션 이름(실제 조회가 모두 성공하기 전 첫 쓰기 금지), references 는 참조 ID 조회 증거를 뜻한다. 필요한 컬렉션만 선택한다. 그런 조건이 없으면 생략한다. 이것은 작성 요청의 절차 계약이며 별도 허락 질문이 아니다.
- "adventure": 시작 마을·던전 탐험·파티 모험을 구성하라는 전체 모험 저작 요청이면 {"village":true,"dungeon":true,"party":true,"battle":true,"world":true,"characters":true,"appearance":true}. 각 항목은 요청한 것만 true. 단순 NPC 추가/질문/DB 시드만/입구 표지판만 요청은 생략한다. 모험 JRPG 장르 프리셋 또는 "중세 게임 RPG를 만들어줘"처럼 프로젝트 전체를 처음 만드는 요청은 세계관·핵심 인물·주인공 외형/장비를 먼저 저작해야 하므로 world/characters/appearance를 true로 선언한다. 모험 JRPG 장르 프리셋 + 파티·던전 탐험 + 시작 마을·기본 전투 적은 네 항목과 새 세 항목 모두 true다.
- "actionCombat": 실제 필드 액션 전투(공격 적중·처치·피격·회피·스태미나·원거리 적·보상)의 작동을 요구하면 {"targets":[{"mapId":"기존 실제 ID"} 또는 {"newMapName":"새로 만들 정확한 맵 이름"}]}로 필수 검증 대상을 선언한다. 턴제 전투, 장르 질문, 액션을 제외한 요청은 생략한다. 단어가 아니라 요청한 행동으로 판단한다. 이 선언은 계획 교체나 acceptance 수리로 지울 수 없는 완료 조건이다.
- "statefulNpcs": 사용자가 상태에 따라 달라지는 NPC 행동/대사를 명시했을 때만 true. 보통의 한 페이지 안내 NPC, 인사, 상점이라는 이유로 true를 만들지 않는다.
- "construction": 마을·집·시설을 짓거나 넓히라는 요청에서 **문장에 실제로 나온 수량만** 옮긴다. {"scale":"small|medium|large|vast","houseCount":20,"npcCount":8,"targetName":"강호 장터 마을"}. 크기어 대응: 아기자기한·작은=small, 보통=medium, 큰·넓은=large, 아주 큰·광활한=vast. 없는 값은 넣지 않는다(추측 금지). width/height는 쓰지 않는다 — 크기 환산은 코드가 한다. 「더 크게」「넓혀줘」「집 더 지어줘」처럼 있는 마을을 키우라는 요청도 mode=modify 로 두고 여기에 규모를 적는다. 공간 시공이 아니면 생략한다. 사용자가 배치를 명시하면 morphology:river|street|green|round|cluster로 옮긴다. river는 중앙 강·다리·양안 주거다. 별도 배치 요청이 없으면 morphology를 생략한다(빈 맵 기본 강변형은 코드가 정한다). 사용자가 명시한 산골·항구·사막 등 테마는 theme에 옮기되 추측으로 만들지 않는다. 주민 0명은 npcCount:0으로 보존한다. 말 없는 주민을 명시하면 residentDialogue:false, 대사를 요구하면 true로 적는다. 「위로 올라가면 마을」「북쪽으로 가면 마을이 나온다」「오른쪽 길 끝에 마을」처럼 **지금 맵에서 어느 쪽으로 가면 마을이 나온다**고 하면 지금 맵 위가 아니라 새 마을 맵이다 — approach:north|south|east|west 로 방향을 적고 targetMapId=null 로 둔다(위·북=north, 아래·남=south, 오른쪽·동=east, 왼쪽·서=west). 두 맵을 잇는 출입구는 코드가 만든다.

- "npcRewards": ONLY for explicit create/modify requests to make an NPC grant currency, items or collected monsters. Omit for ordinary dialogue/NPCs, questions, and reward removal requests. Array example: [{"target":{"eventId":"known_event_id"},"grants":[{"kind":"item","id":"known_item_id","count":2}],"oneTime":true}]. Grant kind may also be "monster" or "gold". Currency uses {"kind":"gold","count":20} with NO id/name, not an inventory item. Do not reinterpret an item named gold/골드 as currency or invent a gold item to represent money. When an ID is unknown, replace target eventId with eventName, or item/monster grant id with name. Each target or item/monster reference must contain exactly ONE of those keys, never both; omit unused keys rather than writing null. Optional mapId belongs inside target. Preserve every requested grant. count is a positive integer for an explicit amount; omit count for an unspecified positive amount. oneTime=true ONLY when requested. Choices are zero-based and only declared when requested; repeatChoices describes the second interaction, normally omitted. Use IDs only when known, otherwise exact names (must resolve uniquely at completion); do not invent IDs or substitute actors/changeParty for collected monsters. If the requested target/reward cannot be identified, include an incomplete requirement so completion remains blocked, not an omitted contract. These expectations come from the REQUEST, never the eventual event commands, and must not be weakened to pass completion.
- "functionalAcceptance": ONLY requested working purchases or map round-trip travel, not a shop decoration, map listing, genre label, question, or excluded behavior. Array of immutable expectations, never success flags/scripts. Purchase: {"kind":"shopPurchase","target":{"mapId":"actual map"},"start":{"x":1,"y":1},"seller":{"eventId":"known seller"},"item":{"id":"known item"},"count":2,"unitPrice":10}. Round trip: {"kind":"mapRoundTrip","target":{"mapId":"origin"},"start":{"x":1,"y":1},"destination":{"mapId":"destination"},"outgoing":{"eventId":"outgoing transfer"},"returning":{"eventId":"return transfer"}}. Use exact eventName/name instead of invented eventId/id; a new map uses newMapName instead of mapId. Start must be the requested actual project entry, supplied in facts, never a convenient test teleport. Preserve requested seller, stock, price/count, origin/destination and both authored transfers. For missing/ambiguous/unsupported targets or unspecified price/count include {"kind":"functionalUnresolved","reason":"Identify the missing request expectations"}; do not drop the requested behavior. Existing npcRewards already creates mandatory real-interaction acceptance. Non-requested behaviors MUST be omitted.
- "functionalRefinements": ONLY when this USER message clarifies an unresolvedFunctional requirement supplied in facts. Read its original source.text, current typed expectations and prior user refinements together with the latest message. Output [{"requirementId":"the exact supplied stable promise id","criterionIndex":3,"criterion":{...concrete or partial functional criterion},"corrections":["count"]}]. Copy criterionIndex exactly from facts (zero-based); omission is supported only for a singleton index0. Replace only that unresolved leaf, never its valid siblings. The entire refinement batch must be valid, with unique selectors. Keep the original behavior/targets and known quantities; fill missing fields without inventing them. corrections is optional and names only known top-level fields explicitly corrected by this user's message; never infer a correction to make a failing check pass. A partial criterion retains known fields and stays unresolved until complete. Do not output duplicate functionalAcceptance for this clarification. Do not refine unrelated requirements or concrete contracts; there is no worker repair/replan authority here. For a generic ending/compound-scene placeholder with no typed expectations, a later explicit user clarification may specialize to {"kind":"toolVerdict","tool":"run_scene_test","args":{"mapId":"known map","start":{"x":1,"y":1},"steps":[...]},"interactionTargets":[{"stepIndex":2,"mapId":"known owning map","eventId":"named event"}]}. Use complete native scene input and ordered map-qualified ownership for EVERY named interact step, fixed before execution. No set/debug state, checkpoint retry, arbitrary tool, or first-probe-derived ownership. Require post-interaction outcome assertions (nonzero reward/consumption delta, actual lastTransfer, or endingReached with the exact nonempty ending-ID string, never true); wait, position, interactionComplete or zero-only checks alone are not a functional outcome. Preserve the original requested chain, quantities, repeats, transfers and ending; do not convert typed shop/travel/reward expectations into a scene. The host retains the original request initial-state contract and requires a fresh exact explicit execution after refinement. For an initial unresolved request, preserve all known machine-checkable fields in functionalUnresolved.expectations (e.g. {"kind":"shopPurchase","seller":{"eventName":"Mira"},"item":{"name":"Potion"},"count":2}), not only in the reason string.
- "referenceWork": 사용자가 **실존 작품을 비유**해 게임을 만들라고 했으면 그 작품명(예: "해리포터", "스타덱밸리"). 아니면 생략한다. "중세 판타지 RPG", "픽셀 노스탠지아" 같은 장르·스타일 설명은 작품명이 아니다. 그러나 "해리포터 같은", "OO 느낌으로" 처럼 고유명사로 지목하면 그대로 적는다 — 그 작품의 분위기·구조를 검색으로 확인한 뒤 설계에 쓴다.
- "summary": 요청을 한 문장으로.

Rules:
- 부정과 금지("X 말고", "X 는 만들지 마", "X 없이")를 그대로 존중한다. 금지된 X 를 tools·needsPlan·facility 의 근거로 쓰지 않는다.
- 「여관 주인 NPC」「대장간 주인」처럼 직업 이름에 든 건물 명사는 시공이 아니다 — NPC 배치(mode=create, space=none).
- 「수집」「편집」「완벽」「적당히」「낮게」처럼 다른 낱말의 일부는 시공·전투·시간 요청이 아니다. 문장 전체의 뜻으로 판단한다.
- 「추가해줘」「하나 더」는 있는 곳에 얹는 것이라 보통 mode=modify 이고, 마을을 새로 만드는 뜻이 아니다.
- 질문(뭐야, 몇 개야, 알려줘, 보여줘)은 mode=question, tools 는 조회 툴만.
- 사용자와 같은 언어로 clarify·summary 를 쓴다.

JSON schema:
{"mode":"create","space":"interior","facility":"여관","targetMapId":null,"useSelection":false,"clarify":null,"clarifyOptions":[],"needsPlan":false,"resetsContext":false,"tools":["list_hand_interior_parts","build_hand_interior_room"],"summary":"여관 실내 맵을 설계해 시공"}`;

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
  if (facts.actualStart) context.push(`Actual project entry: ${JSON.stringify(facts.actualStart)}`);
  lines.push(`## 사실\n${context.join("\n")}`);
  if (facts.unresolvedFunctional?.length) lines.push(`## Unresolved functional requirements - original user context and known expectations\n${JSON.stringify(facts.unresolvedFunctional)}`);
  if (facts.wikiContext) lines.push(`## 프로젝트 위키 — 이전에 정한 제작 방향과 현재 맵의 예외\n${facts.wikiContext}`);
  lines.push(`## 개념 꾸러미 시설 라벨\n${facts.facilityLabels.length > 0 ? facts.facilityLabels.join(", ") : "(없음)"}`);
  lines.push(`## 툴 목록\n${facts.toolNames.join(", ")}`);
  return lines.join("\n\n");
}

export interface IntentParseResult {
  readonly intent: IntentDeclaration | null;
  readonly error?: string;
}

export function extractJsonObject(raw: string): string | null {
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

/** Parse this boundary separately so malformed reward fields cannot disable acceptance. */
export function parseNpcRewardRequirements(raw: unknown): NpcRewardRequirements {
  const invalid = (detail: string): NpcRewardRequirements => ({ invalidReason: `npcRewards: ${detail}` });
  const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
  if (!Array.isArray(raw) || raw.length === 0) return invalid("a non-empty requirement array is required");
  const requirements: NpcRewardRequirement[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || !isRecord(entry.target)) return invalid("target is required");
    if (Object.keys(entry).some(key => !["target", "grants", "oneTime", "choices", "repeatChoices"].includes(key))) return invalid("unknown requirement field");
    const target = entry.target;
    if (Object.keys(target).some(key => !["mapId", "eventId", "eventName"].includes(key))) return invalid("unknown target field");
    if (target.mapId !== undefined && !text(target.mapId)) return invalid("mapId must be non-empty");
    const map = typeof target.mapId === "string" ? { mapId: target.mapId } : {};
    let reference: NpcRewardTarget;
    if (text(target.eventId) && target.eventName === undefined) reference = { eventId: target.eventId, ...map };
    else if (text(target.eventName) && target.eventId === undefined) reference = { eventName: target.eventName, ...map };
    else return invalid("target needs exactly one eventId or exact eventName");
    if (!Array.isArray(entry.grants) || entry.grants.length === 0) return invalid("grants are required");
    const grants: NpcRewardGrant[] = [];
    for (const grant of entry.grants) {
      if (!isRecord(grant) || (grant.kind !== "item" && grant.kind !== "monster" && grant.kind !== "gold")) return invalid("grant kind must be item, monster or gold");
      if (Object.keys(grant).some(key => !["kind", "id", "name", "count"].includes(key))) return invalid("unknown grant field");
      if (grant.count !== undefined && (typeof grant.count !== "number" || !Number.isSafeInteger(grant.count) || grant.count <= 0)) return invalid("count must be a positive integer");
      const count = typeof grant.count === "number" ? { count: grant.count } : {};
      if (grant.kind === "gold") {
        if ("id" in grant || "name" in grant) return invalid("gold grants must omit id and name");
        if (grants.some(existing => existing.kind === "gold")) return invalid(`duplicate gold grants for target ${JSON.stringify(reference)}; declare one gold grant with the amount from the user request, preserving other grants and counts. Do not sum ambiguous amounts`);
        grants.push({ kind: "gold", ...count });
        continue;
      }
      if (text(grant.id) && grant.name === undefined) grants.push({ kind: grant.kind, id: grant.id, ...count });
      else if (text(grant.name) && grant.id === undefined) grants.push({ kind: grant.kind, name: grant.name, ...count });
      else return invalid("grant needs exactly one id or exact name");
    }
    if (entry.oneTime !== undefined && typeof entry.oneTime !== "boolean") return invalid("oneTime must be boolean");
    const choices: { choices?: number[]; repeatChoices?: number[] } = {};
    for (const key of ["choices", "repeatChoices"] as const) {
      if (entry[key] === undefined) continue;
      const indices = entry[key];
      if (!Array.isArray(indices) || !indices.every((index): index is number => typeof index === "number" && Number.isSafeInteger(index) && index >= 0)) return invalid(`${key} must contain non-negative integer indices`);
      choices[key] = [...indices];
    }
    requirements.push({ target: reference, grants, ...choices, ...(typeof entry.oneTime === "boolean" ? { oneTime: entry.oneTime } : {}) });
  }
  return requirements;
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
  const authoring = mode === "create" || mode === "modify";
  const actionCombat = authoring && parsed.actionCombat !== undefined
    ? parseActionCombatRequirements(parsed.actionCombat) : undefined;
  if (actionCombat === null) return { intent: null, error: "actionCombat targets are missing or malformed" };
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
      ...(isRecord(parsed.readBeforeWrite) ? { readBeforeWrite: {
        project: parsed.readBeforeWrite.project === true,
        collections: readStringList(parsed.readBeforeWrite.collections, 24).filter((name) =>
          ["actors", "classes", "skills", "items", "equipment", "enemies", "troops", "states", "battleAnimations", "switches", "variables", "commonEvents", "quests", "maps", "elements", "monsterSpecies", "lifeSkills", "farmAnimalSpecies", "crops"].includes(name)),
        references: parsed.readBeforeWrite.references === true,
      } } : {}),
      ...("npcRewards" in parsed && (mode === "create" || mode === "modify")
        ? { npcRewards: parseNpcRewardRequirements(parsed.npcRewards) } : {}),
      ...(isRecord(parsed.adventure) && (mode === "create" || mode === "modify") ? { adventure: {
        village: parsed.adventure.village === true,
        dungeon: parsed.adventure.dungeon === true,
        party: parsed.adventure.party === true,
        battle: parsed.adventure.battle === true,
        ...(parsed.adventure.world === true ? { world: true } : {}),
        ...(parsed.adventure.characters === true ? { characters: true } : {}),
        ...(parsed.adventure.appearance === true ? { appearance: true } : {}),
      } } : {}),
      ...(actionCombat ? { actionCombat } : {}),
      ...(authoring && parsed.functionalAcceptance !== undefined ? { functionalAcceptance: parseFunctionalRequirements(parsed.functionalAcceptance) } : {}),
      ...(authoring && parsed.functionalRefinements !== undefined ? { functionalRefinements: parseFunctionalRefinements(parsed.functionalRefinements) } : {}),
      ...(authoring && parsed.statefulNpcs === true ? { statefulNpcs: true } : {}),
      ...(authoring ? (() => {
        const construction = parseConstructionDeclaration(parsed.construction);
        return construction ? { construction } : {};
      })() : {}),
      // 참조 작품은 지정 사실이지 저작 선언이 아니다 — authoring 게이트에 묶으면 "해리포터 같은 게임 만들고 싶다"처럼 mode=other 로 분류된 발화에서
      // 조용히 사라진다(2026-09-21 실측: referenceWork=null, tools=[]). 그러면 사용자가 명시한 작품을 검색할 계기가 어디에서도 생기지 않는다.
      ...(() => {
        const referenceWork = readString(parsed.referenceWork, 80);
        return referenceWork ? { referenceWork } : {};
      })(),
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
  // A full adventure is a cross-domain authoring request. Do not make the
  // first round depend on the model remembering to name every lane in `tools`;
  // the declaration itself opens the world/lore, character database, map and
  // event surfaces needed to build a coherent starting slice.
  if (intent.adventure) {
    domains.add("world");
    domains.add("database");
    domains.add("system");
    domains.add("map");
    domains.add("event");
    if (intent.adventure.battle) domains.add("battle");
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
    intent.construction
      ? `construction=${[
        intent.construction.scale ?? null,
        intent.construction.houseCount !== undefined ? `houses:${intent.construction.houseCount}` : null,
        intent.construction.npcCount !== undefined ? `npcs:${intent.construction.npcCount}` : null,
        intent.construction.approach ? `approach:${intent.construction.approach}` : null,
        intent.construction.targetName ? `name:${intent.construction.targetName}` : null,
      ].filter((part) => part !== null).join("/") || "declared"}`
      : null,
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
export interface IntentNoteTargetMap {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

/**
 * 선언된 시공 규모 → 모델이 읽는 한 줄. 숫자는 코드(estimateVillageSize)가 정한다.
 *
 * 2026-09-15: 규모를 아는 계층과 크기를 정하는 계층이 끊겨 있어서 「마을 넓혀줘」가 맵 크기를
 * 한 번도 바꾸지 않았다. 기존 맵이 권장 크기보다 작으면 여기서 resize_map 을 먼저 부르라고 못박는다.
 */
function formatConstructionNote(intent: IntentDeclaration, targetMap: IntentNoteTargetMap | null): string | null {
  const construction = intent.construction;
  if (!construction) return null;
  const size = estimateVillageSize(construction);
  const declared = [
    construction.morphology ? `배치 ${construction.morphology}` : null,
    construction.theme ? `테마 ${construction.theme}` : null,
    construction.scale ? `규모 ${construction.scale}` : null,
    construction.houseCount !== undefined ? `집 ${construction.houseCount}채` : null,
    construction.npcCount !== undefined ? `주민 ${construction.npcCount}명` : null,
  ].filter((part): part is string => part !== null).join(" · ");
  const head = `[시공 규모] 선언된 수량: ${declared || "수량 없음"}. 코드가 환산한 권장 맵 크기는 ${size.width}×${size.height}(집 ${size.houseCount}채 기준)이다.`;
  if (intent.mode === "modify") {
    if (!targetMap) {
      return `${head} 대상 맵이 이보다 작으면 resize_map 으로 먼저 키운 뒤 그 자리에 시공하라 — 좌상단 기준 확장이라 기존 타일·이벤트는 그대로다.`;
    }
    if (targetMap.width >= size.width && targetMap.height >= size.height) {
      return `${head} 대상 맵 '${targetMap.id}' 은 ${targetMap.width}×${targetMap.height} 로 이미 충분하다 — 크기는 그대로 두고 안에서 고쳐라.`;
    }
    const width = Math.max(targetMap.width, size.width);
    const height = Math.max(targetMap.height, size.height);
    return `${head} 대상 맵 '${targetMap.id}' 은 ${targetMap.width}×${targetMap.height} 로 부족하다. `
      + `resize_map({mapId:"${targetMap.id}", width:${width}, height:${height}}) 를 먼저 호출해 키운 뒤 시공하라 — `
      + `좌상단 기준 확장이라 기존 타일·이벤트는 그대로고 늘어난 칸만 잔디가 된다. 요청한 수량을 줄여 기존 크기에 우겨넣지 말 것.`;
  }
  return `${head} 새 맵이면 이 크기를 그대로 써라 — author_village(target:{kind:"new", width:${size.width}, height:${size.height}}) 또는 create_map 에 같은 값을 넣는다.`;
}

export function formatIntentNote(
  intent: IntentDeclaration,
  options: { readonly clarifyBypassed?: boolean; readonly targetMap?: IntentNoteTargetMap | null } = {},
): string | null {
  if (intent.source !== "llm") return null;
  const lines: string[] = [];
  if (intent.adventure) lines.push(ADVENTURE_AUTHORING_GUIDE);
  if (intent.actionCombat) lines.push(`[액션 완료 계약] 대상 ${JSON.stringify(intent.actionCombat.targets)}의 필드 전투를 run_action_combat_test로 검증하라. wait/스폰 장면 검사와 턴제 시뮬은 액션 증거가 아니며 계획 교체·수리로 이 의무를 지울 수 없다.`);
  if (intent.statefulNpcs) lines.push("[NPC 완료 계약] 명시적으로 요청된 상태별 NPC 행동을 구현하라. 일반 안내 NPC까지 다중 페이지로 확대하지 않는다.");
  if (intent.referenceWork) lines.push(`[참조 작품] 사용자가 지목한 작품: "${intent.referenceWork}". 설계 전에 web_search 로 그 작품의 분위기·장소·직업·사건 구조를 확인하라. 모델 암기로 추정하지 말고 검색으로 사실을 고정한 뒤, 그 분위기를 장르·색·구성에 옮겨 담는다. 고유명사(인물·지명·마법 이름)는 그대로 쓰지 않는다 — 새 이름을 짓고 분위기만 가져온다.`);

  if (intent.functionalAcceptance) lines.push(`[Functional acceptance contract] ${JSON.stringify(intent.functionalAcceptance)}. Immutable request expectations; real engine behavior on applied content decides completion, not images or success prose.`);
  if (intent.npcRewards) {
    lines.push(`[NPC reward contract] ${JSON.stringify(intent.npcRewards)} — preserve these request expectations. Verify real interaction goldDelta for currency and inventory/owned-monster deltas for items/monsters; inventoryDelta.gold is only an item ID, never currency. Author currency with native changeGold, not an invented gold item. Text, switches and changeParty are not grants. For oneTime, interact again in the SAME session with runtime page re-selection and prove zero additional gold/item/monster rewards. Do not remove grants or weaken this contract to complete. give_starter_monsters can author a guarded starter choice event.`);
  }
  if (intent.readBeforeWrite) {
    lines.push(`[조회 선행 계약] 첫 쓰기 전에 ${intent.readBeforeWrite.project ? "get_project_summary와 대상 get_map_region, find_events, " : ""}${intent.readBeforeWrite.collections.map((name) => `get_database_records(collection:"${name}")`).join(", ")}를 성공시켜 반환값을 읽어라. 기존 DB 수정은 include:"full", ids:[실제 ID]로 원본을 확인한다. 새 레코드도 참조 전에 다시 조회한다. 조회 실패와 같은 응답의 쓰기는 실행되지 않는다.`);
  }
  if (intent.clarify && options.clarifyBypassed) {
    lines.push(`[의도] 모호한 점: ${intent.clarify} — 자율 모드라 되묻지 않는다. 가장 그럴듯한 해석으로 진행하고 첫 문장에 어느 쪽을 택했는지 밝혀라.`);
  }
  if (intent.mode === "question") {
    lines.push("[의도] 질문·조회다. 프로젝트를 바꾸지 말고 조회 툴로 답한다.");
  } else if (intent.mode === "modify") {
    const target = intent.targetMapId ? `대상 맵은 \`${intent.targetMapId}\` 이다.` : "대상은 지금 열린 맵의 기존 산출물이다.";
    lines.push(
      `[의도] 있는 것을 고치는 요청이다. ${target} get_map_region/find_layout_regions 로 현재 상태를 먼저 보고 그 자리에서 고친다. `
      + "create_map·duplicate_map·author_village(kind:\"new\") 로 새것을 만들지 말 것. 기존 실내 맵은 같은 mapId 로 build_hand_interior_room(replace:true).",
    );
  } else if (intent.mode === "create" && !intent.clarify) {
    const facilityHow = intent.facility
      ? `시설 「${intent.facility}」는 참고문서 「손 도트 실내 (v5)」의 가까운 예제를 읽고 규모·방 구성을 정한 plan 을 build_hand_interior_room 으로 새 mapId 에 시공한다`
      : null;
    if (intent.space === "both") {
      const how = facilityHow
        ?? "들어가서 걷는 집이면 author_house(interior:\"linked-interior\") 한 번으로 외장+실내+양방향 전이를 짓는다";
      lines.push(
        `[의도] 야외 외장과 실내 둘 다이다. ${how}. 이미 확인된 의도이므로 야외/실내를 다시 묻지 말고 진행하라.`,
      );
    } else if (intent.space === "interior") {
      const how = facilityHow ?? "참고문서 「손 도트 실내 (v5)」를 읽고 build_hand_interior_room(plan, 새 mapId)으로 실내를 시공한다(벽·천장 자동, 가구는 v5 id)";
      lines.push(
        `[의도] 실내 시공이다(외장 없는 독립 실내). ${how}. 외장과 함께 짓는 들어가서 걷는 집이면 author_house(interior:"linked-interior")가 정답이다. `
        + "이미 확인된 의도이므로 야외/실내를 다시 묻지 말고 진행하라.",
      );
    } else if (intent.space === "outdoor") {
      lines.push("[의도] 지금 맵 위 야외 시공이다(author_house/author_village/fill_region/place_props; 대상 맵이 버들항 계열이면 마을은 author_beodeul_town). 집은 author_house(interior:\"linked-interior\")가 기본이다 — 실내맵과 양방향 전이가 함께 생긴다. 겉모습만 필요하면 명시적으로 interior:\"exterior-only\". 독립 실내 세션은 만들지 말 것. 이미 확인된 의도이므로 되묻지 말고 진행하라.");
    }
  }
  const constructionNote = formatConstructionNote(intent, options.targetMap ?? null);
  if (constructionNote) lines.push(constructionNote);
  return lines.length > 0 ? lines.join("\n") : null;
}
