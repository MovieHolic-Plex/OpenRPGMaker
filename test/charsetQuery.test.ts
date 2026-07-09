import { describe, expect, it } from "vitest";
import { resolveNpcGraphic } from "@/assets/charsetQuery";

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
});
