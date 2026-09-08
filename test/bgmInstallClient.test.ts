/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from "vitest";
import {
  applyBgmStatus,
  fetchBgmStatus,
  startBgmInstall,
  BGM_INSTALLED_EVENT,
  type BgmInstallStatus,
} from "@/editor/bgmInstallClient";
import { isBgmFileInstalled, setInstalledBgmFiles } from "@/assets/installedBgm";

const status = (over: Partial<BgmInstallStatus> = {}): BgmInstallStatus => ({
  expected: 281, installed: ["x.mp3"], installing: false,
  stagedBytes: 0, archiveBytes: 1304157696, remoteAllowed: true, error: null, ...over,
});

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init, headers: { "Content-Type": "application/json" } });

afterEach(() => { setInstalledBgmFiles(null); vi.unstubAllGlobals(); });

it("status 를 적용하면 판정이 갱신되고 완료 이벤트가 뜬다", () => {
  const seen: string[] = [];
  const listener = () => seen.push("fired");
  window.addEventListener(BGM_INSTALLED_EVENT, listener);
  try {
    applyBgmStatus(status());
    expect(isBgmFileInstalled("x.mp3")).toBe(true);
    expect(isBgmFileInstalled("other.mp3")).toBe(false);
    expect(seen).toEqual(["fired"]);
  } finally { window.removeEventListener(BGM_INSTALLED_EVENT, listener); }
});

it("설치 중 status 는 적용하되 완료 이벤트는 내지 않는다", () => {
  const seen: string[] = [];
  const listener = () => seen.push("fired");
  window.addEventListener(BGM_INSTALLED_EVENT, listener);
  try {
    applyBgmStatus(status({ installing: true }));
    expect(seen).toEqual([]);
  } finally { window.removeEventListener(BGM_INSTALLED_EVENT, listener); }
});

it("엔드포인트가 없는 배포 환경에서는 null 을 주고 조용히 넘어간다", async () => {
  // 정적 배포는 SPA 폴백 HTML 을 200 으로 준다 — 상태 코드로는 구분할 수 없다.
  vi.stubGlobal("fetch", vi.fn(async () => new Response("<!doctype html>", {
    status: 200, headers: { "Content-Type": "text/html" } })));
  expect(await fetchBgmStatus()).toBeNull();
});

it("네트워크가 끊겨도 예외를 던지지 않는다", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("connection refused"); }));
  expect(await fetchBgmStatus()).toBeNull();
});

it("정상 status 는 그대로 돌려준다", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => json(status({ installed: ["a.mp3", "b.mp3"] }))));
  expect((await fetchBgmStatus())?.installed).toEqual(["a.mp3", "b.mp3"]);
});

it("403 은 사용자에게 보여줄 이유를 담아 돌려준다", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => json({ error: "원격 접속에서는 opt-in 이 필요합니다." }, { status: 403 })));
  const result = await startBgmInstall();
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/opt-in/);
});

it("202 는 성공으로 본다", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => json({ started: true }, { status: 202 })));
  expect(await startBgmInstall()).toEqual({ ok: true, error: null });
});
