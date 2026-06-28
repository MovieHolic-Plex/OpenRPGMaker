import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { ACTOR_RATE_GRADES } from "@/project/actorModel";
import { store } from "@/project/store";
import type { ActorRateGrade, EnemyActionCondition, EnemyActionPattern, EnemyRecord } from "@/project/types";
import { el } from "@/util/dom";

export { openActionContextMenu, openActionDialog } from "@/editor/panels/databaseEnemyActionDialog";
export { openGraphicDialog } from "@/editor/panels/databaseEnemyGraphicDialog";

export const ELEMENT_RATE_LABELS: readonly { readonly id: string; readonly name: string }[] = [
  { id: "sword", name: "검" },
  { id: "spear", name: "창" },
  { id: "hit", name: "타격" },
  { id: "bow", name: "활" },
  { id: "fire", name: "불" },
  { id: "ice", name: "얼음" },
  { id: "thunder", name: "번개" },
  { id: "water", name: "물" },
  { id: "earth", name: "대지" },
  { id: "wind", name: "바람" },
  { id: "holy", name: "성" },
];

const MAGENTA_CHROMA_KEY_RESOURCE_IDS = new Set<string>(["easyrpg-monster-hornet"]);

export function enemyGraphicVisual(record: EnemyRecord): HTMLElement {
  const url = resolveAssetResourceUrl(record.monsterResourceId, { project: store.getCurrent() });
  const image = url
    ? el("img", { attrs: { alt: `${record.name} 미리보기`, src: url } })
    : el("span", { class: "db-enemy-empty-graphic", text: "(없음)" });
  if (image instanceof HTMLImageElement) {
    image.style.filter = `hue-rotate(${record.graphicHue}deg)`;
    image.style.opacity = record.transparent ? "0.58" : "1";
    image.classList.toggle("flying", record.flying);
    image.addEventListener("error", () => {
      image.replaceWith(el("span", { class: "db-enemy-empty-graphic", text: "(그래픽 없음)" }));
    }, { once: true });
    if (record.monsterResourceId && MAGENTA_CHROMA_KEY_RESOURCE_IDS.has(record.monsterResourceId)) applyMagentaChromaKey(image);
  }
  return el("div", { class: "db-enemy-graphic-stage", children: [image] });
}

function applyMagentaChromaKey(image: HTMLImageElement): void {
  const apply = (): void => {
    if (image.dataset.chromaKeyed === "true") return;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width <= 0 || height <= 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const red = pixels.data[index] ?? 0;
      const green = pixels.data[index + 1] ?? 0;
      const blue = pixels.data[index + 2] ?? 0;
      if (red > 220 && green < 80 && blue > 180) pixels.data[index + 3] = 0;
    }
    context.putImageData(pixels, 0, 0);
    image.dataset.chromaKeyed = "true";
    image.src = canvas.toDataURL("image/png");
  };
  if (image.complete) {
    apply();
    return;
  }
  image.addEventListener("load", apply, { once: true });
}

export function rateField(label: string, testid: string, value: ActorRateGrade, onChange: (value: ActorRateGrade) => void): HTMLElement {
  const select = el("select", { dataset: { testid } });
  for (const grade of ACTOR_RATE_GRADES) select.append(el("option", { text: grade, attrs: { value: grade } }));
  select.value = value;
  select.addEventListener("change", () => {
    const next = ACTOR_RATE_GRADES.find((grade) => grade === select.value);
    if (next) onChange(next);
  });
  return el("label", { class: "db-enemy-rate-row", children: [el("span", { text: label }), select] });
}

export function checkboxField(label: string, testid: string, checked: boolean, onInput: (value: boolean) => void): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => onInput(input.checked));
  return el("label", { class: "actor-check", children: [input, el("span", { text: label })] });
}

export function panel(title: string, children: HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-advanced-panel", children: [el("legend", { text: title }), ...children] });
}

export function openDialog(testid: string, title: string, content: HTMLElement[], actions: readonly { readonly label: string; readonly testid: string; readonly action?: () => void }[]): void {
  const overlay = el("div", { class: "db-enemy-dialog-backdrop", dataset: { testid } });
  const close = (): void => overlay.remove();
  overlay.append(
    el("div", {
      class: "db-enemy-dialog",
      children: [
        el("header", { text: title }),
        el("main", { children: content }),
        el("footer", {
          children: actions.map((entry) =>
            el("button", {
              class: "btn small",
              text: entry.label,
              dataset: { testid: entry.testid },
              on: {
                click: () => {
                  entry.action?.();
                  close();
                },
              },
            })
          ),
        }),
      ],
    })
  );
  document.body.append(overlay);
}

export function currentEnemy(record: EnemyRecord): EnemyRecord {
  return store.getCurrent().database.enemies.find((entry) => entry.id === record.id) ?? record;
}

export function defaultAction(): EnemyActionPattern {
  return {
    skillId: store.getCurrent().database.skills[0]?.id ?? "skill_attack",
    priority: 50,
    condition: { kind: "always" },
    switchOnAfterAction: { enabled: false },
    switchOffAfterAction: { enabled: false },
  };
}

export function replaceAction(actions: readonly EnemyActionPattern[], index: number, action: EnemyActionPattern): EnemyActionPattern[] {
  const next = actions.length > 0 ? [...actions] : [defaultAction()];
  next[index] = action;
  return next;
}

export function skillName(skillId: string): string {
  return store.getCurrent().database.skills.find((skill) => skill.id === skillId)?.name ?? "일반 공격";
}

export function conditionLabel(condition: EnemyActionCondition): string {
  if (condition.kind === "turn") return `${condition.start}+${condition.interval}턴`;
  return "항상";
}
