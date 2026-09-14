import { beforeAll, describe, expect, it } from "vitest";
import { validateProjectV4 } from "../src/project/io/shape";
import { ProjectFormatError } from "../src/project/io/errors";
import { own, spatialId, SpatialOperationError } from "../src/project/spatial/domain";
import { validateSpatialAuthoring } from "../src/project/spatial/guards";
import type { SpatialOverviewEntry } from "../src/project/spatial/types";
import type { Project } from "../src/project/types";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { geographyOutputContract } from "./support/spatialGeographyOutputContract";
import { overviewBinding, updateOverview, updateRoute } from "./support/spatialOverviewFixture";
import { fixtureDocument, replaceOccurrence } from "./support/spatialSpaceCompilerFixture";

let fixture: Project;
beforeAll(() => { fixture = geographyOutputContract(109).complete; });
const entryChange = (project: Project, update: (entry: SpatialOverviewEntry) => SpatialOverviewEntry) =>
  updateOverview(project, binding => ({ ...binding, overviewEntries: binding.overviewEntries?.map(update) }));
const eventChange = (project: Project, update: (event: Project["maps"][string]["events"][number]) => Project["maps"][string]["events"][number]) =>
  ({ ...project, maps: Object.fromEntries(Object.entries(project.maps).map(([id, map]) => [id, { ...map, events: map.events.map(update) }])) });

describe("exact overview boundary counterexamples", () => {
  const cases: readonly [string, (project: Project) => Project, string][] = [
    ["duplicate route claim", p => ({ ...p, spatialAuthoring: { ...fixtureDocument(p), connections: [
      ...fixtureDocument(p).connections, ...fixtureDocument(p).connections.map(link => ({ ...link, id: spatialId("another") }))] } }), "overviewRoute"],
    ["missing declaring owner", p => updateRoute(p, link => ({ ...link, overviewRoute: { occurrenceId: spatialId("absent"), localConnectionId: spatialId("road") } })), "absent"],
    ["non-overview declaring owner", p => updateRoute(p, link => ({ ...link, overviewRoute: { occurrenceId: link.from.occurrenceId, localConnectionId: spatialId("road") } })), "overview"],
    ["missing local route", p => updateRoute(p, link => ({ ...link, overviewRoute: { occurrenceId: geographyRoot, localConnectionId: spatialId("absent") } })), "localConnectionId"],
    ["reversed authored sides", p => updateRoute(p, link => ({ ...link, from: link.to, to: link.from })), "overviewRoute.from"],
    ["changed direction", p => updateRoute(p, link => ({ ...link, bidirectional: false })), "overviewRoute.bidirectional"],
    ["absent provenance cannot authorize bookkeeping", p => updateRoute(p, ({ overviewRoute: _route, ...link }) => link), "connectionIds"],
    ["omitted route bookkeeping", p => updateOverview(p, binding => ({ ...binding, connectionIds: [] })), "connectionIds"],
    ["foreign marker target", p => entryChange(p, entry => ({ ...entry, target: { ...entry.target, occurrenceId: geographyRoot } })), "connectionIds"],
    ["unknown port", p => entryChange(p, entry => ({ ...entry, target: { ...entry.target, portId: spatialId("absent") } })), "connectionIds"],
    ["offset marker", p => entryChange(p, entry => ({ ...entry, x: entry.x + 1 })), "overviewEntries.position"],
    ["rectangle exclusive edge", p => entryChange(p, entry => ({ ...entry, x: 32 })), "overviewEntries.position"],
    ["source ownership missing", p => updateOverview(p, binding => ({ ...binding, eventIds: [] })), "overviewEntries.eventId"],
    ["wrong entering ID", p => entryChange(p, entry => ({ ...entry, eventId: "absent" })), "overviewEntries.eventId"],
    ["wrong return ID", p => entryChange(p, entry => ({ ...entry, returnEventId: "absent" })), "overviewEntries.returnEventId"],
    ["duplicate marker", p => updateOverview(p, binding => ({ ...binding, overviewEntries: [...binding.overviewEntries ?? [], ...binding.overviewEntries ?? []] })), "overviewEntries.target"],
    ["wrong terrain extent", p => updateOverview(p, binding => ({ ...binding, rect: { ...binding.rect, width: 31 } })), "overviewEntries.rect"],
    ["redirected command", p => eventChange(p, event => ({ ...event, pages: event.pages?.map(page => ({ ...page,
      commands: page.commands.map(command => command.kind === "transfer" ? { ...command, x: command.x + 1 } : command) })) })), "commands"],
    ["contradictory pages", p => eventChange(p, event => ({ ...event, pages: [...event.pages ?? [], ...event.pages ?? []].map((page, index) => ({ ...page, id: `${page.id}:${index}` })) })), "page"],
    ["conditional page", p => eventChange(p, event => ({ ...event, pages: event.pages?.map(page => ({ ...page, conditions: [{ kind: "gold", op: ">=", amount: 0 }] })) })), "page"],
    ["uncommitted entering event", p => eventChange(p, event => ({ ...event, draft: { kind: "new" } })), "event"],
    ["conditional event", p => eventChange(p, event => ({ ...event, condition: { kind: "gold", op: ">=", amount: 0 } })), "event"],
    ["multi-cell automatic event", p => eventChange(p, event => ({ ...event, pages: event.pages?.map(page => ({ ...page, footprint: { width: 2, height: 2 } })) })), "page"],
    ["missing mapConnection", p => ({ ...p, mapConnections: [] }), "mapConnection"],
    ["duplicate mapConnection", p => ({ ...p, mapConnections: [...p.mapConnections ?? [], ...p.mapConnections ?? []] }), "mapConnection"],
    ["disabled navigation", p => ({ ...p, mapConnections: p.mapConnections?.map(link => ({ ...link, npcEnabled: false })) }), "mapConnection"],
    ["wrong mapConnection destination", p => ({ ...p, mapConnections: p.mapConnections?.map(link => ({ ...link, to: { ...link.to, x: link.to.x + 1 } })) }), "mapConnection"],
  ];
  it.each(cases)("rejects %s when complete output crosses full project IO", (_name, change, path) => {
    // Given: one independent corruption, without touching the shared fixture.
    const candidate = change(fixture);
    const before = JSON.stringify(candidate);
    // When: invoke the real project boundary.
    let failure: unknown;
    try { validateProjectV4({ ...candidate }); } catch (error) { failure = error; }
    // Then: a boundary error identifies the machine field; the caller is unchanged.
    expect(failure instanceof ProjectFormatError || failure instanceof SpatialOperationError).toBe(true);
    expect(failure instanceof Error ? failure.message : "").toContain(path);
    expect(JSON.stringify(candidate)).toBe(before);
  });

  it.each([undefined, null, {}, [], { occurrenceId: "x" }, { occurrenceId: "x", localConnectionId: "y", extra: 1 }].map(value => [value]))(
    "rejects malformed route metadata when its optional field is explicitly present: %j", value => {
      // Given
      const document = fixtureDocument(fixture);
      const input = { ...document, connections: document.connections.map(link => ({ ...link, overviewRoute: value })) };
      // When / Then: direct parser preserves the distinction between absence and undefined.
      expect(() => validateSpatialAuthoring(input)).toThrow(ProjectFormatError);
    });
  it.each([undefined, null, [], [{}]].map(value => [value]))("rejects malformed entries when present: %j", value => {
    // Given
    const document = fixtureDocument(fixture);
    const root = own(document.occurrences, geographyRoot);
    const input = { ...document, occurrences: { ...document.occurrences, [root.id]: { ...root,
      bindings: [{ ...overviewBinding(fixture), overviewEntries: value }] } } };
    // When / Then
    expect(() => validateSpatialAuthoring(input)).toThrow(ProjectFormatError);
  });
  it.each([[], undefined].map(value => [value]))("rejects entry fields on nonowners even when empty: %j", value => {
    // Given
    const document = fixtureDocument(fixture);
    const root = own(document.occurrences, geographyRoot);
    const binding = overviewBinding(fixture);
    const input = { ...document, occurrences: { ...document.occurrences, [root.id]: { ...root,
      bindings: [{ kind: "projection", mapId: binding.mapId, rect: binding.rect, ports: [], overviewEntries: value }] } } };
    // When / Then
    expect(() => validateSpatialAuthoring(input)).toThrow(ProjectFormatError);
  });
  it.each([false, true])("rejects duplicate ordinary target bindings in either array order: %s", reverse => {
    // Given
    const entry = overviewBinding(fixture).overviewEntries?.[0];
    if (!entry) throw new TypeError("Missing entry");
    const child = own(fixtureDocument(fixture).occurrences, entry.target.occurrenceId);
    const duplicate = { kind: "projection", mapId: overviewBinding(fixture).mapId, rect: overviewBinding(fixture).rect,
      ports: [{ portId: entry.target.portId, x: entry.x, y: entry.y }] } as const;
    const bindings = [...child.bindings, duplicate];
    const candidate = replaceOccurrence(fixture, { ...child, bindings: reverse ? bindings.reverse() : bindings });
    // When / Then
    expect(() => validateProjectV4({ ...candidate })).toThrowError(/ports: duplicate port binding/);
  });
});
