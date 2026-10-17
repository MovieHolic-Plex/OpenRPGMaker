import { afterEach, describe, expect, it, vi } from "vitest";
import { _resetBootSettledForTest, afterBootSettled, expectBootSettle, markBootSettled } from "@/util/bootSettled";

describe("bootSettled — 첫 화면 뒤로 미루는 한가한 일", () => {
  afterEach(() => { _resetBootSettledForTest(); vi.useRealTimers(); });

  it("신호를 켜지 않은 환경(헤드리스·테스트·플레이어)은 기다리지 않고 바로 돈다", () => {
    const run = vi.fn();
    afterBootSettled(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("켠 환경은 첫 화면 신호가 올 때까지 미루고, 신호가 오면 들어온 순서대로 한 번씩 돈다", () => {
    expectBootSettle();
    const order: number[] = [];
    afterBootSettled(() => order.push(1));
    afterBootSettled(() => order.push(2));
    expect(order).toEqual([]);
    markBootSettled();
    expect(order).toEqual([1, 2]);
    markBootSettled();
    expect(order).toEqual([1, 2]);
  });

  it("신호가 온 뒤에 부른 일은 바로 돈다", () => {
    expectBootSettle();
    markBootSettled();
    const run = vi.fn();
    afterBootSettled(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("신호가 끝내 오지 않아도 45초 뒤에는 돈다", () => {
    vi.useFakeTimers();
    expectBootSettle();
    const run = vi.fn();
    afterBootSettled(run);
    vi.advanceTimersByTime(44_000);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
