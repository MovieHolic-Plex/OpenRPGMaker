/**
 * 웹 스토어 글자 — 한국어·영어·일본어·중국어(간체). 편집기 i18n 과 같은 네 언어다.
 * 언어 결정: ?lang= (쿠키에 저장) → 쿠키 oprn_store_lang → Accept-Language → 영어.
 * 상품 글(제목·소개·설명)은 여기가 아니라 상품의 locales 에서 온다(items.ts localizedText).
 */
import { STORE_KIND_NAMES, STORE_LICENSE_NAMES, STORE_LICENSE_SHORT, STORE_LOCALES, type StoreItemKind, type StoreLicense, type StoreLocale } from "../../../src/assetStore/format";

export type Lang = StoreLocale;
export const LANGS = STORE_LOCALES;
export const LANG_COOKIE = "oprn_store_lang";
export const LANG_NAMES: Record<Lang, string> = { ko: "한국어", en: "English", ja: "日本語", zh: "简体中文" };
export const HTML_LANG: Record<Lang, string> = { ko: "ko", en: "en", ja: "ja", zh: "zh-CN" };

export function matchLang(tag: string | null | undefined): Lang | null {
  const value = (tag ?? "").trim().toLowerCase();
  if (!value) return null;
  const base = value.split(/[-_]/)[0]!;
  return (LANGS as readonly string[]).includes(base) ? base as Lang : null;
}

/** Accept-Language 를 q 값 순서로 읽어 처음 지원하는 언어. */
export function langFromAcceptLanguage(header: string | undefined): Lang | null {
  const ranked = (header ?? "").split(",").map((part, index) => {
    const [tag, ...params] = part.trim().split(";");
    const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
    return { tag: tag ?? "", q: Number.isFinite(q) ? q : 0, index };
  }).filter((entry) => entry.tag && entry.q > 0).sort((a, b) => b.q - a.q || a.index - b.index);
  for (const entry of ranked) {
    const lang = matchLang(entry.tag);
    if (lang) return lang;
  }
  return null;
}

type Entry = readonly [ko: string, en: string, ja: string, zh: string];
const M = {
  storeName: ["에셋 스토어", "Asset Store", "アセットストア", "素材商店"],
  search: ["타일셋, 캐릭터, 음악 찾기", "Search tilesets, characters, music", "タイルセット・キャラクター・音楽を検索", "搜索图块、角色、音乐"],
  searchLabel: ["찾기", "Search", "検索", "搜索"],
  skip: ["본문으로", "Skip to content", "本文へ", "跳到正文"],
  upload: ["올리기", "Upload", "アップロード", "上传"],
  myItems: ["내 상품", "My items", "マイアイテム", "我的作品"],
  admin: ["운영", "Admin", "管理", "管理"],
  login: ["로그인", "Sign in", "ログイン", "登录"],
  logout: ["로그아웃", "Sign out", "ログアウト", "退出"],
  language: ["언어", "Language", "言語", "语言"],
  all: ["전체", "All", "すべて", "全部"],
  free: ["무료", "Free", "無料", "免费"],
  allFree: ["모든 에셋 무료", "Every asset is free", "すべて無料", "全部免费"],
  footerTag: ["OPRN 에디터를 위한 무료 RPG 에셋", "Free RPG assets for the OPRN editor", "OPRN エディター向けの無料 RPG アセット", "OPRN 编辑器的免费 RPG 素材"],
  terms: ["이용약관", "Terms", "利用規約", "使用条款"],
  copyright: ["저작권 신고", "Copyright", "著作権の申し立て", "版权投诉"],
  privacy: ["개인정보", "Privacy", "プライバシー", "隐私"],
  contact: ["문의 {0}", "Contact {0}", "お問い合わせ {0}", "联系 {0}"],

  aiReady: ["조수 사용 가능", "AI-ready", "AI 対応", "AI 可用"],
  aiReadyTitle: ["참고문서가 들어 있어 에디터 조수가 바로 이 타일로 맵을 깔 수 있습니다", "Includes reference docs, so the editor assistant can build maps with these tiles right away", "参考資料入りで、エディターのアシスタントがこのタイルですぐにマップを作れます", "附带参考文档，编辑器助手可直接用这些图块搭建地图"],
  aiGenerated: ["AI 생성", "AI-generated", "AI 生成", "AI 生成"],
  aiGeneratedTitle: ["AI 도구로 만든 그림·소리가 들어 있습니다", "Contains art or audio made with AI tools", "AI ツールで作った絵・音を含みます", "包含用 AI 工具制作的图像或声音"],
  downloads: ["받기 {0}", "{0} downloads", "{0} ダウンロード", "{0} 次下载"],
  downloadOne: ["받기 1", "1 download", "1 ダウンロード", "1 次下载"],
  newArrival: ["새로 올라옴", "New", "新着", "新上架"],
  items: ["{0}개", "{0} items", "{0} 件", "{0} 个"],

  heroEyebrow: ["추천", "Featured", "おすすめ", "精选"],
  heroTitle: ["게임에 바로 까는 도트 에셋", "Pixel assets that drop straight into your game", "そのままゲームに使えるドット素材", "直接放进游戏的像素素材"],
  heroLead: ["타일셋·캐릭터·얼굴·음악을 OPRN 에디터 안에서 받아 프로젝트에 넣습니다. 「조수 사용 가능」 팩은 AI 조수가 그 타일로 바로 맵을 깝니다.", "Get tilesets, characters, portraits and music inside the OPRN editor and add them to your project. AI-ready packs let the assistant build maps with them instantly.", "タイルセット・キャラクター・顔グラ・音楽を OPRN エディターの中で受け取り、プロジェクトに追加します。「AI 対応」パックなら、アシスタントがそのタイルですぐにマップを作ります。", "在 OPRN 编辑器里获取图块、角色、头像和音乐并加入项目。「AI 可用」素材包能让助手直接用它们搭建地图。"],
  viewItem: ["자세히 보기", "View details", "詳しく見る", "查看详情"],
  howToGet: ["에디터에서 받는 법", "How to get it", "エディターでの入手方法", "如何在编辑器中获取"],
  categories: ["카테고리", "Categories", "カテゴリー", "分类"],
  seeAll: ["모두 보기", "See all", "すべて見る", "查看全部"],
  shelfPack: ["조수가 바로 쓰는 타일셋", "AI-ready tilesets", "アシスタントがすぐ使えるタイルセット", "助手可直接使用的图块"],
  shelfCharacter: ["캐릭터·걷기 칩", "Characters & walking sprites", "キャラクター・歩行グラフィック", "角色与行走图"],
  shelfFace: ["얼굴·흉상·전신", "Faces, busts & full-body portraits", "顔グラ・バストアップ・立ち絵", "头像、半身像与立绘"],
  shelfNew: ["새로 올라온 것", "Recently added", "新着", "最新上架"],
  shelfPopular: ["많이 받은 것", "Most downloaded", "人気", "下载最多"],
  creatorTitle: ["직접 만든 에셋을 나눠 보세요", "Share the assets you made", "自作のアセットを共有しましょう", "分享你制作的素材"],
  creatorLead: ["에디터에서 타일셋을 고르면 그림·참고문서까지 한 번에 팩이 됩니다. 받는 사람의 게임 크레딧에는 이름이 자동으로 들어갑니다.", "Pick a tileset in the editor and it becomes a pack with its art and reference docs. Your name goes into every game's credits automatically.", "エディターでタイルセットを選ぶと、絵と参考資料ごとパックになります。使った人のゲームのクレジットにはあなたの名前が自動で入ります。", "在编辑器里选中图块，就会连同图像和参考文档打包。使用者游戏的制作人员名单里会自动写上你的名字。"],
  creatorPoint1: ["올리면 자동 검사", "Automatic checks", "自動チェック", "自动检查"],
  creatorPoint2: ["크레딧 자동 표기", "Automatic credits", "クレジット自動表記", "自动署名"],
  creatorPoint3: ["언제나 무료", "Always free", "いつでも無料", "永久免费"],
  startUpload: ["에셋 올리기", "Upload an asset", "アセットをアップロード", "上传素材"],
  totalAssets: ["공개 에셋 {0}개", "{0} public assets", "公開アセット {0} 件", "已公开 {0} 个素材"],

  filters: ["거르기", "Filters", "絞り込み", "筛选"],
  kindHeading: ["종류", "Type", "種類", "类型"],
  onlyAiReady: ["조수 사용 가능만", "AI-ready only", "AI 対応のみ", "仅 AI 可用"],
  sort: ["정렬", "Sort", "並び替え", "排序"],
  sortNew: ["최신", "Newest", "新着順", "最新"],
  sortPopular: ["인기", "Popular", "人気順", "最热"],
  resultsFor: ["「{0}」 결과", "Results for “{0}”", "「{0}」の検索結果", "“{0}”的结果"],
  allAssets: ["모든 에셋", "All assets", "すべてのアセット", "全部素材"],
  emptyFiltered: ["조건에 맞는 에셋이 없습니다.", "No assets match these filters.", "条件に合うアセットはありません。", "没有符合条件的素材。"],
  emptyAll: ["아직 진열된 에셋이 없습니다.", "Nothing here yet.", "まだアセットがありません。", "还没有素材。"],
  backHome: ["처음으로", "Back to the store", "ストアへ戻る", "返回商店"],
  prev: ["이전", "Previous", "前へ", "上一页"],
  next: ["다음", "Next", "次へ", "下一页"],

  breadcrumbStore: ["스토어", "Store", "ストア", "商店"],
  by: ["{0} 만듦", "by {0}", "作者 {0}", "作者 {0}"],
  getInEditor: ["에디터에서 받기", "Get it in the editor", "エディターで入手", "在编辑器中获取"],
  step1: ["OPRN 에디터 왼쪽 막대에서 「스토어」를 엽니다.", "Open “Store” from the left bar of the OPRN editor.", "OPRN エディター左のバーから「ストア」を開きます。", "在 OPRN 编辑器左侧栏打开「商店」。"],
  step2: ["이 에셋을 찾아 「받기」를 누릅니다.", "Find this asset and press “Get”.", "このアセットを探して「入手」を押します。", "找到这个素材并点击「获取」。"],
  step3: ["「이 프로젝트에 넣기」를 누르면 끝입니다.", "Press “Add to this project” and you're done.", "「このプロジェクトに追加」を押せば完了です。", "点击「加入此项目」即可。"],
  getNote: ["받은 에셋은 프로젝트 안에 저장되어 스토어 없이도 게임이 돌아갑니다.", "Assets are saved inside your project, so the game runs without the store.", "受け取ったアセットはプロジェクト内に保存され、ストアがなくてもゲームは動きます。", "素材保存在项目内，没有商店也能运行游戏。"],
  copyId: ["상품 주소", "Item ID", "アイテム ID", "素材 ID"],
  license: ["라이선스", "License", "ライセンス", "许可"],
  contents: ["들어 있는 것", "What's inside", "内容", "包含内容"],
  contentsCount: ["타일셋 {0} · 그림·소리 {1} · 참고문서 {2}", "{0} tilesets · {1} images & sounds · {2} reference docs", "タイルセット {0}・絵と音 {1}・参考資料 {2}", "图块 {0} · 图像与声音 {1} · 参考文档 {2}"],
  version: ["판본", "Version", "バージョン", "版本"],
  updated: ["업데이트", "Updated", "更新日", "更新于"],
  size: ["크기", "Size", "サイズ", "大小"],
  languages: ["언어", "Languages", "言語", "语言"],
  tags: ["태그", "Tags", "タグ", "标签"],
  description: ["설명", "Description", "説明", "介绍"],
  insideTitle: ["들어 있는 그림·소리", "Images and sounds in this pack", "収録されている絵と音", "包含的图像与声音"],
  insideMore: ["외 {0}개", "and {0} more", "ほか {0} 件", "另有 {0} 个"],
  creditsTitle: ["크레딧 표기", "Credits", "クレジット表記", "署名信息"],
  creditsNote: ["에디터가 게임의 타이틀 「크레딧」 창에 이 문장을 자동으로 넣습니다.", "The editor adds this line to your game's title-screen credits automatically.", "エディターがゲームのタイトル画面「クレジット」にこの文を自動で入れます。", "编辑器会自动把这段文字加入游戏标题画面的「制作人员」。"],
  versionsTitle: ["판본 기록", "Version history", "バージョン履歴", "版本记录"],
  versionN: ["판본 {0}", "Version {0}", "バージョン {0}", "版本 {0}"],
  related: ["같은 종류의 다른 에셋", "More like this", "同じ種類のアセット", "同类素材"],
  mine: ["내 상품입니다. 새 판본은 에디터에서 같은 상품으로 다시 올리면 됩니다.", "This is your item. Upload again from the editor to publish a new version.", "あなたのアイテムです。新しいバージョンはエディターから同じアイテムとして再アップロードします。", "这是你的作品。在编辑器中重新上传即可发布新版本。"],
  report: ["신고하기", "Report", "報告する", "举报"],
  reportReason: ["사유", "Reason", "理由", "原因"],
  reportDetail: ["자세히", "Details", "詳細", "详情"],
  reportPlaceholder: ["저작권 침해라면 원작 주소를 적어 주세요.", "For copyright issues, include a link to the original work.", "著作権侵害の場合は原作の URL を書いてください。", "如涉及侵权，请附上原作链接。"],
  reportSend: ["신고 보내기", "Send report", "報告を送る", "提交举报"],
  reportFine: ["권리자의 정식 게시중단 요청은 {0} 절차를 따라 주세요.", "Rights holders should follow the {0} process for formal takedowns.", "権利者による正式な削除依頼は {0} の手続きに従ってください。", "权利人的正式下架请求请按照{0}流程处理。"],
  reportDone: ["신고를 받았습니다. 고맙습니다.", "Thanks — your report was received.", "報告を受け付けました。ありがとうございます。", "已收到举报，谢谢。"],
  reasonCopyright: ["저작권 침해", "Copyright infringement", "著作権侵害", "侵犯版权"],
  reasonInappropriate: ["부적절한 내용", "Inappropriate content", "不適切な内容", "不当内容"],
  reasonBroken: ["파일이 깨짐", "Broken files", "ファイルが壊れている", "文件损坏"],
  reasonSpam: ["스팸·광고", "Spam or advertising", "スパム・広告", "垃圾信息或广告"],
  reasonOther: ["기타", "Other", "その他", "其他"],
  preview: ["{0} 미리보기 {1}", "{0} preview {1}", "{0} プレビュー {1}", "{0} 预览 {1}"],

  statusPending: ["확인 대기", "Awaiting review", "確認待ち", "待审核"],
  statusVisible: ["공개", "Public", "公開", "公开"],
  statusHidden: ["숨김", "Hidden", "非表示", "已隐藏"],
  statusRemoved: ["내려감", "Removed", "削除済み", "已下架"],
  pendingNote: ["새 작가의 첫 공개는 운영자가 한 번 확인합니다. 확인 전에는 목록에 보이지 않습니다.", "A new creator's first items are reviewed once before they appear in the store.", "新しい作者の最初の公開は運営が一度確認します。確認までは一覧に表示されません。", "新作者的首批作品会先经过一次审核，审核前不会出现在列表中。"],
  hiddenByAuthor: ["작가가 숨김", "Hidden by the creator", "作者が非表示にしました", "作者已隐藏"],
  hiddenByReports: ["신고 누적으로 자동 숨김", "Hidden automatically after reports", "報告が重なり自動で非表示", "因多次举报自动隐藏"],
  hiddenByAdmin: ["운영자가 숨김", "Hidden by an admin", "運営が非表示にしました", "管理员已隐藏"],

  uploadTitle: ["파일 하나 올리기", "Upload a single file", "ファイルを 1 つアップロード", "上传单个文件"],
  uploadLead: ["PNG 그림 한 장이나 음원 하나를 올립니다. 참고문서까지 든 타일셋 팩은 OPRN 에디터의 「스토어 → 올리기」에서 올리세요 — 「조수 사용 가능」 표시가 붙습니다.", "Upload one PNG image or one audio file. Tileset packs with reference docs are uploaded from “Store → Upload” in the OPRN editor and get the AI-ready badge.", "PNG 画像 1 枚か音声 1 つをアップロードします。参考資料入りのタイルセットパックは OPRN エディターの「ストア → アップロード」から上げると「AI 対応」になります。", "上传一张 PNG 图片或一个音频文件。带参考文档的图块包请在 OPRN 编辑器的「商店 → 上传」中上传，会获得「AI 可用」标记。"],
  fieldFile: ["파일", "File", "ファイル", "文件"],
  fieldKind: ["종류", "Type", "種類", "类型"],
  fieldTileSize: ["칸 크기(타일셋)", "Tile size (tilesets)", "タイルサイズ（タイルセット）", "图块尺寸（图块集）"],
  fieldTitle: ["제목", "Title", "タイトル", "标题"],
  fieldSummary: ["한 줄 소개", "One-line summary", "ひとこと紹介", "一句话简介"],
  fieldDescription: ["설명", "Description", "説明", "介绍"],
  fieldTags: ["태그(쉼표로 구분)", "Tags (comma separated)", "タグ（カンマ区切り）", "标签（用逗号分隔）"],
  tagsPlaceholder: ["숲, 마을, 16px", "forest, village, 16px", "森, 村, 16px", "森林, 村庄, 16px"],
  fieldAi: ["AI 생성 여부 (필수)", "AI use (required)", "AI 使用の有無（必須）", "是否使用 AI（必填）"],
  aiYes: ["AI 도구로 만든 부분이 있다", "Parts were made with AI tools", "AI ツールで作った部分がある", "部分内容由 AI 工具制作"],
  aiNo: ["전부 직접 만들었다", "I made all of it myself", "すべて自分で作った", "全部由我自己制作"],
  fieldCredits: ["크레딧 표기", "Credit line", "クレジット表記", "署名"],
  creditsPlaceholder: ["그림: 이름 (사이트)", "Art: Name (site)", "絵: 名前（サイト）", "美术：姓名（网站）"],
  agree: ["이 파일의 권리를 내가 가지고 있고 {0}에 동의합니다.", "I own the rights to this file and agree to the {0}.", "このファイルの権利を持っており、{0}に同意します。", "我拥有此文件的权利并同意{0}。"],
  uploadSubmit: ["올리기", "Upload", "アップロード", "上传"],
  upChoose: ["파일을 골라 주세요.", "Choose a file.", "ファイルを選んでください。", "请选择文件。"],
  upHashing: ["파일 확인 중…", "Checking the file…", "ファイルを確認中…", "正在检查文件…"],
  upSending: ["파일 올리는 중…", "Uploading…", "アップロード中…", "正在上传…"],
  upCreating: ["상품 만드는 중…", "Creating the item…", "アイテムを作成中…", "正在创建素材…"],
  upDone: ["올렸습니다.", "Uploaded.", "アップロードしました。", "已上传。"],
  upPending: ["새 작가의 첫 공개는 운영자가 한 번 확인합니다.", "A new creator's first items are reviewed once.", "新しい作者の最初の公開は運営が一度確認します。", "新作者的首批作品会先审核一次。"],
  upView: ["상품 보기 →", "View item →", "アイテムを見る →", "查看素材 →"],

  meTitle: ["내 상품", "My items", "マイアイテム", "我的作品"],
  meEmpty: ["아직 올린 상품이 없습니다.", "You haven't uploaded anything yet.", "まだアップロードしたアイテムはありません。", "你还没有上传任何作品。"],
  colTitle: ["제목", "Title", "タイトル", "标题"],
  colStatus: ["상태", "Status", "状態", "状态"],
  colVersion: ["판본", "Version", "バージョン", "版本"],
  colDownloads: ["받기", "Downloads", "ダウンロード", "下载"],
  hide: ["숨기기", "Hide", "非表示にする", "隐藏"],
  unhide: ["다시 공개", "Publish again", "再公開", "重新公开"],

  adminTitle: ["운영", "Admin", "管理", "管理"],
  adminPending: ["확인 대기 {0}", "Awaiting review: {0}", "確認待ち {0}", "待审核 {0}"],
  adminReported: ["신고 {0}", "Reports: {0}", "報告 {0}", "举报 {0}"],
  none: ["없음", "None", "なし", "无"],
  approve: ["공개", "Publish", "公開", "公开"],
  remove: ["내리기", "Remove", "削除", "下架"],
  keepPublic: ["문제없음 · 공개", "No problem · publish", "問題なし・公開", "无问题 · 公开"],
  keepHidden: ["숨김 유지", "Keep hidden", "非表示のまま", "保持隐藏"],

  loginTitle: ["로그인", "Sign in", "ログイン", "登录"],
  loginLead: ["둘러보기와 받기는 로그인 없이 됩니다. 에셋을 올리거나 내 상품을 관리할 때만 로그인합니다.", "Browsing and downloading need no account. Sign in only to upload or manage your items.", "閲覧と入手にログインは不要です。アップロードやアイテム管理のときだけログインします。", "浏览和下载无需登录，只有上传或管理作品时才需要登录。"],
  loginGoogle: ["Google 계정으로 로그인", "Continue with Google", "Google でログイン", "使用 Google 登录"],
  loginSoon: ["일반 로그인(Google)은 곧 열립니다. 지금은 둘러보기와 받기만 할 수 있습니다.", "Google sign-in opens soon. For now you can browse and download.", "Google ログインはまもなく公開します。今は閲覧と入手のみできます。", "Google 登录即将开放，目前只能浏览和下载。"],
  alreadyIn: ["이미 로그인했습니다", "You're already signed in", "すでにログインしています", "你已登录"],
  continue: ["계속하기", "Continue", "続ける", "继续"],
  devNote: ["스테이징 전용 개발 로그인입니다. 운영 서버에서는 꺼져 있습니다.", "Staging-only developer sign-in. Disabled in production.", "ステージング専用の開発用ログインです。本番では無効です。", "仅限测试环境的开发登录，正式服务器已关闭。"],
  email: ["이메일", "Email", "メールアドレス", "邮箱"],
  name: ["이름", "Name", "名前", "名称"],
  linkTitle: ["운영자 로그인", "Admin sign-in", "管理者ログイン", "管理员登录"],
  linkLead: ["서버에서 발급한 일회용 링크입니다. 아래 단추를 누르면 로그인됩니다(한 번만 쓸 수 있습니다).", "This is a one-time link issued by the server. Press the button to sign in (it works once).", "サーバーが発行した使い捨てリンクです。下のボタンでログインします（1 回のみ有効）。", "这是服务器生成的一次性链接，点击下方按钮即可登录（仅可使用一次）。"],

  deviceTitle: ["에디터 로그인", "Editor sign-in", "エディターのログイン", "编辑器登录"],
  deviceApproved: ["허락했습니다. 에디터로 돌아가면 로그인이 끝나 있습니다.", "Approved. Go back to the editor — you're signed in.", "許可しました。エディターに戻るとログインが完了しています。", "已允许。回到编辑器即可完成登录。"],
  deviceDenied: ["거절했습니다.", "Denied.", "拒否しました。", "已拒绝。"],
  deviceExpired: ["코드가 만료되었거나 이미 쓰였습니다. 에디터에서 다시 시작해 주세요.", "The code expired or was already used. Start again from the editor.", "コードの期限が切れたか、すでに使われています。エディターからやり直してください。", "代码已过期或已被使用，请在编辑器中重新开始。"],
  deviceAsk: ["OPRN 데스크톱 앱이 {0} 계정으로 로그인하려고 합니다.", "The OPRN desktop app wants to sign in as {0}.", "OPRN デスクトップアプリが {0} でログインしようとしています。", "OPRN 桌面应用想以 {0} 登录。"],
  deviceWarn: ["내가 직접 에디터에서 「로그인」을 누른 경우에만 허락하세요. 다른 사람이 보내 준 코드라면 거절하세요.", "Only approve if you pressed “Sign in” in the editor yourself. If someone sent you this code, deny it.", "自分でエディターの「ログイン」を押した場合だけ許可してください。他人から送られたコードなら拒否してください。", "只有你自己在编辑器中点击了「登录」时才允许。如果是别人发来的代码，请拒绝。"],
  deviceMatch: ["에디터 화면의 코드와 같은지 확인하세요.", "Check that it matches the code in the editor.", "エディター画面のコードと同じか確認してください。", "请确认与编辑器中显示的代码一致。"],
  allow: ["허락", "Allow", "許可", "允许"],
  deny: ["거절", "Deny", "拒否", "拒绝"],
  deviceNotFound: ["코드를 찾지 못했습니다.", "Code not found.", "コードが見つかりません。", "找不到该代码。"],
  deviceInput: ["에디터 코드", "Editor code", "エディターのコード", "编辑器代码"],
  check: ["확인", "Check", "確認", "确认"],

  notFound: ["찾을 수 없습니다", "Not found", "見つかりません", "未找到"],
  problem: ["문제가 생겼습니다", "Something went wrong", "問題が発生しました", "出现问题"],
  errorGeneric: ["요청을 처리하지 못했습니다({0}).", "The request could not be completed ({0}).", "リクエストを処理できませんでした（{0}）。", "无法完成请求（{0}）。"],
} as const satisfies Record<string, Entry>;

export type MessageKey = keyof typeof M;
export type T = (key: MessageKey, ...args: (string | number)[]) => string;
const INDEX: Record<Lang, number> = { ko: 0, en: 1, ja: 2, zh: 3 };

export function translator(lang: Lang): T {
  return (key, ...args) => M[key][INDEX[lang]]!.replace(/\{(\d)\}/g, (_, n: string) => String(args[Number(n)] ?? ""));
}

export const kindLabel = (lang: Lang, kind: StoreItemKind): string => STORE_KIND_NAMES[kind][lang];
export const licenseLabel = (lang: Lang, license: StoreLicense): string => STORE_LICENSE_NAMES[license][lang];
export const licenseShort = (license: StoreLicense): string => STORE_LICENSE_SHORT[license];

/** 날짜: 언어별 짧은 표기(서울 시각). */
export function formatDate(lang: Lang, iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(HTML_LANG[lang], { timeZone: "Asia/Seoul", year: "numeric", month: "short", day: "numeric" });
}

/** 이용약관·저작권·개인정보 문서. 한국어가 정본이고 나머지는 번역이다(문서 첫머리에 밝힌다). */
export const DOCS: Record<"terms" | "copyright" | "privacy", Record<Lang, (contact: string) => string>> = {
  terms: {
    ko: (c) => `<p>OPRN 에셋 스토어(이하 스토어)는 OPRN 에디터 사용자가 게임 제작용 그림·소리를 나누는 무료 서비스입니다.</p>
<h2>올리는 사람</h2><ol><li>내가 권리를 가진 것만 올립니다. 다른 사람의 팩·게임에서 뽑은 그림, 상업 팩의 원본·변형물은 올릴 수 없습니다.</li>
<li>AI 도구로 만든 부분이 있으면 「AI 생성」을 표시합니다.</li><li>고른 라이선스로 다른 사용자가 쓰는 것을 허락합니다. 이미 받은 사람의 사용 권리는 상품을 숨기거나 내려도 남습니다.</li>
<li>올린 파일은 자동 검사를 거칩니다. 새 계정의 첫 3건은 운영자가 확인한 뒤 공개됩니다.</li></ol>
<h2>받는 사람</h2><ol><li>각 상품의 라이선스와 크레딧 표기를 지킵니다. 에디터는 크레딧을 게임에 자동으로 넣습니다.</li><li>「OPRN 게임 사용」 라이선스는 게임 안에서만 자유롭게 쓰고, 원본 파일을 따로 다시 배포하지 않는 조건입니다.</li></ol>
<h2>운영</h2><p>신고가 쌓이거나 약관을 어긴 상품은 숨기거나 내릴 수 있습니다. 문의: ${c}</p>`,
    en: (c) => `<p class="doc-note">This is a translation. The Korean version is authoritative.</p><p>The OPRN Asset Store (“the Store”) is a free service where OPRN editor users share art and audio for making games.</p>
<h2>Uploaders</h2><ol><li>Upload only what you hold the rights to. Art ripped from other people's packs or games, and originals or edits of commercial packs, are not allowed.</li>
<li>Mark anything made with AI tools as “AI-generated”.</li><li>You allow other users to use your upload under the license you choose. People who already downloaded it keep that right even if you hide or remove the item.</li>
<li>Uploads go through automatic checks. A new account's first three items are reviewed by an admin before they are published.</li></ol>
<h2>Downloaders</h2><ol><li>Follow each item's license and credit line. The editor adds credits to your game automatically.</li><li>The “OPRN Game Use” license lets you use the asset freely inside games, on the condition that you do not redistribute the source files on their own.</li></ol>
<h2>Moderation</h2><p>Items that collect reports or break these terms may be hidden or removed. Contact: ${c}</p>`,
    ja: (c) => `<p class="doc-note">これは翻訳です。韓国語版が正本です。</p><p>OPRN アセットストア（以下「ストア」）は、OPRN エディターのユーザーがゲーム制作用の絵や音を共有する無料サービスです。</p>
<h2>アップロードする方</h2><ol><li>自分が権利を持つものだけをアップロードしてください。他人のパックやゲームから抜き出した絵、商用パックの原本や改変物は禁止です。</li>
<li>AI ツールで作った部分がある場合は「AI 生成」を表示してください。</li><li>選んだライセンスで他のユーザーが使うことを許可します。すでに入手した人の利用権は、アイテムを非表示・削除しても残ります。</li>
<li>アップロードしたファイルは自動チェックを受けます。新しいアカウントの最初の 3 件は運営が確認してから公開されます。</li></ol>
<h2>入手する方</h2><ol><li>各アイテムのライセンスとクレジット表記を守ってください。エディターはクレジットをゲームに自動で入れます。</li><li>「OPRN ゲーム使用」ライセンスは、ゲーム内では自由に使え、元ファイルを単体で再配布しないことが条件です。</li></ol>
<h2>運営</h2><p>報告が重なったり規約に違反したアイテムは、非表示または削除することがあります。お問い合わせ: ${c}</p>`,
    zh: (c) => `<p class="doc-note">本文为译文，以韩文版本为准。</p><p>OPRN 素材商店（以下简称「商店」）是供 OPRN 编辑器用户分享游戏制作用图像和声音的免费服务。</p>
<h2>上传者</h2><ol><li>只上传你拥有权利的内容。不得上传从他人素材包或游戏中提取的图像，也不得上传商业素材包的原件或改编版。</li>
<li>如有使用 AI 工具制作的部分，请标注「AI 生成」。</li><li>你允许其他用户按你选择的许可使用作品。即使作品被隐藏或下架，已下载用户的使用权仍然保留。</li>
<li>上传的文件会经过自动检查。新账号的前 3 个作品需经管理员审核后公开。</li></ol>
<h2>下载者</h2><ol><li>请遵守每个素材的许可和署名要求。编辑器会自动把署名加入游戏。</li><li>「OPRN 游戏使用」许可允许在游戏内自由使用，但不得单独再分发原始文件。</li></ol>
<h2>运营</h2><p>被多次举报或违反条款的素材可能会被隐藏或下架。联系方式：${c}</p>`,
  },
  copyright: {
    ko: (c) => `<p>스토어의 상품이 내 저작권을 침해한다면 아래 내용을 적어 ${c} 로 보내 주세요.</p>
<ol><li>침해된 원작과 권리자를 확인할 수 있는 자료(원작 주소 등)</li><li>스토어 상품 주소</li><li>연락처와 권리자 본인(또는 대리인)이라는 진술</li></ol>
<p>확인되면 상품을 내리고 파일 제공을 멈춥니다. 급한 경우 상품 화면의 「신고하기」도 함께 써 주세요 — 신고가 쌓이면 확인 전에 자동으로 숨겨집니다.</p>`,
    en: (c) => `<p class="doc-note">This is a translation. The Korean version is authoritative.</p><p>If an item in the Store infringes your copyright, email ${c} with the following:</p>
<ol><li>Material identifying the original work and its rights holder (such as a link to the original)</li><li>The address of the Store item</li><li>Your contact details and a statement that you are the rights holder or their agent</li></ol>
<p>Once confirmed, we remove the item and stop serving its files. If it is urgent, also use “Report” on the item page — items that collect reports are hidden automatically before review.</p>`,
    ja: (c) => `<p class="doc-note">これは翻訳です。韓国語版が正本です。</p><p>ストアのアイテムがあなたの著作権を侵害している場合は、次の内容を ${c} にお送りください。</p>
<ol><li>侵害された原作と権利者を確認できる資料（原作の URL など）</li><li>ストアのアイテムの URL</li><li>連絡先と、権利者本人（または代理人）であるという申し立て</li></ol>
<p>確認でき次第、アイテムを削除しファイルの提供を停止します。急ぎの場合はアイテム画面の「報告する」も併せてご利用ください — 報告が重なると確認前に自動で非表示になります。</p>`,
    zh: (c) => `<p class="doc-note">本文为译文，以韩文版本为准。</p><p>如果商店中的素材侵犯了你的版权，请将以下内容发送至 ${c}：</p>
<ol><li>可以确认原作及权利人的材料（如原作链接）</li><li>商店素材的地址</li><li>联系方式，以及你是权利人本人（或代理人）的声明</li></ol>
<p>核实后我们会下架该素材并停止提供文件。紧急情况下也请在素材页面使用「举报」——举报累积后会在审核前自动隐藏。</p>`,
  },
  privacy: {
    ko: (c) => `<p>로그인할 때 이메일과 표시 이름만 저장합니다. 비밀번호는 저장하지 않습니다(Google 로그인).</p>
<p>받기 수·신고는 같은 사람이 여러 번 세지 않도록 로그인 계정 또는 IP 의 해시로 구분합니다. IP 원문은 저장하지 않습니다.</p><p>계정 삭제 요청: ${c}</p>`,
    en: (c) => `<p class="doc-note">This is a translation. The Korean version is authoritative.</p><p>When you sign in we store only your email address and display name. We never store passwords (sign-in is through Google).</p>
<p>To avoid counting the same person twice, downloads and reports are keyed by your account or a hash of your IP address. Raw IP addresses are not stored.</p><p>Account deletion requests: ${c}</p>`,
    ja: (c) => `<p class="doc-note">これは翻訳です。韓国語版が正本です。</p><p>ログイン時に保存するのはメールアドレスと表示名だけです。パスワードは保存しません（Google ログイン）。</p>
<p>ダウンロード数と報告は、同じ人を重複して数えないよう、アカウントまたは IP アドレスのハッシュで区別します。IP アドレスそのものは保存しません。</p><p>アカウント削除の依頼: ${c}</p>`,
    zh: (c) => `<p class="doc-note">本文为译文，以韩文版本为准。</p><p>登录时我们只保存邮箱和显示名称，不保存密码（通过 Google 登录）。</p>
<p>为避免重复统计同一人，下载次数和举报以账号或 IP 地址的哈希值区分，不保存原始 IP 地址。</p><p>删除账号请求：${c}</p>`,
  },
};
export const DOC_TITLES: Record<"terms" | "copyright" | "privacy", Entry> = {
  terms: ["이용약관", "Terms of use", "利用規約", "使用条款"],
  copyright: ["저작권 신고 · 게시중단 요청", "Copyright and takedown requests", "著作権の申し立て・削除依頼", "版权投诉与下架请求"],
  privacy: ["개인정보 처리", "Privacy", "個人情報の取り扱い", "隐私政策"],
};
export const docTitle = (lang: Lang, doc: keyof typeof DOC_TITLES): string => DOC_TITLES[doc][INDEX[lang]]!;
