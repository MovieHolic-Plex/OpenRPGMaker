import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { DatabaseCollection } from "@/editor/databaseActions";
import type {
  ActorRecord,
  BattleAnimationRecord,
  BattleAnimationSheet,
  ClassRecord,
  DatabaseRecords,
  EnemyRecord,
  EquipmentRecord,
  ItemRecord,
  Project,
  SkillRecord,
  StateRecord,
  TroopRecord,
} from "@/project/types";
import { stateOntologyFor } from "@/project/ontology/databaseStateOntology";
import { el } from "@/util/dom";
import { applyMagentaChromaKey, applyAutoChromaKeyToBackground } from "@/editor/panels/chromaKey";
import { buildSvgIcon, type SvgNodeSpec } from "@/editor/panels/tileToolbarIcons";

const THUMB_SIZE = 32;
const DEFAULT_ANIMATION_SHEET: BattleAnimationSheet = { frameWidth: 96, frameHeight: 96, columns: 5 };
const BROKEN_IMAGE_ICON: readonly SvgNodeSpec[] = [
  { tag: "rect", attrs: { x: "3.5", y: "4.5", width: "15", height: "13", rx: "1.7" } },
  { tag: "circle", attrs: { cx: "8", cy: "8.5", r: "1.3" } },
  { tag: "path", attrs: { d: "M4.5 15l4-4 3 3 2-2 4 4" } },
  { tag: "path", attrs: { d: "M5 19 17 3" } },
];

export function recordListThumbnail(
  collection: DatabaseCollection,
  record: DatabaseRecords[DatabaseCollection][number],
  project: Project,
  size: number = THUMB_SIZE
): HTMLElement | null {
  // 손상된 size(0/음수/NaN)는 기존 32px 기본값으로 폴백한다.
  const thumbSize = Number.isFinite(size) && size > 0 ? size : THUMB_SIZE;
  switch (collection) {
    case "actors":
      return actorThumbnail(record as ActorRecord, project, thumbSize);
    case "enemies":
      return enemyThumbnail(record as EnemyRecord, project, thumbSize);
    case "items": {
      const item = record as ItemRecord;
      return imageThumbnail(item.iconResourceId ?? item.imageResourceId, project, `${item.name} 썸네일`, thumbSize);
    }
    case "equipment": {
      const equipment = record as EquipmentRecord;
      return imageThumbnail(equipment.iconResourceId ?? equipment.imageResourceId, project, `${equipment.name} 썸네일`, thumbSize);
    }
    case "skills":
      return skillAnimationThumbnail(record as SkillRecord, project, thumbSize);
    case "battleAnimations":
      return animationThumbnail(record as BattleAnimationRecord, project, thumbSize);
    case "classes":
      return classThumbnail(record as ClassRecord, project, thumbSize);
    case "troops":
      return troopThumbnail(record as TroopRecord, project, thumbSize);
    case "states":
      return stateThumbnail(record as StateRecord, thumbSize);
  }
}

function actorThumbnail(record: ActorRecord, project: Project, size: number): HTMLElement {
  const label = `${record.name} 얼굴`;
  const url = resolveAssetResourceUrl(record.faceResourceId, { project });
  if (!url) return record.faceResourceId ? imageFailureSlot(label, size) : emptySlot(size);

  // 얼굴 한 칸 = 파일 한 장이라 크롭이 없다 — 슬롯 크기에 맞춰 그림 한 장을 통째로 깐다.
  const slot = baseSlot("db-list-thumb-crop", label, size);
  slot.style.backgroundImage = `url("${url}")`;
  slot.style.backgroundPosition = "center";
  slot.style.backgroundSize = `${size}px ${size}px`;
  slot.append(loadProbe(url, slot, label));
  return slot;
}

function enemyThumbnail(record: EnemyRecord, project: Project, size: number): HTMLElement {
  // 색조는 전투가 읽지 않으므로(2026-10-02) 미리보기도 원래 색으로 그린다.
  return imageThumbnail(record.monsterResourceId, project, `${record.name} 썸네일`, size);
}

function classThumbnail(record: ClassRecord, project: Project, size: number): HTMLElement {
  const actor = project.database.actors.find((entry) => entry.classId === record.id);
  if (actor?.faceResourceId) return actorThumbnail(actor, project, size);
  if (record.animationId) {
    const animation = project.database.battleAnimations.find((entry) => entry.id === record.animationId);
    if (animation) return animationThumbnail(animation, project, size);
  }
  return emptySlot(size);
}

function troopThumbnail(record: TroopRecord, project: Project, size: number): HTMLElement {
  const firstMemberId = record.members?.[0]?.enemyId ?? record.enemyIds?.[0];
  const enemy = firstMemberId ? project.database.enemies.find((entry) => entry.id === firstMemberId) : undefined;
  if (enemy?.monsterResourceId) return enemyThumbnail(enemy, project, size);
  return imageThumbnail(record.previewBackgroundResourceId, project, `${record.name} 배경`, size);
}

function stateThumbnail(record: StateRecord, size: number): HTMLElement {
  const ontology = stateOntologyFor(record.id, record.name);
  const slot = baseSlot("db-list-thumb-state", `${record.name} 상태 색`, size);
  slot.style.backgroundColor = ontology.colorHex;
  slot.title = ontology.color;
  return slot;
}

function skillAnimationThumbnail(record: SkillRecord, project: Project, size: number): HTMLElement {
  const animation = record.animationId
    ? project.database.battleAnimations.find((entry) => entry.id === record.animationId)
    : undefined;
  return animation ? animationThumbnail(animation, project, size) : emptySlot(size);
}

function animationThumbnail(record: BattleAnimationRecord, project: Project, size: number): HTMLElement {
  const label = `${record.name} 애니메이션`;
  const url = resolveAssetResourceUrl(record.resourceId, { project });
  if (!url) return record.resourceId ? imageFailureSlot(label, size) : emptySlot(size);
  const slot = baseSlot("db-list-thumb-crop db-list-thumb-animation", label, size);
  applyAnimationPatternCrop(slot, record.sheet ?? DEFAULT_ANIMATION_SHEET, 0, url, size);
  slot.append(loadProbe(url, slot, label));
  return slot;
}

// 이미지 썸네일은 <img> 가 슬롯(32px/갤러리 48px)을 CSS 100% 로 채우므로 JS 크롭 계산이
// 필요 없다 — size 파라미터는 호출부 계약(recordListThumbnail 시그니처)을 위해 받는다.
export function imageThumbnail(resourceId: string | undefined, project: Project, alt: string, size: number): HTMLElement {
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) return resourceId ? imageFailureSlot(alt, size) : emptySlot(size);
  const slot = baseSlot("db-list-thumb-image", alt, size);
  const image = el("img", { attrs: { alt, src: url, width: String(size), height: String(size) } });
  image.addEventListener("error", () => markDatabaseImageFailed(slot, alt), { once: true });
  // Equipment icons + enemy battlers are authored with #FF00FF chroma key.
  if (image instanceof HTMLImageElement) applyMagentaChromaKey(image);
  slot.append(image);
  return slot;
}

function baseSlot(extraClass: string, label: string, size: number): HTMLElement {
  const slot = el("span", {
    class: `db-list-thumb ${extraClass}`,
    attrs: { "aria-label": label, role: "img" },
  });
  declareMinimumImageSize(slot, size, size);
  return slot;
}

function emptySlot(size: number): HTMLElement {
  const slot = baseSlot("empty db-image-placeholder", "이미지 없음", size);
  slot.setAttribute("aria-hidden", "true");
  slot.removeAttribute("aria-label");
  slot.removeAttribute("role");
  slot.append(databaseBrokenImageIcon());
  return slot;
}

function imageFailureSlot(label: string, size: number): HTMLElement {
  const slot = baseSlot("", label, size);
  markDatabaseImageFailed(slot, label);
  return slot;
}

function loadProbe(url: string, slot: HTMLElement, label: string): HTMLElement {
  const probe = el("img", {
    class: "db-list-thumb-probe",
    attrs: { alt: "", "aria-hidden": "true", src: url, width: "1", height: "1" },
  });
  probe.addEventListener("error", () => markDatabaseImageFailed(slot, label), { once: true });
  return probe;
}

export function markDatabaseImageFailed(surface: HTMLElement, label: string): void {
  surface.classList.remove("empty");
  surface.classList.add("db-image-placeholder", "db-image-load-failed");
  surface.style.backgroundImage = "";
  surface.replaceChildren(databaseBrokenImageIcon(), el("span", { class: "db-image-placeholder-label", text: label }));
  surface.setAttribute("aria-label", `${label} 이미지 불러오기 실패`);
  surface.setAttribute("role", "img");
  surface.setAttribute("title", `${label} 이미지 불러오기 실패`);
}

export function databaseImageFailurePlaceholder(
  className: string,
  label: string,
  width: number,
  height: number,
): HTMLElement {
  const surface = el("span", { class: className });
  declareMinimumImageSize(surface, width, height);
  markDatabaseImageFailed(surface, label);
  return surface;
}

function databaseBrokenImageIcon(): SVGSVGElement {
  const icon = buildSvgIcon(BROKEN_IMAGE_ICON);
  icon.classList.add("db-image-placeholder-icon");
  return icon;
}

function declareMinimumImageSize(surface: HTMLElement, width: number, height: number): void {
  surface.style.minWidth = `${Math.max(1, width)}px`;
  surface.style.minHeight = `${Math.max(1, height)}px`;
}

function applyAnimationPatternCrop(
  element: HTMLElement,
  sheet: BattleAnimationSheet,
  pattern: number,
  url: string,
  size: number
): void {
  const columns = Math.max(1, sheet.columns);
  const column = pattern % columns;
  const row = Math.floor(pattern / columns);
  const scale = size / Math.max(1, sheet.frameWidth);
  element.style.backgroundImage = `url("${url}")`;
  element.style.backgroundPosition = `-${column * sheet.frameWidth * scale}px -${row * sheet.frameHeight * scale}px`;
  element.style.backgroundSize = `${columns * sheet.frameWidth * scale}px auto`;
  // 단색 배경 시트 자동 키아웃. 투명 PNG 면 no-op.
  applyAutoChromaKeyToBackground(element, url);
}
