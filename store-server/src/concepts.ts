// 컨셉 피드(oprn-concept/1): 목록·상세·「이걸로 만들었다」 수·운영자 게시.
// 본문 검사는 편집기와 같은 normalizeGameConcept 하나로 한다 — 서버가 따로 규칙을 들지 않는다.
import { isSha256 } from "../../src/assetStore/format";
import { normalizeGameConcept, type GameConcept } from "../../src/concepts/format";
import type { Db } from "./db";
import { HttpError } from "./http";

export const CONCEPT_PAGE = 24;
const SIMILAR_LIMIT = 6;
/** 카드 = 컨셉 본문 + 썸네일 sha256 두 개 + 만든 수(+ 사용자 컨셉이면 작가 이름). */
export type ConceptCard = GameConcept;

const SELECT = "select c.*, u.display_name as author_name from store_concepts c left join store_users u on u.id = c.author_id";

/**
 * 번역(locales)은 본문에 그대로 둔다. 화면이 localizedConcept 로 고른다.
 * 제목·훅·설명 칸에 번역을 덮어쓰지 않는 이유: 번역 글자 한도(80/240/1200)가 원문 한도(40/120/600)보다 길어
 * 받는 쪽 normalizeGameConcept 가 카드를 버리게 된다.
 */
function card(row: Record<string, unknown>): ConceptCard {
  const body = row.body as GameConcept;
  const authorName = row.author_id !== null && typeof row.author_name === "string" ? row.author_name : null;
  return {
    ...body,
    thumb: { full: String(row.full_sha), card: String(row.card_sha) },
    madeCount: Number(row.made_count),
    ...(authorName ? { author: { name: authorName } } : {}),
  };
}

export interface ConceptQuery { tag?: string; q?: string; preset?: string; cursor?: string }

/** 커서 = "rank:id". 정렬은 rank, id 오름차순. */
export async function listConcepts(db: Db, query: ConceptQuery): Promise<{ items: ConceptCard[]; nextCursor: string | null }> {
  const where = ["c.status = 'visible'"];
  const args: unknown[] = [];
  if (query.tag) { args.push(query.tag); where.push(`$${args.length} = any(c.tags)`); }
  if (query.preset) { args.push(query.preset); where.push(`c.preset_id = $${args.length}`); }
  const q = query.q?.trim().slice(0, 80);
  if (q) { args.push(`%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`); where.push(`c.body::text ilike $${args.length}`); }
  // 자릿수를 묶는다 — int·bigint 범위를 넘는 숫자는 Postgres 가 500 으로 터진다. 이상한 커서는 첫 쪽으로 본다.
  const cursor = /^(-?\d{1,9}):(\d{1,18})$/.exec(query.cursor ?? "");
  if (cursor) { args.push(Number(cursor[1]), cursor[2]); where.push(`(c.rank, c.id) > ($${args.length - 1}::int, $${args.length}::bigint)`); }
  const { rows } = await db.query(`${SELECT} where ${where.join(" and ")} order by c.rank, c.id limit ${CONCEPT_PAGE + 1}`, args);
  const page = rows.slice(0, CONCEPT_PAGE);
  const last = page.at(-1);
  return { items: page.map(card), nextCursor: rows.length > CONCEPT_PAGE && last ? `${last.rank}:${last.id}` : null };
}

export async function conceptDetail(db: Db, slug: string): Promise<{ concept: ConceptCard; similar: ConceptCard[] }> {
  const { rows } = await db.query(`${SELECT} where c.slug = $1 and c.status = 'visible'`, [slug]);
  const row = rows[0];
  if (!row) throw new HttpError(404, "컨셉을 찾을 수 없습니다.", "not_found");
  const similar = await db.query(
    `${SELECT} where c.status = 'visible' and c.id <> $1 and (c.tags && $2::text[] or c.preset_id = $3)
     order by (c.tags && $2::text[])::int desc, c.rank, c.id limit ${SIMILAR_LIMIT}`,
    [row.id, row.tags, row.preset_id],
  );
  return { concept: card(row), similar: similar.rows.map(card) };
}

export async function recordConceptMade(db: Db, slug: string, clientKey: string): Promise<void> {
  const { rows } = await db.query("select id from store_concepts where slug = $1 and status = 'visible'", [slug]);
  if (!rows[0]) throw new HttpError(404, "컨셉을 찾을 수 없습니다.", "not_found");
  const inserted = await db.query("insert into store_concept_made (concept_id, client_key) values ($1, $2) on conflict do nothing", [rows[0].id, clientKey]);
  if (inserted.rowCount) await db.query("update store_concepts set made_count = made_count + 1 where id = $1", [rows[0].id]);
}

/** 운영자 게시. 같은 slug 면 본문·그림·순위를 덮어쓴다(만든 수·상태는 그대로). */
export async function publishConcept(db: Db, input: unknown, authorId: number | null): Promise<{ slug: string }> {
  const raw = (input && typeof input === "object" ? input : {}) as { concept?: unknown; rank?: unknown };
  let concept: GameConcept;
  try {
    concept = normalizeGameConcept(raw.concept);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "컨셉이 올바르지 않습니다.", "bad_concept");
  }
  if (!isSha256(concept.thumb.full) || !isSha256(concept.thumb.card)) throw new HttpError(400, "썸네일은 올린 파일의 sha256 이어야 합니다.", "bad_thumb");
  const have = await db.query("select sha256 from store_blobs where sha256 = any($1::text[])", [[concept.thumb.full, concept.thumb.card]]);
  if (have.rows.length < (concept.thumb.full === concept.thumb.card ? 1 : 2)) throw new HttpError(400, "썸네일 파일을 먼저 올려 주세요.", "missing_blob");
  const rank = typeof raw.rank === "number" && Number.isFinite(raw.rank) ? Math.max(-1_000_000, Math.min(1_000_000, Math.floor(raw.rank))) : 1000;
  // 만든 수·작가는 서버가 정한다 — 본문에 들어온 값은 버린다.
  const { madeCount: _made, author: _author, ...body } = concept;
  await db.query(
    `insert into store_concepts (slug, author_id, body, tags, preset_id, full_sha, card_sha, rank)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (slug) do update set body = excluded.body, tags = excluded.tags, preset_id = excluded.preset_id,
       full_sha = excluded.full_sha, card_sha = excluded.card_sha, rank = excluded.rank, updated_at = now()`,
    [concept.slug, authorId, JSON.stringify(body), concept.tags, concept.presetId, concept.thumb.full, concept.thumb.card, rank],
  );
  return { slug: concept.slug };
}
