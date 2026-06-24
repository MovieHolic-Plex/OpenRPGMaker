import { el, clearChildren } from "@/util/dom";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { setMapTileset } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";
import { DEFAULT_TILESET_ID } from "@/project/defaults";
import {
  getResourceProfileSpec,
  RESOURCE_PROFILE_SPECS,
  validateResourceDimensions,
} from "@/project/resourceProfiles";
import type { PassFlag, ResourceKind, TilesetDef, UploadedAsset } from "@/project/types";

type TilesetEnsureResult = {
  readonly id: TilesetDef["id"];
  readonly created: boolean;
};

function makeTilesetFromUpload(asset: UploadedAsset): TilesetDef {
  const kind = toResourceKind(asset.kind);
  const spec = getResourceProfileSpec(kind ?? "chipset");
  const tileSize = spec.tileWidth ?? asset.meta.tileSize ?? 16;
  const width = asset.meta.width ?? asset.meta.frameWidth ?? tileSize;
  const height = asset.meta.height ?? asset.meta.frameHeight ?? tileSize;
  const tilesPerRow = Math.max(1, Math.floor(width / tileSize));
  const count = Math.max(1, tilesPerRow * Math.floor(height / (spec.tileHeight ?? tileSize)));
  const passability: PassFlag[] = [];
  const priority: ("lower" | "upper")[] = [];
  const terrain: number[] = [];
  for (let index = 0; index < count; index++) {
    passability.push({ up: true, down: true, left: true, right: true });
    priority.push("lower");
    terrain.push(0);
  }
  return {
    id: genId("ts"),
    name: asset.name,
    image: { type: "uploaded", id: asset.id },
    tileSize,
    tilesPerRow,
    count,
    passability,
    priority,
    terrain,
  };
}

export function renderResourceManager(container: HTMLElement): void {
  clearChildren(container);
  const project = store.getCurrent();
  const uploaded = Object.values(project.assets.uploaded);

  container.append(el("h3", { text: "리소스 관리자" }));

  const importRow = el("div", { class: "rm-import-row" });
  const kindSel = el("select", { dataset: { testid: "resource-kind-select" } }) as HTMLSelectElement;
  for (const spec of RESOURCE_PROFILE_SPECS.filter((profile) => profile.media === "image")) {
    kindSel.append(el("option", { text: spec.label, attrs: { value: spec.kind } }));
  }

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/jpeg";
  fileInput.style.display = "none";
  fileInput.dataset.testid = "resource-file-input";
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    importImageResource(file, kindSel.value as ResourceKind, container);
    fileInput.value = "";
  });

  importRow.append(
    el("label", { text: "종류" }),
    kindSel,
    el("button", {
      class: "btn primary",
      text: "+ 가져오기",
      dataset: { testid: "resource-import-button" },
      on: { click: () => fileInput.click() },
    })
  );
  container.append(importRow, fileInput);

  renderProfiles(container);
  renderUploadedAssets(container, uploaded);
  container.append(
    el("div", {
      class: "empty-hint",
      text: `기본 포함 리소스: ${DEFAULT_TILESET_ID}, EasyRPG RTP 이미지, hero, npc_villager.`,
    })
  );
}

function importImageResource(file: File, kind: ResourceKind, container: HTMLElement): void {
  const maxBytes = 4 * 1024 * 1024;
  if (file.size > maxBytes) {
    toast(`파일이 너무 큽니다. ${(file.size / 1024 / 1024).toFixed(1)}MB > 4MB`, "error");
    return;
  }
  if (!/\.(png|jpe?g)$/i.test(file.name)) {
    toast("PNG/JPEG 파일만 사용할 수 있습니다.", "error");
    return;
  }

  if (file.type !== "image/png" && file.type !== "image/jpeg") {
    toast("PNG/JPEG image MIME only.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    if (!dataUrl.startsWith("data:image/png;") && !dataUrl.startsWith("data:image/jpeg;")) {
      toast("PNG/JPEG image data only.", "error");
      return;
    }
    const probe = new Image();
    probe.onload = () => {
      const result = validateResourceDimensions(kind, probe.width, probe.height);
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      const spec = getResourceProfileSpec(kind);
      const id = genId(`${kind}_img`);
      const asset: UploadedAsset = {
        id,
        name: file.name.replace(/\.[^.]+$/, ""),
        kind,
        dataUrl,
        meta: {
          tileSize: spec.tileWidth,
          frames: result.tileCount,
          frameWidth: spec.tileWidth,
          frameHeight: spec.tileHeight,
          width: probe.width,
          height: probe.height,
        },
      };
      store.update((project) => {
        project.assets.uploaded[id] = asset;
        project.resourceProfiles.push({
          kind,
          name: asset.name,
          tileWidth: spec.tileWidth,
          tileHeight: spec.tileHeight,
          imageWidth: probe.width,
          imageHeight: probe.height,
          assetId: id,
        });
      });
      toast(`${spec.label} 가져오기 완료: ${probe.width}x${probe.height}`, "ok");
      renderResourceManager(container);
    };
    probe.onerror = () => toast("이미지를 읽을 수 없습니다.", "error");
    probe.src = dataUrl;
  };
  reader.onerror = () => toast("파일 읽기 실패", "error");
  reader.readAsDataURL(file);
}

function renderProfiles(container: HTMLElement): void {
  const project = store.getCurrent();
  const profiles = project.resourceProfiles;
  container.append(el("h3", { text: `프로필 (${profiles.length})` }));
  for (const profile of profiles) {
    const spec = getResourceProfileSpec(profile.kind);
    const text = [
      spec.label,
      profile.name,
      profile.imageWidth && profile.imageHeight ? `${profile.imageWidth}x${profile.imageHeight}` : undefined,
      profile.tileWidth && profile.tileHeight ? `${profile.tileWidth}x${profile.tileHeight}` : undefined,
      profile.assetId,
    ]
      .filter(Boolean)
      .join(" · ");
    const row = el("div", {
      class: "rm-profile-row",
      dataset: { testid: `resource-profile-${profile.kind}` },
      text,
    });
    const previewUrl = resolveAssetResourceUrl(profile.assetId, { project });
    if (previewUrl && profile.kind !== "chipset") {
      const thumb = el("img", { attrs: { alt: `${profile.name} 미리보기`, src: previewUrl } }) as HTMLImageElement;
      thumb.className = "rm-profile-thumb";
      row.prepend(thumb);
    }
    if (profile.kind === "chipset") {
      row.append(makePreviewGrid(profile.imageWidth ?? 0, profile.imageHeight ?? 0, profile.tileWidth ?? 16));
    }
    container.append(row);
  }
}

function renderUploadedAssets(container: HTMLElement, uploaded: UploadedAsset[]): void {
  container.append(el("h3", { text: `업로드 (${uploaded.length})` }));
  if (uploaded.length === 0) {
    container.append(el("div", { class: "empty-hint", text: "아직 업로드한 리소스가 없습니다." }));
  }
  for (const asset of uploaded) {
    const row = el("div", { class: "rm-asset-row" });
    const preview = el("img", { attrs: { src: asset.dataUrl, alt: asset.name } }) as HTMLImageElement;
    preview.className = "rm-preview";
    row.append(preview);
    const info = el("div", { class: "rm-asset-info" });
    const dims = asset.meta.width && asset.meta.height ? `${asset.meta.width}x${asset.meta.height}px` : "?";
    const kind = toResourceKind(asset.kind);
    const kindLabel = kind ? getResourceProfileSpec(kind).label : asset.kind;
    info.append(
      el("div", { class: "rm-asset-name", text: asset.name }),
      el("div", { class: "rm-asset-kind", text: `${kindLabel} · ${asset.id.slice(0, 12)}` }),
      el("div", { class: "rm-asset-dims", text: dims })
    );
    row.append(info);
    if (asset.kind === "chipset" || asset.kind === "tileset") {
      const actions = el("div", { class: "rm-asset-actions" });
      actions.append(
        el("button", {
          class: "btn",
          text: "타일셋 추가",
          dataset: { testid: `resource-add-tileset-${asset.id}` },
          on: {
            click: () => {
              const result = ensureTilesetFromUpload(asset);
              toast(result.created ? `타일셋 추가됨: ${asset.name}` : `이미 추가된 타일셋: ${asset.name}`, "ok");
            },
          },
        })
      );
      actions.append(
        el("button", {
          class: "btn primary",
          text: "현재 맵에 적용",
          dataset: { testid: `resource-apply-tileset-${asset.id}` },
          on: {
            click: () => {
              const result = ensureTilesetFromUpload(asset);
              setMapTileset(currentMapId(), result.id);
              toast(`현재 맵 칩셋 적용: ${asset.name}`, "ok");
            },
          },
        })
      );
      row.append(actions);
    }
    row.append(
      el("button", {
        class: "btn danger",
        text: "삭제",
        on: {
          click: () => {
            store.update((project) => {
              delete project.assets.uploaded[asset.id];
              project.resourceProfiles = project.resourceProfiles.filter((profile) => profile.assetId !== asset.id);
            });
          },
        },
      })
    );
    container.append(row);
  }
}

function ensureTilesetFromUpload(asset: UploadedAsset): TilesetEnsureResult {
  const existingId = uploadedTilesetIdForAsset(asset.id);
  if (existingId) return { id: existingId, created: false };
  const tileset = makeTilesetFromUpload(asset);
  store.update((project) => {
    project.tilesets[tileset.id] = tileset;
  });
  return { id: tileset.id, created: true };
}

function uploadedTilesetIdForAsset(assetId: UploadedAsset["id"]): TilesetDef["id"] | null {
  const project = store.getCurrent();
  const tileset = Object.values(project.tilesets).find((candidate) => {
    return candidate.image.type === "uploaded" && candidate.image.id === assetId;
  });
  return tileset?.id ?? null;
}

function currentMapId(): string {
  const project = store.getCurrent();
  return editorState.get().currentMapId ?? project.startMapId;
}

function makePreviewGrid(width: number, height: number, tileSize: number): HTMLElement {
  const grid = el("div", { class: "rm-tile-grid" });
  const count = width > 0 && height > 0 ? Math.min(16, (width / tileSize) * (height / tileSize)) : 4;
  for (let index = 0; index < count; index++) {
    grid.append(el("div", { class: "rm-tile-cell", text: String(index), dataset: { testid: `resource-tile-${index}` } }));
  }
  return grid;
}

function toResourceKind(kind: UploadedAsset["kind"]): ResourceKind | null {
  if (kind === "tileset") return "chipset";
  if (kind === "sprite") return "charset";
  return kind;
}
