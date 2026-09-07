import { describe, expect, it } from "vitest";
import { createBlankProject } from "../src/project/defaults";
import { deserialize } from "../src/project/io";
import { collectWebExportAssets } from "../src/project/webExportAssets";
import { createGameRelease, createRuntimeManifest, jsonBytes } from "../src/project/gameRelease";
import { validateReleaseArchive } from "../community-site/lib/releaseArchive";
import { operatorRuntimeWithCollector } from "../community-site/lib/releaseArchive";
import { buildReleaseCollector } from "../scripts/lib/releaseCollectorBuild.mjs";

const collector = await buildReleaseCollector(process.cwd());

async function fixture() {
  const project = createBlankProject();
  project.system.defaultBgmResourceId = "cc0-bgm-field";
  project.system.titleResourceId = "oprn-title-field";
  const publicEntries = collectWebExportAssets(project).filter(asset => asset.kind === "public")
    .map(asset => ({ name: asset.zipPath, bytes: jsonBytes(`retained:${asset.zipPath}`) }));
  const web = [{ name: "player.html", bytes: jsonBytes("trusted html") }, { name: "player.js", bytes: jsonBytes("trusted script") },
    { name: "dependency-collector.js", bytes: collector }];
  const trusted = await operatorRuntimeWithCollector(await createRuntimeManifest([...web.map(entry => ({ ...entry, name: `web/${entry.name}` })),
    ...publicEntries.map(entry => ({ ...entry, name: `public/${entry.name}` }))], []), collector);
  const publication = { gameId: "dependency-test", versionLabel: "1", runtimeTarget: trusted.runtimeTarget,
    saveCompatibilityId: "dependency-save", acceptedSaveCompatibilityIds: [] };
  project.meta.publication = publication;
  const release = async (omit?: string) => {
    const projectBytes = new TextEncoder().encode(` \n${JSON.stringify(project, null, 2)}\n`);
    const result = await createGameRelease({ publication, entries: [...web, ...publicEntries.filter(entry => entry.name !== omit),
      { name: "project.json", bytes: projectBytes }] });
    return { bytes: Buffer.from(await result.blob.arrayBuffer()), projectBytes };
  };
  return { project, trusted, release };
}

describe("retained authored dependency closure", () => {
  it.each(["assets/generated/title/oprn-title-field.png", "assets/cc0/audio/bgm/field-of-dreams.mp3"])
    ("rejects coherent removal of used %s outside fixed runtime assets", async missing => {
      const f = await fixture();
      expect(f.trusted.requiredAssets).not.toContain(missing);
      const complete = await f.release();
      await expect(validateReleaseArchive(complete.bytes, async () => f.trusted)).resolves.toBeDefined();
      await expect(validateReleaseArchive((await f.release(missing)).bytes, async () => f.trusted).then(() => "accepted")).rejects.toThrow();
    });
  it.each(["unknown-authored-track", "https://evil.invalid/music.mp3", "//evil.invalid/music.mp3"])
    ("rejects unresolved/external authored reference %s", async reference => {
      const f = await fixture();
      f.project.system.defaultBgmResourceId = reference;
      await expect(validateReleaseArchive((await f.release()).bytes, async () => f.trusted).then(() => "accepted")).rejects.toThrow();
    });
  it("keeps exact original project bytes", async () => {
    const f = await fixture(), release = await f.release();
    const result = await validateReleaseArchive(release.bytes, async () => f.trusted);
    expect(Buffer.from(result.entries.get("project.json") ?? []).equals(Buffer.from(release.projectBytes))).toBe(true);
    expect(result.bytes.equals(release.bytes)).toBe(true);
  });
  it.each([
    { background: { imageId: "", scrollX: 0, scrollY: 0 } },
    { bgm: { mode: "custom" as const, resourceId: "" } },
    { bgm: { mode: "custom" as const, resourceId: " \t" } },
    { background: { imageId: "", scrollX: 0, scrollY: 0 }, bgm: { mode: "custom" as const, resourceId: "" } },
  ])("validates optional map clear selections with exact original bytes: %j", async settings => {
    const f = await fixture();
    Object.assign(Object.values(f.project.maps)[0], settings);
    const release = await f.release();
    const result = await validateReleaseArchive(release.bytes, async () => f.trusted);
    expect(Buffer.from(result.entries.get("project.json") ?? []).equals(Buffer.from(release.projectBytes))).toBe(true);
    expect(result.bytes.equals(release.bytes)).toBe(true);
  });
  it("excludes editorial monster metadata even when raw IDs resemble resource fields", async () => {
    const f = await fixture();
    const originalDependencies = f.trusted.collectDependencies?.(JSON.stringify(f.project));
    f.project.monsterMetadata = {
      resourceId: { description: "unknown-editorial-resource" },
      imageId: { tags: ["unused-upload"] },
      bgm: { name: "Uninstalled editorial choice" },
    };
    f.project.assets.uploaded["unused-upload"] = { id: "unused-upload", name: "Unused", kind: "monster", dataUrl: "data:image/png;base64,AA==", meta: {} };
    expect(f.trusted.collectDependencies?.(JSON.stringify(f.project))).toEqual(originalDependencies);
    const release = await f.release();
    const result = await validateReleaseArchive(release.bytes, async () => f.trusted);
    expect(Buffer.from(result.entries.get("project.json") ?? []).equals(Buffer.from(release.projectBytes))).toBe(true);
  });
  it.each(["sprite", "tileset"])("still rejects mandatory empty %s image definitions", async kind => {
    const f = await fixture();
    if (kind === "sprite") f.project.assets.sprites.custom = { id: "custom", image: { type: "bundled", id: "" }, frames: 1, frameWidth: 16, frameHeight: 16 };
    else Object.values(f.project.tilesets)[0].image = { type: "bundled", id: "" };
    await expect(validateReleaseArchive((await f.release()).bytes, async () => f.trusted).then(() => "accepted")).rejects.toThrow();
  });
  it.each(["unknown-map-resource", "https://evil.invalid/media.png", "//evil.invalid/media.mp3"])
    ("still rejects nonempty optional map references: %s", async resourceId => {
      for (const settings of [{ background: { imageId: resourceId } }, { bgm: { mode: "custom" as const, resourceId } }]) {
        const f = await fixture();
        Object.assign(Object.values(f.project.maps)[0], settings);
        await expect(validateReleaseArchive((await f.release()).bytes, async () => f.trusted).then(() => "accepted")).rejects.toThrow();
      }
    });
  it("does not let a map clear hide a mandatory empty image", async () => {
    const f = await fixture();
    f.project.assets.sprites.custom = { id: "custom", image: { type: "bundled", id: "" }, frames: 1, frameWidth: 16, frameHeight: 16 };
    Object.values(f.project.maps)[0].background = { imageId: "" };
    await expect(validateReleaseArchive((await f.release()).bytes, async () => f.trusted).then(() => "accepted")).rejects.toThrow();
  });
  it.each(["https://evil.invalid/picture.png", "data:image/png;base64,aHR0cHM6Ly9ldmlsLmludmFsaWQ=", "data:image/png;base64,iVBORw=="])
    ("rejects externally disguised or invalid uploaded media: %s", async dataUrl => {
      const f = await fixture();
      f.project.assets.uploaded["used-upload"] = { id: "used-upload", name: "Used upload", kind: "picture", dataUrl, meta: {} };
      f.project.system.titleResourceId = "used-upload";
      await expect(validateReleaseArchive((await f.release()).bytes, async () => f.trusted).then(() => "accepted")).rejects.toThrow();
    });
  it("accepts valid media embedded in the unchanged project without a separate payload", async () => {
    const f = await fixture();
    f.project.assets.uploaded["used-upload"] = { id: "used-upload", name: "Used upload", kind: "picture", meta: {},
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" };
    f.project.system.titleResourceId = "used-upload";
    const release = await f.release();
    const result = await validateReleaseArchive(release.bytes, async () => f.trusted);
    expect(Buffer.from(result.entries.get("project.json") ?? []).equals(Buffer.from(release.projectBytes))).toBe(true);
  });
  it.each(["portrait friendly", "초상화 친구", "portrait\u00a0friendly", "portrait:친구/one"])
    ("accepts editor-valid logical asset ID %s through the frozen collector and complete archive", async id => {
      const f = await fixture();
      const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
      f.project.assets.uploaded[id] = { id, name: "Portrait", kind: "picture", dataUrl, meta: { width: 1, height: 1 } };
      f.project.system.titleResourceId = id;
      const release = await f.release();
      const projectJson = new TextDecoder().decode(release.projectBytes);
      const editorAccepted = deserialize(projectJson);
      expect(editorAccepted.system.titleResourceId).toBe(id);
      expect(editorAccepted.assets.uploaded[id]?.id).toBe(id);
      expect(f.trusted.collectDependencies?.(projectJson)).toContainEqual(expect.objectContaining({ dataUrl }));
      const result = await validateReleaseArchive(release.bytes, async () => f.trusted);
      expect(Buffer.from(result.entries.get("project.json") ?? []).equals(Buffer.from(release.projectBytes))).toBe(true);
      expect(result.bytes.equals(release.bytes)).toBe(true);
    });
  it("does not require unused audio catalog rows", async () => {
    const f = await fixture();
    f.project.resourceProfiles.push({ kind: "music", name: "Unavailable catalog choice", assetId: "uninstalled-unused-track" });
    await expect(validateReleaseArchive((await f.release()).bytes, async () => f.trusted)).resolves.toBeDefined();
  });
  it.each(["sprite", "image", "disguised-upload", "m2", "orientation", "background"])("rejects unresolved %s references", async kind => {
    const f = await fixture();
    const map = Object.values(f.project.maps)[0];
    if (kind === "sprite") f.project.assets.sprites.custom = { id: "custom", image: { type: "bundled", id: "unknown-image" }, frames: 1, frameWidth: 16, frameHeight: 16 };
    if (kind === "image") Object.values(f.project.tilesets)[0].image = { type: "uploaded", id: "missing-upload" };
    if (kind === "disguised-upload") Object.values(f.project.tilesets)[0].image = { type: "uploaded", id: "tex_tiles_default" };
    if (kind === "background") map.background = { imageId: "https://evil.invalid/bg.png" };
    if (kind === "m2") f.project.commonEvents.push({ id: "legacy", name: "Legacy", trigger: "none", commands: [{ kind: "m2Command", commandId: "m2-024-change-actor-graphic", fields: { value: "unknown-graphic" } }] });
    if (kind === "orientation") f.project.database.homeDecorationTypes = [{ id: "decoration", name: "Decoration", graphicResourceId: "oprn-title-field",
      orientationGraphicResourceIds: { down: "unknown-facing" }, placementItemId: "item", footprint: { width: 1, height: 1 }, blocksMovement: false, allowedOrientations: ["down"] }];
    await expect(validateReleaseArchive((await f.release()).bytes, async () => f.trusted).then(() => "accepted")).rejects.toThrow();
  });
  it("never executes an uploaded self-consistent collector or tampered operator collector", async () => {
    const f = await fixture();
    const evil = new TextEncoder().encode("throw Error('uploaded code executed');");
    await expect(operatorRuntimeWithCollector(f.trusted, evil)).rejects.toThrow("runtime-unavailable");
    const original = await f.release();
    const { readReleaseEntries } = await import("../community-site/lib/releaseArchive");
    const entries = [...readReleaseEntries(original.bytes)].filter(([name]) => name !== "release.json")
      .map(([name, bytes]) => ({ name, bytes: name === "dependency-collector.js" ? evil : bytes }));
    const forged = await createGameRelease({ publication: f.project.meta.publication!, entries });
    await expect(validateReleaseArchive(Buffer.from(await forged.blob.arrayBuffer()), async () => f.trusted).then(() => "accepted")).rejects.toThrow("untrusted-runtime");
  });
  it("preserves blank command clear-resource semantics", async () => {
    const f = await fixture();
    f.project.commonEvents.push({ id: "clear", name: "Clear", trigger: "none", commands: [
      { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false },
      { kind: "m2Command", commandId: "m2-025-change-actor-faceset", fields: { target: "actor_hero", value: " " } },
    ] });
    expect(() => f.trusted.collectDependencies?.(JSON.stringify(f.project))).not.toThrow();
  });
  it.each(["m2-061-play-bgm", "m2-065-play-se", "m2-051-show-picture", "m2-003-change-faceset"])
    ("rejects unresolved or external legacy value in %s", async commandId => {
      const f = await fixture();
      for (const value of ["unknown-legacy-resource", "https://evil.invalid/media.png"]) {
        f.project.commonEvents = [{ id: "legacy", name: "Legacy", trigger: "none", commands: [{ kind: "m2Command", commandId, fields: { value } }] }];
        expect(() => f.trusted.collectDependencies?.(JSON.stringify(f.project))).toThrow();
      }
    });
});
