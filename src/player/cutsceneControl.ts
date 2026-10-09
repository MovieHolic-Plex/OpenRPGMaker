import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"

export const CUTSCENE_END_LABEL = "cutscene_end";
export const CUTSCENE_LOCK_FLAG = "cutscene:inputLocked";
export const CUTSCENE_SKIPPABLE_FLAG = "cutscene:skippable";
export const CUTSCENE_HIDE_HUD_FLAG = "cutscene:hideHud";
/** `.play-stage` 에 붙는 클래스. HUD 억제 규칙은 styles/runtime/playSurface.css 가 소유한다. */
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

/**
 * 컷신 중 필드 HUD(미니맵·손 슬롯·액션 HUD·타이머/시계)를 숨겨야 하는가.
 *
 * 입력 잠금이 걸린 동안은 항상 숨긴다 — 손 슬롯·액션 HUD 는 "지금 누를 수 있는 것"을
 * 알려주는 표면인데 그 입력이 전부 막혀 있으면 거짓말이 된다(회상 장면 위에 미니맵이
 * 떠 있던 2026-08-30 실측). Modern `Cutscene Control` 의 `HUD 숨김`(hideHud) 는
 * 잠금 없이 HUD 만 걷어내는 독립 스위치로 남는다 — 그 옵션은 드롭다운에만 있고 소비처가
 * 없던 죽은 값이었다.
 */
export function isCutsceneHudHidden(session: Pick<PlaySessionLike, "flags">): boolean {
  return isCutsceneInputLocked(session) || session.flags[CUTSCENE_HIDE_HUD_FLAG] === true;
}
