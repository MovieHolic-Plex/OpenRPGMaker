import { afterEach, expect, it, vi, describe, beforeEach } from "vitest";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";
import { STARTER_DEFAULT_BGM_ID } from "@/assets/bgmStarterTracks";
import { audioPlayback } from "@/editor/panels/audioResourcePresentation";
import { createBlankProject } from "@/project/defaults";
import { listDatabaseResourceOptions, type DatabaseResourcePickerKind, openDatabaseResourcePickerDialog, resourcePickerControl, listDatabaseResourceOptionsForTest } from "@/editor/panels/databaseResourcePickerDialog";
import { getTool } from "@/editor/tools";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { deserialize, serialize } from "@/project/io";
import type { CinematicSequence, Project } from "@/project/types";
import { renderBattleAnimationRecordForm } from "@/editor/panels/databaseAnimationRecordView";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("audioInventoryDelivery", () => {
  isolateTimers();
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("advertises installed BGM only, consistently across catalog and picker without changing runtime identity", () => {
    const installed = findBgmRuntimeEntry(STARTER_DEFAULT_BGM_ID);
    if (!installed) throw new Error("Missing starter registry entry");
    vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", [installed.fileName]);
    vi.stubEnv("VITE_BGM_CDN_BASE", "");
    const project = createBlankProject();
    const catalog = listAudioResources("music", project);
    expect(catalog.filter(entry => findBgmRuntimeEntry(entry.id)).map(entry => entry.id)).toEqual([STARTER_DEFAULT_BGM_ID]);
    expect(listDatabaseResourceOptions("music", project).map(entry => entry.id)).toEqual(catalog.map(entry => entry.id));
    expect(findBgmRuntimeEntry("cc0-bgm-rtp-fld-001")).toBeDefined();
  });
  it("keeps the complete pack inventory with an explicit CDN", () => {
    vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", []);
    vi.stubEnv("VITE_BGM_CDN_BASE", "https://example.com");
    expect(listAudioResources("music", createBlankProject()).filter(entry => findBgmRuntimeEntry(entry.id))).toHaveLength(281);
  });
  it("does not advertise preview for an existing reference to an uninstalled pack entry", () => {
    vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", []);
    vi.stubEnv("VITE_BGM_CDN_BASE", "");
    const preview = audioPlayback("cc0-bgm-rtp-fld-001", createBlankProject());
    expect(preview.url).toMatch(/\.mp3$/);
    expect(preview.playable).toBe(false);
  });
});

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

describe("databaseAnimationFrameSelect", () => {
  isolateTimers();
  // Wave 3 — 프레임 행/이전·다음이 editorState만 바꾸고 폼을 다시 그리지 않던 결함.
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    // 스테이지 프리뷰가 chromaKey Image를 띄우므로 노드 테스트에서 거절만 막는다.
    (globalThis as unknown as { Image: new () => object }).Image = class {
      addEventListener(): void {}
      set src(_value: string) {}
    };
    store.replace(createBlankProject());
    resetMapEditHistory();
    editorState.set({ selectedAnimationFrameIndex: 0, selectedAnimationCellIndex: 0 });
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function renderForm(): FakeElement {
    const animation = store.getCurrent().database.battleAnimations[0];
    if (!animation) throw new Error("expected default battle animation");
    const form = el("div") as unknown as FakeElement;
    renderBattleAnimationRecordForm(form as unknown as HTMLElement, animation);
    return form;
  }
  function requireTestId(root: FakeElement, testid: string): FakeElement {
    const node = findByTestId(root, testid);
    if (!node) throw new Error(`missing ${testid}`);
    return node;
  }
  describe("battle animation frame selection rerenders the form", () => {
    it("binds the visible graphic name to catalog selection, cancel and clear", () => {
      const form = renderForm();
      const catalog = listDatabaseResourceOptions("battle", store.getCurrent());
      const selectedId = store.getCurrent().database.battleAnimations[0].resourceId;
      const selected = catalog.find((entry) => entry.id === selectedId)!;
      expect(form.querySelector(".db-resource-picker-inline-name")?.textContent).toBe(selected.name);
      const body = document.body as unknown as FakeElement;
      const next = catalog.find((entry) => entry.id !== selectedId)!;
      const open = () => requireTestId(form, "db-field-animation-resource-set").dispatchEvent(new Event("click"));
      const action = (suffix: string) => requireTestId(body, `db-field-animation-resource-dialog-${suffix}`).dispatchEvent(new Event("click"));
      open(); action(`option-${next.id}`); action("cancel");
      expect(store.getCurrent().database.battleAnimations[0].resourceId).toBe(selectedId);
      expect(form.querySelector(".db-resource-picker-inline-name")?.textContent).toBe(selected.name);
      open(); action(`option-${next.id}`); action("ok");
      expect(store.getCurrent().database.battleAnimations[0].resourceId).toBe(next.id);
      expect(form.querySelector(".db-resource-picker-inline-name")?.textContent).toBe(next.name);
      open(); action("clear");
      expect(store.getCurrent().database.battleAnimations[0].resourceId).toBeUndefined();
      expect(requireTestId(form, "db-field-animation-resource").value).toBe("");
      expect(form.querySelector(".db-animation-stage-cell")).toBeNull();
    });

    it("row click marks the row active and swaps the cell table to that frame", () => {
      const form = renderForm();
      expect(requireTestId(form, "db-animation-frame-0").classList.contains("active")).toBe(true);
      expect(requireTestId(form, "db-animation-cell-pattern-0").value).toBe("0");

      requireTestId(form, "db-animation-frame-1").dispatchEvent(new Event("click"));

      expect(requireTestId(form, "db-animation-frame-1").classList.contains("active")).toBe(true);
      expect(requireTestId(form, "db-animation-frame-0").classList.contains("active")).toBe(false);
      expect(requireTestId(form, "db-animation-cell-pattern-0").value).toBe("1");
    });

    it("다음 advances the selected frame and cell table", () => {
      const form = renderForm();
      requireTestId(form, "db-animation-frame-next").dispatchEvent(new Event("click"));

      expect(requireTestId(form, "db-animation-frame-1").classList.contains("active")).toBe(true);
      expect(requireTestId(form, "db-animation-cell-pattern-0").value).toBe("1");
    });
  });
});

describe("databaseCinematicResources", () => {
  isolateTimers();
  let restoreDom: () => void;
  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    project.assets.uploaded["movie-upload"] = {
      id: "movie-upload",
      name: "Uploaded movie",
      kind: "movie",
      dataUrl: "data:video/webm;base64,AAAA",
      meta: {},
    };
    project.assets.uploaded["picture-upload"] = {
      id: "picture-upload",
      name: "Picture",
      kind: "picture",
      dataUrl: "data:image/png;base64,AAAA",
      meta: {},
    };
    project.assets.uploaded["voice-upload"] = {
      id: "voice-upload",
      name: "Voice",
      kind: "sound",
      dataUrl: "data:audio/ogg;base64,AAAA",
      meta: {},
    };
    project.resourceProfiles.push(
      { kind: "movie", name: "Profile movie", assetId: "profile-movie" },
      { kind: "movie", name: "Movie profile name", assetId: "movie-upload" },
    );
    store.replace(project);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    restoreDom();
  });
  describe("Database cinematic resource selection", () => {
    it("lists project movie profiles and uploads once", () => {
      const project = store.getCurrent();
      const before = JSON.stringify(project);
      const options = listDatabaseResourceOptions("movie", project);
      expect(options.map((entry) => entry.id).sort()).toEqual([
        "movie-upload",
        "profile-movie",
      ]);
      expect(JSON.stringify(project)).toBe(before);
      expect(listDatabaseResourceOptions("image", project).map((entry) => entry.id))
        .toContain("picture-upload");
      expect(listDatabaseResourceOptions("sound", project).map((entry) => entry.id))
        .toContain("voice-upload");
    });

    it("searches and confirms movies without images or another player", () => {
      const onConfirm = vi.fn();
      const update = vi.spyOn(store, "update");
      openDatabaseResourcePickerDialog({
        kind: "movie",
        title: "Movie",
        currentId: "movie-upload",
        testidPrefix: "cinematic-movie",
        onConfirm,
      });
      const body = document.body as unknown as FakeElement;
      const dialog = findByTestId(body, "cinematic-movie");
      expect(dialog).not.toBeNull();
      expect(dialog!.querySelectorAll("img, video, audio")).toHaveLength(0);

      const search = findByTestId(body, "cinematic-movie-search")!;
      search.value = "profile-movie";
      search.dispatchEvent(new Event("input"));
      expect(findByTestId(body, "cinematic-movie-option-movie-upload")).toBeNull();
      const option = findByTestId(body, "cinematic-movie-option-profile-movie");
      expect(option).not.toBeNull();
      option!.click();
      findByTestId(body, "cinematic-movie-ok")!.click();
      expect(onConfirm).toHaveBeenCalledOnce();
      expect(onConfirm.mock.calls[0][0].resourceId).toBe("profile-movie");
      expect(update).not.toHaveBeenCalled();
    });

    it("preserves cancel and clear semantics without store mutation", () => {
      const onConfirm = vi.fn();
      const update = vi.spyOn(store, "update");
      const open = (): void => openDatabaseResourcePickerDialog({
        kind: "movie",
        title: "Movie",
        currentId: "movie-upload",
        allowClear: true,
        testidPrefix: "cinematic-movie",
        onConfirm,
      });
      const body = document.body as unknown as FakeElement;
      open();
      findByTestId(body, "cinematic-movie-cancel")!.click();
      expect(onConfirm).not.toHaveBeenCalled();
      open();
      findByTestId(body, "cinematic-movie-clear")!.click();
      expect(onConfirm.mock.calls[0][0].resourceId).toBe("");
      expect(update).not.toHaveBeenCalled();
    });

    it("reuses the inline picker without image probes, playback or AI generation", () => {
      const onChange = vi.fn();
      const rerender = vi.fn();
      const row = resourcePickerControl({
        kind: "movie",
        label: "Movie",
        resourceId: "movie-upload",
        testid: "cinematic-movie",
        onChange,
        rerender,
      }) as unknown as FakeElement;
      expect(row.querySelectorAll("img, video, audio")).toHaveLength(0);
      expect(findByTestId(row, "cinematic-movie-ai-generate")).toBeNull();
      document.body.append(row as unknown as Node);
      findByTestId(row, "cinematic-movie-set")!.click();
      const body = document.body as unknown as FakeElement;
      findByTestId(body, "cinematic-movie-dialog-option-profile-movie")!.click();
      findByTestId(body, "cinematic-movie-dialog-ok")!.click();
      expect(onChange.mock.calls[0][0].resourceId).toBe("profile-movie");
      expect(rerender).toHaveBeenCalledOnce();
    });
  });
});

describe("soundResourceCatalog", () => {
  isolateTimers();
  describe("sound/music resource catalogs in editor", () => {
    it("lists bundled EasyRPG SE and CC0 tones for sound picker", () => {
      const project = createBlankProject();
      const sound = listDatabaseResourceOptionsForTest("sound", project);
      const music = listDatabaseResourceOptionsForTest("music", project);
      expect(sound.length).toBeGreaterThan(50);
      expect(sound.some((entry) => entry.id === "easyrpg-sound-decision1")).toBe(true);
      expect(sound.some((entry) => entry.id === "cc0-sound-ui-confirm")).toBe(true);
      expect(music.some((entry) => entry.id === "cc0-music-field-loop")).toBe(true);
      expect(project.resourceProfiles.filter((profile) => profile.kind === "sound").length).toBeGreaterThan(50);
    });

    it("keeps EasyRPG SE ids available for event SE pickers", () => {
      const project = createBlankProject();
      const ids = new Set(
        project.resourceProfiles
          .filter((profile) => profile.kind === "sound" && profile.assetId)
          .map((profile) => profile.assetId as string)
      );
      // m2 Play SE picker reads resourceProfiles; ensure common SE ids are present.
      for (const id of ["easyrpg-sound-decision1", "easyrpg-sound-cursor1", "easyrpg-sound-attack1", "cc0-sound-ui-confirm"]) {
        expect(ids.has(id), id).toBe(true);
      }
    });
  });
});
