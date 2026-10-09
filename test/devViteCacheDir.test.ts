// dev 서버의 vite 최적화 캐시 위치 — 공유 node_modules 를 쓰는 체크아웃은 자기 캐시를 가져야 한다.
// 2026-09-24 실측: `npm run wt` 는 워크트리 node_modules 를 메인으로 통째 심링크한다(92개 중 46개).
// vite 의 캐시 해시는 root 를 포함하므로 root 가 다른 dev 서버끼리 공유 `node_modules/.vite` 를
// 번갈아 재최적화해 덮어쓴다 — 동시에 떠 있으면 상대 페이지가 강제 리로드되거나 서버가 죽는다.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { devViteCacheEnv } from "../scripts/lib/viteCacheDir.mjs";

const scratch: string[] = [];

function dir(): string {
  const path = mkdtempSync(join(tmpdir(), "vite-cache-dir-"));
  scratch.push(path);
  return path;
}

afterEach(() => {
  for (const path of scratch.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("devViteCacheEnv", () => {
  it("node_modules 가 다른 체크아웃으로 심링크돼 있으면 체크아웃 안의 .vite-cache/dev 를 준다", () => {
    const main = dir();
    mkdirSync(join(main, "node_modules"));
    const worktree = dir();
    symlinkSync(join(main, "node_modules"), join(worktree, "node_modules"), "dir");

    expect(devViteCacheEnv(worktree, {})).toEqual({ VITE_CACHE_DIR: join(worktree, ".vite-cache", "dev") });
  });

  it("자기 node_modules 디렉터리를 가진 체크아웃(메인·패키지별 링크)은 vite 기본값을 그대로 둔다", () => {
    const own = dir();
    mkdirSync(join(own, "node_modules"));

    expect(devViteCacheEnv(own, {})).toEqual({});
  });

  it("명시한 VITE_CACHE_DIR 은 덮지 않는다 — QA 스크립트의 전용 캐시가 이긴다", () => {
    const main = dir();
    mkdirSync(join(main, "node_modules"));
    const worktree = dir();
    symlinkSync(join(main, "node_modules"), join(worktree, "node_modules"), "dir");

    expect(devViteCacheEnv(worktree, { VITE_CACHE_DIR: "/tmp/qa-cache" })).toEqual({});
  });

  it("node_modules 가 없으면 아무것도 정하지 않는다(런처가 따로 알린다)", () => {
    expect(devViteCacheEnv(dir(), {})).toEqual({});
  });
});
