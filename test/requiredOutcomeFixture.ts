import { AssistantSession, type SessionEvent, type SessionTurnOptions } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";
import type { IntentDeclaration } from "@/ai/intentDeclaration";

export type Call = { readonly name: string; readonly args: Record<string, unknown> };
export const target = { mapId: createBlankProject().startMapId };
export const skip: Call = { name: "skip_work_item", args: {} };
export const size = { id: "size", title: "Size", criteria: [{ kind: "mapDimensions", target, width: 99, height: 99 }] };
export function plan(requirements?: unknown, requirementIds?: readonly string[]): Call {
  return { name: "set_work_plan", args: {
    goal: "Map contract", ...(requirements === undefined ? {} : { requirements }),
    layers: [{ title: "Edit", items: [{ id: "edit", title: "Edit", instruction: "Inspect map",
      ...(requirementIds === undefined ? {} : { requirementIds }),
    }] }],
  } };
}

/** Only LLM transports are scripted; the session, parser, tools and ledger are real. */
export function fixture() {
  let batches: readonly (readonly Call[])[] = [];
  let round = 0;
  let intent: Partial<IntentDeclaration> = { mode: "other" };
  const events: SessionEvent[] = [];
  const session = new AssistantSession(createBlankProject(), {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 16 },
    declareIntent: facts => fixedDeclarer(intent)(facts),
    chat: async (): Promise<ChatResult> => {
      const batch = batches[round++];
      return batch ? { message: { role: "assistant", content: null, tool_calls: batch.map((call, i) => ({
        id: `call-${round}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
      })) }, finishReason: "tool_calls" } : { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
    },
  });
  return {
    session, events,
    setIntent(value: Partial<IntentDeclaration>) { intent = value; },
    // Empty raw source deliberately exercises legacy tool-declared contracts. Provenance
    // cases pass their actual source explicitly and must account for its required rows.
    run(calls: readonly (readonly Call[])[], options: SessionTurnOptions = {}, text = "") {
      batches = calls; round = 0; events.length = 0;
      return session.sendUserMessage(text, event => events.push(event), undefined, options);
    },
  };
}
