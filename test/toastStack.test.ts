/** @vitest-environment happy-dom */
/**
 * 토스트는 서로를 지우지 않고 쌓여야 한다.
 *
 * 회귀 배경: 모듈 전역 엘리먼트 하나를 재사용해 204개 호출 지점이 서로를 덮어썼다.
 * 일괄 작업(붙여넣기 실패 + 잠금 + 범위 밖)에서 마지막 한 줄만 남아 왜 실패했는지가
 * 사라졌고, 호출의 절반 가까이가 error 라 가장 필요한 정보가 가장 잘 지워졌다.
 *
 * 동시에 기존 계약을 깨면 안 된다 — e2e 는 getByTestId("toast") 가 **단일 요소**로
 * 풀리길 기대하고, 만료 후 `not.toHaveClass(/show/)` 를 본다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetToastsForTest, toast } from "@/util/toast";

const q = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];
const taggedToast = () => q("[data-testid='toast']");
const visible = () => q(".toast.show");

beforeEach(() => {
  document.body.innerHTML = "";
  resetToastsForTest();
});
afterEach(() => {
  vi.useRealTimers();
  resetToastsForTest();
});

describe("토스트 스택", () => {
  it("연달아 띄운 메시지가 서로를 지우지 않는다", () => {
    toast("붙여넣기 실패", "error");
    toast("맵이 잠겨 있습니다", "error");
    toast("범위 밖입니다", "error");

    const shown = visible().map((el) => el.textContent);
    expect(shown).toHaveLength(3);
    expect(shown.join(" ")).toContain("붙여넣기 실패");
    expect(shown.join(" ")).toContain("맵이 잠겨 있습니다");
    expect(shown.join(" ")).toContain("범위 밖입니다");
  });

  it("상한을 넘으면 오래된 것부터 걷는다", () => {
    for (let index = 0; index < 8; index += 1) toast(`메시지 ${index}`, "info");
    const shown = visible();
    expect(shown.length).toBeLessThanOrEqual(4);
    // 가장 오래된 것이 밀려나고 최신은 남는다.
    expect(document.body.textContent).toContain("메시지 7");
    expect(document.body.textContent).not.toContain("메시지 0");
  });
});

describe("기존 계약 유지", () => {
  it("data-testid='toast' 는 항상 정확히 하나다", () => {
    toast("첫째");
    expect(taggedToast()).toHaveLength(1);
    toast("둘째");
    toast("셋째");
    expect(taggedToast(), "e2e 가 단일 요소를 기대한다").toHaveLength(1);
  });

  it("data-testid='toast' 는 가장 최근 메시지를 가리킨다", () => {
    toast("옛날 것");
    toast("최신 것");
    expect(taggedToast()[0]?.textContent).toContain("최신 것");
  });

  it("만료되면 최신 토스트는 남되 show 만 떨어진다", () => {
    vi.useFakeTimers();
    toast("사라질 것", "info");
    const element = taggedToast()[0]!;
    expect(element.classList.contains("show")).toBe(true);

    vi.advanceTimersByTime(3_000);

    // 요소 자체는 남아야 한다 — not.toHaveClass 가 요소 존재를 전제한다.
    expect(taggedToast()).toHaveLength(1);
    expect(element.classList.contains("show")).toBe(false);
  });

  it("kind 별 클래스와 지속시간을 그대로 쓴다", () => {
    vi.useFakeTimers();
    toast("에러", "error");
    const element = taggedToast()[0]!;
    expect(element.className).toContain("error");

    vi.advanceTimersByTime(3_000);
    expect(element.classList.contains("show"), "error 는 4초까지 버틴다").toBe(true);
    vi.advanceTimersByTime(1_500);
    expect(element.classList.contains("show")).toBe(false);
  });

  it("action 버튼이 동작하고 누르면 사라진다", () => {
    const onClick = vi.fn();
    toast("삭제했습니다", { kind: "ok", action: { label: "실행취소", onClick } });

    const element = taggedToast()[0]!;
    expect(element.className).toContain("has-action");
    const button = element.querySelector<HTMLButtonElement>("[data-testid='toast-action']");
    expect(button).not.toBeNull();

    button!.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(element.classList.contains("show")).toBe(false);
  });

  it("body 가 교체돼도 고아 노드를 붙잡지 않는다", () => {
    toast("이전 body");
    document.body.innerHTML = "";
    toast("새 body");
    expect(taggedToast()).toHaveLength(1);
    expect(taggedToast()[0]?.textContent).toContain("새 body");
  });

  it("document 가 없으면 조용히 무시한다", () => {
    const original = globalThis.document;
    // @ts-expect-error 테스트에서 document 를 잠시 제거한다.
    delete globalThis.document;
    expect(() => toast("노드 환경")).not.toThrow();
    globalThis.document = original;
  });
});
