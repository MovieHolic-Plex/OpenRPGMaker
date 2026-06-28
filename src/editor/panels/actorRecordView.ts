import { updateDatabaseRecord } from "@/editor/databaseActions";
import { actorCurveCards, actorExperiencePanel } from "@/editor/panels/actorRecordCurveEditors";
import { battlePanel, ratesPanel } from "@/editor/panels/actorRecordBattlePanels";
import {
  actorPanel,
  checkboxControl,
  emptyToUndefined,
  graphicPreview,
  numberControl,
  selectRecord,
  textControl,
} from "@/editor/panels/actorRecordControls";
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
            el("div", { class: "actor-column actor-left-stack", children: [identityPanel(actor), graphicsPanel(actor)] }),
            el("div", { class: "actor-column actor-center-stack", children: [classPanel(actor), curvesPanel(actor), experiencePanel(actor)] }),
            el("div", { class: "actor-column actor-right-stack", children: [battlePanel(actor, rerender), ratesPanel(actor)] }),
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

function graphicsPanel(actor: ActorRecord): HTMLElement {
  return actorPanel("그래픽", "actor-graphic", [
    graphicPreview("얼굴", actor.faceResourceId ?? actor.characterResourceId ?? "(없음)", "faceset"),
    textControl("얼굴", "db-field-face-resource", actor.faceResourceId ?? "", (faceResourceId) =>
      updateDatabaseRecord("actors", actor.id, { faceResourceId: emptyToUndefined(faceResourceId) })
    ),
    graphicPreview("캐릭터셋", actor.characterResourceId ?? "(없음)", "charset"),
    textControl("캐릭터셋", "db-field-character-resource", actor.characterResourceId ?? "", (characterResourceId) =>
      updateDatabaseRecord("actors", actor.id, { characterResourceId: emptyToUndefined(characterResourceId) })
    ),
    checkboxControl("투명", "db-field-character-transparent", actor.characterTransparent, (characterTransparent) =>
      updateDatabaseRecord("actors", actor.id, { characterTransparent })
    ),
    graphicPreview("애니메이션", actor.battleCharacterResourceId ?? "(없음)", "battleCharset"),
    textControl("애니메이션", "db-field-battle-character-resource", actor.battleCharacterResourceId ?? "", (battleCharacterResourceId) =>
      updateDatabaseRecord("actors", actor.id, { battleCharacterResourceId: emptyToUndefined(battleCharacterResourceId) })
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
