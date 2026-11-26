#!/usr/bin/env node
// 편집기 번역 카탈로그(src/i18n/catalogs/{en,ja,zh}.json)를 키 정렬 · 한 줄에 한 항목으로 맞춘다.
//
// 왜 (2026-11-26): 새 문구를 늘 파일 끝에 덧붙여, 카탈로그를 건드리는 PR 두 개가 같은 끝 줄(마지막 항목의 쉼표와 `}`)을
// 고쳐 매번 충돌했다(#5187·#5203 이 CI 한 판 사이에 main 과 두 번씩 충돌). 키를 정렬된 자리에 넣으면 서로 다른 키는
// 서로 다른 줄에 들어가 git 이 줄 단위로 합친다. 같은 키를 두 PR 이 넣거나 이웃한 키일 때만 충돌한다.
//
// 비교는 JS 문자열 기본 순서(UTF-16 코드 단위)다 — ICU·로캘과 무관하게 어디서나 같은 결과를 낸다.
// 번역 결과는 순서와 무관하다(정확 일치는 Map, 템플릿은 고정부 길이로 고른다). 같은 길이의 템플릿이 겹칠 때와
// 정규화 뒤 같은 키가 둘일 때만 순서가 결과를 바꿀 수 있어, 그런 키가 있으면 --write 를 거절한다.
//
// 사용: node scripts/i18n/sort-catalogs.mjs           # 정렬해 다시 쓴다
//       node scripts/i18n/sort-catalogs.mjs --check   # 정렬·형식이 어긋나면 exit 1 (CI)
// 충돌 풀기: 카탈로그에서 충돌이 나면 양쪽 줄을 모두 남기고(<<< === >>> 표시만 지우고) 이 스크립트를 돌린다.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LOCALES = ["en", "ja", "zh"];
const check = process.argv.includes("--check");

export function formatCatalog(entries) {
  const lines = entries.map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`);
  return `{\n${lines.join(",\n")}\n}\n`;
}

export function sortEntries(catalog) {
  return Object.entries(catalog).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

const normalize = (text) => text.replace(/\s+/gu, " ").trim();

let failed = 0;
for (const locale of LOCALES) {
  const file = join(ROOT, "src/i18n/catalogs", `${locale}.json`);
  const text = readFileSync(file, "utf8");
  let catalog;
  try {
    catalog = JSON.parse(text);
  } catch (error) {
    console.error(`${locale}.json: JSON 이 아니다 — 충돌 표시(<<<<<<< ======= >>>>>>>)가 남았는지 본다. ${error.message}`);
    failed += 1;
    continue;
  }
  const seen = new Map();
  const collisions = [];
  for (const key of Object.keys(catalog)) {
    const norm = normalize(key);
    if (seen.has(norm) && catalog[seen.get(norm)] !== catalog[key]) collisions.push(`${seen.get(norm)} | ${key}`);
    seen.set(norm, key);
  }
  if (collisions.length > 0) {
    console.error(`${locale}.json: 공백만 다른 키가 다른 번역을 가진다(순서가 결과를 바꾼다) — 하나로 합친다:\n  ${collisions.join("\n  ")}`);
    failed += 1;
    continue;
  }
  const sorted = formatCatalog(sortEntries(catalog));
  if (sorted === text) continue;
  if (check) {
    console.error(`${locale}.json: 키 정렬·한 줄 한 항목이 아니다 — node scripts/i18n/sort-catalogs.mjs 를 돌려 고친다.`);
    failed += 1;
  } else {
    writeFileSync(file, sorted);
    console.log(`${locale}.json: 정렬해 다시 썼다 (${Object.keys(catalog).length}개).`);
  }
}
process.exit(failed > 0 ? 1 : 0);
