// 체크아웃별 고정 dev 포트 — 배정 규칙은 순수 함수라 여기서 고정한다.
// 2026-09-17 실측: 워크트리 21개 중 9개가 메인의 .env.local 을 손으로 복사해 DEV_SERVER_PORT=9841 을
// 그대로 물고 있었고, `npm run dev` 는 워크트리에서도 9999 를 잡았다. 그 두 구멍이 다시 열리지 않게 한다.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MAIN_DEV_PORT,
  PORT_BASE,
  PORT_COUNT,
  PREVIEW_PORT,
  claimedPortsByOthers,
  decideMainDev,
  decideWorktreePort,
  isLinkedWorktree,
  parsePortArg,
  parseWorktreeList,
  readEnvPort,
  stripEnvPort,
  withoutPortArg,
  writeEnvPort,
} from "../scripts/lib/worktreeDevPort.mjs";

describe("worktreeDevPort · .env.local 읽기/쓰기", () => {
  it("배정 줄을 읽고, 없으면 null", () => {
    expect(readEnvPort("A=1\nDEV_SERVER_PORT=9841\nB=2\n")).toBe(9841);
    expect(readEnvPort("A=1\n")).toBeNull();
    expect(readEnvPort(null)).toBeNull();
  });

  it("있으면 그 줄만 바꾸고 다른 줄·끝 개행은 그대로", () => {
    expect(writeEnvPort("A=1\nDEV_SERVER_PORT=9841\nB=2\n", 9804)).toBe("A=1\nDEV_SERVER_PORT=9804\nB=2\n");
  });

  it("없으면 끝에 붙인다", () => {
    expect(writeEnvPort("A=1\n", 9804)).toBe("A=1\nDEV_SERVER_PORT=9804\n");
    expect(writeEnvPort("", 9804)).toBe("DEV_SERVER_PORT=9804\n");
  });

  it("복사해 온 원본의 배정 줄은 지운다 — 원본의 포트는 원본의 것", () => {
    expect(stripEnvPort("A=1\nDEV_SERVER_PORT=9841\nB=2\n")).toBe("A=1\nB=2\n");
  });
});

describe("worktreeDevPort · 배정 규칙", () => {
  const claimed = new Map<number, string[]>([[9801, ["/wt/a"]], [9841, ["/main", "/wt/b"]]]);

  it("유일하고 예약이 아니면 그대로 둔다(범위 밖 값도)", () => {
    expect(decideWorktreePort({ current: 9805, claimed })).toMatchObject({ port: 9805, reason: "kept" });
    expect(decideWorktreePort({ current: 9897, claimed })).toMatchObject({ port: 9897, reason: "kept" });
  });

  it("없으면 범위 안에서 남이 안 쥔 첫 포트", () => {
    expect(decideWorktreePort({ current: null, claimed })).toMatchObject({ port: 9802, reason: "missing" });
  });

  it("남과 겹치면 미배정으로 보고 새로 준다 — 손으로 복사한 9841 이 이 경우다", () => {
    const decision = decideWorktreePort({ current: 9841, claimed });
    expect(decision).toMatchObject({ port: 9802, reason: "duplicate", previous: 9841 });
    expect(decision.holders).toEqual(["/main", "/wt/b"]);
  });

  it("예약 포트(9999 메인 dev·9888 preview)는 갖지도, 배정하지도 않는다", () => {
    expect(decideWorktreePort({ current: MAIN_DEV_PORT, claimed })).toMatchObject({ reason: "reserved" });
    // 9888 이 배정 범위 안에 있다 — 스캔이 건너뛰어야 한다.
    const packed = new Map(Array.from({ length: 87 }, (_, i) => [9801 + i, ["/x"]] as [number, string[]]));
    expect(decideWorktreePort({ current: null, claimed: packed }).port).toBe(9889);
    expect(PREVIEW_PORT).toBe(9888);
  });

  it("범위가 다 차면 정리하라고 던진다", () => {
    const full = new Map(Array.from({ length: PORT_COUNT }, (_, i) => [PORT_BASE + i, ["/x"]] as [number, string[]]));
    expect(() => decideWorktreePort({ current: null, claimed: full })).toThrow(/다 찼습니다/);
  });

  it("git worktree list --porcelain 을 읽고, 자기 자신은 빼고 남의 포트만 모은다", () => {
    const porcelain = [
      "worktree /main", "HEAD aaa", "branch refs/heads/main", "",
      "worktree /wt/a", "HEAD bbb", "branch refs/heads/feat/a", "",
      "worktree /wt/me", "HEAD ccc", "detached", "",
    ].join("\n");
    const entries = parseWorktreeList(porcelain);
    expect(entries).toEqual([
      { path: "/main", branch: "main" }, { path: "/wt/a", branch: "feat/a" }, { path: "/wt/me", branch: null },
    ]);
    const env: Record<string, string | null> = { "/main": "DEV_SERVER_PORT=9841\n", "/wt/a": "DEV_SERVER_PORT=9841\n", "/wt/me": "DEV_SERVER_PORT=9841\n" };
    const claimedByOthers = claimedPortsByOthers(entries, "/wt/me", (path: string) => env[path] ?? null);
    expect(claimedByOthers.get(9841)).toEqual(["/main", "/wt/a"]);
  });
});

describe("worktreeDevPort · npm run dev 가드와 인자", () => {
  it("메인 체크아웃은 그대로 9999", () => {
    expect(decideMainDev({ linked: false, explicitPort: null })).toEqual({ ok: true, port: MAIN_DEV_PORT });
  });

  it("워크트리에서 포트 없는 npm run dev 는 거절 — 메인 포트를 잡는다", () => {
    expect(decideMainDev({ linked: true, explicitPort: null }).ok).toBe(false);
    expect(decideMainDev({ linked: true, explicitPort: MAIN_DEV_PORT }).ok).toBe(false);
    expect(decideMainDev({ linked: true, explicitPort: PREVIEW_PORT }).ok).toBe(false);
  });

  it("워크트리라도 명시 --port(예약 아님)는 통과 — playwright webServer 가 이렇게 부른다", () => {
    expect(decideMainDev({ linked: true, explicitPort: 9804 })).toEqual({ ok: true, port: 9804 });
  });

  it("--port N / --port=N 은 마지막 값, 나머지 인자는 보존", () => {
    expect(parsePortArg(["--host", "127.0.0.1", "--port", "9173", "--port=9804"])).toBe(9804);
    expect(parsePortArg(["--host", "127.0.0.1"])).toBeNull();
    expect(withoutPortArg(["--host", "127.0.0.1", "--port", "9173", "--strictPort", "--port=9804"])).toEqual(["--host", "127.0.0.1", "--strictPort"]);
  });
});

describe("worktreeDevPort · 링크된 워크트리 판별", () => {
  const dirs: string[] = [];
  afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

  it(".git 이 gitfile 이면 워크트리, 디렉터리면 메인 체크아웃, 없으면 아니다", () => {
    const linked = mkdtempSync(join(tmpdir(), "oprn-wt-")); dirs.push(linked);
    writeFileSync(join(linked, ".git"), "gitdir: /main/.git/worktrees/x\n");
    const main = mkdtempSync(join(tmpdir(), "oprn-main-")); dirs.push(main);
    mkdirSync(join(main, ".git"));
    const plain = mkdtempSync(join(tmpdir(), "oprn-plain-")); dirs.push(plain);
    expect(isLinkedWorktree(linked)).toBe(true);
    expect(isLinkedWorktree(main)).toBe(false);
    expect(isLinkedWorktree(plain)).toBe(false);
  });
});
