# 별빛섬 몬스터 원정

An original complete monster campaign authored as an ordinary `Project`, using
the shipping Gen1 battle, collection, interpreter, save and menu systems.

## Source and regeneration

- `src/project/examples/monsterExpedition/index.ts`: composes a fresh project and
  round-trips it through the canonical loader; retains the seven current monster
  chipsets and their shared reference documents for the editor.
- `world.ts` / `worldPlan.ts`: 72 maps, 142 directed door/route connections, 8 gyms,
  company rescue/beacon events, 5 league rooms, ending and 6 repeatable postgame rares.
  The current project has 360 events and 44 authored trainer/story battles.
- `mapTemplates.json`: reviewed I6 native sample arrays. Its generator is
  `scripts/content/monster-expedition-templates.py`; inspect the current canonical
  tileset references and images before changing tile placement.
- `roster.ts`, original creature art and audio registrars own the data/assets.
  `markers.json` contains three original event sprites, not chipset tiles.
- `opening.ts` authors three distinct prologue images (4/5/9 seconds), a single
  purpose-composed 18.3-second score and the existing title picture. The camera
  uses still-image pan/zoom; this is not animated character acting. Provenance is under
  `public/assets/monster-expedition/opening/`. SQLite owns the uploaded bytes.
- Visible character pages use same priority and overlapForbidden:true; invisible
  logic and floor portals remain passable. `npcLayout.ts` repairs 13 original seed
  positions that blocked portal bypasses, narrow corridors or ice approaches.
  Already moved author positions are preserved. Four empty-looking neighboring
  tiles alone do not prove that a solid NPC leaves a route open.
- `patch-monster-expedition-opening.mjs` applies only the opening/title/media and
  NPC page/position corrections to a freshly loaded canonical document. It preserves
  the database, session, tiles and editing references; it is not a world regeneration.
- `node scripts/content/build-monster-expedition.mjs` writes the portable project,
  public asset inventory and world manifest under `public/monster-expedition/`.
  The document with editor references goes to the private evidence directory.
- Build the player with `npm run build:player`, then
  `node scripts/content/export-monster-expedition.mjs <output-folder>` copies the
  compiled player and the standard `prepareWebExport` asset closure.
  If building the editor too, run `build:app` before `build:player`, sequentially:
  the app build cleans `dist/` including the player output. Freeze an export before
  any later build, and do not mutate a server's frozen QA directory.

## Campaign metadata contract

`SystemRecords.monsterCampaign` is optional authored metadata: roster IDs, ecology
notes, badge switch/city IDs, region coordinates and objective prerequisite IDs.
`shapeMonsterCampaign.ts` checks shape, `references.ts` checks database/map/switch
references, and `normalizeSystemRecords` preserves it during load. Runtime journal
and menu behavior is documented in `monster-campaign-menu.md`.

Game state belongs in the existing session. Badge/story/puzzle switches, tile
mutations, party instances, seen/caught receipts and learned move PP use native
save snapshots. Gym devices use `changeTile`; psychic pads set their switch before
transfer (ordinary interpreters terminate at transfer). Ice uses native slide rules.
The fire gym's lower vent mouths reset the player to its entrance; the upper steam
plume is artwork. Field HUD uses the collector configuration; dialogue uses the
handheld style. Ether restores each learned move's PP through the shared monster
medicine contract rather than actor MP.

## Storage and evidence

Canonical project `fca4b134-ed34-4365-9021-450c7ee24894` is managed by the team host,
selector `649482df-81ca-4af9-806b-2613f7d7bebb`. Use
`scripts/content/monster-expedition-store.mjs` for the host's `assets.put`, CAS save,
fresh connection load and binary media reread. Never patch the running SQLite DB.
Do not create a second canonical project when that identity file exists.

2026-10-03 follow-up: revision8 is the saved/reloaded opening/collision correction.
Fresh-connection receipt includes the original PNG byte reload. The exported player
uses that exact document except media transport and editing reference removal.
Evidence: `verify-shots/monster-opening-collision-2026-10-03/`. Spatial audit accepts
an optional project JSON and output path, so frozen artifacts can be inspected
without replacing older evidence. Static all-map reachability is distinct from
native story progression; the whole campaign has not been played through.

Opening direction follow-up: canonical revision9 contains the new dimming lighthouse,
the three unclaimed starters waiting in the lab, and mx_audio_prologue. Normal playback
is18seconds with two short captions; actual starter selection remains in the lab event.
`patch-monster-expedition-storyboard.mjs` checks that only opening and its three new
media differ; all old media refs, title settings, maps/events, database and session are
exact. Save with `monster-expedition-store.mjs save <host> <private-dir> <prepared>
<expected-source-sha>` to reject a stale prepared snapshot before media promotion.
Fresh reopen proves all three new media bytes. Do not rerun the older NPC patch to
change just this storyboard. Evidence: `verify-shots/monster-opening-direction-2026-10-03/`.

Focused content inspection commands (not suites):

```bash
node scripts/qa/runtime/monster-expedition-spatial.mjs
node scripts/qa/runtime/monster-expedition-logic.mjs
```

Spatial inspection uses actual collision and slide helpers, every authored arrival
and successive device states. Logic inspection uses the real interpreter with
prescribed battle outcomes; it proves branches and locks, not battle balance or
human play duration. Browser evidence must use compiled `player.html` with the
export store shim. QA-only input/teleport hooks stay out of the ordinary player boot.
The full native browser probe is `scripts/qa/runtime/monster-expedition-play.probe.mjs`: starter and
capture, every gym, both story chapters, league, ending, Continue and return home.
It uses QA travel and a level99 party, so it verifies integration rather than normal
difficulty. `verify-shots/monster-expedition/SUMMARY.md` records the evidence and
canonical save receipt. The export script includes static battle-skin media in
addition to the standard asset closure.

Existing repository restrictions on suites/full typecheck still apply. Do not run
gates because these inspection scripts exist. Combat pacing needs human playtesting.

## Normal-play dogfood and authoring policy (2026-10-03)

The first ordinary Lv5 run reached both grass-gym devices, then lost after 13 fire
uses and all four remaining potions: the generic `demoEnemy` even-turn policy had
given both Lv9 opponents a Lv7 full recovery. Gen1 non-link enemies do not spend PP;
`maxPp: 10` does not bound their recovery. Do not use the old level99 integration
run as normal-play balance evidence.

`enemyActions.ts` now authors damage as always eligible, support at lower priority,
and HP healing only at HP ≤35%. The roster learns early normal/grass/dragon recovery
at Lv13, after the second attack at Lv11. The first gym retains its Lv9 stats,
two members and rewards. This removes its recovery loop; HP conditions alone do not
bound recovery in later battles. Later gym balance remains unverified.

`scripts/content/patch-monster-expedition-balance.mjs` prepares this learning/action
patch on an existing host document; save it with the host CAS API and freshly load
it through `monster-expedition-store.mjs`. Do not regenerate/reset the canonical
world to patch combat. The export script's optional canonical JSON argument uses
that reloaded document and verifies all portable asset bytes against host SHA.

The complete improvement/evidence scope is
`verify-shots/monster-authoring-dogfood-2026-10-03/REPORT.md`.


## 실제 Pi 조수 제작 오프닝 · revision11 (2026-10-03)

기존 `opening.ts`의 수동 3장 seed는 이전 기준선이다. 현재 정본은 실제 Pi/이미지 제공자가
생성·등록·시각 검토한 별도 5장으로, `apply-monster-assistant-opening.mjs`가 오프닝과 새 그림만
저장 제안에 옮겼다. 첫 수정은 revision10(9생성 그림 중5장 연결), 실제 브라우저 조수의 후속
검토/수정은 revision11(그림 동일·문구/시간 개선)이다. 맵72개·DB·타이틀·시작 세션·기존141개
에셋은 이전 정본과 동일하다. 전체 자동 도입은4.5/4.5/4/4.5/7초,24.5초다.

정본 projectId `fca4b134-ed34-4365-9021-450c7ee24894`, hostProject
`649482df-81ca-4af9-806b-2613f7d7bebb`, SQLite 호스트9888, revision11 재로드SHA
`f09f724a365ab43eb4050f591216a08aa5a89b102ca9d34753be742b498c161a`.
9개 새 그림의 저장 후 바이트 재로드 증거는 revision10 receipt에, 최종 전체 문서 재로드는
revision11 receipt에 보존한다. 호스트 재시작 뒤 같은 revision11을 다시 load했다.

휴대 에셋 캐시는 `/home/main/.local/share/oprn/monster-expedition-evidence/assistant-portable-revision11.json`
(비공개 정본 SHA 일치 캐시)에 있다. `export-monster-expedition.mjs <out> <canonical> [portable-cache]`
네 번째 인자로 지정한다. 기존 저장소 seed JSON은 수동 기준선으로 유지하며 최신 정본을 대신하지 않는다.
QA/실제 모델 제작 방법과 한계: `verify-shots/monster-assistant-opening-2026-10-03/REPORT.md`.

후속 편집기 부팅 정규화가 revision14를 저장했다. 오프닝/시작 세션은 같지만 번들·DB 등은 변했다.
18301 게임은 검수한 revision11 스냅샷, 개선 조수는18364에서 같은9888 정본을 사용한다.
운영 autosweep가 임시 조수 패치를 치환하므로 영구9888 배포로 보고하지 않는다.

추가 확인: 운영 기준선에 system.monsterCampaign 계약이 없어서 revision14/15 부팅 저장에서
캠페인이 누락됐다. 고정 개선 UI에 원래 타입·normalizer·shape/reference 계약을 통합하고,
다른 최신 필드를 유지한 채 캠페인만 원본에서 복구한 revision16을 CAS 저장·fresh load했다.
9888의 이전 소스로 다시 저장하면 이 계약을 보장할 수 없으므로 개선 UI18364를 사용한다.


## Native creature refinement · 2026-10-04

`scripts/content/monster-expedition-art.py` owns all24 original anatomy painters,
three stage proportions and distinct rear detail, and independently draws32px icons.
The ordinary `configureExpeditionRoster` import of `uploaded-art.json` registers
120battle resources plus60icons into every freshly generated campaign. Existing
species IDs, front/back IDs, stats, learning and evolution data remain unchanged.
The generator has no canonical/remote store access; existing saved projects need
an explicit asset-only promotion through their standard host service.

Battle PNGs are native64×64, icons32×32, alpha0/255, integer drawing, no resource
image resize. The legacy80unit design grid is projected before rasterization.
Each sprite contains body/highlight/shadow colors, family-colored1px ink and at
most8opaque colors. Last opaque battle row61, party row29. `catalog.json` records
all180resource byte sizes/SHA/bbox/dimensions/palettes; `provenance.json` records
source/catalog/upload-seed SHA and the complete native contract.

`mx_art_<slug>_icon` is a separate single static frame. Consumers may prefer this
registered resource for a party/dex cell, with the existing front as fallback;
`MonsterSpeciesGraphic` has no icon field, so do not append an unsupported field.
The normal roster upload clone preserves isolation across project externalization.

Visual review assets: `contact-sheet.png` shows all60front/back pairs at1x;
`starter-review.png` shows all9starter-family species at3x; `rare-review.png` shows
all6rares at4x; `icon-contact-sheet.png` shows all60icons at1x. Review enlargement
never touches exported sprite bytes. The generator itself checks dimensions,
alpha, baseline, palette bound,180embedded-byte matches and120+60unique hashes.
Direct before/after inspection and all-resource byte audit are recorded privately
under `/tmp/oprn-emerald-20261004/creature-qa/`. This is asset QA; runtime/canonical
promotion and native battle/party screenshots belong to the integration owner.


Astralhart is explicitly a quadruped matching `emerald-monster/title-stag.png`:
four grounded legs, horizontal barrel, cream star-tipped antlers, leaf mane and
bushy tail. Its front/back/icon are independently drawn in forest green/ivory.
Focused regeneration: `python3 scripts/content/monster-expedition-art.py --species
astralhart` changes only its3PNG resources and rebuilds the aggregate catalog/seed
and reviews, while verifying the other177existing PNGs against their catalog SHA.
It requires an existing catalog; full generation without the option remains supported.


## 빈터 쓰임 채우기 · 타이틀/주민 테마 배선 (2026-10-14)

- `src/project/kitAreaFurnish.ts` 가 몬스터 키트 시트(monster_*) 야외 빈터를 「쓰임」으로 채운다. 편집기 도구
  `find_empty_ground`·`furnish_outdoor_area`(`src/editor/tools/kitAreaTools.ts`)와 캠페인 생성기(`world.ts` 끝, 마을 9곳)가 같은 코드다.
  남은 터에서 가장 큰 빈 직사각형부터 구획(최대 5×4)으로 떼어 바닥별 쓰임(`LOT_USES`: 숲 덩이·꽃밭·쉼터·눈놀이 터·덤불숲·
  야자·선인장 밭·유적 자리·바위·김 구멍·파라솔 쉼터·어구 더미)을 고른다. 숲 벽·맵 가장자리 곁은 덩이, 건물 곁은 마당 쓰임,
  가까이 같은 쓰임은 피한다. 구획 둘레는 1칸(좁은 띠는 2칸) 여백, 조각은 구획의 지배 바닥 위에만, 문 앞·이벤트 둘레·주민 산책길
  (`reservedCells`)은 비우고, 닿던 이벤트가 막히면 조각을 되돌린다. 멈춤 = 맨땅(3×3 이웃에 물체 없는 바닥) ≤5% 그리고 빈 바닥 ≤45%.
- 도구는 `region`(bottom-left 등)만 받아도 그 구역 전체를 채운다. 옛 스타일(grove/garden/plaza/pond)은 첫 덩이로 남았고, 표식을
  제자리에 못 놓으면 길도 깔지 않는다(예전엔 구석에 표식, 허공에서 끝나는 길이 남았다).
- 측정: `bun scripts/qa/monster-fill-probe.mts <out> [--themes ...] [--followup] [--render] [--check]` — 테마별로
  build_monster_game(create) → 야외 맨땅 비율, 「서리꽃 마을 왼쪽 아래 빈 곳 채워」 모사, runGameCheck(자동 플레이).
  2026-10-14: 마을 맨땅 14%→4.8%(네 테마), 이어 고치기 모사 맨땅 43%→3%(옛 도구 9%, 빈 바닥 55→34 vs 옛 32), 네 테마 막힘 0·엔딩.
- 타이틀 키아트: `src/project/emeraldMonsterTitleArt.ts` — startTheme → coast(지금 사슴 그림)·default(풀밭)·desert·snow.
  변형 그림은 그림 작업자가 `VARIANTS` 에 import 한 줄로 넣고, 없으면 사슴 그림으로 돌아간다. 보수는 지금 타이틀 id·시작 맵 바닥으로 테마를 추정.
- 테마 주민 칩: `src/project/emeraldMonsterCast.ts` `THEME_CASTS` 는 비어 있다(원작 판형 theme-cast-v1 은 저작권 정리로 삭제).
  사용자가 독자 도트 후보를 Allow 하고 설치한 칩만 항목으로 더한다. 없으면 기본 People1 칩(조용한 대체).
- 산호 해변 오두막: 템플릿 집에 문 이벤트가 없었다 → 문에서 「바닷가 쉼터」 주인이 회복(recoverAll). 방 맵은 늘리지 않았다.


## 자유 경로 · 대회형/탐험형 · 계통 일괄 도구 (monster-free-b, 2026-10-14)

감사 구멍 #3(시작 테마·자유 경로)·#4(일괄·이름 바꾸기)·#5(포획 없음·대회)를 메운 변경이다.

- **화산 시작 테마** — `StartTheme` 에 `volcano`. `townLayouts.ts` 의 `VOLCANO` 도면(재 바닥·온천 못·김 구멍·화산암)은 몬스터 키트
  `monster_climate` 시트의 기존 재·용암 조각만 쓴다(`climate/ash_town` 템플릿). **새 그림을 그리지 않았으므로 object-gate 대상이 아니다.**
  `world.ts` 는 화산에서 첫 관을 불 타입으로, 야생 풀에 불 타입 토착종을 더하고 뒤쪽 마을 `ember` 와 판을 맞바꾼다.
- **포획 없음은 선언된 모드다** — `system.monsterCollection === false` + 몬스터 파티 전투(`monsterBattleParty`/`battleParty:"monsters"`)이다.
  `undefined` 는 「켜는 걸 잊음」이라 그대로 막힘이다. 판정은 `src/project/monsterCollection.ts` 의 `isMonsterPartyGame`·`isMonsterNoCaptureGame`.
  `configure_monster_system(enabled:true, capture:false)` 가 이 모드를 켠다(없이 `enabled:true` 만 부르면 포획 게임).
  `src/qa/gameCheck/monster.ts` 는 포획 관련 막힘만 이 모드에서 건너뛴다. 대신 상대(적 조련사) 0은 막힘 `monster-no-opponents`,
  너무 적으면 경고 `monster-few-opponents`, 포획 도구가 남아 있으면 경고 `monster-no-capture-has-ball` — 진짜 결함은 가리지 않는다.
- **대회형** — `build_monster_tournament`(`monsterTournamentTools.ts`, 생성기 `tournament.ts`·`tournamentGame.ts`): 접수 마을 → 연습 길 →
  본선 회전 방(`mx_round_i` 스위치로 사슬) → 결승 → `mx_ending_tournament`. rounds 2~8, 회전마다 레벨·팀 수가 오른다.
- **탐험형(체육관 없음)** — `build_monster_expedition`(같은 파일, `format:"expedition"`): 허브 → 사냥터 N(rounds 2~5), 라이벌(연구소+마지막 앞),
  마지막 사냥터 보스, 엔딩 `mx_ending_hunt`. 포획 구슬 판매.
- **계통 일괄** — `define_monster_families`(`monsterBatchTools.ts`): 한 호출 최대 40계통, 계통마다 원자적(스냅숏 되돌림), 일부 실패는
  `data.failed` 로 보고하고 전부 실패면 오류. `autoGraphics`·`spawn{mapIds,minLevel,includeEvolved}`. 도감은 `monsterCampaign.speciesIds`/`speciesNotes` 를
  돌기 때문에 종 레코드만으로는 도감에 안 나타난다 — 도구가 둘 다 덧붙인다.
  `rename_monster_species`: 최대 60개, 종·적·무리·맵 이벤트 대사·도감 설명·공용 이벤트·엔딩·세션까지 같은 `replacer` 로 전파.
  다른 종 이름의 부분 문자열(모호)·중복·미존재·동일 이름은 건너뛰고 `data.replaced` 로 건수를 돌려준다.
- **자유 경로 의도 판정** — `src/ai/piAgent/monsterGameRequest.ts` `classifyMonsterGameRequest(task, blank)` → `campaign|tournament|expedition|null`.
  「포켓몬」 낱말이 없어도 몬스터 주체 + 시스템 신호(포획·도감·체육관·진화·트레이너·종 정의·대전) 가 있으면 몬스터 수집 의도다.
  사냥꾼·좀비·공포·디펜스·생존·액션 RPG 같은 신호는 제외한다. `plainTurn.ts` 가 이 판정으로 도구 목록·프롬프트를 고정하고,
  작은 요청(마을·종 하나)이면 `monsterKit` 의도로 `MONSTER_FREE_KIT_NOTE` 를 붙인다. `aiChatPanel.ts` 는 손 안 댄 빈 시작 맵을
  `openBlankStartOnMonsterKit`(`genrePresets.ts`)으로 `monster_overworld` 키트로 옮긴다 — 칩셋 계열은 첫 맵이 정한다.
  비몬스터 요청은 건드리지 않는다.
- **알려진 한계** — `review_monster_game`(monster-free-a 소유)은 72맵·8체육관 기준이라 대회형·탐험형에 맞지 않아 프롬프트가 쓰지 말라고 한다.
  체육관 개수 파라미터(0~8)는 monster-free-a 의 `campaignPlan.ts` 가 합쳐져야 「체육관 세 개」가 지켜진다. 탐험형은 「전투마다 회복」 자동 플레이에서만
  통과하는 소모 경고가 남는다. 도감 메뉴 첫 줄은 포획 없는 게임에서도 「포획」 수를 센다(표시만).



## 규모 인자 — 체육관 0~8관 (2026-10-14, monster-free-a)

`createMonsterExpedition({gymCount, speciesCount})` 는 기본(8관·60종)에서 이전과 똑같은 프로젝트를 만든다(여섯 옵션 변형의 sha 가 같다).
`gymCount<8` 이면 `world.ts` 가 `campaignShape` 로 마을·길·체육관·리그 방을 자르고(`campaignLevels` 로 레벨 곡선을 마지막 체육관에 맞춤),
진행 잠금 `mx_badge_k>N` 을 마지막 배지로(0관은 `mx_starter`) 옮긴다. 0관은 체육관 없는 마을에 「조련사 회관」을 세우고 관측탑 보스가
엔딩을 건다. `speciesCount<60` 은 쓰지 않는 계통을 통째로 덜어 낸다(`campaignSpecies.ts`). 결과 규모는 `system.monsterCampaign.plan`
(`{gyms,species,maps,links}`)에 적히고 검수·`qa:game check` 가 그 계획과 정의-이벤트 일치(`monsterCampaignConsistency.ts`)를 본다.
측정(2026-10-14, 모델 없이): 0관 24맵·3관 32맵(눈 테마 41맵)·8관 90맵, 모두 몬스터 키트 시트(monster_overworld·gyms·rooms·dungeon…)만 쓴다.
이미 지은 캠페인의 체육관을 줄이는 것은 `resizeGyms.ts`(`configure_monster_campaign badgeCount`). 상세는 `editor-ai-tools.md` 같은 날 절.
검증(2026-10-14, 모델 없이 qa:game check + 자동 플레이): 체육관 0~8관 아홉 규모 모두 막힘 0·엔딩 도달. 2관은 마지막 마을(항구)의 관측탑·리그 문이 좁은 골목 안쪽 막다른 칸에
착지해 리그 문까지 걸어갈 길이 없었다 — `connect()` 가 작은 캠페인의 마지막 마을 문 자리를 「문 아래 칸이 걸어 닿고 다른 문도 그대로 닿는 칸」으로만 고른다(8관은 해시 동일).

## 체육관 공백·화산 캠페인·0관·줄이기/늘리기 (2026-10-14, monster-gym-fix)

- **체육관 가운데 검은 공백 원인:** `mapTemplates.json` 의 `gyms/gym_dojo`(·`_after`) 가운데 퍼즐 구역에 타일 라벨 「어둠(벽 위층, 막힘)」·「어둠(바닥 위층, 걷는다)」(어둠 덮개) 95칸이 깔려 있었고,
  그 덮개를 걷어 줄 불빛 이벤트는 만들어진 적이 없다. 걷는 칸이 있는데 검게 그려진 덩이(89칸 덩이·통행 32칸)가 남았다. `scripts/content/fix-dojo-maze.mts`(멱등)가 덮개 95칸을 지우고
  `gy_pb_dojo` 오토타일 4칸을 다시 맞춰 퍼즐 바닥·벽이 그대로 보이게 했다. 「어둠 낭떠러지」는 의도한 함정이라 건드리지 않는다.
- **재발 방지:** `qa:game check`(와 `gen`)는 렌더한 밝기로 `visual-void` 경고를 낸다(`scripts/qa-game/README.md` 「화면 빈 구멍」). `--no-visual` 로 끈다.
- **화산 캠페인(`startTheme:'volcano'`):** 시작 마을만이 아니라 마을 4곳(`VOLCANO_TOWN_KEYS`)과 숲·강·사막·설원·늪 길(`VOLCANO_ROUTE_KEYS`)이 재·용암 키트(`climate/ash_town` + monster_climate)로 그려진다
  (`townLayouts.ts` `volcanoTownSketch`/`volcanoRouteSketch`, 같은 해시 변주로 마을끼리 같아 보이지 않게). 항구·도시(`harbor`·`city`)와 산·유적 길은 원래 몬스터 키트 그대로 둔다 — 항구의 물·도시 석조는 재 키트에 없다.
  생성 그림 없음, 전부 기존 몬스터 키트 조각.
- **0관 캠페인:** 「조련사 회관」이 교실 방(`${key}_hall`)을 재사용하던 것을 몬스터 키트 집 실내(`${key}_annex` + 2층 `${key}_annex_2f`, `attachStairs`)로 바꾸고 마을 건물은 일반 집(`gable_a`)으로 둔다. 체육관 키트는 쓰지 않는다.
- **`resizeCampaignGyms`(configure_monster_campaign badgeCount):** 줄일 때 체육관 건물 발자국·내부 맵·연결·맵 트리 노드를 함께 지운다(`removeGymBuilding`). 건물 키트가 `gym_*` 와 안 맞는 마을은 문만 막고 안내 문구를 둔다.
  결과에 `removedGyms` 가 담긴다. **늘리기는 하지 않는다** — 새 체육관 마을·퍼즐 방·리그 연결을 안전하게 짜는 일이라 오류 문구가 `build_monster_game mode:create replace:true gymCount:N` 으로 안내한다.

