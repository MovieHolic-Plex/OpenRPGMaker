import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { configureEmeraldMonsterOpening, configureEmeraldMonsterPortraitMotion } from "@/project/emeraldMonsterOpening";
import { EMERALD_PROFESSOR_BUST_RESOURCE_ID } from "@/project/emeraldProfessorArt";

describe("emerald opening professor bust", () => {
  it("resolves the bundled PNG by id without any uploaded bytes in the project", () => {
    const project = createBlankProject();
    configureEmeraldMonsterOpening(project);
    expect(project.meta.oprnOpeningBook?.portraitResourceId).toBe(EMERALD_PROFESSOR_BUST_RESOURCE_ID);
    expect(project.assets.uploaded[EMERALD_PROFESSOR_BUST_RESOURCE_ID]).toBeUndefined();
    expect(project.system.opening?.scenes[0]).toMatchObject({ kind: "image", resourceId: EMERALD_PROFESSOR_BUST_RESOURCE_ID });
    const url = resolveAssetResourceUrl(EMERALD_PROFESSOR_BUST_RESOURCE_ID, { project });
    expect(url).toMatch(/professor-bust\.png$/);
    const file = readFileSync(`public${url!.replace(/\?.*$/u, "")}`);
    // PNG 신호 + 122×97
    expect(file.subarray(1, 4).toString()).toBe("PNG");
    expect(file.readUInt32BE(16)).toBe(122);
    expect(file.readUInt32BE(20)).toBe(97);
    expect(JSON.stringify(project.system.opening)).not.toContain("data:image");
  });

  it("upgrades an old 64x64 chip portrait on repair", () => {
    const project = createBlankProject();
    configureEmeraldMonsterOpening(project);
    project.meta.oprnOpeningBook!.portraitResourceId = "oprn_emerald_professor";
    const first = project.system.opening!.scenes[0]!;
    if (first.kind === "image") first.resourceId = "oprn_emerald_professor";
    configureEmeraldMonsterPortraitMotion(project);
    expect(project.meta.oprnOpeningBook?.portraitResourceId).toBe(EMERALD_PROFESSOR_BUST_RESOURCE_ID);
    expect(first.kind === "image" && first.resourceId).toBe(EMERALD_PROFESSOR_BUST_RESOURCE_ID);
  });

  it("ships provenance that names the model and matches the file", () => {
    const meta = JSON.parse(readFileSync("public/assets/emerald-monster/professor-bust-provenance.json", "utf8")) as { model: string; resourceId: string; width: number; height: number };
    expect(meta).toMatchObject({ model: "gpt-image-2.5-sunburst", resourceId: EMERALD_PROFESSOR_BUST_RESOURCE_ID, width: 122, height: 97 });
    expect(existsSync("public/assets/emerald-monster/professor-bust.png")).toBe(true);
  });
});
