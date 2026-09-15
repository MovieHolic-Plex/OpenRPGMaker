// test/releaseTooling.test.ts
// 릴리스 도구의 순수 계산을 케이스로 직접 고정한다(저장소 이력에 의존하지 않는다).
import { describe, expect, it } from "vitest";
import { appVersionLabel, parseDescribe } from "../scripts/lib/appVersion.mjs";
import {
  SECTION_TITLES,
  buildReleaseSections,
  bumpVersion,
  collectReleaseItems,
  decideReleaseKind,
  parseCommitSubject,
  renderReleaseNotes,
} from "../scripts/lib/releaseNotes.mjs";
import { changelogEntryFor } from "../scripts/lib/releaseFiles.mjs";

describe("parseDescribe", () => {
  it("태그·커밋 수·sha 를 분해한다", () => {
    expect(parseDescribe("v0.1.0-3-gddc7a88")).toEqual({
      tag: "v0.1.0",
      commitsSinceTag: 3,
      commit: "gddc7a88",
      dirty: false,
    });
  });

  it("태그가 없으면 sha 만 남기고 커밋 수는 미정으로 둔다", () => {
    expect(parseDescribe("ddc7a88")).toEqual({ tag: null, commitsSinceTag: null, commit: "gddc7a88", dirty: false });
  });

  it("더러운 트리를 표시한다", () => {
    expect(parseDescribe("v0.1.0-0-gddc7a88-dirty")).toEqual({
      tag: "v0.1.0",
      commitsSinceTag: 0,
      commit: "gddc7a88",
      dirty: true,
    });
  });

  it("해석 못 하는 입력은 null — 호출자가 폴백을 정한다", () => {
    expect(parseDescribe("")).toBeNull();
    expect(parseDescribe(undefined)).toBeNull();
    expect(parseDescribe("--releases")).toBeNull();
  });
});

describe("appVersionLabel", () => {
  const base = { version: "0.1.0", commit: "gddc7a88", dirty: false };

  it("태그가 현재 버전 그대로이고 그 위 커밋이 없으면 릴리스 라벨이다", () => {
    expect(appVersionLabel({ ...base, tag: "v0.1.0", commitsSinceTag: 0 })).toBe("0.1.0");
  });

  it("태그 이후 커밋 수를 dev 카운터로 쓴다", () => {
    expect(appVersionLabel({ ...base, tag: "v0.1.0", commitsSinceTag: 3 })).toBe("0.1.0-dev.3+gddc7a88");
  });

  it("태그가 없으면 저장소 전체 커밋 수를 쓴다", () => {
    expect(appVersionLabel({ ...base, tag: null, commitsSinceTag: 184 })).toBe("0.1.0-dev.184+gddc7a88");
  });

  it("더러운 트리는 build metadata 에 표시한다", () => {
    expect(appVersionLabel({ ...base, tag: "v0.1.0", commitsSinceTag: 3, dirty: true })).toBe("0.1.0-dev.3+gddc7a88.dirty");
  });

  it("git  못 쓰면 죽지 않고 nogit 으로 떨어진다", () => {
    expect(appVersionLabel({ ...base, commit: "unknown", tag: null, commitsSinceTag: 0 })).toBe("0.1.0+nogit");
  });

  it("태그가 다른 버전이면(범프 직후 커밋) dev 라벨이다", () => {
    expect(appVersionLabel({ version: "0.2.0", tag: "v0.1.0", commitsSinceTag: 1, commit: "gddc7a88", dirty: false })).toBe(
      "0.2.0-dev.1+gddc7a88",
    );
  });
});

describe("bumpVersion", () => {
  it("semver 자리를 올린다", () => {
    expect(bumpVersion("0.1.0", "patch")).toBe("0.1.1");
    expect(bumpVersion("0.1.0", "minor")).toBe("0.2.0");
    expect(bumpVersion("0.1.0", "major")).toBe("1.0.0");
    expect(bumpVersion("1.4.9", "patch")).toBe("1.4.10");
  });

  it("모르는 종류는 던진다 — 조용히 0.0.0 을 만들지 않는다", () => {
    expect(() => bumpVersion("0.1.0", "huge")).toThrow();
  });
});

describe("parseCommitSubject", () => {
  it("타입·스코프·요약을 뽑고 깨지는 변경을 표시한다", () => {
    expect(parseCommitSubject("feat(editor): 목차를 고친다")).toEqual({
      type: "feat",
      scope: "editor",
      summary: "목차를 고친다",
      breaking: false,
    });
    expect(parseCommitSubject("fix(ai)!: 응답 형식을 바꾼다")).toEqual({
      type: "fix",
      scope: "ai",
      summary: "응답 형식을 바꾼다",
      breaking: true,
    });
  });

  it("머지 커밋과 릴리스 커밋은 노트에서 뺀다", () => {
    expect(parseCommitSubject("Merge branch 'persistence/p1-port' (#845)")).toBeNull();
    expect(parseCommitSubject("chore(release): v0.2.0")).toBeNull();
  });

  it("규약을 안 따른 커밋도 버리지 않는다 — 조용히 사라지는 변경을 만들지 않기 위해서다", () => {
    expect(parseCommitSubject("맵 목록 전환을 고침")).toEqual({
      type: null,
      scope: null,
      summary: "맵 목록 전환을 고침",
      breaking: false,
    });
  });
});

describe("collectReleaseItems", () => {
  it("같은 요약은 한 번만 남기고 sha 를 7자로 자른다", () => {
    const items = collectReleaseItems([
      { sha: "ddc7a88eb1234567890", subject: "feat(editor): 같은 변경" },
      { sha: "aaaaaaaaa1111111111", subject: "feat(editor): 같은 변경" },
      { sha: "bbbbbbbbb2222222222", subject: "fix: 다른 변경" },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ sha: "ddc7a88", section: "기능" });
    expect(items[1]).toMatchObject({ section: "수정" });
  });

  it("모르는 타입과 비규약 커밋은 기타로 간다", () => {
    const items = collectReleaseItems([
      { sha: "ccccccc3333333333333", subject: "wip: 실험" },
      { sha: "ddddddd4444444444444", subject: "그냥 메시지" },
    ]);
    expect(items.map((item) => item.section)).toEqual(["기타", "기타"]);
  });
});

describe("buildReleaseSections", () => {
  it("선언된 순서대로 묶고 빈 섹션은 만들지 않는다", () => {
    const items = collectReleaseItems([
      { sha: "1111111aaaaaaaaaaaaa", subject: "fix: 고침" },
      { sha: "2222222bbbbbbbbbbbbb", subject: "feat: 추가" },
    ]);
    const sections = buildReleaseSections(items);
    expect(sections.map((section) => section.title)).toEqual(["기능", "수정"]);
    expect(SECTION_TITLES.map(([, title]) => title)).toContain("기능");
  });

  it("깨지는 변경은 맨 앞 섹션으로도 세우고 원래 섹션에도 남긴다", () => {
    const items = collectReleaseItems([
      { sha: "1111111aaaaaaaaaaaaa", subject: "feat!: 저장 포맷 변경" },
      { sha: "2222222bbbbbbbbbbbbb", subject: "fix: 고침" },
    ]);
    const sections = buildReleaseSections(items);
    expect(sections[0].title).toBe("깨지는 변경");
    expect(sections[0].items).toHaveLength(1);
    expect(sections.find((section) => section.title === "기능")?.items).toHaveLength(1);
  });
});

describe("renderReleaseNotes", () => {
  const sections = buildReleaseSections(
    collectReleaseItems([{ sha: "1111111aaaaaaaaaaaaa", subject: "feat(editor): 목차를 고친다" }]),
  );

  it("버전 표제와 섹션 제목, sha 를 담는다", () => {
    const notes = renderReleaseNotes({ version: "0.2.0", date: "2026-09-16", sections });
    expect(notes.startsWith("## 0.2.0 — 2026-09-16")).toBe(true);
    expect(notes).toContain("### 기능");
    expect(notes).toContain("`1111111`");
  });

  it("사람이 쓴 표제가 있으면 본문 위에 붙는다", () => {
    const notes = renderReleaseNotes({ version: "0.2.0", date: "2026-09-16", summary: "로컬 저장 첫 배포", sections });
    expect(notes.split("\n")[2]).toBe("로컬 저장 첫 배포");
  });

  it("변경이 없으면 빈 문서 대신 그렇다고 말한다", () => {
    const notes = renderReleaseNotes({ version: "0.1.1", date: "2026-09-16", sections: [] });
    expect(notes).toContain("기록할 만한 변경이 없습니다.");
  });

  it("생략한 커밋이 있으면 밝힌다", () => {
    const notes = renderReleaseNotes({ version: "0.1.0", date: "2026-09-16", sections, omitted: 4100 });
    expect(notes).toContain("4100");
  });
});

describe("decideReleaseKind", () => {
  const commits = (subjects: readonly string[]) =>
    subjects.map((subject, index) => ({ sha: String(index).repeat(7).slice(0, 7), subject }));

  it("feat 와 깨지는 변경은 MINOR", () => {
    expect(decideReleaseKind(commits(["feat: 추가"]))).toBe("minor");
    expect(decideReleaseKind(commits(["fix!: 저장 포맷 교체"]))).toBe("minor");
  });

  it("고치는 것은 PATCH", () => {
    expect(decideReleaseKind(commits(["fix: 고침"]))).toBe("patch");
    expect(decideReleaseKind(commits(["refactor: 정리"]))).toBe("patch");
  });

  it("규약 밖 메시지도 PATCH 로 다 — 동작이 바뀌었을 수 있다", () => {
    expect(decideReleaseKind(commits(["그냥 메시지"]))).toBe("patch");
  });

  it("문서·테스트·잡무만 였으면 낼 릴리스가 없다", () => {
    expect(decideReleaseKind(commits(["docs: 문서", "chore: 잡무", "test: 테스트"]))).toBeNull();
  });

  it("머지만 있거나 커밋이 없으면 null", () => {
    expect(decideReleaseKind([])).toBeNull();
    expect(decideReleaseKind(commits(["Merge branch 'x' (#1)"]))).toBeNull();
  });
});

describe("changelogEntryFor", () => {
  const text = [
    "# 변경 기록",
    "",
    "<!-- releases -->",
    "",
    "## 0.2.0 — 2026-09-16",
    "",
    "### 기능",
    "",
    "- 새 기능",
    "",
    "## 0.1.0 — 2026-09-15",
    "",
    "- 옛 기능",
  ].join("\n");

  it("한 버전의 절만 낸다", () => {
    const entry = changelogEntryFor(text, "0.2.0");
    expect(entry).toContain("0.2.0");
    expect(entry).toContain("- 새 기능");
    expect(entry).not.toContain("0.1.0");
  });

  it("없는 버전이면 null", () => {
    expect(changelogEntryFor(text, "9.9.9")).toBeNull();
  });
});
