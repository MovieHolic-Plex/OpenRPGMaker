// 「도트 연출」 탭 — 스킬이 부르는 도트 이펙트 연출(층·시작 시각·크기)을 저작한다.
//
// 목록: 프로젝트 연출(chor_*) 먼저, 그 뒤 기본 연출(번들 계약 약 1,130개, 읽기 전용, 「기본」 배지).
// 기본 연출을 고르면 「복제해서 고치기」가 프로젝트 연출을 만든다. 프로젝트 연출은 층 표로 고친다.
// 어떤 편집이든 오른쪽 무대가 곧바로 다시 돈다(기존 스킬 탭 무대 + resolveSkillChoreography 경로 재사용).
// 손대는 손잡이는 이름·설명·모션·층(시트·자리·시작 ms·크기·반복·타마다)뿐이다. 속도·무게·색조·화면·효과음은 이 탭에 없다.
//
// DOM 계약(테스트·캡처가 의존):
//   db-retro-choreo-workspace, -list, -row-<id>, -badge-default(기본 행), -search
//   db-retro-choreo-add / -clone / -delete, -used-by(쓰는 곳), -stage(무대 자리)
//   db-retro-choreo-layer-<n>, -layer-<n>-sheet(썸네일 버튼)·-anchor·-start·-scale·-repeat·-each·-up·-down·-remove
//   db-retro-choreo-add-layer, -axis(시간 축), -sheet-picker(시트 갤러리 자리)
import { freshChoreographyId, cloneChoreographyRecord } from "@/assets/retroChoreographyClone";
import { filterRetroChoreographies, retroChoreographyEntries, retroFxSheetKeys, retroFxSheetMeta, type RetroChoreographyEntry } from "@/assets/retroSkillCatalog";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { numberField, selectField, textControl, toggleSwitch } from "@/editor/panels/databaseControls";
import {
  RETRO_CHOREOGRAPHY_MOTION_LABELS, renderChoreographyPreview, retroSheetGallery, sheetThumb,
} from "@/editor/panels/databaseRetroGallery";
import { ANCHOR_LABELS, type SkillRetroStage } from "@/editor/panels/databaseSkillRetroStage";
import {
  detailHero, detailPane, emptyState, listPane, listRow, listSearch, listToolbar, noticeBar, sectionCard, workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import {
  SKILL_CHOREOGRAPHY_ANCHORS, SKILL_CHOREOGRAPHY_LAYER_LIMIT, SKILL_CHOREOGRAPHY_LIMIT, SKILL_CHOREOGRAPHY_MOTIONS,
  SKILL_CHOREOGRAPHY_RANGES, normalizeSkillChoreographyRecord,
} from "@/project/skillChoreographyRecords";
import { store } from "@/project/store";
import type { SkillChoreographyLayer, SkillChoreographyRecord } from "@/project/types/database";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

/** 기본 연출은 1,130개라 목록에는 앞쪽만 싣고 나머지는 검색으로 좁히게 한다. */
const DEFAULT_ROW_LIMIT = 150;
/** 시간 축 층 길이 추정(ms/프레임). 무대의 실제 재생 속도와 같지 않고 배치를 가늠하는 용도다. */
const AXIS_MS_PER_FRAME = 80;

let selectedId: string | undefined;
let listQuery = "";
/** 시트 갤러리를 연 층 번호(없으면 닫힘). */
let pickerLayer: number | undefined;
let currentStage: SkillRetroStage | null = null;

export function resetRetroChoreographyViewState(): void {
  selectedId = undefined;
  listQuery = "";
  pickerLayer = undefined;
  currentStage?.stop();
  currentStage = null;
}

function records(): SkillChoreographyRecord[] {
  return store.getCurrent().database.skillChoreographies ?? [];
}

function usedBy(id: string): string[] {
  const isDefault = !records().some((record) => record.id === id);
  return store.getCurrent().database.skills
    .filter((skill) => skill.retroChoreographyId === id || (isDefault && skill.id === id))
    .map((skill) => skill.name || skill.id);
}

function motionLabel(motion: string): string {
  return RETRO_CHOREOGRAPHY_MOTION_LABELS[motion] ?? motion;
}

function editRecord(id: string, mutate: (record: SkillChoreographyRecord) => void): void {
  store.update((draft) => {
    const record = draft.database.skillChoreographies?.find((row) => row.id === id);
    if (record) mutate(record);
  });
}

function clampTo(value: number, [min, max]: readonly [number, number]): number {
  return Math.min(max, Math.max(min, value));
}

export function renderRetroChoreographyTab(content: HTMLElement, rerender: () => void): void {
  currentStage?.stop();
  currentStage = null;
  const projectRecords = records();
  const all = filterRetroChoreographies({ query: listQuery.trim() || undefined }, projectRecords);
  const projectRows = all.filter((entry) => entry.origin === "project");
  const defaultMatches = all.filter((entry) => entry.origin === "default");
  const defaultRows = defaultMatches.slice(0, DEFAULT_ROW_LIMIT);
  const visible = [...projectRows, ...defaultRows];
  const known = [...projectRecords.map((record) => record.id), ...retroChoreographyEntries().map((entry) => entry.id)];
  if (!selectedId || !known.includes(selectedId)) selectedId = visible[0]?.id;
  const selectedProject = projectRecords.find((record) => record.id === selectedId);
  const selectedEntry: RetroChoreographyEntry | undefined = selectedId
    ? filterRetroChoreographies({}, projectRecords).find((entry) => entry.id === selectedId)
    : undefined;

  const select = (id: string): void => { selectedId = id; pickerLayer = undefined; rerender(); };

  const rows = visible.map((entry) => {
    const row = listRow({
      name: entry.name,
      ...(entry.origin === "default" ? { sub: "기본" } : { sub: "내 연출" }),
      thumb: sheetThumb(entry.layerKeys[0] ?? "", 24),
      active: entry.id === selectedId,
      title: `${entry.name}\n${entry.layerSummary}`,
      onSelect: () => select(entry.id),
      testid: "db-retro-choreo-row-" + entry.id,
    });
    if (entry.origin === "default") row.querySelector(".db-list-sub")?.setAttribute("data-testid", "db-retro-choreo-badge-default");
    return row;
  });
  if (defaultMatches.length > defaultRows.length) {
    rows.push(el("div", { class: "db-retro-choreo-more", text: `기본 연출 ${defaultMatches.length - defaultRows.length}개 더 있음 — 검색으로 좁혀 보세요.` }));
  }

  const addRecord = (): void => {
    if (projectRecords.length >= SKILL_CHOREOGRAPHY_LIMIT) { toast(`프로젝트 연출은 ${SKILL_CHOREOGRAPHY_LIMIT}개까지입니다.`, "error"); return; }
    const sheet = retroFxSheetKeys()[0];
    if (!sheet) return;
    const fresh = normalizeSkillChoreographyRecord({
      id: freshChoreographyId(projectRecords, "새 연출"), name: "새 연출", motion: "cast", layers: [{ sheet, anchor: "target" }],
    });
    if (!fresh) return;
    recordProjectSnapshot("도트 연출 추가");
    store.update((draft) => { (draft.database.skillChoreographies ??= []).push(fresh); });
    selectedId = fresh.id;
    pickerLayer = 0;
    toast("새 연출을 만들었습니다. 첫 층의 이펙트를 골라 보세요.", "ok");
    rerender();
  };
  const cloneSelected = (): void => {
    if (!selectedId) return;
    if (projectRecords.length >= SKILL_CHOREOGRAPHY_LIMIT) { toast(`프로젝트 연출은 ${SKILL_CHOREOGRAPHY_LIMIT}개까지입니다.`, "error"); return; }
    const copy = cloneChoreographyRecord(projectRecords, selectedId);
    if (!copy) { toast("복제할 수 없는 연출입니다.", "error"); return; }
    recordProjectSnapshot("도트 연출 복제");
    store.update((draft) => { (draft.database.skillChoreographies ??= []).push(copy); });
    selectedId = copy.id;
    pickerLayer = undefined;
    toast(`「${copy.name}」을(를) 만들었습니다. 이제 고칠 수 있습니다.`, "ok");
    rerender();
  };
  const deleteSelected = (): void => {
    if (!selectedProject) return;
    const users = usedBy(selectedProject.id);
    const message = users.length
      ? `「${selectedProject.name}」을(를) 지웁니다.\n이 연출을 쓰는 스킬 ${users.length}개(${users.slice(0, 5).join(", ")}${users.length > 5 ? " 외" : ""})는 연출이 비워집니다. 계속할까요?`
      : `「${selectedProject.name}」을(를) 지웁니다. 계속할까요?`;
    if (!globalThis.confirm(message)) return;
    const id = selectedProject.id;
    recordProjectSnapshot("도트 연출 삭제");
    store.update((draft) => {
      draft.database.skillChoreographies = (draft.database.skillChoreographies ?? []).filter((row) => row.id !== id);
      for (const skill of draft.database.skills) if (skill.retroChoreographyId === id) delete skill.retroChoreographyId;
    });
    selectedId = undefined;
    pickerLayer = undefined;
    rerender();
  };

  const list = listPane({
    title: "도트 연출",
    count: projectRecords.length ? `내 ${projectRecords.length} · 기본 ${retroChoreographyEntries().length}` : `기본 ${retroChoreographyEntries().length}`,
    search: listSearch({
      placeholder: "이름·설명·이펙트 (예: 번개, 화염 참격)",
      value: listQuery,
      onInput: (value) => { listQuery = value; selectedId = undefined; rerender(); },
      testid: "db-retro-choreo-search",
    }),
    rows,
    empty: emptyState({ title: "맞는 연출이 없습니다", body: "낱말을 줄이거나 다른 이름으로 찾아 보세요.", compact: true }),
    toolbar: listToolbar([
      { label: "추가", kind: "primary", onClick: addRecord, testid: "db-retro-choreo-add", title: "빈 연출을 새로 만든다" },
      { label: "복제", onClick: cloneSelected, disabled: !selectedId, testid: "db-retro-choreo-clone-list", title: "고른 연출을 복제해 프로젝트 연출로 만든다" },
      { label: "삭제", kind: "danger", onClick: deleteSelected, disabled: !selectedProject, testid: "db-retro-choreo-delete", title: "고른 프로젝트 연출을 지운다(기본 연출은 지울 수 없다)" },
    ]),
    testid: "db-retro-choreo-list",
  });

  const detail = selectedEntry
    ? renderDetail(selectedEntry, selectedProject, { rerender, cloneSelected })
    : detailPane({ body: emptyState({ title: "연출을 골라 보세요", body: "왼쪽에서 기본 연출을 고른 뒤 「복제해서 고치기」를 누르면 층을 바꿀 수 있습니다." }) });

  content.replaceChildren(workspaceShell({ list, detail, testid: "db-retro-choreo-workspace" }));
}

interface DetailContext { readonly rerender: () => void; readonly cloneSelected: () => void }

function renderDetail(entry: RetroChoreographyEntry, project: SkillChoreographyRecord | undefined, ctx: DetailContext): HTMLElement {
  const isDefault = !project;
  // 무대: 어떤 편집이든 이 함수로 다시 돌린다.
  const stageHost = el("div", { class: "db-retro-choreo-stage", dataset: { testid: "db-retro-choreo-stage" } });
  const refreshStage = (): void => {
    currentStage?.stop();
    const name = project?.name ?? entry.name;
    currentStage = renderChoreographyPreview(entry.id, name);
    stageHost.replaceChildren(...(currentStage ? [currentStage.element] : [el("div", { class: "db-retro-choreo-nostage", text: "이 연출은 무대로 보여 줄 수 없습니다." })]));
  };
  const axisHost = el("div", { class: "db-retro-choreo-axis-host" });
  const refreshAxis = (): void => {
    const current = project ? records().find((row) => row.id === project.id) : undefined;
    axisHost.replaceChildren(timeAxis(current?.layers ?? []));
  };
  const refreshLive = (): void => { refreshStage(); refreshAxis(); };

  const users = usedBy(entry.id);
  const usedCard = sectionCard({
    title: "쓰는 곳",
    hint: users.length ? `이 연출을 부르는 스킬 ${users.length}개` : "아직 이 연출을 쓰는 스킬이 없습니다. 스킬 탭의 「도트 연출」 칸에서 고를 수 있습니다.",
    children: users.length ? [el("ul", { class: "db-retro-choreo-users", children: users.map((name) => el("li", { text: name })) })] : [],
    testid: "db-retro-choreo-used-by",
  });
  const previewCard = sectionCard({ title: "미리보기", hint: "고칠 때마다 바로 다시 재생됩니다.", children: [stageHost] });

  if (isDefault) {
    const hero = detailHero({
      title: entry.name,
      eyebrow: "기본 연출 (읽기 전용)",
      subtitle: entry.description,
      tags: [motionLabel(entry.motion), ...(entry.element ? [entry.element] : []), `층 ${entry.layerKeys.length}`],
      actions: [{ label: "복제해서 고치기", kind: "primary", onClick: ctx.cloneSelected, testid: "db-retro-choreo-clone", title: "프로젝트 연출로 복제해 층을 고친다" }],
    });
    const layers = sectionCard({ title: "층", children: [el("div", { class: "db-retro-choreo-summary", text: entry.layerSummary })] });
    const body = [
      noticeBar({ text: "기본 연출은 고칠 수 없습니다. 복제하면 같은 층으로 시작하는 내 연출이 생기고, 스킬이 그것을 고를 수 있습니다." }),
      previewCard, layers, usedCard,
    ];
    refreshLive();
    return detailPane({ hero, body, testid: "db-retro-choreo-detail" });
  }

  const editable = project;
  const id = editable.id;
  const layerCard = sectionCard({ title: `층 (${editable.layers.length}/${SKILL_CHOREOGRAPHY_LAYER_LIMIT})`, hint: "위에서부터 겹쳐 그려집니다. 시작 ms 는 스킬이 시작된 뒤 몇 ms 에 이 층이 나오는지입니다.", children: [] });
  const layerBody = layerCard.querySelector(".db-ws-card-body") ?? layerCard;

  const commitLayer = (index: number, key: string, mutate: (layer: SkillChoreographyLayer) => void): void => {
    recordCoalescedSnapshot(`retro-choreo:${id}:${index}:${key}`, "도트 연출 층 편집");
    editRecord(id, (record) => { const layer = record.layers[index]; if (layer) mutate(layer); });
    refreshLive();
  };
  const structural = (label: string, mutate: (record: SkillChoreographyRecord) => void): void => {
    recordProjectSnapshot(label);
    editRecord(id, mutate);
    ctx.rerender();
  };

  editable.layers.forEach((layer, index) => {
    const meta = retroFxSheetMeta(layer.sheet);
    const thumbButton = el("button", {
      class: "db-retro-choreo-thumb-btn" + (pickerLayer === index ? " active" : ""),
      attrs: { type: "button", title: `${layer.sheet} — 눌러서 이펙트 바꾸기`, "aria-label": `층 ${index + 1} 이펙트 바꾸기: ${layer.sheet}` },
      dataset: { testid: `db-retro-choreo-layer-${index}-sheet` },
      children: [sheetThumb(layer.sheet, 48), el("span", { class: "db-retro-card-sub", text: `${layer.sheet}${meta ? ` · ${meta.frame}px` : ""}` })],
    });
    thumbButton.addEventListener("click", () => { pickerLayer = pickerLayer === index ? undefined : index; ctx.rerender(); });
    const move = (delta: number): void => structural("도트 연출 층 순서", (record) => {
      const target = index + delta;
      if (target < 0 || target >= record.layers.length) return;
      const [item] = record.layers.splice(index, 1);
      if (item) record.layers.splice(target, 0, item);
      if (pickerLayer === index) pickerLayer = target;
    });
    const btn = (label: string, testid: string, onClick: () => void, disabled = false): HTMLButtonElement => {
      const b = el("button", { class: "btn small ghost", text: label, attrs: { type: "button", title: label, "aria-label": `층 ${index + 1} ${label}` }, dataset: { testid: `db-retro-choreo-layer-${index}-${testid}` } });
      b.disabled = disabled;
      b.addEventListener("click", onClick);
      return b;
    };
    layerBody.append(el("div", {
      class: "db-retro-choreo-layer",
      dataset: { testid: `db-retro-choreo-layer-${index}` },
      children: [
        el("span", { class: "db-retro-choreo-layer-no", text: String(index + 1) }),
        thumbButton,
        selectField("자리", `db-retro-choreo-layer-${index}-anchor`, layer.anchor,
          SKILL_CHOREOGRAPHY_ANCHORS.map((anchor) => ({ id: anchor, name: ANCHOR_LABELS[anchor] })),
          (value) => commitLayer(index, "anchor", (row) => { row.anchor = value as SkillChoreographyLayer["anchor"]; })),
        numberField("시작(ms)", `db-retro-choreo-layer-${index}-start`, layer.startMs ?? 0,
          (value) => commitLayer(index, "start", (row) => { row.startMs = Math.round(clampTo(value, SKILL_CHOREOGRAPHY_RANGES.startMs)); }),
          { min: SKILL_CHOREOGRAPHY_RANGES.startMs[0], max: SKILL_CHOREOGRAPHY_RANGES.startMs[1], step: 10 }),
        numberField("크기(배)", `db-retro-choreo-layer-${index}-scale`, layer.scale ?? 1,
          (value) => commitLayer(index, "scale", (row) => { row.scale = Math.round(clampTo(value, SKILL_CHOREOGRAPHY_RANGES.scale) * 100) / 100; }),
          { min: SKILL_CHOREOGRAPHY_RANGES.scale[0], max: SKILL_CHOREOGRAPHY_RANGES.scale[1], step: 0.1 }),
        numberField("반복", `db-retro-choreo-layer-${index}-repeat`, layer.repeat ?? 1,
          (value) => commitLayer(index, "repeat", (row) => { row.repeat = Math.round(clampTo(value, SKILL_CHOREOGRAPHY_RANGES.repeat)); }),
          { min: SKILL_CHOREOGRAPHY_RANGES.repeat[0], max: SKILL_CHOREOGRAPHY_RANGES.repeat[1], step: 1 }),
        toggleSwitch("타마다", `db-retro-choreo-layer-${index}-each`, layer.onHit === "each",
          (checked) => commitLayer(index, "each", (row) => { if (checked) row.onHit = "each"; else delete row.onHit; })),
        el("div", { class: "db-retro-choreo-layer-actions", children: [
          btn("위로", "up", () => move(-1), index === 0),
          btn("아래로", "down", () => move(1), index === editable.layers.length - 1),
          btn("삭제", "remove", () => structural("도트 연출 층 삭제", (record) => {
            if (record.layers.length <= 1) { toast("층은 최소 1개가 필요합니다.", "error"); return; }
            record.layers.splice(index, 1);
            pickerLayer = undefined;
          }), editable.layers.length <= 1),
        ] }),
      ],
    }));
  });

  const addLayer = el("button", {
    class: "btn small", text: "층 추가", attrs: { type: "button", title: "층 추가" }, dataset: { testid: "db-retro-choreo-add-layer" },
  });
  addLayer.disabled = editable.layers.length >= SKILL_CHOREOGRAPHY_LAYER_LIMIT;
  addLayer.addEventListener("click", () => {
    const sheet = editable.layers[editable.layers.length - 1]?.sheet ?? retroFxSheetKeys()[0];
    if (!sheet) return;
    structural("도트 연출 층 추가", (record) => {
      record.layers.push({ sheet, anchor: "target" });
      pickerLayer = record.layers.length - 1;
    });
  });
  layerBody.append(el("div", { class: "db-retro-choreo-layer-add", children: [addLayer] }));

  const cards: HTMLElement[] = [previewCard, sectionCard({ title: "시간 축", hint: "각 층이 시작 시각에 맞춰 놓인 모습(길이는 대략).", children: [axisHost] })];
  cards.push(sectionCard({
    title: "기본 정보",
    children: [
      textControl("이름", editable.name, (value) => {
        recordCoalescedSnapshot(`retro-choreo:${id}:name`, "도트 연출 이름");
        editRecord(id, (record) => { record.name = value.slice(0, 80); });
        document.querySelector(`[data-testid="db-retro-choreo-row-${id}"] .db-list-name`)?.replaceChildren(document.createTextNode(value || "(이름 없음)"));
      }, "db-retro-choreo-name"),
      textControl("설명", editable.description ?? "", (value) => {
        recordCoalescedSnapshot(`retro-choreo:${id}:description`, "도트 연출 설명");
        editRecord(id, (record) => { if (value.trim()) record.description = value.slice(0, 400); else delete record.description; });
      }, "db-retro-choreo-description"),
      selectField("모션", "db-retro-choreo-motion", editable.motion,
        SKILL_CHOREOGRAPHY_MOTIONS.map((motion) => ({ id: motion, name: motionLabel(motion) })),
        (value) => { recordProjectSnapshot("도트 연출 모션"); editRecord(id, (record) => { record.motion = value as SkillChoreographyRecord["motion"]; }); refreshLive(); }),
    ],
    testid: "db-retro-choreo-basic",
  }));
  cards.push(layerCard);
  if (pickerLayer !== undefined && editable.layers[pickerLayer]) {
    const target = pickerLayer;
    cards.push(sectionCard({
      title: `층 ${target + 1} 이펙트 고르기`,
      hint: "한글로 찾을 수 있습니다(예: 번개, 불꽃, 얼음). 카드를 누르면 바로 바뀝니다.",
      children: [retroSheetGallery({
        selected: editable.layers[target]?.sheet,
        onPick: (key) => {
          recordProjectSnapshot("도트 연출 이펙트 바꾸기");
          editRecord(id, (record) => { const layer = record.layers[target]; if (layer) layer.sheet = key; });
          pickerLayer = undefined;
          ctx.rerender();
        },
      })],
      testid: "db-retro-choreo-sheet-picker",
    }));
  }
  cards.push(usedCard);

  const hero = detailHero({
    title: editable.name,
    eyebrow: "내 연출",
    subtitle: editable.sourceId ? `복제 원본: ${editable.sourceId}` : undefined,
    tags: [motionLabel(editable.motion), `층 ${editable.layers.length}`],
  });
  refreshLive();
  return detailPane({ hero, body: cards, testid: "db-retro-choreo-detail" });
}

/** 층들을 시작 시각 순서대로 가로 막대로 놓는다. */
function timeAxis(layers: readonly SkillChoreographyLayer[]): HTMLElement {
  const spans = layers.map((layer) => {
    const meta = retroFxSheetMeta(layer.sheet);
    const start = layer.startMs ?? 0;
    return { layer, start, end: start + (meta?.frames ?? 8) * AXIS_MS_PER_FRAME * (layer.repeat ?? 1) };
  });
  const total = Math.max(1000, ...spans.map((span) => span.end));
  const axis = el("div", { class: "db-retro-choreo-axis", dataset: { testid: "db-retro-choreo-axis" } });
  spans.forEach((span, index) => {
    const bar = el("span", {
      class: "db-retro-choreo-axis-bar" + (span.layer.startMs === undefined ? " auto" : ""),
      text: `${index + 1} ${span.layer.sheet}`,
      attrs: { title: `층 ${index + 1}: ${span.layer.sheet} · ${span.start}ms 시작${span.layer.startMs === undefined ? "(자동)" : ""}` },
    });
    bar.style.left = (span.start / total) * 100 + "%";
    bar.style.width = Math.max(4, ((span.end - span.start) / total) * 100) + "%";
    axis.append(el("div", { class: "db-retro-choreo-axis-lane", children: [bar] }));
  });
  axis.append(el("div", { class: "db-retro-choreo-axis-scale", children: [el("span", { text: "0" }), el("span", { text: `${Math.round(total)}ms` })] }));
  return axis;
}
