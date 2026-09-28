// scripts/lib/whatsNew.mjs
// 앱 안 「새 소식」 데이터 — CHANGELOG.md 를 사용자에게 보일 목록으로 거른다.
//
// 왜 CHANGELOG 를 다시 읽는가 — 노트의 정본은 이미 하나다(scripts/lib/releaseNotes.mjs 가 커밋에서 만든다).
// 앱이 커밋을 따로 읽거나 사람이 따로 쓰면 두 곳이 갈라진다. 여기서는 **거르기만** 한다.
//
// 거르는 규칙 (openwiki/release-and-version.md 「앱 안 새 소식과 업데이트」):
//   1. 섹션: 기능 → new, 수정·성능 → fix. 문서·테스트·잡무·정리·빌드·기타는 뺀다.
//   2. 범위(scope)가 INTERNAL_SCOPES 뿐이면 뺀다 — 개발 도구·증거·공용 DB 게시처럼 사용자가 못 보는 변경.
//   3. 커밋 본문 트레일러 `User-Note: <문장>` 이 있으면 제목 대신 그 문장을 보인다.
//      `User-Note: -` 는 「사용자에게 보이지 않는 변경」이라는 표시다 — 뺀다.
//      트레일러는 CHANGELOG 항목 아래 `  <!-- user-note: … -->` 줄로 남는다(GitHub 화면에는 안 보인다).
//
// 순수 함수와 vite 플러그인만 있다. 브라우저는 플러그인이 만든 가상 모듈만 받는다(원문 185KB 를 싣지 않는다).

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** 사용자에게 보이지 않는 변경의 범위. 새 개발 전용 범위를 만들면 여기 더한다. */
export const INTERNAL_SCOPES = new Set([
  "openwiki",
  "docs",
  "qa",
  "qa-game",
  "gates",
  "evidence",
  "test",
  "tests",
  "types",
  "worktree",
  "release",
  "shared-db",
  "benchmark",
  "ci",
  "css",
  "refmap",
]);

const SECTION_KIND = new Map([
  ["기능", "new"],
  ["수정", "fix"],
  ["성능", "fix"],
]);

/** 앱 번들에 싣는 최근 릴리스 수. 이보다 오래 안 연 사용자는 「전체 변경 기록」으로 간다. */
export const WHATS_NEW_RELEASE_LIMIT = 40;

export const USER_NOTE_TRAILER = "User-Note";
const USER_NOTE_MARKER = /^\s+<!-- user-note: (?<note>.*) -->\s*$/;
const RELEASE_HEADING = /^## (?<version>\d+\.\d+\.\d+)(?: — (?<date>\d{4}-\d{2}-\d{2}))?\s*$/;
const ITEM_LINE = /^- (?:\*\*(?<scope>[^*]+)\*\* — )?(?<summary>.+?)(?: \(\x60(?<sha>[0-9a-f]{7,40})\x60\))?\s*$/;

/** 트레일러 값을 CHANGELOG 주석 한 줄로 쓸 수 있게 다듬는다. 주석을 닫는 `-->` 는 지운다. */
export function normalizeUserNote(value) {
  const text = String(value ?? "").replace(/-->/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

/** CHANGELOG 항목 아래에 붙는 사용자 문장 줄. 노트가 없으면 null. */
export function renderUserNoteMarker(note) {
  const text = normalizeUserNote(note);
  return text ? `  <!-- user-note: ${text} -->` : null;
}

/**
 * CHANGELOG 본문 → 릴리스 배열(파일 순서 = 최신이 먼저).
 * 항목: { section, scope, summary, sha, userNote }. 해석 못 하는 줄은 건너뛴다 — 사람이 쓴 머리말이 있어도 죽지 않는다.
 */
export function parseChangelog(text) {
  const releases = [];
  let release = null;
  let section = null;
  let lastItem = null;
  for (const line of String(text ?? "").split("\n")) {
    const heading = RELEASE_HEADING.exec(line);
    if (heading) {
      release = { version: heading.groups.version, date: heading.groups.date ?? null, items: [] };
      releases.push(release);
      section = null;
      lastItem = null;
      continue;
    }
    if (!release) continue;
    if (line.startsWith("### ")) {
      section = line.slice(4).trim();
      lastItem = null;
      continue;
    }
    const marker = USER_NOTE_MARKER.exec(line);
    if (marker && lastItem) {
      lastItem.userNote = normalizeUserNote(marker.groups.note);
      continue;
    }
    const item = section ? ITEM_LINE.exec(line) : null;
    if (item) {
      lastItem = {
        section,
        scope: item.groups.scope?.trim() || null,
        summary: item.groups.summary.trim(),
        sha: item.groups.sha ?? null,
        userNote: null,
      };
      release.items.push(lastItem);
      continue;
    }
    if (line.trim()) lastItem = null;
  }
  return releases;
}

/** 범위가 여럿(`ai,village`)이면 하나라도 사용자 범위가 있을 때 남긴다. */
function isInternalScope(scope) {
  if (!scope) return false;
  const parts = scope.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean);
  return parts.length > 0 && parts.every((part) => INTERNAL_SCOPES.has(part));
}

/** 항목 하나를 사용자 목록에 넣을지. 넣으면 { kind, scope, text, sha }, 빼면 null. */
export function toUserItem(item) {
  const kind = SECTION_KIND.get(item.section);
  if (!kind) return null;
  if (item.userNote === "-") return null;
  if (!item.userNote && isInternalScope(item.scope)) return null;
  return { kind, scope: item.scope, text: item.userNote ?? item.summary, sha: item.sha };
}

/**
 * 앱에 싣는 모양. hidden 은 그 릴리스에서 걸러 낸 항목 수(「개발 내부 변경 N건은 숨김」).
 * 문서·테스트만 있던 릴리스도 버전 자리로는 남긴다 — 몇 버전을 건너뛰었는지는 사용자에게도 의미가 있다.
 */
export function buildWhatsNewData(changelogText, { limit = WHATS_NEW_RELEASE_LIMIT } = {}) {
  const releases = parseChangelog(changelogText).slice(0, limit).map((release) => {
    const items = [];
    let hidden = 0;
    for (const entry of release.items) {
      const item = toUserItem(entry);
      if (item) items.push(item);
      else hidden += 1;
    }
    return { version: release.version, date: release.date, items, hidden };
  });
  return { releases };
}

export const WHATS_NEW_MODULE_ID = "virtual:oprn-whats-new";
const RESOLVED_ID = `\0${WHATS_NEW_MODULE_ID}`;

/**
 * vite 플러그인 — `import data from "virtual:oprn-whats-new"` 가 거른 JSON 을 받는다.
 * 편집기가 패널을 열 때만 동적 import 하므로 첫 화면 번들에는 들어가지 않는다.
 */
export function whatsNewPlugin() {
  let root = process.cwd();
  return {
    name: "oprn-whats-new",
    configResolved(config) {
      root = resolve(config.root ?? process.cwd());
    },
    resolveId(id) {
      return id === WHATS_NEW_MODULE_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const file = join(root, "CHANGELOG.md");
      if (!existsSync(file)) return `export default ${JSON.stringify(buildWhatsNewData(""))};\n`;
      this.addWatchFile(file);
      return `export default ${JSON.stringify(buildWhatsNewData(readFileSync(file, "utf8")))};\n`;
    },
  };
}
