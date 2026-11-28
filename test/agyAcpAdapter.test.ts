import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  agyAdapter,
  buildAgyAcpArgs,
  createAgyUpdateHandler,
  parseAgyModelsOutput,
  parseAgyQuotaWarning,
  resolveAgyModelId,
  shouldApproveAgyPermission,
} from "../scripts/lib/localCliAgent/agy";
import type { LocalCliEvent } from "../scripts/lib/localCliAgent/types";

describe("Antigravity ACP (agy) adapter", () => {
  it("builds official agy acp stdio args with --process-per-session and without auto-approving built-in tools", () => {
    expect(buildAgyAcpArgs()).toEqual([
      "acp",
      "--stdio",
      "--include-default-customizations=false",
      "--process-per-session",
    ]);
  });

  it("parses agy models output into deduplicated base models and detects login-required", () => {
    const loggedIn = parseAgyModelsOutput([
      "Fetching available models...",
      "gemini-4-neon-high\tGemini 4 Neon (High)",
      "gemini-4-neon-low\tGemini 4 Neon (Low)",
      "gemini-4-argon-medium\tGemini 4 Argon (Medium)",
      "claude-sonnet-5-5-high\tClaude Sonnet 5.5 (High)",
      "gpt-oss-120b-medium\tGPT-OSS 120B (Medium)",
    ].join("\n"));
    expect(loggedIn.needsLogin).toBe(false);
    expect(loggedIn.models.map((m) => m.id)).toEqual([
      "gemini-4-neon",
      "gemini-4-argon",
      "claude-sonnet-5-5",
      "gpt-oss-120b",
    ]);

    const loggedOut = parseAgyModelsOutput("Fetching available models...\nError: Please sign in to view available models.");
    expect(loggedOut.needsLogin).toBe(true);
    expect(loggedOut.models).toEqual([]);
  });

  it("resolves model IDs with effort suffixes and prefers advertised variants", () => {
    const available = ["gemini-4-argon-low", "gemini-4-argon-medium", "gemini-4-argon-high", "gemini-4-neon-xhigh"];
    expect(resolveAgyModelId("gemini-4-argon", "high", available)).toBe("gemini-4-argon-high");
    expect(resolveAgyModelId("gemini-4-argon", "xhigh", available)).toBe("gemini-4-argon-medium");
    expect(resolveAgyModelId("gemini-4-neon", "high", available)).toBe("gemini-4-neon-xhigh");
    expect(resolveAgyModelId("gemini-4-neon-xhigh", "low", available)).toBe("gemini-4-neon-xhigh");
    expect(resolveAgyModelId("auto", "medium", available)).toBeUndefined();
  });

  it("detects standalone quota warning banners without false-positiving on normal answers", () => {
    expect(parseAgyQuotaWarning("\n⚠ Individual quota reached. Resets in 12h30m.\n")).toContain("429 quota exceeded");
    expect(parseAgyQuotaWarning("Normal assistant reply.")).toBeUndefined();
    expect(parseAgyQuotaWarning("In this game, the error message says quota exceeded when the player runs out of mana.")).toBeUndefined();
  });

  it("approves only oprn MCP permissions and blocks built-in shell/file tools", () => {
    expect(shouldApproveAgyPermission({ toolCall: { title: "mcp__oprn__paint_tiles", kind: "mcp" } })).toBe(true);
    expect(shouldApproveAgyPermission({ toolCall: { title: "oprn_ping", kind: "mcp" } })).toBe(true);
    expect(shouldApproveAgyPermission({ toolCall: { title: "run_shell_command", kind: "execute" } })).toBe(false);
    expect(shouldApproveAgyPermission({ toolCall: { title: "write_file", kind: "edit" } })).toBe(false);
  });

  it("maps ACP session/update notifications into LocalCliEvent stream", () => {
    const events: LocalCliEvent[] = [];
    const handler = createAgyUpdateHandler((ev) => events.push(ev));
    handler.handleUpdate("sess-1", { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "plan" } });
    handler.handleUpdate("sess-1", { sessionUpdate: "tool_call", toolCallId: "t1", toolName: "mcp__oprn__paint_tiles" });
    handler.handleUpdate("sess-1", { sessionUpdate: "tool_call_update", toolCallId: "t1", status: "completed" });
    handler.handleUpdate("sess-1", { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Done!" } });

    expect(events).toEqual([
      { kind: "assistant", messageId: "sess-1:1", newRequest: true, blocks: [{ type: "thinking", text: "plan" }] },
      { kind: "assistant", messageId: "sess-1:1", newRequest: false, blocks: [{ type: "tool_use", name: "paint_tiles" }] },
      { kind: "acknowledged", toolName: "paint_tiles", ok: true },
      { kind: "assistant", messageId: "sess-1:2", newRequest: true, blocks: [{ type: "text", text: "Done!" }] },
    ]);
    expect(handler.snapshot()).toEqual({ calls: 2, toolCalls: 1, text: "Done!" });
  });

  it.skipIf(process.platform === "win32")("verifies model selection, permission allow/deny outcomes, stopReason handling, and not-installed detection", async () => {
    const missing = await agyAdapter.detect("/nonexistent-oprn-agy-bin");
    expect(missing.state).toBe("not-installed");

    const dir = mkdtempSync(join(tmpdir(), "oprn-fake-agy-"));
    const fakeBin = join(dir, "agy");
    writeFileSync(fakeBin, `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "--version") { console.log("1.5.18-test"); process.exit(0); }
if (args[0] === "models") { console.log("gemini-4-argon-high\\tGemini 4 Argon (High)"); process.exit(0); }
let buf = "";
let selectedModel = null;
let promptReqId = null;
let permStep = 0;
let allowOk = false;
let denyOk = false;
let promptText = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  const lines = buf.split("\\n");
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.method === "initialize") {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: 1, agentCapabilities: { sessionCapabilities: { resume: {} } } } }) + "\\n");
    } else if (msg.method === "session/new") {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { sessionId: "fake-sess-1", models: { currentModelId: "gemini-4-neon-high", availableModels: [{ modelId: "gemini-4-argon-high" }] } } }) + "\\n");
    } else if (msg.method === "session/set_model") {
      selectedModel = msg.params?.modelId ?? null;
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: {} }) + "\\n");
    } else if (msg.method === "session/prompt") {
      promptReqId = msg.id;
      promptText = msg.params?.prompt?.[0]?.text ?? "";
      if (selectedModel !== "gemini-4-argon-high") {
        process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: "model not set: " + String(selectedModel) } }) + "\\n");
        continue;
      }
      if (promptText.includes("REFUSE")) {
        process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { stopReason: "refusal" } }) + "\\n");
        continue;
      }
      permStep = 1;
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id: "perm-1",
        method: "session/request_permission",
        params: {
          toolCall: { title: "mcp__oprn__paint_tiles", kind: "mcp" },
          options: [{ optionId: "allow_once", kind: "allow_once" }, { optionId: "reject_once", kind: "reject_once" }],
        },
      }) + "\\n");
    } else if (msg.id === "perm-1" && permStep === 1) {
      allowOk = msg.result?.outcome?.outcome === "selected" && msg.result?.outcome?.optionId === "allow_once";
      permStep = 2;
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id: "perm-2",
        method: "session/request_permission",
        params: {
          toolCall: { title: "run_shell_command", kind: "execute" },
          options: [{ optionId: "allow_once", kind: "allow_once" }, { optionId: "reject_once", kind: "reject_once" }],
        },
      }) + "\\n");
    } else if (msg.id === "perm-2" && permStep === 2) {
      denyOk = msg.result?.outcome?.outcome === "cancelled" || msg.result?.outcome?.optionId === "reject_once";
      if (!allowOk || !denyOk) {
        process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: promptReqId, error: { code: -32001, message: "perm failed: " + JSON.stringify({ allowOk, denyOk }) } }) + "\\n");
      } else {
        process.stdout.write(JSON.stringify({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "fake-sess-1", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "OK" } } } }) + "\\n");
        process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: promptReqId, result: { stopReason: "end_turn", usage: { inputTokens: 120, outputTokens: 10, cachedReadTokens: 20 } } }) + "\\n");
      }
    }
  }
});
`, "utf8");
    chmodSync(fakeBin, 0o755);
    try {
      const detected = await agyAdapter.detect(fakeBin);
      expect(detected).toMatchObject({
        state: "ready",
        version: "1.5.18-test",
        authMethod: "Google ACP",
        defaults: { routine: "gemini-4-argon", deep: "gemini-4-argon" },
      });

      let seenUsage: unknown;
      const reply = await agyAdapter.complete("Reply with OK", {
        binary: fakeBin,
        model: "gemini-4-argon",
        effort: "high",
        onUsage: (u) => { seenUsage = u; },
      });
      expect(reply).toBe("OK");
      expect(seenUsage).toEqual({ input: 100, output: 10, cacheRead: 20, cacheWrite: 0, calls: 1 });

      await expect(agyAdapter.complete("REFUSE", {
        binary: fakeBin,
        model: "gemini-4-argon",
        effort: "high",
      })).rejects.toThrow(/거절/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
