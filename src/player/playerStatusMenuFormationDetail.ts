import { defaultActorFaceResourceId } from "@/project/actorModel";
import type { ActorRecord } from "@/project/types";
import type {
  StatusMenuDetail,
  StatusMenuDetailEntry,
  StatusMenuDetailOptions,
} from "@/player/playerStatusMenuDetails";

export function formationDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const actors = partyActors(options);
  if (!options.formationActorId) {
    return {
      title: "진형",
      entries: actors.map((actor, index) => ({
        label: `${index + 1}. ${actor.name}`,
        value: options.project.database.classes.find((record) => record.id === actor.classId)?.name ?? "직업 없음",
        face: actorFaceEntry(actor),
        testId: `status-menu-formation-actor-${actor.id}`,
        onActivate: options.onSelectFormationActor ? () => options.onSelectFormationActor?.(actor.id) : undefined,
      })),
      emptyLabel: "진형을 볼 파티원이 없습니다",
    };
  }

  const actor = actors.find((item) => item.id === options.formationActorId);
  const selectedName = actor?.name ?? "선택 없음";
  return {
    title: `진형: ${selectedName}`,
    entries: [
      {
        label: selectedName,
        value: "선택됨",
        description: "위로/아래로 위치를 바꿉니다",
        face: actor ? actorFaceEntry(actor) : undefined,
      },
      {
        label: "위로",
        value: "한 칸 이동",
        testId: "status-menu-formation-move-up",
        onActivate: options.onMoveFormationActor ? () => options.onMoveFormationActor?.(options.formationActorId ?? "", -1) : undefined,
      },
      {
        label: "아래로",
        value: "한 칸 이동",
        testId: "status-menu-formation-move-down",
        onActivate: options.onMoveFormationActor ? () => options.onMoveFormationActor?.(options.formationActorId ?? "", 1) : undefined,
      },
    ],
  };
}

function partyActors(options: StatusMenuDetailOptions): readonly ActorRecord[] {
  const actorsById = new Map(options.project.database.actors.map((actor) => [actor.id, actor]));
  return options.session.partyActorIds.flatMap((actorId): ActorRecord[] => {
    const actor = actorsById.get(actorId);
    return actor ? [actor] : [];
  });
}

function actorFaceEntry(actor: ActorRecord): NonNullable<StatusMenuDetailEntry["face"]> {
  return {
    resourceId: actor.faceResourceId ?? defaultActorFaceResourceId(actor),
    alt: `${actor.name} face`,
    testId: `status-menu-formation-face-${actor.id}`,
  };
}
