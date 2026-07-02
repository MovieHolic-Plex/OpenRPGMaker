import type { Command, M2CommandValue } from "@/project/types";
import {
  EXISTING_KIND_BY_TITLE,
  KOREAN_LABEL_BY_TITLE,
  MODERN_COMMAND_ROWS,
  NO_ELLIPSIS_TITLES,
  PDF_COMMAND_ROWS,
  type M2PdfCommandRow,
} from "./m2CatalogData";
import { modernFieldsFor } from "./m2ModernCatalog";
import {
  pickerGroupForM2Command,
  pickerPageForM2Command,
  type M2CommandPickerGroup,
  type M2CommandPickerPage,
} from "./m2PickerLayout";

export type { M2CommandPickerGroup, M2CommandPickerPage } from "./m2PickerLayout";

export type M2CommandSupportStatus =
  | "enabled-runtime"
  | "enabled-editor-only"
  | "enabled-shell"
  | "battle-only"
  | "catalog-disabled"
  | "internal-non-pdf";

export type M2RuntimeClassification =
  | "runtime"
  | "editor-only"
  | "shell"
  | "battle-only"
  | "disabled"
  | "missing-runtime"
  | "internal-non-pdf";

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
};

export type M2CommandCatalogEntry = M2PdfCommandRow & {
  readonly id: string;
  readonly label: string;
  readonly pickerLabel: string;
  readonly pickerPage: M2CommandPickerPage;
  readonly pickerGroup: M2CommandPickerGroup;
  readonly existingKind?: Command["kind"];
  readonly supportStatus: M2CommandSupportStatus;
  readonly runtimeClassification: M2RuntimeClassification;
  readonly bodyStrategy: "existing" | "generic" | "none";
  readonly fields: readonly M2CommandFieldSpec[];
  readonly testId: string;
};

const SAFE_EDITOR_ONLY_TITLES: ReadonlySet<string> = new Set(["Comment"]);

const OPERATION_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "set", label: "설정" },
  { value: "add", label: "증가" },
  { value: "remove", label: "감소" },
  { value: "toggle", label: "전환" },
];

const BOOLEAN_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "true", label: "ON / 허가" },
  { value: "false", label: "OFF / 금지" },
];

export const M2_COMMAND_CATALOG: readonly M2CommandCatalogEntry[] = [...PDF_COMMAND_ROWS, ...MODERN_COMMAND_ROWS].map(buildCatalogEntry);

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
  return (
    entry.runtimeClassification === "runtime" ||
    entry.runtimeClassification === "editor-only" ||
    entry.runtimeClassification === "shell" ||
    (entry.runtimeClassification === "disabled" && entry.bodyStrategy === "generic")
  );
}

export function isM2CatalogEntrySelectableInBattleEvent(entry: M2CommandCatalogEntry): boolean {
  return (
    entry.runtimeClassification === "runtime" ||
    entry.runtimeClassification === "editor-only" ||
    entry.runtimeClassification === "battle-only" ||
    (entry.runtimeClassification === "disabled" && entry.bodyStrategy === "generic")
  );
}

function buildCatalogEntry(row: M2PdfCommandRow): M2CommandCatalogEntry {
  const existingKind = EXISTING_KIND_BY_TITLE[row.title];
  const label = KOREAN_LABEL_BY_TITLE[row.title] ?? row.title;
  const supportStatus = supportStatusFor(row.title, existingKind, row.index);
  const runtimeClassification = runtimeClassificationFor(supportStatus, existingKind);
  const fields = existingKind ? [] : genericFieldsFor(row.title);
  return {
    ...row,
    id: stableCommandId(row),
    label,
    pickerLabel: pickerLabelFor(row.title, label, fields),
    pickerPage: pickerPageForM2Command(row),
    pickerGroup: pickerGroupForM2Command(row),
    existingKind,
    supportStatus,
    runtimeClassification,
    bodyStrategy: existingKind ? "existing" : fields.length > 0 ? "generic" : "none",
    fields,
    testId: `command-picker-add-${stableCommandId(row)}`,
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

function supportStatusFor(
  title: string,
  existingKind: Command["kind"] | undefined,
  index: number
): M2CommandSupportStatus {
  if (existingKind) return "enabled-runtime";
  if (index >= 200) return "enabled-runtime";
  if (index >= 98) return "battle-only";
  if (title.startsWith("Open ") || title === "Exit Game" || title.startsWith("Toggle ")) return "enabled-shell";
  if (SAFE_EDITOR_ONLY_TITLES.has(title)) return "enabled-editor-only";
  return "catalog-disabled";
}

function runtimeClassificationFor(supportStatus: M2CommandSupportStatus, existingKind: Command["kind"] | undefined): M2RuntimeClassification {
  if (existingKind) return "runtime";
  if (supportStatus === "enabled-runtime") return "runtime";
  if (supportStatus === "enabled-shell") return "shell";
  if (supportStatus === "battle-only") return "battle-only";
  if (supportStatus === "catalog-disabled") return "disabled";
  if (supportStatus === "internal-non-pdf") return "internal-non-pdf";
  return "editor-only";
}

function genericFieldsFor(title: string): readonly M2CommandFieldSpec[] {
  const modernFields = modernFieldsFor(title);
  if (modernFields) return modernFields;
  if (title === "Comment") {
    return [{ key: "comment", label: "내용", type: "textarea", defaultValue: "" }];
  }
  if (title === "Enemy Encounter") {
    return [{ key: "target", label: "적", type: "text", defaultValue: "" }];
  }
  if (title === "Change Battleback") {
    return [{ key: "resourceId", label: "전투 배경", type: "text", defaultValue: "" }];
  }
  if (title.includes("Location") || title.includes("Player") || title.includes("Event") || title.includes("Map")) {
    return [
      { key: "target", label: "대상", type: "text", defaultValue: "" },
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
  if (title.includes("BGM") || title.includes("SE") || title.includes("Movie")) {
    return [
      { key: "resourceId", label: "리소스 ID", type: "text", defaultValue: "" },
      { key: "volume", label: "볼륨", type: "number", defaultValue: 100 },
    ];
  }
  if (title.includes("On/Off") || title.includes("Access") || title.startsWith("Toggle ")) {
    return [{ key: "enabled", label: "상태", type: "select", defaultValue: "true", options: BOOLEAN_OPTIONS }];
  }
  if (title.startsWith("Open ") || title === "Exit Game" || title === "Break Loop" || title === "End Event Processing" || title === "Erase Event") {
    return [];
  }
  if (title.includes("Animation")) {
    return [
      { key: "target", label: "대상", type: "text", defaultValue: "" },
      { key: "animationId", label: "애니메이션 ID", type: "text", defaultValue: "" },
    ];
  }
  if (title.startsWith("Get ")) {
    return [
      { key: "target", label: "대상", type: "text", defaultValue: "" },
      { key: "variableId", label: "변수 ID", type: "text", defaultValue: "" },
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
      { key: "target", label: "대상", type: "text", defaultValue: "" },
      { key: "operation", label: "조작", type: "select", defaultValue: "set", options: OPERATION_OPTIONS },
      { key: "value", label: "값", type: "text", defaultValue: "" },
    ];
  }
  return [{ key: "note", label: "메모", type: "text", defaultValue: "" }];
}
