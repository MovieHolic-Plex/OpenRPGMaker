import { startSession } from "@/project/session";
import { findBlockingRuntimeEventAtInMap, initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";
import type { AcceptanceItemSnapshot } from "./assistantAcceptance";
import { resolveAcceptanceMap, type AcceptanceEvaluation } from "./assistantAcceptanceEvaluation";
import type { FunctionalCriterion, FunctionalEventTarget } from "./functionalAcceptance";
import { verifyNpcRewardsPlayable } from "./workItemOutcome";

function resolveEvent(map: GameMap, target: FunctionalEventTarget): GameEvent | undefined {
  const matches = map.events.filter(event => "eventId" in target ? event.id === target.eventId : (event.name ?? event.pages?.[0]?.name) === target.eventName);
  return matches.length === 1 ? matches[0] : undefined;
}
function activation(event: GameEvent): SceneStep[] {
  // Use real runtime page resolution at the interaction, never choose a favorable page.
  const triggers = new Set(event.pages?.map(page => page.trigger.kind) ?? [event.trigger.kind]);
  if (triggers.size !== 1) return [];
  if (triggers.has("action")) return [
    { kind: "walk", to: { x: event.x, y: event.y }, adjacent: true },
    { kind: "interact", eventId: event.id },
  ];
  if ((["touch", "playerTouch", "eventTouch"] as const).some(kind => triggers.has(kind))) {
    return [{ kind: "walk", to: { x: event.x, y: event.y } }];
  }
  return [];
}
export function evaluateFunctionalCriterion(criterion: FunctionalCriterion, input: AcceptanceEvaluation): AcceptanceItemSnapshot["evidence"][number] {
  const expected = JSON.stringify(criterion);
  const fail = (observed: string) => ({ expected, observed, passed: false });
  if (criterion.kind === "functionalUnresolved") return fail(criterion.reason);
  if (criterion.kind === "npcReward") {
    const verdict = verifyNpcRewardsPlayable(input.project, [criterion.requirement]);
    return verdict.ok ? { expected, observed: "Real NPC interaction: requested first delta and same-session repeat delta verified", passed: true } : fail(verdict.reason);
  }
  const { project } = input;
  const origin = resolveAcceptanceMap(project, criterion.target, input.bindings);
  if (!origin) return fail("Origin map missing or ambiguous; supply an exact map target");
  if (project.startMapId !== origin.id || project.startPos.x !== criterion.start.x || project.startPos.y !== criterion.start.y) {
    return fail(`Expected actual project entry ${origin.id} ${JSON.stringify(criterion.start)}, observed ${project.startMapId} ${JSON.stringify(project.startPos)}. This check cannot teleport to a convenient start.`);
  }
  if (!isPassable(project, origin, criterion.start.x, criterion.start.y)
    || findBlockingRuntimeEventAtInMap(project, origin, startSession(project, 1), initialRuntimeEventPositions(origin.events), criterion.start.x, criterion.start.y)) {
    return fail("Actual start is blocked; repair the entry before checking gameplay");
  }
  const steps: SceneStep[] = [];
  if (criterion.kind === "shopPurchase") {
    const seller = resolveEvent(origin, criterion.seller);
    if (!seller) return fail(`Seller missing or ambiguous: ${JSON.stringify(criterion.seller)}`);
    const records = [...project.database.items, ...project.database.equipment].filter(item => "id" in criterion.item ? item.id === criterion.item.id : item.name === criterion.item.name);
    const item = records.length === 1 ? records[0] : undefined;
    if (!item) return fail(`Stock reference missing or ambiguous: ${JSON.stringify(criterion.item)}`);
    const approach = activation(seller);
    if (approach.length === 0) return fail("Seller trigger is unsupported or ambiguous; use an action/touch interaction");
    steps.push({ kind: "snapshotRewards" }, ...approach,
      { kind: "purchase", eventId: seller.id, itemId: item.id, count: criterion.count, unitPrice: criterion.unitPrice },
      { kind: "expect", goldDelta: -criterion.unitPrice * criterion.count, inventoryDelta: { [item.id]: criterion.count }, interactionComplete: true });
  } else {
    const destination = resolveAcceptanceMap(project, criterion.destination, input.bindings);
    if (!destination || destination.id === origin.id) return fail("Round-trip destination must resolve to one distinct map");
    const outgoing = resolveEvent(origin, criterion.outgoing), returning = resolveEvent(destination, criterion.returning);
    if (!outgoing || !returning) return fail(`Missing or ambiguous authored transfers: outgoing=${JSON.stringify(criterion.outgoing)}, returning=${JSON.stringify(criterion.returning)}`);
    const out = activation(outgoing), back = activation(returning);
    if (!out.length || !back.length) return fail("Transfer triggers are unsupported or ambiguous; require authored action/touch transfers");
    steps.push(...out, { kind: "expect", mapId: destination.id, interactionComplete: true,
      lastTransfer: { fromMapId: origin.id, eventId: outgoing.id, toMapId: destination.id } },
    ...back, { kind: "expect", mapId: origin.id, interactionComplete: true,
      lastTransfer: { fromMapId: destination.id, eventId: returning.id, toMapId: origin.id } },
    { kind: "walk", to: criterion.start }, { kind: "expect", playerAt: { ...criterion.start, mapId: origin.id } });
  }
  return runFunctionalScene(project, origin.id, criterion.start, steps, expected);
}
function runFunctionalScene(project: Project, mapId: string, start: { x: number; y: number }, steps: SceneStep[], expected: string): AcceptanceItemSnapshot["evidence"][number] {
  const result = runSceneTest(project, { mapId, start, steps });
  return { expected, passed: result.ok, observed: result.ok
    ? JSON.stringify({ mapId: result.finalState.mapId, x: result.finalState.x, y: result.finalState.y, gold: result.finalState.gold,
      inventory: result.finalState.inventory, stepsRun: result.stepsRun, log: result.log })
    : `Step ${result.failedStepIndex}: ${result.failureReason}; actual map=${result.finalState.mapId} position=(${result.finalState.x},${result.finalState.y}) gold=${result.finalState.gold}` };
}
