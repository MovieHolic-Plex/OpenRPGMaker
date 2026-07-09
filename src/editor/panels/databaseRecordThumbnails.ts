import {
  FACESET_COLUMNS,
  FACESET_FACE_HEIGHT,
  FACESET_FACE_WIDTH,
  FACESET_ROWS,
} from "@/assets/easyrpgRtp";
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

const THUMB_SIZE = 32;
const DEFAULT_ANIMATION_SHEET: BattleAnimationSheet = { frameWidth: 96, frameHeight: 96, columns: 5 };

export function recordListThumbnail(
  collection: DatabaseCollection,
  record: DatabaseRecords[DatabaseCollection][number],
  project: Project
): HTMLElement | null {
  switch (collection) {
    case "actors":
      return actorThumbnail(record as ActorRecord, project);
    case "enemies":
      return enemyThumbnail(record as EnemyRecord, project);
    case "items": {
      const item = record as ItemRecord;
      return imageThumbnail(item.iconResourceId ?? item.imageResourceId, project, `${item.name} 썸네일`);
    }
    case "equipment": {
      const equipment = record as EquipmentRecord;
      return imageThumbnail(equipment.iconResourceId ?? equipment.imageResourceId, project, `${equipment.name} 썸네일`);
    }
    case "skills":
      return skillAnimationThumbnail(record as SkillRecord, project);
    case "battleAnimations":
      return animationThumbnail(record as BattleAnimationRecord, project);
    case "classes":
      return classThumbnail(record as ClassRecord, project);
    case "troops":
      return troopThumbnail(record as TroopRecord, project);
    case "states":
      return stateThumbnail(record as StateRecord);
  }
}

function actorThumbnail(record: ActorRecord, project: Project): HTMLElement {
  const url = resolveAssetResourceUrl(record.faceResourceId, { project });
  if (!url) return emptySlot();
  const faceIndex = record.faceIndex ?? 0;
  const column = faceIndex % FACESET_COLUMNS;
  const row = Math.floor(faceIndex / FACESET_COLUMNS);
  const slot = baseSlot("db-list-thumb-crop", `${record.name} 얼굴`);
  const scale = THUMB_SIZE / FACESET_FACE_WIDTH;
  slot.style.backgroundImage = `url("${url}")`;
  slot.style.backgroundPosition = `-${column * FACESET_FACE_WIDTH * scale}px -${row * FACESET_FACE_HEIGHT * scale}px`;
  slot.style.backgroundSize = `${FACESET_COLUMNS * FACESET_FACE_WIDTH * scale}px ${FACESET_ROWS * FACESET_FACE_HEIGHT * scale}px`;
  slot.append(loadProbe(url, slot));
  return slot;
}

function enemyThumbnail(record: EnemyRecord, project: Project): HTMLElement {
  const thumb = imageThumbnail(record.monsterResourceId, project, `${record.name} 썸네일`);
  if (record.graphicHue && thumb.classList.contains("db-list-thumb-image")) {
    const image = thumb.querySelector("img");
    if (image) image.style.filter = `hue-rotate(${record.graphicHue}deg)`;
  }
  return thumb;
}

function classThumbnail(record: ClassRecord, project: Project): HTMLElement {
  const actor = project.database.actors.find((entry) => entry.classId === record.id);
  if (actor?.faceResourceId) return actorThumbnail(actor, project);
  if (record.animationId) {
    const animation = project.database.battleAnimations.find((entry) => entry.id === record.animationId);
    if (animation) return animationThumbnail(animation, project);
  }
  return emptySlot();
}

function troopThumbnail(record: TroopRecord, project: Project): HTMLElement {
  const firstMemberId = record.members?.[0]?.enemyId ?? record.enemyIds?.[0];
  const enemy = firstMemberId ? project.database.enemies.find((entry) => entry.id === firstMemberId) : undefined;
  if (enemy?.monsterResourceId) return enemyThumbnail(enemy, project);
  return imageThumbnail(record.previewBackgroundResourceId, project, `${record.name} 배경`);
}

function stateThumbnail(record: StateRecord): HTMLElement {
  const ontology = stateOntologyFor(record.id, record.name);
  const slot = baseSlot("db-list-thumb-state", `${record.name} 상태 색`);
  slot.style.backgroundColor = ontology.colorHex;
  slot.title = ontology.color;
  return slot;
}

function skillAnimationThumbnail(record: SkillRecord, project: Project): HTMLElement {
  const animation = record.animationId
    ? project.database.battleAnimations.find((entry) => entry.id === record.animationId)
    : undefined;
  return animation ? animationThumbnail(animation, project) : emptySlot();
}

function animationThumbnail(record: BattleAnimationRecord, project: Project): HTMLElement {
  const url = resolveAssetResourceUrl(record.resourceId, { project });
  if (!url) return emptySlot();
  const slot = baseSlot("db-list-thumb-crop db-list-thumb-animation", `${record.name} 애니메이션`);
  applyAnimationPatternCrop(slot, record.sheet ?? DEFAULT_ANIMATION_SHEET, 0, url);
  slot.append(loadProbe(url, slot));
  return slot;
}

function imageThumbnail(resourceId: string | undefined, project: Project, alt: string): HTMLElement {
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) return emptySlot();
  const slot = baseSlot("db-list-thumb-image", alt);
  const image = el("img", { attrs: { alt, src: url } });
  image.addEventListener("error", () => markEmpty(slot), { once: true });
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

function applyAnimationPatternCrop(element: HTMLElement, sheet: BattleAnimationSheet, pattern: number, url: string): void {
  const columns = Math.max(1, sheet.columns);
  const column = pattern % columns;
  const row = Math.floor(pattern / columns);
  const scale = THUMB_SIZE / Math.max(1, sheet.frameWidth);
  element.style.backgroundImage = `url("${url}")`;
  element.style.backgroundPosition = `-${column * sheet.frameWidth * scale}px -${row * sheet.frameHeight * scale}px`;
  element.style.backgroundSize = `${columns * sheet.frameWidth * scale}px auto`;
}
