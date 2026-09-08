import { beforeAll, describe, expect, it } from "vitest";
import { createInterpreter } from "../src/player/interpreter";
import { pointRect } from "../src/project/footprint";
import { deserialize, serialize } from "../src/project/io";
import { ProjectFormatError } from "../src/project/io/errors";
import { findEventOverlappingRect } from "../src/project/runtimeEventState";
import type { PlaySessionLike } from "../src/project/sessionRuntimeTypes";
import { own } from "../src/project/spatial/domain";
import type { EventPage, Project } from "../src/project/types";
import { worldEntryOutput } from "./support/spatialOverviewFixture";

let fixture: Project;
beforeAll(() => { fixture = deserialize(serialize(worldEntryOutput())); });
const cases = (["entering", "returning"] as const).flatMap(side =>
  [true, false].flatMap(first => (["single", "later", "earlier-conditional"] as const).map(pages => ({ side, first, pages }))));

function competingProject(testCase: typeof cases[number]) {
  const pair = fixture.mapConnections?.[testCase.side === "entering" ? 0 : 1];
  if (!pair) throw new TypeError("Missing fixture pair");
  const map = own(fixture.maps, pair.from.mapId);
  const event = map.events.find(event => event.id === pair.id);
  const page = event?.pages?.[0];
  if (!event || !page) throw new TypeError("Missing fixture event page");
  const destination = { mapId: pair.to.mapId, x: pair.to.x + 1, y: pair.to.y };
  const automatic: EventPage = { ...page, id: "neighbor-auto", footprint: { width: 2, height: 1 },
    commands: [{ kind: "transfer", ...destination }] };
  const action: EventPage = { ...page, id: "neighbor-action", trigger: { kind: "action" } };
  let pages: EventPage[];
  switch (testCase.pages) {
    case "single": pages = [automatic]; break;
    case "later": pages = [action, automatic]; break;
    case "earlier-conditional": pages = [
      { ...automatic, conditions: [{ kind: "gold", op: ">=", amount: 1 }] },
      { ...action, conditions: [{ kind: "gold", op: "<=", amount: 0 }] },
    ]; break;
    default: testCase.pages satisfies never; throw new TypeError("Unknown page variant");
  }
  const competitor = { ...event, id: "competing-neighbor", x: event.x - 1, pages };
  const candidate = { ...fixture, maps: { ...fixture.maps, [map.id]: { ...map,
    events: testCase.first ? [competitor, ...map.events] : [...map.events, competitor] } } };
  const session: PlaySessionLike = { currentMapId: map.id, x: event.x, y: event.y, gold: 1,
    switches: {}, variables: {}, flags: {}, timers: {}, inventory: {}, partyActorIds: [],
    actorExperience: {}, actorLevels: {}, actorEquipment: {}, actorVitals: {} };
  return { candidate, pair, competitor, destination, session };
}

describe("overview automatic page footprint competition", () => {
  it.each(cases)("reproduces $side runtime selection when neighbor first=$first pages=$pages", testCase => {
    // Given: a fully loaded project, with only an unmanaged neighboring event added.
    const { candidate, pair, competitor, destination, session } = competingProject(testCase);
    const map = own(candidate.maps, pair.from.mapId);
    const positions = Object.fromEntries(map.events.map(event => [event.id, { x: event.x, y: event.y }]));
    // When: production touch hit-testing selects the event and the real interpreter executes it.
    const selected = findEventOverlappingRect(candidate, map, session, positions, pointRect(pair.from.x, pair.from.y), "playerTouch");
    if (!selected?.page) throw new TypeError("Missing selected transfer page");
    const transfer = createInterpreter(selected.page.commands, session, candidate).start();
    // Then: array order changes the executed destination despite distinct event origins.
    expect(selected.event.id).toBe(testCase.first ? competitor.id : pair.id);
    expect(transfer).toMatchObject({ kind: "transfer", ...(testCase.first ? destination : pair.to) });
  });

  it.each(cases)("rejects $side ambiguity through public IO when neighbor first=$first pages=$pages", testCase => {
    // Given: the same runtime-faithful counterexample, preserving exact owned pair bytes.
    const { candidate, pair } = competingProject(testCase);
    const raw = JSON.stringify(candidate);
    // When: the public project boundary parses the candidate.
    let failure: unknown;
    try { deserialize(raw); } catch (error) { failure = error; }
    // Then: both array orders reject at this exact pair event, without mutating the caller.
    expect(failure).toBeInstanceOf(ProjectFormatError);
    expect(failure instanceof Error ? failure.message : "").toContain(`spatialAuthoring.overviewEntries.${pair.id}.event`);
    expect(JSON.stringify(candidate)).toBe(raw);
  });

  it("retains the effective unit footprint when legacy root metadata is present", () => {
    // Given: generated pages have no footprint; root metadata is not runtime footprint authority.
    const candidate = { ...fixture, maps: Object.fromEntries(Object.entries(fixture.maps).map(([id, map]) =>
      [id, { ...map, events: map.events.map(event => ({ ...event, footprint: { width: 3, height: 3 } })) }])) };
    // When: the full project is reloaded.
    const loaded = deserialize(JSON.stringify(candidate));
    // Then: the exact associated transfer projections survive; no speculative root-footprint rule applies.
    expect(loaded.mapConnections).toEqual(fixture.mapConnections);
  });
});
