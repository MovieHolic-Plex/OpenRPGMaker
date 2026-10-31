import { describe, expect, it } from "vitest";
import { parseStoreQuery, searchStoreCatalog } from "@/assetStore/storeQuery";
import type { StoreCatalogPage, StoreItemSummary } from "@/assetStore/format";

const item = (slug: string, kind: string, words: string[]) => ({ slug, kind, title: slug, words }) as unknown as StoreItemSummary & { words: string[] };
const CATALOG = [
  item("icons-weapons", "icon", ["무기", "weapon", "아이콘"]),
  item("icons-potions", "icon", ["물약", "소모품", "potion", "consumable", "아이콘"]),
  item("battlers-weapon", "battler", ["무기", "weapon"]),
];
/** 서버처럼 검색어 전체를 한 덩어리로 찾는다. */
async function fakeCatalog(input: { q?: string; kind?: string }): Promise<StoreCatalogPage> {
  const q = (input.q ?? "").toLowerCase();
  const items = CATALOG.filter((entry) => (!input.kind || entry.kind === input.kind) && (!q || entry.words.some((word) => word.includes(q))));
  return { items, total: items.length, page: 1, pageSize: 24 };
}

describe("store query", () => {
  it("종류 낱말은 kind 로 읽고 찾을 낱말에서 뺀다", () => {
    expect(parseStoreQuery("무기 아이콘")).toEqual({ kind: "icon", words: ["무기"] });
    expect(parseStoreQuery("불 효과음")).toEqual({ kind: "sound", words: ["불"] });
    expect(parseStoreQuery("아이콘", "battler")).toEqual({ kind: "battler", words: [] });
    expect(parseStoreQuery("그림자 숲")).toEqual({ kind: "", words: ["그림자", "숲"] });
  });

  it("「무기 아이콘」 처럼 낱말이 여럿이어도 찾는다", async () => {
    expect((await searchStoreCatalog(fakeCatalog, "무기 아이콘")).items.map((entry) => entry.slug)).toEqual(["icons-weapons"]);
    expect((await searchStoreCatalog(fakeCatalog, "물약 소모품")).items.map((entry) => entry.slug)).toEqual(["icons-potions"]);
    expect((await searchStoreCatalog(fakeCatalog, "consumable potion icon")).items.map((entry) => entry.slug)).toEqual(["icons-potions"]);
    expect((await searchStoreCatalog(fakeCatalog, "아이콘")).total).toBe(2);
  });
});
