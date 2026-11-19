import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { formatLastOpenedTime } from "@/project/recentProjectTime";
import { containsPath, validateRecentFolder } from "../electron/main/projectFolderPath";
import { filterRecentProjects, upsertRecentProject, withoutRecentProject } from "../electron/shared/recentProjects";
import type { RecentProjectEntry } from "../electron/shared/start";

const older: RecentProjectEntry = { projectDir: "/Games/Old", title: "모험 2", lastOpenedAt: "2026-11-15T12:00:00Z", updatedAt: "2026-11-19T12:00:00Z" };
const newer: RecentProjectEntry = { projectDir: "/Games/New", title: "모험 10", lastOpenedAt: "2026-11-17T12:00:00Z" };
const copy: RecentProjectEntry = { projectDir: "/Games/New 사본", title: "모험 10", lastOpenedAt: null };
const missing: RecentProjectEntry = { projectDir: "/Moved/RPG", title: "사라진 게임", lastOpenedAt: "invalid", hiddenReason: "missing" };

describe("최근 프로젝트 목록", () => {
  it("이름과 경로를 검색하고 한글 정규화와 대소문자 차이를 허용한다", () => {
    const entries = [older, newer, copy, missing];
    expect(filterRecentProjects(entries, "  모험 2 ".normalize("NFD"), "opened")).toEqual([older]);
    expect(filterRecentProjects(entries, "/games/NEW", "opened")).toEqual([newer, copy]);
    expect(filterRecentProjects(entries, "moved", "opened")).toEqual([missing]);
  });

  it("편집 시각 대신 마지막으로 연 시각으로 정렬하고 열기 기록이 없는 사본도 남긴다", () => {
    const entries = [older, copy, newer, missing];
    expect(filterRecentProjects(entries, "", "opened")).toEqual([newer, older, copy, missing]);
    expect(filterRecentProjects(entries, "모험", "name")).toEqual([older, copy, newer]);
    expect(entries).toEqual([older, copy, newer, missing]);
  });

  it("마지막으로 연 시각은 오래된 날짜도 한국어 상대 시각으로 표시한다", () => {
    const now = Date.parse("2026-11-19T12:00:00Z");
    expect(formatLastOpenedTime("2026-11-19T10:00:00Z", "ko", now)).toBe("2시간 전");
    expect(formatLastOpenedTime("2026-11-18T12:00:00Z", "ko", now)).toBe("어제");
    expect(formatLastOpenedTime("2026-09-19T12:00:00Z", "ko", now)).toBe("2개월 전");
    expect(formatLastOpenedTime(null, "ko", now)).toBe("");
  });

  it("같은 경로를 다시 열면 앞으로 옮기고 제거는 지정 경로에만 적용한다", () => {
    const entries = [newer, older];
    const reopened = { ...older, title: "새 제목", lastOpenedAt: "2026-11-19T13:00:00Z" };
    expect(upsertRecentProject(entries, reopened, 2)).toEqual([reopened, newer]);
    expect(upsertRecentProject(entries, copy, 2)).toEqual([copy, newer]);
    expect(withoutRecentProject([newer, copy, missing], missing.projectDir)).toEqual([newer, copy]);
    expect(withoutRecentProject(entries, missing.projectDir)).toEqual(entries);
    expect(entries).toEqual([newer, older]);
  });
});

describe("최근 프로젝트 폴더 검증", () => {
  const dir = resolve("games", "project");
  const another = resolve("games", "another");
  const recent = [{ projectDir: dir }];

  it("정확히 같은 최근 경로이며 프로젝트 검사에 통과한 폴더만 허용한다", () => {
    expect(validateRecentFolder(dir, recent, () => dir)).toBe(dir);
    expect(validateRecentFolder(dir, recent, () => null)).toBeNull();
    expect(validateRecentFolder(dir, recent, () => another)).toBeNull();
  });

  it("등록되지 않은 경로, 상대 경로, 우회 경로와 루트는 파일을 검사하기 전에 거절한다", () => {
    const inspect = vi.fn(() => dir);
    const root = resolve("/");
    for (const path of [another, "games/project", dir + "/../project", dir + "\0suffix", root, {}]) {
      const entries = path === another || typeof path !== "string" ? recent : [{ projectDir: path }];
      expect(validateRecentFolder(path, entries, inspect)).toBeNull();
    }
    expect(inspect).not.toHaveBeenCalled();
  });

  it("폴더 포함 관계는 이름 접두어가 아닌 경로 요소를 비교한다", () => {
    expect(containsPath(dir, resolve(dir, "nested"))).toBe(true);
    expect(containsPath(dir, dir)).toBe(true);
    expect(containsPath(dir, dir + " 사본")).toBe(false);
    expect(containsPath(dir, another)).toBe(false);
  });
});
