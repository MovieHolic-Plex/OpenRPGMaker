import { playAudioCommand, stopAudioChannel } from "@/player/audio";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export interface BattleAudioSession {
  readonly fieldBgmResourceId?: string;
}

/** 필드 BGM 을 기억하고 전투곡으로 갈아탄다. 같은 곡이면 건드리지 않는다. */
export function enterBattleAudio(project: Project, session: PlaySession): BattleAudioSession {
  const fieldBgmResourceId = session.audio.bgm?.resourceId;
  const battleBgmResourceId = project.system.battleBgmResourceId;
  if (battleBgmResourceId && battleBgmResourceId !== fieldBgmResourceId) {
    playAudioCommand({ resourceId: battleBgmResourceId, loop: true }, project);
    session.audio.bgm = { resourceId: battleBgmResourceId, loop: true };
  }
  return { fieldBgmResourceId };
}

/**
 * 승패·도주가 확정되는 순간 전투 BGM 을 끊는다.
 * 결과 화면에서 필드곡을 되돌리기 전에 팡파레가 묻히지 않게 하기 위함이다.
 */
export function beginBattleResultAudio(): void {
  stopAudioChannel("bgm", 80);
}

/**
 * 전투 씬을 닫을 때 필드 BGM 을 되돌린다.
 * 필드곡이 없으면 전투곡만 멈추고 세션 슬롯을 비운다 — 예전에는 `session.audio.bgm`
 * 만 지우고 엔진은 그대로 돌려서, 필드 무음 맵에서 전투곡이 맵까지 따라왔다.
 */
export function exitBattleAudio(project: Project, session: PlaySession, saved: BattleAudioSession): void {
  stopAudioChannel("bgm");
  if (saved.fieldBgmResourceId) {
    playAudioCommand({ resourceId: saved.fieldBgmResourceId, loop: true }, project);
    session.audio.bgm = { resourceId: saved.fieldBgmResourceId, loop: true };
    return;
  }
  session.audio.bgm = undefined;
}
