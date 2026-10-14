# 필드 적 (눈에 보이는 적, 심볼 인카운트) — `place_field_enemy`

FF6·크로노 트리거식 「필드에 보이는 적」을 조수가 한 마리씩 놓는 도구와 그 런타임 계약이다.
새 런타임 개념은 없다. 이벤트 페이지 셋과 기존 명령만 조합하고, 런타임에는 작은 훅 하나만 더했다.

- 도구: `src/editor/tools/fieldEnemyTools.ts` (`place_field_enemy`, 등록은 `toolRegistry.ts` 의 `FIELD_ENEMY_TOOLS`)
- 런타임 훅: `src/player/commandBattle.ts` `contactEventFormation` — 접촉 트리거(eventTouch·touch·playerTouch) 이벤트의
  `battleProcessing` 은 `symbolContactFormation`(선제/기습) 을 따른다. 명령에 `formation` 이 직접 있으면 그쪽이 이긴다.
  `system.battleFormationRoll` 이 꺼져 있으면 기존처럼 일반 진형이다(도구가 경고한다).
- 검증: `npm run qa:runtime -- --scenario field-enemy` (`scripts/qa/runtime/field-enemy.scenario.mjs` + `field-enemy-fixture.mts`)

## 다른 수단과의 구분

| 필요 | 도구 |
|---|---|
| 걷다 보면 무작위로 전투 | `set_encounter_table` |
| 사냥터 구역에 몬스터가 흩어져 있음(위치는 런타임이 정함) | `make_hunting_ground` (`fieldSpawns`) |
| 정해진 자리에 한 마리, 순찰·시야 추격·소멸/재출현을 저작 | `place_field_enemy` |
| 지나가지 못하게 막는 보스·문지기 | `place_battle_blocker` |
| NPC 순찰 | `configure_npc_patrol` (NPC 전용, 적에게 쓰지 않는다) |

마을·실내에는 놓지 않는다(`buildMapPlacementContext` 의 role 이 town/interior 면 `field-enemy-safe-area` 로 거절).
보스 방은 도구 설명에서 제외한다(이벤트 전투를 직접 저작).

## 이벤트 모양 (한 마리 = 이벤트 하나, 페이지 셋)

1. `_fight` — 접촉(eventTouch). 움직임은 behavior 에 따라 fixed / 닫힌 경로 custom / chase(`sightRange`, `giveUpRange = 시야+4`, `pathfind`).
   명령: `showEmote`(비차단) → `wait 520` → `battleProcessing {canEscape, canLose:false}` → `fork`:
   승리 = `setSwitch(clearSwitch, true)`, 도주 = `setSelfSwitch B`. 패배는 `canLose:false` 라 기존 게임 오버 경로(`applyBattleDefeat`).
2. `_stun` — selfSwitch B. 도주 직후 3초 정지(바로 다시 닿아 전투가 반복되는 것을 막는다) 뒤 B 를 끈다.
3. `_cleared` — 스위치(clearSwitch) 켜짐. 투명·통과·항상 parallel. `respawnSec>0` 이면 N초 뒤 스위치를 꺼서 되돌린다
   (그 맵에 있을 때만 흐른다 — 맵을 떠나 있는 시간은 세지 않는다).

처치 상태는 스위치라서 저장·맵 재진입에서도 유지된다. 스위치 id 를 안 주면 도구가 새로 만든다(`clearSwitchId` 로 한 스위치에 여럿을 묶을 수 있다).

## 안전 장치 (도구가 거절하는 것)

- 문·시작 위치·착지 칸·표지판 등 보호 칸(`protectedCells`) 맨해튼 거리 2 이내: `field-enemy-unsafe-spot`.
- chase 는 입구 칸(`entryCells`) 에서 `sightRange+1` 안이면 `field-enemy-ambush`(입장하자마자 추격 방지).
- 시작·입구에서 걸어서 닿지 못하는 칸: `field-enemy-unreachable`(`walkableFromAnchors`).
- 순찰 경로는 닫힌 왕복이어야 하고 양방향 통행 가능·다른 이벤트 칸 불가.
- 그래픽: 적 이름 → 트룹 이름 → "monster" 순으로 기존 몬스터 도트(`charset:…monster…`)·Actor1 을 찾는다(생성 그림 없음). 못 찾으면 경고.

## 알려진 한계

- chase 는 포기 거리(`giveUpRange`)를 넘으면 멈출 뿐 제자리로 돌아가지 않는다.
- 놀람(!) 표시는 접촉 직전이다(처음 시야에 들어온 순간이 아님).
- 순찰과 추격은 한 마리에 겹치지 못한다.
- 보호 반경 때문에 아주 작은 맵에서는 자리를 못 찾을 수 있다.
- 시간 기반 재출현은 QA 로 시간을 재지 않았다(구조만 확인).
