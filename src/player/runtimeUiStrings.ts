// player/runtimeUiStrings.ts
// 런타임 전역 시스템 UI 문자열 4개국어(ko/en/ja/zh) 통합 카탈로그.
// 에디터·AI·하네스 모듈을 import 하지 않으므로 출하 플레이어 번들(playerBundleGuard)에 안전하게 실린다.
// 언어 결정 우선순위:
//   1. 인게임 유저 오버라이드 (setRuntimeUiLocaleOverride)
//   2. project.meta.language ("ko"|"en"|"ja"|"zh"|"auto")
//   3. project.meta.oprnDialogueSystem.language ("ko"|"en"|"ja"|"zh"|"auto")
//   4. 기본값 "ko" (구 프로젝트 100% 하위 호환)
import { detectLocale, matchSupportedLocale, type SupportedLocale } from "@/i18n/locale";
import type { Project } from "@/project/types";

export type RuntimeUiKey =
  // Title screen
  | "title.newGame"
  | "title.resume"
  | "title.resumeRecent"
  | "title.continueGame"
  | "title.credits"
  | "title.quit"
  | "title.menuAriaLabel"
  | "title.editorialKicker"
  | "title.editorialSubtitle"
  | "title.pressStart"
  // Credits / license dialog
  | "credits.title"
  | "credits.ariaLabel"
  | "credits.bodyAriaLabel"
  | "credits.hint"
  | "credits.close"
  | "credits.fullDoc"
  | "credits.fallbackNotice"
  | "credits.section.game"
  | "credits.section.engine"
  | "credits.section.audio"
  | "credits.section.graphics"
  | "credits.section.fonts"
  | "credits.section.store"
  | "credits.section.license"
  // Status menu groups & collapsed entries
  | "menu.group.action"
  | "menu.group.party"
  | "menu.group.record"
  | "menu.group.system"
  | "menu.collapsed.party"
  | "menu.collapsed.record"
  | "menu.collapsed.system"
  // Status menu commands
  | "menu.cmd.trainerCard"
  | "menu.cmd.items"
  | "menu.cmd.skills"
  | "menu.cmd.equipment"
  | "menu.cmd.monsters"
  | "menu.cmd.monsterDex"
  | "menu.cmd.regionMap"
  | "menu.cmd.campaignProgress"
  | "menu.cmd.save"
  | "menu.cmd.load"
  | "menu.cmd.status"
  | "menu.cmd.row"
  | "menu.cmd.formation"
  | "menu.cmd.battleReports"
  | "menu.cmd.bestiary"
  | "menu.cmd.quests"
  | "menu.cmd.journal"
  | "menu.cmd.relationships"
  | "menu.cmd.gallery"
  | "menu.cmd.endings"
  | "menu.cmd.lifeLedger"
  | "menu.cmd.backlog"
  | "menu.cmd.options"
  | "menu.cmd.rest"
  | "menu.cmd.waitOn"
  | "menu.cmd.waitOff"
  | "menu.cmd.toTitle"
  // Status menu labels & summaries
  | "menu.condition.normal"
  | "menu.class.none"
  | "menu.emptyParty"
  | "menu.emptyMonsterParty"
  | "menu.summary.trainerRecord"
  | "menu.summary.members"
  | "menu.summary.monsters"
  | "menu.summary.itemKinds"
  | "menu.summary.dexProgress"
  | "menu.summary.badges"
  | "menu.summary.battles"
  | "menu.summary.quests"
  | "menu.summary.journalLines"
  | "menu.summary.slots"
  | "menu.summary.galleryCount"
  | "menu.summary.partyDanger"
  | "menu.summary.partyGood"
  // Save / Load panel (shared keys for Track 2 playerLoadPanel & status menu details)
  | "load.title"
  | "load.hint"
  | "load.empty"
  | "load.emptyDesc"
  | "load.corrupt"
  | "load.slotLabel"
  | "load.autosave"
  | "load.playTime"
  | "load.confirm"
  | "load.cancel"
  | "load.delete"
  | "load.deleteConfirm"
  | "load.noSaves"
  | "save.title"
  | "save.hint"
  | "save.saved"
  | "save.overwriteConfirm"
  | "save.disabled"
  // Status menu details (shared keys for Track 2 playerStatusMenuDetails)
  | "statusDetail.stats"
  | "statusDetail.equipment"
  | "statusDetail.skills"
  | "statusDetail.items"
  | "statusDetail.use"
  | "statusDetail.equip"
  | "statusDetail.unequip"
  | "statusDetail.none"
  | "statusDetail.nextLevel"
  | "statusDetail.maxLevel"
  | "statusDetail.toTitlePrompt"
  | "statusDetail.toTitleConfirm"
  | "statusDetail.toTitleCancel"
  | "statusDetail.waitModeTitle"
  | "statusDetail.waitModeDesc"
  | "statusDetail.back"
  | "statusDetail.close"
  // Shop UI
  | "shop.ariaLabel"
  | "shop.title.default"
  | "shop.title.repair"
  | "shop.title.appraisal"
  | "shop.title.pawn"
  | "shop.tagline.repair"
  | "shop.tagline.appraisal"
  | "shop.tagline.pawn"
  | "shop.tagline.buyOnly"
  | "shop.tagline.sellOnly"
  | "shop.tagline.normal"
  | "shop.modeSub.buy"
  | "shop.modeSub.sell"
  | "shop.categoryAria"
  | "shop.category.all"
  | "shop.category.equipment"
  | "shop.category.material"
  | "shop.category.consumable"
  | "shop.story.merchant"
  | "shop.story.recommend"
  | "shop.story.actionsAria"
  | "shop.story.buy"
  | "shop.story.sell"
  | "shop.story.talk"
  | "shop.story.talkLine"
  | "shop.story.leave"
  | "shop.grid.heading"
  | "shop.grid.count"
  | "shop.compare.heading"
  | "shop.compare.sub"
  | "shop.purseLabel"
  | "shop.listAria"
  | "shop.empty.buy"
  | "shop.empty.sell"
  | "shop.close"
  | "shop.full"
  | "shop.stat.attack"
  | "shop.stat.defense"
  | "shop.stat.mind"
  | "shop.stat.agility"
  | "shop.owned"
  | "shop.ownedEquipped"
  | "shop.detailCompare"
  | "shop.serviceUnavailable"
  | "shop.menuHint.buy"
  | "shop.menuHint.sell"
  | "shop.menuHint.cancel"
  | "shop.key.select"
  | "shop.key.confirm"
  | "shop.key.leave"
  | "shop.key.section"
  | "shop.key.qty"
  | "shop.key.back"
  | "shop.key.close"
  | "shop.haggle.verbBuy"
  | "shop.haggle.verbSell"
  | "shop.haggle.itemLine"
  | "shop.haggle.myOffer"
  | "shop.haggle.myAsk"
  | "shop.haggle.total"
  | "shop.haggle.patience"
  | "shop.haggle.stepAria"
  | "shop.haggle.cancel"
  | "shop.haggle.keyAdjust"
  | "shop.haggle.keyMove"
  | "shop.haggle.keyBack"
  // Battle UI
  | "battle.autoOn"
  | "battle.autoOff"
  | "battle.skipping"
  | "battle.defeatBanner"
  | "battle.inputPrompt"
  | "battle.charging";

type Row = Readonly<Record<SupportedLocale, string>>;

export const RUNTIME_UI_STRINGS: Readonly<Record<RuntimeUiKey, Row>> = {
  // Title screen
  "title.newGame": { ko: "새 게임", en: "New Game", ja: "ニューゲーム", zh: "新游戏" },
  "title.resume": { ko: "이어하기", en: "Resume", ja: "つづきから", zh: "继续游玩" },
  "title.resumeRecent": { ko: "방금 하던 곳부터", en: "Continue Recent", ja: "直前から再開", zh: "从上次继续" },
  "title.continueGame": { ko: "불러오기", en: "Load Game", ja: "ロード", zh: "读取存档" },
  "title.credits": { ko: "크레딧", en: "Credits", ja: "クレジット", zh: "制作人员" },
  "title.quit": { ko: "종료", en: "Quit", ja: "おわる", zh: "退出游戏" },
  "title.menuAriaLabel": { ko: "게임 시작 메뉴", en: "Title menu", ja: "タイトルメニュー", zh: "标题菜单" },
  "title.editorialKicker": { ko: "A NEW ADVENTURE", en: "A NEW ADVENTURE", ja: "A NEW ADVENTURE", zh: "A NEW ADVENTURE" },
  "title.editorialSubtitle": { ko: "이야기가 시작되는 곳", en: "Where the story begins", ja: "物語が始まる場所", zh: "故事开始的地方" },
  "title.pressStart": { ko: "PRESS START", en: "PRESS START", ja: "PRESS START", zh: "PRESS START" },

  // Credits / license dialog
  "credits.title": { ko: "크레딧", en: "Credits", ja: "クレジット", zh: "制作人员" },
  "credits.ariaLabel": {
    ko: "크레딧 — 게임 에셋 저작자 표기",
    en: "Credits — Game Asset Attributions",
    ja: "クレジット — アセット権利表記",
    zh: "制作人员 — 游戏素材署名",
  },
  "credits.bodyAriaLabel": { ko: "저작자 표기", en: "Attribution notices", ja: "権利表記", zh: "署名信息" },
  "credits.hint": {
    ko: "↑↓ 로 읽고, Esc 로 닫습니다",
    en: "↑↓ to scroll, Esc to close",
    ja: "↑↓ でスクロール、Esc で閉じます",
    zh: "↑↓ 滚动阅读，Esc 关闭",
  },
  "credits.close": { ko: "닫기", en: "Close", ja: "閉じる", zh: "关闭" },
  "credits.fullDoc": {
    ko: "전체 출처 문서 (영문)",
    en: "Full Attribution Document",
    ja: "詳細クレジット文書（英語）",
    zh: "完整署名文档（英文）",
  },
  "credits.fallbackNotice": {
    ko: "이 게임에는 CC BY 라이선스의 에셋이 포함되어 있습니다.",
    en: "This game includes third-party assets requiring attribution.",
    ja: "このゲームには権利表記が必要なアセットが含まれています。",
    zh: "本游戏包含需要署名的第三方素材。",
  },
  "credits.section.game": { ko: "게임 크레딧", en: "Game Credits", ja: "ゲームクレジット", zh: "游戏制作人员" },
  "credits.section.engine": { ko: "만든 도구", en: "Built With", ja: "制作ツール", zh: "制作工具" },
  "credits.section.audio": { ko: "음악과 효과음", en: "Music & Sound Effects", ja: "音楽と効果音", zh: "音乐与音效" },
  "credits.section.graphics": { ko: "그림", en: "Graphics & Artwork", ja: "グラフィック", zh: "美术素材" },
  "credits.section.fonts": { ko: "글꼴", en: "Fonts", ja: "フォント", zh: "字体" },
  "credits.section.store": { ko: "OPRN 에셋 스토어", en: "OPRN Asset Store", ja: "OPRN アセットストア", zh: "OPRN 素材商店" },
  "credits.section.license": { ko: "라이선스", en: "Licenses", ja: "ライセンス", zh: "许可证" },

  // Status menu groups & collapsed entries
  "menu.group.action": { ko: "행동", en: "Actions", ja: "行動", zh: "行动" },
  "menu.group.party": { ko: "파티", en: "Party", ja: "パーティ", zh: "队伍" },
  "menu.group.record": { ko: "기록", en: "Records", ja: "記録", zh: "记录" },
  "menu.group.system": { ko: "시스템", en: "System", ja: "システム", zh: "系统" },
  "menu.collapsed.party": { ko: "파티 ▸", en: "Party ▸", ja: "パーティ ▸", zh: "队伍 ▸" },
  "menu.collapsed.record": { ko: "기록 ▸", en: "Records ▸", ja: "記録 ▸", zh: "记录 ▸" },
  "menu.collapsed.system": { ko: "시스템 ▸", en: "System ▸", ja: "システム ▸", zh: "系统 ▸" },

  // Status menu commands
  "menu.cmd.trainerCard": { ko: "원정 수첩", en: "Trainer Card", ja: "冒険ノート", zh: "冒险手册" },
  "menu.cmd.items": { ko: "아이템", en: "Items", ja: "アイテム", zh: "物品" },
  "menu.cmd.skills": { ko: "스킬", en: "Skills", ja: "スキル", zh: "技能" },
  "menu.cmd.equipment": { ko: "장비", en: "Equip", ja: "装備", zh: "装备" },
  "menu.cmd.monsters": { ko: "몬스터", en: "Monsters", ja: "モンスター", zh: "怪物" },
  "menu.cmd.monsterDex": { ko: "몬스터 도감", en: "Monster Dex", ja: "モンスター図鑑", zh: "怪物图鉴" },
  "menu.cmd.regionMap": { ko: "지역 지도", en: "Region Map", ja: "地域マップ", zh: "区域地图" },
  "menu.cmd.campaignProgress": { ko: "배지·목표", en: "Badges & Goals", ja: "バッジ・目標", zh: "徽章与目标" },
  "menu.cmd.save": { ko: "저장", en: "Save", ja: "セーブ", zh: "存档" },
  "menu.cmd.load": { ko: "로드", en: "Load", ja: "ロード", zh: "读档" },
  "menu.cmd.status": { ko: "상태", en: "Status", ja: "ステータス", zh: "状态" },
  "menu.cmd.row": { ko: "열 바꾸기", en: "Row", ja: "隊列", zh: "换排" },
  "menu.cmd.formation": { ko: "진형", en: "Formation", ja: "編成", zh: "编队" },
  "menu.cmd.battleReports": { ko: "전투 기록", en: "Battle Log", ja: "戦闘記録", zh: "战斗记录" },
  "menu.cmd.bestiary": { ko: "괴물 도감", en: "Bestiary", ja: "魔物図鑑", zh: "怪物图鉴" },
  "menu.cmd.quests": { ko: "임무", en: "Quests", ja: "クエスト", zh: "任务" },
  "menu.cmd.journal": { ko: "이야기 일지", en: "Journal", ja: "日誌", zh: "日志" },
  "menu.cmd.relationships": { ko: "관계", en: "Bonds", ja: "交流", zh: "关系" },
  "menu.cmd.gallery": { ko: "갤러리", en: "Gallery", ja: "ギャラリー", zh: "画廊" },
  "menu.cmd.endings": { ko: "엔딩", en: "Endings", ja: "エンディング", zh: "结局" },
  "menu.cmd.lifeLedger": { ko: "생활 장부", en: "Life Ledger", ja: "生活記録", zh: "生活账本" },
  "menu.cmd.backlog": { ko: "백로그", en: "Backlog", ja: "バックログ", zh: "对话记录" },
  "menu.cmd.options": { ko: "설정", en: "Options", ja: "設定", zh: "设置" },
  "menu.cmd.rest": { ko: "쉬기", en: "Rest", ja: "休む", zh: "休息" },
  "menu.cmd.waitOn": { ko: "대기 ON", en: "Wait ON", ja: "ウェイト ON", zh: "等待 开" },
  "menu.cmd.waitOff": { ko: "대기 OFF", en: "Wait OFF", ja: "ウェイト OFF", zh: "等待 关" },
  "menu.cmd.toTitle": { ko: "타이틀", en: "Title", ja: "タイトル", zh: "返回标题" },

  // Status menu labels & summaries
  "menu.condition.normal": { ko: "정상", en: "Normal", ja: "正常", zh: "正常" },
  "menu.class.none": { ko: "직업 없음", en: "No Class", ja: "職業なし", zh: "无职业" },
  "menu.emptyParty": { ko: "파티원이 없습니다", en: "No party members", ja: "パーティメンバーがいません", zh: "没有队伍成员" },
  "menu.emptyMonsterParty": { ko: "아직 동료가 없습니다", en: "No companions yet", ja: "まだ仲間がいません", zh: "还没有伙伴" },
  "menu.summary.trainerRecord": { ko: "원정 기록", en: "Journey Log", ja: "冒険の記録", zh: "冒险记录" },
  "menu.summary.members": { ko: "{0}명", en: "{0}", ja: "{0}人", zh: "{0}人" },
  "menu.summary.monsters": { ko: "{0}마리", en: "{0}", ja: "{0}体", zh: "{0}只" },
  "menu.summary.itemKinds": { ko: "{0}종", en: "{0} types", ja: "{0}種", zh: "{0}种" },
  "menu.summary.dexProgress": { ko: "{0}/{1}종", en: "{0}/{1}", ja: "{0}/{1}種", zh: "{0}/{1}种" },
  "menu.summary.badges": { ko: "{0}/{1}배지", en: "{0}/{1} badges", ja: "{0}/{1}バッジ", zh: "{0}/{1}徽章" },
  "menu.summary.battles": { ko: "{0}전투", en: "{0} battles", ja: "{0}戦", zh: "{0}战" },
  "menu.summary.quests": { ko: "{0}건", en: "{0}", ja: "{0}件", zh: "{0}项" },
  "menu.summary.journalLines": { ko: "{0}줄", en: "{0} entries", ja: "{0}件", zh: "{0}条" },
  "menu.summary.slots": { ko: "{0}/{1}칸", en: "{0}/{1}", ja: "{0}/{1}枠", zh: "{0}/{1}栏" },
  "menu.summary.galleryCount": { ko: "{0}장", en: "{0}", ja: "{0}枚", zh: "{0}张" },
  "menu.summary.partyDanger": { ko: "위험 {0} · {1}", en: "Critical {0} · {1}", ja: "危険 {0} · {1}", zh: "危险 {0} · {1}" },
  "menu.summary.partyGood": { ko: "{0} 양호", en: "{0} OK", ja: "{0} 良好", zh: "{0} 良好" },

  // Save / Load panel (pre-built for Track 2)
  "load.title": { ko: "불러오기", en: "Load Game", ja: "ロード", zh: "读取存档" },
  "load.hint": { ko: "불러올 저장 칸을 선택하세요.", en: "Select a save slot to load.", ja: "読み込むセーブ枠を選んでください。", zh: "请选择要读取的存档栏。" },
  "load.empty": { ko: "비어 있음", en: "Empty", ja: "空き", zh: "空" },
  "load.emptyDesc": { ko: "저장된 데이터가 없습니다.", en: "No saved data.", ja: "セーブデータがありません。", zh: "暂无存档数据。" },
  "load.corrupt": { ko: "손상된 저장 데이터", en: "Corrupted save data", ja: "破損したセーブデータ", zh: "存档数据已损坏" },
  "load.slotLabel": { ko: "{0}번 슬롯", en: "Slot {0}", ja: "スロット {0}", zh: "存档栏 {0}" },
  "load.autosave": { ko: "자동 저장", en: "Autosave", ja: "オートセーブ", zh: "自动存档" },
  "load.playTime": { ko: "플레이 시간 {0}", en: "Play time {0}", ja: "プレイ時間 {0}", zh: "游玩时间 {0}" },
  "load.confirm": { ko: "불러오기", en: "Load", ja: "読み込む", zh: "读取" },
  "load.cancel": { ko: "돌아가기", en: "Back", ja: "戻る", zh: "返回" },
  "load.delete": { ko: "삭제", en: "Delete", ja: "削除", zh: "删除" },
  "load.deleteConfirm": { ko: "이 저장 데이터를 삭제할까요?", en: "Delete this save file?", ja: "このセーブデータを削除しますか？", zh: "要删除此存档吗？" },
  "load.noSaves": { ko: "저장된 파일이 없습니다.", en: "No save files found.", ja: "セーブデータがありません。", zh: "没有找到存档文件。" },
  "save.title": { ko: "저장", en: "Save Game", ja: "セーブ", zh: "保存游戏" },
  "save.hint": { ko: "저장할 슬롯을 선택하세요.", en: "Select a slot to save.", ja: "保存するスロットを選んでください。", zh: "请选择要保存的存档栏。" },
  "save.saved": { ko: "저장했습니다.", en: "Game saved.", ja: "セーブしました。", zh: "已保存。" },
  "save.overwriteConfirm": {
    ko: "이미 저장된 칸입니다. 덮어쓸까요?",
    en: "Overwrite existing save in this slot?",
    ja: "すでに保存されています。上書きしますか？",
    zh: "该存档栏已有数据，确定覆盖吗？",
  },
  "save.disabled": { ko: "지금은 저장할 수 없습니다.", en: "Cannot save right now.", ja: "今はセーブできません。", zh: "当前无法保存。" },

  // Status menu details (pre-built for Track 2)
  "statusDetail.stats": { ko: "능력치", en: "Stats", ja: "能力値", zh: "属性" },
  "statusDetail.equipment": { ko: "장비", en: "Equipment", ja: "装備", zh: "装备" },
  "statusDetail.skills": { ko: "스킬", en: "Skills", ja: "スキル", zh: "技能" },
  "statusDetail.items": { ko: "소지품", en: "Items", ja: "所持品", zh: "物品" },
  "statusDetail.use": { ko: "사용", en: "Use", ja: "使う", zh: "使用" },
  "statusDetail.equip": { ko: "장착", en: "Equip", ja: "装備する", zh: "装备" },
  "statusDetail.unequip": { ko: "해제", en: "Unequip", ja: "外す", zh: "卸下" },
  "statusDetail.none": { ko: "없음", en: "None", ja: "なし", zh: "无" },
  "statusDetail.nextLevel": { ko: "다음 레벨까지 {0}", en: "Next Lv: {0}", ja: "次のレベルまで {0}", zh: "距下一级 {0}" },
  "statusDetail.maxLevel": { ko: "최대 레벨", en: "MAX", ja: "最大レベル", zh: "满级" },
  "statusDetail.toTitlePrompt": {
    ko: "저장하지 않은 진행은 사라집니다. 타이틀로 돌아갈까요?",
    en: "Unsaved progress will be lost. Return to title?",
    ja: "セーブしていない進行は失われます。タイトルへ戻りますか？",
    zh: "未保存的进度将会丢失。要返回标题画面吗？",
  },
  "statusDetail.toTitleConfirm": { ko: "타이틀로", en: "Return to Title", ja: "タイトルへ戻る", zh: "返回标题" },
  "statusDetail.toTitleCancel": { ko: "취소", en: "Cancel", ja: "キャンセル", zh: "取消" },
  "statusDetail.waitModeTitle": { ko: "전투 대기", en: "Battle Wait", ja: "バトルウェイト", zh: "战斗等待" },
  "statusDetail.waitModeDesc": {
    ko: "켜면 명령을 고르는 동안 전투 게이지가 멈춥니다.",
    en: "Pauses battle gauges while choosing commands.",
    ja: "オンにするとコマンド選択中にゲージが止まります。",
    zh: "开启后，选择指令时战斗行动条会暂停。",
  },
  "statusDetail.back": { ko: "뒤로", en: "Back", ja: "戻る", zh: "返回" },
  "statusDetail.close": { ko: "닫기", en: "Close", ja: "閉じる", zh: "关闭" },

  // Shop UI
  "shop.ariaLabel": { ko: "상점", en: "Shop", ja: "ショップ", zh: "商店" },
  "shop.title.default": { ko: "상점", en: "Shop", ja: "ショップ", zh: "商店" },
  "shop.title.repair": { ko: "수리점", en: "Repair Shop", ja: "修理屋", zh: "修理店" },
  "shop.title.appraisal": { ko: "감정소", en: "Appraisal Shop", ja: "鑑定所", zh: "鉴定所" },
  "shop.title.pawn": { ko: "전당포", en: "Pawn Shop", ja: "質屋", zh: "当铺" },
  "shop.tagline.repair": { ko: "장비를 손봐 드립니다.", en: "Equipment repair service.", ja: "装備を修理します。", zh: "提供装备修理服务。" },
  "shop.tagline.appraisal": { ko: "물건의 값을 봐 드립니다.", en: "Item appraisal service.", ja: "品物を鑑定します。", zh: "提供物品鉴定服务。" },
  "shop.tagline.pawn": { ko: "물건을 맡기고 돈을 받습니다.", en: "Pawn items for gold.", ja: "品物を質入れできます。", zh: "典当物品换取金币。" },
  "shop.tagline.buyOnly": { ko: "물건을 팝니다.", en: "Goods for sale.", ja: "商品を販売しています。", zh: "出售商品。" },
  "shop.tagline.sellOnly": { ko: "물건을 사들입니다.", en: "Buying your items.", ja: "品物を買い取ります。", zh: "收购物品。" },
  "shop.tagline.normal": { ko: "물건을 사고팝니다.", en: "Buy and sell goods.", ja: "売買ができます。", zh: "买卖商品。" },
  "shop.modeSub.buy": { ko: "구매 · 상인의 진열 상품", en: "Buy · Merchant's wares", ja: "購入 · 店主の品揃え", zh: "购买 · 商人的商品" },
  "shop.modeSub.sell": { ko: "판매 · 내 소지품을 상인에게", en: "Sell · Trade your items", ja: "売却 · 所持品を売る", zh: "出售 · 卖给商人" },
  "shop.categoryAria": { ko: "상품 카테고리", en: "Item categories", ja: "商品カテゴリ", zh: "商品分类" },
  "shop.category.all": { ko: "전체", en: "All", ja: "すべて", zh: "全部" },
  "shop.category.equipment": { ko: "장비", en: "Equipment", ja: "装備", zh: "装备" },
  "shop.category.material": { ko: "재료", en: "Materials", ja: "素材", zh: "材料" },
  "shop.category.consumable": { ko: "소모품", en: "Consumables", ja: "消費品", zh: "消耗品" },
  "shop.story.merchant": { ko: "상인", en: "Merchant", ja: "店主", zh: "商人" },
  "shop.story.recommend": {
    ko: "오늘은 특별 추천 상품이 들어왔습니다.",
    en: "We have special recommendations today.",
    ja: "本日はおすすめ商品が入荷しています。",
    zh: "今天有特别推荐的商品到货了。",
  },
  "shop.story.actionsAria": { ko: "상인 행동", en: "Merchant actions", ja: "店主への行動", zh: "商人操作" },
  "shop.story.buy": { ko: "사기", en: "Buy", ja: "買う", zh: "买" },
  "shop.story.sell": { ko: "팔기", en: "Sell", ja: "売る", zh: "卖" },
  "shop.story.talk": { ko: "말 걸기", en: "Talk", ja: "話す", zh: "交谈" },
  "shop.story.talkLine": {
    ko: "상인: 다음 마을에 가기 전에 필요한 걸 챙겨요.",
    en: "Merchant: Stock up before heading to the next town.",
    ja: "店主：次の町へ行く前に必要なものを揃えておくといいよ。",
    zh: "商人：去下个城镇之前记得备好物资。",
  },
  "shop.story.leave": { ko: "나가기", en: "Leave", ja: "出る", zh: "离开" },
  "shop.grid.heading": { ko: "오늘의 진열", en: "Today's Stock", ja: "本日の品揃え", zh: "今日陈列" },
  "shop.grid.count": { ko: "{0}개 상품", en: "{0} items", ja: "{0}点", zh: "{0}件商品" },
  "shop.compare.heading": { ko: "장비 비교", en: "Equipment Comparison", ja: "装備比較", zh: "装备对比" },
  "shop.compare.sub": {
    ko: "현재 장비와 구매 후 변화",
    en: "Current gear vs. after purchase",
    ja: "現在の装備と購入後の変化",
    zh: "当前装备与购买后变化",
  },
  "shop.purseLabel": { ko: "소지금", en: "Gold", ja: "所持金", zh: "持有金币" },
  "shop.listAria": { ko: "상품 목록", en: "Item list", ja: "商品リスト", zh: "商品列表" },
  "shop.empty.buy": { ko: "파는 물건이 없습니다.", en: "Nothing for sale.", ja: "販売中の商品がありません。", zh: "没有可购买的商品。" },
  "shop.empty.sell": { ko: "팔 물건이 없습니다.", en: "Nothing to sell.", ja: "売却できる品物がありません。", zh: "没有可出售的物品。" },
  "shop.close": { ko: "닫기", en: "Close", ja: "閉じる", zh: "关闭" },
  "shop.full": { ko: "가득", en: "Full", ja: "満タン", zh: "已满" },
  "shop.stat.attack": { ko: "공격", en: "ATK", ja: "攻撃", zh: "攻击" },
  "shop.stat.defense": { ko: "방어", en: "DEF", ja: "防御", zh: "防御" },
  "shop.stat.mind": { ko: "정신", en: "MND", ja: "精神", zh: "精神" },
  "shop.stat.agility": { ko: "민첩", en: "AGI", ja: "敏捷", zh: "敏捷" },
  "shop.owned": { ko: "보유 {0}", en: "Owned {0}", ja: "所持 {0}", zh: "持有 {0}" },
  "shop.ownedEquipped": { ko: "보유 {0} · 장착 중 {1}", en: "Owned {0} · Equipped {1}", ja: "所持 {0} · 装備中 {1}", zh: "持有 {0} · 已装备 {1}" },
  "shop.detailCompare": { ko: "상세 / 장비 비교", en: "Details / Compare", ja: "詳細・装備比較", zh: "详情 / 装备对比" },
  "shop.serviceUnavailable": {
    ko: "대상 없음 — 서비스 불가",
    en: "No eligible items — unavailable",
    ja: "対象なし — 利用不可",
    zh: "无可用目标 — 无法服务",
  },
  "shop.menuHint.buy": { ko: "진열된 물건을 산다", en: "Browse items to buy", ja: "並んでいる商品を買う", zh: "购买陈列的商品" },
  "shop.menuHint.sell": { ko: "가진 물건을 넘긴다", en: "Sell items you own", ja: "所持品を売る", zh: "出售持有的物品" },
  "shop.menuHint.cancel": { ko: "가게에서 나간다", en: "Leave the shop", ja: "店を出る", zh: "离开商店" },
  "shop.key.select": { ko: "선택", en: "Select", ja: "選択", zh: "选择" },
  "shop.key.confirm": { ko: "결정", en: "Confirm", ja: "決定", zh: "确认" },
  "shop.key.leave": { ko: "나가기", en: "Leave", ja: "出る", zh: "离开" },
  "shop.key.section": { ko: "영역", en: "Focus", ja: "領域", zh: "区域" },
  "shop.key.qty": { ko: "수량", en: "Qty", ja: "数量", zh: "数量" },
  "shop.key.back": { ko: "뒤로", en: "Back", ja: "戻る", zh: "返回" },
  "shop.key.close": { ko: "닫기", en: "Close", ja: "閉じる", zh: "关闭" },
  "shop.haggle.verbBuy": { ko: "제시", en: "Offer", ja: "提示", zh: "出价" },
  "shop.haggle.verbSell": { ko: "요구", en: "Ask", ja: "要求", zh: "要价" },
  "shop.haggle.itemLine": {
    ko: "{0} · 기준가 {1}{2} ×{3} · 내 소지금 {4}{2}",
    en: "{0} · Base {1}{2} ×{3} · Gold {4}{2}",
    ja: "{0} · 基準 {1}{2} ×{3} · 所持金 {4}{2}",
    zh: "{0} · 基准价 {1}{2} ×{3} · 持有 {4}{2}",
  },
  "shop.haggle.myOffer": { ko: "내 제시가", en: "Your offer", ja: "提示額", zh: "我的出价" },
  "shop.haggle.myAsk": { ko: "내 요구가", en: "Your ask", ja: "要求額", zh: "我的要价" },
  "shop.haggle.total": { ko: "합계 {0}{1}", en: "Total {0}{1}", ja: "合計 {0}{1}", zh: "总计 {0}{1}" },
  "shop.haggle.patience": {
    ko: "상인이 {0}번 더 들어줍니다",
    en: "Merchant patience: {0} left",
    ja: "店主はあと{0}回聞いてくれます",
    zh: "商人还可听取 {0} 次",
  },
  "shop.haggle.stepAria": { ko: "제시가 {0}{1}", en: "Offer {0}{1}", ja: "提示額 {0}{1}", zh: "出价 {0}{1}" },
  "shop.haggle.cancel": { ko: "그만두기", en: "Cancel", ja: "やめる", zh: "取消" },
  "shop.haggle.keyAdjust": { ko: "금액 조절", en: "Adjust", ja: "金額調整", zh: "调整价格" },
  "shop.haggle.keyMove": { ko: "버튼 이동", en: "Navigate", ja: "ボタン移動", zh: "切换按钮" },
  "shop.haggle.keyBack": { ko: "돌아가기", en: "Back", ja: "戻る", zh: "返回" },

  // Battle UI
  "battle.autoOn": { ko: "{0} 자동 켜짐", en: "{0} Auto ON", ja: "{0} オート ON", zh: "{0} 自动 开" },
  "battle.autoOff": { ko: "{0} 자동 꺼짐", en: "{0} Auto OFF", ja: "{0} オート OFF", zh: "{0} 自动 关" },
  "battle.skipping": { ko: "넘기는 중", en: "Skipping", ja: "早送り中", zh: "快进中" },
  "battle.defeatBanner": { ko: "전멸…", en: "Defeated…", ja: "全滅…", zh: "全灭…" },
  "battle.inputPrompt": { ko: "입력! ({0}초)", en: "Input! ({0}s)", ja: "入力！ ({0}秒)", zh: "输入！({0}秒)" },
  "battle.charging": { ko: "게이지가 차는 중입니다.", en: "Charging gauge…", ja: "ゲージ充填中…", zh: "行动条充能中…" },
};

export const RUNTIME_UI_KEYS = Object.keys(RUNTIME_UI_STRINGS) as readonly RuntimeUiKey[];

let runtimeUiLocaleOverride: SupportedLocale | null = null;

/** 인게임 언어 전환(플레이어 설정 등). null 을 주면 프로젝트 기본 설정으로 되돌린다. */
export function setRuntimeUiLocaleOverride(locale: SupportedLocale | string | null): void {
  runtimeUiLocaleOverride = locale === null ? null : matchSupportedLocale(locale);
}

/** 현재 설정된 인게임 언어 오버라이드. 없으면 null. */
export function getRuntimeUiLocaleOverride(): SupportedLocale | null {
  return runtimeUiLocaleOverride;
}

/** 테스트/세션 정리용. 인게임 언어 오버라이드를 해제한다. */
export function resetRuntimeUiLocaleOverride(): void {
  runtimeUiLocaleOverride = null;
}

/**
 * 프로젝트의 런타임 UI 로캘을 결정한다.
 * 우선순위: 인게임 오버라이드 → project.meta.language → project.meta.oprnDialogueSystem.language → "ko".
 * "auto" 는 detectLocale() 로 해석한다.
 */
export function runtimeUiLocale(project?: Pick<Project, "meta"> | null): SupportedLocale {
  if (runtimeUiLocaleOverride) return runtimeUiLocaleOverride;
  const projectLang = project?.meta?.language;
  if (projectLang === "ko" || projectLang === "en" || projectLang === "ja" || projectLang === "zh") {
    return projectLang;
  }
  if (projectLang === "auto") return detectLocale();
  const dialogueLang = project?.meta?.oprnDialogueSystem?.language;
  if (dialogueLang === "ko" || dialogueLang === "en" || dialogueLang === "ja" || dialogueLang === "zh") {
    return dialogueLang;
  }
  if (dialogueLang === "auto") return detectLocale();
  return "ko";
}

/** 명시 로캘로 런타임 UI 문자열을 포맷한다. */
export function runtimeUiTextForLocale(
  locale: SupportedLocale,
  key: RuntimeUiKey,
  ...args: readonly (string | number)[]
): string {
  const template = RUNTIME_UI_STRINGS[key][locale];
  return template.replace(/\{(\d+)\}/g, (_match, index: string) => String(args[Number(index)] ?? ""));
}

/** 프로젝트 언어(또는 인게임 오버라이드)에 맞춰 런타임 UI 문자열을 포맷한다. */
export function runtimeUiText(
  project: Pick<Project, "meta"> | null | undefined,
  key: RuntimeUiKey,
  ...args: readonly (string | number)[]
): string {
  return runtimeUiTextForLocale(runtimeUiLocale(project), key, ...args);
}
