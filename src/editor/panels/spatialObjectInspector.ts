import { renderSpatialCardThumb } from "@/editor/panels/spatialGallery";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { ObjectDeletePreview, ObjectDraftTarget } from "@/editor/panels/spatialObjectDraft";
import type { ObjectDesign, SpatialPort } from "@/project/spatial/types";
import { visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import { el } from "@/util/dom";

export type SpatialObjectInspectorHandlers = {
  readonly onBuildTarget: () => void;
  readonly onName: (name: string) => void;
  readonly onExteriorStories?: (stories: ObjectDesign["exteriorStories"]) => void;
  readonly onGraphic: (tilesetId: string, kitId: string) => void;
  readonly onAnchor: (index: number, patch: Partial<SpatialPort>) => void;
  readonly onAddAnchor: () => void;
  readonly onChipToggle: (chip: string, on: boolean) => void;
  readonly onChipCustom: (value: string) => void;
  readonly onEditGraphic: () => void;
  readonly onCopyBuiltin: () => void;
  readonly builtinLocked: boolean;
};

const COMMON_CHIPS = ["pass", "block", "sit", "sleep", "counter"] as const;

function sourceLabel(card: SpatialGalleryCard): string {
  switch (card.source) {
    case "default": return "기본 설계";
    case "own": return "내 설계";
    case "placed": return "배치";
    default: {
      const exhaustive: never = card.source;
      return exhaustive;
    }
  }
}


export function renderSpatialObjectInspector(input: {
  readonly card: SpatialGalleryCard;
  readonly open: boolean;
  readonly target: ObjectDraftTarget;
  readonly design: ObjectDesign | undefined;
  readonly deletePreview: ObjectDeletePreview | null;
  readonly handlers: SpatialObjectInspectorHandlers;
}): HTMLElement {
  const { card, open, target, design, deletePreview, handlers } = input;
  const project = visibleAuthoringProject();
  const tilesets = Object.values(project.tilesets);
  const tileset = project.tilesets[target.tilesetId];
  const kits = tileset?.structureKits ?? [];
  const thumb = renderSpatialCardThumb(card);
  thumb.classList.add("spatial-object-hero-art");
  const chips = new Set(design?.chips ?? []);
  const customChips = [...chips].filter((chip) => !(COMMON_CHIPS as readonly string[]).includes(chip));

  return el("aside", {
    class: `spatial-inspector spatial-object-inspector${open ? " is-open" : ""}`,
    attrs: { "aria-label": "속성", id: "spatial-inspector" },
    dataset: { testid: "spatial-inspector" },
    children: [
      el("h3", { class: "spatial-inspector-name", text: card.name }),
      el("p", { class: "spatial-inspector-sub", text: sourceLabel(card) }),
      el("div", {
        class: "spatial-object-hero",
        dataset: { testid: "spatial-object-preview" },
        children: [thumb],
      }),
      nameField(design?.name ?? card.name, handlers.builtinLocked, handlers.onName),
      graphicFields(tilesets, target, kits, handlers),
      ...(design && handlers.onExteriorStories ? [exteriorStoriesField(design, handlers)] : []),
      el("div", {
        class: "spatial-object-actions",
        children: handlers.builtinLocked
          ? [actionButton("spatial-object-copy", "내 설계로 복제", handlers.onCopyBuiltin)]
          : [actionButton("spatial-object-paint", "그림 편집", handlers.onEditGraphic)],
      }),
      anchorFields(design?.anchors ?? [], handlers),
      chipFields(chips, customChips.join(", "), handlers),
      ...(deletePreview ? [deletePreviewBlock(deletePreview)] : []),
      el("details", {
        class: "spatial-object-meta",
        children: [
          el("summary", { text: "원본 정보" }),
          el("dl", {
            class: "spatial-inspector-facts",
            children: [
              el("dt", { text: "설계" }), el("dd", { text: target.libraryId ?? "", dataset: { testid: "spatial-object-design-id" } }),
              el("dt", { text: "타일셋" }), el("dd", { text: target.tilesetId }),
              el("dt", { text: "그림" }), el("dd", { text: target.kitId, dataset: { testid: "spatial-object-kit-id" } }),
            ],
          }),
        ],
      }),
    ],
  });
}


function nameField(name: string, locked: boolean, onName: (name: string) => void): HTMLElement {
  const input = el("input", {
    attrs: { type: "text", ...(locked ? { disabled: "", readonly: "" } : {}) },
    value: name,
    dataset: { testid: "spatial-object-name" },
  });
  if (!locked) input.addEventListener("change", () => onName(input.value));
  return el("label", {
    class: "spatial-object-field",
    children: [el("span", { text: "이름" }), input],
  });
}

function graphicFields(
  tilesets: readonly { readonly id: string; readonly name: string }[],
  target: ObjectDraftTarget,
  kits: readonly { readonly id: string; readonly name?: string }[],
  handlers: SpatialObjectInspectorHandlers,
): HTMLElement {
  const tilesetSelect = el("select", {
    dataset: { testid: "spatial-object-tileset" },
    attrs: handlers.builtinLocked ? { disabled: "" } : {},
    children: tilesets.map((tileset) => el("option", {
      text: tileset.name || tileset.id,
      attrs: { value: tileset.id, ...(tileset.id === target.tilesetId ? { selected: "" } : {}) },
    })),
  });
  const kitSelect = el("select", {
    dataset: { testid: "spatial-object-kit" },
    attrs: handlers.builtinLocked ? { disabled: "" } : {},
    children: [
      el("option", { text: target.kitId, attrs: { value: target.kitId, selected: "" } }),
      ...kits.filter((kit) => kit.id !== target.kitId).map((kit) => el("option", {
        text: kit.name || kit.id,
        attrs: { value: kit.id },
      })),
    ],
  });
  const onGraphic = (): void => handlers.onGraphic(tilesetSelect.value, kitSelect.value);
  if (!handlers.builtinLocked) {
    tilesetSelect.addEventListener("change", onGraphic);
    kitSelect.addEventListener("change", onGraphic);
  }
  return el("div", {
    class: "spatial-object-graphic",
    children: [
      el("label", { class: "spatial-object-field", children: [el("span", { text: "타일셋" }), tilesetSelect] }),
      el("label", { class: "spatial-object-field", children: [el("span", { text: "칩/킷" }), kitSelect] }),
    ],
  });
}

function anchorFields(anchors: readonly SpatialPort[], handlers: SpatialObjectInspectorHandlers): HTMLElement {
  return el("fieldset", {
    class: "spatial-object-anchors",
    dataset: { testid: "spatial-object-anchors" },
    children: [
      el("legend", { text: "앵커" }),
      ...anchors.map((anchor, index) => el("div", {
        class: "spatial-object-anchor-row",
        children: [
          namedInput("이름", "text", anchor.name, `spatial-object-anchor-name-${index}`, (value) => {
            handlers.onAnchor(index, { name: value });
          }, handlers.builtinLocked),
          namedInput("X", "number", String(anchor.x), `spatial-object-anchor-x-${index}`, (value) => {
            handlers.onAnchor(index, { x: Number.parseInt(value, 10) || 0 });
          }, handlers.builtinLocked),
          namedInput("Y", "number", String(anchor.y), `spatial-object-anchor-y-${index}`, (value) => {
            handlers.onAnchor(index, { y: Number.parseInt(value, 10) || 0 });
          }, handlers.builtinLocked),
        ],
      })),
      el("button", {
        class: "spatial-action",
        text: "앵커 추가",
        attrs: { type: "button", ...(handlers.builtinLocked ? { disabled: "" } : {}) },
        dataset: { testid: "spatial-object-anchor-add" },
        on: handlers.builtinLocked ? undefined : { click: handlers.onAddAnchor },
      }),
    ],
  });
}

function chipFields(chips: ReadonlySet<string>, custom: string, handlers: SpatialObjectInspectorHandlers): HTMLElement {
  return el("fieldset", {
    class: "spatial-object-chips",
    dataset: { testid: "spatial-object-chips" },
    children: [
      el("legend", { text: "칩" }),
      ...COMMON_CHIPS.map((chip) => {
        const box = el("input", {
          attrs: {
            type: "checkbox",
            ...(chips.has(chip) ? { checked: "" } : {}),
            ...(handlers.builtinLocked ? { disabled: "" } : {}),
          },
          dataset: { testid: `spatial-object-chip-${chip}` },
        });
        if (!handlers.builtinLocked) {
          box.addEventListener("change", () => handlers.onChipToggle(chip, box.checked));
        }
        return el("label", { class: "spatial-object-chip", children: [box, el("span", { text: chip })] });
      }),
      namedInput("직접 입력", "text", custom, "spatial-object-chip-custom", handlers.onChipCustom, handlers.builtinLocked),
    ],
  });
}

function deletePreviewBlock(preview: ObjectDeletePreview): HTMLElement {
  const lines = [
    ...preview.kitThings.map((thing) => thing.label),
    ...preview.strong.map((entry) => entry.path),
    ...(preview.historical.length > 0 ? [`과거 배치 ${preview.historical.length}`] : []),
  ];
  return el("div", {
    class: "spatial-object-delete-preview",
    dataset: { testid: "spatial-delete-preview" },
    children: [
      el("p", { class: "spatial-inspector-sub", text: lines.length === 0 ? "참조 없음" : "영향받는 자료" }),
      ...lines.map((line) => el("p", { class: "spatial-object-impact", text: line })),
    ],
  });
}

function namedInput(
  label: string,
  type: string,
  value: string,
  testid: string,
  onChange: (value: string) => void,
  locked: boolean,
): HTMLElement {
  const input = el("input", {
    attrs: { type, ...(locked ? { disabled: "" } : {}) },
    value,
    dataset: { testid },
  });
  if (!locked) input.addEventListener("change", () => onChange(input.value));
  return el("label", { class: "spatial-object-field", children: [el("span", { text: label }), input] });
}

function actionButton(testid: string, label: string, onClick: () => void): HTMLElement {
  return el("button", {
    class: "spatial-action",
    text: label,
    attrs: { type: "button" },
    dataset: { testid },
    on: { click: onClick },
  });
}

function exteriorStoriesField(design: ObjectDesign, handlers: SpatialObjectInspectorHandlers): HTMLElement {
  const select = el("select", { attrs: { "aria-label": "건물 외형 층수" }, dataset: { testid: "spatial-object-exterior-stories" },
    children: [el("option", { attrs: { value: "" }, text: "건물 아님 / 미지정" }), ...[1, 2, 3, 4].map(n => el("option", { attrs: { value: String(n) }, text: `${n}층 외형` }))] }) as HTMLSelectElement;
  select.value = String(design.exteriorStories ?? "");
  select.disabled = handlers.builtinLocked;
  select.addEventListener("change", () => handlers.onExteriorStories?.(select.value ? Number(select.value) as 1 | 2 | 3 | 4 : undefined));
  return el("label", { children: [el("span", { text: "건물 외형 층수 (실내 공간은 별도)" }), select] });
}
