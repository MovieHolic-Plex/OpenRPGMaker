import { describe, expect, it } from "vitest";
import { charsetGraphicKey, pickNpcGraphic, resolveNpcGraphic } from "@/assets/charsetQuery";

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
});
