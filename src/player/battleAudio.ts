import { playAudioCommand, playMusicEffect, playSoundEffect, stopAudioChannel } from "@/player/audio";
import type { AudioTrackState, PlaySession } from "@/project/session";
import type { Project, SystemRecords } from "@/project/types";
import { systemAudioOverride } from "@/player/systemAudioSlots";

export type BattleResultCueKind = "victory" | "defeat" | "escape";

export interface BattleAudioSession {
  readonly fieldBgm?: AudioTrackState;
}

/** 필드 BGM 을 기억하고 전투곡으로 갈아탄다. 같은 곡이면 건드리지 않는다. */
export function enterBattleAudio(project: Project, session: PlaySession): BattleAudioSession {
  const fieldBgm = session.audio.bgm;
  const battleBgmResourceId = systemAudioOverride(session.m2Runtime, "battle") ?? project.system.battleBgmResourceId;
  if (battleBgmResourceId && battleBgmResourceId !== fieldBgm?.resourceId) {
    playAudioCommand({ resourceId: battleBgmResourceId, loop: true }, project);
    session.audio.bgm = { resourceId: battleBgmResourceId, loop: true };
  }
  return { fieldBgm };
}

/**
 * 승패·도주가 확정되는 순간 전투 BGM 을 끊는다.
 * 결과 화면에서 필드곡을 되돌리기 전에 팡파레가 묻히지 않게 하기 위함이다.
 */
export function beginBattleResultAudio(): void {
  stopAudioChannel("bgm", 80);
}

export function authoredBattleResultResourceId(
  system: Pick<SystemRecords, "battleVictoryMeResourceId" | "battleDefeatSeResourceId" | "battleEscapeSeResourceId">,
  kind: BattleResultCueKind,
): string | undefined {
  if (kind === "victory") return system.battleVictoryMeResourceId;
  if (kind === "defeat") return system.battleDefeatSeResourceId;
  return system.battleEscapeSeResourceId;
}

/** 자료집에서 고른 승패 큐를 재생한다. 없거나 URL 을 못 풀면 false → 호출부가 폴백. */
export function playAuthoredBattleResultCue(project: Project, kind: BattleResultCueKind, session?: Pick<PlaySession, "m2Runtime">): boolean {
  const resourceId = (kind === "victory" ? undefined : systemAudioOverride(session?.m2Runtime, kind))
    ?? authoredBattleResultResourceId(project.system, kind);
  if (kind === "victory") return playMusicEffect(resourceId, project);
  return playSoundEffect(resourceId, project);
}

/**
 * 전투 씬을 닫을 때 필드 BGM 을 되돌린다.
 * 필드곡이 없으면 전투곡만 멈추고 세션 슬롯을 비운다 — 예전에는 `session.audio.bgm`
 * 만 지우고 엔진은 그대로 돌려서, 필드 무음 맵에서 전투곡이 맵까지 따라왔다.
 */
export function exitBattleAudio(project: Project, session: PlaySession, saved: BattleAudioSession): void {
  stopAudioChannel("bgm");
  if (saved.fieldBgm) {
    playAudioCommand({ ...saved.fieldBgm, channel: "bgm" }, project);
    session.audio.bgm = saved.fieldBgm;
    return;
  }
  session.audio.bgm = undefined;
}
