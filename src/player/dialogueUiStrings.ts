// player/dialogueUiStrings.ts
// 대사창 읽기 보조(백로그·오토·스킵·숨기기)의 시스템 글자 — 네 언어 표(2026-10-17). 대사창 단추 줄은 없다(단축키만).
// 게임 본문은 번역하지 않는다. 이 표는 단추·패널·알림 같은 「시스템 글자」만 다룬다. 어느 언어로 보일지는
// 저작자가 정한다(meta.oprnDialogueSystem.language: ko|en|ja|zh, auto 는 기기 언어). 기본 ko 라 옛 화면은 그대로다.
// 새 글자를 더할 땐 네 언어를 모두 채운다 — test/dialogueSystem.test.ts 가 빈 칸과 자리표시자 불일치를 막는다.
import { detectLocale, type SupportedLocale } from "@/i18n/locale";
import type { AuthoredDialogueSystem, DialogueUiLanguage } from "@/project/dialogueSystem";

export type DialogueUiKey =
  | "backlog.title" | "backlog.hint" | "backlog.empty" | "backlog.choice" | "backlog.cancel" | "backlog.count" | "backlog.close"
  | "menu.backlog" | "menu.backlogOpen" | "menu.backlogHint" | "menu.backlogDisabled"
  | "option.autoSpeed" | "option.autoSpeedHint" | "option.skipScope" | "option.skipScopeHint" | "option.windowOpacity" | "option.windowOpacityHint"
  | "value.slow" | "value.normal" | "value.fast" | "value.scopeRead" | "value.scopeAll" | "value.on" | "value.off"
  | "option.title" | "option.footer" | "option.saved" | "option.savedSession" | "option.bgm" | "option.se" | "option.voice" | "option.down" | "option.up" | "option.volumeHint"
  | "option.textSpeed" | "option.textSpeedHint" | "option.menuMotion" | "option.menuMotionHint"
  | "option.alwaysRun" | "option.alwaysRunHint" | "option.tapToMove" | "option.tapToMoveHint" | "option.stick" | "option.stickHint" | "option.haptics" | "option.hapticsHint"
  | "value.stickAuto" | "value.stickFixed" | "value.stickFloating"
  | "controls.compact" | "controls.function" | "controls.grid" | "controls.list";

type Row = Readonly<Record<SupportedLocale, string>>;

export const DIALOGUE_UI_STRINGS: Readonly<Record<DialogueUiKey, Row>> = {
  "option.alwaysRun": { ko: "항상 달리기", en: "Always run", ja: "常時ダッシュ", zh: "始终奔跑" },
  "option.alwaysRunHint": { ko: "켜면 늘 달립니다. 달리기 키(Shift)나 터치 달리기 단추는 이 값을 뒤집습니다.", en: "Run by default. The run key (Shift) and the touch Run button flip it.", ja: "常に走ります。ダッシュキー(Shift)やタッチのダッシュボタンで切り替えます。", zh: "默认奔跑。奔跑键(Shift)或触屏奔跑按钮可切换。" },
  "option.tapToMove": { ko: "탭해서 걷기", en: "Tap to move", ja: "タップで移動", zh: "点击移动" },
  "option.tapToMoveHint": { ko: "맵을 탭하면 그곳까지 걷고, 사람·물건을 탭하면 곁으로 가서 말을 겁니다. 패드를 만지면 멈춥니다.", en: "Tap the map to walk there; tap a person or object to walk up and talk. Touching the pad stops it.", ja: "マップをタップするとそこへ歩き、人や物をタップすると近づいて話しかけます。パッドに触れると止まります。", zh: "点击地图走到该处，点击人物或物件会走过去交谈。触碰摇杆即停止。" },
  "option.stick": { ko: "조이스틱", en: "Joystick", ja: "スティック", zh: "摇杆" },
  "option.stickHint": { ko: "자동: 판 곁을 누르면 바로 그 방향, 먼 곳은 엄지 밑으로. 고정: 판이 움직이지 않음. 떠다님: 누른 자리가 중심.", en: "Auto: press near the pad for that direction, elsewhere the pad comes to your thumb. Fixed: pad stays put. Floating: wherever you press is the center.", ja: "自動: パッド付近を押すとその方向、離れた所では親指の下に移動。固定: 動かない。フローティング: 押した所が中心。", zh: "自动：按在摇杆附近即为该方向，远处则摇杆移到拇指下。固定：不移动。浮动：按下处为中心。" },
  "option.haptics": { ko: "진동", en: "Vibration", ja: "振動", zh: "振动" },
  "option.hapticsHint": { ko: "단추를 누르거나 방향이 바뀔 때 짧게 떱니다(지원하는 기기만).", en: "Short buzz on button presses and direction changes (supported devices only).", ja: "ボタンや方向が変わる時に短く振動します（対応端末のみ）。", zh: "按键或方向变化时短暂振动（仅支持的设备）。" },
  "value.stickAuto": { ko: "자동", en: "Auto", ja: "自動", zh: "自动" },
  "value.stickFixed": { ko: "고정", en: "Fixed", ja: "固定", zh: "固定" },
  "value.stickFloating": { ko: "떠다님", en: "Floating", ja: "フローティング", zh: "浮动" },
  "backlog.title": { ko: "백로그", en: "Backlog", ja: "バックログ", zh: "对话回顾" },
  "backlog.hint": { ko: "휠·↑↓ 넘겨 보기 · Esc 닫기", en: "Wheel / Up Down to scroll · Esc to close", ja: "ホイール・↑↓ でスクロール · Esc で閉じる", zh: "滚轮 / ↑↓ 滚动 · Esc 关闭" },
  "backlog.empty": { ko: "아직 나눈 대화가 없습니다.", en: "No conversation yet.", ja: "まだ会話がありません。", zh: "还没有对话记录。" },
  "backlog.choice": { ko: "선택", en: "Choice", ja: "選択", zh: "选择" },
  "backlog.cancel": { ko: "(취소)", en: "(Cancelled)", ja: "(キャンセル)", zh: "(取消)" },
  "backlog.count": { ko: "{0}줄", en: "{0} lines", ja: "{0}行", zh: "{0}条" },
  "backlog.close": { ko: "닫기", en: "Close", ja: "閉じる", zh: "关闭" },
  "menu.backlog": { ko: "백로그", en: "Backlog", ja: "バックログ", zh: "对话回顾" },
  "menu.backlogOpen": { ko: "지난 대사 읽기", en: "Read past dialogue", ja: "過去の会話を読む", zh: "查看过往对话" },
  "menu.backlogHint": { ko: "결정 키로 전체 화면을 엽니다. 최근 대사가 아래에 있습니다.", en: "Confirm to open the full screen. Latest lines are at the bottom.", ja: "決定キーで全画面を開きます。最新の会話は下にあります。", zh: "按确认键打开全屏，最新对话在最下方。" },
  "menu.backlogDisabled": { ko: "이 게임은 대사 기록을 쓰지 않습니다.", en: "This game does not keep a dialogue log.", ja: "このゲームは会話ログを使いません。", zh: "此游戏不记录对话。" },
  "option.autoSpeed": { ko: "오토 속도", en: "Auto speed", ja: "オート速度", zh: "自动速度" },
  "option.autoSpeedHint": { ko: "선택하면 보통 → 빠르게 → 느리게 순서로 바뀝니다. 글이 길수록 더 오래 기다립니다.", en: "Cycles Normal, Fast, Slow. Longer text waits longer.", ja: "選ぶと 普通→速い→遅い の順で切り替わります。長い文ほど長く待ちます。", zh: "依次切换 普通→快→慢。文字越长等待越久。" },
  "option.skipScope": { ko: "스킵 범위", en: "Skip range", ja: "スキップ範囲", zh: "跳过范围" },
  "option.skipScopeHint": { ko: "읽은 글만 넘길지, 전부 넘길지 정합니다. 선택지와 엔딩 앞에서는 항상 멈춥니다.", en: "Skip only text you have read, or everything. Always stops at choices and endings.", ja: "既読のみ飛ばすか、すべて飛ばすかを決めます。選択肢とエンディングの前では必ず止まります。", zh: "选择只跳过已读文本还是全部。遇到选项和结局时总会停止。" },
  "option.windowOpacity": { ko: "대사창 투명도", en: "Window opacity", ja: "ウィンドウ透明度", zh: "对话框透明度" },
  "option.windowOpacityHint": { ko: "선택할 때마다 10%씩 낮아지고 40% 다음에는 100%로 돌아갑니다. 낮을수록 뒤 화면이 비칩니다.", en: "Lowers by 10% each time and wraps from 40% to 100%. Lower shows more of the scene behind.", ja: "選ぶたびに10%ずつ下がり、40%の次は100%に戻ります。低いほど後ろの画面が見えます。", zh: "每次选择降低10%，40%之后回到100%。越低越能看到后面的画面。" },
  "value.on": { ko: "켜짐", en: "On", ja: "オン", zh: "开" },
  "value.off": { ko: "꺼짐", en: "Off", ja: "オフ", zh: "关" },
  "option.title": { ko: "설정", en: "Settings", ja: "設定", zh: "设置" },
  "option.footer": { ko: "이 기기에 저장 · 게임 저장 파일과 별개 · Enter 변경 · Esc 돌아가기", en: "Saved on this device · separate from game saves · Enter to change · Esc to go back", ja: "この端末に保存 · セーブデータとは別 · Enter で変更 · Esc で戻る", zh: "保存在本设备 · 与游戏存档无关 · Enter 更改 · Esc 返回" },
  "option.saved": { ko: "이 기기에 설정을 저장했습니다.", en: "Saved settings on this device.", ja: "この端末に設定を保存しました。", zh: "已将设置保存到本设备。" },
  "option.savedSession": { ko: "현재 실행에 적용했습니다. 기기 저장소에 저장하지 못했습니다.", en: "Applied for this session. Could not save to device storage.", ja: "今回の実行に反映しました。端末に保存できませんでした。", zh: "已应用于本次运行，未能保存到设备存储。" },
  "option.bgm": { ko: "배경 음악", en: "Music", ja: "BGM", zh: "背景音乐" },
  "option.se": { ko: "효과음", en: "Sound effects", ja: "効果音", zh: "音效" },
  "option.voice": { ko: "대사 목소리", en: "Dialogue voice", ja: "会話ボイス", zh: "对话语音" },
  "option.down": { ko: "줄이기", en: "Lower", ja: "下げる", zh: "调低" },
  "option.up": { ko: "늘리기", en: "Raise", ja: "上げる", zh: "调高" },
  "option.volumeHint": { ko: "10%씩 조절합니다. 0%는 음소거입니다.", en: "Adjusts in 10% steps. 0% is mute.", ja: "10%ずつ調整します。0%はミュートです。", zh: "每次调整10%，0%为静音。" },
  "option.textSpeed": { ko: "대사 속도", en: "Text speed", ja: "文字速度", zh: "文字速度" },
  "option.textSpeedHint": { ko: "선택하면 보통 → 빠르게 → 느리게 순서로 바뀝니다.", en: "Cycles Normal, Fast, Slow.", ja: "選ぶと 普通→速い→遅い の順で切り替わります。", zh: "依次切换 普通→快→慢。" },
  "option.menuMotion": { ko: "메뉴 움직임 줄이기", en: "Reduce menu motion", ja: "メニューの動きを減らす", zh: "减少菜单动效" },
  "option.menuMotionHint": { ko: "ESC 메뉴 전환의 이동 효과를 줄입니다. 운영체제의 감소 설정도 존중합니다.", en: "Reduces movement in ESC menu transitions. The system reduce-motion setting is also respected.", ja: "ESCメニュー切り替えの動きを減らします。OSの動き軽減設定にも従います。", zh: "减少ESC菜单切换的动效，同时遵循系统的减少动态设置。" },
  "controls.compact": { ko: "↑↓ 이동 · Enter 선택\nEsc 닫기", en: "Up/Down move · Enter select\nEsc close", ja: "↑↓ 移動 · Enter 選択\nEsc 閉じる", zh: "↑↓ 移动 · Enter 选择\nEsc 关闭" },
  "controls.function": { ko: "↑↓ 항목 이동   Enter 결정   ← 메뉴   Esc 뒤로", en: "Up/Down move   Enter confirm   Left menu   Esc back", ja: "↑↓ 項目移動   Enter 決定   ← メニュー   Esc 戻る", zh: "↑↓ 移动项目   Enter 确定   ← 菜单   Esc 返回" },
  "controls.grid": { ko: "↑↓←→ 이동   Enter 선택   Esc 게임으로", en: "Arrows move   Enter select   Esc to game", ja: "↑↓←→ 移動   Enter 選択   Esc ゲームへ", zh: "↑↓←→ 移动   Enter 选择   Esc 回到游戏" },
  "controls.list": { ko: "↑↓ 메뉴 이동   → / Enter 선택   Esc 게임으로", en: "Up/Down menu   Right / Enter select   Esc to game", ja: "↑↓ メニュー移動   → / Enter 選択   Esc ゲームへ", zh: "↑↓ 菜单移动   → / Enter 选择   Esc 回到游戏" },
  "value.slow": { ko: "느리게", en: "Slow", ja: "遅い", zh: "慢" },
  "value.normal": { ko: "보통", en: "Normal", ja: "普通", zh: "普通" },
  "value.fast": { ko: "빠르게", en: "Fast", ja: "速い", zh: "快" },
  "value.scopeRead": { ko: "읽은 글만", en: "Read only", ja: "既読のみ", zh: "仅已读" },
  "value.scopeAll": { ko: "전부", en: "All", ja: "すべて", zh: "全部" },
};

/** 저작된 언어 → 실제 로캘. auto 는 기기 언어. */
export function dialogueUiLocale(language: DialogueUiLanguage | undefined): SupportedLocale {
  if (language === "ko" || language === "en" || language === "ja" || language === "zh") return language;
  if (language === "auto") return detectLocale();
  return "ko";
}

export function dialogueUiText(system: Pick<AuthoredDialogueSystem, "language"> | undefined, key: DialogueUiKey, ...args: readonly (string | number)[]): string {
  const template = DIALOGUE_UI_STRINGS[key][dialogueUiLocale(system?.language)];
  return template.replace(/\{(\d+)\}/g, (_match, index: string) => String(args[Number(index)] ?? ""));
}
