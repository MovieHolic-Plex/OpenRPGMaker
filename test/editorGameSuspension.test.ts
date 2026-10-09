import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  _resetEditorGameSuspensionForTest,
  configureEditorGameAccessor,
  isEditorGameSuspended,
  resumeEditorGame,
  suspendEditorGame,
} from "@/editor/panels/editorGameSuspension";

const modeHarness = { game: null as unknown };

function fakeGame(): {
  loop: { running: boolean; sleep: ReturnType<typeof vi.fn>; wake: ReturnType<typeof vi.fn> };
  input: { keyboard: { enabled: boolean } };
  scale: { refresh: ReturnType<typeof vi.fn> };
} {
  const game = {
    loop: {
      running: true,
      sleep: vi.fn(() => {
        game.loop.running = false;
      }),
      wake: vi.fn(() => {
        game.loop.running = true;
      }),
    },
    input: { keyboard: { enabled: true } },
    scale: { refresh: vi.fn() },
  };
  return game;
}

describe("editorGameSuspension", () => {
  beforeEach(() => {
    _resetEditorGameSuspensionForTest();
    modeHarness.game = null;
    configureEditorGameAccessor(() => modeHarness.game);
  });

  it("테스트 플레이 창이 열리면 편집기 게임 루프를 멈추고 키보드 매니저를 끈다", () => {
    const game = fakeGame();
    modeHarness.game = game;
    suspendEditorGame();
    expect(game.loop.sleep).toHaveBeenCalledTimes(1);
    expect(game.loop.running).toBe(false);
    expect(game.input.keyboard.enabled).toBe(false);
    expect(isEditorGameSuspended()).toBe(true);
  });

  it("창을 닫으면 루프를 이어서 깨우고(seamless) 키보드·크기를 되살린다", () => {
    const game = fakeGame();
    modeHarness.game = game;
    suspendEditorGame();
    resumeEditorGame();
    expect(game.loop.wake).toHaveBeenCalledWith(true);
    expect(game.loop.running).toBe(true);
    expect(game.input.keyboard.enabled).toBe(true);
    expect(game.scale.refresh).toHaveBeenCalledTimes(1);
    expect(isEditorGameSuspended()).toBe(false);
  });

  it("두 번 열어도 한 번만 잠재우고, 잠재운 적 없으면 닫기는 아무 일도 하지 않는다", () => {
    const game = fakeGame();
    modeHarness.game = game;
    resumeEditorGame();
    expect(game.loop.wake).not.toHaveBeenCalled();
    suspendEditorGame();
    suspendEditorGame();
    expect(game.loop.sleep).toHaveBeenCalledTimes(1);
  });

  it("편집기 게임이 없으면(플레이 전용 셸·접근자 미주입) 조용히 지나간다", () => {
    _resetEditorGameSuspensionForTest();
    expect(() => suspendEditorGame()).not.toThrow();
    expect(isEditorGameSuspended()).toBe(false);
    expect(() => resumeEditorGame()).not.toThrow();
  });

  it("잠든 사이 파괴된 게임(isRunning=false)은 깨우지 않는다", () => {
    const game = fakeGame() as ReturnType<typeof fakeGame> & { isRunning?: boolean };
    modeHarness.game = game;
    suspendEditorGame();
    game.isRunning = false;
    resumeEditorGame();
    expect(game.loop.wake).not.toHaveBeenCalled();
    expect(game.scale.refresh).not.toHaveBeenCalled();
    expect(isEditorGameSuspended()).toBe(false);
  });

  it("이미 꺼져 있던 키보드는 닫은 뒤에도 꺼진 채로 둔다", () => {
    const game = fakeGame();
    game.input.keyboard.enabled = false;
    modeHarness.game = game;
    suspendEditorGame();
    resumeEditorGame();
    expect(game.input.keyboard.enabled).toBe(false);
  });
});
