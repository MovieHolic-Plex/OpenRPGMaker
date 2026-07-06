import { updateDatabaseRecord } from "@/editor/databaseActions";
import { ACTOR_PARAMETER_KEYS, parameterValueAtLevel } from "@/project/actorModel";
import { actorCurveCards, actorExperiencePanel } from "@/editor/panels/actorRecordCurveEditors";
import { battlePanel, ratesPanel } from "@/editor/panels/actorRecordBattlePanels";
import {
  actorPanel,
  checkboxControl,
  emptyToUndefined,
  graphicPreview,
  numberControl,
  resourceControl,
  selectRecord,
  textControl,
} from "@/editor/panels/actorRecordControls";
import { openActorResourceDialog } from "@/editor/panels/databaseActorResourceDialog";
import { store } from "@/project/store";
import type { ActorRecord } from "@/project/types";
import { el } from "@/util/dom";

export function renderActorRecordForm(actor: ActorRecord, rerender: () => void): HTMLElement {
  const form = el("section", {
    class: "db-detail-form actor-detail-form",
    dataset: { testid: "db-detail-form" },
  });
  form.append(
    el("div", {
      class: "actor-classic-sheet",
      dataset: { testid: "actor-classic-sheet" },
      children: [
        el("div", {
          class: "actor-editor-grid",
          children: [
            el("div", { class: "actor-column actor-left-stack", children: [identityPanel(actor), classPanel(actor), graphicsPanel(actor, rerender), baseStatsPanel(actor)] }),
            el("div", { class: "actor-column actor-center-stack", children: [curvesPanel(actor), experiencePanel(actor)] }),
            el("div", { class: "actor-column actor-right-stack", children: [inspectorTabs(() => form), battlePanel(actor, rerender), ratesPanel(actor)] }),
          ],
        }),
      ],
    })
  );
  return form;
}

function identityPanel(actor: ActorRecord): HTMLElement {
  return actorPanel("이름", "actor-identity", [
    textControl("이름", "db-field-name", actor.name, (name) => updateDatabaseRecord("actors", actor.id, { name })),
    textControl("칭호", "db-field-actor-nickname", actor.nickname, (nickname) =>
      updateDatabaseRecord("actors", actor.id, { nickname })
    ),
    el("div", {
      class: "actor-level-row",
      children: [
        numberControl("초기 레벨", "db-field-initial-level", actor.initialLevel, (initialLevel) =>
          updateDatabaseRecord("actors", actor.id, { initialLevel })
        ),
        numberControl("최대 레벨", "db-field-max-level", actor.maxLevel, (maxLevel) =>
          updateDatabaseRecord("actors", actor.id, { maxLevel })
        ),
      ],
    }),
    checkboxControl("크리티컬", "db-field-actor-critical-enabled", actor.critical.enabled, (enabled) =>
      updateDatabaseRecord("actors", actor.id, { critical: { ...actor.critical, enabled } })
    ),
    numberControl("확률 분모", "db-field-actor-critical-rate", actor.critical.chanceDenominator, (chanceDenominator) =>
      updateDatabaseRecord("actors", actor.id, { critical: { ...actor.critical, chanceDenominator } })
    ),
  ]);
}

function classPanel(actor: ActorRecord): HTMLElement {
  return actorPanel("직업", "actor-class", [
    el("div", {
      class: "actor-class-row",
      children: [
        selectRecord("직업", "db-picker-class", actor.classId, store.getCurrent().database.classes, (classId) =>
          updateDatabaseRecord("actors", actor.id, { classId })
        ),
        el("button", { class: "btn small", text: "적용", attrs: { type: "button", disabled: "true" } }),
      ],
    }),
  ]);
}

function baseStatsPanel(actor: ActorRecord): HTMLElement {
  const labels: Record<(typeof ACTOR_PARAMETER_KEYS)[number], string> = {
    maxHp: "최대 HP",
    maxMp: "최대 MP",
    attack: "공격력",
    defense: "방어력",
    mind: "마법력",
    agility: "민첩성",
  };
  return actorPanel("기본 능력치", "actor-basic-stats", [
    el("div", {
      class: "actor-basic-stat-grid",
      children: ACTOR_PARAMETER_KEYS.map((key) =>
        el("div", {
          class: "actor-basic-stat-row",
          children: [
            el("span", { text: `${labels[key]}:` }),
            el("strong", { text: String(parameterValueAtLevel(actor.parameterCurves[key], actor.initialLevel)) }),
          ],
        })
      ),
    }),
  ]);
}

function inspectorTabs(root: () => HTMLElement): HTMLElement {
  const tabs = [
    { label: "특성", target: "[data-testid='actor-panel-actor-options']" },
    { label: "장비", target: "[data-testid='actor-panel-actor-starting-equipment']" },
    { label: "성장 곡선", target: "[data-testid='actor-panel-actor-parameter-curves']" },
    { label: "능력치 보정", target: "[data-testid='actor-panel-actor-basic-stats']" },
    { label: "공격 속성", target: "[data-testid='actor-panel-actor-rates']" },
  ];
  return el("div", {
    class: "actor-inspector-tabs",
    dataset: { testid: "db-actor-inspector-tabs" },
    children: tabs.map((tab, index) => {
      const button = el("button", {
        class: `actor-inspector-tab${index === 0 ? " active" : ""}`,
        text: tab.label,
        attrs: { type: "button", "aria-pressed": String(index === 0) },
      });
      button.addEventListener("click", () => activateInspectorTab(button, root(), tab.target));
      return button;
    }),
  });
}

function activateInspectorTab(button: HTMLElement, root: HTMLElement, selector: string): void {
  for (const tab of root.querySelectorAll(".actor-inspector-tab")) {
    if (!(tab instanceof HTMLElement)) continue;
    const active = tab === button;
    if (active) tab.classList.add("active");
    else tab.classList.remove("active");
    tab.setAttribute("aria-pressed", String(active));
  }
  const panel = root.querySelector(selector);
  if (panel instanceof HTMLElement) panel.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

function graphicsPanel(actor: ActorRecord, rerender: () => void): HTMLElement {
  return actorPanel("그래픽", "actor-graphic", [
    graphicPreview("얼굴", actor.faceResourceId ?? actor.characterResourceId ?? "(없음)", "faceset"),
    resourceControl("얼굴", "db-field-face-resource", actor.faceResourceId ?? "", (faceResourceId) =>
      updateDatabaseRecord("actors", actor.id, { faceResourceId: emptyToUndefined(faceResourceId) }),
      () => openActorResourceDialog(actor, "faceResourceId", rerender)
    ),
    graphicPreview("캐릭터셋", actor.characterResourceId ?? "(없음)", "charset"),
    resourceControl("캐릭터셋", "db-field-character-resource", actor.characterResourceId ?? "", (characterResourceId) =>
      updateDatabaseRecord("actors", actor.id, { characterResourceId: emptyToUndefined(characterResourceId) }),
      () => openActorResourceDialog(actor, "characterResourceId", rerender)
    ),
    checkboxControl("투명", "db-field-character-transparent", actor.characterTransparent, (characterTransparent) =>
      updateDatabaseRecord("actors", actor.id, { characterTransparent })
    ),
    graphicPreview("애니메이션", actor.battleCharacterResourceId ?? "(없음)", "battleCharset"),
    resourceControl("애니메이션", "db-field-battle-character-resource", actor.battleCharacterResourceId ?? "", (battleCharacterResourceId) =>
      updateDatabaseRecord("actors", actor.id, { battleCharacterResourceId: emptyToUndefined(battleCharacterResourceId) }),
      () => openActorResourceDialog(actor, "battleCharacterResourceId", rerender)
    ),
  ]);
}

function curvesPanel(actor: ActorRecord): HTMLElement {
  return actorPanel("능력치 곡선", "actor-parameter-curves", [
    el("div", { class: "actor-curves-grid", children: actorCurveCards(actor) }),
  ]);
}

function experiencePanel(actor: ActorRecord): HTMLElement {
  return actorPanel("경험치 곡선", "actor-experience", actorExperiencePanel(actor));
}
