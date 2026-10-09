import { BUNDLED_IMAGE_ASSETS } from "@/assets/bundled";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { getResourceProfileSpec } from "@/project/resourceProfiles";
import type { ResourceKind, ResourceProfile, UploadedAsset } from "@/project/types";
import { el } from "@/util/dom";

// 번들 프로젝트는 같은 시트를 두 네임스페이스로 등록한다 — 번들 textureKey(`tex_*`)와
// RTP 매니페스트 id(`easyrpg-*`). resourceProfiles 에는 둘 다 남는 게 맞다(리소스 참조와
// 저작 메타가 어느 id 로도 온다). 다만 리소스 관리자 목록에 같은 그림이 두 장 보이면
// 중복으로 읽히므로, 표시할 때는 정본 id 하나로 접는다.
const BUNDLED_CHIPSET_TEXTURE_BY_ALIAS = new Map<string, string>();
for (const asset of BUNDLED_IMAGE_ASSETS) {
  const file = asset.path.slice(asset.path.lastIndexOf("/") + 1).replace(/\.png$/iu, "");
  const alias = file.endsWith("-transparent") ? file.slice(0, -"-transparent".length) : file;
  if (alias.startsWith("easyrpg-chipset-")) BUNDLED_CHIPSET_TEXTURE_BY_ALIAS.set(alias, asset.textureKey);
}

export function canonicalResourceProfileId(assetId: string): string {
  return BUNDLED_CHIPSET_TEXTURE_BY_ALIAS.get(assetId) ?? findCharsetAsset(assetId)?.textureKey ?? assetId;
}

// 오디오·몬스터 카탈로그와 같은 규칙: 업로드 자산과 id 가 겹치는 프로필은 업로드 카드가 대신 보이고,
// 별칭 프로필은 정본 id 카드가 대신 보인다. 정본 프로필이 없는 별칭만 남은 프로젝트는 그대로 보인다.
export function dedupeListedProfiles(profiles: readonly ResourceProfile[], uploaded: readonly UploadedAsset[]): ResourceProfile[] {
  const uploadedIds = new Set(uploaded.map((asset) => asset.id));
  const byId = new Map<string, ResourceProfile>();
  let anonymous = 0;
  for (const profile of profiles) {
    if (profile.assetId !== undefined && uploadedIds.has(profile.assetId)) continue;
    const key = profile.assetId === undefined ? `anonymous:${anonymous++}` : canonicalResourceProfileId(profile.assetId);
    const existing = byId.get(key);
    if (existing === undefined || (existing.assetId !== key && profile.assetId === key)) byId.set(key, profile);
  }
  return [...byId.values()];
}

export function resourceKindFromUpload(kind: UploadedAsset["kind"]): ResourceKind | null {
  if (kind === "tileset") return "chipset";
  if (kind === "sprite") return "charset";
  return kind;
}

export function uploadedResourceKindLabel(asset: UploadedAsset): string {
  const kind = resourceKindFromUpload(asset.kind);
  return kind ? getResourceProfileSpec(kind).label : asset.kind;
}

export function makeResourcePreviewGrid(width: number, height: number, tileSize: number): HTMLElement {
  const grid = el("div", { class: "rm-tile-grid" });
  const count = width > 0 && height > 0 ? Math.min(16, (width / tileSize) * (height / tileSize)) : 4;
  for (let index = 0; index < count; index++) {
    grid.append(el("div", { class: "rm-tile-cell", text: String(index), dataset: { testid: `resource-tile-${index}` } }));
  }
  return grid;
}
