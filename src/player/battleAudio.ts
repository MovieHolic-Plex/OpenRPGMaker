import { playAudioCommand } from "@/player/audio";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export interface BattleAudioSession {
  readonly fieldBgmResourceId?: string;
}

export function enterBattleAudio(project: Project, session: PlaySession): BattleAudioSession {
  const fieldBgmResourceId = session.audio.bgm?.resourceId;
  const battleBgmResourceId = project.system.battleBgmResourceId;
  if (battleBgmResourceId && battleBgmResourceId !== fieldBgmResourceId) {
    playAudioCommand({ resourceId: battleBgmResourceId, loop: true }, project);
  }
  return { fieldBgmResourceId };
}

export function exitBattleAudio(project: Project, session: PlaySession, saved: BattleAudioSession): void {
  const battleBgmResourceId = project.system.battleBgmResourceId;
  if (!battleBgmResourceId) return;
  if (saved.fieldBgmResourceId) {
    playAudioCommand({ resourceId: saved.fieldBgmResourceId, loop: true }, project);
    session.audio.bgm = { resourceId: saved.fieldBgmResourceId, loop: true };
    return;
  }
  session.audio.bgm = undefined;
}