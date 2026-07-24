import { Pool } from "pg";

const connectionString = process.env.COMMUNITY_DATABASE_URL;
if (!connectionString) throw new Error("COMMUNITY_DATABASE_URL is not set");

declare global {
  var __openrpgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!globalThis.__openrpgPool) {
    globalThis.__openrpgPool = new Pool({ connectionString, max: 5 });
  }
  return globalThis.__openrpgPool;
}

export interface AssetRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  description: string;
  author: string;
  tags: string[];
  license: string;
  likes: number;
  data_url: string;
  meta: Record<string, unknown>;
  downloads: number;
  created_at: string;
}

export interface GameRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  tags: string[];
  license: string;
  likes: number;
  cover_data_url: string | null;
  package_base64: string;
  map_count: number;
  asset_count: number;
  downloads: number;
  created_at: string;
}

export interface PostRow {
  id: string;
  category: string;
  title: string;
  body: string;
  author: string;
  lang: string;
  likes: number;
  views: number;
  created_at: string;
  comment_count: number;
}

export interface CommentRow {
  id: string;
  parent_type: string;
  parent_id: string;
  body: string;
  author: string;
  created_at: string;
}

export type Sort = "new" | "popular";

export async function listAssets(opts: { kind?: string; q?: string; sort?: Sort; limit?: number } = {}): Promise<AssetRow[]> {
  const where = ["status = 'visible'"];
  const params: unknown[] = [];
  if (opts.kind) {
    params.push(opts.kind);
    where.push(`kind = $${params.length}`);
  }
  if (opts.q) {
    params.push(`%${opts.q}%`);
    where.push(`(name ilike $${params.length} or description ilike $${params.length} or author ilike $${params.length})`);
  }
  const order = opts.sort === "popular" ? "downloads desc, created_at desc" : "created_at desc";
  params.push(Math.min(opts.limit ?? 60, 200));
  const { rows } = await getPool().query(
    `select id, slug, name, kind, description, author, tags, license, likes, meta, downloads, created_at
     from openrpg_assets where ${where.join(" and ")} order by ${order} limit $${params.length}`,
    params,
  );
  return rows;
}

export async function getAsset(slug: string): Promise<AssetRow | null> {
  const { rows } = await getPool().query(
    "select * from openrpg_assets where slug = $1 and status = 'visible'",
    [slug],
  );
  return rows[0] ?? null;
}

export async function listGames(opts: { q?: string; sort?: Sort; limit?: number } = {}): Promise<GameRow[]> {
  const where = ["status = 'visible'"];
  const params: unknown[] = [];
  if (opts.q) {
    params.push(`%${opts.q}%`);
    where.push(`(title ilike $${params.length} or description ilike $${params.length} or author ilike $${params.length})`);
  }
  const order = opts.sort === "popular" ? "downloads desc, created_at desc" : "created_at desc";
  params.push(Math.min(opts.limit ?? 60, 200));
  const { rows } = await getPool().query(
    `select id, slug, title, description, author, tags, license, likes, cover_data_url, map_count, asset_count, downloads, created_at
     from openrpg_games where ${where.join(" and ")} order by ${order} limit $${params.length}`,
    params,
  );
  return rows;
}

export async function getGame(slug: string): Promise<GameRow | null> {
  const { rows } = await getPool().query(
    "select * from openrpg_games where slug = $1 and status = 'visible'",
    [slug],
  );
  return rows[0] ?? null;
}

export async function listPosts(category?: string, limit = 50, lang?: string): Promise<PostRow[]> {
  const params: unknown[] = [];
  let where = "p.status = 'visible'";
  if (category) {
    params.push(category);
    where += ` and p.category = $${params.length}`;
  }
  if (lang) {
    params.push(lang);
    where += ` and p.lang = $${params.length}`;
  }
  params.push(Math.min(limit, 200));
  const { rows } = await getPool().query(
    `select p.id, p.category, p.title, p.body, p.author, p.lang, p.likes, p.views, p.created_at,
       (select count(*)::int from openrpg_comments c where c.parent_type = 'post' and c.parent_id = p.id::text) as comment_count
     from openrpg_posts p where ${where} order by p.created_at desc limit $${params.length}`,
    params,
  );
  return rows;
}

export async function getPost(id: string): Promise<PostRow | null> {
  const { rows } = await getPool().query(
    `select p.id, p.category, p.title, p.body, p.author, p.lang, p.likes, p.views, p.created_at,
       (select count(*)::int from openrpg_comments c where c.parent_type = 'post' and c.parent_id = p.id::text) as comment_count
     from openrpg_posts p where p.id = $1 and p.status = 'visible'`,
    [id],
  );
  return rows[0] ?? null;
}

export async function bumpViews(id: string): Promise<void> {
  await getPool().query("update openrpg_posts set views = views + 1 where id = $1", [id]).catch(() => {});
}

export async function listComments(parentType: string, parentId: string): Promise<CommentRow[]> {
  const { rows } = await getPool().query(
    "select id, parent_type, parent_id, body, author, created_at from openrpg_comments where parent_type = $1 and parent_id = $2 order by created_at asc limit 200",
    [parentType, parentId],
  );
  return rows;
}

export async function bumpCounter(
  table: "openrpg_assets" | "openrpg_games",
  column: "downloads" | "likes",
  slug: string,
): Promise<void> {
  await getPool()
    .query(`update ${table} set ${column} = ${column} + 1 where slug = $1`, [slug])
    .catch(() => {});
}

export async function communityStats(): Promise<{ assets: number; games: number; posts: number; downloads: number }> {
  const { rows } = await getPool().query(
    `select
       (select count(*)::int from openrpg_assets where status = 'visible') as assets,
       (select count(*)::int from openrpg_games where status = 'visible') as games,
       (select count(*)::int from openrpg_posts where status = 'visible') as posts,
       ((select coalesce(sum(downloads), 0)::int from openrpg_assets) +
        (select coalesce(sum(downloads), 0)::int from openrpg_games)) as downloads`,
  );
  return rows[0];
}
