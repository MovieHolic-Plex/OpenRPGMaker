import type { RoleModel } from "../../src/ai/modelRoles";
import type { PiToolShape } from "../../src/ai/piAgent/toolAdapter";
import type { completeProvider } from "./ohMyPiPiAiRuntime";

export function createWriterTool(writer: RoleModel, complete: typeof completeProvider, apiKey?: string): PiToolShape {
  return {
    concurrency: "shared",
    name: "consult_writer", label: "Writer", description: "Ask Writer to author story, lore, NPC dialogue or quest prose. Supply relevant existing context and constraints. Returns text only; apply the accepted text with project tools.",
    parameters: { type: "object", properties: { brief: { type: "string" } }, required: ["brief"], additionalProperties: false },
    async execute(_id, params, signal) {
      const brief = (params as { brief?: unknown })?.brief;
      if (typeof brief !== "string" || !brief.trim() || brief.length > 32000) throw new Error("Writer brief must contain 1–32000 characters.");
      signal?.throwIfAborted();
      const result = await complete(writer.provider, { model: writer.model,
        reasoning: { effort: writer.thinkingLevel }, max_tokens: 8192,
        messages: [{ role: "system", content: "You are Writer, responsible for story, lore, dialogue and literary style. Follow the supplied brief and continuity. Return finished prose in the requested language. You cannot edit the project or claim changes were applied." }, { role: "user", content: brief }],
      }, { apiKey, signal });
      signal?.throwIfAborted();
      const choice = result.completion.choices[0];
      if (choice?.finish_reason !== "stop" || typeof choice.message.content !== "string" || !choice.message.content.trim()) throw new Error("Writer 응답을 완료하지 못했습니다.");
      return { content: [{ type: "text", text: choice.message.content }] };
    },
  };
}
