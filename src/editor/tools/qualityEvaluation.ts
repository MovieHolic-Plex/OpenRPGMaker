import { isUnauthoredMap } from "@/ai/workItemOutcome";
import { lintTilesetPalettes } from "@/editor/lint/tilesetPaletteLint";
import { projectLint, type LintIssue } from "@/project/lint/projectLint";
import { buildStoryFlagUsageIndex } from "@/project/storyFlagUsage";
import { visitProjectCommands, type CommandOwnerKind, type NestedBranchKind } from "./commandTraversal";
import type { ToolDefinition } from "./types";
import type { Project } from "@/project/types/project";

const LIMITATIONS = [
  "Cannot measure fun.",
  "Cannot measure originality.",
  "Cannot measure emotional impact.",
  "Cannot measure pacing quality.",
  "Cannot determine a player's preferred difficulty.",
] as const;

/**
 * 만들기만 하고 비워 둔 맵 — `coverage.content.maps` 는 개수만 세므로 잔디 단색 맵도 "통과"였다.
 * (2026-08-28 실측: 30×30·20×20 단색 맵 2장이 남은 채 이 평가가 통과 판정을 냈다.)
 *
 * 시작 맵은 **warning** 으로 낮춘다 — `createBlankProject()` 가 만드는 20×15 단색 맵이 정확히
 * 이 상태라, error 로 올리면 새 프로젝트가 전부 `verdict.blocked` 가 되어 신호가 죽는다.
 * 저작 중 새로 만든 나머지 빈 맵은 명백한 결함이므로 error 로 막는다.
 */
function emptyMapIssues(project: Project): LintIssue[] {
  return Object.values(project.maps)
    .filter((map) => isUnauthoredMap(map))
    .map((map) => ({
      severity: map.id === project.startMapId ? ("warning" as const) : ("error" as const),
      code: "empty-map",
      mapId: map.id,
      message:
        `'${map.name}'(${map.id}) 은 만들기만 하고 지형·구조·이벤트가 하나도 없습니다` +
        `(${map.width}×${map.height}, 바닥 타일 1종, 상단 레이어 비어 있음, 이벤트 0).` +
        (map.id === project.startMapId ? " 시작 맵이라 차단하지는 않지만 플레이어가 빈 벌판에서 시작합니다." : ""),
    }));
}

const evaluateGameQuality: ToolDefinition = {
  name: "evaluate_game_quality",
  description: "프로젝트 전체의 객관적 무결성과 콘텐츠/분기/퀘스트/전투/엔딩/스토리 플래그 커버리지를 읽기 전용으로 평가한다. 엔딩 호출 누락은 차단한다. 정적 하한 검사이며 실제 완주 증거가 아니고, 주관적 점수는 만들지 않는다.",
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
    const emptyMaps = emptyMapIssues(project);
    const objectiveIssues = [...projectLint(project), ...emptyMaps];
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
    const namedEndingIds = new Set<string>();
    let hasConditionSelectedEnding = false;
    visitProjectCommands(project, ({ command, owner, branch, location }) => {
      kinds[command.kind] = (kinds[command.kind] ?? 0) + 1;
      ownerSeen.add(owner);
      if (branch) nestedBranches[branch] += 1;
      if (command.kind !== "triggerEnding") return;
      // Runtime pages replace legacy root commands; stale roots are not wiring.
      if (location.kind === "legacyEvent" && project.maps[location.mapId].events.some(
        event => event.id === location.eventId && (event.pages?.length ?? 0) > 0,
      )) return;
      if (command.endingId) namedEndingIds.add(command.endingId);
      else hasConditionSelectedEnding = true;
    });
    // Completion-only: intermediate define_ending writes must remain valid.
    // Presence is a lower bound, not proof that conditions/branches are reachable.
    const uninvokedEndings = (project.endings ?? []).filter(ending =>
      !hasConditionSelectedEnding && !namedEndingIds.has(ending.id),
    );
    objectiveIssues.push(...uninvokedEndings.map(ending => ({
      severity: "error" as const,
      code: "ending-uninvoked",
      message: `엔딩 '${ending.name}'(${ending.id})을 실행하는 triggerEnding 명령이 없습니다. ` +
        `define_ending과 setSwitch는 엔딩을 실행하지 않습니다. 도달 가능한 이벤트 commands에 ` +
        JSON.stringify({ kind: "triggerEnding", endingId: ending.id }) +
        ' 또는 조건 선택용 {"kind":"triggerEnding"}을 연결한 뒤 실제 완주를 검증하세요.',
    })));
    for (const owner of ownerSeen) commandOwners[owner as CommandOwnerKind] = 1;
    const usage = buildStoryFlagUsageIndex(project);
    const objectiveErrorCount = objectiveIssues.filter((issue) => issue.severity === "error").length;
    const walkthroughs = Array.isArray(args.walkthroughResults) ? args.walkthroughResults : [];
    const data = {
      verdict: { blocked: objectiveErrorCount > 0, objectiveErrorCount },
      integrity: {
        objective: { issues: objectiveIssues },
        palette: { issues: paletteIssues },
      },
      coverage: {
        commandOwners,
        nestedBranches,
        // emptyMaps: 맵 개수만으로는 "만들기만 한 잔디밭"과 저작된 맵이 구분되지 않는다.
        content: { maps: Object.keys(project.maps).length, emptyMaps: emptyMaps.length, events: Object.values(project.maps).reduce((count, map) => count + map.events.length, 0), commonEvents: project.commonEvents.length, commandKinds: Object.keys(kinds).length },
        branches: { choices: kinds.choices ?? 0, forks: kinds.fork ?? 0, loops: kinds.loop ?? 0 },
        quests: { defined: project.quests?.length ?? 0 },
        battles: { commands: kinds.battleProcessing ?? 0, troops: project.database.troops.length },
        endings: { defined: project.endings?.length ?? 0, triggers: kinds.triggerEnding ?? 0, uninvokedIds: uninvokedEndings.map(ending => ending.id) },
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
      // 검사한 축을 먼저 적는다 — "통과"만 남기면 보는 사람이 게임이 좋다는 판정으로 읽는다.
      // 주관 점수를 안 만든다는 사실은 data.limitations 와 프롬프트 정책이 이미 들고 있으므로 여기서 반복하지 않는다.
      summary: objectiveErrorCount > 0
        ? `무결성 점검(참조·빈 맵·미호출 엔딩): 오류 ${objectiveErrorCount}건${emptyMaps.length > 0 ? ` (빈 맵 ${emptyMaps.length}개 포함)` : ""}`
        : `무결성 점검(참조·빈 맵·미호출 엔딩): 이상 없음${emptyMaps.length > 0 ? ` — 다만 빈 맵 ${emptyMaps.length}개` : ""}`,
      data,
      issues: objectiveIssues,
    };
  },
};

export const QUALITY_EVALUATION_TOOLS: readonly ToolDefinition[] = [evaluateGameQuality];
