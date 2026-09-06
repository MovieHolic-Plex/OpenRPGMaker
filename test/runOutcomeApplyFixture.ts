import { vi } from "vitest";
import { AssistantSession, type AssistantSessionOptions, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { fixedDeclarer } from "./intentFixture";

/** The real store/save/proof adapter against a wire-level in-memory project row. */
export function applyFixture(chat?: AssistantSessionOptions["chat"]) {
  vi.useFakeTimers(); // Autosave is unrelated; flush and exact callbacks drive every operation.
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
  vi.stubEnv("VITE_SUPABASE_URL", "http://outcome.invalid");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "outcome-apply-fixture");
  vi.stubGlobal("window", { location: { hostname: "127.0.0.1", pathname: "/", search: "" },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
  let row = "";
  let proofResponse: (() => Response | Promise<Response>) | undefined;
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? "GET";
    if (path === "/rest/v1/projects") {
      if (method === "GET") return proofResponse ? proofResponse() : new Response(row ? `[${row}]` : "[]");
      row = String(init?.body);
      return new Response(method === "PATCH" ? `[${row}]` : "[]");
    }
    if (["/rest/v1/maps", "/rest/v1/tilesets", "/rest/v1/project_commits", "/rest/v1/project_changes"].includes(path)) return Response.json([]);
    throw new Error(`Unexpected transport: ${method} ${path}`);
  }));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  store._setPersistedBaselineForTest(null);
  resetMapEditHistory();
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  let round = 0;
  const events: SessionEvent[] = [];
  const session = new AssistantSession(store.getCurrent(), {
    config: { ...defaultAiConfig(), model: "test", liteModel: "test", apiKey: "test", agentMode: "chat", maxToolCalls: 4 },
    declareIntent: fixedDeclarer({ mode: "other" }),
    yieldToUi: async () => {},
    chat: chat ?? (async (): Promise<ChatResult> => round++ === 0
      ? { message: { role: "assistant", content: null, tool_calls: [{ id: "title", type: "function", function: {
        name: "set_title_screen", arguments: JSON.stringify({ title: "Run-owned title" }),
      } }] }, finishReason: "tool_calls" }
      : { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" }),
  });
  return { session, events, setProofResponse: (response: () => Response | Promise<Response>) => { proofResponse = response; },
    run: () => session.sendUserMessage("Set title", event => events.push(event)),
  };
}
