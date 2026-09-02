// ai/modifyIntent.ts
// "기존 산출물을 고치라"는 요청인지 판정하는 단일 축(2026-08-29 modify 진단).
//
// 배경: 의도 분류 테이블 3개 — assistantToolMode.INTENT_KEYWORDS,
// regionIntentRouter.REGION_INTENT_KEYWORDS, intentClarify — 가 전부
// "무엇을 만들 것인가"(도메인·주제어) 축으로만 설계돼 "만들 것인가 고칠 것인가" 축이
// 아예 없었다. 그래서 "이 침실 좀 고쳐줘"가 "침실을 새로 시공하라"와 같은 경로를 탔고,
// 실내 경로에서는 기존 맵이 빈 방으로 교체됐다. 이 모듈이 그 축을 제공하고
// 소비자(영역 라우터·도메인 스캐너·되묻기·플래너 폴백·완료 게이트)가 공유한다.
//
// 순수 함수만 둔다(브라우저/스토어 접근 금지) — 툴 계층과 AI 계층이 함께 import 한다.

/** 수정(기존 것을 손본다) 표지. */
export const MODIFY_KEYWORDS: readonly string[] = [
  "수정",
  "고쳐",
  "고치",
  "바꿔",
  "바꾸",
  "변경",
  "개선",
  "다듬",
  "손봐",
  "손보",
  "손질",
  "재배치",
  "조정",
  "교체",
  "정리",
  "넓혀",
  "좁혀",
  "옮겨",
  "옮기",
  // 끊긴 길/담장을 "이어줘" 는 순수 보수 요청인데 위 어휘 중 아무것도 걸리지 않았다.
  // 토큰을 정확히 "이어줘"/"이어 붙" 로 좁혀 둔다("이어서 만들어줘" 는 생성 표지가 이기므로 무해).
  "이어줘",
  "이어 붙",
  "이어붙",
  "지워",
  "삭제",
  "제거",
  "치워",
  "modify",
  "fix",
  "edit",
  "adjust",
  "rework",
  "revise",
  "tweak",
  "improve",
];

/** 신규 생성 표지(명사형 + 동사형). */
export const CREATE_KEYWORDS: readonly string[] = [
  "새로운",
  "새로",
  "새 맵",
  "새맵",
  "새 방",
  "새방",
  "새 마을",
  "새 던전",
  "새 집",
  "신규",
  "만들",
  "만드",
  "지어",
  "지을",
  "짓기",
  "생성",
  "추가",
  "하나 더",
  "한 채 더",
  "create",
  "generate",
  "new map",
];

// 신규 생성 어휘 / 그것을 부정하는 표현. "새로 만들지는 말고", "새 맵은 만들지 마",
// "새 맵 말고 이거 고쳐줘" 를 모두 잡아야 한다. 이 부정 처리를 빼먹으면
// "새로 만들지 말고 지금 있는 것만 손봐줘" 가 생성 요청으로 분류된다(실측 결함).
const CREATE_CUE_FRAGMENT =
  "(?:새로운|새로|새\\s*맵|새\\s*방|새\\s*마을|새\\s*던전|새\\s*집|신규|만들|만드|생성|짓|세우|추가|create|generate)";
// "없이" 는 넣지 않는다 — "새 맵을 벽 없이 만들어줘" 를 생성 부정으로 오판한다.
const NEGATOR_FRAGMENT =
  "(?:지\\s*마|지\\s*말|지\\s*않|하지\\s*마|하지\\s*말|하지\\s*않|필요\\s*없|말고|아니라|빼고|금지)";
const CREATE_NEGATION_RE = new RegExp(`${CREATE_CUE_FRAGMENT}[^\\n]{0,10}?${NEGATOR_FRAGMENT}`);

/** 의도 스캔용 정규화 — NFKC + 소문자 + 구두점 제거 + 공백 1칸. */
function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}_]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `[컨텍스트] …` footer 를 걷어낸다.
 *
 * footer 는 aiChatPanel/runRegionTask 가 붙이는 **기계 생성 텍스트**인데 사용자 발화와 같은
 * 문자열 채널에 실려 온다. 그래서 맵 이름이 도메인 키워드로 오인됐다 — 같은 "여기 좀 고쳐줘"가
 * 맵 이름이 "언덕"일 때와 "호숫가 마을"일 때 다른 툴 집합을 열었다(실측 A/B).
 *
 * 주의: 영역 라우터(routeRegionIntent)는 footer 의 "맵" 을 domainSeed 로 **의도적으로** 쓴다.
 * 이 함수는 수정/생성 의도 스캔과 도메인 스캔에만 적용하고, 영역 라우터에는 적용하지 않는다.
 * LLM 에 보내는 원문 메시지는 언제나 footer 를 포함한 그대로 둔다.
 */
/**
 * 패널이 사용자 발화 뒤에 붙이는 기계 생성 텍스트의 첫 줄 — `buildTurnGuide` 의 「도구 규칙:」/「영역 작업 도구 규칙:」
 * 머리와, 스코프가 있을 때 그 앞에 서는 「(영역 작업: …)」 도메인 시드. 이 줄부터 끝까지가 가이드·스코프 문장·footer 다.
 */
const TURN_GUIDE_START_RE = /^(?:\(영역 작업: |(?:영역 작업 )?도구 규칙:$)/u;

/**
 * 의도 스캔용 사용자 발화만 남긴다 — `[컨텍스트]` footer 와 **턴 가이드 블록** 을 뗀다.
 *
 * 2026-09-03 실측(`/tmp/inn-audit.json`, 「여관 지어줘」): 가이드 문구의 「마을=author_village」「상점 NPC」「주민/NPC」가
 * 그대로 의도 스캔에 들어가 `requestNeedsVolumePlan` 이 참이 되고(volume-contract:forced-plan), 여관을 다 지은 뒤
 * 「상점 +0 (최소 +1)」 로 볼륨 계약이 재주입돼 시작 맵에 마을·NPC 3명·상점을 덤으로 지었다. 공간 요청이면 무엇이든
 * 가이드가 붙으므로 모든 시공 요청이 마을 막대를 받고 있었다(메모리 「볼륨 계약 폭주」의 경로).
 */
export function stripContextFooter(text: string): string {
  const lines = text.split("\n");
  const guideStart = lines.findIndex((line) => TURN_GUIDE_START_RE.test(line.trim()));
  const own = guideStart >= 0 ? lines.slice(0, guideStart) : lines;
  return own
    .filter((line) => !line.trimStart().startsWith("[컨텍스트]"))
    .join("\n")
    .trim();
}

/** footer 의 현재 맵 id(가장 마지막 것). 없으면 null. */
export function contextFooterMapId(text: string): string | null {
  const pattern = /^\[컨텍스트\] 현재 맵: .+? \(([^)]+)\)/gm;
  let found: string | null = null;
  let match = pattern.exec(text);
  while (match !== null) {
    if (match[1] !== undefined) found = match[1];
    match = pattern.exec(text);
  }
  return found;
}

function includesAny(normalized: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => {
    const token = normalize(keyword);
    return token.length > 0 && normalized.includes(token);
  });
}

/** 수정 어휘가 있는가(신규 표지 유무와 무관). */
export function hasModifyCue(text: string): boolean {
  return includesAny(normalize(stripContextFooter(text)), MODIFY_KEYWORDS);
}

/** 신규 생성 어휘가 있는가 — 생성 금지 표현("만들지 마")은 표지로 세지 않는다. */
export function hasCreateCue(text: string): boolean {
  const normalized = normalize(stripContextFooter(text));
  if (CREATE_NEGATION_RE.test(normalized)) return false;
  return includesAny(normalized, CREATE_KEYWORDS);
}

/** 사용자가 명시적으로 "새로 만들지 마"라고 했는가. */
export function forbidsNewCreation(text: string): boolean {
  return CREATE_NEGATION_RE.test(normalize(stripContextFooter(text)));
}

/**
 * 이 요청은 **기존 산출물 수정**인가.
 *
 * 수정 어휘가 있고 신규 표지가 없을 때만 참이다. 둘 다 섞인 요청("집 하나 더 짓고 길도 고쳐줘")은
 * 참이 아니다 — 그런 요청에는 기존 생성 경로가 여전히 필요하므로 보수적으로 판단한다.
 */
export function requestLikelyModifiesExisting(text: string): boolean {
  return hasModifyCue(text) && !hasCreateCue(text);
}

/**
 * 이 요청은 **지목된 기존 대상에** 변경이 남기를 기대하는가(완료 게이트용).
 * 수정 어휘가 있거나 신규 생성이 금지된 요청이면 참.
 *
 * `proposalCompleteness.requestLikelyExpectsChange`(= "쓰기 툴이 하나라도 돌아야 하는 요청인가")
 * 와 이름이 비슷하지만 축이 다르다 — 그쪽은 신규 생성 요청에도 참이다.
 */
export function requestLikelyExpectsExistingChange(text: string): boolean {
  return hasModifyCue(text) || forbidsNewCreation(text);
}
