import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { nestedCommandLists } from "./authoredCommandIndex";
import type { ActorRecord, CharacterAppearanceRecord, Command, EventPageGraphic, FaceGraphic, Project } from "./types";

export function getCharacterAppearance(project: Pick<Project, "database">, appearanceId: string | undefined): CharacterAppearanceRecord | undefined {
  return appearanceId === undefined ? undefined : project.database.characterAppearances?.find((record) => record.id === appearanceId);
}

export function resolveAppearancePortrait(
  project: Project,
  appearanceId: string | undefined,
  presentation: "face" | "bust" | "full",
): FaceGraphic | undefined {
  const appearance = getCharacterAppearance(project, appearanceId);
  // 전신 → 흉상 → 얼굴 순으로 내려간다. 표시 방식은 실제로 고른 칸을 따른다.
  const full = presentation === "full" ? appearance?.full : undefined;
  const bust = presentation !== "face" ? appearance?.bust : undefined;
  const slot = full ?? bust ?? appearance?.face;
  if (!slot) return undefined;
  return {
    resourceId: slot.resourceId,
    presentation: full ? "full" : bust ? "bust" : "face",
    position: "left",
    flipHorizontally: false,
  };
}

/** Effective runtime projection; the authored legacy fields are never changed. */
export function resolveActorAppearance(project: Project, actor: ActorRecord): ActorRecord {
  const appearance = getCharacterAppearance(project, actor.appearanceId);
  if (!appearance) return actor;
  return {
    ...actor,
    ...(appearance.charset ? {
      characterResourceId: appearance.charset.resourceId,
      characterIndex: appearance.charset.characterIndex,
    } : {}),
    ...(appearance.face ? { faceResourceId: appearance.face.resourceId } : {}),
  };
}

export function resolveEventAppearanceGraphic(project: Pick<Project, "database" | "assets">, graphic: EventPageGraphic): EventPageGraphic {
  const charset = getCharacterAppearance(project, graphic.appearanceId)?.charset;
  if (!charset) return graphic;
  return {
    ...graphic,
    sprite: { type: project.assets.uploaded[charset.resourceId] ? "uploaded" : "bundled", id: charset.resourceId },
    pattern: charsetFrameIndex({
      characterIndex: charset.characterIndex,
      direction: graphic.direction ?? "down",
      pattern: graphic.pattern === undefined ? 1 : decodeCharsetFrameIndex(graphic.pattern).pattern,
    }),
  };
}

export interface AppearanceUsage {
  readonly kind: "actor" | "event" | "command";
  readonly label: string;
}

export function listAppearanceUsages(project: Project, appearanceId: string): readonly AppearanceUsage[] {
  const usages: AppearanceUsage[] = [];
  const visit = (commands: readonly Command[], label: string): void => {
    for (const command of commands) {
      if (command.kind === "changeFace" && command.appearanceId === appearanceId) usages.push({ kind: "command", label });
      for (const branch of nestedCommandLists(command)) visit(branch, label);
    }
  };
  for (const actor of project.database.actors) {
    if (actor.appearanceId === appearanceId) usages.push({ kind: "actor", label: actor.name });
  }
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      visit(event.commands, `${map.name} / ${event.id}`);
      for (const page of event.pages ?? []) {
        const label = `${map.name} / ${event.id} / ${page.name || page.id}`;
        if (page.graphic.appearanceId === appearanceId) usages.push({ kind: "event", label });
        visit(page.commands, label);
      }
    }
  }
  for (const event of project.commonEvents) visit(event.commands, event.name);
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages) visit(page.commands, `${troop.name} / ${page.id}`);
  }
  return usages;
}
