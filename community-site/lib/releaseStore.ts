import type { Pool } from "pg";
import { parseReleaseManifest } from "../../src/project/gameRelease";
import { isRecord } from "../../src/project/playerDeploymentPaths";
import { manifestFromEntries, readReleaseEntries, releaseZipDigest, type RetainedRelease } from "./releaseArchive";

export type ReleaseListingInput = {
  readonly slug: string; readonly title: string; readonly description: string;
  readonly author: string; readonly tags: readonly string[]; readonly license: string;
  readonly coverDataUrl: string | null;
};

/** No update/upsert path: publication.gameId never confers listing ownership. */
export async function insertReleaseListing(pool: Pool, input: ReleaseListingInput, release: RetainedRelease): Promise<void> {
  const project: unknown = JSON.parse(new TextDecoder().decode(release.entries.get("project.json")));
  const maps = isRecord(project) && isRecord(project.maps) ? Object.keys(project.maps).length : 0;
  const assets = isRecord(project) && isRecord(project.assets) && isRecord(project.assets.uploaded) ? Object.keys(project.assets.uploaded).length : 0;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ id: string }>(
      `insert into openrpg_games (slug,title,description,author,tags,license,cover_data_url,release_id,map_count,asset_count)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [input.slug, input.title, input.description, input.author, input.tags, input.license,
        input.coverDataUrl, release.manifest.releaseId, maps, assets],
    );
    await client.query(
      `insert into openrpg_game_releases (listing_id,release_id,manifest,zip_bytes,zip_sha256)
       values ($1,$2,$3,$4,$5)`,
      [result.rows[0].id, release.manifest.releaseId, JSON.stringify(release.manifest), release.bytes, releaseZipDigest(release.bytes)],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}

type ReleaseRow = { readonly zip_bytes: Buffer; readonly manifest: unknown; readonly zip_sha256: string };
const CACHE_BYTES = 192 * 1024 * 1024;

/** Cache owns at most two ZIPs / 192 MiB. Entry views share their ZIP buffer.
 * Visibility and listing association are checked in SQL even on cache hits. */
export function createReleaseLoader(pool: Pool) {
  const cache = new Map<string, RetainedRelease>();
  let cacheBytes = 0;
  let activeLoads = 0;
  return async (slug: string, releaseId: string): Promise<RetainedRelease | null> => {
    const association = await pool.query<{ listing_id: string; zip_sha256: string }>(
      `select r.listing_id,r.zip_sha256 from openrpg_games g join openrpg_game_releases r
       on r.listing_id=g.id and r.release_id=g.release_id
       where g.slug=$1 and g.release_id=$2 and g.status='visible'`, [slug, releaseId]);
    const row = association.rows[0];
    if (!row) return null;
    const key = `${row.listing_id}:${releaseId}:${row.zip_sha256}`;
    const cached = cache.get(key);
    if (cached) {
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }
    if (activeLoads >= 2) throw new ReleaseBusyError();
    activeLoads++;
    try {
      const result = await pool.query<ReleaseRow>(
        `select zip_bytes,manifest,zip_sha256 from openrpg_game_releases where listing_id=$1 and release_id=$2`,
        [row.listing_id, releaseId]);
      const stored = result.rows[0];
      if (!stored || releaseZipDigest(stored.zip_bytes) !== row.zip_sha256) throw new Error("Release storage integrity failure");
      const entries = readReleaseEntries(stored.zip_bytes);
      const manifest = await manifestFromEntries(entries);
      const retainedManifest = await parseReleaseManifest(stored.manifest);
      if (manifest.releaseId !== releaseId || retainedManifest.releaseId !== releaseId) throw new Error("Release manifest mismatch");
      const release = { bytes: stored.zip_bytes, manifest, entries };
      // Another request may have filled this key while the SQL query was pending.
      if (!cache.has(key)) {
        while (cache.size >= 2 || cacheBytes + release.bytes.length > CACHE_BYTES) {
          const oldest = cache.entries().next().value;
          if (!oldest) break;
          cache.delete(oldest[0]);
          cacheBytes -= oldest[1].bytes.length;
        }
        cache.set(key, release);
        cacheBytes += release.bytes.length;
      }
      return release;
    } finally { activeLoads--; }
  };
}

export class ReleaseBusyError extends Error {
  constructor() { super("Release service busy"); }
}
