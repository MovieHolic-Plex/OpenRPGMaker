// 마을 탭 — 마을 하네스가 읽는 값을 사람이 저작하는 화면.
//
// 이 탭이 없던 동안 마을 생성의 모든 값(집 형태 34종, 길 폭, 광장 모양, 마당 스타일…)은
// 코드 상수였고, 사용자가 바꿀 수 있는 자리가 없었다. AI 도 코드 요약만 읽었으므로
// "내가 정한 대로 깔아 줘" 가 성립하지 않았다.
//
// 여기서 만든 레코드는 project.villageTemplates / villagePresets 에 저장되고
//   1) `village/authoringData.ts` 가 시공 직전에 읽어 코드 기본값을 덮고,
//   2) `ai/contextBuilder.ts` 가 시스템 프롬프트에 실어 모델이 id 로 지목할 수 있게 한다.
// 그래서 select 의 선택지는 `authoringData.ts` 의 열거형 상수를 그대로 쓴다 — 화면에서
// 고를 수 있는 값과 하네스가 받아들이는 값이 갈라지면 조용히 무시되기 때문이다.

import { field, selectField, textField } from "@/editor/panels/databaseControls";
import {
  blankPresetRecord,
  blankTemplateRecord,
  duplicatePresetRecord,
  duplicateTemplateRecord,
  footprintTileCount,
  nextVillageId,
  presetRecordFromArchetype,
  templateFootprint,
  templateRecordFromDef,
  tightenTemplateBounds,
} from "@/editor/panels/databaseVillageModel";
import {
  detailHero,
  detailPane,
  emptyState,
  listPane,
  listRow,
  listSearch,
  listToolbar,
  noticeBar,
  sectionCard,
  statStrip,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { ALL_HOUSE_KIT_IDS, HOUSE_KITS, MIXABLE_HOUSE_KIT_IDS } from "@/editor/houseKit";
import {
  VILLAGE_ARCHETYPES,
  VILLAGE_EDGE_TREE_STYLES,
  VILLAGE_GROUND_THEME_IDS,
  VILLAGE_LAYOUT_IDS,
  VILLAGE_PATH_STYLES,
  VILLAGE_PLAZA_LAYOUTS,
  VILLAGE_PLAZA_STYLES,
  VILLAGE_RANGE,
  VILLAGE_YARD_STYLES,
  minWingRun,
  presetOverrides,
  templateFromRecord,
  villageArchetypeById,
  villageTemplateCatalog,
  type VillageArchetype,
} from "@/editor/tools/village/authoringData";
import { HOUSE_TEMPLATE_DEFS } from "@/project/defaults/houseTemplateCatalog";
import { store } from "@/project/store";
import type { Project, VillageHouseTemplateRecord, VillageLayoutPresetRecord } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import "@/styles/database/modern/village.css";

type VillageKind = "template" | "preset";

const KIND_LABEL: Readonly<Record<VillageKind, string>> = { template: "집 형태", preset: "배치 프리셋" };

// 사용자에게 보여줄 한국어 이름. 값(=하네스가 받는 문자열)은 그대로 저장한다.
const PATH_LABEL: Readonly<Record<string, string>> = { sand: "모래길", dirt: "흙길", stone: "돌길" };
const YARD_LABEL: Readonly<Record<string, string>> = {
  mixed: "섞기", garden: "텃밭", workshop: "작업장", market: "노점", minimal: "최소",
};
const PLAZA_STYLE_LABEL: Readonly<Record<string, string>> = { market: "장터", garden: "정원", empty: "빈터" };
const PLAZA_LAYOUT_LABEL: Readonly<Record<string, string>> = {
  center: "가운데", north: "북쪽", south: "남쪽", west: "서쪽", east: "동쪽",
};
const EDGE_TREE_LABEL: Readonly<Record<string, string>> = { conifer: "침엽수", dense: "빽빽하게", none: "없음" };
const LAYOUT_LABEL: Readonly<Record<string, string>> = {
  "plaza-ring": "광장 둘레", "street-grid": "격자 길", clusters: "덩어리",
};
const GROUND_LABEL: Readonly<Record<string, string>> = { grass: "풀", snow: "눈" };

const UNSET = "";

let selectedKind: VillageKind = "template";
let selectedTemplateId = "";
let selectedPresetId = "";
let villageSearch = "";

export function renderVillageTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const templates = project.villageTemplates ?? [];
  const presets = project.villagePresets ?? [];
  if (!templates.some((record) => record.id === selectedTemplateId)) selectedTemplateId = templates[0]?.id ?? "";
  if (!presets.some((record) => record.id === selectedPresetId)) selectedPresetId = presets[0]?.id ?? "";

  const list = listPane({
    title: "마을 저작",
    count: selectedKind === "template" ? templates.length : presets.length,
    search: listSearch({
      placeholder: "이름 또는 ID 검색",
      value: villageSearch,
      testid: "db-village-search",
      onInput: (value) => { villageSearch = value; rerender(); },
    }),
    chips: kindChips(templates.length, presets.length, rerender),
    rows: selectedKind === "template" ? templateRows(templates, rerender) : presetRows(presets, rerender),
    empty: listEmpty(templates.length, presets.length, rerender),
    toolbar: kindToolbar(templates, presets, rerender),
    testid: "db-village-list-pane",
  });

  const detail = selectedKind === "template"
    ? templateDetail(project, templates, rerender)
    : presetDetail(project, presets, rerender);

  host.append(workspaceShell({ list, detail, legacyClass: "db-village-workspace", testid: "db-village-workspace" }));
}

// ---------------------------------------------------------------------------
// 목록 창
// ---------------------------------------------------------------------------

function kindChips(templateCount: number, presetCount: number, rerender: () => void): HTMLElement {
  const counts: Record<VillageKind, number> = { template: templateCount, preset: presetCount };
  return el("div", {
    class: "db-village-chips",
    attrs: { role: "tablist", "aria-label": "마을 저작 분류" },
    dataset: { testid: "db-village-kinds" },
    children: (["template", "preset"] as const).map((kind) => el("button", {
      class: `db-village-chip${kind === selectedKind ? " active" : ""}`,
      attrs: { type: "button", role: "tab", "aria-selected": kind === selectedKind ? "true" : "false" },
      dataset: { testid: `db-village-kind-${kind}` },
      on: {
        click: () => {
          if (kind === selectedKind) return;
          selectedKind = kind;
          villageSearch = "";
          rerender();
        },
      },
      children: [
        el("span", { class: "db-village-chip-label", text: KIND_LABEL[kind] }),
        el("span", { class: "db-village-chip-count", text: String(counts[kind]) }),
      ],
    })),
  });
}

/** 내장과 id 가 겹치는 레코드는 「더하기」가 아니라 「덮기」다 — 목록에서 구분돼야 한다. */
function overridesBuiltIn(id: string): boolean {
  return HOUSE_TEMPLATE_DEFS.some((def) => def.id === id);
}

function templateRows(records: readonly VillageHouseTemplateRecord[], rerender: () => void): HTMLElement[] {
  const query = villageSearch.trim().toLowerCase();
  return records.flatMap((record, index) => {
    if (query && !matches(record.name, record.id, query)) return [];
    const resolved = templateFromRecord(record);
    const override = overridesBuiltIn(record.id);
    const marks = [`${record.w}×${record.h}`];
    if (override) marks.push("내장 덮음");
    if ("reason" in resolved) marks.push("규약 위반");
    const titleParts = [record.id];
    if (override) titleParts.push(`내장 “${record.id}” 을 이 레코드가 대체합니다`);
    if ("reason" in resolved) titleParts.push(resolved.reason);
    return [listRow({
      name: record.name || record.id,
      sub: marks.join(" · "),
      number: index + 1,
      active: record.id === selectedTemplateId,
      title: titleParts.join(" · "),
      testid: `db-village-template-row-${record.id}`,
      dataset: {
        villageTemplateId: record.id,
        valid: "reason" in resolved ? "false" : "true",
        villageOverride: override ? "true" : "false",
      },
      onSelect: () => { selectedTemplateId = record.id; rerender(); },
    })];
  });
}

function presetRows(records: readonly VillageLayoutPresetRecord[], rerender: () => void): HTMLElement[] {
  const query = villageSearch.trim().toLowerCase();
  return records.flatMap((record, index) => {
    if (query && !matches(record.name, record.id, query)) return [];
    const applied = Object.keys(presetOverrides(record)).length;
    return [listRow({
      name: record.name || record.id,
      sub: applied > 0 ? `${applied}개 값` : "빈 프리셋",
      number: index + 1,
      active: record.id === selectedPresetId,
      title: record.id,
      testid: `db-village-preset-row-${record.id}`,
      dataset: { villagePresetId: record.id },
      onSelect: () => { selectedPresetId = record.id; rerender(); },
    })];
  });
}

function listEmpty(templateCount: number, presetCount: number, rerender: () => void): HTMLElement {
  const count = selectedKind === "template" ? templateCount : presetCount;
  if (villageSearch.trim() && count > 0) {
    return emptyState({
      icon: "⌕",
      title: "검색 결과가 없습니다",
      body: `“${villageSearch}”와 일치하는 항목이 없습니다.`,
      compact: true,
      testid: "db-village-list-empty",
    });
  }
  return emptyState({
    icon: "＋",
    title: selectedKind === "template" ? "내가 만든 집 형태가 없습니다" : "배치 프리셋이 없습니다",
    body: selectedKind === "template"
      ? "내장 34종은 그대로 쓰이고, 여기서 만든 형태가 더해집니다."
      : "프리셋을 만들면 AI 에게 “이 프리셋으로 깔아 줘”라고 지시할 수 있습니다.",
    compact: true,
    action: {
      label: "+ 추가",
      kind: "primary",
      testid: "db-village-empty-create",
      onClick: () => createRecord(rerender),
    },
    testid: "db-village-list-empty",
  });
}

function kindToolbar(
  templates: readonly VillageHouseTemplateRecord[],
  presets: readonly VillageLayoutPresetRecord[],
  rerender: () => void,
): HTMLElement {
  const hasSelection = selectedKind === "template" ? selectedTemplateId !== "" : selectedPresetId !== "";
  return listToolbar([
    { label: "+ 추가", kind: "primary", testid: "db-village-create", onClick: () => createRecord(rerender) },
    {
      label: "복제",
      testid: "db-village-duplicate",
      disabled: !hasSelection,
      onClick: () => duplicateRecord(templates, presets, rerender),
    },
    {
      label: "삭제",
      kind: "danger",
      testid: "db-village-delete",
      disabled: !hasSelection,
      title: selectedKind === "preset" ? "이 프리셋을 가리키는 지시는 코드 기본값으로 시공됩니다" : undefined,
      onClick: () => deleteRecord(rerender),
    },
  ]);
}

// ---------------------------------------------------------------------------
// 집 형태 상세
// ---------------------------------------------------------------------------

function templateDetail(
  project: Project,
  records: readonly VillageHouseTemplateRecord[],
  rerender: () => void,
): HTMLElement {
  const record = records.find((entry) => entry.id === selectedTemplateId);
  if (!record) {
    return detailPane({
      body: emptyState({
        icon: "⌂",
        title: "집 형태를 만들어 보세요",
        body: "내장 형태를 복제해서 시작하면 규약을 어길 일이 없습니다. 폭 3~8칸, 높이 4~24칸 안에서 날개를 붙입니다.",
        action: { label: "내장에서 복제", kind: "primary", testid: "db-village-clone-builtin", onClick: () => cloneBuiltIn("rect-large", rerender) },
        testid: "db-village-template-blank",
      }),
      testid: "db-village-detail-pane",
    });
  }

  const resolved = templateFromRecord(record);
  const invalid = "reason" in resolved ? resolved.reason : undefined;
  const catalog = villageTemplateCatalog(project);
  const kitName = record.kitId ? HOUSE_KITS[record.kitId as keyof typeof HOUSE_KITS]?.name ?? record.kitId : "프리셋/씨앗값이 고름";
  const override = overridesBuiltIn(record.id);
  // 레코드 수와 후보 수만 보면 "34 인데 왜 안 늘었지" 를 알 수 없다 — 덮은 것과 더한 것을 따로 센다.
  const overrideCount = records.filter((entry) => overridesBuiltIn(entry.id)).length;
  const addedCount = records.length - overrideCount;

  return detailPane({
    hero: detailHero({
      eyebrow: "집 형태",
      title: record.name || record.id,
      subtitle: invalid
        ? `규약 위반: ${invalid}`
        : override
          ? `내장 “${record.id}” 을 이 레코드가 대체합니다. AI 가 같은 id 를 써도 여기 값으로 시공됩니다.`
          : "시공에 바로 쓰입니다. AI 는 housePlans[].templateId 로 이 id 를 지목합니다.",
      tags: [
        record.id,
        `${record.w}×${record.h}`,
        `${footprintTileCount(record)}칸`,
        kitName,
        ...(override ? ["내장 덮음"] : []),
      ],
      media: footprintPreview(record),
      testid: "db-village-template-hero",
    }),
    body: [
      statStrip([
        { label: "내장에 더함", value: String(addedCount), hint: `내장 ${HOUSE_TEMPLATE_DEFS.length}종에 새로 더한 형태`, tone: "good" },
        {
          label: "내장 덮음",
          value: String(overrideCount),
          hint: overrideCount > 0 ? "내장과 id 가 같아 대체됩니다" : "내장과 같은 ID 를 쓰면 여기로 셉니다",
          tone: overrideCount > 0 ? "warn" : "neutral",
          testid: "db-village-template-override-count",
        },
        { label: "시공 후보", value: String(catalog.templates.length), hint: `내장 ${HOUSE_TEMPLATE_DEFS.length} + 더함 ${addedCount}` },
        {
          label: "규약 검사",
          value: invalid ? "위반" : "통과",
          hint: invalid ?? "이 형태는 시공에 쓰입니다",
          tone: invalid ? "bad" : "good",
          testid: "db-village-template-validity",
        },
      ], { testid: "db-village-template-stats" }),
      el("div", {
        class: "db-ws-stack db-village-inspector",
        children: [
          ...(invalid
            ? [span(noticeBar({
              text: `이 형태는 시공에서 건너뜁니다 — ${invalid}`,
              tone: "bad",
              testid: "db-village-template-warning",
            }))]
            : []),
          sectionCard({
            title: "기본 정보",
            hint: "ID 는 AI 가 지목하는 이름입니다",
            children: templateBasicFields(record, records, rerender),
            testid: "db-village-template-basics",
          }),
          sectionCard({
            title: "크기와 재료",
            hint: "폭 3~8 · 높이 4~24칸",
            children: templateSizeFields(record, rerender),
            testid: "db-village-template-size",
          }),
          span(sectionCard({
            title: "날개",
            hint: "바운딩 박스 안에 붙이는 직사각형들. 합집합이 집 바닥이 됩니다",
            children: templateWingFields(record, rerender),
            testid: "db-village-template-wings",
          })),
          sectionCard({
            title: "내장 형태에서 값 가져오기",
            hint: "값을 베껴 옵니다 — 이후 내장이 바뀌어도 따라 변하지 않습니다",
            children: builtInImportFields(record, rerender),
            testid: "db-village-template-import",
          }),
        ],
      }),
    ],
    testid: "db-village-detail-pane",
  });
}

function templateBasicFields(
  record: VillageHouseTemplateRecord,
  records: readonly VillageHouseTemplateRecord[],
  rerender: () => void,
): HTMLElement[] {
  const idInput = el("input", {
    attrs: { type: "text", spellcheck: "false" },
    value: record.id,
    dataset: { testid: "db-village-template-id" },
  }) as HTMLInputElement;
  idInput.addEventListener("change", () => {
    const next = idInput.value.trim();
    if (next === record.id) return;
    if (!next) { toast("ID 는 비워둘 수 없습니다.", "error"); idInput.value = record.id; return; }
    if (records.some((entry) => entry.id === next)) {
      toast(`이미 쓰는 ID 입니다: ${next}`, "error");
      idInput.value = record.id;
      return;
    }
    recordProjectSnapshot("집 형태 ID 변경");
    patchTemplate(record.id, () => ({ id: next }));
    renamePresetReferences(record.id, next);
    selectedTemplateId = next;
    rerender();
  });

  return [
    textField("이름", "db-village-template-name", record.name, (value) => {
      recordCoalescedSnapshot(`village-template-name:${record.id}`, "집 형태 이름 변경");
      patchTemplate(record.id, () => ({ name: value }));
      updateVisibleName(`db-village-template-row-${record.id}`, value || record.id);
    }),
    field("ID", idInput),
    textField("메모", "db-village-template-note", record.note ?? "", (value) => {
      recordCoalescedSnapshot(`village-template-note:${record.id}`, "집 형태 메모 변경");
      patchTemplate(record.id, () => (value.trim() ? { note: value } : { note: undefined }));
    }),
    el("p", {
      class: "db-ws-usage",
      dataset: { testid: "db-village-template-id-usage" },
      text: overridesBuiltIn(record.id)
        // 이 문장이 "덮는 중" 과 "덮을 수 있음" 을 섞으면 사용자는 지금 상태를 알 수 없다.
        ? `지금 이 ID 는 내장 형태 “${record.id}” 와 같습니다 — 내장 대신 이 레코드가 시공됩니다. ID 를 바꾸면 내장이 되살아나고 이 형태는 따로 더해집니다.`
        : record.clonedFrom
          ? `내장 “${record.clonedFrom}” 에서 복제했습니다. ID 가 달라서 내장에 더해집니다 — ID 를 “${record.clonedFrom}” 로 바꾸면 내장을 덮어씁니다.`
          : "내장과 같은 ID 를 쓰면 내장 형태를 덮어씁니다. 다른 ID 면 카탈로그에 더해집니다.",
    }),
  ];
}

function templateSizeFields(record: VillageHouseTemplateRecord, rerender: () => void): HTMLElement[] {
  const { templateW, templateH } = VILLAGE_RANGE;
  // 빈 값 항목은 `baseSelect` 가 넣는다 — 여기서 또 넣으면 값이 같은 항목이 둘이 된다.
  const kitOptions = ALL_HOUSE_KIT_IDS.map((id) => ({ id, name: HOUSE_KITS[id].name }));
  return [
    requiredNumber("폭 (칸)", "db-village-template-w", record.w, templateW, (value) => {
      recordCoalescedSnapshot(`village-template-w:${record.id}`, "집 형태 폭 변경");
      patchTemplate(record.id, () => ({ w: value }));
      rerender();
    }),
    requiredNumber("높이 (칸)", "db-village-template-h", record.h, templateH, (value) => {
      recordCoalescedSnapshot(`village-template-h:${record.id}`, "집 형태 높이 변경");
      patchTemplate(record.id, () => ({ h: value }));
      rerender();
    }),
    selectField("층수", "db-village-template-stories", String(record.stories ?? 1), [
      { id: "1", name: "1층" },
      { id: "2", name: "2층" },
      { id: "3", name: "3층" },
    ], (value) => {
      recordProjectSnapshot("집 형태 층수 변경");
      patchTemplate(record.id, () => ({ stories: Number(value) === 3 ? 3 : Number(value) === 2 ? 2 : 1 }));
      rerender();
    }),
    selectField("재료 킷", "db-village-template-kit", record.kitId ?? UNSET, kitOptions, (value) => {
      recordProjectSnapshot("집 형태 재료 킷 변경");
      patchTemplate(record.id, () => ({ kitId: value === UNSET ? undefined : value }));
      rerender();
    }),
    checkboxField("낮은 벽", "db-village-template-low-wall", record.lowWall === true, "벽 밴드를 한 단 낮춘다", (checked) => {
      recordProjectSnapshot("집 형태 낮은 벽 변경");
      patchTemplate(record.id, () => ({ lowWall: checked ? true : undefined }));
      rerender();
    }),
    checkboxField("옥상", "db-village-template-roof-deck", record.roofDeck === true, "지붕 대신 올라갈 수 있는 옥상", (checked) => {
      recordProjectSnapshot("집 형태 옥상 변경");
      patchTemplate(record.id, () => ({ roofDeck: checked ? true : undefined }));
      rerender();
    }),
  ];
}

function templateWingFields(record: VillageHouseTemplateRecord, rerender: () => void): HTMLElement[] {
  const wings = record.wings ?? [];
  const rows = wings.map((wing, index) => el("div", {
    class: "db-village-wing-row",
    dataset: { testid: `db-village-wing-${index}` },
    children: [
      el("span", { class: "db-village-wing-index", text: `#${index + 1}` }),
      wingNumber("x", index, wing.x, record, rerender),
      wingNumber("y", index, wing.y, record, rerender),
      wingNumber("w", index, wing.w, record, rerender),
      wingNumber("h", index, wing.h, record, rerender),
      el("button", {
        class: "db-ws-btn db-ws-btn-danger",
        text: "삭제",
        attrs: { type: "button", ...(wings.length <= 1 ? { disabled: "true" } : {}), title: "이 날개를 지웁니다" },
        dataset: { testid: `db-village-wing-delete-${index}` },
        on: {
          click: () => {
            recordProjectSnapshot("날개 삭제");
            patchTemplate(record.id, (current) => ({ wings: (current.wings ?? []).filter((_, at) => at !== index) }));
            rerender();
          },
        },
      }),
    ],
  }));

  return [
    el("div", { class: "db-village-wing-list", dataset: { testid: "db-village-wings" }, children: rows }),
    el("div", {
      class: "db-village-wing-actions",
      children: [
        el("button", {
          class: "db-ws-btn db-ws-btn-ghost",
          text: "+ 날개 추가",
          attrs: { type: "button" },
          dataset: { testid: "db-village-wing-add" },
          on: {
            click: () => {
              recordProjectSnapshot("날개 추가");
              patchTemplate(record.id, (current) => ({
                // 새 날개는 규약을 통과하는 최소 크기로 시작한다 — 「추가」를 누른 순간
                // 위반 배지가 뜨면 사용자는 무엇을 고쳐야 하는지 모른다.
                wings: [...(current.wings ?? []), {
                  x: 0,
                  y: 0,
                  w: Math.min(current.w, VILLAGE_RANGE.wingW.min),
                  h: Math.min(current.h, minWingRun(current)),
                }],
              }));
              rerender();
            },
          },
        }),
        el("button", {
          class: "db-ws-btn db-ws-btn-ghost",
          text: "박스 맞추기",
          attrs: { type: "button", title: "빈 줄·열을 없애고 바운딩 박스를 날개 합집합에 맞춥니다" },
          dataset: { testid: "db-village-wing-tighten" },
          on: {
            click: () => {
              recordProjectSnapshot("바운딩 박스 맞추기");
              patchTemplate(record.id, (current) => {
                const tight = tightenTemplateBounds(current);
                return { w: tight.w, h: tight.h, wings: tight.wings };
              });
              rerender();
            },
          },
        }),
      ],
    }),
    footprintPreview(record, { large: true }),
    el("p", {
      class: "db-ws-usage",
      // 하한을 문장에 손으로 박으면 규약이 바뀔 때 화면만 거짓말을 한다 — 상수에서 뽑는다.
      text: `좌표는 집 왼쪽 위를 (0,0) 으로 하는 상대 좌표입니다. 날개는 최소 ${VILLAGE_RANGE.wingW.min}×${VILLAGE_RANGE.wingH.min}칸이고 바운딩 박스를 넘을 수 없습니다. 세로로는 한 열이 이어서 ${minWingRun(record)}칸 이상이어야 벽과 지붕이 들어갑니다.`,
    }),
  ];
}

function wingNumber(
  axis: "x" | "y" | "w" | "h",
  index: number,
  value: number,
  record: VillageHouseTemplateRecord,
  rerender: () => void,
): HTMLElement {
  const label: Record<typeof axis, string> = { x: "x", y: "y", w: "폭", h: "높이" };
  const min = axis === "w" ? VILLAGE_RANGE.wingW.min : axis === "h" ? VILLAGE_RANGE.wingH.min : 0;
  const input = el("input", {
    attrs: { type: "number", min: String(min), step: "1" },
    value,
    dataset: { testid: `db-village-wing-${index}-${axis}` },
  }) as HTMLInputElement;
  const commit = (): void => {
    const next = Math.max(0, Math.trunc(Number(input.value)) || 0);
    recordCoalescedSnapshot(`village-wing:${record.id}:${index}:${axis}`, "날개 좌표 변경");
    patchTemplate(record.id, (current) => ({
      wings: (current.wings ?? []).map((wing, at) => (at === index ? { ...wing, [axis]: next } : wing)),
    }));
    rerender();
  };
  input.addEventListener("change", commit);
  return el("label", {
    class: "db-village-wing-field",
    children: [el("span", { text: label[axis] }), input],
  });
}

/** 날개 합집합을 격자로 그린다 — 숫자만 보고는 L 자인지 ㄷ 자인지 알 수 없다. */
function footprintPreview(record: VillageHouseTemplateRecord, options: { readonly large?: boolean } = {}): HTMLElement {
  const grid = templateFootprint(record);
  const width = grid[0]?.length ?? 0;
  const host = el("div", {
    class: `db-village-footprint${options.large ? " db-village-footprint-large" : ""}`,
    attrs: { role: "img", "aria-label": `${record.name || record.id} 바닥 ${record.w}×${record.h}칸` },
    dataset: { testid: options.large ? "db-village-footprint-large" : "db-village-footprint" },
    children: grid.flatMap((row) => row.map((filled) => el("span", {
      class: `db-village-cell${filled ? " is-filled" : ""}`,
    }))),
  });
  host.style.setProperty("--db-village-cols", String(Math.max(1, width)));
  return host;
}

function builtInImportFields(record: VillageHouseTemplateRecord, rerender: () => void): HTMLElement[] {
  const select = el("select", { dataset: { testid: "db-village-import-source" } }) as HTMLSelectElement;
  for (const def of HOUSE_TEMPLATE_DEFS) {
    select.append(el("option", { attrs: { value: def.id }, text: `${def.name} (${def.w}×${def.h}) · ${def.id}` }));
  }
  select.value = record.clonedFrom ?? HOUSE_TEMPLATE_DEFS[0]!.id;
  return [
    field("내장 형태", select),
    el("div", {
      class: "db-village-wing-actions",
      children: [el("button", {
        class: "db-ws-btn db-ws-btn-ghost",
        text: "값 가져오기",
        attrs: { type: "button" },
        dataset: { testid: "db-village-import-apply" },
        on: {
          click: () => {
            const def = HOUSE_TEMPLATE_DEFS.find((entry) => entry.id === select.value);
            if (!def) return;
            recordProjectSnapshot("내장 형태 값 가져오기");
            const baked = templateRecordFromDef(def, record.id, record.name);
            patchTemplate(record.id, () => ({
              w: baked.w,
              h: baked.h,
              stories: baked.stories,
              lowWall: baked.lowWall,
              kitId: baked.kitId,
              roofDeck: baked.roofDeck,
              wings: baked.wings,
              clonedFrom: def.id,
            }));
            toast(`“${def.name}” 값을 가져왔습니다.`, "ok");
            rerender();
          },
        },
      })],
    }),
  ];
}

// ---------------------------------------------------------------------------
// 배치 프리셋 상세
// ---------------------------------------------------------------------------

function presetDetail(
  project: Project,
  records: readonly VillageLayoutPresetRecord[],
  rerender: () => void,
): HTMLElement {
  const record = records.find((entry) => entry.id === selectedPresetId);
  if (!record) {
    return detailPane({
      body: [
        emptyState({
          icon: "⌖",
          title: "배치 프리셋을 만들어 보세요",
          body: "길 폭·광장 모양·마당 스타일 같은 값을 한 묶음으로 저장합니다. AI 에게 “이 프리셋으로 마을 깔아 줘”라고 하면 그대로 쓰입니다.",
          action: { label: "+ 빈 프리셋 추가", kind: "primary", testid: "db-village-preset-blank-create", onClick: () => createRecord(rerender) },
          testid: "db-village-preset-blank",
        }),
        el("div", {
          class: "db-ws-stack db-village-inspector",
          children: [span(sectionCard({
            title: "마을 원형에서 시작하기",
            hint: "AI 가 테마 문장으로 고르던 값 묶음. 골라서 프리셋으로 굽습니다",
            children: archetypeGallery(rerender),
            testid: "db-village-archetype-gallery",
          }))],
        }),
      ],
      testid: "db-village-detail-pane",
    });
  }

  const applied = presetOverrides(record);
  const catalog = villageTemplateCatalog(project, applied.templateIds);
  return detailPane({
    hero: detailHero({
      eyebrow: "배치 프리셋",
      title: record.name || record.id,
      subtitle: "author_village 의 presetId 로 지정됩니다. 문장에서 직접 말한 값이 프리셋보다 우선합니다.",
      tags: [
        record.id,
        `${Object.keys(applied).length}개 값 적용`,
        applied.settlementLayout ? LAYOUT_LABEL[applied.settlementLayout] ?? applied.settlementLayout : "배치 자동",
      ],
      testid: "db-village-preset-hero",
    }),
    body: [
      statStrip([
        { label: "적용되는 값", value: String(Object.keys(applied).length), hint: "범위·열거형을 통과한 값만", tone: "good" },
        { label: "형태 후보", value: String(catalog.templates.length), hint: applied.templateIds ? "화이트리스트 적용" : "카탈로그 전체" },
        {
          label: "집 수",
          value: applied.houseCount === undefined ? "자동" : String(applied.houseCount),
          hint: applied.houseCount === undefined ? "맵 넓이로 정함" : "이 프리셋이 정함",
        },
      ], { testid: "db-village-preset-stats" }),
      el("div", {
        class: "db-ws-stack db-village-inspector",
        children: [
          ...(catalog.warnings.length > 0
            ? [span(noticeBar({
              text: catalog.warnings.join(" / "),
              tone: "warn",
              testid: "db-village-preset-warning",
            }))]
            : []),
          sectionCard({
            title: "기본 정보",
            hint: "ID 는 AI 가 지목하는 이름입니다",
            children: presetBasicFields(record, records, rerender),
            testid: "db-village-preset-basics",
          }),
          sectionCard({
            title: "규모",
            hint: "비워 두면 맵 넓이와 씨앗값으로 정합니다",
            children: presetScaleFields(record, rerender),
            testid: "db-village-preset-scale",
          }),
          sectionCard({
            title: "길",
            hint: "폭 2~3칸 · 구불거림 0.35~1",
            children: presetRoadFields(record, rerender),
            testid: "db-village-preset-road",
          }),
          sectionCard({
            title: "배치와 분위기",
            children: presetLayoutFields(record, rerender),
            // 카드 testid 는 안쪽 select 의 `db-village-preset-layout` 과 겹치면 안 된다 —
            // testid 조회는 정확 일치이므로 겹치면 조상 div 가 먼저 잡힌다.
            testid: "db-village-preset-arrangement",
          }),
          sectionCard({
            title: "마을 원형에서 값 가져오기",
            hint: "분위기 6갈래. 집 수·길 폭·바닥은 건드리지 않습니다",
            children: archetypeImportFields(record, rerender),
            testid: "db-village-preset-archetype",
          }),
          span(sectionCard({
            title: "쓸 집 형태 고르기",
            hint: "아무것도 안 고르면 카탈로그 전체를 씁니다",
            children: presetTemplateWhitelist(project, record, rerender),
            testid: "db-village-preset-templates",
          })),
        ],
      }),
    ],
    testid: "db-village-detail-pane",
  });
}

function presetBasicFields(
  record: VillageLayoutPresetRecord,
  records: readonly VillageLayoutPresetRecord[],
  rerender: () => void,
): HTMLElement[] {
  const idInput = el("input", {
    attrs: { type: "text", spellcheck: "false" },
    value: record.id,
    dataset: { testid: "db-village-preset-id" },
  }) as HTMLInputElement;
  idInput.addEventListener("change", () => {
    const next = idInput.value.trim();
    if (next === record.id) return;
    if (!next) { toast("ID 는 비워둘 수 없습니다.", "error"); idInput.value = record.id; return; }
    if (records.some((entry) => entry.id === next)) {
      toast(`이미 쓰는 ID 입니다: ${next}`, "error");
      idInput.value = record.id;
      return;
    }
    recordProjectSnapshot("배치 프리셋 ID 변경");
    patchPreset(record.id, () => ({ id: next }));
    selectedPresetId = next;
    rerender();
  });

  return [
    textField("이름", "db-village-preset-name", record.name, (value) => {
      recordCoalescedSnapshot(`village-preset-name:${record.id}`, "배치 프리셋 이름 변경");
      patchPreset(record.id, () => ({ name: value }));
      updateVisibleName(`db-village-preset-row-${record.id}`, value || record.id);
    }),
    field("ID", idInput),
    textField("메모", "db-village-preset-note", record.note ?? "", (value) => {
      recordCoalescedSnapshot(`village-preset-note:${record.id}`, "배치 프리셋 메모 변경");
      patchPreset(record.id, () => (value.trim() ? { note: value } : { note: undefined }));
    }),
    el("p", { class: "db-ws-usage", text: "메모는 AI 컨텍스트에도 실립니다 — “산골 분위기” 처럼 의도를 적어 두면 모델이 참고합니다." }),
  ];
}

function presetScaleFields(record: VillageLayoutPresetRecord, rerender: () => void): HTMLElement[] {
  return [
    optionalNumber("집 수", "db-village-preset-house-count", record.houseCount, VILLAGE_RANGE.houseCount, (value) => {
      recordCoalescedSnapshot(`village-preset-houses:${record.id}`, "프리셋 집 수 변경");
      patchPreset(record.id, () => ({ houseCount: value }));
      rerender();
    }),
    optionalNumber("주민 수", "db-village-preset-npc-count", record.npcCount, VILLAGE_RANGE.npcCount, (value) => {
      recordCoalescedSnapshot(`village-preset-npcs:${record.id}`, "프리셋 주민 수 변경");
      patchPreset(record.id, () => ({ npcCount: value }));
      rerender();
    }),
    optionalSelect("바닥", "db-village-preset-ground", record.groundTheme, VILLAGE_GROUND_THEME_IDS, GROUND_LABEL, (value) => {
      recordProjectSnapshot("프리셋 바닥 변경");
      patchPreset(record.id, () => ({ groundTheme: value }));
      rerender();
    }),
  ];
}

function presetRoadFields(record: VillageLayoutPresetRecord, rerender: () => void): HTMLElement[] {
  return [
    optionalSelect("길 재질", "db-village-preset-path-style", record.pathStyle, VILLAGE_PATH_STYLES, PATH_LABEL, (value) => {
      recordProjectSnapshot("프리셋 길 재질 변경");
      patchPreset(record.id, () => ({ pathStyle: value }));
      rerender();
    }),
    optionalNumber("길 폭 (칸)", "db-village-preset-road-width", record.roadWidth, VILLAGE_RANGE.roadWidth, (value) => {
      recordCoalescedSnapshot(`village-preset-road-width:${record.id}`, "프리셋 길 폭 변경");
      patchPreset(record.id, () => ({ roadWidth: value }));
      rerender();
    }),
    optionalNumber(
      "구불거림",
      "db-village-preset-road-naturalness",
      record.roadNaturalness,
      { ...VILLAGE_RANGE.roadNaturalness, step: 0.05 },
      (value) => {
        recordCoalescedSnapshot(`village-preset-road-nat:${record.id}`, "프리셋 구불거림 변경");
        patchPreset(record.id, () => ({ roadNaturalness: value }));
        rerender();
      },
    ),
    el("p", { class: "db-ws-usage", text: "구불거림 1 은 최대한 자연스럽게, 0.35 는 거의 직선입니다. 비워 두면 씨앗값으로 정합니다." }),
  ];
}

function presetLayoutFields(record: VillageLayoutPresetRecord, rerender: () => void): HTMLElement[] {
  const kitOptions = ["mixed", ...MIXABLE_HOUSE_KIT_IDS] as const;
  const kitLabel: Record<string, string> = { mixed: "섞기" };
  for (const id of MIXABLE_HOUSE_KIT_IDS) kitLabel[id] = HOUSE_KITS[id].name;
  return [
    optionalSelect("마을 배치", "db-village-preset-layout", record.settlementLayout, VILLAGE_LAYOUT_IDS, LAYOUT_LABEL, (value) => {
      recordProjectSnapshot("프리셋 마을 배치 변경");
      patchPreset(record.id, () => ({ settlementLayout: value }));
      rerender();
    }),
    optionalSelect("광장 모양", "db-village-preset-plaza-style", record.plazaStyle, VILLAGE_PLAZA_STYLES, PLAZA_STYLE_LABEL, (value) => {
      recordProjectSnapshot("프리셋 광장 모양 변경");
      patchPreset(record.id, () => ({ plazaStyle: value }));
      rerender();
    }),
    optionalSelect("광장 위치", "db-village-preset-plaza-layout", record.plazaLayout, VILLAGE_PLAZA_LAYOUTS, PLAZA_LAYOUT_LABEL, (value) => {
      recordProjectSnapshot("프리셋 광장 위치 변경");
      patchPreset(record.id, () => ({ plazaLayout: value }));
      rerender();
    }),
    optionalSelect("마당", "db-village-preset-yard", record.yardStyle, VILLAGE_YARD_STYLES, YARD_LABEL, (value) => {
      recordProjectSnapshot("프리셋 마당 변경");
      patchPreset(record.id, () => ({ yardStyle: value }));
      rerender();
    }),
    optionalSelect("바깥 나무", "db-village-preset-edge-trees", record.edgeTrees, VILLAGE_EDGE_TREE_STYLES, EDGE_TREE_LABEL, (value) => {
      recordProjectSnapshot("프리셋 바깥 나무 변경");
      patchPreset(record.id, () => ({ edgeTrees: value }));
      rerender();
    }),
    optionalSelect("재료 킷", "db-village-preset-kit-mix", record.kitMix, kitOptions, kitLabel, (value) => {
      recordProjectSnapshot("프리셋 재료 킷 변경");
      patchPreset(record.id, () => ({ kitMix: value }));
      rerender();
    }),
  ];
}

function presetTemplateWhitelist(
  project: Project,
  record: VillageLayoutPresetRecord,
  rerender: () => void,
): HTMLElement[] {
  const chosen = new Set(record.templateIds ?? []);
  const all = villageTemplateCatalog(project).templates;
  const userIds = new Set((project.villageTemplates ?? []).map((entry) => entry.id));
  const toggle = (id: string, on: boolean): void => {
    recordProjectSnapshot("프리셋 형태 목록 변경");
    patchPreset(record.id, (current) => {
      const next = new Set(current.templateIds ?? []);
      if (on) next.add(id);
      else next.delete(id);
      return { templateIds: next.size > 0 ? [...next] : undefined };
    });
    rerender();
  };

  return [
    el("div", {
      class: "db-village-template-picker",
      dataset: { testid: "db-village-preset-template-picker" },
      children: all.map((template) => {
        const input = el("input", {
          attrs: { type: "checkbox" },
          dataset: { testid: `db-village-preset-template-${template.id}` },
        }) as HTMLInputElement;
        input.checked = chosen.has(template.id);
        input.addEventListener("change", () => toggle(template.id, input.checked));
        return el("label", {
          class: `db-village-template-option${userIds.has(template.id) ? " is-user" : ""}`,
          attrs: { title: `${template.id} · ${template.w}×${template.h}` },
          children: [
            input,
            el("span", { class: "db-village-template-name", text: template.name }),
            el("span", { class: "db-village-template-meta", text: userIds.has(template.id) ? "내 형태" : `${template.w}×${template.h}` }),
          ],
        });
      }),
    }),
    el("div", {
      class: "db-village-wing-actions",
      children: [
        el("button", {
          class: "db-ws-btn db-ws-btn-ghost",
          text: "내 형태만 고르기",
          attrs: { type: "button", ...(userIds.size === 0 ? { disabled: "true" } : {}) },
          dataset: { testid: "db-village-preset-pick-user" },
          on: {
            click: () => {
              recordProjectSnapshot("프리셋 형태 목록 변경");
              patchPreset(record.id, () => ({ templateIds: [...userIds] }));
              rerender();
            },
          },
        }),
        el("button", {
          class: "db-ws-btn db-ws-btn-ghost",
          text: "전체 해제",
          attrs: { type: "button", ...(chosen.size === 0 ? { disabled: "true" } : {}) },
          dataset: { testid: "db-village-preset-clear-templates" },
          on: {
            click: () => {
              recordProjectSnapshot("프리셋 형태 목록 변경");
              patchPreset(record.id, () => ({ templateIds: undefined }));
              rerender();
            },
          },
        }),
      ],
    }),
    el("p", {
      class: "db-ws-usage",
      text: "고른 형태만 시공에 쓰입니다. 고른 id 가 카탈로그에 하나도 없으면 경고를 남기고 전체를 씁니다.",
    }),
  ];
}

// ---------------------------------------------------------------------------
// 마을 원형
//
// 원형은 예전에 `village/builder.ts` 의 정규식 6갈래 안에만 있었다 — 테마 문장에 「어촌」이
// 들어가야만 닿을 수 있었고, 화면에는 이름조차 없었으며 `presetId` 로 지목할 수도 없었다.
// 이제 `authoringData.ts` 의 `VILLAGE_ARCHETYPES` 가 정본이고 테마 추론과 이 화면이 같은
// 배열을 읽는다. 여기서 만든 프리셋은 값을 베낀 사본이므로, 원형이 나중에 바뀌어도 이미
// 만든 프리셋은 흔들리지 않는다.
// ---------------------------------------------------------------------------

/** 원형이 정하는 값을 한 줄로. 사람이 고를 때 이름만으로는 무엇이 달라지는지 알 수 없다. */
function archetypeSummary(archetype: VillageArchetype): string {
  const { pathStyle, yardStyle, plazaStyle, plazaLayout, edgeTrees, kitMix } = archetype.values;
  const parts: string[] = [];
  if (pathStyle) parts.push(PATH_LABEL[pathStyle] ?? pathStyle);
  if (yardStyle) parts.push(`마당 ${YARD_LABEL[yardStyle] ?? yardStyle}`);
  if (plazaStyle) parts.push(`광장 ${PLAZA_STYLE_LABEL[plazaStyle] ?? plazaStyle}`);
  if (plazaLayout) parts.push(PLAZA_LAYOUT_LABEL[plazaLayout] ?? plazaLayout);
  if (edgeTrees) parts.push(`나무 ${EDGE_TREE_LABEL[edgeTrees] ?? edgeTrees}`);
  if (kitMix) parts.push(kitMix === "mixed" ? "재료 섞기" : HOUSE_KITS[kitMix as keyof typeof HOUSE_KITS]?.name ?? kitMix);
  return parts.join(" · ");
}

function archetypeGallery(rerender: () => void): HTMLElement[] {
  return [
    el("div", {
      class: "db-village-archetypes",
      dataset: { testid: "db-village-archetypes" },
      children: VILLAGE_ARCHETYPES.map((archetype) => el("button", {
        class: "db-village-archetype",
        attrs: {
          type: "button",
          // 낱말 목록이 곧 "이 원형이 언제 자동으로 골라지는가" 다.
          title: `테마에 이런 낱말이 있으면 자동으로 골라집니다: ${archetype.keywords.join(", ")}`,
        },
        dataset: { testid: `db-village-archetype-${archetype.id}` },
        on: { click: () => createPresetFromArchetype(archetype.id, rerender) },
        children: [
          el("span", { class: "db-village-archetype-name", text: archetype.name }),
          el("span", { class: "db-village-archetype-note", text: archetype.note }),
          el("span", { class: "db-village-archetype-values", text: archetypeSummary(archetype) }),
        ],
      })),
    }),
    el("p", {
      class: "db-ws-usage",
      text: "원형을 고르면 그 값이 든 프리셋이 새로 생깁니다. AI 는 테마 문장으로도 같은 원형을 고르지만, 프리셋으로 만들어 두면 값을 눈으로 보고 고칠 수 있고 presetId 로 지목할 수 있습니다.",
    }),
  ];
}

function archetypeImportFields(record: VillageLayoutPresetRecord, rerender: () => void): HTMLElement[] {
  const select = el("select", { dataset: { testid: "db-village-archetype-source" } }) as HTMLSelectElement;
  for (const archetype of VILLAGE_ARCHETYPES) {
    select.append(el("option", { attrs: { value: archetype.id }, text: `${archetype.name} — ${archetypeSummary(archetype)}` }));
  }
  return [
    field("마을 원형", select),
    el("div", {
      class: "db-village-wing-actions",
      children: [el("button", {
        class: "db-ws-btn db-ws-btn-ghost",
        text: "값 가져오기",
        attrs: { type: "button" },
        dataset: { testid: "db-village-archetype-apply" },
        on: {
          click: () => {
            const archetype = villageArchetypeById(select.value);
            if (!archetype) return;
            recordProjectSnapshot("원형 값 가져오기");
            // 원형이 안 정하는 항목은 `undefined` 로 지운다 — 남겨 두면 두 원형이 섞인 값이 되고,
            // 화면의 「지정 안 함」과 저장된 값이 어긋난다.
            patchPreset(record.id, () => ({
              pathStyle: archetype.values.pathStyle,
              yardStyle: archetype.values.yardStyle,
              plazaStyle: archetype.values.plazaStyle,
              plazaLayout: archetype.values.plazaLayout,
              edgeTrees: archetype.values.edgeTrees,
              kitMix: archetype.values.kitMix,
            }));
            toast(`“${archetype.name}” 값을 가져왔습니다.`, "ok");
            rerender();
          },
        },
      })],
    }),
    el("p", {
      class: "db-ws-usage",
      text: "분위기 값(길 재질·마당·광장·바깥 나무·재료)만 덮어씁니다. 원형이 정하지 않는 항목은 「지정 안 함」으로 비워집니다.",
    }),
  ];
}

function createPresetFromArchetype(archetypeId: string, rerender: () => void): void {
  const archetype = villageArchetypeById(archetypeId);
  if (!archetype) return;
  const used = (store.getCurrent().villagePresets ?? []).map((entry) => entry.id);
  const id = nextVillageId(used, archetype.id);
  recordProjectSnapshot("원형에서 배치 프리셋 만들기");
  store.update((draft) => {
    draft.villagePresets = [...(draft.villagePresets ?? []), presetRecordFromArchetype(archetype, id)];
  }, { scope: "database", collection: "villagePresets" });
  selectedKind = "preset";
  selectedPresetId = id;
  villageSearch = "";
  toast(`“${archetype.name}” 원형으로 프리셋을 만들었습니다.`, "ok");
  rerender();
}

// ---------------------------------------------------------------------------
// 컨트롤 헬퍼
// ---------------------------------------------------------------------------

function checkboxField(
  label: string,
  testid: string,
  checked: boolean,
  hint: string,
  onChange: (checked: boolean) => void,
): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return field(label, el("label", {
    class: "db-village-check",
    children: [input, el("span", { text: hint })],
  }));
}

/**
 * `change` 에서만 커밋하는 숫자 입력. 공용 `numberField` 는 `input` 마다 콜백을 부르는데,
 * 이 탭의 콜백은 미리보기 격자와 규약 배지를 다시 그리려고 전체 rerender 를 한다 —
 * 한 글자 칠 때마다 입력칸이 DOM 에서 떼어져 캐럿이 날아간다.
 */
function requiredNumber(
  label: string,
  testid: string,
  value: number,
  bounds: { readonly min: number; readonly max: number },
  onCommit: (value: number) => void,
): HTMLElement {
  const input = el("input", {
    attrs: { type: "number", min: String(bounds.min), max: String(bounds.max), step: "1" },
    value,
    dataset: { testid },
  }) as HTMLInputElement;
  input.addEventListener("change", () => {
    const raw = Math.trunc(Number(input.value));
    const clamped = Math.min(bounds.max, Math.max(bounds.min, Number.isFinite(raw) ? raw : bounds.min));
    input.value = String(clamped);
    onCommit(clamped);
  });
  return field(label, input);
}

/**
 * 값을 비울 수 있는 select — 프리셋의 모든 값은 생략 가능하다.
 *
 * 「지정 안 함」 항목을 여기서 만들지 않는다: 공용 `selectField` 의 `baseSelect` 가 빈 값
 * 항목(`(없음)`)을 **항상** 맨 앞에 넣는다. 예전에는 여기서 하나 더 얹어서 값이 같은("")
 * 항목이 둘이 됐고, 브라우저는 앞선 것을 고르므로 「지정 안 함」 라벨은 화면에 한 번도
 * 뜨지 않는 죽은 문구였다(실측: 재료 킷이 「(없음)」으로 표시).
 */
function optionalSelect<T extends string>(
  label: string,
  testid: string,
  value: string | undefined,
  options: readonly T[],
  labels: Readonly<Record<string, string>>,
  onChange: (value: T | undefined) => void,
): HTMLElement {
  return selectField(
    label,
    testid,
    typeof value === "string" && (options as readonly string[]).includes(value) ? value : UNSET,
    options.map((id) => ({ id, name: labels[id] ?? id })),
    (next) => onChange(next === UNSET ? undefined : (next as T)),
  );
}

/** 빈 값 = 「지정 안 함」인 숫자 입력. 0 이 유효값인 필드(주민 수)가 있어 빈 문자열로 구분한다. */
function optionalNumber(
  label: string,
  testid: string,
  value: number | undefined,
  bounds: { readonly min: number; readonly max: number; readonly step?: number },
  onChange: (value: number | undefined) => void,
): HTMLElement {
  const input = el("input", {
    attrs: {
      type: "number",
      min: String(bounds.min),
      max: String(bounds.max),
      step: String(bounds.step ?? 1),
      placeholder: "자동",
    },
    value: value === undefined ? "" : String(value),
    dataset: { testid },
  }) as HTMLInputElement;
  input.addEventListener("change", () => {
    if (input.value.trim() === "") { onChange(undefined); return; }
    const raw = Number(input.value);
    if (!Number.isFinite(raw)) { onChange(undefined); return; }
    const clamped = Math.min(bounds.max, Math.max(bounds.min, bounds.step === undefined ? Math.trunc(raw) : raw));
    input.value = String(clamped);
    onChange(clamped);
  });
  return field(label, input);
}

// ---------------------------------------------------------------------------
// 저장
// ---------------------------------------------------------------------------

function patchTemplate(
  id: string,
  patch: (current: VillageHouseTemplateRecord) => Partial<VillageHouseTemplateRecord>,
): void {
  store.update((draft) => {
    const records = draft.villageTemplates ?? [];
    const index = records.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    draft.villageTemplates = records.map((entry, at) => (at === index ? prune({ ...entry, ...patch(entry) }) : entry));
  }, { scope: "database", collection: "villageTemplates" });
}

function patchPreset(
  id: string,
  patch: (current: VillageLayoutPresetRecord) => Partial<VillageLayoutPresetRecord>,
): void {
  store.update((draft) => {
    const records = draft.villagePresets ?? [];
    const index = records.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    draft.villagePresets = records.map((entry, at) => (at === index ? prune({ ...entry, ...patch(entry) }) : entry));
  }, { scope: "database", collection: "villagePresets" });
}

/** `undefined` 를 키째 지운다 — 직렬화 왕복에서 `"kitId": undefined` 는 살아남지 않으므로
 *  메모리 표현과 저장 표현을 같게 유지해야 왕복 비교 테스트가 성립한다. */
function prune<T extends object>(record: T): T {
  for (const key of Object.keys(record)) {
    if ((record as Record<string, unknown>)[key] === undefined) delete (record as Record<string, unknown>)[key];
  }
  return record;
}

function createRecord(rerender: () => void): void {
  const project = store.getCurrent();
  if (selectedKind === "template") {
    const id = nextVillageId((project.villageTemplates ?? []).map((entry) => entry.id), "my-house");
    recordProjectSnapshot("집 형태 추가");
    store.update((draft) => {
      draft.villageTemplates = [...(draft.villageTemplates ?? []), blankTemplateRecord(id)];
    }, { scope: "database", collection: "villageTemplates" });
    selectedTemplateId = id;
  } else {
    const id = nextVillageId((project.villagePresets ?? []).map((entry) => entry.id), "vpreset");
    recordProjectSnapshot("배치 프리셋 추가");
    store.update((draft) => {
      draft.villagePresets = [...(draft.villagePresets ?? []), blankPresetRecord(id)];
    }, { scope: "database", collection: "villagePresets" });
    selectedPresetId = id;
  }
  villageSearch = "";
  rerender();
}

function cloneBuiltIn(defId: string, rerender: () => void): void {
  const def = HOUSE_TEMPLATE_DEFS.find((entry) => entry.id === defId) ?? HOUSE_TEMPLATE_DEFS[0]!;
  const id = nextVillageId((store.getCurrent().villageTemplates ?? []).map((entry) => entry.id), `my-${def.id}`);
  recordProjectSnapshot("내장 집 형태 복제");
  store.update((draft) => {
    draft.villageTemplates = [...(draft.villageTemplates ?? []), templateRecordFromDef(def, id)];
  }, { scope: "database", collection: "villageTemplates" });
  selectedKind = "template";
  selectedTemplateId = id;
  villageSearch = "";
  rerender();
}

function duplicateRecord(
  templates: readonly VillageHouseTemplateRecord[],
  presets: readonly VillageLayoutPresetRecord[],
  rerender: () => void,
): void {
  if (selectedKind === "template") {
    const source = templates.find((entry) => entry.id === selectedTemplateId);
    if (!source) return;
    const id = nextVillageId(templates.map((entry) => entry.id), source.id);
    recordProjectSnapshot("집 형태 복제");
    store.update((draft) => {
      draft.villageTemplates = [...(draft.villageTemplates ?? []), duplicateTemplateRecord(source, id)];
    }, { scope: "database", collection: "villageTemplates" });
    selectedTemplateId = id;
  } else {
    const source = presets.find((entry) => entry.id === selectedPresetId);
    if (!source) return;
    const id = nextVillageId(presets.map((entry) => entry.id), source.id);
    recordProjectSnapshot("배치 프리셋 복제");
    store.update((draft) => {
      draft.villagePresets = [...(draft.villagePresets ?? []), duplicatePresetRecord(source, id)];
    }, { scope: "database", collection: "villagePresets" });
    selectedPresetId = id;
  }
  villageSearch = "";
  rerender();
}

function deleteRecord(rerender: () => void): void {
  if (selectedKind === "template") {
    const id = selectedTemplateId;
    if (!id) return;
    recordProjectSnapshot("집 형태 삭제");
    store.update((draft) => {
      draft.villageTemplates = (draft.villageTemplates ?? []).filter((entry) => entry.id !== id);
      // 프리셋 화이트리스트에 남은 죽은 id 는 시공 때 경고가 된다 — 같이 지운다.
      draft.villagePresets = (draft.villagePresets ?? []).map((preset) => {
        if (!preset.templateIds?.includes(id)) return preset;
        const next = preset.templateIds.filter((entry) => entry !== id);
        return prune({ ...preset, templateIds: next.length > 0 ? next : undefined });
      });
    }, { scope: "database", collection: "villageTemplates" });
    selectedTemplateId = "";
    toast("집 형태를 삭제했습니다. Ctrl+Z 로 되돌릴 수 있습니다.", "ok");
  } else {
    const id = selectedPresetId;
    if (!id) return;
    recordProjectSnapshot("배치 프리셋 삭제");
    store.update((draft) => {
      draft.villagePresets = (draft.villagePresets ?? []).filter((entry) => entry.id !== id);
    }, { scope: "database", collection: "villagePresets" });
    selectedPresetId = "";
    toast("배치 프리셋을 삭제했습니다. Ctrl+Z 로 되돌릴 수 있습니다.", "ok");
  }
  rerender();
}

/** 형태 id 를 바꾸면 그 id 를 가리키던 프리셋 화이트리스트도 따라간다. */
function renamePresetReferences(from: string, to: string): void {
  store.update((draft) => {
    draft.villagePresets = (draft.villagePresets ?? []).map((preset) => {
      if (!preset.templateIds?.includes(from)) return preset;
      return { ...preset, templateIds: preset.templateIds.map((entry) => (entry === from ? to : entry)) };
    });
  }, { scope: "database", collection: "villagePresets" });
}

function updateVisibleName(rowTestid: string, name: string): void {
  const row = document.querySelector<HTMLElement>(`[data-testid='${rowTestid}'] .db-list-name`);
  if (row) row.textContent = name;
}

function matches(name: string, id: string, query: string): boolean {
  return name.toLowerCase().includes(query) || id.toLowerCase().includes(query);
}

function span(node: HTMLElement): HTMLElement {
  node.classList.add("db-ws-span");
  return node;
}
