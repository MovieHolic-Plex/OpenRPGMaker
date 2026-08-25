import { describe, expect, it } from "vitest";
import { uiLabel } from "@/editor/uiCopy";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { layerShortLabel } from "@/editor/panels/aiAgentBrief";

describe("uiCopy", () => {
  it("plain style uses beginner-friendly words without tool jargon", () => {
    expect(uiLabel("database", "plain")).toBe("자료집");
    expect(uiLabel("database", "plain")).not.toMatch(/DB|Supabase|chipset|autotile/);
    expect(uiLabel("databaseShort", "plain")).toBe("자료");
    expect(uiLabel("tilesetMissing", "plain")).toBe("그림이 없습니다");
    expect(uiLabel("tilesetMissing", "plain")).not.toBe("타일셋이 없습니다");
    expect(uiLabel("layerLower", "plain")).toBe("바닥");
    expect(uiLabel("layerUpper", "plain")).toBe("덧그림");
    expect(uiLabel("layerEvent", "plain")).toBe("이벤트");
  });

  it("technical style keeps domain terms", () => {
    expect(uiLabel("database", "technical")).toBe("데이터베이스");
  });

  // 2026-08-21 용어 정리: technical 쪽 레이어 값이 곧 RM 유래 직역(下層/上層)이었다.
  // 레이어는 전문가라고 다르게 부를 이유가 없으므로 **두 스타일이 같은 말**을 쓴다.
  // 밀도 축(jargonStyle) 자체는 database 등 다른 항목에 남아 있다.
  it("레이어 이름은 밀도 스타일과 무관하게 하나다", () => {
    for (const key of ["layerLower", "layerUpper", "layerEvent"] as const) {
      expect(uiLabel(key, "plain")).toBe(uiLabel(key, "technical"));
    }
  });

  it("레이어 이름에 RM 유래 직역이 없다", () => {
    for (const style of ["plain", "technical"] as const) {
      expect(uiLabel("layerLower", style)).not.toBe("하위");
      expect(uiLabel("layerUpper", style)).not.toBe("상위");
    }
  });

  // "장식"은 타일 **분류** 이름(팔레트 필터 칩 · tileMeta role "decoration")과 겹친다.
  // 레이어에 같은 말을 쓰면 한 화면에서 두 뜻이 부딪힌다.
  it("덧그림 레이어 이름이 타일 분류명 '장식'과 겹치지 않는다", () => {
    expect(uiLabel("layerUpper", "plain")).not.toBe("장식");
  });

  it("defaults to plain when style is omitted", () => {
    expect(uiLabel("database")).toBe("자료집");
  });

  it("layerShortLabel follows the active mode jargon style (standard = plain)", () => {
    resetEditorUiModeForTests("standard");
    expect(layerShortLabel("lower")).toBe("바닥");
    resetEditorUiModeForTests("standard");
  });
});
