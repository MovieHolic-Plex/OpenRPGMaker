import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOUSE_DOOR_OPEN_SE } from "@/editor/houseInteriors";
import { runCommands } from "@/player/playSceneInterpreter";
import { applyNonBlockingStep } from "@/player/playSceneSchedulers";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { FakeElement, installFakeDom } from "./fakeDom";

// 오디오 배너("지금 흐르는 곡")는 루프 채널 전용이다.
// 문 열림처럼 수시로 울리는 원샷 SE 까지 배너를 띄우면, clear 경로가 stopAudio 뿐이라
// 리소스 id 가 게임 화면에 박혀 남는다 (2026-08-30 브라우저 QA 실측).
function mkScene() {
  const project = createBlankProject();
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

describe("오디오 배너는 루프 채널 전용", () => {
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
});
