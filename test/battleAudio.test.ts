import { describe, expect, it, vi } from "vitest";

vi.mock("@/player/audio", () => ({
  playAudioCommand: vi.fn(),
  stopAudioChannel: vi.fn(),
}));

import { playAudioCommand, stopAudioChannel } from "@/player/audio";
import { beginBattleResultAudio, enterBattleAudio, exitBattleAudio } from "@/player/battleAudio";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

function sessionWithBgm(resourceId?: string): PlaySession {
  return {
    audio: resourceId ? { bgm: { resourceId, loop: true } } : { bgm: undefined },
  } as PlaySession;
}

function projectWithBattleBgm(resourceId?: string): Project {
  return { system: { battleBgmResourceId: resourceId } } as Project;
}

describe("battle audio", () => {
  it("필드곡이 없어도 전투가 끝나면 엔진의 전투 BGM 을 멈춘다", () => {
    vi.mocked(playAudioCommand).mockClear();
    vi.mocked(stopAudioChannel).mockClear();
    const session = sessionWithBgm(undefined);
    const saved = enterBattleAudio(projectWithBattleBgm("cc0-bgm-rtp-btl-001"), session);
    exitBattleAudio(projectWithBattleBgm("cc0-bgm-rtp-btl-001"), session, saved);
    expect(stopAudioChannel).toHaveBeenCalledWith("bgm");
    expect(session.audio.bgm).toBeUndefined();
  });

  it("필드곡이 있으면 전투 종료 후 그 곡으로 되돌린다", () => {
    vi.mocked(playAudioCommand).mockClear();
    vi.mocked(stopAudioChannel).mockClear();
    const session = sessionWithBgm("cc0-bgm-rtp-fld-003");
    const project = projectWithBattleBgm("cc0-bgm-rtp-btl-001");
    const saved = enterBattleAudio(project, session);
    exitBattleAudio(project, session, saved);
    expect(playAudioCommand).toHaveBeenCalledWith(
      { resourceId: "cc0-bgm-rtp-fld-003", loop: true },
      project,
    );
    expect(session.audio.bgm?.resourceId).toBe("cc0-bgm-rtp-fld-003");
  });

  it("승패가 나면 결과 화면 전에 전투 BGM 을 끊는다", () => {
    vi.mocked(stopAudioChannel).mockClear();
    beginBattleResultAudio();
    expect(stopAudioChannel).toHaveBeenCalledWith("bgm", 80);
  });
});
