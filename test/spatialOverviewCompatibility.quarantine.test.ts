import { beforeAll, describe, expect, it } from "vitest";
import { spatialRasterDigest } from "../src/editor/spatial/compilerValidation";
import { validateOverviewAccess } from "../src/editor/spatial/overviewEntries";
import { deserialize, serialize, serializePretty } from "../src/project/io";
import { own, requireOccurrenceAssociations } from "../src/project/spatial/domain";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import type { Project } from "../src/project/types";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { geographyOutputContract } from "./support/spatialGeographyOutputContract";
import { overviewBinding, updateOverview, updateRoute } from "./support/spatialOverviewFixture";

// Captured by the unmodified task10 witness/digest implementation, not computed from the candidate.
const OLD_DIGEST = "814d71d358e58955d64e434328faba7269d67953f8b9b1f8f56952c52bbc34a1";
let fixture: Project;
beforeAll(() => { fixture = geographyOutputContract(109).complete; });
describe("overview raster compatibility", () => {
  it.each([serialize, serializePretty])("preserves literal old digest bytes when old absent fields reload through %s", save => {
    // Given: the historical incomplete diagnostic record is readable, not complete geography output.
    const old = updateRoute(updateOverview(fixture, ({ overviewEntries: _entries, ...binding }) => ({ ...binding, connectionIds: [] })),
      ({ overviewRoute: _route, ...link }) => link);
    // When
    const loaded = deserialize(save(old));
    // Then: no migration/backfill and identical old digest bytes.
    const binding = overviewBinding(loaded);
    expect(Object.hasOwn(binding, "overviewEntries")).toBe(false);
    expect(loaded.spatialAuthoring?.connections.every(link => !Object.hasOwn(link, "overviewRoute"))).toBe(true);
    expect(spatialRasterDigest(own(loaded.maps, binding.mapId), binding)).toBe(OLD_DIGEST);
  });
  it("requires an explicit route association before accepting old output as complete", () => {
    // Given: backward-readable old output has no route provenance or entry associations.
    const old = updateRoute(updateOverview(fixture, ({ overviewEntries: _entries, ...binding }) => ({ ...binding, connectionIds: [] })),
      ({ overviewRoute: _route, ...link }) => link);
    // When / Then: completeness is stricter than historical readability.
    expect(() => validateOverviewAccess(old, geographyRoot, { mapId: overviewBinding(old).mapId, x: 2, y: 8 }))
      .toThrowError(expect.objectContaining({ code: "connection" }));
  });
  it("rejects unsupported one-way walking acceptance while preserving old one-way readability", () => {
    // Given: the frozen and concrete directions agree, but numeric walking cannot enforce one-way routes.
    const document = fixtureDocument(fixture);
    const root = requireOccurrenceAssociations(own(document.occurrences, geographyRoot));
    const region = own(root.snapshot.library.regions, root.source.id);
    const candidate = { ...fixture, spatialAuthoring: { ...document, connections: document.connections.map(link => ({ ...link, bidirectional: false })),
      occurrences: { ...document.occurrences, [root.id]: { ...root, snapshot: { ...root.snapshot, library: { ...root.snapshot.library,
        regions: { [region.id]: { ...region, routes: region.routes.map(route => ({ ...route, bidirectional: false })) } } } } } } } };
    deserialize(serialize(candidate));
    // When / Then
    expect(() => validateOverviewAccess(candidate, geographyRoot, { mapId: overviewBinding(candidate).mapId, x: 2, y: 8 }))
      .toThrowError(expect.objectContaining({ code: "connection" }));
  });
  it("keeps raster digest unchanged when only association identity changes", () => {
    // Given
    const binding = overviewBinding(fixture);
    const metadataOnly = { ...binding, overviewEntries: binding.overviewEntries?.map(entry => ({ ...entry, returnEventId: "different-logical-reference" })) };
    // When
    const digest = spatialRasterDigest(own(fixture.maps, binding.mapId), metadataOnly);
    // Then: task11 needs a full logical baseline, not a new raster hash version.
    expect(digest).toBe(OLD_DIGEST);
  });
  it("changes the source owner digest when its actual transfer command changes", () => {
    // Given
    const binding = overviewBinding(fixture);
    const map = own(fixture.maps, binding.mapId);
    const changed = { ...map, events: map.events.map(event => ({ ...event, pages: event.pages?.map(page => ({ ...page,
      commands: page.commands.map(command => command.kind === "transfer" ? { ...command, x: command.x + 1 } : command) })) })) };
    // When
    const digest = spatialRasterDigest(changed, binding);
    // Then
    expect(digest).not.toBe(OLD_DIGEST);
  });
  it("does not hash a child raster when digesting an overview owner", () => {
    // Given
    const binding = overviewBinding(fixture);
    const changed = { ...fixture, maps: Object.fromEntries(Object.entries(fixture.maps).map(([id, map]) =>
      [id, id === binding.mapId ? map : { ...map, lowerTiles: map.lowerTiles.map(() => -1) }])) };
    // When
    const digest = spatialRasterDigest(own(changed.maps, binding.mapId), binding);
    // Then
    expect(digest).toBe(OLD_DIGEST);
  });
  it.each(["unreachable-marker", "blocked-local-landing"] as const)("rejects %s at numeric acceptance even when shape remains valid", variant => {
    // Given: no event/association corruption; only numeric tiles lose passability.
    const candidate = structuredClone(fixture);
    const binding = overviewBinding(candidate);
    const map = own(candidate.maps, binding.mapId);
    switch (variant) {
      case "unreachable-marker":
        for (let y = 0; y < map.height; y++) { map.lowerTiles[y * map.width + 15] = -1; map.upperTiles[y * map.width + 15] = -1; }
        break;
      case "blocked-local-landing": {
        const transfer = candidate.mapConnections?.find(link => link.from.mapId === binding.mapId);
        if (!transfer) throw new TypeError("Missing transfer");
        const target = own(candidate.maps, transfer.to.mapId);
        const index = transfer.to.y * target.width + transfer.to.x;
        target.lowerTiles[index] = -1; target.upperTiles[index] = -1;
        break;
      }
    }
    deserialize(serialize(candidate));
    const before = serialize(candidate);
    // When
    const accept = () => validateOverviewAccess(candidate, geographyRoot, { mapId: map.id, x: 5, y: 8 });
    // Then
    expect(accept).toThrowError(expect.objectContaining({ code: "port" }));
    expect(serialize(candidate)).toBe(before);
  });
});
