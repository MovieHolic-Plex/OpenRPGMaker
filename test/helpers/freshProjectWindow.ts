// 이 모듈은 항상 `@/project/store` 보다 **앞에** import 되어야 한다.
// store 는 모듈 평가 시점에 싱글턴을 만들며 window.addEventListener 를 건다. 테스트 본문에서
// stubGlobal + resetModules + 동적 import 로 심으면 그 방대한 그래프의 컴파일 비용이 테스트 하나의
// 타임아웃 예산으로 들어오고, 실측상 단독 10.8초로 통과하던 테스트가 13파일 동시 실행에서 30초
// 타임아웃을 토했다. ESM 은 import 를 소스 순서대로 평가하므로 이 모듈을 먼저 놓으면 컴파일 비용은
// collect 단계로 밀리고 테스트 본문은 실제 동작 시간만 재게 된다.

export class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

export const freshProjectStorage = new MemoryStorage();

const fakeWindow = {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  location: {
    hostname: "127.0.0.1",
    pathname: "/",
    search: "?freshProject=1",
    href: "http://127.0.0.1/?freshProject=1",
  },
  localStorage: freshProjectStorage,
};

const define = (key: string, value: unknown) =>
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });

define("window", fakeWindow);
define("localStorage", freshProjectStorage);
define("fetch", async () => {
  throw new Error("fresh-project 세션은 Supabase 를 호출하지 않아야 한다");
});
