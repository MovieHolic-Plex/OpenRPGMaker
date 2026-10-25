// editor/assetStore/reviewDigest.ts
// 조수 store_game_reviews 가 쓰는 평가 정리(순수 함수). 위키: openwiki/asset-store.md 「조수와 평가」.
// 비추천·「도움 됨」 많이 받은 불만 글을 낱말로 주제에 묶는다. 모델이 수십 개 글을 통째로 읽지 않고 무엇이 반복되는지 먼저 보게 한다.

import type { StoreReview, StoreReviewLabel, StoreReviewTally } from "@/assetStore/bridgeTypes";

/** 스토어 화면과 같은 요약 라벨(한국어). */
export const REVIEW_LABEL_TEXT: Readonly<Record<StoreReviewLabel, string>> = {
  none: "평가 없음", few: "평가 부족",
  overwhelmingly_positive: "압도적으로 긍정적", very_positive: "매우 긍정적", positive: "긍정적", mostly_positive: "대체로 긍정적",
  mixed: "복합적", mostly_negative: "대체로 부정적", negative: "부정적", very_negative: "매우 부정적", overwhelmingly_negative: "압도적으로 부정적",
};

/** 불만 주제. words 는 한·영·일 낱말 — 하나라도 맞으면 그 주제로 센다(한 글이 여러 주제에 들 수 있다). */
export const COMPLAINT_THEMES: readonly { readonly id: string; readonly label: string; readonly words: RegExp }[] = [
  { id: "bug", label: "버그·오류", words: /버그|오류|에러|튕|멈춰|멈춤|먹통|안\s*넘어|진행\s*불가|막혀서|크래시|bug|crash|freez|stuck|broken|glitch|バグ|フリーズ|進めない/iu },
  { id: "save", label: "저장", words: /저장|세이브|날아갔|초기화|save|progress\s*lost|セーブ/iu },
  { id: "difficulty", label: "전투·난이도", words: /난이도|어려|너무\s*쎄|너무\s*세|보스|전투|몬스터|레벨\s*업|노가다|파밍|밸런스|difficult|too\s*hard|grind|boss|battle|balance|難し|戦闘|ボス/iu },
  { id: "controls", label: "조작·휴대폰", words: /조작|키\s*입력|버튼|터치|모바일|휴대폰|폰에서|스마트폰|패드|control|touch|mobile|phone|keyboard|gamepad|操作|スマホ/iu },
  { id: "navigation", label: "길찾기·목표", words: /길을?\s*(못|모르|잃)|어디로|헤맸|헤매|목표|뭘\s*해야|힌트|lost|where\s*to\s*go|objective|hint|confus|迷/iu },
  { id: "length", label: "분량", words: /짧|금방\s*끝|분량|볼륨|미완성|끝이\s*없|short|too\s*brief|unfinished|incomplete|短い|未完/iu },
  { id: "pacing", label: "속도·지루함", words: /느리|느려|답답|지루|늘어|길어서|반복|loading|로딩|slow|boring|tedious|repetitive|遅い|退屈/iu },
  { id: "story", label: "이야기·대사", words: /스토리|이야기|대사|전개|개연성|캐릭터|오타|맞춤법|story|plot|dialog|writing|typo|character|ストーリー|シナリオ|誤字/iu },
  { id: "visual", label: "그래픽·화면", words: /그래픽|그림|도트|화면|글씨\s*(가|이)?\s*작|해상도|깨져|graphic|visual|sprite|art|resolution|screen|グラフィック|画面/iu },
  { id: "audio", label: "음악·소리", words: /음악|소리|브금|bgm|효과음|사운드|music|sound|audio|音楽|サウンド/iu },
  { id: "language", label: "글자·번역", words: /번역|영어|한국어|일본어|외국어|글자\s*깨|translation|language|english|korean|翻訳|日本語/iu },
];

export interface ReviewBrief {
  readonly id: number; readonly recommended: boolean; readonly body: string; readonly version: string | null;
  readonly helpful: number; readonly funny: number; readonly author: string; readonly at: string; readonly replied: boolean;
}
export interface ComplaintTheme { readonly id: string; readonly label: string; readonly count: number; readonly helpful: number; readonly reviewIds: number[]; readonly quotes: string[] }

const clip = (text: string, max: number): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

export const tallyText = (tally: StoreReviewTally): string =>
  tally.total ? `${REVIEW_LABEL_TEXT[tally.label] ?? tally.label} (${tally.total}개 중 ${tally.pct}% 추천)` : "평가 없음";

export function briefReview(review: StoreReview, max = 400): ReviewBrief {
  return {
    id: review.id, recommended: review.recommended, body: clip(review.body, max), version: review.version,
    helpful: review.helpful, funny: review.funny, author: review.author, at: review.createdAt.slice(0, 10), replied: Boolean(review.reply?.text),
  };
}

/**
 * 불만 주제 묶기. 비추천 글은 전부, 추천 글은 아쉬움 표현(「다만」「아쉬」「but」…)이 있을 때만 센다.
 * 「도움 됨」이 많은 글일수록 무겁게 본다(정렬 helpful 합).
 */
export function complaintThemes(reviews: readonly StoreReview[], limit = 6): ComplaintTheme[] {
  const caveat = /다만|아쉬|아쉽|하지만|그런데|그러나|단점|불편|but\b|however|wish|downside|残念|ただ/iu;
  const buckets = new Map<string, { label: string; ids: number[]; helpful: number; quotes: { text: string; weight: number }[] }>();
  for (const review of reviews) {
    if (review.recommended && !caveat.test(review.body)) continue;
    for (const theme of COMPLAINT_THEMES) {
      const match = theme.words.exec(review.body);
      if (!match) continue;
      const bucket = buckets.get(theme.id) ?? { label: theme.label, ids: [], helpful: 0, quotes: [] };
      bucket.ids.push(review.id);
      bucket.helpful += review.helpful;
      const start = Math.max(0, match.index - 50);
      bucket.quotes.push({ text: clip(`${start > 0 ? "…" : ""}${review.body.slice(start, match.index + 90)}`, 150), weight: review.helpful + (review.recommended ? 0 : 1) });
      buckets.set(theme.id, bucket);
    }
  }
  return [...buckets.entries()]
    .map(([id, bucket]) => ({
      id, label: bucket.label, count: bucket.ids.length, helpful: bucket.helpful, reviewIds: bucket.ids.slice(0, 12),
      quotes: bucket.quotes.sort((a, b) => b.weight - a.weight).slice(0, 3).map((quote) => quote.text),
    }))
    .sort((a, b) => b.count - a.count || b.helpful - a.helpful)
    .slice(0, limit);
}

/** 두 쪽(최근·도움 됨)을 id 로 합친다. */
export function mergeReviews(...pages: readonly (readonly StoreReview[])[]): StoreReview[] {
  const byId = new Map<number, StoreReview>();
  for (const page of pages) for (const review of page) if (!byId.has(review.id)) byId.set(review.id, review);
  return [...byId.values()];
}
