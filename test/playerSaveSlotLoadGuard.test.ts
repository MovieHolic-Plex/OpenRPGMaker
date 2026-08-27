import { describe, expect, it } from "vitest";
import { createSampleAdventureProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createSaveSnapshot, saveToSlot, snapshotLoadBlocker, type SaveSnapshot } from "@/player/saveSlots";

// 실측 결함: 저장 당시의 맵이 지워진 슬롯을 그대로 적용하면 부팅이 project.maps[id].width 에서
// 터져 배포 플레이어가 "맵·에셋 불러오는 중…" 화면에 영구히 갇혔다. 로드는 적용 전에 막아야 한다.
describe("snapshotLoadBlocker", () => {
  const project = createSampleAdventureProject();

  function snapshotOnMap(mapId: string): SaveSnapshot {
    const session = startSession(project);
    session.currentMapId = mapId;
    return createSaveSnapshot(project, session);
  }

  it("허용: 저장 당시의 맵이 아직 프로젝트에 있다", () => {
    expect(snapshotLoadBlocker(project, snapshotOnMap(project.startMapId))).toBeNull();
  });

  it("차단: 저장 당시의 맵이 프로젝트에서 사라졌다", () => {
    const snapshot = snapshotOnMap(project.startMapId);
    const stale: SaveSnapshot = {
      ...snapshot,
      session: { ...snapshot.session, currentMapId: "map_deleted_by_author" },
    };
    expect(snapshotLoadBlocker(project, stale)).toBe("저장 당시의 맵이 이 프로젝트에 없습니다");
  });
});

// 수동 저장은 quota 초과·프라이빗 모드에서 예외를 던졌고 상태 메뉴가 잡지 않아 성공도 실패도
// 표시되지 않았다. 오토세이브(performAutosave)처럼 결과를 돌려준다.
describe("saveToSlot", () => {
  const project = createSampleAdventureProject();

  function throwingStorage(error: unknown): Storage {
    const backing = new Map<string, string>();
    return {
      get length() {
        return backing.size;
      },
      clear: () => backing.clear(),
      getItem: (key: string) => backing.get(key) ?? null,
      key: (index: number) => [...backing.keys()][index] ?? null,
      removeItem: (key: string) => void backing.delete(key),
      setItem: () => {
        throw error;
      },
    } satisfies Storage;
  }

  it("성공하면 ok 를 돌려준다", () => {
    const storage = new Map<string, string>();
    const fake = {
      get length() {
        return storage.size;
      },
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      key: (index: number) => [...storage.keys()][index] ?? null,
      removeItem: (key: string) => void storage.delete(key),
      setItem: (key: string, value: string) => void storage.set(key, value),
    } satisfies Storage;
    const result = saveToSlot(fake, 1, createSaveSnapshot(project, startSession(project)));
    expect(result).toEqual({ ok: true });
    expect(storage.size).toBe(1);
  });

  it("저장 공간이 부족하면 사람이 읽을 수 있는 실패를 돌려준다(예외를 던지지 않는다)", () => {
    const quota = new DOMException("exceeded", "QuotaExceededError");
    const result = saveToSlot(throwingStorage(quota), 1, createSaveSnapshot(project, startSession(project)));
    expect(result).toEqual({ ok: false, message: "저장 공간이 부족합니다" });
  });

  it("그 밖의 저장 실패도 던지지 않고 실패로 보고한다", () => {
    const result = saveToSlot(throwingStorage(new Error("boom")), 1, createSaveSnapshot(project, startSession(project)));
    expect(result.ok).toBe(false);
  });
});
