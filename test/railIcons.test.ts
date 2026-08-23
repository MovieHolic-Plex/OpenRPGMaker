import { describe, expect, it } from "vitest";
import { SVG_ICON_NAMES } from "@/editor/panels/tileToolbarIcons";

describe("rail svg icons", () => {
  it("기본 레일에 필요한 아이콘 이름이 모두 등록되어 있다", () => {
    for (const name of ["select", "brush", "eraser", "fill", "event", "eyedropper", "tile", "layers", "map"]) {
      expect(SVG_ICON_NAMES).toContain(name);
    }
  });
});
