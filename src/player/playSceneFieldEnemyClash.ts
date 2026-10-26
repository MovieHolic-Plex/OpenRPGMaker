// player/playSceneFieldEnemyClash.ts
// 보이는 필드 적끼리의 진영 싸움 연출 — 판정은 project/fieldEnemyClash.ts.
// 마주친 두 적 머리 위에 「분노」 말풍선 → 진 쪽이 붉게 깜빡이다 사라진다(지우기 = eraseEvent 와 같은 뜻,
// 맵에 다시 들어오면 돌아온다). 대화·전투 중(scene.running)에는 멈춘다. 플레이어는 두 진영 모두에게 여전히 덮쳐진다.
import { store } from "@/project/store";
import { resolveFactionTable } from "@/project/factions";
import { findFieldEnemyClashes, troopFieldPower, type FieldEnemyClashEntry } from "@/project/fieldEnemyClash";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { showSceneEmote } from "@/player/playSceneEmotes";
import type { PlaySceneContext } from "@/player/playSceneTypes";

const SCAN_INTERVAL_MS = 200;
/** 부딪힘 연출 길이 — 이 뒤에 진 쪽이 사라진다. */
const CLASH_MS = 900;

interface ClashState {
  scanMs: number;
  readonly pending: Map<string, { remainingMs: number }>;
}

const states = new WeakMap<PlaySceneContext, ClashState>();

export function updateFieldEnemyClashes(scene: PlaySceneContext, deltaMs: number): void {
  if (!scene.map.events.some((event) => event.fieldFactionId)) return;
  let state = states.get(scene);
  if (!state) { state = { scanMs: 0, pending: new Map() }; states.set(scene, state); }
  if (scene.running) return;
  for (const [loserId, entry] of state.pending) {
    entry.remainingMs -= Math.max(0, deltaMs);
    if (entry.remainingMs > 0) continue;
    state.pending.delete(loserId);
    eraseClashLoser(scene, loserId);
  }
  state.scanMs += Math.max(0, deltaMs);
  if (state.scanMs < SCAN_INTERVAL_MS) return;
  state.scanMs = 0;
  const project = store.getCurrent();
  const entries: FieldEnemyClashEntry[] = [];
  for (const view of runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)) {
    const factionId = view.event.fieldFactionId;
    if (!factionId || state.pending.has(view.event.id) || view.transparent || !view.page) continue;
    if (view.trigger.kind !== "eventTouch") continue;
    const battle = view.page.commands.find((command) => command.kind === "battleProcessing");
    if (!battle || battle.kind !== "battleProcessing") continue;
    entries.push({ eventId: view.event.id, factionId, x: view.x, y: view.y, power: troopFieldPower(project, battle.troopId) });
  }
  if (entries.length < 2) return;
  const clashes = findFieldEnemyClashes(entries, resolveFactionTable(project.factions));
  for (const clash of clashes) {
    state.pending.set(clash.loserId, { remainingMs: CLASH_MS });
    showSceneEmote(scene, clash.winnerId, "anger", CLASH_MS);
    showSceneEmote(scene, clash.loserId, "anger", CLASH_MS);
    const sprite = scene.eventSprites.get(clash.loserId);
    if (sprite) {
      sprite.setTint(0xff7070);
      scene.tweens.add({ targets: sprite, alpha: 0.35, duration: 120, yoyo: true, repeat: 3, delay: CLASH_MS / 3 });
    }
  }
}

function eraseClashLoser(scene: PlaySceneContext, eventId: string): void {
  scene.session.erasedEventIds = [...new Set([...(scene.session.erasedEventIds ?? []), eventId])];
  scene.autonomousNPCs.delete(eventId);
  scene.commandMoveRouteEventIds.delete(eventId);
  scene.pageMoveRouteEventIds.delete(eventId);
  scene.eventSprites.get(eventId)?.destroy();
  scene.eventSprites.delete(eventId);
}
