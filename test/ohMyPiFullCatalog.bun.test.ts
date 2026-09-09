import { describe, expect, test } from "bun:test";
import { completeProvider } from "../scripts/lib/ohMyPiPiAiRuntime.ts";

// Exercise the installed subscription adapters, not a reimplementation of their wire format.
// Mock upstream deliberately rejects after serialization; rejection must never trigger pruning.
describe("full native catalog on supported subscription transports", () => {
  for (const provider of ["google-antigravity", "openai-codex"]) {
    for (const count of [40, 41, 127, 128, 129, 198, 207]) {
      test(`${provider} preserves ${count} full definitions and surfaces upstream rejection`, async () => {
        const tools = Array.from({ length: count }, (_, index) => ({
          type: "function",
          function: {
            name: `editor_probe_${index}`,
            description: `Read fixture record ${index} with its complete nested shape.`,
            parameters: {
              type: "object",
              properties: {
                id: { type: "string", enum: ["original", "draft"] },
                page: { type: "object", properties: { index: { type: "integer" } }, required: ["index"] },
              },
              required: ["id", "page"],
            },
          },
        }));
        // pi-ai annotates schema objects with private symbols while normalizing them.
        const expected = JSON.parse(JSON.stringify(tools.map((tool) => tool.function)));
        if (provider === "google-antigravity") {
          for (const tool of expected) tool.parameters.propertyOrdering = ["id", "page"];
        }
        const bodies: Record<string, unknown>[] = [];
        await expect(completeProvider(provider, {
          model: provider === "google-antigravity" ? "gemini-3.7-flash" : "gpt-5.6-sol",
          messages: [{ role: "user", content: "Inspect the catalog only." }],
          tools,
        }, {
          apiKey: provider === "google-antigravity"
            ? JSON.stringify({ token: "fixture-access", projectId: "fixture-project" })
            : "fixture-access",
          fetch: async (_input, init) => {
            // The real Codex adapter sends zstd bytes, whereas Antigravity sends JSON text.
            const encoded = init?.body;
            const json = new Headers(init?.headers).get("content-encoding") === "zstd"
              ? new TextDecoder().decode(Bun.zstdDecompressSync(encoded as Uint8Array))
              : String(encoded);
            bodies.push(JSON.parse(json));
            return new Response("tool catalog rejected by fixture upstream", { status: 422 });
          },
        })).rejects.toThrow("tool catalog rejected by fixture upstream");
        expect(bodies).toHaveLength(1);
        const body = bodies[0]!;
        type Declaration = { name: string; description: string; parameters?: unknown; parametersJsonSchema?: unknown };
        const declarations = provider === "google-antigravity"
          ? (body.request as { tools: { functionDeclarations: Declaration[] }[] }).tools.flatMap((tool) => tool.functionDeclarations)
          : (body.input as { type: string; tools?: Declaration[] }[])
            .filter((item) => item.type === "additional_tools")
            .flatMap((item) => item.tools ?? []);
        expect(declarations.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parametersJsonSchema ?? tool.parameters,
        }))).toEqual(expected);
      });
    }
  }
});
