import { afterAll, beforeAll, vi } from "vitest";

// 합친 시험 파일(scripts/test-merge)의 describe 마다 맨 앞에서 한 번 부른다.
//
// 왜: 시험 파일이 따로일 때는 파일이 끝나면 워커 환경이 통째로 사라져, 시험이 남긴 타이머·애니메이션이 아무것도 못 했다.
// 합친 파일에서는 앞 describe 가 남긴 타이머가 뒤 describe 가 도는 동안 터져 «document is not defined»·«AbortError: The animation
// was canceled» 같은 미처리 오류가 난다(vitest 는 단언이 다 통과해도 종료 코드를 1 로 낸다).
// → describe 가 시작한 뒤 만든 타이머를 기록했다가 describe 가 끝나면 걷고, 가짜 타이머가 남아 있으면 되돌린다.
const TIMERS = [
  ["setTimeout", "clearTimeout"],
  ["setInterval", "clearInterval"],
  ["setImmediate", "clearImmediate"],
  ["requestAnimationFrame", "cancelAnimationFrame"],
] as const;

type AnyFn = (...args: unknown[]) => unknown;

export function isolateTimers(): void {
  const g = globalThis as unknown as Record<string, AnyFn | undefined>;
  const patched: { name: string; original: AnyFn; wrapped: AnyFn; ids: Set<unknown>; clearName: string }[] = [];
  beforeAll(() => {
    for (const [name, clearName] of TIMERS) {
      const original = g[name];
      if (typeof original !== "function") continue;
      const ids = new Set<unknown>();
      const once = name === "setTimeout" || name === "setImmediate";
      const wrapped = function (this: unknown, ...args: unknown[]): unknown {
        const fn = args[0];
        const holder: { id?: unknown } = {};
        if (once && typeof fn === "function") {
          args[0] = (...cbArgs: unknown[]) => {
            ids.delete(holder.id);
            return (fn as AnyFn)(...cbArgs);
          };
        }
        const id = original.apply(this, args);
        holder.id = id;
        ids.add(id);
        return id;
      } as AnyFn;
      // util.promisify.custom 같은 원래 함수의 속성을 그대로 옮긴다.
      for (const key of Reflect.ownKeys(original)) {
        if (key === "length" || key === "name" || key === "prototype") continue;
        const desc = Object.getOwnPropertyDescriptor(original, key);
        if (desc) Object.defineProperty(wrapped, key, desc);
      }
      g[name] = wrapped;
      patched.push({ name, original, wrapped, ids, clearName });
    }
  });
  afterAll(() => {
    if (vi.isFakeTimers()) {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
    for (const { name, original, wrapped, ids, clearName } of patched) {
      if (g[name] === wrapped) g[name] = original;
      const clear = g[clearName];
      if (typeof clear === "function") for (const id of ids) clear(id);
      ids.clear();
    }
  });
}
