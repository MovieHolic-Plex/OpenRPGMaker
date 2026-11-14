# IDS — KR 건물·옥상·시골 기물 (draw-kr, 2026-11-14)

칩셋 modern_city · 브랜치 agent/draw-kr-buildings · 면제 묶음 fable-krbuildings-2026-11-14. id·크기는 바뀌지 않는다. 떨어진 그림은 DROPPED.
건물: 키트 전체 칸 막힘(위층). 문 칸 = (doorDx.., h-1) 그림 칸(막힘), 접근 칸 = 키트 바깥 한 줄 아래 (doorDx.., h) — 기존 mc-bld 와 같은 규칙. **문 칸은 구운 키트의 `ai.access` · `parts[entrance]` 가 정본이다**(그림에 맞춰 이 표의 문 칸이 한 번 바뀔 수 있다 — «구움» 인 줄은 확정). program 은 키트 `ai.program`. h 는 지붕 면 포함.
지붕 면 = 옥상 기물(mc-roof-kr-*)을 얹을 수 있는 칸 사각형(키트 원점 기준, 난간 안쪽). «빈 지붕» 은 구성기가 옥상 기물을 얹을 몫이고 키트 태그 `roof:empty`, 키트 `ai.roofFace` 에 같은 값이 있다. 기와·볼트·특수 지붕은 `-`.
태그: country:kr, tier:*, setting:city|rural, kind:<장면 벌>.

## 건물 60 (`mc-bld-kr-<type>`)

| kit id | 이름 | tier | w×h | 문 칸(dx,dy;폭) | 접근 칸 | program | 지붕 면(dx,dy,w×h) | 나라 | 곳 | 상태 |
|---|---|---|---|---|---|---|---|---|---|---|
| `mc-bld-kr-conv` | 편의점 | small | 5×5 | (3,4);1 | (3,5) | mc_konbini | (0,1) 5×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-bunsik` | 분식집 | small | 4×5 | (1,4);1 | (1,5) | mc_restaurant | (0,1) 4×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-chicken` | 치킨집 | small | 4×6 | (1,5);1 | (1,6) | mc_fastfood | - | kr | city | 구움 |
| `mc-bld-kr-cafe` | 동네 카페 | small | 4×5 | (2,4);1 | (2,5) | mc_cafe | (0,1) 4×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-pharmacy` | 약국 | small | 4×5 | (1,4);1 | (1,5) | mc_pharmacy | (0,1) 4×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-salon` | 미용실 | small | 4×5 | (2,4);1 | (2,5) | mc_salon | (0,1) 4×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-laundry` | 세탁소 | small | 3×5 | (1,4);1 | (1,5) | mc_laundry | (0,1) 3×1 **빈 지붕** | kr | city | 구움 |
| `mc-bld-kr-hardware` | 철물점 | small | 5×5 | (3,4);1 | (3,5) | mc_warehouse | (0,1) 5×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-realty` | 부동산 | small | 3×5 | (1,4);1 | (1,5) | mc_realty | (0,1) 3×1 **빈 지붕** | kr | city | 구움 |
| `mc-bld-kr-lotto` | 복권방 겸 구멍가게 | small | 3×4 | (0,3);1 | (0,4) | mc_konbini | - | kr | city | 구움 |
| `mc-bld-kr-ricecake` | 떡집 | small | 4×5 | (1,4);1 | (1,5) | mc_bakery_cafe | (0,1) 4×1 **빈 지붕** | kr | city | 구움 |
| `mc-bld-kr-butcher` | 정육점 | small | 4×5 | (2,4);1 | (2,5) | mc_supermarket | (0,1) 4×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-fruit` | 과일가게 | small | 5×4 | (4,3);1 | (4,4) | mc_supermarket | - | kr | city | 구움 |
| `mc-bld-kr-florist` | 꽃집 | small | 3×5 | (2,4);1 | (2,5) | mc_florist | (0,1) 3×1 **빈 지붕** | kr | city | 구움 |
| `mc-bld-kr-stationery` | 문구점 | small | 4×5 | (1,4);1 | (1,5) | mc_stationery | (0,1) 4×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-cobbler` | 구둣방 컨테이너 | small | 3×3 | (0,2);1 | (0,3) | - | - | kr | city | 구움 |
| `mc-bld-kr-policebox` | 파출소 | small | 5×5 | (2,4);1 | (2,5) | mc_police | (0,1) 5×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-guardhouse` | 경비실 | small | 3×4 | (2,3);1 | (2,4) | - | - | kr | city | 구움 |
| `mc-bld-kr-ticket` | 버스 매표소 | small | 4×4 | (1,3);1 | (1,4) | mc_bus_terminal | - | kr | city | 구움 |
| `mc-bld-kr-toilet` | 공중화장실 | small | 4×4 | (1,3);1 | (1,4) | - | - | kr | city | 구움 |
| `mc-bld-kr-sangga3` | 3층 상가 | medium | 6×8 | (2,7);1 | (2,8) | mc_restaurant | (0,1) 6×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-sangga5` | 5층 상가 | medium | 6×11 | (2,10);1 | (2,11) | mc_office | (0,1) 6×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-villa` | 필로티 빌라 | medium | 7×9 | (3,8);1 | (3,9) | mc_apartment | (0,1) 7×2 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-dasedae` | 붉은 벽돌 다세대 | medium | 6×8 | (4,7);1 | (4,8) | mc_old_apartment | (0,1) 6×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-hagwon` | 학원 건물 | medium | 6×10 | (2,9);1 | (2,10) | mc_cram_school | (0,1) 6×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-pcnorae` | PC방·노래방 건물 | medium | 7×9 | (3,8);1 | (3,9) | mc_karaoke | - | kr | city | 구움 |
| `mc-bld-kr-clinic` | 동네 의원 | medium | 6×7 | (2,6);2 | (2,7) (3,7) | mc_clinic | (0,1) 6×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-bank` | 은행 지점 | medium | 8×7 | (3,6);2 | (3,7) (4,7) | mc_bank | (0,1) 8×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-post` | 우체국 | medium | 7×7 | (3,6);1 | (3,7) | mc_post_office | (0,1) 7×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-jumin` | 주민센터 | medium | 8×7 | (3,6);2 | (3,7) (4,7) | mc_ward_office | (0,1) 8×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-church` | 교회 | medium | 6×10 | (2,9);2 | (2,10) (3,10) | mc_auditorium | (0,1) 6×3 **빈 지붕** | kr | city | 구움 |
| `mc-bld-kr-bathhouse` | 목욕탕 | medium | 7×9 | (3,8);1 | (3,9) | mc_sento_machi | (0,4) 7×2 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-gosiwon` | 고시원 | medium | 6×10 | (2,9);1 | (2,10) | mc_boarding_house | - | kr | city | 구움 |
| `mc-bld-kr-hanokcafe` | 한옥 카페 | medium | 8×6 | (3,5);2 | (3,6) (4,6) | mc_tea_room | (0,1) 8×1 **빈 지붕** | kr | city | 구움 |
| `mc-bld-kr-gas` | 주유소 | medium | 8×7 | (5,6);1 | (5,7) | mc_gas_station | (0,1) 8×1 기물 그려 넣음 | kr | city | 구움 |
| `mc-bld-kr-carcenter` | 카센터 | medium | 8×6 | (6,5);1 | (6,6) | mc_warehouse | - | kr | city | 그리는 중 |
| `mc-bld-kr-apt-corridor` | 복도식 아파트 동 | large | 12×13 | (5,12);2 | (5,13) (6,13) | mc_old_apartment | - | kr | city | 그리는 중 |
| `mc-bld-kr-apt-tower` | 타워형 아파트 동 | large | 9×15 | (4,14);1 | (4,15) | mc_apartment | - | kr | city | 그리는 중 |
| `mc-bld-kr-officetel` | 오피스텔 | large | 9×13 | (4,12);1 | (4,13) | mc_officetel | - | kr | city | 그리는 중 |
| `mc-bld-kr-hospital` | 종합병원 | large | 12×11 | (5,10);2 | (5,11) (6,11) | mc_hospital | - | kr | city | 그리는 중 |
| `mc-bld-kr-elementary` | 초등학교 본관 | large | 13×9 | (6,8);1 | (6,9) | mc_elementary | - | kr | city | 그리는 중 |
| `mc-bld-kr-mart` | 대형마트 | large | 13×8 | (5,7);3 | (5,8) (6,8) (7,8) | mc_supermarket | - | kr | city | 그리는 중 |
| `mc-bld-kr-cinema` | 영화관 | large | 10×10 | (4,9);2 | (4,10) (5,10) | mc_cinema | - | kr | city | 그리는 중 |
| `mc-bld-kr-gucheong` | 구청 | large | 12×10 | (5,9);2 | (5,10) (6,10) | mc_city_hall | - | kr | city | 그리는 중 |
| `mc-bld-kr-library` | 도서관 | large | 10×8 | (4,7);2 | (4,8) (5,8) | mc_library | - | kr | city | 그리는 중 |
| `mc-bld-kr-terminal` | 시외버스 터미널 | large | 13×8 | (6,7);1 | (6,8) | mc_bus_terminal | - | kr | city | 그리는 중 |
| `mc-bld-kr-market` | 재래시장 아케이드 | large | 11×7 | (6,6);2 | (6,7) (7,7) | mc_underground_mall | - | kr | city | 그리는 중 |
| `mc-bld-kr-subway` | 지하철역 지상 건물 | large | 9×7 | (4,6);1 | (4,7) | mc_station | - | kr | city | 그리는 중 |
| `mc-bld-kr-dept` | 백화점 | xlarge | 16×12 | (6,11);4 | (6,12) (7,12) (8,12) (9,12) | mc_department_store | - | kr | city | 그리는 중 |
| `mc-bld-kr-univ` | 대학 본관 | xlarge | 18×11 | (8,10);2 | (8,11) (9,11) | mc_university | - | kr | city | 그리는 중 |
| `mc-bld-kr-ktx` | KTX 역사 | xlarge | 20×10 | (8,9);3 | (8,10) (9,10) (10,10) | mc_jr_station | - | kr | city | 그리는 중 |
| `mc-bld-kr-ballpark` | 야구장 | xlarge | 20×12 | (8,11);3 | (8,12) (9,12) (10,12) | mc_gym | - | kr | city | 그리는 중 |
| `mc-bld-kr-convention` | 컨벤션 센터 | xlarge | 18×9 | (8,8);2 | (8,9) (9,9) | mc_auditorium | - | kr | city | 그리는 중 |
| `mc-bld-kr-broadcast` | 방송국 | xlarge | 15×12 | (7,11);2 | (7,12) (8,12) | mc_tv_studio | - | kr | city | 그리는 중 |
| `mc-bld-kr-factory` | 공장 단지 | xlarge | 20×9 | (9,8);1 | (9,9) | mc_factory | - | kr | city | 그리는 중 |
| `mc-bld-kr-univhospital` | 대학병원 | xlarge | 18×13 | (7,12);1 | (7,13) | mc_hospital | - | kr | city | 그리는 중 |
| `mc-bld-kr-tower` | 전망 타워 | landmark | 6×16 | (2,15);2 | (2,16) (3,16) | mc_lobby | - | kr | city | 그리는 중 |
| `mc-bld-kr-palacegate` | 한옥 궁궐 정문 | landmark | 14×9 | (6,8);2 | (6,9) (7,9) | - | - | kr | city | 그리는 중 |
| `mc-bld-kr-bridgepylon` | 큰 다리 주탑 | landmark | 6×14 | 없음(기념물, 전부 막힘) | - | - | - | kr | city | 그리는 중 |
| `mc-bld-kr-clocktower` | 광장의 큰 시계탑 | landmark | 4×10 | 없음(기념물, 전부 막힘) | - | - | - | kr | city | 그리는 중 |

## 옥상 기물 16 (`mc-roof-kr-<name>`) — 이 일꾼이 그린다(거리 일꾼은 그리지 않는다)

지붕 면 위에 찍는 위층 그림. 한국 건물 키트의 지붕 면에는 이미 기물이 그려져 있다 — 이 키트들은 다른 건물(기존 mc-bld 포함) 지붕을 더 채울 때 쓴다.

| kit id | 이름 | w×h | 상태 |
|---|---|---|---|
| `mc-roof-kr-tank-yellow` | 노란 물탱크 | 2×2 | 구움 |
| `mc-roof-kr-tank-blue` | 파란 물탱크 | 2×2 | 구움 |
| `mc-roof-kr-oktap` | 옥탑방 | 3×2 | 구움 |
| `mc-roof-kr-ac-row` | 실외기 줄 | 3×1 | 구움 |
| `mc-roof-kr-pyeongsang` | 옥상 평상과 화분 | 3×2 | 그리는 중 |
| `mc-roof-kr-laundry` | 옥상 빨랫줄 | 3×2 | 구움 |
| `mc-roof-kr-jangdok` | 옥상 장독대 | 2×2 | 구움 |
| `mc-roof-kr-antenna` | 안테나 | 1×2 | 구움 |
| `mc-roof-kr-solar` | 태양광 판 | 3×2 | 구움 |
| `mc-roof-kr-duct` | 환기 덕트 | 2×2 | 구움 |
| `mc-roof-kr-door` | 옥상 문(계단실) | 2×2 | 구움 |
| `mc-roof-kr-sign` | 옥상 간판 | 3×2 | 구움 |
| `mc-roof-kr-garden` | 옥상 텃밭 상자 | 2×1 | 구움 |
| `mc-roof-kr-cooling` | 냉각탑 | 2×2 | 구움 |
| `mc-roof-kr-skylight` | 천창 | 2×1 | 구움 |
| `mc-roof-kr-tarp` | 파란 천막 더미 | 2×1 | 구움 |

## 시골 기물 88 (`mc-prop-krr-<name>`) — 장면 벌

통행 줄: X 막힘 · * 사람 위(걷는다) · . 바닥 그림(밟는다). 줄은 위에서 아래.

| kit id | 벌(kind) | 이름 | w×h | 통행 | 상태 |
|---|---|---|---|---|---|
| `mc-prop-krr-vinyl-end` | vinyl | 비닐하우스 앞면(문) | 3×2 | `***/XXX` | 그리는 중 |
| `mc-prop-krr-vinyl-body` | vinyl | 비닐하우스 몸통 | 3×2 | `***/XXX` | 그리는 중 |
| `mc-prop-krr-vinyl-frame` | vinyl | 비닐하우스 뼈대 | 3×2 | `***/XXX` | 그리는 중 |
| `mc-prop-krr-vinyl-tank` | vinyl | 농업용 물통 | 1×2 | `*/X` | 그리는 중 |
| `mc-prop-krr-vinyl-crates` | vinyl | 모종 상자 더미 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-vinyl-barrow` | vinyl | 외발 수레 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-vinyl-mulch` | vinyl | 검은 비닐 두둑 | 2×1 | `..` | 그리는 중 |
| `mc-prop-krr-paddy-young` | paddy | 모내기한 논 | 2×2 | `../..` | 그리는 중 |
| `mc-prop-krr-paddy-ripe` | paddy | 벼 익은 논 | 2×2 | `XX/XX` | 그리는 중 |
| `mc-prop-krr-paddy-stubble` | paddy | 벤 논 그루터기 | 2×2 | `../..` | 그리는 중 |
| `mc-prop-krr-paddy-sheaf` | paddy | 볏짚 더미 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-paddy-scarecrow` | paddy | 허수아비 | 1×2 | `*/X` | 그리는 중 |
| `mc-prop-krr-paddy-gate` | paddy | 논두렁 물꼬 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-paddy-egret` | paddy | 백로 | 1×2 | `*/X` | 그리는 중 |
| `mc-prop-krr-paddy-rack` | paddy | 볏단 말리는 걸이 | 3×2 | `***/XXX` | 그리는 중 |
| `mc-prop-krr-paddy-pump` | paddy | 양수기 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-chili-mat` | chili | 고추 말리는 멍석 | 2×1 | `..` | 그리는 중 |
| `mc-prop-krr-chili-mat-big` | chili | 고추 말리는 큰 멍석 | 3×2 | `.../...` | 그리는 중 |
| `mc-prop-krr-chili-sack` | chili | 고추 자루 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-chili-pyeongsang` | chili | 마당 평상 | 2×2 | `XX/XX` | 그리는 중 |
| `mc-prop-krr-chili-sieve` | chili | 키와 소쿠리 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-chili-corn` | chili | 말리는 옥수수 걸이 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-chili-radish` | chili | 무청 시래기 줄 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-jang-stand` | jangdok | 장독대 | 3×2 | `XXX/XXX` | 그리는 중 |
| `mc-prop-krr-jang-big` | jangdok | 큰 항아리 | 1×2 | `*/X` | 그리는 중 |
| `mc-prop-krr-jang-small` | jangdok | 작은 항아리 둘 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-jang-meju` | jangdok | 메주 걸이 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-jang-well` | jangdok | 수돗가 펌프 | 2×1 | `XX` | 그리는 중 |
| `mc-prop-krr-jang-rubber` | jangdok | 고무 대야 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-hall-jeongja` | hall | 정자 | 3×3 | `***/XXX/XXX` | 그리는 중 |
| `mc-prop-krr-hall-tree` | hall | 노거수 | 3×4 | `***/***/.X./.X.` | 그리는 중 |
| `mc-prop-krr-hall-treebench` | hall | 나무 아래 평상 | 2×1 | `XX` | 그리는 중 |
| `mc-prop-krr-hall-stone` | hall | 마을 표지석 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-hall-jangseung` | hall | 장승 한 쌍 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-hall-sotdae` | hall | 솟대 | 1×3 | `*/*/X` | 그리는 중 |
| `mc-prop-krr-hall-speaker` | hall | 마을 방송 스피커 기둥 | 1×3 | `*/*/X` | 그리는 중 |
| `mc-prop-krr-hall-board` | hall | 마을 게시판 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-hall-exercise` | hall | 운동 기구 | 1×2 | `*/X` | 그리는 중 |
| `mc-prop-krr-hall-flag` | hall | 새마을 깃대 | 1×3 | `*/*/X` | 그리는 중 |
| `mc-prop-krr-farm-cultivator` | machine | 경운기 | 3×2 | `***/XXX` | 그리는 중 |
| `mc-prop-krr-farm-tractor` | machine | 트랙터 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-farm-rearcar` | machine | 리어카 | 2×1 | `XX` | 그리는 중 |
| `mc-prop-krr-farm-truck` | machine | 농사 1톤 트럭 | 3×2 | `***/XXX` | 그리는 중 |
| `mc-prop-krr-farm-sprayer` | machine | 방제기 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-farm-plow` | machine | 쟁기와 농기구 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-nh-pallet` | nonghyup | 쌀 포대 팰릿 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-nh-fertilizer` | nonghyup | 비료 포대 더미 | 2×1 | `XX` | 그리는 중 |
| `mc-prop-krr-nh-forklift` | nonghyup | 지게차 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-nh-scale` | nonghyup | 계근 저울 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-nh-boxes` | nonghyup | 농산물 상자 더미 | 1×2 | `*/X` | 그리는 중 |
| `mc-prop-krr-nh-sign` | nonghyup | 공판장 간판 기둥 | 1×2 | `*/X` | 그리는 중 |
| `mc-prop-krr-bus-shelter` | busstop | 시골 버스 정류장 | 3×2 | `***/XXX` | 그리는 중 |
| `mc-prop-krr-bus-pole` | busstop | 정류장 표지 기둥 | 1×2 | `*/X` | 그리는 중 |
| `mc-prop-krr-bus-chair` | busstop | 낡은 의자 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-bus-mirror` | busstop | 도로 반사경 | 1×2 | `*/X` | 그리는 중 |
| `mc-prop-krr-bus-milestone` | busstop | 이정표 돌 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-orchard-apple` | orchard | 사과나무 | 2×3 | `**/**/XX` | 그리는 중 |
| `mc-prop-krr-orchard-crates` | orchard | 사과 궤짝 더미 | 2×1 | `XX` | 그리는 중 |
| `mc-prop-krr-orchard-ladder` | orchard | 과수원 사다리 | 1×2 | `*/X` | 그리는 중 |
| `mc-prop-krr-orchard-basket` | orchard | 사과 바구니 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-orchard-persimmon` | orchard | 감나무 | 2×3 | `**/**/XX` | 그리는 중 |
| `mc-prop-krr-orchard-gotgam` | orchard | 곶감 걸이 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-orchard-net` | orchard | 새 그물 지주 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-barn-trough` | barn | 소 여물통 | 2×1 | `XX` | 그리는 중 |
| `mc-prop-krr-barn-hayroll` | barn | 건초 롤 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-barn-silage` | barn | 사일리지 흰 롤 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-barn-cow` | barn | 한우 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-barn-fence` | barn | 축사 울타리 | 2×1 | `XX` | 그리는 중 |
| `mc-prop-krr-barn-manure` | barn | 두엄 더미 | 2×1 | `XX` | 그리는 중 |
| `mc-prop-krr-barn-doghouse` | barn | 개집 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-barn-chicken` | barn | 닭장 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-fish-pots` | fishing | 통발 더미 | 2×1 | `XX` | 그리는 중 |
| `mc-prop-krr-fish-nets` | fishing | 그물 더미 | 2×1 | `XX` | 그리는 중 |
| `mc-prop-krr-fish-squid` | fishing | 말리는 오징어 | 3×2 | `***/XXX` | 그리는 중 |
| `mc-prop-krr-fish-boat` | fishing | 작은 배 | 3×2 | `XXX/XXX` | 그리는 중 |
| `mc-prop-krr-fish-buoys` | fishing | 부표 더미 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-fish-drying` | fishing | 생선 건조대 | 2×1 | `XX` | 그리는 중 |
| `mc-prop-krr-fish-anchor` | fishing | 닻 | 1×1 | `X` | 그리는 중 |
| `mc-prop-krr-fish-tank` | fishing | 활어 수조 | 2×1 | `XX` | 그리는 중 |
| `mc-prop-krr-fish-light` | fishing | 작은 등대 | 1×3 | `*/*/X` | 그리는 중 |
| `mc-prop-krr-mt-spring` | mountain | 약수터 | 2×2 | `**/XX` | 그리는 중 |
| `mc-prop-krr-mt-cairn` | mountain | 돌탑 | 1×2 | `*/X` | 그리는 중 |
| `mc-prop-krr-mt-sign` | mountain | 등산 표지 | 1×2 | `*/X` | 그리는 중 |
| `mc-prop-krr-mt-bench` | mountain | 통나무 벤치 | 2×1 | `XX` | 그리는 중 |
| `mc-prop-krr-mt-steps` | mountain | 나무 계단 | 2×2 | `../..` | 그리는 중 |
| `mc-prop-krr-mt-rope` | mountain | 밧줄 난간 | 2×1 | `XX` | 그리는 중 |
| `mc-prop-krr-mt-grave` | mountain | 봉분 | 2×2 | `XX/XX` | 그리는 중 |
| `mc-prop-krr-mt-hives` | mountain | 벌통 | 2×1 | `XX` | 그리는 중 |
