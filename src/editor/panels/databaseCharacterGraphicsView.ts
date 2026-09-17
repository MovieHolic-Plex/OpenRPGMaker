import { applyCharsetFrameCrop } from "@/assets/charsetFrameCrop";
import { FACE_EXPRESSION_SETS } from "@/assets/faceExpressionSets";
import { GENERATED_FACESET_FACE_IDS } from "@/assets/facesetFaceAssets";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { GRAPHIC_ATTRIBUTE_AXES, applyCharacterGraphicsImport, exportCharacterGraphics, graphicSpriteKey, listCharacterFaces, listCharacterSprites, parseCharacterGraphicsImport, updateCharacterFace, updateCharacterSprite, updateCharacterSpriteLabel, type CharacterFace, type CharacterSprite, type GraphicAttributes, type GraphicAttributeAxis, type GraphicMappingStatus, type GraphicMatchQuality } from "@/project/characterGraphics";
import { isRecommendedCharacterFace, rankCharacterFaces } from "@/project/characterFaceCandidates";
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
  projectId: string;
  view: "sprites" | "faces";
  spriteKey?: string;
  faceId?: string;
  candidateId?: string;
  candidateLimit: number;
  showExpressions: boolean;
  showAllFaces: boolean;
  sprites: Filter;
  faces: Filter;
  picker: Filter;
  status: string;
  quality: string;
  json: string;
  message: string;
  error: boolean;
};
const expressionGroups = new Map(FACE_EXPRESSION_SETS.flatMap((set) => set.faces.map((face) => [face.id, set.id] as const)));
const sessions = new WeakMap<HTMLElement, ViewState>();
function stateFor(container: HTMLElement): ViewState {
  let state = sessions.get(container);
  if (!state || state.projectId !== store.getProjectIdentity().id) {
    state = { projectId: store.getProjectIdentity().id, view: "sprites", candidateLimit: 48, showExpressions: false, showAllFaces: false, sprites: { query: "", attributes: {} }, faces: { query: "", attributes: {} }, picker: { query: "", attributes: {} }, status: "", quality: "", json: "", message: "", error: false };
    sessions.set(container, state);
  }
  return state;
}
/** 표시용 얼굴 목록 — 생성 시리즈(hero-XX-face)는 리소스 관리자·피커와 같이 숨긴다.
 *  검증 집합인 listCharacterFaces 자체는 건드리지 않는다: 저장본의 characterSlots 가
 *  생성 얼굴을 가리켜도 로드가 깨지지 않아야 한다. */
function listPickableFaces(project: Project): CharacterFace[] {
  return listCharacterFaces(project).filter((face) => !GENERATED_FACESET_FACE_IDS.has(face.resourceId));
}
function matches(row: { label: string; note?: string; attributes: GraphicAttributes }, id: string, filter: Filter): boolean {
  const haystack = `${row.label} ${row.note ?? ""} ${id} ${Object.values(row.attributes).join(" ")}`.toLocaleLowerCase();
  return haystack.includes(filter.query.toLocaleLowerCase()) && GRAPHIC_ATTRIBUTE_AXES.every((axis) => !filter.attributes[axis] || row.attributes[axis] === filter.attributes[axis]);
}
function spriteImage(row: CharacterSprite, scale = 1): HTMLElement {
  const image = el("span", { class: "db-cg-sprite-image", attrs: { role: "img", "aria-label": row.label } });
  if (!row.path) { markDatabaseImageFailed(image, row.label); return image; }
  applyCharsetFrameCrop(image, row.path, { characterIndex: row.characterIndex, direction: "down", pattern: 1 }, scale);
  const probe = el("img", { attrs: { src: row.path, alt: "", hidden: "" } });
  probe.addEventListener("error", () => markDatabaseImageFailed(image, row.label), { once: true });
  // Keep the load probe detached: list-thumbnail CSS makes descendant images visible.
  return image;
}

/** This view edits authoring metadata only. It never rewrites actors, event graphics or commands. */
export function renderCharacterGraphicsTab(container: HTMLElement, _rerender?: () => void): void {
  const state = stateFor(container);
  const redraw = (): void => {
    const scrollTop = container.querySelector<HTMLElement>(".db-ws-list")?.scrollTop ?? 0;
    container.replaceChildren(); renderCharacterGraphicsTab(container);
    const list = container.querySelector<HTMLElement>(".db-ws-list");
    if (list) list.scrollTop = scrollTop;
  };
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
  const faces = listPickableFaces(store.getCurrent());
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
        name: row.label, sub: STATUSES.find((status) => status.id === row.status)!.name, number: row.characterIndex, thumb: el("span", { class: "db-cg-pair-thumb", children: [spriteImage(row), ...(row.faceResourceId ? [imageThumbnail(row.faceResourceId, project, "현재 연결된 얼굴", 32)] : [])] }),
        active: state.spriteKey === graphicSpriteKey(row.textureKey, row.characterIndex), testid: `db-cg-sprite-${row.textureKey}-${row.characterIndex}`,
        onSelect: () => { state.spriteKey = graphicSpriteKey(row.textureKey, row.characterIndex); state.candidateId = undefined; state.candidateLimit = 48; redraw(); },
      }))
      : listPickableFaces(project).filter((row) => matches(row, row.resourceId, state.faces)).map((row) => listRow({
        name: row.label, thumb: imageThumbnail(row.resourceId, project, row.label, 40), active: state.faceId === row.resourceId,
        testid: `db-cg-face-${row.resourceId}`, onSelect: () => { state.faceId = row.resourceId; redraw(); },
      }));
    listHost.replaceChildren(...(rows.length ? rows : [emptyState({ title: "조건에 맞는 그림이 없습니다", compact: true })]));
  };
  const refreshSelection = (): void => {
    if (!selectedSprite) return;
    const project = store.getCurrent();
    const row = currentSprite(project);
    const allFaces = listCharacterFaces(project);
    const current = allFaces.find((face) => face.resourceId === row.faceResourceId);
    const candidate = allFaces.find((face) => face.resourceId === state.candidateId);
    const card = (title: string, content: HTMLElement, caption: string): HTMLElement => el("div", { class: "db-cg-comparison-card", children: [el("strong", { text: title }), content, el("span", { text: caption })] });
    const comparison = el("div", { class: "db-cg-comparison", children: [
      card("걷는 모습", spriteImage(row, 3), row.label),
      card("현재 얼굴", current ? imageThumbnail(current.resourceId, project, current.label, 96) : el("span", { text: "—" }), current?.label ?? (row.status === "no-face" ? "얼굴 없음 확정" : "연결되지 않음")),
      card("교체 후보", candidate ? imageThumbnail(candidate.resourceId, project, candidate.label, 96) : el("span", { text: "후보를 선택하세요" }), candidate?.label ?? "선택만으로 저장되지 않습니다"),
    ] });
    const previewFace = candidate ?? current;
    const preview = el("div", { class: "db-cg-dialogue-preview", children: [
      ...(previewFace ? [imageThumbnail(previewFace.resourceId, project, previewFace.label, 64)] : []),
      el("div", { children: [el("strong", { text: row.label }), el("p", { text: "다음 마을로 함께 가볼까요?" }), el("small", { text: "대화창 예시 · 실제 이벤트는 변경되지 않습니다" })] }),
    ] });
    selectionHost.replaceChildren(comparison, preview, listToolbar([
      { label: "선택 취소", disabled: !candidate, onClick: () => { state.candidateId = undefined; refreshSelection(); refreshCandidates(); } },
      { label: "이 얼굴로 연결", kind: "primary", testid: "db-cg-apply-face", disabled: !candidate || candidate.resourceId === row.faceResourceId, onClick: () => {
        if (!candidate || !listPickableFaces(store.getCurrent()).some((face) => face.resourceId === candidate.resourceId)) return;
        mutate("캐릭터 얼굴 지정", (draft) => updateCharacterSprite(draft, { ...currentSprite(draft), status: "mapped", faceResourceId: candidate.resourceId, quality: "unspecified" }));
        state.candidateId = undefined;
        refreshSelection(); refreshList(); refreshCandidates();
        announce("얼굴 연결을 적용했습니다. 기존 이벤트의 얼굴은 유지됩니다.");
      } },
    ]));
    const statusInput = container.querySelector<HTMLSelectElement>('[data-testid="db-cg-status"]');
    if (statusInput) statusInput.value = row.status;
    const qualityInput = container.querySelector<HTMLSelectElement>('[data-testid="db-cg-quality"]');
    if (qualityInput) { qualityInput.value = row.quality; qualityInput.disabled = row.status !== "mapped"; }
  };
  const refreshCandidates = (): void => {
    const project = store.getCurrent();
    const candidates = listPickableFaces(project).filter((face) => matches(face, face.resourceId, state.picker));
    const ordered = selectedSprite ? rankCharacterFaces(currentSprite(project), candidates) : [];
    const seen = new Set<string>();
    const ranked = ordered.filter((candidate) => {
      const { face } = candidate;
      if (!state.showAllFaces && !state.picker.query.trim() && !isRecommendedCharacterFace(candidate)) return false;
      if (state.showExpressions || state.picker.query.trim()) return true;
      const group = expressionGroups.get(face.resourceId);
      if (!group) return true;
      if (seen.has(group)) return false;
      seen.add(group);
      return true;
    });
    candidateHost.replaceChildren(...ranked.slice(0, state.candidateLimit).map(({ face, reasons, conflicts, recommendation }) => el("button", {
      class: "db-cg-face-choice", attrs: { type: "button", title: `${face.label} · ${face.resourceId}`, "aria-label": `${face.label} 후보 선택`, "aria-pressed": String(state.candidateId === face.resourceId) },
      dataset: { testid: `db-cg-assign-${face.resourceId}`, recommendation },
      children: [imageThumbnail(face.resourceId, project, face.label, 64), el("strong", { text: face.label }),
        el("small", { class: "db-cg-recommendation", text: ({ paired: "원본 대응", similar: "유사 특징 · 동일인 미확인", none: "추천 근거 부족", conflict: "추천 제외 · 속성 확인" })[recommendation] }),
        el("small", { text: reasons.slice(0, 2).join(" · ") || "일치 근거 없음 · 직접 확인" }),
        ...(conflicts.length ? [el("small", { class: "db-cg-conflict", text: `차이 있음 · ${conflicts.join(" / ")}` })] : []),
      ],
      on: { click: () => {
        state.candidateId = face.resourceId;
        refreshSelection();
        for (const button of candidateHost.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")) button.setAttribute("aria-pressed", String(button.dataset.testid === `db-cg-assign-${face.resourceId}`));
      } },
    })));
    if (ranked.length > state.candidateLimit) candidateHost.append(el("button", { class: "db-cg-face-choice", attrs: { type: "button" }, text: `후보 더 보기 (${state.candidateLimit}/${ranked.length})`, on: { click: () => { state.candidateLimit += 48; refreshCandidates(); } } }));
    if (!ranked.length) candidateHost.append(emptyState({ title: state.showAllFaces || state.picker.query.trim() ? "조건에 맞는 얼굴이 없습니다" : "추천할 근거가 충분한 얼굴이 없습니다", body: "전체 얼굴에서 직접 고르거나 캐릭터의 특징을 보완하세요.", compact: true }));
  };
  const filterControls = (filter: Filter, prefix: string, values: readonly { attributes: GraphicAttributes }[], refresh: () => void): HTMLElement => {
    const search = el("input", { attrs: { type: "search", "aria-label": "그림 이름·메모·ID 검색", placeholder: "이름·메모·ID 검색" }, value: filter.query, dataset: { testid: `${prefix}-search` } });
    search.addEventListener("input", () => { filter.query = search.value; state.candidateLimit = 48; refresh(); });
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
      refreshList(); refreshCandidates();
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
      refreshList(); refreshSelection(); refreshCandidates();
    });
    control.querySelector("input")!.maxLength = name === "label" ? 200 : 2000;
    return control;
  };

  const detail: HTMLElement[] = [];
  if (state.view === "sprites" && selectedSprite) {
    const metadata = el("details", { children: [el("summary", { text: "캐릭터 이름 · 특징 · 메모" }), sectionCard({ title: "캐릭터 속성", hint: "등록된 이름·태그·성별·나이에서 읽은 특징입니다. 직접 수정한 값이 우선합니다.", children: [editText("sprite", "label", selectedSprite.label), attributeEditor("sprite", selectedSprite.attributes), editText("sprite", "note", selectedSprite.note)] })] });
    const status = selectField("검토 상태", "db-cg-status", selectedSprite.status, STATUSES, (value) => {
      const current = currentSprite(store.getCurrent());
      if (value === "mapped" && !current.faceResourceId) {
        announce("아래 그림에서 얼굴을 먼저 선택하세요.", true);
        const input = container.querySelector<HTMLSelectElement>('[data-testid="db-cg-status"]')!; input.value = current.status;
        return;
      }
      mutate("캐릭터 얼굴 검토 상태", (project) => updateCharacterSprite(project, { ...currentSprite(project), status: value as GraphicMappingStatus, faceResourceId: value === "mapped" ? current.faceResourceId : null, quality: value === "mapped" ? current.quality : "unspecified" }));
      state.candidateId = undefined; refreshSelection(); refreshList(); refreshCandidates();
    });
    detail.push(sectionCard({ title: "얼굴 비교 · 연결", hint: "기본 대응표와 등록된 특징으로 후보를 정렬합니다. 추천은 동일 인물의 확정이 아닙니다.", children: [el("div", { class: "db-cg-workbench", children: [el("div", { class: "db-cg-review", children: [selectionHost, status,
      selectField("일치 품질", "db-cg-quality", selectedSprite.quality, QUALITIES, (value) => {
        mutate("캐릭터 얼굴 일치 품질", (project) => updateCharacterSprite(project, { ...currentSprite(project), quality: value as GraphicMatchQuality })); refreshList();
      })] }), el("div", { class: "db-cg-candidates", children: [el("h3", { text: "얼굴 후보" }), filterControls(state.picker, "db-cg-picker", faces, refreshCandidates), el("label", { class: "db-cg-expression-toggle", children: [el("input", { attrs: { type: "checkbox", ...(state.showAllFaces ? { checked: "" } : {}) }, dataset: { testid: "db-cg-show-all-faces" }, on: { change: (event) => { state.showAllFaces = (event.target as HTMLInputElement).checked; state.candidateLimit = 48; refreshCandidates(); } } }), el("span", { text: "전체 얼굴 보기 · 추천 제외 포함" })] }), el("label", { class: "db-cg-expression-toggle", children: [el("input", { attrs: { type: "checkbox", ...(state.showExpressions ? { checked: "" } : {}) }, on: { change: (event) => { state.showExpressions = (event.target as HTMLInputElement).checked; state.candidateLimit = 48; refreshCandidates(); } } }), el("span", { text: "모든 표정 보기" })] }), candidateHost] })] }),
    ] }));
    detail.push(metadata);
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
  detail.push(el("details", { children: [el("summary", { text: "가져오기 · 내보내기" }), sectionCard({ title: "JSON 가져오기·내보내기", children: [file, field("JSON", json), listToolbar([
    { label: "JSON 적용", testid: "db-cg-import-apply", onClick: () => applyImport(json.value) },
    { label: "JSON 내보내기", testid: "db-cg-export", onClick: () => {
      try { downloadBlob(new Blob([JSON.stringify(exportCharacterGraphics(store.getCurrent()), null, 2)], { type: "application/json" }), "character-face-mapping-v2.json"); announce("현재 캐릭터·얼굴 메타데이터를 내보냈습니다."); }
      catch (error) { announce(error instanceof Error ? error.message : String(error), true); }
    } },
  ])] })] }));
  detail.unshift(message);
  const viewButtons = listToolbar([
    { label: "캐릭터", testid: "db-cg-view-sprites", onClick: () => { state.view = "sprites"; redraw(); } },
    { label: "얼굴", testid: "db-cg-view-faces", onClick: () => { state.view = "faces"; redraw(); } },
  ]);
  viewButtons.classList.add("db-cg-view-switch");
  viewButtons.querySelector(`[data-testid="db-cg-view-${state.view}"]`)!.setAttribute("aria-pressed", "true");
  const filters = filterControls(state[state.view], `db-cg-${state.view}`, state.view === "sprites" ? sprites : faces, refreshList);
  if (state.view === "sprites") filters.append(
    selectField("검토 상태", "db-cg-filter-status", state.status, [{ id: "", name: "전체" }, ...STATUSES], (value) => { state.status = value; refreshList(); }),
    selectField("일치 품질", "db-cg-filter-quality", state.quality, [{ id: "", name: "전체" }, ...QUALITIES], (value) => { state.quality = value; refreshList(); }),
  );
  const selected = state.view === "sprites" ? selectedSprite : selectedFace;
  container.append(workspaceShell({ testid: "db-character-graphics", legacyClass: "db-character-graphics",
    list: listPane({ title: state.view === "sprites" ? "캐릭터 그림" : "얼굴 그림", count: state.view === "sprites" ? sprites.length : faces.length, search: el("div", { class: "db-cg-list-controls", children: [viewButtons, filters] }), rows: [listHost] }),
    detail: detailPane({ hero: selected ? detailHero({ title: selected.label, subtitle: state.view === "sprites" ? state.spriteKey : state.faceId, media: state.view === "sprites" && selectedSprite ? spriteImage(selectedSprite, 2) : imageThumbnail(selectedFace?.resourceId, store.getCurrent(), selected.label, 72) }) : undefined, body: detail }),
  }));
  refreshList(); refreshSelection(); refreshCandidates();
}
