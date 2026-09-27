#!/usr/bin/env node
// 편집기 화면에 나갈 수 있는 한국어 원문을 소스에서 뽑는다 — 번역 카탈로그(src/i18n/catalogs/*.json)의 키 목록.
//
// 사용:
//   node scripts/i18n/extract-ui-strings.mjs                 # 원문 수·누락 수 요약
//   node scripts/i18n/extract-ui-strings.mjs --missing en    # en 카탈로그에 없는 원문 JSON 배열
//   node scripts/i18n/extract-ui-strings.mjs --json          # 원문 전체 JSON 배열
//
// 키 규칙(런타임 src/i18n/translator.ts 와 같다): 공백은 한 칸으로 접고 앞뒤를 자른다.
// 템플릿 리터럴과 문자열 덧셈은 동적 자리를 {0} {1} … 로 적는다.
import ts from "typescript";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
const SCAN_ROOTS = ["src/editor", "src/app", "src/project/eventCommands", "src/i18n", "src/ai/piAgent/applyMode.ts", "src/project/store.ts"];
// 저작 콘텐츠(기본 맵·예제 이름)와 AI 도구 본문은 화면 문구가 아니라 데이터·모델 입력이다.
const EXCLUDED_DIRS = ["src/editor/content", "src/editor/tools"];
const HANGUL = /[\uac00-\ud7a3]/;
const MAX_KEY_LENGTH = 300;
const MIN_TEMPLATE_HANGUL = 2;

export function normalizeSource(text) {
  return text.replace(/\s+/g, " ").trim();
}

function isExcluded(path) {
  const rel = relative(ROOT, path);
  return EXCLUDED_DIRS.some((dir) => rel === dir || rel.startsWith(`${dir}/`));
}

function listFiles(dir, out) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (isExcluded(path)) continue;
    if (statSync(path).isDirectory()) listFiles(path, out);
    else if (path.endsWith(".ts") && !path.endsWith(".test.ts") && !path.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

function inConsoleOrError(node) {
  for (let cursor = node.parent; cursor; cursor = cursor.parent) {
    if (ts.isCallExpression(cursor) && /^console\./.test(cursor.expression.getText())) return true;
    if (ts.isNewExpression(cursor) && /Error$/.test(cursor.expression.getText())) return true;
    if (ts.isStatement(cursor)) return false;
  }
  return false;
}

function stringPart(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function templateKey(node) {
  let key = node.head.text;
  node.templateSpans.forEach((span, index) => {
    key += `{${index}}${span.literal.text}`;
  });
  return key;
}

function concatKey(node) {
  const parts = [];
  const flatten = (current) => {
    if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      flatten(current.left);
      flatten(current.right);
    } else if (ts.isParenthesizedExpression(current)) {
      flatten(current.expression);
    } else {
      parts.push(current);
    }
  };
  flatten(node);
  if (!parts.some((part) => stringPart(part) !== null)) return null;
  let key = "";
  let slot = 0;
  for (const part of parts) {
    const text = stringPart(part);
    if (text !== null) key += text;
    else if (ts.isTemplateExpression(part)) {
      key += part.head.text;
      for (const span of part.templateSpans) key += `{${slot++}}${span.literal.text}`;
    } else key += `{${slot++}}`;
  }
  return key;
}

function acceptable(key) {
  if (!HANGUL.test(key) || key.length > MAX_KEY_LENGTH) return false;
  if ((key.match(/\n/g) ?? []).length >= 2) return false;
  if (key.includes("{0}")) {
    const fixed = key.replace(/\{\d+\}/g, "");
    if ((fixed.match(/[\uac00-\ud7a3]/g) ?? []).length < MIN_TEMPLATE_HANGUL) return false;
  }
  return true;
}

export function extractUiStrings() {
  const keys = new Set();
  const add = (raw) => {
    const key = normalizeSource(raw);
    if (acceptable(key)) keys.add(key);
  };
  const files = SCAN_ROOTS.flatMap((entry) => {
    const path = join(ROOT, entry);
    if (!existsSync(path)) return [];
    return statSync(path).isDirectory() ? listFiles(path, []) : [path];
  });
  for (const path of files) {
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !inConsoleOrError(node)) add(node.text);
      else if (ts.isTemplateExpression(node) && !inConsoleOrError(node)) add(templateKey(node));
      else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        !(ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken) &&
        !inConsoleOrError(node)
      ) {
        const key = concatKey(node);
        if (key) add(key);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return [...keys].sort();
}

function readCatalog(locale) {
  const path = join(ROOT, "src/i18n/catalogs", `${locale}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const keys = extractUiStrings();
  const missingIndex = args.indexOf("--missing");
  if (missingIndex >= 0) {
    const catalog = readCatalog(args[missingIndex + 1] ?? "en");
    process.stdout.write(`${JSON.stringify(keys.filter((key) => !catalog[key]), null, 1)}\n`);
  } else if (args.includes("--json")) {
    process.stdout.write(`${JSON.stringify(keys, null, 1)}\n`);
  } else {
    const summary = { sources: keys.length };
    for (const locale of ["en", "ja", "zh"]) {
      const catalog = readCatalog(locale);
      summary[`${locale}Missing`] = keys.filter((key) => !catalog[key]).length;
    }
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  }
}
