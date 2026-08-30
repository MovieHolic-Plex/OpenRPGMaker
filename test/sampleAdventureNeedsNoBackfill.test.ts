import { describe, expect, it } from "vitest";
import { ensureDefaultDatabaseIconResources } from "@/project/defaults/defaultDatabaseIconResources";
import { createSampleAdventureProject } from "@/project/defaults/defaultProject";

describe("출하 데모는 로드 시 보충에 의존하지 않는다", () => {
  it("보충이 아무것도 바꾸지 못한다", () => {
    expect(ensureDefaultDatabaseIconResources(createSampleAdventureProject())).toBe(false);
  });

  it("보충을 통과시켜도 아이템·장비 개수가 변하지 않는다", () => {
    const project = createSampleAdventureProject();
    const before = {
      items: project.database.items.length,
      equipment: project.database.equipment.length,
    };

    ensureDefaultDatabaseIconResources(project);

    expect({
      items: project.database.items.length,
      equipment: project.database.equipment.length,
    }).toEqual(before);
  });
});
