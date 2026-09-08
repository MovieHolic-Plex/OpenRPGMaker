// QA-only proposal-host boundary. No async wrapper: callers receive the exact
// original promise and its original value/error, with no added awaited work.
export function observeProposalCall(original, session) {
  return function(...args) {
    const observe = globalThis.__qaObserveProposal?.(session(), args[0]);
    const promise = Reflect.apply(original, this, args);
    if (observe) void promise.then(
      value => observe({ status: 'fulfilled', value }),
      error => observe({ status: 'rejected', error: String(error?.stack ?? error) }),
    );
    return promise;
  };
}
