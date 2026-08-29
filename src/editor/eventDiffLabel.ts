// editor/eventDiffLabel.ts
// EventDiff → 사람이 읽는 라벨 + 감사 로그용 필드 목록.
//
// 왜 이 파일이 있나 (2026-08-29 실측) —
// `saveEventDraft` 는 이미 `EventDiff` 를 돌려준다. `event.pages[0].name: "페이지 1" → "촌장"`
// 수준의 필드 경로 diff 가 **이미 계산되고 있었다.** 그런데 유일한 호출자
// (`panels/eventEditor/modal.ts` 의 commitValidatedEventDraft)가 반환값을 버렸고,
// 되돌리기 라벨은 상수 `"이벤트 편집"` 이었다. 그래서 NPC 를 아무리 고쳐도 기록에는
// "이벤트 편집" 한 줄만 남고 **어떤 NPC 인지도 알 수 없었다.**
//
// 이 모듈은 그 diff 를 (1) 되돌리기 목록에 뜨는 라벨과 (2) 감사 로그의 필드 목록으로 바꾼다.

import type { EditActivityField } from "@/editor/editActivityLog";
import type { EventDiff, EventFieldDiff } from "@/project/eventDrafts";

/** 라벨에 나열할 필드 경로 최대 개수 — 넘으면 "외 N건" 으로 접는다. */
const MAX_LABELED_PATHS = 3;

/**
 * `event.pages[0].commands[2].body.text` → `pages[0].commands[2]`
 * `event.pages[0].name`                  → `pages[0].name`
 *
 * 전체 경로를 라벨에 그대로 쓰면 한 줄이 화면을 넘긴다. 규칙은 두 가지다:
 *  - 가장 깊은 인덱스 세그먼트까지 남긴다(그 아래는 커맨드 내부 세부 필드라 노이즈다).
 *  - 단, 그 뒤에 **딱 한 세그먼트**만 남는다면 같이 남긴다 — `name` 처럼 짧은 잎 필드는
 *    "무엇을 고쳤나" 의 핵심 정보다. `pages[0]` 만 보여 주면 이름 변경과 조건 변경을
 *    구분할 수 없다.
 */
export function shortEventPath(path: string): string {
  const withoutRoot = path.startsWith("event.") ? path.slice("event.".length) : path;
  if (withoutRoot === "" || withoutRoot === "event") return "전체";
  const segments = withoutRoot.split(".");
  const lastIndexed = segments.reduce((found, segment, index) => (/\[\d+\]$/.test(segment) ? index : found), -1);
  if (lastIndexed < 0) return segments.slice(0, 2).join(".");
  const trailing = segments.length - (lastIndexed + 1);
  const cut = trailing === 1 ? lastIndexed + 2 : lastIndexed + 1;
  return segments.slice(0, cut).join(".");
}

/** 중복 제거된 짧은 경로 목록. 커맨드 하나에서 3개 필드가 바뀌어도 한 항목으로 보인다. */
export function eventDiffPaths(diff: EventDiff): readonly string[] {
  const seen = new Set<string>();
  for (const change of diff.changes) seen.add(shortEventPath(change.path));
  return [...seen];
}

/**
 * 되돌리기 목록·행위 로그에 뜨는 라벨.
 * 예) `이벤트 편집: 촌장 — pages[0].name, pages[0].commands[0]`
 *     `이벤트 생성: 촌장`
 */
export function describeEventDiff(diff: EventDiff | null, eventName?: string): string {
  const name = eventName?.trim();
  const subject = name ? `: ${name}` : "";
  if (!diff) return `이벤트 편집${subject}`;
  if (diff.kind === "created") return `이벤트 생성${subject}`;
  const paths = eventDiffPaths(diff);
  if (paths.length === 0) return `이벤트 편집${subject} — 변경 없음`;
  const shown = paths.slice(0, MAX_LABELED_PATHS).join(", ");
  const rest = paths.length > MAX_LABELED_PATHS ? ` 외 ${paths.length - MAX_LABELED_PATHS}건` : "";
  return `이벤트 편집${subject} — ${shown}${rest}`;
}

/**
 * 감사 로그에 실을 필드 목록. 라벨과 달리 **전체 경로**를 유지한다 —
 * 사후 조사에서는 정확히 어느 필드였는지가 필요하다. 값 절단은 로그 쪽에서 한다.
 */
export function eventDiffFields(diff: EventDiff | null): readonly EditActivityField[] {
  if (!diff) return [];
  return diff.changes.map((change: EventFieldDiff) => ({
    path: change.path,
    ...(change.before === undefined ? {} : { before: change.before }),
    ...(change.after === undefined ? {} : { after: change.after }),
  }));
}
