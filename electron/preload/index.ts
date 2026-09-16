import { contextBridge, ipcRenderer } from "electron";
import { OPRN_CHANNELS } from "../shared/channels";

const invoke = (channel: string) => (payload?: unknown) => ipcRenderer.invoke(channel, payload);

const bridge = {
  closeIsHostDriven: true,
  // 동반 서비스 출처는 실행할 때마다 다른 포트라 프리로드 시점에 한 번 동기로 받는다.
  companionOrigin: (() => {
    try {
      return ipcRenderer.sendSync(OPRN_CHANNELS.companionOrigin) ?? null;
    } catch {
      return null;
    }
  })(),
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
  assetBaseUrl: (projectId: string) => `oprn-asset://${projectId}/`,
  lifecycle: {
    onFlushBeforeClose: (callback: () => void): void => {
      ipcRenderer.on(OPRN_CHANNELS.lifecycleFlushBeforeClose, () => callback());
    },
    flushDone: invoke(OPRN_CHANNELS.lifecycleFlushDone),
  },
  start: {
    recentProjects: invoke(OPRN_CHANNELS.startRecentProjects),
    openFolder: invoke(OPRN_CHANNELS.startOpenFolder),
    openRecent: invoke(OPRN_CHANNELS.startOpenRecent),
    createProject: invoke(OPRN_CHANNELS.startCreateProject),
    importFile: invoke(OPRN_CHANNELS.startImportFile),
  },
} as const;

contextBridge.exposeInMainWorld("oprn", bridge);
