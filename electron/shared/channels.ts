export const OPRN_CHANNEL_PREFIX = "oprn:" as const;

export const OPRN_CHANNELS = {
  projectStatus: "oprn:project.status",
  projectProbe: "oprn:project.probe",
  projectOpen: "oprn:project.open",
  projectLoad: "oprn:project.load",
  projectSave: "oprn:project.save",
  projectSaveMapPatch: "oprn:project.saveMapPatch",
  projectDataVersion: "oprn:project.dataVersion",
  projectSeparateMedia: "oprn:project.separateMedia",
  projectBackup: "oprn:project.backup",
  commitsRecord: "oprn:commits.record",
  commitsList: "oprn:commits.list",
  commitsListSync: "oprn:commits.listSync",
  aiRecordActivity: "oprn:ai.recordActivity",
  aiListActivity: "oprn:ai.listActivity",
  aiRecordConversation: "oprn:ai.recordConversation",
  aiListConversations: "oprn:ai.listConversations",
  aiLoadConversation: "oprn:ai.loadConversation",
  aiRecordAnalysisRun: "oprn:ai.recordAnalysisRun",
  assetsPut: "oprn:assets.put",
  assetsList: "oprn:assets.list",
  assetsRead: "oprn:assets.read",
  assetsPruneUnused: "oprn:assets.pruneUnused",
  lifecycleFlushBeforeClose: "oprn:lifecycle.flush-before-close",
  lifecycleFlushDone: "oprn:lifecycle.flush-done",
  startRecentProjects: "oprn:start.recentProjects",
  startOpenFolder: "oprn:start.openFolder",
  startCreateProject: "oprn:start.createProject",
  startImportFile: "oprn:start.importFile",
} as const;

export type OprnChannel = (typeof OPRN_CHANNELS)[keyof typeof OPRN_CHANNELS];

export const OPRN_APP_SCHEME = "app" as const;
export const OPRN_ASSET_SCHEME = "oprn-asset" as const;
