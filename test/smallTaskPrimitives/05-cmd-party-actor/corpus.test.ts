/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { readCheckPath, resolveTarget, type CorpusCase, type FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import type { Command, LifeSkillRecord, Project } from "@/project/types";
import { expectKoreanSentence, loadFixture } from "../harness";

type PartyCase = CorpusCase & {
  setup?: { commands?: Command[]; lifeSkills?: LifeSkillRecord[] };
  refusalMessage?: string;
  receiptLabel?: string;
};

const file = join(dirname(fileURLToPath(import.meta.url)), "seeded-cases.json");
const cases: PartyCase[] = JSON.parse(readFileSync(file, "utf8"));
const fixtures = new Map<FixtureName, Project>();

function prepareFixture(entry: PartyCase): Project {
  const base = fixtures.get(entry.fixture) ?? loadFixture(entry.fixture);
  fixtures.set(entry.fixture, base);
  if (!entry.setup) return base;
  const { commands, lifeSkills } = entry.setup;
  const source = lifeSkills ? { ...base, database: { ...base.database, lifeSkills } } : base;
  if (!commands || entry.target.kind !== "event") return source;
  const { mapId = source.startMapId, eventId, pageId } = entry.target;
  const map = source.maps[mapId]!;
  const events = map.events.map(event => event.id === eventId
    ? { ...event, pages: event.pages?.map((page, index) => (pageId ? page.id === pageId : index === 0)
      ? { ...page, commands } : page) }
    : event);
  return { ...source, maps: { ...source.maps, [mapId]: { ...map, events } } };
}

// 공용 주자는 고정 픽스처만 사용합니다. 기존 줄과 생활 스킬이 필요한 사례는 이 시드로도 검수합니다.
it.each(cases)("$request", entry => {
  const before = prepareFixture(entry);
  const target = resolveTarget(before, entry.target);
  const apply = () => runPrimitive(before, target, entry.primitive, entry.args, entry.selection);
  if (entry.expectRefusal) {
    expect(apply).toThrow(entry.refusalMessage ?? PrimitiveError);
    return;
  }
  const result = apply();
  const label = entry.receiptLabel && `「${entry.receiptLabel}」`;
  if (label) expect(result.sentence).toContain(label);
  expect(result.sentence.length).toBeLessThanOrEqual(80);
  expectKoreanSentence(label ? result.sentence.replace(label, "「파티 이름」") : result.sentence, target);
  expect(entry.expect?.length).toBeGreaterThan(0);
  for (const check of entry.expect ?? []) {
    expect(readCheckPath(result.after, check.at), check.at).toEqual(check.equals);
  }
});
