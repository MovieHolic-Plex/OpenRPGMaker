import { beforeEach, describe, expect, it } from "vitest";
import { addDatabaseRecord, deleteDatabaseRecord } from "@/editor/databaseActions";
import { getMapEditHistoryMarker, resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

describe("database deletion preserves direct authored references", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    resetMapEditHistory();
  });

  it.each(["learnedSkillId", "activateSkillId"] as const)("blocks a skill used only by item %s, including dormant effects", (field) => {
    const skillId = addDatabaseRecord("skills");
    const itemId = addDatabaseRecord("items");
    store.update((project) => {
      const item = project.database.items.find((record) => record.id === itemId)!;
      // The current type is normalGoods: inactive effects remain authored foreign keys.
      item.name = "참조를 보존할 아이템";
      item[field] = skillId;
      delete item.skillId;
    });
    const before = store.getCurrent();
    const historyMarker = getMapEditHistoryMarker();

    expect(deleteDatabaseRecord("skills", skillId)).toEqual({
      ok: false,
      message: expect.stringContaining("참조를 보존할 아이템"),
    });
    expect(store.getCurrent()).toBe(before);
    expect(getMapEditHistoryMarker()).toBe(historyMarker);

    store.update((project) => {
      delete project.database.items.find((record) => record.id === itemId)![field];
    });
    expect(deleteDatabaseRecord("skills", skillId)).toEqual({ ok: true });
    expect(deserialize(serialize(store.getCurrent())).database.skills.some((record) => record.id === skillId)).toBe(false);
  });

  it("blocks a skill used only by a class battle command", () => {
    const skillId = addDatabaseRecord("skills");
    const classId = addDatabaseRecord("classes");
    store.update((project) => {
      const actorClass = project.database.classes.find((record) => record.id === classId)!;
      actorClass.name = "전투 명령 소유 직업";
      actorClass.battleCommands = [{ id: "direct_skill", name: "직접 시전", kind: "skill", skillId }];
    });
    const before = store.getCurrent();
    const historyMarker = getMapEditHistoryMarker();

    expect(deleteDatabaseRecord("skills", skillId)).toEqual({
      ok: false,
      message: expect.stringContaining("전투 명령 소유 직업"),
    });
    expect(store.getCurrent()).toBe(before);
    expect(getMapEditHistoryMarker()).toBe(historyMarker);

    store.update((project) => {
      project.database.classes.find((record) => record.id === classId)!.battleCommands = [];
    });
    expect(deleteDatabaseRecord("skills", skillId)).toEqual({ ok: true });
    expect(deserialize(serialize(store.getCurrent())).database.skills.some((record) => record.id === skillId)).toBe(false);
  });

  const actorPermissions: { label: string; set: (project: Project, ids: string[]) => void }[] = [
    {
      label: "직업 장비 권한",
      set: (project, ids) => {
        project.database.classes[0]!.name = "권한 소유 레코드";
        project.database.classes[0]!.equipmentPermissions.actorIds = ids;
      },
    },
    {
      label: "장비 착용 권한",
      set: (project, ids) => {
        project.database.equipment[0]!.name = "권한 소유 레코드";
        project.database.equipment[0]!.equippableActorIds = ids;
      },
    },
    {
      label: "아이템 사용 권한",
      set: (project, ids) => {
        project.database.items[0]!.name = "권한 소유 레코드";
        project.database.items[0]!.usableActorIds = ids;
      },
    },
    {
      label: "레거시 아이템 장비 권한",
      set: (project, ids) => {
        project.database.items[0]!.name = "권한 소유 레코드";
        project.database.items[0]!.equipmentProfile.equippableActorIds = ids;
      },
    },
  ];

  it.each(actorPermissions)("blocks an actor referenced only by $label", ({ set }) => {
    const actorId = addDatabaseRecord("actors");
    store.update((project) => set(project, [actorId]));
    const before = store.getCurrent();
    const historyMarker = getMapEditHistoryMarker();

    expect(deleteDatabaseRecord("actors", actorId)).toEqual({
      ok: false,
      message: expect.stringContaining("권한 소유 레코드"),
    });
    expect(store.getCurrent()).toBe(before);
    expect(getMapEditHistoryMarker()).toBe(historyMarker);

    store.update((project) => set(project, []));
    expect(deleteDatabaseRecord("actors", actorId)).toEqual({ ok: true });
    expect(deserialize(serialize(store.getCurrent())).database.actors.some((record) => record.id === actorId)).toBe(false);
  });
});
