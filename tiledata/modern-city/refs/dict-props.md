# 현대 도시 — 소품 키트 사전

tilesetId `modern_city` · 그림 `public/assets/modern-city/modern-city-chipset.png`(텍스처 `tex_modern_city`, **9998칸**, 16px 칸, 시트 768×3344px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-modern` — 버들항(`oprn-atlas`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

소품 키트 117종(같은 그림의 알파벳 글자 a~e 는 다른 원본 판). 키 큰 소품 26종은 발밑 줄만 막고 위 줄은 ★. `stamp_object({objectId:"kit:modern_city/<키트 id>", mapId, x, y})` 의 x,y 는 키트 왼쪽 위 칸.

| 키트 | 이름 | 크기 | ★ | 출처 슬롯 | 칸 수 |
|---|---|---|---|---|---|
| `mc-prop-lamp-a` | 가로등 | 1×3 | 키 큰(★ 윗줄) | lamp | 3 |
| `mc-prop-signal-a` | 신호등 | 1×3 | 키 큰(★ 윗줄) | signal | 3 |
| `mc-prop-bollard-a` | 볼라드 | 1×1 | - | bollard | 1 |
| `mc-prop-hydrant-a` | 소화전 | 1×1 | - | hydrant | 1 |
| `mc-prop-vending-a` | 자판기 | 1×2 | - | vending | 2 |
| `mc-prop-tree-a` | 가로수(기본) | 2×3 | 키 큰(★ 윗줄) | tree | 6 |
| `mc-prop-trash-a` | 쓰레기통 | 1×1 | - | trash | 1 |
| `mc-prop-busstop-a` | 버스 정류장 표지 | 1×3 | 키 큰(★ 윗줄) | busstop | 3 |
| `mc-prop-barrier-a` | 차단봉 | 2×1 | - | barrier | 2 |
| `mc-prop-barrier-b` | 차단봉 | 2×1 | - | barrier | 2 |
| `mc-prop-bench-a` | 벤치 | 2×1 | - | bench | 2 |
| `mc-prop-bench-b` | 벤치 | 2×1 | - | bench | 2 |
| `mc-prop-bench-c` | 벤치 | 2×1 | - | bench | 2 |
| `mc-prop-bench2-a` | 정류장 벤치 | 2×1 | - | bench2 | 2 |
| `mc-prop-bench2-b` | 정류장 벤치 | 2×1 | - | bench2 | 2 |
| `mc-prop-bike-a` | 자전거 | 2×1 | - | bike | 2 |
| `mc-prop-bike-c` | 자전거 | 2×1 | - | bike | 2 |
| `mc-prop-bike-row-a` | 자전거 거치대(3대) | 3×1 | - | bike_row | 3 |
| `mc-prop-bike-row-c` | 자전거 거치대(3대) | 3×1 | - | bike_row | 3 |
| `mc-prop-boxes-a` | 상자 | 1×1 | - | boxes | 1 |
| `mc-prop-boxes-b` | 상자 | 1×1 | - | boxes | 1 |
| `mc-prop-boxes-c` | 상자 | 1×1 | - | boxes | 1 |
| `mc-prop-bus-shelter-a` | 버스 정류장 지붕(큰) | 2×3 | - | bus_shelter | 6 |
| `mc-prop-bus-shelter-b` | 버스 정류장 지붕(큰) | 2×3 | - | bus_shelter | 6 |
| `mc-prop-bus-shelter-c` | 버스 정류장 지붕(큰) | 2×3 | - | bus_shelter | 6 |
| `mc-prop-cone-a` | 삼각콘 | 1×1 | - | cone | 1 |
| `mc-prop-cone-b` | 삼각콘 | 1×1 | - | cone | 1 |
| `mc-prop-fence-a` | 공사 펜스 | 1×1 | - | fence | 1 |
| `mc-prop-fence-b` | 공사 펜스 | 1×1 | - | fence | 1 |
| `mc-prop-hoarding-a` | 공사 가림막 | 2×2 | - | hoarding | 4 |
| `mc-prop-hoarding-b` | 공사 가림막 | 2×2 | - | hoarding | 4 |
| `mc-prop-hoarding-c` | 공사 가림막 | 2×2 | - | hoarding | 4 |
| `mc-prop-kiosk-a` | 매점 | 2×2 | - | kiosk | 4 |
| `mc-prop-kiosk-b` | 매점 | 2×2 | - | kiosk | 4 |
| `mc-prop-kiosk-c` | 매점 | 2×2 | - | kiosk | 4 |
| `mc-prop-mailbox-red-a` | 우체통(빨강) | 1×2 | - | mailbox_red | 2 |
| `mc-prop-mailbox-red-b` | 우체통(빨강) | 1×2 | - | mailbox_red | 2 |
| `mc-prop-mailbox-red-c` | 우체통(빨강) | 1×2 | - | mailbox_red | 2 |
| `mc-prop-meter-a` | 주차 미터기 | 1×2 | - | meter | 2 |
| `mc-prop-meter-b` | 주차 미터기 | 1×2 | - | meter | 2 |
| `mc-prop-meter-c` | 주차 미터기 | 1×2 | - | meter | 2 |
| `mc-prop-moto-c` | 오토바이 | 2×1 | - | moto | 2 |
| `mc-prop-newsstand-a` | 신문 가판대 | 1×2 | - | newsstand | 2 |
| `mc-prop-newsstand-b` | 신문 가판대 | 1×2 | - | newsstand | 2 |
| `mc-prop-newsstand-c` | 신문 가판대 | 1×2 | - | newsstand | 2 |
| `mc-prop-park-lamp-a` | 공원 가로등 | 1×2 | 키 큰(★ 윗줄) | park_lamp | 2 |
| `mc-prop-park-lamp-b` | 공원 가로등 | 1×2 | 키 큰(★ 윗줄) | park_lamp | 2 |
| `mc-prop-park-lamp-c` | 공원 가로등 | 1×2 | 키 큰(★ 윗줄) | park_lamp | 2 |
| `mc-prop-ped-signal-g-a` | 보행 신호기(녹색) | 1×3 | 키 큰(★ 윗줄) | ped_signal_g | 3 |
| `mc-prop-ped-signal-g-b` | 보행 신호기(녹색) | 1×3 | 키 큰(★ 윗줄) | ped_signal_g | 3 |
| `mc-prop-ped-signal-g-c` | 보행 신호기(녹색) | 1×3 | 키 큰(★ 윗줄) | ped_signal_g | 3 |
| `mc-prop-ped-signal-r-a` | 보행 신호기(적색) | 1×3 | 키 큰(★ 윗줄) | ped_signal_r | 3 |
| `mc-prop-ped-signal-r-b` | 보행 신호기(적색) | 1×3 | 키 큰(★ 윗줄) | ped_signal_r | 3 |
| `mc-prop-ped-signal-r-c` | 보행 신호기(적색) | 1×3 | 키 큰(★ 윗줄) | ped_signal_r | 3 |
| `mc-prop-phone-a` | 공중전화 | 1×2 | - | phone | 2 |
| `mc-prop-phone-b` | 공중전화 | 1×2 | - | phone | 2 |
| `mc-prop-phone-c` | 공중전화 | 1×2 | - | phone | 2 |
| `mc-prop-planter-a` | 화분 | 1×1 | - | planter | 1 |
| `mc-prop-planter-b` | 화분 | 1×1 | - | planter | 1 |
| `mc-prop-planter-c` | 화분 | 1×1 | - | planter | 1 |
| `mc-prop-pole-a` | 전신주 | 1×5 | 키 큰(★ 윗줄) | pole | 5 |
| `mc-prop-pole-b` | 전신주 | 1×5 | 키 큰(★ 윗줄) | pole | 4 |
| `mc-prop-postbox-a` | 우편함 | 1×2 | - | postbox | 2 |
| `mc-prop-postbox-b` | 우편함 | 1×2 | - | postbox | 2 |
| `mc-prop-postbox-c` | 우편함 | 1×2 | - | postbox | 2 |
| `mc-prop-recycle3-a` | 분리수거함(3통) | 1×1 | - | recycle3 | 1 |
| `mc-prop-recycle3-b` | 분리수거함(3통) | 1×1 | - | recycle3 | 1 |
| `mc-prop-recycle3-c` | 분리수거함(3통) | 1×1 | - | recycle3 | 1 |
| `mc-prop-sand-a` | 모래 포대 | 2×1 | - | sand | 2 |
| `mc-prop-sand-b` | 모래 포대 | 2×1 | - | sand | 2 |
| `mc-prop-sand-c` | 모래 포대 | 2×1 | - | sand | 2 |
| `mc-prop-shelter-a` | 정류장 쉼터 | 3×3 | - | shelter | 9 |
| `mc-prop-shelter-b` | 정류장 쉼터 | 3×3 | - | shelter | 9 |
| `mc-prop-shelter-c` | 정류장 쉼터 | 3×3 | - | shelter | 9 |
| `mc-prop-signboard-a` | 입간판 | 1×2 | - | signboard | 2 |
| `mc-prop-signboard-b` | 입간판 | 1×2 | - | signboard | 2 |
| `mc-prop-signboard-c` | 입간판 | 1×2 | - | signboard | 2 |
| `mc-prop-stall-a` | 노점 | 2×2 | - | stall | 4 |
| `mc-prop-stall-b` | 노점 | 2×2 | - | stall | 4 |
| `mc-prop-stall-c` | 노점 | 2×2 | - | stall | 4 |
| `mc-prop-subway-a` | 지하철 입구 | 3×3 | - | subway | 9 |
| `mc-prop-subway-b` | 지하철 입구 | 3×3 | - | subway | 9 |
| `mc-prop-subway-c` | 지하철 입구 | 3×3 | - | subway | 9 |
| `mc-prop-subway-sign-a` | 지하철 표지 기둥 | 1×2 | 키 큰(★ 윗줄) | subway_sign | 2 |
| `mc-prop-subway-sign-b` | 지하철 표지 기둥 | 1×2 | 키 큰(★ 윗줄) | subway_sign | 2 |
| `mc-prop-subway-sign-c` | 지하철 표지 기둥 | 1×2 | 키 큰(★ 윗줄) | subway_sign | 2 |
| `mc-prop-terrace-a` | 테라스 자리 | 2×2 | - | terrace | 4 |
| `mc-prop-terrace-b` | 테라스 자리 | 2×2 | - | terrace | 4 |
| `mc-prop-terrace-c` | 테라스 자리 | 2×2 | - | terrace | 4 |
| `mc-prop-trashbags-a` | 쓰레기 봉투 | 1×1 | - | trashbags | 1 |
| `mc-prop-trashbags-b` | 쓰레기 봉투 | 1×1 | - | trashbags | 1 |
| `mc-prop-trashbags-c` | 쓰레기 봉투 | 1×1 | - | trashbags | 1 |
| `mc-prop-vending2-a` | 자판기(큰) | 1×2 | - | vending2 | 2 |
| `mc-prop-vending2-b` | 자판기(큰) | 1×2 | - | vending2 | 2 |
| `mc-prop-vending2-c` | 자판기(큰) | 1×2 | - | vending2 | 2 |
| `mc-prop-street-tree-a` | 가로수 | 2×3 | 키 큰(★ 윗줄) | street_tree | 6 |
| `mc-prop-street-tree-b` | 가로수 | 2×3 | 키 큰(★ 윗줄) | street_tree | 6 |
| `mc-prop-conifer-a` | 침엽수 | 2×3 | 키 큰(★ 윗줄) | conifer | 6 |
| `mc-prop-conifer-b` | 침엽수 | 2×3 | 키 큰(★ 윗줄) | conifer | 6 |
| `mc-prop-blossom-a` | 벚나무 | 2×3 | 키 큰(★ 윗줄) | blossom | 6 |
| `mc-prop-blossom-b` | 벚나무 | 2×3 | 키 큰(★ 윗줄) | blossom | 6 |
| `mc-prop-ginkgo-a` | 은행나무 | 2×3 | 키 큰(★ 윗줄) | ginkgo | 6 |
| `mc-prop-ginkgo-b` | 은행나무 | 2×3 | 키 큰(★ 윗줄) | ginkgo | 6 |
| `mc-prop-hedge-a` | 생울타리(가로) | 2×1 | - | hedge | 2 |
| `mc-prop-hedge-v-a` | 생울타리(세로) | 1×2 | - | hedge_v | 2 |
| `mc-prop-hedge-b` | 생울타리(가로) | 2×1 | - | hedge | 2 |
| `mc-prop-hedge-v-b` | 생울타리(세로) | 1×2 | - | hedge_v | 2 |
| `mc-prop-bigpot-a` | 큰 화분 | 1×2 | - | bigpot | 2 |
| `mc-prop-bigpot-b` | 큰 화분 | 1×2 | - | bigpot | 2 |
| `mc-prop-shrub-a` | 관목 | 1×2 | - | shrub | 2 |
| `mc-prop-shrub-b` | 관목 | 1×2 | - | shrub | 2 |
| `mc-prop-board-a-b` | 입간판 A | 1×2 | - | board_a | 2 |
| `mc-prop-board-a-c` | 입간판 A | 1×2 | - | board_a | 2 |
| `mc-prop-board-b-b` | 입간판 B | 1×2 | - | board_b | 2 |
| `mc-prop-board-b-c` | 입간판 B | 1×2 | - | board_b | 2 |
| `mc-prop-fountain-a` | 분수 | 4×4 | - | fountain | 14 |
| `mc-prop-pond-a` | 연못 | 7×4 | - | pond | 27 |

## 칸 번호 전체 배열 (3층, tiles[행][열], -1 = 빈 칸; 발밑 줄 = 마지막 행)
```json
[
{"kit":"mc-prop-lamp-a","w":1,"h":3,"tall":true,"tiles":[[7406],[7407],[7408]]},
{"kit":"mc-prop-signal-a","w":1,"h":3,"tall":true,"tiles":[[7409],[7410],[7411]]},
{"kit":"mc-prop-bollard-a","w":1,"h":1,"tall":false,"tiles":[[7412]]},
{"kit":"mc-prop-hydrant-a","w":1,"h":1,"tall":false,"tiles":[[7413]]},
{"kit":"mc-prop-vending-a","w":1,"h":2,"tall":false,"tiles":[[7414],[7415]]},
{"kit":"mc-prop-tree-a","w":2,"h":3,"tall":true,"tiles":[[7416,7417],[7418,7419],[7420,7421]]},
{"kit":"mc-prop-trash-a","w":1,"h":1,"tall":false,"tiles":[[7422]]},
{"kit":"mc-prop-busstop-a","w":1,"h":3,"tall":true,"tiles":[[7423],[7424],[7411]]},
{"kit":"mc-prop-barrier-a","w":2,"h":1,"tall":false,"tiles":[[7425,7426]]},
{"kit":"mc-prop-barrier-b","w":2,"h":1,"tall":false,"tiles":[[7427,7428]]},
{"kit":"mc-prop-bench-a","w":2,"h":1,"tall":false,"tiles":[[7429,7430]]},
{"kit":"mc-prop-bench-b","w":2,"h":1,"tall":false,"tiles":[[7431,7432]]},
{"kit":"mc-prop-bench-c","w":2,"h":1,"tall":false,"tiles":[[7433,7434]]},
{"kit":"mc-prop-bench2-a","w":2,"h":1,"tall":false,"tiles":[[7435,7436]]},
{"kit":"mc-prop-bench2-b","w":2,"h":1,"tall":false,"tiles":[[7437,7438]]},
{"kit":"mc-prop-bike-a","w":2,"h":1,"tall":false,"tiles":[[7439,7440]]},
{"kit":"mc-prop-bike-c","w":2,"h":1,"tall":false,"tiles":[[7441,7442]]},
{"kit":"mc-prop-bike-row-a","w":3,"h":1,"tall":false,"tiles":[[7443,7444,7445]]},
{"kit":"mc-prop-bike-row-c","w":3,"h":1,"tall":false,"tiles":[[7446,7447,7448]]},
{"kit":"mc-prop-boxes-a","w":1,"h":1,"tall":false,"tiles":[[7449]]},
{"kit":"mc-prop-boxes-b","w":1,"h":1,"tall":false,"tiles":[[7450]]},
{"kit":"mc-prop-boxes-c","w":1,"h":1,"tall":false,"tiles":[[7451]]},
{"kit":"mc-prop-bus-shelter-a","w":2,"h":3,"tall":false,"tiles":[[7452,7453],[7454,7455],[7456,7457]]},
{"kit":"mc-prop-bus-shelter-b","w":2,"h":3,"tall":false,"tiles":[[7458,7459],[7460,7461],[7462,7463]]},
{"kit":"mc-prop-bus-shelter-c","w":2,"h":3,"tall":false,"tiles":[[7464,7465],[7466,7467],[7468,7469]]},
{"kit":"mc-prop-cone-a","w":1,"h":1,"tall":false,"tiles":[[7470]]},
{"kit":"mc-prop-cone-b","w":1,"h":1,"tall":false,"tiles":[[7471]]},
{"kit":"mc-prop-fence-a","w":1,"h":1,"tall":false,"tiles":[[7472]]},
{"kit":"mc-prop-fence-b","w":1,"h":1,"tall":false,"tiles":[[7473]]},
{"kit":"mc-prop-hoarding-a","w":2,"h":2,"tall":false,"tiles":[[7474,7475],[7476,7477]]},
{"kit":"mc-prop-hoarding-b","w":2,"h":2,"tall":false,"tiles":[[7478,7479],[7480,7481]]},
{"kit":"mc-prop-hoarding-c","w":2,"h":2,"tall":false,"tiles":[[7482,7483],[7484,7485]]},
{"kit":"mc-prop-kiosk-a","w":2,"h":2,"tall":false,"tiles":[[7486,7487],[7488,7489]]},
{"kit":"mc-prop-kiosk-b","w":2,"h":2,"tall":false,"tiles":[[7490,7491],[7492,7493]]},
{"kit":"mc-prop-kiosk-c","w":2,"h":2,"tall":false,"tiles":[[7494,7495],[7496,7497]]},
{"kit":"mc-prop-mailbox-red-a","w":1,"h":2,"tall":false,"tiles":[[7498],[7499]]},
{"kit":"mc-prop-mailbox-red-b","w":1,"h":2,"tall":false,"tiles":[[7500],[7501]]},
{"kit":"mc-prop-mailbox-red-c","w":1,"h":2,"tall":false,"tiles":[[7502],[7503]]},
{"kit":"mc-prop-meter-a","w":1,"h":2,"tall":false,"tiles":[[7504],[7505]]},
{"kit":"mc-prop-meter-b","w":1,"h":2,"tall":false,"tiles":[[7506],[7507]]},
{"kit":"mc-prop-meter-c","w":1,"h":2,"tall":false,"tiles":[[7508],[7509]]},
{"kit":"mc-prop-moto-c","w":2,"h":1,"tall":false,"tiles":[[7510,7511]]},
{"kit":"mc-prop-newsstand-a","w":1,"h":2,"tall":false,"tiles":[[7512],[7513]]},
{"kit":"mc-prop-newsstand-b","w":1,"h":2,"tall":false,"tiles":[[7514],[7515]]},
{"kit":"mc-prop-newsstand-c","w":1,"h":2,"tall":false,"tiles":[[7516],[7517]]},
{"kit":"mc-prop-park-lamp-a","w":1,"h":2,"tall":true,"tiles":[[7518],[7519]]},
{"kit":"mc-prop-park-lamp-b","w":1,"h":2,"tall":true,"tiles":[[7520],[7521]]},
{"kit":"mc-prop-park-lamp-c","w":1,"h":2,"tall":true,"tiles":[[7522],[7523]]},
{"kit":"mc-prop-ped-signal-g-a","w":1,"h":3,"tall":true,"tiles":[[7524],[7525],[7526]]},
{"kit":"mc-prop-ped-signal-g-b","w":1,"h":3,"tall":true,"tiles":[[7527],[7528],[7529]]},
{"kit":"mc-prop-ped-signal-g-c","w":1,"h":3,"tall":true,"tiles":[[7530],[7531],[7532]]},
{"kit":"mc-prop-ped-signal-r-a","w":1,"h":3,"tall":true,"tiles":[[7524],[7533],[7526]]},
{"kit":"mc-prop-ped-signal-r-b","w":1,"h":3,"tall":true,"tiles":[[7527],[7534],[7529]]},
{"kit":"mc-prop-ped-signal-r-c","w":1,"h":3,"tall":true,"tiles":[[7530],[7535],[7532]]},
{"kit":"mc-prop-phone-a","w":1,"h":2,"tall":false,"tiles":[[7536],[7537]]},
{"kit":"mc-prop-phone-b","w":1,"h":2,"tall":false,"tiles":[[7538],[7539]]},
{"kit":"mc-prop-phone-c","w":1,"h":2,"tall":false,"tiles":[[7540],[7541]]},
{"kit":"mc-prop-planter-a","w":1,"h":1,"tall":false,"tiles":[[7542]]},
{"kit":"mc-prop-planter-b","w":1,"h":1,"tall":false,"tiles":[[7543]]},
{"kit":"mc-prop-planter-c","w":1,"h":1,"tall":false,"tiles":[[7544]]},
{"kit":"mc-prop-pole-a","w":1,"h":5,"tall":true,"tiles":[[7545],[7546],[7547],[7548],[7549]]},
{"kit":"mc-prop-pole-b","w":1,"h":5,"tall":true,"tiles":[[7550],[7551],[7552],[7552],[7553]]},
{"kit":"mc-prop-postbox-a","w":1,"h":2,"tall":false,"tiles":[[7554],[7555]]},
{"kit":"mc-prop-postbox-b","w":1,"h":2,"tall":false,"tiles":[[7556],[7557]]},
{"kit":"mc-prop-postbox-c","w":1,"h":2,"tall":false,"tiles":[[7558],[7559]]},
{"kit":"mc-prop-recycle3-a","w":1,"h":1,"tall":false,"tiles":[[7560]]},
{"kit":"mc-prop-recycle3-b","w":1,"h":1,"tall":false,"tiles":[[7561]]},
{"kit":"mc-prop-recycle3-c","w":1,"h":1,"tall":false,"tiles":[[7562]]},
{"kit":"mc-prop-sand-a","w":2,"h":1,"tall":false,"tiles":[[7563,7564]]},
{"kit":"mc-prop-sand-b","w":2,"h":1,"tall":false,"tiles":[[7565,7566]]},
{"kit":"mc-prop-sand-c","w":2,"h":1,"tall":false,"tiles":[[7567,7568]]},
{"kit":"mc-prop-shelter-a","w":3,"h":3,"tall":false,"tiles":[[7569,7570,7571],[7572,7573,7574],[7575,7576,7577]]},
{"kit":"mc-prop-shelter-b","w":3,"h":3,"tall":false,"tiles":[[7578,7579,7580],[7581,7582,7583],[7584,7585,7586]]},
{"kit":"mc-prop-shelter-c","w":3,"h":3,"tall":false,"tiles":[[7587,7588,7589],[7590,7591,7592],[7593,7594,7595]]},
{"kit":"mc-prop-signboard-a","w":1,"h":2,"tall":false,"tiles":[[7596],[7597]]},
{"kit":"mc-prop-signboard-b","w":1,"h":2,"tall":false,"tiles":[[7598],[7599]]},
{"kit":"mc-prop-signboard-c","w":1,"h":2,"tall":false,"tiles":[[7600],[7601]]},
{"kit":"mc-prop-stall-a","w":2,"h":2,"tall":false,"tiles":[[7602,7603],[7604,7605]]},
{"kit":"mc-prop-stall-b","w":2,"h":2,"tall":false,"tiles":[[7606,7607],[7608,7609]]},
{"kit":"mc-prop-stall-c","w":2,"h":2,"tall":false,"tiles":[[7610,7611],[7612,7613]]},
{"kit":"mc-prop-subway-a","w":3,"h":3,"tall":false,"tiles":[[7614,7615,7616],[7617,7618,7619],[7620,7621,7622]]},
{"kit":"mc-prop-subway-b","w":3,"h":3,"tall":false,"tiles":[[7623,7624,7625],[7626,7627,7628],[7629,7630,7631]]},
{"kit":"mc-prop-subway-c","w":3,"h":3,"tall":false,"tiles":[[7632,7633,7634],[7635,7636,7637],[7638,7639,7640]]},
{"kit":"mc-prop-subway-sign-a","w":1,"h":2,"tall":true,"tiles":[[7641],[7642]]},
{"kit":"mc-prop-subway-sign-b","w":1,"h":2,"tall":true,"tiles":[[7643],[7644]]},
{"kit":"mc-prop-subway-sign-c","w":1,"h":2,"tall":true,"tiles":[[7645],[7646]]},
{"kit":"mc-prop-terrace-a","w":2,"h":2,"tall":false,"tiles":[[7647,7648],[7649,7650]]},
{"kit":"mc-prop-terrace-b","w":2,"h":2,"tall":false,"tiles":[[7651,7652],[7653,7654]]},
{"kit":"mc-prop-terrace-c","w":2,"h":2,"tall":false,"tiles":[[7655,7656],[7657,7658]]},
{"kit":"mc-prop-trashbags-a","w":1,"h":1,"tall":false,"tiles":[[7659]]},
{"kit":"mc-prop-trashbags-b","w":1,"h":1,"tall":false,"tiles":[[7660]]},
{"kit":"mc-prop-trashbags-c","w":1,"h":1,"tall":false,"tiles":[[7661]]},
{"kit":"mc-prop-vending2-a","w":1,"h":2,"tall":false,"tiles":[[7662],[7663]]},
{"kit":"mc-prop-vending2-b","w":1,"h":2,"tall":false,"tiles":[[7664],[7665]]},
{"kit":"mc-prop-vending2-c","w":1,"h":2,"tall":false,"tiles":[[7666],[7667]]},
{"kit":"mc-prop-street-tree-a","w":2,"h":3,"tall":true,"tiles":[[7668,7669],[7670,7671],[7672,7673]]},
{"kit":"mc-prop-street-tree-b","w":2,"h":3,"tall":true,"tiles":[[7674,7675],[7676,7677],[7678,7679]]},
{"kit":"mc-prop-conifer-a","w":2,"h":3,"tall":true,"tiles":[[7680,7681],[7682,7683],[7684,7685]]},
{"kit":"mc-prop-conifer-b","w":2,"h":3,"tall":true,"tiles":[[7686,7687],[7688,7689],[7690,7691]]},
{"kit":"mc-prop-blossom-a","w":2,"h":3,"tall":true,"tiles":[[7692,7693],[7694,7695],[7696,7697]]},
{"kit":"mc-prop-blossom-b","w":2,"h":3,"tall":true,"tiles":[[7698,7699],[7700,7701],[7702,7703]]},
{"kit":"mc-prop-ginkgo-a","w":2,"h":3,"tall":true,"tiles":[[7704,7705],[7706,7707],[7672,7708]]},
{"kit":"mc-prop-ginkgo-b","w":2,"h":3,"tall":true,"tiles":[[7709,7710],[7711,7712],[7702,7703]]},
{"kit":"mc-prop-hedge-a","w":2,"h":1,"tall":false,"tiles":[[7713,7714]]},
{"kit":"mc-prop-hedge-v-a","w":1,"h":2,"tall":false,"tiles":[[7715],[7716]]},
{"kit":"mc-prop-hedge-b","w":2,"h":1,"tall":false,"tiles":[[7717,7718]]},
{"kit":"mc-prop-hedge-v-b","w":1,"h":2,"tall":false,"tiles":[[7719],[7720]]},
{"kit":"mc-prop-bigpot-a","w":1,"h":2,"tall":false,"tiles":[[7721],[7722]]},
{"kit":"mc-prop-bigpot-b","w":1,"h":2,"tall":false,"tiles":[[7723],[7724]]},
{"kit":"mc-prop-shrub-a","w":1,"h":2,"tall":false,"tiles":[[7725],[7726]]},
{"kit":"mc-prop-shrub-b","w":1,"h":2,"tall":false,"tiles":[[7727],[7728]]},
{"kit":"mc-prop-board-a-b","w":1,"h":2,"tall":false,"tiles":[[7729],[7730]]},
{"kit":"mc-prop-board-a-c","w":1,"h":2,"tall":false,"tiles":[[7731],[7732]]},
{"kit":"mc-prop-board-b-b","w":1,"h":2,"tall":false,"tiles":[[7733],[7734]]},
{"kit":"mc-prop-board-b-c","w":1,"h":2,"tall":false,"tiles":[[7735],[7736]]},
{"kit":"mc-prop-fountain-a","w":4,"h":4,"tall":false,"tiles":[[-1,7737,7738,-1],[7739,7740,7741,7742],[7743,7744,7745,7746],[7747,7748,7749,7750]]},
{"kit":"mc-prop-pond-a","w":7,"h":4,"tall":false,"tiles":[[7751,7752,7753,7754,7755,7756,7757],[7758,7759,7760,7761,7762,7763,7764],[7765,7766,7767,7768,7769,7770,7771],[-1,7772,7773,7774,7775,7776,7777]]}
]
```
