import { describe, expect, it } from "vitest";
import { START_SCREEN_INTENT_KEY, START_PLAY_URL, takeStartPlayRequest, takeStartScreenIntent, writeStartScreenIntent } from "@/start/startIntent";
import { entriesNeedingCover, formatRelativeTime, partitionRecentEntries } from "@/start/startScreen";
import { LAUNCHER_MODE_KEY, readLauncherMode, writeLauncherMode } from "@/start/launcherShell";
import { PLAYED_KEY, readPlayedLog, recordPlayed, worldsByLastPlayed } from "@/start/playFeed/playFeed";
import { startScreenPrompt } from "@/editor/startScreenHandoff";
import { projectCoverSchema } from "../electron/shared/schemas";
import { interviewBrief } from "./helpers/gameDesignBrief";

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

  it("인터뷰 원문·선택·요약 전체를 일치하는 폴더에 한 번 전달한다", () => {
    const storage = memoryStorage();
    const brief = interviewBrief();
    brief.interview = { version: 1, genre: "monster", concept: "강 너머의 약속을 지키는 모험", protagonist: "아직 외형을 정하지 않음", notes: "원문과 모든 선택을 유지", choiceIds: { experience: "first-meeting" } };
    const complete = { ...base, choiceId: brief.presetId, startMode: "ai" as const, gameDesignBrief: brief };
    writeStartScreenIntent(storage, complete, 1000);
    expect(takeStartScreenIntent(storage, base.projectDir, 2000)?.gameDesignBrief).toEqual(brief);
    expect(takeStartScreenIntent(storage, base.projectDir, 2000)).toBeNull();
    writeStartScreenIntent(storage, complete, 1000);
    expect(takeStartScreenIntent(storage, "/games/other", 2000)).toBeNull();
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

describe("플레이·만들기 갈래", () => {
  it("마지막으로 고른 갈래를 기억하고, 모르는 값은 버린다", () => {
    const storage = memoryStorage();
    expect(readLauncherMode(storage)).toBeNull();
    writeLauncherMode(storage, "play");
    expect(readLauncherMode(storage)).toBe("play");
    storage.setItem(LAUNCHER_MODE_KEY, "edit");
    expect(readLauncherMode(storage)).toBeNull();
    expect(readLauncherMode(null)).toBeNull();
  });

  it("플레이 기록은 최근에 플레이한 순서로, 플레이한 적 없는 월드는 빼고 고른다", () => {
    const storage = memoryStorage();
    recordPlayed(storage, "/games/a", Date.parse("2026-10-17T09:00:00Z"));
    recordPlayed(storage, "/games/b", Date.parse("2026-10-17T10:00:00Z"));
    const log = readPlayedLog(storage);
    const order = worldsByLastPlayed([
      { projectDir: "/games/a", title: "A" },
      { projectDir: "/games/never", title: "안 함" },
      { projectDir: "/games/b", title: "B" },
    ], log);
    expect(order.map((entry) => entry.title)).toEqual(["B", "A"]);
  });

  it("깨진 플레이 기록은 빈 기록으로 읽는다", () => {
    const storage = memoryStorage();
    storage.setItem(PLAYED_KEY, "not json");
    expect(readPlayedLog(storage)).toEqual({});
    storage.setItem(PLAYED_KEY, JSON.stringify({ "/a": "어제", "/b": "2026-10-17T10:00:00Z" }));
    expect(readPlayedLog(storage)).toEqual({ "/b": "2026-10-17T10:00:00Z" });
  });

  it("플레이 표시는 편집기 부팅이 한 번 읽고 주소에서 지운다", () => {
    let replaced = "";
    const history = { state: null, replaceState: (_state: unknown, _title: string, url?: string | URL | null) => { replaced = String(url); } };
    expect(takeStartPlayRequest({ href: "app://oprn" + START_PLAY_URL }, history)).toBe(true);
    expect(replaced).toBe("app://oprn/index.html");
    expect(takeStartPlayRequest({ href: "app://oprn/index.html" }, history)).toBe(false);
  });
});
