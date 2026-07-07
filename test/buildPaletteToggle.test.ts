import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { isBuildPaletteEnabled, setBuildPaletteEnabled } from "@/editor/panels/buildPalette";

// 회귀: 건축 모드를 켜면 영역 선택 툴로 전환해야 사용자가 바로 드래그로 영역을 지정할 수 있다.
// (이 전환이 없으면 건축을 눌러도 그리기 툴이라 "반응 없음"으로 보인다.)
describe("build palette toggle → tool switch", () => {
  beforeEach(() => {
    editorState.set({ tool: "paint" });
    setBuildPaletteEnabled(false);
    editorState.set({ tool: "paint" });
  });
  afterEach(() => {
    setBuildPaletteEnabled(false);
  });

  it("켜면 select 툴로, 끄면 paint 툴로 전환한다", () => {
    expect(isBuildPaletteEnabled()).toBe(false);

    setBuildPaletteEnabled(true);
    expect(isBuildPaletteEnabled()).toBe(true);
    expect(editorState.get().tool).toBe("select");

    setBuildPaletteEnabled(false);
    expect(isBuildPaletteEnabled()).toBe(false);
    expect(editorState.get().tool).toBe("paint");
  });
});
