import type { Project } from "@/project/types";
import type { VillageDesign, VillageLayoutPresetRecord } from "@/project/types/village";
import { VILLAGE_DESIGN_GROUP_LABELS, VILLAGE_DESIGN_GROUPS } from "@/project/villageDesign";
import { villageObjectDesignControls } from "./villageObjectDesignControls";
import { el } from "@/util/dom";
import { field, numberField, selectField } from "./databaseControls";
import { detailPane, sectionCard } from "./databaseWorkspace";

type Tab = "mood" | "houses" | "layout" | "nature" | "interior" | "residents";
const TABS: readonly [Tab, string][] = [["mood", "분위기"], ["houses", "집의 생김새"], ["layout", "길과 배치"], ["nature", "물과 숲"], ["interior", "실내 연결"], ["residents", "주민과 이야기"]];
let activeTab: Tab = "houses";

export interface VillageDesignControls {
  basics: HTMLElement[];
  scale: HTMLElement[];
  road: HTMLElement[];
  layout: HTMLElement[];
  templates: HTMLElement[];
  archetype: HTMLElement[];
  preview: HTMLElement[];
  patch: (patch: Partial<VillageLayoutPresetRecord>) => void;
  setDefault: () => void;
}

const note = (text: string): HTMLElement => el("p", { class: "db-ws-usage", text });
const button = (label: string, testid: string, click: () => void): HTMLButtonElement => el("button", {
  class: "db-ws-btn", attrs: { type: "button" }, text: label, dataset: { testid }, on: { click },
}) as HTMLButtonElement;

/** 기존 컨트롤을 설계서에 모은다. 편집·저장은 공용 store 경로를 사용한다. */
export function renderVillageDesignDetail(project: Project, preset: VillageLayoutPresetRecord, controls: VillageDesignControls): HTMLElement {
  const design = preset.design!;
  const update = (patch: Partial<VillageDesign>): void => controls.patch({ design: { ...design, ...patch } });
  const policy = (group: keyof VillageDesign["policies"]): HTMLElement => selectField(
    `${VILLAGE_DESIGN_GROUP_LABELS[group]} 결정권`, `db-village-design-policy-${group}`, design.policies[group],
    [{ id: "fixed", name: "설계서에 고정" }, { id: "free", name: "AI가 변경 가능" }],
    value => update({ policies: { ...design.policies, [group]: value as "fixed" | "free" } }),
  );
  const card = (title: string, children: HTMLElement[], testid: string): HTMLElement => sectionCard({ title, children, testid });
  const stories = el("div", { class: "db-village-design-stories", children: ([1, 2, 3] as const).map(floor => {
    const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid: `db-village-design-stories-${floor}` } }) as HTMLInputElement;
    input.checked = design.stories.includes(floor);
    input.addEventListener("change", () => {
      const selected = input.checked ? [...design.stories, floor] : design.stories.filter(n => n !== floor);
      if (selected.length === 0) { input.checked = true; return; }
      update({ stories: selected });
    });
    return el("label", { children: [input, el("span", { text: `${floor}층` })] });
  }) });
  const interiorInput = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "db-village-design-interior" } }) as HTMLInputElement;
  interiorInput.checked = design.interior;
  interiorInput.disabled = !!design.objectVillage;
  interiorInput.addEventListener("change", () => update({ interior: interiorInput.checked }));
  const canon = project.worldCanon;
  const panels: Record<Tab, HTMLElement[]> = {
    mood: [card("설계서 이름과 설명", controls.basics, "db-village-design-basics"), card("분위기의 출발점", controls.archetype, "db-village-design-archetypes"), controls.scale[2]!],
    houses: [policy("appearance"), ...(design.objectVillage ? villageObjectDesignControls(project, design, update) : [card("마을 전체의 외벽과 지붕", [controls.layout[5]!, note("선택한 재료와 호환되는 집 형태만 사용합니다. 형태에 고정된 재료가 다르면 후보에서 제외합니다.")], "db-village-design-material"), card("허용 층수", [stories], "db-village-design-floor"), card("허용할 집 형태", controls.templates, "db-village-design-templates")]), ...(design.objectVillage ? [card("허용 층수", [stories], "db-village-design-floor")] : [])],
    layout: [policy("layout"), card("집 수와 AI의 범위", countControls(preset, controls.patch), "db-village-design-count"), card("길", controls.road, "db-village-design-roads"), card("광장과 마당", controls.layout.slice(0, 4), "db-village-design-layout")],
    nature: design.objectVillage ? [policy("nature"), note("소형 집 배치는 길과 건물을 보호하며 테두리와 빈터에 숲을 채웁니다. 243 계열 풀밭을 쓰고, 호수는 우하단의 길을 피해 가로로 긴 비대칭 해안으로 만듭니다. 이 구성의 호수 면적은 3.5~8%입니다.")] : [policy("nature"), ...natureControls(design, update), card("마을 테두리 나무", [controls.layout[4]!], "db-village-design-edge"), note("숲 구역과 마을 테두리 나무는 별도입니다. 숲 구역이 없어도 테두리 나무는 남습니다. 기본 생성 규칙의 수치를 이 설계서에서 재정의합니다.")],
    interior: [policy("interior"), card("들어갈 수 있는 집", [field("집마다 실내를 만들고 문으로 연결", interiorInput), note("켜면 현재 집 시공기가 실내를 만들고 왕복 출입 이벤트를 연결합니다. 시설 종류별 구성은 타일셋의 공용 개념 꾸러미에서 관리합니다.")], "db-village-design-interiors")],
    residents: [policy("residents"), card("마을의 주민 수", [controls.scale[1]!, note("인원은 설계서가 정합니다. AI 캐스트 라이터가 이름·역할·대사를 작성하고, 기존 주민과 세계관을 참조합니다.")], "db-village-design-residents"), card("이 세계에서 가져오는 맥락", [note(canon?.name ? `세계: ${canon.name}` : "아직 「이 세계」를 작성하지 않았습니다."), note(canon?.premise || "세계관의 전제와 금지 요소는 자료집 「이 세계」에서 정합니다."), ...(canon?.absences?.length ? [note(`등장하지 않는 것: ${canon.absences.join(" · ")}`)] : [])], "db-village-design-canon")],
  };
  const pane = el("div", { class: "db-village-design-fields" });
  const nav = el("nav", { class: "db-village-design-tabs", attrs: { "aria-label": "마을 설계서 항목" } });
  const show = (tab: Tab): void => {
    activeTab = tab;
    pane.replaceChildren(...panels[tab]);
    for (const child of Array.from(nav.children)) {
      const selected = (child as HTMLElement).dataset.section === tab;
      child.classList.toggle("active", selected);
      child.setAttribute("aria-pressed", String(selected));
    }
  };
  for (const [tab, label] of TABS) {
    const entry = button(label, `db-village-design-tab-${tab}`, () => show(tab));
    entry.dataset.section = tab;
    nav.append(entry);
  }
  const defaultButton = button(project.defaultVillagePresetId === preset.id ? "기본 설계서 해제" : "기본 설계서로 사용", "db-village-design-default", controls.setDefault);
  defaultButton.setAttribute("aria-pressed", String(project.defaultVillagePresetId === preset.id));
  const policies = VILLAGE_DESIGN_GROUPS.map(group => el("div", { class: "db-village-design-summary-row", children: [el("span", { text: VILLAGE_DESIGN_GROUP_LABELS[group] }), el("strong", { text: design.policies[group] === "fixed" ? "고정" : "AI 자유" })] }));
  const request = el("textarea", {
    attrs: { readonly: "true", rows: "3", "aria-label": "AI에게 전달할 마을 생성 요청문" },
    value: `마을 설계서 「${preset.name}」(presetId: ${preset.id})로 현재 선택 영역에 마을을 만들어줘. 고정값은 유지하고, 공간이 부족하면 먼저 알려줘.`,
    dataset: { testid: "db-village-design-request" },
  });
  const sidebar = el("aside", { class: "db-village-design-preview", children: [
    el("h3", { text: "이 설계서의 실제 모습" }), ...controls.preview,
    el("h3", { text: "AI가 지킬 약속" }), ...policies,
    note(`집 수: ${design.houseCount.mode === "free" ? "AI 자유" : design.houseCount.mode === "fixed" ? `${design.houseCount.min}채 고정` : `${design.houseCount.min}~${design.houseCount.max}채`}`),
    note("고정값과 다른 요청은 시공 전에 멈추고 차이를 알립니다. 데이터베이스에서 값을 바꾸거나 설계서를 복제해 새 안을 만드세요."),
    el("h3", { text: "AI에게 이 설계서로 요청" }), request,
  ] });
  show(activeTab);
  return detailPane({ body: [
    el("header", { class: "db-village-design-heading", children: [el("div", { children: [el("small", { text: `마을 설계서 · 개정 ${design.revision}` }), el("h2", { text: preset.name || preset.id })] }), defaultButton] }),
    el("div", { class: "db-village-design-body", dataset: { testid: "db-village-design-studio" }, children: [el("div", { class: "db-village-design-editor", children: [nav, pane] }), sidebar] }),
  ], testid: "db-village-detail-pane" });
}

function countControls(preset: VillageLayoutPresetRecord, patch: VillageDesignControls["patch"]): HTMLElement[] {
  const design = preset.design!;
  const count = design.houseCount;
  const change = (next: VillageDesign["houseCount"]): void => patch({ houseCount: next.min, design: { ...design, houseCount: next } });
  return [
    selectField("집 수 결정", "db-village-design-count-policy", count.mode, [{ id: "fixed", name: "정한 수로 고정" }, { id: "range", name: "범위 안에서 AI가 선택" }, { id: "free", name: "AI에게 맡기기" }], value => change({ ...count, mode: value as typeof count.mode, max: value === "fixed" ? count.min : count.max })),
    numberField(count.mode === "range" ? "최소 집 수" : "집 수", "db-village-design-count-min", count.min, value => change({ ...count, min: value, max: count.mode === "fixed" ? value : Math.max(value, count.max) }), { min: 1, max: 32, step: 1 }),
    ...(count.mode === "range" ? [numberField("최대 집 수", "db-village-design-count-max", count.max, value => change({ ...count, max: value, min: Math.min(value, count.min) }), { min: 1, max: 32, step: 1 })] : []),
    note("범위를 벗어나거나 들어갈 공간이 없으면 집을 몰래 줄이지 않습니다. 미리보기에서 실제 배치 가능성을 확인하세요."),
  ];
}

function natureControls(design: VillageDesign, update: (patch: Partial<VillageDesign>) => void): HTMLElement[] {
  const nature = design.nature;
  const set = <K extends keyof VillageDesign["nature"]>(key: K, value: VillageDesign["nature"][K]): void => update({ nature: { ...nature, [key]: value } });
  const directions = [{ id: "east", name: "동쪽" }, { id: "west", name: "서쪽" }, { id: "north", name: "북쪽" }, { id: "south", name: "남쪽" }];
  return [sectionCard({ title: "물 풍경", testid: "db-village-design-water", children: [
    selectField("수역", "db-village-design-water-kind", nature.water, [{ id: "none", name: "물 없이" }, { id: "river", name: "강" }, { id: "lake", name: "호수" }, { id: "river-lake", name: "강과 호수" }], value => set("water", value as typeof nature.water)),
    selectField("물 방향", "db-village-design-water-side", nature.waterSide, directions, value => set("waterSide", value as typeof nature.waterSide)),
    numberField("강 폭 비율 (%)", "db-village-design-river-width", Math.round(nature.riverWidthRatio * 100), value => set("riverWidthRatio", value / 100), { min: 5, max: 45, step: 1 }),
    numberField("호수 지름 비율 (%)", "db-village-design-lake-size", Math.round(nature.lakeSizeRatio * 100), value => set("lakeSizeRatio", value / 100), { min: 5, max: 45, step: 1 }),
  ] }), sectionCard({ title: "숲 구역", testid: "db-village-design-forest", children: [
    selectField("숲 밀도", "db-village-design-forest-density", nature.forest, [{ id: "none", name: "숲 구역 없음" }, { id: "sparse", name: "드문드문" }, { id: "normal", name: "보통" }, { id: "dense", name: "빽빽하게" }, { id: "impassable", name: "통행하기 어려운 숲" }], value => set("forest", value as typeof nature.forest)),
    selectField("숲 방향", "db-village-design-forest-side", nature.forestSide, directions, value => set("forestSide", value as typeof nature.forestSide)),
    numberField("숲 깊이 비율 (%)", "db-village-design-forest-depth", Math.round(nature.forestDepthRatio * 100), value => set("forestDepthRatio", value / 100), { min: 5, max: 45, step: 1 }),
  ] })];
}
