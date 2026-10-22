// 폴른 스타 안쪽 방(천문대·화로의 방·지하 묘소)을 다시 짓는 쪽(fallenStarRooms)과 마을·숲 쪽 마감(chronoBell)이 한 프로젝트를 같이 만진다.
// 다시 지은 방은 여기에 표시하고, 마감 패스(둘레 덧대기·어둠·상인방·홀 꾸미기·바닥 통일·묘소 바위)는 표시된 방을 건너뛴다.
const rebuilt = new WeakMap<object, Set<string>>();

export function markFallenRoomRebuilt(project: object, mapId: string): void {
  let set = rebuilt.get(project);
  if (!set) rebuilt.set(project, (set = new Set()));
  set.add(mapId);
}

export function isFallenRoomRebuilt(project: object, mapId: string | undefined): boolean {
  return !!mapId && (rebuilt.get(project)?.has(mapId) ?? false);
}
