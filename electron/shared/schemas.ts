import { z } from "zod";

const projectDir = z.string().min(1);
const positiveLimit = z.number().int().positive().max(200);

export const projectRefSchema = z.object({ projectDir });

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
