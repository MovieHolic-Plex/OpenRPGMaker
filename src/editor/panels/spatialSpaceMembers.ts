import { placedSpaceState } from "@/editor/spatial/placedSpaceMembers";
import { requireOccurrenceAssociations } from "@/project/spatial/domain";
import type { SpatialAssociatedOccurrence, SpatialId, SpatialObjectSlot, SpatialParentSlot } from "@/project/spatial/types";
import type { Project } from "@/project/types";

export type PlacedSpaceMemberView = {
  readonly child: SpatialAssociatedOccurrence;
  readonly member: SpatialParentSlot;
  readonly slot: SpatialObjectSlot | undefined;
};

export function listPlacedSpaceMembers(project: Project, occurrenceId: SpatialId): readonly PlacedSpaceMemberView[] {
  const { document, space } = placedSpaceState(project, occurrenceId);
  return Object.values(document.occurrences)
    .filter((child) => child.parentId === occurrenceId)
    .map(requireOccurrenceAssociations)
    .flatMap((child) => {
      const member = child.parentSlot;
      if (!member) return [];
      return [{
        child,
        member,
        slot: space.objectSlots.find((entry) => entry.id === member.slotId),
      }];
    })
    .sort((left, right) => left.member.slotId.localeCompare(right.member.slotId) || left.member.index - right.member.index);
}

export function memberChips(child: SpatialAssociatedOccurrence): readonly string[] {
  return child.snapshot.library.objects[child.source.id]?.chips ?? [];
}
