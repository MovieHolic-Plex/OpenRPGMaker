// 이벤트 명령 폼 공용 선택 컨트롤 (맵/주인공/아이템/이벤트).
// 숨은·보이는 <select> + testid 계약을 유지해 e2e selectOption 호환을 지킨다.
// 페이스셋/캐릭셋 시트는 한 장에 여러 칸이 있으므로 faceIndex·characterIndex로 단일 셀만 크롭한다.
import { eventDisplayName } from "@/editor/eventMarkerUx";
import { store } from "@/project/store";
import type { ActorRecord, GameEvent, ItemRecord, MapId, Project } from "@/project/types";
import { el } from "@/util/dom";
import {
  charsetIconOf,
  facesetIconOf,
  imageIconOf,
  recordPickerWithPreview,
  type RecordPickerHandle,
  type RecordPickerIcon,
  type RecordPickerRecordLike,
} from "./recordPicker";

export type SharedPickerOptions = {
  readonly selectedId: string;
  readonly testid: string;
  readonly placeholder?: string;
  readonly onChange?: (id: string) => void;
};

export type MapPickerOptions = SharedPickerOptions & {
  readonly allowEmpty?: boolean;
  readonly project?: Project;
};

export type ActorPickerOptions = SharedPickerOptions & {
  readonly project?: Project;
  /** true면 빈 옵션을 placeholder로 둔다 (예: 회복 대상 "파티 전체"). */
  readonly allowEmpty?: boolean;
};

export type ItemPickerOptions = SharedPickerOptions & {
  readonly project?: Project;
  readonly allowEmpty?: boolean;
  readonly subtitleOf?: (record: ItemRecord) => string | null;
};

export type EventPickerOptions = SharedPickerOptions & {
  readonly project?: Project;
  /** 지정 시 해당 맵 이벤트만. 생략 시 전 맵. */
  readonly mapId?: MapId;
  readonly allowEmpty?: boolean;
};

type NamedRecord = RecordPickerRecordLike;

export function mapPicker(options: MapPickerOptions): RecordPickerHandle {
  const project = options.project ?? store.getCurrent();
  const records = mapRecords(project);
  return recordPickerWithPreview({
    records: options.allowEmpty === false ? records : records,
    selectedId: options.selectedId,
    placeholder: options.placeholder ?? "맵 선택",
    testid: options.testid,
    onChange: options.onChange,
    subtitleOf: (record) => {
      const map = project.maps[record.id];
      if (!map) return null;
      return `${map.width}×${map.height}`;
    },
  });
}

/** 카드 없이 select만 필요할 때(밀집 다이얼로그). 값은 동일 맵 목록. */
export function mapSelectElement(options: {
  readonly selectedId: string;
  readonly testid: string;
  readonly placeholder?: string;
  readonly allowEmpty?: boolean;
  readonly project?: Project;
  readonly onChange?: (mapId: string) => void;
}): HTMLSelectElement {
  const project = options.project ?? store.getCurrent();
  const select = el("select", { dataset: { testid: options.testid } }) as HTMLSelectElement;
  if (options.allowEmpty !== false) {
    select.append(el("option", { text: `(${options.placeholder ?? "맵 선택"})`, attrs: { value: "" } }));
  }
  for (const record of mapRecords(project)) {
    select.append(el("option", { text: record.name, attrs: { value: record.id } }));
  }
  select.value = options.selectedId;
  if (options.onChange) {
    select.addEventListener("change", () => options.onChange?.(select.value));
  }
  return select;
}

export function actorPicker(options: ActorPickerOptions): RecordPickerHandle {
  const project = options.project ?? store.getCurrent();
  return recordPickerWithPreview({
    records: project.database.actors,
    selectedId: options.selectedId,
    placeholder: options.placeholder ?? "주인공 선택",
    testid: options.testid,
    onChange: options.onChange,
    iconOf: (record) => actorSheetIcon(project, record),
    subtitleOf: (record) => actorSubtitle(project, record),
  });
}

/** 페이스셋 faceIndex 칸 우선, 없으면 캐릭셋 characterIndex idle-front 칸. 시트 전체 금지. */
export function actorSheetIcon(project: Project, record: ActorRecord): RecordPickerIcon | null {
  const face = facesetIconOf(project, record.faceResourceId, record.faceIndex ?? 0);
  if (face) return face;
  return charsetIconOf(project, record.characterResourceId, record.characterIndex ?? 0);
}

export function itemPicker(options: ItemPickerOptions): RecordPickerHandle {
  const project = options.project ?? store.getCurrent();
  return recordPickerWithPreview({
    records: project.database.items,
    selectedId: options.selectedId,
    placeholder: options.placeholder ?? "아이템 선택",
    testid: options.testid,
    onChange: options.onChange,
    iconOf: (record) => imageIconOf(project, record.iconResourceId ?? record.imageResourceId),
    subtitleOf: options.subtitleOf,
  });
}

export function eventPicker(options: EventPickerOptions): RecordPickerHandle {
  const project = options.project ?? store.getCurrent();
  const records = eventRecords(project, options.mapId);
  return recordPickerWithPreview({
    records,
    selectedId: options.selectedId,
    placeholder: options.placeholder ?? "이벤트 선택",
    testid: options.testid,
    onChange: options.onChange,
    subtitleOf: (record) => {
      const hit = findEvent(project, record.id, options.mapId);
      if (!hit) return null;
      return `${hit.mapName} · (${hit.event.x}, ${hit.event.y})`;
    },
  });
}

/** 조건 폼 등 onChange-콜백 스타일 호스트용 래퍼. */
export function actorPickerControl(
  currentId: string,
  onChange: (id: string) => void,
  testid = "event-condition-actor",
): HTMLElement {
  return actorPicker({ selectedId: currentId, testid, onChange }).root;
}

export function itemPickerControl(
  currentId: string,
  onChange: (id: string) => void,
  testid = "event-condition-item",
): HTMLElement {
  return itemPicker({ selectedId: currentId, testid, onChange }).root;
}

export function actorSubtitle(project: Project, record: ActorRecord): string | null {
  const className = project.database.classes.find((entry) => entry.id === record.classId)?.name;
  const level = `Lv.${record.initialLevel}`;
  return className ? `${className} · ${level}` : level;
}

function mapRecords(project: Project): readonly NamedRecord[] {
  return Object.values(project.maps).map((map) => ({
    id: map.id,
    name: map.name?.trim() ? map.name : map.id,
  }));
}

function eventRecords(project: Project, mapId?: MapId): readonly NamedRecord[] {
  const maps = mapId && project.maps[mapId]
    ? [[mapId, project.maps[mapId]] as const]
    : Object.entries(project.maps);
  const rows: NamedRecord[] = [];
  for (const [, map] of maps) {
    if (!map) continue;
    for (const event of map.events) {
      rows.push({
        id: event.id,
        name: eventDisplayName(event),
      });
    }
  }
  return rows;
}

function findEvent(
  project: Project,
  eventId: string,
  mapId?: MapId,
): { readonly event: GameEvent; readonly mapName: string } | null {
  if (mapId) {
    const map = project.maps[mapId];
    const event = map?.events.find((entry) => entry.id === eventId);
    return event && map ? { event, mapName: map.name || mapId } : null;
  }
  for (const map of Object.values(project.maps)) {
    const event = map.events.find((entry) => entry.id === eventId);
    if (event) return { event, mapName: map.name || map.id };
  }
  return null;
}

