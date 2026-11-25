import { describe, expect, it, afterEach } from "vitest";
import { checkDesktopAssets, highestReleaseTag, requiredDesktopAssets, requiredUpdateAssets } from "../scripts/lib/releaseAssets.mjs";
import { appVersionLabel, parseDescribe } from "../scripts/lib/appVersion.mjs";
import { DEV_GROUP_TITLE, HIGHLIGHTS_TITLE, SECTION_TITLES, buildReleaseSections, bumpVersion, collectReleaseItems, decideReleaseKind, enrichReleaseItems, extractPrNumber, extractReleaseNotesFromPrBody, parseCommitSubject, pickHighlights, renderReleaseNotes } from "../scripts/lib/releaseNotes.mjs";
import { changelogEntryFor, ghReleaseCreateArgs, gitAnnotateTagArgs, writeReleaseNotesFile } from "../scripts/lib/releaseFiles.mjs";
import { decideAutoRelease, diffFailedFiles, layerBaselines, runCompleteness, selectUserFacingCommits, summarizeShardReports } from "../scripts/lib/releaseGate.mjs";
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertNoUpdateEnvInCI, assertSurfaceGate, type FloorMetrics } from "./surfaceGateSupport";
import { isolateTimers } from "./mergedTeardown";

// test/releaseAssets.test.ts
// 릴리스 자산 계약 — «자산이 0개인 릴리스가 latest 가 되던» 사고(v0.408.0, 2026-11-07)의
// 판정을 순수 함수로 고정한다. 이 검사가 느슨해지면 순서를 뒤집어도 워크플로가 발행해 버린다.
describe("releaseAssets", () => {
  isolateTimers();
  const full = (version: string, size = 1_100_000_000) =>
    requiredDesktopAssets(version).map((name) => ({ name, size }));
  describe("requiredDesktopAssets", () => {
    it("README 가 버전 없이 부르는 이름 3개와 버전 이름 3개를 요구한다 — 윈도우는 설치판과 portable", () => {
      expect(requiredDesktopAssets("0.408.0")).toEqual([
        "OPRN.Studio-windows-setup.exe",
        "OPRN.Studio-windows.exe",
        "OPRN.Studio-linux.AppImage",
        "OPRN.Studio-Setup-0.408.0.exe",
        "OPRN.Studio.0.408.0.exe",
        "OPRN.Studio-0.408.0.AppImage",
      ]);
    });

    it("설치판이 빠진 릴리스(v0.418.0 까지의 portable 만)는 불통과 — README 기본 단추가 404 가 된다", () => {
      const assets = ["OPRN.Studio-windows.exe", "OPRN.Studio-linux.AppImage", "OPRN.Studio.0.418.0.exe", "OPRN.Studio-0.418.0.AppImage"].map(
        (name) => ({ name, size: 1_000_000_000 }),
      );
      expect(checkDesktopAssets("0.418.0", assets)).toEqual({ ok: false, missing: ["OPRN.Studio-windows-setup.exe", "OPRN.Studio-Setup-0.418.0.exe"], empty: [] });
    });

    it("윈도우 zip 은 요구하지 않는다 — zip 없이 exe·AppImage 만 있는 릴리스가 통과해야 한다", () => {
      const assets = ["OPRN.Studio-windows-setup.exe", "OPRN.Studio-windows.exe", "OPRN.Studio-linux.AppImage", "OPRN.Studio-Setup-0.417.0.exe", "OPRN.Studio.0.417.0.exe", "OPRN.Studio-0.417.0.AppImage"].map(
        (name) => ({ name, size: 1_000_000_000 }),
      );
      expect(checkDesktopAssets("0.417.0", assets)).toEqual({ ok: true, missing: [], empty: [] });
    });

    it("v 접두어를 받아들인다", () => {
      expect(requiredDesktopAssets("v0.408.0")).toEqual(requiredDesktopAssets("0.408.0"));
    });

    it("X.Y.Z 가 아니면 던진다 — 잘못된 이름으로 검사하지 않게", () => {
      expect(() => requiredDesktopAssets("0.408")).toThrow(/X\.Y\.Z/);
      expect(() => requiredDesktopAssets("")).toThrow(/X\.Y\.Z/);
    });
  });
  describe("checkDesktopAssets", () => {
    it("자산이 0개인 릴리스는 불통과 — 이것이 v0.408.0 이 latest 가 된 상태다", () => {
      const result = checkDesktopAssets("0.408.0", []);
      expect(result.ok).toBe(false);
      expect(result.missing).toHaveLength(6);
      expect(result.empty).toEqual([]);
    });

    it("이름이 다 맞고 크기가 있으면 통과", () => {
      expect(checkDesktopAssets("0.408.0", full("0.408.0"))).toEqual({ ok: true, missing: [], empty: [] });
    });

    it("크기 0 인 자산(업로드 미완료·starter)은 불통과", () => {
      const assets = full("0.408.0");
      // #4970 부터 목록 맨 앞은 설치판이다 — 자리로 덮지 말고 portable exe 를 이름으로 찾아 크기만 0 으로.
      const portable = assets.findIndex((asset) => asset.name === "OPRN.Studio-windows.exe");
      assets[portable] = { name: "OPRN.Studio-windows.exe", size: 0, state: "starter" };
      const result = checkDesktopAssets("0.408.0", assets);
      expect(result.ok).toBe(false);
      expect(result.missing).toEqual([]);
      expect(result.empty).toEqual(["OPRN.Studio-windows.exe"]);
    });

    it("하나만 빠져도 불통과하고 그 이름을 지목한다", () => {
      const assets = full("0.408.0").filter((asset) => asset.name !== "OPRN.Studio-linux.AppImage");
      const result = checkDesktopAssets("0.408.0", assets);
      expect(result.ok).toBe(false);
      expect(result.missing).toEqual(["OPRN.Studio-linux.AppImage"]);
    });

    it("옛 버전 이름만 있으면(다른 릴리스 자산) 이 버전은 불통과", () => {
      const result = checkDesktopAssets("0.408.0", full("0.407.0"));
      expect(result.ok).toBe(false);
      expect(result.missing).toHaveLength(3);
    });
  });
  describe("highestReleaseTag", () => {
    it("숫자 세 자리로 비교한다 — v0.9.0 < v0.10.0", () => {
      expect(highestReleaseTag(["v0.9.0", "v0.10.0", "v0.408.0"])).toBe("v0.408.0");
      expect(highestReleaseTag(["v0.9.0", "v0.10.0"])).toBe("v0.10.0");
    });

    it("릴리스 태그가 아니면 건너뛴다", () => {
      expect(highestReleaseTag(["nightly", "v0.1.0-rc1", "v0.2.0"])).toBe("v0.2.0");
    });

    it("하나도 없으면 null — 이때는 latest 를 건드리지 않는다", () => {
      expect(highestReleaseTag([])).toBeNull();
    });
  });
  describe("requiredUpdateAssets", () => {
    it("0.420.0 부터 latest.yml·latest-linux.yml·설치판 blockmap 이 있어야 발행한다 — 없으면 설치된 앱이 새 판을 못 찾는다", () => {
      expect(requiredUpdateAssets("v0.420.0")).toEqual(["latest.yml", "latest-linux.yml", "OPRN.Studio-Setup-0.420.0.exe.blockmap"]);
      const withoutFeed = requiredDesktopAssets("0.420.0").map((name) => ({ name, size: 1_000_000_000 }));
      expect(checkDesktopAssets("0.420.0", withoutFeed)).toEqual({ ok: false, missing: requiredUpdateAssets("0.420.0"), empty: [] });
      const withFeed = [...withoutFeed, ...requiredUpdateAssets("0.420.0").map((name) => ({ name, size: 900 }))];
      expect(checkDesktopAssets("0.420.0", withFeed).ok).toBe(true);
    });

    it("그 전 판은 요구하지 않는다 — 옛 초안을 다시 채울 때 만들 수 없는 파일로 영영 걸리지 않게", () => {
      expect(requiredUpdateAssets("0.419.0")).toEqual([]);
      expect(checkDesktopAssets("0.419.0", requiredDesktopAssets("0.419.0").map((name) => ({ name, size: 1 }))).ok).toBe(true);
    });
  });
});

// test/releaseTooling.test.ts
// 릴리스 도구의 순수 계산을 케이스로 직접 고정한다(저장소 이력에 의존하지 않는다).
describe("releaseTooling", () => {
  isolateTimers();
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

    it("사람이 쓴 표제가 있으면 주요 변경을 덮어쓰고 기능 절보다 앞에 둔다", () => {
      const notes = renderReleaseNotes({ version: "0.2.0", date: "2026-09-16", summary: "로컬 저장 첫 배포", sections });
      expect(notes).toContain(`### ${HIGHLIGHTS_TITLE}`);
      expect(notes).toContain("로컬 저장 첫 배포");
      expect(notes.indexOf("로컬 저장 첫 배포")).toBeLessThan(notes.indexOf("### 기능"));
      expect(notes).not.toMatch(/### 주요 변경\n\n- /);
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
  describe("pickHighlights and richer notes layout", () => {
    const commits = (subjects: readonly string[]) =>
      subjects.map((subject, index) => ({ sha: `${String(index + 1).padStart(7, "0")}`, subject }));

    it("feat/fix/perf 만 고르고 깨지는 변경·feat 를 앞에, 최대 5개를 남긴다", () => {
      const items = collectReleaseItems(
        commits([
          "fix: 오래된 수정 (#10)",
          "feat: 다섯째 기능",
          "feat: 넷째 기능",
          "chore: 잡무는 빼기",
          "docs: 문서도 빼기",
          "feat!: 깨지는 기능 (#7)",
          "perf: 성능",
          "feat: 둘째 기능",
          "fix: 첫째 수정 (#11)",
          "feat: 첫째 기능 (#9)",
        ]),
      );
      const picked = pickHighlights(items);
      expect(picked).toHaveLength(5);
      expect(picked[0]).toMatchObject({ breaking: true, summary: "깨지는 기능 (#7)" });
      expect(picked.slice(1).map((item) => item.type)).toEqual(["feat", "feat", "feat", "feat"]);
      expect(picked.map((item) => item.summary)).toContain("첫째 기능 (#9)");
      expect(picked.some((item) => item.type === "fix" || item.section === "잡무")).toBe(false);
    });

    it("사용자 섹션을 앞에 두고 내부 섹션은 개발 안에 접는다", () => {
      const sections = buildReleaseSections(
        collectReleaseItems(
          commits(["feat: 기능 하나", "fix: 수정 하나", "chore: 잡무 하나", "test: 테스트 하나", "docs: 문서 하나"]),
        ),
      );
      const notes = renderReleaseNotes({ version: "0.3.0", date: "2026-11-19", sections });
      expect(notes.startsWith("## 0.3.0 — 2026-11-19")).toBe(true);
      expect(notes).toContain(`### ${HIGHLIGHTS_TITLE}`);
      expect(notes.indexOf("### 기능")).toBeLessThan(notes.indexOf("### 수정"));
      expect(notes.indexOf("### 수정")).toBeLessThan(notes.indexOf("<details>"));
      expect(notes).toContain(`<summary>${DEV_GROUP_TITLE}</summary>`);
      expect(notes).toContain("### 잡무");
      expect(notes).toContain("### 테스트");
      expect(notes).toContain("### 문서");
      expect(notes.indexOf("<details>")).toBeLessThan(notes.indexOf("### 잡무"));
      expect(notes).toContain("</details>");
      expect(notes).not.toContain("### 잡무\n\n- 잡무 하나\n\n### 기능");
    });

    it("내부 항목이 없으면 개발 접기를 만들지 않는다", () => {
      const sections = buildReleaseSections(collectReleaseItems(commits(["feat: 기능만"])));
      const notes = renderReleaseNotes({ version: "0.3.1", date: "2026-11-19", sections });
      expect(notes).not.toContain("<details>");
      expect(notes).not.toContain(`<summary>${DEV_GROUP_TITLE}</summary>`);
    });
  });
  describe("extractPrNumber and PR release notes", () => {
    it("스쿼시 머지의 (#123) 를 읽고 맨 끝 #123 도 허용한다", () => {
      expect(extractPrNumber("feat(editor): 메뉴를 고친다 (#4772)")).toBe(4772);
      expect(extractPrNumber("메뉴를 고친다 #90")).toBe(90);
      expect(extractPrNumber("feat: 번호 없음")).toBeNull();
    });

    it("PR 본문의 릴리스 노트 절에서 첫 줄을 꺼낸다", () => {
      expect(
        extractReleaseNotesFromPrBody(
          ["## 요약", "내부 설명", "", "## 릴리스 노트", "", "- 맵 우클릭 메뉴 글자가 잘리지 않습니다.", "", "## 테스트", "생략"].join("\n"),
        ),
      ).toBe("맵 우클릭 메뉴 글자가 잘리지 않습니다.");
      expect(extractReleaseNotesFromPrBody("### Release notes\n\n이벤트 생성이 영어에서 Create event 로 바뀝니다.")).toBe(
        "이벤트 생성이 영어에서 Create event 로 바뀝니다.",
      );
      expect(extractReleaseNotesFromPrBody("**Release notes:** 한 줄로 적는다.")).toBe("한 줄로 적는다.");
      expect(extractReleaseNotesFromPrBody("## 설명\n본문만 있음")).toBeNull();
      expect(extractReleaseNotesFromPrBody("## 릴리스 노트\n\n")).toBeNull();
    });

    it("enrich 는 노트가 있으면 쓰고, gh 실패·빈 절은 제목으로 남긴다", () => {
      const items = collectReleaseItems([
        { sha: "1111111aaaaaaaa", subject: "feat: 메뉴 수정 (#12)" },
        { sha: "2222222bbbbbbbb", subject: "fix: 다른 수정 (#13)" },
        { sha: "3333333cccccccc", subject: "feat: 번호 없는 기능" },
      ]);
      const bodies: Record<number, string | Error> = {
        12: "## 릴리스 노트\n\n우클릭 메뉴 글자가 전부 보입니다.",
        13: new Error("API down"),
      };
      const enriched = enrichReleaseItems(items, (number) => {
        const value = bodies[number];
        if (value instanceof Error) throw value;
        return value ?? null;
      });
      expect(enriched[0]?.note).toBe("우클릭 메뉴 글자가 전부 보입니다.");
      expect(enriched[1]?.note).toBeUndefined();
      expect(enriched[2]?.note).toBeUndefined();
      const notes = renderReleaseNotes({
        version: "0.4.0",
        date: "2026-11-19",
        sections: buildReleaseSections(enriched),
      });
      expect(notes).toContain("우클릭 메뉴 글자가 전부 보입니다. (#12)");
      expect(notes).toContain("다른 수정 (#13)");
      expect(notes).toContain("번호 없는 기능");
    });

    it("fetchPrBody 가 없으면 항목을 그대로 둔다", () => {
      const items = collectReleaseItems([{ sha: "1111111aaaaaaaa", subject: "feat: 메뉴 수정 (#12)" }]);
      const enriched = enrichReleaseItems(items);
      expect(enriched[0]?.note).toBeUndefined();
      expect(enriched[0]?.prNumber).toBe(12);
    });
  });
  describe("git tag and gh release note files", () => {
    it("주석 글자를 # 가 아닌 값으로 두고 --notes-file 을 쓴다", () => {
      expect(gitAnnotateTagArgs("v0.4.0", "/tmp/notes.md", "abc")).toEqual([
        "-c",
        "core.commentChar=;",
        "tag",
        "-a",
        "v0.4.0",
        "-F",
        "/tmp/notes.md",
        "abc",
      ]);
      expect(ghReleaseCreateArgs("v0.4.0", "/tmp/notes.md", { draft: true })).toEqual([
        "release",
        "create",
        "v0.4.0",
        "--title",
        "v0.4.0",
        "--notes-file",
        "/tmp/notes.md",
        "--draft",
      ]);
    });

    it("노트 파일은 ##/### 제목 줄을 그대로 두고 끝 줄바꿈을 붙인다", () => {
      const dir = mkdtempSync(join(tmpdir(), "oprn-notes-"));
      try {
        const path = join(dir, "notes.md");
        const body = "## 0.4.0 — 2026-11-19\n\n### 기능\n\n- 항목\n";
        writeReleaseNotesFile(path, body.trimEnd());
        expect(readFileSync(path, "utf8")).toBe(body);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
  describe("조건 기반 자동 릴리스 판정 (releaseGate)", () => {
    it("사용자 체감 변경은 feat·fix 만, 시험·CI 범위는 빼고 센다", () => {
      const picked = selectUserFacingCommits([
        { sha: "a", subject: "feat(database): 자료집 머리줄" },
        { sha: "b", subject: "fix: 저장 오류" },
        { sha: "c", subject: "fix(test): 기대값" },
        { sha: "d", subject: "ci(full): 밤 1회" },
        { sha: "e", subject: "perf(test): 픽스처" },
        { sha: "f", subject: "chore(release): v0.419.0" },
        { sha: "g", subject: "feat(editor)!: 깨지는 변경" },
      ]);
      expect(picked.map((commit) => commit.sha)).toEqual(["a", "b", "g"]);
    });

    it("플레이크(단독 재실행 통과)는 실패에서 빠지고, 기준 판에서 통과한 파일의 실패만 새 실패다", () => {
      const candidate = summarizeShardReports([
        { tests: { failedFiles: ["test/a.test.ts", "test/flaky.test.ts"], testFiles: ["test/a.test.ts", "test/b.test.ts", "test/flaky.test.ts"] }, flakeRetries: ["test/flaky.test.ts"] },
        { tests: { failedFiles: ["test/old.test.ts", "test/brandnew.test.ts"], testFiles: ["test/old.test.ts", "test/brandnew.test.ts", "test/fixed.test.ts"] } },
      ]);
      const baseline = summarizeShardReports([
        { tests: { failedFiles: ["test/old.test.ts", "test/fixed.test.ts"], testFiles: ["test/a.test.ts", "test/b.test.ts", "test/old.test.ts", "test/fixed.test.ts", "test/flaky.test.ts"] } },
      ]);
      expect(diffFailedFiles(candidate, baseline)).toEqual({
        ok: false,
        newFailures: ["test/a.test.ts"],
        notInBaseline: ["test/brandnew.test.ts"],
        stillFailing: ["test/old.test.ts"],
        fixed: ["test/fixed.test.ts"],
      });
    });

    it("가장 새 기준 판이 파일을 돌렸으면 그 결과를, 빠진 샤드의 파일만 앞 판에서 채운다", () => {
      const newest = { failedFiles: ["test/x.test.ts"], ranFiles: ["test/x.test.ts", "test/y.test.ts"] };
      const older = { failedFiles: ["test/y.test.ts", "test/z.test.ts"], ranFiles: ["test/x.test.ts", "test/y.test.ts", "test/z.test.ts"] };
      expect(layerBaselines([newest, older])).toEqual({
        failedFiles: ["test/x.test.ts", "test/z.test.ts"],
        ranFiles: ["test/x.test.ts", "test/y.test.ts", "test/z.test.ts"],
      });
    });

    it("샤드 잡이 취소됐거나 리포트가 빠지면 불완전한 판이다", () => {
      const jobs = [{ name: "tests (1)", conclusion: "failure" }, { name: "tests (2)", conclusion: "success" }];
      expect(runCompleteness({ testJobs: jobs, reportCount: 2 }).complete).toBe(true);
      expect(runCompleteness({ testJobs: jobs, reportCount: 1 }).complete).toBe(false);
      expect(runCompleteness({ testJobs: [jobs[0], { name: "tests (2)", conclusion: "cancelled" }], reportCount: 2 }).complete).toBe(false);
    });

    const passing = () => ({
      userCommits: Array.from({ length: 5 }, (_, index) => ({ sha: String(index), subject: "feat: x" })),
      sinceTag: "v0.419.0",
      ciDiff: { ok: true, newFailures: [], notInBaseline: [] },
      lastPublishedAt: "2026-11-24T00:00:00Z",
      recentReleaseTags: ["v0.419.0"],
      holdPrs: [],
      draftTags: [],
      openReleasePr: null,
      now: "2026-11-24T12:00:00Z",
    });

    it("네 조건과 하루 상한이 다 맞으면 발행한다(12시간 경계 포함)", () => {
      const decision = decideAutoRelease(passing());
      expect(decision.release).toBe(true);
      expect(decision.reasons).toEqual([]);
    });

    it("하나라도 안 맞으면 넘어가고 안 맞는 것마다 이유를 남긴다", () => {
      const cases = [
        [{ userCommits: passing().userCommits.slice(0, 4) }, "user-commits"],
        [{ ciDiff: { ok: false, newFailures: ["test/a.test.ts"], notInBaseline: [] } }, "ci-full"],
        [{ ciDiff: { ok: false, error: "판 없음" } }, "ci-full"],
        [{ ciDiff: null }, "ci-full"],
        [{ now: "2026-11-24T11:59:00Z" }, "since-publish"],
        [{ holdPrs: [{ number: 5040 }] }, "hold-label"],
        [{ recentReleaseTags: ["v0.418.0", "v0.419.0"] }, "daily-cap"],
        [{ draftTags: ["v0.420.0"] }, "no-draft"],
        [{ openReleasePr: { number: 5041, auto: true } }, "no-open-release-pr"],
      ];
      for (const [override, id] of cases) {
        const decision = decideAutoRelease({ ...passing(), ...override });
        expect(decision.release).toBe(false);
        expect(decision.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([id]);
        expect(decision.reasons).toHaveLength(1);
      }
    });
  });
});

// test/surfaceGateSupport.test.ts
//
// 표면 게이트의 **공용 계약 자체**를 검증한다. 축(폼/M2/셸/커밋/조건/포털/상호작용)이 전부
// 이 파일 하나에 의존하므로, 여기의 안전장치가 조용히 죽으면 축 전부가 동시에 초록 거짓말을
// 하게 된다. 그리고 그 죽음은 축 테스트로는 안 보인다 — 축은 "기준선과 같다"만 확인하고,
// 안전장치는 "기준선이 부당하게 갱신되는 경로"를 막는 코드라서 정상 실행에서는 한 줄도 안 돈다.
//
// 검증 대상 4가지 (전부 실측된 함정에 대응):
//   1. CI 에서 갱신 환경변수 금지 — 켜져 있으면 즉시 throw.
//   2. 하한선 파일 생성은 통과가 아니다 — 만들되 실패시킨다.
//   3. 열화한 하한선을 쓰지 않는다 — 총합 0(축 크래시) / 기존의 10% 미만(대량 열화)이면
//      파일을 **쓰지 않고** 실패시킨다. 셸 축에서 실제로 하한선이 크래시한 실행 중에 생겼다.
//   4. diff 예외가 하한선 단정을 넘어 던져지지 않는다 — 구 스키마 기준선에서 diff 가 TypeError 로
//      죽으면 하한선 신호가 무관한 크래시에 묻힌다(실측).
describe("surfaceGateSupport", () => {
  isolateTimers();
  /** 이 테스트가 만드는 임시 디렉터리들 — afterEach 에서 전부 지운다. */
  const tempDirs: string[] = [];
  /** it.fails 테스트에서 빼낸 디스크 상태. 다음 테스트가 단정한다(soft 실패는 잡을 수 없다). */
  let updateModeDisk: { baseline: unknown; floorExists: boolean } | null = null;
  function tempPaths(): { baseline: string; floor: string } {
    const dir = mkdtempSync(join(tmpdir(), "surface-gate-support-"));
    tempDirs.push(dir);
    return { baseline: join(dir, "baseline.json"), floor: join(dir, "floor.json") };
  }
  /**
   * 환경변수를 세팅하고 콜백을 돌린 뒤 무조건 원복한다.
   * `undefined` 를 주면 삭제한다(CI 를 지워야 하는 케이스가 있다).
   */
  function withEnv<T>(vars: Record<string, string | undefined>, run: () => T): T {
    const saved = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(vars)) {
      saved.set(key, process.env[key]);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    try {
      return run();
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }
  /** 단정 실패 메시지를 문자열로 회수한다. 통과하면 그것 자체가 테스트 실패다. */
  function failureMessage(run: () => void): string {
    try {
      run();
    } catch (error) {
      return (error as Error)?.message ?? String(error);
    }
    throw new Error("실패해야 하는 호출이 통과했다 — 안전장치가 죽었다");
  }
  type Surface = { count: number };
  const metrics = (surface: Surface): FloorMetrics => ({ count: surface.count });
  const diffCount = (_key: string, before: Surface, after: Surface): string[] =>
    before.count === after.count ? [] : [`count ${before.count} → ${after.count}`];
  afterEach(() => {
    while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
  });
  describe("표면 게이트 공용 계약", () => {
    it("CI 에서 갱신 환경변수가 켜져 있으면 즉시 실패한다", () => {
      // CI 가 기준선을 다시 쓰면 래칫이 사라진다 — 그 경로를 원천 차단하는 가드.
      const message = withEnv({ CI: "1", FORM_SURFACE_UPDATE: "1" }, () =>
        failureMessage(() => assertNoUpdateEnvInCI())
      );
      expect(message).toContain("FORM_SURFACE_UPDATE");

      // 반대 방향: CI 가 아니면 갱신 모드는 정상 경로다(가드가 과잉 차단하지 않는다).
      withEnv({ CI: undefined, FORM_SURFACE_UPDATE: "1" }, () => {
        expect(() => assertNoUpdateEnvInCI()).not.toThrow();
      });
    });

    it("하한선 파일 생성은 통과가 아니다 — 만들고 나서 실패시킨다", () => {
      const { baseline, floor } = tempPaths();
      const message = withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () =>
        failureMessage(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            actual: { alpha: { count: 7 } },
            diff: diffCount,
            metrics,
          })
        )
      );
      expect(message).toContain("하한선 파일을 생성했다");
      // 파일은 실제로 생겼고(다음 실행의 하한선이 된다), 이번 실행은 빨갛다.
      expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual({ alpha: { count: 7 } });
    });

    it("지표 총합이 0이면 하한선을 쓰지 않는다 — 축 크래시를 하한선으로 굳히지 않는다", () => {
      const { baseline, floor } = tempPaths();
      const message = withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () =>
        failureMessage(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            actual: { alpha: { count: 0 }, beta: { count: 0 } },
            diff: diffCount,
            metrics,
          })
        )
      );
      expect(message).toContain("지표 총합이 0이다");
      // 핵심: 0 하한선이 파일로 굳지 않았다. 굳었다면 그 뒤로는 무엇을 잃어도 통과한다.
      expect(existsSync(floor)).toBe(false);
    });

    it("개별 0 은 정상이다 — 다른 항목이 살아 있으면 하한선을 쓴다", () => {
      // breakLoop 처럼 controlCount 가 0인 kind 는 실재한다. 총합 0 만 크래시로 본다.
      const { baseline, floor } = tempPaths();
      withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () =>
        failureMessage(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            actual: { alpha: { count: 0 }, beta: { count: 4 } },
            diff: diffCount,
            metrics,
          })
        )
      );
      expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual({ alpha: { count: 0 }, beta: { count: 4 } });
    });

    it("기존 하한선의 10% 미만으로 떨어지면 갱신 모드에서도 덮어쓰지 않는다", () => {
      const { baseline, floor } = tempPaths();
      const before = { alpha: { count: 100 } };
      writeFileSync(floor, `${JSON.stringify(before)}\n`);

      // SURFACE_FLOOR_UPDATE=1 은 CI 금지 대상이므로 CI 를 지워야 이 경로에 도달한다.
      const message = withEnv(
        { CI: undefined, SURFACE_FLOOR_UPDATE: "1", TEST_AXIS_UPDATE: undefined },
        () =>
          failureMessage(() =>
            assertSurfaceGate({
              axis: "테스트축",
              baselinePath: baseline,
              floorPath: floor,
              updateEnv: "TEST_AXIS_UPDATE",
              actual: { alpha: { count: 5 } },
              diff: diffCount,
              metrics,
            })
          )
      );
      expect(message).toContain("100 → 5");
      // 기존 하한선이 그대로 남아 있다 — 대량 열화가 하한선을 삼키지 못했다.
      expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual(before);
    });

    // ── 개별 하한선 하락 차단 (실측된 구멍) ─────────────────────────────────────────────
    // 갱신 모드는 항목별 비교보다 먼저 쓰기 분기를 타서 가드가 "총합 0"과 "총합 10% 미만"
    // 둘뿐이었다. 지표 하나가 1 → 0 으로 내려가는 것은 두 가드를 모두 통과한다.
    // 실제로 커밋 프로브 축에서 commitCount 가 4종에서 1 → 0, playMovie 에서 3 → 2 로 조용히
    // 낮아졌고, 그 4종이 바로 그때 결함을 잡고 있던 항목이었다.
    it("갱신 모드가 개별 하한선을 1 → 0 으로 낮추지 못한다 — 총합 가드를 통과하는 소규모 열화", () => {
      const { baseline, floor } = tempPaths();
      // 총합 101 → 100: 0도 아니고 10% 미만도 아니다. 예전 가드는 여기서 파일을 썼다.
      const before = { alpha: { commitCount: 1, probeCount: 100 } };
      writeFileSync(floor, `${JSON.stringify(before)}\n`);

      const message = withEnv(
        { CI: undefined, SURFACE_FLOOR_UPDATE: "1", TEST_AXIS_UPDATE: undefined },
        () =>
          failureMessage(() =>
            assertSurfaceGate({
              axis: "테스트축",
              baselinePath: baseline,
              floorPath: floor,
              updateEnv: "TEST_AXIS_UPDATE",
              actual: { alpha: { commitCount: 0, probeCount: 100 } },
              diff: () => [],
              metrics: (surface: { commitCount: number; probeCount: number }) => ({ ...surface }),
            })
          )
      );
      expect(message, "무엇이 내려가는지 지목하지 않는다").toContain("하한선 하락: alpha.commitCount 1 → 0");
      expect(message).toContain("개별 하한선 1건이 내려간다");
      // 핵심: 하한선 파일이 그대로다. 갈렸다면 그 뒤로는 commitCount 0 이 영구 합법이 된다.
      expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual(before);
    });

    it("내려가는 지표를 항목·지표 단위로 **전부** 열거한다 — 하나만 말하고 끝내지 않는다", () => {
      const { baseline, floor } = tempPaths();
      writeFileSync(
        floor,
        `${JSON.stringify({
        alpha: { commitCount: 1, probeCount: 1 },
        beta: { commitCount: 3 },
        gamma: { commitCount: 5 },
      })}\n`
      );
      const message = withEnv(
        { CI: undefined, SURFACE_FLOOR_UPDATE: "1", TEST_AXIS_UPDATE: undefined },
        () =>
          failureMessage(() =>
            assertSurfaceGate({
              axis: "테스트축",
              baselinePath: baseline,
              floorPath: floor,
              updateEnv: "TEST_AXIS_UPDATE",
              // alpha.commitCount 하락 + beta 하락 + gamma 는 상승(보고에 없어야 한다).
              actual: {
                alpha: { commitCount: 0, probeCount: 1 },
                beta: { commitCount: 2 },
                gamma: { commitCount: 9 },
              },
              diff: () => [],
              metrics: (surface: Record<string, number>) => ({ ...surface }),
            })
          )
      );
      expect(message).toContain("하한선 하락: alpha.commitCount 1 → 0");
      expect(message).toContain("하한선 하락: beta.commitCount 3 → 2");
      expect(message, "오르는 지표를 하락으로 오보한다").not.toContain("gamma");
      expect(message).toContain("개별 하한선 2건이 내려간다");
    });

    it("항목이 통째로 사라지는 갱신도 거부한다 — 그 항목의 하한선 전부가 지워진다", () => {
      const { baseline, floor } = tempPaths();
      const before = { alpha: { count: 4 }, beta: { count: 4 } };
      writeFileSync(floor, `${JSON.stringify(before)}\n`);
      const message = withEnv(
        { CI: undefined, SURFACE_FLOOR_UPDATE: "1", TEST_AXIS_UPDATE: undefined },
        () =>
          failureMessage(() =>
            assertSurfaceGate({
              axis: "테스트축",
              baselinePath: baseline,
              floorPath: floor,
              updateEnv: "TEST_AXIS_UPDATE",
              actual: { alpha: { count: 4 } },
              diff: diffCount,
              metrics,
            })
          )
      );
      expect(message).toContain("beta — 항목이 축에서 사라져 하한선이 통째로 지워진다 (count=4)");
      expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual(before);
    });

    it("전부 오르거나 같으면 갱신을 그대로 통과시킨다 — 하락 가드가 상승을 막지 않는다", () => {
      // 과잉 차단 검증. 이게 없으면 "하락 차단"이 하한선 인상 자체를 막는지 알 수 없다.
      const { baseline, floor } = tempPaths();
      writeFileSync(floor, `${JSON.stringify({ alpha: { count: 4 }, beta: { count: 4 } })}\n`);
      const message = withEnv(
        { CI: undefined, SURFACE_FLOOR_UPDATE: "1", TEST_AXIS_UPDATE: undefined },
        () =>
          failureMessage(() =>
            assertSurfaceGate({
              axis: "테스트축",
              baselinePath: baseline,
              floorPath: floor,
              updateEnv: "TEST_AXIS_UPDATE",
              // 하나는 오르고 하나는 그대로 + 새 항목까지. 전부 허용이다.
              actual: { alpha: { count: 9 }, beta: { count: 4 }, gamma: { count: 1 } },
              diff: diffCount,
              metrics,
            })
          )
      );
      // 갱신 자체는 설계상 "리뷰 요청"이라 빨갛지만, 하한선 파일은 실제로 갈려 있어야 한다.
      expect(message).toContain("하한선 파일을 갱신했다");
      expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual({
        alpha: { count: 9 },
        beta: { count: 4 },
        gamma: { count: 1 },
      });
    });

    it("하한선 파일이 없으면 하락 판정 대상이 없다 — 첫 생성은 개별 0 을 허용한다", () => {
      // 부트스트랩 경로를 하락 가드가 삼키면 새 축을 만들 수 없다(비교할 이전 값이 없다).
      const { baseline, floor } = tempPaths();
      withEnv({ CI: undefined, SURFACE_FLOOR_UPDATE: "1", TEST_AXIS_UPDATE: undefined }, () =>
        failureMessage(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            actual: { alpha: { count: 0 }, beta: { count: 7 } },
            diff: diffCount,
            metrics,
          })
        )
      );
      expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual({ alpha: { count: 0 }, beta: { count: 7 } });
    });

    it("하한선 위반 메시지가 기준선 diff 도 함께 싣는다 — 개수만 말하고 끝내지 않는다", () => {
      // 실측된 결함: 하한선 단정이 먼저 던져서 사람이 «classCount 30 < 31» 만 보고 무엇이
      // 줄었는지는 못 봤다(소스 변이 감사에서 "빨갛지만 무언"으로 잡혔다).
      const { baseline, floor } = tempPaths();
      writeFileSync(floor, `${JSON.stringify({ alpha: { count: 10 } })}\n`);
      writeFileSync(baseline, `${JSON.stringify({ alpha: { count: 10 } })}\n`);
      const message = withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () =>
        failureMessage(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            actual: { alpha: { count: 2 } },
            diff: diffCount,
            metrics,
          })
        )
      );
      expect(message).toContain("하한선 미달: alpha.count 2 < 10");
      expect(message, "표면 변화(원인)가 메시지에 없다").toContain("count 10 → 2");
      expect(message).toContain("함께 관측된 표면 변화");
    });

    it("diff 가 예외로 죽어도 하한선 단정에 도달한다 — 신호가 크래시에 묻히지 않는다", () => {
      const { baseline, floor } = tempPaths();
      // 하한선은 만족시켜 두고(위반 0), diff 만 터뜨려서 어디서 멈추는지 본다.
      writeFileSync(floor, `${JSON.stringify({ alpha: { count: 1 } })}\n`);
      writeFileSync(baseline, `${JSON.stringify({ alpha: { count: 3 } })}\n`);

      const message = withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () =>
        failureMessage(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            actual: { alpha: { count: 3 } },
            diff: () => {
              throw new TypeError("Cannot read properties of undefined (reading 'testids')");
            },
            metrics,
          })
        )
      );
      // 원시 TypeError 가 아니라 축 리포트로 잡혔다.
      expect(message).toContain("diff 계산이 예외로 죽었다");
      expect(message).toContain("TEST_AXIS_UPDATE=1");
      expect(message).toContain("표면이 기준선과 다르다");
    });

    it("하한선 위반이면 갱신 모드가 기준선 파일을 건드리지 않는다", () => {
      // 실측된 순서 결함의 회귀 테스트: 예전에는 기준선을 먼저 쓰고 하한선을 단정했다.
      // 테스트는 빨갰지만 디스크의 기준선은 이미 열화 표면으로 갈려 있었다.
      const { baseline, floor } = tempPaths();
      writeFileSync(floor, `${JSON.stringify({ alpha: { count: 10 } })}\n`);
      writeFileSync(baseline, `${JSON.stringify({ alpha: { count: 10 } })}\n`);

      const message = withEnv({ CI: undefined, TEST_AXIS_UPDATE: "1" }, () =>
        failureMessage(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            actual: { alpha: { count: 2 } },
            diff: diffCount,
            metrics,
          })
        )
      );
      expect(message).toContain("하한선 위반은 기준선 갱신으로 덮을 수 없다");
      expect(message).toContain("하한선 미달: alpha.count 2 < 10");
      expect(JSON.parse(readFileSync(baseline, "utf8"))).toEqual({ alpha: { count: 10 } });
    });

    // 갱신 모드의 정상 경로는 **설계상 실패**한다(soft 빨강 = 리뷰 요청). soft 실패는 try/catch 로
    // 잡을 수 없어서 it.fails 로 감싸고, 디스크 상태는 모듈 변수로 빼내 다음 테스트에서 단정한다.
    // 그렇게 하지 않으면 "위반 차단"이 정상 갱신까지 막는지(과잉 차단) 증명할 수 없다.
    it.fails("갱신 모드는 하한선이 건강하면 기준선을 쓰고, 그래도 실패한다", () => {
      const { baseline, floor } = tempPaths();
      writeFileSync(floor, `${JSON.stringify({ alpha: { count: 1 } })}\n`);
      writeFileSync(baseline, `${JSON.stringify({ alpha: { count: 3 } })}\n`);
      withEnv({ CI: undefined, TEST_AXIS_UPDATE: "1" }, () => {
        assertSurfaceGate({
          axis: "테스트축",
          baselinePath: baseline,
          floorPath: floor,
          updateEnv: "TEST_AXIS_UPDATE",
          actual: { alpha: { count: 5 } },
          diff: diffCount,
          metrics,
        });
      });
      updateModeDisk = {
        baseline: JSON.parse(readFileSync(baseline, "utf8")),
        floorExists: existsSync(floor),
      };
    });

    it("직전 갱신 실행이 기준선을 실제로 갈아 놓았다 — 위반 차단이 정상 갱신을 막지 않는다", () => {
      expect(updateModeDisk, "갱신 모드 테스트가 디스크 상태를 남기지 못했다").not.toBeNull();
      expect(updateModeDisk!.baseline).toEqual({ alpha: { count: 5 } });
      expect(updateModeDisk!.floorExists).toBe(true);
    });

    it("하한선 파일 생성 통지는 기준선 갱신을 막지 않는다 — 새 축은 1회 실행으로 부트스트랩된다", () => {
      // 통지(notice)와 위반(violation)을 구분하지 않으면 새 축이 3회 실행을 요구한다:
      // 1회 하한선 생성 → 기준선 미기록 → 2회 "기준선 없음" → 3회 기준선 생성.
      const { baseline, floor } = tempPaths();
      const message = withEnv({ CI: undefined, TEST_AXIS_UPDATE: "1" }, () =>
        failureMessage(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            actual: { alpha: { count: 5 } },
            diff: diffCount,
            metrics,
          })
        )
      );
      expect(message).toContain("하한선 파일이 방금 만들어졌다");
      // 두 파일이 다 생겼다 — 다음 실행(갱신 없이)은 초록이어야 한다.
      expect(JSON.parse(readFileSync(baseline, "utf8"))).toEqual({ alpha: { count: 5 } });
      expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual({ alpha: { count: 5 } });
      withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () => {
        expect(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            actual: { alpha: { count: 5 } },
            diff: diffCount,
            metrics,
          })
        ).not.toThrow();
      });
    });

    it("기준선과 같으면 통과한다 — 게이트가 항상 빨갛지는 않다", () => {
      const { baseline, floor } = tempPaths();
      writeFileSync(floor, `${JSON.stringify({ alpha: { count: 1 } })}\n`);
      writeFileSync(baseline, `${JSON.stringify({ alpha: { count: 3 } })}\n`);
      withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () => {
        expect(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            actual: { alpha: { count: 3 } },
            diff: diffCount,
            metrics,
          })
        ).not.toThrow();
      });
    });

    it("항목 소실과 신규 항목을 각각 지목한다", () => {
      const { baseline, floor } = tempPaths();
      writeFileSync(floor, `${JSON.stringify({ alpha: { count: 1 } })}\n`);
      writeFileSync(baseline, `${JSON.stringify({ alpha: { count: 3 } })}\n`);
      // 하한선 항목 alpha 가 사라졌으므로 하한선 단정이 먼저 잡는다 — 그것도 계약이다.
      const message = withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () =>
        failureMessage(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            actual: { gamma: { count: 3 } },
            diff: diffCount,
            metrics,
          })
        )
      );
      expect(message).toContain("하한선 항목 소실: alpha");
    });
  });
});

describe("windowSkinAsset", () => {
  isolateTimers();
  type BinaryFsReader = {
    readonly readFileSync: (path: URL) => Uint8Array;
  };
  type Inflater = {
    readonly inflateSync: (data: Uint8Array) => Uint8Array;
  };
  const loadBinaryFs = async (): Promise<BinaryFsReader> => {
    const moduleName = "node:fs";
    return (await import(moduleName)) as BinaryFsReader;
  };
  const loadInflater = async (): Promise<Inflater> => {
    const moduleName = "node:zlib";
    return (await import(moduleName)) as unknown as Inflater;
  };
  const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const WINDOW_SKIN_URL = new URL("../public/assets/ui/windowskin-default.png", import.meta.url);
  const WARM_WINDOW_SKIN_URL = new URL("../public/assets/ui/windowskin-warm.png", import.meta.url);
  describe("runtime window skin asset", () => {
    it("ships a valid 96x96 RGBA PNG for 24px 9-slice windows", async () => {
      const fs = await loadBinaryFs();
      const bytes = fs.readFileSync(WINDOW_SKIN_URL);

      expect(Array.from(bytes.slice(0, PNG_SIGNATURE.length))).toEqual(Array.from(PNG_SIGNATURE));
      expect(readUint32BE(bytes, 16)).toBe(96);
      expect(readUint32BE(bytes, 20)).toBe(96);
      expect(bytes[24]).toBe(8);
      expect(bytes[25]).toBe(6);
      expect(hasChunk(bytes, "IDAT")).toBe(true);
    });

    // 저작 기본 스킨(windowskin-warm)은 같은 96x96 / 24px 9-slice 규격이어야 border-image 로
    // 동일하게 타일링된다. 규격이 어긋난 PNG 를 갈아끼우면 창 테두리가 조용히 늘어난다.
    it("ships the authored warm skin at the same 96x96 RGBA 9-slice geometry", async () => {
      const fs = await loadBinaryFs();
      const bytes = fs.readFileSync(WARM_WINDOW_SKIN_URL);

      expect(Array.from(bytes.slice(0, PNG_SIGNATURE.length))).toEqual(Array.from(PNG_SIGNATURE));
      expect(readUint32BE(bytes, 16)).toBe(96);
      expect(readUint32BE(bytes, 20)).toBe(96);
      expect(bytes[24]).toBe(8);
      expect(bytes[25]).toBe(6);
      expect(hasChunk(bytes, "IDAT")).toBe(true);
    });

    // 사용자가 원한 것은 "따뜻한 갈색" 이다. 픽셀을 직접 펴서 붉은 채널이 파란 채널보다
    // 우세한지 본다 — 파란 스킨으로 되돌아가는 회귀를 브라우저 없이 잡는 유일한 방어선이다.
    it("paints the warm skin brown, not blue", async () => {
      const fs = await loadBinaryFs();
      const zlib = await loadInflater();
      const pixels = decodeRgbaPng(fs.readFileSync(WARM_WINDOW_SKIN_URL), zlib);

      let warm = 0;
      let cool = 0;
      for (let index = 0; index + 3 < pixels.length; index += 4) {
        if ((pixels[index + 3] ?? 0) < 32) continue;
        const red = pixels[index] ?? 0;
        const blue = pixels[index + 2] ?? 0;
        if (red > blue + 8) warm += 1;
        else if (blue > red + 8) cool += 1;
      }

      expect(warm).toBeGreaterThan(0);
      expect(cool).toBe(0);
      expect(warm).toBeGreaterThan(cool * 10);
    });
  });
  function decodeRgbaPng(bytes: Uint8Array, zlib: Inflater): Uint8Array {
    const width = readUint32BE(bytes, 16);
    const height = readUint32BE(bytes, 20);
    const compressed: number[] = [];
    let offset = PNG_SIGNATURE.length;
    while (offset + 12 <= bytes.length) {
      const length = readUint32BE(bytes, offset);
      const chunkType = ascii(bytes, offset + 4, offset + 8);
      if (chunkType === "IDAT") compressed.push(...bytes.slice(offset + 8, offset + 8 + length));
      offset += length + 12;
    }

    const raw = zlib.inflateSync(new Uint8Array(compressed));
    const stride = width * 4;
    const out = new Uint8Array(stride * height);
    // PNG 스캔라인 필터 해제(색 타입 6, 비트 심도 8 전용).
    for (let row = 0; row < height; row += 1) {
      const filter = raw[row * (stride + 1)] ?? 0;
      const source = row * (stride + 1) + 1;
      const target = row * stride;
      for (let column = 0; column < stride; column += 1) {
        const value = raw[source + column] ?? 0;
        const left = column >= 4 ? (out[target + column - 4] ?? 0) : 0;
        const up = row > 0 ? (out[target - stride + column] ?? 0) : 0;
        const upLeft = row > 0 && column >= 4 ? (out[target - stride + column - 4] ?? 0) : 0;
        out[target + column] = (value + unfilter(filter, left, up, upLeft)) & 0xff;
      }
    }
    return out;
  }
  function unfilter(filter: number, left: number, up: number, upLeft: number): number {
    if (filter === 1) return left;
    if (filter === 2) return up;
    if (filter === 3) return Math.floor((left + up) / 2);
    if (filter === 4) return paeth(left, up, upLeft);
    return 0;
  }
  function paeth(left: number, up: number, upLeft: number): number {
    const estimate = left + up - upLeft;
    const distanceLeft = Math.abs(estimate - left);
    const distanceUp = Math.abs(estimate - up);
    const distanceUpLeft = Math.abs(estimate - upLeft);
    if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left;
    return distanceUp <= distanceUpLeft ? up : upLeft;
  }
  function hasChunk(bytes: Uint8Array, type: string): boolean {
    let offset = PNG_SIGNATURE.length;
    while (offset + 12 <= bytes.length) {
      const length = readUint32BE(bytes, offset);
      const chunkType = ascii(bytes, offset + 4, offset + 8);
      if (chunkType === type) return true;
      offset += length + 12;
    }
    return false;
  }
  function readUint32BE(bytes: Uint8Array, offset: number): number {
    return ((bytes[offset] ?? 0) * 0x1000000) + (((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0));
  }
  function ascii(bytes: Uint8Array, start: number, end: number): string {
    return String.fromCharCode(...bytes.slice(start, end));
  }
});
