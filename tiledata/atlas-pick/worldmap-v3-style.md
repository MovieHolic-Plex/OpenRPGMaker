# 월드맵 3판 「바람들 결」 — 색·질감 규칙과 48개 다시 찍는 절차 (2026-09-30)

> 사용자 판정(2판 월드맵을 보고): 「easyrpg 랑 바람들 항구의 영향을 좀 받아야 될 것 같은데, 지금은 아닌 것 같다」.
> 2판은 해안 형태는 좋았으나 풀은 연한 체커, 물은 옅은 청록 한 색 잔물결, 윤곽은 가늘어 **밋밋하고 연했다.**
> 마을 맵(바람들)로 들어갈 때 한 게임처럼 보이게 하는 것이 3판의 목적이다.

## 0. 영향 관계 (해석)

| 순위 | 원천 | 가져오는 것 | 가져오지 않는 것 |
|---|---|---|---|
| **주** | **바람들 v3** = 16px 생성형 초원 칩셋 「바람들 마을」(`gen-grassland`, gg-houses 브랜치 2be37b331 v3 빌드·7d893c3e5 최종 지반) | 색 램프, 풀·물·흙길 질감, 잉크 윤곽 | (마을 건물·소품은 월드맵 기물이 아니다) |
| 부 | 버들항(`tiledata/beodeul-city/render/city6.png`) | 돌길·항구 벽면 색, 물가 둑 | 바람들과 다른 곳은 바람들이 이긴다 |
| 구도만 | EasyRPG World.png | 큰 덩이 대륙·산맥 배열·블록 크기·가독성 → **`worldmap-reference-study.md` 가 정본** | **픽셀 복제 금지.** world-easyrpg·refmap-world 95% 유사도 hard 실패 유지 |

「바람들」은 버들항도 48px 판도 아니다. 근거: 조정자 정정(2026-09-30) + gg-houses 커밋 이력(v1 18f135c87 → v3 2be37b331 → 규칙 c81130b1c → 지반 되돌림 7d893c3e5).
바람들 원자료는 `git show agent/gg-houses:<경로>` 로 뽑아 `~/.local/share/oprn/ref-cache/gen-grassland/` 에 있다(체크아웃·/tmp 금지). 마을 그림은 `.../public/assets/gen-grassland/references/village-center.png`.

## 1. 바람들 v3 실측 (주 원천)

램프는 **6단**(어두움→밝음)이고 색조가 어두운 쪽은 청록/남색으로, 밝은 쪽은 노랑 초록으로 **굽는다**(hue shift). 순수 검정은 없고 윤곽은 잉크 `#16110d`(따뜻한 갈검정) 한 색이다.

| 램프 | 6단 | 색조 이동 |
|---|---|---|
| 풀 | 1d3b24 2b5a2d 3d7a34 57983f 77b14c a2cb62 | 어두운 쪽 청록 초록 → 밝은 쪽 노랑 초록 |
| 키큰 풀 | 142c1d 1f4526 2c5e2c 3b7833 4f913c 6fab47 | 풀보다 한 단 어둡다 |
| 흙길 | 44301f 664a2d 8a693f a88652 c3a068 dcbd88 | 갈색, 밝은 쪽 살구 |
| 흙절벽 | 271912 462d1f 694530 8b6040 a97c52 c69a68 | 길보다 붉은 갈색 |
| 물 | 1b3159 254a86 335eae 4a80cc 78a9e0 c6e1f5 | **로열블루**, 밝은 쪽 흰청. 청록이 아니다 |
| 잎(나무) | 0f2a1c 1a4526 2a6230 3f8037 5c9c40 86ba55 | 왼쪽 위 빛 |
| 껍질 | 2a130c 472314 653a21 86552e a67040 c18d57 | |
| 돌 | 24222d 3c3a48 585666 777587 9896a6 bdbcc8 | 보라 낀 회색 |
| 회벽/밀/지붕 | 회벽 5c4632…f7f0dc / 밀 5a4214…f1da86 / 붉은 지붕 3a0f10…e8946a / 파란 지붕 141a38…98b2df | 건물 계열(월드맵 도시 아이콘이 씀) |

질감 주기(전부 16px 칸에서 이음매 없이 돌아야 한다):

- **풀**: 바탕 한 단(57983f) 위에 어두운 뭉치(3d7a34/2b5a2d) 3~4획과 잎날 획, 밝은 점(77b14c). 16px 주기. 체커·균일 잡음은 쓰지 않는다.
- **키큰 풀**: 풀 위 가는 세로획, 한 단 어둡다. 월드맵의 「초원 위 소품」 자리.
- **흙길**: 가장자리가 울퉁불퉁(16 주기 1차원 잡음, 옆 칸과 이어짐) + 자갈 점. 길 폭 5칸 기준 둥근 모서리.
- **물**: 3단 이상 파랑 바탕 + **흰청 잔물결 2~4px 가로 획**, 8프레임 = 16px 주기, 물가에 어두운 1px 둑선. (월드맵은 움직임 없이 정지 프레임만 쓴다.)
- **절벽/바위**: 가로 32px 주기 세로 보로노이 바위 결, 윗줄 흙 턱 + 늘어진 풀.
- **나무**: 둥근 수관, 잉크 윤곽 #16110d, 왼쪽 위 빛, 수관 속 잎 채움.
- **돌길(부 원천 버들항)**: 돌 램프 4~5단, 사각 돌 결에 어두운 줄눈. 바람들에는 돌길이 없어 버들항 것을 따른다.

## 2. 2판 대비 팔레트 (`palette/worldmap3.pal`, 생성 `make_worldmap3_palette.py`)

램프 **이름은 2판 `worldmap.pal` 과 같다.** 그래서 조각 `.pxg` 의 `@palette` 한 줄만 `../../palette/worldmap3.pal` 로 바꾸면 통째로 3판 색이 된다. 2판 팔레트는 그대로 두었다.
`worldmap_check.py`·`worldmap_context.py` 는 파일명이 `v3-*` 이면 worldmap3.pal 로 자동 전환한다.

| 램프 | 2판 | 3판 | 달라진 점 |
|---|---|---|---|
| wgrass | 163a1e … c4e4a0 (밝은 끝이 옅은 민트) | 1d3b24 2b5a2d 3d7a34 57983f 77b14c a2cb62 | 채도 높은 중간 초록, 밝은 끝 제한 |
| wsea | 0e3a5a … a0e4e0 (청록) | 1b3159 254a86 335eae 4a80cc 78a9e0 c6e1f5 | 청록 → 로열블루 |
| wdirt | 3e2814 … cca676 | 44301f 664a2d 8a693f b08d55 d8b982 | 살짝 붉은 갈색 |
| wdeep | | 0c1832 12244c 1a3868 22497f 2c5a98 3868b0 | 깊은 바다도 파랑 계열 유지 |
| wriver | 옅은 청록 | 24508c 3868b8 5088d0 82b0e6 cce4f6 | 강 = 바다와 같은 파랑 |
| wmead/whill/wleaf/wpine/wbark/wrock/wsand/wstone/wroofr/wroofb/wgold/wplast/wink | | 바람들 v3 램프에서 유도 | wink = 16110d |

## 3. 3판 결 요점 5줄

1. 풀은 체커가 아니라 **어두운 뭉치 + 잎날 + 밝은 점**이 16px 로 도는 중간 초록(57983f 바탕).
2. 물은 옅은 청록이 아니라 **로열블루 3~4단 + 흰청 가로 잔물결 flecks**, 깊은 바다는 남색으로 한 단 더 내림.
3. 흙길·둑은 **따뜻한 갈색 계열**(44301f…d8b982)로 초원과 대비, 윤곽은 잉크 #16110d 한 색.
4. 순수 검정 없음, 색조 굽기(어두운 쪽 청록·남색, 밝은 쪽 노랑 초록).
5. 구도(큰 덩이 대륙·산맥·아이콘)는 EasyRPG 를 따르되 픽셀은 복제하지 않는다.

## 4. 만든 것과 절차

| 산출 | 위치 |
|---|---|
| 스크립트 | `scripts/content/atlas-pick/worldmap_v3_gen.py`(변환), `worldmap_v3_demo.py`(40×30 장면 조립), `worldmap_v3_page.py`(비교 페이지) |
| 후보 | `candidates-worldmap/<slug>/v3-A.pxg` **19개**(coast_grass sea_deep shoal plains_base forest conifer mountain hills river road bridge_h bridge_v desert town castle cave port trees_scatter plains_scatter), 전부 `worldmap_check` 통과 |
| 장면 | `style-demo-worldmap3/scene-2.png`(2판), `scene-3.png`(3판) |
| 비교 페이지 | `http://mdc-server:18301/worldmap-v3-demo.html` |

**48개 전부를 3판으로 다시 찍는 절차**

1. `python3 scripts/content/atlas-pick/worldmap_v3_gen.py --baseline [slug…]` — 2판 선정본의 `@palette` 줄만 3판으로 바꿔 색을 옮긴다(형태 검사 그대로 통과). `SRC` 표에 slug → 2판 원본(`wvN-X`)을 추가해야 한다(현재 19개만 있다).
2. 질감이 바뀌어야 하는 조각은 `RESTYLE` 에 함수를 등록한다. 현재 등록: 풀 바탕(`restyle_plains`, 16×16 세 칸을 뭉치·잎날·점으로 다시 생성), 물(`restyle_water` 흰청 flecks), 강(`restyle_river` 문자→램프 재매핑), 얕은 물(`restyle_shoal`), 마을(`restyle_town` 바닥). 나머지는 색만 바뀐 상태다.
3. `python3 scripts/content/atlas-pick/worldmap_check.py <pxg>` 로 검사. 규칙은 알파·기하 기반이라 램프 교체·내부 얼룩은 깨지지 않는다(팔레트 밖 색만 hard).
4. `worldmap_v3_demo.py [--html]` 로 장면·페이지를 다시 뽑아 눈으로 본다.
5. 남은 29개(설원·얼음·정글·용암·화산·늪·독늪·재·오아시스·언덕 등)는 **각자 기후 램프**가 worldmap3.pal 에 이미 있다(wsnow wice wlava wswamp wpoison wash…). 바람들에 없는 기후 램프는 색조 굽기 규칙(§1)으로 손으로 정했으므로 눈 확인이 필요하다.

**절차서·배정 손볼 곳**: `WORKER-WORLDMAP.md` 의 팔레트 절과 검사 절에 「3판 = `v3-*`, worldmap3.pal」을 추가하고, 배정(`jobs-worldmap.json`)에 3판 대상 slug 열을 두어야 한다. 팔레트 파일은 새로 만들 필요 없다.

## 5. 약점 (정직하게)

- 도로·사막·언덕·숲은 **색만 바뀌었다.** 도로는 가늘고 가장자리가 울퉁불퉁하지도 자갈도 없다. 나무는 잉크 윤곽·왼쪽 위 빛으로 다시 그리지 않았다.
- 사막은 사선 줄무늬 그대로. 성·동굴·항구 아이콘은 재채색뿐, 마을 아이콘은 안쪽 바닥만 바꿨다.
- 19/48만 v3 가 있다. `.note` 메모가 없어 `worldmap_check` 에 「메모 없음」 경고가 전부 남는다.
- forest·conifer·mountain 의 shore-join 경고는 2판에서 온 것(hard 아님).
- 데모 오른쪽 아래의 작은 얕은 못은 샘플 장면의 배치 산물이다.
- 물 flecks 는 정지 프레임뿐이다(월드맵에서 애니메이션 여부는 결정 대기).
