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
    expect(uiLabel("layerUpper", "plain")).toBe("장식");
    expect(uiLabel("layerEvent", "plain")).toBe("이벤트");
  });

  it("technical style keeps domain terms", () => {
    expect(uiLabel("database", "technical")).toMatch(/데이터베이스|하위/);
    expect(uiLabel("layerLower", "technical")).toBe("하위");
    expect(uiLabel("layerUpper", "technical")).toBe("상위");
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
