import type { Project } from "@/project/types";
import type { VillageDesign } from "@/project/types/village";
import { el } from "@/util/dom";
import { numberField, selectField } from "./databaseControls";
import { sectionCard } from "./databaseWorkspace";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";

/** Edits the same saved object contract consumed by preview and author_village. */
export function villageObjectDesignControls(project: Project, design: VillageDesign,
  update: (patch: Partial<VillageDesign>) => void): HTMLElement[] {
  const profile = design.objectVillage!;
  const set = (patch: Partial<typeof profile>): void => update({ objectVillage: { ...profile, ...patch } });
  const objects = Object.values(project.spatialAuthoring?.library.objects ?? {}).filter(o => o.exteriorStories || profile.objectIds.includes(o.id));
  const choices = objects.map(object => {
    const input = el("input", { attrs: { type: "checkbox" } }) as HTMLInputElement;
    input.checked = profile.objectIds.includes(object.id);
    input.addEventListener("change", () => {
      const objectIds = input.checked ? [...profile.objectIds, object.id] : profile.objectIds.filter(id => id !== object.id);
      if (!objectIds.length) { input.checked = true; return; }
      set({ objectIds });
    });
    return el("label", { children: [input, el("span", { text: `${object.name} · ${object.exteriorStories ? `${object.exteriorStories}층 외형` : "층수 미지정"}` })] });
  });
  return [sectionCard({ title: "저장된 집 외형으로 짓기", testid: "db-village-object-profile", children: [
    el("p", { text: "일반 집은 10×10 이하, 큰집은 최대 15×15·2채. 통나무 벽은 제외합니다. 층수는 오브젝트 속성의 외형 층수를 사용하며 실내 공간은 별도입니다." }),
    numberField("2층 이상 집 (큰집 포함)", "db-village-multi-storey-count", profile.multiStoreyCount,
      multiStoreyCount => set({ multiStoreyCount }), { min: 0, max: design.houseCount.min, step: 1 }),
    selectField("집 사이 배치", "db-village-house-clustering", profile.clustering,
      [{ id: "tight", name: "가까운 주택군과 좁은 골목" }, { id: "balanced", name: "마을 전체에 고르게" }], clustering => set({ clustering: clustering as typeof profile.clustering })),
    ...(["width", "height"] as const).map(key => numberField(`기준 맵 ${key === "width" ? "너비" : "높이"}`, `db-village-reference-${key}`, profile.previewSize[key],
      n => set({ previewSize: { ...profile.previewSize, [key]: n } }), { min: 20, max: MAX_TOOL_MAP_DIMENSION, step: 1 })),
    el("p", { text: "기준 크기는 미리보기와 크기를 생략한 새 맵에 적용됩니다. 다른 크기나 지역에도 같은 집 구성 규칙을 사용합니다." }),
    el("div", { class: "db-village-design-stories", children: choices }),
  ] })];
}
