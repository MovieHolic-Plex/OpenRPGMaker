import { z } from "zod";

const projectDir = z.string().min(1);
const positiveLimit = z.number().int().positive().max(200);

export const projectRefSchema = z.object({ projectDir });

/** 시작 화면 카드용 대표 그림. 480×300 JPEG 은 base64 로 100KB 안팎이다 — 2MB 는 넉넉한 상한이다. */
export const projectCoverSchema = z.object({
  projectDir,
  dataUrl: z.string().max(2_000_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/),
});

export const tilesetBlobsSchema = z.object({
  projectDir,
  sha256s: z.array(z.string().regex(/^[0-9a-f]{64}$/)).max(4096),
});

export const saveProjectSchema = z.object({
  projectDir,
  serialized: z.string().min(1),
  expectedSha: z.string().min(1).nullable(),
});

const dictPatchSchema = z.object({
  set: z.record(z.string(), z.unknown()).optional(),
  del: z.array(z.string()).optional(),
});

/** 전체 문서 둘 또는 변경분. 변경분만 있으면 64MB 본문 한도를 넘지 않는다. */
export const saveMapPatchSchema = z.object({
  projectDir,
  baseSerialized: z.string().min(1).optional(),
  serialized: z.string().min(1).optional(),
  baseSha: z.string().min(1).nullable().optional(),
  patch: z.object({
    set: z.record(z.string(), z.unknown()).optional(),
    del: z.array(z.string()).optional(),
    maps: dictPatchSchema.optional(),
    database: dictPatchSchema.optional(),
    tilesets: dictPatchSchema.optional(),
  }).optional(),
  changedMapIds: z.array(z.string().min(1)).optional(),
}).refine(
  (value) => (value.baseSerialized !== undefined && value.serialized !== undefined) || value.patch !== undefined,
  "patch or full documents required",
);

export const listLimitSchema = z.object({ projectDir, limit: positiveLimit });

export const commitRecordSchema = z.object({
  projectDir,
  identity: z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    kind: z.string().min(1),
    agentName: z.string().min(1).optional(),
  }),
  reviewStatus: z.string().min(1),
  summary: z.string().min(1),
  parentCommitId: z.string().min(1).nullable().optional(),
  toolNames: z.array(z.string()).default([]),
  diff: z.unknown().optional(),
  editActivity: z.unknown().optional(),
});

export const activityRecordSchema = z.object({
  projectDir,
  logId: z.string().min(1),
  runId: z.string().min(1).optional(),
  channel: z.string().min(1),
  instruction: z.string().min(1),
  mapId: z.string().min(1).optional(),
  payload: z.unknown(),
});

export const conversationRecordSchema = z.object({
  projectDir,
  conversationId: z.string().min(1),
  destinationProjectId: z.string().min(1).nullable().optional(),
  title: z.string().min(1),
  model: z.string().min(1),
  projectContextKey: z.string().min(1).optional(),
  entries: z.unknown(),
  savedAt: z.number().int().nonnegative(),
});

export const conversationListSchema = z.object({
  projectDir,
  query: z.string().optional(),
  limit: positiveLimit.optional(),
  offset: z.number().int().nonnegative().optional(),
  includeEntries: z.boolean().optional(),
  projectContextKey: z.string().min(1).optional(),
});

export const activityListSchema = z.object({
  projectDir,
  limit: positiveLimit,
  runId: z.string().min(1).optional(),
});

export const conversationLoadSchema = z.object({ projectDir, conversationId: z.string().min(1) });

export const analysisRunSchema = z.object({
  projectDir,
  tilesetId: z.string().min(1),
  selectedTiles: z.array(z.number().int().nonnegative()),
  promptContext: z.unknown(),
  result: z.unknown(),
});

export const assetPutSchema = z.object({
  projectDir,
  mime: z.string().min(1),
  extension: z.string().min(1),
  originalName: z.string().optional(),
  kind: z.string().optional(),
  bytes: z.instanceof(Uint8Array),
});

const assetBrowserBox = {
  x: z.number().int().min(0).max(10000),
  y: z.number().int().min(0).max(10000),
  width: z.number().int().min(0).max(10000),
  height: z.number().int().min(0).max(10000),
};

export const assetBrowserOpenSchema = z.object({
  url: z.string().min(1).max(2000),
  ...assetBrowserBox,
});

export const assetBrowserBoundsSchema = z.object(assetBrowserBox);

export const assetReadSchema = z.object({ projectDir, sha256: z.string().min(1) });

export const assetPruneSchema = z.object({ projectDir, referenced: z.array(z.string()) });

/** 에셋 스토어 IPC 입력. 본문 검증(팩 형식·해시)은 assetStoreClient 와 서버가 한 번 더 한다. */
const storeSlug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);
const storeLang = z.enum(["ko", "en", "ja", "zh"]);
export const storeSlugSchema = z.object({ slug: storeSlug, version: z.number().int().positive().optional(), lang: storeLang.optional() });
export const storeBlobSchema = z.object({ sha256: z.string().regex(/^[0-9a-f]{64}$/) });
export const storeManifestSchema = z.object({ slug: storeSlug, version: z.number().int().positive() });
export const storeUrlSchema = z.object({ url: z.string().url().max(300) });
export const storeLoginSchema = z.object({ openBrowser: z.boolean().optional() });
export const storeCatalogSchema = z.object({
  q: z.string().max(80).optional(),
  kind: z.string().max(24).optional(),
  grade: z.enum(["single", "pack", ""]).optional(),
  sort: z.enum(["new", "popular", ""]).optional(),
  page: z.number().int().positive().max(500).optional(),
  lang: storeLang.optional(),
});
export const storeVisibilitySchema = z.object({ slug: storeSlug, hidden: z.boolean() });
/** 상품 신고. 사유는 서버 store_reports 의 다섯 가지(assetStoreClient StoreReportReason). */
export const storeReportSchema = z.object({ slug: storeSlug, reason: z.enum(["copyright", "inappropriate", "broken", "spam", "other"]), detail: z.string().max(2000) });
/** 컨셉 피드 입력. 카드 본문 검사는 assetStoreClient 가 normalizeGameConcept 로 한다. */
const conceptSlug = z.string().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const storeConceptsSchema = z.object({
  tag: z.string().max(40).optional(),
  q: z.string().max(80).optional(),
  preset: z.string().max(40).optional(),
  cursor: z.string().max(40).regex(/^-?\d{1,9}:\d{1,18}$/).optional(),
  lang: storeLang.optional(),
}).strict();
export const storeConceptSlugSchema = z.object({ slug: conceptSlug, lang: storeLang.optional() }).strict();
export const storeConceptMadeSchema = z.object({ slug: conceptSlug }).strict();
/** 「바로 플레이」 게임. 파일 형식·크기·실행 파일 제한은 스토어 서버(src/games.ts)가 정본으로 다시 검사한다. */
const storeGameVersion = z.string().regex(/^\d{1,4}\.\d{1,4}$/);
export const storeGameMineSchema = z.object({ projectKey: z.string().min(1).max(200) }).strict();
const storeGameChangeSet = z.object({ added: z.array(z.string().max(200)).max(5000), changed: z.array(z.string().max(200)).max(5000), removed: z.array(z.string().max(200)).max(5000) });
export const storeGamePublishSchema = z.object({
  projectKey: z.string().min(1).max(200),
  meta: z.object({
    title: z.string().max(120), summary: z.string().max(300), description: z.string().max(8000), credits: z.string().max(4000), genre: z.string().max(40),
    controls: z.array(z.object({ keys: z.string().max(80), action: z.string().max(120) })).max(16),
  }),
  files: z.record(z.string().max(400), z.instanceof(Uint8Array)),
  entry: z.string().max(200),
  cover: z.string().max(400).nullable(),
  art: z.array(z.string().max(400)).max(12),
  changelog: z.string().max(8000),
  changes: z.record(z.string().max(24), storeGameChangeSet),
  bump: z.enum(["minor", "major"]),
  version: storeGameVersion.nullable().optional(),
  comment: z.string().max(600).optional(),
  post: z.object({ title: z.string().max(120), body: z.string().max(20000), pinned: z.boolean().optional() }).strict().nullable().optional(),
}).strict();
/** 소식 글 올리기(조수 카드·발행 대화상자). 판본 코멘트를 같이 고칠 수 있다(commentVersion 판본에). */
export const storeGamePostSchema = z.object({
  slug: storeSlug,
  title: z.string().min(1).max(120),
  body: z.string().max(20000),
  version: storeGameVersion.nullable().optional(),
  pinned: z.boolean().optional(),
  comment: z.string().max(600).optional(),
  commentVersion: storeGameVersion.nullable().optional(),
}).strict();
/** 평가 목록 한 쪽(조수 store_game_reviews). */
export const storeGameReviewsSchema = z.object({
  slug: storeSlug,
  sort: z.enum(["helpful", "recent", "funny"]).optional(),
  filter: z.enum(["all", "up", "down"]).optional(),
  limit: z.number().int().min(1).max(50).optional(),
}).strict();
/** 제작자 답글(빈 글이면 지운다). 조수 답글 카드에서 사용자가 눌렀을 때만. */
export const storeReviewReplySchema = z.object({
  slug: storeSlug,
  reviewId: z.number().int().positive(),
  reply: z.string().max(2000),
}).strict();
export const storeGameCurrentSchema = z.object({ slug: storeSlug, version: storeGameVersion }).strict();
export const storeUploadSchema = z.object({
  manifest: z.record(z.string(), z.unknown()),
  blobs: z.record(z.string().regex(/^[0-9a-f]{64}$/), z.instanceof(Uint8Array)),
  targetSlug: storeSlug.optional(),
});
