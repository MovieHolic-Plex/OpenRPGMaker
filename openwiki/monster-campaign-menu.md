# Monster campaign menu and permanent journal (2026-10-03)

`system.monsterCampaign` opts an authored game into three ESC → 기록 commands:
몬스터 도감, 지역 지도, 배지·목표. Games without this definition retain their existing
commands and collection behavior. The definition contract is
`docs/content/monster-expedition-contract.md`; the UI helper temporarily mirrors it
as `MonsterCampaignDefinition` in `src/project/monsterJournal.ts` so isolated agents
can build before the shared `SystemRecords` field is integrated.

## Ownership and receipts

- `playerMonsterCampaignMenu.ts` owns species ecology/skills/evolution detail, the
  region graph and acquired badge/next objective views. Native status-menu buttons
  retain controller keyboard focus and touch activation; the dex detail has a
  touch-accessible 목록 action as well as the controller's nested Esc back action.
- `monsterJournal.ts` owns `session.switches['mx_seen_'+speciesId]` and
  `session.switches['mx_caught_'+speciesId]`. Species must belong to the campaign.
  Caught implies seen. Existing ownership supplies the old-save fallback; the
  collection menu promotes existing instances to permanent receipts.
- Successful `giveMonster` and evolution register receipts. Successful release,
  trade and fusion register the departing species before deleting its instance,
  preserving old saves even if the player never opened the dex. Boxing never
  clears receipts. Failed actions do not register new caught species.
- `battleDom` supplies its already-created visible-enemy snapshot through an
  optional `onSnapshot` callback; `playSceneBattle` attaches it only for campaigns.
  Hidden troop members never enter that snapshot. Late revealed enemies are
  discovered when the existing view updates. This adds no new per-frame snapshot.
- Capture receipts come from `giveMonster` in the canonical battle-exit commit,
  after cancellable presentation. Campaign defeat (including canLose) issues no
  captured instances. Cancelled exits never reach the commit. The existing
  noncampaign capture policy is preserved. The commit preserves true journal
  receipts across the battle's older seeded switch copy.
- Save slots already preserve arbitrary switches; there is no save-schema change.

## UI data and map

Unknown species show only their dex number and `???`, with no art, species name,
notes, types or evolution target identity. A discovered species exposes its actual
front resource, authored notes, base stats, evolution requirements and learned
skills/PP from database records. The configured roster order is the dex order.

The region map uses authored location coordinates. Lines derive from actual
nested `transfer` commands rather than inventing connections. A building's
current marker resolves to its nearest named exterior through these transfers.
The current exact map name is also shown. The location list scrolls by keyboard
and touch. Badges read their switches; the next objective is the first incomplete
objective whose prerequisite switch is true (or absent).

`styles/runtime/monsterCampaignMenu.css` is loaded by the runtime index after
pixel windows; all selectors are scoped to campaign pages. Logical player size
remains 320×240. The default pixel menu owns window chrome and fonts.

## Browser evidence and limitations

`verify-shots/monster-campaign-menu/SUMMARY.md` records an engine-only 60-species
fixture with placeholder artwork. It exercises the native menu controller, ESC
and Enter navigation, touch actions, unknown information hiding, live badges,
prerequisite objectives, give/evolve/box/release receipts, defeat/victory capture
and save-snapshot roundtrip. This is not final authored-game or SQLite evidence.

Reproduce with a running `npm run dev:worktree`, then
`OPRN_QA_URL=http://127.0.0.1:<port> node scripts/qa/runtime/monster-campaign-menu.probe.mjs`.
The probe runs no suites or typecheck. The campaign supervisor owns final
shipping-player QA and SQLite save/reload evidence.

## Authored field menu and assistant tools (2026-10-04)

`meta.oprnFieldMenu` is the version1 authored command/label/order contract in
`src/project/fieldMenu.ts`. Keeping it in metadata lets older SQLite hosts preserve
it. Runtime reads this contract directly; intrinsic availability/access gates
still apply. Collector preset: dex, monsters, items, trainer-card, region-map,
campaign-progress, save, options. It uses `field-list`; configuring the menu also
updates an existing `fieldHud.menuStyle`, which otherwise overrides system style.

`trainer-card` shows the actual trainer identity, current place, party size,
seen/caught counts, badges and money. It does not fabricate actor combat stats.
The menu controller clamps the selection to available authored entries on render;
a hidden default Items command cannot remain selected on first boot. All command
icon, dispatch and controller switches must include a newly added command.

Assistant tools: `read_game_systems`, `configure_field_menu`,
`configure_monster_campaign`, `review_game_systems`; `configure_monster_system`
can explicitly select `rules:gen1`. Reads expose effective commands and report
incompatible collection/party/rules/campaign combinations. Campaign definitions
validate actual species, map and switch references before mutation. They do not
award species, badges or overwrite the play session. Native input/save proof is
separate from configuration review.

PiGameSystemProduction records actual read/review receipts and fingerprints final
system/menu/audio/map-BGM settings. Successful system/music writes require an actual
read and review after the last change; stale or inconsistent reviews enter the
existing bounded repair loop. Done receipts expose remaining issues and explicitly
keep playbackVerified:false. This does not establish native gameplay or hearing.

## Emerald authored presentation

See [Emerald runtime surfaces](emerald-runtime-surfaces.md) for the opt-in480×320 field menu, six-slot monster party, independent summary/current PP, bag/context/target geometry, icon fallback and standalone browser evidence contract. Campaign data and the existing menu controller remain the semantic owners.

## 파티 화면: 자리 바꾸기·요약 쪽 (2026-10-16, poke-sys-collect)

- 파티 순서의 정본은 `session.monsterParty` 배열 순서다(맨 앞 = 선두 출전). `swapMonsterPartyOrder`(`monsterCollection.ts`)가 두 자리를 맞바꾸고,
  박스 몬스터·같은 몬스터는 거절한다. 메뉴 경로: 요약 「관리」 쪽 → 자리 바꾸기 → 맞바꿀 동료 고르기(Esc/같은 동료 다시 = 취소).
- 수집 화면 하위 상태(`swapSourceId`·`summaryPage`)는 `playerMonsterCollectTypes.ts` 한 곳에 있고 컨트롤러가 갖는다.
  상세 빌더는 `StatusMenuDetailOptions.monsterCollect`(읽기)와 `onMonsterCollect`(동작) 두 칸으로만 받는다.
- 요약은 에메랄드 스킨에서만 쪽(능력치 → 기술 → 관리)으로 나뉜다(`onMonsterCollect` 가 연결되고 스타일이 에메랄드일 때). 그 밖의 스킨·옛 테스트는 한 목록 그대로.
- 지닌 도구가 있는 칸은 `data-party-held`, 자리 바꾸기의 먼저 고른 칸은 `data-party-swap-source` 로 CSS 가 표시한다.
- 캡처: `node scripts/qa/runtime/collect-menu.probe.mjs --stages party,summary` 와 `QA_AFTER=scripts/qa/runtime/collect-menu-party.after.mjs … --stages none`.
  예제 프로젝트는 `node scripts/content/build-monster-expedition.mjs /tmp/psc/exp /tmp/psc/evidence` 로 먼저 만든다.

## 도감 화면 (수집·관리 UI ② — 2026-10-16)

- 도감 상세 빌더는 `src/player/playerMonsterDexDetail.ts` 로 옮겼다(`playerMonsterCampaignMenu.ts` 는 지도·배지만 남음). 쪽 상태 `dexPage`(생태 / 능력 / 기술)는 컨트롤러가 갖고 `playerMonsterDexTypes.ts` 가 타입이다. 쪽 나누기는 에메랄드 스킨에서만(`onDexPage` 가 넘어올 때) 켜지며 그 밖의 스킨은 기존 한 목록.
- **원정 정의(`monsterCampaign`) 없이도 도감이 열린다**: `monsterDexSpeciesIds(project)` = 원정이 있으면 그 `speciesIds`, 없으면 `system.monsterCollection===true` 일 때만 `monsterSpecies` 전부, 아니면 `[]`. 발견·포획 기록(`recordMonsterSeen/Caught`)·전투 조우 기록·보상 되돌림이 모두 이 함수를 쓴다. 포획 없는 게임은 저장 바이트·메뉴 모두 그대로.
- 설명 문구: `monsterDexNote` = 원정 `speciesNotes` 우선, 없으면 종 레코드의 선택 필드 `dexNote`(200자, `define_monster_species` · `define_monster_families` 단계 note). 옛 저장본은 필드가 없어 변하지 않는다.
- 분포: `monsterSpeciesHabitats` 가 맵 `encounterTable`(없으면 `troopIds`) → 무리 → 적 → 종 으로 거슬러 올라 맵 이름을 모은다. 손으로 쓰지 않는다. 야생에서 안 나오는 종(스타터 등)은 「야생에서는 만날 수 없음」.
- 진행 막대: 목록 머리 오른쪽 「N% 완성」+ 발견(연한)/포획(진한) 두 겹 막대(`detail.meter`).
- 조수: `toolCapabilityIndex` 의 `monster-collection-ui` 레시피, find_tools 별칭 「도감」, 점검 `gameSystemAuthoringTools.issues` 가 도감 항목에 원정 정의 **또는** monsterCollection 을 요구.
- 화면 증거 스크립트: `node scripts/qa/runtime/collect-menu.probe.mjs --stages dex` (`QA_AFTER=scripts/qa/runtime/collect-menu-dex.after.mjs` 로 쪽·야생 종, `QA_PROJECT_PATCH` 로 원정 정의 제거본). 원정 정의를 지울 땐 `meta.oprnCinematicTimelines.monsterCampaign` 캡슐도 같이 지워야 로드 때 되살아나지 않는다.

## 배지 획득 연출과 배지 스위치 규칙 (2026-10-16)

**스위치 규칙(진행 게이팅의 정본).** 배지 N 의 스위치 id 는 `mx_badge_N`(N 은 1부터)이고, 실제 id 의 정본은
`system.monsterCampaign.badges[i].switchId` 다. 배지에 매달린 모든 것(문·길 잠금·NPC 대사·HM 장애물의 `requiresBadge`)은 이 스위치를 읽는다 —
번호를 문자열로 지어내지 말고 캠페인 정의에서 읽어라. 스위치를 켜는 것은 관장전 승리 분기(`battle()` 의 승리 스위치)이고 연출은 켜지 않는다.

**연출 레시피.** `src/project/monsterBadgeCeremony.ts` 의 `badgeAwardCommands()` 하나가 모양을 정한다:
흰 섬광(`m2-047-flash-screen`) → 징글 ME(프로젝트 승리 ME) + 반짝 효과음 → 번들 아이콘(`cc0-jetrel-*`, 32px)을 그림 표시로 4배 키워 아래에서 떠오르게
+ 같은 그림을 더하기 합성으로 640% 깔아 빛나게(`mx_badge_halo`/`mx_badge_medal`) → 반짝임 파티클 → 「○○를 받았다!」 → 「배지 케이스에 N/M번째 배지가 채워졌다.」 → 그림 치우기.
새 런타임 개념·새 도트는 없다 — 기존 이벤트 명령만 조립한 배열이다. 대사 상자는 `position:"bottom"` 으로 고정한다(자동이면 위로 올라가 배지를 덮는다).
아이콘은 체육관 타입으로 고르며(`badgeIconResourceId(type)`), 캠페인 정의의 선택 필드 `badges[].iconResourceId` 에 저장돼 배지 화면이 받은 배지 앞에 같은 그림을 보여 준다
(없으면 `cc0-jetrel-badge`). 기본값(필드 없음)에서는 직렬화에 나타나지 않는다. 참조 검사(`references.ts`)가 아이콘 id 가 실제 리소스인지 확인한다.

**연결.** `build_monster_game`(world.ts 관장 승리 분기, 관마다 한 번) · 조수 `configure_monster_campaign {badgeCeremony:{badgeId?, remove?, line?}}`
(= `installBadgeCeremonies`, 스위치 setSwitch 바로 뒤에 심고 다시 부르면 갈아 끼움; 스위치를 켜는 이벤트가 없으면 missing 으로 알림) ·
`definition.badges[].iconResourceId`. 조수 색인은 `toolCapabilityIndex.ts` 의 `monster-badges`, find_tools 별칭은 「배지·뱃지·배지 연출」.

**배지 화면(「배지·목표」).** 받은 배지 행은 아이콘이 붙고 못 받은 행은 흐리다. 첫 줄 「다음 목표」는 라벨만 보이고 설명은 아래 안내 창이 한 줄로 보여 준다
(에메랄드 스킨 CSS: 설명이 32px 행에서 라벨과 겹치던 것을 고쳤다).

**QA.** `node scripts/qa/runtime/monster-badge.mjs <project.json> [outDir]` (player.html 직접 스크립트; 크로미움이 백지면 `unshare -rn` 으로 감싼다).
시작 → 교수 → 1관 관장 실제 입력 전투 → 연출 프레임 연속 캡처(`frames/`, `frames.json`) → ESC 메뉴 → 배지 화면. 디버그 쓰기는 SUMMARY 에 적힌다
(맵 텔레포트·퍼즐 스위치·리더 레벨 ≥14). `BADGE_QA_MENU_ONLY=1` 은 연출을 건너뛰고 배지 스위치만 켜 배지 화면만 찍는다. 헤드리스(swiftshader)에서는 프레임이 초당 1~2장이라 떠오르는 구간은 1~2장만 잡힌다.

## 보관함(PC) 상자 화면 (2026-10-16, poke-sys-collect)

- 정본은 그대로 `session.monsterBox`(평평한 id 배열). 상자·칸은 `src/project/monsterBox.ts` 가 계산한다 — 30칸(6×5)·최소 8상자·넘치면 상자가 늘어난다(포획을 막지 않는다). 칸 번호는 개체의 선택 필드 `boxSlot`(없거나 겹치면 첫 빈 칸). 사용자가 한 칸이라도 옮기면 `placeBoxMonster` 가 전부 굳히고 빈 칸이면 이동·찬 칸이면 자리 바꿈.
- 상자 이름 = 저작 `system.monsterBoxNames`(`configure_monster_system {boxNames}`; `databaseRecordModel` 화이트리스트·`shapeDatabaseFields` 검사 둘 다 필요). 비면 「상자 N」.
- 화면: `playerMonsterBoxDetail.ts`(레이아웃 `campaign-box`, 항목 = 머리 ◀ 이름 ▶ 3개 + 30칸), 커서 규칙 `playerMonsterBoxGrid.ts`(순수), 컨트롤러 `boxGridActive`/`stepBox`. 다른 칸으로 옮기기(`startBoxMove`→`boxPlace`)·파티로 데려가기·놓아주기(2단계 확인, 지닌 도구는 가방으로, 도감 기록은 유지). 파티의 마지막 한 마리는 맡기지 않는다.
- 필드 PC: 새 명령이 아니라 「메뉴 화면 열기」(`m2-078`) 에 `fields.screen='monster-box'`. `commandCatalog` 가 `openMenuScreen{screen}` 으로, `player.ts` 가 `statusMenu.openMonsterBox()`(단독 열기, `pcMode` — Esc 로 닫으면 이벤트 이어짐). 조수 도구 `place_monster_pc`(투명 이벤트, 이미 있는 컴퓨터 그림 위).
- 파티가 가득 찬 뒤 포획하면 에메랄드 결과 문구에 「…는 보관함으로 보내졌다!」.
- 한계: 비 에메랄드 스킨은 옛 평평한 목록. PC 그림은 새로 만들지 않았다. 증거 http://mdc-server:18301/poke-sys-collect-1.html. 단위 시험 `test/monsterCollectBox.test.ts` 는 작성만 했고 미실행.
