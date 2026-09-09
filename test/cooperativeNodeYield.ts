import { setImmediate } from "node:timers";

const nativeSetImmediate = setImmediate;

/** Let Node process RPC/IPC during long scripted turns, even with fake UI timers. */
export function cooperativeNodeYield(): Promise<void> {
  return new Promise(resolve => nativeSetImmediate(resolve));
}
