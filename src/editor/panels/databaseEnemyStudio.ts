import { battlerIdleAnimation, battlerIdleAnimationDurationMs, battlerIdleAnimationUrl } from "@/assets/battlerIdleAnimations";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { switchDatabaseActiveTab } from "@/editor/panels/database";
import { currentEnemy, enemyGraphicVisual } from "@/editor/panels/databaseEnemyRecordSupport";
import { recordDetailSection, recordPreviewPaused, setRecordDetailSection, setRecordPreviewPaused, setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { store } from "@/project/store";
import type { EnemyRecord } from "@/project/types";
import { el } from "@/util/dom";

export type EnemyInspectorSection = { id: string; label: string; cards: HTMLElement[] };

/** Local UI state only. Every field keeps its existing databaseActions mutation path. */
export function renderEnemyStudio(record: EnemyRecord, sections: EnemyInspectorSection[], actions: HTMLElement): HTMLElement {
  const stage = enemyStage(record);
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
    stage.refresh();
    refreshReferences();
  };
  const root = el("div", {
    class: "db-enemy-studio",
    children: [
      el("div", { class: "db-enemy-stage-column", children: [stage.element, actions, references] }),
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

function enemyStage(record: EnemyRecord): { element: HTMLElement; refresh: () => void } {
  const media = el("div", { class: "db-enemy-stage-media" });
  const status = el("span", { class: "db-enemy-stage-status" });
  const stats = el("div", { class: "db-enemy-stage-stats", dataset: { testid: "db-enemy-stage-stats" } });
  let paused = recordPreviewPaused(record.id)
    ?? (typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));
  media.classList.toggle("is-paused", paused);
  const pause = el("button", {
    class: "db-enemy-stage-control",
    text: "일시 정지",
    attrs: { type: "button", "aria-pressed": String(paused) },
    dataset: { testid: "db-enemy-preview-pause" },
  });
  pause.addEventListener("click", () => {
    paused = !paused;
    setRecordPreviewPaused(record.id, paused);
    media.classList.toggle("is-paused", paused);
    pause.textContent = paused ? "재생" : "일시 정지";
    pause.setAttribute("aria-pressed", String(paused));
  });
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
  let graphicKey = "";
  const refresh = (): void => {
    const live = currentEnemy(record);
    stats.replaceChildren(...[
      ["HP", live.stats.maxHp], ["MP", live.stats.maxMp], ["공격", live.stats.attack], ["방어", live.stats.defense],
    ].map(([label, value]) => el("div", { children: [el("span", { text: String(label) }), el("strong", { text: String(value) })] })));
    const nextKey = JSON.stringify([live.monsterResourceId, live.graphicHue, live.transparent, live.flying, live.name]);
    if (graphicKey === nextKey) return;
    graphicKey = nextKey;
    const still = enemyGraphicVisual(live);
    media.replaceChildren(still);
    const animation = battlerIdleAnimation(live.monsterResourceId);
    pause.disabled = true;
    status.textContent = "정적 미리보기";
    pause.textContent = paused ? "재생" : "일시 정지";
    if (!animation || animation.tier !== "image-strip") return;
    const strip = el("img", { class: "db-enemy-idle-strip", attrs: { src: battlerIdleAnimationUrl(animation), alt: `${live.name} 대기 애니메이션` } });
    const frame = el("div", { class: "db-enemy-idle-frame", children: [strip] });
    frame.style.aspectRatio = `${animation.cellWidth} / ${animation.cellHeight}`;
    frame.style.setProperty("--enemy-idle-frames", String(animation.frameCount));
    frame.style.setProperty("--enemy-idle-duration", `${battlerIdleAnimationDurationMs(animation)}ms`);
    frame.style.filter = `hue-rotate(${live.graphicHue}deg)`;
    frame.style.opacity = live.transparent ? "0.58" : "1";
    frame.classList.toggle("flying", live.flying);
    strip.addEventListener("load", () => {
      if (graphicKey !== nextKey) return;
      media.replaceChildren(frame);
      pause.disabled = false;
      status.textContent = "대기 애니메이션";
    }, { once: true });
    // Keep the resolved static image when the optional animation cannot load.
  };
  refresh();
  return {
    element: el("section", {
      class: "db-enemy-stage",
      attrs: { "aria-label": "몬스터 미리보기" },
      children: [
        el("div", { class: "db-enemy-stage-heading", children: [el("span", { text: "미리보기" }), status] }),
        viewport,
        stats,
        el("div", { class: "db-enemy-stage-toolbar", children: [pause, test] }),
      ],
    }),
    refresh,
  };
}
