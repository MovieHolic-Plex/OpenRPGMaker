import type { ZodType } from "zod";
import { deserializeStoredProjectJson } from "../../src/project/persistence/core/loadRepair";
import type { Project } from "../../src/project/types";
import { OPRN_CHANNELS } from "../shared/channels";
import {
  activityListSchema,
  activityRecordSchema,
  analysisRunSchema,
  assetPruneSchema,
  assetPutSchema,
  assetReadSchema,
  commitRecordSchema,
  conversationListSchema,
  conversationLoadSchema,
  conversationRecordSchema,
  listLimitSchema,
  projectRefSchema,
  saveMapPatchSchema,
  saveProjectSchema,
} from "../shared/schemas";
import type { SessionKey, SessionRegistry } from "./sessions";

type Handler = (key: SessionKey, payload: unknown) => unknown;

/** zod 검증을 두 전송로가 같은 방식으로 통과시키기 위해 내보낸다. */
export function parseOrThrow<T>(schema: ZodType<T>, payload: unknown, channel: string): T {
  const result = schema.safeParse(payload);
  if (result.success) return result.data;
  const detail = result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ");
  throw new Error(`${channel}: ${detail}`);
}

function projectFromSerialized(serialized: string): Project {
  return deserializeStoredProjectJson(JSON.parse(serialized));
}

/** 전송로(IPC·HTTP)와 무관한 저장소 채널 본문. */
export function createStoreHandlers(sessions: SessionRegistry): Readonly<Record<string, Handler>> {
  const store = (key: SessionKey) => sessions.require(key).store;

  return {
    [OPRN_CHANNELS.projectStatus]: (key) => {
      const session = sessions.get(key);
      if (!session) return { kind: "not-configured" };
      // projectDir 를 함께 준다 — 렌더러가 부팅 때 이 값으로 열린 폴더를 채택한다(설계 7.3).
      return { kind: "ready", projectId: session.store.projectId, projectDir: session.projectDir, source: "custom", url: session.projectDir };
    },

    [OPRN_CHANNELS.projectProbe]: (key) => sessions.get(key) !== null,

    [OPRN_CHANNELS.projectOpen]: async (key, payload) => {
      const input = parseOrThrow(projectRefSchema, payload, OPRN_CHANNELS.projectOpen);
      const session = await sessions.open(key, input.projectDir);
      return { projectDir: session.projectDir, ...session.store.info() };
    },

    [OPRN_CHANNELS.projectLoad]: (key) => {
      const snapshot = store(key).loadSnapshot();
      if (!snapshot) return null;
      return { serialized: store(key).exportSerialized(), sha256: snapshot.sha256, revision: snapshot.revision };
    },

    [OPRN_CHANNELS.projectSave]: async (key, payload) => {
      const input = parseOrThrow(saveProjectSchema, payload, OPRN_CHANNELS.projectSave);
      return await store(key).saveSerialized(input.serialized);
    },

    [OPRN_CHANNELS.projectSaveMapPatch]: async (key, payload) => {
      const input = parseOrThrow(saveMapPatchSchema, payload, OPRN_CHANNELS.projectSaveMapPatch);
      return await store(key).saveMapPatch({
        baseProject: projectFromSerialized(input.baseSerialized),
        project: projectFromSerialized(input.serialized),
        ...(input.changedMapIds ? { changedMapIds: input.changedMapIds } : {}),
      });
    },

    [OPRN_CHANNELS.projectDataVersion]: (key) => store(key).dataVersion(),

    [OPRN_CHANNELS.projectSeparateMedia]: async (key) => {
      const target = store(key);
      const snapshot = target.loadSnapshot();
      if (!snapshot) return { changed: false, migratedAssetIds: [], revision: 0 };
      const result = await target.separateInlineMedia(snapshot.project);
      return { changed: result.changed, migratedAssetIds: result.migratedAssetIds, revision: result.revision };
    },

    [OPRN_CHANNELS.projectBackup]: (key) => store(key).backup(),

    [OPRN_CHANNELS.commitsRecord]: (key, payload) => {
      const input = parseOrThrow(commitRecordSchema, payload, OPRN_CHANNELS.commitsRecord);
      const commitId = store(key).recordCommit({
        identity: input.identity,
        reviewStatus: input.reviewStatus,
        summary: input.summary,
        ...(input.parentCommitId === undefined ? {} : { parentCommitId: input.parentCommitId }),
        toolNames: input.toolNames,
        ...(input.diff === undefined ? {} : { diff: input.diff }),
        ...(input.editActivity === undefined ? {} : { editActivity: input.editActivity }),
      });
      return { kind: "saved", commitId };
    },

    [OPRN_CHANNELS.commitsList]: (key, payload) => {
      const input = parseOrThrow(listLimitSchema, payload, OPRN_CHANNELS.commitsList);
      return store(key).listCommits(input.limit);
    },

    [OPRN_CHANNELS.aiRecordActivity]: (key, payload) => {
      const input = parseOrThrow(activityRecordSchema, payload, OPRN_CHANNELS.aiRecordActivity);
      store(key).recordActivity({
        logId: input.logId,
        ...(input.runId ? { runId: input.runId } : {}),
        channel: input.channel,
        instruction: input.instruction,
        ...(input.mapId ? { mapId: input.mapId } : {}),
        payload: input.payload,
      });
      return { kind: "saved" };
    },

    [OPRN_CHANNELS.aiListActivity]: (key, payload) => {
      const input = parseOrThrow(activityListSchema, payload, OPRN_CHANNELS.aiListActivity);
      return store(key).listActivity(input.limit, input.runId ? { runId: input.runId } : {});
    },

    [OPRN_CHANNELS.aiRecordConversation]: (key, payload) => {
      const input = parseOrThrow(conversationRecordSchema, payload, OPRN_CHANNELS.aiRecordConversation);
      store(key).recordConversation({
        conversationId: input.conversationId,
        ...(input.destinationProjectId === undefined ? {} : { destinationProjectId: input.destinationProjectId }),
        title: input.title,
        model: input.model,
        ...(input.projectContextKey ? { projectContextKey: input.projectContextKey } : {}),
        entries: input.entries,
        savedAt: input.savedAt,
      });
      return { kind: "saved" };
    },

    [OPRN_CHANNELS.aiListConversations]: (key, payload) => {
      const input = parseOrThrow(conversationListSchema, payload, OPRN_CHANNELS.aiListConversations);
      return store(key).listConversations({
        ...(input.query === undefined ? {} : { query: input.query }),
        ...(input.limit === undefined ? {} : { limit: input.limit }),
        ...(input.offset === undefined ? {} : { offset: input.offset }),
        ...(input.includeEntries === undefined ? {} : { includeEntries: input.includeEntries }),
        ...(input.projectContextKey === undefined ? {} : { projectContextKey: input.projectContextKey }),
      });
    },

    [OPRN_CHANNELS.aiLoadConversation]: (key, payload) => {
      const input = parseOrThrow(conversationLoadSchema, payload, OPRN_CHANNELS.aiLoadConversation);
      return store(key).loadConversation(input.conversationId);
    },

    [OPRN_CHANNELS.aiRecordAnalysisRun]: (key, payload) => {
      const input = parseOrThrow(analysisRunSchema, payload, OPRN_CHANNELS.aiRecordAnalysisRun);
      store(key).recordAnalysisRun({
        tilesetId: input.tilesetId,
        selectedTiles: input.selectedTiles,
        promptContext: input.promptContext,
        result: input.result,
      });
      return { kind: "saved" };
    },

    [OPRN_CHANNELS.assetsPut]: async (key, payload) => {
      const input = parseOrThrow(assetPutSchema, payload, OPRN_CHANNELS.assetsPut);
      const ref = await store(key).putAsset(new Uint8Array(input.bytes), {
        mime: input.mime,
        extension: input.extension,
        ...(input.originalName === undefined ? {} : { originalName: input.originalName }),
        ...(input.kind === undefined ? {} : { kind: input.kind }),
      });
      return { ref, dataUrl: null };
    },

    [OPRN_CHANNELS.assetsList]: (key) => store(key).listAssets(),

    [OPRN_CHANNELS.assetsRead]: async (key, payload) => {
      const input = parseOrThrow(assetReadSchema, payload, OPRN_CHANNELS.assetsRead);
      return await store(key).assetBytes(input.sha256);
    },

    [OPRN_CHANNELS.assetsPruneUnused]: async (key, payload) => {
      const input = parseOrThrow(assetPruneSchema, payload, OPRN_CHANNELS.assetsPruneUnused);
      return await store(key).pruneUnusedAssets(input.referenced);
    },
  };
}

/** 창 없는 전송로도 같은 표를 쓴다 — 두 전송로가 채널 목록에서 갈리지 않게 한다. */
export const STORE_CHANNELS = [
  OPRN_CHANNELS.projectStatus,
  OPRN_CHANNELS.projectProbe,
  OPRN_CHANNELS.projectOpen,
  OPRN_CHANNELS.projectLoad,
  OPRN_CHANNELS.projectSave,
  OPRN_CHANNELS.projectSaveMapPatch,
  OPRN_CHANNELS.projectDataVersion,
  OPRN_CHANNELS.projectSeparateMedia,
  OPRN_CHANNELS.projectBackup,
  OPRN_CHANNELS.commitsRecord,
  OPRN_CHANNELS.commitsList,
  OPRN_CHANNELS.aiRecordActivity,
  OPRN_CHANNELS.aiListActivity,
  OPRN_CHANNELS.aiRecordConversation,
  OPRN_CHANNELS.aiListConversations,
  OPRN_CHANNELS.aiLoadConversation,
  OPRN_CHANNELS.aiRecordAnalysisRun,
  OPRN_CHANNELS.assetsPut,
  OPRN_CHANNELS.assetsList,
  OPRN_CHANNELS.assetsRead,
  OPRN_CHANNELS.assetsPruneUnused,
] as const;
