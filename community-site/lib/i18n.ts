export const LANGS = ["en", "ko"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";

export function toLang(value: string | undefined): Lang {
  return LANGS.includes(value as Lang) ? (value as Lang) : DEFAULT_LANG;
}

const en = {
  nav: { assets: "Assets", games: "Games", board: "Board", share: "Share yours", brand: "OpenRPGMaker", brandSub: "Community" },
  hero: {
    eyebrow: "asset · game · share",
    titleA: "Make it. Share it.",
    titleB: "Load it straight back.",
    titleC: "The OpenRPGMaker hub",
    body: "Chipsets, charsets, facesets and full game packages. Games import straight into the editor; assets ship in its native resource format.",
    browseAssets: "Browse assets",
    browseGames: "Browse games",
    share: "Share your work",
  },
  quest: {
    title: "How sharing works",
    step1t: "Download",
    step1b: "Grab an .oprn package or an asset JSON from the library.",
    step2t: "Import",
    step2b: "In the editor: Project → Import. The file opens as-is.",
    step3t: "Play & remix",
    step3b: "Maps, events and database arrive intact. Make it yours.",
  },
  stats: { assets: "assets", games: "games", posts: "posts", downloads: "downloads" },
  sections: { recentAssets: "Fresh assets", recentGames: "Fresh games", recentPosts: "From the board", viewAll: "View all →" },
  empty: { assets: "No assets here yet — be the first to share one.", games: "No games shared yet.", posts: "No posts yet. Start the conversation." },
  board: {
    title: "Board", write: "New post", back: "← Board",
    categories: { all: "All", general: "General", showcase: "Showcase", qna: "Q&A", feedback: "Feedback" } as Record<string, string>,
    comments: "Comments", writeComment: "Write a comment", postComment: "Post comment",
    yourName: "Nickname", nameOptional: "anonymous", titleField: "Title", bodyField: "Body",
    publish: "Publish post", views: "views",
  },
  asset: {
    library: "Asset library", upload: "+ Upload asset", all: "All", search: "Search assets…",
    sortNew: "Newest", sortPopular: "Most downloaded",
    back: "← Assets", by: "by", downloads: "downloads",
    dlJson: "Download for editor (JSON)", dlImage: "Download original image",
    howtoTitle: "Using it in the editor",
    howtoBody: "The JSON is the editor's UploadedAsset format. Import it via the resource manager as kind",
    howtoTail: "and match the meta values.",
  },
  game: {
    library: "Game library", upload: "+ Upload game", back: "← Games", search: "Search games…",
    maps: "maps", assetsInside: "assets", dl: "Download source .oprn",
    dlRelease: "Download release ZIP", release: "Published version",
    releaseHowtoTitle: "Versioned web release",
    releaseHowtoBody: "This ZIP retains the published project, runtime and assets. Download it unchanged or play this exact version in your browser.",
    playbackUnavailable: "Playback unavailable: this legacy source package has no retained compatibility runtime. Its original .oprn source download is still available.",
    howtoTitle: "Opening it in the editor",
    howtoBody: "This is a standard .oprn package. In the editor, choose Project → Import and pick the file — maps, events and the database open exactly as authored. Older .rpgzzu files still import too.",
  },
  upload: {
    title: "Share your work", assetTab: "Asset (image · sound)", gameTab: "Game release (.zip)",
    name: "Asset name", gameTitle: "Game title", author: "Creator", kind: "Asset kind (editor resource kind)",
    desc: "Description", tags: "Tags (comma separated)", fileAsset: "Image file (PNG/GIF/JPEG/WebP)",
    fileGame: "Editor web release ZIP", submit: "Share", submitting: "Uploading…",
    doneAsset: "Uploaded: /assets/", doneGame: "Uploaded: /games/", pickFile: "Choose a file first.",
    schemaHint: "Export a versioned web ZIP from the editor (96 MB max). It includes the pinned runtime, project and assets. Legacy .oprn source packages are not playable releases; existing source downloads remain available. Each upload creates a new listing, not an update to another creator's game.",
    releaseFileError: "Choose an editor-produced web release .zip, up to 96 MB. A source .oprn is not a release ZIP.",
  },
  common: {
    like: "Like", report: "Report", reported: "Reported", license: "License",
    chooseLicense: "Choose a license…", playInBrowser: "Play in browser",
    coverLabel: "Cover image (optional, shown in the gallery)", category: "Category",
  },
  metaLabels: {
    width: "Width", height: "Height", tileSize: "Tile size", frames: "Frames",
    frameWidth: "Frame width", frameHeight: "Frame height", transparentColor: "Transparent color",
  } as Record<string, string>,
  footer: "OpenRPGMaker Community — take as much as you make.",
  a11y: { langSwitch: "한국어로", langSwitchTo: "한국어" },
};

export type Dict = typeof en;

const ko: Dict = {
  nav: { assets: "에셋", games: "게임", board: "게시판", share: "공유하기", brand: "OpenRPGMaker", brandSub: "Community" },
  hero: {
    eyebrow: "asset · game · share",
    titleA: "만들고, 나누고,",
    titleB: "그대로 다시 담는다.",
    titleC: "OpenRPGMaker 허브",
    body: "칩셋·캐릭터셋·페이스셋부터 통째 게임 패키지까지. 게임 패키지는 에디터에서 바로 열리고, 에셋은 에디터 리소스 형식 그대로 제공됩니다.",
    browseAssets: "에셋 둘러보기",
    browseGames: "게임 둘러보기",
    share: "내 작품 공유하기",
  },
  quest: {
    title: "공유는 이렇게 동작합니다",
    step1t: "다운로드",
    step1b: "라이브러리에서 .oprn 패키지나 에셋 JSON을 받습니다.",
    step2t: "가져오기",
    step2b: "에디터에서 프로젝트 → 불러오기. 파일이 그대로 열립니다.",
    step3t: "플레이 & 리믹스",
    step3b: "맵·이벤트·데이터베이스가 온전히 도착합니다.",
  },
  stats: { assets: "에셋", games: "게임", posts: "글", downloads: "다운로드" },
  sections: { recentAssets: "최근 에셋", recentGames: "최근 게임", recentPosts: "게시판 새 글", viewAll: "전체 보기 →" },
  empty: { assets: "아직 올라온 에셋이 없습니다. 첫 번째 주인공이 되어보세요.", games: "아직 공유된 게임이 없습니다.", posts: "아직 글이 없습니다. 첫 글을 시작하세요." },
  board: {
    title: "게시판", write: "글 쓰기", back: "← 게시판",
    categories: { all: "전체", general: "자유", showcase: "작품 자랑", qna: "질문답변", feedback: "피드백" },
    comments: "댓글", writeComment: "댓글 작성", postComment: "댓글 달기",
    yourName: "닉네임", nameOptional: "anonymous", titleField: "제목", bodyField: "본문",
    publish: "글 올리기", views: "조회",
  },
  asset: {
    library: "에셋 라이브러리", upload: "+ 에셋 올리기", all: "전체", search: "에셋 검색…",
    sortNew: "최신순", sortPopular: "다운로드순",
    back: "← 에셋 목록", by: "by", downloads: "다운로드",
    dlJson: "에디터용 JSON 다운로드", dlImage: "원본 이미지 다운로드",
    howtoTitle: "에디터에서 쓰기",
    howtoBody: "JSON 파일은 에디터의 UploadedAsset 형식입니다. 리소스 매니저에서 kind(",
    howtoTail: ")로 가져온 뒤 meta 값을 맞추면 바로 쓸 수 있습니다.",
  },
  game: {
    library: "게임 라이브러리", upload: "+ 게임 올리기", back: "← 게임 목록", search: "게임 검색…",
    maps: "맵", assetsInside: "에셋", dl: "소스 .oprn 다운로드",
    dlRelease: "출시 ZIP 다운로드", release: "출시 버전",
    releaseHowtoTitle: "버전이 고정된 웹 출시본",
    releaseHowtoBody: "출시 당시 프로젝트·런타임·에셋을 보존한 ZIP입니다. 파일을 그대로 내려받거나 브라우저에서 이 버전을 플레이할 수 있습니다.",
    playbackUnavailable: "플레이할 수 없습니다. 이 예전 소스 패키지에 호환되는 런타임이 보존되어 있지 않습니다. 원본 .oprn 소스는 계속 내려받을 수 있습니다.",
    howtoTitle: "에디터에서 열기",
    howtoBody: "표준 .oprn 패키지입니다. 에디터 메뉴 프로젝트 → 불러오기에서 이 파일을 선택하면 맵·이벤트·데이터베이스가 그대로 열립니다. 예전 .rpgzzu 파일도 계속 열 수 있습니다.",
  },
  upload: {
    title: "작품 공유하기", assetTab: "에셋 (이미지·사운드)", gameTab: "게임 출시본 (.zip)",
    name: "에셋 이름", gameTitle: "게임 제목", author: "제작자", kind: "에셋 종류 (에디터 리소스 kind)",
    desc: "설명", tags: "태그 (쉼표 구분)", fileAsset: "이미지 파일 (PNG/GIF/JPEG/WebP)",
    fileGame: "에디터 웹 출시 ZIP", submit: "공유하기", submitting: "올리는 중…",
    doneAsset: "업로드 완료: /assets/", doneGame: "업로드 완료: /games/", pickFile: "파일을 선택하세요.",
    schemaHint: "에디터에서 버전이 지정된 웹 ZIP을 내보내세요(최대 96 MB). 런타임·프로젝트·에셋이 함께 고정됩니다. 예전 .oprn 소스는 플레이용 출시본이 아니며, 기존 소스 다운로드는 유지됩니다. 업로드마다 새 게시물이 생기며 다른 제작자의 게임을 변경하지 않습니다.",
    releaseFileError: "에디터에서 내보낸 웹 출시 .zip을 선택하세요(최대 96 MB). 소스 .oprn은 출시 ZIP이 아닙니다.",
  },
  common: {
    like: "추천", report: "신고", reported: "신고됨", license: "라이선스",
    chooseLicense: "라이선스를 선택하세요…", playInBrowser: "브라우저에서 플레이",
    coverLabel: "커버 이미지 (선택, 갤러리에 표시)", category: "카테고리",
  },
  metaLabels: {
    width: "너비", height: "높이", tileSize: "타일 크기", frames: "프레임 수",
    frameWidth: "프레임 너비", frameHeight: "프레임 높이", transparentColor: "투명색",
  } as Record<string, string>,
  footer: "OpenRPGMaker Community — 에디터에서 낸 만큼, 다시 담는다.",
  a11y: { langSwitch: "Switch to English", langSwitchTo: "English" },
};

export function getDict(lang: Lang): Dict {
  return lang === "ko" ? ko : en;
}
