/**
 * 검열 1단계: 보류 낱말. 상품 글(제목·소개·설명·크레딧·태그·다른 언어판·에셋 이름)에 낱말이 있으면
 * 바로 공개하지 않고 운영자 확인 대기(pending)로 보낸다. 거절이 아니라 보류다 — 잘못 걸려도 운영자가 공개하면 된다.
 * 기본 목록은 저작권(원작 게임·툴 RTP·추출)과 성인물 낱말. STORE_HOLD_WORDS 로 더하고, STORE_HOLD_WORDS_DEFAULTS=0 으로 기본을 끈다.
 */
import type { StorePackManifest } from "../../src/assetStore/format";

export const DEFAULT_HOLD_WORDS: readonly string[] = [
  // 원작 게임·회사 — 팬아트·추출 그림이 섞이기 쉽다
  "pokemon", "포켓몬", "ポケモン", "宝可梦", "nintendo", "닌텐도", "任天堂",
  "final fantasy", "파이널판타지", "ファイナルファンタジー", "dragon quest", "드래곤퀘스트", "ドラゴンクエスト",
  // 툴 동봉 소재는 그 툴에서만 쓸 수 있다
  "rpg maker", "rpgmaker", "알만툴", "쯔꾸르", "ツクール", "rtp",
  // 다른 게임에서 뽑아 낸 그림
  "ripped", "sprite rip", "리핑",
  // 성인물
  "nsfw", "hentai", "헨타이", "porn", "포르노", "야짤", "19금", "성인용", "r18", "18禁", "エロ",
];

/** 대소문자·전각·라틴 악센트(é → e)를 접는다. 가나의 탁점(U+3099·309A)은 남긴다 — ポ 와 ホ 는 다른 글자다. */
const fold = (text: string): string => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").normalize("NFKC").toLowerCase();
const isAscii = (word: string): boolean => /^[\x00-\x7f]+$/.test(word);
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 쉼표·줄바꿈으로 나눈 낱말 목록. # 뒤는 주석. */
export function parseHoldWords(text: string | undefined): string[] {
  return (text ?? "").split(/[,\n]/).map((line) => line.replace(/#.*/, "").trim()).filter(Boolean);
}

export interface HoldMatcher { readonly words: readonly string[]; hits(text: string): string[] }

/**
 * 영문 낱말은 낱말 경계로만 찾는다(rtp 가 "art pack" 에 걸리지 않게, 낱말 사이 띄어쓰기·기호는 무시).
 * 한글·일본어·중국어는 띄어쓰기·기호를 뺀 글 안에서 그대로 찾는다(「포 켓 몬」도 걸린다).
 */
export function holdMatcher(words: readonly string[]): HoldMatcher {
  const unique = [...new Set(words.map((word) => fold(word).trim()).filter(Boolean))];
  const tests = unique.map((word) => {
    if (isAscii(word)) {
      const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${word.split(/[\s\-_.]+/).map(escape).join("[\\s\\-_.]*")}(?![\\p{L}\\p{N}])`, "u");
      return { word, test: (folded: string) => pattern.test(folded) };
    }
    const squeezed = word.replace(/[\s\p{P}\p{S}]+/gu, "");
    return { word, test: (_folded: string, compact: string) => compact.includes(squeezed) };
  });
  return {
    words: unique,
    hits(text: string): string[] {
      const folded = fold(text);
      const compact = folded.replace(/[\s\p{P}\p{S}]+/gu, "");
      return tests.filter((entry) => entry.test(folded, compact)).map((entry) => entry.word);
    },
  };
}

/** 상품에서 사람이 읽는 글 전부 — 낱말 검사 대상. */
export function manifestText(manifest: StorePackManifest): string {
  const parts: string[] = [manifest.title, manifest.summary, manifest.description, manifest.credits, ...manifest.tags];
  for (const text of Object.values(manifest.locales ?? {})) if (text) parts.push(text.title ?? "", text.summary ?? "", text.description ?? "");
  for (const asset of Object.values(manifest.content.assets)) parts.push(String((asset as { name?: unknown }).name ?? ""));
  for (const tileset of Object.values(manifest.content.tilesets)) parts.push(String((tileset as { name?: unknown }).name ?? ""));
  return parts.join("\n");
}
