import { applyCharsetFrameCrop } from "@/assets/charsetFrameCrop";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { GRAPHIC_ATTRIBUTE_AXES, applyCharacterGraphicsImport, exportCharacterGraphics, graphicSpriteKey, listCharacterFaces, listCharacterSprites, parseCharacterGraphicsImport, updateCharacterFace, updateCharacterSprite, updateCharacterSpriteLabel, type CharacterFace, type CharacterSprite, type GraphicAttributes, type GraphicAttributeAxis, type GraphicMappingStatus, type GraphicMatchQuality } from "@/project/characterGraphics";
import { downloadBlob } from "@/util/downloadBlob";
import { el } from "@/util/dom";
import { field, selectField, textField } from "./databaseControls";
import { imageThumbnail, markDatabaseImageFailed } from "./databaseRecordThumbnails";
import { detailHero, detailPane, emptyState, listPane, listRow, listToolbar, sectionCard, workspaceShell } from "./databaseWorkspace";

const AXIS_LABELS: Record<GraphicAttributeAxis, string> = { kind: "종류", age: "나이", gender: "성별", skin: "피부", hair: "머리", clothing: "의상", role: "역할" };
const STATUSES: { id: GraphicMappingStatus; name: string }[] = [{ id: "pending", name: "미검토" }, { id: "mapped", name: "얼굴 지정" }, { id: "no-face", name: "얼굴 없음 확정" }];
const QUALITIES: { id: GraphicMatchQuality; name: string }[] = [{ id: "unspecified", name: "미지정" }, { id: "exact", name: "정확" }, { id: "approximate", name: "근사" }];
type Filter = { query: string; attributes: GraphicAttributes };
type ViewState = {
  view: "sprites" | "faces";
  spriteKey?: string;
  faceId?: string;
  sprites: Filter;
  faces: Filter;
  picker: Filter;
  status: string;
  quality: string;
  json: string;
  message: string;
  error: boolean;
};
const sessions = new WeakMap<HTMLElement, ViewState>();
function stateFor(container: HTMLElement): ViewState {
  let state = sessions.get(container);
  if (!state) {
    state = { view: "sprites", sprites: { query: "", attributes: {} }, faces: { query: "", attributes: {} }, picker: { query: "", attributes: {} }, status: "", quality: "", json: "", message: "", error: false };
    sessions.set(container, state);
  }
  return state;
}
function matches(row: { label: string; attributes: GraphicAttributes }, id: string, filter: Filter): boolean {
  const haystack = `${row.label} ${id} ${Object.values(row.attributes).join(" ")}`.toLocaleLowerCase();
  return haystack.includes(filter.query.toLocaleLowerCase()) && GRAPHIC_ATTRIBUTE_AXES.every((axis) => !filter.attributes[axis] || row.attributes[axis] === filter.attributes[axis]);
}
function spriteImage(row: CharacterSprite, scale = 1): HTMLElement {
  const image = el("span", { class: "db-cg-sprite-image", attrs: { role: "img", "aria-label": row.label } });
  if (!row.path) { markDatabaseImageFailed(image, row.label); return image; }
  applyCharsetFrameCrop(image, row.path, { characterIndex: row.characterIndex, direction: "down", pattern: 1 }, scale);
  const probe = el("img", { attrs: { src: row.path, alt: "", hidden: "" } });
  probe.addEventListener("error", () => markDatabaseImageFailed(image, row.label), { once: true });
  image.append(probe);
  return image;
}

/** This view edits authoring metadata only. It never rewrites actors, event graphics or commands. */
export function renderCharacterGraphicsTab(container: HTMLElement, _rerender?: () => void): void {
  const state = stateFor(container);
  const redraw = (): void => { container.replaceChildren(); renderCharacterGraphicsTab(container); };
  const message = el("p", { text: state.message, attrs: { role: "status", "aria-live": "polite" }, dataset: { testid: "db-cg-message", state: state.error ? "error" : "ok" } });
  const announce = (text: string, error = false): void => {
    state.message = text; state.error = error; message.textContent = text; message.dataset.state = error ? "error" : "ok";
  };
  const mutate = (label: string, change: (project: Project) => void, key?: string): void => {
    if (key) recordCoalescedSnapshot(`character-graphics:${key}`, label);
    else recordProjectSnapshot(label);
    store.update(change, { scope: "project", label });
  };
  const sprites = listCharacterSprites(store.getCurrent());
  const faces = listCharacterFaces(store.getCurrent());
  const selectedSprite = sprites.find((row) => graphicSpriteKey(row.textureKey, row.characterIndex) === state.spriteKey) ?? sprites[0];
  const selectedFace = faces.find((row) => row.resourceId === state.faceId) ?? faces[0];
  if (selectedSprite) state.spriteKey = graphicSpriteKey(selectedSprite.textureKey, selectedSprite.characterIndex);
  if (selectedFace) state.faceId = selectedFace.resourceId;

  const listHost = el("div", { dataset: { testid: "db-cg-list" } });
  const candidateHost = el("div", { class: "db-cg-face-grid", dataset: { testid: "db-cg-face-candidates" } });
  const selectionHost = el("div", { class: "db-cg-selected-face", dataset: { testid: "db-cg-selected-face" } });
  const currentSprite = (project: Project): CharacterSprite => listCharacterSprites(project).find((row) => graphicSpriteKey(row.textureKey, row.characterIndex) === state.spriteKey)!;
  const currentFace = (project: Project): CharacterFace => listCharacterFaces(project).find((row) => row.resourceId === state.faceId)!;

  const refreshList = (): void => {
    const project = store.getCurrent();
    const rows = state.view === "sprites"
      ? listCharacterSprites(project).filter((row) => matches(row, `${row.textureKey} ${row.characterIndex}`, state.sprites) && (!state.status || row.status === state.status) && (!state.quality || row.quality === state.quality)).map((row) => listRow({
        name: row.label, sub: STATUSES.find((status) => status.id === row.status)!.name, number: row.characterIndex, thumb: spriteImage(row),
        active: state.spriteKey === graphicSpriteKey(row.textureKey, row.characterIndex), testid: `db-cg-sprite-${row.textureKey}-${row.characterIndex}`,
        onSelect: () => { state.spriteKey = graphicSpriteKey(row.textureKey, row.characterIndex); redraw(); },
      }))
      : listCharacterFaces(project).filter((row) => matches(row, row.resourceId, state.faces)).map((row) => listRow({
        name: row.label, thumb: imageThumbnail(row.resourceId, project, row.label, 40), active: state.faceId === row.resourceId,
        testid: `db-cg-face-${row.resourceId}`, onSelect: () => { state.faceId = row.resourceId; redraw(); },
      }));
    listHost.replaceChildren(...(rows.length ? rows : [emptyState({ title: "조건에 맞는 그림이 없습니다", compact: true })]));
  };
  const refreshSelection = (): void => {
    if (!selectedSprite) return;
    const row = currentSprite(store.getCurrent());
    selectionHost.replaceChildren(...(row.faceResourceId
      ? [imageThumbnail(row.faceResourceId, store.getCurrent(), row.faceResourceId, 72), el("span", { text: row.faceResourceId })]
      : [el("span", { text: row.status === "no-face" ? "얼굴 없음 확정" : "미검토 · 얼굴 미지정" })]));
    const statusInput = container.querySelector<HTMLSelectElement>('[data-testid="db-cg-status"]');
    if (statusInput) statusInput.value = row.status;
  };
  const refreshCandidates = (): void => {
    const project = store.getCurrent();
    const candidates = listCharacterFaces(project).filter((face) => matches(face, face.resourceId, state.picker));
    candidateHost.replaceChildren(...candidates.map((face) => el("button", {
      class: "db-cg-face-choice", attrs: { type: "button", title: `${face.label} · ${face.resourceId}`, "aria-label": `${face.label} 얼굴 지정` },
      dataset: { testid: `db-cg-assign-${face.resourceId}` },
      children: [imageThumbnail(face.resourceId, project, face.label, 48), el("span", { text: face.label })],
      on: { click: () => {
        mutate("캐릭터 얼굴 지정", (draft) => updateCharacterSprite(draft, { ...currentSprite(draft), status: "mapped", faceResourceId: face.resourceId, quality: "unspecified" }));
        const qualityInput = container.querySelector<HTMLSelectElement>('[data-testid="db-cg-quality"]');
        if (qualityInput) qualityInput.value = "unspecified";
        refreshSelection(); refreshList();
      } },
    })));
    if (!candidates.length) candidateHost.append(emptyState({ title: "조건에 맞는 얼굴이 없습니다", compact: true }));
  };
  const filterControls = (filter: Filter, prefix: string, values: readonly { attributes: GraphicAttributes }[], refresh: () => void): HTMLElement => {
    const search = el("input", { attrs: { type: "search", "aria-label": "그림 이름 또는 ID 검색", placeholder: "이름 또는 ID 검색" }, value: filter.query, dataset: { testid: `${prefix}-search` } });
    search.addEventListener("input", () => { filter.query = search.value; refresh(); });
    const controls = GRAPHIC_ATTRIBUTE_AXES.map((axis) => selectField(AXIS_LABELS[axis], `${prefix}-filter-${axis}`, filter.attributes[axis] ?? "",
      [{ id: "", name: "전체" }, ...[...new Set(values.map((row) => row.attributes[axis]).filter((value): value is string => Boolean(value)))].sort().map((value) => ({ id: value, name: value }))],
      (value) => { filter.attributes[axis] = value; refresh(); }));
    const details = el("details", { dataset: { testid: `${prefix}-filters` }, children: [el("summary", { text: "속성으로 찾기" }), el("div", { class: "db-cg-attribute-grid", children: controls })] });
    return el("div", { class: "db-cg-filters", children: [search, details] });
  };
  const attributeEditor = (prefix: "sprite" | "face", values: GraphicAttributes): HTMLElement => el("div", { class: "db-cg-attribute-grid", children: GRAPHIC_ATTRIBUTE_AXES.map((axis) => {
    const control = textField(AXIS_LABELS[axis], `db-cg-${prefix}-attribute-${axis}`, values[axis] ?? "", (value) => {
      mutate(`${prefix === "sprite" ? "캐릭터" : "얼굴"} ${AXIS_LABELS[axis]}`, (project) => {
        const row = prefix === "sprite" ? currentSprite(project) : currentFace(project);
        const next = { ...row.attributes };
        if (value) next[axis] = value; else delete next[axis];
        if (prefix === "sprite") updateCharacterSprite(project, { ...currentSprite(project), attributes: next });
        else updateCharacterFace(project, { ...currentFace(project), attributes: next });
      }, `${prefix}:${state.spriteKey}:${state.faceId}:${axis}`);
      refreshList();
    });
    control.querySelector("input")!.maxLength = 80;
    return control;
  }) });
  const editText = (prefix: "sprite" | "face", name: "label" | "note", value: string): HTMLElement => {
    const control = textField(name === "label" ? "이름" : "메모", `db-cg-${prefix}-${name}`, value, (next) => {
      mutate(`${prefix === "sprite" ? "캐릭터" : "얼굴"} ${name === "label" ? "이름" : "메모"}`, (project) => {
        if (prefix === "sprite") {
          const row = currentSprite(project);
          if (name === "label") updateCharacterSpriteLabel(project, row.textureKey, row.characterIndex, next);
          else updateCharacterSprite(project, { ...row, note: next });
        } else updateCharacterFace(project, { ...currentFace(project), [name]: next });
      }, `${prefix}:${state.spriteKey}:${state.faceId}:${name}`);
      refreshList();
    });
    control.querySelector("input")!.maxLength = name === "label" ? 200 : 2000;
    return control;
  };

  const detail: HTMLElement[] = [];
  if (state.view === "sprites" && selectedSprite) {
    detail.push(sectionCard({ title: "캐릭터 속성", hint: "글에 명시된 특징만 기본 표시 · 빈칸은 미지정", children: [editText("sprite", "label", selectedSprite.label), attributeEditor("sprite", selectedSprite.attributes), editText("sprite", "note", selectedSprite.note)] }));
    const status = selectField("검토 상태", "db-cg-status", selectedSprite.status, STATUSES, (value) => {
      const current = currentSprite(store.getCurrent());
      if (value === "mapped" && !current.faceResourceId) {
        announce("아래 그림에서 얼굴을 먼저 선택하세요.", true);
        const input = container.querySelector<HTMLSelectElement>('[data-testid="db-cg-status"]')!; input.value = current.status;
        return;
      }
      mutate("캐릭터 얼굴 검토 상태", (project) => updateCharacterSprite(project, { ...currentSprite(project), status: value as GraphicMappingStatus, faceResourceId: value === "mapped" ? current.faceResourceId : null }));
      refreshSelection(); refreshList();
    });
    detail.push(sectionCard({ title: "수동 얼굴 연결", hint: "얼굴 지정은 속성을 복사하거나 이벤트를 바꾸지 않습니다.", children: [selectionHost, status,
      selectField("일치 품질", "db-cg-quality", selectedSprite.quality, QUALITIES, (value) => {
        mutate("캐릭터 얼굴 일치 품질", (project) => updateCharacterSprite(project, { ...currentSprite(project), quality: value as GraphicMatchQuality })); refreshList();
      }), filterControls(state.picker, "db-cg-picker", faces, refreshCandidates), candidateHost,
    ] }));
  } else if (selectedFace) {
    detail.push(sectionCard({ title: "얼굴 속성", hint: "캐릭터와 별도로 분류합니다. 추정하지 않은 특징은 비워 두세요.", children: [editText("face", "label", selectedFace.label), attributeEditor("face", selectedFace.attributes), editText("face", "note", selectedFace.note)] }));
  }

  const json = el("textarea", { attrs: { rows: "5", "aria-label": "캐릭터·얼굴 매핑 JSON", placeholder: "version 1 또는 2 JSON 붙여넣기" }, value: state.json, dataset: { testid: "db-cg-import-json" } });
  json.addEventListener("input", () => { state.json = json.value; });
  const applyImport = (raw: string): void => {
    try {
      const parsed = parseCharacterGraphicsImport(raw, store.getCurrent());
      mutate("캐릭터·얼굴 JSON 가져오기", (project) => applyCharacterGraphicsImport(project, parsed));
      state.json = raw; state.message = `캐릭터 ${parsed.mappings.length}칸 · 얼굴 ${parsed.faces.length}개를 가져왔습니다.`; state.error = false;
      redraw();
    } catch (error) { announce(error instanceof Error ? error.message : String(error), true); }
  };
  const file = el("input", { attrs: { type: "file", accept: ".json,application/json", "aria-label": "매핑 JSON 파일" }, dataset: { testid: "db-cg-import-file" } });
  file.addEventListener("change", () => {
    const selected = file.files?.[0];
    if (!selected) return;
    const projectId = store.getProjectIdentity().id;
    void selected.text().then((raw) => {
      if (!container.contains(file) || store.getProjectIdentity().id !== projectId) { announce("프로젝트 또는 편집 화면이 바뀌어 가져오기를 취소했습니다.", true); return; }
      applyImport(raw);
    }).catch((error: unknown) => announce(error instanceof Error ? error.message : String(error), true));
  });
  detail.push(sectionCard({ title: "JSON 가져오기·내보내기", children: [file, field("JSON", json), listToolbar([
    { label: "JSON 적용", testid: "db-cg-import-apply", onClick: () => applyImport(json.value) },
    { label: "JSON 내보내기", testid: "db-cg-export", onClick: () => {
      try { downloadBlob(new Blob([JSON.stringify(exportCharacterGraphics(store.getCurrent()), null, 2)], { type: "application/json" }), "character-face-mapping-v2.json"); announce("현재 캐릭터·얼굴 메타데이터를 내보냈습니다."); }
      catch (error) { announce(error instanceof Error ? error.message : String(error), true); }
    } },
  ]), message] }));
  const viewButtons = listToolbar([
    { label: "캐릭터", testid: "db-cg-view-sprites", onClick: () => { state.view = "sprites"; redraw(); } },
    { label: "얼굴", testid: "db-cg-view-faces", onClick: () => { state.view = "faces"; redraw(); } },
  ]);
  viewButtons.querySelector(`[data-testid="db-cg-view-${state.view}"]`)!.setAttribute("aria-pressed", "true");
  const filters = filterControls(state[state.view], `db-cg-${state.view}`, state.view === "sprites" ? sprites : faces, refreshList);
  if (state.view === "sprites") filters.append(
    selectField("검토 상태", "db-cg-filter-status", state.status, [{ id: "", name: "전체" }, ...STATUSES], (value) => { state.status = value; refreshList(); }),
    selectField("일치 품질", "db-cg-filter-quality", state.quality, [{ id: "", name: "전체" }, ...QUALITIES], (value) => { state.quality = value; refreshList(); }),
  );
  const selected = state.view === "sprites" ? selectedSprite : selectedFace;
  container.append(workspaceShell({ testid: "db-character-graphics", legacyClass: "db-character-graphics",
    list: listPane({ title: state.view === "sprites" ? "캐릭터 그림" : "얼굴 그림", count: state.view === "sprites" ? sprites.length : faces.length, search: filters, chips: viewButtons, rows: [listHost] }),
    detail: detailPane({ hero: selected ? detailHero({ title: selected.label, subtitle: state.view === "sprites" ? state.spriteKey : state.faceId, media: state.view === "sprites" && selectedSprite ? spriteImage(selectedSprite, 2) : imageThumbnail(selectedFace?.resourceId, store.getCurrent(), selected.label, 72) }) : undefined, body: detail }),
  }));
  refreshList(); refreshSelection(); refreshCandidates();
}
