import { afterEach, beforeEach, describe } from "vitest";
import type { spatialStoreFixture } from "./spatialStoreFixture";

type Fixture = Awaited<ReturnType<typeof spatialStoreFixture>>;
type Observe = <T>(pending: Promise<T>) => Promise<T>;
type Run<Given> = (body: (given: Given, observe: Observe) => Promise<void>) => Promise<void>;

/** Nested hooks own setup, active bodies and concurrent matchers before outer resets. */
export function spatialStoreLifecycle<Given>(
  prepare: (own: (fixture: Fixture) => Fixture) => Promise<Given>,
  tests: (run: Run<Given>) => void,
): void {
  describe("scoped store lifecycle", () => {
    let setup: Promise<Given>;
    let fixture: Fixture | undefined;
    let bodySettled: Promise<unknown>;
    // Accumulate settlement barriers without changing the original promise's outcome.
    let operations: Promise<unknown>[];

    beforeEach(async () => {
      fixture = undefined;
      bodySettled = Promise.resolve();
      operations = [];
      setup = prepare(acquired => { fixture = acquired; return acquired; });
      await setup;
    });
    afterEach(async () => {
      // The setup hook and returned body retain their primary failures in the runner.
      await Promise.allSettled([setup]);
      if (fixture) {
        fixture.http.state.heldPath = "";
        fixture.http.release();
        await bodySettled;
        await Promise.all(operations);
        await fixture[Symbol.asyncDispose]();
      }
    });

    tests(body => {
      const pending = (async () => body(await setup, operation => {
        operations.push(Promise.allSettled([operation]));
        return operation;
      }))();
      bodySettled = Promise.allSettled([pending]);
      return pending;
    });
  });
}
