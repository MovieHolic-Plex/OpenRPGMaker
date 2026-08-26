import type { DatabaseCollection } from "@/editor/databaseActions";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import type {
  ActorRecord,
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
import { el } from "@/util/dom";

export type DatabaseRecordUnion =
  | ActorRecord
  | ClassRecord
  | SkillRecord
  | ItemRecord
  | EquipmentRecord
  | EnemyRecord
  | TroopRecord
  | StateRecord
  | DatabaseRecords["battleAnimations"][number];

export interface EntityMention {
  readonly collection: DatabaseCollection;
  readonly id: string;
  readonly name: string;
  readonly record: DatabaseRecordUnion;
}

// 스캔 대상 컬렉션 및 우선순위 순서: enemies -> items -> equipment -> actors -> skills -> troops
const SEARCH_COLLECTIONS: readonly DatabaseCollection[] = [
  "enemies",
  "items",
  "equipment",
  "actors",
  "skills",
  "troops",
];

interface MatchedCandidate {
  readonly collection: DatabaseCollection;
  readonly id: string;
  readonly name: string;
  readonly record: DatabaseRecordUnion;
  readonly startIndex: number;
  readonly endIndex: number;
}

// 한글·한자·가나 — 이 문자가 들어있는 이름은 단어 경계가 없으므로 부분 문자열로 맞춘다.
const CJK_PATTERN = /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-䶿一-鿿가-힯]/u;
// ASCII 이름의 경계 밖 문자. 예: "map" 은 "mapvillage30" 안에서 맞지 않아야 한다.
const WORD_CHAR_PATTERN = /[A-Za-z0-9_]/u;

function isWordChar(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return false;
  return WORD_CHAR_PATTERN.test(text[index] ?? "");
}

/**
 * `name` 이 `text` 에 나타나는 지점들. `requireBoundary` 가 켜지면 양 끝이 단어 경계여야만
 * 인정한다.
 *
 * 왜 경계가 필요한가 (2026-08-26 라이브 실측): 기본 프로젝트의 아이템에는 "map", "ale",
 * "egg", "bell", "bone", "coal" 처럼 짧은 순수 ASCII 이름이 수십 개 있다. 부분 문자열
 * 포함만 봤을 때, 어시스턴트가 "현재 맵: 이슬 장터 마을 (mapvillage30_100x100)" 이라고
 * 말하는 순간 아이템 `map` 썸네일이 실제로 붙었다. "단어 경계가 없다"는 근거는 한글에만
 * 해당하므로 ASCII 이름에는 경계를 요구한다.
 */
function* occurrences(text: string, name: string, requireBoundary: boolean): Generator<number> {
  let from = 0;
  while (from <= text.length - name.length) {
    const at = text.indexOf(name, from);
    if (at === -1) return;
    const boundaryOk =
      !requireBoundary || (!isWordChar(text, at - 1) && !isWordChar(text, at + name.length));
    if (boundaryOk) yield at;
    from = at + 1;
  }
}

/**
 * 어시스턴트 채팅 텍스트 내에서 프로젝트 데이터베이스에 존재하는 엔티티 이름을 탐색한다.
 * 한국어 단어 경계가 없는 특성에 맞춰 단순 부분 문자열 포함 여부를 검사하며,
 * 더 긴 이름을 우선 매칭해 "슬라임 왕" 안의 "슬라임" 같은 중복 감지를 차단한다.
 */
export function findEntityMentions(
  text: string,
  project: Project,
  limit: number = 6
): EntityMention[] {
  if (!text || !text.trim() || !project?.database || limit <= 0) {
    return [];
  }

  // 1. 우선순위 컬렉션에서 길이 >= 2 인 고유 레코드들을 수집한다.
  // 동일 컬렉션 내 또는 다른 컬렉션 간 중복 레코드(동일 id 또는 동일 name)는 우선순위에 따라 먼저 등장한 것만 보존한다.
  const recordsByNameAndCollection: {
    collection: DatabaseCollection;
    id: string;
    name: string;
    record: DatabaseRecordUnion;
  }[] = [];

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (const collection of SEARCH_COLLECTIONS) {
    const list = project.database[collection];
    if (!Array.isArray(list)) continue;

    for (const record of list) {
      if (!record || typeof record.name !== "string" || !record.id) continue;
      const trimmedName = record.name.trim();
      if (trimmedName.length < 2) continue;

      const idKey = `${collection}:${record.id}`;
      if (seenIds.has(idKey) || seenNames.has(trimmedName)) {
        continue;
      }

      seenIds.add(idKey);
      seenNames.add(trimmedName);
      recordsByNameAndCollection.push({
        collection,
        id: record.id,
        name: trimmedName,
        record: record as DatabaseRecordUnion,
      });
    }
  }

  // 2. 더 긴 이름이 먼저 매칭될 수 있도록 이름 길이 내림차순 정렬한다.
  recordsByNameAndCollection.sort((a, b) => b.name.length - a.name.length);

  // 3. 텍스트에서 소비된 구간을 추적하기 위해 마스크 배열 또는 인덱스 매칭을 사용한다.
  // 텍스트 문자열 길이만큼 불리언 배열을 준비해 이미 매칭된 구간을 점유 처리한다.
  const occupied = new Array<boolean>(text.length).fill(false);
  const matchedCandidates: MatchedCandidate[] = [];

  for (const target of recordsByNameAndCollection) {
    const targetName = target.name;
    // ASCII 전용 이름은 단어 경계를 요구하고, 한글이 섞인 이름은 부분 문자열로 맞춘다.
    const requireBoundary = !CJK_PATTERN.test(targetName);

    for (const idx of occurrences(text, targetName, requireBoundary)) {
      const endIdx = idx + targetName.length;

      // 이미 더 긴 이름이 점유한 범위와 겹치는지 검사
      let hasOverlap = false;
      for (let i = idx; i < endIdx; i++) {
        if (occupied[i]) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;

      for (let i = idx; i < endIdx; i++) occupied[i] = true;

      matchedCandidates.push({
        collection: target.collection,
        id: target.id,
        name: targetName,
        record: target.record,
        startIndex: idx,
        endIndex: endIdx,
      });

      // 동일 레코드는 텍스트 내 첫 번째 매칭만 결과에 취합한다.
      break;
    }
  }

  // 4. 텍스트 내 첫 등장 인덱스(startIndex) 오름차순으로 정렬
  matchedCandidates.sort((a, b) => a.startIndex - b.startIndex);

  // 5. limit 적용 후 EntityMention 형태로 반환
  const capped = matchedCandidates.slice(0, limit);
  return capped.map((item) => ({
    collection: item.collection,
    id: item.id,
    name: item.name,
    record: item.record,
  }));
}

/**
 * 멘션된 데이터베이스 레코드 목록을 썸네일 칩 스트립으로 렌더링한다.
 */
export function renderEntityMentionStrip(
  mentions: readonly EntityMention[],
  project: Project
): HTMLElement | null {
  if (!mentions || mentions.length === 0) {
    return null;
  }

  const container = el("div", {
    class: "ai-mention-strip",
    attrs: {
      role: "list",
      "aria-label": "언급된 자료",
    },
    dataset: {
      testid: "ai-mention-strip",
    },
  });

  for (const mention of mentions) {
    const thumb = recordListThumbnail(
      mention.collection,
      mention.record as DatabaseRecords[DatabaseCollection][number],
      project,
      28
    );

    const isThumbless = !thumb;
    const chipClass = isThumbless ? "ai-mention-chip is-thumbless" : "ai-mention-chip";

    const chip = el("div", {
      class: chipClass,
      attrs: {
        role: "listitem",
        title: mention.name,
      },
      dataset: {
        testid: `ai-mention-${mention.collection}-${mention.id}`,
      },
    });

    if (thumb) {
      chip.append(thumb);
    }

    const nameSpan = el("span", {
      class: "ai-mention-name",
      text: mention.name,
    });
    chip.append(nameSpan);

    container.append(chip);
  }

  return container;
}
