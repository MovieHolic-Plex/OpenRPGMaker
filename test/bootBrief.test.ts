import { describe, expect, it } from "vitest";
import { BOOT_TIP_LINES, bootBriefLines } from "@/app/bootBrief";

const project = {
  meta: { title: "Medieval · 공용 타일과 AI 조립 참고" },
  maps: { a: {}, b: {}, c: {}, d: {} },
  tilesets: { t: {} },
  database: { items: [{}, {}] },
};

describe("bootBriefLines", () => {
  it("reads the open project when a model is connected", () => {
    expect(bootBriefLines(project, true)).toEqual([
      "Medieval · 공용 타일과 AI 조립 참고",
      "맵 4개 · 아이템 2개",
      "타일셋 1개",
    ]);
  });

  it("uses a title when the project name is blank", () => {
    expect(bootBriefLines({ ...project, meta: { title: "  " } }, true)[0]).toBe("제목 없는 프로젝트");
  });

  it("keeps feature names when no model is connected", () => {
    expect(bootBriefLines(project, false)).toEqual(BOOT_TIP_LINES);
  });
});
