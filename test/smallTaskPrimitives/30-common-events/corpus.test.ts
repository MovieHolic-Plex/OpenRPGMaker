/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { readCheckPath, resolveTarget, type CorpusCase, type FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/30-common-events";
import type { Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectKoreanSentence, expectUndoRestores, loadFixture } from "../harness";

const file = resolve(dirname(fileURLToPath(import.meta.url)), "../../../harness-data/small-task-corpus/30-common-events.json");
const cases = JSON.parse(readFileSync(file, "utf8")) as CorpusCase[];
const fixtures = new Map<FixtureName, Project>();

it("공용 이벤트 동작마다 한국어 요청 여덟 건 이상과 검증할 거절 사유 두 건 이상이 있다", () => {
  for (const { id } of PRIMITIVES) {
    const examples = cases.filter(entry => entry.primitive === id);
    expect(new Set(examples.map(entry => entry.request)).size).toBeGreaterThanOrEqual(8);
    const refusals = examples.filter(entry => entry.expectRefusal);
    expect(refusals.length).toBeGreaterThanOrEqual(2);
    expect(refusals.every(entry => entry.refusalMessage)).toBe(true);
  }
});

it.each(cases)("$request", async entry => {
  let fixture = fixtures.get(entry.fixture);
  if (!fixture) {
    fixture = loadFixture(entry.fixture);
    fixtures.set(entry.fixture, fixture);
  }
  const initialEvents = entry.setup?.commonEvents ?? fixture.commonEvents;
  const before = { ...fixture, commonEvents: structuredClone(initialEvents) };
  const target = resolveTarget(before, entry.target);
  const apply = () => runPrimitive(before, target, entry.primitive, entry.args, entry.selection);
  if (entry.expectRefusal) {
    expect(apply).toThrow(expect.objectContaining({ name: "PrimitiveError", message: expect.stringContaining(entry.refusalMessage!) }));
    expect(before.commonEvents).toEqual(initialEvents);
    return;
  }
  const { after, sentence } = apply();
  expect(before.commonEvents).toEqual(initialEvents);
  expect({ ...after, commonEvents: before.commonEvents }).toEqual(before);
  expectKoreanSentence(sentence, target);
  expect(entry.expect?.length).toBeGreaterThan(0);
  for (const check of entry.expect ?? []) {
    const value = readCheckPath(after, check.at);
    expect(["equals", "includes", "count"].some(key => Object.hasOwn(check, key)), check.at).toBe(true);
    if (Object.hasOwn(check, "equals")) expect(value, check.at).toEqual(check.equals);
    if (Object.hasOwn(check, "includes")) {
      const includes = typeof value === "string" && typeof check.includes === "string" ? value.includes(check.includes)
        : Array.isArray(value) && value.some(item => jsonEqual(item, check.includes));
      expect(includes, check.at).toBe(true);
    }
    if (check.count !== undefined) expect(value, check.at).toHaveLength(check.count);
  }
  await expectUndoRestores(before, after, target);
}, 60_000);
