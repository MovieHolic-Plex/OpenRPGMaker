// editor/panels/aiChangeThumbnails.ts
// 「바뀐 것」 카드 줄 앞의 작은 그림 — 아이템·장비·스킬은 아이콘, 캐릭터는 얼굴, 몬스터는 전투 그림,
// 맵은 그 맵을 작게, 이벤트는 그 칸 둘레를 잘라서. 그림은 실행이 끝난 프로젝트의 실제 리소스로 그린다.
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import { renderRegionSnapshot } from "@/editor/regionSnapshot";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { recordCollectionOf, type ChangeItem } from "./aiChangeSummaryCard";
import { eventCharsetGraphic, walkingCharset } from "./aiCreationCards";

const THUMB = 32;
const MAP_THUMB_WIDTH = 56;
const EVENT_CROP_RADIUS = 3;

function deferredMapCrop(project: Project, mapId: string, region: { x: number; y: number; width: number; height: number } | null): HTMLElement | null {
  const map = project.maps[mapId];
  if (!map || map.width <= 0 || map.height <= 0) return null;
  const slot = el("span", { class: "ai-change-summary-thumb-map", attrs: { role: "img", "aria-label": `${map.name || mapId} 그림` } });
  const area = region ?? { x: 0, y: 0, width: map.width, height: map.height };
  void renderRegionSnapshot(project, map, area, { targetWidth: MAP_THUMB_WIDTH })
    .then((canvas) => slot.replaceChildren(canvas))
    .catch(() => { slot.classList.add("is-empty"); });
  return slot;
}

export function changeItemThumbnail(project: Project, item: ChangeItem): HTMLElement | null {
  if (item.change === "removed") return null;
  if (item.kind === "map") return deferredMapCrop(project, item.id, null);
  if (item.kind === "event") {
    const map = item.mapId ? project.maps[item.mapId] : undefined;
    const event = map?.events.find((entry) => entry.id === item.id);
    if (!map || !event) return null;
    const graphic = eventCharsetGraphic(event);
    if (graphic?.sprite?.id) {
      const walk = walkingCharset(project, graphic.sprite.id, 0, THUMB, "ai-change-thumb-walk");
      if (walk) return walk;
    }
    const x = Math.max(0, event.x - EVENT_CROP_RADIUS);
    const y = Math.max(0, event.y - EVENT_CROP_RADIUS);
    return deferredMapCrop(project, map.id, { x, y, width: Math.min(map.width - x, EVENT_CROP_RADIUS * 2 + 1), height: Math.min(map.height - y, EVENT_CROP_RADIUS * 2 + 1) });
  }
  if (item.kind === "music") return el("span", { class: "ai-change-summary-thumb-glyph", attrs: { "aria-hidden": "true" }, text: "♪" });
  const collection = recordCollectionOf(item.kind);
  if (!collection) return null;
  const list = (project.database as unknown as Record<string, readonly { id: unknown }[] | undefined>)[collection];
  const record = list?.find((entry) => String(entry.id) === item.id);
  return record ? recordListThumbnail(collection, record as never, project, THUMB) : null;
}
