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

describe("emerald opening pixel grid (CSS contract)", () => {
  const css = readFileSync("src/styles/runtime/playSurface.css", "utf8");
  const motion = readFileSync("src/styles/runtime/emeraldOpeningMotion.css", "utf8");
  it("sizes the introduced monster from the integer art box and places it on whole even pixels", () => {
    const rule = css.split("\n").find((line) => line.includes('[data-portrait-art="bust"] .cinematic-creature'));
    expect(rule).toBeDefined();
    expect(rule).toContain("width:var(--art-box-width,128px)");
    expect(rule).toContain("height:var(--art-box-height,128px)");
    expect(rule).toMatch(/left:272px;top:76px/u);
    expect(rule).not.toMatch(/%/u);
  });
  it("keeps idle bobs on 2px steps and the dialogue window inside the stage", () => {
    expect(motion).toContain("emerald-creature-idle 3.2s steps(1, end)");
    expect(motion).toMatch(/emerald-professor-idle[^}]*-2px/u);
    expect(css).toContain("width:calc(100% - 28px - 40px)");
    expect(css).toContain("border:6px double #55615f");
  });
});
