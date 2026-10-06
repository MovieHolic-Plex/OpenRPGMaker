export const OPRN_CHANNEL_PREFIX = "oprn:" as const;

export const OPRN_CHANNELS = {
  windowControl: "oprn:window.control",
  /** 데스크톱 앱 창의 네이티브 전체화면 여부(조회)와 변화 알림(푸시)을 같은 이름으로 오간다. */
  windowFullscreen: "oprn:window.fullscreen",
  teamStatus: "oprn:team.status",
  teamInvite: "oprn:team.invite",
  teamRevoke: "oprn:team.revoke",
  teamRename: "oprn:team.rename",
  teamLock: "oprn:team.lock",
  companionOrigin: "oprn:companion.origin",
  companionToken: "oprn:companion.token",
  startOpenRecent: "oprn:start.openRecent",
  projectStatus: "oprn:project.status",
  projectProbe: "oprn:project.probe",
  projectOpen: "oprn:project.open",
  projectLoad: "oprn:project.load",
  projectLoadFolded: "oprn:project.loadFolded",
  projectTilesetBlobs: "oprn:project.tilesetBlobs",
  /** HTTP 팀 호스트 전용: 전송에서 뗀 업로드 자산 dataUrl 본문(내용 주소). 로컬 IPC 에는 없다. */
  projectAssetBlobs: "oprn:project.assetBlobs",
  projectSave: "oprn:project.save",
  projectSaveMapPatch: "oprn:project.saveMapPatch",
  projectDataVersion: "oprn:project.dataVersion",
  projectSeparateMedia: "oprn:project.separateMedia",
  projectBackup: "oprn:project.backup",
  /** 시작 화면 카드에 쓰는 대표 그림(cover.jpg). 편집기가 저장 뒤에 보낸다. */
  projectSaveCover: "oprn:project.saveCover",
  projectListBackups: "oprn:project.listBackups",
  projectRestoreBackup: "oprn:project.restoreBackup",
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
  lifecycleSave: "oprn:lifecycle.save",
  startRecentProjects: "oprn:start.recentProjects",
  startOpenFolder: "oprn:start.openFolder",
  startCreateProject: "oprn:start.createProject",
  startImportFile: "oprn:start.importFile",
  /** 새 게임 폴더 추천 경로(기본 위치 + 겹치지 않는 이름). */
  startSuggestProjectDir: "oprn:start.suggestProjectDir",
  /** 새 게임 폴더를 만들 상위 위치를 고르는 대화상자. */
  startChooseProjectRoot: "oprn:start.chooseProjectRoot",
  /** 최근 목록 프로젝트의 카드 그림 재료(시작 맵 + 타일셋). */
  startCoverSource: "oprn:start.coverSource",
  /** 시작 화면이 구운 카드 그림을 그 폴더의 cover.jpg 로 남긴다. */
  startSaveCover: "oprn:start.saveCover",
  /** 다른 컴퓨터의 팀 호스트를 앱 창으로 연다(참여하는 쪽). */
  startJoinTeam: "oprn:start.joinTeam",
  /** 전에 참여한 팀 호스트 주소. 초대 비밀(#join=)은 남기지 않는다. */
  startRecentTeams: "oprn:start.recentTeams",
  assetBrowserOpen: "oprn:assetBrowser.open",
  assetBrowserBounds: "oprn:assetBrowser.bounds",
  assetBrowserClose: "oprn:assetBrowser.close",
  assetBrowserDownload: "oprn:assetBrowser.download",
  /** 에셋 스토어(openwiki/asset-store.md). 렌더러는 스토어 서버에 직접 붙지 않고 이 채널로 메인에 맡긴다. */
  storeStatus: "oprn:store.status",
  storeSetUrl: "oprn:store.setUrl",
  storeCatalog: "oprn:store.catalog",
  storeItem: "oprn:store.item",
  storeBlob: "oprn:store.blob",
  storeInstalled: "oprn:store.installed",
  storeInstall: "oprn:store.install",
  storeUninstall: "oprn:store.uninstall",
  storePackage: "oprn:store.package",
  storeMine: "oprn:store.mine",
  storeLogin: "oprn:store.login",
  storeLogout: "oprn:store.logout",
  storeUpload: "oprn:store.upload",
  /** 메인 → 렌더러 알림: 받기·올리기 진행, 설치·로그인 변화. */
  storeProgress: "oprn:store.progress",
  storeChanged: "oprn:store.changed",
} as const;

export type OprnChannel = (typeof OPRN_CHANNELS)[keyof typeof OPRN_CHANNELS];

export const OPRN_APP_SCHEME = "app" as const;
export const OPRN_ASSET_SCHEME = "oprn-asset" as const;
