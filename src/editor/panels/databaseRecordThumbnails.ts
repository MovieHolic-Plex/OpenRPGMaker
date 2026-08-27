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

const THUMB_SIZE = 32;
const DEFAULT_ANIMATION_SHEET: BattleAnimationSheet = { frameWidth: 96, frameHeight: 96, columns: 5 };

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
      return stateThumbnail(record as StateRecord);
  }
}

function actorThumbnail(record: ActorRecord, project: Project, size: number): HTMLElement {
  const url = resolveAssetResourceUrl(record.faceResourceId, { project });
  if (!url) return emptySlot();
  // 얼굴 한 칸 = 파일 한 장이라 크롭이 없다 — 슬롯 크기에 맞춰 그림 한 장을 통째로 깐다.
  const slot = baseSlot("db-list-thumb-crop", `${record.name} 얼굴`);
  slot.style.backgroundImage = `url("${url}")`;
  slot.style.backgroundPosition = "center";
  slot.style.backgroundSize = `${size}px ${size}px`;
  slot.append(loadProbe(url, slot));
  return slot;
}

function enemyThumbnail(record: EnemyRecord, project: Project, size: number): HTMLElement {
  const thumb = imageThumbnail(record.monsterResourceId, project, `${record.name} 썸네일`, size);
  if (record.graphicHue && thumb.classList.contains("db-list-thumb-image")) {
    const image = thumb.querySelector("img");
    if (image) image.style.filter = `hue-rotate(${record.graphicHue}deg)`;
  }
  return thumb;
}

function classThumbnail(record: ClassRecord, project: Project, size: number): HTMLElement {
  const actor = project.database.actors.find((entry) => entry.classId === record.id);
  if (actor?.faceResourceId) return actorThumbnail(actor, project, size);
  if (record.animationId) {
    const animation = project.database.battleAnimations.find((entry) => entry.id === record.animationId);
    if (animation) return animationThumbnail(animation, project, size);
  }
  return emptySlot();
}

function troopThumbnail(record: TroopRecord, project: Project, size: number): HTMLElement {
  const firstMemberId = record.members?.[0]?.enemyId ?? record.enemyIds?.[0];
  const enemy = firstMemberId ? project.database.enemies.find((entry) => entry.id === firstMemberId) : undefined;
  if (enemy?.monsterResourceId) return enemyThumbnail(enemy, project, size);
  return imageThumbnail(record.previewBackgroundResourceId, project, `${record.name} 배경`, size);
}

function stateThumbnail(record: StateRecord): HTMLElement {
  const ontology = stateOntologyFor(record.id, record.name);
  const slot = baseSlot("db-list-thumb-state", `${record.name} 상태 색`);
  slot.style.backgroundColor = ontology.colorHex;
  slot.title = ontology.color;
  return slot;
}

function skillAnimationThumbnail(record: SkillRecord, project: Project, size: number): HTMLElement {
  const animation = record.animationId
    ? project.database.battleAnimations.find((entry) => entry.id === record.animationId)
    : undefined;
  return animation ? animationThumbnail(animation, project, size) : emptySlot();
}

function animationThumbnail(record: BattleAnimationRecord, project: Project, size: number): HTMLElement {
  const url = resolveAssetResourceUrl(record.resourceId, { project });
  if (!url) return emptySlot();
  const slot = baseSlot("db-list-thumb-crop db-list-thumb-animation", `${record.name} 애니메이션`);
  applyAnimationPatternCrop(slot, record.sheet ?? DEFAULT_ANIMATION_SHEET, 0, url, size);
  slot.append(loadProbe(url, slot));
  return slot;
}

// 이미지 썸네일은 <img> 가 슬롯(32px/갤러리 48px)을 CSS 100% 로 채우므로 JS 크롭 계산이
// 필요 없다 — size 파라미터는 호출부 계약(recordListThumbnail 시그니처)을 위해 받는다.
function imageThumbnail(resourceId: string | undefined, project: Project, alt: string, _size: number): HTMLElement {
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) return emptySlot();
  const slot = baseSlot("db-list-thumb-image", alt);
  const image = el("img", { attrs: { alt, src: url } });
  image.addEventListener("error", () => markEmpty(slot), { once: true });
  // Equipment icons + enemy battlers are authored with #FF00FF chroma key.
  if (image instanceof HTMLImageElement) applyMagentaChromaKey(image);
  slot.append(image);
  return slot;
}

function baseSlot(extraClass: string, label: string): HTMLElement {
  return el("span", {
    class: `db-list-thumb ${extraClass}`,
    attrs: { "aria-label": label, role: "img" },
  });
}

function emptySlot(): HTMLElement {
  return el("span", { class: "db-list-thumb empty", attrs: { "aria-hidden": "true" } });
}

function loadProbe(url: string, slot: HTMLElement): HTMLElement {
  const probe = el("img", { class: "db-list-thumb-probe", attrs: { alt: "", "aria-hidden": "true", src: url } });
  probe.addEventListener("error", () => markEmpty(slot), { once: true });
  return probe;
}

function markEmpty(slot: HTMLElement): void {
  slot.classList.add("empty");
  slot.style.backgroundImage = "";
  slot.replaceChildren();
  slot.setAttribute("aria-hidden", "true");
  if ("removeAttribute" in slot) {
    slot.removeAttribute("aria-label");
    slot.removeAttribute("role");
  }
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
