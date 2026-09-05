import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { usesMagicalDefense } from "@/battle/battleDamage";
import { imageThumbnail, recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import type { DatabaseElementRecord, Project } from "@/project/types";

/** Editor-only motifs: generated registry artwork, never serialized onto elements. */
const ELEMENT_ART: Readonly<Record<string, string>> = {
  sword: "gen-sword-bronze", spear: "gen-spear-iron", hit: "gen-hammer-war", bow: "gen-bow-short",
  fire: "fire-bomb", ice: "ice-shard", thunder: "thunder-stone", water: "water-flask",
  earth: "earth-ore", wind: "wind-feather", holy: "holy-water", dark: "gen-scythe-reaper",
  atk: "book-sword", def: "iron-shield", int: "book-magic", agi: "boots", absorb: "fang",
};

export function elementArtwork(element: DatabaseElementRecord, project: Project, size: number, decorative = true): HTMLElement {
  const stem = Object.hasOwn(ELEMENT_ART, element.id) ? ELEMENT_ART[element.id] : undefined;
  const skill = stem ? undefined : project.database.skills.find((entry) => {
    if (entry.elementId !== element.id) return false;
    const animation = project.database.battleAnimations.find((animation) => animation.id === entry.animationId);
    return animation && resolveAssetResourceUrl(animation.resourceId, { project });
  });
  const caption = stem ? "속성 이미지 · 생성된 그림" : skill ? `연결 스킬 그림 · ${skill.name}` : "연결된 그림 없음";
  const art = skill
    ? recordListThumbnail("skills", skill, project, size)!
    : imageThumbnail(stem ? `cc0-jetrel-${stem}` : undefined, project, element.name || "이름 없는 속성", size);
  art.dataset.artSource = stem ? "builtin" : skill ? "skill" : "none";
  art.title = caption;
  if (decorative) art.setAttribute("aria-hidden", "true");
  else {
    art.removeAttribute("aria-hidden");
    art.setAttribute("role", "img");
    art.setAttribute("aria-label", `${element.name || "이름 없는 속성"} · ${caption}`);
  }
  return art;
}

export function elementDefenseContext(project: Project, elementId: string | undefined): "rm2k3" | "mental" | "physical" {
  if (project.system.battleModel !== "gen1") return "rm2k3";
  return usesMagicalDefense(project, elementId) ? "mental" : "physical";
}

export function elementDefenseNote(project: Project, elementId: string): string {
  const context = elementDefenseContext(project, elementId);
  return context === "rm2k3" ? "현재 RM2k3 모델은 기존 방어 공식을 사용합니다. 이 유형만으로 정신력 방어로 바뀌지 않습니다."
    : context === "mental" ? "현재 Gen1 모델: 마법 계열은 대상의 정신력으로 경감합니다."
      : "현재 Gen1 모델: 물리 계열은 대상의 물리 방어력으로 경감합니다.";
}

export function elementOutcome(reference: number, percentage: number) {
  const value = Math.round(reference * percentage / 100);
  const outcome = percentage < 0 ? "heal" : percentage === 0 ? "none" : "damage";
  const text = outcome === "heal" ? `${Math.abs(value)} 회복` : outcome === "none" ? "피해 없음" : `${value} 피해`;
  return { value, outcome, text };
}
