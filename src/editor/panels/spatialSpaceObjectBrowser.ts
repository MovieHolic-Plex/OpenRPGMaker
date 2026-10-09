import { spatialProjectKey } from "@/editor/panels/spatialAuthoringSession";
import { renderSpatialCardThumb } from "@/editor/panels/spatialGallery";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import { workingProject } from "@/editor/panels/spatialSpaceCommands";
import { spatialId } from "@/project/spatial/domain";
import { el } from "@/util/dom";

const queries = new Map<string, string>();
export function renderSpaceObjectBrowser(tilesetId: string): HTMLElement {
  const key = `${spatialProjectKey()}:${tilesetId}`;
  const objects = Object.values(workingProject().spatialAuthoring?.library.objects ?? {})
    .filter(object => object.graphic.tilesetId === tilesetId);
  const grid = el("div", { class: "space-object-browser-grid", dataset: { testid: "spatial-object-gallery" } });
  const status = el("p", { class: "space-object-browser-status", attrs: { role: "status" }, text: "선택한 뒤 빈칸을 클릭하거나 끌어 놓으세요." });
  const search = el("input", { class: "asset-browser-search", value: queries.get(key) ?? "",
    attrs: { type: "search", placeholder: "배치할 오브젝트 검색", "aria-label": "배치할 오브젝트 검색" },
    dataset: { testid: "space-object-search" },
    on: { input: event => {
      if (!(event.currentTarget instanceof HTMLInputElement)) return;
      queries.set(key, event.currentTarget.value); render();
    } },
  });
  function render(): void {
    const query = (queries.get(key) ?? "").trim().toLocaleLowerCase();
    const matches = objects.filter(object => `${object.name} ${object.tags.join(" ")}`.toLocaleLowerCase().includes(query));
    grid.replaceChildren(...matches.map(object => el("button", {
      class: `space-object-browser-card${spaceChromeState.selectedObjectId === object.id ? " is-selected" : ""}`,
      attrs: { type: "button", draggable: "true", "aria-pressed": String(spaceChromeState.selectedObjectId === object.id) },
      dataset: { testid: `spatial-object-${object.id}`, objectId: object.id },
      children: [el("div", { children: [renderSpatialCardThumb({
        id: object.id, name: object.name, source: "own", kind: "objects", usage: 0,
        tilesetId: object.graphic.tilesetId, objectId: object.graphic.kitId, localId: object.id,
      })] }), el("span", { text: object.name })],
      on: {
        click: () => {
          spaceChromeState.selectedObjectId = spatialId(object.id);
          for (const card of grid.querySelectorAll<HTMLElement>(".space-object-browser-card")) {
            const active = card.dataset.objectId === object.id;
            card.classList.toggle("is-selected", active); card.setAttribute("aria-pressed", String(active));
          }
          status.textContent = `${object.name} — 빈칸을 클릭해 배치하세요.`;
        },
        dragstart: event => {
          spaceChromeState.selectedObjectId = spatialId(object.id);
          if (event instanceof DragEvent) event.dataTransfer?.setData("text/spatial-object", object.id);
        },
      },
    })));
    if (!matches.length) grid.append(el("p", { text: query ? "검색 결과가 없습니다." : "이 타일셋에 사용할 오브젝트가 없습니다. 오브젝트 탭에서 먼저 만들어 주세요." }));
  }
  render();
  return el("aside", { class: "space-object-browser", attrs: { "aria-label": "배치할 오브젝트" }, children: [
    el("h3", { text: "오브젝트" }), search, status, grid,
  ] });
}
