import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { BattleResult } from "@/battle/runtime";
import { runCommands } from "@/player/playSceneInterpreter";
import { maybeTriggerRandomEncounter, resetEncounterCounter, handleAction } from "@/player/playSceneMovement";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { startSession, reseedSessionRng } from "@/project/session";
import { store } from "@/project/store";
import type { Command, GameMap, Project, EventPage, GameEvent } from "@/project/types";
import { createInterpreter } from "@/player/interpreter";
import { applyNonBlockingStep } from "@/player/playSceneSchedulers";
import { MOVIE_OVERLAY_TESTID, MOVIE_VIDEO_TESTID, resolveMovieResourceUrl } from "@/player/playSceneMovies";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { HOUSE_DOOR_OPEN_SE } from "@/editor/houseInteriors";
import { isolateTimers } from "./mergedTeardown";
import { commandSchemaFor } from "@/editor/eventCommands/schema/defineCommand";
import { COMMAND_GUARANTEES } from "@/project/commandGuaranteeRegistry";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import { commandRuntimeSupport } from "@/project/eventCommands/runtimeSupport";
import { EVENT_COMMAND_PICKER_NATIVE_ONLY_PLACEMENTS } from "@/editor/panels/eventEditor/commandPicker";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { commandKindLabel } from "@/editor/panels/eventEditor/options";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { Window } from "happy-dom";
import { RuntimeDomOverlay, buildLifeRuntimeSnapshot, type RuntimeActionReceipt } from "@/player/runtimeDom";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { lifeQaProject } from "./fixtures/life-full/qaObservability";
import "@/editor/eventCommands/schema/catalog";

describe("playFilterShaderSource", () => {
  isolateTimers();
  // J01: Phaser 4 는 `#pragma phaserTemplate(shaderName)` 를 `#define SHADER_NAME …` 로 바꾼다.
  // 소스에 `#define SHADER_NAME` 을 또 쓰면 "macro redefined" 로 컴파일이 깨져 시간문·균열 이동이 검정에서 멈춘다.
  describe("카메라 필터 셰이더 소스", () => {
    for (const file of ["src/player/playSceneScreenDistortion.ts", "src/player/playSceneMode7.ts"]) {
      it(`${file} 는 SHADER_NAME 을 직접 정의하지 않는다`, () => {
        const source = readFileSync(file, "utf8");
        expect(source).toContain("#pragma phaserTemplate(shaderName)");
        expect(source).not.toMatch(/#define\s+SHADER_NAME/u);
      });
      it(`${file} 는 컴파일 확인을 하는 공용 등록기를 쓴다`, () => {
        expect(readFileSync(file, "utf8")).toContain("ensureFilterShaderNode");
      });
    }
  });
});

describe("playMovieRuntime", () => {
  isolateTimers();
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
});

describe("playMovieSchema", () => {
  isolateTimers();
  // 타입 계약: playMovie 리터럴이 Command 유니온에 그대로 들어간다(컴파일 시점 검증).
  const VALID_MOVIE = {
    kind: "playMovie",
    resourceId: "video_intro",
    wait: true,
    skippable: true,
  } as const satisfies Command;
  const IDENTITY_LOOKUP = {
    switchName: (id: string) => id,
    variableName: (id: string) => id,
    recordName: (id: string) => id,
  };
  function pageWith(commands: readonly Command[]): EventPage {
    return {
      id: "page-1",
      name: "동영상 페이지",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [...commands],
    };
  }
  function eventWith(page: EventPage): GameEvent {
    return {
      id: "event-movie",
      x: 2,
      y: 2,
      trigger: page.trigger,
      commands: [],
      pages: [page],
    };
  }
  function validate(project: Project, commands: readonly Command[]) {
    const mapId = project.startMapId;
    const event = eventWith(pageWith(commands));
    project.maps[mapId].events = [event];
    return validateEventDraftBody(project, mapId, event);
  }
  describe("playMovie 명령 계약", () => {
    it("kind 레지스트리와 보증 레지스트리에 등재된다", () => {
      expect(COMMAND_KINDS).toContain("playMovie");
      expect(COMMAND_GUARANTEES.playMovie.family).toBe("media");
    });

    it("스키마 카탈로그가 동영상 라벨과 리소스·대기·건너뛰기 필드를 노출한다", () => {
      const schema = commandSchemaFor("playMovie");
      expect(schema, "playMovie 스키마가 등록되지 않았다").toBeDefined();
      expect(schema?.label).toBe("동영상");
      expect(schema?.family).toBe("media");
      expect(Object.keys(schema?.fields ?? {})).toEqual(["resourceId", "wait", "skippable"]);
      expect(schema?.fields.resourceId?.optional).not.toBe(true);
      expect(schema?.fields.wait?.optional).toBe(true);
      expect(schema?.fields.skippable?.optional).toBe(true);
    });

    it("요약문은 '<리소스> 재생' 형태다", () => {
      const schema = commandSchemaFor("playMovie");
      expect(schema?.summary({ kind: "playMovie", resourceId: "video_intro" }, IDENTITY_LOOKUP)).toBe(
        "video_intro 재생"
      );
    });

    it("명령 목록 요약이 동영상 재생임을 밝히고 대기/건너뛰기를 드러낸다", () => {
      const summary = commandSummary({ ...VALID_MOVIE });
      expect(summary).toContain("동영상 재생");
      expect(summary).toContain("대기");
      expect(summary).toContain("건너뛰기 허용");
    });

    it("편집기 라벨 목록이 동영상 재생을 제공한다", () => {
      expect(commandKindLabel("playMovie")).toBe("동영상 재생");
    });

    it("피커는 연출 페이지(3)의 미디어 그룹 자리를 예약한다", () => {
      expect(EVENT_COMMAND_PICKER_NATIVE_ONLY_PLACEMENTS).toContainEqual({
        kind: "playMovie",
        group: "화면 연출",
        page: 3,
      });
    });

    it("맵·공통은 런타임이 착지해 전체 지원이고, 전투 실행기가 없는 troop 은 부분 지원이다", () => {
      expect(commandRuntimeSupport({ ...VALID_MOVIE }, "map")).toBe("runtime-full");
      expect(commandRuntimeSupport({ ...VALID_MOVIE }, "common")).toBe("runtime-full");
      // src/battle/battleEvents.ts 가 이 kind 를 logUnsupported 로 기록하고 false 를 돌린다.
      // troop 을 full 로 적으면 전투 페이지 저작 표면이 "전투에서도 그대로 돈다"고 거짓 표시한다.
      expect(commandRuntimeSupport({ ...VALID_MOVIE }, "troop")).toBe("runtime-partial");
    });

    it("검증기가 알 수 없는 동영상 리소스를 오류로 잡는다", () => {
      const result = validate(createBlankProject(), [
        { kind: "playMovie", resourceId: "video_does_not_exist" },
      ]);

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: "error",
          code: "reference.resource.missing",
          commandPath: [0],
        })
      );
      expect(result.canCommit).toBe(false);
    });

    it("검증기가 비어 있는 동영상 리소스도 오류로 잡는다", () => {
      const result = validate(createBlankProject(), [{ kind: "playMovie", resourceId: "" }]);

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: "error",
          code: "reference.resource.missing",
          commandPath: [0],
        })
      );
    });

    it("존재하는 리소스를 가리키면 참조 오류를 내지 않는다", () => {
      const project = createBlankProject();
      const knownResourceId = Object.values(project.tilesets)[0]?.image.id;
      expect(knownResourceId, "blank project에 타일셋 리소스가 있어야 함").toBeTruthy();

      const result = validate(project, [{ kind: "playMovie", resourceId: knownResourceId ?? "" }]);

      expect(
        result.issues.filter((issue) => issue.code === "reference.resource.missing")
      ).toEqual([]);
    });
  });
});

describe("playSceneMovement", () => {
  isolateTimers();
  describe("actionEncounterGuard", () => {
    isolateTimers();
    function makeMap(actionCombat: boolean): GameMap {
      return {
        id: actionCombat ? "map_action" : "map_normal",
        name: "t",
        encounterRate: 1000,
        troopIds: ["troop_a"],
        actionCombat,
      } as unknown as GameMap;
    }
    function makeScene(map: GameMap, playBattleCalls: string[]): PlaySceneContext {
      const scene = {
        running: false,
        inputEnabled: true,
        map,
        tileX: 0,
        tileY: 0,
        session: { partyActorIds: [], switches: {}, variables: {} },
        // playBattle 은 Promise<BattleResult> 계약이다(playSceneTypes.ts). void 를 돌려주는 페이크는
        // 인카운터 결과 소모(패배→게임 오버) 경로를 가린다.
        playBattle: async (cmd: { kind: string }) => {
          playBattleCalls.push(cmd.kind);
          return "escape" as const;
        },
        setInputEnabled: (enabled: boolean) => {
          scene.inputEnabled = enabled;
        },
      } as unknown as PlaySceneContext & { inputEnabled: boolean };
      return scene;
    }
    describe("랜덤 인카운트 액션 전투 가드", () => {
      it("액션 전투 맵에서는 walk 스텝이 playBattle 을 부르지 않는다", () => {
        const project = store.getCurrent();
        project.system.actionCombat = { enabled: true };
        const calls: string[] = [];
        const scene = makeScene(makeMap(true), calls);

        resetEncounterCounter();
        for (let i = 0; i < 5; i += 1) maybeTriggerRandomEncounter(scene);

        expect(calls).toEqual([]);
      });

      it("같은 설정의 비(非)액션 맵에서는 playBattle 이 호출된다", () => {
        const project = store.getCurrent();
        project.system.actionCombat = { enabled: true };
        const calls: string[] = [];
        const scene = makeScene(makeMap(false), calls);

        resetEncounterCounter();
        maybeTriggerRandomEncounter(scene);

        expect(calls).toEqual(["battleProcessing"]);
      });

      it("액션 맵에서 쌓인 누적값이 리셋되어 맵을 나가자마자 전투가 터지지 않는다", () => {
        const project = store.getCurrent();
        project.system.actionCombat = { enabled: true };
        const calls: string[] = [];
        const actionScene = makeScene(makeMap(true), calls);
        const normalScene = makeScene({ ...makeMap(false), encounterRate: 10 } as unknown as GameMap, calls);

        resetEncounterCounter();
        // rate 1000 이면 한 스텝마다 누적이 임계를 채우지만, 액션 맵에선 발동 대신 리셋된다.
        for (let i = 0; i < 10; i += 1) maybeTriggerRandomEncounter(actionScene);
        expect(calls).toEqual([]);

        // 낮은 encounterRate 맵으로 나가면 오래된 누적값이 남아 즉시 발동하면 안 된다.
        maybeTriggerRandomEncounter(normalScene);
        expect(calls).toEqual([]);
      });
    });
  });
  describe("encounterInBattleGuard", () => {
    isolateTimers();
    type BattleOutcome = "victory" | "defeat" | "escape";
    // encounterRate 1000 이면 첫 스텝의 누적값이 임계(1000)에 정확히 닿아 RNG 없이 발동한다.
    // 세션 RNG에 의존하지 않으므로 이 스위트는 시드와 무관하게 결정적이다.
    function makeEncounterMap(): GameMap {
      return {
        id: "map_field",
        name: "field",
        encounterRate: 1000,
        troopIds: ["troop_a"],
      } as unknown as GameMap;
    }
    interface FakeSceneHandle {
      readonly scene: PlaySceneContext;
      readonly battleCalls: string[];
      readonly inputCalls: boolean[];
      finishBattle(result: BattleOutcome): void;
      /** setInputEnabled(true) 로 입력이 복구될 때 resolve — 고정 대기 없이 정확한 상태 변화를 기다린다. */
      readonly inputRestored: Promise<void>;
    }
    function makeSceneInBattleProbe(map: GameMap): FakeSceneHandle {
      const battleCalls: string[] = [];
      const inputCalls: boolean[] = [];
      let settleBattle: ((result: BattleOutcome) => void) | undefined;
      let signalRestored: (() => void) | undefined;
      const inputRestored = new Promise<void>((resolve) => {
        signalRestored = resolve;
      });

      const scene = {
        running: false,
        inputEnabled: true,
        lastActionTargetKey: "",
        map,
        tileX: 3,
        tileY: 4,
        session: { partyActorIds: [], switches: {}, variables: {} },
        playBattle: (step: { kind: string }): Promise<BattleOutcome> => {
          battleCalls.push(step.kind);
          return new Promise<BattleOutcome>((resolve) => {
            settleBattle = resolve;
          });
        },
        setInputEnabled: (enabled: boolean): void => {
          inputCalls.push(enabled);
          scene.inputEnabled = enabled;
          if (enabled) signalRestored?.();
        },
        refreshRuntimeSurfaces: (): void => {},
      } as unknown as PlaySceneContext & { inputEnabled: boolean };

      return {
        scene,
        battleCalls,
        inputCalls,
        finishBattle: (result) => {
          if (!settleBattle) throw new Error("전투가 시작되지 않았다");
          settleBattle(result);
        },
        inputRestored,
      };
    }
    describe("전투 중 랜덤 인카운터 재진입 가드", () => {
      it("전투가 진행되는 동안 걸음이 더 발생해도 두 번째 인카운터가 터지지 않는다", () => {
        const project = store.getCurrent();
        project.system.actionCombat = { enabled: false };
        const probe = makeSceneInBattleProbe(makeEncounterMap());

        resetEncounterCounter();
        maybeTriggerRandomEncounter(probe.scene);
        for (let step = 0; step < 5; step += 1) maybeTriggerRandomEncounter(probe.scene);

        expect(probe.battleCalls).toEqual(["battleProcessing"]);
      });

      it("인카운터 전투가 시작되면 맵 로직과 입력이 잠긴다", () => {
        const project = store.getCurrent();
        project.system.actionCombat = { enabled: false };
        const probe = makeSceneInBattleProbe(makeEncounterMap());

        resetEncounterCounter();
        maybeTriggerRandomEncounter(probe.scene);

        expect(probe.scene.running).toBe(true);
        expect(probe.inputCalls).toEqual([false]);
      });

      it("전투가 끝나면 맵 입력과 인카운터가 정상 복구된다", async () => {
        const project = store.getCurrent();
        project.system.actionCombat = { enabled: false };
        const probe = makeSceneInBattleProbe(makeEncounterMap());

        resetEncounterCounter();
        maybeTriggerRandomEncounter(probe.scene);
        expect(probe.battleCalls).toHaveLength(1);

        probe.finishBattle("victory");
        await probe.inputRestored;

        expect(probe.scene.running).toBe(false);
        expect(probe.inputCalls).toEqual([false, true]);

        maybeTriggerRandomEncounter(probe.scene);
        expect(probe.battleCalls).toEqual(["battleProcessing", "battleProcessing"]);
      });
    });
  });
  // 도그푸딩 「등대지기의 겨울」: 얼어붙은 해안 동굴(인카운터 표 2개·조우율 25)에서 30걸음을 오갔는데
  // 전투가 한 번도 나지 않았다고 보고됐다. 생성된 모양 그대로(조건 `{}` 인 표 항목, encounterRate 25)
  // 런타임 조우 판정이 30걸음 안에 발동하는지 여러 시드로 못박는다. 당시 재현은 다른 맵으로
  // __oprnDebug.teleport 한 뒤라 화면·입력이 옛 맵에 묶여 있었다(PR #1219 로 고침).
  describe("generatedCaveEncounterFires", () => {
    isolateTimers();
    function caveLike(): GameMap {
      const project = store.getCurrent();
      const base = project.maps[project.startMapId]!;
      return {
        ...base,
        id: "map_ice_cave",
        encounterRate: 25,
        encounterTable: [
          { troopId: project.database.troops[0]!.id, weight: 50, conditions: {} },
          { troopId: project.database.troops[1]!.id, weight: 50, conditions: {} },
        ],
      } as GameMap;
    }
    function stepsUntilEncounter(seed: number, maxSteps: number): number | null {
      const project = store.getCurrent();
      project.system.actionCombat = { enabled: false };
      const session = startSession(project);
      reseedSessionRng(session, seed);
      const battles: string[] = [];
      const scene = {
        running: false,
        inputEnabled: true,
        map: caveLike(),
        tileX: 3,
        tileY: 3,
        session,
        playBattle: (step: { troopId: string }) => { battles.push(step.troopId); return new Promise(() => {}); },
        setInputEnabled: () => {},
        refreshRuntimeSurfaces: () => {},
      } as unknown as PlaySceneContext;
      resetEncounterCounter();
      for (let step = 1; step <= maxSteps; step += 1) {
        maybeTriggerRandomEncounter(scene);
        if (battles.length > 0) return step;
      }
      return null;
    }
    describe("generated cave encounter table", () => {
      it("fires within 30 steps for every seed", () => {
        for (let seed = 1; seed <= 25; seed += 1) {
          const steps = stepsUntilEncounter(seed, 30);
          expect(steps, `seed ${seed}`).not.toBeNull();
        }
      });
    });
  });
  describe("lifeQaObservability", () => {
    isolateTimers();
    const windows: Window[] = [];
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const w of windows.splice(0)) w.close(); });
    function fixture(instrumented = false) {
      const w = new Window(); windows.push(w);
      vi.stubGlobal("window", w); vi.stubGlobal("document", w.document);
      vi.stubGlobal("HTMLElement", w.HTMLElement); vi.stubGlobal("CustomEvent", w.CustomEvent);
      const project = lifeQaProject();
      vi.spyOn(store, "getCurrent").mockReturnValue(project);
      const session = startSession(project, 5);
      const host = document.createElement("div"); document.body.append(host);
      const runtimeDom = new RuntimeDomOverlay(() => host, { qaInstrumentation: instrumented });
      const scene: Parameters<typeof handleAction>[0] = {
        session, map: project.maps[project.startMapId]!, tileX: 2, tileY: 2,
        facing: "down", lastActionTargetKey: "", eventPositions: {}, autonomousNPCs: new Map(),
        eventSprites: new Map(), runEvent: async () => undefined, runtimeDom,
      };
      return { scene, project, session, host, runtimeDom };
    }
    function nextReceipt(host: HTMLElement): Promise<RuntimeActionReceipt> {
      return new Promise((resolve, reject) => {
        const onReceipt = (event: Event) => {
          clearTimeout(timeout); host.removeEventListener("oprn:action", onReceipt);
          if (event instanceof CustomEvent) resolve(event.detail);
          else reject(new Error("Not a receipt event"));
        };
        const timeout = setTimeout(() => {
          host.removeEventListener("oprn:action", onReceipt); reject(new Error("Missing action receipt"));
        }, 500);
        host.addEventListener("oprn:action", onReceipt);
      });
    }
    describe("life QA observability", () => {
      it("clones existing life owners without progressing makers or paying recovery", () => {
        const { session } = fixture();
        session.farmPlots = { map_blank_start: { "2,3": { tilled: true, watered: false, stage: 2 } } };
        session.makerInstances = { m: { instanceId: "m", makerId: "removed", status: "processing", readyAtMinute: 0 } };
        session.farmAnimals = { a: { instanceId: "a", name: "Cow", speciesId: "cow", buildingId: "barn", friendship: 4, productionProgress: 1, readyProductCount: 2 } };
        session.farmBuildingPlacements = { barn: { instanceId: "barn", typeId: "shed", level: 1, mapId: "map_blank_start", x: 4, y: 4, orientation: "down" } };
        session.lifeRecovery = { nextSequence: 2, claims: { "1": { id: "1", sourceKind: "maker", sourceId: "m", reason: "removed", items: [{ itemId: "qa-hoe", count: 3 }] } } };
        const before = structuredClone(session);
        const snapshot = buildLifeRuntimeSnapshot(session);
        for (const key of ["farmPlots", "energy", "makerInstances", "farmAnimals", "farmBuildingPlacements", "lifeRecovery"] as const) {
          expect(snapshot[key]).toEqual(before[key]);
        }
        expect(snapshot.farmPlots).not.toBe(session.farmPlots);
        expect(snapshot.lifeRecovery?.claims).not.toBe(session.lifeRecovery.claims);
        expect(snapshot.makerInstances?.m?.status).toBe("processing");
        expect(session).toEqual(before);
        expect(snapshot.farmPlots?.map_blank_start?.["2,3"]).not.toHaveProperty("regrowDaysRemaining");
        expect(snapshot.farmAnimals?.a).not.toHaveProperty("housingPlacementId");
      });
      it("does not materialize missing optional owners", () => {
        expect(buildLifeRuntimeSnapshot({})).toEqual({});
      });
      it("publishes a prearmed actual acceptance then a rejection without state mutation", async () => {
        const { scene, host, session, runtimeDom } = fixture(true);
        const accepted = nextReceipt(host);
        expect(handleAction(scene)).toBe(true);
        expect(await accepted).toMatchObject({ sequence: 1, kind: "action", handled: true, farmAttempts: [{ kind: "tilled", x: 2, y: 3, energySpent: 1 }] });
        scene.facing = "right";
        const before = structuredClone(session);
        const rejected = nextReceipt(host);
        expect(handleAction(scene)).toBe(false);
        expect(await rejected).toMatchObject({ sequence: 2, handled: false, farmAttempts: [{ kind: "ignored", reason: "insufficient-energy" }, { kind: "ignored", reason: "insufficient-energy" }] });
        expect(session).toEqual(before);
        expect(session).not.toHaveProperty("actionReceipt");
        expect(runtimeDom.actionReceipt?.sequence).toBe(2);
        expect(fixture(true).runtimeDom.actionReceipt).toBeUndefined();
      });
      it("off does not emit or retain an action receipt even after a real action", () => {
        const { scene, runtimeDom, host } = fixture();
        const observed = vi.fn(); host.addEventListener("oprn:action", observed);
        handleAction(scene);
        expect(runtimeDom.actionReceipt).toBeUndefined();
        expect(observed).not.toHaveBeenCalled();
        expect(host.querySelector("[data-testid=runtime-state-json]")).toBeNull();
        expect(Reflect.has(window, "__oprnDebug")).toBe(false);
      });
      it("the headless runner reports the same life owners, detached from its session", () => {
        const project = lifeQaProject();
        const result = runSceneTest(project, { mapId: project.startMapId, start: project.startPos, steps: [] });
        expect(result.ok).toBe(true);
        expect(result.finalState.energy).toBe(1);
        expect(result.finalState.farmPlots).toEqual(result.session.farmPlots);
        expect(result.finalState.farmPlots).not.toBe(result.session.farmPlots);
      });
    });
    describe("life QA baseline characterization", () => {
      it("real action spends one energy to till, then rejects without changing session", () => {
        const { scene, session } = fixture();
        expect(handleAction(scene)).toBe(true);
        expect(session.farmPlots?.[scene.map.id]?.["2,3"]).toMatchObject({ tilled: true });
        expect(session.energy).toBe(0);
        scene.facing = "right";
        const before = structuredClone(session);
        expect(handleAction(scene)).toBe(false);
        expect(session).toEqual(before);
      });
      it("an uninstrumented overlay starts without a mirror", () => {
        const { host, runtimeDom } = fixture();
        expect(runtimeDom.instrumented).toBe(false);
        expect(host.querySelector("[data-testid=runtime-state-json]")).toBeNull();
      });
    });
  });
  describe("terrainEncounterScaling", () => {
    isolateTimers();
    function authorTerrain(project: ReturnType<typeof createBlankProject>, tag: number): { mapId: string; x: number; y: number } {
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      if (!map) throw new Error("missing start map");
      const tileset = project.tilesets[map.tilesetId];
      if (!tileset) throw new Error("missing tileset");
      const tile = map.lowerTiles[project.startPos.y * map.width + project.startPos.x] ?? 0;
      if (!Array.isArray(tileset.terrain)) (tileset as { terrain: number[] }).terrain = [];
      while (tileset.terrain.length <= tile) tileset.terrain.push(0);
      tileset.terrain[tile] = tag;
      const meta = [...(tileset.tileMeta ?? [])];
      while (meta.length <= tile) meta.push({ label: "", description: "" });
      meta[tile] = { ...(meta[tile] ?? { label: "", description: "" }), terrainTag: tag };
      tileset.tileMeta = meta;
      return { mapId, x: project.startPos.x, y: project.startPos.y };
    }
    function makeScene(map: GameMap, playBattleCalls: string[]): PlaySceneContext {
      const scene = {
        running: false,
        inputEnabled: true,
        map,
        tileX: 0,
        tileY: 0,
        session: { partyActorIds: [], switches: {}, variables: {} },
        playBattle: async (cmd: { kind: string }) => {
          playBattleCalls.push(cmd.kind);
          return "escape" as const;
        },
        setInputEnabled: (enabled: boolean) => {
          scene.inputEnabled = enabled;
        },
      } as unknown as PlaySceneContext & { inputEnabled: boolean };
      return scene;
    }
    describe("terrain encounter scaling", () => {
      it("scales map encounter rate by terrain encounterRatePercent", () => {
        const project = createBlankProject();
        project.system.actionCombat = { enabled: false };
        const map = project.maps[project.startMapId];
        if (!map) throw new Error("missing map");
        map.encounterRate = 1000;
        map.troopIds = ["troop_a"];
        map.encounterTable = undefined;
        const loc = authorTerrain(project, 2);
        project.database.terrains = [
          { id: "t1", name: "평지", damage: 0, encounterRatePercent: 100, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
          { id: "t2", name: "안전지대", damage: 0, encounterRatePercent: 0, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
        ];
        store.replaceProject(project);
        const calls: string[] = [];
        const scene = makeScene(store.getCurrent().maps[loc.mapId] as GameMap, calls);
        scene.tileX = loc.x;
        scene.tileY = loc.y;

        resetEncounterCounter();
        for (let i = 0; i < 5; i += 1) maybeTriggerRandomEncounter(scene);

        expect(calls).toEqual([]);
      });
    });
  });
});
