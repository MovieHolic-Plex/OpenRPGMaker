# 일본 도시 — 현대 던전 장소 8곳

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **13224칸**, 16px 칸, 시트 1536×2208px, 한 줄 **96칸** — 번호 n 의 칸은 열 n%96, 행 n÷96(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

**가져오기**: `import_region_reference({id:"<장소 id>"})` → 맵 여러 장(구역·층 — 사다리·계단·맨홀·경사로 이동 이벤트로 이미 이어져 있다). **거리 건물 문과 잇기**: `link_jp_city_interior({door:{x,y}, width, place:"<장소 id>"})` 한 번 — 첫 맵에만 잇는다(안쪽 구역은 맨 아래 줄이 막혀 있다).
던전은 가게 규칙과 다르다: 통로가 1칸이어도 되고, 막다른 곳(보물·단서 자리 `*-item-*`, use search)·갈림길·한 바퀴 도는 고리가 있다. 넓은 곳(예제 `open`)은 몬스터·보스 자리다.
**잠긴 문**은 그림만 문이고 통행은 열려 있다 — 아래 표의 칸에 이벤트(열쇠 아이템이 있으면 통과, 없으면 막고 대사)를 단다. 열쇠는 장소 rules 문장이 말하는 막다른 방의 보물 자리에 둔다. 사람(경비·작업자)·몬스터는 Actor1·전투 이벤트로 놓는다(그림에 없다).

| 장소 id | 이름 | 맵(예제 문서) | 짜임 |
|---|---|---|---|
| `jp-city-construction-1f-22x16` | 일본 공사 중 빌딩(1층 자재 야적·현장 사무실·갱도 + 2층 기둥 층) | `jp-interior-ex-construction-1f` → `jp-interior-ex-construction-2f` | 1층: 남쪽 가설 출입문(2칸, cs-site-gate) → 남서 자재 야적(철근·H빔·방수포·시멘트 포대) — 여기서 세 갈래: 서쪽 길(비계 줄 cs-scaffold 로 막힌 1~2칸 길) · 가운데 갱도 둘레 · 동쪽 비계 미로. |
| `jp-city-parking-b1-24x16` | 일본 지하 주차장(B1 주차 칸·기계실 + B2 침수 구역·방재 창고) | `jp-interior-ex-parking-b1` → `jp-interior-ex-parking-b2` | B1: 남서 계단 출입구(맨 아래 2칸) → 작은 출입구 칸(정산기 cs-pay-machine·소화전 상자·비상구 초록 등) → 철 방화문(3,9) → 차로. 북쪽 벽에 앞을 벽으로 둔 차 세 대(cs-car-a·cs-car-b)와 빈 칸, 칸 사이 흰 선(cs-parking-line)·바퀴 멈춤턱, 칸 앞 줄에 기둥(cs-pillar). |
| `jp-city-abandoned-hospital-1f-24x16` | 폐병원(버려진 종합병원) 던전 | `jp-interior-ex-abandoned-hospital-1f` → `jp-interior-ex-abandoned-hospital-2f` → `jp-interior-ex-abandoned-hospital-b1` | 던전 맵 셋 — 1층 abandoned-hospital-1f(거리와 잇는 주 맵 24×16, 맨 아래 2칸 부서진 정문) · 2층 abandoned-hospital-2f(병동, inner) · 지하 abandoned-hospital-b1(영안실·보일러실, inner). 계단 x 를 층마다 맞춘다: 1층 계단실의 올라가는 sc-stairs-up (21,3)(x21-22) 발칸 → 2층 계단참 (20,15), 2층 내려가는 계단통 sc-stairwell-down (21,14) 아랫줄 (21,15)(22,15) → 1층 계단 앞 (21,4)/(22,4). 1층 내려가는 계단통 sc-stairwell-down (18,3) 아랫줄 (18,4)(19,4) → 지하 계단 앞 (18,4)/(19,4), 지하 올라가는 sc-stairs-up (18,3) 발칸 → 1층 (20,4). |
| `jp-city-ruin-school-1f-24x18` | 폐교(버려진 시골 학교) 던전 | `jp-interior-ex-ruin-school-1f` → `jp-interior-ex-ruin-school-2f` | 맵 둘 — 1층 ruin-school-1f(거리 건물 jp_school_ruin 문과 잇는 주 맵, 맨 아래 2칸 출입구) · 2층 ruin-school-2f(inner). 계단은 1층 복도 서쪽 끝의 부서진 콘크리트 계단 as-stairs-up-broken(1~2,10) → 2층 계단통 as-stairwell-down(1~2,11) 옆 (3,12), 2층 계단통 아랫줄 → 1층 계단 앞 (1~2,11). |
| `jp-city-subway-tunnel-1-24x14` | 지하철 보선 터널(던전) — B1 보선 통로·기계실 · B2 선로 분기부·환기 기계실 | `jp-interior-ex-subway-tunnel-1` → `jp-interior-ex-subway-tunnel-2` | 구역 흐름: 역 직원 통로(B1 맨 아래 2칸 틈) → 남쪽 보선 통로(1줄, 북쪽 난간 너머 선로) → 선로 건널목(ug-track-crossing 1×2, x 5·9·12·16) → 북쪽 보선 줄(대피 홈·케이블 선반 사이) → 북쪽 방 셋(대피실·기계실·신호 계전실, 철문 ug-door-steel). B1 기계실 바닥 점검구(ug-hatch-down 13,4) → B2 벽 사다리 옆(3,3). B2 벽 사다리(ug-ladder-up 2,3) → B1 점검구 옆(12,4). |
| `jp-city-sewer-1-22x14` | 하수도(던전) — 점검로·수문·작업원 대기소·점검실 · 하수 본관 합류 수조·펌프실 | `jp-interior-ex-sewer-1` → `jp-interior-ex-sewer-2` | 구역 흐름: 점검 계단 입구(맨 아래 1칸 틈 2,13) → 남쪽 둑(2줄) → 쇠창살 다리(ug-grate 1×2, x 4·12·18)로 물길을 건넌다 → 북쪽 둑(1줄). 서쪽 다리(4)는 서쪽 둑·수문 앞·작업원 대기소(막다른 구역), 동쪽 다리 둘(12·18)은 고리로 동쪽 둑·점검실 문에 닿는다. 점검실 바닥 점검구(20,4) → 하수 본관 사다리 옆(2,4). 본관 벽 사다리(2,3) → 점검구 옆(19,4). |
| `jp-city-undermall-1-26x16` | 밤의 지하상가(地下街) — 셔터 거리·경비실·기계실·분수 광장 던전 | `jp-interior-ex-undermall-1` → `jp-interior-ex-undermall-2` | B1(undermall-1, 26×16, 거리 문과 잇는 맵): 맨 아래 2칸 틈(11·12,15) = 지상 계단 출입구. 들어오면 기둥 둘·안내판이 선 광장(x12~15) → 북쪽 셔터 거리(y9~10, 가게 셔터·진열창·불 꺼진 자판기가 북쪽 벽에 줄지음)와 남쪽 직원 뒷통로(y14)가 서쪽 통로(x1~3)·광장으로 이어져 한 바퀴 도는 고리가 된다. |
| `jp-city-harbor-warehouse-1-30x22` | 항만 창고(港湾倉庫) — 컨테이너 미로·사무 칸·보세 구역·중이층 밀수품 방 던전 | `jp-interior-ex-harbor-warehouse-1` → `jp-interior-ex-harbor-warehouse-2` | 1층(harbor-warehouse-1, 30×22, 거리 문과 잇는 맵): 맨 아래 1칸 틈 (2,21) = 옆문. 들어오면 20피트 컨테이너 7대(가로 6×2·세로 2×6, 빨강·파랑·초록)가 벽이 된 미로(y11~20) — 컨테이너 사이는 2칸 통로, 남쪽 y17~18 은 지게차가 다니는 2칸 가로 길(동쪽 끝에 지게차). 미로 북쪽은 2칸 랙 통로(y9~10), 그 북쪽 벽에 파랑·주황 팔레트 랙 다섯과 닫힌 대형 셔터. |

## 잠긴 문 (예제 `locks`)
| 맵 | 칸 | 열쇠 | 이유 |
|---|---|---|---|
| `jp-city-construction-1f` | (18,7) | 자재 창고 열쇠 | 자재 창고 셔터 — 열쇠는 현장 사무실 곁 공구함 |
| `jp-city-construction-2f` | (16,8) | 철골 구역 열쇠 | 보스가 있는 철골 구역 셔터 — 열쇠는 1층 자재 창고의 설계도 통 |
| `jp-city-parking-b1` | (20,6) | 기계실 열쇠 | 기계실 셔터 — 열쇠는 빨간 왜건 옆에 열어 둔 트렁크 짐 |
| `jp-city-parking-b2` | (3,6) | B2 방재 창고 열쇠 | 방재 창고 셔터 — 열쇠는 B1 기계실 공구함 |
| `jp-city-abandoned-hospital-1f` | (14,6) | 약제실 열쇠 | 약제실 철문 — 2층 간호사 스테이션 열쇠함(hp-item-keybox)에서 찾는다 |
| `jp-city-abandoned-hospital-2f` | (18,6) | 수술실 열쇠 | 수술실(보스 방) 철문 — 지하 보일러실 열쇠함에서 찾는다 |
| `jp-city-abandoned-hospital-b1` | (11,6) | 보일러실 열쇠 | 보일러실 철문 — 1층 외래 진찰실 1 사물함(hp-item-locker)에서 찾는다 |
| `jp-city-ruin-school-1f` | (12,12) | 과학실 열쇠 | 쇠사슬 감긴 과학실 문 — 열쇠는 교무실 열쇠 고리판(21,1) |
| `jp-city-ruin-school-2f` | (6,8) | 음악실 열쇠 | 쇠사슬 감긴 음악실 문(보스 방) — 열쇠는 1층 과학실 사진 상자(14,16) |
| `jp-city-subway-tunnel-1` | (10,5) | B1 기계실 열쇠 | 기계실 철문 — 열쇠는 동쪽 신호 계전실 사물함(22,3). 기계실 바닥 점검구로 B2 분기부에 내려간다. |
| `jp-city-subway-tunnel-2` | (4,10) | B2 환기 기계실 열쇠 | 환기 기계실 철문 — 열쇠는 동쪽 자재 창고 사물함(17,13). |
| `jp-city-sewer-1` | (17,5) | 점검실 열쇠 | 점검실 철문 — 열쇠는 서쪽 작업원 대기소 사물함(1,3). 점검실 바닥 점검구로 하수 본관(합류 수조)에 내려간다. |
| `jp-city-sewer-2` | (15,5) | 펌프실 열쇠 | 펌프실 철문 — 열쇠는 남동쪽 막다른 둑 공구함(20,12). |
| `jp-city-undermall-1` | (20,5) | B1 통로 셔터 열쇠 | 에스컬레이터(B2로 내려가는 곳) 앞 격자 셔터 — 열쇠는 서쪽 경비실 사물함(1,3) |
| `jp-city-undermall-2` | (15,9) | 분수 광장 셔터 열쇠 | 보스 자리 분수 광장 앞 격자 셔터 — 열쇠는 기계실 구석 공구함(7,15) |
| `jp-city-harbor-warehouse-1` | (12,5) | 창고 쪽문 열쇠 | 대형 셔터 옆 쪽문 — 열쇠는 서쪽 사무 칸(막다른 방) 금고 wh-item-safe (6,3) |
| `jp-city-harbor-warehouse-2` | (13,6) | 밀수품 방 열쇠 | 밀수품 방(보스 자리) 쪽문 — 열쇠는 서쪽 중이층 사무실(막다른 방) 사물함 wh-item-locker (1,3) |

## 없는 것
몬스터·NPC·잠금 이벤트 자체(조수가 단다), 어둠 연출(조명은 그림의 꺼진 등·비상등뿐 — 화면 색조는 이벤트로). 피·시체·사람 그림은 일부러 없다.
