import { afterEach, describe, expect, it, vi } from "vitest";
import { strict as assert } from "node:assert";
import { runEventCommandAssist } from "@/ai/eventCommandAssist";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { requireArray, requireRecord, requireString } from "@/project/io/guards";
import type { Command } from "@/project/types";
import { AUDIO_TEST_CONFIG, audioPromptProject, parseAudioPrompt, uploadId } from "./support/audioPrompt";
import { audioDescriptionToolProject, MUSIC_ID, SOUND_ID } from "./support/audioDescriptionToolProject";
import { applyBlueprintOpening } from "@/editor/tools/blueprintOpening";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { isolateTimers } from "./mergedTeardown";

describe("audioDescriptionPromptTransport", () => {
  isolateTimers();
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
});

describe("audioDescriptionResourceLifecycle", () => {
  isolateTimers();
  describe("uploaded resource description lifecycle", () => {
    it("removes an imported audio profile when its asset is deleted", () => {
      const project = audioDescriptionToolProject();
      project.resourceProfiles.push({ kind: "music", name: "Imported", assetId: MUSIC_ID });
      const ctx: ToolContext = { project };

      const result = runTool(ctx, "delete_resource", { resourceId: MUSIC_ID });

      expect(result.ok).toBe(true);
      expect(ctx.project.resourceProfiles.some(profile => profile.assetId === MUSIC_ID)).toBe(false);
      expect(runTool(ctx, "get_audio_resource", { kind: "music", resourceId: MUSIC_ID }).ok).toBe(false);
    });

    it("retains a referenced imported audio asset and its profile", () => {
      const project = audioDescriptionToolProject();
      project.resourceProfiles.push({ kind: "music", name: "Imported", assetId: MUSIC_ID });
      project.system.defaultBgmResourceId = MUSIC_ID;
      const before = structuredClone(project);
      const ctx: ToolContext = { project };

      const result = runTool(ctx, "delete_resource", { resourceId: MUSIC_ID });

      expect(result.ok).toBe(false);
      expect(ctx.project).toEqual(before);
    });

    it.each(["music", "sound"] as const)("writes a description when upserting new %s", (kind) => {
      // Given
      const ctx: ToolContext = { project: audioDescriptionToolProject() };
      // When
      const result = runTool(ctx, "upsert_resource", {
        resource: { id: "qa-new-audio", name: "New audio", kind, description: "  sentinel\nline  " },
      });
      // Then
      expect(result.ok, result.summary).toBe(true);
      expect(result.diff).toMatchObject({ audioDescriptionsChanged: 1 });
      expect(ctx.project.audioDescriptions).toEqual({ [kind]: { "qa-new-audio": "sentinel\nline" } });
      expect(ctx.project.assets.uploaded["qa-new-audio"]?.meta).toEqual({});
      expect(runTool(ctx, "get_audio_resource", { kind, resourceId: "qa-new-audio" }).data)
        .toMatchObject({ resource: { description: "sentinel\nline", descriptionSource: "project" } });
    });

    it("preserves the description when upsert omits it", () => {
      // Given
      const project = audioDescriptionToolProject();
      project.audioDescriptions = { music: { [MUSIC_ID]: "" }, sound: { [SOUND_ID]: "sibling" } };
      const ctx: ToolContext = { project };
      // When
      const result = runTool(ctx, "upsert_resource", {
        resource: { id: MUSIC_ID, name: "Renamed", kind: "music" },
      });
      // Then
      expect(result.ok, result.summary).toBe(true);
      expect(result.diff).toMatchObject({ audioDescriptionsChanged: 0 });
      expect(ctx.project.audioDescriptions).toEqual(project.audioDescriptions);
      expect(ctx.project.assets.uploaded[MUSIC_ID]?.dataUrl).toBe(project.assets.uploaded[MUSIC_ID]?.dataUrl);
    });

    it("retains an explicit clear when upsert supplies an empty description", () => {
      // Given
      const project = audioDescriptionToolProject();
      project.audioDescriptions = { music: { [MUSIC_ID]: "old" } };
      const ctx: ToolContext = { project };
      // When
      const result = runTool(ctx, "upsert_resource", {
        resource: { id: MUSIC_ID, name: "Audio", kind: "music", description: "" },
      });
      // Then
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.audioDescriptions).toEqual({ music: { [MUSIC_ID]: "" } });
    });

    it.each([undefined, null, 1, false, [], {}, "x".repeat(4001)])(
      "rejects invalid nested descriptions before changing an upload when given %j", (description) => {
        // Given
        const project = audioDescriptionToolProject();
        const before = structuredClone(project);
        const ctx: ToolContext = { project };
        // When
        const result = runTool(ctx, "upsert_resource", {
          resource: { id: MUSIC_ID, name: "Changed", kind: "music", description },
        });
        // Then
        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-args" })]));
        expect(ctx.project).toBe(project);
        expect(project).toEqual(before);
      },
    );

    it("rejects descriptions on non-audio resources", () => {
      // Given
      const project = audioDescriptionToolProject();
      const before = structuredClone(project);
      const ctx: ToolContext = { project };
      // When
      const result = runTool(ctx, "upsert_resource", {
        resource: { id: "qa-picture", name: "Picture", kind: "picture", description: "" },
      });
      // Then
      expect(result.ok).toBe(false);
      expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-args" })]));
      expect(project).toEqual(before);
      expect(ctx.project).toBe(project);
    });

    it("removes only the deleted upload's kind and ID override when deletion succeeds", () => {
      // Given
      const project = audioDescriptionToolProject();
      project.audioDescriptions = {
        music: { [MUSIC_ID]: "" },
        sound: { [MUSIC_ID]: "other partition", [SOUND_ID]: "other resource" },
      };
      const ctx: ToolContext = { project };
      // When
      const result = runTool(ctx, "delete_resource", { resourceId: MUSIC_ID });
      // Then
      expect(result.ok, result.summary).toBe(true);
      expect(result.diff).toMatchObject({ audioDescriptionsChanged: 1 });
      expect(ctx.project.assets.uploaded[MUSIC_ID]).toBeUndefined();
      expect(ctx.project.audioDescriptions).toEqual({
        sound: { [MUSIC_ID]: "other partition", [SOUND_ID]: "other resource" },
      });
    });

    it("preserves the description when a referenced upload cannot be deleted", () => {
      // Given
      const project = audioDescriptionToolProject();
      project.system.defaultBgmResourceId = MUSIC_ID;
      project.audioDescriptions = { music: { [MUSIC_ID]: "preserved" } };
      const before = structuredClone(project);
      const ctx: ToolContext = { project };
      // When
      const result = runTool(ctx, "delete_resource", { resourceId: MUSIC_ID });
      // Then
      expect(result.ok).toBe(false);
      expect(ctx.project).toBe(project);
      expect(project).toEqual(before);
    });
  });
});

// 청사진 기본 오프닝(bp-open-*) — 맵 조각만 넘기던 장면에 그 맵에 선 사람·끝까지 남는 자막을 넣고, 첫 순간을 덮던 전환을 뺀다.
// 2026-11-11 Terra 네 판 장부: «인물이 한 명도 없고 대사 상자도 없이 맵 일부만», «시작 프레임이 붉은 점무늬».
describe("blueprintOpeningCast", () => {
  isolateTimers();
  type Layer = { id: string; kind: string; role?: string; x: number; y: number; width: number; height: number; walk?: { holdFrame?: number; frames: number[] }; caption?: { fadeOutMs?: number; cues: { text: string }[] } };
  type Scene = { id: string; composition: { height: number; letterbox?: number; transition?: { kind: string }; layers: Layer[] } };
  function fixture() {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.lowerTiles[3] = (map.lowerTiles[0] ?? 0) + 1; // 그릴 것이 있는 맵
    const person = (id: string, x: number, y: number, pattern: number, conditions: unknown[] = []) =>
      ({ id, name: id, x, y, pages: [{ conditions, graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern }, trigger: "action", commands: [] }] });
    // 맨 아래 줄에 선 촌장(자막 띠에 가려지던 자리)과, 스위치가 켜진 뒤에야 나타나는 사람.
    map.events.push(person("ev_elder", 6, map.height - 1, 31) as never, person("ev_later", 8, 6, 79, [{ kind: "switch", switchId: "sw_later", value: true }]) as never);
    project.gameBlueprint = {
      title: "시험", genre: "모험", playerGoal: "촌장과 이야기하고 샘을 되살리자.", places: [{ name: map.name }],
      steps: [{ id: "s1", kind: "talk", place: map.name, action: "촌장에게 샘의 사연을 듣는다", feeling: "따뜻한 마을에 닥친 위기" }], ending: { name: "끝", how: "샘이 돌아왔다." },
    } as never;
    return project;
  }
  describe("청사진 기본 오프닝 — 선 사람·자막·전환", () => {
    it("장면마다 cut 으로 들어오고, 자막이 장면 끝까지 남는다", () => {
      const project = fixture();
      expect(applyBlueprintOpening(project)).toHaveLength(1);
      const scenes = (project.system.opening?.scenes ?? []) as unknown as Scene[];
      expect(scenes.length).toBeGreaterThanOrEqual(2);
      for (const scene of scenes) {
        expect(scene.id.startsWith("bp-open-"), scene.id).toBe(true);
        expect(scene.composition.transition?.kind, scene.id).toBe("cut");
        const caption = scene.composition.layers.find((l) => l.kind === "caption");
        expect(caption?.caption?.cues[0]?.text, scene.id).toBeTruthy();
        expect(caption?.caption?.fadeOutMs, scene.id).toBe(0);
      }
    }, 60_000);

    it("그 맵에 처음부터 선 사람을 제 칸에 세운다 — 맨 아래 줄의 사람도 자막 띠 위에 보이고, 나중에 나타나는 사람은 없다", () => {
      const project = fixture();
      applyBlueprintOpening(project);
      const scenes = (project.system.opening?.scenes ?? []) as unknown as Scene[];
      const first = scenes[0]!.composition;
      const bar = Math.ceil(first.height * (first.letterbox ?? 0));
      const bg = first.layers.find((l) => l.role === "background")!;
      // 배경은 자막 띠 사이에만 깔린다.
      expect([bg.y, bg.height]).toEqual([bar, first.height - 2 * bar]);
      const people = first.layers.filter((l) => l.role === "actor");
      expect(people.map((l) => l.walk?.holdFrame)).toEqual([31]);
      expect(people[0]!.walk?.frames).toEqual([31]); // 서 있는 한 칸(걷는 연기 없음)
      expect(people[0]!.y + people[0]!.height).toBeLessThanOrEqual(first.height - bar);
      expect(people[0]!.y).toBeGreaterThanOrEqual(bar);
      // 마지막 장면에는 주인공이 시작 칸에 선다.
      const last = scenes[scenes.length - 1]!.composition.layers;
      expect(last.some((l) => l.id === "hero" && l.role === "actor")).toBe(true);
    }, 60_000);
  });
});
