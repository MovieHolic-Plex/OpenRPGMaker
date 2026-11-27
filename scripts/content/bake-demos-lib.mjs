// scripts/content/bake-demos-lib.mjs
// Pure helpers & BGM sync shared by bake-flagship-demos.mjs and bake-flagship-demos.mts.
import { createHash } from "node:crypto";
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync,
  renameSync, rmSync, statSync, utimesSync, writeFileSync,
} from "node:fs";
import { availableParallelism, totalmem } from "node:os";
import { join } from "node:path";

export const DEMO_ENTRY_FILES = Object.freeze({
  "chrono-bell": "src/project/flagship/chronoBell.ts",
  "emerald-crown": "src/project/flagship/emeraldCrown.ts",
  "shitamachi-fourth-season": "src/project/flagship/shitamachiFourthSeason.ts",
  "first-love": "src/project/flagship/firstLove.ts",
  "maou-konbini": "src/project/flagship/maouKonbini.ts",
});

/** Order heaviest demo first so worker pools start the critical path immediately. */
export const DEMO_WEIGHT_ORDER = Object.freeze([
  "chrono-bell",
  "first-love",
  "emerald-crown",
  "shitamachi-fourth-season",
  "maou-konbini",
]);

const BGM_CDN = "https://cheapcdn.sgp1.cdn.digitaloceanspaces.com/rpg-zzu/bgm/v1/";
const GIB = 1024 * 1024 * 1024;

/**
 * Hash package-lock.json while ignoring the root project's own release version bump
 * (`version` and `packages[""].version`). Any dependency change still changes the hash,
 * whereas `chore(release): vX.Y.Z` no longer invalidates every cached demo.
 */
export function normalizePackageLockForHash(rawText) {
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return rawText;
    const copy = { ...parsed };
    delete copy.version;
    if (copy.packages && typeof copy.packages === "object" && copy.packages[""] && typeof copy.packages[""] === "object") {
      const rootPkg = { ...copy.packages[""] };
      delete rootPkg.version;
      copy.packages = { ...copy.packages, "": rootPkg };
    }
    return JSON.stringify(copy);
  } catch {
    return rawText;
  }
}

/**
 * Choose safe worker concurrency for parallel demo baking based on CPU cores and RAM.
 * Each demo worker can temporarily peak around 4–8 GiB when building large demos.
 */
export function computeDemoConcurrency({
  missCount,
  cpuCount = availableParallelism(),
  totalMemBytes = totalmem(),
  envConcurrency = process.env.OPRN_BAKE_DEMOS_CONCURRENCY,
} = {}) {
  if (!Number.isFinite(missCount) || missCount <= 0) return 1;
  const override = envConcurrency !== undefined && envConcurrency !== "" ? Number(envConcurrency) : NaN;
  if (Number.isInteger(override) && override >= 1) return Math.min(missCount, override);
  const byCpu = Math.max(1, Math.floor(cpuCount / 4));
  const byRam = Math.max(1, Math.floor(totalMemBytes / (12 * GIB)));
  return Math.min(missCount, Math.max(1, Math.min(5, byCpu, byRam)));
}

/** Order demos heaviest-first so the critical-path demo starts immediately. */
export function sortDemosByWeight(demoIds) {
  const rank = new Map(DEMO_WEIGHT_ORDER.map((id, index) => [id, index]));
  return [...demoIds].sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999));
}

/**
 * Keep the N newest cache entries per demo ID under `<cacheDir>/v2/<id>-<64hex>`,
 * and prune legacy monolithic 64-hex directories down to at most 1 entry.
 */
export function prunePerDemoCache(cacheDir, keepPerDemo = 3) {
  const v2Dir = join(cacheDir, "v2");
  if (existsSync(v2Dir)) {
    const byDemo = new Map();
    for (const entry of readdirSync(v2Dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const match = /^(.+)-([a-f0-9]{64})$/.exec(entry.name);
      if (!match) continue;
      const demoId = match[1];
      const fullPath = join(v2Dir, entry.name);
      const list = byDemo.get(demoId) ?? [];
      list.push({ path: fullPath, mtime: statSync(fullPath).mtimeMs });
      byDemo.set(demoId, list);
    }
    for (const list of byDemo.values()) {
      list.sort((a, b) => b.mtime - a.mtime);
      for (const { path } of list.slice(keepPerDemo)) rmSync(path, { recursive: true, force: true });
    }
  }
  if (existsSync(cacheDir)) {
    const legacy = readdirSync(cacheDir, { withFileTypes: true })
      .filter((dir) => dir.isDirectory() && /^[a-f0-9]{64}$/.test(dir.name))
      .map(({ name }) => ({ path: join(cacheDir, name), mtime: statSync(join(cacheDir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const { path } of legacy.slice(1)) rmSync(path, { recursive: true, force: true });
  }
}

const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * Copy or download catalog BGM tracks referenced by baked demos into `<outDir>/assets/cc0/audio/catalog`.
 * Uses an optional content-addressed cache under `<cacheDir>/bgm/<sha256>.mp3` and parallel CDN downloads.
 */
export async function syncDemoBgm({ root, outDir, demoIds, cacheDir = null, concurrency = 6 }) {
  const demosDir = join(outDir, "demos");
  const manifest = JSON.parse(readFileSync(join(root, "assets/bgm-release-v1.json"), "utf8"));
  const used = new Map();
  for (const id of demoIds) {
    const file = join(demosDir, `${id}.project.json`);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const track of manifest.tracks) {
      if (text.includes(`"${track.id}"`)) used.set(track.fileName, track);
    }
  }
  const bgmDir = join(outDir, "assets/cc0/audio/catalog");
  mkdirSync(bgmDir, { recursive: true });
  const bgmCacheDir = cacheDir ? join(cacheDir, "bgm") : null;
  if (bgmCacheDir) mkdirSync(bgmCacheDir, { recursive: true });

  let copied = 0;
  let cached = 0;
  let downloaded = 0;
  const toDownload = [];
  const now = new Date();

  for (const track of used.values()) {
    const target = join(bgmDir, track.fileName);
    if (existsSync(target) && sha256Hex(readFileSync(target)) === track.sha256) continue;
    const local = join(root, "public/assets/cc0/audio/catalog", track.fileName);
    if (existsSync(local) && sha256Hex(readFileSync(local)) === track.sha256) {
      copyFileSync(local, target);
      copied += 1;
      continue;
    }
    if (bgmCacheDir) {
      const cachedFile = join(bgmCacheDir, `${track.sha256}.mp3`);
      if (existsSync(cachedFile) && sha256Hex(readFileSync(cachedFile)) === track.sha256) {
        copyFileSync(cachedFile, target);
        try { utimesSync(cachedFile, now, now); } catch { /* ignore */ }
        cached += 1;
        continue;
      }
    }
    toDownload.push(track);
  }

  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, toDownload.length) }, async () => {
    while (cursor < toDownload.length) {
      const track = toDownload[cursor++];
      const target = join(bgmDir, track.fileName);
      const response = await fetch(BGM_CDN + encodeURIComponent(track.fileName));
      if (!response.ok) throw new Error(`데모 BGM 을 받지 못했습니다: ${track.fileName} (${response.status})`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== track.bytes || sha256Hex(bytes) !== track.sha256) {
        throw new Error(`데모 BGM 해시가 다릅니다: ${track.fileName}`);
      }
      writeFileSync(target, bytes);
      if (bgmCacheDir) {
        const cachedFile = join(bgmCacheDir, `${track.sha256}.mp3`);
        const temp = `${cachedFile}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
        try {
          writeFileSync(temp, bytes);
          renameSync(temp, cachedFile);
        } catch {
          rmSync(temp, { force: true });
        }
      }
      downloaded += 1;
    }
  });
  await Promise.all(workers);

  const present = used.size - copied - cached - downloaded;
  console.log(`demo bgm: ${used.size} tracks (copied ${copied}, cached ${cached}, downloaded ${downloaded}, already present ${present})`);
  return { total: used.size, copied, cached, downloaded, present };
}
