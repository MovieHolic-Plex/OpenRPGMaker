import { EVENT_COMMAND_PICKER_NATIVE_KINDS } from "@/editor/panels/eventEditor/commandPicker";
import { COMMAND_KIND_OPTIONS, PAGE_COMMAND_BUTTONS } from "@/editor/panels/eventEditor/options";
import { COMMAND_KINDS, type CommandKind } from "@/project/commandKindRegistry";
import type { CommandAuthoringSurface } from "@/project/commandGuaranteeRegistry";
import type { CommandGuarantee } from "@/project/commandGuaranteeRegistry";

const pickerKinds = new Set(EVENT_COMMAND_PICKER_NATIVE_KINDS);

export const ACTUAL_AUTHORING_SURFACES: Readonly<
  Record<CommandAuthoringSurface, ReadonlySet<CommandKind>>
> = {
  mainPicker: pickerKinds,
  quick: new Set(PAGE_COMMAND_BUTTONS.map((entry) => entry.kind)),
  nested: new Set(COMMAND_KIND_OPTIONS.map((entry) => entry.value)),
  common: pickerKinds,
  troop: pickerKinds,
  ai: new Set(COMMAND_KINDS.filter((kind) => kind !== "m2Command")),
};

export function actualSurfacesFor(kind: CommandKind): readonly CommandAuthoringSurface[] {
  return Object.entries(ACTUAL_AUTHORING_SURFACES)
    .filter(([, kinds]) => kinds.has(kind))
    .map(([surface]) => parseAuthoringSurface(surface));
}

export function stableFullRouteIssues(kind: CommandKind, guarantee: CommandGuarantee): readonly string[] {
  if (guarantee.stability !== "stable") return [];
  const required: CommandAuthoringSurface[] = ["nested"];
  if (guarantee.supportByContext.map === "full") required.push("mainPicker");
  if (guarantee.supportByContext.common === "full") required.push("common");
  if (guarantee.supportByContext.troop === "full") required.push("troop");
  const actual = new Set(actualSurfacesFor(kind));
  return required.filter((surface) => !actual.has(surface)).map((surface) => `${kind}:${surface}`);
}

function parseAuthoringSurface(value: string): CommandAuthoringSurface {
  switch (value) {
    case "mainPicker":
    case "quick":
    case "nested":
    case "common":
    case "troop":
    case "ai":
      return value;
    default:
      throw new Error(`unknown authoring surface: ${value}`);
  }
}
