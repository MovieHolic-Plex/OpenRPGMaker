import type { M2PdfCommandRow } from "./m2CatalogData";

export type M2CommandPickerPage = 1 | 2 | 3 | 4;
export type M2CommandPickerGroup = string;

/**
 * 탭 2(동료 · 전투)는 카탈로그 분류가 아니라 저작 작업면이다. 그래서 그룹 이름은
 * `배우/전투` 같은 RM 분류명이 아니라 작가가 하려는 일 — 적을 세우고(전투), 누구를
 * 파티에 넣고(파티), 수치를 움직이고(능력·성장), 모습을 바꾼다(모습·이름) — 로 쪼갠다.
 */
export const M2_PICKER_BATTLE_GROUP = "전투";
export const M2_PICKER_PARTY_GROUP = "파티";
export const M2_PICKER_GROWTH_GROUP = "능력·성장";
export const M2_PICKER_APPEARANCE_GROUP = "모습·이름";

export const M2_COMMAND_PICKER_GROUP_ORDER: readonly M2CommandPickerGroup[] = [
  "대화/입력",
  "조건/흐름",
  "맵/이동",
  "보상/상점",
  "소리",
  M2_PICKER_BATTLE_GROUP,
  M2_PICKER_PARTY_GROUP,
  M2_PICKER_GROWTH_GROUP,
  M2_PICKER_APPEARANCE_GROUP,
  "화면/연출",
  "시스템/고급",
  "모던 명령",
];

/** 전투 이벤트에서만 의미가 있는 PDF 행 구간. 페이지/그룹 판정보다 먼저 걸러진다. */
const BATTLE_ONLY_INDEX_RANGE = { first: 98, last: 108 } as const;

function isBattleOnlyRow(row: M2PdfCommandRow): boolean {
  return row.index >= BATTLE_ONLY_INDEX_RANGE.first && row.index <= BATTLE_ONLY_INDEX_RANGE.last;
}

const QUICK_AUTHORING_PAGE_TITLES: ReadonlySet<string> = new Set([
  "Show Text",
  "Display Text Settings",
  "Change Faceset",
  "Show Choices",
  "Input Number",
  "Control Switches",
  "Control Variables",
  "Conditional Branch",
  "Wait",
  "Comment",
  "Transfer Player",
  "Move Event",
  "Wait for All Movement",
  "Erase Event",
  "Change Gold",
  "Change Items",
  "Shop Processing",
  "Inn Processing",
  "Play SE",
  "Play BGM",
  "Fadeout BGM",
  // 흐름·시간·입력·사운드는 탭 1 저작면이다. 시스템 탭의 쓰레기통이 아니다.
  "Control Timer",
  "Label",
  "Jump to Label",
  "Loop",
  "Break Loop",
  "End Event Processing",
  "Name Input Processing",
  "Memorize Current BGM",
  "Play Memorized BGM",
  "Wait Until",
  "Weighted Branch",
  "Quest Objective",
  "Advanced Dialogue",
  "Sound Layer",
]);

const ACTOR_AND_BATTLE_PAGE_TITLES: ReadonlySet<string> = new Set([
  "Battle Processing",
  "Change Party Member",
  "Change EXP",
  "Change Level",
  "Change Parameters",
  "Change Skills",
  "Change Equipment",
  "Change HP",
  "Change MP",
  "Change State",
  "Recover All",
  "Damage Processing",
  "Change Actor Name",
  "Change Actor Nickname",
  "Change Actor Graphic",
  "Change Actor Faceset",
  "Change Actor Class",
  "Change Battle Commands",
]);

/** 탭 4에 남는 시스템·도구 명령. 세이브/메뉴, 시스템 미디어, 종료, 도구, 시스템 플래그. */
const SYSTEM_TOOL_PAGE_TITLES: ReadonlySet<string> = new Set([
  "Change System BGM",
  "Change System SE",
  "Change System Graphic",
  "Set Teleportation Point",
  "Teleportation On/Off",
  "Set Escape Location",
  "Change Escape Access",
  "Open Save Menu",
  "Change Save Access",
  "Open Load Menu",
  "Open Menu Screen",
  "Change Menu Access",
  "Game Over",
  "Return to Title Screen",
  "Exit Game",
  "Toggle ATB Wait Mode",
  "Toggle Fullscreen Mode",
  "Open Video Options",
  "Checkpoint Save",
  "UI Command",
  "Debug Log",
  "Evaluate Expression",
  "Data Query",
]);

const DETAILED_MAP_PRESENTATION_PAGE_TITLES: ReadonlySet<string> = new Set([
  "Get Player Location",
  "Move to Variable Location",
  "Get On/Off Vehicle",
  "Set Vehicle Location",
  "Set Event Location",
  "Swap Event Location",
  "Get Terrain ID",
  "Get Event ID",
  "Hide Screen",
  "Show Screen",
  "Tint Screen",
  "Flash Screen",
  "Shake Screen",
  "Scroll Map",
  "Set Weather Effects",
  "Show Picture",
  "Move Picture",
  "Erase Picture",
  "Show Animation",
  "Flash Event",
  "Stop All Movement",
  "Key Input Processing",
  "Change Tileset",
  "Change Parallax Back",
  "Set Encounter Rate",
  "Change Tile",
  // 지도·연출 상세. 카메라/화면 효과/컷신/동영상은 시스템이 아니라 연출이다.
  "Change Vehicle Graphic",
  "Change Screen Transition",
  "Play Movie",
  "Call Event",
  "Camera Control",
  "Screen Effect",
  "Cutscene Control",
  "Spawn Event",
  "Remove Event",
  "Pathfind Move",
  "Region Trigger",
]);

/**
 * 페이지는 명시 분류만 인정한다. 기본값 4(= 시스템 탭 쓰레기통)는 없다.
 * 새 명령을 추가하면 위 네 표 중 하나에 반드시 등록해야 하고, 빠뜨리면 카탈로그 빌드가 즉시 터진다.
 */
export function pickerPageForM2Command(row: M2PdfCommandRow): M2CommandPickerPage {
  if (isBattleOnlyRow(row)) return 2;
  if (QUICK_AUTHORING_PAGE_TITLES.has(row.title)) return 1;
  if (ACTOR_AND_BATTLE_PAGE_TITLES.has(row.title)) return 2;
  if (DETAILED_MAP_PRESENTATION_PAGE_TITLES.has(row.title)) return 3;
  // 명시 분류가 휴리스틱을 이긴다. "Open Menu Screen"·"Return to Title Screen" 은 제목에
  // Screen 이 들어가도 연출이 아니라 시스템 명령이다(탭 4).
  if (SYSTEM_TOOL_PAGE_TITLES.has(row.title)) return 4;
  if (isScreenPresentationCommand(row.title)) return 3;
  throw new Error(`Unclassified event command picker page: ${row.index} ${row.title}`);
}

export function pickerGroupForM2Command(row: M2PdfCommandRow): M2CommandPickerGroup {
  if (isBattleOnlyRow(row)) return M2_PICKER_BATTLE_GROUP;
  const tab2Group = actorBattleSurfaceGroup(row.title);
  if (tab2Group) return tab2Group;
  // 탭 4에 남는 행은 시스템(⚙) 또는 도구(◈) 헤딩 하나로만 묶인다.
  if (SYSTEM_TOOL_PAGE_TITLES.has(row.title)) return row.index >= 200 ? "모던 명령" : "시스템/고급";
  if (isDialogueInputCommand(row.title)) return "대화/입력";
  if (isConditionFlowCommand(row.title)) return "조건/흐름";
  if (isMapMovementCommand(row.title)) return "맵/이동";
  if (isRewardShopCommand(row.title)) return "보상/상점";
  if (row.title.includes("BGM") || row.title.includes("SE") || row.title === "Sound Layer") return "소리";
  if (isScreenPresentationCommand(row.title)) return "화면/연출";
  if (row.index >= 200) return "모던 명령";
  return "시스템/고급";
}

/** 탭 2 작업면 그룹. 탭 2 행이 아니면 undefined. */
function actorBattleSurfaceGroup(title: string): M2CommandPickerGroup | undefined {
  if (title === "Battle Processing" || title === "Change Battle Commands") return M2_PICKER_BATTLE_GROUP;
  if (title === "Change Party Member") return M2_PICKER_PARTY_GROUP;
  if (APPEARANCE_PAGE_TITLES.has(title)) return M2_PICKER_APPEARANCE_GROUP;
  if (GROWTH_PAGE_TITLES.has(title)) return M2_PICKER_GROWTH_GROUP;
  return undefined;
}

/** 수치·성장: HP/MP/EXP/레벨/능력치/스킬/장비/상태. 게이지로 미리 보는 명령들. */
const GROWTH_PAGE_TITLES: ReadonlySet<string> = new Set([
  "Change EXP",
  "Change Level",
  "Change Parameters",
  "Change Skills",
  "Change Equipment",
  "Change HP",
  "Change MP",
  "Change State",
  "Recover All",
  "Damage Processing",
]);

/** 모습·이름: 얼굴·맵 그래픽·이름·별명·직업. */
const APPEARANCE_PAGE_TITLES: ReadonlySet<string> = new Set([
  "Change Actor Name",
  "Change Actor Nickname",
  "Change Actor Graphic",
  "Change Actor Faceset",
  "Change Actor Class",
]);

function isDialogueInputCommand(title: string): boolean {
  return (
    title === "Show Text" ||
    title === "Display Text Settings" ||
    title === "Change Faceset" ||
    title === "Show Choices" ||
    title === "Input Number" ||
    title === "Name Input Processing" ||
    title === "Advanced Dialogue"
  );
}

function isConditionFlowCommand(title: string): boolean {
  return (
    title === "Control Switches" ||
    title === "Control Variables" ||
    title === "Control Timer" ||
    title === "Conditional Branch" ||
    title === "Wait" ||
    title === "Wait Until" ||
    title === "Weighted Branch" ||
    title === "Comment" ||
    title === "Label" ||
    title === "Jump to Label" ||
    title === "Loop" ||
    title === "Break Loop" ||
    title === "End Event Processing"
  );
}

function isMapMovementCommand(title: string): boolean {
  return (
    title === "Transfer Player" ||
    title.includes("Location") ||
    title.includes("Vehicle") ||
    title === "Move Event" ||
    title === "Wait for All Movement" ||
    title === "Stop All Movement" ||
    title === "Erase Event" ||
    title === "Call Event" ||
    title === "Spawn Event" ||
    title === "Remove Event" ||
    title === "Pathfind Move" ||
    title === "Region Trigger"
  );
}

function isRewardShopCommand(title: string): boolean {
  return (
    title === "Change Gold" ||
    title === "Change Items" ||
    title === "Shop Processing" ||
    title === "Inn Processing" ||
    title === "Quest Objective"
  );
}

function isScreenPresentationCommand(title: string): boolean {
  return (
    title.includes("Picture") ||
    title.includes("Screen") ||
    title.includes("Weather") ||
    title.includes("Animation") ||
    title === "Play Movie" ||
    title === "Camera Control" ||
    title === "Screen Effect" ||
    title === "Cutscene Control"
  );
}

