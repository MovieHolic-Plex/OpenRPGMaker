import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { renderClassRecordForm } from "@/editor/panels/databaseClassRecordView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("class learned skills editor", () => {
  it("editing the first row does not drop the rest of learnedSkills", () => {
    const klass = store.getCurrent().database.classes[0];
    const skills = store.getCurrent().database.skills;
    if (!klass || skills.length < 2) throw new Error("fixture needs a class and two skills");
    updateDatabaseRecord("classes", klass.id, {
      learnedSkills: [
        { level: 1, skillId: skills[0]!.id },
        { level: 8, skillId: skills[1]!.id },
      ],
    });

    const form = document.createElement("section") as unknown as FakeElement;
    renderClassRecordForm(form as unknown as HTMLElement, store.getCurrent().database.classes[0]!);

    const level = findByTestId(form, "db-field-class-skill-level");
    expect(level).not.toBeNull();
    level!.value = "3";
    level!.dispatchEvent(new Event("input"));

    const after = store.getCurrent().database.classes[0]!;
    expect(after.learnedSkills).toHaveLength(2);
    expect(after.learnedSkills[0]).toEqual({ level: 3, skillId: skills[0]!.id });
    expect(after.learnedSkills[1]).toEqual({ level: 8, skillId: skills[1]!.id });
  });

  it("add button appends a learned-skill row instead of replacing the array", () => {
    const klass = store.getCurrent().database.classes[0];
    const skills = store.getCurrent().database.skills;
    if (!klass || !skills[0]) throw new Error("fixture needs a class and a skill");
    updateDatabaseRecord("classes", klass.id, {
      learnedSkills: [{ level: 1, skillId: skills[0].id }],
    });

    const form = document.createElement("section") as unknown as FakeElement;
    renderClassRecordForm(form as unknown as HTMLElement, store.getCurrent().database.classes[0]!);
    findByTestId(form, "db-add-class-skill")?.click();

    const after = store.getCurrent().database.classes[0]!;
    expect(after.learnedSkills.length).toBe(2);
    expect(after.learnedSkills[0]?.skillId).toBe(skills[0].id);
  });
});
