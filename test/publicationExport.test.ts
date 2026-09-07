import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";
import { sha256HexBytes, sha256HexText } from "@/util/sha256";
import { createBlankProject } from "@/project/defaults";
import { prepareWebExport, createWebPlayerExportPackage } from "@/project/webExport";
import { createStandaloneHtmlExport } from "@/project/standaloneExport";
import { createRuntimeManifest, jsonBytes, verifyGameRelease } from "@/project/gameRelease";
import { preparePublication } from "@/project/publication";
import { buildReleaseCollector } from "../scripts/lib/releaseCollectorBuild.mjs";
import { operatorRuntimeWithCollector } from "../community-site/lib/releaseArchive";

const collector = await buildReleaseCollector(process.cwd());

async function fixture(legacyRuntime = false) {
  const project = createBlankProject();
  const assets = prepareWebExport(project).assets.filter(asset => asset.kind === "public");
  const entries = [
    { name: "web/player.html", bytes: new TextEncoder().encode("<html><head></head></html>") },
    { name: "web/player.js", bytes: new TextEncoder().encode("trusted web") },
    { name: "web/sdk-manifest.json", bytes: jsonBytes({ sdk: 1 }) },
    ...(!legacyRuntime ? [{ name: "web/dependency-collector.js", bytes: collector },
      { name: "standalone/dependency-collector.js", bytes: collector }] : []),
    { name: "standalone/standalone.js", bytes: new TextEncoder().encode("window.booted=true;") },
    { name: "standalone/standalone.css", bytes: new TextEncoder().encode("body{color:red}") },
    { name: "standalone/sdk-manifest.json", bytes: jsonBytes({ standalone: 1 }) },
    ...assets.map(asset => ({ name: `public/${asset.zipPath}`, bytes: new TextEncoder().encode(`retained:${asset.zipPath}`) })),
  ];
  let runtime = await createRuntimeManifest(entries, []);
  if (legacyRuntime) {
    const { runtimeTarget: _target, capabilities: _capabilities, ...body } = runtime;
    runtime = { ...body, runtimeTarget: await sha256HexText(JSON.stringify(body)) };
  }
  project.meta.publication = preparePublication(runtime.runtimeTarget);
  const requests: string[] = [];
  const fetchBytes = async (url: string) => {
    requests.push(url);
    const base = `/runtime-archive/${runtime.runtimeTarget}/`;
    if (!url.startsWith(base)) throw new Error(`Unexpected current dependency: ${url}`);
    const name = url.slice(base.length);
    if (name === "runtime.json") return jsonBytes(runtime);
    const found = entries.find(entry => entry.name === name);
    if (!found) throw new Error("Missing archived file");
    return found.bytes;
  };
  const operator = legacyRuntime ? undefined : await operatorRuntimeWithCollector(runtime, collector);
  return { project, runtime, fetchBytes, requests, collectDependencies: operator?.collectDependencies };
}
describe("actual publication exports", () => {
  it("exports a verified ZIP without reading current dependencies", async () => {
    const { project, runtime, fetchBytes, collectDependencies } = await fixture();
    const result = await createWebPlayerExportPackage(project, { fetchBytes });
    const release = await verifyGameRelease(new Uint8Array(await result.blob.arrayBuffer()), runtime, collectDependencies);
    expect(release.manifest.publication).toEqual(project.meta.publication);
    expect(new TextDecoder().decode(release.entries.get("player.js"))).toBe("trusted web");
  });
  it("embeds provenance with transformed script/style and decoded asset digests", async () => {
    const { project, fetchBytes, runtime } = await fixture();
    const result = await createStandaloneHtmlExport(project, { fetchBytes });
    const html = await result.blob.text();
    const payload = /id="oprn-release-provenance">([^<]+)<\/script>/.exec(html)?.[1];
    expect(payload).toBeDefined();
    const manifest = JSON.parse(payload ?? "{}");
    expect(manifest.publication.runtimeTarget).toBe(runtime.runtimeTarget);
    expect(manifest.releaseId).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.files.map((file: { path: string }) => file.path)).toEqual(expect.arrayContaining(["standalone.js", "standalone.css", "project.json"]));
  });
  it("fails both exports when the selected engine is absent", async () => {
    const { project } = await fixture();
    const fetchBytes = async () => { throw new Error("archive unavailable"); };
    await expect(createWebPlayerExportPackage(project, { fetchBytes })).rejects.toThrow();
    await expect(createStandaloneHtmlExport(project, { fetchBytes })).rejects.toThrow();
  });
  it.each([false, true])("boots verified payloads (legacy runtime: %s) but rejects coherent executable tampering", async legacyRuntime => {
    const { project, fetchBytes } = await fixture(legacyRuntime);
    const html = await (await createStandaloneHtmlExport(project, { fetchBytes })).blob.text();
    const nodes = new Map([...html.matchAll(/<script type="application\/json" id="([^"]+)">([^<]*)<\/script>/g)]
      .map(match => [match[1], { textContent: match[2] }]));
    nodes.set("app", { textContent: "" });
    const bootstrap = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
    if (!bootstrap) throw new Error("Missing bootstrap");
    const appended: { tag: string; textContent: string }[] = [];
    const document = { getElementById: (id: string) => nodes.get(id), createElement: (tag: string) => ({ tag, textContent: "" }),
      head: { append: (node: { tag: string; textContent: string }) => appended.push(node) },
      body: { append: (node: { tag: string; textContent: string }) => appended.push(node) } };
    const errors: unknown[] = [];
    const run = () => runInNewContext(bootstrap, { document, crypto: webcrypto, atob, Uint8Array, TextDecoder, TextEncoder,
      console: { error: (...args: unknown[]) => errors.push(args) } });
    await run();
    expect(appended.find(node => node.tag === "script")?.textContent).toBe("window.booted=true;");
    appended.length = 0;
    const provenanceNode = nodes.get("oprn-release-provenance"), payloadNode = nodes.get("oprn-release-payloads");
    if (!provenanceNode || !payloadNode) throw new Error("Missing provenance");
    const provenance = JSON.parse(provenanceNode.textContent);
    const payload = JSON.parse(payloadNode.textContent);
    if (!legacyRuntime) {
      const assetNode = nodes.get("oprn-standalone-assets");
      if (!assetNode) throw new Error("Missing assets");
      const originalAssets = assetNode.textContent;
      const originalProvenance = provenanceNode.textContent;
      for (const extension of [".png", ".mp3"]) {
        const assets = JSON.parse(originalAssets);
        const name = Object.keys(assets).find(path => path.endsWith(extension));
        if (!name) throw new Error("Missing omission fixture");
        expect(provenance.runtime.requiredAssets).not.toContain(name);
        delete assets[name];
        const { releaseId: _id, ...body } = JSON.parse(originalProvenance);
        body.files = body.files.filter((file: { path: string }) => file.path !== name);
        assetNode.textContent = JSON.stringify(assets);
        provenanceNode.textContent = JSON.stringify({ ...body, releaseId: await sha256HexText(JSON.stringify(body)) });
        errors.length = 0;
        await run();
        expect(appended).toEqual([]);
        expect(errors.length).toBeGreaterThan(0);
      }
      assetNode.textContent = originalAssets;
      provenanceNode.textContent = originalProvenance;
    }
    const evil = new TextEncoder().encode("window.evil=true;");
    payload["standalone.js"] = btoa(new TextDecoder().decode(evil));
    for (const file of provenance.files) if (file.path === "standalone.js") {
      file.bytes = evil.length; file.sha256 = await sha256HexBytes(evil);
    }
    const { releaseId: _releaseId, ...body } = provenance;
    provenance.releaseId = await sha256HexText(JSON.stringify(body));
    provenanceNode.textContent = JSON.stringify(provenance); payloadNode.textContent = JSON.stringify(payload);
    await run();
    expect(appended).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });
});
