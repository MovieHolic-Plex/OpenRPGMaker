// 적 그룹 「전투 뒤」 이벤트 러너 — 결과 화면이 닫히고 필드가 돌아온 다음 한 번 돈다.
//
// 부르는 곳은 세 갈래다: 이벤트 전투 처리·병렬 전투(commandBattle.playCommandBattle),
// 랜덤 인카운터(playSceneMovement.runRandomEncounterBattle), 필드 심볼 접촉
// (playSceneFieldSpawns.runFieldSpawnEventBattle). 셋 다 전투 동안 scene.running 을 쥐고 있으므로
// 중첩 실행(allowNested)으로 돌고, 끝나면 그 호출자의 잠금 상태로 되돌린다.
//
// 게임 오버로 끝나는 패배는 부르지 않는다 — 호출자가 applyBattleDefeat 로 넘긴 뒤다.
import { store } from "@/project/store";
import { troopAfterBattleCommands } from "@/project/troopAfterBattle";
import type { TroopAfterBattleOutcome } from "@/project/types/database";
import type { PlaySceneContext } from "@/player/playSceneTypes";

export async function runTroopAfterBattle(
  scene: PlaySceneContext,
  troopId: string,
  result: TroopAfterBattleOutcome,
  isCurrent?: () => boolean,
): Promise<void> {
  const troop = store.getCurrent().database.troops.find((entry) => entry.id === troopId);
  const commands = troopAfterBattleCommands(troop, result);
  if (commands.length === 0) return;
  // 정적 import 는 playSceneInterpreter → commandBattle → 이 파일 → playSceneInterpreter 순환이 된다.
  const { runCommands } = await import("@/player/playSceneInterpreter");
  await runCommands(scene, commands, undefined, { allowNested: true, ...(isCurrent ? { isCurrent } : {}) });
}
