import { ipcMain, type IpcMainInvokeEvent } from "electron";
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
import type { SessionRegistry } from "./sessions";

function parseOrThrow<T>(schema: ZodType<T>, payload: unknown, channel: string): T {
  const result = schema.safeParse(payload);
  if (result.success) return result.data;
  const detail = result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ");
  throw new Error(`${channel}: ${detail}`);
}

function projectFromSerialized(serialized: string): Project {
  return deserializeStoredProjectJson(JSON.parse(serialized));
}

export function registerIpcHandlers(sessions: SessionRegistry): void {
  ipcMain.handle(OPRN_CHANNELS.projectStatus, (event: IpcMainInvokeEvent) => {
    const session = sessions.get(event.sender.id);
    if (!session) return { kind: "not-configured" };
    return { kind: "ready", projectId: session.store.projectId, source: "custom", url: session.projectDir };
  });

  ipcMain.handle(OPRN_CHANNELS.projectProbe, (event: IpcMainInvokeEvent) => sessions.get(event.sender.id) !== null);

  ipcMain.handle(OPRN_CHANNELS.projectOpen, async (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = parseOrThrow(projectRefSchema, payload, OPRN_CHANNELS.projectOpen);
    const session = await sessions.open(event.sender.id, input.projectDir);
    return { projectDir: session.projectDir, ...session.store.info() };
  });

  ipcMain.handle(OPRN_CHANNELS.projectLoad, (event: IpcMainInvokeEvent) => {
    const { store } = sessions.require(event.sender.id);
    const snapshot = store.loadSnapshot();
    if (!snapshot) return null;
    return { serialized: store.exportSerialized(), sha256: snapshot.sha256, revision: snapshot.revision };
  });

  ipcMain.handle(OPRN_CHANNELS.projectSave, async (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = parseOrThrow(saveProjectSchema, payload, OPRN_CHANNELS.projectSave);
    return await sessions.require(event.sender.id).store.saveSerialized(input.serialized);
  });

  ipcMain.handle(OPRN_CHANNELS.projectSaveMapPatch, async (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = parseOrThrow(saveMapPatchSchema, payload, OPRN_CHANNELS.projectSaveMapPatch);
    return await sessions.require(event.sender.id).store.saveMapPatch({
      baseProject: projectFromSerialized(input.baseSerialized),
      project: projectFromSerialized(input.serialized),
      ...(input.changedMapIds ? { changedMapIds: input.changedMapIds } : {}),
    });
  });

  ipcMain.handle(OPRN_CHANNELS.projectDataVersion, (event: IpcMainInvokeEvent) =>
    sessions.require(event.sender.id).store.dataVersion());

  ipcMain.handle(OPRN_CHANNELS.projectSeparateMedia, async (event: IpcMainInvokeEvent) => {
    const { store } = sessions.require(event.sender.id);
    const snapshot = store.loadSnapshot();
    if (!snapshot) return { changed: false, migratedAssetIds: [], revision: 0 };
    const result = await store.separateInlineMedia(snapshot.project);
    return { changed: result.changed, migratedAssetIds: result.migratedAssetIds, revision: result.revision };
  });

  ipcMain.handle(OPRN_CHANNELS.projectBackup, (event: IpcMainInvokeEvent) =>
    sessions.require(event.sender.id).store.backup());

  ipcMain.handle(OPRN_CHANNELS.commitsRecord, (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = parseOrThrow(commitRecordSchema, payload, OPRN_CHANNELS.commitsRecord);
    const commitId = sessions.require(event.sender.id).store.recordCommit({
      identity: input.identity,
      reviewStatus: input.reviewStatus,
      summary: input.summary,
      ...(input.parentCommitId === undefined ? {} : { parentCommitId: input.parentCommitId }),
      toolNames: input.toolNames,
      ...(input.diff === undefined ? {} : { diff: input.diff }),
      ...(input.editActivity === undefined ? {} : { editActivity: input.editActivity }),
    });
    return { kind: "saved", commitId };
  });

  ipcMain.handle(OPRN_CHANNELS.commitsList, (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = parseOrThrow(listLimitSchema, payload, OPRN_CHANNELS.commitsList);
    return sessions.require(event.sender.id).store.listCommits(input.limit);
  });

  ipcMain.on(OPRN_CHANNELS.commitsListSync, (event, payload: unknown) => {
    try {
      const input = parseOrThrow(listLimitSchema, payload, OPRN_CHANNELS.commitsListSync);
      event.returnValue = sessions.require(event.sender.id).store.listCommits(input.limit);
    } catch (error) {
      event.returnValue = [];
      void error;
    }
  });

  ipcMain.handle(OPRN_CHANNELS.aiRecordActivity, (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = parseOrThrow(activityRecordSchema, payload, OPRN_CHANNELS.aiRecordActivity);
    sessions.require(event.sender.id).store.recordActivity({
      logId: input.logId,
      ...(input.runId ? { runId: input.runId } : {}),
      channel: input.channel,
      instruction: input.instruction,
      ...(input.mapId ? { mapId: input.mapId } : {}),
      payload: input.payload,
    });
    return { kind: "saved" };
  });

  ipcMain.handle(OPRN_CHANNELS.aiListActivity, (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = parseOrThrow(activityListSchema, payload, OPRN_CHANNELS.aiListActivity);
    return sessions.require(event.sender.id).store.listActivity(input.limit, input.runId ? { runId: input.runId } : {});
  });

  ipcMain.handle(OPRN_CHANNELS.aiRecordConversation, (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = parseOrThrow(conversationRecordSchema, payload, OPRN_CHANNELS.aiRecordConversation);
    sessions.require(event.sender.id).store.recordConversation({
      conversationId: input.conversationId,
      ...(input.destinationProjectId === undefined ? {} : { destinationProjectId: input.destinationProjectId }),
      title: input.title,
      model: input.model,
      ...(input.projectContextKey ? { projectContextKey: input.projectContextKey } : {}),
      entries: input.entries,
      savedAt: input.savedAt,
    });
    return { kind: "saved" };
  });

  ipcMain.handle(OPRN_CHANNELS.aiListConversations, (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = parseOrThrow(conversationListSchema, payload, OPRN_CHANNELS.aiListConversations);
    return sessions.require(event.sender.id).store.listConversations({
      ...(input.query === undefined ? {} : { query: input.query }),
      ...(input.limit === undefined ? {} : { limit: input.limit }),
      ...(input.offset === undefined ? {} : { offset: input.offset }),
      ...(input.includeEntries === undefined ? {} : { includeEntries: input.includeEntries }),
      ...(input.projectContextKey === undefined ? {} : { projectContextKey: input.projectContextKey }),
    });
  });

  ipcMain.handle(OPRN_CHANNELS.aiLoadConversation, (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = parseOrThrow(conversationLoadSchema, payload, OPRN_CHANNELS.aiLoadConversation);
    return sessions.require(event.sender.id).store.loadConversation(input.conversationId);
  });

  ipcMain.handle(OPRN_CHANNELS.aiRecordAnalysisRun, (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = parseOrThrow(analysisRunSchema, payload, OPRN_CHANNELS.aiRecordAnalysisRun);
    sessions.require(event.sender.id).store.recordAnalysisRun({
      tilesetId: input.tilesetId,
      selectedTiles: input.selectedTiles,
      promptContext: input.promptContext,
      result: input.result,
    });
    return { kind: "saved" };
  });

  ipcMain.handle(OPRN_CHANNELS.assetsPut, async (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = parseOrThrow(assetPutSchema, payload, OPRN_CHANNELS.assetsPut);
    const ref = await sessions.require(event.sender.id).store.putAsset(new Uint8Array(input.bytes), {
      mime: input.mime,
      extension: input.extension,
      ...(input.originalName === undefined ? {} : { originalName: input.originalName }),
      ...(input.kind === undefined ? {} : { kind: input.kind }),
    });
    return { ref, dataUrl: null };
  });

  ipcMain.handle(OPRN_CHANNELS.assetsList, (event: IpcMainInvokeEvent) =>
    sessions.require(event.sender.id).store.listAssets());

  ipcMain.handle(OPRN_CHANNELS.assetsRead, async (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = parseOrThrow(assetReadSchema, payload, OPRN_CHANNELS.assetsRead);
    return await sessions.require(event.sender.id).store.assetBytes(input.sha256);
  });

  ipcMain.handle(OPRN_CHANNELS.assetsPruneUnused, async (event: IpcMainInvokeEvent, payload: unknown) => {
    const input = parseOrThrow(assetPruneSchema, payload, OPRN_CHANNELS.assetsPruneUnused);
    return await sessions.require(event.sender.id).store.pruneUnusedAssets(input.referenced);
  });
}
