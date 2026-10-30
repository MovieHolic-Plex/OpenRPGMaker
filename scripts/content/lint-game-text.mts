#!/usr/bin/env node
// 게임 글 윤문 린트(코딩 에이전트용) — general-good-writing(코드 연규 code-yeongyu)의 polish-lint 를 판정 모델 없이 로컬 규칙만으로 돌린다.
// 편집기 조수의 lint_dialogue 와 같은 린터(src/vendor/general-good-writing/local.ts)다. 지침: assistant-skills/dialogue-polish/SKILL.md.
//   node scripts/content/lint-game-text.mts <파일> [fiction|essay|blog|report|changelog|chat] [--lang ko|en]
// 파일은 한 줄에 대사 하나(대사 안 \n 은 공백으로 편다). 키·네트워크를 쓰지 않는다.
import { readFileSync } from "node:fs";
import { lintLocal } from "../../src/vendor/general-good-writing/local.ts";

const args = process.argv.slice(2);
const langAt = args.indexOf("--lang");
const lang = langAt >= 0 ? args.splice(langAt, 2)[1] : undefined;
const [file, profile = "fiction"] = args;
if (!file) {
  console.error("사용법: node scripts/content/lint-game-text.mts <파일> [fiction] [--lang ko|en]");
  process.exit(2);
}
const result = await lintLocal(readFileSync(file, "utf8"), {
  profile: profile as "fiction",
  ...(lang === "ko" || lang === "en" ? { lang } : {}),
});
console.log(result.text("ko"));
