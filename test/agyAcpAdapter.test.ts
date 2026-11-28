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

    // 접두 일치로 계열을 맞추지 않는다 — preview 모델이 Argon 으로 접히거나 유령 Argon 항목을 만들지 않는다.
    const previewOnly = parseAgyModelsOutput("gemini-4-argon-preview-high\tGemini 4 Argon Preview (High)");
    expect(previewOnly.models.map((m) => m.id)).toEqual(["gemini-4-argon-preview"]);

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
    // preview 변형은 Argon 의 강도 변형이 아니다 — 광고된 변형이 없으면 기본 후보로 떨어진다.
    expect(resolveAgyModelId("gemini-4-argon", "high", ["gemini-4-argon-preview-high"])).toBe("gemini-4-argon-high");
  });

  it("detects standalone quota warning banners without false-positiving on normal answers", () => {
    expect(parseAgyQuotaWarning("\n⚠ Individual quota reached. Resets in 12h30m.\n")).toContain("429 quota exceeded");
    expect(parseAgyQuotaWarning("Normal assistant reply.")).toBeUndefined();
    expect(parseAgyQuotaWarning("In this game, the error message says quota exceeded when the player runs out of mana.")).toBeUndefined();
  });

  it("approves only requests bound to the oprn MCP server and fails closed otherwise", () => {
    expect(shouldApproveAgyPermission({ toolCall: { title: "mcp__oprn__paint_tiles", kind: "mcp" } })).toBe(true);
    expect(shouldApproveAgyPermission({ toolCall: { title: "oprn_ping", kind: "mcp" } })).toBe(true);
    expect(shouldApproveAgyPermission({ toolCall: { title: "paint_tiles", kind: "mcp", serverName: "oprn" } })).toBe(true);
    // 서버 식별이 있으면 이름보다 우선한다 — 다른 서버가 oprn 처럼 보이는 이름을 달아도 거절.
    expect(shouldApproveAgyPermission({ toolCall: { title: "mcp__oprn__paint_tiles", kind: "mcp", serverName: "other" } })).toBe(false);
    // 이름 «중간» 의 oprn 이나 kind: mcp 만으로는 허용하지 않는다(에이전트가 쓴 표시 문구).
    expect(shouldApproveAgyPermission({ toolCall: { title: "run_shell_command (oprn helper)", kind: "execute" } })).toBe(false);
    expect(shouldApproveAgyPermission({ toolCall: { title: "paint_tiles", kind: "mcp" } })).toBe(false);
    expect(shouldApproveAgyPermission({ toolCall: { title: "run_shell_command", kind: "execute" } })).toBe(false);
    expect(shouldApproveAgyPermission({ toolCall: { title: "write_file", kind: "edit" } })).toBe(false);
    // 도구를 연결하지 않은 세션(보조 complete)은 oprn 도구 요청도 허용하지 않는다.
    expect(shouldApproveAgyPermission({ toolCall: { title: "mcp__oprn__paint_tiles", kind: "mcp" } }, false)).toBe(false);
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

    // 도구는 시작한 때 센다 — 끝 알림 전에도 재시도를 막을 수 있어야 한다.
    const started = createAgyUpdateHandler(() => undefined);
    started.handleUpdate("sess-2", { sessionUpdate: "tool_call", toolCallId: "w1", toolName: "mcp__oprn__paint_tiles" });
    expect(started.snapshot().toolCalls).toBe(1);
    started.handleUpdate("sess-2", { sessionUpdate: "tool_call_update", toolCallId: "w1", status: "completed" });
    expect(started.snapshot().toolCalls).toBe(1);
  });

  it.skipIf(process.platform === "win32")("verifies model selection, permission allow/deny outcomes, stopReason handling, and not-installed detection", async () => {
    const missing = await agyAdapter.detect("/nonexistent-oprn-agy-bin");
    expect(missing.state).toBe("not-installed");

    const dir = mkdtempSync(join(tmpdir(), "oprn-fake-agy-"));
    const fakeBin = join(dir, "agy");
    writeFileSync(fakeBin, `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "--version") { console.log("1.5.18-test"); process.exit(0); }
if (args[0] === "models") {
  console.log("gemini-4-argon-high\\tGemini 4 Argon (High)");
  process.exit(process.env.OPRN_FAKE_AGY_MODELS_FAIL === "1" ? 3 : 0);
}
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
      process.stdout.write("null\\n"); // ACP 프레임이 아닌 줄 — 어댑터가 던지지 않고 건너뛰어야 한다.
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
      // 허용/거절 결과는 답변 글에 실어 테스트가 세션 종류(도구 연결 여부)별로 단언한다.
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "fake-sess-1", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "OK allow=" + allowOk + " deny=" + denyOk } } } }) + "\\n");
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: promptReqId, result: { stopReason: "end_turn", usage: { inputTokens: 120, outputTokens: 10, cachedReadTokens: 20 } } }) + "\\n");
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
      // 도구를 연결하지 않은 보조 호출은 oprn 도구 요청도 거절한다(allow=false), 셸 요청도 거절(deny=true).
      expect(reply).toBe("OK allow=false deny=true");
      expect(seenUsage).toEqual({ input: 100, output: 10, cacheRead: 20, cacheWrite: 0, calls: 1 });

      // 도구를 연결한 세션에서만 oprn MCP 요청이 허용되고, 셸 요청은 여전히 거절된다.
      let sessionText = "";
      let sessionResult: { ok: boolean; error?: string } | undefined;
      const session = agyAdapter.openSession({
        mcpUrl: "http://127.0.0.1:9/mcp",
        mcpToken: "test-token",
        systemPrompt: "test",
        binary: fakeBin,
        model: "gemini-4-argon",
        effort: "high",
        onEvent: (event) => {
          if (event.kind === "assistant") {
            for (const block of event.blocks) if (block.type === "text") sessionText += block.text;
          } else if (event.kind === "result") {
            sessionResult = { ok: event.ok, ...(event.error ? { error: event.error } : {}) };
          }
        },
      });
      try {
        await session.prompt("Reply with OK");
      } finally {
        await session.close();
      }
      expect(sessionResult).toMatchObject({ ok: true });
      expect(sessionText).toBe("OK allow=true deny=true");

      // 모델 조회가 한 줄 출력 뒤 비정상 종료하면 «연결됨» 이 아니다.
      process.env.OPRN_FAKE_AGY_MODELS_FAIL = "1";
      try {
        const partial = await agyAdapter.detect(fakeBin);
        expect(partial.state).toBe("error");
      } finally {
        delete process.env.OPRN_FAKE_AGY_MODELS_FAIL;
      }

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
