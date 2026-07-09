import { describe, expect, it } from "vitest";
import { searchResources } from "@/assets/resourceSearch";

describe("searchResources", () => {
  it("finds the slime charset for '슬라임'", () => {
    const results = searchResources("charset", "슬라임");
    expect(results[0]?.id).toBe("charset:tex_easyrpg_charset_monster1:0");
  });

  it("finds the sign tile for '표지판'", () => {
    const results = searchResources("tile", "표지판");
    expect(results[0]?.id).toBe("tile:320");
  });

  it("finds the red dragon charset for '붉은 드래곤'", () => {
    const results = searchResources("charset", "붉은 드래곤");
    expect(results[0]?.id).toBe("charset:tex_easyrpg_charset_monster3:5");
  });

  it("includes the fence tile 378 for '울타리'", () => {
    const results = searchResources("tile", "울타리");
    expect(results.map((r) => r.id)).toContain("tile:378");
  });

  it("includes the sand tile 423 for '모래'", () => {
    const results = searchResources("tile", "모래");
    expect(results.map((r) => r.id)).toContain("tile:423");
  });

  it("finds the validated passability-trap tiles (FLOOR/STAIRS solid)", () => {
    const floor = searchResources("tile", "돌바닥");
    expect(floor.map((r) => r.id)).toContain("tile:342");
    const stairs = searchResources("tile", "계단");
    expect(stairs.map((r) => r.id)).toContain("tile:246");
  });

  it("finds bee and skeleton monster1 charsets", () => {
    expect(searchResources("charset", "벌")[0]?.id).toBe("charset:tex_easyrpg_charset_monster1:2");
    expect(searchResources("charset", "해골")[0]?.id).toBe("charset:tex_easyrpg_charset_monster1:4");
  });

  it("finds town-flavored BGM for '마을'", () => {
    const results = searchResources("bgm", "마을");
    expect(results.map((r) => r.id)).toContain("bgm:easyrpg-music-town-1");
  });

  it("finds sky-flavored backdrops for '하늘'", () => {
    const results = searchResources("backdrop", "하늘");
    expect(results.map((r) => r.id)).toContain("backdrop:easyrpg-backdrop-sky1");
  });

  it("finds fire-flavored sound effects for '불'", () => {
    const results = searchResources("se", "불");
    expect(results.map((r) => r.id)).toContain("se:easyrpg-sound-fire1");
  });

  it("finds a villager charset for '주민'", () => {
    const results = searchResources("charset", "주민");
    expect(results.map((r) => r.id)).toContain("charset:tex_easyrpg_charset_people1:0");
  });

  it("finds an elder charset for '노인'", () => {
    const results = searchResources("charset", "노인");
    expect(results.map((r) => r.id)).toContain("charset:tex_easyrpg_charset_people1:7");
  });

  it("finds the innkeeper charset for '여관 주인'", () => {
    const results = searchResources("charset", "여관 주인");
    expect(results[0]?.id).toBe("charset:tex_easyrpg_charset_people5:6");
  });

  it("finds a merchant charset for '상인'", () => {
    const results = searchResources("charset", "상인");
    expect(results.map((r) => r.id)).toContain("charset:tex_easyrpg_charset_people2:0");
  });

  it("finds a child charset for '아이'", () => {
    const results = searchResources("charset", "아이");
    expect(results.map((r) => r.id)).toContain("charset:tex_easyrpg_charset_people1:1");
  });

  it("returns no results for an unmatched query", () => {
    expect(searchResources("tile", "존재하지않는쿼리xyz")).toEqual([]);
  });

  it("returns no results for a blank query", () => {
    expect(searchResources("tile", "   ")).toEqual([]);
  });

  // 실사용 감사 로그 회귀: LLM이 시도한 질의가 전부 0건이라 place_npc가 실패했다.
  // 영어/시트명/두 단어 질의와 와일드카드 브라우징을 지원해야 한다.
  describe("LLM 질의 회귀 (감사 로그 2026-07-04)", () => {
    it("시트명 질의 people1/people2가 해당 시트를 찾는다", () => {
      expect(searchResources("charset", "people1")[0]?.id).toMatch(/^charset:tex_easyrpg_charset_people1:/);
      expect(searchResources("charset", "people2")[0]?.id).toMatch(/^charset:tex_easyrpg_charset_people2:/);
    });

    it("영문 질의 npc/people/human/villager가 주민 차셋을 찾는다", () => {
      for (const query of ["npc", "people", "human", "villager"]) {
        const ids = searchResources("charset", query).map((r) => r.id);
        expect(ids.some((id) => id.includes("people")), `query=${query}`).toBe(true);
      }
    });

    it("두 단어 질의 '마을 사람'이 주민 차셋을 찾는다", () => {
      const ids = searchResources("charset", "마을 사람").map((r) => r.id);
      expect(ids.some((id) => id.includes("people"))).toBe(true);
    });

    it("query='*'는 전체 차셋 목록을 반환한다 (브라우징)", () => {
      const all = searchResources("charset", "*");
      expect(all.length).toBeGreaterThan(30);
      expect(searchResources("charset", "all").length).toBe(all.length);
    });

    it("monster1 시트명 질의도 동작한다", () => {
      expect(searchResources("charset", "monster1")[0]?.id).toMatch(/^charset:tex_easyrpg_charset_monster1:/);
    });
  });
});
