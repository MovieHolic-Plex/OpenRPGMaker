import { editorState } from "@/editor/editorState";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { beginWalkEncounter, applyWalkEncounter, hasLastWalkEncounter, isSimpleWalkTroop,
  reuseLastWalkEncounter, sameEncounterRegion, walkEncounterRegions, WALK_FREQUENCIES,
  type WalkEncounterDraft } from "@/editor/walkEncounterAuthoring";
import { openEventSubdialog } from "@/editor/panels/eventEditor/subdialog";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import { renderWalkEncounterOptions, walkChoiceName, walkField, walkSelect } from "@/editor/panels/walkEncounterOptions";
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
  if (!canEditMap(draft.mapId)) { toast(mapEditLockNotice(draft.mapId), "error"); return; }
  openEventSubdialog({ title: "걸을 때 적 만나기", subtitle: walkRegionLabel(draft.region), testId: "walk-encounter-modal", width: "wide", render: (body, close) => {
    body.classList.add("walk-encounter-shell");
    const content = el("div", { class: "walk-encounter-content" });
    const error = el("p", { class: "walk-encounter-error", attrs: { role: "alert" }, dataset: { testid: "walk-encounter-error" } });
    const intro = el("p", { class: "walk-encounter-help", text: "포켓몬 풀숲처럼, 이 안에서 걷다 보면 전투가 시작됩니다." });
    const search = el("input", { attrs: { type: "search", placeholder: "적 이름 검색" }, dataset: { testid: "walk-encounter-search" } });
    const catalog = el("div", { class: "walk-encounter-catalog", dataset: { testid: "walk-encounter-catalog" } });
    const count = el("p", { attrs: { "aria-live": "polite" }, dataset: { testid: "walk-encounter-count" } });
    const selected = el("div", { class: "walk-encounter-selected" });
    const optionsHost = el("div");
    const project = store.getCurrent();
    const enemyForChoice = (choice: WalkEncounterDraft["choices"][number], enemyId: string): boolean => choice.kind === "enemy"
      ? choice.id === enemyId : project.database.troops.some((troop) => troop.id === choice.id && isSimpleWalkTroop(troop, enemyId));
    const refreshCatalog = (): void => {
      catalog.replaceChildren();
      const query = search.value.trim().toLocaleLowerCase();
      const enemies = project.database.enemies.filter((enemy) => enemy.name.toLocaleLowerCase().includes(query));
      for (const enemy of enemies) {
        const check = el("input", { attrs: { type: "checkbox" }, dataset: { testid: `walk-enemy-${enemy.id}` } });
        check.checked = draft.choices.some((choice) => enemyForChoice(choice, enemy.id));
        check.addEventListener("change", () => {
          if (check.checked) draft.choices.push({ kind: "enemy", id: enemy.id, weight: 1, conditions: {} });
          else draft.choices = draft.choices.filter((choice) => !enemyForChoice(choice, enemy.id));
          refreshChoices(false);
        });
        const row = el("label", { class: "walk-encounter-enemy", children: [check] });
        const art = recordListThumbnail("enemies", enemy, project, 48);
        if (art) row.append(art);
        row.append(el("span", { text: enemy.name }));
        catalog.append(row);
      }
      if (!enemies.length) {
        catalog.append(el("p", { class: "walk-encounter-help", text: project.database.enemies.length ? "검색 결과가 없습니다." : "등록된 적이 없습니다. 데이터베이스의 전투 몬스터에서 먼저 만들어 주세요." }));
        if (query) catalog.append(el("button", { class: "btn", text: "검색 지우기", attrs: { type: "button" }, on: { click: () => { search.value = ""; refreshCatalog(); search.focus(); } } }));
      }
    };
    const refreshChoices = (catalogToo = true): void => {
      count.textContent = `${draft.choices.length}종 선택`;
      selected.replaceChildren(...draft.choices.map((choice) => el("span", { text: walkChoiceName(choice) })));
      const wasOpen = optionsHost.querySelector("details")?.open ?? false;
      const options = renderWalkEncounterOptions(draft, () => { refreshChoices(); optionsHost.querySelector("summary")?.focus(); });
      options.open = wasOpen;
      optionsHost.replaceChildren(options);
      if (catalogToo) refreshCatalog();
    };
    search.addEventListener("input", refreshCatalog);
    content.append(intro, walkField("만날 적 고르기", search), count, selected, catalog);
    const frequency = walkSelect([
      ...(!WALK_FREQUENCIES.some((preset) => preset.rate === draft.rate) ? [{ id: String(draft.rate), name: `현재 값 유지 (${draft.rate})` }] : []),
      ...WALK_FREQUENCIES.map((preset) => ({ id: String(preset.rate), name: preset.label })),
    ], String(draft.rate), (value) => { draft.rate = Number(value); });
    frequency.dataset.testid = "walk-encounter-frequency";
    content.append(walkField("얼마나 자주 만날까요?", frequency), el("p", { class: "walk-encounter-help", text: "빈도는 이 맵 전체에 적용됩니다. 다른 범위의 빈도도 함께 바뀝니다." }));
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
    content.append(optionsHost);
    const actions = el("div", { class: "walk-encounter-footer" });
    const save = (operation: "save" | "delete"): void => {
      const result = applyWalkEncounter(draft, operation);
      if (!result.ok) { error.textContent = result.error; return; }
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
    search.focus();
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
