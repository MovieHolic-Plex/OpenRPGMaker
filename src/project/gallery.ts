// 갤러리 — 시스템에서 켜고, 메뉴에 보일 이름을 정한다.
// 그림 표시의 recordInGallery 가 켜진 그림만 세이브에 남긴다.

export const DEFAULT_GALLERY_LABEL = "갤러리";
export const GALLERY_LABEL_MAX = 24;
export const GALLERY_UNLOCK_MAX = 200;
export const SCENE_SWITCH_ID = "sw_scene_seen";
export const SCENE_PICTURE_ID = "scene";

export type GallerySettings = {
  readonly enabled: boolean;
  readonly label?: string;
};

type GalleryHost = {
  readonly system?: {
    readonly gallery?: {
      readonly enabled?: boolean;
      readonly label?: string;
    };
  };
};

export function isGalleryEnabled(project: GalleryHost | undefined): boolean {
  return project?.system?.gallery?.enabled === true;
}

export function galleryMenuLabel(project: GalleryHost | undefined): string {
  const raw = project?.system?.gallery?.label;
  const label = typeof raw === "string" ? raw.trim() : "";
  return label.length > 0 ? label.slice(0, GALLERY_LABEL_MAX) : DEFAULT_GALLERY_LABEL;
}

/** 꺼져 있고 이름도 기본이면 필드를 저장하지 않는다. 켠 적 있는 이름은 꺼도 남긴다. */
export function normalizeGallerySettings(
  value: { readonly enabled?: boolean; readonly label?: string } | undefined,
): GallerySettings | undefined {
  if (!value) return undefined;
  const enabled = value.enabled === true;
  const trimmed = typeof value.label === "string" ? value.label.trim().slice(0, GALLERY_LABEL_MAX) : "";
  const custom = trimmed.length > 0 && trimmed !== DEFAULT_GALLERY_LABEL;
  if (!enabled && !custom) return undefined;
  return custom ? { enabled, label: trimmed } : { enabled };
}

export function listGalleryUnlocks(
  session: { readonly galleryUnlocks?: readonly string[] } | undefined,
): readonly string[] {
  return session?.galleryUnlocks ?? [];
}

export function recordGalleryUnlock(
  session: { galleryUnlocks?: string[] },
  resourceId: string,
): void {
  const id = resourceId.trim();
  if (!id) return;
  const current = session.galleryUnlocks ?? [];
  if (current.includes(id)) return;
  const next = [...current, id];
  session.galleryUnlocks = next.length > GALLERY_UNLOCK_MAX ? next.slice(next.length - GALLERY_UNLOCK_MAX) : next;
}

export function normalizeGalleryUnlocks(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const id = entry.trim();
    if (!id || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= GALLERY_UNLOCK_MAX) break;
  }
  return ids.length > 0 ? ids : undefined;
}
