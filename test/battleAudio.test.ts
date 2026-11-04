import { describe, expect, it, vi } from "vitest";

vi.mock("@/player/audio", () => ({
  playAudioCommand: vi.fn(),
  stopAudioChannel: vi.fn(),
  playMusicEffect: vi.fn(),
  playSoundEffect: vi.fn(),
}));

import { playAudioCommand, playMusicEffect, playSoundEffect, stopAudioChannel } from "@/player/audio";
import {
  authoredBattleResultResourceId,
  beginBattleResultAudio,
  enterBattleAudio,
  exitBattleAudio,
  playAuthoredBattleResultCue,
} from "@/player/battleAudio";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
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
      { resourceId: "cc0-bgm-rtp-fld-003", loop: true, channel: "bgm" },
      project,
    );
    expect(session.audio.bgm?.resourceId).toBe("cc0-bgm-rtp-fld-003");
  });

  it("승패가 나면 결과 화면 전에 전투 BGM 을 끊는다", () => {
    vi.mocked(stopAudioChannel).mockClear();
    beginBattleResultAudio();
    expect(stopAudioChannel).toHaveBeenCalledWith("bgm", 80);
  });

  it("자료집 승리 팡파레가 있으면 ME 로 재생한다", () => {
    vi.mocked(playMusicEffect).mockReturnValue(true);
    const project = {
      system: { battleVictoryMeResourceId: "cc0-bgm-rtp-ttl-001" },
    } as Project;
    expect(authoredBattleResultResourceId(project.system, "victory")).toBe("cc0-bgm-rtp-ttl-001");
    expect(playAuthoredBattleResultCue(project, "victory")).toBe(true);
    expect(playMusicEffect).toHaveBeenCalledWith("cc0-bgm-rtp-ttl-001", project);
  });

  it("패배·도주 슬롯은 SE 채널로 재생한다", () => {
    vi.mocked(playSoundEffect).mockReturnValue(true);
    const project = {
      system: {
        battleDefeatSeResourceId: "easyrpg-sound-collapse1",
        battleEscapeSeResourceId: "easyrpg-sound-escape",
      },
    } as Project;
    expect(playAuthoredBattleResultCue(project, "defeat")).toBe(true);
    expect(playSoundEffect).toHaveBeenCalledWith("easyrpg-sound-collapse1", project);
    expect(playAuthoredBattleResultCue(project, "escape")).toBe(true);
    expect(playSoundEffect).toHaveBeenCalledWith("easyrpg-sound-escape", project);
  });

  it("자료집 승패 슬롯은 정규화 왕복에서 사라지지 않는다", () => {
    const out = normalizeSystemRecords({
      ...createBlankProject().system,
      battleVictoryMeResourceId: "cc0-bgm-rtp-ttl-001",
      battleDefeatSeResourceId: "easyrpg-sound-collapse1",
      battleEscapeSeResourceId: "easyrpg-sound-escape",
    });
    expect(out.battleVictoryMeResourceId).toBe("cc0-bgm-rtp-ttl-001");
    expect(out.battleDefeatSeResourceId).toBe("easyrpg-sound-collapse1");
  it("지금 맵의 전투곡이 프로젝트 전투곡보다 먼저이고, 이벤트가 건 보스곡이 그보다 먼저다", () => {
    vi.mocked(playAudioCommand).mockClear();
    const project = {
      system: { battleBgmResourceId: "cc0-bgm-rtp-btl-001" },
      maps: { map_forest: { battleBgmResourceId: "cc0-bgm-battle" }, map_town: {} },
    } as unknown as Project;
    const inForest = { ...sessionWithBgm("cc0-bgm-rtp-fld-002"), currentMapId: "map_forest" } as PlaySession;
    enterBattleAudio(project, inForest);
    expect(inForest.audio.bgm?.resourceId).toBe("cc0-bgm-battle");
    const inTown = { ...sessionWithBgm("cc0-bgm-rtp-fld-001"), currentMapId: "map_town" } as PlaySession;
    enterBattleAudio(project, inTown);
    expect(inTown.audio.bgm?.resourceId).toBe("cc0-bgm-rtp-btl-001");
    const boss = { ...sessionWithBgm("cc0-bgm-rtp-fld-002"), currentMapId: "map_forest", systemAudioOverrides: { bgm: { battle: { resourceId: "cc0-bgm-rtp-btl-002", volume: 100 } } } } as PlaySession;
    enterBattleAudio(project, boss);
    expect(boss.audio.bgm?.resourceId).toBe("cc0-bgm-rtp-btl-002");
  });
});
