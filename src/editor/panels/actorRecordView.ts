import { ACTOR_PARAMETER_KEYS, parameterValueAtLevel, totalExpForLevel } from "@/project/actorModel";
import { updateDatabaseRecord } from "@/editor/databaseActions";
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
import type { ActorParameterKey, ActorRecord } from "@/project/types";
import { el } from "@/util/dom";

const PARAMETER_LABELS: Record<ActorParameterKey, string> = {
  maxHp: "최대 HP",
  maxMp: "최대 MP",
  attack: "공격력",
  defense: "방어력",
  mind: "정신력",
  agility: "민첩성",
};

export function renderActorRecordForm(actor: ActorRecord, rerender: () => void): HTMLElement {
  const form = el("section", {
    class: "db-detail-form actor-detail-form",
    dataset: { testid: "db-detail-form" },
  });
  form.append(
    el("div", {
      class: "actor-editor-grid",
      children: [
        el("div", { class: "actor-column actor-left-stack", children: [identityPanel(actor), graphicsPanel(actor)] }),
        el("div", { class: "actor-column actor-center-stack", children: [curvesPanel(actor)] }),
        el("div", { class: "actor-column actor-right-stack", children: [battlePanel(actor, rerender), ratesPanel(actor)] }),
      ],
    })
  );
  return form;
}

function identityPanel(actor: ActorRecord): HTMLElement {
  return actorPanel("기본 정보", "actor-identity", [
    textControl("이름", "db-field-name", actor.name, (name) => updateDatabaseRecord("actors", actor.id, { name })),
    textControl("칭호", "db-field-actor-nickname", actor.nickname, (nickname) =>
      updateDatabaseRecord("actors", actor.id, { nickname })
    ),
    selectRecord("직업", "db-picker-class", actor.classId, store.getCurrent().database.classes, (classId) =>
      updateDatabaseRecord("actors", actor.id, { classId })
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
    graphicPreview("전투 그래픽", actor.battleCharacterResourceId ?? "(없음)", "battleCharset"),
    textControl("전투 캐릭터셋", "db-field-battle-character-resource", actor.battleCharacterResourceId ?? "", (battleCharacterResourceId) =>
      updateDatabaseRecord("actors", actor.id, { battleCharacterResourceId: emptyToUndefined(battleCharacterResourceId) })
    ),
  ]);
}

function curvesPanel(actor: ActorRecord): HTMLElement {
  const curveCards = ACTOR_PARAMETER_KEYS.map((key) => {
    const curve = actor.parameterCurves[key];
    return el("div", {
      class: `actor-curve actor-curve-${key}`,
      children: [
        el("strong", { text: PARAMETER_LABELS[key] }),
        el("span", { text: `Now:${parameterValueAtLevel(curve, actor.initialLevel)}` }),
        el("div", { class: "actor-curve-graph", children: curveBars(curve) }),
      ],
    });
  });
  return actorPanel("능력치 곡선", "actor-parameter-curves", [
    el("div", { class: "actor-curves-grid", children: curveCards }),
    el("div", {
      class: "actor-exp-row",
      children: [
        el("span", {
          text: `기본=${actor.expCurve.base}; 추가=${actor.expCurve.extra}; 가속=${actor.expCurve.acceleration}`,
        }),
        el("span", { text: `Lv99 경험치 ${totalExpForLevel(actor.expCurve, 99).toLocaleString()}` }),
        el("button", { class: "btn small", text: "설정", attrs: { type: "button" } }),
      ],
    }),
  ]);
}

function curveBars(curve: readonly number[]): HTMLElement[] {
  const max = Math.max(...curve);
  return [0, 12, 24, 36, 48, 60, 72, 84, 98].map((index) => {
    const value = curve[index] ?? curve[curve.length - 1] ?? 1;
    return el("i", { attrs: { style: `height:${Math.max(10, Math.round((value / max) * 100))}%` } });
  });
}
