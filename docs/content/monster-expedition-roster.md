# 별빛섬 몬스터 원정 — 로스터와 손 도트

## 구현 계약

`src/project/examples/monsterExpedition/roster.ts`의 동기 함수
`configureExpeditionRoster(project)`를 Gen1 기본 타입/상태 설정 뒤에 호출한다.
파일 시스템·네트워크·정본 DB 접근은 없다. 기존 기본 액터·아이템·이벤트가
참조하는 DB 행은 보존하고 같은 ID의 `mx_` 행만 교체한다. 캠페인의 조우·도감은
`EXPEDITION_SPECIES`의 60종을 사용한다. 종족 배열에서 `mx_species_` 이외의
기본 종까지 조우에 넣으면 이 캠페인의 오리지널 로스터 밖의 콘텐츠가 섞인다.

- `EXPEDITION_SPECIES`: 종 ID, 한글 이름, 실제 단계별 타입, 단계, 계열,
  서식지, 각 종의 고유 도감 설명. 단계 `0`은 독립 희귀 종이다.
- `EXPEDITION_STARTERS`: `mx_species_spriglet`, `mx_species_coalbit`,
  `mx_species_rivulet`.
- `EXPEDITION_LEGENDARIES`: 아래 독립 희귀 종 6개.
- 기술: `mx_skill_<type>_<1..6>`, 15타입 × 6개 = 90개.
- 기본 적: `mx_enemy_<slug>`, 종과 같은 이름. 기본 레벨은 5/22/40/50이다.
  캠페인 저작자는 실제 조우 레벨에 맞는 별도 적을 만든다.
- 그림: `mx_art_<slug>_front`, `mx_art_<slug>_back`.

## 계열

모든 종의 ID는 아래 영문 키에 `mx_species_`를 붙인다. 타입은 최종 단계 기준이며,
두 번째 타입은 일부 계열에서 진화 때 생긴다. 실제 단계별 값은 공개 배열을 읽는다.

| 계열 | 종 키 (1 → 2 → 3) | 최종 타입 | 서식지 | 진화 레벨 |
|---|---|---|---|---|
| hare | spriglet → frondhare → grovewarden | grass/psychic | grass | 16/34 |
| pangolin | coalbit → kilnclaw → furnscale | fire/fighting | volcano | 16/34 |
| otter | rivulet → brookraft → tidekeeper | water/ice | coast | 16/34 |
| beetle | pipbug → podback → orchardant | bug/grass | forest | 10/23 |
| bird | gustchick → ribbonwing → galecrest | normal/flying | grass | 14/30 |
| gecko | zaptoe → coilcrest → stormskink | electric/dragon | mountain | 18/36 |
| ram | pebblekid → craghoof → ridgehorn | rock/fighting | mountain | 19/37 |
| scorpion | sandnip → dunestalk → miragespike | poison/ground | desert | 17/35 |
| lynx | flurrykit → rimepelt → glaciermane | ice/normal | snow | 18/36 |
| moth | wickworm → lanternwing → beaconmoth | bug/fire | forest | 11/25 |
| newt | miretail → venomfrill → marshcrown | poison/water | swamp | 17/33 |
| boar | rootpig → brambleboar → briartusk | ground/grass | forest | 18/35 |
| mantis | dozemite → trancescythe → oraclemantis | psychic/bug | ruins | 20/38 |
| mole | gritnose → tunnelpaw → faultdigger | ground/rock | cave | 16/32 |
| puppet | threadimp → hushdoll → veilmaster | ghost/psychic | ruins | 21/39 |
| heron | reedpeep → fenstrider → mistralheron | flying/water | swamp | 15/31 |
| crab | coralpin → reefguard → atollclamp | water/rock | coast | 19/36 |
| seahorse | curlfin → brinewyrm → abyssail | dragon/water | coast | 24/43 |

| 독립 희귀 종 키 | 한글 이름 | 타입 | 서식지 |
|---|---|---|---|
| thundercairn | 천뢰산양 | electric/rock | mountain |
| winterquill | 설월학 | ice/flying | snow |
| solmane | 해갈기사자 | fire/normal | volcano |
| lunavane | 달빛가오리 | psychic/water | coast |
| relicarab | 유적장수 | bug/rock | desert |
| astralhart | 별가지사슴 | grass/ghost | ruins |

## 전투와 성장 근거

- 종족 능력은 `monsterBattleStatsForSpecies`의 네이티브 레벨/IV 산식을 쓴다.
  성체 기준 HP/공격/방어/특수/속도 합계는 일반 428~467, 희귀 505~535다.
  어린 종은 성체의 54%, 중간 종은 77%다. 진화하면 모든 능력이 증가한다.
  MP는 기본 12이며 Gen1 기술의 비용은 PP로 관리한다.
- 기본 경험치 곡선은 `{base:18,extra:8,acceleration:8}`이다. 네이티브 누적값은
  L5=190, L16=1,871, L34=8,127, L56=21,524다. 같은 계열은 같은 곡선을
  계속 써 진화 전후의 경험치가 갑자기 바뀌지 않는다.
- 기본 적 경험치 보상은 `level*(2+stage)`, 희귀는 `level*7`이다. 후기 일반
  적 Lv40은 200 EXP이며 다음 레벨에 약 500 EXP가 필요하다. 실제 트레이너
  편성 수에 따라 캠페인 생성기가 보상을 조절한다. 2~3마리 트레이너를 여러 번
  거쳐 한 레벨을 올리려면 적 하나당 대략 `level*2.5`를 출발점으로 쓴다.
- 레벨 1의 공통 견제기, 3의 타입 기본기, 7의 보조기, 11의 타입 공격기 이후
  16/20/23/27/32/37/43/48/54에서 두 타입의 기술을 배운다. 90개 모두 실제
  종의 습득표에 등장한다. 엔진의 최근 4개 기술 규칙과 레벨업 선택 창을 따른다.
- 공격 위력 30/35/55/75/90/105, PP 5~30. 선공(+1), 급소 상승, 독·화상·
  마비·수면·빙결, 공격/방어/속도 변화, 50% 흡수, 자가 회복, 상태 치료가
  실제 필드로 저작돼 있다. 얼리는 보조기는 PP5/명중55로 제한한다.
- 포획률은 0~1 스케일: 어린 종 .72, 중간 .42, 성체 .20, 희귀 .065.
  HP·상태·구슬별 판정은 기존 Gen1 포획 런타임이 수행한다.
- 상태 참조는 Gen1 기본 주요 상태 5종과 기본 `state_attack_up/down`,
  `state_defense_up/down`, `state_agility_up/down`이다. 상태/애니메이션을
  캠페인 구성 중 삭제하지 않는다. 빠진 애니메이션은 명시적으로 생략한다.

## 그림, 출처, 휴대성

원본은 `scripts/content/monster-expedition-art.py`의 정수 좌표 도형이다.
24개 해부 형태(18계열 + 6희귀)를 각각 직접 작성했고 진화에 따라 잎·갑옷·
뿔·날개·집게·지느러미가 자란다. 유충은 성체와 전혀 다른 분절 형태를 쓴다.
외부 몬스터 그림, 원작 캐릭터, Scarloxy 그림, 이미지 생성 결과, 추적/복사는
사용하지 않았다. 저작된 앞/뒤 PNG 모두 고유하며 뒷모습에는 후두부·등판·
접힌 날개·꼬리 뿌리·등 봉합선을 따로 그린다. 앞모습의 좌우 반전이 아니다.

2026-10-04 그림은 투명 RGBA 네이티브 64×64, 3단 몸색·계열별 유색 외곽선,
정수 도트다. 기존 80단위 저작 좌표를 도형을 그리기 전에 네이티브 정수 좌표로
투영하며 PNG 축소를 하지 않는다. 어린/중간/성체는 몸통 윤곽·관절·장식과
표정이 구분되고, 등판·꼬리 뿌리·접힌 부속지는 뒤에서 별도로 그린다.
180개 그림 모두 몸색/밝은색/그늘색이 실제 픽셀에 있으며 불투명색은 최대8색이다.
전투 그림의 마지막 불투명 행은61, 별도 직접 저작한 32×32 정적 파티/도감
아이콘은29다. 흐림/벡터 안티앨리어싱이 없고 alpha는0/255다.
등록 kind는 지원되는 `monster`, meta는 width/height만 쓴다. 기존120개
전투 resource ID와60종 데이터는 유지하며 아이콘만 `mx_art_<slug>_icon`으로
추가한다. 종 graphic에는 지원되지 않는 아이콘 필드를 넣지 않는다.
그림 목록·네이티브 bbox·실사용 팔레트·개별 SHA-256은 `catalog.json`,
원본 코드 SHA·seed SHA·팔레트/정수 좌표 계약은 `provenance.json`이다.
둘 다 `public/assets/monster-expedition/creatures/` 아래에 생성된다.

`uploaded-art.json`에 PNG data URL을 넣어 동기 seed가 자산을 실제
`project.assets.uploaded`에 등록한다. 이 파일은 참고문서 이미지 번들이 아니다.
상대 URL만 저장하면 독립 내보내기/SQLite 가져오기에서 그림이 끊길 수 있다.
정본 저장 시 호스트의 표준 자산 외부화가 data URL을 내용 주소 참조로 바꾸며,
휴대용 내보내기는 같은 업로드 자산 경로를 사용한다. 프로젝트마다 seed 객체를
복사하므로 한 저장소의 외부화가 다음 프로젝트의 원본을 변경하지 않는다.

원본과 결과는 프로젝트 소유 콘텐츠다. 이 문서는 별도 재배포 라이선스를
추가하지 않는다. 제삼자 몬스터 소재의 출처/라이선스 의무는 없다. Python/Pillow는
저작 도구로만 쓰이며 게임 자산으로 배포하지 않는다.

## 확인한 범위

2026-10-03: 120 PNG 생성, 비어 있지 않은 도형/모두 다른 SHA-256 확인,
앞/뒤 전체 contact sheet와 3스타터 확대 그림을 직접 열어 시각 확인.
native 모듈을 esbuild로 빌드한 뒤 구성/재구성하여 60종/90기술/60적/120자산,
15타입, 전체 기술 학습 가능, 진화 참조, 성장 증가, PP 범위, 상태 참조,
보조기의 실제 효과, 기술 정규화 왕복·동일 구성 재실행 일치를 확인했다.
전체 typecheck/Vitest/gates는 실행하지 않았다. 정본 저장·재로드와 실제
플레이어 화면 확인은 캠페인 통합 담당자의 완료 절차다.

- `contact-sheet.png`: 전체 60종, 각 칸 앞/뒤 한 쌍.
- `starter-review.png`: 새싹토/숯비늘/여울랑의 앞/뒤 3배 확대.
