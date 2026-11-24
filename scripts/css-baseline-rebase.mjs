#!/usr/bin/env node
// css-winners 기준선 리베이스 도우미 — 기준선 조각이 충돌하면 손으로 풀지 않고 다시 만든다.
//
// 왜 필요한가: 기준선 조각(scripts/css-winners/**)은 현재 CSS 에서 **계산되는** 값이다. 조각끼리 충돌은
// 「두 PR 이 같은 조각의 같은 자리를 각자 다시 뜬 것」이라 어느 쪽을 고르느냐가 아니라, 합쳐진 CSS 에서
// 다시 뜨는 것이 유일한 정답이다. 충돌 표식을 지우며 줄을 고르면 두 PR 의 CSS 중 어느 하나와 어긋난
// 기준선이 커밋되고, 그러면 CI 에서 한 번 더 빨간불이다.
//
// 하는 일:
//   1. `git rebase <기준 브랜치>` 를 돈다(이미 리베이스·체리픽 진행 중이면 그것을 이어 간다).
//   2. 멈췄을 때 충돌 파일이 전부 기준선(조각·옛 단일 파일)이면 `--save-baseline` 로 다시 뜨고
//      `git add` 뒤 `--continue`. 멈출 때마다 반복한다.
//   3. CSS 소스까지 충돌했으면 멈추고 그 파일을 알려 준다 — 그건 사람이 푼다. 풀고 `git add` 한 뒤
//      `--continue` 로 다시 부른다(기준선 조각은 그때 자동으로 다시 만든다). 체리픽·`git am` 진행 중에도 같다.
//   4. 끝나면 게이트를 한 번 돈다. 줄 단위 자동 합치기가 조각을 어긋나게 만들었으면(한 쪽이 다른 쪽
//      조각의 승자를 뺐을 때) 다시 뜨서 한 커밋으로 얹는다.
//
// 사용:
//   npm run css-baseline:rebase                      # origin/main 위로 리베이스
//   npm run css-baseline:rebase -- main              # 다른 기준 브랜치
//   npm run css-baseline:rebase -- --continue        # 충돌을 손으로 푼 뒤 이어 가기
//   npm run css-baseline:rebase -- --abort           # 리베이스 취소
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_RE = /^scripts\/css-winners(?:\/|$)|^scripts\/css-winners\.baseline\.json$/;
const MAX_ROUNDS = 80;

// GIT_EDITOR=true: --continue 가 커밋 메시지 편집기를 열지 않게 한다.
function git(args) {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8", env: { ...process.env, GIT_EDITOR: "true" } });
  if (r.error) throw r.error;
  return { code: r.status ?? 1, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}
function run(args) {
  const r = spawnSync(args[0], args.slice(1), { cwd: repoRoot, stdio: "inherit", env: { ...process.env, GIT_EDITOR: "true" } });
  return r.status ?? 1;
}
const gitPath = (name) => resolve(repoRoot, git(["rev-parse", "--git-path", name]).out);
const lines = (s) => s.split("\n").filter(Boolean);

// 진행 중인 연속 적용의 종류. 리베이스는 백엔드에 따라 rebase-merge(merge)·rebase-apply(am) 디렉터리를 남기고,
// `git am` 도 rebase-apply 를 쓰지만 그 안에 `applying` 표식이 있다.
function inProgress() {
  if (existsSync(gitPath("rebase-merge"))) return "rebase";
  if (existsSync(gitPath("rebase-apply"))) return existsSync(gitPath("rebase-apply/applying")) ? "am" : "rebase";
  if (existsSync(gitPath("CHERRY_PICK_HEAD"))) return "cherry-pick";
  return null;
}
const RESUME = { rebase: ["git", "rebase", "--continue"], am: ["git", "am", "--continue"], "cherry-pick": ["git", "cherry-pick", "--continue"] };
const ABORT = { rebase: ["git", "rebase", "--abort"], am: ["git", "am", "--abort"], "cherry-pick": ["git", "cherry-pick", "--abort"] };
const KIND_LABEL = { rebase: "리베이스", am: "am", "cherry-pick": "체리픽" };

const unmerged = () => lines(git(["diff", "--name-only", "--diff-filter=U"]).out);
const staged = () => lines(git(["diff", "--cached", "--name-only"]).out);

function regenerate(reason) {
  console.log(`[css-baseline] ${reason}: 기준선을 --save-baseline 로 다시 만든다.`);
  const code = run([process.execPath, "scripts/check-css-winners.mjs", "--save-baseline"]);
  if (code !== 0) {
    console.error("[css-baseline] 재생성이 실패했다(위 출력). CSS 가 문법적으로 깨졌거나 충돌 표식이 남아 있다.");
    return false;
  }
  // 수정/삭제 충돌에서 옛 단일 파일은 작업 트리에 없고 인덱스에만 남는다(UU 가 아니라 UD). 그래서 add 가 아니라
  // 인덱스에서 빼는 쪽으로 푼다. 디스크에 있는 경로만 add 하면 충돌이 영원히 남는다(2026-11-24 실측).
  if (existsSync(resolve(repoRoot, "scripts/css-winners"))) {
    const add = git(["add", "-A", "--", "scripts/css-winners"]);
    if (add.code !== 0) { console.error(add.err); return false; }
  }
  const rm = git(["rm", "-q", "--cached", "--ignore-unmatch", "--", "scripts/css-winners.baseline.json"]);
  if (rm.code !== 0) { console.error(rm.err); return false; }
  const left = unmerged();
  if (left.length > 0) {
    console.error(`[css-baseline] 다시 만든 뒤에도 기준선 충돌이 남아 있다: ${left.join(", ")} — 손으로 확인한다.`);
    return false;
  }
  return true;
}

function usage() {
  console.log(`css-baseline:rebase — 기준선 조각 충돌을 재생성으로 풀며 리베이스한다.

  npm run css-baseline:rebase                origin/main 위로 리베이스
  npm run css-baseline:rebase -- <브랜치>     다른 기준 브랜치
  npm run css-baseline:rebase -- --continue  CSS 충돌을 손으로 풀고 git add 한 뒤 이어 가기
  npm run css-baseline:rebase -- --abort     리베이스·체리픽 취소`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) { usage(); return 0; }
  if (args.includes("--abort")) {
    const kind = inProgress();
    if (!kind) { console.log("진행 중인 리베이스·체리픽이 없다."); return 0; }
    return run(ABORT[kind]);
  }
  const continuing = args.includes("--continue");
  const upstream = args.find((a) => !a.startsWith("--")) ?? "origin/main";

  let kind = inProgress();
  if (!kind) {
    if (continuing) { console.log("진행 중인 리베이스·체리픽이 없다."); return 0; }
    if (git(["status", "--porcelain", "--untracked-files=no"]).out) {
      console.error("[css-baseline] 작업 트리에 커밋 안 한 변경이 있다. 먼저 커밋하거나 정리한다(`git stash` 는 쓰지 않는다 — 스택을 모든 워크트리가 공유한다).");
      return 1;
    }
    if (upstream.startsWith("origin/")) {
      const f = git(["fetch", "-q", "origin"]);
      if (f.code !== 0) { console.error(f.err); return 1; }
    }
    console.log(`[css-baseline] git rebase ${upstream}`);
    const code = run(["git", "rebase", upstream]);
    kind = inProgress();
    if (code !== 0 && !kind) return code; // 거절(예: 작업 트리가 더러움)이면 그대로 돌려준다.
  } else {
    console.log(`[css-baseline] 진행 중인 ${KIND_LABEL[kind]}을 이어 간다.`);
  }

  for (let round = 1; kind && round <= MAX_ROUNDS; round += 1) {
    const files = unmerged();
    const other = files.filter((f) => !BASELINE_RE.test(f));
    if (other.length > 0) {
      console.error(
        `[css-baseline] CSS 소스가 충돌했다 — 이건 사람이 푼다:\n${other.map((f) => `  ${f}`).join("\n")}\n` +
          "  푼 뒤 `git add <파일>` 하고 `npm run css-baseline:rebase -- --continue` 로 다시 부른다(기준선 조각은 그때 자동으로 다시 만든다).",
      );
      return 1;
    }
    if (files.length > 0) {
      console.log(`[css-baseline] 기준선 충돌 ${files.length}개:${files.slice(0, 5).map((f) => `\n  ${f}`).join("")}${files.length > 5 ? `\n  … 외 ${files.length - 5}개` : ""}`);
    }
    if (!regenerate(files.length > 0 ? "기준선 조각 충돌" : "이어 가기")) return 1;
    // 다시 만들었는데 스테이지도 충돌도 비어 있으면 이 도우미가 풀 수 있는 상태가 아니다.
    if (files.length === 0 && staged().length === 0) {
      // 리베이스: 그 커밋은 이미 기준 브랜치에 있는 내용이라 건너뛴다.
      if (kind === "rebase") {
        console.log("[css-baseline] 커밋할 내용이 없다 — 그 커밋은 건너뛴다.");
        const skip = run(["git", "rebase", "--skip"]);
        kind = inProgress();
        if (skip === 0 || kind) continue;
        return skip;
      }
      if (kind === "am") {
        console.error(
          "[css-baseline] 패치가 아무것도 적용되지 않았다(3-way 없는 git am 은 존재하지 않는 파일의 hunk 에서 통째로 멈춘다).\n" +
            "  `git am --abort` 뒤 `git am -3 <패치>` 로 다시 적용하고 충돌이 나면 `npm run css-baseline:rebase -- --continue` 를 부른다.",
        );
        return 1;
      }
      console.error("[css-baseline] 커밋할 내용이 없다 — `git cherry-pick --skip` 으로 그 커밋을 건너뛴다.");
      return 1;
    }
    const cont = run(RESUME[kind]);
    kind = inProgress();
    if (cont === 0 || kind) continue;
    // --continue 가 거절했다: 스테이지가 비어 있으면 그 커밋은 이미 기준 브랜치에 있는 내용이다.
    if (staged().length === 0 && kind === "rebase") {
      console.log("[css-baseline] 커밋할 내용이 없다 — 그 커밋은 건너뛴다.");
      const skip = run(["git", "rebase", "--skip"]);
      kind = inProgress();
      if (skip === 0 || kind) continue;
    }
    return cont;
  }
  if (kind) { console.error("[css-baseline] 멈춤이 너무 많다(80회). CSS 를 먼저 확인한다."); return 1; }

  const gate = () => run([process.execPath, "scripts/check-css-winners.mjs"]);
  if (gate() === 0) {
    console.log("[css-baseline] 리베이스 끝. 기준선은 현재 CSS 와 맞다.");
    return 0;
  }
  // 줄 단위 합치기는 조각마다는 맞지만 조각 **사이**(한 쪽이 뺀 승자를 다른 쪽 조각이 아직 가진 경우)는 어긋날 수 있다.
  if (!regenerate("리베이스 뒤 게이트가 승자 변경을 보고")) return 1;
  if (staged().length > 0) {
    const c = git(["commit", "-q", "-m", "chore(css): css-winners 기준선 재생성 (리베이스 뒤 자동)"]);
    if (c.code !== 0) { console.error(c.err); return 1; }
    console.log("[css-baseline] 어긋난 조각을 다시 만들어 한 커밋으로 얹었다.");
  }
  return gate();
}

process.exit(main());
