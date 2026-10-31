// 스토어 검색어 → 서버 질의. 서버 검색(/api/v1/items?q=)은 검색어 전체를 한 덩어리로 찾는다 —
// 「무기 아이콘」「consumable potion icon」 처럼 낱말이 둘 이상이면 0개였고, 「아이콘」「무기」 하나씩은 찾았다
// (2026-10-31 스토어 검증, 조수 store_search). 여기서 종류 낱말(아이콘·효과음·캐릭터 …)은 kind 거르기로 옮기고,
// 남은 낱말이 여럿이면 낱말마다 찾아 많이 맞은 것부터 합친다.
import { STORE_ITEM_KINDS, type StoreCatalogPage, type StoreItemKind, type StoreItemSummary } from "./format";

/** 검색어에 들어오면 종류로 읽는 낱말(소문자). 낱말 전체가 같을 때만 — 「그림자」 는 그림이 아니다. */
const KIND_WORDS: Readonly<Record<StoreItemKind, readonly string[]>> = {
  tileset: ["타일셋", "타일", "칩셋", "tileset", "tilesets", "tiles", "chipset", "chipsets", "タイルセット", "图块"],
  character: ["캐릭터", "걷기칩", "걷기", "캐릭터칩", "character", "characters", "charset", "charsets", "walking", "キャラクター", "角色"],
  face: ["얼굴", "초상", "얼굴그림", "face", "faces", "portrait", "portraits", "顔", "头像"],
  battler: ["배틀러", "전투그림", "battler", "battlers", "バトラー"],
  picture: ["그림", "배경그림", "picture", "pictures", "ピクチャー", "图片"],
  icon: ["아이콘", "icon", "icons", "アイコン", "图标"],
  music: ["음악", "브금", "배경음악", "bgm", "music", "song", "songs", "音楽", "音乐"],
  sound: ["효과음", "사운드", "sfx", "sound", "sounds", "se", "効果音", "音效"],
  animation: ["애니메이션", "전투애니메이션", "이펙트", "animation", "animations", "effect", "effects", "アニメーション", "动画"],
  pack: ["묶음", "pack", "bundle"],
};

const WORD_KIND = new Map<string, StoreItemKind>(
  (Object.entries(KIND_WORDS) as [StoreItemKind, readonly string[]][]).flatMap(([kind, words]) => words.map((word) => [word, kind] as const)),
);

export interface ParsedStoreQuery {
  /** 서버에 보낼 kind. 호출자가 준 kind 가 이긴다. */
  readonly kind: StoreItemKind | "";
  /** 종류 낱말을 뺀 찾을 낱말. */
  readonly words: readonly string[];
}

/** 「전투 그림」 처럼 두 낱말로 쓰는 종류 이름은 붙여서 읽는다. */
function joinKindPhrases(text: string): string {
  return text.replace(/전투\s+그림/gu, "전투그림").replace(/걷기\s+칩/gu, "걷기칩").replace(/전투\s+애니메이션/gu, "전투애니메이션").replace(/배경\s+음악/gu, "배경음악");
}

export function parseStoreQuery(query: string, kind: string = ""): ParsedStoreQuery {
  const given = (STORE_ITEM_KINDS as readonly string[]).includes(kind) ? kind as StoreItemKind : "";
  const tokens = joinKindPhrases(query.toLowerCase()).split(/[\s,·/|+&()[\]{}"'「」『』<>!?.:;]+/u).filter(Boolean);
  let inferred: StoreItemKind | "" = "";
  const words: string[] = [];
  for (const token of tokens) {
    const tokenKind = WORD_KIND.get(token);
    if (tokenKind) {
      if (!inferred) inferred = tokenKind;
      continue;
    }
    if (!words.includes(token)) words.push(token);
  }
  return { kind: given || inferred, words };
}

export type StoreCatalogFetch = (input: { q?: string; kind?: string }) => Promise<StoreCatalogPage>;

/**
 * 검색어를 낱말로 나눠 찾는다. 낱말이 하나(또는 종류 낱말뿐)면 서버 질의 한 번 그대로다.
 * 여럿이면 먼저 남은 낱말 전체로 찾고, 0개면 낱말마다 찾아 맞은 낱말 수가 많은 순서로 합친다.
 */
export async function searchStoreCatalog(fetchPage: StoreCatalogFetch, query: string, kind: string = ""): Promise<StoreCatalogPage> {
  const parsed = parseStoreQuery(query, kind);
  const kindParam = parsed.kind;
  const whole = await fetchPage({ q: parsed.words.join(" "), kind: kindParam });
  if (whole.items.length > 0 || parsed.words.length < 2) return whole;
  const pages = await Promise.all(parsed.words.map((word) => fetchPage({ q: word, kind: kindParam }).catch(() => null)));
  const hits = new Map<string, { item: StoreItemSummary; count: number; first: number }>();
  pages.forEach((page, wordIndex) => {
    for (const item of page?.items ?? []) {
      const hit = hits.get(item.slug);
      if (hit) hit.count += 1;
      else hits.set(item.slug, { item, count: 1, first: wordIndex });
    }
  });
  const ranked = [...hits.values()].sort((a, b) => b.count - a.count || a.first - b.first);
  // 모든 낱말에 맞은 것이 있으면 그것만, 없으면 하나라도 맞은 것을 많이 맞은 순서로.
  const best = ranked[0]?.count ?? 0;
  const items = (best === parsed.words.length ? ranked.filter((hit) => hit.count === best) : ranked).map((hit) => hit.item);
  return { ...whole, items, total: items.length, page: 1 };
}
