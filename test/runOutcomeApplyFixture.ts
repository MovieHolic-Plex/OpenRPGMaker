import { vi } from "vitest";
import { clearTimeout, setTimeout } from "node:timers";
import * as sync from "@/project/supabaseProjectSync";
import { AssistantSession, type AssistantSessionOptions, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { fixedDeclarer } from "./intentFixture";
import { approvedReviewResponse } from "./independentReviewFixture";
import type { TilesetDef } from "@/project/types";

const fixtureWriters: (() => readonly Promise<unknown>[])[] = [];

/** Flush launches writers synchronously; their returned promises include response handling. */
export async function drainOutcomeFixtures(): Promise<void> {
  const pending = fixtureWriters.splice(0).flatMap(writes => writes());
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    const results = await Promise.race([Promise.allSettled(pending), new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error("Outcome fixture writer completion deadline")), 10_000);
    })]);
    const failures = results.flatMap(result => result.status === "rejected" ? [result.reason] : []);
    if (failures.length) throw new AggregateError(failures, "Outcome fixture writer failed");
  } finally { clearTimeout(deadline); }
}

/** The real store/save/proof adapter against a wire-level in-memory project row. */
export function applyFixture(
  chat?: AssistantSessionOptions["chat"],
  declareIntent: AssistantSessionOptions["declareIntent"] = fixedDeclarer({ mode: "other" }),
  renderImages?: AssistantSessionOptions["renderImages"],
  yieldToUi: AssistantSessionOptions["yieldToUi"] = async () => {},
) {
  vi.useFakeTimers(); // Autosave is unrelated; flush and exact callbacks drive every operation.
  const commits = vi.spyOn(sync, "recordProjectCommitToSupabase"); // Call through, never replace the writer.
  fixtureWriters.push(() => commits.mock.results.map(result => {
    if (result.type !== "return") throw new Error("Outcome fixture writer did not return its completion");
    return result.value;
  }));
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
  vi.stubEnv("VITE_SUPABASE_URL", "http://outcome.invalid");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "outcome-apply-fixture");
  vi.stubGlobal("window", { location: { hostname: "127.0.0.1", pathname: "/", search: "" },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
  let row = "";
  let proofResponse: (() => Response | Promise<Response>) | undefined;
  let commitResponse: (() => Response) | undefined;
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? "GET";
    if (path === "/rest/v1/projects") {
      if (method === "GET") return proofResponse ? proofResponse() : new Response(row ? `[${row}]` : "[]");
      row = String(init?.body);
      return new Response(method === "PATCH" ? `[${row}]` : "[]");
    }
    if (path === "/rest/v1/project_commits" && method === "POST" && commitResponse) return commitResponse();
    if (["/rest/v1/maps", "/rest/v1/tilesets", "/rest/v1/project_commits", "/rest/v1/project_changes"].includes(path)) return Response.json([]);
    throw new Error(`Unexpected transport: ${method} ${path}`);
  }));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Outcome fixture start map missing");
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) throw new Error("Outcome fixture start tileset missing");
  // A passable one-tile proof fixture: outcome tests also execute real lint.
  // Numeric legacy passage flags are not valid in-memory runtime PassFlag records.
  map.tilesetId = "outcome-tileset";
  map.lowerTiles.fill(0);
  project.tilesets = { [map.tilesetId]: {
    id: map.tilesetId, name: "Outcome tileset", image: tileset.image, kind: "custom",
    tileSize: map.tileSize, tilesPerRow: 1, count: 1,
    passability: [{ up: true, down: true, left: true, right: true }], priority: ["lower"], terrain: [0],
  } satisfies TilesetDef };
  store.replace(project);
  store._setPersistedBaselineForTest(null);
  resetMapEditHistory();
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  let round = 0;
  const events: SessionEvent[] = [];
  const writer = chat ?? (async (): Promise<ChatResult> => round++ === 0
    ? { message: { role: "assistant", content: null, tool_calls: [{ id: "title", type: "function", function: {
      name: "set_title_screen", arguments: JSON.stringify({ title: "Run-owned title" }),
    } }] }, finishReason: "tool_calls" }
    : { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" });
  const session = new AssistantSession(store.getCurrent(), {
    config: { ...defaultAiConfig(), model: "test", liteModel: "test", apiKey: "test", agentMode: "chat", maxToolCalls: 4 },
    declareIntent, renderImages,
    yieldToUi,
    chat: async (config, request) => approvedReviewResponse(request)
      ?? (!request.tools?.length ? { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" }
        : writer(config, request)),
  });
  return { session, events, setProofResponse: (response?: () => Response | Promise<Response>) => { proofResponse = response; },
    setCommitResponse: (response: () => Response) => { commitResponse = response; },
    run: () => session.sendUserMessage("Set title", event => events.push(event)),
  };
}
