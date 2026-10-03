import { contextBridge, ipcRenderer } from "electron";
import { OPRN_CHANNELS } from "../shared/channels";

const invoke = (channel: string) => (payload?: unknown) => ipcRenderer.invoke(channel, payload);

const bridge = {
  closeIsHostDriven: true,
  team: { status: invoke(OPRN_CHANNELS.teamStatus), lock: invoke(OPRN_CHANNELS.teamLock) },
  // 동반 서비스 출처는 실행할 때마다 다른 포트라 프리로드 시점에 한 번 동기로 받는다.
  companionOrigin: (() => {
    try {
      return ipcRenderer.sendSync(OPRN_CHANNELS.companionOrigin) ?? null;
    } catch {
      return null;
    }
  })(),
  companionToken: (() => {
    try {
      return ipcRenderer.sendSync(OPRN_CHANNELS.companionToken) ?? null;
    } catch {
      return null;
    }
  })(),
  project: {
    status: invoke(OPRN_CHANNELS.projectStatus),
    probe: invoke(OPRN_CHANNELS.projectProbe),
    open: invoke(OPRN_CHANNELS.projectOpen),
    load: invoke(OPRN_CHANNELS.projectLoad),
    loadFolded: invoke(OPRN_CHANNELS.projectLoadFolded),
    tilesetBlobs: invoke(OPRN_CHANNELS.projectTilesetBlobs),
    save: invoke(OPRN_CHANNELS.projectSave),
    saveMapPatch: invoke(OPRN_CHANNELS.projectSaveMapPatch),
    dataVersion: invoke(OPRN_CHANNELS.projectDataVersion),
    separateMedia: invoke(OPRN_CHANNELS.projectSeparateMedia),
    backup: invoke(OPRN_CHANNELS.projectBackup),
    saveCover: invoke(OPRN_CHANNELS.projectSaveCover),
    listBackups: invoke(OPRN_CHANNELS.projectListBackups),
    restoreBackup: invoke(OPRN_CHANNELS.projectRestoreBackup),
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
    onSaveRequest: (callback: () => void): void => {
      ipcRenderer.on(OPRN_CHANNELS.lifecycleSave, () => callback());
    },
  },
  start: {
    recentProjects: invoke(OPRN_CHANNELS.startRecentProjects),
    openFolder: invoke(OPRN_CHANNELS.startOpenFolder),
    openRecent: invoke(OPRN_CHANNELS.startOpenRecent),
    createProject: invoke(OPRN_CHANNELS.startCreateProject),
    importFile: invoke(OPRN_CHANNELS.startImportFile),
    suggestProjectDir: invoke(OPRN_CHANNELS.startSuggestProjectDir),
    chooseProjectRoot: invoke(OPRN_CHANNELS.startChooseProjectRoot),
    coverSource: invoke(OPRN_CHANNELS.startCoverSource),
    saveCover: invoke(OPRN_CHANNELS.startSaveCover),
    joinTeam: invoke(OPRN_CHANNELS.startJoinTeam),
    recentTeams: invoke(OPRN_CHANNELS.startRecentTeams),
  },
  assetBrowser: {
    open: invoke(OPRN_CHANNELS.assetBrowserOpen),
    setBounds: invoke(OPRN_CHANNELS.assetBrowserBounds),
    close: invoke(OPRN_CHANNELS.assetBrowserClose),
    onDownload: (callback: (payload: unknown) => void): (() => void) => {
      const listener = (_event: unknown, payload: unknown): void => callback(payload);
      ipcRenderer.on(OPRN_CHANNELS.assetBrowserDownload, listener);
      return () => ipcRenderer.removeListener(OPRN_CHANNELS.assetBrowserDownload, listener);
    },
  },
} as const;

contextBridge.exposeInMainWorld("oprn", bridge);
