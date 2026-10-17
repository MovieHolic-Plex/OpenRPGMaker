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
  | "gallery.lockedHint"
  | "gallery.empty"
  | "gallery.hint"
  | "gallery.ending"
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
  | "save.sceneLabel";

type Row = Readonly<Record<SupportedLocale, string>>;

export const VN_UI_STRINGS: Readonly<Record<VnUiKey, Row>> = {
  "menu.endings": { ko: "엔딩", en: "Endings", ja: "エンディング", zh: "结局" },
  "gallery.label": { ko: "갤러리", en: "Gallery", ja: "ギャラリー", zh: "画廊" },
  "gallery.item": { ko: "그림 {0}", en: "Picture {0}", ja: "絵 {0}", zh: "画面 {0}" },
  "gallery.progress": { ko: "{0}/{1}장", en: "{0}/{1}", ja: "{0}/{1}枚", zh: "{0}/{1}张" },
  "gallery.locked": { ko: "잠김", en: "Locked", ja: "未開放", zh: "未解锁" },
  "gallery.lockedName": { ko: "???", en: "???", ja: "???", zh: "???" },
  "gallery.lockedHint": { ko: "아직 열리지 않은 그림입니다. 이야기를 진행하면 열립니다.", en: "Not unlocked yet. Keep playing to open it.", ja: "まだ開放されていません。物語を進めると開きます。", zh: "尚未解锁，继续游戏即可打开。" },
  "gallery.empty": { ko: "아직 열린 그림이 없습니다.", en: "Nothing unlocked yet.", ja: "まだ開放された絵がありません。", zh: "还没有解锁的画面。" },
  "gallery.hint": { ko: "결정 키로 화면 가득 봅니다. 엔딩 회상은 결정 키로 글을 다시 읽습니다.", en: "Confirm to view full screen. Confirm an ending to read it again.", ja: "決定キーで全画面表示。エンディングは決定キーで文章を読み返せます。", zh: "按确认键全屏查看；选择结局可重读文字。" },
  "gallery.ending": { ko: "엔딩", en: "Ending", ja: "エンディング", zh: "结局" },
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
  "endings.undefined": { ko: "없음", en: "none", ja: "なし", zh: "无" },
  "save.sceneLabel": { ko: "마지막 장면", en: "Last scene", ja: "直前の場面", zh: "最近场景" },
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
