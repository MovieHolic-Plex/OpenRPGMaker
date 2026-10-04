/** Shared frontend routing for a private, whole-project Pi production run. No model or storage I/O. */
import { resolveAutonomy } from '../../src/ai/autonomyLevels';
import { composePiTask } from '../../src/ai/piAgent/executionRoute';
import { classifyPlainPiTurn, buildPiRunRequest } from '../../src/ai/piAgent/plainTurn';
import { requestsEmeraldMonsterGame } from '../../src/ai/piAgent/monsterGameRequest';
import type { PiAgentDoneEvent } from '../../src/ai/piAgent/protocol';
import type { Project } from '../../src/project/types';

export async function buildMonsterGameAssistantRequest(project: Project, task: string, provider: string, model: string, maxTurns = 300) {
  if (!requestsEmeraldMonsterGame(task)) throw Error('--mode monster-game requires an ordinary Pokemon/Emerald whole-game creation or repair request');
  const route = await classifyPlainPiTurn({ project, text: task, currentMapId: project.startMapId,
    selection: null, hasActivePlan: false, autonomy: resolveAutonomy('autonomous'), piTeam: false,
    declarer: () => { throw Error('Unexpected separate intent declaration for whole-game request'); } });
  const modelTask = composePiTask(task, route.intentNote);
  const role = { provider, model, thinkingLevel: 'high' as const };
  const request = buildPiRunRequest({ team: route.mode === 'team', readOnly: route.plan.readOnly,
    planOnly: route.plan.planOnly, applyMode: 'yolo', villageContract: route.plan.villageContract,
    brain: { providerId: provider, model, reasoningEffort: 'high' }, deep: role, writer: role,
    modelTask, executionTask: modelTask, mapIds: [], currentMapId: project.startMapId, project,
    scopedByUser: false, mapBundleMerge: false, maxTurns, initialToolNames: route.initialToolNames,
    preferCallerThinking: true, callerThinkingLevel: route.plan.thinkingLevel });
  return { request, routingAudit: route.routingAudit, mode: route.mode,
    method: 'Shared classifyPlainPiTurn → composePiTask → buildPiRunRequest; autonomous single producer, private YOLO execution (no separate Ultrabrain plan turn), entire project. Client NDJSON/apply/save/reload/player not exercised.' };
}

/** Missing production receipts must fail, even when the model claims success. */
export function monsterGameAssistantCompletionIssues(done: PiAgentDoneEvent): readonly string[] {
  return done.monsterGameProduction?.issues ?? ['Requested whole-game run returned no monsterGameProduction receipt.'];
}
