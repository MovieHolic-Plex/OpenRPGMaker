import type { EventPage } from "@/project/types";

let copiedEventPage: EventPage | null = null;

export function copyEventPageToBuffer(page: EventPage | null): boolean {
  copiedEventPage = page ? structuredClone(page) : null;
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
  copiedEventPage = null;
}
