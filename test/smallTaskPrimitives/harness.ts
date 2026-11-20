import { expect } from "vitest";
import { getMapEditHistoryDepth, resetMapEditHistory } from "@/editor/mapEditHistory";
import { commitSmallTask, smallTaskBase } from "@/editor/smallTask/history";
import type { FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import type { PrimitiveContext } from "@/editor/smallTask/primitives/types";
import { dbTarget as findDbTarget, mapTarget as findMapTarget, type SmallTaskCollection, type SmallTaskTarget } from "@/editor/smallTask/target";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import { createMaouKonbiniFlagshipDemo } from "@/project/flagship/maouKonbini";
import { runtimeEventViewById } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";

export function loadFixture(fixture: FixtureName): Project {
  switch (fixture) {
    case "blank": return createEmptyToolProject();
    case "built": return buildFixture("built");
    case "maou": return createMaouKonbiniFlagshipDemo().project;
    default: throw new Error("검수 자료 이름을 확인해 주세요.");
  }
}

export function eventTarget(project: Project, mapId: string, eventId: string, pageId?: string) {
  const target = findMapTarget(project, mapId, eventId, pageId);
  if (target?.kind !== "event") throw new Error("검수 대상 이벤트를 찾을 수 없어요.");
  return target;
}

export function dbTarget(project: Project, collection: SmallTaskCollection, id: string) {
  const target = findDbTarget(project, collection, id);
  if (target?.kind !== "dbEntry") throw new Error("검수 대상 자료집 항목을 찾을 수 없어요.");
  return target;
}

export function mapTarget(project: Project, mapId = project.startMapId) {
  const target = findMapTarget(project, mapId);
  if (target?.kind !== "map") throw new Error("검수 대상 맵을 찾을 수 없어요.");
  return target;
}

export function expectApplies(project: Project, target: SmallTaskTarget, id: string, args: Record<string, unknown>, selection?: PrimitiveContext["selection"]) {
  const result = runPrimitive(project, target, id, args, selection);
  expectKoreanSentence(result.sentence, target);
  return result;
}

export function expectRefused(
  project: Project, target: SmallTaskTarget, id: string, args: Record<string, unknown>,
  reason: RegExp = /범위 밖/u, selection?: PrimitiveContext["selection"],
): void {
  const apply = () => runPrimitive(project, target, id, args, selection);
  expect(apply).toThrow(PrimitiveError);
  expect(apply).toThrow(reason);
}

export function expectKoreanSentence(sentence: string, target?: SmallTaskTarget) {
  expect(sentence).toMatch(/[가-힣]/u);
  expect(sentence.length).toBeLessThanOrEqual(80);
  expect(sentence).not.toMatch(/[\r\n{}\[\]]|\b(?:[a-z][a-z\d]*_[\w.-]+|[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})\b/iu);
  const ids = target?.kind === "dbEntry" ? [target.id]
    : target?.kind === "event" ? [target.mapId, target.eventId, target.pageId] : [target?.mapId];
  const tokens = sentence.match(/[\p{L}\p{N}_-]+/gu) ?? [];
  for (const id of ids) if (id && /^[a-z][\w-]*$/iu.test(id)) expect(tokens).not.toContain(id);
}

export async function expectUndoRestores(before: Project, after: Project, target: SmallTaskTarget) {
  store.replaceProject(before);
  resetMapEditHistory();
  try {
    const live = store.getCurrent();
    const base = smallTaskBase(live, target);
    expect(jsonEqual(base, before)).toBe(true);
    const receipt = commitSmallTask(live, base, after, target);
    if (jsonEqual(before, after)) {
      expect(receipt).toBeNull();
      expect(getMapEditHistoryDepth()).toBe(0);
    } else {
      expect(receipt).not.toBeNull();
      expect(getMapEditHistoryDepth()).toBe(1);
      expect(jsonEqual(store.getCurrent(), after)).toBe(true);
      expect(await receipt?.undo(async () => false)).toBe(true);
      expect(getMapEditHistoryDepth()).toBe(0);
    }
    expect(jsonEqual(store.getCurrent(), before)).toBe(true);
  } finally {
    resetMapEditHistory();
  }
}

/** Run up to the first player-facing stop. The caller can resume choices with the returned interpreter. */
export function runHeadless(project: Project, mapId: string, eventId: string) {
  const map = project.maps[mapId];
  if (!map) throw new Error("플레이할 맵을 찾을 수 없어요.");
  const session = startSession(project, 1);
  session.currentMapId = mapId;
  const event = runtimeEventViewById(project, map, session, {}, eventId);
  if (!event?.page) throw new Error("플레이할 이벤트 페이지를 찾을 수 없어요.");
  const interpreter = createInterpreter(event.page.commands, session, project, { currentEventId: eventId });
  const step: StepResult = interpreter.start();
  return { session, interpreter, step };
}
