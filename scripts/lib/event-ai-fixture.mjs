// A small project for event-assist browser checks. It needs no bundled demo data
// or Node-side imports of the editor's asset graph.
export function eventAiFixture(commands, { title = "이벤트 AI 검수", name = "상자", secondPage = false } = {}) {
  const target = { mapId: "map_ai_dock", eventId: "ev_ai_dock", pageId: "p1" };
  const switchId = "switch_1";
  const width = 16;
  const height = 12;
  const eventPage = {
    id: target.pageId, name, conditions: [], graphic: {},
    trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  const map = {
    id: target.mapId, name: "빈 맵", width, height, tileSize: 16, tilesetId: "tiles_default",
    lowerTiles: Array(width * height).fill(0), upperTiles: Array(width * height).fill(-1),
    events: [{ id: target.eventId, name, x: 4, y: 4, trigger: { kind: "action" }, commands,
      pages: secondPage ? [eventPage, { ...structuredClone(eventPage), id: "p2" }] : [eventPage] }],
  };
  const project = {
    version: 3,
    meta: { title, author: "e2e", terms: { gold: "G" } },
    assets: { sprites: {}, uploaded: {} },
    resourceProfiles: [],
    tilesets: {
      tiles_default: {
        id: "tiles_default", name: "Default tileset",
        image: { type: "bundled", id: "tex_tiles_default" },
        tileSize: 16, tilesPerRow: 8, count: 1,
        passability: [{ up: true, down: true, left: true, right: true }],
        priority: ["lower"], terrain: [0],
      },
    },
    switches: [{ id: switchId, name: "잠금 기억" }],
    variables: [],
    commonEvents: [],
    database: {
      actors: [], classes: [], skills: [], items: [], equipment: [], enemies: [], troops: [], states: [], battleAnimations: [],
    },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: { [map.id]: map },
    mapTree: { mapId: map.id, children: [] },
    startMapId: map.id,
    startPos: { x: 1, y: 1 },
    flags: { slimStarter: true },
  };
  return { project, target, switchId };
}

// Mock the model transport while keeping the shared assistant, its writer tool,
// deferApply and the command editor on their normal paths.
export async function mockEventAi(page, target, commands, { gate = async () => {}, mode = "edit" } = {}) {
  let generatorCalls = 0;
  await page.route("**/v1/chat/completions", async route => {
    const request = route.request().postDataJSON();
    const tool = request.tools?.find(entry => entry.function.name === "event_command_assist");
    let content = null;
    let toolCalls;
    if (tool) {
      const prompt = request.messages.filter(message => message.role === "user").at(-1)?.content;
      toolCalls = [{ id: `event-assist-${generatorCalls + 1}`, type: "function", function: {
        name: "event_command_assist", arguments: JSON.stringify({ ...target, prompt, mode }),
      } }];
    } else {
      generatorCalls += 1;
      await gate();
      content = JSON.stringify(commands);
    }
    await route.fulfill({
      contentType: "application/json",
      json: { choices: [{ message: { role: "assistant", content, tool_calls: toolCalls }, finish_reason: toolCalls ? "tool_calls" : "stop" }] },
    });
  });
  return () => generatorCalls;
}
