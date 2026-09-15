import { contextBridge, ipcRenderer } from "electron";
import { OPRN_CHANNELS } from "../shared/channels";

const invoke = (channel: string) => (payload?: unknown) => ipcRenderer.invoke(channel, payload);

const bridge = {
  project: {
    status: invoke(OPRN_CHANNELS.projectStatus),
    probe: invoke(OPRN_CHANNELS.projectProbe),
    open: invoke(OPRN_CHANNELS.projectOpen),
    load: invoke(OPRN_CHANNELS.projectLoad),
    save: invoke(OPRN_CHANNELS.projectSave),
    saveMapPatch: invoke(OPRN_CHANNELS.projectSaveMapPatch),
    dataVersion: invoke(OPRN_CHANNELS.projectDataVersion),
    separateMedia: invoke(OPRN_CHANNELS.projectSeparateMedia),
    backup: invoke(OPRN_CHANNELS.projectBackup),
  },
  commits: {
    record: invoke(OPRN_CHANNELS.commitsRecord),
    list: invoke(OPRN_CHANNELS.commitsList),
    listSync: (payload: unknown) => ipcRenderer.sendSync(OPRN_CHANNELS.commitsListSync, payload),
  },
  ai: {
    recordActivity: invoke(OPRN_CHANNELS.aiRecordActivity),
    listActivity: invoke(OPRN_CHANNELS.aiListActivity),
    recordConversation: invoke(OPRN_CHANNELS.aiRecordConversation),
    listConversations: invoke(OPRN_CHANNELS.aiListConversations),
    loadConversation: invoke(OPRN_CHANNELS.aiLoadConversation),
    recordAnalysisRun: invoke(OPRN_CHANNELS.aiRecordAnalysisRun),
  },
  assets: {
    put: invoke(OPRN_CHANNELS.assetsPut),
    list: invoke(OPRN_CHANNELS.assetsList),
    read: invoke(OPRN_CHANNELS.assetsRead),
    pruneUnused: invoke(OPRN_CHANNELS.assetsPruneUnused),
  },
  lifecycle: {
    onFlushBeforeClose: (callback: () => void): void => {
      ipcRenderer.on(OPRN_CHANNELS.lifecycleFlushBeforeClose, () => callback());
    },
    flushDone: invoke(OPRN_CHANNELS.lifecycleFlushDone),
  },
  companionOrigin: null,
} as const;

contextBridge.exposeInMainWorld("oprn", bridge);
