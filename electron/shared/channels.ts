export const OPRN_CHANNEL_PREFIX = "oprn:" as const;

export const OPRN_CHANNELS = {
  windowControl: "oprn:window.control",
  /** 데스크톱 앱 창의 네이티브 전체화면 여부(조회)와 변화 알림(푸시)을 같은 이름으로 오간다. */
  windowFullscreen: "oprn:window.fullscreen",
  /** 최대화·전체화면 상태 조회(invoke)와 변화 알림(push). 같은 이름으로 오간다. */
  windowState: "oprn:window.state",
  /** 시작 화면이 첫 카드를 그렸다(렌더러 → 메인, 단방향). 메인은 숨긴 창을 보이고 스플래시를 닫는다. */
  startScreenReady: "oprn:start.screenReady",
  teamStatus: "oprn:team.status",
  /** @deprecated multi-user team collaboration is not supported yet (2026-10-21). 호스트 팀 관리 페이지만 부른다(소유자 권한). */
  teamInvite: "oprn:team.invite",
  /** @deprecated multi-user team collaboration is not supported yet (2026-10-21). */
  teamRevoke: "oprn:team.revoke",
  /** @deprecated multi-user team collaboration is not supported yet (2026-10-21). */
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
  /** 보기 → 새로고침. 렌더러가 store.flush() 를 끝내고 flush-reload-done 으로 결과를 알린다. */
  lifecycleFlushBeforeReload: "oprn:lifecycle.flush-before-reload",
  lifecycleFlushReloadDone: "oprn:lifecycle.flush-reload-done",
  /** 편집기가 새로고침 저장 리스너를 붙였다. 그 전에는 메모리 편집이 없다. */
  lifecycleFlushReady: "oprn:lifecycle.flush-ready",
  /** beforeunload 가 미저장 때문에 새로고침을 막았다(동기). 메인이 저장한 뒤 다시 연다. */
  lifecycleReloadBlocked: "oprn:lifecycle.reload-blocked",
  /** 이 창이 연 프로젝트의 «마지막 편집 화면» 그림(편집기 부팅 동안 읽기 전용 자리표시). electron/main/lastView.ts */
  resumeLastView: "oprn:resume.lastView",
  /** 편집기가 부팅 로더를 걷었다 — 이제 이 창을 마지막 편집 화면으로 찍어도 된다. */
  resumeEditorReady: "oprn:resume.editorReady",
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
  /** 다른 컴퓨터의 팀 호스트를 앱 창으로 연다(참여하는 쪽). @deprecated multi-user team collaboration is not supported yet (2026-10-21). */
  startJoinTeam: "oprn:start.joinTeam",
  /** 전에 참여한 팀 호스트 주소. 초대 비밀(#join=)은 남기지 않는다. @deprecated multi-user team collaboration is not supported yet (2026-10-21). */
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
  storeManifest: "oprn:store.manifest",
  storeInstalled: "oprn:store.installed",
  storeInstall: "oprn:store.install",
  storeUninstall: "oprn:store.uninstall",
  storePackage: "oprn:store.package",
  storeMine: "oprn:store.mine",
  storeLogin: "oprn:store.login",
  storeLogout: "oprn:store.logout",
  storeUpload: "oprn:store.upload",
  storeVisibility: "oprn:store.visibility",
  storeReport: "oprn:store.report",
  /** 「바로 플레이」 게임: 이 프로젝트의 게임·다음 판본, 판본 올리기, 지금 판본 바꾸기(되돌리기). */
  storeGameMine: "oprn:store.gameMine",
  storeGamePublish: "oprn:store.gamePublish",
  storeGameCurrent: "oprn:store.gameCurrent",
  storeGamePost: "oprn:store.gamePost",
  /** 플레이어 평가: 내 게임 평가 읽기·제작자 답글(답글은 작가만 — 서버가 판단). */
  storeGameReviews: "oprn:store.gameReviews",
  storeReviewReply: "oprn:store.reviewReply",
  /** 컨셉 피드(새 게임): 목록 한 쪽·상세·「이걸로 만들었다」 세기. 썸네일은 storeBlob 으로 받는다. */
  storeConcepts: "oprn:store.concepts",
  storeConcept: "oprn:store.concept",
  storeConceptMade: "oprn:store.conceptMade",
  /** 메인 → 렌더러 알림: 받기·올리기 진행, 설치·로그인 변화. */
  storeProgress: "oprn:store.progress",
  storeChanged: "oprn:store.changed",
  /**
   * 「에디터에서 열기」 링크(oprn://store/install). 메인이 검사한 요청을 렌더러로 보내고(push),
   * 프로젝트가 열린 편집기가 부팅하면 맡겨 둔 요청을 한 번 꺼낸다(invoke). openwiki/asset-store.md.
   */
  storeOpenLink: "oprn:store.openLink",
  storeTakeOpenLink: "oprn:store.takeOpenLink",
} as const;

export type OprnChannel = (typeof OPRN_CHANNELS)[keyof typeof OPRN_CHANNELS];

export const OPRN_APP_SCHEME = "app" as const;
export const OPRN_ASSET_SCHEME = "oprn-asset" as const;
