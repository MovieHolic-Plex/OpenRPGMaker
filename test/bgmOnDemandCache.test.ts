import { createHash } from "node:crypto";
import { lstatSync, mkdtempSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { cacheDirectoryAccepted, ensureCachedTrack } from "../electron/main/bgmOnDemand";

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

it("accepts a Windows cache whose mode has group and other write bits and serves a stored track", async () => {
  const windowsDir = { isDirectory: () => true, uid: 0, mode: 0o40777 };
  expect(cacheDirectoryAccepted(windowsDir, "win32", undefined)).toBe(true);
  expect(cacheDirectoryAccepted(windowsDir, "linux", 1000)).toBe(false);
  expect(cacheDirectoryAccepted({ isDirectory: () => true, uid: 1000, mode: 0o40700 }, "linux", 1000)).toBe(true);
  expect(cacheDirectoryAccepted({ isDirectory: () => true, uid: 0, mode: 0o40700 }, "linux", 1000)).toBe(false);

  const root = mkdtempSync(join(tmpdir(), "bgm-cache-"));
  roots.push(root);
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const ready = { fileName: "ready.mp3", bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
  writeFileSync(join(root, ready.fileName), bytes);
  expect(await ensureCachedTrack(ready, root, fetch404)).toBe(join(root, ready.fileName));
});

it("drops the temporary file when a cache write cannot finish", async () => {
  const root = mkdtempSync(join(tmpdir(), "bgm-cache-"));
  roots.push(root);
  const bytes = new Uint8Array([9, 9, 9, 9]);
  const trackInMissingDir = {
    fileName: "missing-dir/track.mp3",
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  expect(await ensureCachedTrack(trackInMissingDir, root, async () => new Response(body))).toBeNull();
  expect(readdirSync(root).filter((name) => name.endsWith(".part"))).toEqual([]);
});
