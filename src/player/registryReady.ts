// player/registryReady.ts
// Phaser DataManager(game.registry) 의 값이 준비될 때 한 번 콜백한다.
//
// 왜 필요한가: DataManager 는 **처음 넣는 키**에는 `setdata` 를, 이미 있는 키를 바꿀 때만
// `changedata` 를 낸다. `dialogue` 는 player.ts 가 게임 생성 직후 처음 넣는 키라 `changedata`
// 하나만 기다리면 영원히 오지 않는다 — 그 대기가 자동 실행 이벤트의 발화 조건이었다.
// 두 이벤트를 모두 듣고, 값이 이미 있으면 기다리지 않는다.

type RegistryDataListener = (parent: unknown, key: string, value: unknown) => void;

export type ReadyRegistry = {
  get(key: string): unknown;
  readonly events: {
    on(event: string, listener: RegistryDataListener): unknown;
    off(event: string, listener: RegistryDataListener): unknown;
  };
};

const DATA_EVENTS = ["setdata", "changedata"] as const;

/** 값이 있으면 즉시, 없으면 `key` 가 처음 들어오거나 바뀔 때 **한 번** 콜백한다. 해제 함수를 돌려준다. */
export function onRegistryValue(registry: ReadyRegistry, key: string, callback: (value: unknown) => void): () => void {
  const current = registry.get(key);
  if (current !== undefined && current !== null) {
    callback(current);
    return () => undefined;
  }
  let settled = false;
  const detach = (): void => {
    for (const event of DATA_EVENTS) registry.events.off(event, listener);
  };
  const listener: RegistryDataListener = (_parent, changedKey, value) => {
    if (settled || changedKey !== key) return;
    settled = true;
    detach();
    callback(value);
  };
  for (const event of DATA_EVENTS) registry.events.on(event, listener);
  return () => {
    if (settled) return;
    settled = true;
    detach();
  };
}
