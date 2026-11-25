import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { ensureOnDemandAsset, ONDEMAND_MANIFEST_FILE, onDemandAssetFor, parseOnDemandManifest } from "../electron/main/assetsOnDemand";
import { planOnDemand } from "../scripts/desktop-ondemand-assets.mjs";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "ondemand-"));
  roots.push(root);
  return root;
}
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const blob = (bytes: Uint8Array) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const BASE = "https://raw.githubusercontent.com/MovieHolic-Plex/OpenRPGMaker/abc123/public/";

it("accepts only an https manifest with sized, hashed entries", () => {
  const files = { "assets/a.png": [3, "0".repeat(64)] };
  expect(parseOnDemandManifest({ base: BASE, files })).not.toBeNull();
  expect(parseOnDemandManifest({ base: "http://example.com/x/", files })).toBeNull();
  expect(parseOnDemandManifest({ base: BASE, files: { "assets/a.png": [3, "nothex"] } })).toBeNull();
});

it("maps a percent-encoded app path to the commit-pinned public URL and ignores unlisted paths", () => {
  const manifest = parseOnDemandManifest({ base: BASE, files: { "assets/shared/portraits/a b/bust-base.png": [3, "1".repeat(64)] } });
  expect(onDemandAssetFor(manifest, "assets/shared/portraits/a%20b/bust-base.png")?.url).toBe(`${BASE}assets/shared/portraits/a%20b/bust-base.png`);
  expect(onDemandAssetFor(manifest, "assets/shared/portraits/other.png")).toBeUndefined();
  expect(onDemandAssetFor(manifest, "constructor")).toBeUndefined();
});

it("downloads a listed file once, stores it under its hash and rejects bytes that do not match", async () => {
  const renderer = tempRoot();
  const cache = join(tempRoot(), "cache");
  const good = new Uint8Array([1, 2, 3, 4]);
  writeFileSync(join(renderer, ONDEMAND_MANIFEST_FILE), JSON.stringify({
    base: BASE,
    files: { "assets/region-references/a.oprn.json": [4, sha(good)], "assets/region-references/b.oprn.json": [4, sha(good)] },
  }));
  const asked: string[] = [];
  const serve = (bytes: Uint8Array): typeof fetch => async (input) => {
    asked.push(String(input));
    return new Response(bytes.slice().buffer);
  };
  const path = await ensureOnDemandAsset(renderer, "assets/region-references/a.oprn.json", cache, serve(good));
  expect(path).toBe(join(cache, `${sha(good)}.json`));
  expect([...readFileSync(path!)]).toEqual([...good]);
  expect(asked).toEqual([`${BASE}assets/region-references/a.oprn.json`]);
  expect(await ensureOnDemandAsset(renderer, "assets/region-references/a.oprn.json", cache, serve(good))).toBe(path);
  expect(asked).toHaveLength(1);

  const otherCache = join(tempRoot(), "cache");
  expect(await ensureOnDemandAsset(renderer, "assets/region-references/b.oprn.json", otherCache, serve(new Uint8Array([9, 9, 9, 9])))).toBeNull();
  expect(await ensureOnDemandAsset(renderer, "assets/unlisted.png", otherCache, serve(good))).toBeNull();
});

it("keeps demo-used portrait folders and files that differ from the commit, moves the rest", () => {
  const dist = tempRoot();
  const write = (rel: string, bytes: Uint8Array) => {
    mkdirSync(join(dist, rel, ".."), { recursive: true });
    writeFileSync(join(dist, rel), bytes);
    return bytes;
  };
  const used = write("assets/shared/portraits/people1-boy/bust-happy.png", new Uint8Array([1]));
  const free = write("assets/shared/portraits/people2-lion/bust-base.png", new Uint8Array([2]));
  write("assets/shared/portraits/people3-cat/bust-base.png", new Uint8Array([3]));
  const place = write("assets/region-references/gungnae.oprn.json", new Uint8Array([4]));
  write("assets/region-references/gungnae.png", new Uint8Array([5]));
  const blobs = new Map([
    ["assets/shared/portraits/people1-boy/bust-happy.png", blob(used)],
    ["assets/shared/portraits/people2-lion/bust-base.png", blob(free)],
    ["assets/shared/portraits/people3-cat/bust-base.png", blob(new Uint8Array([99]))],
    ["assets/region-references/gungnae.oprn.json", blob(place)],
  ]);
  const plan = planOnDemand({ distDir: dist, blobs, demos: '{"faceResourceId":"shared-people1-boy-expressions-02","faces":[{"assetId":"shared-people2-lion-expressions-00"}]}' });
  expect(plan.moved.map((item: { rel: string }) => item.rel).sort()).toEqual(["assets/region-references/gungnae.oprn.json", "assets/shared/portraits/people2-lion/bust-base.png"]);
  expect(plan.kept.demo).toEqual(["assets/shared/portraits/people1-boy/bust-happy.png"]);
  expect(plan.kept.untracked).toEqual(["assets/shared/portraits/people3-cat/bust-base.png"]);
});
