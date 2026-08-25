import { duplicateInto } from "@/editor/databaseCopy";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { selectEditorMap } from "@/editor/mapSelection";
import { cropReferenceMessage } from "@/editor/databaseReferences";
import { numberField, selectField, textControl } from "@/editor/panels/databaseControls";
import { clickDatabaseTabFrom, renderLifePanel } from "@/editor/panels/databaseLifeUi";
import { normalizeCropRecord } from "@/project/farmModel";
import { SEASONS } from "@/project/gameTime";
import { store } from "@/project/store";
import type { CropGraphicStage, CropRecord } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

const DELETE_CONFIRM_LABEL = "정말 삭제?";
const DELETE_IDLE_LABEL = "삭제";
const DELETE_CONFIRM_WINDOW_MS = 3000;

let selectedCropId: string | undefined;

export function renderCropTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const crops = project.database.crops ?? [];
  if (!selectedCropId || !crops.some((record) => record.id === selectedCropId)) selectedCropId = crops[0]?.id;
  const selected = crops.find((record) => record.id === selectedCropId);
  const list = el("div", { class: "db-list" });
  for (let index = 0; index < crops.length; index += 1) {
    const record = crops[index]!;
    const trailing = `#${index + 1}`;
    list.append(el("button", {
      class: `db-list-row${record.id === selectedCropId ? " active" : ""}`,
      attrs: { type: "button", title: `${record.name || "(이름 없음)"} ${trailing} — ${record.id}` },
      dataset: { testid: `db-crop-row-${record.id}`, recordId: record.id },
      on: {
        click: () => {
          selectedCropId = record.id;
          rerender();
        },
      },
      children: [
        el("span", { class: "db-list-name", text: record.name || "(이름 없음)" }),
        el("small", { class: "db-list-meta", text: trailing, attrs: { title: record.id } }),
      ],
    }));
  }
  const listPane = el("div", { class: "db-list-pane oprn-record-list-pane" });
  listPane.append(
    el("h3", { text: "농사·작물" }),
    list,
    el("div", { class: "db-list-footer", text: `${crops.length}개` }),
    toolbar(rerender)
  );
  const detailPane = el("div", { class: "db-detail-pane oprn-record-detail-pane" });
  detailPane.append(selected ? cropForm(selected, rerender) : cropEmptyState(rerender));
  host.append(
    cropLifeHeader(project, rerender),
    el("div", { class: "db-record-workspace oprn-record-workspace oprn-record-crops", children: [listPane, detailPane] }),
  );
}

function cropLifeHeader(project: ReturnType<typeof store.getCurrent>, rerender: () => void): HTMLElement {
  const timeReady = project.system.timeSystem?.enabled === true;
  const farmableMaps = Object.values(project.maps).filter((map) => (map.farmableArea ?? []).length > 0);
  const farmableMapCount = farmableMaps.length;
  const toolKinds = new Set(project.database.items.map((item) => item.farmTool).filter(Boolean));
  const toolsReady = toolKinds.has("hoe") && toolKinds.has("wateringCan");
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const crops = project.database.crops ?? [];
  const invalidCrops = crops.filter((crop) => !itemIds.has(crop.seedItemId) || !itemIds.has(crop.harvestItemId));
  const openTab = (event: Event, testid: string): void => {
    if (!clickDatabaseTabFrom(event.currentTarget as HTMLElement | null, testid)) {
      toast("데이터베이스 창에서 해당 탭을 열어 주세요.", "info");
    }
  };

  return el("div", {
    class: "db-life-header",
    children: [
      el("p", {
        class: "db-record-intro",
        dataset: { testid: "db-crops-intro" },
        text: "씨앗을 심고, 날짜가 지나면 자라며, 수확물이 아이템으로 들어오는 농사 규칙입니다.",
      }),
      renderLifePanel({
        testid: "db-crop-readiness",
        eyebrow: "플레이 연결",
        title: "농사 루프 준비 상태",
        description: "작물 레코드만으로는 자라지 않습니다. 시간, 경작 영역, 도구가 함께 준비되어야 합니다.",
        cards: [
          {
            testid: "db-crop-readiness-time",
            label: "시간·계절",
            value: timeReady ? "사용 중" : "설정 필요",
            detail: timeReady ? "날짜가 바뀌면 성장합니다." : "시스템에서 시간 기능을 켜세요.",
            state: timeReady ? "ready" : "needs-setup",
            action: {
              label: "시스템 열기",
              testid: "db-crop-readiness-time-action",
              onClick: (event) => openTab(event, "db-tab-system"),
            },
          },
          {
            testid: "db-crop-readiness-fields",
            label: "경작 가능한 맵",
            value: `${farmableMapCount}곳`,
            detail: farmableMapCount > 0 ? "맵의 경작 영역에서 심을 수 있습니다." : "맵 설정에 경작 영역이 필요합니다.",
            state: farmableMapCount > 0 ? "ready" : "needs-setup",
            data: { count: String(farmableMapCount) },
            action: {
              label: farmableMapCount > 0 ? "경작 맵 선택" : "시작 맵 선택",
              testid: "db-crop-readiness-fields-action",
              onClick: () => {
                const mapId = farmableMaps[0]?.id ?? project.startMapId;
                if (selectEditorMap(mapId)) toast(`맵 '${project.maps[mapId]?.name ?? mapId}'을 선택했습니다.`, "ok");
                else toast("이동할 맵을 찾을 수 없습니다.", "error");
              },
            },
          },
          {
            testid: "db-crop-readiness-tools",
            label: "기본 농사 도구",
            value: toolsReady ? "준비됨" : "확인 필요",
            detail: toolsReady ? "괭이와 물뿌리개가 등록되어 있습니다." : "아이템에서 괭이와 물뿌리개를 지정하세요.",
            state: toolsReady ? "ready" : "needs-setup",
            action: {
              label: "아이템 열기",
              testid: "db-crop-readiness-tools-action",
              onClick: (event) => openTab(event, "db-tab-items"),
            },
          },
          {
            testid: "db-crop-readiness-records",
            label: "작물 연결",
            value: invalidCrops.length > 0 ? `${invalidCrops.length}개 오류` : `${crops.length}개 사용 가능`,
            detail: invalidCrops.length > 0 ? "씨앗 또는 수확 아이템 연결을 확인하세요." : "모든 작물의 아이템 연결이 유효합니다.",
            state: invalidCrops.length > 0 || crops.length === 0 ? "needs-setup" : "ready",
            data: { invalid: String(invalidCrops.length), total: String(crops.length) },
            action: {
              label: invalidCrops.length > 0 ? "첫 오류 열기" : "작물 확인",
              testid: "db-crop-readiness-records-action",
              onClick: () => {
                selectedCropId = invalidCrops[0]?.id ?? crops[0]?.id;
                rerender();
              },
            },
          },
        ],
      }),
    ],
  });
}

function cropEmptyState(rerender: () => void): HTMLElement {
  return el("section", {
    class: "db-detail-form",
    dataset: { testid: "db-detail-form" },
    children: [
      el("div", {
        class: "empty-state empty-state--large empty-state--inset",
        dataset: { testid: "db-crop-empty" },
        children: [
          el("span", { class: "empty-state__icon", text: "芽", attrs: { "aria-hidden": "true" } }),
          el("h3", { class: "empty-state__title", text: "아직 작물이 없습니다" }),
          el("p", {
            class: "empty-state__desc",
            text: "첫 작물을 만든 뒤 씨앗·수확물·성장일·계절을 연결하면 농사 루프가 시작됩니다.",
          }),
          el("div", {
            class: "empty-state__actions",
            children: [
              el("button", {
                class: "empty-state__action empty-state__action--primary",
                text: "첫 작물 만들기",
                attrs: { type: "button" },
                dataset: { testid: "db-crop-empty-add" },
                on: { click: () => addCrop(rerender) },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function toolbar(rerender: () => void): HTMLElement {
  const add = el("button", {
    class: "db-toolbar-button",
    text: "+ 추가",
    attrs: { type: "button" },
    dataset: { testid: "db-crop-add" },
    on: {
      click: () => addCrop(rerender),
    },
  });
  const duplicate = el("button", {
    class: "db-toolbar-button",
    text: "복제",
    attrs: { type: "button" },
    dataset: { testid: "db-crop-duplicate" },
    on: {
      click: () => {
        const id = selectedCropId;
        if (!id) return;
        const copyId = genId("crop");
        recordProjectSnapshot();
        store.update((project) => {
          project.database.crops ??= [];
          duplicateInto(project.database.crops, id, copyId);
        }, { scope: "database", collection: "crops" });
        selectedCropId = copyId;
        rerender();
      },
    },
  });
  const remove = deleteCropButton(rerender);
  return el("div", { class: "db-toolbar", children: [add, duplicate, remove] });
}

function addCrop(rerender: () => void): void {
  const id = genId("crop");
  recordProjectSnapshot();
  store.update((project) => {
    project.database.crops ??= [];
    const firstItemId = project.database.items[0]?.id ?? "item_seed";
    project.database.crops.push(normalizeCropRecord({
      id,
      name: "새 작물",
      seedItemId: firstItemId,
      harvestItemId: firstItemId,
      stages: [{ days: 1 }],
      seasons: ["spring"],
    }));
  }, { scope: "database", collection: "crops" });
  selectedCropId = id;
  rerender();
}

// 다른 레코드 탭과 동일한 2단계 확인 패턴(작물은 DatabaseCollection 밖이라 공용
// deleteButton을 그대로 재사용할 수 없어 이 뷰에서 같은 계약을 재현한다).
// 참조 가드(cropReferenceMessage)는 항상 null — 농사 플롯은 런타임 세이브 전용 필드라
// 정적 DB에서 검사할 대상이 없다(databaseReferences.ts 주석 참조).
function deleteCropButton(rerender: () => void): HTMLElement {
  let armedId: string | null = null;
  let armedUntil = 0;
  let resetTimer: number | null = null;

  const button = el("button", {
    class: "db-toolbar-button danger",
    text: DELETE_IDLE_LABEL,
    attrs: { type: "button" },
    dataset: { testid: "db-crop-delete" },
    on: {
      click: () => {
        const id = selectedCropId;
        if (!id) return;

        const blockedMessage = cropReferenceMessage(id);
        if (blockedMessage) {
          toast(blockedMessage, "error");
          return;
        }

        const now = Date.now();
        const isArmed = armedId === id && now <= armedUntil;
        if (!isArmed) {
          armedId = id;
          armedUntil = now + DELETE_CONFIRM_WINDOW_MS;
          button.textContent = DELETE_CONFIRM_LABEL;
          button.classList.add("confirming");
          if (resetTimer !== null) window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            resetTimer = null;
            if (Date.now() >= armedUntil) {
              armedId = null;
              button.textContent = DELETE_IDLE_LABEL;
              button.classList.remove("confirming");
            }
          }, DELETE_CONFIRM_WINDOW_MS + 100);
          return;
        }

        armedId = null;
        armedUntil = 0;
        button.textContent = DELETE_IDLE_LABEL;
        button.classList.remove("confirming");
        recordProjectSnapshot();
        store.update((project) => {
          project.database.crops = (project.database.crops ?? []).filter((record) => record.id !== id);
        }, { scope: "database", collection: "crops" });
        selectedCropId = undefined;
        toast("삭제했습니다 — Ctrl+Z로 되돌릴 수 있습니다.", "ok");
        rerender();
      },
    },
  });
  return button;
}

function cropForm(record: CropRecord, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const form = el("section", { class: "db-detail-form oprn-detail-form", dataset: { testid: "db-detail-form" } });
  form.append(
    el("div", { class: "db-record-id", children: [el("span", { text: "ID" }), el("code", { text: record.id })] }),
    cropOverview(record),
    textControl("이름", record.name, (name) => updateCrop(record.id, { name }), "db-crop-name"),
    selectField("씨앗 아이템", "db-crop-seed-item", record.seedItemId, project.database.items, (seedItemId) => updateCrop(record.id, { seedItemId })),
    selectField("수확 아이템", "db-crop-harvest-item", record.harvestItemId, project.database.items, (harvestItemId) => updateCrop(record.id, { harvestItemId })),
    numberField("수확 수량", "db-crop-harvest-count", record.harvestCount, (harvestCount) => updateCrop(record.id, { harvestCount })),
    stagesField(record),
    seasonsField(record, rerender),
    numberField("재수확 대기일(0=없음)", "db-crop-regrow-days", record.regrow?.days ?? 0, (days) => {
      updateCrop(record.id, { regrow: days > 0 ? { days } : undefined });
    }),
    graphicStagesField(record)
  );
  return form;
}

function cropOverview(record: CropRecord): HTMLElement {
  const growthDays = record.stages.reduce((total, stage) => total + stage.days, 0);
  return renderLifePanel({
    testid: "db-crop-overview",
    eyebrow: "플레이 결과",
    title: record.name || "이름 없는 작물",
    description: "현재 설정으로 플레이어가 경험하는 재배 흐름입니다.",
    compact: true,
    cards: [
      {
        testid: "db-crop-overview-growth",
        label: "첫 수확까지",
        value: `${growthDays}일`,
        detail: `${record.stages.length}단계 성장`,
        data: { days: String(growthDays), stages: String(record.stages.length) },
      },
      {
        testid: "db-crop-overview-yield",
        label: "한 번 수확",
        value: `${record.harvestCount}개`,
        detail: "수확 아이템 지급량",
        data: { count: String(record.harvestCount) },
      },
      {
        testid: "db-crop-overview-seasons",
        label: "재배 계절",
        value: `${record.seasons.length}계절`,
        detail: record.seasons.join(" · "),
        data: { count: String(record.seasons.length) },
      },
      {
        testid: "db-crop-overview-regrow",
        label: "재수확",
        value: record.regrow ? `${record.regrow.days}일마다` : "한 번만",
        detail: record.regrow ? "수확 후 다시 열립니다." : "수확하면 밭이 비워집니다.",
        data: { days: String(record.regrow?.days ?? 0) },
      },
    ],
  });
}

function stagesField(record: CropRecord): HTMLElement {
  const textarea = el("textarea", {
    value: record.stages.map((stage) => String(stage.days)).join("\n"),
    attrs: { rows: "4" },
    dataset: { testid: "db-crop-stages" },
  }) as HTMLTextAreaElement;
  textarea.addEventListener("change", () => updateCrop(record.id, { stages: parseStages(textarea.value) }));
  return el("label", { class: "db-field", children: [el("span", { text: "단계 소요일" }), textarea] });
}

function seasonsField(record: CropRecord, rerender: () => void): HTMLElement {
  const controls = SEASONS.map((season) => {
    const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid: `db-crop-season-${season}` } }) as HTMLInputElement;
    input.checked = record.seasons.includes(season);
    input.addEventListener("input", () => {
      const current = store.getCurrent().database.crops?.find((crop) => crop.id === record.id) ?? record;
      const seasons = new Set(current.seasons);
      if (input.checked) seasons.add(season);
      else seasons.delete(season);
      updateCrop(record.id, { seasons: [...seasons] });
      // normalizeCropRecord가 계절 전체 해제 시 "봄"으로 강제 복원한다(빈 계절 방지).
      // 이 복원은 화면에 자동 반영되지 않으므로(폼이 다시 그려지지 않음) 명시적으로
      // rerender해 체크박스 상태를 실제 저장값과 동기화한다.
      rerender();
    });
    return el("label", { class: "db-checkbox-field", children: [input, el("span", { text: season })] });
  });
  return el("div", { class: "db-item-choice-list", children: [el("strong", { text: "계절" }), ...controls] });
}

function graphicStagesField(record: CropRecord): HTMLElement {
  const textarea = el("textarea", {
    value: (record.graphicStages ?? []).map(formatGraphicStage).join("\n"),
    attrs: { rows: "4" },
    dataset: { testid: "db-crop-graphic-stages" },
  }) as HTMLTextAreaElement;
  textarea.addEventListener("change", () => updateCrop(record.id, { graphicStages: parseGraphicStages(textarea.value) }));
  return el("label", {
    class: "db-field",
    children: [
      el("span", { text: "그래픽 단계" }),
      textarea,
      el("small", { text: "한 줄: resourceId | frame | label. 비우면 단계 번호 배지로 표시합니다." }),
    ],
  });
}

function updateCrop(id: string, patch: Partial<CropRecord>): void {
  recordCoalescedSnapshot(`db-crop:${id}:${Object.keys(patch).sort().join(",")}`);
  store.update((project) => {
    const records = project.database.crops ?? [];
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return;
    records[index] = normalizeCropRecord({ ...records[index], ...patch });
    project.database.crops = records;
  }, { scope: "database", collection: "crops" });
}

function parseStages(value: string): CropRecord["stages"] {
  const stages = value
    .split(/\r?\n/)
    .flatMap((line): CropRecord["stages"] => {
      const days = parseInt(line.trim(), 10);
      return Number.isFinite(days) && days > 0 ? [{ days }] : [];
    });
  return stages.length > 0 ? stages : [{ days: 1 }];
}

function formatGraphicStage(stage: CropGraphicStage): string {
  return [stage.resourceId ?? "", stage.frame ?? "", stage.label ?? ""].join(" | ");
}

function parseGraphicStages(value: string): CropGraphicStage[] {
  return value
    .split(/\r?\n/)
    .flatMap((line): CropGraphicStage[] => {
      const [resourceId, frame, label] = line.split("|").map((part) => part.trim());
      if (!resourceId && !frame && !label) return [];
      return [{
        ...(resourceId ? { resourceId } : {}),
        ...(frame ? { frame } : {}),
        ...(label ? { label } : {}),
      }];
    });
}
