import { asVillageDesign } from "@/project/villageDesign";
import { renderVillageDesignDetail } from "./villageDesignPanel";
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
  HOUSE_SHAPE_PRESETS,
  blankPresetRecord,
  blankTemplateRecord,
  duplicatePresetRecord,
  duplicateTemplateRecord,
  footprintTileCount,
  houseTemplateGroupLabel,
  moveWing,
  nextVillageId,
  presetRecordFromArchetype,
  resizeWing,
  templateFootprint,
  templateRecordFromDef,
  tightenTemplateBounds,
} from "@/editor/panels/databaseVillageModel";
import {
  createHousePreview,
  createMapShot,
  houseKitTileset,
  previewKitFor,
  villageArchetypeShotUrl,
  type HousePreviewSize,
} from "@/editor/panels/villageHousePreview";
import { createMoodPreview, type MoodPreviewField } from "@/editor/panels/villageMoodPreview";
import { visualSelect } from "@/editor/panels/villageVisualSelect";
import { createGroundThemePreview } from "@/editor/panels/villageGroundPreview";
import { PRESET_PREVIEW_SIZE, buildPresetPreview } from "@/editor/panels/villagePresetPreview";
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
import { ALL_HOUSE_KIT_IDS, HOUSE_KITS, MIXABLE_HOUSE_KIT_IDS, isHouseKitId, type HouseKitId } from "@/editor/houseKit";
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
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";

type VillageKind = "template" | "preset";

const KIND_LABEL: Readonly<Record<VillageKind, string>> = { template: "집 형태", preset: "마을 설계서" };

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

let selectedKind: VillageKind = "preset";
let selectedTemplateId = "";
let selectedPresetId = "";
let villageSearch = "";
/** 프리셋 미리보기 씨앗. 랜덤이 아니라 세는 값이다 — 같은 씨앗은 늘 같은 배치를 낸다. */
let presetPreviewSeed = 7;
/** 「값 가져오기」가 읽을 원형. 예전 <select> 의 첫 항목과 같이 프리셋마다 첫 원형에서 시작한다. */
let archetypeImportSourceId = VILLAGE_ARCHETYPES[0]!.id;
let archetypeImportPresetId = "";

/** Open the selected settlement recipe without falling back to the first preset. */
export function selectVillagePresetDesign(id: string): void {
  selectedKind = "preset"; selectedPresetId = id; villageSearch = "";
}

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
    rows: selectedKind === "template" ? templateRows(project, templates, rerender) : presetRows(presets, rerender),
    empty: listEmpty(templates.length, presets.length, rerender),
    toolbar: kindToolbar(templates, presets, rerender),
    testid: "db-village-list-pane",
  });

  // 빈 프로젝트에서 「만들어 보세요」 빈 판만 뜨면 사용자는 무엇을 만들 수 있는지조차
  // 모른다 — 아무것도 없을 때는 예시(원형 6갈래 · 집 모양 10꼴)를 먼저 보여준다.
  const detail = templates.length === 0 && presets.length === 0
    ? startScreen(project, rerender)
    : selectedKind === "template"
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

function templateRows(
  project: Project,
  records: readonly VillageHouseTemplateRecord[],
  rerender: () => void,
): HTMLElement[] {
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
      // 목록에서도 그림으로 고르게 한다 — 이름만 있으면 「my-house_3」 중 어느 게 ㄱ자인지 모른다.
      thumb: rowThumb(project, record),
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
// 시작 화면
//
// 레코드가 하나도 없을 때만 뜬다. 예전에는 분류마다 「만들어 보세요」 빈 판이 떴고,
// 예시(원형 6갈래)는 프리셋 분류로 들어가야 보였다 — 첫 화면이 무엇을 만들 수 있는지
// 알려주지 않으면 빈 프로젝트에서는 시작할 방법이 없다.
//
// 빈 상태 판을 **없애지 않고 감싼다**: `db-village-template-blank` / `db-village-preset-blank`
// 는 여기 안에 그대로 남는다.
// ---------------------------------------------------------------------------

function startScreen(project: Project, rerender: () => void): HTMLElement {
  return detailPane({
    hero: detailHero({
      eyebrow: "마을",
      title: "예시부터 골라 보세요",
      subtitle: "여기서 만든 값은 마을 시공(author_village)이 그대로 읽습니다. 아직 아무것도 없어도 내장 형태와 원형은 이미 쓰이는 중입니다 — 고쳐 쓰고 싶은 것만 여기로 가져옵니다.",
      tags: [`내장 집 형태 ${HOUSE_TEMPLATE_DEFS.length}종`, `마을 원형 ${VILLAGE_ARCHETYPES.length}갈래`],
      testid: "db-village-start-hero",
    }),
    body: [
      el("div", {
        class: "db-ws-stack db-village-inspector",
        children: [
          span(sectionCard({
            title: "예시 마을로 시작",
            hint: "원형을 고르면 그 분위기 값이 든 배치 프리셋이 생깁니다",
            children: [
              emptyState({
                icon: "⌖",
                title: "마을 설계서를 만들어 보세요",
                body: "집의 생김새·길·물과 숲을 한곳에서 정합니다. AI가 지킬 고정값과 바꿔도 되는 범위를 선택하세요.",
                action: {
                  label: "+ 마을 설계서 추가",
                  kind: "primary",
                  testid: "db-village-preset-blank-create",
                  onClick: () => { selectedKind = "preset"; createRecord(rerender); },
                },
                compact: true,
                testid: "db-village-preset-blank",
              }),
              ...archetypeGallery(rerender),
            ],
            testid: "db-village-start-archetypes",
          })),
          span(sectionCard({
            title: "집 모양으로 시작",
            hint: "고른 꼴로 집 형태 레코드가 생깁니다. 그림은 실제 시공 타일입니다",
            children: [
              emptyState({
                icon: "⌂",
                title: "집 형태를 만들어 보세요",
                body: "내장 형태를 복제해서 시작하면 규약을 어길 일이 없습니다. 폭 3~8칸, 높이 4~24칸 안에서 날개를 붙입니다.",
                action: {
                  label: "내장에서 복제",
                  kind: "primary",
                  testid: "db-village-clone-builtin",
                  onClick: () => cloneBuiltIn("rect-large", rerender),
                },
                compact: true,
                testid: "db-village-template-blank",
              }),
              ...startShapePalette(project, rerender),
            ],
            testid: "db-village-start-shapes",
          })),
        ],
      }),
    ],
    testid: "db-village-detail-pane",
  });
}

/** 시작 화면의 모양 팔레트 — 고른 꼴로 **새 레코드**를 만든다(편집 중 레코드를 고치는 팔레트와 다르다). */
function startShapePalette(project: Project, rerender: () => void): HTMLElement[] {
  const cards = HOUSE_SHAPE_PRESETS.flatMap((preset) => {
    const def = HOUSE_TEMPLATE_DEFS.find((entry) => entry.id === preset.defId);
    if (!def) return [];
    return [builtInCard(project, def, {
      testid: `db-village-start-shape-${def.id}`,
      onPick: () => cloneBuiltIn(def.id, rerender),
    })];
  });
  return [
    el("div", { class: "db-village-shape-grid", dataset: { testid: "db-village-start-shape-palette" }, children: cards }),
    el("p", {
      class: "db-ws-usage",
      text: "고른 꼴을 복제해 내 형태로 만듭니다. 내장 형태는 그대로 남고, 복제본은 카탈로그에 더해집니다.",
    }),
  ];
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
      media: housePicture(project, record, "hero", { testid: "db-village-template-shot" }),
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
          span(sectionCard({
            title: "모양 고르기",
            hint: "누르면 그 꼴로 날개가 바뀝니다 — 숫자를 채우기 전에 바닥 꼴부터 고릅니다",
            children: shapePalette(project, record, rerender),
            testid: "db-village-template-shapes",
          })),
          sectionCard({
            title: "크기와 재료",
            hint: "폭 3~8 · 높이 4~24칸",
            children: templateSizeFields(project, record, rerender),
            testid: "db-village-template-size",
          }),
          span(sectionCard({
            title: "날개",
            hint: "격자에서 끌어 옮기고 변을 끌어 늘립니다. 합집합이 집 바닥이 됩니다",
            children: templateWingFields(record, rerender),
            testid: "db-village-template-wings",
          })),
          span(sectionCard({
            title: "내장 형태에서 값 가져오기",
            hint: `내장 ${HOUSE_TEMPLATE_DEFS.length}종. 값을 베껴 옵니다 — 이후 내장이 바뀌어도 따라 변하지 않습니다`,
            children: builtInImportFields(project, record, rerender),
            testid: "db-village-template-import",
          })),
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

/**
 * 층수 카드용 미리보기 레코드.
 * 보통은 8×9 한 날개(1·2·3층 열 최소 5/7/9 를 모두 통과)에 지금 킷을 찍는다.
 */
function storiesCardRecord(
  record: VillageHouseTemplateRecord,
  stories: 1 | 2 | 3,
  kitId: HouseKitId,
): VillageHouseTemplateRecord {
  return {
    id: record.id,
    name: record.name,
    w: 8,
    h: 9,
    stories,
    kitId,
    wings: [{ x: 0, y: 0, w: 8, h: 9 }],
    ...(record.clonedFrom ? { clonedFrom: record.clonedFrom } : {}),
    ...(record.lowWall ? { lowWall: true } : {}),
    ...(record.roofDeck ? { roofDeck: true } : {}),
  };
}

function templateSizeFields(
  project: Project,
  record: VillageHouseTemplateRecord,
  rerender: () => void,
): HTMLElement[] {
  const { templateW, templateH } = VILLAGE_RANGE;
  const kitOptions = ALL_HOUSE_KIT_IDS.map((id) => ({ id, name: HOUSE_KITS[id].name }));
  const storiesKitId = previewKitFor(record);
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
    visualSelect({
      label: "층수",
      testid: "db-village-template-stories",
      value: String(record.stories ?? 1),
      options: [
        { id: "1", name: "1층" },
        { id: "2", name: "2층" },
        { id: "3", name: "3층" },
      ],
      mediaFor: (id) => {
        const stories = Number(id) === 3 ? 3 : Number(id) === 2 ? 2 : 1;
        return createHousePreview(storiesCardRecord(record, stories, storiesKitId), project, "card", {
          testid: `db-village-template-stories-${stories}-shot`,
          label: `${stories}층 집 그림`,
        });
      },
      onChange: (value) => {
        recordProjectSnapshot("집 형태 층수 변경");
        patchTemplate(record.id, () => ({ stories: Number(value) === 3 ? 3 : Number(value) === 2 ? 2 : 1 }));
        rerender();
      },
    }),
    visualSelect({
      label: "재료 킷",
      testid: "db-village-template-kit",
      value: record.kitId ?? UNSET,
      options: kitOptions,
      allowUnset: true,
      unsetLabel: "프리셋/씨앗값이 고름",
      mediaFor: (id) => createHousePreview(
        { ...record, kitId: id },
        project,
        "card",
        {
          testid: id ? `db-village-template-kit-${id}-shot` : "db-village-template-kit-unset-shot",
          label: isHouseKitId(id) ? `${HOUSE_KITS[id].name} 집 그림` : "프리셋/씨앗값이 고름",
        },
      ),
      onChange: (value) => {
        recordProjectSnapshot("집 형태 재료 킷 변경");
        // 비움은 키를 지운다 — "" 가 남아 있으면 왕복에서 kitId:"" 로 살아남는다.
        patchTemplate(record.id, () => ({ kitId: value || undefined }));
        rerender();
      },
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
  const numberRows = wings.map((wing, index) => el("div", {
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
    footprintEditor(record, rerender),
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
    el("p", {
      class: "db-ws-usage",
      // 하한을 문장에 손으로 박으면 규약이 바뀔 때 화면만 거짓말을 한다 — 상수에서 뽑는다.
      text: `날개를 끌어 옮기고 변을 끌어 늘립니다. 키보드로는 날개를 고른 뒤 화살표(이동) · Shift+화살표(크기)입니다. 날개는 최소 ${VILLAGE_RANGE.wingW.min}×${VILLAGE_RANGE.wingH.min}칸이고 바운딩 박스를 넘을 수 없습니다. 세로로는 한 열이 이어서 ${minWingRun(record)}칸 이상이어야 벽과 지붕이 들어갑니다.`,
    }),
    // 숫자칸은 없애지 않고 접어 둔다 — 정확한 값을 박아야 할 때가 있고, 격자 드래그는
    // 「대충 이 모양」까지만 빠르다.
    advancedFold("숫자로 고치기", "db-village-wing-numbers", [
      el("div", { class: "db-village-wing-list", dataset: { testid: "db-village-wings" }, children: numberRows }),
      el("p", {
        class: "db-ws-usage",
        text: "좌표는 집 왼쪽 위를 (0,0) 으로 하는 상대 좌표입니다.",
      }),
    ]),
  ];
}

/**
 * 격자 조작면. 날개마다 절대 배치 사각형 + 변 손잡이 8개를 얹는다.
 *
 * 규약 클램프는 `moveWing`/`resizeWing`(순수 함수)이 전부 끝낸다 — 드래그로는 애초에
 * 규약을 어길 수 없게 만드는 편이 어긴 뒤 안내문을 띄우는 것보다 낫다.
 *
 * 드래그 중에는 store 를 건드리지 않는다. 한 칸 움직일 때마다 커밋하면 되돌리기 스택이
 * 수십 개로 불고, rerender 가 조작 중인 노드를 DOM 에서 떼어내 포인터가 끊긴다.
 */
function footprintEditor(record: VillageHouseTemplateRecord, rerender: () => void): HTMLElement {
  const cols = Math.max(1, Math.trunc(record.w) || 1);
  const rows = Math.max(1, Math.trunc(record.h) || 1);
  const wings = (record.wings ?? []).map((wing) => ({ ...wing }));
  const status = el("p", { class: "db-village-grid-status", dataset: { testid: "db-village-grid-status" } });
  const boxes: HTMLElement[] = [];

  const grid = el("div", {
    // 클래스는 `db-village-grid` 하나만 쓴다 — 예전 격자의 `.db-village-footprint-large`
    // 는 gap·padding 을 넣는데, 드래그가 `clientWidth / 열 수` 로 칸 크기를 재므로
    // 여백이 끼면 좌표가 어긋난다. testid 는 그 상자를 가리켜야 하므로 그대로 둔다.
    class: "db-village-grid",
    attrs: { role: "group", "aria-label": `날개 배치 격자 ${cols}×${rows}칸` },
    dataset: { testid: "db-village-footprint-large" },
    children: Array.from({ length: cols * rows }, () => el("span", { class: "db-village-grid-cell" })),
  });
  grid.style.setProperty("--db-village-cols", String(cols));
  grid.style.setProperty("--db-village-rows", String(rows));

  /** 화면만 갱신한다(드래그 중). 커밋은 포인터를 놓을 때 한 번. */
  const paintLive = (next: readonly { x: number; y: number; w: number; h: number }[]): void => {
    next.forEach((wing, index) => {
      const box = boxes[index];
      if (!box) return;
      box.style.setProperty("--db-village-wing-x", String(wing.x));
      box.style.setProperty("--db-village-wing-y", String(wing.y));
      box.style.setProperty("--db-village-wing-w", String(wing.w));
      box.style.setProperty("--db-village-wing-h", String(wing.h));
      box.setAttribute("aria-label", wingLabel(index, wing));
    });
    const resolved = templateFromRecord({ ...record, wings: [...next] });
    status.textContent = "reason" in resolved ? `규약 위반: ${resolved.reason}` : "규약 통과";
    status.dataset.valid = "reason" in resolved ? "false" : "true";
  };

  const commit = (next: readonly { x: number; y: number; w: number; h: number }[]): void => {
    recordCoalescedSnapshot(`village-wing-drag:${record.id}`, "날개 배치 변경");
    patchTemplate(record.id, () => ({ wings: next.map((wing) => ({ ...wing })) }));
    rerender();
  };

  /** 격자 한 칸의 픽셀 크기. 레이아웃이 없는 환경(테스트)에서는 0 이라 드래그가 안 돈다. */
  const cellSize = (): { readonly x: number; readonly y: number } => ({
    x: grid.clientWidth / cols,
    y: grid.clientHeight / rows,
  });

  wings.forEach((wing, index) => {
    // 손잡이는 포인터 전용이다 — 8개마다 탭 정지점을 만들면 키보드 사용자가 격자를
    // 지나갈 수 없다. 키보드 조작은 날개 상자 자체가 받는다.
    const handles = WING_HANDLES.map(([name, edges]) => ({
      edges,
      node: el("span", {
        class: `db-village-handle is-${name}`,
        attrs: { "aria-hidden": "true" },
        dataset: { testid: `db-village-wing-handle-${index}-${name}` },
      }),
    }));
    const box = el("div", {
      class: "db-village-wing-box",
      attrs: { role: "button", tabindex: "0", "aria-label": wingLabel(index, wing) },
      dataset: { testid: `db-village-wing-box-${index}` },
      children: [
        el("span", { class: "db-village-wing-tag", text: `#${index + 1}`, attrs: { "aria-hidden": "true" } }),
        ...handles.map((handle) => handle.node),
      ],
    });
    box.style.setProperty("--db-village-wing-x", String(wing.x));
    box.style.setProperty("--db-village-wing-y", String(wing.y));
    box.style.setProperty("--db-village-wing-w", String(wing.w));
    box.style.setProperty("--db-village-wing-h", String(wing.h));
    boxes.push(box);

    const startDrag = (event: PointerEvent, edges: readonly ("n" | "s" | "e" | "w")[]): void => {
      const cell = cellSize();
      if (!(cell.x > 0) || !(cell.y > 0)) return;
      event.preventDefault();
      event.stopPropagation();
      const originX = event.clientX;
      const originY = event.clientY;
      const base = wings.map((entry) => ({ ...entry }));
      let last = base;
      let steps = "";
      const target = event.currentTarget as HTMLElement;
      if (typeof target.setPointerCapture === "function") target.setPointerCapture(event.pointerId);

      const onMove = (move: PointerEvent): void => {
        const dx = Math.round((move.clientX - originX) / cell.x);
        const dy = Math.round((move.clientY - originY) / cell.y);
        const key = `${dx},${dy}`;
        if (key === steps) return;
        steps = key;
        let next = base;
        if (edges.length === 0) {
          next = moveWing({ ...record, wings: base }, index, dx, dy);
        } else {
          for (const edge of edges) {
            const delta = edge === "n" || edge === "s" ? dy : dx;
            next = resizeWing({ ...record, wings: next }, index, edge, delta);
          }
        }
        last = next;
        paintLive(next);
      };
      const onEnd = (): void => {
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onEnd);
        target.removeEventListener("pointercancel", onEnd);
        commit(last);
      };
      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onEnd);
      target.addEventListener("pointercancel", onEnd);
    };

    box.addEventListener("pointerdown", (event) => startDrag(event as PointerEvent, []));
    for (const handle of handles) {
      handle.node.addEventListener("pointerdown", (event) => startDrag(event as PointerEvent, handle.edges));
    }
    box.addEventListener("keydown", (event) => {
      const step = ARROW_STEPS[(event as KeyboardEvent).key];
      if (!step) return;
      event.preventDefault();
      const source = { ...record, wings };
      if ((event as KeyboardEvent).shiftKey) {
        // 오른쪽·아래 변만 키보드로 옮긴다 — 이동과 합치면 어떤 사각형이든 만들 수 있다.
        const edge = step.x !== 0 ? "e" : "s";
        commit(resizeWing(source, index, edge, step.x !== 0 ? step.x : step.y));
        return;
      }
      commit(moveWing(source, index, step.x, step.y));
    });
    grid.append(box);
  });

  paintLive(wings);
  return el("div", { class: "db-village-grid-wrap", children: [grid, status] });
}

/** 손잡이 이름 → 이 손잡이가 미는 변. 모서리는 두 변을 한 번에 민다. */
const WING_HANDLES: readonly (readonly [string, readonly ("n" | "s" | "e" | "w")[]])[] = [
  ["n", ["n"]], ["s", ["s"]], ["e", ["e"]], ["w", ["w"]],
  ["nw", ["n", "w"]], ["ne", ["n", "e"]], ["sw", ["s", "w"]], ["se", ["s", "e"]],
];

const ARROW_STEPS: Readonly<Record<string, { readonly x: number; readonly y: number }>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

function wingLabel(index: number, wing: { x: number; y: number; w: number; h: number }): string {
  return `날개 ${index + 1} — 위치 ${wing.x},${wing.y} 크기 ${wing.w}×${wing.h}칸. 화살표로 이동, Shift+화살표로 크기 변경`;
}

/**
 * 접기 — `<details>` 를 쓰지 않는다. Chromium `::details-content` 가 flex 스크롤 자식을
 * 무력화하는 기왕의 함정이 있고, 무엇보다 닫혀 있어도 자식이 DOM 에 남아야 한다.
 */
function advancedFold(label: string, testid: string, children: readonly HTMLElement[]): HTMLElement {
  const body = el("div", { class: "db-village-fold-body", children: [...children] });
  body.hidden = true;
  const toggle = el("button", {
    class: "db-village-fold-toggle",
    attrs: { type: "button", "aria-expanded": "false" },
    dataset: { testid: `${testid}-toggle` },
    children: [
      el("span", { class: "db-village-fold-caret", text: "▸", attrs: { "aria-hidden": "true" } }),
      el("span", { text: label }),
    ],
  });
  toggle.addEventListener("click", () => {
    const open = body.hidden;
    body.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    const caret = toggle.querySelector<HTMLElement>(".db-village-fold-caret");
    if (caret) caret.textContent = open ? "▾" : "▸";
  });
  return el("div", { class: "db-village-fold", dataset: { testid }, children: [toggle, body] });
}

/**
 * 모양 팔레트 — 숫자를 채우기 전에 바닥 꼴부터 고르게 한다. 값은 내장 정의를 그대로
 * 베끼므로 「고르자마자 규약 위반」이 생길 수 없다(내장 34종 왕복 테스트가 그 불변식을 지킨다).
 */
function shapePalette(
  project: Project,
  record: VillageHouseTemplateRecord,
  rerender: () => void,
): HTMLElement[] {
  const cards = HOUSE_SHAPE_PRESETS.flatMap((preset) => {
    const def = HOUSE_TEMPLATE_DEFS.find((entry) => entry.id === preset.defId);
    if (!def) return [];
    return [builtInCard(project, def, {
      testid: `db-village-shape-${def.id}`,
      active: record.clonedFrom === def.id,
      onPick: () => applyBuiltInValues(record, def, rerender),
    })];
  });
  return [
    el("div", { class: "db-village-shape-grid", dataset: { testid: "db-village-shape-palette" }, children: cards }),
    el("p", {
      class: "db-ws-usage",
      text: "모양을 고르면 날개·크기·층수·재료가 그 형태의 값으로 바뀝니다. 이름·ID·메모는 그대로 남습니다.",
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

// ---------------------------------------------------------------------------
// 그림
//
// 이 탭이 오래 어려웠던 이유는 값이 아니라 그림이 없어서였다. 날개 x/y/w/h 를 숫자로
// 넣어도 그게 ㄱ자인지 ㄷ자인지 알 길이 없었고, 추상 격자는 바닥 꼴만 알려주고 층수·
// 재료·창문은 못 보여줬다. 그래서 실제 시공 함수로 타일을 찍어 보여준다.
//
// 재료(합본 마을 칩셋)가 없는 프로젝트도 있으므로 그림은 **덧붙임**이다 — 못 그리면
// 예전 추상 격자로 내려앉고, 탭 기능은 하나도 잃지 않는다.
// ---------------------------------------------------------------------------

/** 히어로/카드 자리의 집 그림. 재료를 못 구하면 추상 격자로 내려앉는다. */
function housePicture(
  project: Project,
  record: VillageHouseTemplateRecord,
  size: HousePreviewSize,
  options: { readonly testid?: string; readonly label?: string } = {},
): HTMLElement {
  if (!houseKitTileset(project)) return footprintPreview(record, { large: size === "hero" });
  return createHousePreview(record, project, size, options);
}

/** 목록 행 32px 썸네일. `listRow` 가 `db-list-thumb` 를 자기 노드에 붙이므로 감싼다. */
function rowThumb(project: Project, record: VillageHouseTemplateRecord): HTMLElement | undefined {
  if (!houseKitTileset(project)) return undefined;
  return el("span", {
    class: "db-village-row-thumb",
    children: [createHousePreview(record, project, "card", {
      testid: `db-village-template-thumb-${record.id}`,
      label: `${record.name || record.id} 집 그림`,
    })],
  });
}

/** 내장 정의를 그림 카드로. 카드 = 그림 + 이름 + 치수. 누르면 그 값을 그대로 가져온다. */
function builtInCard(
  project: Project,
  def: (typeof HOUSE_TEMPLATE_DEFS)[number],
  options: { readonly testid: string; readonly active?: boolean; readonly onPick: () => void },
): HTMLElement {
  const record = templateRecordFromDef(def, def.id, def.name);
  const marks = [`${def.w}×${def.h}`];
  if (def.stories && def.stories > 1) marks.push(`${def.stories}층`);
  if (def.lowWall) marks.push("낮은 벽");
  if (def.roofDeck) marks.push("옥상");
  return el("button", {
    class: `db-village-shape-card${options.active ? " active" : ""}`,
    attrs: {
      type: "button",
      title: `${def.name} · ${def.id} · ${def.w}×${def.h}칸`,
      "aria-pressed": options.active ? "true" : "false",
    },
    dataset: { testid: options.testid, villageDefId: def.id },
    on: { click: options.onPick },
    children: [
      el("span", {
        class: "db-village-shape-media",
        children: [housePicture(project, record, "card", {
          testid: `${options.testid}-shot`,
          label: `${def.name} 집 그림`,
        })],
      }),
      el("span", { class: "db-village-shape-name", text: def.name }),
      el("span", { class: "db-village-shape-meta", text: marks.join(" · ") }),
    ],
  });
}

/**
 * 내장 34종 그림 갤러리. 예전에는 `직사각 대 (8×7) · rect-large` 같은 글자 목록이었다 —
 * 이름으로는 무엇이 다른지 알 수 없어서 사실상 고를 수 없는 목록이었다.
 *
 * 묶음 이름은 id 접두사에서 유도한다(`houseTemplateGroupLabel`). 카탈로그 파일에 분류
 * 필드를 새로 넣으면 `houseTemplates.baseline.json` 고정 덤프가 흔들린다.
 */
function builtInImportFields(
  project: Project,
  record: VillageHouseTemplateRecord,
  rerender: () => void,
): HTMLElement[] {
  const groups = new Map<string, (typeof HOUSE_TEMPLATE_DEFS)[number][]>();
  for (const def of HOUSE_TEMPLATE_DEFS) {
    const label = houseTemplateGroupLabel(def.id);
    const bucket = groups.get(label);
    if (bucket) bucket.push(def);
    else groups.set(label, [def]);
  }
  return [
    el("div", {
      class: "db-village-import-gallery",
      dataset: { testid: "db-village-import-gallery" },
      children: [...groups].map(([label, defs]) => el("div", {
        class: "db-village-import-group",
        children: [
          el("h5", { class: "db-village-import-group-title", text: label }),
          el("div", {
            class: "db-village-shape-grid",
            children: defs.map((def) => builtInCard(project, def, {
              testid: `db-village-import-${def.id}`,
              active: record.clonedFrom === def.id,
              onPick: () => applyBuiltInValues(record, def, rerender),
            })),
          }),
        ],
      })),
    }),
    el("p", {
      class: "db-ws-usage",
      text: "누르면 그 형태의 날개·크기·층수·재료를 그대로 베껴 옵니다. ID 가 내장과 다르면 카탈로그에 더해지고, 같으면 내장을 덮습니다.",
    }),
  ];
}

/** 내장 정의의 기하·재료만 레코드에 붓는다. 이름·ID·메모는 사용자 것이므로 건드리지 않는다. */
function applyBuiltInValues(
  record: VillageHouseTemplateRecord,
  def: (typeof HOUSE_TEMPLATE_DEFS)[number],
  rerender: () => void,
): void {
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
          title: "마을 설계서를 만들어 보세요",
          body: "집의 생김새·길·물과 숲을 한곳에서 정합니다. AI가 지킬 고정값과 바꿔도 되는 범위를 선택하세요.",
          action: { label: "+ 마을 설계서 추가", kind: "primary", testid: "db-village-preset-blank-create", onClick: () => createRecord(rerender) },
          testid: "db-village-preset-blank",
        }),
        el("div", {
          class: "db-ws-stack db-village-inspector",
          children: [span(sectionCard({
            title: "마을 원형에서 시작하기",
            hint: "분위기를 고른 뒤 집과 길, 자연 설정을 설계서에서 조정합니다",
            children: archetypeGallery(rerender),
            testid: "db-village-archetype-gallery",
          }))],
        }),
      ],
      testid: "db-village-detail-pane",
    });
  }

  if (record.design) {
    return renderVillageDesignDetail(project, record, {
      basics: presetBasicFields(record, records, rerender),
      scale: presetScaleFields(project, record, rerender),
      road: presetRoadFields(project, record, rerender),
      layout: presetLayoutFields(project, record, rerender),
      templates: presetTemplateWhitelist(project, record, rerender),
      archetype: archetypeImportFields(record, rerender),
      preview: presetPreviewFields(project, record),
      patch: (patch) => {
        recordProjectSnapshot("마을 설계서 변경");
        patchPreset(record.id, () => patch);
        rerender();
      },
      setDefault: () => {
        recordProjectSnapshot("기본 마을 설계서 지정");
        store.update(draft => {
          if (draft.defaultVillagePresetId === record.id) delete draft.defaultVillagePresetId;
          else draft.defaultVillagePresetId = record.id;
        }, { scope: "database", collection: "villagePresets", label: "기본 마을 설계서 지정" });
        rerender();
      },
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
      el("button", {
        class: "db-ws-btn db-ws-btn-primary", text: "마을 설계서로 전환", attrs: { type: "button" },
        dataset: { testid: "db-village-design-convert" },
        on: { click: () => {
          recordProjectSnapshot("마을 설계서로 전환");
          patchPreset(record.id, () => asVillageDesign(record));
          rerender();
        } },
      }),
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
          span(sectionCard({
            title: "미리보기",
            hint: `실제 시공기를 ${PRESET_PREVIEW_SIZE}×${PRESET_PREVIEW_SIZE} 초안에 돌려 그립니다 — 화면이 상상해 그리지 않습니다`,
            children: presetPreviewFields(project, record),
            testid: "db-village-preset-preview-card",
          })),
          sectionCard({
            title: "기본 정보",
            hint: "ID 는 AI 가 지목하는 이름입니다",
            children: presetBasicFields(record, records, rerender),
            testid: "db-village-preset-basics",
          }),
          sectionCard({
            title: "규모",
            hint: "비워 두면 맵 넓이와 씨앗값으로 정합니다",
            children: presetScaleFields(project, record, rerender),
            testid: "db-village-preset-scale",
          }),
          sectionCard({
            title: "길",
            hint: "폭 2~3칸 · 구불거림 0.35~1",
            children: presetRoadFields(project, record, rerender),
            testid: "db-village-preset-road",
          }),
          sectionCard({
            title: "배치와 분위기",
            children: presetLayoutFields(project, record, rerender),
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

/**
 * 프리셋 값(길 폭·광장 모양·마당 스타일…)은 서로 얽혀 있어서 항목별 설명을 읽어도 결과가
 * 그려지지 않는다. 그래서 진짜 시공기를 돌려 보여준다.
 *
 * 버튼을 눌러야 돈다: 40×40 한 판은 도로 탐색까지 도는 무거운 계산이라 값을 고칠 때마다
 * 자동으로 돌리면 select 를 한 번 바꿀 때마다 화면이 멈춘다. 초안(structuredClone)에서만
 * 돌기 때문에 실제 프로젝트에는 맵이 생기지 않는다.
 */
function presetPreviewFields(project: Project, record: VillageLayoutPresetRecord): HTMLElement[] {
  const stage = el("div", {
    class: "db-village-preset-stage",
    dataset: { testid: "db-village-preset-preview", previewState: "idle" },
  });
  const note = el("p", {
    class: "db-ws-usage",
    dataset: { testid: "db-village-preset-preview-note" },
    text: "「미리보기 만들기」를 누르면 이 프리셋으로 마을 한 판을 시공해 그림으로 보여줍니다. 초안에서만 돌기 때문에 프로젝트에는 맵이 생기지 않습니다.",
  });
  const warnings = el("details", { dataset: { testid: "db-village-preset-preview-warnings" } });
  warnings.hidden = true;

  const run = (): void => {
    clearChildren(stage);
    clearChildren(warnings);
    warnings.hidden = true;
    const result = buildPresetPreview(project, record.id, presetPreviewSeed);
    if (!result.ok) {
      stage.dataset.previewState = "none";
      note.textContent = `미리보기를 만들지 못했습니다 — ${result.reason}`;
      return;
    }
    stage.dataset.previewState = "ready";
    stage.append(createMapShot(result.map, result.tileset, {
      label: `${record.name || record.id} 마을 미리보기`,
      testid: "db-village-preset-shot",
      // 미리보기 판은 정사각(`PRESET_PREVIEW_SIZE`)이다 — 기본 4:3 캔버스에 그리면
      // 좌우에 빈 띠가 남아 그림이 작아 보인다.
      height: 320,
    }));
    const visibleWarnings = [...new Set(result.warnings.filter(message => !message.startsWith("[vperf]") && !message.startsWith("마을 프리셋 적용:") && !message.startsWith("상점가 지정:")).map(message => message.split(/tile_query| — 다시 보낼/)[0]!.trim()))];
    note.textContent = `씨앗 ${presetPreviewSeed} · 집 ${result.housesBuilt}채${visibleWarnings.length ? ` · 확인할 사항 ${visibleWarnings.length}건` : ""}`;
    if (visibleWarnings.length) {
      warnings.hidden = false;
      warnings.append(el("summary", { text: "시공 결과 자세히 보기" }), el("ul", { children: visibleWarnings.map(text => el("li", { text })) }));
    }
  };

  return [
    stage,
    el("div", {
      class: "db-village-wing-actions",
      children: [
        el("button", {
          class: "db-ws-btn db-ws-btn-primary",
          text: "미리보기 만들기",
          attrs: { type: "button" },
          dataset: { testid: "db-village-preset-preview-run" },
          on: { click: run },
        }),
        el("button", {
          class: "db-ws-btn db-ws-btn-ghost",
          text: "씨앗 바꾸기",
          attrs: { type: "button", title: "같은 프리셋도 씨앗값이 다르면 배치가 달라집니다" },
          dataset: { testid: "db-village-preset-preview-reseed" },
          on: {
            click: () => {
              presetPreviewSeed += 1;
              run();
            },
          },
        }),
      ],
    }),
    note,
    warnings,
  ];
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

function presetScaleFields(
  project: Project,
  record: VillageLayoutPresetRecord,
  rerender: () => void,
): HTMLElement[] {
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
    visualSelect({
      label: "바닥",
      testid: "db-village-preset-ground",
      value: record.groundTheme ?? UNSET,
      options: VILLAGE_GROUND_THEME_IDS.map((id) => ({ id, name: GROUND_LABEL[id] ?? id })),
      allowUnset: true,
      unsetLabel: "지정 안 함",
      mediaFor: (id) => createGroundThemePreview(id, project, {
        testid: id ? `db-village-preset-ground-${id}-shot` : "db-village-preset-ground-unset-shot",
        label: id === "snow" ? "눈 바닥" : id === "grass" ? "풀 바닥" : "지정 안 함",
      }),
      onChange: (value) => {
        recordProjectSnapshot("프리셋 바닥 변경");
        patchPreset(record.id, () => ({
          groundTheme: value === "grass" || value === "snow" ? value : undefined,
        }));
        rerender();
      },
    }),
  ];
}

function presetRoadFields(
  project: Project,
  record: VillageLayoutPresetRecord,
  rerender: () => void,
): HTMLElement[] {
  return [
    presetMoodSelect(project, "길 재질", "db-village-preset-path-style", record.pathStyle, VILLAGE_PATH_STYLES, PATH_LABEL, "pathStyle", (value) => {
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

function presetLayoutFields(
  project: Project,
  record: VillageLayoutPresetRecord,
  rerender: () => void,
): HTMLElement[] {
  const kitOptions = ["mixed", ...MIXABLE_HOUSE_KIT_IDS] as const;
  const kitLabel: Record<string, string> = { mixed: "섞기" };
  for (const id of MIXABLE_HOUSE_KIT_IDS) kitLabel[id] = HOUSE_KITS[id].name;
  return [
    // plaza-ring / street-grid / clusters 는 마을 전체 배치라 스크래치 스탬프로는 정직하게
    // 안 나온다. 전경은 「미리보기 만들기」(buildPresetPreview) 가 맡고, 옵션마다 돌리면
    // 카드 3장에 40×40 시공이 붙어 멈춘다. 그림 없이 select 로 둔다.
    optionalSelect("마을 배치", "db-village-preset-layout", record.settlementLayout, VILLAGE_LAYOUT_IDS, LAYOUT_LABEL, (value) => {
      recordProjectSnapshot("프리셋 마을 배치 변경");
      patchPreset(record.id, () => ({ settlementLayout: value }));
      rerender();
    }),
    presetMoodSelect(project, "광장 모양", "db-village-preset-plaza-style", record.plazaStyle, VILLAGE_PLAZA_STYLES, PLAZA_STYLE_LABEL, "plazaStyle", (value) => {
      recordProjectSnapshot("프리셋 광장 모양 변경");
      patchPreset(record.id, () => ({ plazaStyle: value }));
      rerender();
    }),
    presetMoodSelect(project, "광장 위치", "db-village-preset-plaza-layout", record.plazaLayout, VILLAGE_PLAZA_LAYOUTS, PLAZA_LAYOUT_LABEL, "plazaLayout", (value) => {
      recordProjectSnapshot("프리셋 광장 위치 변경");
      patchPreset(record.id, () => ({ plazaLayout: value }));
      rerender();
    }),
    presetMoodSelect(project, "마당", "db-village-preset-yard", record.yardStyle, VILLAGE_YARD_STYLES, YARD_LABEL, "yardStyle", (value) => {
      recordProjectSnapshot("프리셋 마당 변경");
      patchPreset(record.id, () => ({ yardStyle: value }));
      rerender();
    }),
    presetMoodSelect(project, "바깥 나무", "db-village-preset-edge-trees", record.edgeTrees, VILLAGE_EDGE_TREE_STYLES, EDGE_TREE_LABEL, "edgeTrees", (value) => {
      recordProjectSnapshot("프리셋 바깥 나무 변경");
      patchPreset(record.id, () => ({ edgeTrees: value }));
      rerender();
    }),
    presetMoodSelect(project, "재료 킷", "db-village-preset-kit-mix", record.kitMix, kitOptions, kitLabel, "kitMix", (value) => {
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
            // 그림은 덧붙임이다 — 칩셋이 없거나 스탬프가 거절되면 canvas 가 previewState=none
            // 으로 남을 뿐, 체크박스·이름은 그대로 동작한다.
            createHousePreview({
              id: template.id,
              name: template.name,
              w: template.w,
              h: template.h,
              stories: template.stories ?? 1,
              ...(template.lowWall ? { lowWall: true } : {}),
              ...(template.kitId ? { kitId: template.kitId } : record.kitMix && record.kitMix !== "mixed" ? { kitId: record.kitMix } : {}),
              ...(template.roofDeck ? { roofDeck: true } : {}),
              wings: template.wings.map((wing) => ({
                x: wing.x,
                y: wing.y,
                w: wing.w,
                h: wing.h,
                ...(wing.stories === undefined ? {} : { stories: wing.stories }),
              })),
            }, project, "card", {
              testid: `db-village-preset-template-${template.id}-shot`,
              label: `${template.name} 집 그림`,
            }),
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

/**
 * 원형 전경 그림. 집 한 채와 달리 전경은 도로 탐색·마당·바깥 숲까지 도는 무거운 시공이라
 * 브라우저에서 6장을 즉석에서 돌리지 않는다 — `scripts/bake-village-archetype-previews.mts`
 * 가 실제 `author_village` 결과를 굽고 여기서는 그 PNG 만 읽는다.
 * 파일이 없으면 `error` 로 떨어지므로 카드가 그림 자리를 접고 글자만 남는다.
 */
function archetypeShot(archetype: VillageArchetype): HTMLElement {
  const image = el("img", {
    class: "db-village-archetype-shot",
    attrs: {
      src: villageArchetypeShotUrl(archetype.id),
      alt: `${archetype.name} 마을 전경`,
      loading: "lazy",
      decoding: "async",
    },
    dataset: { testid: `db-village-archetype-shot-${archetype.id}` },
  }) as HTMLImageElement;
  const frame = el("span", { class: "db-village-archetype-media", children: [image] });
  image.addEventListener("error", () => { frame.hidden = true; });
  return frame;
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
          archetypeShot(archetype),
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
  if (archetypeImportPresetId !== record.id || !villageArchetypeById(archetypeImportSourceId)) {
    archetypeImportPresetId = record.id;
    archetypeImportSourceId = VILLAGE_ARCHETYPES[0]!.id;
  }
  return [
    visualSelect({
      label: "마을 원형",
      testid: "db-village-archetype-source",
      value: archetypeImportSourceId,
      options: VILLAGE_ARCHETYPES.map((archetype) => ({
        id: archetype.id,
        name: archetype.name,
        meta: archetypeSummary(archetype),
      })),
      mediaFor: (id) => {
        const archetype = villageArchetypeById(id ?? "") ?? VILLAGE_ARCHETYPES[0]!;
        return archetypeShot(archetype);
      },
      onChange: (id) => {
        if (!id) return;
        archetypeImportSourceId = id;
        rerender();
      },
    }),
    el("div", {
      class: "db-village-wing-actions",
      children: [el("button", {
        class: "db-ws-btn db-ws-btn-ghost",
        text: "값 가져오기",
        attrs: { type: "button" },
        dataset: { testid: "db-village-archetype-apply" },
        on: {
          click: () => {
            const archetype = villageArchetypeById(archetypeImportSourceId);
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
    draft.villagePresets = [...(draft.villagePresets ?? []), asVillageDesign(presetRecordFromArchetype(archetype, id))];
    draft.defaultVillagePresetId ??= id;
  }, { scope: "database", collection: "villagePresets", label: "마을 설계서 변경" });
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

function presetMoodSelect<T extends string>(
  project: Project,
  label: string,
  testid: string,
  value: string | undefined,
  options: readonly T[],
  labels: Readonly<Record<string, string>>,
  field: MoodPreviewField,
  onChange: (value: T | undefined) => void,
): HTMLElement {
  return visualSelect({
    label,
    testid,
    value: typeof value === "string" && (options as readonly string[]).includes(value) ? value : UNSET,
    options: options.map((id) => ({ id, name: labels[id] ?? id })),
    allowUnset: true,
    unsetLabel: "지정 안 함",
    mediaFor: (id) => createMoodPreview(project, {
      field,
      id,
      testid,
      label: id ? (labels[id] ?? id) : "지정 안 함",
    }),
    onChange: (next) => onChange(next as T | undefined),
  });
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
    draft.villagePresets = records.map((entry, at) => {
      if (at !== index) return entry;
      const next = prune({ ...entry, ...patch(entry) });
      if (next.design) next.design = { ...next.design, revision: (entry.design?.revision ?? 0) + 1 };
      if (draft.defaultVillagePresetId === id) draft.defaultVillagePresetId = next.id;
      return next;
    });
  }, { scope: "database", collection: "villagePresets", label: "마을 설계서 변경" });
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
      draft.villagePresets = [...(draft.villagePresets ?? []), asVillageDesign({ ...blankPresetRecord(id), name: "새 마을 설계서" })];
      draft.defaultVillagePresetId ??= id;
    }, { scope: "database", collection: "villagePresets", label: "마을 설계서 변경" });
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
    }, { scope: "database", collection: "villagePresets", label: "마을 설계서 변경" });
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
      if (draft.defaultVillagePresetId === id) delete draft.defaultVillagePresetId;
    }, { scope: "database", collection: "villagePresets", label: "마을 설계서 변경" });
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
  }, { scope: "database", collection: "villagePresets", label: "마을 설계서 변경" });
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
