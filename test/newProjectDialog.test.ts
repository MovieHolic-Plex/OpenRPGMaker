import { describe, expect, it } from "vitest";
import {
  NEW_PROJECT_STARTER_OPTIONS,
  resolveNewProjectSelection,
} from "@/editor/newProjectDialog";

describe("resolveNewProjectSelection", () => {
  it("BREAK: 빈 이름은 기본 제목으로, 장르 없음은 빈 프로젝트로", () => {
    const selection = resolveNewProjectSelection({ title: "   ", genrePresetId: null, starter: "blank" });
    expect(selection.title).toBe("새 프로젝트");
    expect(selection.starter).toBe("blank");
    expect(selection.genrePresetId).toBeNull();
  });

  it("BREAK: 장르 선택은 시스템 프리셋 계획을 동반한다", () => {
    const selection = resolveNewProjectSelection({ title: "나의 모험", genrePresetId: "adventure-jrpg", starter: "blank" });
    expect(selection.title).toBe("나의 모험");
    expect(selection.systemPresetPlan).toMatchObject({
      kind: "blank-project-system-preset",
      packId: "adventure-jrpg",
    });
  });

  it("BREAK: 예제 시작은 장르 없이 예제 프로젝트를 가리킨다", () => {
    const selection = resolveNewProjectSelection({ title: "학습용", genrePresetId: null, starter: "sample-adventure" });
    expect(selection.starter).toBe("sample-adventure");
    expect(selection.systemPresetPlan).toBeUndefined();
  });

  it("BREAK: 모르는 장르 id 는 에러로 실패한다", () => {
    expect(() => resolveNewProjectSelection({ title: "x", genrePresetId: "no-such-genre", starter: "blank" })).toThrow();
  });

  it("BREAK: 시작 옵션 목록은 빈 프로젝트·장르·예제를 모두 제공한다", () => {
    const ids = NEW_PROJECT_STARTER_OPTIONS.map((option) => option.id);
    expect(ids).toContain("blank");
    expect(ids).toContain("sample-adventure");
  });
});
