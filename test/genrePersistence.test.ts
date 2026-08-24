import { describe, expect, it } from "vitest";
import { GENRE_PACK_IDS } from "@/project/genrePackId";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";

describe("system.genre persistence", () => {
  it("BREAK: preserves every official genre id across serialize and deserialize", () => {
    for (const genre of GENRE_PACK_IDS) {
      const project = createBlankProject();
      project.system.genre = genre;
      expect(deserialize(serialize(project)).system.genre).toBe(genre);
    }
  });

  it("BREAK: rejects arbitrary genre strings instead of silently accepting them", () => {
    const raw = JSON.parse(serialize(createBlankProject())) as { system: Record<string, unknown> };
    raw.system.genre = "farm-ish";
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/system\.genre/);
  });
});
