import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { listDatabaseResourceOptions, type DatabaseResourcePickerKind } from "@/editor/panels/databaseResourcePickerDialog";
import { getTool } from "@/editor/tools";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { createBlankProject, TILE } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { CinematicSequence, Project, MapId, ClusterRule, GameMap, TileGroupMetadata } from "@/project/types";
import { clusterAssistCopy, clusterRecoveryOffer, presentClusterRecovery, toggleClusterAssistMode } from "@/editor/clusterAssistRecovery";
import { editorState } from "@/editor/editorState";
import { makeTileBrushAssistPanel } from "@/editor/panels/tilePalettePreviewPanel";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { paintTilesBulk, type TilePaintRejection } from "@/editor/tileActions";
import { store } from "@/project/store";
import { resetToastsForTest } from "@/util/toast";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { mergeSurfaceRule } from "@/editor/panels/tilesetKnowledgeWorkspaceState";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { validateClusterRules } from "@/project/lint/clusterRuleValidators";
import { blockedFlag, passableFlag } from "@/project/tilesetPassage";
import { buildPaletteEntries, movePaletteIndex, paletteKeyAction } from "@/editor/panels/commandPalette";
import type { EditorCommand } from "@/editor/commandRegistry";
import { isolateTimers } from "./mergedTeardown";

describe("cinematicTools", () => {
  isolateTimers();
  const PICTURE = "picture-upload";
  const MOVIE = "movie-upload";
  const VOICE = "voice-upload";
  function mediaProject(): Project {
    const project = createBlankProject();
    // 새 프로젝트는 기본 오프닝(kingdom-prologue)을 씨앗으로 들고 태어난다(defaultOpeningSequence). 이 시험은 오프닝이 없는
    // 문서에서 시작하는 도구 계약을 보므로 그 씨앗을 뺀다 — 로드는 빠진 오프닝을 다시 만들지 않는다.
    delete project.system.opening;
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

    it("refuses split-screen / UI-baked reference stills as a title background", () => {
      // jrpg-loop-4 r5-ff2: the title used the 4-panel village reference (oprn-still-hero-dawn) and was rejected by the user.
      for (const id of ["oprn-still-hero-dawn", "oprn-still-quiet-room", "oprn-still-rally", "oprn-still-dream"]) {
        const ctx = context();
        const refused = runTool(ctx, "set_title_screen", { backgroundResourceId: id }, { dryRun: false });
        expect(refused.ok, id).toBe(false);
        expect(ctx.project.system.titleScreen?.backgroundResourceId).not.toBe(id);
      }
      const ctx = context();
      const accepted = runTool(ctx, "set_title_screen", { backgroundResourceId: "oprn-still-kingdom-day" }, { dryRun: false });
      expect(accepted.ok, failure(accepted)).toBe(true);
      expect(ctx.project.system.titleScreen?.backgroundResourceId).toBe("oprn-still-kingdom-day");
    });

    it("lists exactly the media the database opening tab offers", () => {
      const ctx = context();

      for (const kind of ["image", "movie", "sound"] as const) {
        // 도구는 프로젝트에 올린 자료를 먼저 보여 준다(opening_still_* → 나중에 올린 것 순), 그다음 번들 카탈로그 순서다.
        const uploadOrder = Object.keys(ctx.project.assets.uploaded);
        const rank = (id: string) => (uploadOrder.includes(id) ? (id.startsWith("opening_still_") ? 0 : 1) : 2);
        const catalog = catalogIds(kind === "image" ? "still" : kind, ctx.project)
          .map((id, index) => ({ id, index }))
          .sort((a, b) => rank(a.id) - rank(b.id) || (rank(a.id) < 2 ? uploadOrder.indexOf(b.id) - uploadOrder.indexOf(a.id) : a.index - b.index))
          .map((entry) => entry.id);
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
        // EasyRPG 배경(cosmos1)은 2026-10-07 저작권 정리로 빠졌다 — 번들 정지 그림을 쓴다.
        backgroundResourceId: "oprn-still-corridor",
      });
      expect(result.ok, failure(result)).toBe(true);
      expect(ctx.project.system.opening).toBeUndefined();
      expect(ctx.project.system.gameOver).toMatchObject({
        title: "패배",
        message: "어둠이 성을 삼켰다.",
        retryLabel: "다시 도전",
        backgroundResourceId: "oprn-still-corridor",
      });
      const read = runTool(ctx, "get_game_over", {});
      expect(read.ok, failure(read)).toBe(true);
      expect(read.data).toMatchObject({ gameOver: { backgroundResourceId: "oprn-still-corridor" } });
    });

    it("fails a game-over image request hard when the environment has no generator", () => {
      const ctx = context();
      const result = runTool(ctx, "generate_game_over_image", { prompt: "비가 내리는 폐허의 왕좌" });
      expect(result.ok).toBe(false);
      expect(result.issues?.map((issue) => issue.code)).toEqual(["image-generation-unavailable"]);
      expect(getTool("generate_game_over_image")?.name).toBe("generate_game_over_image");
    });
  });
});

// OPRN-OUT-017 — 두 보조가 화면에서도 **서로 다른 계약**으로 보이는가, 그리고 거부가
// 조용한 무동작이 아니라 누를 수 있는 복구 행동을 내놓는가.
describe("clusterAssistUi", () => {
  isolateTimers();
  let restoreFakeDom: () => void;
  function seed(): MapId {
    const project = startOnRetiredCombinedTown(createBlankProject());
    const map = project.maps[project.startMapId];
    map.width = 8;
    map.height = 8;
    map.lowerTiles = Array(64).fill(TILE.GRASS);
    map.upperTiles = Array(64).fill(TILE.EMPTY);
    map.events = [];
    project.startPos = { x: 0, y: 7 };
    store.replace(project);
    resetMapEditHistory();
    return project.startMapId;
  }
  function renderAssist(mapId: MapId) {
    const project = store.getCurrent();
    const map = project.maps[mapId]!;
    const state = editorState.get();
    return renderWithFakeDom(() =>
      makeTileBrushAssistPanel({
        autoConnectMode: state.autoConnectMode,
        clusterAssistMode: state.clusterAssistMode,
        mapId,
        onSelectTile: () => {},
        rerender: () => {},
        selectedTile: 290,
        tileset: project.tilesets[map.tilesetId]!,
      })
    );
  }
  beforeEach(() => {
    restoreFakeDom = installFakeDom();
    resetToastsForTest();
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
    editorState.set({ autoConnectMode: false, clusterAssistMode: true });
  });
  afterEach(() => {
    resetToastsForTest();
    restoreFakeDom();
    editorState.set({ autoConnectMode: false, clusterAssistMode: true });
  });
  describe("이웃 연결과 구조 보조는 화면에서 따로 표현된다", () => {
    it("두 토글이 각자의 줄·testid·상태로 존재한다", () => {
      const mapId = seed();

      const panel = renderAssist(mapId);

      const neighbor = findByTestId(panel, "auto-connect-mode-toggle");
      const cluster = findByTestId(panel, "cluster-assist-mode-toggle");
      expect(neighbor).toBeTruthy();
      expect(cluster).toBeTruthy();
      expect(neighbor).not.toBe(cluster);
      // 이웃 연결 수동 + 구조 보조 켜짐 — 두 상태가 독립적으로 표시된다.
      expect(neighbor!.getAttribute("aria-pressed")).toBe("false");
      expect(cluster!.getAttribute("aria-pressed")).toBe("true");
    });

    it("이웃 연결 수동 설명이 구조물 짝 배치를 따로 가리킨다 — 하나가 둘을 끈다고 읽히지 않는다", () => {
      const mapId = seed();

      const title = findByTestId(renderAssist(mapId), "auto-connect-mode-toggle")!.getAttribute("title") ?? "";

      expect(title).toContain("지형 연결만");
      expect(title).toContain("구조 보조");
    });

    it("구조 보조 문구가 켜짐/꺼짐에서 서로 다른 계약을 말한다", () => {
      const on = clusterAssistCopy(true);
      const off = clusterAssistCopy(false);

      expect(on.chip).not.toBe(off.chip);
      expect(on.title).toContain("동반 칸까지");
      expect(off.title).toContain("고른 칸·레이어 하나만");
      // 정확 배치도 보호셀·남의 덧그림은 덮지 않는다는 사실이 문구에 남아야 한다.
      expect(off.title).toContain("보호셀");
    });

    it("구조 보조 토글은 이웃 연결 상태를 건드리지 않는다", () => {
      editorState.set({ autoConnectMode: true, clusterAssistMode: true });

      expect(toggleClusterAssistMode()).toBe(false);

      expect(editorState.get().clusterAssistMode).toBe(false);
      expect(editorState.get().autoConnectMode).toBe(true);
    });
  });
  describe("거부는 실행 가능한 복구 경로를 화면에 낸다", () => {
    it("경계 거부 토스트에 규칙 문장과 정확 배치 버튼이 함께 있고, 누르면 그 칸이 칠해진다", () => {
      const mapId = seed();
      const rejections: TilePaintRejection[] = [];
      paintTilesBulk(mapId, [{ layer: "lower", tile: 291, x: 4, y: 0 }], {
        autoConnect: false,
        onRejected: (rejection) => rejections.push(rejection),
      });
      expect(rejections).toHaveLength(1);

      presentClusterRecovery(clusterRecoveryOffer(mapId, rejections[0]!));

      const toastEl = document.querySelector<HTMLElement>('[data-testid="toast"]');
      expect(toastEl).toBeTruthy();
      expect(toastEl!.textContent).toContain("261");
      const button = document.querySelector<HTMLElement>('[data-testid="cluster-exact-place"]');
      expect(button).toBeTruthy();

      button!.click();

      const map = store.getCurrent().maps[mapId]!;
      expect(map.lowerTiles[0 * map.width + 4]).toBe(291);
    });

    it("복구 불가(보호셀 자체)일 때는 버튼 대신 다음에 할 일을 말한다", () => {
      const mapId = seed();
      store.update((project) => {
        project.startMapId = mapId;
        project.startPos = { x: 4, y: 4 };
      });
      const rejections: TilePaintRejection[] = [];
      paintTilesBulk(mapId, [{ layer: "lower", tile: 290, x: 4, y: 4 }], {
        autoConnect: false,
        exactPlacement: true,
        onRejected: (rejection) => rejections.push(rejection),
      });

      presentClusterRecovery(clusterRecoveryOffer(mapId, rejections[0]!));

      expect(document.querySelector('[data-testid="cluster-exact-place"]')).toBeNull();
      expect(document.querySelector<HTMLElement>('[data-testid="toast"]')!.textContent).toContain("먼저 그 칸을 비우거나");
    });
  });
});

describe("clusterRuleSurface", () => {
  isolateTimers();
  /**
   * 타일 그룹의 `surface` 규칙 — 「화덕은 북쪽 벽에 붙는다」의 타일 쪽 절반.
   * 구조물 킷 조건(structureKitPlacementConditions.test.ts)은 찍는 순간 차단하고,
   * 이쪽은 이미 찍힌 맵을 훑어 규칙 감사 패널에 올린다.
   */

  const MAP_ID = "map_surface_rules";
  const WALL = 300;
  const FLOOR = 400;
  const STOVE_TOP = 21;
  const STOVE_BOT = 51;
  function stoveGroup(rules: readonly ClusterRule[]): TileGroupMetadata {
    return {
      defaultLayer: "mixed",
      description: "화덕 오븐",
      id: "kitchen-stove",
      name: "화덕 오븐",
      patternGrammar: {
        axis: "vertical",
        kind: "vertical_expandable",
        minHeight: 2,
        minWidth: 1,
        parts: [
          { role: "topCap", tileIds: [STOVE_TOP] },
          { role: "bottomCap", tileIds: [STOVE_BOT] },
        ],
        preserveCaps: true,
        repeat: "source_order",
      },
      placementRules: "부엌 북쪽 벽",
      role: "building",
      rules: [...rules],
      tileIds: [STOVE_TOP, STOVE_BOT],
    };
  }
  const NORTH_WALL_RULE: ClusterRule = {
    id: "r_interior_stove_north_wall",
    kind: "surface",
    message: "화덕은 북쪽 벽에 등을 대고 놓입니다.",
    params: { facing: "north", zone: "againstWall" },
    strength: "hard",
  };
  /** 8×6 방. y=1 행이 벽, 나머지는 바닥. */
  function projectWithStove(stoveOriginY: number): Project {
    const width = 8;
    const height = 6;
    const map: GameMap = {
      events: [],
      height,
      id: MAP_ID,
      lowerTiles: new Array<number>(width * height).fill(FLOOR),
      name: "주방",
      tileSize: 16,
      tilesetId: DEFAULT_TILESET_ID,
      upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
      width,
    };
    for (let x = 0; x < width; x += 1) map.lowerTiles[1 * width + x] = WALL;

    const project = createBlankProject();
    project.maps = { [MAP_ID]: map };
    project.mapTree = { mapId: MAP_ID, children: [] };
    project.startMapId = MAP_ID;
    project.startPos = { x: 0, y: 0 };
    const tileset = project.tilesets[DEFAULT_TILESET_ID]!;
    tileset.passability[WALL] = blockedFlag();
    tileset.passability[FLOOR] = passableFlag();
    tileset.priority[WALL] = "lower";
    tileset.priority[FLOOR] = "lower";
    // 화덕 자체는 통행 불가 — 검증기가 자기 발밑을 벽으로 오인하지 않는지 같이 본다.
    tileset.passability[STOVE_TOP] = blockedFlag();
    tileset.passability[STOVE_BOT] = blockedFlag();
    tileset.tileGroups = [stoveGroup([NORTH_WALL_RULE])];

    // 실내 파이프라인과 같은 방식으로 찍는다: 상단(21)은 **상위** 레이어에 벽면 위로 겹쳐 세우고,
    // 발밑(51)은 하위 레이어에 놓는다. 그래야 벽의 지형 타일이 남아 감사가 되돌려 볼 수 있다.
    map.upperTiles[stoveOriginY * width + 3] = STOVE_TOP;
    map.lowerTiles[(stoveOriginY + 1) * width + 3] = STOVE_BOT;
    return project;
  }
  describe("cluster-rule surface — 맵 감사", () => {
    it("벽 아래에 등을 댄 화덕은 위반이 아니다", () => {
      // 상단이 벽 행(y=1), 발밑이 y=2 바닥 → 발밑 위(y=1)가 벽.
      const violations = validateClusterRules(projectWithStove(1), MAP_ID);
      expect(violations.filter((entry) => entry.rule.kind === "surface")).toHaveLength(0);
    });

    it("방 가운데 떠 있는 화덕은 error 로 보고된다", () => {
      const violations = validateClusterRules(projectWithStove(3), MAP_ID);
      const surface = violations.filter((entry) => entry.rule.kind === "surface");
      expect(surface).toHaveLength(1);
      expect(surface[0]!.severity).toBe("error");
      expect(surface[0]!.code).toBe("cluster-rule:surface:kitchen-stove");
      // 규칙 감사 패널이 위치를 찍을 수 있어야 한다.
      expect(surface[0]!.coords.length).toBeGreaterThan(0);
    });

    it("지형까지 덮어 찍힌 세로쌍은 «판정 불가» 로 건너뛴다 — 벽을 지운 자리는 되볼 수 없다", () => {
      // 구조물 킷 스탬프는 두 줄을 모두 하위 레이어에 쓴다 → 상단이 앉았던 벽 타일이 사라진다.
      // 찍는 순간에는 검사를 통과했으므로, 나중에 되보고 위반이라 우기면 거짓 위반이다.
      const project = projectWithStove(1);
      const map = project.maps[MAP_ID]!;
      map.upperTiles[1 * map.width + 3] = TILE.EMPTY;
      map.lowerTiles[1 * map.width + 3] = STOVE_TOP;
      expect(validateClusterRules(project, MAP_ID).filter((entry) => entry.rule.kind === "surface")).toHaveLength(0);
    });

    it("params 가 망가진 규칙은 조용히 건너뛴다 — 거짓 위반을 만들지 않는다", () => {
      const project = projectWithStove(3);
      project.tilesets[DEFAULT_TILESET_ID]!.tileGroups = [
        stoveGroup([{ ...NORTH_WALL_RULE, params: { zone: "없는존" } }]),
      ];
      expect(validateClusterRules(project, MAP_ID).filter((entry) => entry.rule.kind === "surface")).toHaveLength(0);
    });
  });
  describe("set_cluster_rule — surface 규칙 편집", () => {
    it("zone·facing 을 받아 그룹에 저장한다", () => {
      const project = projectWithStove(1);
      project.tilesets[DEFAULT_TILESET_ID]!.tileGroups = [stoveGroup([])];
      const context = { project };
      const result = runTool(context, "set_cluster_rule", {
        tilesetId: DEFAULT_TILESET_ID,
        groupId: "kitchen-stove",
        rule: {
          id: "r_stove_surface",
          kind: "surface",
          strength: "hard",
          params: { zone: "againstWall", facing: "north" },
        },
      });
      expect(result.ok).toBe(true);
      const saved = context.project.tilesets[DEFAULT_TILESET_ID]!.tileGroups!
        .find((group) => group.id === "kitchen-stove")!.rules!
        .find((rule) => rule.kind === "surface");
      expect(saved?.params).toEqual({ facing: "north", zone: "againstWall" });
    });

    it("모르는 zone 은 거부한다 — 조용히 통과시키면 검사가 없는 것과 같아진다", () => {
      const project = projectWithStove(1);
      project.tilesets[DEFAULT_TILESET_ID]!.tileGroups = [stoveGroup([])];
      const result = runTool({ project }, "set_cluster_rule", {
        tilesetId: DEFAULT_TILESET_ID,
        groupId: "kitchen-stove",
        rule: { id: "r_bad", kind: "surface", strength: "hard", params: { zone: "북벽" } },
      });
      expect(result.ok).toBe(false);
      expect(result.summary + JSON.stringify(result.issues ?? [])).toContain("params.zone");
    });
  });
  describe("타일셋 지식 저장 — 배치 면 병합", () => {
    const adjacency: ClusterRule = {
      id: "r_interior_stove_v_pair",
      kind: "adjacency",
      params: { a: STOVE_TOP, b: STOVE_BOT, relation: "aAboveB" },
      strength: "hard",
    };

    it("«조건 없음» 은 surface 규칙만 지우고 다른 규칙은 남긴다", () => {
      const merged = mergeSurfaceRule([adjacency, NORTH_WALL_RULE], "kitchen-stove", {
        surfaceFacing: "any",
        surfaceStrength: "hard",
        surfaceZone: "none",
      });
      expect(merged).toEqual([adjacency]);
    });

    it("배치 면을 고르면 규칙이 생기고, 인접 규칙은 그대로 보존된다", () => {
      const merged = mergeSurfaceRule([adjacency], "kitchen-stove", {
        surfaceFacing: "north",
        surfaceStrength: "hard",
        surfaceZone: "againstWall",
      });
      expect(merged).toHaveLength(2);
      expect(merged[0]).toEqual(adjacency);
      expect(merged[1]).toMatchObject({
        id: "r_surface_kitchen-stove",
        kind: "surface",
        params: { facing: "north", zone: "againstWall" },
        strength: "hard",
      });
    });

    it("같은 그룹에 두 번 저장해도 surface 규칙은 하나만 남는다", () => {
      const once = mergeSurfaceRule([adjacency], "kitchen-stove", {
        surfaceFacing: "north",
        surfaceStrength: "hard",
        surfaceZone: "againstWall",
      });
      const twice = mergeSurfaceRule(once, "kitchen-stove", {
        surfaceFacing: "west",
        surfaceStrength: "soft",
        surfaceZone: "againstWall",
      });
      expect(twice.filter((rule) => rule.kind === "surface")).toHaveLength(1);
      expect(twice[1]).toMatchObject({ params: { facing: "west", zone: "againstWall" }, strength: "soft" });
    });

    it("방향은 againstWall 에서만 실린다 — 다른 면에 facing 을 남기면 읽는 쪽이 헷갈린다", () => {
      const merged = mergeSurfaceRule([], "g", {
        surfaceFacing: "north",
        surfaceStrength: "medium",
        surfaceZone: "wallFace",
      });
      expect(merged[0]!.params).toEqual({ zone: "wallFace" });
    });
  });
});

describe("commandPalette", () => {
  isolateTimers();
  function cmd(id: string, label: string): EditorCommand {
    return { id, label, category: "도구", keywords: [label], run: () => {} };
  }
  describe("buildPaletteEntries", () => {
    it("명령 → 맵 순으로 합치고 종류별 상한을 지킨다", () => {
      const commands = Array.from({ length: 10 }, (_, i) => cmd(`c${i}`, `명령${i}`));
      const maps = Array.from({ length: 10 }, (_, i) => cmd(`m${i}`, `맵${i}`));
      const entries = buildPaletteEntries("", { commands, maps });
      expect(entries.filter((e) => e.kind === "command")).toHaveLength(6);
      expect(entries.filter((e) => e.kind === "map")).toHaveLength(4);
      expect(entries[0]!.kind).toBe("command");
    });

    it("질의가 명령과 맵을 함께 거른다", () => {
      const entries = buildPaletteEntries("맵3", {
        commands: [cmd("c1", "명령1")],
        maps: [cmd("m3", "맵3"), cmd("m4", "맵4")],
      });
      expect(entries).toHaveLength(1);
      expect(entries[0]!.id).toBe("m3");
    });
  });
  describe("movePaletteIndex", () => {
    it("순환 이동한다", () => {
      expect(movePaletteIndex(3, 0, 1)).toBe(1);
      expect(movePaletteIndex(3, 2, 1)).toBe(0);
      expect(movePaletteIndex(3, 0, -1)).toBe(2);
      expect(movePaletteIndex(0, 0, 1)).toBe(0);
    });
  });
  describe("paletteKeyAction", () => {
    it("조합 중 Enter·화살표는 명령을 실행하거나 선택을 옮기지 않는다", () => {
      expect(paletteKeyAction({ key: "Enter", isComposing: true })).toBe("ignore");
      expect(paletteKeyAction({ key: "Enter", keyCode: 229 })).toBe("ignore");
      expect(paletteKeyAction({ key: "Process", keyCode: 229 })).toBe("ignore");
      expect(paletteKeyAction({ key: "ArrowDown", isComposing: true })).toBe("ignore");
      expect(paletteKeyAction({ key: "ArrowUp", keyCode: 229 })).toBe("ignore");
      expect(paletteKeyAction({ key: "Unidentified" })).toBe("ignore");
    });

    it("조합이 끝난 Enter 는 실행이고 화살표는 이동이다", () => {
      expect(paletteKeyAction({ key: "Enter" })).toBe("run");
      expect(paletteKeyAction({ key: "ArrowDown" })).toBe("down");
      expect(paletteKeyAction({ key: "ArrowUp" })).toBe("up");
      expect(paletteKeyAction({ key: "Escape" })).toBe("ignore");
    });
  });
});
