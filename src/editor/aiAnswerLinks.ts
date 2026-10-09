// editor/aiAnswerLinks.ts
// 조수 답변 안에 등장한 **저작물 이름**을 편집기 내부 이동 대상으로 푼다.
//
// 왜 이름이 열쇠인가: UX 정책(`promptPolicies.ts`)이 최종 답변에서 내부 ID 노출을 금지하므로
// 모델이 마크다운 링크에 mapId 를 실어 보내게 만들 수 없다. 대신 모델이 실제로 쓰는 것(맵·이벤트
// 이름)을 색인해 두고 답변 텍스트에서 되찾는다. 그래서 모델 협조가 0 이어도, 이미 지나간 대화에도
// 링크가 걸린다.
//
// 의존성 0 을 유지하라 — DOM(패널)과 툴 런타임이 둘 다 import 한다. store/editorState/Phaser 를
// 끌어들이면 순수 테스트가 불가능해지고 툴 쪽이 브라우저 상태에 오염된다.
//
// `panels/aiEntityMentions.ts` 와 하는 일이 닮아 보이지만 일부러 합치지 않았다. 그곳은 데이터베이스
// 레코드(몬스터·아이템) 이름을 한글에서는 경계 **없이** 부분 일치로 잡아 사진 띠를 붙이고, 오탐의
// 대가는 "엉뚱한 사진 한 장"이다. 여기는 누르면 **화면이 이동하므로** 오탐의 대가가 "엉뚱한 곳으로
// 끌려가기" 다 — 그래서 조사를 아는 더 엄한 경계 계산을 쓴다(`마을길` 거부). 둘을 합치면 한쪽은
// 반드시 나쁜 쪽을 얻는다.
import type { Project } from "@/project/types";

export type EditorReferenceTarget =
  | { readonly kind: "map"; readonly mapId: string }
  | { readonly kind: "event"; readonly mapId: string; readonly eventId: string; readonly x: number; readonly y: number }
  /** 같은 이름이 여러 곳에 있어 한 곳으로 데려갈 수 없다 — 찾기 창에 이름을 넣어 사용자가 고른다. */
  | { readonly kind: "ambiguous"; readonly label: string; readonly count: number };

export interface EditorReferenceEntry {
  readonly label: string;
  readonly target: EditorReferenceTarget;
}

export type EditorReferenceQueryResult =
  | { readonly kind: "found"; readonly entry: EditorReferenceEntry }
  | { readonly kind: "ambiguous"; readonly labels: readonly string[] }
  | { readonly kind: "missing" };

export interface EditorReferenceIndex {
  /** 긴 이름 우선. '상인 하나의 집' 이 '집' 보다 먼저 잡혀야 한다. */
  readonly entries: readonly EditorReferenceEntry[];
}

export interface EditorReferenceSpan {
  readonly start: number;
  readonly end: number;
  readonly label: string;
  readonly target: EditorReferenceTarget;
}

/** 한 글자 이름은 아무 문장에나 걸린다. 두 글자부터 색인한다. */
const MIN_LABEL_LENGTH = 2;
/** 문장 하나가 통째로 이름인 경우(잘못 저장된 이름)까지 링크로 만들지 않는다. */
const MAX_LABEL_LENGTH = 40;

/**
 * 한국어 산문은 이름과 조사를 띄우지 않으므로 일반 단어 경계만 쓰면 링크가 거의 사라진다.
 * 그러나 조사 음절을 무제한 소비하면 `마을도로` 같은 보통 합성어까지 조사로 발명해 버린다.
 * 따라서 완전한 조사 하나와 그 뒤의 보조사 하나만 허용한다.
 */
const PARTICLES = [
  "으로써", "으로서", "에게서", "이라도", "입니다",
  "으로", "에서", "에게", "까지", "부터", "처럼", "보다", "마다", "조차", "밖에", "라도", "한테", "께서",
  "하고", "이랑", "이나", "이다", "였다", "이에요", "예요", "이야", "이며", "이고",
  "은", "는", "이", "가", "을", "를", "의", "도", "만", "와", "과", "나", "랑", "께", "에", "로", "야",
  "인", "일",
] as const;

const AUXILIARY_PARTICLES = ["이야", "는", "은", "도", "만", "요", "야"] as const;

function isWordChar(char: string): boolean {
  return /[\p{L}\p{N}_]/u.test(char);
}

function isHangul(char: string): boolean {
  return /[\p{Script=Hangul}]/u.test(char);
}

function usableLabel(raw: string | undefined | null): string | null {
  const label = (raw ?? "").trim();
  if (label.length < MIN_LABEL_LENGTH || label.length > MAX_LABEL_LENGTH) return null;
  // 숫자·기호만으로 된 이름(`1`, `---`)은 문장 안에서 이름으로 읽히지 않는다.
  if (!/[\p{L}]/u.test(label)) return null;
  return label;
}

/** 프로젝트에서 "데려갈 수 있는 것"의 이름 색인. 맵과 이름 있는 맵 이벤트만 대상이다. */
export function buildEditorReferenceIndex(project: Project): EditorReferenceIndex {
  const byLabel = new Map<string, EditorReferenceTarget[]>();

  const add = (raw: string | undefined | null, target: EditorReferenceTarget): void => {
    const label = usableLabel(raw);
    if (!label) return;
    const bucket = byLabel.get(label);
    if (bucket) bucket.push(target);
    else byLabel.set(label, [target]);
  };

  // 맵 id 순으로 돌아 같은 프로젝트에서 항상 같은 색인이 나오게 한다.
  for (const mapId of Object.keys(project.maps).sort()) {
    const map = project.maps[mapId];
    if (!map) continue;
    add(map.name, { kind: "map", mapId });
    for (const event of map.events) {
      const names = new Set<string>();
      for (const page of event.pages ?? []) {
        const label = usableLabel(page.name);
        if (label) names.add(label);
      }
      for (const name of names) {
        add(name, { kind: "event", mapId, eventId: event.id, x: event.x, y: event.y });
      }
    }
  }

  const entries: EditorReferenceEntry[] = [];
  for (const [label, targets] of byLabel) {
    const unique = dedupeTargets(targets);
    entries.push({
      label,
      target: unique.length === 1 && unique[0]
        ? unique[0]
        : { kind: "ambiguous", label, count: unique.length },
    });
  }
  entries.sort((a, b) => b.label.length - a.label.length || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  return { entries };
}

function dedupeTargets(targets: readonly EditorReferenceTarget[]): EditorReferenceTarget[] {
  const seen = new Set<string>();
  const unique: EditorReferenceTarget[] = [];
  for (const target of targets) {
    const key = target.kind === "event" ? `event:${target.mapId}:${target.eventId}` : `map:${(target as { mapId: string }).mapId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(target);
  }
  return unique;
}

// 긴 조사가 먼저 걸려야 한다(`밖에` 가 `에` 보다, `이라도` 가 `라도` 보다). 표를 손으로
// 정렬해 두는 것에 의존하면 나중에 조사를 끝에 덧붙이는 순간 조용히 짧은 쪽이 이긴다.
const PARTICLES_BY_LENGTH = [...PARTICLES].sort((a, b) => b.length - a.length);
const AUXILIARY_BY_LENGTH = [...AUXILIARY_PARTICLES].sort((a, b) => b.length - a.length);

function consumeLongest(text: string, cursor: number, candidates: readonly string[]): number {
  const match = candidates.find((candidate) => text.startsWith(candidate, cursor));
  return match ? cursor + match.length : cursor;
}

/** 이름 경계 판정. 앞 단어는 거부하고, 뒤에는 완전한 조사 하나와 보조사 하나까지만 허용한다. */
function boundaryOk(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text.charAt(start - 1) : "";
  if (before && isWordChar(before)) return false;

  let cursor = consumeLongest(text, end, PARTICLES_BY_LENGTH);
  cursor = consumeLongest(text, cursor, AUXILIARY_BY_LENGTH);
  const after = text.charAt(cursor);
  return !after || (!isHangul(after) && !isWordChar(after));
}

interface ReferenceTrie {
  children: Map<string, ReferenceTrie>;
  matches: { entry: EditorReferenceEntry; rank: number }[];
}
const matchers = new WeakMap<EditorReferenceIndex, { root: ReferenceTrie; results: Map<string, readonly EditorReferenceSpan[]> }>();
function referenceMatcher(index: EditorReferenceIndex) {
  let matcher = matchers.get(index);
  if (matcher) return matcher;
  const root: ReferenceTrie = { children: new Map(), matches: [] };
  index.entries.forEach((entry, rank) => {
    let node = root;
    // UTF-16 offsets match DOM text slicing and the existing boundary contract.
    for (let i = 0; i < entry.label.length; i++) {
      const char = entry.label.charAt(i);
      let child = node.children.get(char);
      if (!child) { child = { children: new Map(), matches: [] }; node.children.set(char, child); }
      node = child;
    }
    node.matches.push({ entry, rank });
  });
  matcher = { root, results: new Map() };
  matchers.set(index, matcher);
  return matcher;
}

/** 답변 텍스트에서 색인된 이름의 위치를 찾는다. 겹치지 않고, 긴 이름이 이긴다. */
export function findEditorReferences(text: string, index: EditorReferenceIndex): EditorReferenceSpan[] {
  if (!text) return [];
  const matcher = referenceMatcher(index);
  const cached = matcher.results.get(text);
  if (cached) return cached.slice();
  const matches: { span: EditorReferenceSpan; rank: number }[] = [];
  for (let start = 0; start < text.length; start++) {
    if (start > 0 && isWordChar(text.charAt(start - 1))) continue;
    let node = matcher.root;
    for (let cursor = start; cursor < text.length; cursor++) {
      const child = node.children.get(text.charAt(cursor));
      if (!child) break;
      node = child;
      for (const { entry, rank } of node.matches) {
        const end = cursor + 1;
        if (boundaryOk(text, start, end)) matches.push({ rank, span: { start, end, label: entry.label, target: entry.target } });
      }
    }
  }
  // Global long-name priority must also win for crossing overlaps, not just prefixes.
  matches.sort((a, b) => a.rank - b.rank || a.span.start - b.span.start);
  const spans: EditorReferenceSpan[] = [];
  for (const { span } of matches) {
    if (!spans.some(range => span.start < range.end && span.end > range.start)) spans.push(span);
  }
  spans.sort((a, b) => a.start - b.start);
  // Bounded per-index cache for repeated paragraphs during history restoration.
  if (text.length <= 8000) {
    if (matcher.results.size >= 256) matcher.results.delete(matcher.results.keys().next().value!);
    matcher.results.set(text, spans);
  }
  return spans.slice();
}

/**
 * 도구용 이름 조회 — 정확히 같은 이름이 있으면 바로 찾고, 부분 일치만 여럿이면 후보를 돌려준다.
 * 서로 다른 이름을 순서 규칙으로 하나 고르면 호출자가 의도하지 않은 곳으로 화면을 옮기게 된다.
 */
export function resolveEditorReferenceQuery(index: EditorReferenceIndex, query: string): EditorReferenceQueryResult {
  const needle = query.trim();
  if (!needle) return { kind: "missing" };
  const lower = needle.toLowerCase();
  const exact = index.entries.find((entry) => entry.label.toLowerCase() === lower);
  if (exact) return { kind: "found", entry: exact };
  const partial = index.entries
    .filter((entry) => entry.label.toLowerCase().includes(lower))
    .sort((a, b) => a.label.length - b.label.length || (a.label < b.label ? -1 : 1));
  if (partial.length === 0) return { kind: "missing" };
  if (partial.length > 1) return { kind: "ambiguous", labels: partial.map((entry) => entry.label) };
  const entry = partial[0];
  return entry ? { kind: "found", entry } : { kind: "missing" };
}
