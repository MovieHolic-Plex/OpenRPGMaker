import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";
import { getResourceProfileSpec } from "@/project/resourceProfiles";
import type { ResourceProfile, UploadedAsset } from "@/project/types";
import { el } from "@/util/dom";
import { makeResourcePreviewGrid, resourceKindFromUpload, uploadedResourceKindLabel } from "./resourceManagerUtils";

export type UploadedAssetActions = {
  addTileset(asset: UploadedAsset): void;
  applyTileset(asset: UploadedAsset): void;
  deleteAsset(asset: UploadedAsset): void;
};

export type ResourceCategory = {
  readonly kind: ResourceProfile["kind"];
  readonly label: string;
};

export type ResourceWorkbenchOptions = {
  readonly categories: readonly ResourceCategory[];
  readonly selectedKind: ResourceProfile["kind"];
  readonly profiles: readonly ResourceProfile[];
  readonly uploaded: readonly UploadedAsset[];
  readonly kindSelect: HTMLSelectElement;
  readonly fileInput: HTMLInputElement;
  readonly actions: UploadedAssetActions;
  readonly onSelectKind: (kind: ResourceProfile["kind"]) => void;
  readonly onImport: () => void;
};

export function renderResourceWorkbench(container: HTMLElement, options: ResourceWorkbenchOptions): void {
  const selectedProfiles = options.profiles.filter((profile) => profile.kind === options.selectedKind);
  const selectedUploaded = options.uploaded.filter((asset) => resourceKindFromUpload(asset.kind) === options.selectedKind);
  container.append(
    el("div", {
      class: "rm-classic-shell",
      children: [
        resourceCategoryList(options),
        resourceEntryList(selectedProfiles, selectedUploaded, options.actions),
        resourceCommandPanel(options),
      ],
    }),
    options.kindSelect,
    options.fileInput
  );
}

export function renderResourceProfiles(container: HTMLElement, profiles: readonly ResourceProfile[]): void {
  container.append(el("h3", { text: `프로필 (${profiles.length})` }));
  const list = el("div", { class: "rm-profile-list", dataset: { testid: "resource-profile-list" } });
  for (const profile of profiles) {
    list.append(resourceProfileRow(profile));
  }
  container.append(list);
}

export function renderUploadedAssets(
  container: HTMLElement,
  uploaded: readonly UploadedAsset[],
  actions: UploadedAssetActions
): void {
  container.append(el("h3", { text: `업로드 (${uploaded.length})` }));
  const list = el("div", { class: "rm-upload-list", dataset: { testid: "resource-upload-list" } });
  if (uploaded.length === 0) {
    list.append(el("div", { class: "empty-hint", text: "아직 업로드한 리소스가 없습니다." }));
  }
  for (const asset of uploaded) {
    list.append(uploadedAssetRow(asset, actions));
  }
  container.append(list);
}

function resourceProfileRow(profile: ResourceProfile): HTMLElement {
  const project = store.getCurrent();
  const spec = getResourceProfileSpec(profile.kind);
  const text = [
    spec.label,
    profile.name,
    profile.imageWidth && profile.imageHeight ? `${profile.imageWidth}x${profile.imageHeight}` : undefined,
    profile.tileWidth && profile.tileHeight ? `${profile.tileWidth}x${profile.tileHeight}` : undefined,
    profile.assetId,
  ].filter(Boolean).join(" · ");
  const row = el("div", { class: "rm-profile-row", dataset: { testid: `resource-profile-${profile.kind}` }, text });
  const previewUrl = resolveAssetResourceUrl(profile.assetId, { project });
  const isAudio = profile.kind === "music" || profile.kind === "sound";
  if (previewUrl && profile.kind !== "chipset" && !isAudio) {
    const thumb = el("img", { attrs: { alt: `${profile.name} 미리보기`, src: previewUrl } }) as HTMLImageElement;
    thumb.className = "rm-profile-thumb";
    row.prepend(thumb);
  }
  if (isAudio) {
    row.prepend(el("span", { class: "rm-profile-audio-badge", text: profile.kind === "music" ? "♪ BGM" : "♪ SE", attrs: { "aria-hidden": "true" } }));
  }
  if (profile.kind === "chipset") {
    row.append(makeResourcePreviewGrid(profile.imageWidth ?? 0, profile.imageHeight ?? 0, profile.tileWidth ?? 16));
  }
  return row;
}

function resourceCategoryList(options: ResourceWorkbenchOptions): HTMLElement {
  const list = el("div", {
    class: "rm-category-list",
    attrs: { role: "listbox", "aria-label": "리소스 종류" },
    dataset: { testid: "resource-category-list" },
  });
  for (const category of options.categories) {
    const selected = category.kind === options.selectedKind;
    list.append(
      el("button", {
        class: selected ? "rm-category-row active" : "rm-category-row",
        text: category.label,
        attrs: {
          type: "button",
          role: "option",
          "aria-selected": selected ? "true" : "false",
        },
        on: { click: () => options.onSelectKind(category.kind) },
      })
    );
  }
  return list;
}

function resourceEntryList(
  profiles: readonly ResourceProfile[],
  uploaded: readonly UploadedAsset[],
  actions: UploadedAssetActions
): HTMLElement {
  const list = el("div", { class: "rm-entry-list", dataset: { testid: "resource-entry-list" } });
  if (profiles.length === 0 && uploaded.length === 0) {
    list.append(el("div", { class: "rm-entry-empty", text: "이 종류의 리소스가 없습니다." }));
    return list;
  }
  for (const profile of profiles) {
    list.append(resourceProfileRow(profile));
  }
  renderUploadedAssets(list, uploaded, actions);
  return list;
}

function resourceCommandPanel(options: ResourceWorkbenchOptions): HTMLElement {
  return el("aside", {
    class: "rm-command-panel",
    dataset: { testid: "resource-command-panel" },
    children: [
      el("button", {
        class: "rm-command-button primary",
        text: "가져오기...",
        attrs: { type: "button" },
        dataset: { testid: "resource-import-button" },
        on: { click: options.onImport },
      }),
      el("button", { class: "rm-command-button", text: "내보내기...", attrs: { type: "button", disabled: "true" } }),
      el("button", { class: "rm-command-button", text: "삭제", attrs: { type: "button", disabled: "true" } }),
      importFormatNote(),
      el("div", { class: "rm-preview-well", attrs: { "aria-label": "미리보기" } }),
    ],
  });
}

function importFormatNote(): HTMLElement {
  return el("div", {
    class: "rm-import-format",
    dataset: { testid: "resource-import-format" },
    children: [
      el("div", { class: "rm-import-format-title", text: "가져오기 형식" }),
      el("div", { text: "PNG·JPEG (표준)" }),
      el("div", { text: "WebP·GIF (PNG 첫 프레임으로 자동 변환)" }),
    ],
  });
}

function uploadedAssetRow(asset: UploadedAsset, actions: UploadedAssetActions): HTMLElement {
  const row = el("div", { class: "rm-asset-row", dataset: { testid: `resource-upload-${asset.id}` } });
  const preview = el("img", { attrs: { src: asset.dataUrl, alt: `${asset.name} 미리보기` } }) as HTMLImageElement;
  preview.className = "rm-preview";
  const dims = asset.meta.width && asset.meta.height ? `${asset.meta.width}x${asset.meta.height}px` : "크기 미확인";
  row.append(preview, uploadedAssetInfo(asset, dims));
  if (asset.kind === "chipset" || asset.kind === "tileset") {
    row.append(tilesetActions(asset, actions));
  }
  row.append(el("button", {
    class: "btn danger",
    text: "삭제",
    dataset: { testid: `resource-delete-${asset.id}` },
    on: { click: () => actions.deleteAsset(asset) },
  }));
  return row;
}

function uploadedAssetInfo(asset: UploadedAsset, dims: string): HTMLElement {
  return el("div", {
    class: "rm-asset-info",
    children: [
      el("div", { class: "rm-asset-name", text: asset.name }),
      el("div", { class: "rm-asset-kind", text: `${uploadedResourceKindLabel(asset)} · ${asset.id.slice(0, 12)}` }),
      el("div", { class: "rm-asset-dims", text: dims }),
    ],
  });
}

function tilesetActions(asset: UploadedAsset, actions: UploadedAssetActions): HTMLElement {
  return el("div", {
    class: "rm-asset-actions",
    children: [
      el("button", {
        class: "btn",
        text: "타일셋 추가",
        dataset: { testid: `resource-add-tileset-${asset.id}` },
        on: { click: () => actions.addTileset(asset) },
      }),
      el("button", {
        class: "btn primary",
        text: "현재 맵에 적용",
        dataset: { testid: `resource-apply-tileset-${asset.id}` },
        on: { click: () => actions.applyTileset(asset) },
      }),
    ],
  });
}
