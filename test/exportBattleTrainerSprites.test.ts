// QA-AH119-001: the runtime builds /assets/battle-trainers/<role>/<file>.png from troop.trainerSprite
// (battleAssetPrefetch.ts:69, emeraldTrainerIntro.ts:40), so those paths never appear in project strings the
// dependency collector walks. The Astra 1.19 bundle shipped an empty battle-trainers folder and every trainer
// battle sprite 404'd. The collector must ship every committed file for a referenced role.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import spriteFiles from "@/assets/battleTrainerSpriteFiles.json";
import { createBlankProject } from "@/project/defaults";
import { collectWebExportAssets, trainerSpriteImagePaths } from "@/project/webExportAssets";
import { requiredRuntimeAssetPaths } from "@/project/webExportRuntimeAssets";

const PUBLIC_ROOT = join(process.cwd(), "public");
const files = spriteFiles as Readonly<Record<string, readonly string[]>>;

function projectWithTrainerSprite(sprite: { front: string; back?: string; throw?: string; backThrow?: string }) {
  const project = createBlankProject();
  project.database.troops = project.database.troops.map((troop, index) =>
    index === 0 ? { ...troop, trainerBattle: true, trainerSprite: sprite } : troop);
  return project;
}

describe("trainer battle sprite export dependencies", () => {
  it("ships both the front and back role files for a trainer troop", () => {
    // Given a monster-collect troop that shows a trainer in battle
    const project = projectWithTrainerSprite({ front: "astra_naru", back: "astra_hero" });

    // When the release dependency list is collected
    const exported = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));

    // Then the runtime-composed sprite URLs are all present
    expect(exported).toContain("assets/battle-trainers/astra_naru/front.png");
    expect(exported).toContain("assets/battle-trainers/astra_hero/back.png");
  });

  it("ships the throw sheet and orb of the throwing hero", () => {
    // Given the protagonist's back sprite carries a throw sheet and an orb cut-out
    const project = projectWithTrainerSprite({ front: "astra_naru", back: "astra_hero", backThrow: "astra_hero" });

    // When exported
    const exported = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));

    // Then every file the capture cinematic can ask for is in the bundle
    expect(exported).toContain("assets/battle-trainers/astra_hero/throw.png");
    expect(exported).toContain("assets/battle-trainers/astra_hero/orb.png");
    expect(exported).toContain("assets/battle-trainers/astra_hero/back.png");
  });

  it("only lists files that exist on disk", () => {
    // Given the generated manifest
    // When comparing each entry against public/
    // Then no export path points at a missing file (a missing source would fail the whole export)
    const referenced = projectWithTrainerSprite({ front: "astra_naru", back: "astra_hero", backThrow: "astra_hero" });
    const paths = trainerSpriteImagePaths(referenced);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter((path) => !existsSync(join(PUBLIC_ROOT, path)))).toEqual([]);
  });

  it("keeps the manifest in sync with public/assets/battle-trainers", async () => {
    // Given the sprite folders on disk
    const { readSpriteFiles } = await import("../scripts/content/sync-battle-trainer-sprite-files.mjs");
    // Then the committed manifest matches exactly (regenerate with the script when art is added)
    expect(readSpriteFiles(join(PUBLIC_ROOT, "assets/battle-trainers"))).toEqual(files);
  });

  it("adds no battle-trainers paths for a project with no trainer sprite", () => {
    // Given a project whose troops are ordinary monster encounters
    const project = createBlankProject();
    project.database.troops = project.database.troops.map((troop) => ({ ...troop, trainerSprite: undefined }));

    // When exported
    const declared = requiredRuntimeAssetPaths(project);
    const paths = collectWebExportAssets(project).map((asset) => asset.zipPath).filter((path) => path.startsWith("assets/battle-trainers/"));

    // Then the sprite collector adds nothing: only the always-shipped default roles that src/player/runtimeAssets.json
    // declares (since 15f8ce5de1, the player prefetches them) are present, and no troop-derived path is.
    expect(trainerSpriteImagePaths(project)).toEqual([]);
    expect(paths.filter((path) => !declared.has(path))).toEqual([]);
  });

  it("ignores a role with no committed art instead of emitting a broken path", () => {
    // Given a troop naming a role that has no folder under public/assets/battle-trainers
    const project = projectWithTrainerSprite({ front: "role_that_does_not_exist" });

    // When the paths are collected
    const paths = trainerSpriteImagePaths(project);

    // Then no path is invented
    expect(paths).toEqual([]);
  });

  it("does not treat an Object.prototype name as a role", () => {
    // Given a role id that is a valid identifier but also an inherited property name
    const project = projectWithTrainerSprite({ front: "constructor", back: "toString" });

    // When the paths are collected
    // Then the export neither throws nor invents a path
    expect(trainerSpriteImagePaths(project)).toEqual([]);
  });

  it("lets an uploaded picture shadow a bundled role id", () => {
    // Given a project upload that reuses the bundled role id astra_naru
    const project = projectWithTrainerSprite({ front: "astra_naru" });
    project.assets.uploaded.astra_naru = { id: "astra_naru", name: "astra_naru.png", kind: "image", path: "uploaded/astra_naru.png" } as never;

    // When the paths are collected
    // Then the bundled folder is not shipped (the upload owns the id)
    expect(trainerSpriteImagePaths(project)).toEqual([]);
  });
});
