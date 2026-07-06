import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  EASYRPG_CHARSET_ASSETS,
  EASYRPG_FACESET_ASSETS,
  FACESET_COLUMNS,
  FACESET_FACE_HEIGHT,
  FACESET_FACE_WIDTH,
  FACESET_ROWS,
  charsetFrameSource,
} from "@/assets/easyrpgRtp";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { RM2K3_GENERATED_ASSET_PLAN } from "@/assets/rm2k3GeneratedAssetPlan";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import { store } from "@/project/store";
import type { ActorRecord, Project, ResourceKind } from "@/project/types";
import { el } from "@/util/dom";

type ActorResourceField = "battleCharacterResourceId" | "characterResourceId" | "faceResourceId";
type ActorResourceKind = Extract<ResourceKind, "battleCharset" | "charset" | "faceset">;
type ActorResourceOption = {
  readonly id: string;
  readonly name: string;
  readonly kind: ActorResourceKind;
};

const GENERATED_BATTLE_CHARSET_FRAME_WIDTH = 48;
const GENERATED_BATTLE_CHARSET_FRAME_HEIGHT = 64;
const GENERATED_BATTLE_CHARSET_SHEET_WIDTH = 144;
const GENERATED_BATTLE_CHARSET_SHEET_HEIGHT = 384;
const GENERATED_BATTLE_CHARSET_PREVIEW_SCALE = 0.75;

export function openActorResourceDialog(record: ActorRecord, field: ActorResourceField, rerender: () => void): void {
  const project = store.getCurrent();
  const kind = kindForField(field);
  const options = resourceOptions(kind);
  const current = currentActor(record);
  let selectedId = current[field] ?? options[0]?.id ?? "";
  const preview = el("div", { class: "db-actor-resource-dialog-preview" });
  const list = el("div", { class: "db-actor-resource-list" });

  const refreshPreview = (): void => {
    preview.replaceChildren(resourceVisual(selectedId, kind, project, "선택 리소스", "db-actor-resource-preview-visual"));
  };

  for (const option of options) {
    list.append(resourceButton(option, selectedId, list, project, () => {
      selectedId = option.id;
      refreshPreview();
    }));
  }
  refreshPreview();

  openDialog("db-actor-resource-dialog", dialogTitle(kind), [
    el("div", { class: "db-actor-resource-dialog-grid", children: [list, preview] }),
  ], [
    {
      label: "OK",
      testid: "db-actor-resource-ok",
      action: () => {
        updateDatabaseRecord("actors", record.id, { [field]: selectedId || undefined } as Partial<ActorRecord>);
        rerender();
      },
    },
    { label: "Cancel", testid: "db-actor-resource-cancel" },
  ]);
}

function resourceButton(
  option: ActorResourceOption,
  selectedId: string,
  list: HTMLElement,
  project: Project,
  onSelect: () => void
): HTMLElement {
  return el("button", {
    class: option.id === selectedId ? "active" : "",
    attrs: { type: "button", title: `${option.name} (${option.id})` },
    dataset: { resourceId: option.id, testid: `db-actor-resource-option-${option.id}` },
    children: [
      resourceVisual(option.id, option.kind, project, option.name, "db-actor-resource-option-thumb"),
      el("span", { text: option.name }),
    ],
    on: {
      click: () => {
        for (const button of list.querySelectorAll("button")) {
          if (button.dataset.resourceId === option.id) button.classList.add("active");
          else button.classList.remove("active");
        }
        onSelect();
      },
    },
  });
}

function resourceOptions(kind: ActorResourceKind): readonly ActorResourceOption[] {
  const options = new Map<string, ActorResourceOption>();
  if (kind === "faceset") {
    for (const asset of EASYRPG_FACESET_ASSETS) options.set(asset.id, { id: asset.id, name: asset.name, kind });
  }
  if (kind === "charset") {
    for (const asset of EASYRPG_CHARSET_ASSETS) options.set(asset.id, { id: asset.id, name: asset.name, kind });
  }
  for (const asset of RM2K3_GENERATED_ASSET_PLAN.assets) {
    if (asset.status === "promoted" && asset.resourceKind === kind) {
      options.set(asset.resourceId, { id: asset.resourceId, name: generatedName(asset.id), kind });
    }
  }
  for (const id of builtinGeneratedResourceIds()) {
    const builtinKind = generatedKindFromId(id);
    if (builtinKind === kind && !options.has(id)) options.set(id, { id, name: generatedName(id), kind });
  }
  return Array.from(options.values());
}

function resourceVisual(resourceId: string, kind: ActorResourceKind, project: Project, label: string, className: string): HTMLElement {
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) return el("span", { class: `${className} db-actor-resource-empty`, text: "(없음)" });
  if (kind === "faceset") {
    return cropVisual(className, label, url, { x: 0, y: 0, width: FACESET_FACE_WIDTH, height: FACESET_FACE_HEIGHT, sheetWidth: FACESET_COLUMNS * FACESET_FACE_WIDTH, sheetHeight: FACESET_ROWS * FACESET_FACE_HEIGHT, scale: 1 });
  }
  if (kind === "charset") {
    const source = charsetFrameSource({ characterIndex: 0, direction: "down", pattern: 1 });
    return cropVisual(className, label, url, {
      ...source,
      sheetWidth: CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH,
      sheetHeight: CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT,
      scale: 1.5,
    });
  }
  if (resourceId === "hero" || isGeneratedBattleActorResource(resourceId)) {
    return cropVisual(className, label, url, {
      x: 0,
      y: 0,
      width: GENERATED_BATTLE_CHARSET_FRAME_WIDTH,
      height: GENERATED_BATTLE_CHARSET_FRAME_HEIGHT,
      sheetWidth: GENERATED_BATTLE_CHARSET_SHEET_WIDTH,
      sheetHeight: GENERATED_BATTLE_CHARSET_SHEET_HEIGHT,
      scale: GENERATED_BATTLE_CHARSET_PREVIEW_SCALE,
    });
  }
  const image = el("img", { class: className, attrs: { alt: `${label} 미리보기`, src: url } });
  image.addEventListener("error", () => {
    const fallback = el("span", { class: `${className} db-actor-resource-empty`, text: "(없음)" });
    const replaceWith = (image as HTMLElement & { replaceWith?: (...nodes: (Node | string)[]) => void }).replaceWith;
    if (replaceWith) replaceWith.call(image, fallback);
    else image.parentElement?.replaceChildren(fallback);
  }, { once: true });
  return image;
}

function cropVisual(
  className: string,
  label: string,
  url: string,
  source: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly sheetWidth: number;
    readonly sheetHeight: number;
    readonly scale: number;
  }
): HTMLElement {
  return el("span", {
    class: `${className} db-actor-resource-crop`,
    attrs: {
      "aria-label": `${label} 미리보기`,
      role: "img",
      style: [
        `--actor-resource-url:url("${url}")`,
        `--actor-resource-width:${source.width * source.scale}px`,
        `--actor-resource-height:${source.height * source.scale}px`,
        `--actor-resource-sheet-width:${source.sheetWidth * source.scale}px`,
        `--actor-resource-sheet-height:${source.sheetHeight * source.scale}px`,
        `--actor-resource-x:-${source.x * source.scale}px`,
        `--actor-resource-y:-${source.y * source.scale}px`,
      ].join(";"),
    },
  });
}

function kindForField(field: ActorResourceField): ActorResourceKind {
  if (field === "faceResourceId") return "faceset";
  if (field === "characterResourceId") return "charset";
  return "battleCharset";
}

function dialogTitle(kind: ActorResourceKind): string {
  if (kind === "faceset") return "얼굴 리소스";
  if (kind === "charset") return "캐릭터셋 리소스";
  return "배틀 캐릭터 리소스";
}

function currentActor(record: ActorRecord): ActorRecord {
  return store.getCurrent().database.actors.find((entry) => entry.id === record.id) ?? record;
}

function generatedKindFromId(id: string): ActorResourceKind | null {
  if (id.startsWith("generated-actor-") && id.endsWith("-face")) return "faceset";
  if (id.startsWith("generated-actor-") && id.endsWith("-charset")) return "charset";
  if (id.startsWith("generated-actor-") && id.endsWith("-battle")) return "battleCharset";
  return null;
}

function isGeneratedBattleActorResource(resourceId: string): boolean {
  return resourceId.startsWith("generated-actor-") && resourceId.endsWith("-battle");
}

function generatedName(id: string): string {
  return `${id.replace(/^generated-actor-/u, "").replaceAll("-", " ")} <생성>`;
}
