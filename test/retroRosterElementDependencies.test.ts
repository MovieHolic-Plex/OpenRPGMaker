import { describe, expect, it } from "vitest";
import { defaultDatabase, ensureRetroRosterRecords } from "@/project/defaults/defaultDatabase";
import type { DatabaseElementRecord, ProjectDatabaseRecords } from "@/project/types";

function customDatabase(): { database: ProjectDatabaseRecords & { elements: DatabaseElementRecord[] } } {
  return { database: { ...defaultDatabase(), actors: [], classes: [], skills: [], equipment: [], states: [], battleAnimations: [], elements: [] } };
}

describe("retro roster element dependencies", () => {
  it("fills every appended skill element in a custom database and converges", () => {
    const project = customDatabase();
    expect(ensureRetroRosterRecords(project)).toBe(true);
    const elements = new Set(project.database.elements.map(row => row.id));
    for (const skill of project.database.skills) if (skill.elementId) expect(elements.has(skill.elementId)).toBe(true);
    expect(elements.has("grass")).toBe(true);
    expect(ensureRetroRosterRecords(project)).toBe(false);
  });

  it("keeps an existing author grass definition", () => {
    const project = customDatabase();
    const grass = { ...defaultDatabase().elements!.find(row => row.id === "grass")!, name: "저자 풀 속성" };
    project.database.elements.push(grass);
    ensureRetroRosterRecords(project);
    expect(project.database.elements.filter(row => row.id === "grass")).toEqual([grass]);
  });
});
