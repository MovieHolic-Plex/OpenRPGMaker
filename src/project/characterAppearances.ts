import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { findSharedPortrait, sharedPortraitId } from "@/assets/sharedPortraitAssets";
import { nestedCommandLists } from "./authoredCommandIndex";
import type { ActorRecord, CharacterAppearanceRecord, Command, EventPageGraphic, FaceGraphic, Project } from "./types";

export function getCharacterAppearance(project: Pick<Project, "database">, appearanceId: string | undefined): CharacterAppearanceRecord | undefined {
  return appearanceId === undefined ? undefined : project.database.characterAppearances?.find((record) => record.id === appearanceId);
}

/**
 * 외형에 흉상·전신·얼굴 칸이 비어 있어도 걷기 칩의 검토된 짝이 공용 흉상·전신이면 그 인물의 그림을 돌려준다.
 * 현대 연애 인물 칩 12종이 이 경우다(48px 얼굴이 없고 대응표가 흉상 base 를 짝으로 잇는다, 2026-10-16) —
 * 칩만 고른 외형 레코드에도 같은 인물의 흉상·전신이 따라온다. 얼굴이 낱장인 판타지 칩에는 영향이 없다.
 */
function pairedPortraitSlot(appearance: CharacterAppearanceRecord | undefined, mode: "bust" | "full"): { readonly resourceId: string } | undefined {
  const charset = appearance?.charset;
  if (!charset) return undefined;
  const paired = findSharedPortrait(reviewedFaceIdForCharset(charset.resourceId, charset.characterIndex));
  if (!paired) return undefined;
  const id = sharedPortraitId(paired.setId, mode, "base");
  return findSharedPortrait(id) ? { resourceId: id } : undefined;
}

export function resolveAppearancePortrait(
  project: Project,
  appearanceId: string | undefined,
  presentation: "face" | "bust" | "full",
): FaceGraphic | undefined {
  const appearance = getCharacterAppearance(project, appearanceId);
  // 전신 → 흉상 → 얼굴 순으로 내려간다. 표시 방식은 실제로 고른 칸을 따른다.
  // 칸이 비었으면 걷기 칩의 짝 초상(pairedPortraitSlot)이 그 자리를 채운다 — 얼굴 요청에도 흉상이 대신 선다(짝에 얼굴 낱장이 없으므로).
  const full = presentation === "full" ? appearance?.full ?? pairedPortraitSlot(appearance, "full") : undefined;
  const bust = presentation !== "face" ? appearance?.bust : undefined;
  const slot = full ?? bust ?? appearance?.face;
  const paired = slot ? undefined : pairedPortraitSlot(appearance, "bust");
  const chosen = slot ?? paired;
  if (!chosen) return undefined;
  const portraitMode = full ? "full" : bust || paired ? "bust" : "face";
  return {
    resourceId: chosen.resourceId,
    presentation: portraitMode,
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
