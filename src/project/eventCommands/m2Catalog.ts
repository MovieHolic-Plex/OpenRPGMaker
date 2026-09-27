import type { Command, M2CommandValue } from "@/project/types";
import {
  DEPRECATED_M2_COMMAND_IDS,
  EXISTING_KIND_BY_TITLE,
  KOREAN_LABEL_BY_TITLE,
  MODERN_COMMAND_ROWS,
  NO_ELLIPSIS_TITLES,
  PDF_COMMAND_ROWS,
  type M2CommandDeprecation,
  type M2PdfCommandRow,
} from "./m2CatalogData";
import { modernFieldsFor } from "./m2ModernCatalog";
import {
  pickerGroupForM2Command,
  pickerPageForM2Command,
  type M2CommandPickerGroup,
  type M2CommandPickerPage,
} from "./m2PickerLayout";
import {
  catalogRowRuntimeSupport,
  m2CommandRuntimeClassification,
  type CommandRuntimeSupport,
  type M2RuntimeContext,
} from "./runtimeSupport";

export type { M2CommandDeprecation } from "./m2CatalogData";
export type { M2CommandPickerGroup, M2CommandPickerPage } from "./m2PickerLayout";
export type { CommandRuntimeSupport, M2RuntimeContext } from "./runtimeSupport";

export type M2CommandSupportStatus = CommandRuntimeSupport;
export type M2RuntimeClassification = CommandRuntimeSupport;

export type M2CommandFieldType = "text" | "number" | "boolean" | "textarea" | "select";

export type M2CommandFieldOption = {
  readonly value: string;
  readonly label: string;
};

export type M2CommandFieldSpec = {
  readonly key: string;
  readonly label: string;
  readonly type: M2CommandFieldType;
  readonly defaultValue: M2CommandValue;
  readonly options?: readonly M2CommandFieldOption[];
  /** number 필드의 통상 범위 — 런타임 클램프와 같은 수를 쓴다(예: clampMs 50~5000). */
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
};

export type M2CommandCatalogEntry = M2PdfCommandRow & {
  readonly id: string;
  readonly label: string;
  readonly pickerLabel: string;
  readonly pickerPage: M2CommandPickerPage;
  readonly pickerGroup: M2CommandPickerGroup;
  readonly existingKind?: Command["kind"];
  readonly supportStatus: M2CommandSupportStatus;
  readonly runtimeSupport: CommandRuntimeSupport;
  readonly runtimeClassification: M2RuntimeClassification;
  readonly bodyStrategy: "existing" | "generic" | "none";
  readonly fields: readonly M2CommandFieldSpec[];
  readonly testId: string;
  /**
   * 설정되어 있으면 은퇴한 행이다 — 어느 피커에서도 새로 고를 수 없고, 이미 저장된 행은
   * 그대로 열리고 실행된다. 정본은 `DEPRECATED_M2_COMMAND_IDS`.
   */
  readonly deprecated?: M2CommandDeprecation;
};

const OPERATION_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "set", label: "설정" },
  { value: "add", label: "증가" },
  { value: "remove", label: "감소" },
  { value: "toggle", label: "전환" },
];

const BOOLEAN_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "true", label: "켜기 / 허가" },
  { value: "false", label: "끄기 / 금지" },
];

const SYSTEM_BGM_SLOT_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "field", label: "필드 기본곡" },
  { value: "battle", label: "전투곡" },
];
const SYSTEM_SE_SLOT_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "defeat", label: "전투 패배" },
  { value: "escape", label: "도주" },
];
const WEATHER_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "none", label: "없음" },
  { value: "rain", label: "비" },
  { value: "storm", label: "폭풍" },
  { value: "snow", label: "눈" },
  { value: "fog", label: "안개" },
];

const SCREEN_COLOR_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "white", label: "흰색" },
  { value: "red", label: "빨강" },
  { value: "green", label: "초록" },
  { value: "blue", label: "파랑" },
  { value: "yellow", label: "노랑" },
  { value: "purple", label: "보라" },
  { value: "black", label: "검정" },
  { value: "neutral", label: "중립" },
];

const SHAKE_INTENSITY_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "1", label: "약하게" },
  { value: "3", label: "보통" },
  { value: "6", label: "강하게" },
  { value: "10", label: "매우 강하게" },
];

const SCROLL_DIRECTION_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "down", label: "아래" },
  { value: "left", label: "왼쪽" },
  { value: "right", label: "오른쪽" },
  { value: "up", label: "위" },
];

const SCROLL_MODE_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "return", label: "복귀" },
  { value: "lock", label: "고정" },
  { value: "pan", label: "패닝" },
];

const ANIMATION_TARGET_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "player", label: "플레이어" },
  { value: "this-event", label: "이 이벤트" },
];

const VEHICLE_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "boat", label: "배" },
  { value: "ship", label: "배(대형)" },
  { value: "airship", label: "비행선" },
];


export const M2_COMMAND_CATALOG: readonly M2CommandCatalogEntry[] = [...PDF_COMMAND_ROWS, ...MODERN_COMMAND_ROWS].map(buildCatalogEntry);

// 은퇴 레지스트리는 오타 한 글자로 조용히 뚫린다(실측: 라벨 문자열 필터가 그렇게 뚫렸다).
// 카탈로그를 빌드하는 자리에서 즉시 터뜨린다.
for (const [id, deprecation] of Object.entries(DEPRECATED_M2_COMMAND_IDS)) {
  if (!deprecation) continue;
  if (!M2_COMMAND_CATALOG.some((entry) => entry.id === id)) {
    throw new Error(`Deprecated m2 command id is not in the catalog: ${id}`);
  }
  if (!M2_COMMAND_CATALOG.some((entry) => entry.id === deprecation.supersededBy)) {
    throw new Error(`Deprecated m2 command ${id} points at an unknown replacement: ${deprecation.supersededBy}`);
  }
  if (DEPRECATED_M2_COMMAND_IDS[deprecation.supersededBy]) {
    throw new Error(`Deprecated m2 command ${id} points at another deprecated entry: ${deprecation.supersededBy}`);
  }
}

export function m2CommandById(commandId: string): M2CommandCatalogEntry | undefined {
  return M2_COMMAND_CATALOG.find((entry) => entry.id === commandId);
}

export function m2CommandByKind(kind: Command["kind"]): M2CommandCatalogEntry | undefined {
  return M2_COMMAND_CATALOG.find((entry) => entry.existingKind === kind);
}

export function createDefaultM2Fields(entry: M2CommandCatalogEntry): Record<string, M2CommandValue> {
  const fields: Record<string, M2CommandValue> = {};
  for (const field of entry.fields) fields[field.key] = field.defaultValue;
  return fields;
}

export function isM2CatalogEntrySelectableInMap(entry: M2CommandCatalogEntry): boolean {
  // 은퇴한 행(중복 등재·다른 명령으로 통합)은 저장 프로젝트 호환을 위해 카탈로그에 남지만
  // 새로 저작할 수는 없다. 판정은 라벨이 아니라 id 레지스트리가 한다.
  if (entry.deprecated) return false;
  return entry.index <= 97 || entry.index >= 200;
}

export function isM2CatalogEntrySelectableInBattleEvent(entry: M2CommandCatalogEntry): boolean {
  if (entry.deprecated) return false;
  if (entry.index >= 98 && entry.index <= 108) return true;
  // 선택 가능 집합은 배지 정직성 수정 이전과 동일하게 유지한다:
  // 네이티브 변환 행 + 행동 클래스 nativeAlias/full. (배지는 컨텍스트별로 별도 판정.)
  if (entry.existingKind) return true;
  const behaviorClass = m2CommandRuntimeClassification(entry.id).behaviorClass;
  return behaviorClass === "nativeAlias" || behaviorClass === "full";
}

/**
 * 편집 중인 이벤트 컨텍스트(맵/공통/배틀)를 반영한 카탈로그 행 런타임 지원 판정.
 * 피커·커맨드 리스트 배지는 반드시 이 함수를 쓰고, 컨텍스트를 모르면 생략해
 * 보수 판정(세 컨텍스트 중 최저)을 받는다.
 */
export function m2CatalogEntryRuntimeSupport(
  entry: M2CommandCatalogEntry,
  context?: M2RuntimeContext
): CommandRuntimeSupport {
  return catalogRowRuntimeSupport(entry.id, entry.existingKind, context);
}

function buildCatalogEntry(row: M2PdfCommandRow): M2CommandCatalogEntry {
  const existingKind = EXISTING_KIND_BY_TITLE[row.title];
  const label = KOREAN_LABEL_BY_TITLE[row.title] ?? row.title;
  const fields = existingKind ? [] : genericFieldsFor(row.title);
  const id = stableCommandId(row);
  // 카탈로그는 컨텍스트를 모르는 정적 테이블이므로 보수 판정(세 컨텍스트 중 최저)을 굽는다.
  // 컨텍스트를 아는 표면(피커/리스트)은 m2CatalogEntryRuntimeSupport(entry, context)로 재판정한다.
  const runtimeSupport = catalogRowRuntimeSupport(id, existingKind);
  return {
    ...row,
    id,
    label,
    pickerLabel: pickerLabelFor(row.title, label, fields),
    pickerPage: pickerPageForM2Command(row),
    pickerGroup: pickerGroupForM2Command(row),
    existingKind,
    supportStatus: runtimeSupport,
    runtimeSupport,
    runtimeClassification: runtimeSupport,
    bodyStrategy: existingKind ? "existing" : fields.length > 0 ? "generic" : "none",
    fields,
    testId: `command-picker-add-${id}`,
    deprecated: DEPRECATED_M2_COMMAND_IDS[id],
  };
}

function stableCommandId(row: M2PdfCommandRow): string {
  return `m2-${String(row.index).padStart(3, "0")}-${slug(row.title)}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function pickerLabelFor(title: string, label: string, fields: readonly M2CommandFieldSpec[]): string {
  if (NO_ELLIPSIS_TITLES.has(title)) return label;
  if (fields.length === 0 && title.startsWith("Open ")) return label;
  return `${label}...`;
}

function genericFieldsFor(title: string): readonly M2CommandFieldSpec[] {
  const page3Fields = page3FieldsFor(title);
  if (page3Fields) return page3Fields;
  const modernFields = modernFieldsFor(title);
  if (modernFields) return modernFields;
  if (title === "Comment") {
    return [
      { key: "comment", label: "내용", type: "textarea", defaultValue: "" },
      {
        key: "color",
        label: "글자색",
        type: "select",
        defaultValue: "green",
        options: [
          { value: "green", label: "초록" },
          { value: "yellow", label: "노랑" },
          { value: "cyan", label: "청록" },
          { value: "pink", label: "분홍" },
          { value: "gray", label: "회색" },
          { value: "white", label: "흰색" },
        ],
      },
    ];
  }
  if (title === "Enemy Encounter") {
    return [{ key: "target", label: "적", type: "text", defaultValue: "" }];
  }
  if (title === "Change Battleback") {
    return [{ key: "resourceId", label: "전투 배경", type: "text", defaultValue: "" }];
  }

  // Location/transfer-like commands only. Never match Erase/End Event Processing.
  if (
    title.includes("Location")
    || title.includes("Player")
    || title === "Call Event"
    || (title.includes("Map") && title !== "Stop All Movement")
  ) {
    return [
      { key: "target", label: "어디에", type: "text", defaultValue: "" },
      { key: "mapId", label: "맵 ID", type: "text", defaultValue: "" },
      { key: "x", label: "X", type: "number", defaultValue: 0 },
      { key: "y", label: "Y", type: "number", defaultValue: 0 },
    ];
  }
  if (title.includes("Picture")) {
    return [
      { key: "pictureId", label: "그림 ID", type: "text", defaultValue: "pic1" },
      { key: "resourceId", label: "리소스 ID", type: "text", defaultValue: "" },
      { key: "x", label: "X", type: "number", defaultValue: 0 },
      { key: "y", label: "Y", type: "number", defaultValue: 0 },
    ];
  }
  if (title === "Memorize Current BGM" || title === "Play Memorized BGM") return [];
  if (title === "Change System BGM" || title === "Change System SE") {
    const bgm = title === "Change System BGM";
    return [
      {
        key: "slot",
        label: bgm ? "바꿀 음악" : "바꿀 효과음",
        type: "select",
        defaultValue: bgm ? "battle" : "defeat",
        options: bgm ? SYSTEM_BGM_SLOT_OPTIONS : SYSTEM_SE_SLOT_OPTIONS,
      },
      { key: "resourceId", label: bgm ? "음악" : "효과음", type: "text", defaultValue: "" },
    ];
  }
  if (title.includes("BGM") || title.includes("SE") || title.includes("Movie")) {
    return [
      { key: "resourceId", label: "리소스 ID", type: "text", defaultValue: "" },
      { key: "volume", label: "볼륨", type: "number", defaultValue: 100 },
    ];
  }
  if (title.includes("On/Off") || title.includes("Access") || title.startsWith("Toggle ")) {
    return [{ key: "enabled", label: "상태", type: "select", defaultValue: "true", options: BOOLEAN_OPTIONS }];
  }
  if (
    title.startsWith("Open ")
    || title === "Exit Game"
    || title === "Break Loop"
    || title === "End Event Processing"
    || title === "Erase Event"
    || title === "Wait for All Movement"
    || title === "Stop All Movement"
  ) {
    return [];
  }
  if (title.includes("Animation")) {
    return [
      { key: "target", label: "누구에게", type: "text", defaultValue: "" },
      { key: "animationId", label: "애니메이션 ID", type: "text", defaultValue: "" },
    ];
  }
  if (title.startsWith("Get ")) {
    return [
      { key: "target", label: "누구에게", type: "text", defaultValue: "" },
      { key: "variableId", label: "변수 ID", type: "text", defaultValue: "" },
    ];
  }
  if (title === "Change Parameters") {
    return [
      { key: "target", label: "동료", type: "text", defaultValue: "" },
      { key: "parameter", label: "능력치", type: "select", defaultValue: "maxHp", options: [
        { value: "maxHp", label: "최대 HP" },
        { value: "maxMp", label: "최대 MP" },
        { value: "attack", label: "공격" },
        { value: "defense", label: "방어" },
        { value: "mind", label: "정신" },
        { value: "agility", label: "민첩" },
      ] },
      { key: "operation", label: "어떻게", type: "select", defaultValue: "add", options: OPERATION_OPTIONS },
      { key: "value", label: "값", type: "number", defaultValue: 1 },
      { key: "valueSource", label: "값 소스", type: "select", defaultValue: "number", options: [
        { value: "number", label: "숫자" },
        { value: "variable", label: "변수" },
      ] },
      { key: "valueVariableId", label: "값 변수", type: "text", defaultValue: "" },
    ];
  }
  if (title === "Change State") {
    return [
      { key: "target", label: "주인공", type: "text", defaultValue: "party" },
      { key: "operation", label: "어떻게", type: "select", defaultValue: "add", options: OPERATION_OPTIONS },
      { key: "value", label: "상태", type: "text", defaultValue: "" },
    ];
  }
  if (title === "Damage Processing") {
    return [
      { key: "target", label: "주인공", type: "text", defaultValue: "party" },
      { key: "operation", label: "어떻게", type: "select", defaultValue: "add", options: [
        { value: "add", label: "데미지" },
        { value: "remove", label: "회복" },
      ] },
      { key: "value", label: "값", type: "number", defaultValue: 10 },
      { key: "valueSource", label: "값 소스", type: "select", defaultValue: "number", options: [
        { value: "number", label: "숫자" },
        { value: "variable", label: "변수" },
      ] },
      { key: "valueVariableId", label: "값 변수", type: "text", defaultValue: "" },
    ];
  }
  if (title === "Change Actor Name" || title === "Change Actor Nickname") {
    return [
      { key: "target", label: "주인공", type: "text", defaultValue: "" },
      { key: "value", label: "이름", type: "text", defaultValue: "" },
    ];
  }
  if (title === "Change Actor Graphic") {
    return [
      { key: "target", label: "주인공", type: "text", defaultValue: "" },
      { key: "value", label: "모습", type: "text", defaultValue: "" },
    ];
  }
  if (title === "Change Actor Faceset") {
    return [
      { key: "target", label: "주인공", type: "text", defaultValue: "" },
      { key: "value", label: "얼굴 그래픽", type: "text", defaultValue: "" },
    ];
  }
  if (title === "Change Actor Class") {
    return [
      { key: "target", label: "주인공", type: "text", defaultValue: "" },
      { key: "value", label: "직업", type: "text", defaultValue: "" },
    ];
  }
  if (
    title.startsWith("Display ") ||
    title.startsWith("Set ") ||
    title.startsWith("Change ") ||
    title.includes("Processing") ||
    title === "Recover All" ||
    title === "Action Times +"
  ) {
    return [
      { key: "target", label: "누구에게", type: "text", defaultValue: "" },
      { key: "operation", label: "어떻게", type: "select", defaultValue: "set", options: OPERATION_OPTIONS },
      { key: "value", label: "값", type: "text", defaultValue: "" },
    ];
  }
  return [{ key: "note", label: "메모", type: "text", defaultValue: "" }];
}

/** Page 3 (맵·연출) M2 field specs aligned with m2Runtime / commandCatalog keys. */
function page3FieldsFor(title: string): readonly M2CommandFieldSpec[] | undefined {
  switch (title) {
    case "Get Player Location":
      return [{ key: "variableId", label: "변수 ID", type: "text", defaultValue: "" }];
    case "Move to Variable Location":
      return [
        { key: "mapVariableId", label: "맵 변수", type: "text", defaultValue: "" },
        { key: "xVariableId", label: "X 변수", type: "text", defaultValue: "" },
        { key: "yVariableId", label: "Y 변수", type: "text", defaultValue: "" },
      ];
    case "Get On/Off Vehicle":
      return [
        { key: "boarded", label: "탑승", type: "select", defaultValue: "true", options: BOOLEAN_OPTIONS },
      ];
    case "Set Vehicle Location":
      return [
        { key: "vehicle", label: "탈것", type: "select", defaultValue: "boat", options: VEHICLE_OPTIONS },
        { key: "mapId", label: "맵 ID", type: "text", defaultValue: "" },
        { key: "x", label: "X", type: "number", defaultValue: 0 },
        { key: "y", label: "Y", type: "number", defaultValue: 0 },
      ];
    case "Set Event Location":
      return [
        { key: "target", label: "이벤트", type: "text", defaultValue: "" },
        { key: "mapId", label: "맵 ID", type: "text", defaultValue: "" },
        { key: "x", label: "X", type: "number", defaultValue: 0 },
        { key: "y", label: "Y", type: "number", defaultValue: 0 },
      ];
    case "Swap Event Location":
      return [
        { key: "eventA", label: "이벤트 A", type: "text", defaultValue: "" },
        { key: "eventB", label: "이벤트 B", type: "text", defaultValue: "" },
      ];
    case "Get Terrain ID":
      return [
        { key: "variableId", label: "변수 ID", type: "text", defaultValue: "" },
        { key: "x", label: "X", type: "number", defaultValue: 0 },
        { key: "y", label: "Y", type: "number", defaultValue: 0 },
      ];
    case "Get Event ID":
      return [
        { key: "variableId", label: "변수 ID", type: "text", defaultValue: "" },
        { key: "x", label: "X", type: "number", defaultValue: 0 },
        { key: "y", label: "Y", type: "number", defaultValue: 0 },
      ];
    case "Hide Screen":
    case "Show Screen":
    case "Stop All Movement":
      return [];
    case "Tint Screen":
      return [
        { key: "color", label: "색상", type: "select", defaultValue: "neutral", options: SCREEN_COLOR_OPTIONS },
        { key: "value", label: "색(R,G,B 또는 hex)", type: "text", defaultValue: "" },
        { key: "durationMs", label: "시간(ms)", type: "number", defaultValue: 0 },
        // 색 필터(%). 기본값이 중립이라 필드가 없는 옛 명령과 같게 동작한다.
        { key: "saturation", label: "채도(%)", type: "number", defaultValue: 100, min: 0, max: 200, step: 5 },
        { key: "grayscale", label: "흑백(%)", type: "number", defaultValue: 0, min: 0, max: 100, step: 5 },
        { key: "sepia", label: "세피아(%)", type: "number", defaultValue: 0, min: 0, max: 100, step: 5 },
      ];
    case "Flash Screen":
      return [
        { key: "color", label: "색상", type: "select", defaultValue: "white", options: SCREEN_COLOR_OPTIONS },
        { key: "value", label: "색 값", type: "text", defaultValue: "flash" },
        { key: "durationMs", label: "시간(ms)", type: "number", defaultValue: 300 },
      ];
    case "Shake Screen":
      return [
        { key: "value", label: "강도(값)", type: "number", defaultValue: 3 },
        { key: "intensity", label: "강도", type: "select", defaultValue: "3", options: SHAKE_INTENSITY_OPTIONS },
        { key: "durationMs", label: "시간(ms)", type: "number", defaultValue: 400 },
      ];
    case "Scroll Map":
      return [
        { key: "direction", label: "방향", type: "select", defaultValue: "down", options: SCROLL_DIRECTION_OPTIONS },
        { key: "distance", label: "거리(타일)", type: "number", defaultValue: 1 },
        { key: "speed", label: "속도", type: "number", defaultValue: 4 },
        { key: "wait", label: "대기", type: "select", defaultValue: "true", options: BOOLEAN_OPTIONS },
        { key: "mode", label: "모드", type: "select", defaultValue: "return", options: SCROLL_MODE_OPTIONS },
      ];
    case "Set Weather Effects":
      return [
        { key: "value", label: "날씨", type: "select", defaultValue: "none", options: WEATHER_OPTIONS },
        { key: "intensity", label: "강도(0~1)", type: "number", defaultValue: 0.5 },
        { key: "transitionMs", label: "전환(ms)", type: "number", defaultValue: 0 },
      ];
    case "Show Picture":
      return [
        { key: "pictureId", label: "그림 ID", type: "text", defaultValue: "pic1" },
        { key: "resourceId", label: "리소스 ID", type: "text", defaultValue: "" },
        { key: "x", label: "X", type: "number", defaultValue: 0 },
        { key: "y", label: "Y", type: "number", defaultValue: 0 },
        { key: "scale", label: "배율", type: "number", defaultValue: 100 },
        { key: "opacity", label: "불투명도", type: "number", defaultValue: 255 },
      ];
    case "Move Picture":
      return [
        { key: "pictureId", label: "그림 ID", type: "text", defaultValue: "pic1" },
        { key: "x", label: "X", type: "number", defaultValue: 0 },
        { key: "y", label: "Y", type: "number", defaultValue: 0 },
        { key: "scale", label: "배율", type: "number", defaultValue: 100 },
        { key: "opacity", label: "불투명도", type: "number", defaultValue: 255 },
        { key: "durationMs", label: "시간(ms)", type: "number", defaultValue: 0 },
      ];
    case "Erase Picture":
      return [{ key: "pictureId", label: "그림 ID", type: "text", defaultValue: "pic1" }];
    case "Show Animation":
      return [
        { key: "target", label: "누구에게", type: "select", defaultValue: "player", options: ANIMATION_TARGET_OPTIONS },
        { key: "animationId", label: "애니메이션 ID", type: "text", defaultValue: "" },
        { key: "wait", label: "완료까지 대기", type: "select", defaultValue: "false", options: BOOLEAN_OPTIONS },
      ];
    case "Flash Event":
      return [
        { key: "target", label: "이벤트", type: "text", defaultValue: "" },
        { key: "value", label: "색 값", type: "text", defaultValue: "flash" },
        { key: "color", label: "색상", type: "select", defaultValue: "white", options: SCREEN_COLOR_OPTIONS },
      ];
    case "Key Input Processing":
      return [
        { key: "variableId", label: "변수 ID", type: "text", defaultValue: "" },
        {
          key: "wait",
          label: "키 대기",
          type: "select",
          defaultValue: "true",
          options: BOOLEAN_OPTIONS,
        },
      ];
    case "Change Tileset":
      return [{ key: "value", label: "타일셋 ID", type: "text", defaultValue: "" }];
    case "Change Parallax Back":
      // 흐름 배율·전환은 회상 연출용(2026-09-27) — 100 = 저작 속도, 0 = 멈춤. 런타임 규칙은 m2Runtime.
      return [
        { key: "resourceId", label: "파노라마 리소스", type: "text", defaultValue: "" },
        { key: "flowPercent", label: "흐름 배율(%)", type: "number", defaultValue: 100 },
        { key: "flowDurationMs", label: "전환 시간(ms)", type: "number", defaultValue: 0 },
      ];
    case "Set Encounter Rate":
      return [{ key: "value", label: "인카운트율", type: "number", defaultValue: 25 }];
    case "Change Tile":
      return [
        { key: "x", label: "X", type: "number", defaultValue: 0 },
        { key: "y", label: "Y", type: "number", defaultValue: 0 },
        { key: "value", label: "타일 ID", type: "text", defaultValue: "" },
        { key: "layer", label: "레이어", type: "number", defaultValue: 0 },
      ];
    default:
      return undefined;
  }
}
