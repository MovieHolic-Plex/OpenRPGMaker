#!/usr/bin/env node
// 월드맵 키트(공개 저장소 oprn-worldmap-kit)를 고정 커밋으로 받아 둔다.
//
//   npm run worldmap-kit:sync              # .worldmap-kit 을 lock 의 커밋으로 맞춘다(없으면 clone)
//   npm run worldmap-kit:sync -- --check   # 맞는지만 본다(다르면 exit 1)
//   npm run worldmap-kit:sync -- --dir <경로>   # 다른 곳(예: 다른 체크아웃과 공유)
//
// 받은 곳은 진짜 git 체크아웃이다. 하네스 bake 가 selected/ 를 쓰면 거기서 브랜치를 따 공개 저장소에 PR → 머지 → lock 의 commit 갱신.
// 체크아웃에 커밋 안 한 변경이 있으면 덮지 않는다(--force 로만).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(readFileSync(join(root, "tiledata/worldmap-kit.lock.json"), "utf8"));
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const dir = resolve(root, opt("--dir") || process.env.OPRN_WORLDMAP_KIT_CHECKOUT || lock.checkout);
const git = (...args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
if (!/^[0-9a-f]{40}$/.test(lock.commit)) throw new Error(`lock 의 commit 이 40자 해시가 아니다: ${lock.commit}`);

const head = () => { try { return git("rev-parse", "HEAD"); } catch { return null; } };
if (flag("--check")) {
  const now = existsSync(join(dir, ".git")) ? head() : null;
  const dirty = now ? git("status", "--porcelain") : "";
  console.log(JSON.stringify({ dir, kit: join(dir, lock.kitPath), pinned: lock.commit, head: now, dirty: Boolean(dirty) }));
  process.exit(now === lock.commit ? 0 : 1);
}
if (!existsSync(join(dir, ".git"))) {
  execFileSync("git", ["clone", "--no-checkout", lock.repo, dir], { stdio: "inherit" });
} else if (git("status", "--porcelain") && !flag("--force")) {
  throw new Error(`${dir} 에 커밋 안 한 변경이 있다 — 공개 저장소에 올리거나 치운 뒤 다시 돌려라(덮으려면 --force).`);
}
try { git("cat-file", "-e", `${lock.commit}^{commit}`); } catch { execFileSync("git", ["-C", dir, "fetch", "origin"], { stdio: "inherit" }); }
execFileSync("git", ["-C", dir, "checkout", ...(flag("--force") ? ["--force"] : []), "--detach", lock.commit], { stdio: "inherit" });
console.log(`월드맵 키트 ${lock.commit.slice(0, 12)} → ${join(dir, lock.kitPath)}`);
