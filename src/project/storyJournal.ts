// project/storyJournal.ts
// 이야기 일지(2026-10-25) — ESC 메뉴 「일지」 항목과 이벤트 명령 «Journal Line»(일지에 한 줄 쓰기)이 함께 쓰는 잎 모듈.
// 저작 설정은 project.meta.oprnStoryJournal(제목·필체 목록), 실제 줄은 세이브에 들어가는 session.storyJournal 이다.
// 줄 상태: normal(보통) · erased(지워진 줄 — 메뉴에서 흐리게) · reread(다시 읽어 준 줄 — 되살아남, 묶인 기술을 배운다).
// 명령 적용은 player/interpreter/journalCommands.ts. 해석기(commandCatalog)·메뉴(playerStatusMenuDetails)·조수 도구(configure_story_journal)·세이브(saveSlots)가 같은 규칙을 쓴다.
import type { Project } from "./types";

export type JournalLineState = "normal" | "erased" | "reread";

export interface JournalLine {
  readonly id: string;
  /** 필체(writers[].id 또는 아무 이름). 메뉴는 writers 에서 이름을 찾고, 없으면 이 글자를 그대로 보인다. */
  readonly writer: string;
  /** 날짜 칸(자유 글자 — 「3일째」「서리달 4일」). */
  readonly date: string;
  readonly text: string;
  readonly state: JournalLineState;
  /** 지워진 줄을 다시 읽어 줄 때 이 배우가 이 기술을 (되)배운다. */
  readonly learnActorId?: string;
  readonly learnSkillId?: string;
}

export interface AuthoredStoryJournal {
  readonly version: 1;
  /** 메뉴 항목·화면 제목(12자 이하). */
  readonly title: string;
  /** 필체 목록. id 는 명령의 writer 칸이 가리킨다. */
  readonly writers: readonly { readonly id: string; readonly name: string }[];
}

export const STORY_JOURNAL_DEFAULT_TITLE = "일지";
export const JOURNAL_LINE_LIMIT = 400;
const LINE_STATES: readonly JournalLineState[] = ["normal", "erased", "reread"];

export function validateStoryJournal(value: unknown): asserts value is AuthoredStoryJournal {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("storyJournal: object required");
  const journal = value as Record<string, unknown>;
  if (Object.keys(journal).some((key) => !["version", "title", "writers"].includes(key))) throw Error("storyJournal: unknown field");
  if (journal.version !== 1) throw Error("storyJournal: version 1 required");
  if (typeof journal.title !== "string" || !journal.title.trim() || journal.title.length > 12) throw Error("storyJournal: title 1..12 chars");
  if (!Array.isArray(journal.writers) || journal.writers.length > 16) throw Error("storyJournal: writers 0..16");
  const seen = new Set<string>();
  for (const writer of journal.writers as unknown[]) {
    const row = writer as Record<string, unknown> | null;
    if (!row || typeof row !== "object" || Object.keys(row).some((key) => key !== "id" && key !== "name")) throw Error("storyJournal: invalid writer");
    if (typeof row.id !== "string" || !row.id.trim() || typeof row.name !== "string" || !row.name.trim() || seen.has(row.id)) throw Error("storyJournal: writer id/name required and unique");
    seen.add(row.id);
  }
}

export function storyJournal(project: Project): AuthoredStoryJournal | undefined {
  return project.meta.oprnStoryJournal;
}

export function journalWriterName(project: Project, writer: string): string {
  return storyJournal(project)?.writers.find((row) => row.id === writer)?.name ?? writer;
}

/** 세이브에서 읽은 값을 줄 목록으로 — 모양이 틀린 줄은 버린다. */
export function normalizeJournalLines(raw: unknown): JournalLine[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const lines: JournalLine[] = [];
  for (const item of raw) {
    const row = item as Record<string, unknown> | null;
    if (!row || typeof row !== "object") continue;
    if (typeof row.id !== "string" || !row.id || typeof row.text !== "string") continue;
    const state = LINE_STATES.includes(row.state as JournalLineState) ? (row.state as JournalLineState) : "normal";
    lines.push({
      id: row.id,
      writer: typeof row.writer === "string" ? row.writer : "",
      date: typeof row.date === "string" ? row.date : "",
      text: row.text,
      state,
      ...(typeof row.learnActorId === "string" && row.learnActorId ? { learnActorId: row.learnActorId } : {}),
      ...(typeof row.learnSkillId === "string" && row.learnSkillId ? { learnSkillId: row.learnSkillId } : {}),
    });
  }
  return lines.slice(-JOURNAL_LINE_LIMIT);
}

/** 메뉴·도구가 보는 상태 이름. */
export function journalLineStateLabel(state: JournalLineState): string {
  return state === "erased" ? "지워진 줄" : state === "reread" ? "다시 읽은 줄" : "";
}
