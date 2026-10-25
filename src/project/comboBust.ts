import { findSharedPortrait, sharedExpressionSetIdOf, sharedPortraitId, sharedPortraitWithExpression } from "@/assets/sharedPortraitAssets";
import { resolveAppearancePortrait } from "@/project/characterAppearances";
import type { Project } from "@/project/types";

/**
 * 연계기 「얼굴 교차」 컷인(player/battleComboCutIn.ts)이 배우마다 띄우는 그림의 리소스 id —
 * 외형의 흉상(결의 표정 우선) → 얼굴이 속한 공용 표정 세트의 흉상(결의 → 기본) → 48px 얼굴.
 * 내보내기(webExportAssets)도 같은 id 를 싣는다: 런타임이 고르는 그림이라 프로젝트 데이터에 이름이 없어,
 * 스토어 판본에 「결의」 흉상이 빠져 컷인 얼굴이 비었다(폴른 스타 1.20, 2026-10-25).
 */
export function comboBustResourceId(project: Project, actorId: string): { readonly resourceId: string; readonly kind: "bust" | "face" }[] {
  const actor = project.database.actors.find((record) => record.id === actorId);
  if (!actor) return [];
  const out: { resourceId: string; kind: "bust" | "face" }[] = [];
  const appearance = resolveAppearancePortrait(project, actor.appearanceId, "bust");
  if (appearance?.presentation === "bust") {
    const id = sharedPortraitWithExpression(appearance.resourceId, "determined");
    if (id) out.push({ resourceId: id, kind: "bust" });
    out.push({ resourceId: appearance.resourceId, kind: "bust" });
  }
  const face = appearance?.resourceId ?? actor.faceResourceId;
  const setId = sharedExpressionSetIdOf(face);
  if (setId) {
    const base = sharedPortraitId(setId, "bust", "base");
    if (findSharedPortrait(base)) {
      const id = sharedPortraitWithExpression(base, "determined");
      if (id) out.push({ resourceId: id, kind: "bust" });
      out.push({ resourceId: base, kind: "bust" });
    }
  }
  if (face) out.push({ resourceId: face, kind: "face" });
  return out;
}

/** 연계기에 끼는 배우 id(중복 없이). */
export function comboMemberActorIds(project: Project): string[] {
  return [...new Set(project.database.skills.flatMap((skill) => (skill.comboActorIds?.length ?? 0) >= 2 ? skill.comboActorIds! : []))];
}
