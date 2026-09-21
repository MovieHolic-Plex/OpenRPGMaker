import { RIVER_VILLAGE_STYLE_GUIDANCE } from "@/project/defaults/riverVillageStyle";
import type { Project } from "@/project/types";
import { VILLAGE_DESIGN_GROUP_LABELS, VILLAGE_DESIGN_GROUPS } from "@/project/villageDesign";

/** 설계서 색인은 예산 밖에 둔다. 집행 자체는 프롬프트가 아니라 시공기 소유다. */
export function villageDesignContext(project: Project): string {
  const designs = (project.villagePresets ?? []).filter(p => p.design);
  if (designs.length === 0) return RIVER_VILLAGE_STYLE_GUIDANCE;
  const selected = designs.find(p => p.id === project.defaultVillagePresetId);
  const ordered = selected ? [selected, ...designs.filter(p => p.id !== selected.id)] : designs;
  return [
    RIVER_VILLAGE_STYLE_GUIDANCE,
    "## 마을 설계서 — 데이터베이스가 결정하는 시공 계약",
    "마을은 author_village({target,presetId,countPolicy:'exact'})로 짓는다. 설계서 사용 시 집 수는 생략 가능하고 고정한 필드도 생략한다. forestDensity를 항상 넣으라는 일반 지침보다 이 계약이 우선한다.",
    "고정값은 AI 인자로 덮을 수 없다. 범위 밖·재료 충돌은 village-design-conflict로 시공 전 거부된다. 오류의 설계서 값과 요청 값을 사용자에게 설명하고 설계서를 유지하거나 DB에서 수정할 변경안을 제시한다. 다른 툴로 우회하지 않는다.",
    selected ? `기본 설계서: ${selected.name} (${selected.id}). presetId를 생략해도 이 설계서가 적용된다.` : "기본 설계서는 아직 없다. 요청에 맞는 설계서 id를 명시한다.",
    ...ordered.slice(0, 12).map(p => {
      const d = p.design!;
      const count = d.houseCount.mode === "free" ? "자유" : `${d.houseCount.min}~${d.houseCount.max}`;
      const objectRule = d.objectVillage ? ` 저장된 건물 ${d.objectVillage.objectIds.length}종, 2층 이상 총 ${d.objectVillage.multiStoreyCount}채(큰집 포함), 배치 ${d.objectVillage.clustering}, 기준 ${d.objectVillage.previewSize.width}×${d.objectVillage.previewSize.height}. 이 설계서의 이름·설명을 보고 해당 규모에만 선택하며 다른 규모의 기본값으로 일반화하지 않는다.` : "";
      return `- ${p.name} (${p.id}, 개정 ${d.revision}): 집 ${count}, 재료 ${p.kitMix ?? "자동"}, 층 ${d.stories.join("/")}, 길 ${p.pathStyle ?? "자동"}, 물 ${d.nature.water}, 숲 ${d.nature.forest}, 실내 ${d.interior ? "연결" : "없음"}. ${VILLAGE_DESIGN_GROUPS.map(g => `${VILLAGE_DESIGN_GROUP_LABELS[g]}=${d.policies[g] === "fixed" ? "고정" : "자유"}`).join(", ")}${objectRule}`;
    }),
    ...(designs.length > 12 ? [`외 ${designs.length - 12}개는 데이터베이스 「마을」에서 확인한다.`] : []),
  ].join("\n");
}
