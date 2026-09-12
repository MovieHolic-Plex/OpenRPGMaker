import { mutateWorkingPlace, workingProject } from "@/editor/panels/spatialPlaceCommands";
import { withPlaceExterior, type PlaceDraftTarget } from "@/editor/panels/spatialPlaceDraft";
import type { PlaceDesign, SpatialGraphic } from "@/project/spatial/types";
import { el } from "@/util/dom";

/** Exterior stores a graphic reference, never object membership or a live ObjectDesign link. */
export function renderPlaceExterior(place: PlaceDesign, target: PlaceDraftTarget, rerender: () => void): HTMLElement {
  const objects = Object.values(workingProject().spatialAuthoring?.library.objects ?? {});
  const matching = objects.find((object) => object.graphic.tilesetId === place.exterior?.tilesetId
    && object.graphic.kitId === place.exterior?.kitId);
  const commit = (graphic: SpatialGraphic | undefined): void => {
    mutateWorkingPlace(target, (current) => withPlaceExterior(current, graphic));
    rerender();
  };
  const picker = el("select", {
    attrs: { "aria-label": "건물 외형 오브젝트" },
    dataset: { testid: "spatial-place-exterior-object" },
    children: [
      el("option", { text: "직접 지정한 외형 없음", attrs: { value: "", ...(!place.exterior ? { selected: "" } : {}) } }),
      ...(place.exterior && !matching ? [el("option", {
        text: "현재 그림 참조 (직접 지정)", attrs: { value: "__current__", selected: "", disabled: "" },
      })] : []),
      ...objects.map((object) => el("option", {
        text: object.name,
        attrs: { value: object.id, ...(matching?.id === object.id ? { selected: "" } : {}) },
      })),
    ],
  });
  picker.addEventListener("change", () => {
    if (!picker.value) { commit(undefined); return; }
    const object = objects.find((entry) => entry.id === picker.value);
    if (object) commit({ ...object.graphic });
  });
  const tileset = el("input", {
    attrs: { type: "text", value: place.exterior?.tilesetId ?? "" },
    dataset: { testid: "spatial-place-exterior-tileset" },
  });
  const kit = el("input", {
    attrs: { type: "text", value: place.exterior?.kitId ?? "" },
    dataset: { testid: "spatial-place-exterior-kit" },
  });
  const status = el("p", { class: "spatial-preview-error", attrs: { role: "status" } });
  return el("div", {
    class: "spatial-place-exterior",
    dataset: { testid: "spatial-place-exterior" },
    children: [
      el("label", { class: "spatial-place-field", children: [el("span", { text: "건물 외형" }), picker] }),
      el("details", {
        children: [
          el("summary", { text: "외형 선택 안내 · 직접 지정" }),
          el("p", {
            class: "spatial-inspector-sub",
            text: "오브젝트의 그림 참조만 가져옵니다. 오브젝트 속성·출입구와 이후 변경은 따라오지 않으며, 방·층·연결은 장소에 따로 구성합니다.",
          }),
          el("label", { class: "spatial-place-field", children: [el("span", { text: "외형 타일셋" }), tileset] }),
          el("label", { class: "spatial-place-field", children: [el("span", { text: "외형 키트" }), kit] }),
          el("button", {
            class: "spatial-action", text: "외형 참조 적용", attrs: { type: "button" },
            dataset: { testid: "spatial-place-exterior-reference-apply" },
            on: { click: () => {
              const tilesetId = tileset.value.trim();
              const kitId = kit.value.trim();
              if (Boolean(tilesetId) !== Boolean(kitId)) {
                status.textContent = "타일셋과 키트를 모두 입력하세요.";
                return;
              }
              commit(tilesetId ? { tilesetId, kitId } : undefined);
            } },
          }),
          status,
        ],
      }),
    ],
  });
}
