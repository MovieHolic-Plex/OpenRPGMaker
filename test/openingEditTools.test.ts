import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { acceptSharedCharacterGraphics, refreshSharedCharacterGraphics, sharedFaceForCharset } from "@/project/sharedCharacterFaceResolver";
import { defaultSharedCharacterGraphics, SHARED_CHARACTER_GRAPHICS_ENDPOINT } from "@/project/sharedCharacterGraphicsSchema";
import { getTool } from "@/editor/tools";
import { deserialize, serialize } from "@/project/io";
import { collectUsedUploadedAssetIds, collectWebExportAssets } from "@/project/webExportAssets";
import type { CinematicSequence, Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("npcSharedFaceMapping", () => {
  isolateTimers();
  const textureKey = "tex_easyrpg_charset_people1";
  const chosen = "easyrpg-faceset-actor1-09";   // Deliberately unlike the old people1#0 heuristic.
  function catalog(status: "mapped" | "no-face" | "pending" = "mapped") {
    const doc = defaultSharedCharacterGraphics();
    const row = doc.mappings.find(row => row.textureKey === textureKey && row.characterIndex === 0)!;
    row.status = status;
    row.faceResourceId = status === "mapped" ? chosen : null;
    return doc;
  }
  function npc(tool: string, extra: Record<string, unknown> = {}) {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, tool, {
      mapId: ctx.project.startMapId, name: "매핑 확인 주민",
      ...(tool === "make_villager" ? { home: { x: 3, y: 3 } } : { x: 3, y: 3 }),
      graphic: { textureKey, characterIndex: 0 }, pages: [{ lines: ["매핑 확인 대사"] }], ...extra,
    });
    expect(result.ok, result.summary).toBe(true);
    const event = ctx.project.maps[ctx.project.startMapId]!.events.find(event => event.id === (result.data as { eventId: string }).eventId)!;
    expect(event).toBeDefined();
    return event.pages!;
  }
  afterEach(() => { acceptSharedCharacterGraphics(defaultSharedCharacterGraphics()); vi.unstubAllGlobals(); });
  describe.each(["place_npc", "make_villager"])("%s shared face mapping", tool => {
    it("writes the authored mapping into real event commands and survives JSON reload", () => {
      acceptSharedCharacterGraphics(catalog());
      const pages = JSON.parse(JSON.stringify(npc(tool)));
      expect(pages[0].commands[0]).toMatchObject({ kind: "changeFace", resourceId: chosen });
      expect(pages[0].commands.some((command: { kind: string }) => command.kind === "text")).toBe(true);
    });
    it.each(["no-face", "pending"] as const)("does not reintroduce a heuristic portrait for %s", status => {
      acceptSharedCharacterGraphics(catalog(status));
      expect(npc(tool)[0]!.commands.some(command => command.kind === "changeFace")).toBe(false);
    });
    it("keeps explicit face overrides", () => {
      acceptSharedCharacterGraphics(catalog("no-face"));
      // 대응표 밖 얼굴(생성 표정 세트)은 작가 선택으로 그대로 둔다. 번들 얼굴은 걷기 그림의 짝으로 교정된다(faceMatchAudit.test.ts).
      const custom = "shared-brown-headband-expressions-01";
      expect(npc(tool, { face: { resourceId: custom } })[0]!.commands[0]).toMatchObject({ kind: "changeFace", resourceId: custom });
    });
    it("resolves each page graphic, not just the top-level sprite", () => {
      acceptSharedCharacterGraphics(catalog("no-face"));
      const pages = npc(tool, { pages: [{ lines: ["기본"] }, {
        conditions: [{ kind: "selfSwitch", key: "A", value: true }], lines: ["다른 모습"],
        graphic: { textureKey: "tex_easyrpg_charset_actor2", characterIndex: 1 },
      }] });
      expect(pages[0]!.commands.some(command => command.kind === "changeFace")).toBe(false);
      expect(pages[1]!.commands[0]).toMatchObject({ kind: "changeFace", resourceId: "easyrpg-faceset-actor1-09" });
    });
    it("uses a newly fetched server mapping without opening the database tab", async () => {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ document: catalog(), revision: "test" }), { headers: { "Content-Type": "application/json" } }));
      vi.stubGlobal("fetch", fetcher);
      await refreshSharedCharacterGraphics();
      expect(fetcher).toHaveBeenCalledWith(SHARED_CHARACTER_GRAPHICS_ENDPOINT, expect.objectContaining({ cache: "no-store" }));
      expect(npc(tool)[0]!.commands[0]).toMatchObject({ kind: "changeFace", resourceId: chosen });
    });
  });
  it("does not guess absent rows or invalid slots", () => {
    acceptSharedCharacterGraphics({ ...catalog(), mappings: [] });
    expect(sharedFaceForCharset(textureKey, 0)).toBeNull();
    expect(sharedFaceForCharset(textureKey, 8)).toBeNull();
  });
  it("rejects unavailable or invalid host data without replacing the last accepted catalog", async () => {
    acceptSharedCharacterGraphics(catalog());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(refreshSharedCharacterGraphics()).rejects.toThrow("공용");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ document: {} }), { headers: { "Content-Type": "application/json" } })));
    await expect(refreshSharedCharacterGraphics()).rejects.toThrow();
    expect(sharedFaceForCharset(textureKey, 0)?.resourceId).toBe(chosen);
  });
});

// 2026-11-05 gpt-only-game (Terra alone, 「학교 배경 연애 게임」): animate_opening_camera got camera.x as a keyframe
// array and was refused three times ("camera.x: -20000..20000 number required"), so the opening lost its camera move.
describe("openingCameraKeyArrays", () => {
  isolateTimers();
  function shotCamera(ctx: ToolContext): unknown {
    let found: unknown;
    JSON.stringify(ctx.project, (key, value) => {
      if (value && typeof value === "object" && (value as { id?: unknown }).id === "s1" && (value as { kind?: unknown }).kind === "animatic") {
        found = (value as { composition?: { camera?: unknown } }).composition?.camera;
      }
      return value;
    });
    return found;
  }
  describe("animate_opening_camera keyframe arrays", () => {
    it("camera.x as [{atMs,value}] becomes keys.x with the first value as the start", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      expect(runTool(ctx, "create_opening_animatic_shot", { shotId: "s1", width: 384, height: 216, durationMs: 6500 }, { dryRun: false }).ok).toBe(true);
      const result = runTool(ctx, "animate_opening_camera", { shotId: "s1", camera: { x: [{ atMs: 0, value: 0 }, { atMs: 6500, value: 8 }] } }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      expect(shotCamera(ctx)).toMatchObject({ x: 0, keys: { x: [{ atMs: 0, value: 0 }, { atMs: 6500, value: 8 }] } });
    });

    // 2026-11-05 cat exploration: keys sent as one frame per time ([{atMs,x,y,zoom}]) was refused "camera.keys.0: unsupported field".
    it("camera.keys as per-time frames becomes per-property tracks", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      runTool(ctx, "create_opening_animatic_shot", { shotId: "s1", width: 384, height: 216, durationMs: 6500 }, { dryRun: false });
      const result = runTool(ctx, "animate_opening_camera", { shotId: "s1", camera: { keys: [{ atMs: 0, x: 0, y: 0, zoom: 1 }, { atMs: 6500, x: 4, y: 0, zoom: 1.04 }] } }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      expect(shotCamera(ctx)).toMatchObject({ x: 0, zoom: 1, keys: { x: [{ atMs: 0, value: 0 }, { atMs: 6500, value: 4 }], zoom: [{ atMs: 0, value: 1 }, { atMs: 6500, value: 1.04 }] } });
    });

    // 2026-11-05 cat exploration: six new shots landed behind the four factory kingdom scenes, so New Game still opened on them.
    it("the first animatic shot clears the untouched factory opening scenes", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      expect(ctx.project.system.opening?.scenes.some((s) => s.kind === "image")).toBe(true);
      runTool(ctx, "create_opening_animatic_shot", { shotId: "s1", width: 384, height: 216, durationMs: 6500 }, { dryRun: false });
      expect(ctx.project.system.opening?.scenes.map((s) => s.id)).toEqual(["s1"]);
    });

    it("an authored image scene is kept when the first animatic shot is added", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      ctx.project.system.opening!.scenes = [{ id: "mine", kind: "image", resourceId: "oprn-still-harbor", narration: "항구의 아침", durationMs: 4000 }];
      runTool(ctx, "create_opening_animatic_shot", { shotId: "s1", width: 384, height: 216, durationMs: 6500 }, { dryRun: false });
      expect(ctx.project.system.opening?.scenes.map((s) => s.id)).toEqual(["mine", "s1"]);
    });

    // 2026-11-05 cat exploration round 4: set_opening_caption{letterbox:14} (pixels) was refused on all five shots, so no caption survived.
    it("a pixel letterbox becomes a ratio of the stage height", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      runTool(ctx, "create_opening_animatic_shot", { shotId: "s1", width: 384, height: 216, durationMs: 6500 }, { dryRun: false });
      const result = runTool(ctx, "set_opening_caption", { shotId: "s1", layerId: "line", letterbox: 32, cues: [{ atMs: 400, text: "숲 곁에 고양이가 살았어요." }] }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      const shot = ctx.project.system.opening?.scenes.find((s) => s.id === "s1") as { composition?: { letterbox?: number } } | undefined;
      expect(shot?.composition?.letterbox).toBe(0.148);
      expect(runTool(ctx, "set_opening_caption", { shotId: "s1", layerId: "line", letterbox: 0.5, cues: [{ atMs: 400, text: "x" }] }, { dryRun: false }).ok).toBe(false);
    });

    it("pixels count on the pixel grid when the stage is larger", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      runTool(ctx, "create_opening_animatic_shot", { shotId: "s1", width: 1280, height: 720, durationMs: 6500 }, { dryRun: false });
      expect(runTool(ctx, "set_opening_pixel_grid", { shotId: "s1", width: 384, height: 216 }, { dryRun: false }).ok).toBe(true);
      const result = runTool(ctx, "set_opening_caption", { shotId: "s1", layerId: "line", letterbox: 32, cues: [{ atMs: 400, text: "x" }] }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      const shot = ctx.project.system.opening?.scenes.find((s) => s.id === "s1") as { composition?: { letterbox?: number } } | undefined;
      expect(shot?.composition?.letterbox).toBe(0.148);
    });

    it("a non-keyframe array is still refused", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      runTool(ctx, "create_opening_animatic_shot", { shotId: "s1", width: 384, height: 216, durationMs: 6500 }, { dryRun: false });
      expect(runTool(ctx, "animate_opening_camera", { shotId: "s1", camera: { x: [1, 2] } }, { dryRun: false }).ok).toBe(false);
    });
  });
});

describe("openingEditTools", () => {
  isolateTimers();
  const BACKDROP = "oprn-pano-sky-day";
  const TITLE_ART = "oprn-still-corridor";
  const MUSIC = "cc0-bgm-rtp-ttl-001";
  const MOVIE = "movie-upload";
  const VOICE = "voice-upload";
  function project(): Project {
    const base = createBlankProject();
    base.assets.uploaded[MOVIE] = {
      id: MOVIE, name: "인트로 영상", kind: "movie", dataUrl: "data:video/webm;base64,AAAA", meta: {},
    };
    base.assets.uploaded[VOICE] = {
      id: VOICE, name: "내레이션", kind: "sound", dataUrl: "data:audio/ogg;base64,AAAA", meta: {},
    };
    return base;
  }
  function context(): ToolContext {
    return { project: project() };
  }
  function opening(ctx: ToolContext): CinematicSequence | undefined {
    return ctx.project.system.opening;
  }
  function failure(result: ToolResult): string {
    return [result.summary, ...(result.issues ?? []).map(issue => issue.message)].join("\n");
  }
  function seed(ctx: ToolContext, count = 3): void {
    const scenes = Array.from({ length: count }, (_, index) => ({
      id: `s${index + 1}`, kind: "text" as const, narration: `장면 ${index + 1}`, durationMs: 0,
    }));
    const result = runTool(ctx, "set_opening", { enabled: true, skippable: true, scenes });
    if (!result.ok) throw new Error(failure(result));
  }
  describe("오프닝 배경음악", () => {
    it("set_opening 이 음악을 저장하고 저장·재로드를 견딘다", () => {
      const ctx = context();
      const result = runTool(ctx, "set_opening", {
        enabled: true,
        musicResourceId: MUSIC,
        scenes: [{ kind: "image", resourceId: BACKDROP, narration: "별이 흘렀다", durationMs: 3000, motion: "zoom" }],
      });
      expect(result.ok, failure(result)).toBe(true);
      expect(opening(ctx)?.musicResourceId).toBe(MUSIC);
      const reloaded = deserialize(serialize(ctx.project));
      expect(reloaded.system.opening?.musicResourceId).toBe(MUSIC);
      expect(reloaded.system.opening?.scenes[0]).toMatchObject({ kind: "image", resourceId: BACKDROP });
    });

    it("효과음·영상 id 를 배경음악으로 받지 않는다", () => {
      const ctx = context();
      for (const bad of ["cc0-se-orp-interface-interface1", MOVIE, "존재하지-않는-곡"]) {
        const result = runTool(ctx, "set_opening", { musicResourceId: bad, scenes: [] });
        expect(result.ok, `${bad} 가 통과했습니다`).toBe(false);
      }
    });
  });
  describe("edit_opening 부분 편집", () => {
    it("빈 프로젝트에 장면을 이어 붙인다", () => {
      // 2026-09-21: 새 프로젝트는 기본 오프닝(장면 4개)이 이미 있다. «빈 프로젝트» 시나리오는
      // 오프닝 없는 상태를 명시적으로 만들어 검증한다.
      const ctx = context();
      delete ctx.project.system.opening;
      const result = runTool(ctx, "edit_opening", {
        op: "append", scene: { kind: "image", resourceId: BACKDROP, narration: "시작", durationMs: 2000 },
      });
      expect(result.ok, failure(result)).toBe(true);
      expect(opening(ctx)?.scenes).toHaveLength(1);
      expect(opening(ctx)?.enabled).toBe(true);
    });

    it("insert·update·move·remove 가 순서를 정확히 지킨다", () => {
      const ctx = context();
      seed(ctx);
      expect(runTool(ctx, "edit_opening", {
        op: "insert", index: 1, scene: { id: "mid", kind: "text", narration: "끼워넣기", durationMs: 0 },
      }).ok).toBe(true);
      expect(opening(ctx)?.scenes.map(scene => scene.id)).toEqual(["s1", "mid", "s2", "s3"]);

      expect(runTool(ctx, "edit_opening", {
        op: "update", sceneId: "mid", scene: { kind: "image", resourceId: TITLE_ART, narration: "그림으로", durationMs: 1500, motion: "pan" },
      }).ok).toBe(true);
      expect(opening(ctx)?.scenes[1]).toMatchObject({ id: "mid", kind: "image", resourceId: TITLE_ART, motion: "pan" });

      expect(runTool(ctx, "edit_opening", { op: "move", sceneId: "mid", index: 3 }).ok).toBe(true);
      expect(opening(ctx)?.scenes.map(scene => scene.id)).toEqual(["s1", "s2", "s3", "mid"]);

      expect(runTool(ctx, "edit_opening", { op: "remove", sceneId: "s2" }).ok).toBe(true);
      expect(opening(ctx)?.scenes.map(scene => scene.id)).toEqual(["s1", "s3", "mid"]);
    });

    it("시퀀스 설정만 따로 바꾼다", () => {
      const ctx = context();
      seed(ctx, 1);
      const result = runTool(ctx, "edit_opening", { op: "settings", enabled: false, skippable: false, musicResourceId: MUSIC });
      expect(result.ok, failure(result)).toBe(true);
      expect(opening(ctx)).toMatchObject({ enabled: false, skippable: false, musicResourceId: MUSIC });
      expect(opening(ctx)?.scenes).toHaveLength(1);
      expect(runTool(ctx, "edit_opening", { op: "settings", musicResourceId: "" }).ok).toBe(true);
      expect(opening(ctx)?.musicResourceId).toBeUndefined();
    });

    it("경계를 벗어난 요청을 거부한다", () => {
      const ctx = context();
      seed(ctx);
      const rejects: Record<string, unknown>[] = [
        { op: "insert", index: 9, scene: { kind: "text", narration: "범위 밖", durationMs: 0 } },
        { op: "insert", index: -1, scene: { kind: "text", narration: "음수", durationMs: 0 } },
        { op: "move", sceneId: "s1", index: 9 },
        { op: "move", sceneId: "없는장면", index: 0 },
        { op: "update", sceneId: "없는장면", scene: { kind: "text", narration: "x", durationMs: 0 } },
        { op: "remove", sceneId: "없는장면" },
        { op: "append", scene: { id: "s1", kind: "text", narration: "중복 id", durationMs: 0 } },
        { op: "append", scene: { kind: "image", resourceId: MOVIE, narration: "영상 id 를 그림에", durationMs: 0 } },
        { op: "append", scene: { kind: "text", narration: "텍스트에 그림", durationMs: 0, resourceId: BACKDROP } },
        { op: "append", scene: { kind: "video", resourceId: MOVIE, narration: "영상에 모션", durationMs: 0, motion: "zoom" } },
        { op: "append", scene: { kind: "image", resourceId: MUSIC, narration: "음악을 그림에", durationMs: 0 } },
        { op: "append", scene: { kind: "image", resourceId: BACKDROP, narration: "시간 초과", durationMs: 999_999 } },
        { op: "지우기", sceneId: "s1" },
        { op: "remove" },
      ];
      for (const args of rejects) {
        const result = runTool(ctx, "edit_opening", args);
        expect(result.ok, `통과하면 안 되는 요청: ${JSON.stringify(args)}`).toBe(false);
      }
      expect(opening(ctx)?.scenes.map(scene => scene.id)).toEqual(["s1", "s2", "s3"]);
    });

    it("장면 상한을 넘기지 않는다", () => {
      const ctx = context();
      seed(ctx, 100);
      const result = runTool(ctx, "edit_opening", { op: "append", scene: { kind: "text", narration: "101번째", durationMs: 0 } });
      expect(result.ok).toBe(false);
      expect(opening(ctx)?.scenes).toHaveLength(100);
    });

    it("오프닝이 없을 때 remove/update/move 는 안내와 함께 거부한다", () => {
      const ctx = context();
      for (const args of [{ op: "remove", sceneId: "s1" }, { op: "move", sceneId: "s1", index: 0 }]) {
        const result = runTool(ctx, "edit_opening", args);
        expect(result.ok).toBe(false);
        expect(failure(result)).toMatch(/오프닝/u);
      }
    });

    it("유니코드 내레이션을 그대로 보존한다", () => {
      const ctx = context();
      const narration = "🌙 별빛\n둘째 줄 — 끝";
      expect(runTool(ctx, "edit_opening", { op: "append", scene: { kind: "text", narration, durationMs: 0 } }).ok).toBe(true);
      // 기본 오프닝이 있는 새 프로젝트에서도 append 는 끝에 붙는다(첫 장면 교체가 아니다).
      expect(opening(ctx)?.scenes.at(-1)?.narration).toBe(narration);
    });
  });
  describe("generate_opening_image", () => {
    // 성공처럼 보이던 ui-required 핸드오프는 없앴다(2026-10-03, editor-ai-tools.md 「Pi 오프닝 제작」). 실행기 연결 없이는 실패다.
    it("생성 실행 경로가 없는 순수 레지스트리 호출은 실패하고 아무것도 등록하지 않는다", () => {
      const ctx = context();
      const result = runTool(ctx, "generate_opening_image", { prompt: "폐허가 된 성문 앞의 새벽" });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("image-generation-unavailable");
      expect(Object.keys(ctx.project.assets.uploaded)).not.toContain("generated-opening-still");
    });

    it("빈 프롬프트를 거부한다", () => {
      const ctx = context();
      for (const prompt of ["", "   ", "짧"]) {
        expect(runTool(ctx, "generate_opening_image", { prompt }).ok).toBe(false);
      }
    });

    it("시스템 도메인 툴로 등록돼 있다", () => {
      expect(getTool("generate_opening_image")?.name).toBe("generate_opening_image");
      expect(getTool("edit_opening")?.name).toBe("edit_opening");
    });
  });
  describe("오프닝 배경음악 저장 계약", () => {
    it("존재하지 않는 음악 참조는 불러오기에서 걸러진다", () => {
      const ctx = context();
      const result = runTool(ctx, "set_opening", { musicResourceId: MUSIC, scenes: [] });
      expect(result.ok, failure(result)).toBe(true);
      const wire = JSON.parse(serialize(ctx.project)) as { system: { opening: { musicResourceId: string } } };
      wire.system.opening.musicResourceId = "없는-음악-id";
      expect(() => deserialize(JSON.stringify(wire))).toThrow(/musicResourceId/u);
    });

    it("내보내기가 오프닝 배경음악 파일을 함께 챙긴다", () => {
      const ctx = context();
      ctx.project.assets.uploaded["upload-bgm"] = {
        id: "upload-bgm", name: "업로드 곡", kind: "music", dataUrl: "data:audio/ogg;base64,AAAA", meta: {},
      };
      expect(runTool(ctx, "set_opening", { musicResourceId: "upload-bgm", scenes: [] }).ok).toBe(true);
      expect([...collectUsedUploadedAssetIds(ctx.project)]).toContain("upload-bgm");

      expect(runTool(ctx, "edit_opening", { op: "settings", musicResourceId: MUSIC }).ok).toBe(true);
      const paths = collectWebExportAssets(ctx.project).map(asset => asset.zipPath);
      expect(paths.some(path => path.toLowerCase().includes("ttl-001") || path.toLowerCase().includes("bgm"))).toBe(true);
    });
  });
});
