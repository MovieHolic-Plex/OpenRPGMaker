import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const DEFAULT_TARGETS = Object.freeze([
  {
    file: "dist/export-player/player.js",
    path: path.join(REPOSITORY_ROOT, "dist", "export-player", "player.js"),
  },
  {
    file: "community-site/public/player-static/player.js",
    path: path.join(
      REPOSITORY_ROOT,
      "community-site",
      "public",
      "player-static",
      "player.js",
    ),
  },
]);

const RULES = Object.freeze([
  {
    id: "provider-key",
    pattern: /(?:sk-(?:ant-|proj-)?|AIza)[A-Za-z0-9_-]{20,}/gu,
  },
  {
    id: "credentialed-db-uri",
    pattern: /postgres(?:ql)?:\/\/[^\s'"`/:]+:[^\s'"`/@]+@[^\s'"`]+/giu,
  },
  {
    id: "jwt-token",
    pattern:
      /eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/gu,
  },
]);

const requestedPaths = process.argv.slice(2);
const targets =
  requestedPaths.length === 0
    ? DEFAULT_TARGETS
    : requestedPaths.map((requestedPath, index) => ({
        file: `argument-${index + 1}`,
        path: path.resolve(requestedPath),
      }));

const findings = [];
for (const target of targets) {
  let content;
  try {
    content = await readFile(target.path, "utf8");
  } catch {
    findings.push({ file: target.file, rule: "input-unreadable", count: 1 });
    continue;
  }

  for (const rule of RULES) {
    const count = content.match(rule.pattern)?.length ?? 0;
    if (count > 0) {
      findings.push({ file: target.file, rule: rule.id, count });
    }
  }
}

const total = findings.reduce((sum, finding) => sum + finding.count, 0);
const unsafe = total > 0;
console.log(`release-preflight unsafe=${unsafe} total=${total}`);
for (const finding of findings) {
  console.log(
    `file=${finding.file} rule=${finding.rule} count=${finding.count}`,
  );
}
console.log(
  "release-prerequisite provider-rotation=required scope=llm-key,db-password authority=external",
);

process.exitCode = unsafe ? 1 : 0;
