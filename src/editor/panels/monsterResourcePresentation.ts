import { getMonsterResource } from "@/assets/monsterResourceCatalog";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { applyMagentaChromaKey } from "@/editor/panels/chromaKey";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

export type MonsterResource = NonNullable<ReturnType<typeof getMonsterResource>>;
const ORIGIN_LABELS = { bundled: "기본 제공", uploaded: "업로드", profile: "프로필" } as const;
const REVIEW_LABELS = { reviewed: "검토됨", unreviewed: "미검토" } as const;
export const MONSTER_METADATA_SOURCE_LABELS = { project: "프로젝트 편집", catalog: "기본 카탈로그", fallback: "기본 표시값" } as const;

export function monsterResourceStatus(resource: MonsterResource): string {
  return `${ORIGIN_LABELS[resource.origin]} · ${REVIEW_LABELS[resource.reviewStatus]}`;
}

export function monsterResourcePreview(resource: MonsterResource, project: Project): HTMLElement {
  const frame = el("div", { class: "db-monster-resource-preview" });
  const url = resolveAssetResourceUrl(resource.resourceId, { project });
  if (!url) {
    frame.textContent = "미리보기를 사용할 수 없습니다.";
    return frame;
  }
  const image = el("img", {
    attrs: { src: url, alt: `${resource.name} 미리보기`, loading: "lazy", width: "160", height: "160" },
  });
  image.addEventListener("error", () => {
    frame.replaceChildren(el("span", { text: "그림을 불러오지 못했습니다." }));
  }, { once: true });
  applyMagentaChromaKey(image);
  frame.append(image);
  return frame;
}

/** Plain text only: authored metadata is reference data, never markup. */
export function monsterResourceSummary(project: Project, resourceId: string): HTMLElement {
  const resource = getMonsterResource(project, resourceId);
  const summary = el("div", { class: "db-monster-resource-summary", dataset: { testid: "monster-resource-summary", resourceId } });
  if (!resource) {
    summary.textContent = "등록된 몬스터 소재가 아닙니다.";
    return summary;
  }
  summary.append(
    el("strong", { text: resource.name }),
    el("span", { text: resource.tags.join(" · ") }),
    el("p", { text: resource.description }),
    el("small", { text: monsterResourceStatus(resource), dataset: { origin: resource.origin, reviewStatus: resource.reviewStatus } }),
  );
  return summary;
}
