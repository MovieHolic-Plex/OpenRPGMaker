// allow: SIZE_OK - data table
import { FAMILY, type Strings } from "../core.ts";

export const METRIC_NOTES = {
  sentenceMeanChars: "사람 에세이 중앙값 31자, AI 56자. 알림만: 벤치에서는 위키·외부 블로그 같은 사람 글이 AI 글보다 길었다",
  sentenceLengthCv: "사람 0.56-0.90, 0.52 미만이면 길이가 한 구간에 몰려 토막 낭독처럼 읽힌다",
  midBandShare: (low: number, hi: number): string =>
    `${low}~${hi}자 문장 비율: 사람 글 0.39-0.50, 토막난 초안 0.71-0.76. 넘으면 초단문과 장문을 섞는다`,
  longSentenceShare:
    "80자+ 문장 비율: 챗봇 칼럼 0, 사람 에세이 중앙값 2%(8/23편은 0), 신문 칼럼 9%. 장문 부재 알림(점수 미반영): 평균 30-50자면 인접 문장을 이어 하나 만든다",
  longSentenceTellShare: (total: number, hit: number): string =>
    `80자+ 문장 ${total}개 중 중·고위험 티가 있는 문장 ${hit}개: 벤치 사람 글 중앙값 0.14-0.32, AI 보고서 0.67. 넘으면 장문을 사건 연결로 다시 쓴다(명사 나열·대구·재정의 금지)`,
  shortSentenceShare:
    "15자 이하(합니다·해요체 글은 18자 이하) 문장 비율: 사람 에세이 23편 전부 10% 이상(중앙값 23%), 챗봇 칼럼·에이전트 문서는 미달이 흔함",
  sameEndingRun3Share: "같은 어미 3연속 비율(합니다·해요체는 '니다'·'요' 앞 음절까지 본다): 사람 3.8%, AI 산문 14%",
  topEndingShare: "한 어미 점유율: GPT 채팅 85%",
  typographyPer1k:
    "타이포 티(대시·가운뎃점·콜론 라벨·굵게) 1천 자당 건수: 벤치 사람 글 최대 2.78, AI 장문 중앙값 7.6, 에이전트 메시지 12.0",
  paraConnectiveRepeat: (word: string): string => `문단 첫 접속어 반복 '${word}'`,
  negRedefinePer2k: "A가 아니라 B 밀도: 사람 에세이 0.5/2K, 짧은 글은 1회로도 튐",
  bulletLineRatio: (bullets: number, headings: number): string => `불릿 ${bullets}줄, 소제목 ${headings}개`,
  onelinerParaRatio: "한 줄 문단 비율: 사람 61%, AI 30-48% (낮으면 밋밋)",
  questionRatio: "의문문 비율: 사람 에세이는 자문이 잦다",
  paraMultiSentenceShare: (multi: number, total: number): string =>
    `3문장 이상 문단 ${multi}/${total}: 벤치 fit 사람 블로그 최대 0.69, 걸린 AI 초안 0.86-1.0. 웹 글은 문단당 1~2문장이 읽기 쉽다`,
  ledeSentences:
    "리드 첫 문단의 문장 수: 블로그 기준 1~2문장(방법·숫자·판정을 네 문장에 쌓은 리드는 너무 길다). 넘으면 리드는 알게 될 것 한 가지만 남기고 나머지는 본문으로",
  ledeAssertionDensity:
    "리드(제목 직후 ~800자)에서 주장 문장(사실·결론·측정 결과)의 비율: 사람의 기술 글은 리드에서 독자의 '그래서 뭔데'를 풀어 주고, AI 산문은 배경·방법론으로 시작해 결론이 뒤에 온다. 0.3 미만이면 리드가 거의 전부 준비 서술",
  metaphorCallbackMax: (word: string): string =>
    `같은 비유 매개체('${word}') 반복 횟수: 사람 에세이 47편은 최대 1회, AI 장문 302편은 상위 10%가 3회 이상. 비유는 한 번 소개, 한 번 회귀까지`,
  quotedEmphasisPer1k:
    '발화 표지 없는 짧은 따옴표 강조("개념어") 1천 자당 건수: 사람 밀리 49편 최대 0.83, 에이전트 산문 p90 2.1. 알림만: 개념어 따옴표는 첫 등장 한 번만, 인용과 강조를 구분한다',
  obligationEndingParagraphs:
    "당위('~해야 한다')로 끝나는 문단 수: 외부 실측(im-not-ai 24쌍)에서 AI 문단의 20%가 당위 결말, 이 코퍼스(에이전트·밀리)에서는 분리 안 됨. 알림만: 2개 이상이면 첫 문단만 두고 나문지는 당위 문장을 문단 앞·중간으로 옮긴다(삭제·병합·서법 바꾸기 금지)",
} as const;

export const STRINGS: Strings = {
  familyLabels: {
    [FAMILY.NEG_REDEFINE]: "부정재정의",
    [FAMILY.AUTHORITY_NOUN]: "권위명사",
    [FAMILY.METAPHOR_NOUN]: "은유명사",
    [FAMILY.PERSONIFY]: "사물의인화",
    [FAMILY.ENUM_ANNOUNCE]: "열거예고",
    [FAMILY.META_GUIDE]: "메타안내",
    [FAMILY.TAKEAWAY]: "한줄요약",
    [FAMILY.CLOSING_OFFER]: "말미제안",
    [FAMILY.HEDGE_TAIL]: "여운헤지",
    [FAMILY.TRANSLATIONESE]: "번역투",
    [FAMILY.STOCK_PHRASE]: "상투구",
    [FAMILY.BANNED_WORD]: "금지어",
    [FAMILY.MODEL_TIC]: "모델틱",
    [FAMILY.TYPOGRAPHY]: "기호",
    [FAMILY.APHORISM]: "격언착지",
    [FAMILY.FORCED_ANALOGY]: "억지비유",
  },
  verdicts: {
    pass: "통과: 문장 단위 손질만",
    fix: "손보기: 표시된 문장 재작성 + 리듬 조정",
    rewrite: "재작성: 전개부터 다시",
  },
  headerHits: "## 문장 단위 목록",
  headerFamilies: "## 패턴 가족별 건수",
  headerMetrics: "## 전개/리듬 지표",
  thresholdWord: "기준",
  jev: {
    header: "## Jev 판단",
    sentences: "문장",
    gate: "게이트",
    dismissed: "정규식 히트 해제",
    overall: "종합 판정",
    degraded: "로컬 규칙만, Jev 채점 실패",
    dominant: "한 가족이 점수의 60% 이상(개인 습관일 수 있어 재작성 판정을 손보기로 낮추었다)",
  },
};
