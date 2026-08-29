import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "@/util/downloadBlob";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  vi.useFakeTimers();
  (globalThis as { URL?: unknown }).URL = {
    createObjectURL: () => "blob:fake",
    revokeObjectURL: vi.fn(),
  };
});

afterEach(() => {
  vi.useRealTimers();
  restoreDom?.();
  restoreDom = undefined;
});

describe("downloadBlob", () => {
  it("anchor 를 DOM 에 붙였다가 뗀다", () => {
    // 과거 결함 ②: anchor 를 DOM 에 붙이지 않고 click() 하면 일부 환경에서 다운로드가 시작되지 않는다.
    const appended: string[] = [];
    const body = document.body as unknown as FakeElement;
    const originalAppend = body.append.bind(body);
    body.append = (...children: FakeElement[]) => {
      for (const child of children) appended.push(child.tagName.toLowerCase());
      originalAppend(...(children as never[]));
    };

    downloadBlob(new Blob(["x"]), "우물.rpgzzu-kit.json");
    expect(appended).toContain("a");
    expect(body.querySelector("a")).toBeNull(); // click 후 제거됐다
  });

  it("revokeObjectURL 을 즉시 부르지 않는다", () => {
    // 과거 결함 ③: click() 직후 동기 revoke 하면 브라우저가 fetch 를 시작하기 전에 URL 이 무효화된다.
    const revoke = (globalThis as unknown as { URL: { revokeObjectURL: ReturnType<typeof vi.fn> } }).URL.revokeObjectURL;
    downloadBlob(new Blob(["x"]), "a.json");
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(revoke).toHaveBeenCalledWith("blob:fake");
  });
});
