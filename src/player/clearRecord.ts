// 클리어 기록 — 엔딩을 실제로 본 뒤 "강하게 다시 하기" 가 읽는 한 칸.
// 키는 세이브와 같은 게임별 네임스페이스 규칙(clearRecordKey)을 따르므로 내보낸 게임끼리 섞이지 않는다.
import { captureClearCarry, type ClearCarrySnapshot, type ClearRecord } from "@/project/newGamePlus";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";
import { clearRecordKey } from "@/player/saveSlots";

export function readClearRecord(storage: Storage): ClearRecord | undefined {
  const text = storage.getItem(clearRecordKey());
  if (text === null) return undefined;
  try {
    return parseClearRecord(JSON.parse(text));
  } catch (error) {
    console.warn("[clearRecord] 손상된 클리어 기록을 무시합니다:", error);
    return undefined;
  }
}

export function recordEndingClear(storage: Storage, project: Project, session: PlaySession, endingId: string): ClearRecord {
  const previous = readClearRecord(storage);
  const record: ClearRecord = {
    endingIds: [...new Set([...(previous?.endingIds ?? []), endingId])],
    clearedAt: new Date().toISOString(),
    carry: captureClearCarry(session, project.system.newGamePlus?.carry ?? []),
  };
  storage.setItem(clearRecordKey(), JSON.stringify(record));
  return record;
}

function parseClearRecord(value: unknown): ClearRecord | undefined {
  if (!isRecord(value) || !Array.isArray(value.endingIds) || typeof value.clearedAt !== "string" || !isRecord(value.carry)) {
    return undefined;
  }
  const endingIds = value.endingIds.filter((id): id is string => typeof id === "string");
  if (endingIds.length === 0) return undefined;
  return { endingIds, clearedAt: value.clearedAt, carry: value.carry as ClearCarrySnapshot };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
