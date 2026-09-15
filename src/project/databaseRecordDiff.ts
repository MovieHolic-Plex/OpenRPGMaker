// project/databaseRecordDiff.ts — 데이터베이스 레코드 단위 구조 diff.
//
// changeLedger 의 `이름: 이전 → 이후` 문장으로는 썸네일 해석·수치 델타·레코드 점프가 불가능하다.
// 검토 카드는 레코드 신원(컬렉션·id)과 필드 경로·원값을 요구하므로 값을 요약하지 않은 채 든다.
// 컬렉션 종류는 열거하지 않는다 — `id` 를 가진 레코드 배열이면 전부 비교 대상이다(changeLedger 와 같은 여집합 판정).
import { DATABASE_AREA_LABELS } from "./changeLedger";
import type { Project } from "./types";

export type DatabaseRecordChangeKind = "added" | "removed" | "changed";

export interface DatabaseFieldChange {
  /** 점 경로 — `stats.maxHp`. 중첩은 2단까지 편다. */
  readonly path: string;
  readonly label: string;
  readonly before: unknown;
  readonly after: unknown;
  /** 둘 다 유한수일 때 `after - before`. 아니면 null. */
  readonly delta: number | null;
  /** 리소스 id 필드 — 카드가 「지금 / 적용 후」 그림 두 장으로 그린다. */
  readonly graphic: boolean;
}

export interface DatabaseRecordChange {
  readonly collection: string;
  readonly areaLabel: string;
  readonly id: string;
  readonly name: string;
  readonly change: DatabaseRecordChangeKind;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
  readonly fields: readonly DatabaseFieldChange[];
  /** 상한을 넘어 접힌 필드 수 — 카드가 「…외 N개」 로 말한다. */
  readonly hiddenFieldCount: number;
}

const DEFAULT_MAX_FIELDS = 12;
/**
 * 새 레코드는 모든 필드가 「바뀜 것」이라 그대로 다 쓰면 20줄짜리 덤프가 된다(실측: 아이템 하나가 21줄).
 * 사용자가 「무엇이 생겼나」를 판단하는 데 필요한 것은 앞에 오는 몇 개다 — 나머지는 수로 알린다.
 */
const DEFAULT_MAX_FIELDS_ADDED = 6;
const FLATTEN_DEPTH = 2;

const FIELD_LABELS: Readonly<Record<string, string>> = {
  name: "이름",
  nickname: "별명",
  description: "설명",
  price: "가격",
  type: "종류",
  occasion: "사용 시점",
  consumable: "소모품",
  skillId: "스킬",
  stateEffects: "상태 효과",
  elementId: "속성",
  successRate: "성공률",
  repeatCount: "반복",
  level: "레벨",
  initialLevel: "초기 레벨",
  maxLevel: "최대 레벨",
  classId: "직업",
  speciesId: "몬스터 종",
  factionId: "진영",
  kind: "종류",
  category: "분류",
  scope: "대상",
  mpCost: "MP 소모",
  power: "위력",
  hitRate: "명중",
  skillIds: "스킬",
  learnedSkills: "습득 스킬",
  initialEquipment: "초기 장비",
  parameterCurves: "능력치 곡선",
  expCurve: "경험치 곡선",
  elementRates: "속성 상성",
  stateRates: "상태 상성",
  actions: "행동 패턴",
  actionProfile: "액션 프로필",
  attackOptions: "공격 옵션",
  critical: "크리티컬",
  options: "옵션",
  effects: "효과",
  graphicHue: "색조",
  transparent: "투명",
  flying: "부양",
  battleScalePercent: "전투 표시 크기",
  faceResourceId: "얼굴 그림",
  characterResourceId: "캐릭터 그림",
  characterIndex: "캐릭터 칸",
  battleCharacterResourceId: "전투 그림",
  monsterResourceId: "몬스터 그림",
  iconResourceId: "아이콘",
  imageResourceId: "그림",
  animationId: "애니메이션",
  appearanceId: "외형",
  stats: "능력치",
  "stats.maxHp": "최대 HP",
  "stats.maxMp": "최대 MP",
  "stats.attack": "공격",
  "stats.defense": "방어",
  "stats.mind": "마법",
  "stats.agility": "민첩",
  rewards: "보상",
  "rewards.exp": "경험치",
  "rewards.gold": "골드",
  "rewards.dropItemId": "드롭 아이템",
  "rewards.dropRatePercent": "드롭 확률",
};

const GRAPHIC_KEY = /(ResourceId|CharsetId)$/u;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function databaseFieldLabel(path: string): string {
  const direct = FIELD_LABELS[path];
  if (direct) return direct;
  const parts = path.split(".");
  if (parts.length === 1) return path;
  const leaf = parts[parts.length - 1] ?? path;
  const parent = parts.slice(0, -1).join(".");
  return `${databaseFieldLabel(parent)} · ${FIELD_LABELS[leaf] ?? leaf}`;
}

function numericDelta(before: unknown, after: unknown): number | null {
  return typeof before === "number" && typeof after === "number" && Number.isFinite(before) && Number.isFinite(after)
    ? after - before
    : null;
}

function collectFieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix: string,
  depth: number,
  out: DatabaseFieldChange[],
): void {
  const keys = new Set([...Object.keys(after), ...Object.keys(before)]);
  for (const key of keys) {
    if (key === "id" && prefix === "") continue;
    const prev = before[key];
    const next = after[key];
    if (same(prev, next)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const prevObject = asRecord(prev);
    const nextObject = asRecord(next);
    if (depth < FLATTEN_DEPTH && prevObject && nextObject) {
      collectFieldChanges(prevObject, nextObject, path, depth + 1, out);
      continue;
    }
    out.push({
      path,
      label: databaseFieldLabel(path),
      before: prev,
      after: next,
      delta: numericDelta(prev, next),
      graphic: GRAPHIC_KEY.test(key),
    });
  }
}

function recordName(record: Record<string, unknown> | null, id: string): string {
  return stringField(record?.name) ?? stringField(record?.title) ?? stringField(record?.label) ?? id;
}

function byId(list: readonly unknown[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  list.forEach((record, index) => {
    const object = asRecord(record);
    if (!object) return;
    const id = stringField(object.id) ?? `#${index + 1}`;
    map.set(id, object);
  });
  return map;
}

function limitFields(fields: readonly DatabaseFieldChange[], max: number): { fields: DatabaseFieldChange[]; hidden: number } {
  if (fields.length <= max) return { fields: [...fields], hidden: 0 };
  return { fields: fields.slice(0, max), hidden: fields.length - max };
}

/** 두 프로젝트의 `database` 를 컬렉션·레코드 단위로 비교한다. 순서: 컬렉션 키 순 → after 목록 순 → 삭제. */
export function diffDatabaseRecords(
  before: Project,
  after: Project,
  options: { readonly maxFieldsPerRecord?: number; readonly maxFieldsPerAddedRecord?: number } = {},
): DatabaseRecordChange[] {
  const max = options.maxFieldsPerRecord ?? DEFAULT_MAX_FIELDS;
  const maxAdded = options.maxFieldsPerAddedRecord ?? DEFAULT_MAX_FIELDS_ADDED;
  const beforeDatabase = asRecord(before.database) ?? {};
  const afterDatabase = asRecord(after.database) ?? {};
  const collections = new Set([...Object.keys(beforeDatabase), ...Object.keys(afterDatabase)]);
  const out: DatabaseRecordChange[] = [];
  for (const collection of collections) {
    const beforeList = Array.isArray(beforeDatabase[collection]) ? (beforeDatabase[collection] as unknown[]) : [];
    const afterList = Array.isArray(afterDatabase[collection]) ? (afterDatabase[collection] as unknown[]) : [];
    if (beforeList.length === 0 && afterList.length === 0) continue;
    const areaLabel = DATABASE_AREA_LABELS[collection] ?? collection;
    const prevById = byId(beforeList);
    const nextById = byId(afterList);
    for (const [id, next] of nextById) {
      const prev = prevById.get(id);
      if (!prev) {
        const added: DatabaseFieldChange[] = [];
        collectFieldChanges({}, next, "", 0, added);
        // 이름은 카드 머리가 이미 말한다 — 첫 줄을 「이름: 동검」으로 버리지 않는다.
        const limited = limitFields(added.filter((field) => field.path !== "name"), maxAdded);
        out.push({
          collection, areaLabel, id, name: recordName(next, id), change: "added",
          before: null, after: next, fields: limited.fields, hiddenFieldCount: limited.hidden,
        });
        continue;
      }
      const changed: DatabaseFieldChange[] = [];
      collectFieldChanges(prev, next, "", 0, changed);
      if (changed.length === 0) continue;
      const limited = limitFields(changed, max);
      out.push({
        collection, areaLabel, id, name: recordName(next, id), change: "changed",
        before: prev, after: next, fields: limited.fields, hiddenFieldCount: limited.hidden,
      });
    }
    for (const [id, prev] of prevById) {
      if (nextById.has(id)) continue;
      out.push({
        collection, areaLabel, id, name: recordName(prev, id), change: "removed",
        before: prev, after: null, fields: [], hiddenFieldCount: 0,
      });
    }
  }
  return out;
}

/** 프로젝트 안의 어떤 컬렉션이든 이 id 를 가진 레코드의 이름. 참조 필드(드롭 아이템 등)를 사람 말로 바꿀 때 쓴다. */
export function databaseRecordNameById(project: Project, id: string): string | null {
  const database = asRecord(project.database) ?? {};
  for (const list of Object.values(database)) {
    if (!Array.isArray(list)) continue;
    for (const record of list) {
      const object = asRecord(record);
      if (object && object.id === id) return recordName(object, id);
    }
  }
  return null;
}
