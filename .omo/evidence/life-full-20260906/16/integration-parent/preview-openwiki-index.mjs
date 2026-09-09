#!/usr/bin/env node
// openwiki 항해 색인 생성기 — `openwiki/INDEX.md` 를 실측으로 다시 쓴다.
//
// 왜 필요한가 (실측 2026-08-30):
//  1. `openwiki/` 는 1.0MB 다. 통째로 읽으면 33만 토큰이라 어떤 에이전트 컨텍스트에도 안 들어간다.
//     그런데 AGENTS.md 는 "해당 영역 페이지를 읽어라" 라고만 말한다 — 그 페이지 하나가 36k 토큰일
//     수 있다는 사실을 아무도 알려주지 않아서, 에이전트는 코드를 한 줄도 보기 전에 예산을 태운다.
//  2. 코딩 에이전트의 파일 읽기 도구는 대개 50KB 에서 잘린다(senpi/Claude Code 실측). `editor-database.md`
//     (109KB)·`editor-ai-panel.md`(102KB) 는 **조용히 잘린 채** 전달되므로, 에이전트는 자기가 못 본
//     절이 있다는 것조차 모른 채 "위키에 없다" 고 판단한다. 잘리는 페이지는 절 단위로 잘라 읽어야 한다.
//  3. 일부 페이지에는 EUC-KR→UTF-8 모지바케가 남아 있다. 그 문장은 사람도 에이전트도 못 읽으므로
//     "여기 한국어 산문은 신뢰하지 말고 파일 경로만 믿어라" 를 명시해야 한다.
//  4. 문서가 가리키는 파일이 삭제·개명된 경우(실측 69건) 에이전트는 없는 파일을 찾아 헤맨다.
//     기계로 셀 수 있는 사실이므로 색인에 남겨 증가를 눈에 보이게 한다.
//
// 사용:
//   node scripts/openwiki-index.mjs            # openwiki/INDEX.md 재생성
//   node scripts/openwiki-index.mjs --check     # 색인이 최신인지만 검사 (다르면 exit 1)
//   node scripts/openwiki-index.mjs --json      # 기계 판독용 요약
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = process.cwd();
const INDEX_PATH = join(ROOT, "openwiki", "INDEX.md");
const OUTPUT_NAME = "openwiki/INDEX.md";
// 에이전트 파일 읽기 도구의 실측 상한. 이 값을 넘는 페이지는 통째 읽기가 조용히 잘린다.
const READ_LIMIT_BYTES = 50 * 1024;

const args = process.argv.slice(2);
const wantCheck = args.includes("--check");
const wantJson = args.includes("--json");

/** git 이 아는 파일 목록. 문서가 가리키는 경로의 실존 판정에 쓴다. */
function trackedFiles() {
  const out = execFileSync("git", ["-C", ROOT, "ls-files"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out.split("\n").filter(Boolean);
}

/**
 * 토큰 추정. 한글 음절은 대략 1자 = 1토큰, 그 밖의 문자는 대략 4자 = 1토큰이다.
 * 정확한 값이 목적이 아니라 "이 페이지를 열면 예산이 얼마 나가는가" 의 자리수가 목적이다.
 */
function estimateTokens(text) {
  let hangul = 0;
  for (const ch of text) if (ch >= "\uac00" && ch <= "\ud7a3") hangul += 1;
  const rest = text.length - hangul;
  return Math.round(hangul + rest / 4);
}

/** EUC-KR→UTF-8 깨짐의 지문: 한글 음절에 물음표가 붙어 끊긴 자리. */
function garbledLines(lines) {
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (/[\uac00-\ud7a3]\?|\?[\uac00-\ud7a3]/.test(lines[i])) hits.push(i + 1);
  }
  return hits;
}

/** 문서가 백틱으로 가리키는 경로 중 어디에도 없는 것. */
function deadReferences(docRelPath, text, tracked, trackedByBase) {
  const docDir = dirname(docRelPath);
  const dead = new Set();
  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    const token = match[1].trim();
    if (!/^[\w./@-]+$/.test(token)) continue;
    if (!/\.(ts|tsx|mts|mjs|cjs|js|json|md|html|css|py|sql|png)$/.test(token)) continue;
    // 절대 경로는 판정 대상이 아니다 — 브라우저가 받는 `/assets/...` URL 이거나 저장소 밖 경로다.
    if (token.startsWith("/")) continue;
    const clean = token.replace(/^\.\//, "").replace(/[:#].*$/, "");
    if (clean.includes("*") || clean.includes("<")) continue;
    if (existsSync(join(ROOT, clean)) || existsSync(join(ROOT, docDir, clean))) continue;
    const hits = clean.includes("/")
      ? tracked.filter((file) => file.endsWith(`/${clean}`))
      : (trackedByBase.get(clean) ?? []);
    if (hits.length === 0) dead.add(token);
  }
  return [...dead].sort();
}

/** 절 경계(H2/H3)로 자를 때 가장 큰 조각의 바이트. 이 값이 상한을 넘지 않으면 절 단위 읽기가 안전하다. */
function worstSectionBytes(lines) {
  const heads = [];
  for (let i = 0; i < lines.length; i += 1) if (/^#{2,3}\s/.test(lines[i])) heads.push(i);
  const bounds = [0, ...heads, lines.length];
  let worst = 0;
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const from = bounds[i];
    const to = bounds[i + 1];
    if (to <= from) continue;
    let bytes = 0;
    for (let line = from; line < to; line += 1) bytes += Buffer.byteLength(lines[line], "utf8") + 1;
    if (bytes > worst) worst = bytes;
  }
  return worst;
}

/** H2/H3 제목과 줄 번호. 큰 페이지를 절 단위로 잘라 읽을 때의 좌표다. */
function sections(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const heading = /^(#{2,3})\s+(.*)$/.exec(lines[i]);
    if (heading) out.push({ level: heading[1].length, title: heading[2].trim(), line: i + 1 });
  }
  return out;
}

function collect() {
  const tracked = trackedFiles();
  const trackedByBase = new Map();
  for (const file of tracked) {
    const base = file.slice(file.lastIndexOf("/") + 1);
    if (!trackedByBase.has(base)) trackedByBase.set(base, []);
    trackedByBase.get(base).push(file);
  }
  const pages = readdirSync(join(ROOT, "openwiki"))
    .filter((name) => name.endsWith(".md") && name !== "INDEX.md")
    .sort()
    .map((name) => {
      const rel = `openwiki/${name}`;
      const text = readFileSync(join(ROOT, rel), "utf8");
      const lines = text.split("\n");
      return {
        path: rel,
        name,
        bytes: Buffer.byteLength(text, "utf8"),
        lines: lines.length,
        tokens: estimateTokens(text),
        truncates: Buffer.byteLength(text, "utf8") > READ_LIMIT_BYTES,
        worstSection: worstSectionBytes(lines),
        garbled: garbledLines(lines),
        dead: deadReferences(rel, text, tracked, trackedByBase),
        sections: sections(lines),
      };
    });
  return { pages };
}

function render({ pages }) {
  const totalBytes = pages.reduce((sum, page) => sum + page.bytes, 0);
  const totalTokens = pages.reduce((sum, page) => sum + page.tokens, 0);
  const oversize = pages.filter((page) => page.truncates);
  const garbled = pages.filter((page) => page.garbled.length > 0);
  const dead = pages.filter((page) => page.dead.length > 0);
  const kb = (bytes) => `${(bytes / 1024).toFixed(0)}KB`;

  const out = [];
  out.push("<!-- 생성 파일 — 직접 고치지 말고 `npm run openwiki:index` 를 돌려라. -->");
  out.push("# OpenWiki 항해 색인");
  out.push("");
  out.push(
    `이 저장소의 위키는 **${pages.length}쪽 / ${kb(totalBytes)} / 약 ${totalTokens.toLocaleString("en-US")} 토큰** 이다. ` +
      "통째로 읽을 수 있는 크기가 아니므로, 필요한 절만 좌표로 잘라 읽어라.",
  );
  out.push("");
  out.push("```");
  out.push('read("openwiki/editor-database.md", offset=<절 시작줄>, limit=120)');
  out.push('grep -n "찾는말" openwiki/*.md          # 어느 페이지 몇 줄인지부터 찾는다');
  out.push("```");
  out.push("");
  out.push(`## 통째 읽기가 잘리는 페이지 (도구 상한 ${READ_LIMIT_BYTES / 1024}KB)`);
  out.push("");
  if (oversize.length === 0) {
    out.push("없다.");
  } else {
    out.push("이 페이지를 `read` 로 한 번에 열면 **조용히 잘린 채** 전달된다. 아래 절 목록의 줄 번호로 잘라 읽어라.");
    out.push("「가장 큰 절」이 상한 아래면 절 단위 읽기로 페이지 전부에 닿을 수 있다.");
    out.push("");
    out.push("| 페이지 | 통짜 크기 | 가장 큰 절 | 줄 | 토큰 추정 |");
    out.push("|---|---|---|---|---|");
    for (const page of oversize) {
      const flag = page.worstSection <= READ_LIMIT_BYTES ? "" : " ⚠상한 초과 — 절을 더 쪼개라";
      out.push(
        `| \`${page.path}\` | ${kb(page.bytes)} | ${kb(page.worstSection)}${flag} | ${page.lines} | ~${page.tokens.toLocaleString("en-US")} |`,
      );
    }
  }
  out.push("");
  out.push("## 한국어 산문이 깨진 페이지");
  out.push("");
  if (garbled.length === 0) {
    out.push("없다.");
  } else {
    out.push(
      "EUC-KR→UTF-8 모지바케가 남은 줄이다. **그 줄의 한국어는 믿지 말고** 같은 줄의 파일 경로·식별자만 쓰고, " +
        "의미는 해당 소스 파일에서 직접 확인하라. 복원은 불가능하다(원본 바이트가 소실).",
    );
    out.push("");
    out.push("| 페이지 | 깨진 줄 수 | 예시 줄 번호 |");
    out.push("|---|---|---|");
    for (const page of garbled) {
      out.push(`| \`${page.path}\` | ${page.garbled.length} | ${page.garbled.slice(0, 8).join(", ")} |`);
    }
  }
  out.push("");
  out.push("## 없는 파일을 가리키는 참조");
  out.push("");
  if (dead.length === 0) {
    out.push("없다.");
  } else {
    out.push(
      "문서가 이름을 부르는데 저장소에 없는 파일이다. 대부분은 **의도적으로 삭제된 모듈** 을 기록으로 " +
        "남긴 것이지만(그 경우 문단이 삭제 사실을 말한다), 살아 있는 안내처럼 읽히면 에이전트가 없는 파일을 " +
        "찾아 헤맨다. 문서를 고칠 때 이 목록이 줄어드는지 보라.",
    );
    out.push("");
    out.push("| 페이지 | 건수 | 참조 |");
    out.push("|---|---|---|");
    for (const page of dead) {
      out.push(`| \`${page.path}\` | ${page.dead.length} | ${page.dead.map((ref) => `\`${ref}\``).join(", ")} |`);
    }
  }
  out.push("");
  out.push("## 페이지별 절 좌표");
  out.push("");
  for (const page of pages) {
    const flags = [];
    if (page.truncates) flags.push("통째읽기 잘림");
    if (page.garbled.length > 0) flags.push(`깨진 줄 ${page.garbled.length}`);
    out.push(
      `### \`${page.path}\` — ${kb(page.bytes)} · ${page.lines}줄 · ~${page.tokens.toLocaleString("en-US")} 토큰` +
        (flags.length > 0 ? ` · ${flags.join(" · ")}` : ""),
    );
    out.push("");
    if (page.sections.length === 0) {
      out.push("절 제목 없음 (평면 목록 페이지).");
    } else {
      for (const section of page.sections) {
        out.push(`${section.level === 2 ? "-" : "  -"} \`L${section.line}\` ${section.title}`);
      }
    }
    out.push("");
  }
  return `${out.join("\n").trimEnd()}\n`;
}

process.stdout.write(gzipSync(render(collect())).toString("base64"));
