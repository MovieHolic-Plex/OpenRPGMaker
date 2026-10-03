import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { switchDatabaseActiveTab } from "@/editor/panels/database";
import { currentEnemy, enemyGraphicVisual } from "@/editor/panels/databaseEnemyRecordSupport";
import { renderEnemyPixelPreview, type EnemyPixelPreview } from "@/editor/panels/databaseEnemyPixelPreview";
import { recordDetailSection, setRecordDetailSection, setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { store } from "@/project/store";
import type { EnemyRecord } from "@/project/types";
import { el } from "@/util/dom";

export type EnemyInspectorSection = { id: string; label: string; cards: HTMLElement[] };

/** Local UI state only. Every field keeps its existing databaseActions mutation path. */
export function renderEnemyStudio(record: EnemyRecord, sections: EnemyInspectorSection[], actions: HTMLElement): HTMLElement {
  const stage = enemyStage(record);
  const pixel = enemyPixelSlot(record);
  stage.refresh(!pixel.element.hidden);
  const tabs = el("div", { class: "db-enemy-inspector-tabs db-ws-section-tabs", attrs: { role: "tablist", "aria-label": "몬스터 속성" } });
  const panels = el("div", { class: "db-enemy-inspector-body" });
  const buttons: HTMLButtonElement[] = [];
  const bodies: HTMLElement[] = [];
  const select = (id: string): void => {
    setRecordDetailSection(record.id, id);
    sections.forEach((section, index) => {
      const selected = section.id === id;
      buttons[index].setAttribute("aria-selected", String(selected));
      buttons[index].tabIndex = selected ? 0 : -1;
      bodies[index].hidden = !selected;
    });
    panels.scrollTop = 0;
  };
  for (const section of sections) {
    const id = `db-enemy-section-${section.id}`;
    const button = el("button", {
      class: "db-ws-section-tab",
      text: section.label,
      attrs: { type: "button", role: "tab", id: `${id}-tab`, "aria-controls": id },
      dataset: { testid: `${id}-tab` },
      on: { click: () => select(section.id) },
    });
    button.addEventListener("keydown", (event) => {
      const index = buttons.indexOf(button);
      const next = event.key === "ArrowRight" ? (index + 1) % sections.length
        : event.key === "ArrowLeft" ? (index + sections.length - 1) % sections.length
          : event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault();
      select(sections[next].id);
      buttons[next].focus();
    });
    const body = el("section", {
      class: "db-enemy-inspector-section",
      attrs: { id, role: "tabpanel", "aria-labelledby": `${id}-tab` },
      dataset: { testid: id },
      children: section.cards,
    });
    buttons.push(button);
    bodies.push(body);
    tabs.append(button);
    panels.append(body);
  }
  const selected = recordDetailSection(record.id);
  select(sections.some((entry) => entry.id === selected) ? selected : sections[0].id);
  const references = el("details", { class: "db-enemy-references", dataset: { testid: "db-enemy-references" } });
  const refreshReferences = (): void => {
    const live = currentEnemy(record);
    const project = store.getCurrent();
    const links: HTMLElement[] = [];
    const link = (label: string, collection: "troops" | "items" | "skills", id: string): HTMLElement => el("button", {
      class: "db-enemy-reference",
      text: label,
      attrs: { type: "button", title: `${label} 편집 열기` },
      on: { click: (event) => {
        const root = (event.currentTarget as HTMLElement).closest<HTMLElement>(".database-modal-body");
        if (!root) return;
        setSelectedRecordId(collection, id);
        switchDatabaseActiveTab(collection, root);
      } },
    });
    for (const troop of project.database.troops) {
      const members = troop.members?.length ? troop.members.map((member) => member.enemyId) : troop.enemyIds;
      if (members.includes(record.id)) links.push(link(`적 그룹 · ${troop.name}`, "troops", troop.id));
    }
    const item = project.database.items.find((entry) => entry.id === live.rewards.dropItemId);
    if (item) links.push(link(`드롭 · ${item.name}`, "items", item.id));
    for (const id of new Set(live.actions.map((action) => action.skillId))) {
      const skill = project.database.skills.find((entry) => entry.id === id);
      if (skill) links.push(link(`스킬 · ${skill.name}`, "skills", id));
    }
    references.replaceChildren(
      el("summary", { text: `연결된 데이터 · ${links.length}` }),
      ...(links.length ? links : [el("p", { text: "연결된 적 그룹·스킬·드롭 아이템이 없습니다." })]),
    );
  };
  refreshReferences();
  const refresh = (): void => {
    pixel.refresh();
    stage.refresh(!pixel.element.hidden);
    refreshReferences();
  };
  const root = el("div", {
    class: "db-enemy-studio",
    children: [
      el("div", { class: "db-enemy-stage-column", children: [pixel.element, stage.element, actions, references] }),
      el("aside", {
        class: "db-enemy-inspector",
        attrs: { "aria-label": "몬스터 속성 편집" },
        children: [el("h3", { class: "db-enemy-inspector-heading", text: "속성" }), tabs, panels],
      }),
    ],
  });
  // Input handlers have already updated the store when the event bubbles here.
  root.addEventListener("input", refresh);
  root.addEventListener("change", refresh);
  return root;
}

/**
 * retro2003 손도트 시트가 있는 몬스터의 도트 미리보기 카드 자리. 시트가 없으면 빈 자리(hidden)다.
 * 리소스·이름이 바뀔 때만 카드를 새로 그리고 옛 카드의 루프를 멈춘다.
 */
function enemyPixelSlot(record: EnemyRecord): { element: HTMLElement; refresh: () => void } {
  const slot = el("div", { class: "db-enemy-pixel-slot", dataset: { testid: "db-enemy-pixel-slot" } });
  let preview: EnemyPixelPreview | null = null;
  let key = "";
  const refresh = (): void => {
    const live = currentEnemy(record);
    const next = JSON.stringify([live.monsterResourceId, live.name]);
    if (next === key) return;
    key = next;
    preview?.stop();
    preview = renderEnemyPixelPreview(live);
    slot.replaceChildren(...(preview ? [preview.element] : []));
    slot.hidden = !preview;
  };
  refresh();
  return { element: slot, refresh };
}

/**
 * 정지 그림 미리보기. 도트 시트가 있는 몬스터는 아래 도트 미리보기 카드가 실제 전투 모습을 보여 주므로
 * 정지 그림은 숨기고 「시험 전투」 줄만 남긴다(2026-10-02 — 같은 몬스터가 두 번, 그중 하나는 게임과 다른 모습으로 떠 있었다).
 * 업로드 그림처럼 시트가 없는 몬스터만 정지 그림을 본다. 몬스터 대기 애니메이션 스트립은 #1872 에서 지워져 재생 단추도 뺐다.
 */
function enemyStage(record: EnemyRecord): { element: HTMLElement; refresh: (hasPixelSheet: boolean) => void } {
  const media = el("div", { class: "db-enemy-stage-media" });
  const test = el("button", {
    class: "db-ws-btn db-ws-btn-primary",
    text: "시험 전투",
    attrs: { type: "button" },
    dataset: { testid: "db-enemy-battle-test" },
    on: { click: async () => {
      const { openEnemyBattleTestModal } = await import("@/editor/panels/testPlayModal");
      await openEnemyBattleTestModal(record.id);
    } },
  });
  const viewport = el("div", { class: "db-enemy-stage-viewport", dataset: { testid: "db-enemy-preview" }, children: [media] });
  const project = store.getCurrent();
  const backgroundId = project.database.troops.find((troop) =>
    (troop.members?.length ? troop.members.map((member) => member.enemyId) : troop.enemyIds).includes(record.id)
  )?.previewBackgroundResourceId;
  const backgroundUrl = resolveAssetResourceUrl(backgroundId, { project });
  if (backgroundUrl) {
    const background = el("img", { class: "db-enemy-stage-background", attrs: { src: backgroundUrl, alt: "" } });
    background.addEventListener("error", () => background.remove(), { once: true });
    viewport.prepend(background);
  }
  const heading = el("div", { class: "db-enemy-stage-heading", children: [el("span", { text: "미리보기" }), el("span", { class: "db-enemy-stage-status", text: "정지 그림 · 도트 시트 없음" })] });
  let graphicKey = "";
  const refresh = (hasPixelSheet: boolean): void => {
    // [hidden] 은 스튜디오 CSS 의 display 규칙에 진다 — 인라인 display 로 접는다.
    heading.style.display = hasPixelSheet ? "none" : "";
    viewport.style.display = hasPixelSheet ? "none" : "";
    if (hasPixelSheet) return;
    const live = currentEnemy(record);
    const nextKey = JSON.stringify([live.monsterResourceId, live.name]);
    if (graphicKey === nextKey) return;
    graphicKey = nextKey;
    media.replaceChildren(enemyGraphicVisual(live));
  };
  return {
    element: el("section", {
      class: "db-enemy-stage",
      attrs: { "aria-label": "몬스터 미리보기" },
      children: [heading, viewport, el("div", { class: "db-enemy-stage-toolbar", children: [test] })],
    }),
    refresh,
  };
}
