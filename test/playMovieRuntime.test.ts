import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BattleResult } from "@/battle/runtime";
import { runCommands } from "@/player/playSceneInterpreter";
import { maybeTriggerRandomEncounter, resetEncounterCounter } from "@/player/playSceneMovement";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, GameMap, Project } from "@/project/types";
import { createInterpreter } from "@/player/interpreter";
import { applyNonBlockingStep } from "@/player/playSceneSchedulers";
import { MOVIE_OVERLAY_TESTID, MOVIE_VIDEO_TESTID, resolveMovieResourceUrl } from "@/player/playSceneMovies";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { HOUSE_DOOR_OPEN_SE } from "@/editor/houseInteriors";
import { isolateTimers } from "./mergedTeardown";

// 전투 패배(canLose=false)는 RM2K3 규칙대로 게임 오버로 끝나야 한다.
//
// 실측 버그(2026-08-28): 출하 런타임의 두 전투 진입 경로가 패배를 버렸다.
//  - src/player/playSceneInterpreter.ts battleProcessing: 결과를 session.battleResult 에만
//    저장하고 이벤트를 그대로 이어 실행 — 파티 사망도, 게임 오버 화면도 없었다.
//  - src/player/playSceneMovement.ts 랜덤 인카운터: `void scene.playBattle(...)` 로 결과를
//    완전히 폐기 — 패배해도 아무 일도 일어나지 않았다.
// 헤드리스 하네스(src/testing/sceneTestRunner.ts, walkthroughRunner.ts)는 이미
// defeat + !canLose 를 파티 사망 + 게임 오버로 모델링하고 있어 출하물이 자기 하네스와 어긋났다.
describe("battleDefeatOutcome", () => {
  isolateTimers();
  const ENCOUNTER_TROOP_ID = "troop_encounter";
  function battleScene(result: BattleResult) {
    const project = createBlankProject();
    project.database.troops = [
      { id: ENCOUNTER_TROOP_ID, name: "인카운터", members: [] },
      ...project.database.troops,
    ] as typeof project.database.troops;
    const session = startSession(project, 7);
    // 파티가 비어 있으면 "파티 사망" 단정이 공허해진다 — 픽스처 자체를 먼저 못 박는다.
    expect(session.partyActorIds.length).toBeGreaterThan(0);
    const gameOverMessages: string[] = [];
    const battleSteps: Array<{ readonly canLose: boolean }> = [];
    let finishBattle: (() => void) | undefined;
    const battleFinished = new Promise<void>(resolve => { finishBattle = resolve; });
    const dialogue = {
      showText: vi.fn(async () => undefined),
      showChoices: vi.fn(async () => 0),
      showNumberInput: vi.fn(async () => 0),
      hide: vi.fn(),
      close: vi.fn(),
    };
    const registry = new Map<string, unknown>([["dialogue", dialogue]]);
    const map = {
      id: session.currentMapId,
      name: "인카운터 맵",
      encounterRate: 1000,
      troopIds: [ENCOUNTER_TROOP_ID],
    } as unknown as GameMap;
    const scene = {
      session,
      running: false,
      inputEnabled: true,
      lastActionTargetKey: "",
      tileX: 0,
      tileY: 0,
      map,
      game: { registry: { get: (key: string) => registry.get(key) } },
      playBattle: async (step: { readonly canLose: boolean }) => {
        battleSteps.push({ canLose: step.canLose });
        return result;
      },
      showGameOverScreen: (message?: string) => gameOverMessages.push(message ?? ""),
      setInputEnabled: vi.fn((enabled: boolean) => { if (enabled) finishBattle?.(); }),
      refreshRuntimeSurfaces: vi.fn(),
      syncRuntimeState: vi.fn(),
      showRuntimeOverlay: vi.fn(),
      clearRuntimeOverlay: vi.fn(),
      registerPageMoveRoutes: vi.fn(),
      renderTiles: vi.fn(),
    } as unknown as PlaySceneContext;
    return { project, session, scene, gameOverMessages, battleSteps, battleFinished };
  }
  function partyIsDead(session: ReturnType<typeof startSession>): boolean {
    return session.partyActorIds.every((actorId) =>
      session.actorVitals[actorId]?.hp === 0 && (session.actorStateIds?.[actorId] ?? []).includes("state_death")
    );
  }
  describe("전투 패배 결말", () => {
    let previous = createBlankProject();

    beforeEach(() => {
      previous = store.getCurrent();
      vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
      resetEncounterCounter();
    });

    afterEach(() => {
      store.replaceProject(previous);
      vi.unstubAllGlobals();
      resetEncounterCounter();
    });

    it("이벤트 전투(canLose=false) 패배는 파티를 죽이고 게임 오버를 띄우며 이벤트를 끝낸다", async () => {
      const { project, session, scene, gameOverMessages } = battleScene("defeat");
      store.replaceProject(project);
      const commands: Command[] = [
        { kind: "battleProcessing", troopId: ENCOUNTER_TROOP_ID, canEscape: true, canLose: false },
        { kind: "setSwitch", switchId: "after_battle", value: true },
      ];

      await runCommands(scene, commands);

      expect(session.battleResult).toBe("defeat");
      expect(gameOverMessages.length).toBe(1);
      expect(partyIsDead(session)).toBe(true);
      // 패배로 끝난 이벤트는 뒷 커맨드를 실행하지 않는다(죽은 파티로 시나리오가 이어지면 안 된다).
      expect(session.switches.after_battle).not.toBe(true);
    });

    it("canLose=true 패배는 게임 오버 없이 필드로 복귀하고 패배 분기를 실행한다", async () => {
      const { project, session, scene, gameOverMessages } = battleScene("defeat");
      store.replaceProject(project);
      const commands: Command[] = [
        {
          kind: "battleProcessing",
          troopId: ENCOUNTER_TROOP_ID,
          canEscape: true,
          canLose: true,
          branchOnResult: true,
          defeatBranch: [{ kind: "setSwitch", switchId: "lost_but_alive", value: true }],
        },
        { kind: "setSwitch", switchId: "after_battle", value: true },
      ];

      await runCommands(scene, commands);

      expect(session.battleResult).toBe("defeat");
      expect(gameOverMessages).toEqual([]);
      expect(partyIsDead(session)).toBe(false);
      expect(session.switches.lost_but_alive).toBe(true);
      expect(session.switches.after_battle).toBe(true);
    });

    it("cancelled event cleanup does not unlock a replacement battle in the same session", async () => {
      const { project, session, scene } = battleScene("defeat");
      store.replaceProject(project);
      const replacement = new AbortController();
      // This isolates the caller's ownership contract. Real runtime, DOM and
      // session cancellation are exercised in playSceneBattleCancellation.
      scene.playBattle = async () => { scene.battleAbortController = replacement; return null; };
      await runCommands(scene, [
        { kind: "battleProcessing", troopId: ENCOUNTER_TROOP_ID, canEscape: false, canLose: true },
        { kind: "setSwitch", switchId: "stale", value: true },
      ]);
      expect(scene.running).toBe(true);
      expect(scene.setInputEnabled).not.toHaveBeenCalledWith(true);
      expect(session.switches.stale).toBeUndefined();
      expect(session.battleResult).toBeUndefined();
    });

    it("랜덤 인카운터 패배도 파티 사망 + 게임 오버로 끝난다", async () => {
      const { project, session, scene, gameOverMessages, battleSteps, battleFinished } = battleScene("defeat");
      store.replaceProject(project);

      maybeTriggerRandomEncounter(scene);

      await battleFinished;
      expect(gameOverMessages.length).toBe(1);
      expect(battleSteps).toEqual([{ canLose: false }]);
      expect(session.battleResult).toBe("defeat");
      expect(partyIsDead(session)).toBe(true);
    });

    it("랜덤 인카운터 승리는 게임 오버 없이 결과만 세션에 남긴다", async () => {
      const { project, session, scene, gameOverMessages, battleFinished } = battleScene("victory");
      store.replaceProject(project);

      maybeTriggerRandomEncounter(scene);

      await battleFinished;
      expect(session.battleResult).toBe("victory");
      expect(gameOverMessages).toEqual([]);
      expect(partyIsDead(session)).toBe(false);
    });
  });
});

describe("playMovieRuntime", () => {
  isolateTimers();
  const AFTER_MOVIE = "sw_after_movie";
  function mkFixture() {
    const project = createBlankProject();
    const session = startSession(project, 7);
    session.switches[AFTER_MOVIE] = false;
    const host = new FakeElement("div");
    const dialogue = {
      showText: vi.fn(async () => undefined),
      showChoices: vi.fn(async () => 0),
      showNumberInput: vi.fn(async () => 0),
      hide: vi.fn(),
      close: vi.fn(),
    };
    const registry = new Map<string, unknown>([
      ["dialogue", dialogue],
      ["dialogueHost", host],
    ]);
    const scene = {
      session,
      running: false,
      inputEnabled: true,
      lastActionTargetKey: "",
      tileY: 0,
      map: { height: 1 },
      game: { registry: { get: (key: string) => registry.get(key) } },
      setInputEnabled: vi.fn(),
      refreshRuntimeSurfaces: vi.fn(),
      syncRuntimeState: vi.fn(),
      showRuntimeOverlay: vi.fn(),
      clearRuntimeOverlay: vi.fn(),
    } as unknown as PlaySceneContext;
    return { project, session, scene, host };
  }
  function videoIn(host: FakeElement): FakeElement {
    const node = findByTestId(host, MOVIE_VIDEO_TESTID);
    expect(node, "동영상 오버레이의 video 요소가 없다").toBeTruthy();
    return node!;
  }
  function keydown(key: string): void {
    const event = new Event("keydown", { bubbles: true });
    Object.assign(event, { key });
    (globalThis.document as unknown as { dispatchEvent(event: Event): boolean }).dispatchEvent(event);
  }
  let restoreDom: (() => void) | null = null;
  let previousProject: Project | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
    previousProject = store.getCurrent();
  });
  afterEach(() => {
    if (previousProject) store.replaceProject(previousProject);
    previousProject = null;
    restoreDom?.();
    restoreDom = null;
  });
  describe("playMovie 인터프리터 일시정지", () => {
    it("wait/skippable 기본값을 true 로 채운 pause step 을 낸다", () => {
      const project = createBlankProject();
      const session = startSession(project, 1);
      const interpreter = createInterpreter(
        [{ kind: "playMovie", resourceId: "video_intro" }] satisfies Command[],
        session,
        project
      );

      expect(interpreter.start()).toEqual({
        kind: "playMovie",
        resourceId: "video_intro",
        wait: true,
        skippable: true,
      });
    });

    it("wait:false / skippable:false 를 그대로 전달한다", () => {
      const project = createBlankProject();
      const session = startSession(project, 1);
      const interpreter = createInterpreter(
        [
          { kind: "playMovie", resourceId: "video_credits", wait: false, skippable: false },
        ] satisfies Command[],
        session,
        project
      );

      expect(interpreter.start()).toEqual({
        kind: "playMovie",
        resourceId: "video_credits",
        wait: false,
        skippable: false,
      });
    });

    it("resume 전에는 다음 커맨드로 진행하지 않는다", () => {
      const project = createBlankProject();
      const session = startSession(project, 1);
      session.switches[AFTER_MOVIE] = false;
      const interpreter = createInterpreter(
        [
          { kind: "playMovie", resourceId: "video_intro" },
          { kind: "setSwitch", switchId: AFTER_MOVIE, value: true },
        ] satisfies Command[],
        session,
        project
      );

      interpreter.start();
      expect(session.switches[AFTER_MOVIE]).toBe(false);

      expect(interpreter.resume(undefined).kind).toBe("done");
      expect(session.switches[AFTER_MOVIE]).toBe(true);
    });
  });
  describe("playMovie 재생 URL 해석", () => {
    it("등록된 리소스는 프로필 해석 결과를 쓴다", () => {
      const project = createBlankProject();
      const tilesetImageId = Object.values(project.tilesets)[0]?.image.id ?? "";
      expect(tilesetImageId).toBeTruthy();

      expect(resolveMovieResourceUrl(tilesetImageId, project)).toBeTruthy();
    });

    it("해석 불가한 id 는 public 동영상 경로로 폴백한다", () => {
      expect(resolveMovieResourceUrl("video_intro", createBlankProject())).toBe(
        "/assets/movies/video_intro.mp4"
      );
    });

    it("빈 리소스 id 는 재생 대상이 없다", () => {
      expect(resolveMovieResourceUrl("", createBlankProject())).toBeUndefined();
    });

    it("확장자가 붙은 id 는 확장자를 유지한다", () => {
      expect(resolveMovieResourceUrl("sample-movie.webm", createBlankProject())).toBe(
        "/assets/movies/sample-movie.webm"
      );
    });
  });
  describe("playMovie 런타임 배선", () => {
    it.each<Command>([
      { kind: "playMovie", resourceId: "video_intro" },
      { kind: "m2Command", commandId: "m2-066-play-movie", fields: { value: "video_intro", wait: true } },
    ])("wait:true blocks until video ended: $kind", async (command) => {
      const { project, session, scene, host } = mkFixture();
      store.replaceProject(project);
      const running = runCommands(scene, [
        command,
        { kind: "setSwitch", switchId: AFTER_MOVIE, value: true },
      ]);

      const video = videoIn(host);
      expect(video.getAttribute("src")).toBe("/assets/movies/video_intro.mp4");
      expect(session.switches[AFTER_MOVIE]).toBe(false);

      video.dispatchEvent(new Event("ended"));
      await running;

      expect(session.switches[AFTER_MOVIE]).toBe(true);
      expect(findByTestId(host, MOVIE_OVERLAY_TESTID)).toBeNull();
    });

    it("video error 도 인터프리터를 재개시킨다(멈추지 않는다)", async () => {
      const { project, session, scene, host } = mkFixture();
      store.replaceProject(project);
      const running = runCommands(scene, [
        { kind: "playMovie", resourceId: "video_broken" },
        { kind: "setSwitch", switchId: AFTER_MOVIE, value: true },
      ]);

      videoIn(host).dispatchEvent(new Event("error"));
      await running;

      expect(session.switches[AFTER_MOVIE]).toBe(true);
    });

    it("skippable:true 는 확인 키로 건너뛴다", async () => {
      const { project, session, scene, host } = mkFixture();
      store.replaceProject(project);
      const running = runCommands(scene, [
        { kind: "playMovie", resourceId: "video_intro", skippable: true },
        { kind: "setSwitch", switchId: AFTER_MOVIE, value: true },
      ]);

      videoIn(host);
      keydown("Enter");
      await running;

      expect(session.switches[AFTER_MOVIE]).toBe(true);
      expect(findByTestId(host, MOVIE_OVERLAY_TESTID)).toBeNull();
    });

    it("skippable:false 는 확인 키를 무시하고 ended 만 기다린다", async () => {
      const { project, session, scene, host } = mkFixture();
      store.replaceProject(project);
      const running = runCommands(scene, [
        { kind: "playMovie", resourceId: "video_intro", skippable: false },
        { kind: "setSwitch", switchId: AFTER_MOVIE, value: true },
      ]);

      const video = videoIn(host);
      keydown("Enter");
      await Promise.resolve();
      expect(session.switches[AFTER_MOVIE]).toBe(false);

      video.dispatchEvent(new Event("ended"));
      await running;

      expect(session.switches[AFTER_MOVIE]).toBe(true);
    });

    it("wait:false 는 즉시 다음 커맨드로 넘어가고 영상은 계속 재생된다", async () => {
      const { project, session, scene, host } = mkFixture();
      store.replaceProject(project);

      await runCommands(scene, [
        { kind: "playMovie", resourceId: "video_intro", wait: false },
        { kind: "setSwitch", switchId: AFTER_MOVIE, value: true },
      ]);

      expect(session.switches[AFTER_MOVIE]).toBe(true);
      const video = videoIn(host);

      video.dispatchEvent(new Event("ended"));
      expect(findByTestId(host, MOVIE_OVERLAY_TESTID)).toBeNull();
    });

    it("병행 처리 경로도 playMovie step 을 오버레이로 소비한다", () => {
      const { project, scene, host } = mkFixture();
      store.replaceProject(project);

      const handled = applyNonBlockingStep(scene, {
        kind: "playMovie",
        resourceId: "video_intro",
        wait: true,
        skippable: true,
      });

      expect(handled).toBe(true);
      expect(findByTestId(host, MOVIE_OVERLAY_TESTID)).toBeTruthy();
    });
  });
});

describe("runtimeAudioIndicator", () => {
  isolateTimers();
  // 오디오 배너("지금 흐르는 곡")는 루프 BGM 전용이다.
  // 문 열림처럼 수시로 울리는 원샷 SE 까지 배너를 띄우면, clear 경로가 stopAudio 뿐이라
  // 리소스 id 가 게임 화면에 박혀 남는다 (2026-08-30 브라우저 QA 실측).
  function mkScene() {
    const project = createBlankProject();
    // 배너는 이름이 있는 음원만 띄운다(리소스 id 는 플레이어에게 보이지 않는다).
    project.resourceProfiles.push({ kind: "music", assetId: "bgm_town", name: "마을 곡" });
    store.replaceProject(project);
    const session = startSession(project, 3);
    const host = new FakeElement("div");
    const dialogue = {
      showText: vi.fn(async () => undefined),
      showChoices: vi.fn(async () => 0),
      showNumberInput: vi.fn(async () => 0),
      hide: vi.fn(),
      close: vi.fn(),
    };
    const registry = new Map<string, unknown>([
      ["dialogue", dialogue],
      ["dialogueHost", host],
    ]);
    const showRuntimeOverlay = vi.fn();
    const scene = {
      session,
      running: false,
      inputEnabled: true,
      lastActionTargetKey: "",
      tileY: 0,
      map: { height: 1 },
      game: { registry: { get: (key: string) => registry.get(key) } },
      setInputEnabled: vi.fn(),
      refreshRuntimeSurfaces: vi.fn(),
      syncRuntimeState: vi.fn(),
      showRuntimeOverlay,
      clearRuntimeOverlay: vi.fn(),
    } as unknown as PlaySceneContext;
    return { project, session, scene, showRuntimeOverlay };
  }
  function overlayIds(mock: ReturnType<typeof vi.fn>): string[] {
    return mock.mock.calls.map((call) => String(call[0]));
  }
  let restoreDom: (() => void) | null = null;
  let previousProject: Project | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
    previousProject = store.getCurrent();
  });
  afterEach(() => {
    if (previousProject) store.replaceProject(previousProject);
    previousProject = null;
    restoreDom?.();
    restoreDom = null;
  });
  describe("오디오 배너는 루프 BGM 전용", () => {
    it("인터프리터: 루프 오디오는 배너를 띄우고 원샷 SE 는 띄우지 않는다", async () => {
      const loopScene = mkScene();
      await runCommands(loopScene.scene, [{ kind: "playAudio", resourceId: "bgm_town", loop: true }]);
      expect(overlayIds(loopScene.showRuntimeOverlay)).toContain("audio-indicator");
      expect(loopScene.session.audio.bgm).toEqual({ resourceId: "bgm_town", loop: true });

      const seScene = mkScene();
      await runCommands(seScene.scene, [{ kind: "playAudio", resourceId: HOUSE_DOOR_OPEN_SE, loop: false }]);
      expect(overlayIds(seScene.showRuntimeOverlay)).not.toContain("audio-indicator");
      // 배너만 빠지고 재생 상태(SE 채널)는 그대로 기록된다.
      expect(seScene.session.audio.se).toEqual({ resourceId: HOUSE_DOOR_OPEN_SE, loop: false });
    });

    it("병렬 스케줄러: 같은 규칙을 쓴다", () => {
      const loopScene = mkScene();
      expect(applyNonBlockingStep(loopScene.scene, { kind: "playAudio", resourceId: "bgm_town", loop: true })).toBe(true);
      expect(overlayIds(loopScene.showRuntimeOverlay)).toContain("audio-indicator");

      const seScene = mkScene();
      expect(applyNonBlockingStep(seScene.scene, { kind: "playAudio", resourceId: HOUSE_DOOR_OPEN_SE, loop: false })).toBe(true);
      expect(overlayIds(seScene.showRuntimeOverlay)).not.toContain("audio-indicator");
      expect(seScene.session.audio.se).toEqual({ resourceId: HOUSE_DOOR_OPEN_SE, loop: false });
    });
    it.each(["인터프리터", "병렬 스케줄러"])("%s: 이름이 붙은 BGS는 배너 없이 재생한다", async (path) => {
      const { scene, session, showRuntimeOverlay } = mkScene();
      const bgs = { kind: "playAudio", resourceId: "bgm_town", channel: "bgs", loop: true } as const;

      if (path === "인터프리터") await runCommands(scene, [bgs]);
      else expect(applyNonBlockingStep(scene, bgs)).toBe(true);

      expect(showRuntimeOverlay).not.toHaveBeenCalled();
      expect(session.audio.bgs).toEqual({ resourceId: "bgm_town", loop: true });
    });
  });
});
