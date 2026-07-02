import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { ActorRecord, Project } from "@/project/types";
import type { StatusMenuCommandId } from "@/player/playerStatusMenuModel";
import { actorFace } from "@/player/playerStatusMenuFunctionData";
import { el } from "@/util/dom";

export type ClassicSceneOptions = {
  readonly commandId: StatusMenuCommandId;
  readonly title: string;
  readonly testId: string;
  readonly className: string;
  readonly children: readonly HTMLElement[];
};

export type ActionButtonOptions = {
  readonly testId: string;
  readonly className: string;
  readonly children: readonly HTMLElement[];
  readonly onClick?: () => void;
  readonly disabled?: boolean;
};

export function classicScene(options: ClassicSceneOptions): HTMLElement {
  return el("section", {
    class: `status-menu-fullscreen-scene status-menu-classic-scene ${options.className}`,
    attrs: { "aria-label": options.title },
    dataset: { testid: `status-menu-fullscreen-${options.commandId}` },
    children: [
      el("h2", {
        class: "status-menu-detail-title status-menu-classic-title",
        text: options.title,
        dataset: { testid: "status-menu-detail-title" },
      }),
      el("div", { class: "status-menu-classic-content", dataset: { testid: options.testId }, children: [...options.children] }),
    ],
  });
}

export function classicWindow(className: string, children: readonly HTMLElement[], testId?: string): HTMLElement {
  return el("div", {
    class: `status-menu-classic-window ${className}`,
    dataset: testId ? { testid: testId } : undefined,
    children: [...children],
  });
}

export function descriptionStrip(text: string): HTMLElement {
  return classicWindow("status-menu-classic-description-strip", [
    el("span", { text: text || " " }),
  ], "status-menu-classic-description");
}

export function actionButton(options: ActionButtonOptions): HTMLElement {
  return el("button", {
    class: `status-menu-detail-action ${options.className}`,
    attrs: { type: "button", ...(options.disabled ? { disabled: "true" } : {}) },
    dataset: { testid: options.testId },
    on: options.onClick && !options.disabled ? { click: options.onClick } : undefined,
    children: [...options.children],
  });
}

export function entryIcon(project: Project, resourceId: string | undefined, label: string): HTMLElement {
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) {
    return el("span", {
      class: "status-menu-entry-icon status-menu-classic-small-icon missing",
      text: "□",
      attrs: { role: "img", "aria-label": `${label} icon missing` },
      dataset: { testid: "status-menu-entry-icon" },
    });
  }
  return el("img", {
    class: "status-menu-entry-icon status-menu-classic-small-icon",
    attrs: { src: url, alt: `${label} icon` },
    dataset: { testid: "status-menu-entry-icon" },
  });
}

export function actorFaceTile(project: Project, actor: ActorRecord, className = ""): HTMLElement {
  const url = resolveAssetResourceUrl(actorFace(actor), { project });
  const faceIndex = actorFaceIndex(actor);
  const col = faceIndex % 4;
  const row = Math.floor(faceIndex / 4);
  if (!url) {
    return el("div", {
      class: `status-menu-classic-face missing ${className}`,
      text: actor.name.slice(0, 1),
      attrs: { role: "img", "aria-label": `${actor.name} face missing` },
      dataset: { testid: "status-menu-entry-icon" },
    });
  }
  return el("div", {
    class: `status-menu-classic-face actor-sheet-crop ${className}`,
    attrs: {
        role: "img",
        "aria-label": `${actor.name} face`,
        style: [
          `--crop-url:url("${url}")`,
          "--crop-width:var(--status-face-size)",
          "--crop-height:var(--status-face-size)",
          `--crop-x:calc(var(--status-face-size) * ${-col})`,
          `--crop-y:calc(var(--status-face-size) * ${-row})`,
          "--crop-sheet-width:calc(var(--status-face-size) * 4)",
          "--crop-sheet-height:calc(var(--status-face-size) * 4)",
        ].join(";"),
      },
    dataset: { testid: "status-menu-entry-icon" },
  });
}

function actorFaceIndex(actor: ActorRecord): number {
  switch (actor.id) {
    case "actor_cleric":
    case "actor_ranger":
      return 1;
    default:
      return 0;
  }
}
