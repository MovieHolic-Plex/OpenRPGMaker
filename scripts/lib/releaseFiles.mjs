// scripts/lib/releaseFiles.mjs
// 리스가 만지는 파일 (package.json · package-lock.json · CHANGELOG.md)을 쓰는 유일한 곳.
//
// 왜 는가 — 수동 경로(scripts/release.mjs)와 자동 제안 경로(scripts/release-auto.mjs)가
// 각자 파일을 쓰면 한쪽만 고쳐지고, 그 결과 태그와 CHANGELOG 가 서로 다른 말을 하게 된다.
// 릴리스에서 가장 비싼 사고가 그것이다.
//
// 실패는 던진다(process.exit 아님). 종료 코드로 바꾸는 것은 CLI 의 몫이다.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const CHANGELOG_FILE = "CHANGELOG.md";

export const CHANGELOG_HEADER = `# 변경 기록

이 파일은 \`npm run release\` 가 커밋 메시지에서 생성한다. 손으로 고치지 말 것 —
고칠 것은 커밋 메시지다(\`feat:\` \`fix:\` \`refactor:\` … 규약은 openwiki/release-and-version.md).

<!-- releases -->
`;

/** 저장소의 package.json 이 말하는 릴리스 버전. */
export function readManifestVersion(root) {
  const raw = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const version = typeof raw.version === "string" ? raw.version.trim() : "";
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error(`package.json 의 version 이 semver 가 아닙니다: ${JSON.stringify(raw.version)}`);
  }
  return version;
}

/**
 * `"name": "oprn"` 바로 뒤의 version 만 바꾼다 — 의존성의 같은 버전 문자열을 건드리지 않기
 * 위해 자리를 표제로 못 박는다. 기대 개수와 다르면 던진다(조용히 넘어가면 안 되는 자리다).
 */
export function bumpManifestVersion(root, file, from, to, expectedMatches) {
  const path = join(root, file);
  const text = readFileSync(path, "utf8");
  const pattern = new RegExp(`("name":\\s*"oprn",\\s*\\n\\s*"version":\\s*")${from.replace(/\./g, "\\.")}(")`, "g");
  const matches = text.match(pattern) ?? [];
  if (matches.length !== expectedMatches) {
    throw new Error(`${file} 에서 버전 자리를 ${expectedMatches}개 찾아야 하는데 ${matches.length}개 찾았습니다 — 손으로 확인하세요.`);
  }
  const next = text.replace(pattern, `$1${to}$2`);
  const parsed = JSON.parse(next);
  if (parsed.version !== to) throw new Error(`${file} 검증 실패: version=${parsed.version}`);
  writeFileSync(path, next);
  return parsed;
}

/** CHANGELOG 맨 위에 새 항목을 끼워 넣는다. 파일이 없으면 머리말과 함께 만든다. */
export function writeChangelog(root, entry) {
  const path = join(root, CHANGELOG_FILE);
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (!existing.trim()) {
    writeFileSync(path, `${CHANGELOG_HEADER}\n${entry}`);
    return;
  }
  const marker = existing.indexOf("<!-- releases -->");
  if (marker < 0) {
    // 표식이 없는 파일(사람이 시작한 CHANGELOG)도 덮지 않는다 — 첫 `## ` 앞에 워 넣는다.
    const firstEntry = existing.indexOf("\n## ");
    const head = firstEntry < 0 ? existing.trimEnd() : existing.slice(0, firstEntry).trimEnd();
    const tail = firstEntry < 0 ? "" : existing.slice(firstEntry);
    writeFileSync(path, `${head}\n\n${entry}${tail}`);
    return;
  }
  const insertAt = existing.indexOf("\n", marker) + 1;
  writeFileSync(path, `${existing.slice(0, insertAt)}\n${entry}${existing.slice(insertAt)}`);
}

/** CHANGELOG 본문에서 한 버전의 절만 꺼낸다 — 주석 태그 본문(= GitHub Release 노트)으로 쓴다. */
export function changelogEntryFor(text, version) {
  const lines = String(text ?? "").split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## ${version} `) || line.trim() === `## ${version}`);
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trimEnd();
}

/** 리스 날짜는 로컬 기준이다 — KST 새벽에 자른 릴리스가 전날로 적히면 안 된다. */
export function localDate(when = new Date()) {
  const month = String(when.getMonth() + 1).padStart(2, "0");
  const day = String(when.getDate()).padStart(2, "0");
  return `${when.getFullYear()}-${month}-${day}`;
}