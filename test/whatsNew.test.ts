// test/whatsNew.test.ts
// 「새 소식」 거르기와 범위 계산. CHANGELOG 는 커밋 메시지에서 기계로 만들어지므로
// 여기서 막는 것은 «개발 내부 변경이 사용자 목록에 새는 것» 과 «본 적 있는 릴리스를 다시 보이는 것» 이다.
import { describe, expect, it } from "vitest";
import { buildWhatsNewData, parseChangelog, toUserItem } from "../scripts/lib/whatsNew.mjs";
import { buildReleaseSections, collectReleaseItems, parseReleaseLog, renderReleaseNotes } from "../scripts/lib/releaseNotes.mjs";
import { buildDigest, hasUnseenNews, releaseCore, type WhatsNewData } from "@/editor/whatsNew/whatsNewModel";

const CHANGELOG = `# 변경 기록

머리말은 건너뛴다.

<!-- releases -->

## 0.39.0 — 2026-09-28

### 기능

- **battle** — 전투 결과를 한 화면으로 (` + "\x60" + `7536d0b` + "\x60" + `)
  <!-- user-note: 전투가 끝나면 결과를 한 화면에서 봐요 -->
- **refmap** — 빈 어둠 검사 (` + "\x60" + `22ac9fe` + "\x60" + `)
- **ai,village** — 마을 조수 (` + "\x60" + `1111111` + "\x60" + `)
- **editor** — 숨길 기능 (` + "\x60" + `2222222` + "\x60" + `)
  <!-- user-note: - -->

### 수정

- 범위 없는 수정 (` + "\x60" + `3333333` + "\x60" + `)

### 문서

- **openwiki** — 문서만 (` + "\x60" + `4444444` + "\x60" + `)

## 0.38.1 — 2026-09-28

### 성능

- **runtime** — 첫 전투가 덜 끊긴다 (` + "\x60" + `5555555` + "\x60" + `)

## 0.38.0 — 2026-09-27

### 잡무

- **shared-db** — 재게시 증거 (` + "\x60" + `6666666` + "\x60" + `)
`;

describe("CHANGELOG → 새 소식 데이터", () => {
  it("항목과 user-note 주석을 읽는다", () => {
    const [latest] = parseChangelog(CHANGELOG);
    expect(latest?.version).toBe("0.39.0");
    expect(latest?.items[0]).toMatchObject({ section: "기능", scope: "battle", sha: "7536d0b", userNote: "전투가 끝나면 결과를 한 화면에서 봐요" });
    expect(latest?.items[1]?.userNote).toBeNull();
  });

  it("사용자 문장이 있으면 제목 대신 쓰고, 개발 내부 범위와 문서·잡무는 뺀다", () => {
    const data = buildWhatsNewData(CHANGELOG);
    const [latest, patch, chore] = data.releases;
    expect(latest?.items.map((item) => item.text)).toEqual([
      "전투가 끝나면 결과를 한 화면에서 봐요",
      "마을 조수",
      "범위 없는 수정",
    ]);
    // refmap(내부) · User-Note: - · 문서 = 3
    expect(latest?.hidden).toBe(3);
    expect(patch?.items).toEqual([{ kind: "fix", scope: "runtime", text: "첫 전투가 덜 끊긴다", sha: "5555555" }]);
    // 볼 것이 없는 릴리스도 버전 자리는 남는다.
    expect(chore).toEqual({ version: "0.38.0", date: "2026-09-27", items: [], hidden: 1 });
  });

  it("범위가 여럿이면 하나라도 사용자 범위일 때 남긴다", () => {
    expect(toUserItem({ section: "기능", scope: "refmap,css", summary: "x", sha: null, userNote: null })).toBeNull();
    expect(toUserItem({ section: "기능", scope: "refmap,editor", summary: "x", sha: null, userNote: null })?.text).toBe("x");
  });

  it("내부 범위라도 사용자 문장을 붙이면 보인다", () => {
    expect(toUserItem({ section: "수정", scope: "refmap", summary: "기술 문장", sha: null, userNote: "조수가 빈 방을 덜 만들어요" })?.text)
      .toBe("조수가 빈 방을 덜 만들어요");
  });
});

describe("User-Note 트레일러 → CHANGELOG", () => {
  it("git log 레코드에서 트레일러를 읽어 항목 아래 주석으로 남긴다", () => {
    const log = `aaaaaaa1\tfeat(editor): 목차\t목차가 보여요\x1e\nbbbbbbb2\tfix: 둘\t\x1e`;
    const commits = parseReleaseLog(log);
    expect(commits).toEqual([
      { sha: "aaaaaaa1", subject: "feat(editor): 목차", userNote: "목차가 보여요" },
      { sha: "bbbbbbb2", subject: "fix: 둘", userNote: null },
    ]);
    const notes = renderReleaseNotes({ version: "1.0.0", date: "2026-01-01", sections: buildReleaseSections(collectReleaseItems(commits)) });
    expect(notes).toContain("- **editor** — 목차 (` + "\x60" + `aaaaaaa` + "\x60" + `)\n  <!-- user-note: 목차가 보여요 -->");
    // 다시 읽으면 같은 문장이 나온다 — 쓰는 쪽과 읽는 쪽이 한 규칙이다.
    expect(buildWhatsNewData(notes).releases[0]?.items[0]?.text).toBe("목차가 보여요");
  });

  it("주석을 닫는 --> 는 지워 CHANGELOG 를 깨지 않는다", () => {
    const notes = renderReleaseNotes({
      version: "1.0.0",
      date: "2026-01-01",
      sections: buildReleaseSections(collectReleaseItems([{ sha: "c", subject: "feat: x", userNote: "a --> b" }])),
    });
    expect(notes).toContain("<!-- user-note: a b -->");
  });
});

describe("마지막으로 본 버전 이후만 모은다", () => {
  const data: WhatsNewData = {
    releases: [
      { version: "0.40.0", date: null, items: [{ kind: "new", scope: null, text: "미래", sha: null }], hidden: 0 },
      { version: "0.39.0", date: null, items: [{ kind: "new", scope: "battle", text: "c", sha: null }], hidden: 2 },
      { version: "0.38.1", date: null, items: [{ kind: "fix", scope: null, text: "b", sha: null }], hidden: 0 },
      { version: "0.38.0", date: null, items: [], hidden: 5 },
      { version: "0.37.0", date: null, items: [{ kind: "new", scope: null, text: "a", sha: null }], hidden: 0 },
    ],
  };

  it("본 버전 다음부터 지금 버전까지, 지금보다 새 것은 빼고", () => {
    const digest = buildDigest(data, "0.39.0", "0.37.0");
    expect(digest.items.map((item) => item.text)).toEqual(["c", "b"]);
    expect(digest).toMatchObject({ from: "0.37.0", to: "0.39.0", releaseCount: 3, hidden: 7 });
  });

  it("개발 빌드 라벨도 릴리스 번호로 본다", () => {
    expect(releaseCore("0.39.0-dev.3+gabc1234.dirty")).toBe("0.39.0");
    expect(buildDigest(data, "0.39.0-dev.3+gabc1234", "0.38.1").items.map((item) => item.text)).toEqual(["c"]);
  });

  it("처음 여는 사람은 최근 릴리스 몇 개만 본다", () => {
    const digest = buildDigest(data, "0.39.0", null);
    expect(digest.from).toBeNull();
    expect(digest.releaseCount).toBe(3);
  });

  it("다 본 뒤에는 점을 끈다", () => {
    expect(hasUnseenNews(data, "0.39.0", "0.37.0")).toBe(true);
    expect(hasUnseenNews(data, "0.39.0", "0.39.0")).toBe(false);
    // 볼 것 없는 릴리스(0.38.0)만 지났으면 켜지 않는다.
    expect(hasUnseenNews(data, "0.38.0", "0.38.1")).toBe(false);
  });

  it("번들보다 오래전에 봤으면 전체 기록을 권한다", () => {
    expect(buildDigest(data, "0.39.0", "0.20.0").truncated).toBe(true);
    expect(buildDigest(data, "0.39.0", "0.37.0").truncated).toBe(false);
  });
});
