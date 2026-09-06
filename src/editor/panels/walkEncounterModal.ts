import { editorState } from "@/editor/editorState";
import { beginWalkEncounter, applyWalkEncounter, hasLastWalkEncounter, currentDraftError,
  reuseLastWalkEncounter, sameEncounterRegion, walkEncounterRegions, WALK_FREQUENCIES,
  type WalkEncounterDraft } from "@/editor/walkEncounterAuthoring";
import { openEventSubdialog } from "@/editor/panels/eventEditor/subdialog";
import { renderWalkEncounterOptions, walkGroupComposition, walkField, walkSelect } from "@/editor/panels/walkEncounterOptions";
import { store } from "@/project/store";
import type { Rect } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export interface WalkEncounterSelection { readonly mapId: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export function openWalkEncounterForSelection(selection: WalkEncounterSelection, repeat = false): void {
  const map = store.getCurrent().maps[selection.mapId];
  if (!map) return;
  const region = { x: selection.x, y: selection.y, w: selection.width, h: selection.height };
  const edit = walkEncounterRegions(map).some((rect) => sameEncounterRegion(rect, region));
  const draft = beginWalkEncounter(selection.mapId, region, edit);
  if (repeat && !edit) reuseLastWalkEncounter(draft);
  openWalkEncounterModal(draft);
}
export function walkRegionLabel(rect: Rect): string { return `(${rect.x}, ${rect.y}) · ${rect.w}×${rect.h}칸`; }

export function openWalkEncounterModal(draft: WalkEncounterDraft): void {
  openEventSubdialog({ title: "걸을 때 적 만나기", subtitle: walkRegionLabel(draft.region), testId: "walk-encounter-modal", width: "wide", render: (body, close) => {
    body.classList.add("walk-encounter-shell");
    const content = el("div", { class: "walk-encounter-content" });
    const error = el("p", { class: "walk-encounter-error", attrs: { role: "alert" }, dataset: { testid: "walk-encounter-error" } });
    const project = store.getCurrent();
    error.textContent = currentDraftError(draft) ?? "";
    const optionsHost = el("div");
    const count = el("span", { class: "walk-encounter-help", attrs: { "aria-live": "polite" }, dataset: { testid: "walk-encounter-count" } });
    const editGroup = async (id?: string): Promise<void> => {
      try {
        const [{ openDatabaseModal }, { setSelectedRecordId }, { refreshDatabasePanel }] = await Promise.all([
          import("@/editor/panels/databaseModal"), import("@/editor/panels/databaseRecordViewSession"), import("@/editor/panels/database"),
        ]);
        if (!body.isConnected) return;
        close();
        openDatabaseModal("troops", { onClose: () => openWalkEncounterModal(draft) });
        if (id) {
          setSelectedRecordId("troops", id, { reveal: true });
          const panel = document.querySelector<HTMLElement>(".database-modal-body");
          if (panel) refreshDatabasePanel(panel);
        }
      } catch (cause) {
        toast(`그룹 편집기를 열지 못했습니다: ${String(cause)}`, "error");
        if (!body.isConnected) openWalkEncounterModal(draft);
      }
    };
    const openPicker = (replaceIndex?: number): void => {
      openEventSubdialog({ title: replaceIndex === undefined ? "만날 그룹 추가" : "그룹 바꾸기", testId: "walk-encounter-picker", width: "narrow", render: (pickerBody, closePicker) => {
        pickerBody.classList.add("walk-encounter-picker");
        const search = el("input", { attrs: { type: "search", placeholder: "그룹 이름 또는 구성원 검색" }, dataset: { testid: "walk-encounter-search" } });
        const catalog = el("div", { class: "walk-encounter-catalog", dataset: { testid: "walk-encounter-catalog" } });
        const refreshCatalog = (): void => {
          catalog.replaceChildren();
          const db = store.getCurrent().database;
          const query = search.value.trim().toLocaleLowerCase();
          const groups = db.troops.filter((troop) => [troop.name, troop.id, ...(troop.members ?? troop.enemyIds.map((enemyId) => ({ enemyId }))).map((member) => db.enemies.find((enemy) => enemy.id === member.enemyId)?.name ?? member.enemyId)].join(" ").toLocaleLowerCase().includes(query));
          for (const troop of groups) {
            const selected = draft.choices.some((choice, index) => index !== replaceIndex && choice.id === troop.id);
            const button = el("button", { class: "walk-encounter-group-option", attrs: { type: "button", ...(selected ? { disabled: "" } : {}) }, dataset: { testid: `walk-group-${troop.id}` }, children: [
              el("div", { class: "walk-encounter-picker-heading", children: [el("strong", { text: troop.name || troop.id }), el("span", { text: selected ? "추가됨" : "추가" })] }), walkGroupComposition(troop),
            ], on: { click: () => {
              if (replaceIndex !== undefined) {
                draft.choices[replaceIndex]!.id = troop.id;
                refreshChoices(); closePicker(); return;
              }
              draft.choices.push({ id: troop.id, weight: 1, conditions: {} });
              refreshChoices(); refreshCatalog(); search.focus();
            } } });
            catalog.append(button);
          }
          if (!groups.length) catalog.append(el("p", { class: "walk-encounter-empty", text: db.troops.length ? "검색 결과가 없습니다." : "아직 만든 그룹이 없습니다." }));
        };
        search.addEventListener("input", refreshCatalog);
        pickerBody.append(walkField("그룹 검색", search), catalog,
          el("div", { class: "walk-encounter-actions", children: [
            el("button", { class: "btn", text: "그룹 편집기 열기", attrs: { type: "button" }, dataset: { testid: "walk-encounter-group-editor" }, on: { click: () => { closePicker(); void editGroup(); } } }),
            el("button", { class: "btn btn-primary", text: "선택 완료", attrs: { type: "button" }, dataset: { testid: "walk-encounter-picker-done" }, on: { click: closePicker } }),
          ] }));
        refreshCatalog(); search.focus();
      } });
    };
    const refreshChoices = (): void => {
      count.textContent = `${draft.choices.length}개 그룹`;
      optionsHost.replaceChildren(renderWalkEncounterOptions(draft, () => { refreshChoices(); add.focus(); }, (id) => { void editGroup(id); }, openPicker));
    };
    const add = el("button", { class: "btn", text: "+ 그룹 추가", attrs: { type: "button" }, dataset: { testid: "walk-encounter-add-group" }, on: { click: () => openPicker() } });
    content.append(el("p", { class: "walk-encounter-help", text: "포켓몬 풀숲처럼, 걷다 보면 선택한 그룹 중 하나와 전투합니다." }),
      el("div", { class: "walk-encounter-heading", children: [el("h4", { text: "만날 그룹" }), count, add] }), optionsHost,
      el("p", { class: "walk-encounter-help", text: "상대 비율은 이 목록의 비중을 합쳐 계산합니다. 출현 조건·겹친 범위·맵 전체 규칙에 따라 실제 비율은 달라집니다." }));
    const frequency = walkSelect([
      ...(!WALK_FREQUENCIES.some((preset) => preset.rate === draft.rate) ? [{ id: String(draft.rate), name: `현재 값 유지 (${draft.rate})` }] : []),
      ...WALK_FREQUENCIES.map((preset) => ({ id: String(preset.rate), name: preset.label })),
    ], String(draft.rate), (value) => { draft.rate = Number(value); });
    frequency.dataset.testid = "walk-encounter-frequency";
    content.append(el("div", { class: "walk-encounter-frequency", children: [walkField("만나는 빈도", frequency), el("p", { class: "walk-encounter-help", text: "맵 전체에 적용 · 다른 범위도 함께 바뀝니다." })] }));
    if (draft.needsLegacyChoice) {
      const legacy = walkSelect([{ id: "undecided", name: "기존 출현 방식 선택" }, { id: "preserve", name: "맵 전체 출현도 유지" }, { id: "replace", name: "기존 전체 출현 대신 선택한 범위만" }], draft.legacy, (value) => {
        draft.legacy = value === "preserve" ? "preserve" : value === "replace" ? "replace" : "undecided";
      });
      legacy.dataset.testid = "walk-encounter-legacy";
      content.append(walkField("이 맵에는 이미 전체 출현이 있습니다", legacy), el("p", { class: "walk-encounter-help", text: "유지하면 범위 밖에서도 기존 적을 만납니다. 범위만 고르면 기존 전체 출현 목록을 비웁니다. 되돌리기로 복원할 수 있습니다." }));
    } else if (project.maps[draft.mapId]?.encounterTable?.some((entry) => !entry.conditions?.region)) {
      content.append(el("p", { class: "walk-encounter-help", text: "기존 맵 전체 출현 규칙은 유지됩니다. 범위 밖에서도 그 규칙으로 적을 만납니다." }));
    }
    if (!draft.originalRegion && hasLastWalkEncounter()) content.append(el("button", { class: "btn", text: "마지막 설정 가져오기", attrs: { type: "button" }, dataset: { testid: "walk-encounter-reuse" }, on: { click: () => { reuseLastWalkEncounter(draft); refreshChoices(); } } }));
    const actions = el("div", { class: "walk-encounter-footer" });
    const save = (operation: "save" | "delete"): void => {
      const result = applyWalkEncounter(draft, operation);
      if (!result.ok) {
        error.textContent = result.error;
        if (draft.choices.some((choice) => !store.getCurrent().database.troops.some((troop) => troop.id === choice.id))) refreshChoices();
        return;
      }
      close();
      toast(operation === "delete" ? "걷기 전투 설정을 삭제했습니다. 타일과 적 그룹은 그대로입니다." : "걸을 때 적 만나기를 설정했습니다.", "ok");
    };
    if (draft.originalRegion) {
      const map = project.maps[draft.mapId];
      const restoresGlobal = !!map?.troopIds?.length && (map.encounterTable ?? []).every((entry) => sameEncounterRegion(entry.conditions?.region, draft.originalRegion));
      if (restoresGlobal) content.append(el("p", { class: "walk-encounter-help", text: "마지막 범위를 삭제하면 기존 맵 전체 출현이 다시 켜집니다." }));
      let armed = false;
      const remove = el("button", { class: "btn", text: "이 범위 설정 삭제", attrs: { type: "button" }, dataset: { testid: "walk-encounter-delete" }, on: { click: () => {
        if (armed) save("delete");
        else { armed = true; remove.textContent = restoresGlobal ? "전체 출현을 복원하며 삭제?" : "설정만 삭제할까요?"; }
      } } });
      actions.append(remove);
    }
    actions.append(el("button", { class: "btn", text: "취소", attrs: { type: "button" }, dataset: { testid: "walk-encounter-cancel" }, on: { click: close } }),
      el("button", { class: "btn btn-primary", text: "완료", attrs: { type: "button" }, dataset: { testid: "walk-encounter-save" }, on: { click: () => save("save") } }));
    body.append(content, error, actions);
    refreshChoices();
    add.focus();
  } });
}

export function openWalkEncounterList(): void {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  if (!map) return;
  openEventSubdialog({ title: "걸을 때 적 만나기 · 목록", subtitle: map.name, testId: "walk-encounter-list", width: "wide", render: (body, close) => {
    body.classList.add("walk-encounter-list");
    body.append(el("p", { class: "walk-encounter-help", text: "선택 도구로 맵을 드래그한 뒤 ‘걸을 때 적 만나기’를 누르세요. 색 테두리는 편집기에서만 보입니다." }),
      el("p", { class: "walk-encounter-help", text: "범위를 바꾸려면 새로 드래그한 뒤 이 목록에서 ‘현재 선택으로 범위 바꾸기’를 누르세요." }));
    const selection = editorState.get().selection;
    const regions = walkEncounterRegions(map);
    if (!regions.length) body.append(el("p", { text: "아직 설정한 범위가 없습니다." }));
    for (const [index, region] of regions.entries()) {
      const capturedDraft = beginWalkEncounter(mapId, region, true);
      const names = (map.encounterTable ?? []).filter((entry) => sameEncounterRegion(entry.conditions?.region, region))
        .map((entry) => project.database.troops.find((troop) => troop.id === entry.troopId)?.name ?? entry.troopId);
      const row = el("div", { class: "walk-encounter-list-row", dataset: { testid: `walk-encounter-region-${index}` } });
      row.append(el("strong", { text: `${index + 1}. ${walkRegionLabel(region)}` }), el("span", { text: names.join(", ") }));
      const edit = el("button", { class: "btn", text: "편집 · 삭제", attrs: { type: "button" }, dataset: { testid: `walk-encounter-edit-${index}` }, on: { click: () => { close(); openWalkEncounterModal(capturedDraft); } } });
      const actions = el("div", { class: "walk-encounter-actions", children: [edit] });
      if (selection?.mapId === mapId) actions.append(el("button", { class: "btn", text: "현재 선택으로 범위 바꾸기", attrs: { type: "button" }, dataset: { testid: `walk-encounter-retarget-${index}` }, on: { click: () => {
        const draft = capturedDraft;
        draft.region = { x: selection.x, y: selection.y, w: selection.width, h: selection.height };
        close(); openWalkEncounterModal(draft);
      } } }));
      row.append(actions); body.append(row);
    }
    body.append(el("button", { class: "btn", text: "맵에서 범위 선택하기", attrs: { type: "button" }, dataset: { testid: "walk-encounter-select-area" }, on: { click: () => {
      close(); editorState.set({ tool: "select", layer: editorState.get().layer === "event" ? "lower" : editorState.get().layer });
    } } }));
  } });
}
