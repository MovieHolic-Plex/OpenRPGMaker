import type { EventDraftAuthoredWrite, GameEvent, Project } from "@/project/types";

/** Linked writes live ONLY in draft metadata; project profiles/flags stay canonical. */
export function stageEventDraftAuthoredWrite(event: GameEvent, write: EventDraftAuthoredWrite): void {
  if (!event.draft) throw new Error("Linked authored writes require an event draft");
  const writes = event.draft.authoredWrites ?? [];
  const previous = writes.find((entry) => entry.kind === write.kind && entry.id === write.id);
  const next = { ...write, before: previous ? previous.before : write.before };
  event.draft.authoredWrites = writes.filter((entry) => entry !== previous);
  if (next.before !== next.after) event.draft.authoredWrites.push(next);
}

export function eventDraftCharacterName(project: Project, event: GameEvent, characterId: string): string {
  const staged = event.draft?.authoredWrites?.find((write) => write.kind === "characterName" && write.id === characterId);
  return staged ? staged.after ?? "" : project.characters?.[characterId]?.displayName ?? "";
}

export function commitEventDraftAuthoredWrites(project: Project, event: GameEvent): void {
  for (const write of event.draft?.authoredWrites ?? []) {
    switch (write.kind) {
      case "characterName": {
        const profile = { ...project.characters?.[write.id] };
        if (write.after !== null) profile.displayName = write.after;
        else delete profile.displayName;
        const characters = { ...project.characters };
        if (Object.keys(profile).length) characters[write.id] = profile;
        else delete characters[write.id];
        if (Object.keys(characters).length) project.characters = characters;
        else delete project.characters;
        break;
      }
      case "switch": {
        const existing = project.switches.find((entry) => entry.id === write.id);
        // Templates only fill unnamed definitions; a concurrent authored name wins.
        if (existing) {
          if (!existing.name) existing.name = write.after ?? "";
        } else project.switches.push({ id: write.id, name: write.after ?? "" });
        break;
      }
    }
  }
}

export function eventDraftAuthoredDiff(event: GameEvent) {
  return (event.draft?.authoredWrites ?? []).map((write) => ({
    path: write.kind === "characterName" ? `characters.${write.id}.displayName` : `switches.${write.id}.name`,
    before: write.before ?? undefined,
    after: write.after ?? undefined,
  }));
}

/** Editor validation/preview only. Never persist this projected working transaction. */
export function projectWithEventDraftAuthoredWrites(project: Project, mapId: string, eventId: string): Project {
  const event = project.maps[mapId]?.events.find((entry) => entry.id === eventId);
  if (!event?.draft?.authoredWrites?.length) return project;
  const working = structuredClone(project);
  commitEventDraftAuthoredWrites(working, event);
  return working;
}
