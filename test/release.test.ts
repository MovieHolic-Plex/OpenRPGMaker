import { describe, expect, it } from "vitest";
import { checkDesktopAssets, highestReleaseTag, requiredDesktopAssets, requiredUpdateAssets } from "../scripts/lib/releaseAssets.mjs";
import { appVersionLabel, parseDescribe } from "../scripts/lib/appVersion.mjs";
import { DEV_GROUP_TITLE, HIGHLIGHTS_TITLE, SECTION_TITLES, buildReleaseSections, bumpVersion, collectReleaseItems, decideReleaseKind, enrichReleaseItems, extractPrNumber, extractReleaseNotesFromPrBody, parseCommitSubject, pickHighlights, renderReleaseNotes } from "../scripts/lib/releaseNotes.mjs";
import { changelogEntryFor, ghReleaseCreateArgs, gitAnnotateTagArgs, writeReleaseNotesFile } from "../scripts/lib/releaseFiles.mjs";
import {
  decideAutoRelease,
  diffFailedFiles,
  evaluateAppUpdateE2eNeed,
  isManifestDiffOnlyRootVersion,
  layerBaselines,
  runCompleteness,
  selectUserFacingCommits,
  summarizeShardReports,
} from "../scripts/lib/releaseGate.mjs";
import {
  computeDemoConcurrency,
  isDemoCacheInputRelevant,
  normalizePackageLockForHash,
  prunePerDemoCache,
  resolveDemoCacheScope,
  sortDemosByWeight,
} from "../scripts/content/bake-demos-lib.mjs";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
      userCommits: [{ sha: "0", subject: "feat: x" }],
      sinceTag: "v0.424.0",
      ciDiff: null,
      lastPublishedAt: "2026-11-28T00:00:00Z",
      recentReleaseTags: ["v0.424.0"],
      holdPrs: [],
      draftTags: [],
      openReleasePr: null,
      now: "2026-11-28T00:30:00Z",
    });

    it("조건과 하루 상한이 다 맞으면 ci-full 없이도 발행한다(30분 경계 포함)", () => {
      const decision = decideAutoRelease(passing());
      expect(decision.release).toBe(true);
      expect(decision.reasons).toEqual([]);
    });

    it("하나라도 안 맞으면 넘어가고 안 맞는 것마다 이유를 남긴다", () => {
      const cases = [
        [{ userCommits: [] }, "user-commits"],
        [{ now: "2026-11-28T00:29:00Z" }, "since-publish"],
        [{ holdPrs: [{ number: 5040 }] }, "hold-label"],
        [{ recentReleaseTags: Array.from({ length: 48 }, (_, index) => `v0.4${10 + index}.0`) }, "daily-cap"],
        [{ draftTags: ["v0.425.0"] }, "no-draft"],
        [{ openReleasePr: { number: 5041, auto: true } }, "no-open-release-pr"],
      ];
      for (const [override, id] of cases) {
        const decision = decideAutoRelease({ ...passing(), ...override });
        expect(decision.release).toBe(false);
        expect(decision.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([id]);
        expect(decision.reasons).toHaveLength(1);
      }
    });

    it("requireCiFull: true 를 켜면 ci-full 대조 실패·누락을 막는다", () => {
      const ok = decideAutoRelease({ ...passing(), requireCiFull: true, ciDiff: { ok: true, newFailures: [], notInBaseline: [] } });
      expect(ok.release).toBe(true);
      for (const ciDiff of [
        { ok: false, newFailures: ["test/a.test.ts"], notInBaseline: [] },
        { ok: false, error: "판 없음" },
        null,
      ]) {
        const decision = decideAutoRelease({ ...passing(), requireCiFull: true, ciDiff });
        expect(decision.release).toBe(false);
        expect(decision.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual(["ci-full"]);
      }
    });
  });

  describe("app-update-e2e 중복 실행 판정 (releaseGate)", () => {
    it("isManifestDiffOnlyRootVersion 은 루트 version 만 바뀐 package.json·package-lock.json 을 동일로 본다", () => {
      const pkgA = JSON.stringify({ name: "oprn", version: "0.420.0", dependencies: { zod: "^4.0.0" } });
      const pkgB = JSON.stringify({ name: "oprn", version: "0.421.0", dependencies: { zod: "^4.0.0" } });
      const pkgDep = JSON.stringify({ name: "oprn", version: "0.421.0", dependencies: { zod: "^4.1.0" } });
      expect(isManifestDiffOnlyRootVersion(pkgA, pkgB)).toBe(true);
      expect(isManifestDiffOnlyRootVersion(pkgA, pkgDep)).toBe(false);

      const lockA = JSON.stringify({
        name: "oprn",
        version: "0.420.0",
        lockfileVersion: 3,
        packages: { "": { name: "oprn", version: "0.420.0" }, "node_modules/electron": { version: "45.3.3" } },
      });
      const lockB = JSON.stringify({
        name: "oprn",
        version: "0.421.0",
        lockfileVersion: 3,
        packages: { "": { name: "oprn", version: "0.421.0" }, "node_modules/electron": { version: "45.3.3" } },
      });
      const lockElectron = JSON.stringify({
        name: "oprn",
        version: "0.421.0",
        lockfileVersion: 3,
        packages: { "": { name: "oprn", version: "0.421.0" }, "node_modules/electron": { version: "45.4.0" } },
      });
      expect(isManifestDiffOnlyRootVersion(lockA, lockB)).toBe(true);
      expect(isManifestDiffOnlyRootVersion(lockA, lockElectron)).toBe(false);
      expect(isManifestDiffOnlyRootVersion("{broken", lockB)).toBe(false);
    });

    it("업데이트·Electron·의존성 변경이 없고 최근 14일 내 통과 기록이 있으면 건너뛴다", () => {
      const base = {
        sinceTag: "v0.421.0",
        changedFiles: ["src/player/scene.ts", "CHANGELOG.md", "package.json", "package-lock.json"],
        packageManifestDiffOnlyVersion: true,
        lockfileDiffOnlyVersion: true,
        lastPassingRun: { id: 123, completedAt: "2026-11-26T00:00:00Z" },
        now: "2026-11-27T12:00:00Z",
      };
      expect(evaluateAppUpdateE2eNeed(base).required).toBe(false);

      // electron 또는 업데이트 관련 파일 변경 → 반드시 실행
      expect(evaluateAppUpdateE2eNeed({ ...base, changedFiles: ["electron/main/appUpdate.ts"] })).toMatchObject({
        required: true,
        matchedFiles: ["electron/main/appUpdate.ts"],
      });
      expect(evaluateAppUpdateE2eNeed({ ...base, changedFiles: ["src/app/appUpdateChip.ts"] }).required).toBe(true);
      expect(evaluateAppUpdateE2eNeed({ ...base, changedFiles: ["scripts/electron-builder.config.mjs"] }).required).toBe(true);
      // 의존성 변경 → 반드시 실행
      expect(evaluateAppUpdateE2eNeed({ ...base, lockfileDiffOnlyVersion: false }).required).toBe(true);
      expect(evaluateAppUpdateE2eNeed({ ...base, packageManifestDiffOnlyVersion: false }).required).toBe(true);
      // 14일 초과 → 반드시 실행
      expect(evaluateAppUpdateE2eNeed({ ...base, lastPassingRun: { id: 99, completedAt: "2026-11-01T00:00:00Z" } }).required).toBe(true);
      // 기록 없음·diff 실패·0.420 이전 → 보수적으로 실행
      expect(evaluateAppUpdateE2eNeed({ ...base, lastPassingRun: null }).required).toBe(true);
      expect(evaluateAppUpdateE2eNeed({ ...base, changedFiles: null }).required).toBe(true);
      expect(evaluateAppUpdateE2eNeed({ ...base, sinceTag: "v0.419.0" }).required).toBe(true);
    });
  });

  describe("데모 굽기 캐시·병렬 도우미 (bake-demos-lib)", () => {
    it("normalizePackageLockForHash 는 루트 버전 범프를 무시하고 의존성 변경만 반영한다", () => {
      const v1 = JSON.stringify({ name: "oprn", version: "0.420.0", packages: { "": { version: "0.420.0" }, "node_modules/zod": { version: "4.6.7" } } });
      const v2 = JSON.stringify({ name: "oprn", version: "0.421.0", packages: { "": { version: "0.421.0" }, "node_modules/zod": { version: "4.6.7" } } });
      const dep = JSON.stringify({ name: "oprn", version: "0.421.0", packages: { "": { version: "0.421.0" }, "node_modules/zod": { version: "4.6.8" } } });
      expect(normalizePackageLockForHash(v1)).toBe(normalizePackageLockForHash(v2));
      expect(normalizePackageLockForHash(v1)).not.toBe(normalizePackageLockForHash(dep));
    });

    it("computeDemoConcurrency 는 CPU·메모리 상한과 환경변수 덮어쓰기를 따른다", () => {
      const GiB = 1024 ** 3;
      expect(computeDemoConcurrency({ missCount: 5, cpuCount: 40, totalMemBytes: 251 * GiB, envConcurrency: undefined })).toBe(5);
      expect(computeDemoConcurrency({ missCount: 5, cpuCount: 8, totalMemBytes: 16 * GiB, envConcurrency: undefined })).toBe(1);
      expect(computeDemoConcurrency({ missCount: 2, cpuCount: 40, totalMemBytes: 251 * GiB, envConcurrency: undefined })).toBe(2);
      expect(computeDemoConcurrency({ missCount: 5, cpuCount: 40, totalMemBytes: 251 * GiB, envConcurrency: "3" })).toBe(3);
    });

    it("sortDemosByWeight 는 가장 무거운 chrono-bell 을 맨 앞에 둔다", () => {
      expect(sortDemosByWeight(["maou-konbini", "chrono-bell", "first-love"])).toEqual(["chrono-bell", "first-love", "maou-konbini"]);
    });

    it("isDemoCacheInputRelevant 는 에디터·Electron·타입 전용 경로를 제외하고 flagship 스코프에서는 데모 핵심 경로만 추적한다", () => {
      expect(resolveDemoCacheScope("flagship")).toBe("flagship");
      expect(resolveDemoCacheScope(undefined)).toBe("graph");
      // 공통 제외: Electron·에디터·영속성·타입 선언
      expect(isDemoCacheInputRelevant("electron/shared/appUpdate.ts", "graph")).toBe(false);
      expect(isDemoCacheInputRelevant("src/project/persistence/electronRepository.ts", "graph")).toBe(false);
      expect(isDemoCacheInputRelevant("src/project/types/database.ts", "graph")).toBe(false);
      expect(isDemoCacheInputRelevant("src/editor/panels/database.ts", "graph")).toBe(false);
      // flagship 스코프: 데모·직렬화·내보내기·번들 자산만 포함, 무관한 UI/에셋 JSON 제외
      expect(isDemoCacheInputRelevant("src/project/flagship/chronoBell.ts", "flagship")).toBe(true);
      expect(isDemoCacheInputRelevant("src/project/io/serialize.ts", "flagship")).toBe(true);
      expect(isDemoCacheInputRelevant("src/project/export/prepareWebExport.ts", "flagship")).toBe(true);
      expect(isDemoCacheInputRelevant("src/assets/bundledTilesets.json", "flagship")).toBe(true);
      expect(isDemoCacheInputRelevant("assets/bgm-release-v1.json", "flagship")).toBe(true);
      expect(isDemoCacheInputRelevant("src/project/dialogueStyles.ts", "flagship")).toBe(false);
      expect(isDemoCacheInputRelevant("src/assets/sharedCharacterGraphics.json", "flagship")).toBe(false);
    });

    it("prunePerDemoCache 는 데모마다 최신 N개만 남기고 다른 데모의 항목은 지우지 않는다", () => {
      const dir = mkdtempSync(join(tmpdir(), "oprn-bake-prune-"));
      try {
        const v2 = join(dir, "v2");
        mkdirSync(v2, { recursive: true });
        const mk = (name: string, sec: number) => {
          const p = join(v2, name);
          mkdirSync(p, { recursive: true });
          writeFileSync(join(p, "marker"), "ok");
          const t = new Date(1_700_000_000_000 + sec * 1000);
          utimesSync(p, t, t);
          return p;
        };
        const oldFl = mk(`first-love-${"1".repeat(64)}`, 1);
        const midFl = mk(`first-love-${"2".repeat(64)}`, 2);
        const newFl = mk(`first-love-${"3".repeat(64)}`, 3);
        const cb = mk(`chrono-bell-${"a".repeat(64)}`, 0);
        prunePerDemoCache(dir, 2);
        expect(existsSync(oldFl)).toBe(false);
        expect(existsSync(midFl)).toBe(true);
        expect(existsSync(newFl)).toBe(true);
        expect(existsSync(cb)).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
