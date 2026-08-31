import type { EventPage } from "@/project/types";

/**
 * 페이지 붙여넣기 버퍼. 프로젝트 데이터가 아니라 **편집 세션 상태**라 store 밖에 산다.
 *
 * 변경 통지가 있는 이유 (실측 2026-08-30): 버퍼는 스토어도 editorState 도 아니어서 아무도
 * "이제 붙여넣을 게 있다"를 듣지 못했다. 버튼 줄은 자기 클릭 핸들러에서 직접 다시 그려
 * 넘겼지만 탭 우클릭 메뉴에는 그 보정이 없었고, 메뉴가 암묵적으로 의지하던 선택 변경은
 * **이미 활성인 페이지를 복사하면 no-op** 이다(editorState.set 은 무변경 시 통지하지 않는다).
 * 그래서 "복사했어요" 토스트가 뜬 화면에서 붙여넣기 버튼이 여전히 비활성 + "먼저 복사를
 * 누르세요" 였다. 구독을 한 곳에 두어 두 표면이 같은 갱신 경로를 쓰게 한다.
 */
type ClipboardListener = () => void;

let copiedEventPage: EventPage | null = null;
const listeners = new Set<ClipboardListener>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/** 버퍼가 바뀔 때마다 부른다. 반환값으로 구독을 해제한다. */
export function subscribeCopiedEventPage(listener: ClipboardListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function copyEventPageToBuffer(page: EventPage | null): boolean {
  copiedEventPage = page ? structuredClone(page) : null;
  notify();
  return copiedEventPage !== null;
}

export function copiedEventPageFromBuffer(): EventPage | null {
  return copiedEventPage;
}

export function hasCopiedEventPageInBuffer(): boolean {
  return copiedEventPage !== null;
}

/** 프로젝트 경계를 넘은 저작 데이터가 다른 프로젝트에 붙는 것을 막는다. */
export function clearCopiedEventPage(): void {
  const had = copiedEventPage !== null;
  copiedEventPage = null;
  if (had) notify();
}
