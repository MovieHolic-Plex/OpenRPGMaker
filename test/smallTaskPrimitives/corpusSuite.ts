import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { resolveTarget, readCheckPath, type Check, type CorpusCase, type FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import type { Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectKoreanSentence, expectUndoRestores, loadFixture, setupCorpusProject } from "./harness";

// 검수 자료(harness-data/small-task-corpus) 사례 3,700여 건을 한 파일에서 돌리면 CI 한 워커가 18분 넘게 붙잡혔다
// (test-diet 2026-11-25, 1,105 s). vitest 는 파일 안을 나눠 돌리지 않으므로 유닛 묶음을 조각 파일 다섯으로 나눈다 —
// corpus.test.ts(조각 1 + 자료 자체 검사)와 corpus-2..5.test.ts. 사례·이름은 그대로이고 사례마다 한 번씩만 돈다.
// 묶음은 사례 수로 맞췄고 maou 픽스처(짓는 데 30 s 넘게)를 쓰는 유닛은 조각 1·2 에만 모았다.
export const CORPUS_SHARDS: readonly (readonly string[])[] = [
  ["01-cmd-dialogue", "13-m2-screen-sound", "15-cond-state-party", "20-db-enemies-troops", "26-npc-dialogue"],
  ["07-cmd-staging", "09-cmd-move-system", "16-cond-world-social", "23-map-structure", "29-event-movement"],
  ["00-core", "06-cmd-monster-battle", "10-m2-actor-battle", "11-m2-system-menu", "14-m2-modern-logic", "17-db-actors-classes", "27-quests"],
  ["04-cmd-items-shops", "05-cmd-party-actor", "21-db-life-farm", "22-map-tiles", "24-event-structure", "28-project-data", "30-common-events"],
  ["02-cmd-flow", "03-cmd-switch-var", "08-cmd-time-social", "12-m2-map-move", "18-db-skills-states", "19-db-items-equipment", "25-event-presets"],
];

// Vitest transforms import.meta.url into a browser URL in happy-dom.
const directory = resolve("harness-data/small-task-corpus");
export const corpusFiles = readdirSync(directory).filter(file => file.endsWith(".json")).sort();
const assigned = CORPUS_SHARDS.flat().map(unit => `${unit}.json`).sort();
// 새 유닛 파일을 어느 조각에도 넣지 않으면(또는 두 번 넣으면) 그 사례가 조용히 빠지거나 두 번 돈다 — 파일 로드에서 막는다.
if (!jsonEqual(assigned, corpusFiles)) {
  throw new Error(`검수 자료 유닛과 CORPUS_SHARDS 가 다르다: 자료=${corpusFiles.join(",")} 조각=${assigned.join(",")}`);
}

export function evaluateCheck(project: unknown, check: Check) {
  const value = readCheckPath(project, check.at);
  expect(["equals", "includes", "count"].some(key => Object.hasOwn(check, key)), check.at).toBe(true);
  if (Object.hasOwn(check, "equals")) expect(value, check.at).toEqual(check.equals);
  if (Object.hasOwn(check, "includes")) {
    const includes = typeof value === "string" && typeof check.includes === "string" ? value.includes(check.includes)
      : Array.isArray(value) && value.some(entry => jsonEqual(entry, check.includes));
    expect(includes, check.at).toBe(true);
  }
  if (check.count !== undefined) {
    expect(Array.isArray(value) || typeof value === "string" ? value.length : undefined, check.at).toBe(check.count);
  }
}

function expectCorpusRefusal(apply: () => unknown, reason?: string): void {
  expect(apply).toThrow(PrimitiveError);
  if (reason) expect(apply).toThrow(new RegExp(reason, "u"));
}

/** 조각 shardIndex(0부터)의 유닛 사례를 등록한다. OPRN_CORPUS_UNIT 이 있으면 그 유닛만(그 유닛이 든 조각 파일에서) 돈다. */
export function registerCorpusShard(shardIndex: number): void {
  const shardFiles = (CORPUS_SHARDS[shardIndex] ?? []).map(unit => `${unit}.json`);
  const unit = process.env.OPRN_CORPUS_UNIT;
  if (unit !== undefined && !corpusFiles.includes(`${unit}.json`)) throw new Error(`검수 자료 유닛을 찾을 수 없어요: ${unit}`);
  const selectedFiles = unit === undefined ? shardFiles : shardFiles.filter(file => file === `${unit}.json`);
  if (!selectedFiles.length) {
    it.skip(`OPRN_CORPUS_UNIT=${unit} 은 다른 조각 파일에 있다`, () => {});
    return;
  }
  const suites = selectedFiles.map(file => {
    const cases: CorpusCase[] = JSON.parse(readFileSync(join(directory, file), "utf8"));
    if (!Array.isArray(cases)) throw new Error(`검수 자료는 배열이어야 합니다: ${file}`);
    return { file, cases };
  });

  const fixtures = new Map<FixtureName, Project>();
  beforeAll(() => {
    const names = new Set(suites.flatMap(({ cases }) => cases.map(entry => entry.fixture)));
    for (const name of names) {
      const fixture = loadFixture(name);
      // Match the editor's normalization before the first case reads or hashes a command.
      ensureSwitchVariableSlots(fixture);
      removeLegacySpriteReferences(fixture);
      fixtures.set(name, fixture);
    }
  }, 600_000);

  for (const { file, cases } of suites) {
    if (!cases.length) continue;
    describe(file, () => {
      for (const entry of cases) {
        it(entry.request, async () => {
          const fixture = fixtures.get(entry.fixture)!;
          const before = setupCorpusProject(fixture, entry);
          const target = resolveTarget(before, entry.target);
          const apply = () => runPrimitive(before, target, entry.primitive, entry.args, entry.selection);
          const seededSuccess = entry.expectRefusal && entry.expect?.length && (entry.setup || entry.seed);
          if (seededSuccess) {
            expectCorpusRefusal(() => runPrimitive(fixture, resolveTarget(fixture, entry.target), entry.primitive, entry.args, entry.selection),
              entry.refusalMessage);
          } else if (entry.expectRefusal) {
            expectCorpusRefusal(apply, entry.refusalMessage);
            return;
          }
          const { after, sentence } = apply();
          expectKoreanSentence(sentence, target);
          for (const check of entry.expect ?? []) evaluateCheck(after, check);
          await expectUndoRestores(before, after, target);
        });
      }
    });
  }
}
