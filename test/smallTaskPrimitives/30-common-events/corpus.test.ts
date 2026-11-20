/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { readCheckPath, resolveTarget, type CorpusCase, type FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/30-common-events";
import type { Project } from "@/project/types";
import { expectKoreanSentence, expectUndoRestores, loadFixture } from "../harness";

// 공용 픽스처에는 공용 이벤트가 없으므로 이 코퍼스에서 사례별 초기 목록을 넣는다.
type CommonEventCorpusCase = CorpusCase & { setup?: Pick<Project, "commonEvents"> };

const file = resolve("harness-data/small-task-corpus/30-common-events.json");
const cases = JSON.parse(readFileSync(file, "utf8")) as CommonEventCorpusCase[];
const fixtures = new Map<FixtureName, Project>();

it("공용 이벤트 동작마다 한국어 요청 여덟 건과 거절 두 건이 있다", () => {
  for (const { id } of PRIMITIVES) {
    const examples = cases.filter(entry => entry.primitive === id);
    expect(new Set(examples.map(entry => entry.request)).size).toBeGreaterThanOrEqual(8);
    expect(examples.filter(entry => entry.expectRefusal)).toHaveLength(2);
  }
});

it.each(cases)("$request", async entry => {
  let fixture = fixtures.get(entry.fixture);
  if (!fixture) {
    fixture = loadFixture(entry.fixture);
    fixtures.set(entry.fixture, fixture);
  }
  const before = entry.setup ? { ...fixture, commonEvents: structuredClone(entry.setup.commonEvents) } : fixture;
  const target = resolveTarget(before, entry.target);
  const apply = () => runPrimitive(before, target, entry.primitive, entry.args, entry.selection);
  if (entry.expectRefusal) {
    expect(apply).toThrow(PrimitiveError);
    return;
  }
  const { after, sentence } = apply();
  expectKoreanSentence(sentence, target);
  for (const check of entry.expect ?? []) {
    const value = readCheckPath(after, check.at);
    if (Object.hasOwn(check, "equals")) expect(value, check.at).toEqual(check.equals);
    if (check.count !== undefined) expect(value, check.at).toHaveLength(check.count);
  }
  await expectUndoRestores(before, after, target);
}, 60_000);
