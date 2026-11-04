import { describe, expect, it } from "vitest";
import { createFirstLoveFlagshipDemo } from "@/project/flagship/firstLove";
import { lintScenePolish } from "@/project/lint/scenePolishLint";

describe("첫사랑 데모는 장면 다듬기 경고 0건을 지킨다", () => {
  const { project } = createFirstLoveFlagshipDemo();
  const issues = lintScenePolish(project);

  for (const code of ["scene-letterbox-dialogue", "scene-text-during-picture-fade"]) {
    it(code, () => {
      expect(issues.filter((issue) => issue.code === code).map((issue) => issue.eventId)).toEqual([]);
    });
  }
});
