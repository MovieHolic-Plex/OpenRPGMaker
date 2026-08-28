// 스위치·변수·아이템·주인공은 저작자 입장에서 모두 "DB 레코드 하나 고르기"라는 같은 일이다.
// 예전에는 스위치/변수만 모달 픽커였고 아이템/주인공은 네이티브 <select> 였다 — 같은 폼 안에
// 상호작용이 두 갈래로 갈렸고, 좁은 조건 칸에서 select 는 선택값이 읽히지 않았다.
// 이 모듈은 네 종류의 차이(목록·아이콘·부제·생성 가능 여부)를 한 곳에 모아
// 공용 픽커가 종류를 몰라도 동작하게 한다.
import { addSwitch, addVariable, renameSwitch, renameVariable } from "@/editor/actions";
import { store } from "@/project/store";
import type { ActorRecord, Project } from "@/project/types";
import { actorSheetIcon, actorSubtitle } from "./sharedPickers";
import { imageIconOf, type RecordPickerIcon } from "./recordPicker";

export type RecordKind = "switch" | "variable" | "item" | "actor";

export type RecordEntry = { readonly id: string; readonly name: string };

/** 아이콘 해석에 필요한 최소 필드만 좁혀 받는다 (DB 레코드 전체 타입에 의존하지 않기 위함). */
type ItemLike = RecordEntry & {
  readonly iconResourceId?: string;
  readonly imageResourceId?: string;
};

export function recordKindLabel(kind: RecordKind): string {
  switch (kind) {
    case "switch":
      return "스위치";
    case "variable":
      return "변수";
    case "item":
      return "아이템";
    case "actor":
      return "주인공";
  }
}

export function recordsOf(kind: RecordKind, project: Project = store.getCurrent()): readonly RecordEntry[] {
  switch (kind) {
    case "switch":
      return project.switches;
    case "variable":
      return project.variables;
    case "item":
      return project.database.items;
    case "actor":
      return project.database.actors;
  }
}

/**
 * 아이템·주인공은 이름만으로는 성립하지 않는 DB 레코드(가격·직업·능력치 등)라
 * 조건 픽커에서 즉석 생성하지 않는다. 반쪽짜리 레코드가 DB 에 쌓이는 걸 막는다.
 * 스위치·변수는 이름뿐이므로 여기서 만들어도 안전하다.
 */
export function canCreateRecord(kind: RecordKind): boolean {
  return kind === "switch" || kind === "variable";
}

export function createRecord(kind: RecordKind, name: string): string {
  const trimmed = name.trim();
  switch (kind) {
    case "switch":
      return addSwitch(trimmed || "새 스위치");
    case "variable":
      return addVariable(trimmed || "새 변수");
    default:
      throw new Error(`${kind} 레코드는 픽커에서 만들 수 없습니다`);
  }
}

export function canRenameRecord(kind: RecordKind): boolean {
  return kind === "switch" || kind === "variable";
}

export function renameRecord(kind: RecordKind, id: string, name: string): void {
  if (kind === "switch") renameSwitch(id, name);
  else if (kind === "variable") renameVariable(id, name);
}

export function recordIconOf(
  kind: RecordKind,
  record: RecordEntry,
  project: Project = store.getCurrent(),
): RecordPickerIcon | null {
  if (kind === "item") {
    const item = record as ItemLike;
    return imageIconOf(project, item.iconResourceId ?? item.imageResourceId);
  }
  if (kind === "actor") return actorSheetIcon(project, record as ActorRecord);
  return null;
}

export function recordSubtitleOf(
  kind: RecordKind,
  record: RecordEntry,
  project: Project = store.getCurrent(),
): string | null {
  if (kind === "actor") return actorSubtitle(project, record as ActorRecord);
  return null;
}

/**
 * 이 레코드가 프로젝트 이벤트에서 몇 번 참조되는지 센다.
 *
 * 스위치가 수십 개로 늘어나면 이름만으로는 무엇이 무엇인지 구분되지 않는다. 참조 수는
 * "이건 쓰이는 것 / 이건 죽은 것"을 가르는 유일한 단서라 픽커 행마다 보여 준다.
 * `recordUsageHint` 가 쓰던 JSON 스캔과 같은 방식이며, 한 번 직렬화한 뒤 종류별로 재사용한다.
 */
export function createUsageCounter(
  project: Project = store.getCurrent(),
  /** 주면 그 맵 안의 참조만 센다. 없으면 프로젝트 전체(공통 이벤트 포함). */
  scopeMapId?: string | null,
): (id: string) => number {
  let haystack: string | null = null;
  const cache = new Map<string, number>();
  return (id: string): number => {
    if (!id) return 0;
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    if (haystack === null) {
      try {
        haystack = scopeMapId
          ? JSON.stringify(project.maps[scopeMapId] ?? {})
          : JSON.stringify(project.maps) + JSON.stringify(project.commonEvents ?? []);
      } catch {
        haystack = "";
      }
    }
    const needle = `"${id}"`;
    let count = 0;
    let cursor = haystack.indexOf(needle);
    while (cursor >= 0) {
      count += 1;
      cursor = haystack.indexOf(needle, cursor + needle.length);
    }
    cache.set(id, count);
    return count;
  };
}
