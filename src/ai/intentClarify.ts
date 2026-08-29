// ai/intentClarify.ts
// 쓰기 툴 전에 결정론으로 "집(야외 외장) vs 실내 맵" 같은 의도 충돌을 잡는다.
// LLM 프롬프트만으로는 audit 18처럼 추측 실행이 반복되므로, 집/실내 표지가
// 부족하면 도구 호출 없이 한 번 되묻는다. 판정은 자유 텍스트 휴리스틱뿐이다
// (조수 스킬 레지스트리 랭킹은 스킬 기능과 함께 제거됐다).

import { QUICK_REPLY_MARKER } from "@/ai/interviewPrompt";
import { requestLikelyModifiesExisting } from "@/ai/modifyIntent";

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

/**
 * 건물 명사가 **직업 이름의 일부**로 쓰인 자리 — "여관 주인", "대장간 주인", "상점 점원".
 * 이건 사람 배치 요청이고 시공 요청이 아니다. 실측: 골든 태스크 inn
 * ("빈 프로젝트에 마을 맵을 하나 만들고, 15G에 숙박시키는 여관 주인 NPC를 배치해줘")이
 * "야외 외장이냐 실내 맵이냐"로 되물어져 툴이 한 번도 돌지 않고 턴이 끝났다.
 */
const BUILDING_AS_ROLE_RE =
  /(?:여관|대장간|상점|주점|선술집|가게|방앗간|목장)\s*(?:주인|주민|상인|점원|아저씨|아줌마|누나|형|npc|주방장|마스터)/gu;

/** '수집/편집' 안의 '집' 오탐을 피하면서 집·건물 요청을 잡는다. */
export function requestMentionsHouseLike(text: string): boolean {
  const n = normalize(text).replace(BUILDING_AS_ROLE_RE, " ");
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

export function isProtocolLocked(text: string): boolean {
  return PROTOCOL_LOCKED_RE.test(text);
}

/**
 * 도구 호출 전에 되물어야 하면 결과, 아니면 null.
 * - 킥오프 프로토콜 문장은 신뢰.
 * - 실내/야외/둘 다 표지가 있으면 경로 확정.
 * - "집/건물 만들어"만 있고 표지 없으면 항상 되묻기.
 */
/** 던전 방 요청 표지 — 있으면 집/실내 되묻기 없이 dungeon-room-v1로 직행. */
function requestMentionsDungeon(raw: string): boolean {
  const n = normalize(raw);
  return /던전|dungeon|동굴|미궁/u.test(n) || /용암\s*방|석재\s*홀/u.test(n);
}

export function resolveIntentClarification(text: string): IntentClarifyResult | null {
  const raw = text.trim();
  if (!raw) return null;
  if (isProtocolLocked(raw)) return null;
  if (isProceedOrAnswerLike(raw)) return null;

  // 던전(dungeon-room-v1) 요청은 집/실내 되묻기 대상이 아니다 — 전용 하네스로 직행.
  if (requestMentionsDungeon(raw)) return null;

  // **수정 요청은 되묻지 않는다.** "이 집 좀 고쳐줘" 에 "야외 외장이냐 실내 맵이냐"를 물으면
  // 대상이 이미 존재하는데 새로 만들 종류를 고르라는 질문이 된다 — 어느 쪽을 골라도 신규
  // 시공 경로로 들어간다(2026-08-29 modify 진단 근본원인 4). 고칠 대상은 이미 정해져 있다.
  if (requestLikelyModifiesExisting(raw)) return null;

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

  // "집 만들어줘" — 실내/외장 미확정.
  if (hasHouse && !hasInterior && !hasOutdoor) {
    return houseVsInteriorClarify("집·건물 요청에 실내/야외 표지 없음");
  }

  // 만들/지어 류인데 구조물 암시가 약하면 일반 저정보는 프롬프트 정책에 맡김.
  // 단, "방 하나 만들어"처럼 방만 있고 실내 마커가 약한 경우(방은 INTERIOR에 침실 등만).
  if (/(?:^| )방(?:을|이|에|은| |$)/u.test(normalize(raw)) && /(?:만들|지|생성|시공|하나)/u.test(normalize(raw))) {
    if (!hasInterior && !hasOutdoor) {
      return houseVsInteriorClarify("방 요청에 실내/야외 표지 없음");
    }
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
