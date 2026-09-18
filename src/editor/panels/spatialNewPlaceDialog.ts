import { classificationTags, PLACE_CATEGORIES, PLACE_ENVIRONMENTS, placeLibraryFilters, tilesetStyle } from './spatialPlaceClassification';
import { addNewPlaceRoom } from "./spatialPlaceRooms";
import type { PlaceDraftTarget } from "./spatialPlaceDraft";
import { FACILITY_FLOOR_MAX } from "@/project/spatial/facilityLevels";
import { el } from "@/util/dom";
import { openDialog } from "./databaseEnemyRecordSupport";
import { editAuthoringDraft, spatialAuthoringErrorText, visibleAuthoringProject } from "./spatialAuthoringAccess";
import { openSpatialDestination, patchSpatialSession, spatialProjectKey } from "./spatialAuthoringSession";
import { spatialPresentationId } from "./spatialPresentation";
import { createNewPlace, newPlaceTilesets, NEW_PLACE_MIN, NEW_PLACE_MAX, type NewPlaceKind } from "./spatialNewPlace";
import { spaceChromeState } from "./spatialSpaceChromeState";
import { placeChromeState } from "./spatialPlaceChromeState";
import type { SpatialDesignReference } from "@/project/spatial/types";

export function openNewPlaceDialog(rerender: () => void, room?: { parent: PlaceDraftTarget; level: number; floor?: boolean }): void {
  const projectKey = spatialProjectKey();
  let close = (): void => {};
  const name = el("input", { attrs: { type: "text", required: "", maxlength: "80", placeholder: "예: 작은 침실", "aria-label": "장소 이름" }, dataset: { testid: "new-place-name" } });
  const kind = el("select", { attrs: { "aria-label": "장소 형태" }, dataset: { testid: "new-place-kind" }, children: [
    el("option", { text: "실내 — 방·상점 내부", attrs: { value: "interior" } }),
    el("option", { text: "실외 — 마당·광장", attrs: { value: "outdoor" } }),
    ...(!room ? [el("option", { text: "건물 — 여러 방·층 구성", attrs: { value: "building" } })] : []),
  ] });
  const category = el('input', { value: placeLibraryFilters.category || '건물·시설', attrs: { list: 'new-place-category-options', required: '', maxlength: '40', 'aria-label': '장소 유형' } });
  const categoryOptions = el('datalist', { attrs: { id: 'new-place-category-options' }, children: PLACE_CATEGORIES.map(value => el('option', { attrs: { value } })) });
  const environment = el('select', { attrs: { 'aria-label': '공간 형태' }, children: PLACE_ENVIRONMENTS.map(value => el('option', { text: value, attrs: { value } })) });
  environment.value = placeLibraryFilters.environment || '건물 내부';
  const purposes = el('input', { value: placeLibraryFilters.purpose, attrs: { placeholder: '예: 여관, 숙박, 식당', maxlength: '200', 'aria-label': '용도와 태그' } });
  const size = (label: string, value: number) => el("input", { value: String(value), attrs: { type: "number", min: String(NEW_PLACE_MIN), max: String(NEW_PLACE_MAX), step: "1", required: "", "aria-label": label } });
  const width = size("가로 칸 수", 10), height = size("세로 칸 수", 8);
  const level = el("input", { value: String(room?.level ?? 1), attrs: { type: "number", min: "0", max: String(FACILITY_FLOOR_MAX), step: "1", "aria-label": "추가할 층" } });
  const atlas = el("select", { attrs: { "aria-label": "타일셋" }, dataset: { testid: "new-place-tileset" } });
  const hint = el("p");
  const error = el("p", { attrs: { role: "alert" }, dataset: { testid: "new-place-error" } });
  const submit = el("button", { class: "btn primary", text: "만들기", attrs: { type: "submit" }, dataset: { testid: "new-place-create" } });
  const field = (label: string, input: HTMLElement) => el("label", { class: "spatial-new-place-field", children: [el("span", { text: label }), input] });
  const refreshOptions = (): void => {
    const project = visibleAuthoringProject();
    const tilesets = newPlaceTilesets(project, kind.value as NewPlaceKind);
    atlas.replaceChildren(...tilesets.map(tileset => el("option", { text: tileset.name, attrs: { value: tileset.id } })));
    submit.disabled = tilesets.length === 0 || !project.spatialAuthoring;
    hint.textContent = !project.spatialAuthoring ? "장소 설계를 활성화한 뒤 다시 만들어 주세요." : !tilesets.length ? "이 형태에 사용할 타일셋이 없습니다. 타일셋을 준비한 뒤 다시 열어 주세요."
      : kind.value === "building" ? "편집 가능한 1층 실내를 포함한 건물을 만듭니다."
      : "바닥을 만든 뒤 오브젝트를 배치하세요. 실내는 벽도 함께 만듭니다.";
  };
  kind.addEventListener("change", () => { if (room) level.value = kind.value === "outdoor" ? "0" : String(Math.max(1, room.level)); refreshOptions(); });
  if (!room && environment.value !== '건물 내부') kind.value = 'outdoor';
  refreshOptions();
  if (room) { name.value = room.floor ? `${room.level}층` : "새 방"; hint.textContent = "새 방을 만든 뒤 아래 출입 연결에서 문·계단을 연결하세요."; }
  const form = el("form", { class: "spatial-new-place-form", children: [field("이름", name), field("장소 유형", category), categoryOptions, field("공간 형태", environment), field("용도 · 태그", purposes), field("방·층 구성", kind), ...(room ? [field("층", level)] : []), field("가로", width), field("세로", height), field("타일셋", atlas), hint, error, submit] });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (projectKey !== spatialProjectKey()) { error.textContent = "프로젝트가 바뀌었습니다. 창을 닫고 다시 열어 주세요."; return; }
    if (room) {
      try {
        const issue = addNewPlaceRoom(room.parent, { name: name.value, kind: kind.value as NewPlaceKind, width: Number(width.value), height: Number(height.value), tilesetId: atlas.value, tags: classificationTags({ style: tilesetStyle(atlas.value, visibleAuthoringProject().tilesets[atlas.value]?.name), category: category.value.trim(), environment: environment.value, purposes: purposes.value.split(/[，,]/).map(v => v.trim()).filter(Boolean) }) }, Number(level.value));
        if (issue) { error.textContent = issue; return; }
        close(); rerender();
      } catch (cause) { error.textContent = cause instanceof Error ? cause.message : String(cause); }
      return;
    }
    let source: SpatialDesignReference | undefined;
    try {
      const result = editAuthoringDraft(project => {
        const created = createNewPlace(project, { name: name.value, kind: kind.value as NewPlaceKind, width: Number(width.value), height: Number(height.value), tilesetId: atlas.value, tags: classificationTags({ style: tilesetStyle(atlas.value, visibleAuthoringProject().tilesets[atlas.value]?.name), category: category.value.trim(), environment: environment.value, purposes: purposes.value.split(/[，,]/).map(v => v.trim()).filter(Boolean) }) });
        source = created.source;
        return created.project;
      });
      const issue = spatialAuthoringErrorText(result);
      if (result.kind !== "ok" || !source) { error.textContent = issue ?? "장소를 만들지 못했습니다."; return; }
    } catch (cause) { error.textContent = cause instanceof Error ? cause.message : String(cause); return; }
    const tab = source.kind === "space" ? "spaces" : "places";
    const cardId = spatialPresentationId(source.kind === "space" ? "library-space" : "library-place", "library", source.id);
    close();
    spaceChromeState.previewError = null; placeChromeState.previewError = null;
    spaceChromeState.saveState = "초안"; placeChromeState.saveState = "초안";
    placeChromeState.createdDesignId = source.kind === "place" ? source.id : null;
    patchSpatialSession({ tab, mode: "design", source: "own", breadcrumb: [], legacyOrigin: null, placeKindFilter: null, inspectorOpen: true });
    openSpatialDestination(tab, cardId);
    rerender();
  });
  close = openDialog("new-place-dialog", room ? room.floor ? "층 추가" : "방 추가" : "새 장소", [form], [{ label: "취소", testid: "new-place-cancel" }]);
}
