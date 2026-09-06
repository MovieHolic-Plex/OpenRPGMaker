import { describe, expect, it } from "vitest";
import { preparePublication } from "@/project/publication";
import { createGameRelease, verifyGameRelease, createRuntimeManifest } from "@/project/gameRelease";
import { writeStoredZip } from "@/project/packageZip";

const bytes = (value: string) => new TextEncoder().encode(value);
async function fixture() {
  const runtimeEntries = [
    { name: "web/player.html", bytes: bytes('<script src="./player.js"></script>') },
    { name: "web/player.js", bytes: bytes("trusted executable") },
    { name: "web/sdk-manifest.json", bytes: bytes("sdk") },
    { name: "standalone/standalone.js", bytes: bytes("trusted standalone") },
    { name: "standalone/standalone.css", bytes: bytes("body{}") },
    { name: "public/assets/runtime.png", bytes: bytes("retained image") },
  ];
  const runtime = await createRuntimeManifest(runtimeEntries);
  const publication = preparePublication(runtime.runtimeTarget);
  const project = { version: 4, meta: { publication } };
  const entries = runtimeEntries.filter(entry => entry.name.startsWith("web/") || entry.name.startsWith("public/"))
    .map(entry => ({ ...entry, name: entry.name.replace(/^(web|public)\//, "") }));
  entries.push({ name: "project.json", bytes: bytes(JSON.stringify(project, null, 2) + "\n") });
  return { runtime, publication, entries };
}
describe("content-addressed game release", () => {
  it("binds exact project, SDK, runtime and assets to a trusted target", async () => {
    const { runtime, publication, entries } = await fixture();
    const release = await createGameRelease({ publication, entries });
    const verified = await verifyGameRelease(new Uint8Array(await release.blob.arrayBuffer()), runtime);
    expect(verified.manifest.releaseId).toBe(release.manifest.releaseId);
    expect(verified.entries.get("project.json")).toEqual(entries.at(-1)?.bytes);
    expect(verified.manifest.files.some(file => file.path === "release.json")).toBe(false);
  });
  it.each(["tamper", "duplicate", "traversal", "missing", "undeclared"])("rejects %s payloads", async (kind) => {
    const { runtime, publication, entries } = await fixture();
    const release = await createGameRelease({ publication, entries });
    const altered = [...entries, { name: "release.json", bytes: bytes(JSON.stringify(release.manifest)) }];
    switch (kind) {
      case "tamper": altered[1] = { name: "player.js", bytes: bytes("evil") }; break;
      case "duplicate": altered.push(entries[0]); break;
      case "traversal": altered.push({ name: "../evil", bytes: bytes("evil") }); break;
      case "missing": altered.shift(); break;
      case "undeclared": altered.push({ name: "extra", bytes: bytes("extra") }); break;
    }
    const zip = new Uint8Array(await writeStoredZip(altered).arrayBuffer());
    await expect(verifyGameRelease(zip, runtime)).rejects.toThrow();
  });
  it("rejects self-consistent attacker executable hashes against operator trust", async () => {
    const { runtime, publication, entries } = await fixture();
    entries[1] = { name: "player.js", bytes: bytes("evil") };
    const release = await createGameRelease({ publication, entries });
    await expect(verifyGameRelease(new Uint8Array(await release.blob.arrayBuffer()), runtime)).rejects.toThrow();
  });
  it("rejects an unavailable or different runtime, never substituting latest", async () => {
    const { runtime, publication, entries } = await fixture();
    const release = await createGameRelease({ publication, entries });
    const zip = new Uint8Array(await release.blob.arrayBuffer());
    await expect(verifyGameRelease(zip, undefined)).rejects.toThrow();
    await expect(verifyGameRelease(zip, { ...runtime, runtimeTarget: "b".repeat(64) })).rejects.toThrow();
  });
});
