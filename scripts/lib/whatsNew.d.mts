// scripts/lib/whatsNew.mjs 의 타입 선언. 테스트와 vite 설정이 쓴다.
import type { WhatsNewData, WhatsNewItem } from "../../src/editor/whatsNew/whatsNewModel";

export declare const INTERNAL_SCOPES: ReadonlySet<string>;
export declare const WHATS_NEW_RELEASE_LIMIT: number;
export declare const USER_NOTE_TRAILER: string;
export declare const WHATS_NEW_MODULE_ID: string;

export type ChangelogItem = {
  section: string;
  scope: string | null;
  summary: string;
  sha: string | null;
  userNote: string | null;
};

export declare function normalizeUserNote(value: unknown): string | null;
export declare function renderUserNoteMarker(note: unknown): string | null;
export declare function parseChangelog(text: string): { version: string; date: string | null; items: ChangelogItem[] }[];
export declare function toUserItem(item: ChangelogItem): WhatsNewItem | null;
export declare function buildWhatsNewData(changelogText: string, options?: { limit?: number }): WhatsNewData;
export declare function whatsNewPlugin(): { name: string };
