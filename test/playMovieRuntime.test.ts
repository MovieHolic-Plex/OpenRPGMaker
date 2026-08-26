import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { runCommands } from "@/player/playSceneInterpreter";
import { applyNonBlockingStep } from "@/player/playSceneSchedulers";
import {
  MOVIE_OVERLAY_TESTID,
  MOVIE_VIDEO_TESTID,
  resolveMovieResourceUrl,
} from "@/player/playSceneMovies";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, Project } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

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
  it("wait:true 는 video ended 까지 다음 커맨드를 막는다", async () => {
    const { project, session, scene, host } = mkFixture();
    store.replaceProject(project);
    const running = runCommands(scene, [
      { kind: "playMovie", resourceId: "video_intro" },
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
