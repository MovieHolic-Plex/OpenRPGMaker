import { el, clearChildren } from "@/util/dom";
import { normalizeRgbHexColor } from "@/assets/transparentColorKey";
import { setMapTileset } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { resourceReferenceMessage } from "@/editor/databaseReferences";
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
import { renderResourceWorkbench, type ResourceCategory } from "./resourceManagerViews";
import { faceCellSuffix, planFacesetSheetSplit, sliceFacesetSheetDataUrls, type FacesetSheetSplitPlan } from "@/assets/facesetSheetSlicing";
import { FACE_IMAGE_SIZE } from "@/assets/resourceSlicing";
import {
  IMAGE_IMPORT_ACCEPT,
  decideImageDataUrl,
  decideImageImport,
  formatImageImportDimensionError,
  prepareImportedImageDataUrl,
} from "./resourceManagerImageImport";
import { resourceKindFromUpload } from "./resourceManagerUtils";
import { importMediaResource, mediaImportRuleFor } from "./resourceManagerMediaImport";

type TilesetEnsureResult = {
  readonly id: TilesetDef["id"];
  readonly created: boolean;
};

export const RESOURCE_MANAGER_CATEGORIES = [
  { kind: "backdrop", label: "전투 배경" },
  { kind: "battle", label: "전투 애니메이션" },
  { kind: "battleCharset", label: "전투 캐릭터셋" },
  { kind: "battleWeapon", label: "전투 무기" },
  { kind: "charset", label: "캐릭터셋" },
  { kind: "chipset", label: "칩셋" },
  { kind: "faceset", label: "얼굴 그래픽" },
  { kind: "gameOver", label: "게임 오버" },
  { kind: "monster", label: "몬스터" },
  { kind: "music", label: "음악 (BGM)" },
  { kind: "picture", label: "그림" },
  { kind: "movie", label: "동영상" },
  { kind: "sound", label: "효과음 (SE)" },
  { kind: "system", label: "시스템" },
  { kind: "system2", label: "시스템 2" },
  { kind: "title", label: "타이틀" },
] as const satisfies readonly ResourceCategory[];

let selectedResourceKind: ResourceKind = "backdrop";

function makeTilesetFromUpload(asset: UploadedAsset): TilesetDef {
  const kind = resourceKindFromUpload(asset.kind);
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
  const transparentColor = asset.meta.transparentColor ? normalizeRgbHexColor(asset.meta.transparentColor) : null;
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
    ...(transparentColor ? { transparentColor } : {}),
  };
}

export function renderResourceManager(container: HTMLElement): void {
  clearChildren(container);
  const project = store.getCurrent();
  const uploaded = Object.values(project.assets.uploaded);
  const kindSel = el("select", { dataset: { testid: "resource-kind-select" } }) as HTMLSelectElement;
  kindSel.className = "rm-hidden-kind-select";
  for (const spec of RESOURCE_PROFILE_SPECS.filter((profile) => profile.media === "image")) {
    kindSel.append(el("option", { text: spec.label, attrs: { value: spec.kind } }));
  }
  kindSel.value = selectedResourceKind;
  kindSel.addEventListener("change", () => {
    selectedResourceKind = kindSel.value as ResourceKind;
    renderResourceManager(container);
  });

  const fileInput = document.createElement("input");
  const mediaRule = mediaImportRuleFor(selectedResourceKind);
  fileInput.type = "file";
  fileInput.accept = mediaRule?.accept ?? IMAGE_IMPORT_ACCEPT;
  fileInput.style.display = "none";
  fileInput.dataset.testid = "resource-file-input";
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (mediaRule !== null) {
      importMediaResource(file, mediaRule, () => renderResourceManager(container));
    } else {
      importImageResource(file, selectedResourceKind, container);
    }
    fileInput.value = "";
  });

  renderResourceWorkbench(container, {
    categories: RESOURCE_MANAGER_CATEGORIES,
    selectedKind: selectedResourceKind,
    profiles: project.resourceProfiles,
    uploaded,
    kindSelect: kindSel,
    fileInput,
    actions: {
      addTileset: addTilesetFromUpload,
      applyTileset: applyTilesetToCurrentMap,
      deleteAsset: deleteUploadedAsset,
    },
    onSelectKind: (kind) => {
      selectedResourceKind = kind;
      renderResourceManager(container);
    },
    onImport: () => fileInput.click(),
  });
  container.append(
    el("div", {
      class: "empty-hint",
      text: `기본 포함 리소스: ${DEFAULT_TILESET_ID}, EasyRPG 타일 그림판·캐릭터 그림.`,
    })
  );
}

function importImageResource(file: File, kind: ResourceKind, container: HTMLElement): void {
  const decision = decideImageImport({ fileName: file.name, mimeType: file.type, sizeBytes: file.size });
  if (!decision.ok) {
    toast(decision.message, "error");
    return;
  }
  const normalizeToPng = decision.normalizeToPng;

  const reader = new FileReader();
  reader.onload = () => {
    const rawDataUrl = String(reader.result);
    const urlDecision = decideImageDataUrl(rawDataUrl);
    if (!urlDecision.ok) {
      toast(urlDecision.message, "error");
      return;
    }
    void prepareImportedImageDataUrl(rawDataUrl, normalizeToPng || urlDecision.normalizeToPng).then(
      ({ dataUrl, width, height }) => {
        const facesetPlan = kind === "faceset" ? planFacesetSheetSplit(width, height) : null;
        if (facesetPlan !== null) {
          void importFacesetSheetAsFaces(dataUrl, file.name, facesetPlan, container);
          return;
        }
        const result = validateResourceDimensions(kind, width, height);
        if (!result.ok) {
          toast(formatImageImportDimensionError(result.message, width, height), "error");
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
            width,
            height,
          },
        };
        store.update((project) => {
          project.assets.uploaded[id] = asset;
          project.resourceProfiles.push({
            kind,
            name: asset.name,
            tileWidth: spec.tileWidth,
            tileHeight: spec.tileHeight,
            imageWidth: width,
            imageHeight: height,
            assetId: id,
          });
        });
        const converted = dataUrl !== rawDataUrl ? " (WebP/GIF→PNG 변환)" : "";
        toast(`${spec.label} 가져오기 완료: ${width}x${height}${converted}`, "ok");
        if (kind === "chipset") {
          const tileset = ensureTilesetFromUpload(asset);
          if (tileset.created) toast(`타일셋 추가됨: ${asset.name}`, "ok");
        }
        renderResourceManager(container);
      },
      (error: unknown) => {
        toast(error instanceof Error ? error.message : "이미지를 읽을 수 없습니다.", "error");
      }
    );
  };
  reader.onerror = () => toast("파일 읽기 실패", "error");
  reader.readAsDataURL(file);
}


async function importFacesetSheetAsFaces(
  dataUrl: string,
  fileName: string,
  plan: FacesetSheetSplitPlan,
  container: HTMLElement
): Promise<void> {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  let slices: readonly string[];
  try {
    slices = await sliceFacesetSheetDataUrls(dataUrl, plan);
  } catch {
    toast("얼굴 시트를 나누지 못했습니다.", "error");
    return;
  }
  const baseId = genId("faceset_img");
  store.update((project) => {
    slices.forEach((slice, index) => {
      const id = `${baseId}-${faceCellSuffix(index)}`;
      project.assets.uploaded[id] = {
        id,
        name: `${baseName} 얼굴 ${index + 1}`,
        kind: "faceset",
        dataUrl: slice,
        meta: {
          tileSize: FACE_IMAGE_SIZE,
          frames: 1,
          frameWidth: FACE_IMAGE_SIZE,
          frameHeight: FACE_IMAGE_SIZE,
          width: FACE_IMAGE_SIZE,
          height: FACE_IMAGE_SIZE,
        },
      };
      project.resourceProfiles.push({
        kind: "faceset",
        name: `${baseName} 얼굴 ${index + 1}`,
        imageWidth: FACE_IMAGE_SIZE,
        imageHeight: FACE_IMAGE_SIZE,
        assetId: id,
      });
    });
  });
  toast(`얼굴 시트를 낱장 ${slices.length}장으로 나눠 등록했습니다.`, "ok");
  renderResourceManager(container);
}

function addTilesetFromUpload(asset: UploadedAsset): void {
  const result = ensureTilesetFromUpload(asset);
  toast(result.created ? `타일셋 추가됨: ${asset.name}` : `이미 추가된 타일셋: ${asset.name}`, "ok");
}

function applyTilesetToCurrentMap(asset: UploadedAsset): void {
  const result = ensureTilesetFromUpload(asset);
  setMapTileset(currentMapId(), result.id);
  toast(`현재 맵 타일 그림판 적용: ${asset.name}`, "ok");
}

function deleteUploadedAsset(asset: UploadedAsset): void {
  const blocker = uploadedResourceDeleteBlocker(asset.id);
  if (blocker) {
    toast(blocker, "error");
    return;
  }
  store.update((project) => {
    delete project.assets.uploaded[asset.id];
    project.resourceProfiles = project.resourceProfiles.filter((profile) => profile.assetId !== asset.id);
  });
  toast(`업로드 리소스 삭제됨: ${asset.name}`, "ok");
}

function uploadedResourceDeleteBlocker(assetId: UploadedAsset["id"]): string | null {
  const project = store.getCurrent();
  const databaseBlocker = resourceReferenceMessage(assetId);
  if (databaseBlocker) return databaseBlocker;
  const tileset = Object.values(project.tilesets).find((candidate) => candidate.image.type === "uploaded" && candidate.image.id === assetId);
  if (!tileset) return null;
  if (Object.values(project.maps).some((map) => map.tilesetId === tileset.id)) {
    return "현재 맵 또는 다른 맵이 이 타일셋 리소스를 사용 중입니다.";
  }
  return "타일셋 목록이 이 업로드 리소스를 사용 중입니다.";
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
