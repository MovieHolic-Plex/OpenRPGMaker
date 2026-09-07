import { describe, expect, it } from "vitest";
import { createGameRelease, createRuntimeManifest, jsonBytes, parseRuntimeManifest } from "../src/project/gameRelease";
import { sha256HexText } from "../src/util/sha256";
import { writeStoredZip } from "../src/project/packageZip";
import { operatorRuntimeWithCollector, validateReleaseArchive } from "../community-site/lib/releaseArchive";

async function fixture() {
  const runtime = [{ name: "web/player.html", bytes: jsonBytes("trusted html") },
    { name: "web/player.js", bytes: jsonBytes("trusted code") },
    // This narrow trusted fixture runtime does not load any project media.
    { name: "web/dependency-collector.js", bytes: new TextEncoder().encode("var OPRN_RELEASE_COLLECTOR={collectReleaseDependencies:()=>[]};") }];
  const trusted = await operatorRuntimeWithCollector(await createRuntimeManifest(runtime, []), runtime[2].bytes);
  const publication = { gameId: "fixture", versionLabel: "1.0", runtimeTarget: trusted.runtimeTarget,
    saveCompatibilityId: "fixture-save", acceptedSaveCompatibilityIds: [] };
  const entries = [...runtime.map(entry => ({ ...entry, name: entry.name.slice(4) })),
    { name: "project.json", bytes: jsonBytes({ version: 4, meta: { publication } }) }];
  const release = await createGameRelease({ publication, entries });
  return { trusted, publication, entries, release, bytes: Buffer.from(await release.blob.arrayBuffer()) };
}

describe("community release archive boundary", () => {
  it("preserves exact bytes and verifies against operator runtime, not uploaded hashes", async () => {
    const f = await fixture();
    const parsed = await validateReleaseArchive(f.bytes, async target => {
      expect(target).toBe(f.trusted.runtimeTarget);
      return f.trusted;
    });
    expect(parsed.manifest).toEqual(f.release.manifest);
    expect(parsed.bytes).toEqual(f.bytes);
    await expect(validateReleaseArchive(f.bytes, async () => { throw new Error("absent"); })).rejects.toThrow();
    const evil = await createGameRelease({ publication: f.publication,
      entries: f.entries.map(entry => entry.name === "player.js" ? { ...entry, bytes: jsonBytes("evil") } : entry) });
    await expect(validateReleaseArchive(Buffer.from(await evil.blob.arrayBuffer()), async () => f.trusted)).rejects.toThrow();
  });

  it("parses old manifests honestly but rejects their unsafe runtimes for new community uploads", async () => {
    const f = await fixture();
    const body = { sentinel: f.trusted.sentinel, format: f.trusted.format, projectSchema: f.trusted.projectSchema,
      saveSchemas: f.trusted.saveSchemas, collectorVersion: 1 as const,
      files: f.trusted.files, requiredAssets: f.trusted.requiredAssets };
    const old = { ...body, runtimeTarget: await sha256HexText(JSON.stringify(body)) };
    expect(await parseRuntimeManifest(old)).toEqual(old);
    await expect(parseRuntimeManifest({ ...old, capabilities: ["community-save-isolation-v1"] })).rejects.toThrow();
    expect(f.trusted.capabilities).toContain("community-save-isolation-v1");
    await expect(parseRuntimeManifest({ ...f.trusted, capabilities: [] })).rejects.toThrow();
    const publication = { ...f.publication, runtimeTarget: old.runtimeTarget };
    const release = await createGameRelease({ publication, entries: f.entries.map(entry => entry.name === "project.json"
      ? { ...entry, bytes: jsonBytes({ version: 4, meta: { publication } }) } : entry) });
    await expect(validateReleaseArchive(Buffer.from(await release.blob.arrayBuffer()), async () => old)).rejects.toThrow();
  });
  it("rejects duplicate, traversal, undeclared and untrusted executable entries", async () => {
    const f = await fixture();
    for (const name of ["project.json", "../outside.png", "extra.js", "extra.html"]) {
      const bytes = Buffer.from(await writeStoredZip([...f.entries,
        { name: "release.json", bytes: jsonBytes(f.release.manifest) },
        { name, bytes: jsonBytes("extra") }]).arrayBuffer());
      await expect(validateReleaseArchive(bytes, async () => f.trusted)).rejects.toThrow();
    }
    const declared = await createGameRelease({ publication: f.publication,
      entries: [...f.entries, { name: "extra.js", bytes: jsonBytes("evil") }] });
    await expect(validateReleaseArchive(Buffer.from(await declared.blob.arrayBuffer()), async () => f.trusted)).rejects.toThrow();
  });

  it("rejects tampered local names, truncated archives and trailing payloads", async () => {
    const f = await fixture();
    const renamed = Buffer.from(f.bytes);
    renamed[30] ^= 1;
    for (const bytes of [renamed, f.bytes.subarray(0, -1), Buffer.concat([f.bytes, Buffer.from("trailing")])]) {
      await expect(validateReleaseArchive(bytes, async () => f.trusted)).rejects.toThrow();
    }
  });

  it("rejects symlink attributes, compression, oversized files and excessive entry counts", async () => {
    const f = await fixture();
    const central = f.bytes.readUInt32LE(f.bytes.length - 6);
    const symlink = Buffer.from(f.bytes);
    symlink.writeUInt32LE(0xa1ff0000, central + 38);
    const compressed = Buffer.from(f.bytes);
    compressed.writeUInt16LE(8, central + 10);
    const oversized = Buffer.from(f.bytes);
    oversized.writeUInt32LE(64 * 1024 * 1024 + 1, central + 24);
    const excessive = Buffer.from(f.bytes);
    excessive.writeUInt16LE(4097, excessive.length - 12);
    for (const bytes of [symlink, compressed, oversized, excessive]) {
      await expect(validateReleaseArchive(bytes, async () => f.trusted)).rejects.toThrow();
    }
  });

  it("checks the pinned runtime project schema without current editor normalization", async () => {
    const f = await fixture();
    const wrongSchema = await createGameRelease({ publication: f.publication, entries: f.entries.map(entry => entry.name === "project.json"
      ? { ...entry, bytes: jsonBytes({ version: 3, meta: { publication: f.publication } }) } : entry) });
    await expect(validateReleaseArchive(Buffer.from(await wrongSchema.blob.arrayBuffer()), async () => f.trusted).then(() => "accepted")).rejects.toThrow();
  });
});
