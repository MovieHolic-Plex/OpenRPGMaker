// player/deviceRecords.ts
// 기기 기록(클리어한 엔딩 · 한 번 본 CG) — 세이브 슬롯이 아니라 이 기기에 남는 값을 세션에 비춘다 (2026-10-17, 미연시 수리).
// 미연시의 표준: 한 번 본 CG 와 엔딩은 다른 슬롯·새 게임·옛 저장 불러오기에도 그대로 열려 있다.
//  · 엔딩: 클리어 기록(clearRecord)의 endingIds → session.clearHistory (세이브에는 안 실린다).
//  · CG: `{저장 이름공간}:gallery-record:v1` → session.galleryUnlocks. 옛 세이브의 슬롯별 해금은 읽는 순간 기기 기록에 합쳐진다(이관).
// 부팅(새 게임·타이틀 불러오기)과 인게임 applySession(ESC 불러오기·체크포인트 복구·패배 복구)이 같은 함수를 부른다 —
// 한쪽만 심으면 ESC 불러오기 뒤 엔딩 목록이 0/N 으로 초기화됐다.
import { clearHistoryOf, readClearRecord } from "@/player/clearRecord";
import { clearRecordKey } from "@/player/saveSlots";
import { GALLERY_UNLOCK_MAX, normalizeGalleryUnlocks } from "@/project/gallery";
import type { PlaySession } from "@/project/session";
import { listGallerySlots } from "@/project/vnExtras";
import type { Project } from "@/project/types";

/** 기기 기록에 남기는 CG 해금 상한. 세션(세이브)에 싣는 GALLERY_UNLOCK_MAX 보다 넉넉하다 — 칸 밖 옛 id 가 칸 안 id 를 밀어내지 않게 칸 안 id 를 먼저 남긴다. */
export const GALLERY_RECORD_MAX = 1000;

export function galleryRecordKey(): string {
  return clearRecordKey().replace(/:clear-record:v1$/u, ":gallery-record:v1");
}

export function readGalleryRecord(storage: Storage): string[] {
  try {
    const text = storage.getItem(galleryRecordKey());
    if (text === null) return [];
    const parsed: unknown = JSON.parse(text);
    const ids = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as { ids?: unknown }).ids : parsed;
    return normalizeGalleryUnlocks(ids, GALLERY_RECORD_MAX) ?? [];
  } catch (error) {
    console.warn("[galleryRecord] 손상된 갤러리 기록을 무시합니다:", error);
    return [];
  }
}

function writeGalleryRecord(storage: Storage, ids: readonly string[]): void {
  try {
    storage.setItem(galleryRecordKey(), JSON.stringify({ version: 1, ids }));
  } catch (error) {
    console.warn("[galleryRecord] 갤러리 기록을 저장하지 못했습니다:", error);
  }
}

/** 칸 안 id 를 먼저 모두 남기고, 칸 밖 id 는 오래된 것부터 버려 상한에 맞춘다. */
function prioritize(ids: readonly string[], live: ReadonlySet<string>, max: number): string[] {
  const inLive = ids.filter((id) => live.has(id));
  return [...inLive, ...ids.filter((id) => !live.has(id)).slice(-Math.max(0, max - inLive.length))].slice(0, max);
}

/** CG 한 장을 열었다 — 기기 기록에 바로 남긴다(저장하지 않고 종료해도 남는다). */
export function recordGalleryUnlockOnDevice(storage: Storage, resourceId: string, liveSlots: readonly string[] = []): void {
  const id = resourceId.trim();
  if (!id) return;
  const current = readGalleryRecord(storage);
  if (current.includes(id)) return;
  writeGalleryRecord(storage, prioritize([...current, id], new Set(liveSlots), GALLERY_RECORD_MAX));
}

/**
 * 세션에 기기 기록을 비춘다. 엔딩은 기기 기록이 정본(세션 값을 덮는다). CG 는 합집합 — 세션(옛 세이브의 슬롯별 해금)이 가진 것은 기기 기록에 합치고,
 * 기기 기록이 가진 것은 세션에 합친다. 바뀐 것이 있을 때만 쓴다(해금이 없는 게임은 저장소를 건드리지 않는다).
 */
export function syncSessionWithDeviceRecords(storage: Storage, project: Project | undefined, session: PlaySession): void {
  const history = clearHistoryOf(readClearRecord(storage));
  if (history) session.clearHistory = history;
  else delete session.clearHistory;

  const device = readGalleryRecord(storage);
  const own = normalizeGalleryUnlocks(session.galleryUnlocks, GALLERY_RECORD_MAX) ?? [];
  if (device.length === 0 && own.length === 0) {
    delete session.galleryUnlocks;
    return;
  }
  const live = new Set(project ? listGallerySlots(project) : []);
  const merged = [...new Set([...device, ...own])];
  const forDevice = prioritize(merged, live, GALLERY_RECORD_MAX);
  if (forDevice.length !== device.length || forDevice.some((id, index) => id !== device[index])) writeGalleryRecord(storage, forDevice);
  const forSession = prioritize(merged, live, GALLERY_UNLOCK_MAX);
  if (forSession.length > 0) session.galleryUnlocks = forSession;
  else delete session.galleryUnlocks;
}
