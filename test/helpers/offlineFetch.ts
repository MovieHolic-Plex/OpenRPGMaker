// Bun's fetch has a preconnect member. Keep controlled fetches fully typed and
// fail if the SDK ever tries to bypass the controlled request path through it.
export function offlineFetch(handler: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>): typeof fetch {
  return Object.assign(handler, { preconnect() { throw new Error("Unexpected offline fetch.preconnect"); } });
}
