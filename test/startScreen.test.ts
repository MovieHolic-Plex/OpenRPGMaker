import { describe, expect, it } from "vitest";
import { START_SCREEN_INTENT_KEY, takeStartScreenIntent, writeStartScreenIntent } from "@/start/startIntent";
import { entriesNeedingCover, formatRelativeTime, partitionRecentEntries } from "@/start/startScreen";
import { startScreenPrompt } from "@/editor/startScreenHandoff";
import { projectCoverSchema } from "../electron/shared/schemas";

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> & { readonly map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: (key) => { map.delete(key); },
  };
}

describe("시작 화면 → 편집기 인계", () => {
  const base = { projectDir: "/games/새 게임", title: "새 게임", choiceId: "monster-collect" as const, intent: "풀숲 마을" };

  it("방금 만든 그 폴더가 열렸을 때만 한 번 꺼낸다", () => {
    const storage = memoryStorage();
    writeStartScreenIntent(storage, base, 1_000);
    expect(takeStartScreenIntent(storage, "/games/새 게임", 2_000)).toMatchObject(base);
    expect(storage.map.has(START_SCREEN_INTENT_KEY)).toBe(false);
    expect(takeStartScreenIntent(storage, "/games/새 게임", 2_000)).toBeNull();
  });

  it("다른 폴더가 열렸으면 버린다 — 남의 프로젝트에 장르 씨앗을 덮어쓰지 않는다", () => {
    const storage = memoryStorage();
    writeStartScreenIntent(storage, base, 1_000);
    expect(takeStartScreenIntent(storage, "/games/옛 게임", 2_000)).toBeNull();
    expect(storage.map.has(START_SCREEN_INTENT_KEY)).toBe(false);
  });

  it("10분이 지난 값과 깨진 값은 버린다", () => {
    const storage = memoryStorage();
    writeStartScreenIntent(storage, base, 0);
    expect(takeStartScreenIntent(storage, base.projectDir, 11 * 60_000)).toBeNull();
    storage.setItem(START_SCREEN_INTENT_KEY, "{not json");
    expect(takeStartScreenIntent(storage, base.projectDir, 0)).toBeNull();
    storage.setItem(START_SCREEN_INTENT_KEY, JSON.stringify({ version: 2, ...base, createdAt: 0 }));
    expect(takeStartScreenIntent(storage, base.projectDir, 0)).toBeNull();
  });

  it("한 문장이 비었으면 조수에게 보낼 것이 없다", () => {
    expect(startScreenPrompt({ choiceId: "monster-collect", intent: "   " })).toBeNull();
  });

  it("장르를 고른 한 문장은 장르 엔진을 끄지 말라는 줄을 단다", () => {
    const prompt = startScreenPrompt({ choiceId: "monster-collect", intent: "풀숲 마을" });
    expect(prompt).toContain("사용자 의도: 풀숲 마을");
    expect(prompt).toContain("선택한 시작 장르: 몬스터 수집");
    expect(startScreenPrompt({ choiceId: null, intent: "풀숲 마을" })).not.toContain("선택한 시작 장르");
  });
});

describe("시작 화면 최근 목록", () => {
  it("임시 폴더와 사라진 폴더는 기본으로 숨기고 개수만 센다", () => {
    const result = partitionRecentEntries([
      { projectDir: "/tmp/oprn-packaged-a", title: "a", hiddenReason: "temporary" },
      { projectDir: "/home/me/game", title: "게임" },
      { projectDir: "/home/me/gone", title: "사라짐", hiddenReason: "missing" },
    ]);
    expect(result.visible.map((entry) => entry.title)).toEqual(["게임"]);
    expect(result.temporary).toBe(1);
    expect(result.missing).toBe(1);
  });

  it("상대 시각", () => {
    const now = Date.parse("2026-09-27T12:00:00Z");
    expect(formatRelativeTime("2026-09-27T11:59:40Z", now)).toBe("방금");
    expect(formatRelativeTime("2026-09-27T10:00:00Z", now)).toBe("2시간 전");
    expect(formatRelativeTime("2026-09-26T09:00:00Z", now)).toBe("어제");
    expect(formatRelativeTime(null, now)).toBe("");
  });

  it("그림이 없거나 낡은 보이는 항목만 시작 화면이 다시 굽는다", () => {
    const picked = entriesNeedingCover([
      { projectDir: "/a", title: "그림 없음" },
      { projectDir: "/b", title: "그림 있음", cover: "data:image/jpeg;base64,/9j/" },
      { projectDir: "/c", title: "낡음", cover: "data:image/jpeg;base64,/9j/", coverStale: true },
      { projectDir: "/tmp/x", title: "임시", hiddenReason: "temporary" },
      { projectDir: "/gone", title: "사라짐", hiddenReason: "missing" },
    ]);
    expect(picked.map((entry) => entry.projectDir)).toEqual(["/a", "/c"]);
  });
});

describe("대표 그림 채널", () => {
  it("JPEG data URL 만 받는다", () => {
    expect(projectCoverSchema.safeParse({ projectDir: "/p", dataUrl: "data:image/jpeg;base64,/9j/4AAQ" }).success).toBe(true);
    expect(projectCoverSchema.safeParse({ projectDir: "/p", dataUrl: "data:image/png;base64,iVBOR" }).success).toBe(false);
    expect(projectCoverSchema.safeParse({ projectDir: "/p", dataUrl: "data:text/html;base64,PGh0bWw+" }).success).toBe(false);
  });
});
