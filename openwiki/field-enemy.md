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

## 필드 그림 = 전투 그림 (2026-10-14)

필드 그림은 charset(걷기 칩), 전투 그림은 도트 몬스터 시트(`monsterResourceId = generated-enemy-<slug>`)라 다른 자산 계열이다.
예전에는 이름으로 charset 을 찾다 못 찾으면 monster 첫 칸(슬라임)으로 말없이 떨어져서, 박쥐를 불렀는데 필드엔 슬라임이 서 있었다.
지금은 **전투 그림(선두 적의 monsterResourceId)이 정본**이다: `src/editor/tools/fieldEnemyGraphics.ts` 의 `FIELD_CELL_BY_SLUG` 가
전투 slug → 같은 종류의 charset 칸을 정한다(슬라임 계열·해골 계열·유령·골렘·미믹·용 …).

- `graphic` 을 안 주면 그 칸이 자동으로 쓰인다. 주면 그 칸과 같아야 한다(`field-enemy-graphic-mismatch`).
- `troopId` 를 생략하고 `graphic` 만 주면 그 칸을 그리는 전투 시트를 선두로 둔 적 그룹을 고른다.
- 대응 칸이 없는 종(박쥐·늑대·거미 등)은 **거절**한다(`field-enemy-no-field-graphic`) — 다른 그림으로 대체하지 않는다. 필드에 놓을 종을 늘리려면 charset 에 같은 종 칸이 생긴 뒤 표에 한 줄을 더한다.

## 이벤트 모양 (한 마리 = 이벤트 하나, 페이지 셋)

1. `_fight` — 접촉(eventTouch). 움직임은 behavior 에 따라 fixed / 닫힌 경로 custom / chase.
   chase 는 시야(`movement.sight`, 벽 너머 안 봄)·추격(`movement.pursuit`: scope map, 놓친 뒤 `searchMs` 1500 두리번 → `onLost:'return'` 으로 **원래 자리 복귀**)
   ·`movement.sightAlert {emote:'surprise', holdMs:700}`(**시야에 처음 들어온 순간** 머리 위 「!」 를 띄우고 0.7초 멈춘 뒤 쫓는다) 를 갖는다.
   `patrol` 을 함께 주면 `movement.route` 로 순찰하다 시야에 들어오면 추격하고, 놓치면 복귀 → 순찰로 돌아간다(`patrolChaseState`, `playSceneAutonomous.ts`).
   접촉 명령: (sightAlert 가 없을 때만 `showEmote` → `wait 520`) → `battleProcessing {canEscape, canLose:false}` → `fork`:
   승리 = `setSwitch(clearSwitch, true)`, 도주 = `setSelfSwitch B`. 패배는 `canLose:false` 라 기존 게임 오버 경로(`applyBattleDefeat`).
2. `_stun` — selfSwitch B. 도주 직후 3초 정지(바로 다시 닿아 전투가 반복되는 것을 막는다) 뒤 B 를 끈다.
3. `_cleared` — 스위치(clearSwitch) 켜짐. 투명·통과·항상 parallel. `respawnSec>0` 이면 N초 뒤 스위치를 꺼서 되돌린다
   (그 맵에 있을 때만 흐른다 — 맵을 떠나 있는 시간은 세지 않는다).

처치 상태는 스위치라서 저장·맵 재진입에서도 유지된다. 스위치 id 를 안 주면 도구가 새로 만든다(`clearSwitchId` 로 한 스위치에 여럿을 묶을 수 있다).

## 이미 놓인 적을 「보면 달려드는」 적으로 — `makeFieldEnemyChase` (2026-10-24)

`src/editor/tools/fieldEnemyTools.ts` 의 `makeFieldEnemyChase(project, map, event, options)` 는 이미 놓인 필드 적(순찰·보초)의 `_fight` 페이지를
추격으로 바꾸는 다시 쓰는 묶음이다(도구 인자 아님 — 데모·생성기 코드용). 순찰 경로(custom route)는 걸음마다 두 박자 쉬는 시야 밖 걸음으로 살리고,
추격은 `pace`(기본 fast: speed 5·frequency 6)로 순찰보다 눈에 띄게 빠르다(그래도 주인공 걷기보다는 느리다).

- 시야 `sight.facing:'cone'` — `NpcSight` 의 새 값. 이벤트 시선 조건 `eventSeesPlayer` 와 같은 90° 앞쪽 부채꼴(`conditionEventSight.inViewCone`)을
  `npcPerception.npcSeesPoint` 가 쓴다(거리는 맨해튼, 벽 가림 lineOfSight 그대로). 등 뒤로는 못 본다. 편집기 「정면 부채꼴」.
- 들면 `sightAlert`(기본 exclamation, 0.7초) → 쫓다 닿으면 전투 → 놓치면 `pursuit.searchMs`(기본 2500) 두리번 뒤 `onLost:'return'` 으로 제자리 → 순찰.
- 입구(`entryCells`)가 시야+1 안이면 시야를 줄이고, 2칸 밑이면 바꾸지 않는다(들어서자마자 덮치지 않게, `field-enemy-ambush` 와 같은 규칙).
- 폴른 스타는 모든 맵의 `…_foeN` 에 건다(chronoBell.ts — 숲 여섯 맵 포함). 보스·수호자는 제자리.

## 안전 장치 (도구가 거절하는 것)

- 문·시작 위치·착지 칸·표지판 등 보호 칸(`protectedCells`) 맨해튼 거리 2 이내: `field-enemy-unsafe-spot`.
- chase 는 입구 칸(`entryCells`) 에서 `sightRange+1` 안이면 `field-enemy-ambush`(입장하자마자 추격 방지).
- 시작·입구에서 걸어서 닿지 못하는 칸: `field-enemy-unreachable`(`walkableFromAnchors`).
- 순찰 경로는 닫힌 왕복이어야 하고 양방향 통행 가능·다른 이벤트 칸 불가.
- 그래픽: 위 「필드 그림 = 전투 그림」. 생성 그림 없음, 말없는 대체 없음.

## 알려진 한계

- 박쥐·늑대·거미처럼 같은 종 charset 이 없는 종은 필드에 못 놓는다(거절). 전투 쪽 도트는 있으나 필드 칩이 없다.
- 복귀는 놓친 뒤 맵을 떠나면 그 맵에서 다시 시작한 위치(`pursuitState.home`)로 간주한다. 맵 밖에서 흐르지 않는다.
- 보호 반경 때문에 아주 작은 맵에서는 자리를 못 찾을 수 있다.
- 시간 기반 재출현은 QA 로 시간을 재지 않았다(구조만 확인).
