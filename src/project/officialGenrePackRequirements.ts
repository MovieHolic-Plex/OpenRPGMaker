import type { CommandKind } from "@/project/commandKindRegistry";
import { COMMAND_GUARANTEES, type CommandContext } from "@/project/commandGuaranteeRegistry";
import type { Project } from "@/project/types";
import { projectLint } from "@/project/lint/projectLint";
import { indexAuthoredCommands } from "@/project/authoredCommandIndex";
import type { OfficialGenrePackId } from "@/project/officialGenrePackIds";
import {
  evaluateGenrePackReadiness,
  evaluateGenrePackReadinessMatrix,
  type GenrePackAssertionReceipt,
  type GenrePackReadinessMatrix,
  type GenrePackReadinessReceipt,
  type GenrePackRequirement,
} from "@/project/genrePackReadiness";

export { OFFICIAL_GENRE_PACK_IDS } from "@/project/officialGenrePackIds";
export type { OfficialGenrePackId } from "@/project/officialGenrePackIds";
export type OfficialGenrePackRequirement = GenrePackRequirement<OfficialGenrePackId, CommandKind, CommandContext>;

const REQUIRED_ASSERTIONS = [
  "headless-journey",
  "browser-runtime-state",
  "save-load-roundtrip",
  "web-export-smoke",
] as const;

export const OFFICIAL_GENRE_PACK_REQUIREMENTS: Readonly<Record<OfficialGenrePackId, OfficialGenrePackRequirement>> = {
  "adventure-jrpg": {
    packId: "adventure-jrpg",
    label: "Adventure JRPG",
    requiredCommands: commands("map", ["text", "choices", "transfer", "battleProcessing", "changeItem", "ending"]),
    requiredAssertions: REQUIRED_ASSERTIONS,
  },
  "monster-collect": {
    packId: "monster-collect",
    label: "Monster collection",
    requiredCommands: commands("map", ["battleProcessing", "giveMonster", "moveMonster", "evolveMonster"]),
    requiredAssertions: REQUIRED_ASSERTIONS,
    blockingLintCodePrefixes: ["opt-in:monster", "opt-in:genre-monster"],
  },
  "horror-chase": {
    packId: "horror-chase",
    label: "Horror",
    requiredCommands: commands("map", ["setLighting", "checkpointSave", "killPlayer", "triggerEnding"]),
    requiredAssertions: REQUIRED_ASSERTIONS,
  },
  "story-cutscene": {
    packId: "story-cutscene",
    label: "Story cutscene",
    requiredCommands: commands("map", ["text", "showPicture", "cutsceneControl", "triggerEnding"]),
    requiredAssertions: REQUIRED_ASSERTIONS,
  },
  "farm-life": {
    packId: "farm-life",
    label: "Farm life",
    requiredCommands: commands("map", ["advanceTime", "advanceCropGrowth", "sleepUntilMorning", "changeFriendship"]),
    requiredAssertions: REQUIRED_ASSERTIONS,
    blockingLintCodePrefixes: ["opt-in:farm", "opt-in:genre-farm"],
  },
};

function commands(
  context: CommandContext,
  commandIds: readonly CommandKind[]
): readonly Readonly<{ commandId: CommandKind; context: CommandContext }>[] {
  return commandIds.map((commandId) => ({ commandId, context }));
}

export function evaluateOfficialGenrePackReadiness(
  project: Project,
  packId: OfficialGenrePackId,
  assertionReceipt?: GenrePackAssertionReceipt<OfficialGenrePackId>,
  expectedProjectRevision?: string
): GenrePackReadinessReceipt<OfficialGenrePackId, CommandKind, CommandContext> {
  const authoredCommands = indexAuthoredCommands(project);
  return evaluateGenrePackReadiness({
    requirement: OFFICIAL_GENRE_PACK_REQUIREMENTS[packId],
    resolveCommandSupport: (commandId, context) => COMMAND_GUARANTEES[commandId].supportByContext[context],
    resolveAuthoredCommand: (commandId, context) => authoredCommands[context].has(commandId),
    lintIssues: projectLint(project),
    assertionReceipt,
    expectedProjectRevision,
  });
}

export function evaluateOfficialGenrePackReadinessMatrix(
  project: Project,
  assertionReceipts?: Readonly<Partial<Record<OfficialGenrePackId, GenrePackAssertionReceipt<OfficialGenrePackId>>>>,
  expectedProjectRevision?: string
): GenrePackReadinessMatrix<OfficialGenrePackId, CommandKind, CommandContext> {
  const authoredCommands = indexAuthoredCommands(project);
  return evaluateGenrePackReadinessMatrix({
    requirements: OFFICIAL_GENRE_PACK_REQUIREMENTS,
    resolveCommandSupport: (commandId, context) => COMMAND_GUARANTEES[commandId].supportByContext[context],
    resolveAuthoredCommand: (commandId, context) => authoredCommands[context].has(commandId),
    lintIssues: projectLint(project),
    assertionReceipts,
    expectedProjectRevision,
  });
}
