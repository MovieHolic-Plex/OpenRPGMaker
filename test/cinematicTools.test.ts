import { describe, expect, it } from "vitest";
import { listDatabaseResourceOptions, type DatabaseResourcePickerKind } from "@/editor/panels/databaseResourcePickerDialog";
import { getTool } from "@/editor/tools";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { CinematicSequence, Project } from "@/project/types";

const PICTURE = "picture-upload";
const MOVIE = "movie-upload";
const VOICE = "voice-upload";

function mediaProject(): Project {
  const project = createBlankProject();
  project.assets.uploaded[PICTURE] = {
    id: PICTURE, name: "표지 그림", kind: "picture", dataUrl: "data:image/png;base64,AAAA", meta: {},
  };
  project.assets.uploaded[MOVIE] = {
    id: MOVIE, name: "인트로 영상", kind: "movie", dataUrl: "data:video/webm;base64,AAAA", meta: {},
  };
  project.assets.uploaded[VOICE] = {
    id: VOICE, name: "내레이션", kind: "sound", dataUrl: "data:audio/ogg;base64,AAAA", meta: {},
  };
  project.resourceProfiles.push(
    { kind: "movie", name: "프로필 영상", assetId: "profile-movie" },
    { kind: "movie", name: "업로드 영상", assetId: MOVIE },
  );
  return project;
}

function context(): ToolContext {
  return { project: mediaProject() };
}

function opening(ctx: ToolContext): CinematicSequence | undefined {
  return ctx.project.system.opening;
}

function failure(result: ToolResult): string {
  return [result.summary, ...(result.issues ?? []).map((issue) => issue.message)].join("\n");
}

function catalogIds(kind: DatabaseResourcePickerKind, project: Project): string[] {
  return listDatabaseResourceOptions(kind, project).map((entry) => entry.id);
}

describe("opening cinematic AI tools", () => {
  it("authors a three-scene custom opening that survives save and reload", () => {
    const ctx = context();

    const result = runTool(ctx, "set_opening", {
      enabled: true,
      skippable: false,
      scenes: [
        { kind: "text", narration: "폭풍우 치던 밤, 편지 한 장이 남았다.", durationMs: 0 },
        { id: "scene-still", kind: "image", resourceId: PICTURE, narration: "그날의 사진", durationMs: 4000, motion: "zoom" },
        { kind: "video", resourceId: MOVIE, narrationAudioResourceId: VOICE, narration: "기억은 영상으로 남았다.", durationMs: 0 },
      ],
    });

    expect(result.ok, failure(result)).toBe(true);
    expect(opening(ctx)).toEqual({
      enabled: true,
      skippable: false,
      scenes: [
        { id: "opening-scene-1", kind: "text", narration: "폭풍우 치던 밤, 편지 한 장이 남았다.", durationMs: 0 },
        { id: "scene-still", kind: "image", resourceId: PICTURE, narration: "그날의 사진", durationMs: 4000, motion: "zoom" },
        { id: "opening-scene-3", kind: "video", resourceId: MOVIE, narrationAudioResourceId: VOICE, narration: "기억은 영상으로 남았다.", durationMs: 0 },
      ],
    });

    const reloaded = deserialize(serialize(ctx.project));
    expect(reloaded.system.opening).toEqual(opening(ctx));
  });

  it("reads the authored opening back without materializing a missing one", () => {
    const empty = context();
    const missing = runTool(empty, "get_opening", {});
    expect(missing.ok, failure(missing)).toBe(true);
    expect((missing.data as { opening: unknown }).opening).toBeNull();
    expect(opening(empty)).toBeUndefined();

    const ctx = context();
    expect(runTool(ctx, "set_opening", {
      scenes: [{ kind: "text", narration: "시작", durationMs: 0 }],
    }).ok).toBe(true);

    const read = runTool(ctx, "get_opening", {});
    expect(read.ok, failure(read)).toBe(true);
    expect(read.data).toMatchObject({
      opening: { enabled: true, skippable: true, scenes: [{ kind: "text", narration: "시작", durationMs: 0 }] },
      sceneCount: 1,
    });
    expect(read.summary).toContain("1");
  });

  it("keeps unrelated system sections untouched", () => {
    const ctx = context();
    expect(runTool(ctx, "set_title_screen", { title: "내 게임" }).ok).toBe(true);
    const before = JSON.stringify(ctx.project.system.titleScreen);

    expect(runTool(ctx, "set_opening", { scenes: [{ kind: "text", narration: "시작", durationMs: 0 }] }).ok).toBe(true);

    expect(JSON.stringify(ctx.project.system.titleScreen)).toBe(before);
    expect(deserialize(serialize(ctx.project)).system.opening?.scenes).toHaveLength(1);
  });

  it("rejects scene fields that do not belong to the scene kind", () => {
    const ctx = context();

    const textWithMedia = runTool(ctx, "set_opening", {
      scenes: [{ kind: "text", narration: "글", resourceId: PICTURE, durationMs: 0 }],
    });
    expect(textWithMedia.ok).toBe(false);
    expect(failure(textWithMedia)).toContain("텍스트");

    const imageWithoutMedia = runTool(ctx, "set_opening", {
      scenes: [{ kind: "image", narration: "그림", durationMs: 3000, motion: "fade" }],
    });
    expect(imageWithoutMedia.ok).toBe(false);
    expect(failure(imageWithoutMedia)).toContain("resourceId");

    const videoWithMotion = runTool(ctx, "set_opening", {
      scenes: [{ kind: "video", resourceId: MOVIE, narration: "영상", durationMs: 0, motion: "pan" }],
    });
    expect(videoWithMotion.ok).toBe(false);
    expect(failure(videoWithMotion)).toContain("motion");

    const badMotion = runTool(ctx, "set_opening", {
      scenes: [{ kind: "image", resourceId: PICTURE, narration: "그림", durationMs: 3000, motion: "spin" }],
    });
    expect(badMotion.ok).toBe(false);

    expect(opening(ctx)).toBeUndefined();
  });

  it("rejects unknown media ids and points at list_opening_media", () => {
    const ctx = context();

    const unknownPicture = runTool(ctx, "set_opening", {
      scenes: [{ kind: "image", resourceId: "picture-없음", narration: "그림", durationMs: 0, motion: "none" }],
    });
    expect(unknownPicture.ok).toBe(false);
    expect(failure(unknownPicture)).toContain("picture-없음");
    expect(failure(unknownPicture)).toContain("list_opening_media");

    const unknownVoice = runTool(ctx, "set_opening", {
      scenes: [{ kind: "text", narration: "글", durationMs: 0, narrationAudioResourceId: "voice-없음" }],
    });
    expect(unknownVoice.ok).toBe(false);
    expect(failure(unknownVoice)).toContain("voice-없음");

    const wrongKind = runTool(ctx, "set_opening", {
      scenes: [{ kind: "image", resourceId: "cc0-bgm-field", narration: "그림", durationMs: 0, motion: "none" }],
    });
    expect(wrongKind.ok).toBe(false);
    expect(failure(wrongKind)).toContain("cc0-bgm-field");

    expect(opening(ctx)).toBeUndefined();
  });

  it("rejects duplicate, blank and over-limit scene ids", () => {
    const ctx = context();

    const duplicate = runTool(ctx, "set_opening", {
      scenes: [
        { id: "same", kind: "text", narration: "가", durationMs: 0 },
        { id: " same ", kind: "text", narration: "나", durationMs: 0 },
      ],
    });
    expect(duplicate.ok).toBe(false);
    expect(failure(duplicate)).toContain("same");

    const blank = runTool(ctx, "set_opening", {
      scenes: [{ id: "   ", kind: "text", narration: "가", durationMs: 0 }],
    });
    expect(blank.ok).toBe(false);

    const tooMany = runTool(ctx, "set_opening", {
      scenes: Array.from({ length: 101 }, (_, index) => ({ kind: "text", narration: `${index}`, durationMs: 0 })),
    });
    expect(tooMany.ok).toBe(false);
    expect(failure(tooMany)).toContain("100");

    expect(opening(ctx)).toBeUndefined();
  });

  it("rejects non-integer and out-of-range durations", () => {
    const ctx = context();
    for (const durationMs of [1.5, -1, 120_001]) {
      const result = runTool(ctx, "set_opening", { scenes: [{ kind: "text", narration: "가", durationMs }] });
      expect(result.ok, `durationMs=${durationMs}`).toBe(false);
      expect(failure(result)).toContain("durationMs");
    }
    expect(opening(ctx)).toBeUndefined();
  });

  it("keeps authored scenes when the sequence is disabled and warns", () => {
    const ctx = context();
    expect(runTool(ctx, "set_opening", {
      enabled: false,
      scenes: [{ kind: "text", narration: "꺼진 오프닝", durationMs: 0 }],
    }).ok).toBe(true);

    const read = runTool(ctx, "get_opening", {});
    expect(read.ok).toBe(true);
    expect(read.data).toMatchObject({ opening: { enabled: false, scenes: [{ narration: "꺼진 오프닝" }] } });
    expect((read.warnings ?? []).join("\n")).toContain("사용");
    expect(runTool(ctx, "set_opening", { enabled: true, scenes: [] }).ok).toBe(true);
    expect(opening(ctx)).toEqual({ enabled: true, skippable: true, scenes: [] });
  });

  it("removes an authored opening on request", () => {
    const ctx = context();
    expect(runTool(ctx, "set_opening", { scenes: [{ kind: "text", narration: "가", durationMs: 0 }] }).ok).toBe(true);
    expect(opening(ctx)).toBeDefined();

    const removed = runTool(ctx, "remove_opening", {});
    expect(removed.ok, failure(removed)).toBe(true);
    expect(opening(ctx)).toBeUndefined();
    expect(Object.hasOwn(ctx.project.system, "opening")).toBe(false);
    expect(deserialize(serialize(ctx.project)).system.opening).toBeUndefined();

    const again = runTool(ctx, "remove_opening", {});
    expect(again.ok).toBe(false);
  });

  it("finds full-screen art by its actual description and returns selection context", () => {
    const listed = runTool(context(), "list_opening_media", { kind: "image", query: "겨울 신전" });
    expect(listed.ok, failure(listed)).toBe(true);
    expect(listed.data).toMatchObject({ matches: [expect.objectContaining({
      id: "oprn-pack-still-winter-03", group: "배경화", series: "winter",
      description: expect.stringContaining("오로라"), mood: expect.arrayContaining(["신비"]),
      useCases: expect.arrayContaining(["비밀의 암시"]), suitableForOpening: true,
    })] });
    const reference = runTool(context(), "list_opening_media", { kind: "image", query: "oprn-still-quiet-room" });
    expect(reference.data).toMatchObject({ matches: [expect.objectContaining({
      suitableForOpening: false, group: "참고 이미지(오프닝 부적합)",
      cautions: expect.arrayContaining(["분할 화면·게임 대화창·영문 텍스트 포함"]),
    })] });
  });

  it("lists exactly the media the database opening tab offers", () => {
    const ctx = context();

    for (const kind of ["image", "movie", "sound"] as const) {
      const catalog = catalogIds(kind === "image" ? "still" : kind, ctx.project);
      const listed = runTool(ctx, "list_opening_media", { kind });
      expect(listed.ok, failure(listed)).toBe(true);
      const ids = (listed.data as { matches: { id: string }[] }).matches.map((entry) => entry.id);
      expect(ids.length).toBe(Math.min(20, catalog.length));
      expect(ids).toEqual(catalog.slice(0, ids.length));
    }

    expect(catalogIds("image", ctx.project)).toContain(PICTURE);
    expect(catalogIds("movie", ctx.project)).toContain(MOVIE);
    expect(catalogIds("sound", ctx.project)).toContain(VOICE);

    const paged = runTool(ctx, "list_opening_media", { kind: "sound" });
    expect(paged.data).toMatchObject({ total: catalogIds("sound", ctx.project).length, nextOffset: 20 });

    const filtered = runTool(ctx, "list_opening_media", { kind: "movie", query: "프로필" });
    expect((filtered.data as { matches: { id: string }[] }).matches.map((entry) => entry.id)).toEqual(["profile-movie"]);

    const unknownKind = runTool(ctx, "list_opening_media", { kind: "tile" });
    expect(unknownKind.ok).toBe(false);
  });

  it("registers the opening tools as system-domain write facades", () => {
    for (const name of ["set_opening", "remove_opening"]) {
      const definition = getTool(name);
      expect(definition, `${name} is not registered`).toBeDefined();
      expect(definition?.mode).toBe("write");
      expect(definition?.domains).toEqual(["system"]);
    }
    const read = getTool("get_opening");
    expect(read?.mode).toBe("read");
    expect(getTool("list_opening_media")?.mode).toBe("read");
    expect(getTool("recommend_bgm")?.mode).toBe("read");
    expect(getTool("get_audio_resource")?.mode).toBe("read");
    expect(getTool("set_game_over")?.domains).toEqual(["system"]);
  });

  it("authors and reads a game-over background without touching the opening", () => {
    const ctx = context();
    const result = runTool(ctx, "set_game_over", {
      title: "패배",
      message: "어둠이 성을 삼켰다.",
      retryLabel: "다시 도전",
      backgroundResourceId: "easyrpg-backdrop-cosmos1",
    });
    expect(result.ok, failure(result)).toBe(true);
    expect(ctx.project.system.opening).toBeUndefined();
    expect(ctx.project.system.gameOver).toMatchObject({
      title: "패배",
      message: "어둠이 성을 삼켰다.",
      retryLabel: "다시 도전",
      backgroundResourceId: "easyrpg-backdrop-cosmos1",
    });
    const read = runTool(ctx, "get_game_over", {});
    expect(read.ok, failure(read)).toBe(true);
    expect(read.data).toMatchObject({ gameOver: { backgroundResourceId: "easyrpg-backdrop-cosmos1" } });
  });

  it("prepares a game-over image generation handoff", () => {
    const ctx = context();
    const result = runTool(ctx, "generate_game_over_image", { prompt: "비가 내리는 폐허의 왕좌" });
    expect(result.ok, failure(result)).toBe(true);
    expect((result.data as { status?: string } | undefined)?.status).toBe("ui-required");
    expect(getTool("generate_game_over_image")?.name).toBe("generate_game_over_image");
  });
});
