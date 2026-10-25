// player/playSceneDialogueFacing.ts
// 대사 자동 돌아보기 — 말하는 인물이 듣는 인물 쪽으로 돈다(둘 다 맵에 있고 AUTO_FACE_RANGE 칸 안일 때).
//
// 왜(2026-10-22 『첫사랑』 막차 승강장): 장면이 face(id, "right") 처럼 방향을 손으로 골랐고, 그 앞 걸음이 한 칸이라도
// 어긋나면 두 사람이 서로 다른 데를 보며 말했다. 대사가 «누가 누구에게»를 알면 방향은 계산된다(project/staging/dialogueActors.ts).
// 끄기: text.autoFace === false (등 돌린 채 말하기 같은 의도된 연출). 걷는 중·방향 고정·고정 그림 인물은 돌리지 않는다.
import { store } from "@/project/store";
import { runtimeEventViewsForMap, moveRuntimeEventPosition, type RuntimeEventView } from "@/project/runtimeEventState";
import { AUTO_FACE_RANGE, CALLING_FACE_RANGE, chebyshev, dirToward, type StageCell } from "@/project/staging/approach";
import { PLAYER_ACTOR, pushRecentSpeaker, resolveAddressee, resolveSpeakerActor, type StageActorCandidate } from "@/project/staging/dialogueActors";
import { getCharacterProfile } from "@/project/characterProfiles";
import { setNpcIdleFrame } from "@/player/playSceneAutonomousSprites";
import type { AutonomousNpcSprite } from "@/player/playSceneAutonomousTypes";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { Project } from "@/project/types";

type FacingScene = Pick<PlaySceneContext, "map" | "session" | "eventPositions" | "tileX" | "tileY" | "moving" | "autonomousNPCs" | "eventSprites" | "player" | "playerSprite" | "playerRoute"> & { facing: PlaySceneContext["facing"] };

export type DialogueFacingLine = {
  readonly speaker?: string;
  readonly speakerActor?: string;
  readonly addressee?: string;
  readonly autoFace?: boolean;
  readonly calling?: boolean;
};

/** 대사 한 줄의 «누가 누구에게» — 흉상 좌우(text.bustSide = "stage")가 읽는다. 줄마다 applyDialogueFacing 이 새로 쓴다. */
export type DialogueStage = { readonly speakerId: string; readonly addresseeId: string | null; readonly from: StageCell | null; readonly to: StageCell | null; readonly addresseeNames: readonly string[] };
const lastStage = new WeakMap<object, DialogueStage | null>();
export function lastDialogueStage(scene: object): DialogueStage | null {
  return lastStage.get(scene) ?? null;
}

/** 장면(이벤트 실행)마다 «방금 말한 NPC» — 주인공 대사의 기본 청자. */
const recentSpeakers = new WeakMap<object, { runKey: string; ids: string[] }>();

export function playerNames(project: Project, session: PlaySceneContext["session"]): string[] {
  const leaderId = session.partyActorIds?.[0];
  const actor = project.database.actors.find((a) => a.id === leaderId) ?? project.database.actors[0];
  const out: string[] = [];
  const override = leaderId ? session.actorNames?.[leaderId] : undefined;
  if (override) out.push(override);
  if (actor?.name) out.push(actor.name);
  return out;
}

function isShown(view: RuntimeEventView): boolean {
  return !view.transparent && Boolean(view.sprite || view.page?.graphic.appearanceId);
}

export function visibleStageActors(project: Project, scene: Pick<PlaySceneContext, "map" | "session" | "eventPositions">): { views: RuntimeEventView[]; candidates: StageActorCandidate[] } {
  const views = runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions).filter(isShown);
  const candidates = views.map((v): StageActorCandidate => {
    const profile = getCharacterProfile(project, v.event.characterId);
    return { id: v.event.id, names: [v.event.name ?? "", profile?.displayName ?? ""].filter(Boolean), x: v.x, y: v.y };
  });
  return { views, candidates };
}

/** 대사 한 줄 앞에서 부른다. 돌린 인물 id(없으면 null). */
export function applyDialogueFacing(scene: FacingScene, line: DialogueFacingLine, currentEventId: string | undefined): string | null {
  lastStage.set(scene, null);
  try {
    const project = store.getCurrent();
    const { views, candidates } = visibleStageActors(project, scene);
    const player: StageCell = { x: scene.tileX, y: scene.tileY };
    const speakerId = resolveSpeakerActor({
      speaker: line.speaker, speakerActor: line.speakerActor, currentEventId,
      playerNames: playerNames(project, scene.session), visible: candidates, player,
    });
    const runKey = currentEventId ?? "";
    const memo = recentSpeakers.get(scene);
    const recent = memo && memo.runKey === runKey ? memo.ids : [];
    if (speakerId && speakerId !== PLAYER_ACTOR) recentSpeakers.set(scene, { runKey, ids: pushRecentSpeaker(recent, speakerId) });
    else if (!memo || memo.runKey !== runKey) recentSpeakers.set(scene, { runKey, ids: [] });
    if (!speakerId) return null;
    const visibleIds = new Set(views.map((v) => v.event.id));
    const playerPresent = scene.player.visible !== false && scene.player.alpha > 0.05;
    const addresseeId = resolveAddressee({ addressee: line.addressee, speakerActorId: speakerId, recentNpcSpeakers: recent, currentEventId, visibleIds, playerPresent });
    const cellOf = (id: string): StageCell | null => {
      if (id === PLAYER_ACTOR) return player;
      const v = views.find((view) => view.event.id === id);
      return v ? { x: v.x, y: v.y } : null;
    };
    const validAddressee = addresseeId && addresseeId !== speakerId ? addresseeId : null;
    lastStage.set(scene, {
      speakerId, addresseeId: validAddressee,
      from: speakerId === PLAYER_ACTOR && !playerPresent ? null : cellOf(speakerId),
      to: !validAddressee || (validAddressee === PLAYER_ACTOR && !playerPresent) ? null : cellOf(validAddressee),
      addresseeNames: validAddressee ? (validAddressee === PLAYER_ACTOR ? playerNames(project, scene.session) : candidates.find((c) => c.id === validAddressee)?.names ?? []) : [],
    });
    if (line.autoFace === false || !validAddressee) return null;
    const from = cellOf(speakerId), to = cellOf(validAddressee);
    if (!from || !to || chebyshev(from, to) > (line.calling ? CALLING_FACE_RANGE : AUTO_FACE_RANGE)) return null;
    const dir = dirToward(from, to);
    if (!dir) return null;
    const turnPlayer = (d: typeof dir): void => {
      if (scene.moving || scene.playerRoute) return;
      scene.facing = d;
      scene.player.setFrame(scene.playerSprite.idleFrameFor(d));
    };
    if (speakerId === PLAYER_ACTOR) {
      turnPlayer(dir);
      return speakerId;
    }
    const view = views.find((v) => v.event.id === speakerId)!;
    const mover = scene.autonomousNPCs.get(speakerId);
    const busy = Boolean(mover?.activeMove || mover?.directionFix || view.animationType === "fixedGraphic"
      || (mover && mover.moves.length > 0 && mover.step < mover.moves.length && !mover.repeat)); // 걷는 중·방향 고정·명령 경로 중
    if (!busy) {
      if (mover) mover.facing = dir;
      moveRuntimeEventPosition(scene.eventPositions, speakerId, view.x, view.y, dir);
      setNpcIdleFrame(scene.eventSprites.get(speakerId) as unknown as AutonomousNpcSprite | undefined, view.page?.graphic.pattern ?? 0, dir, view.animationType, mover?.animationEnabled ?? true);
    }
    // 주인공이 듣는 쪽이면 주인공도 말하는 NPC 를 돌아본다 — 주인공 방향은 아무도 관리하지 않아, 여럿이 말하는 장면에서 딴 데를 보고 있었다.
    // NPC 끼리의 대화는 말하는 쪽만 돈다(등 돌린 채 듣기 같은 연출을 지킨다 — 마주 보게 하려면 faceEachOther).
    if (validAddressee === PLAYER_ACTOR && !line.calling) turnPlayer(dirToward(to, from) ?? scene.facing);
    return busy ? null : speakerId;
  } catch (error) {
    console.warn("[player] dialogue facing skipped", error);
    return null;
  }
}
