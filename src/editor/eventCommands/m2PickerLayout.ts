import type { M2PdfCommandRow } from "./m2CatalogData";

export type M2CommandPickerPage = 1 | 2 | 3 | 4;
export type M2CommandPickerGroup = string;

export const M2_COMMAND_PICKER_GROUP_ORDER: readonly M2CommandPickerGroup[] = [
  "대화/입력",
  "조건/흐름",
  "맵/이동",
  "보상/상점",
  "소리",
  "배우/전투",
  "화면/연출",
  "시스템/고급",
  "전투 전용",
  "모던 명령",
];

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
]);

export function pickerPageForM2Command(row: M2PdfCommandRow): M2CommandPickerPage {
  if (row.index >= 200) return 4;
  if (QUICK_AUTHORING_PAGE_TITLES.has(row.title)) return 1;
  if (ACTOR_AND_BATTLE_PAGE_TITLES.has(row.title)) return 2;
  if (DETAILED_MAP_PRESENTATION_PAGE_TITLES.has(row.title)) return 3;
  return 4;
}

export function pickerGroupForM2Command(row: M2PdfCommandRow): M2CommandPickerGroup {
  if (isDialogueInputCommand(row.title)) return "대화/입력";
  if (isConditionFlowCommand(row.title)) return "조건/흐름";
  if (isMapMovementCommand(row.title)) return "맵/이동";
  if (isRewardShopCommand(row.title)) return "보상/상점";
  if (row.title.includes("BGM") || row.title.includes("SE") || row.title === "Sound Layer") return "소리";
  if (isScreenPresentationCommand(row.title)) return "화면/연출";
  if (isActorBattleCommand(row.title)) return "배우/전투";
  if (row.index >= 98 && row.index <= 108) return "전투 전용";
  if (row.index >= 200) return "모던 명령";
  return "시스템/고급";
}

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
    title === "Quest Objective" ||
    title === "Checkpoint Save"
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

function isActorBattleCommand(title: string): boolean {
  return (
    title.includes("Actor") ||
    title.includes("Party") ||
    title.includes("EXP") ||
    title.includes("Level") ||
    title.includes("Parameters") ||
    title.includes("Skills") ||
    title.includes("Equipment") ||
    title.includes("HP") ||
    title.includes("MP") ||
    title.includes("State") ||
    title === "Recover All" ||
    title === "Damage Processing"
  );
}
