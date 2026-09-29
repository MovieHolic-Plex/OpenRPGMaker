# 예시 배치 · 강어귀 항구 도시 (`estuary`)

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 23936칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

의도: 강이 북쪽 맵 가장자리에서 들어와(물 오토타일은 가장자리에 둑을 만들지 않는다) 곧게 남쪽 호수 항구로 흐른다. 서쪽 둑에 왕성·귀족 저택, 동쪽 둑에 저택 구역·성당·포룸·풍차. 다리 셋 + 호수 하구 다리. 양 둑에 강가 둑길. 호수 옆 모랫길에 어부 목조집, 우물 광장.

그림 `layout-estuary` (엔진 렌더 100×100, 820px 로 줄임). 이 배치는 `scripts/content/author-beodeul-layouts.mts --only estuary` 가
편집기 도구를 아래 순서로 불러 만든다(같은 순서로 부르면 같은 맵이 나온다 — 전체 아래층·윗층 배열은 이 순서의 결과다).

## 잰 값
| 항목 | 값 |
|---|---|
| 원본과 같은 칸 | 53/10000 (0.53%) |
| 구역 키트 | bd-castle✓, bd-estate✓, bd-forum✓, bd-cathedral✓, bd-windmill✓, bd-harbour·, bd-harbour-west·, bd-river-bridge· |
| 문 | 52곳 — 육지 도달 52, 포장 길망 도달 52 |
| 막다른 포장 칸 / 막다른 넓은 거리 | 0 / 0 |
| 물에 닿아 끝나는 거리 / 막힌 문 앞 / 같은 조각 셋 일렬 | 0 / 0 / 0 |
| 도구 호출 | 193번(잔디 무늬 조각 60번 포함) |

## 도구 순서 (잔디 무늬 60번은 뺐다)
```text
create_map {"id": "estuary", "name": "강어귀 항구 도시", "width": 100, "height": 100, "tilesetId": "beodeul_city"}
fill_region 버들항 풀밭 (0,0) 100×100
stamp_object bd-harbour-lake @(0,85)
fill_region 물 (38,0) 4×85
stamp_object bd-castle @(2,0)
stamp_object bd-estate @(48,4)
stamp_object bd-cathedral @(78,4)
stamp_object bd-manor-vine @(4,40)
stamp_object bd-garden-formal @(4,52)
stamp_object bd-bridge-arch @(38,32)
stamp_object bd-bridge-arch @(38,60)
stamp_object bd-bridge-arch @(38,72)
fill_region 버들항 길 포석 (0,33) 38×2
fill_region 버들항 길 포석 (42,33) 58×2
fill_region 버들항 길 포석 (56,26) 2×7
fill_region 버들항 길 포석 (84,26) 2×7
fill_region 버들항 길 포석 (36,35) 2×49
fill_region 버들항 길 포석 (42,35) 2×49
fill_region 버들항 길 포석 (24,35) 2×49
fill_region 버들항 길 포석 (84,35) 2×49
fill_region 버들항 길 포석 (26,47) 10×2
fill_region 버들항 길 포석 (44,49) 40×2
stamp_object bd-forum @(44,35)
fill_region 버들항 길 포석 (44,34) 22×1
fill_region 버들항 길 포석 (43,44) 1×3
fill_region 버들항 길 포석 (59,49) 4×1
fill_region 버들항 길 포석 (11,60) 3×1
fill_region 버들항 길 포석 (0,61) 38×2
fill_region 버들항 길 포석 (44,61) 40×2
fill_region 버들항 길 포석 (86,59) 14×2
stamp_object bd-windmill @(86,61)
fill_region 버들항 길 포석 (96,60) 3×1
fill_region 버들항 길 포석 (0,73) 38×2
fill_region 버들항 길 포석 (44,73) 40×2
fill_region 버들항 길 포석 (24,84) 14×1
fill_region 버들항 길 포석 (42,84) 58×1
fill_region 버들항 길 포석 (97,83) 1×1
fill_region 버들항 모랫길 (3,84) 21×1
stamp_object bd-house-i9 @(44,27)
stamp_object bd-house-h123_0 @(51,27)
stamp_object bd-house-h123_0 @(58,27)
stamp_object bd-house-h102_1 @(61,25)
stamp_object bd-house-h107_1 @(67,25)
stamp_object bd-house-h103_1 @(74,27)
stamp_object bd-house-i14 @(79,27)
stamp_object bd-house-h104_0 @(86,25)
stamp_object bd-house-h119_0 @(93,27)
stamp_object bd-house-h145_0 @(26,41)
stamp_object bd-house-h109_0 @(30,41)
stamp_object bd-house-h145_0 @(26,55)
stamp_object bd-house-h139_0 @(29,53)
stamp_object bd-house-i13 @(33,55)
stamp_object bd-house-i12 @(66,43)
stamp_object bd-house-h107_0 @(69,43)
stamp_object bd-house-i0 @(75,43)
stamp_object bd-house-h123_0 @(44,55)
stamp_object bd-house-h112_0 @(47,55)
stamp_object bd-house-h123_1 @(51,55)
stamp_object bd-house-h111_0 @(57,53)
stamp_object bd-house-h101_0 @(64,55)
stamp_object bd-house-i8 @(71,55)
stamp_object bd-house-h104_0 @(77,53)
stamp_object bd-house-h122_0 @(86,51)
stamp_object bd-house-h112_0 @(95,53)
stamp_object bd-house-h141_0 @(0,67)
stamp_object bd-house-h116_0 @(3,65)
stamp_object bd-house-i12 @(8,67)
stamp_object bd-house-i14 @(11,67)
stamp_object bd-house-h106_1 @(14,65)
stamp_object bd-house-i13 @(21,67)
stamp_object bd-house-h111_0 @(26,65)
stamp_object bd-house-h144_0 @(33,67)
stamp_object bd-house-h124_0 @(44,64)
stamp_object bd-house-h107_1 @(53,65)
stamp_object bd-house-h110_1 @(60,65)
stamp_object bd-house-h103_2 @(68,67)
stamp_object bd-house-h139_0 @(73,65)
stamp_object bd-house-i0 @(77,67)
stamp_object bd-house-h102_0 @(44,78)
stamp_object bd-house-h111_0 @(51,76)
stamp_object bd-house-i13 @(58,78)
stamp_object bd-house-h101_2 @(62,78)
stamp_object bd-house-h116_0 @(65,76)
stamp_object bd-house-i9 @(70,78)
stamp_object bd-house-h117_1 @(76,76)
stamp_object bd-house-h101_2 @(80,78)
stamp_object bd-out-well-plaza-sand @(26,76)
fill_region 버들항 길 포석 (30,75) 2×1
stamp_object bd-out-cabin-small @(3,80)
stamp_object bd-out-cabin @(7,78)
stamp_object bd-out-longhouse @(12,78)
stamp_object bd-tree-e9d9b3 @(95,92)
stamp_object bd-tree-0f7ed1 @(89,94)
stamp_object bd-tree-1e09f0 @(97,95)
stamp_object bd-tree-d105b2 @(89,90)
stamp_object bd-tree-c27062 @(86,93)
stamp_object bd-tree-1a786c @(84,88)
stamp_object bd-tree-f4f319 @(87,97)
stamp_object bd-tree-eef4bc @(94,87)
stamp_object bd-tree-132848 @(98,86)
stamp_object bd-tree-c27062 @(90,97)
stamp_object bd-tree-c27062 @(36,21)
stamp_object bd-tree-3e8732 @(71,37)
stamp_object bd-tree-eef4bc @(45,6)
stamp_object bd-tree-132848 @(95,50)
stamp_object bd-tree-f4f319 @(98,18)
stamp_object bd-tree-c27062 @(75,0)
stamp_object bd-tree-03a8f7 @(67,52)
stamp_object bd-tree-5844f6 @(91,41)
stamp_object bd-tree-d105b2 @(90,47)
stamp_object bd-tree-132848 @(35,5)
stamp_object bd-tree-47e17a @(94,0)
stamp_object bd-tree-28ad5e @(22,38)
stamp_object bd-tree-d43edd @(73,17)
stamp_object bd-tree-c27062 @(50,0)
stamp_object bd-tree-cc0fcb @(78,38)
stamp_object bd-tree-0f7ed1 @(69,1)
stamp_object bd-tree-eef4bc @(99,72)
stamp_object bd-tree-28ad5e @(47,5)
stamp_object bd-tree-47e17a @(70,6)
stamp_object bd-tree-d105b2 @(75,8)
stamp_object bd-tree-5844f6 @(96,12)
stamp_object bd-tree-e9d9b3 @(68,64)
stamp_object bd-tree-37f48b @(75,40)
stamp_object bd-tree-132848 @(74,13)
stamp_object bd-tree-3e8732 @(74,23)
stamp_object bd-tree-cc0fcb @(98,26)
stamp_object bd-tree-0f7ed1 @(56,1)
stamp_object bd-tree-37f48b @(89,1)
stamp_object bd-tree-47e17a @(98,47)
stamp_object bd-tree-1a786c @(43,15)
stamp_object bd-tree-03a8f7 @(1,51)
stamp_object bd-tree-eef4bc @(36,12)
```

## 역할 격자 100×100 (R 포장 · s 모랫길 · = 다리/잔교 · ~ 물 · . 걷는 땅 · X 막힌 땅 · C 윗층 걸음 · S 윗층 막힘)
```text
...XXXXXXXXXXXSSXXXXXXSSXXXXXXXXXX....~~~~........S........................S..................SS....
...XXXXXXXXXXSSSXSSSXSSSXXXXXXXXXX....~~~~........S.....SS...........SS....S.............SS...SS....
...XXXXXXXXXXSSSSSSSSSSSXXXXXXXXXX....~~~~........S.....SS...........SS....S.............SS.........
...SSSSXSSSSXSSSSSSSSSSSXSSSSXSSSS....~~~~..........................................................
...SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS....~~~~.......XXXXXXSXXXSXXXXXXXXX...............................
...SSSRSSSSSSSSSSSSSSSSSSSSSSSRSSS.SS.~~~~.....S.S.XXXXSSSSSXXXXSSSSS.........X.C...........SS......
...SSSRSSSSSSSSSSSSSSSSSSSSSSSRSSS.SS.~~~~...S.S.SSXXXSSSSSSSXXXSSSSS.SS......XXSXXXXXXXXXX.SS......
...SSSRSSSSSSSSSSSSSSSSSSSSSSSRSSS....~~~~...S.S.SSSSSSSSSSSSSSSSSSSS.SS......XSSSXXXXXXXXXSSS......
...RRRRSSSSSSSSSSSSSSSSSSSSSSSRCRR....~~~~...S...SSSSSSSSSSSSSSS...S.......SS..SSSXXXXXXXXXSSS......
...RSSRSSSSSSSSSSSSSSSSSSSSSSSRSSS....~~~~.......S.SSSSSSSSSSSSSSSSSS......SS.XSSSSSSSSSSSSSSS......
...RRRRSSSSSSSSSSSSSSSSSSSSSSSRSSS....~~~~.......SSSSSSSSSSSSSSSSSSSS.........XSSSSSSSSSSSSSS.......
...RRRRRRRRRRRSCCRRRCCSRRRRRRRRSSS....~~~~.......SSSSSSSSSSSSSSSSSSSS.........XSSSSSSSSSSSSSS.......
...SSRXXXXXXXXXSCRRRCSXXXXXXXXXSSS..S.~~~~.......SSSSSSSSSSSSSSSSSSS..........XSSSSSSSSSSSSXSX..SSSS
...SSRXXXXXXXXXSCRRRCSXXXXXXXXXSSS..S.~~~~.......S.SSSSSSSSSSSSSSSSSX.....SS..XSSSSSSSSSSSSSSSS.SSSS
...RCCXXXXXXXXSSCRRRCSSSXXXXXXXRCC..S.~~~~.......SRRRRRCCCCCRRRRRRRSX.....SS..XSSSSSSSSSSSSSSSS.SSSS
...CCCRRRCRSSCCCRRRRRCCCSSCCRRRCCC....~~~~.SSS...SRRRSSSRRSSSSSSSSXSX..........SSSSSSSSSSSSSSSS.SSSS
...CCCRRRCRSSCCCRRRCCCCCSSCCRRRCCC....~~~~.SSS...SSSRSSSRRSSSSSSSSXS...........SSSSSSSSSSSSSSSC.SSSS
...CCCRRSCRSSCCCRRRCCCCCSSCRRRRCCC....~~~~.SSS...SSSSSSRRRSSRSSSSSXSX....SSSS..SSSSSSSSSSSSSSS......
...CCCRRSSRRRCCCRRRSSCCCRRSXRRRCCC....~~~~.SSS...SSSSSSRRRSSRSSSSSRSX....SSSS.RRRRRRRRRRRRRRRS....SS
...SSS.......SSSXRRRXSSS.......SSS....~~~~.......SRRSSSRRRSSRSSSSSRSX....SSSS.RRRRRRRRRRRRRR..S...SS
...SSSXXXXXXXSSSXRRRXSSSXXXXXXXSSS....~~~~.......SRRSSRRRRSSRSSSSSRSX....SSSS.SRRRRRRSSRRRRSSSS.....
...SSSXXXXXXXSSSXRRRXSSSXXXXXXXSSS..S.~~~~.......SRRSSRCRRCRRRRSSSRS.....SSSS.RSSRRRRSSRRSRR.SS.....
...SSSXXXXXXXSSSXCRCXSSSXXXXXXSSSS..S.~~~~.......SRRRRRCRRCRRRRSSSRS..........RRRRRRRRRRRRRR.SS.....
...~SS~~~~~~~~~~~CCC~~~~~~~~~~SSSS~.S.~~~~.......SRRRRRCCCCRRRRRRRRS......SSS.RRRRRRRRRRRRRR..S.....
...~~~~~~~~~~~~~~CCC~~~~~~~~~~~~~~~...~~~~.......SSSSSSSCCSSSSSSSSSS......SSS.XXXX..RR..XXXXXXS.....
...~~~~~~~~~~~~~~CCC~~~~~~~~~~~~~~~...~~~~.......XX.....RRXXXXX..XXX......SSS.XXXX..RR..XXXXXX......
..........SSSS...RRRRRRRCCCC.XXXXXX...~~~~..............RR...SSSSS..SSSSS...........RRSSSSSSS.....SS
..........SSSS.SSRRRSSXXSCCSXXXXXXX...~~~~..........S...RR.S.SSSSS.SSSSSSS.SSS..S...RRSSSSSSS.SS..SS
..XXXXXXX......SSRRRSSXXSCCSXXXXXXX...~~~~..SSSSSS.SSS..RRSSSSSSSS.SSSSSSSSSSSSSSS..RRSSSSSSSSSSS...
..XXXXXXXXXXXXXSSCRCSSXXSCCSX.CC......~~~~..SSSSSS.SSS..RRSSSSSSSS.SSSSSSSSSSSSSSS..RRSSSSSSSSSSS...
..XXXXXXXXXXXXXXSCRCSXCC.RR.CCCCS.C...~~~~..SSSSSS.SSS..RRSSSSSSSS.SSSSSSSSSSSSSSS..RRSSSSSSSSSSS...
.........XXXXXXXSCRCSXCSSRR.CCSSS.C...~~~~..SSSSSS.SSS..RRSSSSSSSS.SSSSSSSSSSSSSSS..RRSSSSSSSSSSS...
......XXXRRRRRRXSCRCSXSSSRR.SSSSS.X...~~~~..SSSSSS.SSS..RRSSSSSSSS.SSSSSSSSSSSSSSS..RRSSSSSSSSSSS...
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR====RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR====RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR
........................RR..........RR~~~~RRXXRRRRRRRRRSSRRRRRRCRX..................RR..............
........................RR..........RR~~~~RRXSSSSSRSSSSSSSRSSSSSSX..................RR..............
........................RR..........RR~~~~RRXSSSSSRSSSSSSSRSSSSSS......SSS..........RR..............
......................S.RR..........RR~~~~RRXSSSSSRSSSSSSSRSSSSSS......SSS....SS....RR..............
......................S.RR..........RR~~~~RRXSSSSSRSSSSSSSRSSSSSS......SSS....SS....RR..............
.........C.....C......S.RR..........RR~~~~RRXCSSCCRSSSSSSSRSSSSSS..........SS.......RR..............
....CSSSSSSSSSSSSSSSC...RR.S...SSS..RR~~~~RRXRSSSSRSSSSSSSSRCCCCSX.........SS.......RR.....SSSS.....
....SSSSSSSSSSSSSSSSS...RRSSS.SSSSS.RR~~~~RRXRSSSSSSSCCCSSSSSRRRSX..................RR.....SSSS.....
....SSSSSSSSSSSSSSSSS...RRSSS.SSSSS.RR~~~~RRXRSSSSSSRRRRRSSSSRSSSX.S................RR.....SSSS.....
....SSSSSSSSSSSSSSSSS...RRSSS.SSSSS.RR~~~~RRXRRRRRSSRSSSRSSSSRSSSXSSSSSSSSS.SSSSS...RR.....SSSS.....
....SSSSSSSSSSSSSSSSS...RRSSS.SSSSS.RR~~~~RRRRRRRRSSSSSSRSSSSRSSSXSSSSSSSSSSSSSSSS..RR.....SSSS.....
....SSSSSSSSSSSSSSSSS...RRSSS.SSSSS.RR~~~~RRRXRRRXSSCSSSRSSSSRRRCRSSSSSSSSSSSSSSSS..RR..............
....SSSSSSSSSSSSSSSSS...RRRRRRRRRRRRRR~~~~RR.XRRRXSSCRRRRRRRRRRRC.SSSSSSSSSSSSSSSS..RR....SS......SS
....SSSSSSSSSSSSSSSSS...RRRRRRRRRRRRRR~~~~RR.XRRRX.....XXXXXRR.XXXSSSSSSSSSSSSSSSS..RR....SS......SS
.........SSSSSSS........RR..........RR~~~~RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR..............
..........SRRRS.........RR..........RR~~~~RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.........SS...
.SSS......SRRRS.........RR..........RR~~~~RR........................................RR.........SS...
.SSS.C...CCRRRCC...C....RR..........RR~~~~RR.......................SSS..............RR.SSSSSSS......
.SSS.SSSSSCRRRCSSSSS....RR....SS....RR~~~~RR.......................SSS..............RRSSSSSSSSS.SS..
.....SSSSSSRRRSSSSSS....RR...SSSS...RR~~~~RR..............SSSSS....SSS.......SSSSSSSRRSSSSSSSSSSSSS.
.....SSSSS.RRR.SSSSS....RR.S.SSSS.S.RR~~~~RR.S..SS.......SSSSSSS.............SSSSSSSRRSSSSSSSSSSSSS.
....RCRRRCCRRRCCRRRCR...RRSSSSSSSSSSRR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSS..SSSSSSSSSSSSSRRSSSSSSSSSSSSS.
.....SSSSSCRRRCSSSSS....RRSSSSSSSSSSRR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSS.SSSSSSSSSSSSSRR...SSS...SSSS.
.....SSSSSSRRRSSSSSS....RRSSSSSSSSSSRR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSRR...SSS...SSSS.
.....SSSSS.RRR.SSSSS....RRSSSSSSSSSSRR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSRRRRRRRRRRRRRRRR
.....RRRRR.RRR.RRRRR....RRSSSSSSSSSSRR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSRRRRRRRRRRRRRRRR
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR====RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR...XXXXXX.RR..
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR====RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.XXXXXXXXXXR..
........................RR..........RR~~~~RR........................................RRSSSSSSSSSS.R..
........................RR..........RR~~~~RR.SSS.SSS................SS..............RRSSSSSSSSSS.R..
........................RR..........RR~~~~RR.SSSSSSS................SS....SS........RRSSSSSSSSSS.R..
...SSSSS......SSSSSS....RR.SSSSS....RR~~~~RRSSSSSSSSS.SSSSS..SSSSSS......SSSS.......RRSSSSSSSSSSXR..
.S.SSSSS.S..S.SSSSSS..S.RRSSSSSSS.S.RR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSS.....SSSS.......RRSSSSSSSSSSSR..
SSSSSSSSSSSSSSSSSSSS.SSSRRSSSSSSSSSSRR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS.SSSSS.RRSSSSSSSSSSSR..
SSSSSSSSSSSSSSSSSSSS.SSSRRSSSSSSSSSSRR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSRRSSSSSSSSSSSR..
SSSSSSSSSSSSSSSSSSSS.SSSRRSSSSSSSSSSRR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSRRSSSSSSSSSSSR..
SSSSSSSSSSSSSSSSSSSS.SSSRRSSSSSSSSSSRR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSRRSSSSSR.SSSSR..
SSSSSSSSSSSSSSSSSSSS.SSSRRSSSSSSSSSSRR~~~~RR.SSS.SSS.SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSRRSSSSSRRRRCRR.S
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR====RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.SSS.SSSSSSR.S
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR====RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.SSSSSSSSSSR.S
........................RR....RR....RR~~~~RR........................................RR.SSSSSSSSSSR..
........................RR.ssSSs.C..RR~~~~RR.................................SS.....RR.SS.SSSSSSSR..
........................RR.CCRRRss..RR~~~~RR........SSSSS........SSSSS......SSSS....RR.SS..SSSSSSR..
........CSS.......C.....RRsSSRRRRss.RR~~~~RR.......SSSSSSS.S...S.SSSSS......SSSS.S..RRSSSSS.SRRRRR..
.......SSSSSSSSSSSSSSS..RRssRCCRRRs.RR~~~~RRSSSSS..SSSSSSSSSS.SSSSSSSSSSSSSSSSSSSSS.RRSSSSS.SSSSSR..
...SSSSSSSSSSSSSSSSSSS..RRsRRSSRRRs.RR~~~~RRSSSSSS.SSSSSSSSSS.SSSSSSSSSSSSSSSSSSSSS.RRSSSSS.SSSSSR..
...SSSSSSSSSSSSSSSSSSS..RRsRRRRRRRs.RR~~~~RRSSSSSSSSSSSSSSSSS.SSSSSSSSSSSSSSSSSSSSS.RRXX..XXXXXX.R..
...SSSSSSSSSSSSSSSSSSS..RRssRsssss..RR~~~~RRSSSSSSSSSSSSSSSSS.SSSSSSSSSSSSSSSSSSSSS.RRXX..XXXXXX.R..
...SSSSSSSSSSSSSSSSSSS..RRCsss.s....RR~~~~RRSSSSSSSSSSSSSSSSS.SSSSSSSSSSSSSSSSSSSSS.RRRR..RRRRRR.R..
...sssssssssssssssssssssRRRRRRRRRRRRRR~~~~RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR
~XXRRXXXX..XXXXXXXXXXXXXRRRRRRRRRRRRRR====RRRRCCCCCCRXXXXX...RRXXXX.SSS.XSXRRXXXXXX.................
SS.RRXXXXCC.XXX.SRXRRRRRRS..SRRSRRRRRR====RRS.SSSXSSRRRSRRRRRRR.XXX.SSS.SSSRRXXXXXX...............SS
SS.RRXXXXSS.RRRRRRRRSS..~~~~~==~~~~~~~~~~~~~~~~~~~~~~==RRRRRSRRRRRRRSSS.SSSRRRRRRS............S...SS
.CCRRXXXX...R..~~~~~~~~~~~~~~==~~~~~~~~~~~~~SSSSSS~~~==~~~~~~~~~SS.R..SSSSSCR.SSS...SSS.......S.....
.CCRRXXXXCSCCS.~~~~~~~~~~~~~~==~SS~~~~~~~~~~SSSSSSS~~==~~~~~~~~~SSS==SSSSSSCR.SSS...SSS.......S.....
.S.RRXXXXSSCCS~~~~~~~~~~~~~~~==SSS~~~~~~~~~SSSSSSSSS~==~~~~~~~~~~~~==~SSSSSR.SSSS.X.SSS..SS.........
.RRRRRRRRS~==~~~~~~~~~~~~~~~~==SSS~~~~~~~~SSSSSSSSSS~==~~~~~~~~~~~~==SSSSRRCCS..SSX.SSS..SS.........
RRCRRSCRR~~==SS~~~~~~~~~~~~~~~~~~~~~~~~~~~SSSSSSSSSS~~~~~~~~~~~~~~~=CSSSCCCSSSC.SSX............SS...
R~S~~~S~~~~==~~~~~~~~~~~~~~~~~~~~~~~~~~~~~SSSSSSSSSS~~~~~~~~~~~~~~~=CSS~~SS~~SS~SSX...S........SS...
R~~~~~~~~~~==~~~~~~~~~~~~~SS~~~~~~~~~~~~~~SSSSSSSSSS~~~~~~~~~~~~~~~==~~~~~~~~~~SSSX...S..SS.........
R~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~SS~~~~~~~~~~~~~~~~~~~SSSSX...S..SS......SSS
CS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~SSSSX..............SSS
CS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~SS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~SS.X....SS.S......SSS
CS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~S.X....SS.S......SSS
R~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~S.X.......S.........
```
