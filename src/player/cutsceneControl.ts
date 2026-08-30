import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"

export const CUTSCENE_END_LABEL = "cutscene_end";
export const CUTSCENE_LOCK_FLAG = "cutscene:inputLocked";
export const CUTSCENE_SKIPPABLE_FLAG = "cutscene:skippable";
export const CUTSCENE_HIDE_HUD_FLAG = "cutscene:hideHud";
export const CUTSCENE_HUD_HIDDEN_CLASS = "cutscene-hud-hidden";

function ownerFlag(ownerId: string | undefined): string {
  return `cutscene:owner:${ownerId || "anonymous"}`;
}

export function beginCutsceneControl(
  session: PlaySessionLike,
  ownerId: string | undefined,
  skippable: boolean
): void {
  session.flags[CUTSCENE_LOCK_FLAG] = true;
  session.flags[CUTSCENE_SKIPPABLE_FLAG] = skippable;
  session.flags[ownerFlag(ownerId)] = true;
  const runtime = ensureM2Runtime(session);
  runtime.cutscene.lockPlayer = true;
  runtime.cutscene.skippable = skippable;
}

export function endCutsceneControl(session: PlaySessionLike): void {
  delete session.flags[CUTSCENE_LOCK_FLAG];
  delete session.flags[CUTSCENE_SKIPPABLE_FLAG];
  for (const key of Object.keys(session.flags)) {
    if (key.startsWith("cutscene:owner:")) delete session.flags[key];
  }
  const runtime = ensureM2Runtime(session);
  runtime.cutscene.lockPlayer = false;
  runtime.cutscene.skippable = false;
}

export function releaseCutsceneControlForOwner(session: PlaySessionLike, ownerId: string | undefined): void {
  if (session.flags[ownerFlag(ownerId)] === true) endCutsceneControl(session);
}

export function isCutsceneInputLocked(session: Pick<PlaySessionLike, "flags">): boolean {
  return session.flags[CUTSCENE_LOCK_FLAG] === true || session.flags["cutscene:lockPlayer"] === true;
}

export function isCutsceneSkippable(session: Pick<PlaySessionLike, "flags">): boolean {
  return isCutsceneInputLocked(session) && session.flags[CUTSCENE_SKIPPABLE_FLAG] === true;
}

export function isCutsceneHudHidden(session: Pick<PlaySessionLike, "flags">): boolean {
  return isCutsceneInputLocked(session) || session.flags[CUTSCENE_HIDE_HUD_FLAG] === true;
}
