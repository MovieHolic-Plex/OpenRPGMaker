// player/vnExtrasStrings.ts
// 미연시 시스템 UI 2단계(갤러리 잠금·엔딩 목록·세이브 카드)의 시스템 글자 — 네 언어 표(2026-10-17).
// 게임 본문은 번역하지 않는다. 언어는 저작자가 정한다(meta.oprnVnExtras.language, 없으면 대사 시스템 언어, 없으면 ko).
// 새 글자를 더할 땐 네 언어를 모두 채운다 — test/vnExtras.test.ts 가 빈 칸과 자리표시자 불일치를 막는다.
import { dialogueUiLocale } from "@/player/dialogueUiStrings";
import type { DialogueUiLanguage } from "@/project/dialogueSystem";
import { DEFAULT_GALLERY_LABEL, galleryMenuLabel } from "@/project/gallery";
import { vnExtrasLanguage } from "@/project/vnExtras";
import type { SupportedLocale } from "@/i18n/locale";

export type VnUiKey =
  | "menu.endings"
  | "gallery.label"
  | "gallery.item"
  | "gallery.progress"
  | "gallery.locked"
  | "gallery.lockedName"
  | "gallery.empty"
  | "gallery.hint"
  | "gallery.endingRecall"
  | "gallery.recallEmpty"
  | "gallery.missing"
  | "gallery.close"
  | "endings.title"
  | "endings.progress"
  | "endings.summary"
  | "endings.seen"
  | "endings.unseen"
  | "endings.hidden"
  | "endings.common"
  | "endings.tier.happy"
  | "endings.tier.normal"
  | "endings.tier.solo"
  | "endings.tier.other"
  | "endings.checklist"
  | "endings.hint"
  | "endings.empty"
  | "endings.undefined"
  | "endings.unknownPerson"
  | "menu.relationships"
  | "menu.quests"
  | "menu.items"
  | "menu.save"
  | "menu.load"
  | "menu.options"
  | "menu.toTitle"
  | "save.title"
  | "load.title"
  | "save.slot"
  | "save.empty"
  | "save.corrupt"
  | "save.saved"
  | "save.autosave"
  | "save.blocked"
  | "save.trigger.transfer"
  | "save.trigger.battleVictory"
  | "save.overwrite"
  | "save.hintDisabled"
  | "save.hintConfirm"
  | "save.hintPick"
  | "load.hint"
  | "ending.badge.character"
  | "ending.badge.bad"
  | "ending.badge.normal"
  | "ending.badge.happy"
  | "ending.badge.plain"
  | "ending.badge.continued"
  | "ending.actEnd"
  | "ending.chapterEnd"
  | "ending.theEnd"
  | "ending.heading"
  | "ending.kicker.dark"
  | "ending.kicker.couple"
  | "ending.kicker.journey"
  | "ending.kicker.solo"
  | "ending.hallOfFame"
  | "ending.continue"
  | "ending.creditsSkip"
  | "ending.creditsRead"
  | "ending.returnTitle"
  | "ending.nextAct";

type Row = Readonly<Record<SupportedLocale, string>>;

export const VN_UI_STRINGS: Readonly<Record<VnUiKey, Row>> = {
  "menu.endings": { ko: "엔딩", en: "Endings", ja: "エンディング", zh: "结局" },
  "gallery.label": { ko: "갤러리", en: "Gallery", ja: "ギャラリー", zh: "画廊" },
  "gallery.item": { ko: "그림 {0}", en: "Picture {0}", ja: "絵 {0}", zh: "画面 {0}" },
  "gallery.progress": { ko: "{0}/{1}장", en: "{0}/{1}", ja: "{0}/{1}枚", zh: "{0}/{1}张" },
  "gallery.locked": { ko: "잠김", en: "Locked", ja: "未開放", zh: "未解锁" },
  "gallery.lockedName": { ko: "???", en: "???", ja: "???", zh: "???" },
  "gallery.empty": { ko: "아직 열린 그림이 없습니다.", en: "Nothing unlocked yet.", ja: "まだ開放された絵がありません。", zh: "还没有解锁的画面。" },
  "gallery.hint": { ko: "결정 키로 화면 가득 봅니다. 엔딩 회상은 결정 키로 글을 다시 읽습니다. 한 번 연 그림은 이 기기에 남아 다른 저장 칸·새 게임에서도 열려 있습니다.", en: "Confirm to view full screen. Confirm an ending to read it again. Pictures you have opened stay on this device, in every save slot and new game.", ja: "決定キーで全画面表示。エンディングは決定キーで文章を読み返せます。一度開いた絵はこの端末に残り、他のセーブ枠や新しいゲームでも開いたままです。", zh: "按确认键全屏查看；选择结局可重读文字。解锁过的画面保存在本设备，其他存档栏和新游戏中同样可看。" },
  "gallery.endingRecall": { ko: "엔딩 회상 · {0}", en: "Recall · {0}", ja: "回想 · {0}", zh: "回顾 · {0}" },
  "gallery.recallEmpty": { ko: "(이 엔딩은 글 없이 끝납니다.)", en: "(This ending has no text.)", ja: "(このエンディングには文章がありません。)", zh: "(此结局没有文字。)" },
  "gallery.missing": { ko: "그림을 찾을 수 없습니다.", en: "Picture not found.", ja: "絵が見つかりません。", zh: "找不到画面。" },
  "gallery.close": { ko: "닫기", en: "Close", ja: "閉じる", zh: "关闭" },
  "endings.title": { ko: "엔딩", en: "Endings", ja: "エンディング", zh: "结局" },
  "endings.progress": { ko: "{0}/{1}", en: "{0}/{1}", ja: "{0}/{1}", zh: "{0}/{1}" },
  "endings.summary": { ko: "달성한 엔딩", en: "Endings reached", ja: "到達したエンディング", zh: "已达成结局" },
  "endings.seen": { ko: "달성", en: "Reached", ja: "到達", zh: "已达成" },
  "endings.unseen": { ko: "미달성", en: "Not yet", ja: "未到達", zh: "未达成" },
  "endings.hidden": { ko: "???", en: "???", ja: "???", zh: "???" },
  "endings.common": { ko: "공통", en: "Shared", ja: "共通", zh: "通用" },
  "endings.tier.happy": { ko: "해피", en: "Happy", ja: "ハッピー", zh: "幸福" },
  "endings.tier.normal": { ko: "평범", en: "Normal", ja: "ノーマル", zh: "普通" },
  "endings.tier.solo": { ko: "혼자", en: "Solo", ja: "ひとり", zh: "独行" },
  "endings.tier.other": { ko: "그 밖", en: "Other", ja: "その他", zh: "其他" },
  "endings.checklist": { ko: "{0} 체크리스트", en: "{0} checklist", ja: "{0} チェックリスト", zh: "{0} 清单" },
  "endings.hint": { ko: "● 달성 ○ 미달성 — 한 번 본 엔딩은 이 기기에 남습니다. 엔딩 회상은 갤러리에서 볼 수 있습니다.", en: "● reached ○ not yet — endings you have seen are kept on this device. Replay them from the gallery.", ja: "● 到達 ○ 未到達 — 見たエンディングはこの端末に残ります。回想はギャラリーで。", zh: "● 已达成 ○ 未达成 — 看过的结局保存在本设备，可在画廊重读。" },
  "endings.empty": { ko: "이 게임에는 아직 엔딩이 없습니다.", en: "This game has no endings yet.", ja: "このゲームにはまだエンディングがありません。", zh: "此游戏还没有结局。" },
  "endings.unknownPerson": { ko: "???", en: "???", ja: "???", zh: "???" },
  "menu.relationships": { ko: "호감도", en: "Affection", ja: "好感度", zh: "好感度" },
  "menu.quests": { ko: "일정", en: "Schedule", ja: "予定", zh: "日程" },
  "menu.items": { ko: "소지품", en: "Items", ja: "持ち物", zh: "物品" },
  "menu.save": { ko: "저장", en: "Save", ja: "セーブ", zh: "存档" },
  "menu.load": { ko: "불러오기", en: "Load", ja: "ロード", zh: "读取" },
  "menu.options": { ko: "설정", en: "Settings", ja: "設定", zh: "设置" },
  "menu.toTitle": { ko: "타이틀로", en: "Title", ja: "タイトルへ", zh: "返回标题" },
  "save.title": { ko: "저장", en: "Save", ja: "セーブ", zh: "存档" },
  "load.title": { ko: "로드", en: "Load", ja: "ロード", zh: "读取" },
  "save.slot": { ko: "{0}번 저장", en: "Slot {0}", ja: "セーブ {0}", zh: "存档 {0}" },
  "save.empty": { ko: "비어 있음", en: "Empty", ja: "空き", zh: "空" },
  "save.corrupt": { ko: "손상됨", en: "Corrupted", ja: "破損", zh: "已损坏" },
  "save.saved": { ko: "저장됨", en: "Saved", ja: "保存済み", zh: "已保存" },
  "save.autosave": { ko: "자동 저장", en: "Autosave", ja: "オートセーブ", zh: "自动存档" },
  "save.blocked": { ko: "이어서 할 수 없음", en: "Can't continue", ja: "続けられない", zh: "无法继续" },
  "save.trigger.transfer": { ko: "맵 이동", en: "Map move", ja: "マップ移動", zh: "地图移动" },
  "save.trigger.battleVictory": { ko: "전투 승리", en: "Battle won", ja: "戦闘勝利", zh: "战斗胜利" },
  "save.overwrite": { ko: "덮어쓰기 확인", en: "Confirm overwrite", ja: "上書き確認", zh: "确认覆盖" },
  "save.hintDisabled": { ko: "지금은 저장할 수 없습니다.", en: "You can't save right now.", ja: "今は保存できません。", zh: "现在无法存档。" },
  "save.hintConfirm": { ko: "이미 저장된 칸입니다. 같은 슬롯을 다시 선택하면 덮어씁니다.", en: "This slot already has a save. Select it again to overwrite.", ja: "すでに保存されています。もう一度選ぶと上書きします。", zh: "此栏已有存档。再次选择将覆盖。" },
  "save.hintPick": { ko: "저장할 슬롯을 선택하세요.", en: "Choose a slot to save to.", ja: "保存するスロットを選んでください。", zh: "请选择存档栏。" },
  "load.hint": { ko: "불러올 저장 칸을 선택하세요.", en: "Choose a save to load.", ja: "読み込むセーブを選んでください。", zh: "请选择要读取的存档。" },
  "endings.undefined": { ko: "없음", en: "none", ja: "なし", zh: "无" },
  // 엔딩 화면(playSceneOverlays.showEndingScreen) — 배지·마지막 장·안내. 엔딩 presentation 의 badge·finalTitle·kicker 가 있으면 그 글이 이긴다.
  "ending.badge.character": { ko: "캐릭터 엔딩", en: "CHARACTER ENDING", ja: "キャラクターエンディング", zh: "角色结局" },
  "ending.badge.bad": { ko: "배드 엔딩", en: "BAD ENDING", ja: "バッドエンディング", zh: "坏结局" },
  "ending.badge.normal": { ko: "노멀 엔딩", en: "NORMAL ENDING", ja: "ノーマルエンディング", zh: "普通结局" },
  "ending.badge.happy": { ko: "해피 엔딩", en: "HAPPY ENDING", ja: "ハッピーエンディング", zh: "幸福结局" },
  "ending.badge.plain": { ko: "엔딩", en: "ENDING", ja: "エンディング", zh: "结局" },
  "ending.badge.continued": { ko: "다음 이야기에 계속", en: "TO BE CONTINUED", ja: "次回へつづく", zh: "未完待续" },
  "ending.actEnd": { ko: "제{0}막 끝", en: "END OF ACT {0}", ja: "第{0}幕 完", zh: "第{0}幕 终" },
  "ending.chapterEnd": { ko: "제{0}장 끝", en: "END OF CHAPTER {0}", ja: "第{0}章 完", zh: "第{0}章 终" },
  "ending.theEnd": { ko: "끝", en: "THE END", ja: "完", zh: "终" },
  "ending.heading": { ko: "엔딩", en: "The End", ja: "エンディング", zh: "结局" },
  "ending.kicker.dark": { ko: "이야기의 끝", en: "The end of the story", ja: "物語の終わり", zh: "故事的终点" },
  "ending.kicker.couple": { ko: "두 사람의 이야기", en: "Their story", ja: "ふたりの物語", zh: "两个人的故事" },
  "ending.kicker.journey": { ko: "우리의 여정", en: "Our journey", ja: "わたしたちの旅", zh: "我们的旅程" },
  "ending.kicker.solo": { ko: "{0}의 이야기", en: "{0}'s story", ja: "{0}の物語", zh: "{0}的故事" },
  "ending.hallOfFame": { ko: "전당 등록!", en: "Hall of Fame!", ja: "殿堂入り!", zh: "荣登殿堂!" },
  "ending.continue": { ko: "Z / Enter 계속", en: "Z / Enter  Continue", ja: "Z / Enter 次へ", zh: "Z / Enter 继续" },
  "ending.creditsSkip": { ko: "Z / Enter 빠르게 · 한 번 더 넘기기   ·   Esc 건너뛰기   ·   끝나면 타이틀로", en: "Z / Enter  Fast, again to skip   ·   Esc  Skip   ·   Title afterwards", ja: "Z / Enter 早送り・もう一度でとばす   ·   Esc とばす   ·   終わるとタイトルへ", zh: "Z / Enter 快进·再按跳过   ·   Esc 跳过   ·   结束后回到标题" },
  "ending.creditsRead": { ko: "PgUp/PgDn 읽기   ·   Z / Enter 마침", en: "PgUp/PgDn  Read   ·   Z / Enter  Finish", ja: "PgUp/PgDn 読む   ·   Z / Enter 終わる", zh: "PgUp/PgDn 阅读   ·   Z / Enter 结束" },
  "ending.returnTitle": { ko: "타이틀로 돌아가기", en: "Return to title", ja: "タイトルへ戻る", zh: "返回标题" },
  "ending.nextAct": { ko: "다음 막으로", en: "On to the next act", ja: "次の幕へ", zh: "进入下一幕" },
};

export function vnUiText(language: { readonly language: DialogueUiLanguage } | undefined, key: VnUiKey, ...args: readonly (string | number)[]): string {
  const template = VN_UI_STRINGS[key][dialogueUiLocale(language?.language)];
  return template.replace(/\{(\d+)\}/g, (_match, index: string) => String(args[Number(index)] ?? ""));
}

/** 갤러리 이름. 저작자가 정한 이름이 있으면 그대로, 없으면(기본 「갤러리」) 저작 언어로 번역한다. */
export function vnGalleryLabel(project: Parameters<typeof galleryMenuLabel>[0] & Parameters<typeof vnExtrasLanguage>[0]): string {
  const label = galleryMenuLabel(project);
  return label === DEFAULT_GALLERY_LABEL ? vnUiText(vnExtrasLanguage(project), "gallery.label") : label;
}
