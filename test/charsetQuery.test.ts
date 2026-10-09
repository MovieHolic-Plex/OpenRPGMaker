import { describe, expect, it } from "vitest";
import { charsetGraphicKey, pickNpcGraphic, queryNpcGraphics, resolveNpcGraphic } from "@/assets/charsetQuery";

describe("charsetQuery", () => {
  it("할머니 질의를 elder+female 엔트리로 해석한다", () => {
    const entry = resolveNpcGraphic("할머니");
    expect(entry?.gender).toBe("female");
    expect(entry?.age).toBe("elder");
  });

  it("old man 질의를 elder+male 엔트리로 해석한다", () => {
    const entry = resolveNpcGraphic("old man");
    expect(entry?.gender).toBe("male");
    expect(entry?.age).toBe("elder");
  });

  it("소녀 질의를 child+female 엔트리로 해석한다", () => {
    const entry = resolveNpcGraphic("소녀");
    expect(entry?.gender).toBe("female");
    expect(entry?.age).toBe("child");
  });

  it("기사 질의를 기사 태그 엔트리로 해석한다", () => {
    const entry = resolveNpcGraphic("기사");
    expect(entry?.tags).toContain("기사");
  });

  it("0점 질의는 null을 반환한다", () => {
    expect(resolveNpcGraphic("존재하지않는차셋질의xyz")).toBeNull();
  });

  it("generic villager with seed diversifies across top-K", () => {
    const a = pickNpcGraphic("villager", { seed: "map:Alice:1,1" });
    const b = pickNpcGraphic("villager", { seed: "map:Bob:2,2" });
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    // same seed is stable
    expect(pickNpcGraphic("villager", { seed: "map:Alice:1,1" })?.characterIndex).toBe(a?.characterIndex);
    expect(pickNpcGraphic("villager", { seed: "map:Alice:1,1" })?.textureKey).toBe(a?.textureKey);
  });

  it("avoidKeys skips already-used slots when alternatives exist", () => {
    const first = pickNpcGraphic("villager", { seed: "fixed" })!;
    const second = pickNpcGraphic("villager", {
      seed: "fixed",
      avoidKeys: new Set([charsetGraphicKey(first)]),
    })!;
    expect(charsetGraphicKey(second)).not.toBe(charsetGraphicKey(first));
  });

  it("specific role query keeps top match when not avoided", () => {
    const elder = pickNpcGraphic("할머니");
    expect(elder?.gender).toBe("female");
    expect(elder?.age).toBe("elder");
  });

  it("finds each golem and never a king, in Korean and English", () => {
    for (const query of ["골렘", "golem"]) {
      expect(queryNpcGraphics(query, 100).map(match => charsetGraphicKey(match.entry)).sort()).toEqual([
        "tex_easyrpg_charset_monster2#4", "tex_easyrpg_charset_monster4#5",
      ]);
    }
    expect(charsetGraphicKey(resolveNpcGraphic("king")!)).toBe("tex_easyrpg_charset_people3#0");
  });

  it("keeps literal hair and prop searches on the visually audited slots", () => {
    expect(charsetGraphicKey(resolveNpcGraphic("보라 머리 여성 마법사")!)).toBe("tex_easyrpg_charset_actor4#6");
    expect(charsetGraphicKey(resolveNpcGraphic("파란 머리 여성 마법사")!)).toBe("tex_easyrpg_charset_actor4#3");
    expect(queryNpcGraphics("흑발 여성 마법사", 100).some(match => match.entry.textureKey === "tex_easyrpg_charset_actor4")).toBe(false);
    expect(charsetGraphicKey(resolveNpcGraphic("나무 보물상자")!)).toBe("tex_easyrpg_charset_object1#7");
    expect(queryNpcGraphics("나무 통", 100)).toEqual([]);
    expect(queryNpcGraphics("금고", 100)).toEqual([]);
    expect(queryNpcGraphics("후드", 100).map(match => charsetGraphicKey(match.entry))).not.toContain("tex_easyrpg_charset_actor2#5");
    expect(queryNpcGraphics("날개", 100).map(match => charsetGraphicKey(match.entry))).not.toContain("tex_easyrpg_charset_people3#7");
  });

  it("includes Scarloxy residents and farm animals in their actual categories", () => {
    const people = queryNpcGraphics("people", 100).filter(match => match.entry.textureKey.startsWith("tex_scarloxy_"));
    expect(people).toHaveLength(10);
    expect(queryNpcGraphics("object", 100).some(match => match.entry.textureKey.startsWith("tex_scarloxy_"))).toBe(false);
    expect(queryNpcGraphics("animal", 100).filter(match => match.entry.textureKey.startsWith("tex_farming_")).map(match => match.entry.label).sort()).toEqual(["농장 닭", "농장 젖소"]);
  });
});
