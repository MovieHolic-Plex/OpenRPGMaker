import type { RoleModel } from "../../src/ai/modelRoles";
import type { PiToolShape } from "../../src/ai/piAgent/toolAdapter";
import type { completeProvider } from "./ohMyPiPiAiRuntime";

/**
 * `projectContext`: 프로젝트가 늘 들고 있는 저작 맥락(확정 게임 기획 등). Writer 는 시공 모델이 brief 에 옮겨 적은 것만
 * 보므로, 인터뷰에서 정한 인물·무대·톤을 시공 모델이 빠뜨리면 대사가 기획과 어긋난다 — 그래서 시스템 쪽에 고정으로 싣는다.
 */
export function createWriterTool(writer: RoleModel, complete: typeof completeProvider, apiKey?: string, projectContext?: string): PiToolShape {
  const system = "You are Writer, responsible for story, lore, dialogue and literary style. Follow the supplied brief and continuity. Return finished prose in the requested language. You cannot edit the project or claim changes were applied."
    + (projectContext?.trim() ? `\n\nProject continuity (authored by the user; keep names, setting and tone consistent with it):\n${projectContext.trim()}` : "");
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
        messages: [{ role: "system", content: system }, { role: "user", content: brief }],
      }, { apiKey, signal });
      signal?.throwIfAborted();
      const choice = result.completion.choices[0];
      if (choice?.finish_reason !== "stop" || typeof choice.message.content !== "string" || !choice.message.content.trim()) throw new Error("Writer 응답을 완료하지 못했습니다.");
      return { content: [{ type: "text", text: choice.message.content }] };
    },
  };
}
