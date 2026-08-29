/** @vitest-environment happy-dom */
// 전역 오류 트랩 회귀 테스트.
//
// 2026-08-29 관측성 감사 실측: `grep -rn "window.onerror|unhandledrejection" src/` → 0건.
// 편집 캔버스(EditScene 1,606줄 / editSceneRender 329줄, try/catch 0건)가 검게 죽어도
// 어디에도 기록이 남지 않았다. 이 테스트는 (1) 예외·거부가 잡히고, (2) 에셋 404 가
// 예외와 섞이지 않고, (3) 렌더 루프 폭주가 접히고, (4) 재설치가 핸들러를 겹치지 않는 것을
// 고정한다.
//
// happy-dom 실측 두 가지가 테스트 구성을 결정했다:
//  - `PromiseRejectionEvent` 가 없다 → unhandledrejection 은 Event + reason 을 직접 만든다.
//    (실제 브라우저에서도 이 이벤트는 자동 발화만 되고 테스트에서 만들 일이 없어 무해하다.)
//  - 리소스 오류는 버블하지 않지만 window 의 **capture** 리스너로는 내려온다 →
//    트랩이 capture:true 로 듣는지를 이 경로로 실증한다.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _uninstallGlobalErrorTrap,
  getTrappedErrors,
  installGlobalErrorTrap,
  isGlobalErrorTrapInstalled,
  serializeTrappedErrors,
  trappedErrorCount,
} from "@/app/errorTrap";
import { _resetLoggerForTest, getLogEntries } from "@/util/logger";

beforeEach(() => {
  // errorTrap 은 import 시점에 스스로 설치된다(main.ts 부팅 순서 요구). 테스트는 매번
  // 깨끗한 상태에서 시작해야 하므로 떼고 다시 건다.
  _uninstallGlobalErrorTrap();
  _resetLoggerForTest();
  installGlobalErrorTrap();
});

afterEach(() => {
  _uninstallGlobalErrorTrap();
  document.body.innerHTML = "";
});

function throwAt(error: unknown, init: Partial<ErrorEventInit> = {}): void {
  window.dispatchEvent(
    new ErrorEvent("error", {
      message: init.message ?? (error instanceof Error ? error.message : String(error)),
      filename: init.filename ?? "/src/editor/EditScene.ts",
      lineno: init.lineno ?? 812,
      colno: init.colno ?? 17,
      ...(error === undefined ? {} : { error }),
    }),
  );
}

/** happy-dom 에 PromiseRejectionEvent 가 없으므로 reason 을 얹은 Event 로 대체한다. */
function rejectAt(reason: unknown): void {
  const event = new Event("unhandledrejection");
  Object.defineProperty(event, "reason", { value: reason, configurable: true });
  window.dispatchEvent(event);
}

/** 실패한 에셋을 흉내낸다. 리소스 오류는 버블하지 않고 capture 로만 내려온다. */
function failResource(tagName: string, src: string): void {
  const element = document.createElement(tagName);
  element.setAttribute("src", src);
  document.body.append(element);
  element.dispatchEvent(new Event("error"));
}

describe("잡히지 않은 예외", () => {
  it("error 이벤트를 기록하고 스택을 남긴다", () => {
    const boom = new TypeError("Cannot read properties of null (reading 'putTileAt')");
    throwAt(boom);

    const entries = getTrappedErrors();
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.kind).toBe("exception");
    expect(entry.message).toContain("putTileAt");
    // TypeError 는 이름이 message 만으로 구분되지 않으므로 접두사가 붙어야 한다.
    expect(entry.message.startsWith("TypeError:")).toBe(true);
    expect(entry.stack).toBeDefined();
    expect(entry.source).toBe("/src/editor/EditScene.ts");
    expect(entry.line).toBe(812);
    expect(entry.column).toBe(17);
  });

  it("event.error 가 없으면 message/filename/lineno 로 대체한다", () => {
    // cross-origin 스크립트는 브라우저가 error 를 비우고 "Script error." 만 준다.
    window.dispatchEvent(
      new ErrorEvent("error", { message: "Script error.", filename: "https://cdn.example/x.js", lineno: 1, colno: 1 }),
    );
    const entry = getTrappedErrors()[0]!;
    expect(entry.kind).toBe("exception");
    expect(entry.message).toBe("Script error.");
    expect(entry.source).toBe("https://cdn.example/x.js");
    expect(entry.stack).toBeUndefined();
  });

  it("Error 가 아닌 값이 던져져도 읽을 수 있게 남긴다", () => {
    throwAt("문자열이 그대로 던져졌다", { message: "문자열이 그대로 던져졌다" });
    rejectAt({ code: "E_TILESET", detail: "chipset missing" });

    const messages = getTrappedErrors().map((entry) => entry.message);
    // "[object Object]" 만 남으면 사후 조사에 쓸 수 없다.
    expect(messages.some((message) => message.includes("E_TILESET"))).toBe(true);
    expect(messages).toContain("문자열이 그대로 던져졌다");
  });

  it("로거에 error 레벨로 적재한다", () => {
    throwAt(new Error("렌더 실패"));
    const logs = getLogEntries({ ns: "error-trap", minLevel: "error" });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.message).toContain("잡히지 않은 예외");
    expect(logs[0]!.message).toContain("렌더 실패");
  });
});

describe("처리되지 않은 Promise 거부", () => {
  it("unhandledrejection 을 기록한다", () => {
    rejectAt(new Error("Supabase flush 실패"));

    const entries = getTrappedErrors();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe("rejection");
    expect(entries[0]!.message).toContain("Supabase flush 실패");
    expect(entries[0]!.stack).toBeDefined();
  });

  it("예외와 거부가 같은 목록에 최신순으로 쌓인다", () => {
    throwAt(new Error("첫 번째"));
    rejectAt(new Error("두 번째"));

    const entries = getTrappedErrors();
    expect(entries.map((entry) => entry.kind)).toEqual(["rejection", "exception"]);
    expect(entries[0]!.message).toContain("두 번째");
  });
});

describe("리소스 로드 실패 분리", () => {
  it("에셋 오류를 exception 과 다른 kind·레벨로 남긴다", () => {
    failResource("img", "/assets/tilesets/combined_town.png");

    const entries = getTrappedErrors();
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.kind).toBe("resource");
    // `img.src` 는 절대 URL 로 해석된다(브라우저도 동일) — 어떤 오리진의 에셋인지가 같이 남는다.
    expect(entry.resource?.startsWith("IMG ")).toBe(true);
    expect(entry.resource).toContain("/assets/tilesets/combined_town.png");
    // 핵심: error 레벨을 쓰지 않는다. 404 가 error 로 쌓이면 링버퍼(1000)가 404 로 덮여
    // 정작 찾아야 할 예외가 밀려 나간다.
    expect(getLogEntries({ ns: "error-trap", minLevel: "error" })).toHaveLength(0);
    expect(getLogEntries({ ns: "error-trap", minLevel: "warn" })).toHaveLength(1);
  });

  it("excludeResource 로 진짜 예외만 골라낼 수 있다", () => {
    failResource("img", "/assets/a.png");
    failResource("img", "/assets/b.png");
    throwAt(new Error("실제 예외"));

    expect(getTrappedErrors()).toHaveLength(3);
    const real = getTrappedErrors({ excludeResource: true });
    expect(real).toHaveLength(1);
    expect(real[0]!.message).toContain("실제 예외");
    expect(getTrappedErrors({ kind: "resource" })).toHaveLength(2);
  });
});

describe("중복 폭주 접기", () => {
  it("같은 서명이 반복되면 엔트리 하나에 집계만 올린다", () => {
    const boom = new Error("frame update 실패");
    boom.stack = "Error: frame update 실패\n    at EditScene.update (/src/editor/EditScene.ts:812:17)";
    // 렌더 루프는 초당 60번 같은 스택으로 던진다 — 실측 함정: 링버퍼 1000 이 16초면 전소한다.
    for (let i = 0; i < 60; i += 1) throwAt(boom);

    const entries = getTrappedErrors();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.count).toBe(60);
    // 총 발생 횟수는 따로 알 수 있어야 한다 — 엔트리 수만 보면 폭주를 놓친다.
    expect(trappedErrorCount()).toBe(60);
    // 로그도 한 번만 남는다.
    expect(getLogEntries({ ns: "error-trap", minLevel: "error" })).toHaveLength(1);
    expect(serializeTrappedErrors()).toContain("×60");
  });

  it("서명이 다르면 접지 않는다", () => {
    throwAt(new Error("A"), { lineno: 10 });
    throwAt(new Error("A"), { lineno: 99 });
    throwAt(new Error("B"), { lineno: 10 });

    // 같은 message 라도 위치가 다르면 다른 버그다 — 뭉치면 원인 추적이 불가능해진다.
    expect(getTrappedErrors()).toHaveLength(3);
    expect(getTrappedErrors().every((entry) => entry.count === undefined)).toBe(true);
  });

  it("리소스 오류도 URL 별로 따로 센다", () => {
    failResource("img", "/assets/a.png");
    failResource("img", "/assets/a.png");
    failResource("img", "/assets/b.png");

    const entries = getTrappedErrors({ kind: "resource" });
    expect(entries).toHaveLength(2);
    expect(entries.find((entry) => entry.resource?.includes("a.png"))?.count).toBe(2);
  });
});

describe("설치 규약", () => {
  it("두 번 설치해도 핸들러가 중복 등록되지 않는다", () => {
    installGlobalErrorTrap();
    installGlobalErrorTrap();
    expect(isGlobalErrorTrapInstalled()).toBe(true);

    throwAt(new Error("한 번만"));
    // 핸들러가 두 번 붙으면 모든 오류가 2건으로 적재돼 집계가 거짓말을 한다.
    expect(getTrappedErrors()).toHaveLength(1);
    expect(getTrappedErrors()[0]!.count).toBeUndefined();
  });

  it("uninstall 후에는 기록하지 않는다", () => {
    _uninstallGlobalErrorTrap();
    expect(isGlobalErrorTrapInstalled()).toBe(false);
    throwAt(new Error("떼어낸 뒤"));
    rejectAt(new Error("떼어낸 뒤"));
    expect(getTrappedErrors()).toHaveLength(0);
  });

  it("window 조회 훅을 노출한다", () => {
    throwAt(new Error("훅 확인"));
    const api = window as unknown as Record<string, unknown>;
    expect(typeof api.__oprnErrors).toBe("function");
    const rows = (api.__oprnErrors as () => readonly unknown[])();
    expect(rows).toHaveLength(1);
    expect(typeof api.__oprnErrorText).toBe("function");
    expect((api.__oprnErrorText as () => string)()).toContain("훅 확인");
  });

  it("기본 리포팅을 삼키지 않는다 (preventDefault 금지)", () => {
    // 브라우저 콘솔 스택·Playwright pageerror·외부 리포터가 그대로 살아 있어야 한다.
    const event = new ErrorEvent("error", { message: "삼키지 말 것", cancelable: true, error: new Error("x") });
    const notCancelled = window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(notCancelled).toBe(true);
    expect(getTrappedErrors()).toHaveLength(1);
  });
});
