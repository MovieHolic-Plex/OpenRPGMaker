/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { readCheckPath, resolveTarget, type CorpusCase, type FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import type { Command, CommonEvent, EventPage, GameEvent, Project } from "@/project/types";
import { expectKoreanSentence, expectUndoRestores, loadFixture } from "../harness";

type FlowCase = CorpusCase & {
  refusalMessage?: string;
  setup: {
    commands: Command[];
    commonEvents: CommonEvent[];
    mapEvents: Pick<GameEvent, "id" | "name">[];
  };
};

const directory = dirname(fileURLToPath(import.meta.url));
const cases: FlowCase[] = JSON.parse(readFileSync(join(directory, "seeded-corpus.json"), "utf8"));
const fixtures = new Map<FixtureName, Project>();

function fixtureWithFlow({ fixture, setup }: FlowCase): Project {
  let project = fixtures.get(fixture);
  if (!project) {
    project = loadFixture(fixture);
    fixtures.set(fixture, project);
  }
  const mapId = "map_blank_start";
  const tilesetId = Object.keys(project.tilesets)[0]!;
  const map = { ...createBlankMap("흐름 검수", 20, 15, tilesetId), id: mapId };
  const page: EventPage = {
    id: "page_flow_corpus", name: "길 안내", trigger: { kind: "action" }, conditions: [],
    graphic: {}, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: structuredClone(setup.commands),
  };
  map.events = [
    { id: "ev_flow_corpus", name: "안내", x: 2, y: 2, trigger: page.trigger, commands: [], pages: [page] },
    ...setup.mapEvents.map((event, index) => ({ ...event, x: 3 + index, y: 2, trigger: page.trigger, commands: [] })),
  ];
  return {
    ...project,
    maps: { ...project.maps, [mapId]: map },
    startMapId: mapId,
    mapTree: { mapId, children: [] },
    commonEvents: structuredClone(setup.commonEvents),
  };
}

it.each(cases)("$request", async entry => {
  const { target: selector, primitive, args, expect: checks, expectRefusal, refusalMessage } = entry;
  const project = fixtureWithFlow(entry);
  const target = resolveTarget(project, selector);
  const apply = () => runPrimitive(project, target, primitive, args);
  if (expectRefusal) {
    const map = project.maps.map_blank_start;
    const events = structuredClone(map.events);
    const commonEvents = structuredClone(project.commonEvents);
    expect(apply).toThrow(PrimitiveError);
    if (refusalMessage) expect(apply).toThrow(refusalMessage);
    expect(project.maps.map_blank_start.events).toEqual(events);
    expect(project.commonEvents).toEqual(commonEvents);
    return;
  }
  const { after, sentence } = apply();
  expectKoreanSentence(sentence, target);
  expect(checks?.length).toBeGreaterThan(0);
  for (const check of checks ?? []) {
    expect(Object.hasOwn(check, "equals"), check.at).toBe(true);
    expect(readCheckPath(after, check.at), check.at).toEqual(check.equals);
  }
  await expectUndoRestores(project, after, target);
});
