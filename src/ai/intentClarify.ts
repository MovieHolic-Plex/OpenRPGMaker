// ai/intentClarify.ts
// 쓰기 툴 전에 결정론으로 "집(야외 외장) vs 실내 맵" 같은 의도 충돌을 잡는다.
// LLM 프롬프트만으로는 audit 18처럼 추측 실행이 반복되므로, 매칭 스킬이 없거나
// 집/실내 표지가 부족하면 도구 호출 없이 한 번 되묻는다.

import { QUICK_REPLY_MARKER } from "@/ai/interviewPrompt";
import { listDefaultSkills, type SkillDef } from "@/ai/skills";

export type IntentClarifyKind = "house-vs-interior";

export interface IntentClarifyOption {
  readonly id: string;
  readonly label: string;
}

export interface IntentClarifyResult {
  readonly kind: IntentClarifyKind;
  readonly question: string;
  readonly options: readonly IntentClarifyOption[];
  /** 감사/로그용 — 왜 물어봤는지. */
  readonly reason: string;
}

export interface SkillTextMatch {
  readonly skillId: string;
  readonly name: string;
  readonly score: number;
}

export interface IntentClarifyOptions {
  /** 스킬 서랍/슬래시로 이미 고른 스킬 id — 있으면 그 경로를 신뢰하고 되묻지 않는다. */
  readonly explicitSkillId?: string | null;
  /** 테스트 주입용 스킬 목록(기본 listAllSkills). */
  readonly skills?: readonly SkillDef[];
}

const HOUSE_VS_INTERIOR_OPTIONS: readonly IntentClarifyOption[] = [
  { id: "interior", label: "실내 맵으로" },
  { id: "outdoor", label: "야외 집(외장)으로" },
  { id: "both", label: "외장 집 + 내부 둘 다" },
];

/** 스킬 킥오프·영역 작업 합성 문장 — 이미 경로가 정해진 긴 지시. */
const PROTOCOL_LOCKED_RE =
  /영역 작업 도구 규칙|실내 맵을 새로 지어주세요|현재 맵\([^)]*\)에 집을 지어주세요|villager-room-v1|start_interior_room_session|build_house_kit을 우선|절차\(준수/u;

const INTERIOR_MARKERS = [
  "실내", "인테리어", "실내맵", "실내 맵", "방 맵", "방맵",
  "interior", "침실", "서재", "주방", "선술집", "객실",
] as const;

const OUTDOOR_MARKERS = [
  "야외", "외장", "바깥", "옥외", "필드에", "거리에", "마을에 집", "맵 위에",
  "지붕 있는 집", "외관",
] as const;

const BOTH_MARKERS = ["둘 다", "내부까지", "안까지", "외장 집 +", "집 + 내부"] as const;

// 스킬 텍스트 매칭용 — id별 강한 단서(이름/설명 보조).
const SKILL_MATCH_HINTS: Readonly<Record<string, readonly string[]>> = {
  "build-house": ["집 짓", "집짓", "야외 집", "외장", "build-house", "house kit"],
  "build-interior": ["실내", "인테리어", "방 시공", "build-interior", "interior"],
  "build-dungeon": ["던전", "dungeon", "동굴", "용암 방", "얼음 동굴", "석재 홀"],
  "build-village": ["마을", "village"],
  "build-road": ["도로", "길 깔", "길 만들"],
  "place-npcs": ["npc", "주민"],
  "quest-builder": ["퀘스트"],
};

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
}

function includesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(normalize(needle)));
}

/** '수집/편집' 안의 '집' 오탐을 피하면서 집·건물 요청을 잡는다. */
export function requestMentionsHouseLike(text: string): boolean {
  const n = normalize(text);
  if (!n) return false;
  if (/(?:^| )(?:건물|오두막|여관|대장간|주택|가옥|별장|저택)(?: |$|을|이|에|은|도|한|을|를)/u.test(n)) return true;
  if (/(?:건물|오두막|여관|대장간|주택|가옥|별장|저택).{0,8}(?:만들|지|생성|하나)/u.test(n)) return true;
  if (/(?:만들|지|생성|하나).{0,8}(?:건물|오두막|여관|대장간|주택)/u.test(n)) return true;
  // 집 + 조사/동사 (수집·편집 제외)
  if (/수집|편집|직접\s*집/u.test(n) && !/집\s*(?:을|이|에|은|도|하나|채)|(?:을|이|에|은)\s*집/u.test(n)) {
    return false;
  }
  return (
    /(?:^|[^\uac00-\ud7a3])집(?:을|이|에|은|도|만|과|를|한|을| |$)/u.test(n)
    || /집\s*(?:하나|1\s*채|두\s*채|지어|만들|생성|시공)/u.test(n)
    || /(?:지어|만들|생성|시공).{0,10}집/u.test(n)
    || /집.{0,10}(?:지어|만들|생성|시공|하나)/u.test(n)
  );
}

export function requestMentionsInterior(text: string): boolean {
  return includesAny(normalize(text), INTERIOR_MARKERS);
}

export function requestMentionsOutdoorHouse(text: string): boolean {
  return includesAny(normalize(text), OUTDOOR_MARKERS);
}

export function requestMentionsBothHousePaths(text: string): boolean {
  const n = normalize(text);
  if (includesAny(n, BOTH_MARKERS)) return true;
  if (/아니라|말고|대신/u.test(n)) return false;
  const requestsMultipleOutdoorHouses = /집\s*(?:\d+|한|두|세)\s*채/u.test(n);
  return requestsMultipleOutdoorHouses && requestMentionsInterior(n) && requestMentionsOutdoorHouse(n);
}

function isProceedOrAnswerLike(text: string): boolean {
  const n = normalize(text);
  if (!n) return false;
  if (/(?:진행해|진행하라고|계속해|계속 진행|그대로 해|오케이 진행|ok 진행)/u.test(n)) return true;
  // 직전 선택지 답변
  if (includesAny(n, HOUSE_VS_INTERIOR_OPTIONS.map((option) => option.label))) return true;
  if (requestMentionsBothHousePaths(n)) return true;
  if (requestMentionsOutdoorHouse(n) && !requestMentionsHouseLike(n) && n.length < 40) return true;
  if (requestMentionsInterior(n) && !requestMentionsHouseLike(n) && n.length < 40) return true;
  return false;
}

function isProtocolLocked(text: string): boolean {
  return PROTOCOL_LOCKED_RE.test(text);
}

/** 자유 텍스트와 스킬 레지스트리의 느슨한 점수 매칭(슬래시 필터보다 약함).
 *  기본 후보는 advanced 를 뺀 목록 — 사용자가 부르지도 않은 저작 도구를 추천하지 않는다. */
export function rankSkillsForText(text: string, skills: readonly SkillDef[] = listDefaultSkills()): SkillTextMatch[] {
  const n = normalize(text);
  if (!n) return [];
  const scored: SkillTextMatch[] = [];
  for (const skill of skills) {
    let score = 0;
    const name = normalize(skill.name);
    const desc = normalize(skill.description);
    const id = normalize(skill.id);
    if (name && n.includes(name)) score += 5;
    if (id && n.includes(id)) score += 4;
    for (const token of name.split(/[\s·/]+/u).filter((part) => part.length >= 2)) {
      if (n.includes(token)) score += 2;
    }
    for (const hint of SKILL_MATCH_HINTS[skill.id] ?? []) {
      if (n.includes(normalize(hint))) score += 3;
    }
    // 설명 전체 포함은 드묾 — 설명의 핵심 2글자 이상 토큰 1개만 가점
    for (const token of desc.split(/[\s,./·—-]+/u).filter((part) => part.length >= 2).slice(0, 8)) {
      if (n.includes(token)) {
        score += 1;
        break;
      }
    }
    if (score > 0) scored.push({ skillId: skill.id, name: skill.name, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.skillId.localeCompare(b.skillId));
}

export function topSkillMatches(matches: readonly SkillTextMatch[], minScore = 3): SkillTextMatch[] {
  if (matches.length === 0) return [];
  const best = matches[0]!.score;
  if (best < minScore) return [];
  return matches.filter((match) => match.score >= minScore && match.score >= best - 1);
}

/**
 * 도구 호출 전에 되물어야 하면 결과, 아니면 null.
 * - 명시 스킬(build-house / build-interior) 또는 킥오프 프로토콜 문장은 신뢰.
 * - 실내/야외/둘 다 표지가 있으면 경로 확정.
 * - "집/건물 만들어"만 있고 표지 없으면 항상 되묻기(스킬 이름 매칭만으로 야외 추정 금지).
 * - 집 계열 요청인데 매칭 스킬이 0개이거나 build-house+build-interior가 동점이면 되묻기.
 */
/** 던전 방 요청 표지 — 있으면 집/실내 되묻기 없이 dungeon-room-v1로 직행. */
function requestMentionsDungeon(raw: string): boolean {
  const n = normalize(raw);
  return /던전|dungeon|동굴|미궁/u.test(n) || /용암\s*방|석재\s*홀/u.test(n);
}

export function resolveIntentClarification(
  text: string,
  options: IntentClarifyOptions = {},
): IntentClarifyResult | null {
  const raw = text.trim();
  if (!raw) return null;
  if (isProtocolLocked(raw)) return null;
  if (isProceedOrAnswerLike(raw)) return null;

  const explicit = options.explicitSkillId?.trim() || null;
  if (explicit === "build-house" || explicit === "build-interior") return null;
  if (explicit === "build-dungeon") return null;

  // 던전(dungeon-room-v1) 요청은 집/실내 되묻기 대상이 아니다 — 전용 하네스로 직행.
  if (requestMentionsDungeon(raw)) return null;

  const hasInterior = requestMentionsInterior(raw);
  const hasOutdoor = requestMentionsOutdoorHouse(raw);
  const hasBoth = requestMentionsBothHousePaths(raw);
  const hasHouse = requestMentionsHouseLike(raw);

  if (hasBoth) return null;
  if (hasInterior && hasOutdoor) {
    // 표지가 서로 모순이면 물어본다.
    return houseVsInteriorClarify("실내·야외 표지가 동시에 있어 경로를 확정할 수 없음");
  }
  if (hasInterior) return null; // 실내 경로 확정
  if (hasOutdoor) return null; // 야외 경로 확정

  const n = normalize(raw);
  // 맵 위 다수 채 + NPC/마을 맥락은 야외 배치로 확정(실내 맵 3개를 의미하는 경우는 드묾).
  if (
    hasHouse
    && !hasInterior
    && (
      (/\d+\s*채/u.test(n) && /(?:npc|주민|마을)/u.test(n))
      || (/\d+\s*[x×]\s*\d+/u.test(n) && /\d+\s*채/u.test(n))
      || /(?:작은\s*)?마을/.test(n) && /집/u.test(n)
    )
  ) {
    return null;
  }

  const skills = options.skills ?? listDefaultSkills();
  const ranked = rankSkillsForText(raw, skills);
  const top = topSkillMatches(ranked);

  // "집 만들어줘" — 스킬 이름에 집이 걸려도 실내/외장 미확정.
  if (hasHouse && !hasInterior && !hasOutdoor) {
    return houseVsInteriorClarify("집·건물 요청에 실내/야외 표지 없음");
  }

  const topIds = new Set(top.map((match) => match.skillId));
  if (topIds.has("build-house") && topIds.has("build-interior")) {
    return houseVsInteriorClarify("집 짓기·실내 방 시공 스킬이 동시에 매칭");
  }

  // 만들/지어 류인데 스킬 매칭 전무 + 구조물 암시 약함 → 일반 저정보는 프롬프트 정책에 맡김.
  // 단, "방 하나 만들어"처럼 방만 있고 실내 마커가 약한 경우(방은 INTERIOR에 침실 등만).
  if (/(?:^| )방(?:을|이|에|은| |$)/u.test(normalize(raw)) && /(?:만들|지|생성|시공|하나)/u.test(normalize(raw))) {
    if (!hasInterior && !hasOutdoor) {
      return houseVsInteriorClarify("방 요청에 실내/야외 표지 없음");
    }
  }

  if (top.length === 0 && hasHouse) {
    return houseVsInteriorClarify("집 계열 요청인데 매칭 스킬 없음");
  }

  return null;
}

function houseVsInteriorClarify(reason: string): IntentClarifyResult {
  return {
    kind: "house-vs-interior",
    reason,
    question:
      "집/건물을 어떻게 만들까요? 마을 맵 위 **야외 외장**인지, 들어가서 걷는 **실내 맵**인지에 따라 도구가 달라요.",
    options: HOUSE_VS_INTERIOR_OPTIONS,
  };
}

/** 채팅에 넣을 최종 문장(+ 원탭 선택지). */
export function formatIntentClarifyMessage(clarify: IntentClarifyResult): string {
  const labels = clarify.options.map((option) => option.label).join(" | ");
  return [
    clarify.question,
    "원하시는 쪽을 골라 주시면 그에 맞춰 바로 진행할게요.",
    `${QUICK_REPLY_MARKER} ${labels}`,
  ].join("\n");
}

export function isIntentClarifyMessage(text: string): boolean {
  const n = text.trim();
  if (!n.includes(QUICK_REPLY_MARKER)) return false;
  return /실내 맵으로|야외 집\(외장\)으로|외장 집 \+ 내부/.test(n);
}
