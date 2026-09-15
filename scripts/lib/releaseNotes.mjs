// scripts/lib/releaseNotes.mjs
// 릴리스 노트 생성 — 커밋 메시지에서 기계적으로 뽑는다. 손으로 쓰지 않는 이유:
// 손으로 쓰는 노트는 릴리스마다 빠지고, 빠진 릴리스는 아무도 안 쓴다. 반대로 커밋
// 메시지가 곧 노트가 되면 규약(Conventional Commits)을 지키는 압력이 생긴다.
//
// 사람이 쓸 자리는 하나 남겨 둔다 — `--summary` 한 줄(그 릴리스의 표제). 본문은 자동.
//
// 순수 함수만 있다. git 호출은 scripts/release.mjs 가 한다 — 그래야 테스트가
// 저장소 이력에 의존하지 않고 이스(0.x 범프, 깨지는 변경, 비규약 커밋)를 직접 넣는다.

/** 이 순서대로 섹션이 나온다. 여기 없는 타입과 비규약 커밋은 "기타" 로 간다. */
export const SECTION_TITLES = [
  ["feat", "기능"],
  ["fix", "수정"],
  ["perf", "성능"],
  ["refactor", "정리"],
  ["docs", "문서"],
  ["test", "테스트"],
  ["style", "스타일"],
  ["build", "빌드"],
  ["ci", "CI"],
  ["revert", "되돌림"],
  ["chore", "잡무"],
];

const SECTION_BY_TYPE = new Map(SECTION_TITLES);
const OTHER_TITLE = "기타";
const BREAKING_TITLE = "깨지는 변경";

/** 이 메시지들은 릴리스 노트에서 뺀다 — 이력 자체를 서술할 뿐 사용자에게 하는 약속이 아니다. */
const SKIP_PATTERNS = [/^merge\b/i, /^chore\(release\)/i, /^revert "merge/i];

export const RELEASE_KINDS = ["major", "minor", "patch"];

/**
 * `feat(editor)!: 목차를 …` → `{ type: "feat", scope: "editor", summary: "목차를 …", breaking: true }`
 * 규약을 안 따르는 메시지도 버리지 않는다 — 대신 type 을 null 로 두고 "기타" 로 보낸다.
 * 버리면 조용히 사라지는 변경이 생기고, 그게 릴리스 노트를 못 믿게 만든다.
 */
export function parseCommitSubject(subject) {
  const text = typeof subject === "string" ? subject.trim() : "";
  if (!text) return null;
  if (SKIP_PATTERNS.some((pattern) => pattern.test(text))) return null;

  const conventional = /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?:\s*(?<summary>.+)$/.exec(text);
  if (!conventional) return { type: null, scope: null, summary: text, breaking: false };

  const summary = conventional.groups.summary.trim();
  if (!summary) return { type: null, scope: null, summary: text, breaking: false };
  return {
    type: conventional.groups.type.toLowerCase(),
    scope: conventional.groups.scope?.trim() || null,
    summary,
    breaking: conventional.groups.breaking === "!",
  };
}

/** `git log` 항목 { sha, subject } 배열 → 노트 항목. 같은 요약은 한 번만 남긴다. */
export function collectReleaseItems(commits) {
  const items = [];
  const seen = new Set();
  for (const commit of commits) {
    const parsed = parseCommitSubject(commit?.subject);
    if (!parsed) continue;
    const key = parsed.summary.replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      sha: String(commit?.sha ?? "").slice(0, 7),
      type: parsed.type,
      scope: parsed.scope,
      summary: parsed.summary,
      breaking: parsed.breaking,
      section: SECTION_BY_TYPE.get(parsed.type) ?? OTHER_TITLE,
    });
  }
  return items;
}

/**
 * 섹션으로 묶는다. 빈 섹션은 만들지 않는다.
 * "깨지는 변경" 은 별도 섹션으로 맨 앞에 세우고, 원래 섹션에도 그대로 남긴다 —
 * 앞은 "무엇을 조심해야 하나", 뒤는 "무엇이 바뀌었나" 로 읽는 목적이 다르다.
 */
export function buildReleaseSections(items) {
  const buckets = new Map();
  for (const item of items) {
    const title = item.section;
    if (!buckets.has(title)) buckets.set(title, []);
    buckets.get(title).push(item);
  }

  const order = [...SECTION_TITLES.map(([, title]) => title), OTHER_TITLE];
  const sections = order
    .filter((title) => buckets.has(title))
    .map((title) => ({ title, items: buckets.get(title) }));

  const breaking = items.filter((item) => item.breaking);
  if (breaking.length > 0) sections.unshift({ title: BREAKING_TITLE, items: breaking });
  return sections;
}

function renderItem(item) {
  const scope = item.scope ? `**${item.scope}** — ` : "";
  const sha = item.sha ? ` (\`${item.sha}\`)` : "";
  return `- ${scope}${item.summary}${sha}`;
}

/**
 * 마크다운 한 덩어리. GitHub 릴리스 본문과 CHANGELOG.md 가 같은 문자열을 쓴다 —
 * 두 곳에 다른 말을 적을 수 있게 만들면 반드시 갈라진다.
 */
export function renderReleaseNotes({ version, date, summary, sections, omitted = 0 }) {
  const lines = [`## ${version} — ${date}`, ""];
  if (summary && String(summary).trim()) {
    lines.push(String(summary).trim(), "");
  }
  if (sections.length === 0) {
    lines.push("기록할 만한 변경이 없습니다.", "");
  }
  for (const section of sections) {
    lines.push(`### ${section.title}`, "");
    for (const item of section.items) lines.push(renderItem(item));
    lines.push("");
  }
  if (omitted > 0) {
    lines.push(`> 이전 ${omitted}건은 생략했습니다. 전체 이력은 \`git log\` 를 보세요.`, "");
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

/** 0.x 에서는 깨지는 변경이 MINOR 다 — 그래서 major/minor 를 강제하지 않고 사람이 고른다. */
export function bumpVersion(version, kind) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version));
  if (!match) throw new Error(`semver 가 아닙니다: ${version}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  switch (kind) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`모르는 범프 종류입니다: ${kind} (가능: ${RELEASE_KINDS.join(", ")})`);
  }
}