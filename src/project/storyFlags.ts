import type { Project, StoryFlagDef, StoryFlagKind, SwitchDef, VariableDef } from "@/project/types";

export const STORY_FLAG_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type StoryFlagTargetKind = StoryFlagKind;

export function isStoryFlagKind(value: unknown): value is StoryFlagKind {
  return value === "switch" || value === "variable";
}

export function cleanStoryFlagId(value: string): string {
  return value.trim().toLowerCase();
}

export function storyFlags(project: Project, options: { readonly includeRetired?: boolean } = {}): readonly StoryFlagDef[] {
  const flags = project.storyFlags ?? [];
  if (options.includeRetired) return flags;
  return flags.filter((flag) => flag.retired !== true);
}

export function storyFlagById(project: Project, id: string, options: { readonly includeRetired?: boolean } = {}): StoryFlagDef | undefined {
  const clean = cleanStoryFlagId(id);
  return (project.storyFlags ?? []).find((flag) => flag.id === clean && (options.includeRetired || flag.retired !== true));
}

export function storyFlagForTarget(
  project: Project,
  kind: StoryFlagKind,
  targetId: string,
  options: { readonly includeRetired?: boolean } = {}
): StoryFlagDef | undefined {
  return (project.storyFlags ?? []).find((flag) =>
    flag.kind === kind &&
    flag.targetId === targetId &&
    (options.includeRetired || flag.retired !== true)
  );
}

export function storyFlagTargetKey(kind: StoryFlagKind, targetId: string): string {
  return `${kind}:${targetId}`;
}

export function recordsForStoryFlagKind(project: Project, kind: StoryFlagKind): readonly (SwitchDef | VariableDef)[] {
  return kind === "switch" ? project.switches : project.variables;
}

export function targetOrdinal(project: Project, kind: StoryFlagKind, targetId: string): number | undefined {
  const records = recordsForStoryFlagKind(project, kind);
  const index = records.findIndex((record) => record.id === targetId);
  return index >= 0 ? index + 1 : undefined;
}

export function targetShortLabel(project: Project, kind: StoryFlagKind, targetId: string): string {
  const ordinal = targetOrdinal(project, kind, targetId);
  const prefix = kind === "switch" ? "S" : "V";
  return ordinal ? `${prefix}${ordinal}` : `${prefix}?${targetId}`;
}

export function storyFlagOptionLabel(
  project: Project,
  kind: StoryFlagKind,
  record: { readonly id: string; readonly name: string },
  index: number
): string {
  const base = `${String(index + 1).padStart(4, "0")}: ${record.name || "(이름 없음)"}`;
  const flag = storyFlagForTarget(project, kind, record.id);
  return flag ? `${base} · ${flag.id}` : base;
}

export function storyFlagListLabel(project: Project, flag: StoryFlagDef): string {
  const target = targetShortLabel(project, flag.kind, flag.targetId);
  const retired = flag.retired === true ? " retired" : "";
  return `${target} · ${flag.id}${retired}`;
}

export function normalizeStoryFlagTargetId(
  project: Project,
  kind: StoryFlagKind,
  rawTargetId: string
): string | undefined {
  const trimmed = rawTargetId.trim();
  if (!trimmed) return undefined;
  const records = recordsForStoryFlagKind(project, kind);
  if (records.some((record) => record.id === trimmed)) return trimmed;
  const prefix = kind === "switch" ? "S" : "V";
  const ordinalMatch = trimmed.match(new RegExp(`^${prefix}?(\\d+)$`, "i"));
  if (!ordinalMatch) return undefined;
  const ordinal = Number(ordinalMatch[1]);
  if (!Number.isInteger(ordinal) || ordinal < 1) return undefined;
  return records[ordinal - 1]?.id;
}

export function normalizeStoryFlagTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = [...new Set(value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0))];
  return tags.length > 0 ? tags : undefined;
}
