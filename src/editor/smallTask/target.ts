import { DATABASE_AREA_LABELS } from "@/project/changeLedger";
import { equipmentSlots } from "@/project/equipmentSlots";
import { eventNameFromPages } from "@/project/eventDisplayName";
import type { Project } from "@/project/types";

/** Only host-authored Korean explanations are safe to display in the request box. */
export class SmallTaskError extends Error {}

export type SmallTaskCollection = keyof Project["database"];
export type SmallTaskTarget =
  | Readonly<{ kind: "map"; mapId: string; label: string }>
  | Readonly<{ kind: "event"; mapId: string; eventId: string; pageId?: string; x: number; y: number; isNpc: boolean; label: string }>
  | Readonly<{ kind: "dbEntry"; collection: SmallTaskCollection; id: string; label: string }>;

// 모델이 만든 문구·도구 결과를 UI에 붙이지 않는다. 저작 이름과 대사 안에 섞인 식별자도 가린다.
export function displayText(value: string, fallback: string): string {
  const text = value.replace(/\b(?:[a-z][a-z\d]*_[\w.-]+|[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})\b/giu, "…")
    .replace(/\s+/gu, " ").trim();
  if (!text || text === "…") return fallback;
  return text.length > 90 ? text.slice(0, 89) + "…" : text;
}

export function mapTarget(project: Project, mapId: string | null, eventId?: string | null, pageId?: string | null): SmallTaskTarget | null {
  const map = mapId && project.maps[mapId];
  if (!map) return null;
  if (!eventId) return Object.freeze({ kind: "map", mapId: map.id, label: displayText(map.name === map.id ? "" : map.name, "맵") });
  const event = map.events.find(candidate => candidate.id === eventId);
  if (!event) return null;
  const page = pageId ? event.pages?.find(candidate => candidate.id === pageId) : undefined;
  if (pageId && !page) return null;
  // 걷기 그림 또는 캐릭터 외형을 쓰는 이벤트를 NPC로 표시한다. 타일 그림만 있는 상자는 이벤트다.
  const isNpc = Boolean(event.sprite?.id || (page ? [page] : event.pages)?.some(p => p.graphic?.sprite?.id || p.graphic?.appearanceId));
  const kindLabel = isNpc ? "NPC" : "이벤트";
  const name = displayText(event.name === event.id ? "" : event.name || eventNameFromPages(event), "");
  return Object.freeze({ kind: "event", mapId: map.id, eventId, ...(page ? { pageId: page.id } : {}),
    x: event.x, y: event.y, isNpc, label: name ? `${kindLabel} · ${name}` : kindLabel });
}

export function dbTarget(project: Project, collection: SmallTaskCollection, id: string): SmallTaskTarget | null {
  const records = collection === "equipmentSlots" ? equipmentSlots(project) : project.database[collection];
  const record = records?.find(candidate => candidate.id === id);
  if (!record) return null;
  const kindLabel = DATABASE_AREA_LABELS[collection] ?? "자료집 항목";
  const authoredName = "name" in record ? record.name : "title" in record ? record.title : "label" in record ? record.label : "";
  const name = displayText(typeof authoredName === "string" && authoredName !== record.id ? authoredName : "", "");
  return Object.freeze({ kind: "dbEntry", collection, id, label: name ? `${kindLabel} · ${name}` : kindLabel });
}
