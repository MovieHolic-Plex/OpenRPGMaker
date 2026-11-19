// scripts/lib/releaseNotes.mjs
// 릴리스 노트 생성 — 커밋 메시지에서 기계적으로 뽑는다. 손으로 쓰는 노트는 릴리스마다
// 빠지고, 빠진 릴리스는 아무도 안 쓴다. 반대로 커밋 메시지가 곧 노트가 되면 규약
// (Conventional Commits)을 지키는 압력이 생긴다.
//
// 사람이 쓸 자리:
//   - `--summary` : 「주요 변경」 절을 통째로 덮어쓴다(자동 요약 대신).
//   - PR 본문의 「릴리스 노트」/「Release notes」 절: 커밋 제목 대신 그 한 줄을 쓴다.
//
// 순수 함수만 있다. git·gh 호출은 scripts/release.mjs / release-auto.mjs 가 한다 —
// 그래야 테스트가 저장소 이력·네트워크에 의존하지 않는다.

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

/** 다운로드하는 사람에게 먼저 보이는 섹션. */
export const USER_SECTION_TITLES = [BREAKING_TITLE, "기능", "수정", "성능", "되돌림"];

/** 접힌 「개발」 안에 들어가는 섹션. */
export const DEV_SECTION_TITLES = ["정리", "문서", "테스트", "스타일", "빌드", "CI", "잡무", OTHER_TITLE];

export const HIGHLIGHTS_TITLE = "주요 변경";
export const DEV_GROUP_TITLE = "개발";
export const HIGHLIGHT_LIMIT = 5;

/** 이 메시지들은 릴리스 노트에서 뺀다 — 이력 자체를 서술할 뿐 사용자에게 하는 약속이 아니다. */
const SKIP_PATTERNS = [/^merge\b/i, /^chore\(release\)/i, /^revert "merge/i];

const TYPE_RANK = { feat: 0, fix: 1, perf: 2 };

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

/** 커밋 제목·본문에서 머지된 PR 번호. 스쿼시 머지의 `(#1234)` 를 우선한다. */
export function extractPrNumber(text) {
  const source = String(text ?? "");
  const paren = /\(#(\d+)\)/.exec(source);
  if (paren) return Number(paren[1]);
  const trailing = /(?:^|\s)#(\d+)\s*$/.exec(source);
  if (trailing) return Number(trailing[1]);
  return null;
}

/**
 * PR 본문에서 사용자에게 보일 한 줄을 꺼낸다.
 * 인정하는 표제: 「Release notes」, 「Release-notes」, 「릴리스 노트」
 * (`##`/`###`/`**…**`/`Release notes:` 형태). 없거나 비어 있으면 null.
 */
export function extractReleaseNotesFromPrBody(body) {
  const text = String(body ?? "").replace(/\r\n/g, "\n");
  if (!text.trim()) return null;

  const title = "(?:release[ -]?notes|릴리스\\s*노트)";
  const heading = new RegExp(`^(?:#{1,6}\\s*|(?:\\*\\*|__)?)(?:${title})(?:\\*\\*|__)?\\s*:?\\s*$`, "i");
  const inline = new RegExp(`^(?:#{1,6}\\s*)?(?:\\*\\*|__)?(?:${title}):?(?:\\*\\*|__)?\\s*:?\\s+(\\S.*)$`, "i");
  const nextHeading = /^(?:#{1,6}\s+\S|(?:\*\*|__)[^*_\n]+(?:\*\*|__)\s*:?\s*$)/;

  const lines = text.split("\n");
  let start = -1;
  let first = null;
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    const inlineMatch = inline.exec(trimmed);
    if (inlineMatch) {
      first = sanitizeNoteLine(inlineMatch[1]);
      start = i + 1;
      break;
    }
    if (heading.test(trimmed)) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return first;

  const collected = [];
  for (let i = start; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (nextHeading.test(trimmed) && !heading.test(trimmed) && !inline.test(trimmed)) break;
    collected.push(lines[i]);
  }
  if (first) return first;
  for (const line of collected) {
    const note = sanitizeNoteLine(line);
    if (note) return note;
  }
  return null;
}

function sanitizeNoteLine(line) {
  let row = String(line ?? "").trim();
  if (!row || row.startsWith("<!--")) return null;
  row = row.replace(/^[-*+]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
  if (!row) return null;
  return row.replace(/\s+/g, " ");
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
      prNumber: extractPrNumber(commit?.subject) ?? extractPrNumber(parsed.summary),
    });
  }
  return items;
}

/**
 * 머지된 PR 본문의 「릴리스 노트」 절이 있으면 그 한 줄을 item.note 에 넣는다.
 * fetchPrBody(number) 는 문자열 또는 null 을 동기로 반환한다. 던지거나, 없거나,
 * 절이 비어 있으면 커밋 제목으로 남긴다(CI 에서 gh 를 못 쓰는 경우 포함).
 */
export function enrichReleaseItems(items, fetchPrBody) {
  if (!Array.isArray(items)) return [];
  if (typeof fetchPrBody !== "function") return items.map((item) => ({ ...item }));
  const cache = new Map();
  const readBody = (number) => {
    if (cache.has(number)) return cache.get(number);
    let body = null;
    try {
      body = fetchPrBody(number);
    } catch {
      body = null;
    }
    cache.set(number, body);
    return body;
  };
  return items.map((item) => {
    if (item?.prNumber == null) return { ...item };
    const note = extractReleaseNotesFromPrBody(readBody(item.prNumber));
    if (!note) return { ...item };
    return { ...item, note };
  });
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

function uniqueItemsFromSections(sections) {
  const seen = new Set();
  const items = [];
  for (const section of sections ?? []) {
    if (section.title === BREAKING_TITLE) continue;
    for (const item of section.items ?? []) {
      const key = item.sha || item.summary;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  return items;
}

function highlightScore(item) {
  if (item.breaking) return 0;
  return (TYPE_RANK[item.type] ?? 9) + 1;
}

/**
 * 사용자에게 먼저 보여줄 3–5줄. feat/fix/perf(및 깨지는 변경)만 고른다.
 * 순위: 깨지는 변경 → feat → fix → perf, 그다음 PR 노트·PR 번호가 있는 것, 원래 순서(최신 우선).
 */
export function pickHighlights(items, { limit = HIGHLIGHT_LIMIT } = {}) {
  const pool = (items ?? []).filter(
    (item) => item.breaking || item.type === "feat" || item.type === "fix" || item.type === "perf",
  );
  const ranked = pool.map((item, index) => ({ item, index })).sort((a, b) => {
    const score = highlightScore(a.item) - highlightScore(b.item);
    if (score !== 0) return score;
    if (Boolean(a.item.note) !== Boolean(b.item.note)) return a.item.note ? -1 : 1;
    if (Boolean(a.item.prNumber) !== Boolean(b.item.prNumber)) return a.item.prNumber ? -1 : 1;
    return a.index - b.index;
  });
  const cap = Math.max(0, Number(limit) || 0);
  return ranked.slice(0, cap).map((entry) => entry.item);
}

function renderItem(item) {
  const scope = item.scope ? `**${item.scope}** — ` : "";
  const sha = item.sha ? ` (\`${item.sha}\`)` : "";
  const text = (item.note && String(item.note).trim()) || item.summary;
  const withPr = appendPrNumber(text, item.prNumber);
  return `- ${scope}${withPr}${sha}`;
}

function appendPrNumber(text, prNumber) {
  if (prNumber == null) return text;
  if (new RegExp(`\\(#${prNumber}\\)`).test(text) || new RegExp(`#${prNumber}\\b`).test(text)) return text;
  return `${text} (#${prNumber})`;
}

function renderSection(section, lines) {
  lines.push(`### ${section.title}`, "");
  for (const item of section.items) lines.push(renderItem(item));
  lines.push("");
}

/**
 * 마크다운 한 덩어리. GitHub 릴리스 본문과 CHANGELOG.md 가 같은 문자열을 쓴다 —
 * 두 곳에 다른 말을 적을 수 있게 만들면 반드시 갈라진다.
 *
 * 맨 위는 「주요 변경」(자동 3–5줄, `--summary` 가 있으면 그 글이 대신한다).
 * 그다음 사용자 섹션(기능·수정·성능 등), 내부 섹션은 `<details>` 「개발」 안에 접는다.
 */
export function renderReleaseNotes({ version, date, summary, sections, omitted = 0, highlights } = {}) {
  const lines = [`## ${version} — ${date}`, ""];
  const summaryText = summary && String(summary).trim();
  const list = sections ?? [];

  let highlightItems = highlights;
  if (highlightItems === undefined && !summaryText) {
    highlightItems = pickHighlights(uniqueItemsFromSections(list));
  }

  if (summaryText) {
    lines.push(`### ${HIGHLIGHTS_TITLE}`, "", summaryText, "");
  } else if (highlightItems && highlightItems.length > 0) {
    lines.push(`### ${HIGHLIGHTS_TITLE}`, "");
    for (const item of highlightItems) lines.push(renderItem(item));
    lines.push("");
  }

  if (list.length === 0 && !summaryText && !(highlightItems && highlightItems.length)) {
    lines.push("기록할 만한 변경이 없습니다.", "");
  }

  const userTitles = new Set(USER_SECTION_TITLES);
  const userSections = list.filter((section) => userTitles.has(section.title));
  const devSections = list.filter((section) => !userTitles.has(section.title));

  for (const section of userSections) renderSection(section, lines);

  if (devSections.length > 0) {
    lines.push("<details>", `<summary>${DEV_GROUP_TITLE}</summary>`, "");
    for (const section of devSections) renderSection(section, lines);
    lines.push("</details>", "");
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

/**
 * 자동 제안의 범프 종류를 정한다.
 * 0.x 에서는 feat 와 깨지는 변경이 MINOR, 고치는 것은 PATCH 다.
 * 문서·테스트·잡무만 쌓였으면 null 이다.
 * 규약 밖 메시지는 PATCH 로 센다.
 */
export function decideReleaseKind(commits) {
  const items = collectReleaseItems(commits);
  if (items.length === 0) return null;
  if (items.some((item) => item.breaking || item.type === "feat")) return "minor";
  const patchy = items.some((item) => item.type === null || ["fix", "perf", "refactor"].includes(item.type));
  return patchy ? "patch" : null;
}
