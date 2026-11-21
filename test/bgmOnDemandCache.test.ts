import { lstatSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { ensureCachedTrack } from "../electron/main/bgmOnDemand";

const roots: string[] = [];
const track = { fileName: "rtp-fld-001-test.mp3", bytes: 4, sha256: "abcd" };
const fetch404: typeof fetch = async () => new Response(null, { status: 404 });

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("does not follow a cache directory or file that is a symlink", async () => {
  const root = mkdtempSync(join(tmpdir(), "bgm-cache-"));
  roots.push(root);
  const outside = join(root, "outside");
  mkdirSync(outside, { mode: 0o700 });
  writeFileSync(join(outside, "secret.txt"), "secret");
  const linkedDir = join(root, "linked-dir");
  symlinkSync(outside, linkedDir);
  expect(await ensureCachedTrack(track, linkedDir, fetch404)).toBeNull();

  const cache = join(root, "owned");
  mkdirSync(cache, { mode: 0o700 });
  symlinkSync(join(outside, "secret.txt"), join(cache, track.fileName));
  expect(await ensureCachedTrack(track, cache, fetch404)).toBeNull();
  expect(lstatSync(join(cache, track.fileName)).isSymbolicLink()).toBe(true);
});
