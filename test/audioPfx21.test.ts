import { expect, it, describe, afterEach, beforeEach, vi } from "vitest";
import { mkdtemp, mkdir, copyFile, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, preview } from "vite";
import { audioDeliveryPlugin } from "../scripts/lib/audioDelivery";
import { strict as assert } from "node:assert";
import { AssistantSession } from "@/ai/assistantSession";
import { isCompactionSummaryMessage } from "@/ai/contextCompaction";
import type { AiConfig, ChatMessage, ChatRequest, ChatResult } from "@/ai/llmClient";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { requireRecord, requireString } from "@/project/io/guards";
import { AUDIO_TEST_CONFIG, audioPromptProject, uploadId } from "./support/audioPrompt";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { getMapEditHistoryEntries, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { applyProposedProject, captureProposalBase, applyToolSequenceToStore, applyToolToStore, previewTool } from "@/editor/tools/applyChangesetToStore";
import { store } from "@/project/store";
import { audioDescriptionToolProject, MUSIC_ID } from "./support/audioDescriptionToolProject";
import { isolateTimers } from "./mergedTeardown";

describe("audioDeliveryHttp", () => {
  isolateTimers();
  it.each(["dev", "preview"])("serves real media bytes/ranges and missing-media 404s through Vite %s", async mode => {
    const root = await mkdtemp(join(tmpdir(), "audio-delivery-"));
    const bytes = await readFile("public/assets/cc0/audio/ui-confirm.wav");
    for (const directory of ["public", "dist"]) {
      await mkdir(join(root, directory, "assets"), { recursive: true });
      await copyFile("public/assets/cc0/audio/ui-confirm.wav", join(root, directory, "assets/valid.wav"));
    }
    await writeFile(join(root, "index.html"), "<!doctype html><title>SPA shell</title>");
    await copyFile(join(root, "index.html"), join(root, "dist/index.html"));
    const config = { configFile: false as const, root, cacheDir: join(root, ".cache"), logLevel: "silent" as const,
      optimizeDeps: { noDiscovery: true, include: [] }, plugins: [audioDeliveryPlugin()] };
    const server = mode === "dev"
      ? await createServer({ ...config, server: { host: "127.0.0.1", port: 0 } })
      : await preview({ ...config, preview: { host: "127.0.0.1", port: 0 } });
    try {
      if ("listen" in server) await server.listen(0);
      const address = server.httpServer?.address();
      if (!address || typeof address === "string") throw new Error("Missing isolated TCP server");
      const origin = `http://127.0.0.1:${address.port}`;
      const request = (path: string, init?: RequestInit) => fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(10000) });
      const response = await request("/assets/valid.wav");
      expect(response.headers.get("content-type")).toMatch(/^audio\//);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
      const range = await request("/assets/valid.wav", { headers: { Range: "bytes=0-31" } });
      expect(range.status).toBe(206);
      expect(Buffer.from(await range.arrayBuffer())).toEqual(bytes.subarray(0, 32));
      for (const method of ["GET", "HEAD"]) {
        const absent = await request("/assets/absent.mp3?cache=1", { method });
        expect(absent.status).toBe(404);
        expect(absent.headers.get("content-type")).not.toMatch(/text\/html/);
      }
      expect((await request("/ordinary-spa-route")).status).toBe(200);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  }, 20000);
  // 에디터에서 팩을 설치하면 파일은 public/ 으로 들어가지만 preview 는 dist/ 를 서빙한다.
  // 폴백이 없으면 재빌드 전까지 새로 받은 281곡이 전부 404 다.
  it("preview 는 dist 에 없는 카탈로그 파일을 public 에서 서빙한다", async () => {
    const root = await mkdtemp(join(tmpdir(), "audio-preview-fallback-"));
    const bytes = await readFile("public/assets/cc0/audio/ui-confirm.wav");
    await mkdir(join(root, "public/assets/cc0/audio/catalog"), { recursive: true });
    await mkdir(join(root, "dist/assets"), { recursive: true });
    // public 에만 둔다 — 설치 직후 재빌드 전 상태를 그대로 재현한다.
    await copyFile("public/assets/cc0/audio/ui-confirm.wav", join(root, "public/assets/cc0/audio/catalog/late.wav"));
    await writeFile(join(root, "index.html"), "<!doctype html><title>SPA shell</title>");
    await copyFile(join(root, "index.html"), join(root, "dist/index.html"));
    const server = await preview({ configFile: false, root, cacheDir: join(root, ".cache"), logLevel: "silent",
      optimizeDeps: { noDiscovery: true, include: [] }, plugins: [audioDeliveryPlugin()],
      preview: { host: "127.0.0.1", port: 0 } });
    try {
      const address = server.httpServer?.address();
      if (!address || typeof address === "string") throw new Error("Missing isolated TCP server");
      const request = (path: string, init?: RequestInit) =>
        fetch(`http://127.0.0.1:${address.port}${path}`, { ...init, signal: AbortSignal.timeout(10000) });
      const response = await request("/assets/cc0/audio/catalog/late.wav");
      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
      // 폴백은 기본 정적 미들웨어를 안 거치므로 Range 를 직접 지켜야 한다.
      const range = await request("/assets/cc0/audio/catalog/late.wav", { headers: { Range: "bytes=0-31" } });
      expect(range.status).toBe(206);
      expect(Buffer.from(await range.arrayBuffer())).toEqual(bytes.subarray(0, 32));
      const suffix = await request("/assets/cc0/audio/catalog/late.wav", { headers: { Range: "bytes=-32" } });
      expect(suffix.status).toBe(206);
      expect(Buffer.from(await suffix.arrayBuffer())).toEqual(bytes.subarray(-32));
      const head = await request("/assets/cc0/audio/catalog/late.wav", { method: "HEAD" });
      expect(head.headers.get("content-length")).toBe(String(bytes.length));
      expect(await head.text()).toBe("");
      for (const value of [`bytes=${bytes.length}-`, "bytes=-0"]) {
        const invalid = await request("/assets/cc0/audio/catalog/late.wav", { headers: { Range: value } });
        expect(invalid.status).toBe(416);
        expect(invalid.headers.get("content-range")).toBe(`bytes */${bytes.length}`);
        expect(await invalid.text()).toBe("");
      }
      expect((await request("/assets/cc0/audio/catalog/absent.mp3")).status).toBe(404);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  }, 20000);
});

describe("audioDescriptionSessionPrompt", () => {
  isolateTimers();
  function readReply(callId: string, resourceId: string): ChatResult {
    return {
      message: {
        role: "assistant",
        content: "",
        tool_calls: [{
          id: callId,
          type: "function",
          function: {
            name: "get_audio_resource",
            arguments: JSON.stringify({ kind: "music", resourceId, reason: "Inspect the current audio description" }),
          },
        }],
      },
      finishReason: "tool_calls",
      usage: { prompt_tokens: 1000, completion_tokens: 10 },
    };
  }
  // Heavy under CI load (15s default is too tight): runs a real AssistantSession with compaction.
  describe("audio detail after session compaction", { timeout: 120_000 }, () => {
    it("returns current full detail when a clean session is synchronized after compaction", async () => {
      // Given: a real old tool result, followed by enough history for manual compaction.
      const oldDescription = "AUDIO_OLD_7E2A";
      const description = `AUDIO_CURRENT_4F9C ${"detail ".repeat(600)}`.slice(0, 4000).trim();
      const ctx: ToolContext = { project: audioPromptProject("music", [oldDescription]) };
      const resourceId = uploadId("music", 0);
      const filler: ChatResult = {
        message: { role: "assistant", content: "history ".repeat(5000) },
        finishReason: "stop",
        usage: { prompt_tokens: 1000, completion_tokens: 10 },
      };
      const replies: ChatResult[] = [
        readReply("audio-before", resourceId),
        filler, filler, filler, filler,
        {
          message: { role: "assistant", content: JSON.stringify({ snapshot: "AUDIO_SUMMARY" }) },
          finishReason: "stop",
        },
        readReply("audio-after", resourceId),
        { message: { role: "assistant", content: "DONE" }, finishReason: "stop" },
      ];
      const requests: {
        readonly messages: readonly ChatMessage[];
        readonly tools: readonly string[];
      }[] = [];
      const chat = async (_config: AiConfig, request: ChatRequest): Promise<ChatResult> => {
        requests.push({
          messages: structuredClone(request.messages),
          tools: request.tools?.map(tool => tool.function.name) ?? [],
        });
        const reply = replies.shift();
        assert.ok(reply, "Unexpected additional model request");
        return reply;
      };
      const session = new AssistantSession(ctx.project, { config: AUDIO_TEST_CONFIG, chat });
      await session.sendUserMessage("get_audio_resource", () => undefined);
      const oldTool = session.getMessages().find(message => message.tool_call_id === "audio-before");
      const oldData = requireRecord("old tool result", JSON.parse(requireString("content", oldTool?.content)));
      expect(oldData).toMatchObject({
        ok: true, data: { resource: { description: oldDescription } },
      });
      for (let turn = 0; turn < 3; turn += 1) {
        await session.sendUserMessage(`history-${turn}`, () => undefined);
      }
      const compacted = await session.compactNow();
      assert.equal(compacted.kind, "done");
      expect(session.getMessages().some(isCompactionSummaryMessage)).toBe(true);
      expect(session.getMessages().some(message => message.tool_call_id === "audio-before")).toBe(false);
      const edited = runTool(ctx, "set_audio_description", {
        kind: "music", resourceId, action: "set", description,
      });
      assert.ok(edited.ok, edited.summary);
      assert.ok(session.syncBaselineFromStoreIfClean(ctx.project));

      // When: execute the fresh detail tool through the existing session loop.
      const result = await session.sendUserMessage("get_audio_resource", () => undefined);

      // Then: the next model request receives the real tool's current, unabridged data.
      const sent = requests.at(-1);
      assert.ok(sent);
      const toolMessage = sent.messages.find(message => message.tool_call_id === "audio-after");
      const payload = requireRecord("tool result", JSON.parse(requireString("content", toolMessage?.content)));
      expect(result.stoppedReason).toBe("final");
      expect(sent.tools).toContain("get_audio_resource");
      expect(payload).toMatchObject({
        ok: true,
        data: { resource: { id: resourceId, description, descriptionSource: "project" } },
      });
      expect(description.length).toBeGreaterThan(2000);
      const system = requireString("system", sent.messages.find(message => message.role === "system")?.content);
      expect(system.includes(description)).toBe(false);
      expect(replies).toHaveLength(0);
    });
  });
});

describe("audioDescriptionToolStore", () => {
  isolateTimers();
  const SET_ARGS = {
    kind: "music", resourceId: MUSIC_ID, action: "set", description: "accepted sentinel",
  } as const;
  beforeEach(() => {
    vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "");
    vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "");
    vi.stubEnv("VITE_LEGACY_DB_URL", "");
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(audioDescriptionToolProject());
    resetMapEditHistory();
  });
  afterEach(() => {
    resetMapEditHistory();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  describe("audio description store adapter", () => {
    it("leaves the live project and history unchanged when a preview is discarded", () => {
      // Given
      const before = structuredClone(store.getCurrent());
      // When
      const result = previewTool("set_audio_description", SET_ARGS);
      // Then
      expect(result.ok, result.summary).toBe(true);
      expect(result.diff).toMatchObject({ audioDescriptionsChanged: 1 });
      expect(store.getCurrent()).toEqual(before);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
    });

    it("applies only the description when a detached proposal is accepted", async () => {
      // Given
      const before = structuredClone(store.getCurrent());
      const ctx: ToolContext = { project: store.getCurrent() };
      const base = captureProposalBase(ctx.project);
      const preview = runTool(ctx, "set_audio_description", SET_ARGS);
      expect(preview.ok, preview.summary).toBe(true);
      expect(store.getCurrent()).toEqual(before);
      // When
      const applied = await applyProposedProject(ctx.project, {
        base,
        baseline: new AuthoredProjectBaseline(before),
        source: "agent", agentName: "test-agent", summary: "fixture",
        toolNames: ["set_audio_description"],
      });
      // Then
      expect(applied.ok).toBe(true);
      expect(store.getCurrent()).toEqual({
        ...before, audioDescriptions: { music: { [MUSIC_ID]: SET_ARGS.description } },
      });
      expect(getMapEditHistoryEntries()).toHaveLength(1);
      expect(runTool({ project: store.getCurrent() }, "get_audio_resource", {
        kind: "music", resourceId: MUSIC_ID,
      }).data).toMatchObject({ resource: { description: SET_ARGS.description, descriptionSource: "project" } });
      // 제안 적용(applyProposedProject)은 기준 사본·검증을 거쳐 ci-full 샤드(ubuntu-latest)에서 15.7~15.9초가 걸려 기본 15초 상한 언저리다 — 45206810315 에서 17.4초로 넘었다.
    }, 60_000);

    it("restores the previous clear when an accepted edit is undone", () => {
      // Given
      const before = audioDescriptionToolProject();
      before.audioDescriptions = { music: { [MUSIC_ID]: "" } };
      store.replace(before);
      expect(applyToolToStore("set_audio_description", SET_ARGS).ok).toBe(true);
      // When
      const undone = undoMapEdit();
      // Then
      expect(undone).toBe(true);
      expect(store.getCurrent()).toEqual(before);
    });

    it("restores the accepted description when an undone edit is redone", () => {
      // Given
      expect(applyToolToStore("set_audio_description", SET_ARGS).ok).toBe(true);
      const accepted = structuredClone(store.getCurrent());
      expect(undoMapEdit()).toBe(true);
      // When
      const redone = redoMapEdit();
      // Then
      expect(redone).toBe(true);
      expect(store.getCurrent()).toEqual(accepted);
    });

    it("restores the override when reset is undone", () => {
      // Given
      const before = audioDescriptionToolProject();
      before.audioDescriptions = { music: { [MUSIC_ID]: "before reset" } };
      store.replace(before);
      expect(applyToolToStore("set_audio_description", {
        kind: "music", resourceId: MUSIC_ID, action: "reset",
      }).ok).toBe(true);
      expect(Object.hasOwn(store.getCurrent(), "audioDescriptions")).toBe(false);
      // When
      const undone = undoMapEdit();
      // Then
      expect(undone).toBe(true);
      expect(store.getCurrent()).toEqual(before);
    });

    it("rejects the entire sequence when a later description edit is invalid", () => {
      // Given
      const before = structuredClone(store.getCurrent());
      // When
      const results = applyToolSequenceToStore([
        { name: "set_audio_description", args: SET_ARGS },
        { name: "set_audio_description", args: { ...SET_ARGS, resourceId: "missing-audio" } },
      ]);
      // Then
      expect(results.map(result => result.ok)).toEqual([true, false]);
      expect(store.getCurrent()).toEqual(before);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
    });
  });
});
