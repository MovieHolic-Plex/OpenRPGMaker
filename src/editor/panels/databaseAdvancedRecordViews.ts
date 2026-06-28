import {
  emptyToUndefined,
  numberField,
  selectField,
  textField,
} from "@/editor/panels/databaseControls";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { store } from "@/project/store";
import type { EnemyRecord } from "@/project/types";
import { el } from "@/util/dom";
export { renderEquipmentRecordForm } from "./databaseEquipmentRecordView";
export { renderItemRecordForm } from "./databaseItemRecordView";
export { renderSkillRecordForm } from "./databaseSkillRecordView";
export { renderTroopRecordForm } from "./databaseTroopRecordView";

export function renderEnemyRecordForm(form: HTMLElement, record: EnemyRecord): void {
  const action = record.actions[0] ?? { skillId: "", priority: 5, condition: { kind: "always" as const } };
  form.append(
    resourcePreviewPanel("몬스터 그래픽", [
      imagePreview("몬스터", record.monsterResourceId),
      textField("몬스터", "db-field-enemy-monster-resource", record.monsterResourceId ?? "", (monsterResourceId) =>
        updateDatabaseRecord("enemies", record.id, { monsterResourceId: emptyToUndefined(monsterResourceId) })
      ),
    ]),
    panel("능력치", [
      numberField("최대 HP", "db-field-enemy-max-hp", record.stats.maxHp, (maxHp) =>
        updateDatabaseRecord("enemies", record.id, { stats: { ...record.stats, maxHp } })
      ),
      numberField("공격력", "db-field-enemy-attack", record.stats.attack, (attack) =>
        updateDatabaseRecord("enemies", record.id, { stats: { ...record.stats, attack } })
      ),
    ]),
    panel("보상", [
      numberField("경험치", "db-field-enemy-exp", record.rewards.exp, (exp) =>
        updateDatabaseRecord("enemies", record.id, { rewards: { ...currentEnemyRewards(record.id, record.rewards), exp } })
      ),
      selectField("드롭", "db-picker-enemy-drop", record.rewards.dropItemId ?? "", store.getCurrent().database.items, (dropItemId) =>
        updateDatabaseRecord("enemies", record.id, { rewards: { ...currentEnemyRewards(record.id, record.rewards), dropItemId: emptyToUndefined(dropItemId) } })
      ),
    ]),
    selectField("행동", "db-picker-enemy-action-skill", action.skillId, store.getCurrent().database.skills, (skillId) =>
      updateDatabaseRecord("enemies", record.id, { actions: skillId ? [{ ...action, skillId }] : [] })
    )
  );
}

function panel(title: string, children: HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-advanced-panel", children: [el("legend", { text: title }), ...children] });
}

function resourcePreviewPanel(title: string, children: HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-advanced-panel db-resource-panel", children: [el("legend", { text: title }), ...children] });
}

function imagePreview(label: string, resourceId: string | undefined): HTMLElement {
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  const visual = url && isMonsterPreviewResource(resourceId)
    ? monsterCanvasPreview(label, url)
    : url && shouldRenderImagePreview(resourceId)
    ? el("img", { attrs: { alt: `${label} 미리보기`, src: url } })
    : neutralResourceSlot(resourceId);
  return el("div", { class: "db-image-preview", children: [el("span", { text: label }), visual] });
}

function monsterCanvasPreview(label: string, url: string): HTMLElement {
  const canvas = el("canvas", {
    class: "db-monster-canvas",
    attrs: { "aria-label": `${label} 미리보기`, role: "img" },
  }) as HTMLCanvasElement;
  canvas.width = 96;
  canvas.height = 72;
  renderChromaKeyImage(canvas, url);
  return el("div", { class: "db-monster-preview-frame", children: [canvas] });
}

function renderChromaKeyImage(canvas: HTMLCanvasElement, url: string): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const image = new Image();
  image.addEventListener("load", () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / image.width, canvas.height / image.height, 1);
    const width = Math.max(1, Math.floor(image.width * scale));
    const height = Math.max(1, Math.floor(image.height * scale));
    const x = Math.floor((canvas.width - width) / 2);
    const y = Math.floor((canvas.height - height) / 2);
    context.drawImage(image, x, y, width, height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
      const isMagenta = data[index] > 220 && data[index + 1] < 80 && data[index + 2] > 220;
      if (isMagenta) data[index + 3] = 0;
    }
    context.putImageData(imageData, 0, 0);
  });
  image.src = url;
}

function isGeneratedPreviewResource(resourceId: string | undefined): boolean {
  return resourceId?.startsWith("generated-") ?? false;
}

function shouldRenderImagePreview(resourceId: string | undefined): boolean {
  if (!resourceId) return false;
  return !isGeneratedPreviewResource(resourceId);
}

function isMonsterPreviewResource(resourceId: string | undefined): boolean {
  return resourceId?.startsWith("easyrpg-monster-") ?? false;
}

function neutralResourceSlot(resourceId: string | undefined): HTMLElement {
  const isGenerated = isGeneratedPreviewResource(resourceId);
  const label = isGenerated ? "설정..." : resourceId ?? "(없음)";
  const labelNode = isGenerated
    ? el("button", { class: "db-resource-set-button", attrs: { type: "button", "aria-label": "리소스 선택" }, text: label })
    : el("strong", { text: label });
  return el("div", {
    class: `db-neutral-resource-slot${resourceId ? "" : " empty"}${isGenerated ? " generated" : ""}`,
    children: [
      el("span", { class: "db-neutral-resource-icon" }),
      labelNode,
    ],
  });
}

function currentEnemyRewards(enemyId: string, fallback: EnemyRecord["rewards"]): EnemyRecord["rewards"] {
  return store.getCurrent().database.enemies.find((record) => record.id === enemyId)?.rewards ?? fallback;
}
