# 던전 주제 열넷 — 숲·늪·피라미드·마법탑·마계까지 (2026-10-23)

조수의 `author_dungeon` 한 호출이 짓는 버들항(`beodeul_city`) 던전의 종류·배치·장치·적을 정리한다.
배치 문법·벽·천장·받침 규칙 자체는 `openwiki/beodeul-city.md` 의 던전 절(시공기 `src/editor/dungeonKit/`)을 따르고, 이 쪽은 그 위에 얹은 「주제」 층이다.

## 무엇이 바뀌었나

- 사용자는 「던전」을 동굴만으로 말하지 않는다 — 「엘든링 같은 지하묘지」「FF6 광산」「크로노트리거 같은 마계 성」「요정 숲」. 종류가 열넷이 됐다.
- 같은 종류를 두 번 지어도 복사본이 아니다: 배치 가족(사슬·갈래·고리·층 쌓기)과 주제 장치가 시드로 갈린다.
- rpg 던전은 마지막 층에 그 주제다운 장치를 하나 둔다(레버 쇠창살만 있던 것을 넓혔다).

## 종류 (`DUNGEON_TYPES`, `src/editor/dungeonKit/types.ts`)

| type | 말 | 문법 | 벽 | 액체 | 주제 장식(dress.ts) |
|---|---|---|---|---|---|
| catacomb | 지하묘지·카타콤·감옥·납골당 | rooms | 천장 | — | 관·벽감·제단 |
| castle | 성·요새·성채·성 지하 | rooms | 천장 | — | 옥좌의 방(옥좌·붉은 카펫·깃발·갑옷), 그 밖 공통 |
| labyrinth | 미궁·미로 | maze | 천장 | — | 미궁 |
| sewer | 하수도·수로 | rooms | 천장 | 물 | 하수도 |
| cave | 동굴·지하 호수 | blob | 천장 | 물 | 동굴(lair=소굴) |
| temple | 신전·사원·고대 유적 | rooms | 천장 | — | 신전 |
| mine | 광산·갱도 | rooms | 천장 | — | 광산 |
| volcano | 화산·용암 | blob | 천장 | 용암(흑요석 둑) | 화산 |
| ice | 얼음 동굴·빙굴·설산 | blob | 천장(얼음 판 대기) | 물(호수 = 빙판) | 얼음 바위·고드름·얼어붙은 전사 |
| forest | 숲·정글·세계수 | blob | **수관 숲**(야외) | 물(풀 둑) | 고사리·통나무·나무 섬·버섯 고리·거목 |
| swamp | 늪·습지·맹그로브 | blob(길 = 늪물) | **수관 숲**(야외) | 늪물(이끼 둑) | 맹그로브·죽은 나무·도깨비불·가라앉은 우상 |
| pyramid | 피라미드·사막 왕묘 | rooms | 천장(사암 대기) | — | 열주·자칼 석상·석관·금 더미·모래 |
| tower | 마법탑·마도사의 탑 | rooms(+library) | 천장 | — | 책장·독서대·마법진·수정 받침 |
| otherworld | 마계·이세계·지옥·심연 | blob(길 = 허공) | 천장 | **허공**(천장으로 그림, 돌다리) | 타락한 수정·뼈 기둥·보랏빛 화로·마왕의 옥좌 |

- **야외 던전(forest·swamp, `GRAMMAR.walls === "canopy"`)**: 벽 앞면 줄이 없다. 벽 칸은 잔디(737)를 깔고 dungeonTools 가 `planBeodeulCanopy`+`writeBeodeulCanopy` 로 수관 숲(2·3층, 막힘)을 덮는다. 수관 오토타일이 모양을 못 받는 한 칸 폭 틈은 숲에서 빼 빈터로 연다(고정점까지 반복 — 안 그러면 그림 없는 잔디 길이 숲을 뚫는다). 출구는 계단 대신 **입구 빈터 아랫변에서 맵 남쪽 끝까지 낸 길**이다(`trailExit`, 표식 「던전 입구」 3×2).
- **자연 물가(banks)**: 물·용암·늪물 칸 위 2층에 `beodeul_nature` 둑(256 마스크, N8 순서 [-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1])을 얹는다. 이웃 = 같은 액체·다리·맵 밖. 2층 ★·통행(통행은 아래 액체가 막는다).
- **허공(otherworld)**: 액체 종류 `void` — 그리지 않고 천장으로 칠한다. 허공 위에는 벽 앞면을 세우지 않는다(앞면이 허공을 마주 봐 받침 검사가 막는다). 늪·마계는 layouts 가 방 사이 굽은 길을 액체로 바꿔 방이 섬이 되고, settle 이 가장 짧은 줄에 다리를 놓는다.
- **바닥 함정**: 늪 바닥 무늬에 `swamp-stilt-ground-bog`(통행 불가 늪물 그림)을 쓰면 섬 사이가 막혀 「입구에서 닿지 않는 방」으로 거부됐다 — 바닥 무늬는 통행 칸만. 숲의 흙 덩이 무늬는 가장자리 그림이 없어 네모 얼룩으로 읽혀 뺐다.

## 새 그림 키트 이름 (`TK(id)` = `bd-pick-dungeon-theme-<id>`)

profiles·dress·gimmick 는 키트를 **후보 목록**(`KitPref`)으로 받는다 — 앞에서부터 이 타일셋에 있는 첫 키트. 새 테마 그림이 굽혀지기 전에는 기존 버들항 키트로 물러선다(옛 프로젝트도 같은 배치로 짓는다).
굽기는 이 이름을 그대로 써야 살아난다: 벽 `ice/sandstone/tower/otherworld-face-3h|2h`, 바닥 `*-floor`, 천장 그룹 `beodeul_dungeon_ceiling_ice|_sand|_void`, 기물 `giant-tree`·`mushroom-ring`·`sunken-idol`·`lily-pads`·`will-o-wisp`·`obelisk`·`pharaoh-sarcophagus`·`jackal-statue`·`gold-pile`·`sand-drift`·`sand-pit`·`cracked-floor`·`bookshelf(-tall)`·`lectern`·`crystal-pedestal`·`arcane-circle`·`teleport-circle`·`candelabra`·`corrupt-crystal(-big)`·`void-brazier`·`bone-pillar`·`demon-throne`·`portal-gate(-floor)`·`ice-crystal`·`icicles`·`frozen-warrior`·`snow-drift`·`throne`·`carpet-runner`·`royal-banner`·`armor-stand`·`minecart`·`rails-ew`.
그림은 `dungeon-chipset` 하네스(코드 손 도트, 잠긴 팔레트)로 그리고 object-gate 영수증·위임 pick 뒤에만 굽는다.

## 배치 가족 (`layout`, `layoutRooms.ts`·`layouts.ts`)

`linear` 사슬(곁방 하나, 고리 0) · `hub` 가운데 홀에서 갈래 · `loop` 고리 2~3 · `vertical` 층 쌓기(floors 생략 시 2층, tower 는 3층 위로).
생략하면 `layoutFamilyOf` 가 시드로 linear/hub/loop 중 하나를 고른다. rooms 문법은 `planDungeonRooms` 가 가족별 방 그래프를, blob 문법은 고리 수를 가족으로 정한다.

## 게임 참고 (`inspiration`, `DUNGEON_REFERENCES` in `grammar.ts`)

`inferDungeonRequest(text)` — 종류 낱말이 있으면 그 낱말(「크로노트리거 같은 마계 성」 → otherworld), 없으면 게임의 대표 던전.
엘든링·다크소울 → catacomb(성 낱말이면 castle)·loop·lever · FF6 → mine·linear·minecart · 크로노 트리거 → tower·vertical·teleporter(마왕 낱말이면 otherworld) · 젤다 → temple·hub·lever · 툼레이더·미이라 → pyramid·linear·sandpit · 디아블로 → catacomb·hub · 스카이림 → catacomb·linear·lever · 마인크래프트 → mine·loop·minecart · 메이플 → forest.
명시한 인자가 늘 이긴다. 이름·inspiration 은 `routeDungeon({text})` 에도 들어가 type 을 안 준 요청의 종류를 정한다.

## 주제 장치 (`gimmick`, `src/editor/tools/dungeonGimmicks.ts`)

| gimmick | 기본 종류 | 동작 | 그림 |
|---|---|---|---|
| lever | catacomb·castle·temple·sewer·(대체) | 방+통로 문법은 보물/보스 통로를 쇠창살로(`placeLeverGate`), 그 밖은 입구→보스 길의 **좁은 목**(단면 ≤4칸, 막으면 보스에 못 감)을 찾아 쇠창살 + 다른 방 레버(`placeChokeLever`, 레버가 입구 방에 서는 목은 마지막 후보) | 쇠창살·레버 charset |
| bridge | cave·volcano·swamp | 막으면 가장 많은 방(보스방 가중)이 끊기는 다리 무리(≤12칸)를 걷어 액체로 두고, 다리를 건너지 않고 닿는 가장 깊은 방에 레버 — 당기면 `changeTile` 로 다리 그림을 되돌린다 | 레버 charset + 원래 다리 칸 |
| teleporter | labyrinth·forest·tower·otherworld | 입구 쪽 방과 깊은 방에 마법진(숲 버섯 고리·마계 차원문) 한 쌍, 밟으면 반대쪽 내려설 칸으로 | `TK teleport-circle`·`arcane-circle`·`mushroom-ring` → 신전 모자이크 5×5 |
| minecart | mine | 입구 방·깊은 방 정거장 광차, 조사 → 「탄다」 → 반대 정거장 | `TK minecart` → 광산 마을 광차 |
| iceslide | ice | 얼음 호수 방의 가장 긴 가로 줄(≥8)을 빙판으로, 양 끝을 밟으면 맞은편 끝까지 미끄러진다(`moveEvent @player`, 방향 고정) | `TK ice-floor` → 설원 얼음 바닥 |
| sandpit | pyramid·(catacomb·castle 둘째) | 보스 길 밖 곁방 가운데(길 위 방이면 구석, 피해 가는 길이 남을 때만)에 구덩이, 밟으면 흔들림 → 입구로 떨어진다 | `TK sand-pit`·`cracked-floor` → 신전 트래버틴 2×2 |

- 장치는 **채우기(populate) 전에** 놓는다(적·상자가 장치 자리를 먼저 먹지 않게). 고른 장치를 못 놓으면 그 종류의 다음 장치 → 레버 순으로 바꾸고 경고한다.
- 같은 종류 두 요청: 생략 시 `THEME_GIMMICKS[type]` 앞 둘 중 시드로 고른다.
- `gimmick:"none"` 은 끔. 옛 `puzzle:"lever"` 는 `gimmick:"lever"` 와 같다. 레버를 안 놓았으면 `population.lockedGate` 를 지운다(조수가 「잠긴 문이 있다」고 답했다).
- **린트**: 레버 다리 건너편 이벤트가 `event-unreachable` 로 울리지 않도록, 이벤트 배치 분석(`eventPlacementRecovery.ts` `openedByChangeTile`)은 이 맵의 이벤트가 `changeTile`(lower)로 넣는 그림을 미리 깐 사본으로 도달을 잰다 — 「저자가 열 방법을 둔 칸」은 지나갈 수 있다고 본다.

## gap 조각 배선 (#3283 꼬리 29568~30847)

- **둥근 탑 층(`shape: "ring"`)**: 탑(floors>1, direction up)의 위 큰 방(hall·throne)은 방 바닥 w×h = 링 지름 N-2 × N-4 로 잡고, 시공기(`compose.ts` 링 절)가 `bd-dg-tower-ring-<N>` 을 통째로 찍는다. 바닥 마스크를 링 안 칸으로 바꾼 뒤 벽·천장을 유도하고(링 둘레 벽 앞면은 지운다 — 링 위 천장에 테두리 조각이 새던 것), 장식 전에 키트 그림으로 덮는다. 링 바깥 어둠(29775)은 둘레 천장과 같은 결의 천장 칸으로 바꾼다(평평한 어둠이 네모로 떠 보였다).
  - 링은 **남쪽 가운데 두 칸으로만** 드나든다(`bd-dg-tower-pass-s`). 그래서 링 방은 아래 방에서 북쪽(dir N)으로만 잇고, `layoutOnce` 가 그 통로를 링 가운데 두 칸 폭으로 맞춘다. 동·서·북에서 들어오는 링은 그림이 없다.
  - 다음 층으로 가는 방(가장 깊은 방, 지름 12)은 `bd-dg-tower-ring-12-stair` — 안벽 계단 끝 칸(링 원점 +2,+4)이 이동 칸, 바로 아래(+2,+5)가 도착 칸이다. 계단 칸은 위층 그림이 차 있어 물건이 못 앉고, 계단 앞 칸은 길 지킴 칸(`keyCells`)이라 물건이 계단 발치를 막지 않는다.
  - 링 안 장식(`dressTower` `ringEdge`): 링 그림(안벽 그늘·띠)이 덮은 바닥 칸에는 물건이 못 앉는다 — 그 안쪽 첫 둘레에 책장·촛대·수정을 둔다.
  - 층 변화(`towerRooms(top, k, seed)`): 시드로 층계참 너비(9·11)·곁 서고/창고(동·서, 55%)·꼭대기 링 크기(12·10)가 바뀐다 — 같은 탑 두 요청이 판박이가 아니다.
  - 키트가 없는 타일셋 사본은 mask 의 팔각(round)으로 남는다.
- **얼음굴 바닥(`profile.autoFloor`)**: ice 는 바위 줄 C(어두운 청색) + 걷는 바닥 `beodeul_dungeon_ice_ground` 오토타일, 호수 방과 잡음 덩이(vnoise>0.74)는 빙판 `beodeul_dungeon_ice` 오토타일(이웃 = 빙판 칸). 얼음 미끄럼 장치는 이미 빙판인 줄은 다시 칠하지 않는다.
- **벽 레버**: `placeLever` 가 방 북쪽 벽 칸(바닥 첫 줄 위)에 `bd-dg-lever-up` 을 받침 검사(`checkGroundSupportForStamp`) 통과할 때만 걸고, 이벤트를 그 벽 칸에(투명·같은 높이) 둔다 — 당기면 `changeTile`(upper) 로 `lever-down` 그림 + 스위치. 바위 앞면(동굴·화산)은 벽 태그가 없어 바닥 charset 레버로 물러선다.
- **문 여는 이벤트**: 벽 문(`DungeonStairCell.doorTiles`)이 있는 계단 이벤트는 이동 전에 문 소리 + `changeTile`(upper, 문 위·아래 칸 → open 그림) + 250ms 를 먼저 한다.
- **천장 태그**: `supportSurfaceOf` 는 이름표뿐 아니라 태그(ceiling·천장)도 천장으로 센다 — 29775 「탑 바깥 어둠」이 이름만 보면 벽이라 「허공을 향한 벽」 경고가 났다.
- **위상 몸통(32×32)**: 용암처럼 16px 몸통이 격자로 보이는 오토타일을 위해 `dot.Autotile(body32=…)` 가 칸 위치 `(x%2)+2*(y%2)` 로 몸통 쪽을 고르고 가장자리·모서리도 그 칸 몸통 위에 얹는다. 관문은 32px 반복 이음과 그 안 16px 경계(튀면 격자)를 본다. `bake_gap.py` 는 위상 넷 × 47 모양을 굽고 `phaseVariants {w:2,h:2}` 를 쓴다 — 엔진(`autotileVariantForMask`)·시공기(`autoCell`)가 같은 규칙으로 고른다. 화산 용암 다시 그리기는 이 길로 한다.
- **마계 낱말**: `inspiration`·이름에 마계·이세계·지옥·심연이 있으면 모델이 castle·temple·cave·catacomb 로 골라도 otherworld 로 짓는다(「크로노트리거 같은 마계 성」이 회색 성이 됐다, dt-p1).
- **닫힌 조각**: palisade·ice_rock 은 반려로 닫혔다. 열두 주제에는 필요 없다(얼음굴은 바위 C + 얼음 바닥, 고블린 소굴은 주제 밖).

## 주제 그림 꼬리 (30848~, `bake_theme.py`)

- gap 꼬리(29568~30847)가 차서 주제 그림은 **시트 끝 덧붙이기 저장소** `tiledata/beodeul-dungeon/theme/cells.{png,json}` 에 굽는다(2026-10-23 기준 30848~32895, 시트 32896칸). 칸 번호는 덧붙이기 전용 — 다시 굽는 항목은 자기 옛 정의만 빼고 다시 넣는다.
- 굽는 대상은 **후보 그림 자체**(`cv.img()`)에 object-gate 영수증 + 서명된 위임 허용(18323 `/api/decide`, 증거 `harness-data/dungeon-chipset/evidence/2026-10-23-theme-allows.json`)이 있는 pick 뿐이다. 견본 그림 영수증은 효력이 없다. FAIL 은 굽지 않고 빌더가 옛 키트로 물러선다.
- 칸 규칙(버들항 관례): 걸을 수 있는 칸은 2층 낮은 우선(캐릭터 밑), ★·x 는 2층, 불투명한 전부-통행 바닥 조각은 1층. N(≤4)프레임 기물은 4의 배수 칸에서 시작하는 애니메이션 띠.
- 바닥 오토타일(tower·otherworld)은 그룹 + 태그 「섞음」 본문 키트로 굽고, 시공기는 이 태그가 있으면 칸마다 섞는다. 피라미드 앞면은 `sandstone-face-3h|2h(-glyph|-base|-alt)` — 시공기가 벽 가운데 칸 14% 를 `-glyph` 로 바꾼다.
- 화산 용암 r2(32px 위상 몸통)는 gap 꼬리에 자리가 없어 이 꼬리에 `beodeul_dungeon_theme_lava_<줄>` 로 굽는다. 시공기 `gapLava` 가 이 그룹을 먼저 찾는다.
- 배선: 지하묘지 석관(남북·동서, 열린 것 15%)·석판·철 촛대(제단 곁), 광산 목재 기둥(입구 계단 곁)·벽 목재 틀, 유적 석상 머리·잔해 더미, 성 붉은 융단(옥좌 아래부터 위·가운데·아래 줄, 폭 11 이상이면 3칸), 피라미드 스카라베·자칼 석상 번갈아, 늪 빈 창 메우기(고사목·이끼·갈대·통나무·고사리).
- 받침: `groundSupport` WALL_MOUNT 에 목재 틀·광맥·고드름·납골 벽을 넣었다(벽 칸에 걸리는 키트가 바닥 받침 검사에 막혔다).
- 장치 다듬기: 모래 구덩이 그림은 피라미드·숲만(성에 모래 구덩이가 떴다), 늪 순간이동은 버섯 고리, 순간이동 칸 둘레 2칸에는 적이 서지 않는다(`populateFloor` foeFree). 탑(2층 이상)의 teleporter 는 `placeTowerWarp` — 1층 마법진은 봉인, 꼭대기 층계참 마법진을 밟으면 스위치가 켜지고 내려간다, 그 뒤 1층 마법진이 꼭대기로 보낸다.
- 2판(2026-10-24, theme-walls-r4~r10 · theme-props-r2~r8): 탑 천장 갓돌(`beodeul_dungeon_ceiling_tower`)·탑 벽 앞면(`tower-face-*`)·마계 벽 앞면(`otherworld-face-*`)·마계 천장 테두리(`beodeul_dungeon_ceiling_void`, 탑 갓돌 짜임 + 흑요석)·광차(`minecart`, 광산 레일 끝 `dress.ts` cart)·금 간 바닥(`cracked-floor`, **바깥 투명 덧그림** — 2×2 네모 경계가 바닥과 따로 놀았다)·도깨비불 화반(`will-o-wisp`, 1×2 3장면)을 구웠다. 얼음굴 벽 앞면(`ice-face-*`, theme-props-r7 층 바위 + 틈 얼음)은 패널 12 까지 두 심사 중 하나가 계속 떨어뜨려(「바위가 얼음으로 안 읽힘·가로 띠 반복」) **굽지 않았다** — 얼음굴은 동굴 줄 C 앞면으로 물러선다(남은 일). 하나마다 눈가림 두 심사(klb-sonnet-5-5 + argon) 메이저 0 + object-gate PASS 영수증 + 위임 허용(증거 `harness-data/dungeon-chipset/evidence/2026-10-24-theme-panel-*.json`·`-theme-allows.json`).
- 화풍 판정자(object-gate)가 걸던 것과 고친 법: 근흑 윤곽(중성 어둠) → 재질 색조 어둠(vrock·iron·ostone·water) · 칸당 색 수 부족 → 돌마다 색 줄 셋(`three_ramp`)·같은 줄 ±1 알갱이(`pit_speck`) · 납작한 어둠 몸통 → 한 단 밝은 알갱이. 반대로 밝은 점 덩이·흰 심·불티·둥근 판마다 명암은 심사가 「색종이·빛 번짐·16px 반복」으로 떨어뜨렸다.
- 성 붉은 융단 키트 칸이 통행 격자 없이 구워져 막힘(solid)이었고, 성 20 시드 중 2 개(2·5)가 보스·보물 방이 막혀 `unreachable` 로 실패했다(main 에서도 재현). 시드 `earth.carpet` 에 `walk_grid` 를 넣어 다시 구웠다 — 열두 종류 × 20 시드 실패 0.
- space-craft `measure` 의 도달 계산은 닿는 이벤트의 `changeTile`(1·2층)을 반복 적용한다(레버가 내리는 다리 건너편을 「못 닿음」으로 세던 것).

## 조수 실경로 수리 (dt r2 VQA, 2026-10-23)

- **하늘 탑**: 2층 이상 위로 가는 탑은 `skyAroundTower`(`dungeonTools.ts`) — 사방이 천장인 깊은 천장 칸을 비우고(lower -1) 맵 배경을 구름 파노라마 `oprn-clouds`(빈 칸에 보임)로 단다. 층·배치 없이 「탑」만 말하면 3층 세로 배치가 기본이다(한 층 탑이 나왔다).
- **경로 가로채기**: 「던전」이 든 요청은 사막 동부(`desertEastPolicy` `DUNGEON_RE`, 칩셋 이름을 말하면 예외)·북방 설원(`snowNorthPolicy` `describesSnowNorth`) 경로가 가로채지 않는다 — 「피라미드 던전」이 무덤 방 한 칸, 「얼어붙은 호수를 건너는 빙굴 던전」이 설원 한 장이 됐다. 피라미드 던전은 `author_dungeon type pyramid`.
- **장치 고르기 단서**: `gimmick` 이 없으면 이름·inspiration 의 낱말(`gimmickCue`: 광차·미끄럼·순간이동·모래 구덩이·레버·다리)이 먼저, 그다음 시드. 입구 방 레버(들어서자마자 당기는 레버)는 다른 장치가 다 안 될 때만.
- **물·용암 줄기**: 화산 배치(`layoutBlob`)는 용암 줄기 0개 후보에 큰 벌점 — 줄기 수가 `cropToContent` 를 지나며 사라져 벌점이 안 먹던 것을 고쳤다. 호수 방이 있는 동굴(소굴 아님)도 물 줄기 1개까지 — 다리 장치가 설 자리.
- **마계 허공**: 허공 칸은 `void-body`, 섬 바로 남쪽 두 칸은 `void-underside`(1·2단), 허공에 닿는 땅은 `beodeul_dungeon_theme_void_edge`. 허공 위 돌다리 칸은 「끊긴 계단」으로 읽혀 땅 목으로 바꾸고, 바닥 사이 작은 벽 덩이(≤40칸, 맵 가장자리에 안 닿음)는 허공 구멍으로 바꾼다 — 그래서 마계는 다리 장치 대신 순간이동을 쓴다.
- 지하묘지 납골 벽(`ossuaryWalls`), 광산 광맥(`oreVeins`)·광차 선로(`layTrack`), 유적 덩굴 바닥, 마계 보스방 열린 차원문·금고 봉인 차원문. 순간이동 화면 섬광은 카탈로그 색 이름(`purple`)만 — 16진 색은 커밋 거절이었다.
- 채우기 요약 줄은 적 이름까지 적는다(「박쥐가 없다」 오판).

## 주제 적 (`dungeonThemeTroops.ts`)

새 주제: forest(늑대·식인초·거대 벌 → 숲의 늙은 트롤) · swamp(리자드맨·독사·도깨비불 → 히드라) · pyramid(미라·전갈 → 왕묘의 수호 거상) · ice(늑대·바람 정령·창백한 유령 → 푸른 용) · magic(떠다니는 눈·나는 검·떠돌이 마법사 → 탑의 대마법사) · abyss(임프·어둠 정령·망령 → 마계의 군주) · castle(해골 기사·살아 있는 갑옷·가고일 → 타락한 성주) · magitek(FF6 광산: 철 골렘·코볼트 → 괴수).
type 을 안 준 요청은 지은 층의 type 으로 주제를 고른다.

**세기는 시작 파티에 맞춘다(2026-10-29).** 주제 적(`ensureThemeTroop`)과 조수 v2 던전 적(`builders/dungeon.ts ensureFoeTroop`)은 만든 뒤
`bossThreatScaling.fitEnemyToStartParty` 로 시작 파티(Lv·HP·공·방·민)에 맞춘다 — 올리기·내리기 모두, 결정적(모의전 20판 seed 1).
목표: 잡몹 = 영웅 평타 2대에 한 마리·한 대 5%·승률 ≥95%·HP 손실 ≤35% / 수문장 6대·7% / 보스 10대·8%·손실 30~70%. 레벨 표시는 파티 Lv(+1·+2).
적 사본의 기술 중 한 방이 상한(영웅 HP 의 잡몹 10/7%, 보스 24/16% — 단일/전체)을 넘는 것은 같은 범위·능력치(되도록 같은 속성)의 약한 `skill_mon_*` 로 바꾼다(데이터베이스 기술은 그대로).
예전에는 「원래 고르던 그룹」(보스 = 가장 센 그룹) 세기의 비례였다 — VM 판 vm1-1029/flash/jrpg 에서 Lv1 혼자인 아린에게 임프 Lv35×2(승률 0~15%)·마왕 Lv42(심판 위력 220, 승률 0%)가 붙어 판정자가 「전투 못 이김」으로 막혔다. 맞춘 뒤 같은 입력의 모의전: 임프 100%(HP 68% 남음)·마왕 100%(35% 남음).
일반 JRPG 경로(`expand_jrpg_campaign_volume`·`author_jrpg_chapter` 의 `pickTroops`)도 `pickFittedTroops` 로 같은 맞춤을 거친다 — 원본 DB 적·그룹은 그대로 두고 `troop_fit_<역할>_<원본>`·`enemy_fit_<역할>_<원본>` 사본을 만들어 쓴다(`bossThreatScaling.fitTroopCopy`, 있으면 재사용, 준 그룹은 그대로). `pickTroops` 는 `troop_fit_*` 를 고르지 않는다.

## 시험

- 정본 저장 견본: `bun scripts/qa/dungeons/themes-samples.mts <새 프로젝트 폴더> <out> 1,2` — 열두 종류 × 시드 둘을 한 프로젝트에 지어 SQLite 에 저장·다시 열고 대조(mismatch·lint), 다시 연 사본으로 `<theme>@<seed>-<층>.png`. viz `~/claude-viz/dungeon-themes-2.html`.
- 도구 경로 증명: `bun scripts/qa/dungeons/themes-proof.mts <out> [case...]` — 24 경우(종류 열둘 × 둘), 층 PNG·이벤트·린트·장치 줄.
- 조수 실경로: space-craft `dt-<theme>-a|b` 24건(`harness-data/space-craft/seed.json`), 판정 brief `harness-data/space-craft/dungeon-vqa-brief.md` 의 M11(주제로 읽히는가)·M12(두 요청이 복사본인가)·M13(장치가 쓰이는가).
