import { strict as assert } from "node:assert";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runEventCommandAssist } from "@/ai/eventCommandAssist";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { requireArray, requireRecord, requireString } from "@/project/io/guards";
import type { Command } from "@/project/types";
import {
  AUDIO_TEST_CONFIG,
  audioPromptProject,
  parseAudioPrompt,
  uploadId,
} from "./support/audioPrompt";

afterEach(() => vi.unstubAllGlobals());

/** Substitute only the HTTP boundary; prompt building and validation remain real. */
function captureRequests(responses: readonly (readonly Command[])[]) {
  const requests: { readonly system: string; readonly user: string }[] = [];
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (_input, init) => {
    const body = requireRecord("request", JSON.parse(requireString("body", init?.body)));
    const messages = requireArray("messages", body.messages).map(value => requireRecord("message", value));
    requests.push({
      system: requireString("system", messages.find(message => message.role === "system")?.content),
      user: requireString("user", messages.find(message => message.role === "user")?.content),
    });
    const commands = responses[requests.length - 1];
    assert.ok(commands, "Unexpected additional HTTP request");
    return new Response(JSON.stringify({
      choices: [{
        message: { role: "assistant", content: JSON.stringify(commands) },
        finish_reason: "stop",
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }));
  return requests;
}

describe("event audio request transport", () => {
  it("selects from the submitted request when stale context text differs", async () => {
    // Given
    const query = "AUDIO_REQUEST_9E4B";
    const project = audioPromptProject(
      "music", Array.from({ length: 50 }, (_, index) => index === 49 ? query : undefined),
    );
    const resourceId = uploadId("music", 49);
    const commands: Command[] = [{ kind: "playAudio", resourceId, loop: true }];
    const requests = captureRequests([commands]);
    const context = {
      project, mapId: project.startMapId, requestText: "AUDIO_STALE_1C8D",
    };
    // When
    const result = await runEventCommandAssist({ config: AUDIO_TEST_CONFIG, prompt: query, context });
    // Then
    const request = requests[0];
    assert.ok(request);
    expect(request.user).toBe(query);
    expect(parseAudioPrompt(request.system, "music").entries[0]).toMatchObject({
      id: resourceId, description: query, descriptionSource: "project",
    });
    expect(result).toMatchObject({ commands, attempts: 1 });
  });

  it("sends the new effective description when the next request follows an accepted edit", async () => {
    // Given
    const before = "AUDIO_BEFORE_6D1A";
    const after = "AUDIO_AFTER_2F8C";
    const ctx: ToolContext = {
      project: audioPromptProject(
        "sound", Array.from({ length: 50 }, (_, index) => index === 49 ? before : undefined),
      ),
    };
    const resourceId = uploadId("sound", 49);
    const commands: Command[] = [{ kind: "playAudio", resourceId, loop: false }];
    const requests = captureRequests([commands, commands]);
    await runEventCommandAssist({
      config: AUDIO_TEST_CONFIG, prompt: before,
      context: { project: ctx.project, mapId: ctx.project.startMapId },
    });
    const edited = runTool(ctx, "set_audio_description", {
      kind: "sound", resourceId, action: "set", description: after,
    });
    assert.ok(edited.ok, edited.summary);
    // When
    await runEventCommandAssist({
      config: AUDIO_TEST_CONFIG, prompt: after,
      context: { project: ctx.project, mapId: ctx.project.startMapId },
    });
    // Then
    expect(requests.map(request =>
      parseAudioPrompt(request.system, "sound").entries.find(entry => entry.id === resourceId)?.description,
    )).toEqual([before, after]);
  });

  it("repairs a search-wrapper ID when the model first returns it as an event resource ID", async () => {
    // Given
    const project = audioPromptProject("music", ["AUDIO_REPAIR_3A7F"]);
    const resourceId = uploadId("music", 0);
    const commands: Command[] = [{ kind: "playAudio", resourceId, loop: true }];
    const requests = captureRequests([
      [{ kind: "playAudio", resourceId: `bgm:${resourceId}`, loop: true }],
      commands,
    ]);
    // When
    const result = await runEventCommandAssist({
      config: AUDIO_TEST_CONFIG, prompt: "AUDIO_REPAIR_3A7F",
      context: { project, mapId: project.startMapId },
    });
    // Then
    expect(result).toMatchObject({ commands, attempts: 2 });
    expect(requests).toHaveLength(2);
  });
});
