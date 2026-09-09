import { describe, expect, it } from "vitest";
import { deserialize } from "../src/project/io";
import { isPassableLanding } from "../src/project/collision";
import { computeReachableCells } from "../src/project/lint/reachability";
import { own } from "../src/project/spatial/domain";
import { projectedStairOutput } from "./support/spatialPlaceOutputContract";

describe("nested place projected stair output contract", () => {
  it("accepts complete connection bookkeeping when the raster owner hosts projected stair endpoints", () => {
    // Given: real space-compiler maps and the existing house transfer-event adapter.
    const { proposal } = projectedStairOutput();
    // When: proposed complete ownership crosses the actual project IO boundary.
    const loaded = deserialize(JSON.stringify(proposal));
    // Then: the raster owner's generated connection bookkeeping survives IO.
    expect(loaded.spatialAuthoring).toEqual(proposal.spatialAuthoring);
  });

  it("isolates connection bookkeeping when the identical numeric output omits only connectionIds", () => {
    // Given: same tiles, projected ports, owned events, transfers, and navigation.
    const { control } = projectedStairOutput();
    // When: load the diagnostic control (not an acceptable complete compiler output).
    const loaded = deserialize(JSON.stringify(control));
    // Then: the remainder of the output contract is valid.
    expect(loaded.spatialAuthoring).toEqual(control.spatialAuthoring);
    expect(loaded.mapConnections).toEqual(control.mapConnections);
  });

  it("has reachable passable endpoints when the real stair rasters carry transfer events", () => {
    // Given: actual authored stairs and transfer commands from the existing adapter.
    const { proposal, routes } = projectedStairOutput();
    // When: existing-engine collision and walking reachability inspect each endpoint.
    const access = routes.map(route => {
      const source = own(proposal.maps, route.from.mapId);
      const target = own(proposal.maps, route.to.mapId);
      const reached = computeReachableCells(proposal, source, 10, 15);
      return reached.has(`${route.from.x},${route.from.y}`)
        && isPassableLanding(proposal, target, route.to.x, route.to.y);
    });
    // Then: failure of the complete proposal cannot be blamed on blocked landings.
    expect(access).toEqual([true, true, true, true]);
  });
});
