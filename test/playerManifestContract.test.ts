import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { readStoredZipEntry, readStoredZipEntryNames } from "@/project/packageZip";
import {
  WEB_PLAYER_MANIFEST,
  collectWebExportAssets,
  createWebPlayerExportPackage,
  discoverWebPlayerBundleFiles,
  prepareWebExport,
} from "@/project/webExport";
import { loadVerifiedPlayerDeployment } from "@/project/playerDeploymentManifest";
import { unicodeCaseFoldKey } from "@/project/unicodeCaseFold.js";
import { sha256HexBytes, sha256HexText } from "@/util/sha256";
import {
  createPlayerDeploymentManifest,
  parsePlayerDeploymentManifest,
} from "../scripts/lib/playerDeploymentManifest.mjs";

const encoder = new TextEncoder();
const BUNDLE_BASE = "/export-player/";
const RUNTIME_ASSET_PATH = "assets/runtime-required.png";

type FileRecord = {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
};

type FixtureOptions = {
  readonly manifestMode?: "valid" | "missing" | "malformed";
  readonly omitArtifactRecord?: string;
  readonly extraArtifact?: readonly [path: string, contents: string];
  readonly viteCss?: boolean;
  readonly viteManifestText?: string;
  readonly unavailablePath?: string;
  readonly tamperedPath?: string;
  readonly interruptPath?: string;
  readonly runtimeCaseCollision?: boolean;
  readonly viteCaseCollision?: boolean;
  readonly viteCollisionPaths?: readonly [string, string];
  readonly reservedZipCollision?: boolean;
  readonly reservedZipPath?: string;
  readonly mutateManifest?: (manifest: Record<string, unknown>) => void;
};

type DeploymentFixture = {
  readonly artifactBytes: ReadonlyMap<string, Uint8Array>;
  readonly artifactPaths: readonly string[];
  readonly runtimeBytes: Uint8Array;
  readonly fetchBytes: (requestPath: string) => Promise<Uint8Array>;
};

describe("player deployment manifest", () => {
  it.each([
    ["Cyrillic U+1C89 drift", "assets/\u1c89.js", "assets/\u1c8a.js"],
    ["Garay U+10D50 drift", "assets/\u{10d50}.js", "assets/\u{10d70}.js"],
  ])("uses pinned Unicode 15 semantics for post-version %s", (_name, left, right) => {
    expect(unicodeCaseFoldKey(left)).not.toBe(unicodeCaseFoldKey(right));
  });

  it("emits one coherent Node build contract for the complete Vite closure", async () => {
    const viteManifestValue = {
      "player.html": {
        file: "player.js",
        isEntry: true,
        css: ["assets/player.css"],
        dynamicImports: ["scene"],
      },
      scene: { file: "assets/chunk.js" },
    };
    const files = await recordsFor(new Map([
      ["assets/chunk.js", encoder.encode("chunk")],
      ["assets/player.css", encoder.encode("css")],
      ["player-manifest.json", encoder.encode(JSON.stringify(viteManifestValue))],
      ["player.html", encoder.encode("html")],
      ["player.js", encoder.encode("entry")],
    ]));
    const sourceInputs = await recordsFor(new Map([["src/player/exportEntry.ts", encoder.encode("source")]]));
    const runtimeAssets = await recordsFor(new Map([[RUNTIME_ASSET_PATH, encoder.encode("runtime")]]));

    const manifest = createPlayerDeploymentManifest({
      files,
      sourceInputs,
      runtimeAssets,
      viteManifestValue,
      sourceRevision: "fixture-revision",
      builtAt: "2026-07-22T00:00:00.000Z",
    });
    const parsed = parsePlayerDeploymentManifest(manifest, { viteManifestValue });

    expect(parsed.deployment.artifactPaths).toEqual(files.map((record) => record.path));
    expect(parsed.deployment.runtimeAssets).toEqual(runtimeAssets);
    expect(parsed.deployment.deploymentDigest).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("rejects export when the authoritative manifest is unavailable even if player.js exists", async () => {
    const fixture = await deploymentFixture({ manifestMode: "missing" });

    await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
      code: "manifest-unavailable",
    });
  });

  it("rejects export when the authoritative manifest is malformed", async () => {
    const fixture = await deploymentFixture({ manifestMode: "malformed" });

    await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
      code: "manifest-malformed",
    });
  });

  it.each([
    ["sentinel", (manifest: Record<string, unknown>) => { manifest["sentinel"] = "misleading-manifest"; }],
    ["contract schema", (manifest: Record<string, unknown>) => { manifest["schemaVersion"] = 999; }],
    ["source digest", (manifest: Record<string, unknown>) => { manifest["sourceDigest"] = "0".repeat(64); }],
    ["artifact digest", (manifest: Record<string, unknown>) => { manifest["artifactDigest"] = "0".repeat(64); }],
    ["deployment schema", (manifest: Record<string, unknown>) => {
      mutableRecord(manifest["deployment"])["schemaVersion"] = 999;
    }],
    ["deployment entry path", (manifest: Record<string, unknown>) => {
      mutableRecord(manifest["deployment"])["entryHtml"] = "alternate.html";
    }],
    ["traversal path", (manifest: Record<string, unknown>) => {
      mutableFirstRecord(manifest["files"])["path"] = "../outside.js";
    }],
    ["absolute path", (manifest: Record<string, unknown>) => {
      mutableFirstRecord(manifest["files"])["path"] = "C:/outside.js";
    }],
    ["encoded traversal path", (manifest: Record<string, unknown>) => {
      mutableFirstRecord(manifest["files"])["path"] = "%2e%2e/outside.js";
    }],
  ])("rejects an incoherent %s without exposing manifest values", async (_name, mutateManifest) => {
    const fixture = await deploymentFixture({ mutateManifest });

    await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
      code: "manifest-contract-mismatch",
    });
  });

  it("rejects a manifest whose CSS dependency is absent from the exact artifact set", async () => {
    const fixture = await deploymentFixture({ omitArtifactRecord: "assets/player.css" });

    await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
      code: "manifest-incomplete",
    });
  });

  it("rejects an undeclared stale chunk in the exact artifact set", async () => {
    const fixture = await deploymentFixture({ extraArtifact: ["assets/stale.js", "stale"] });

    await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
      code: "manifest-incomplete",
    });
  });

  it("rejects an entry graph with no stylesheet", async () => {
    const fixture = await deploymentFixture({ viteCss: false, omitArtifactRecord: "assets/player.css" });

    await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
      code: "manifest-incomplete",
    });
  });

  it("rejects a malformed transitive Vite manifest even when its own hash is valid", async () => {
    const fixture = await deploymentFixture({ viteManifestText: "{not-json" });

    await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
      code: "manifest-incomplete",
    });
  });

  it("rejects case-insensitive collisions in the Vite output closure", async () => {
    const fixture = await deploymentFixture({ viteCaseCollision: true });

    await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
      code: "manifest-path-collision",
    });
  });

  it.each([
    ["sharp-s", "assets/Straße.js", "assets/STRASSE.js"],
    ["Greek final sigma", "assets/ος.js", "assets/οσ.js"],
    ["compatibility ligature", "assets/ﬃ.js", "assets/ffi.js"],
    ["NFC composition", "assets/café.js", "assets/cafe\u0301.js"],
  ])("rejects a portable Unicode %s collision in the browser manifest", async (_name, left, right) => {
    const fixture = await deploymentFixture({ viteCollisionPaths: [left, right] });

    await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
      code: "manifest-path-collision",
    });
  });

  it("rejects case-insensitive collisions in declared runtime assets", async () => {
    const fixture = await deploymentFixture({ runtimeCaseCollision: true });

    await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
      code: "manifest-path-collision",
    });
  });

  it.each([
    ["missing chunk", { unavailablePath: "assets/chunk.js" }, "bundle-unavailable"],
    ["tampered chunk", { tamperedPath: "assets/chunk.js" }, "bundle-integrity-mismatch"],
    ["wrong chunk byte count", { tamperedPath: "player.js" }, "bundle-integrity-mismatch"],
    ["missing runtime asset", { unavailablePath: RUNTIME_ASSET_PATH }, "runtime-asset-unavailable"],
    ["tampered runtime asset", { tamperedPath: RUNTIME_ASSET_PATH }, "runtime-asset-integrity-mismatch"],
    ["interrupted bundle read", { interruptPath: "assets/chunk.js" }, "bundle-unavailable"],
  ])("rejects %s before ZIP success", async (_name, options, expectedCode) => {
    const fixture = await deploymentFixture(options);

    await expect(discoverWebPlayerBundleFiles(BUNDLE_BASE, fixture.fetchBytes)).rejects.toMatchObject({
      code: expectedCode,
    });
  });

  it("returns a value-free actionable error for a failed dependency read", async () => {
    const sensitiveMarker = `sk-${"T".repeat(32)}`;
    const hostPath = "C:/private/build/player.js";
    const fixture = await deploymentFixture({ unavailablePath: "player.js" });
    const failingFetch = async (requestPath: string): Promise<Uint8Array> => {
      if (requestPath.endsWith("player.js")) throw new Error(`${hostPath}:${sensitiveMarker}`);
      return fixture.fetchBytes(requestPath);
    };

    const error = await discoverWebPlayerBundleFiles(BUNDLE_BASE, failingFetch).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "bundle-unavailable" });
    expect(String(error)).not.toContain(hostPath);
    expect(String(error)).not.toContain(sensitiveMarker);
  });

  it.each([
    ["manifest string", WEB_PLAYER_MANIFEST, `C:/private/${"manifest-canary"}`, "manifest-unavailable"],
    ["bundle object", "player.js", { canary: "bundle-canary", hostPath: "C:/private/player.js" }, "bundle-unavailable"],
    ["runtime string", RUNTIME_ASSET_PATH, `C:/private/${"runtime-canary"}`, "runtime-asset-unavailable"],
  ])("redacts a non-Error %s throw into a typed export failure", async (_name, failingPath, thrownValue, expectedCode) => {
    const fixture = await deploymentFixture();
    const failingFetch = async (requestPath: string): Promise<Uint8Array> => {
      if (requestPath.endsWith(failingPath)) throw thrownValue;
      return fixture.fetchBytes(requestPath);
    };

    const error = await discoverWebPlayerBundleFiles(BUNDLE_BASE, failingFetch).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: expectedCode });
    expect(JSON.stringify(error)).not.toContain("canary");
    expect(String(error)).not.toContain("C:/private");
  });

  it("redacts a non-Error manifest parser failure", async () => {
    const fixture = await deploymentFixture();
    const error = await loadVerifiedPlayerDeployment({
      bundleBase: BUNDLE_BASE,
      adapters: {
        fetchBytes: fixture.fetchBytes,
        parseJson: () => { throw `C:/private/${"parser-canary"}`; },
      },
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "manifest-malformed" });
    expect(String(error)).not.toContain("parser-canary");
    expect(String(error)).not.toContain("C:/private");
  });

  it("redacts a non-Error manifest hash failure", async () => {
    const fixture = await deploymentFixture();
    const error = await loadVerifiedPlayerDeployment({
      bundleBase: BUNDLE_BASE,
      adapters: {
        fetchBytes: fixture.fetchBytes,
        hashText: async () => { throw { canary: "manifest-hash-canary", hostPath: "C:/private/hash" }; },
      },
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "manifest-contract-mismatch" });
    expect(JSON.stringify(error)).not.toContain("canary");
    expect(String(error)).not.toContain("C:/private");
  });

  it("redacts a non-Error bundle hash failure", async () => {
    const fixture = await deploymentFixture();
    const error = await loadVerifiedPlayerDeployment({
      bundleBase: BUNDLE_BASE,
      adapters: {
        fetchBytes: fixture.fetchBytes,
        hashBytes: async () => { throw `C:/private/${"bundle-hash-canary"}`; },
      },
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "bundle-integrity-mismatch" });
    expect(String(error)).not.toContain("bundle-hash-canary");
    expect(String(error)).not.toContain("C:/private");
  });

  it("rejects a deployment path that case-collides with generated project.json", async () => {
    const fixture = await deploymentFixture({ reservedZipCollision: true });

    await expect(createWebPlayerExportPackage(createBlankProject(), {
      bundleBase: BUNDLE_BASE,
      fetchBytes: fixture.fetchBytes,
    })).rejects.toMatchObject({ code: "zip-path-collision" });
  });

  it("rejects case-colliding generated uploaded-asset paths", async () => {
    const fixture = await deploymentFixture();
    const project = createBlankProject();
    const firstItem = project.database.items[0];
    if (firstItem === undefined) throw new TypeError("fixture database item expected");
    project.assets.uploaded = {
      Hero: uploadedPicture("Hero"),
      hero: uploadedPicture("hero"),
    };
    project.database.items[0] = {
      ...firstItem,
      imageResourceId: "Hero",
      iconResourceId: "hero",
    };

    await expect(createWebPlayerExportPackage(project, {
      bundleBase: BUNDLE_BASE,
      fetchBytes: fixture.fetchBytes,
    })).rejects.toMatchObject({ code: "zip-path-collision" });
  });

  it("rejects a full-casefold collision across deployment and generated ZIP entries", async () => {
    const fixture = await deploymentFixture({ reservedZipPath: "assets/uploaded/STRASSE.png" });
    const project = createBlankProject();
    const firstItem = project.database.items[0];
    if (firstItem === undefined) throw new TypeError("fixture database item expected");
    project.assets.uploaded = { Straße: uploadedPicture("Straße") };
    project.database.items[0] = { ...firstItem, imageResourceId: "Straße" };

    await expect(createWebPlayerExportPackage(project, {
      bundleBase: BUNDLE_BASE,
      fetchBytes: fixture.fetchBytes,
    })).rejects.toMatchObject({ code: "zip-path-collision" });
  });

  it("writes the exact verified deployment closure and project payload into the ZIP", async () => {
    const fixture = await deploymentFixture();
    const project = createBlankProject();

    const result = await createWebPlayerExportPackage(project, {
      bundleBase: BUNDLE_BASE,
      fetchBytes: fixture.fetchBytes,
    });
    const zipBytes = new Uint8Array(await result.blob.arrayBuffer());
    const projectAssetPaths = collectWebExportAssets(prepareWebExport(project).project).map((asset) => asset.zipPath);
    const expectedPaths = [...new Set([
      "project.json",
      ...fixture.artifactPaths,
      RUNTIME_ASSET_PATH,
      ...projectAssetPaths,
    ])].sort((left, right) => left.localeCompare(right));

    expect(readStoredZipEntryNames(zipBytes)).toEqual(expectedPaths);
    for (const [filePath, bytes] of fixture.artifactBytes) {
      expect(await digestZipEntry(zipBytes, filePath)).toBe(await sha256HexBytes(bytes));
    }
    expect(await digestZipEntry(zipBytes, RUNTIME_ASSET_PATH)).toBe(await sha256HexBytes(fixture.runtimeBytes));
    expect(result.summary.playerBundleFileCount).toBe(fixture.artifactPaths.length);
    expect(result.summary.zipEntryCount).toBe(expectedPaths.length);
  });
});

async function deploymentFixture(options: FixtureOptions = {}): Promise<DeploymentFixture> {
  const viteCollisionPaths = options.viteCollisionPaths
    ?? (options.viteCaseCollision ? ["assets/Chunk.js", "assets/chunk.js"] as const : undefined);
  const reservedZipPath = options.reservedZipPath ?? (options.reservedZipCollision ? "PROJECT.JSON" : undefined);
  const viteManifestValue = viteCollisionPaths !== undefined
    ? {
        "player.html": {
          file: "player.js",
          isEntry: true,
          css: options.viteCss === false ? undefined : ["assets/player.css"],
          dynamicImports: ["scene-upper", "scene-lower"],
        },
        "scene-upper": { file: viteCollisionPaths[0] },
        "scene-lower": { file: viteCollisionPaths[1] },
      }
    : {
        "player.html": {
          file: "player.js",
          isEntry: true,
          css: options.viteCss === false ? undefined : ["assets/player.css"],
          dynamicImports: ["src/player/PlayScene.ts"],
          assets: reservedZipPath === undefined ? undefined : [reservedZipPath],
        },
        "src/player/PlayScene.ts": {
          file: "assets/chunk.js",
        },
      };
  const viteManifestText = options.viteManifestText ?? JSON.stringify(viteManifestValue);
  const artifactBytes = new Map<string, Uint8Array>([
    ["assets/player.css", encoder.encode(".play-stage{display:block}")],
    ["player-manifest.json", encoder.encode(viteManifestText)],
    ["player.html", encoder.encode("<!doctype html><main id=app></main>")],
    ["player.js", encoder.encode("import './assets/chunk.js';")],
  ]);
  if (viteCollisionPaths === undefined) artifactBytes.set("assets/chunk.js", encoder.encode("export const chunk = true;"));
  else {
    artifactBytes.set(viteCollisionPaths[0], encoder.encode("first collision output"));
    artifactBytes.set(viteCollisionPaths[1], encoder.encode("second collision output"));
  }
  if (reservedZipPath !== undefined) artifactBytes.set(reservedZipPath, encoder.encode("reserved collision"));
  if (options.omitArtifactRecord !== undefined) artifactBytes.delete(options.omitArtifactRecord);
  if (options.extraArtifact !== undefined) artifactBytes.set(options.extraArtifact[0], encoder.encode(options.extraArtifact[1]));
  const artifactRecords = await recordsFor(artifactBytes);
  const sourceRecords = await recordsFor(new Map([["src/player/exportEntry.ts", encoder.encode("fixture source")]]));
  const runtimeBytes = encoder.encode("runtime asset bytes");
  const runtimeFileBytes = new Map([[RUNTIME_ASSET_PATH, runtimeBytes]]);
  if (options.runtimeCaseCollision) runtimeFileBytes.set("assets/Runtime-Required.png", runtimeBytes);
  const runtimeRecords = await recordsFor(runtimeFileBytes);
  const artifactDigest = await digestRecords(artifactRecords);
  const sourceDigest = await digestRecords(sourceRecords);
  const runtimeAssetDigest = await digestRecords(runtimeRecords);
  const deploymentDigest = await sha256HexText(JSON.stringify({
    artifactDigest,
    runtimeAssetDigest,
    entryHtml: "player.html",
    entryScript: "player.js",
    viteManifest: "player-manifest.json",
  }));
  const manifest: Record<string, unknown> = {
    sentinel: "rpg-zzu/player-sdk-manifest",
    contractVersion: 2,
    schemaVersion: 4,
    artifactVersion: artifactDigest.slice(0, 16),
    artifactDigest,
    sourceDigest,
    sourceRevision: "fixture-revision",
    builtAt: "2026-07-22T00:00:00.000Z",
    files: artifactRecords,
    sourceInputs: sourceRecords,
    deployment: {
      schemaVersion: 1,
      entryHtml: "player.html",
      entryScript: "player.js",
      viteManifest: "player-manifest.json",
      artifactPaths: artifactRecords.map((record) => record.path),
      runtimeAssets: runtimeRecords,
      runtimeAssetDigest,
      deploymentDigest,
    },
  };
  options.mutateManifest?.(manifest);
  const manifestBytes = options.manifestMode === "malformed"
    ? encoder.encode("{not-json")
    : encoder.encode(JSON.stringify(manifest));

  const fetchBytes = async (requestPath: string): Promise<Uint8Array> => {
    const relativePath = requestPath.startsWith(BUNDLE_BASE)
      ? requestPath.slice(BUNDLE_BASE.length)
      : requestPath.replace(/^\/+/, "");
    if (relativePath === WEB_PLAYER_MANIFEST) {
      if (options.manifestMode === "missing") throw new Error("fixture manifest unavailable");
      return manifestBytes;
    }
    if (relativePath === options.interruptPath) {
      const interruption = new Error("fixture interrupted");
      interruption.name = "AbortError";
      throw interruption;
    }
    if (relativePath === options.unavailablePath) throw new Error("fixture dependency unavailable");
    if (relativePath === options.tamperedPath) return encoder.encode("tampered fixture bytes");
    const artifact = artifactBytes.get(relativePath);
    if (artifact !== undefined) return artifact;
    if (relativePath.toLowerCase() === RUNTIME_ASSET_PATH.toLowerCase()) return runtimeBytes;
    return encoder.encode(`project-asset:${relativePath}`);
  };
  return {
    artifactBytes,
    artifactPaths: artifactRecords.map((record) => record.path),
    runtimeBytes,
    fetchBytes,
  };
}

async function recordsFor(files: ReadonlyMap<string, Uint8Array>): Promise<readonly FileRecord[]> {
  const records = await Promise.all([...files.entries()].map(async ([filePath, bytes]) => ({
    path: filePath,
    bytes: bytes.length,
    sha256: await sha256HexBytes(bytes),
  })));
  return records.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

function uploadedPicture(id: string): {
  readonly id: string;
  readonly name: string;
  readonly kind: "picture";
  readonly dataUrl: string;
  readonly meta: { readonly width: number; readonly height: number };
} {
  return {
    id,
    name: id,
    kind: "picture",
    dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    meta: { width: 1, height: 1 },
  };
}

async function digestRecords(records: readonly FileRecord[]): Promise<string> {
  return sha256HexText(JSON.stringify(records.map((record) => [record.path, record.bytes, record.sha256])));
}

function mutableRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("fixture record expected");
  return value;
}

function mutableFirstRecord(value: unknown): Record<string, unknown> {
  if (!Array.isArray(value)) throw new TypeError("fixture record array expected");
  const first = value[0];
  return mutableRecord(first);
}

async function digestZipEntry(zipBytes: Uint8Array, filePath: string): Promise<string> {
  const entry = readStoredZipEntry(zipBytes, filePath);
  if (entry === null) throw new TypeError("fixture ZIP entry expected");
  return sha256HexBytes(entry);
}
