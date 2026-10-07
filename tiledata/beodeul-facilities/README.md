# 버들항 RPG 시설 · 건물과 작업 마당 32종

공용 beodeul_city 시설 도장 bd-facility-*. 16px, tex_beodeul_city 네이티브 시트와 tex_beodeul_architecture 원본 보존 보정 시트의 합성이다. 새 기와·벽 그림을 그리지 않는다. 기존 3/4 지붕 윗면, 윤곽, 픽셀, 한 문과 창문을 유지한다. 각 시설은 건물 하나와 용도별 기물 둘로 구분한다. 서로 다른 시설 이름이 같은 원본 건물을 사용할 수 있다. 외장 조립안이며 판매·회복·수련·은행·NPC 대화 기능이 자동으로 만들어지는 것은 아니다.

## 조립

1. referencePurpose=beodeul-facilities의 MD 모든 페이지와 실제 그림을 읽는다. 이 카탈로그의 숫자는 새 기본 city source 정의 기준이다. 현재 프로젝트의 동명 키트 배열이 실제 target이다. 문서 숫자를 다른 저장본에 그대로 칠하지 않는다. stamp_object({objectId:'kit:beodeul_city/bd-facility-<id>',mapId,x,y})를 사용한다. 코드로 이식할 때 translateTiles(sourceFactory,target,모든 rows 숫자)로 graft를 재사용한다.
2. width×height 전체를 평지에 예약한다. 건물 원점은 도장 원점+(1,1), 소품은 오른쪽 작업 마당이다. 물·절벽·다른 건물에 겹치면 배치하지 않는다. 최소 크기는 각 키트의 width,height와 같으며 자르지 않는다. 반복 금지 fixed.
3. 기본 밝은 잔디737, 저대비 흙마당, 공용 기초·짧은 일광 그림자를 먼저 배치한다. 건물 본체는 3층, 낮은 그림자는2층, 접점 풀·기초는4층. 불투명 지면만1층이다. 본체 윗부분 ★와 밑동 X를 섞어 추측하지 말고 source priority/passability를 그대로 가져온다.
4. 각 도장 parts.entrance 아래칸(dx,dy+h)부터 도장 남쪽 끝까지 접근로를 비워 큰길에 연결한다. 원본 회관의 문 아래 현관 ★ 그림은 유지한다. 소품은 문 앞에 놓지 않는다. 실제 canMove로 시작→모든 문앞과 다리 양쪽 둑을 확인한다.
5. 나루터 사무소는 육지에 세운다. 실제 예제는 널판 3×3 bd-pick-swamp-stilt-ground-deck를 (25,46)에 1층으로 놓고 물가 경계칸까지 덮어 (28,47) 육지→(27,47)→(26,47) 잔교를 연결한다. 계선주 (25,46), 나룻배 (23,48). 물 원래의 X를 임의로 O로 바꾸지 않는다. 선착장 그림과 배 이동 이벤트는 별개의 저작이다.
6. 50×50에는 필요한 시설만 고른다. 큰 시설을 전부 넣지 않는다. 강가 물류/주막 공동마당/약초 재배/인물 작업장처럼 생활 관계로 묶는다. 모든 기존 도로와 기와·황록 나무를 보존한다. 남쪽 포석길은 y>=37에서 포석만으로 교회→남쪽 다리 연결을 따로 검사한다.

## 시설 사전

| id | 시설 | 역할 | 원본 건물 | 기물 1 | 기물 2 |
|---|---|---|---|---|---|
| inn | 여관 | 휴식·교류 | bd-house-village-brick | bd-prop-bench_wood | bd-prop-laundry_rack |
| tavern | 술집 | 휴식·교류 | bd-house-cafe | bd-prop-table_mugs | bd-prop-stall_jug_bottle |
| cafe | 찻집·식당 | 휴식·교류 | bd-house-cafe | bd-prop-parasol_table | bd-prop-bread_rack |
| general-shop | 잡화점 | 거래·장비 | bd-house-village-ochre | bd-prop-goods_pile | bd-prop-sandwich_board |
| weapon-shop | 무기점 | 거래·장비 | bd-house-village-brick | bd-prop-sword_barrel | bd-prop-goods_pile |
| armour-shop | 방어구점 | 거래·장비 | bd-house-village-cream | bd-prop-cloth_stand | bd-prop-sword_barrel |
| smithy | 대장간 | 거래·장비 | bd-house-smithy_town | bd-pick-volcano-cave-anvil | bd-pick-volcano-cave-ingots |
| jeweller | 보석상 | 거래·장비 | bd-house-village-stone | bd-prop-sandwich_board | bd-prop-planter_round |
| apothecary | 약초사 집 | 마법·치료 | bd-house-village-cream | bd-pick-wizard-tower-herb-rack | bd-pick-wizard-tower-bed-herb |
| alchemist | 연금술 공방 | 마법·치료 | bd-house-village-stone | bd-pick-wizard-tower-athanor | bd-pick-wizard-tower-herb-rack |
| healer | 치료소 | 마법·치료 | bd-house-village-ochre | bd-prop-door_pots | bd-prop-bench_wood |
| chapel | 예배당 | 신앙 | bd-house-village-church | bd-prop-flowerbox_long | bd-prop-bench_wood |
| adventurers-guild | 모험가 길드 | 의뢰·성장 | bd-house-village-brick | bd-prop-sandwich_board | bd-prop-sword_barrel |
| training-house | 훈련소 | 의뢰·성장 | bd-house-village-ochre | bd-prop-sword_barrel | bd-prop-bench_wood |
| guardhouse | 경비초소 | 통치·치안 | bd-house-village-stone | bd-prop-sword_barrel | bd-prop-lamp_crook |
| prison | 감옥 | 통치·치안 | bd-house-village-stone | bd-prop-sandwich_board | bd-prop-lamp_crook |
| village-hall | 촌장 집·회관 | 통치·치안 | bd-house-manor | bd-prop-sandwich_board | bd-prop-bench_wood |
| bank | 금고·은행 | 거래·보관 | bd-house-village-stone | bd-prop-sandwich_board | bd-prop-goods_pile |
| stable | 마구간·역참 | 이동·물류 | bd-house-cstable | bd-out-hay-barrels | bd-prop-bench_wood |
| ferry-office | 나루터 사무소 | 이동·물류 | bd-house-village-sage | bd-prop-anchor_display | bd-prop-mooring_bollard |
| warehouse | 항구 창고 | 이동·물류 | bd-house-ware0 | bd-prop-goods_pile | bd-prop-fish_crates |
| granary | 곡물창고 | 생산·생활 | bd-house-ware0 | bd-out-hay-barrels | bd-prop-goods_pile |
| bakery | 빵집 | 생산·생활 | bd-house-village-ochre | bd-prop-bread_rack | bd-prop-sandwich_board |
| brewery | 양조장 | 생산·생활 | bd-house-village-brick | bd-prop-stall_jug_bottle | bd-prop-table_mugs |
| tailor | 재단사 집 | 생산·생활 | bd-house-village-cream | bd-prop-cloth_stand | bd-prop-laundry_rack |
| carpenter | 목공소 | 생산·생활 | bd-house-village-ochre | bd-out-woodpile | bd-prop-goods_pile |
| library | 서점·도서관 | 지식·문화 | bd-house-village-brick | bd-prop-sandwich_board | bd-prop-bench_wood |
| inventor | 발명가 집 | 특별한 이야기 | bd-house-village-stone | bd-pick-wizard-tower-armillary | bd-pick-wizard-tower-orrery |
| mage | 마법사 거처 | 특별한 이야기 | bd-house-village-sage | bd-pick-wizard-tower-athanor | bd-pick-wizard-tower-globe |
| fortune-teller | 점술집 | 특별한 이야기 | bd-house-village-stone | bd-pick-wizard-tower-globe | bd-pick-wizard-tower-sundial |
| retired-adventurer | 은퇴한 모험가의 집 | 특별한 이야기 | bd-house-village-cream | bd-prop-sword_barrel | bd-prop-bench_wood |
| missing-family | 실종자 가족의 집 | 특별한 이야기 | bd-house-village-ochre | bd-prop-laundry_rack | bd-prop-flowerbox_long |

은행/도서관/감옥처럼 전용 문양이나 실내가 없는 용도는 의미가 부여된 원본 건물과 작업 마당 도안이다. 전용 실내·간판 그림·거래 이벤트를 만들기 전에는 이미 구현된 기능으로 설명하지 않는다. 실내는 공용 hand interior v5 경로로 별도 저작한다.

## 근거와 오류

현재 실제 예제는 기존 18동을 유지하고 약초사 집·발명가 집·술집·항구 창고·나루터 사무소의 마당을 꾸몄다. 전체 배열과 정확한 역할/좌표는 뒤 문서에 있다. 정상/오류는 blocked-facility-entrance, (5,12). 정상 약초사 문앞에 실제 칼통을 놓으면 canMove (5,13)→(5,12)가 true에서 false로 바뀐다. 기계 검사는 도로·입구·범위·source 배열을 확인하며 시설 기능·미적 합격을 대신하지 않는다.

기획 참고: Dragon Quest VIII 공식 시설 소개 https://www.nintendo.com/en-gb/Games/Nintendo-3DS-games/DRAGON-QUEST-VIII-Journey-of-the-Cursed-King-1136167.html · FFXIV 공식 도시 지도 https://www.finalfantasyxiv.com/beginner/read/read2111.pdf · Chrono Trigger 트루스 촌장 저택 https://guides.gamercorner.net/ct/areas/mayors-manor-truce . 그림 소재는 프로젝트의 기존 손 도트만 사용한다.
