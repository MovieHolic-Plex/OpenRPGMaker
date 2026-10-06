import { createHash, randomBytes } from "node:crypto";
import {
  STORE_ITEM_KINDS,
  STORE_LICENSES,
  STORE_PACK_SCHEMA,
  isStoreLocale,
  localizedText,
  packGrade,
  referenceDocumentCount,
  slugify,
  validateManifest,
  type StoreAssetKind,
  type StoreItemDetail,
  type StoreItemKind,
  type StoreItemStatus,
  type StoreItemSummary,
  type StoreLicense,
  type StoreLocale,
  type StoreLocalizedTexts,
  type StorePackManifest,
} from "../../src/assetStore/format";
import { basicTilesetFor } from "../../src/assetStore/pack";
import { pngSize } from "../../src/assetStore/sniff";
import type { Auth, User } from "./auth";
import type { BlobStore } from "./blobStore";
import type { StoreConfig } from "./config";
import { inTx, type Db, type Tx } from "./db";
import { HttpError } from "./http";

const PAGE_SIZE = 24;

const rowLocales = (row: Record<string, unknown>): StoreLocalizedTexts => (row.locales ?? {}) as StoreLocalizedTexts;
const rowText = (row: Record<string, unknown>, lang: StoreLocale | null | undefined) =>
  localizedText({ title: String(row.title), summary: String(row.summary), description: String(row.description ?? "") }, rowLocales(row), lang);

function summary(row: Record<string, unknown>, lang?: StoreLocale | null): StoreItemSummary {
  const text = rowText(row, lang);
  return {
    slug: String(row.slug),
    title: text.title,
    summary: text.summary,
    kind: row.kind as StoreItemKind,
    grade: row.grade === "pack" ? "pack" : "single",
    license: row.license as StoreLicense,
    aiGenerated: Boolean(row.ai_generated),
    author: String(row.author_name),
    tags: (row.tags as string[]) ?? [],
    latestVersion: Number(row.latest_version),
    cover: (row.cover_sha as string | null) ?? null,
    downloads: Number(row.downloads),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    languages: Object.keys(rowLocales(row)).filter(isStoreLocale),
  };
}

const ITEM_SELECT = "select i.*, u.display_name as author_name from store_items i join store_users u on u.id = i.author_id";

export interface CatalogQuery { q?: string; kind?: string; grade?: string; sort?: string; page?: number; lang?: StoreLocale | null; pageSize?: number }

export async function listCatalog(db: Db, query: CatalogQuery): Promise<{ items: StoreItemSummary[]; total: number; page: number; pageSize: number }> {
  const where = ["i.status = 'visible'"];
  const args: unknown[] = [];
  const q = query.q?.trim().slice(0, 80);
  if (q) {
    args.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    where.push(`(i.title ilike $${args.length} or i.summary ilike $${args.length} or i.locales::text ilike $${args.length} or array_to_string(i.tags, ' ') ilike $${args.length} or u.display_name ilike $${args.length})`);
  }
  if (query.kind && (STORE_ITEM_KINDS as readonly string[]).includes(query.kind)) { args.push(query.kind); where.push(`i.kind = $${args.length}`); }
  if (query.grade === "pack" || query.grade === "single") { args.push(query.grade); where.push(`i.grade = $${args.length}`); }
  const order = query.sort === "popular" ? "i.downloads desc, i.updated_at desc" : "i.updated_at desc";
  const page = Number.isFinite(query.page) ? Math.max(1, Math.min(500, Math.floor(query.page!))) : 1;
  const size = Math.max(1, Math.min(PAGE_SIZE, Math.floor(query.pageSize ?? PAGE_SIZE)));
  const total = await db.query(`select count(*)::int as n from store_items i join store_users u on u.id = i.author_id where ${where.join(" and ")}`, args);
  const rows = await db.query(`${ITEM_SELECT} where ${where.join(" and ")} order by ${order} limit ${size} offset ${(page - 1) * size}`, args);
  return { items: rows.rows.map((row) => summary(row, query.lang)), total: Number(total.rows[0].n), page, pageSize: size };
}

/** 첫 화면용: 종류별 공개 상품 수와 대표 표지. */
export async function catalogOverview(db: Db): Promise<{ total: number; kinds: { kind: StoreItemKind; count: number; cover: string | null }[] }> {
  const { rows } = await db.query(
    `select kind, count(*)::int as n, (array_agg(cover_sha order by updated_at desc) filter (where cover_sha is not null))[1] as cover
     from store_items where status = 'visible' group by kind`,
  );
  const kinds = STORE_ITEM_KINDS.flatMap((kind) => {
    const row = rows.find((r) => r.kind === kind);
    return row ? [{ kind, count: Number(row.n), cover: (row.cover as string | null) ?? null }] : [];
  });
  return { total: kinds.reduce((sum, k) => sum + k.count, 0), kinds };
}

/** 보이는 범위: visible·hidden 은 누구나(숨김은 목록에서만 빠진다), pending·removed 는 작가·관리자만. */
export function canView(row: Record<string, unknown>, viewer: User | null): boolean {
  const status = row.status as StoreItemStatus;
  if (status === "visible" || status === "hidden") return true;
  return viewer !== null && (viewer.role === "admin" || Number(row.author_id) === viewer.id);
}

export async function findItem(db: Db | Tx, slug: string): Promise<Record<string, unknown> | null> {
  const { rows } = await db.query(`${ITEM_SELECT} where i.slug = $1`, [slug]);
  return rows[0] ?? null;
}

export async function itemDetail(db: Db, slug: string, viewer: User | null, lang?: StoreLocale | null): Promise<StoreItemDetail & { authorId: number; hiddenBy: string | null }> {
  const row = await findItem(db, slug);
  if (!row || !canView(row, viewer)) throw new HttpError(404, "상품을 찾지 못했습니다.", "not_found");
  const versions = await db.query("select version, created_at, manifest_sha256, total_bytes from store_versions where item_id = $1 order by version desc", [row.id]);
  const counts = (row.counts ?? {}) as StoreItemDetail["counts"];
  return {
    ...summary(row, lang),
    description: rowText(row, lang).description,
    credits: String(row.credits),
    previews: (row.previews as string[]) ?? [],
    status: row.status as StoreItemStatus,
    versions: versions.rows.map((v) => ({ version: Number(v.version), createdAt: new Date(v.created_at).toISOString(), manifestSha256: String(v.manifest_sha256), bytes: Number(v.total_bytes) })),
    counts: { tilesets: Number(counts.tilesets ?? 0), assets: Number(counts.assets ?? 0), referenceDocuments: Number(counts.referenceDocuments ?? 0) },
    authorId: Number(row.author_id),
    hiddenBy: (row.hidden_by as string | null) ?? null,
  };
}

export async function versionManifest(db: Db, slug: string, version: number, viewer: User | null): Promise<StorePackManifest> {
  const row = await findItem(db, slug);
  if (!row || !canView(row, viewer)) throw new HttpError(404, "상품을 찾지 못했습니다.", "not_found");
  if (row.status === "removed" && viewer?.role !== "admin") throw new HttpError(410, "운영 정책에 따라 내려간 상품입니다.", "removed");
  const { rows } = await db.query("select manifest from store_versions where item_id = $1 and version = $2", [row.id, version]);
  if (!rows[0]) throw new HttpError(404, "그 판본이 없습니다.", "not_found");
  return rows[0].manifest as StorePackManifest;
}

/** blob 을 내줘도 되는가: 내려가지 않은 상품의 판본이 쓰고 있어야 한다(업로드만 된 파일은 주지 않는다). */
export async function blobServable(db: Db, sha256: string): Promise<{ mime: string; inR2: boolean } | null> {
  const { rows } = await db.query(
    `select b.mime, b.r2_at from store_blobs b where b.sha256 = $1 and exists (
       select 1 from store_version_blobs vb join store_items i on i.id = vb.item_id
       where vb.sha256 = b.sha256 and i.status <> 'removed')`,
    [sha256],
  );
  return rows[0] ? { mime: String(rows[0].mime), inR2: rows[0].r2_at !== null } : null;
}

async function checkBlobs(db: Db | Tx, store: BlobStore, manifest: StorePackManifest): Promise<number> {
  const shas = manifest.blobs.map((b) => b.sha256);
  const { rows } = await db.query("select sha256, mime, bytes from store_blobs where sha256 = any($1::text[])", [shas]);
  const known = new Map(rows.map((r) => [String(r.sha256), r]));
  const errors: string[] = [];
  let total = 0;
  for (const blob of manifest.blobs) {
    const row = known.get(blob.sha256);
    if (!row || !store.has(blob.sha256)) errors.push(`아직 올라오지 않은 파일이 있습니다: ${blob.sha256.slice(0, 12)}`);
    else if (row.mime !== blob.mime || Number(row.bytes) !== blob.bytes) errors.push(`파일 설명이 실제와 다릅니다: ${blob.sha256.slice(0, 12)}`);
    total += blob.bytes;
  }
  if (errors.length > 0) throw new HttpError(422, "팩을 받을 수 없습니다.", "invalid_pack", errors);
  return total;
}

function parseManifest(input: unknown): StorePackManifest {
  const result = validateManifest(input);
  if (!result.ok) throw new HttpError(422, "팩 형식이 올바르지 않습니다.", "invalid_pack", result.errors);
  return result.value;
}

async function approvedCount(tx: Tx, authorId: number): Promise<number> {
  const { rows } = await tx.query("select count(*)::int as n from store_items where author_id = $1 and first_visible_at is not null and status <> 'removed'", [authorId]);
  return Number(rows[0].n);
}

const manifestSha = (manifest: StorePackManifest): string => createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
const contentCounts = (manifest: StorePackManifest) => ({
  tilesets: Object.keys(manifest.content.tilesets).length,
  assets: Object.keys(manifest.content.assets).length,
  referenceDocuments: referenceDocumentCount(manifest.content),
});

async function insertVersion(tx: Tx, itemId: number, version: number, manifest: StorePackManifest, totalBytes: number): Promise<void> {
  await tx.query("insert into store_versions (item_id, version, manifest, manifest_sha256, total_bytes) values ($1, $2, $3, $4, $5)", [itemId, version, manifest, manifestSha(manifest), totalBytes]);
  for (const blob of manifest.blobs) await tx.query("insert into store_version_blobs (item_id, version, sha256) values ($1, $2, $3)", [itemId, version, blob.sha256]);
}

export async function audit(tx: Db | Tx, actorId: number | null, action: string, itemId: number | null, detail: Record<string, unknown> = {}): Promise<void> {
  await tx.query("insert into store_audit (actor_id, action, item_id, detail) values ($1, $2, $3, $4)", [actorId, action, itemId, detail]);
}

/** 새 상품. 자동 검사를 지나면 신뢰 작가는 바로 공개, 아니면 사전 확인 대기. */
export async function createItem(db: Db, config: StoreConfig, store: BlobStore, author: User, input: unknown): Promise<{ slug: string; status: StoreItemStatus; version: number }> {
  const manifest = parseManifest(input);
  return inTx(db, async (tx) => {
    const totalBytes = await checkBlobs(tx, store, manifest);
    const trusted = author.role === "admin" || await approvedCount(tx, author.id) >= config.trustThreshold;
    const status: StoreItemStatus = trusted ? "visible" : "pending";
    let slug = "";
    for (let attempt = 0; attempt < 5 && !slug; attempt += 1) {
      const candidate = slugify(manifest.title, randomBytes(4).toString("hex"));
      const taken = await tx.query("select 1 from store_items where slug = $1", [candidate]);
      if (taken.rowCount === 0) slug = candidate;
    }
    if (!slug) throw new HttpError(503, "주소를 만들지 못했습니다. 다시 시도해 주세요.", "slug");
    const { rows } = await tx.query(
      `insert into store_items (slug, author_id, title, summary, description, credits, kind, grade, license, ai_generated, tags, status, first_visible_at, cover_sha, previews, counts, locales)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, case when $12 = 'visible' then now() end, $13, $14, $15, $16) returning id`,
      [slug, author.id, manifest.title, manifest.summary, manifest.description, manifest.credits, manifest.kind, packGrade(manifest.content),
        manifest.license, manifest.aiGenerated, manifest.tags, status, manifest.previews[0] ?? null, manifest.previews, contentCounts(manifest), manifest.locales ?? {}],
    );
    const itemId = Number(rows[0].id);
    await insertVersion(tx, itemId, 1, manifest, totalBytes);
    await audit(tx, author.id, "create", itemId, { status, grade: packGrade(manifest.content) });
    return { slug, status, version: 1 };
  });
}

/**
 * 같은 상품의 새 판본. 이전 판본은 그대로 남는다.
 * 아직 신뢰받지 못한 작가가 공개 상품에 새 판본을 올리면 다시 확인 대기로 돌린다 —
 * 무해한 판본으로 승인받은 뒤 내용을 바꿔치기하는 우회를 막는다(2026-10-06 보안 검토).
 */
export async function addVersion(db: Db, config: StoreConfig, store: BlobStore, auth: Auth, slug: string, input: unknown): Promise<{ slug: string; version: number; status: StoreItemStatus }> {
  const manifest = parseManifest(input);
  return inTx(db, async (tx) => {
    const row = await findItem(tx, slug);
    if (!row || (Number(row.author_id) !== auth.user.id && auth.user.role !== "admin")) throw new HttpError(404, "상품을 찾지 못했습니다.", "not_found");
    if (row.status === "removed") throw new HttpError(410, "내려간 상품에는 새 판본을 올릴 수 없습니다.", "removed");
    const totalBytes = await checkBlobs(tx, store, manifest);
    const version = Number(row.latest_version) + 1;
    await insertVersion(tx, Number(row.id), version, manifest, totalBytes);
    const trusted = auth.user.role === "admin" || await approvedCount(tx, Number(row.author_id)) >= config.trustThreshold;
    const status: StoreItemStatus = row.status === "visible" && !trusted ? "pending" : row.status as StoreItemStatus;
    if (status !== row.status) await tx.query("update store_items set status=$2 where id=$1", [row.id, status]);
    await tx.query(
      `update store_items set title=$2, summary=$3, description=$4, credits=$5, kind=$6, grade=$7, license=$8, ai_generated=$9, tags=$10,
       latest_version=$11, cover_sha=$12, previews=$13, counts=$14, locales=$15, updated_at=now() where id=$1`,
      [row.id, manifest.title, manifest.summary, manifest.description, manifest.credits, manifest.kind, packGrade(manifest.content), manifest.license,
        manifest.aiGenerated, manifest.tags, version, manifest.previews[0] ?? null, manifest.previews, contentCounts(manifest), manifest.locales ?? {}],
    );
    await audit(tx, auth.user.id, "version", Number(row.id), { version, status });
    return { slug, version, status };
  });
}

/** 작가가 자기 상품을 숨기거나 되돌린다. 신고·관리자가 숨긴 것은 되돌릴 수 없다. */
export async function authorVisibility(db: Db, auth: Auth, slug: string, hidden: boolean): Promise<StoreItemStatus> {
  return inTx(db, async (tx) => {
    const row = await findItem(tx, slug);
    if (!row || Number(row.author_id) !== auth.user.id) throw new HttpError(404, "상품을 찾지 못했습니다.", "not_found");
    if (hidden && row.status === "visible") {
      await tx.query("update store_items set status='hidden', hidden_by='author', updated_at=now() where id=$1", [row.id]);
      await audit(tx, auth.user.id, "author_hide", Number(row.id));
      return "hidden";
    }
    if (!hidden && row.status === "hidden" && row.hidden_by === "author") {
      await tx.query("update store_items set status='visible', hidden_by=null, updated_at=now() where id=$1", [row.id]);
      await audit(tx, auth.user.id, "author_unhide", Number(row.id));
      return "visible";
    }
    throw new HttpError(409, "지금 상태에서는 바꿀 수 없습니다.", "conflict");
  });
}

export async function adminSetStatus(db: Db, auth: Auth, slug: string, status: StoreItemStatus, note: string): Promise<void> {
  if (!["visible", "hidden", "removed"].includes(status)) throw new HttpError(400, "상태 값이 올바르지 않습니다.", "bad_status");
  await inTx(db, async (tx) => {
    const row = await findItem(tx, slug);
    if (!row) throw new HttpError(404, "상품을 찾지 못했습니다.", "not_found");
    await tx.query(
      `update store_items set status=$2, hidden_by = case when $2 = 'visible' then null else 'admin' end,
       first_visible_at = coalesce(first_visible_at, case when $2 = 'visible' then now() end), updated_at=now() where id=$1`,
      [row.id, status],
    );
    if (status !== "hidden") await tx.query("update store_reports set status='resolved' where item_id=$1", [row.id]);
    await audit(tx, auth.user.id, `admin_${status}`, Number(row.id), { note: note.slice(0, 500), from: row.status });
  });
}

const REPORT_REASONS = ["copyright", "inappropriate", "broken", "spam", "other"] as const;

/**
 * 신고. 같은 신고자는 한 번만 센다. 서로 다른 신고자가 기준에 닿으면 자동으로 숨긴다.
 * 자동 숨김에는 `counts`(가입 하루가 지난 로그인 계정)인 신고만 센다. 익명 신고는 운영자 확인 목록에만 들어간다
 * — 새 계정·IP 를 바꿔 가며 남의 상품을 숨기는 것을 막는다(2026-10-06 보안 검토).
 */
export async function reportItem(db: Db, config: StoreConfig, slug: string, reporter: { key: string; counts: boolean }, reason: string, detail: string): Promise<{ hidden: boolean }> {
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) throw new HttpError(400, "신고 사유를 골라 주세요.", "bad_reason");
  return inTx(db, async (tx) => {
    const row = await findItem(tx, slug);
    if (!row || row.status === "removed" || row.status === "pending") throw new HttpError(404, "상품을 찾지 못했습니다.", "not_found");
    await tx.query("insert into store_reports (item_id, reporter_key, reason, detail, counts) values ($1,$2,$3,$4,$5) on conflict do nothing", [row.id, reporter.key, reason, detail.slice(0, 2000), reporter.counts]);
    const { rows } = await tx.query("select count(*)::int as n from store_reports where item_id=$1 and status='open' and counts", [row.id]);
    if (row.status === "visible" && Number(rows[0].n) >= config.reportHideThreshold) {
      await tx.query("update store_items set status='hidden', hidden_by='reports', updated_at=now() where id=$1", [row.id]);
      await audit(tx, null, "auto_hide_reports", Number(row.id), { reports: Number(rows[0].n) });
      return { hidden: true };
    }
    return { hidden: false };
  });
}

export async function recordDownload(db: Db, slug: string, clientKey: string): Promise<void> {
  await inTx(db, async (tx) => {
    const row = await findItem(tx, slug);
    if (!row || row.status === "removed" || row.status === "pending") return;
    const inserted = await tx.query("insert into store_downloads (item_id, client_key) values ($1, $2) on conflict do nothing", [row.id, clientKey]);
    if (inserted.rowCount === 1) await tx.query("update store_items set downloads = downloads + 1 where id = $1", [row.id]);
  });
}

export async function myItems(db: Db, user: User, lang?: StoreLocale | null): Promise<(StoreItemSummary & { status: StoreItemStatus; hiddenBy: string | null })[]> {
  const { rows } = await db.query(`${ITEM_SELECT} where i.author_id = $1 order by i.updated_at desc`, [user.id]);
  return rows.map((row) => ({ ...summary(row, lang), status: row.status as StoreItemStatus, hiddenBy: (row.hidden_by as string | null) ?? null }));
}

export async function adminQueue(db: Db, lang?: StoreLocale | null): Promise<{ pending: StoreItemSummary[]; reported: (StoreItemSummary & { status: string; reports: { reason: string; detail: string; createdAt: string }[] })[] }> {
  const pending = await db.query(`${ITEM_SELECT} where i.status = 'pending' order by i.created_at`);
  const reported = await db.query(
    `${ITEM_SELECT} where i.status in ('visible','hidden') and exists (select 1 from store_reports r where r.item_id = i.id and r.status = 'open') order by i.updated_at desc`,
  );
  const result = [];
  for (const row of reported.rows) {
    const reports = await db.query("select reason, detail, created_at from store_reports where item_id = $1 and status = 'open' order by created_at", [row.id]);
    result.push({ ...summary(row, lang), status: String(row.status), reports: reports.rows.map((r) => ({ reason: String(r.reason), detail: String(r.detail), createdAt: new Date(r.created_at).toISOString() })) });
  }
  return { pending: pending.rows.map((row) => summary(row, lang)), reported: result };
}

/** 웹에서 낱장 하나를 올릴 때: 서버가 에셋 하나짜리 팩(타일셋이면 기본 타일셋 포함)으로 감싼다. */
export interface SingleInput {
  blob: string; title: string; summary: string; description: string; kind: string; license: string;
  aiGenerated: boolean; credits: string; tags: string[]; tileSize?: number; fileName?: string;
}
const SINGLE_ASSET_KIND: Partial<Record<StoreItemKind, StoreAssetKind>> = {
  tileset: "chipset", character: "charset", face: "faceset", battler: "battleCharset", picture: "picture", music: "music", sound: "sound",
};

export async function singleManifest(db: Db, store: BlobStore, input: SingleInput): Promise<StorePackManifest> {
  const kind = input.kind as StoreItemKind;
  const assetKind = SINGLE_ASSET_KIND[kind];
  if (!assetKind) throw new HttpError(400, "낱장으로 올릴 수 없는 종류입니다.", "bad_kind");
  if (!(STORE_LICENSES as readonly string[]).includes(input.license)) throw new HttpError(400, "라이선스를 골라 주세요.", "bad_license");
  const { rows } = await db.query("select mime, bytes from store_blobs where sha256 = $1", [input.blob]);
  if (!rows[0] || !store.has(input.blob)) throw new HttpError(422, "파일을 먼저 올려야 합니다.", "missing_blob");
  const mime = String(rows[0].mime);
  const audio = kind === "music" || kind === "sound";
  if (audio !== mime.startsWith("audio/")) throw new HttpError(422, audio ? "음악·효과음은 OGG·MP3·WAV·M4A 파일이어야 합니다." : "그림 종류는 PNG 파일이어야 합니다.", "kind_mime");
  const assetId = `a_${input.blob.slice(0, 12)}`;
  const name = (input.fileName ?? input.title).replace(/\.[a-z0-9]+$/i, "").slice(0, 120) || input.title;
  const meta: Record<string, number> = {};
  const tilesets: StorePackManifest["content"]["tilesets"] = {};
  if (!audio) {
    if (mime !== "image/png") throw new HttpError(422, "그림은 PNG 파일만 받습니다.", "kind_mime");
    const size = pngSize(store.read(input.blob));
    if (!size) throw new HttpError(422, "PNG 크기를 읽지 못했습니다.", "bad_png");
    meta.width = size.width;
    meta.height = size.height;
    if (kind === "tileset") {
      const tileSize = Number(input.tileSize);
      if (![16, 32, 48].includes(tileSize) || size.width % tileSize !== 0 || size.height % tileSize !== 0) {
        throw new HttpError(422, `타일셋 그림의 가로·세로(${size.width}×${size.height})가 칸 크기 ${input.tileSize}의 배수여야 합니다.`, "bad_tile_size");
      }
      Object.assign(meta, { tileSize, frameWidth: tileSize, frameHeight: tileSize, frames: (size.width / tileSize) * (size.height / tileSize) });
      const tileset = basicTilesetFor(assetId, input.title.slice(0, 80), size.width, size.height, tileSize);
      tilesets[tileset.id] = tileset;
    }
  }
  return {
    schema: STORE_PACK_SCHEMA,
    title: input.title,
    summary: input.summary,
    description: input.description,
    tags: input.tags,
    kind,
    license: input.license as StoreLicense,
    aiGenerated: input.aiGenerated,
    credits: input.credits,
    content: { assets: { [assetId]: { id: assetId, name, kind: assetKind, blob: input.blob, mime: mime as StorePackManifest["blobs"][number]["mime"], meta } }, tilesets },
    previews: audio ? [] : [input.blob],
    blobs: [{ sha256: input.blob, mime: mime as StorePackManifest["blobs"][number]["mime"], bytes: Number(rows[0].bytes) }],
  };
}

/**
 * 아무 판본에도 들지 않은 채 하루가 지난 blob 을 지운다. 올리기 도중 끊긴 것과, 디스크를 채우려고 올린 것을 치운다.
 * 판본에 든 blob 은 판본이 불변이므로 지우지 않는다.
 */
export async function sweepOrphanBlobs(db: Db, store: BlobStore, olderThanHours = 24, remote?: { remove(sha256: string): Promise<void> } | null): Promise<number> {
  const { rows } = await db.query(
    `delete from store_blobs b where b.created_at < now() - make_interval(hours => $1)
       and not exists (select 1 from store_version_blobs v where v.sha256 = b.sha256)
       and not exists (select 1 from store_items i where i.cover_sha = b.sha256 or b.sha256 = any(i.previews))
     returning sha256`,
    [olderThanHours],
  );
  for (const row of rows) {
    store.remove(String(row.sha256));
    if (remote) await remote.remove(String(row.sha256)).catch((error) => console.error("[store] r2 remove", error));
  }
  return rows.length;
}
