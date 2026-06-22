import { describe, expect, it } from "vitest";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { createBlankProject } from "@/project/defaults";

const MOJIBAKE_PATTERN = /[�]|[?][\u3131-\uD7A3]|[\u00C0-\u00FF]{2,}/u;

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((entry) => collectStrings(entry));
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value).flatMap((entry) => collectStrings(entry));
}

describe("Korean default localization and EasyRPG RTP defaults", () => {
  it("creates the default database with readable Korean labels and no mojibake", () => {
    const project = createBlankProject();
    const checkedStrings = collectStrings({
      terms: project.meta.terms,
      database: project.database,
      system: project.system,
    });

    expect(project.database.actors[0]?.name).toBe("주인공");
    expect(project.database.classes[0]?.name).toBe("전사");
    expect(project.database.items[0]?.name).toBe("회복약");
    expect(project.database.equipment[0]?.name).toBe("청동 검");
    expect(project.database.enemies[0]?.name).toBe("말벌");
    expect(checkedStrings.filter((value) => MOJIBAKE_PATTERN.test(value))).toEqual([]);
  });

  it("uses inspected EasyRPG RTP image references for non-tileset default surfaces where available", () => {
    const project = createBlankProject();
    const ids: ReadonlySet<string> = new Set(EASYRPG_RTP_ASSETS.map((asset) => asset.id));

    expect(project.database.actors[0]?.faceResourceId).toBe("easyrpg-faceset-actor1");
    expect(project.database.actors[0]?.characterResourceId).toBe("easyrpg-charset-actor1");
    expect(project.database.enemies[0]?.monsterResourceId).toBe("easyrpg-monster-hornet");
    expect(project.system.titleResourceId).toBe("easyrpg-title-title1");
    expect(project.system.systemResourceId).toBe("easyrpg-system-system");
    expect(project.system.battleSystemResourceId).toBe("easyrpg-system2-system2-c");
    for (const id of [
      project.database.actors[0]?.faceResourceId,
      project.database.actors[0]?.characterResourceId,
      project.database.enemies[0]?.monsterResourceId,
      project.system.titleResourceId,
      project.system.systemResourceId,
      project.system.battleSystemResourceId,
    ]) {
      expect(ids.has(id ?? "")).toBe(true);
    }
  });
});
