import { afterEach, describe, expect, it } from "vitest";
import {
  clearAgentGhostPreview,
  clearAgentGhostRunningTool,
  getAgentGhostPreviewState,
  setAgentGhostRunningTool,
  subscribeAgentGhostPreview,
  type AgentGhostPreviewState,
} from "@/editor/agentGhostPreview";

afterEach(clearAgentGhostPreview);

describe("running-tool map ownership", () => {
  it.each([
    { mapId: "a" },
    { target: { kind: "existing", mapId: "a" } },
  ])("captures the explicit tool target before preview cells for %j", (args) => {
    // Given: no geometry has arrived.
    clearAgentGhostPreview();
    // When: a map-targeted tool starts.
    setAgentGhostRunningTool("fill_region", args);
    // Then: activity already belongs to its target, not a viewed map.
    expect(getAgentGhostPreviewState()).toMatchObject({ previews: [], runningToolName: "fill_region", runningToolMapId: "a" });
  });

  it("publishes an owner change even when the tool name is unchanged", () => {
    // Given: A owns a running tool.
    setAgentGhostRunningTool("fill_region", { mapId: "a" });
    const states: AgentGhostPreviewState[] = [];
    const unsubscribe = subscribeAgentGhostPreview(state => states.push(state));
    try {
      // When: the same tool starts on B.
      setAgentGhostRunningTool("fill_region", { mapId: "b" });
      // Then: subscribers receive the changed ownership.
      expect(states).toHaveLength(2);
      expect(states[1]).toMatchObject({ runningToolName: "fill_region", runningToolMapId: "b" });
    } finally { unsubscribe(); }
  });

  it.each([undefined, {}, { mapId: 12 }, { target: { kind: "new" } }])("does not inherit the last owner for unknown target %j", (args) => {
    // Given: a previously targeted tool.
    setAgentGhostRunningTool("fill_region", { mapId: "a" });
    // When: a tool without a known map starts.
    setAgentGhostRunningTool("get_project_summary", args);
    // Then: the name remains available, but canvas ownership is unknown.
    expect(getAgentGhostPreviewState()).toMatchObject({ runningToolName: "get_project_summary", runningToolMapId: null });
  });

  it.each([clearAgentGhostRunningTool, clearAgentGhostPreview])("clears name and ownership together via %s", (clear) => {
    // Given: an owned running tool.
    setAgentGhostRunningTool("fill_region", { mapId: "a" });
    // When: tool/turn state is cleared.
    clear();
    // Then: neither name nor owner survives.
    expect(getAgentGhostPreviewState()).toMatchObject({ runningToolName: "", runningToolMapId: null });
  });
});
