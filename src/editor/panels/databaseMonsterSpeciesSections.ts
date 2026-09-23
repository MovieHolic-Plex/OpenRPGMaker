// editor/panels/databaseMonsterSpeciesSections.ts
//
// 종족 상세를 「기본 · 포획 · 성장 · 진화 · 연결」 구역 탭으로 나눈다.
//
// 공용 inspectorTabs() 를 쓰지 않는 이유: 그쪽은 처음 열 때 패널을 **지연 생성**한다. 종족 테스트
// (qa-enemies.spec.ts·단위 테스트)는 모든 카드의 칸을 testid 로 바로 찾으므로, 여기서는 다섯 패널을
// 전부 미리 만들어 두고 `hidden` 으로만 가린다. 고른 구역은 모듈 변수에 남겨 편집 뒤 다시 그려도
// 「기본」으로 튀지 않는다.
import { isDatabaseUxVisible, uxLevel, type DatabaseUxLevel } from "@/editor/panels/databaseUxLevel";
import { el } from "@/util/dom";

export type MonsterSpeciesSectionId = "basic" | "capture" | "growth" | "evolution" | "links";

export type MonsterSpeciesSection = {
  readonly id: MonsterSpeciesSectionId;
  readonly label: string;
  /** 탭 라벨 옆 짧은 요약(「보통」, 「스킬 2」 …). */
  readonly summary?: string;
  readonly ux?: DatabaseUxLevel;
  readonly children: readonly HTMLElement[];
};

let activeSection: MonsterSpeciesSectionId = "basic";

export function getMonsterSpeciesSection(): MonsterSpeciesSectionId {
  return activeSection;
}

export function setMonsterSpeciesSection(id: MonsterSpeciesSectionId): void {
  activeSection = id;
}

export type MonsterSpeciesSectionsHandle = {
  readonly element: HTMLElement;
  readonly show: (id: MonsterSpeciesSectionId, options?: { readonly focus?: boolean }) => void;
  /** 탭 요약만 다시 칠한다(편집 뒤 전체를 다시 그리지 않고). */
  readonly setSummary: (id: MonsterSpeciesSectionId, summary: string) => void;
};

export function monsterSpeciesSections(sections: readonly MonsterSpeciesSection[]): MonsterSpeciesSectionsHandle {
  const tabs = new Map<MonsterSpeciesSectionId, HTMLButtonElement>();
  const summaries = new Map<MonsterSpeciesSectionId, HTMLElement>();
  const panels = new Map<MonsterSpeciesSectionId, HTMLElement>();
  const reachable = (section: MonsterSpeciesSection): boolean => !section.ux || isDatabaseUxVisible(section.ux);

  for (const section of sections) {
    const summary = el("span", { class: "db-monster-species-section-summary", text: section.summary ?? "" });
    summaries.set(section.id, summary);
    const tab = el("button", {
      class: "db-monster-species-section-tab",
      attrs: {
        type: "button",
        role: "tab",
        id: `db-monster-species-section-tab-${section.id}`,
        "aria-controls": `db-monster-species-section-${section.id}`,
      },
      dataset: { testid: `db-monster-species-section-tab-${section.id}`, sectionId: section.id },
      children: [el("span", { class: "db-monster-species-section-label", text: section.label }), summary],
    }) as HTMLButtonElement;
    if (section.ux) uxLevel(tab, section.ux);
    tab.addEventListener("click", () => show(section.id));
    tab.addEventListener("keydown", (event: KeyboardEvent) => onKeydown(event, section.id));
    tabs.set(section.id, tab);

    const panel = el("div", {
      class: "db-monster-species-section-panel",
      attrs: {
        role: "tabpanel",
        id: `db-monster-species-section-${section.id}`,
        "aria-labelledby": `db-monster-species-section-tab-${section.id}`,
      },
      dataset: { testid: `db-monster-species-section-${section.id}`, sectionId: section.id },
      children: [...section.children],
    });
    panels.set(section.id, panel);
  }

  const show = (id: MonsterSpeciesSectionId, options?: { readonly focus?: boolean }): void => {
    const target = sections.find((section) => section.id === id && reachable(section)) ?? sections[0];
    if (!target) return;
    activeSection = target.id;
    for (const section of sections) {
      const selected = section.id === target.id;
      const tab = tabs.get(section.id)!;
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      tab.setAttribute("tabindex", selected ? "0" : "-1");
      tab.classList.toggle("active", selected);
      panels.get(section.id)!.hidden = !selected;
    }
    if (options?.focus) tabs.get(target.id)?.focus();
  };

  const onKeydown = (event: KeyboardEvent, from: MonsterSpeciesSectionId): void => {
    const order = sections.filter(reachable).map((section) => section.id);
    const index = order.indexOf(from);
    if (index < 0) return;
    let next: MonsterSpeciesSectionId | undefined;
    if (event.key === "ArrowRight") next = order[(index + 1) % order.length];
    else if (event.key === "ArrowLeft") next = order[(index - 1 + order.length) % order.length];
    else if (event.key === "Home") next = order[0];
    else if (event.key === "End") next = order[order.length - 1];
    if (!next) return;
    event.preventDefault();
    show(next, { focus: true });
  };

  const strip = el("div", {
    class: "db-monster-species-section-tabs",
    attrs: { role: "tablist", "aria-label": "종족 설정 구역" },
    dataset: { testid: "db-monster-species-section-tabs" },
    children: [...tabs.values()],
  });
  const element = el("div", {
    class: "db-monster-species-sections",
    children: [strip, ...panels.values()],
  });
  show(activeSection);
  return {
    element,
    show,
    setSummary: (id, summary) => {
      const node = summaries.get(id);
      if (node) node.textContent = summary;
    },
  };
}
