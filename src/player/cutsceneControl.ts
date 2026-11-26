import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"

export const CUTSCENE_END_LABEL = "cutscene_end";
export const CUTSCENE_LOCK_FLAG = "cutscene:inputLocked";
export const CUTSCENE_SKIPPABLE_FLAG = "cutscene:skippable";
export const CUTSCENE_HIDE_HUD_FLAG = "cutscene:hideHud";
/** `.play-stage` 에 붙는 클래스. HUD 억제 규칙은 styles/runtime/playSurface.css 가 소유한다. */
export const CUTSCENE_HUD_HIDDEN_CLASS = "cutscene-hud-hidden";

const OWNER_PREFIX = "cutscene:owner:";
const OWNER_SKIPPABLE_PREFIX = "cutscene:ownerSkippable:";

function ownerFlag(ownerId: string | undefined): string {
  return `${OWNER_PREFIX}${ownerId || "anonymous"}`;
}

function ownerSkippableFlag(ownerId: string | undefined): string {
  return `${OWNER_SKIPPABLE_PREFIX}${ownerId || "anonymous"}`;
}

export function beginCutsceneControl(
  session: PlaySessionLike,
  ownerId: string | undefined,
  skippable: boolean
): void {
  session.flags[CUTSCENE_LOCK_FLAG] = true;
  session.flags[CUTSCENE_SKIPPABLE_FLAG] = skippable;
  session.flags[ownerFlag(ownerId)] = true;
  session.flags[ownerSkippableFlag(ownerId)] = skippable;
  const runtime = ensureM2Runtime(session);
  runtime.cutscene.lockPlayer = true;
  runtime.cutscene.skippable = skippable;
}

/**
 * 이 owner(이벤트)의 컷신 제어만 푼다. 다른 owner 가 아직 잡고 있으면 잠금은 남고 건너뛰기 가능 여부는 남은 owner 를 따른다 —
 * 전투 뒤 무리 이벤트·잠자기 이벤트처럼 안에서 도는 이벤트의 「컷신 끝」이 바깥 컷신의 잠금까지 풀던 결함(2026-11-26 오너 결정 D4).
 * 이 owner 가 잡은 적이 없는 「끝」(옛 세이브, 다른 명령으로 연 잠금)은 예전처럼 다 푼다 — 잠금이 영영 남지 않게.
 */
export function endCutsceneControl(session: PlaySessionLike, ownerId?: string): void {
  if (session.flags[ownerFlag(ownerId)] !== true) {
    clearCutsceneControl(session);
    return;
  }
  delete session.flags[ownerFlag(ownerId)];
  delete session.flags[ownerSkippableFlag(ownerId)];
  const remaining = Object.keys(session.flags).filter((key) => key.startsWith(OWNER_PREFIX) && session.flags[key] === true);
  if (remaining.length > 0) {
    const skippable = remaining.some((key) => session.flags[`${OWNER_SKIPPABLE_PREFIX}${key.slice(OWNER_PREFIX.length)}`] === true);
    session.flags[CUTSCENE_SKIPPABLE_FLAG] = skippable;
    ensureM2Runtime(session).cutscene.skippable = skippable;
    return;
  }
  clearCutsceneControl(session);
}

function clearCutsceneControl(session: PlaySessionLike): void {
  delete session.flags[CUTSCENE_LOCK_FLAG];
  delete session.flags[CUTSCENE_SKIPPABLE_FLAG];
  for (const key of Object.keys(session.flags)) {
    if (key.startsWith(OWNER_PREFIX) || key.startsWith(OWNER_SKIPPABLE_PREFIX)) delete session.flags[key];
  }
  const runtime = ensureM2Runtime(session);
  runtime.cutscene.lockPlayer = false;
  runtime.cutscene.skippable = false;
}

export function releaseCutsceneControlForOwner(session: PlaySessionLike, ownerId: string | undefined): void {
  if (session.flags[ownerFlag(ownerId)] === true) endCutsceneControl(session, ownerId);
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
