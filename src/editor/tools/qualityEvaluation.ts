import { lintTilesetPalettes } from "@/editor/lint/tilesetPaletteLint";
import { projectLint } from "@/project/lint/projectLint";
import { buildStoryFlagUsageIndex } from "@/project/storyFlagUsage";
import { normalizeProjectWorld, lintWorld } from "@/project/world";
import { visitProjectCommands, type CommandOwnerKind, type NestedBranchKind } from "./commandTraversal";
import type { ToolDefinition } from "./types";

const LIMITATIONS = [
  "Cannot measure fun.",
  "Cannot measure originality.",
  "Cannot measure emotional impact.",
  "Cannot measure pacing quality.",
  "Cannot determine a player's preferred difficulty.",
] as const;

const evaluateGameQuality: ToolDefinition = {
  name: "evaluate_game_quality",
  description: "프로젝트 전체의 객관적 무결성과 콘텐츠/분기/퀘스트/전투/엔딩/스토리 플래그 커버리지를 읽기 전용으로 평가한다. 주관적 점수는 만들지 않는다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      walkthroughResults: {
        type: "array",
        description: "선택적으로 공급한 기존 walkthrough 실행 결과",
        items: { type: "object", properties: { id: { type: "string" }, ok: { type: "boolean" }, stepsRun: { type: "integer" }, totalSteps: { type: "integer" }, failureReason: { type: "string" } }, required: ["id", "ok"] },
      },
    },
  },
  run(project, args) {
    const objectiveIssues = projectLint(project);
    const worldIssues = lintWorld(normalizeProjectWorld(project), project);
    const paletteIssues = lintTilesetPalettes(project);
    const commandOwners: Record<CommandOwnerKind, number> = { legacyEvent: 0, eventPage: 0, commonEvent: 0, troopPage: 0 };
    const nestedBranches: Record<NestedBranchKind, number> = {
      choiceOption: 0, choiceCancel: 0, forkThen: 0, forkElse: 0, loopBody: 0,
      shopTransaction: 0, shopFailure: 0, innNotEnough: 0,
      promotionSuccess: 0, promotionFailure: 0, evolutionSuccess: 0, evolutionFailure: 0,
      battleVictory: 0, battleDefeat: 0, battleEscape: 0,
    };
    const ownerSeen = new Set<string>();
    const kinds: Record<string, number> = {};
    visitProjectCommands(project, ({ command, owner, branch }) => {
      kinds[command.kind] = (kinds[command.kind] ?? 0) + 1;
      ownerSeen.add(owner);
      if (branch) nestedBranches[branch] += 1;
    });
    for (const owner of ownerSeen) commandOwners[owner as CommandOwnerKind] = 1;
    const usage = buildStoryFlagUsageIndex(project);
    const objectiveErrorCount = objectiveIssues.filter((issue) => issue.severity === "error").length;
    const walkthroughs = Array.isArray(args.walkthroughResults) ? args.walkthroughResults : [];
    const data = {
      verdict: { blocked: objectiveErrorCount > 0, objectiveErrorCount },
      integrity: {
        objective: { issues: objectiveIssues },
        world: { issues: worldIssues },
        palette: { issues: paletteIssues },
      },
      coverage: {
        commandOwners,
        nestedBranches,
        content: { maps: Object.keys(project.maps).length, events: Object.values(project.maps).reduce((count, map) => count + map.events.length, 0), commonEvents: project.commonEvents.length, commandKinds: Object.keys(kinds).length },
        branches: { choices: kinds.choices ?? 0, forks: kinds.fork ?? 0, loops: kinds.loop ?? 0 },
        quests: { defined: project.quests?.length ?? 0 },
        battles: { commands: kinds.battleProcessing ?? 0, troops: project.database.troops.length },
        endings: { defined: project.endings?.length ?? 0, triggers: kinds.triggerEnding ?? 0 },
      },
      storyFlags: {
        declared: (project.storyFlags ?? []).filter((flag) => flag.retired !== true).length,
        reads: usage.sites.filter((site) => site.access === "read").length,
        writes: usage.sites.filter((site) => site.access === "write").length,
        usage,
      },
      walkthroughs,
      limitations: LIMITATIONS,
    };
    return {
      summary: objectiveErrorCount > 0
        ? `게임 품질 평가 차단: 객관적 오류 ${objectiveErrorCount}건 (주관적 품질 점수 없음)`
        : "게임 품질 평가 통과: 객관적 차단 오류 없음 (주관적 품질 점수 없음)",
      data,
      issues: objectiveIssues,
    };
  },
};

export const QUALITY_EVALUATION_TOOLS: readonly ToolDefinition[] = [evaluateGameQuality];
