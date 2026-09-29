# 예시 배치 · 강어귀 항구 도시 (`estuary`)

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 23936칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

의도: 강이 북쪽 가장자리 폭포로 들어와 곧게 남쪽 호수 항구로 흐른다. 서쪽 둑에 왕성·귀족 저택, 동쪽 둑에 저택 구역·성당·포룸·풍차. 다리 셋 + 호수 하구 다리. 호수 옆 모랫길에 어부 목조집, 우물 광장.

그림 `layout-estuary` (엔진 렌더 100×100, 820px 로 줄임). 이 배치는 `scripts/content/author-beodeul-layouts.mts --only estuary` 가
편집기 도구를 아래 순서로 불러 만든다(같은 순서로 부르면 같은 맵이 나온다 — 전체 아래층·윗층 배열은 이 순서의 결과다).

## 잰 값
| 항목 | 값 |
|---|---|
| 원본과 같은 칸 | 52/10000 (0.52%) |
| 구역 키트 | bd-castle✓, bd-estate✓, bd-forum✓, bd-cathedral✓, bd-windmill✓, bd-harbour·, bd-harbour-west·, bd-river-bridge· |
| 문 | 52곳 — 육지 도달 52, 포장 길망 도달 52 |
| 막다른 포장 칸 / 막다른 넓은 거리 | 0 / 0 |
| 물에 닿아 끝나는 거리 / 막힌 문 앞 / 같은 조각 셋 일렬 | 0 / 0 / 0 |
| 도구 호출 | 168번(잔디 무늬 조각 40번 포함) |

## 도구 순서 (잔디 무늬 40번은 뺐다)
```text
create_map {"id": "estuary", "name": "강어귀 항구 도시", "width": 100, "height": 100, "tilesetId": "beodeul_city"}
fill_region 버들항 풀밭 (0,0) 100×100
stamp_object bd-harbour-lake @(2,85)
stamp_object bd-waterfall-drop @(36,0)
fill_region 물 (40,7) 4×78
stamp_object bd-castle @(2,0)
stamp_object bd-estate @(48,4)
stamp_object bd-cathedral @(78,4)
stamp_object bd-manor-vine @(4,40)
stamp_object bd-garden-formal @(4,52)
stamp_object bd-bridge-arch @(40,32)
stamp_object bd-bridge-arch @(40,60)
stamp_object bd-bridge-arch @(40,72)
fill_region 버들항 길 포석 (0,33) 40×2
fill_region 버들항 길 포석 (44,33) 56×2
fill_region 버들항 길 포석 (56,26) 2×7
fill_region 버들항 길 포석 (84,26) 2×7
fill_region 버들항 길 포석 (38,35) 2×49
fill_region 버들항 길 포석 (44,35) 2×49
fill_region 버들항 길 포석 (24,35) 2×49
fill_region 버들항 길 포석 (84,35) 2×49
fill_region 버들항 길 포석 (26,47) 12×2
fill_region 버들항 길 포석 (46,49) 38×2
stamp_object bd-forum @(46,35)
fill_region 버들항 길 포석 (46,34) 22×1
fill_region 버들항 길 포석 (45,44) 1×3
fill_region 버들항 길 포석 (61,49) 4×1
fill_region 버들항 길 포석 (86,59) 14×2
stamp_object bd-windmill @(86,61)
fill_region 버들항 길 포석 (96,60) 3×1
fill_region 버들항 길 포석 (11,60) 3×1
fill_region 버들항 길 포석 (0,61) 40×2
fill_region 버들항 길 포석 (46,61) 38×2
fill_region 버들항 길 포석 (0,73) 40×2
fill_region 버들항 길 포석 (46,73) 38×2
fill_region 버들항 길 포석 (24,84) 16×1
fill_region 버들항 길 포석 (44,84) 56×1
fill_region 버들항 길 포석 (97,83) 1×1
fill_region 버들항 모랫길 (5,84) 19×1
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
stamp_object bd-house-h141_0 @(35,41)
stamp_object bd-house-h145_0 @(26,55)
stamp_object bd-house-h139_0 @(29,53)
stamp_object bd-house-h129_0 @(33,53)
stamp_object bd-house-i12 @(68,43)
stamp_object bd-house-h107_0 @(71,43)
stamp_object bd-house-i0 @(77,43)
stamp_object bd-house-h123_0 @(46,55)
stamp_object bd-house-h112_0 @(49,55)
stamp_object bd-house-h123_1 @(53,55)
stamp_object bd-house-h111_0 @(59,53)
stamp_object bd-house-h101_0 @(66,55)
stamp_object bd-house-i8 @(73,55)
stamp_object bd-house-h103_1 @(79,55)
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
stamp_object bd-house-h124_0 @(46,64)
stamp_object bd-house-h107_1 @(55,65)
stamp_object bd-house-h110_1 @(62,65)
stamp_object bd-house-h103_2 @(70,67)
stamp_object bd-house-h139_0 @(75,65)
stamp_object bd-house-h116_0 @(79,65)
stamp_object bd-house-h102_0 @(46,78)
stamp_object bd-house-h111_0 @(53,76)
stamp_object bd-house-i13 @(60,78)
stamp_object bd-house-h101_2 @(64,78)
stamp_object bd-house-h116_0 @(67,76)
stamp_object bd-house-i9 @(72,78)
stamp_object bd-house-h117_1 @(78,76)
stamp_object bd-out-well-plaza-sand @(26,76)
fill_region 버들항 길 포석 (30,75) 2×1
stamp_object bd-out-cabin-small @(5,80)
stamp_object bd-out-cabin @(9,78)
stamp_object bd-out-longhouse @(14,78)
stamp_object bd-tree-3e8732 @(71,37)
stamp_object bd-tree-03a8f7 @(50,0)
stamp_object bd-tree-c27062 @(75,0)
stamp_object bd-tree-eef4bc @(22,55)
stamp_object bd-tree-132848 @(73,20)
stamp_object bd-tree-28ad5e @(1,46)
stamp_object bd-tree-3e8732 @(87,46)
stamp_object bd-tree-47e17a @(94,0)
stamp_object bd-tree-0f7ed1 @(78,40)
stamp_object bd-tree-132848 @(70,11)
stamp_object bd-tree-37f48b @(97,0)
stamp_object bd-tree-eef4bc @(76,10)
stamp_object bd-tree-7ecdb8 @(73,52)
stamp_object bd-tree-f4f319 @(68,52)
stamp_object bd-tree-28ad5e @(77,0)
stamp_object bd-tree-3e8732 @(74,23)
stamp_object bd-tree-cc0fcb @(98,26)
stamp_object bd-tree-0f7ed1 @(56,1)
stamp_object bd-tree-37f48b @(89,1)
stamp_object bd-tree-47e17a @(98,47)
stamp_object bd-tree-132848 @(98,20)
stamp_object bd-tree-d105b2 @(37,20)
stamp_object bd-tree-f4f319 @(1,51)
stamp_object bd-tree-0f7ed1 @(71,65)
stamp_object bd-tree-c27062 @(99,11)
stamp_object bd-tree-d61d7e @(92,39)
stamp_object bd-tree-a80c85 @(87,38)
stamp_object bd-tree-37f48b @(97,40)
stamp_object bd-tree-eef4bc @(36,12)
stamp_object bd-tree-d105b2 @(45,13)
stamp_object bd-tree-e9d9b3 @(96,92)
stamp_object bd-tree-0f7ed1 @(91,94)
stamp_object bd-tree-3e8732 @(86,92)
stamp_object bd-tree-1e09f0 @(97,95)
stamp_object bd-tree-d105b2 @(91,90)
stamp_object bd-tree-f4f319 @(91,87)
```

## 역할 격자 100×100 (R 포장 · s 모랫길 · = 다리/잔교 · ~ 물 · . 걷는 땅 · X 막힌 땅 · C 윗층 걸음 · S 윗층 막힘)
```text
..XXXXXXXXXXXXSSXXXXXXSSXXXXXXXXXXX.XXXX~~~~XXXX..SSS......................S.S................SS.SS.
..XXXXXXXXXXXSSSXSSSXSSSXXXXXXXXXXX.XXXXSSSSXXXX..SSS...SS.................S.S...........SS...SS.SS.
..XXXXXXXXXXXSSSSSSSSSSSXXXXXXXXXXX.XXXXSSSSXXXX..SSS...SS.................S.S...........SS.........
..XSSSSXSSSSXSSSSSSSSSSSXSSSSXSSSS......SSSS........................................................
..XSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS...S.CSSSSCCXX~XXXXXXSXXXSXXXXXXXXX...............................
..XSSSRSSSSSSSSSSSSSSSSSSSSSSSRSSS..XS.CS~~~CCXX~S.XXXXSSSSSXXXXSSSSS.........S.C...........SS......
..XSSSRSSSSSSSSSSSSSSSSSSSSSSSRSSS..XS.X~~~~XSXX~SSXXXSSSSSSSXXXSSSSS.........SXSXXXXXXXXXX.SS......
..XSSSRSSSSSSSSSSSSSSSSSSSSSSSRSSS......~~~~....~SSSSSSSSSSSSSSSSSSSS.........SSSSXXXXXXXXXSSS......
..XRRRRSSSSSSSSSSSSSSSSSSSSSSSRCRR......~~~~....~SSSSSSSSSSSSSSS...S...........SSSXXXXXXXXXSSS......
..XRSSRSSSSSSSSSSSSSSSSSSSSSSSRSSS......~~~~....~S.SSSSSSSSSSSSSSSSSS.........XSSSSSSSSSSSSSSS......
..XRRRRSSSSSSSSSSSSSSSSSSSSSSSRSSS......~~~~....~SSSSSSSSSSSSSSSSSSSS.......S.SSSSSSSSSSSSSSS.......
..XRRRRRRRRRRRSCCRRRCCSRRRRRRRRSSS......~~~~....~SSSSSSSSSSSSSSSSSSSS.SS....S.SSSSSSSSSSSSSSS......S
..XSSRXXXXXXXXXSCRRRCSXXXXXXXXXSSS..S...~~~~....~SSSSSSSSSSSSSSSSSSS..SS....S.SSSSSSSSSSSSSXSX.....S
..XSSRXXXXXXXXXSCRRRCSXXXXXXXXXSSS..S...~~~~.SS.~S.SSSSSSSSSSSSSSSSSX.........SSSSSSSSSSSSSSSSS....S
..XRCCXXXXXXXXSSCRRRCSSSXXXXXXXRCC..S...~~~~.SS.~SRRRRRCCCCCRRRRRRRSX.........SSSSSSSSSSSSSSSSS.....
..XCCCRRRCRSSCCCRRRRRCCCSSCCRRRCCC......~~~~....~SRRRSSSRRSSSSSSSSXSX..........SSSSSSSSSSSSSSSS.....
..XCCCRRRCRSSCCCRRRCCCCCSSCCRRRCCC......~~~~....~SSSRSSSRRSSSSSSSSXS...........SSSSSSSSSSSSSSSC.....
..XCCCRRSCRSSCCCRRRCCCCCSSCRRRRCCC......~~~~....~SSSSSSRRRSSRSSSSSXSS..........SSSSSSSSSSSSSSS......
..XCCCRRSSRRRCCCRRRSSCCCRRSXRRRCCC......~~~~....~SSSSSSRRRSSRSSSSSRSS.........RRRRRRRRRRRRRRRS......
..XSSS.......SSSXRRRXSSS.......SSS......~~~~....~SRRSSSRRRSSRSSSSSRSS.........RRRRRRRRRRRRRR..S.....
..XSSSXXXXXXXSSSXRRRXSSSXXXXXXXSSS...SS.~~~~....~SRRSSRRRRSSRSSSSSRSS....SS...SRRRRRRSSRRRRSSSS...SS
..XSSSXXXXXXXSSSXRRRXSSSXXXXXXXSSS...SS.~~~~....~SRRSSRCRRCRRRRSSSRS.....SS...RSSRRRRSSRRSRR.SS...SS
..XSSSXXXXXXXSSSXCRCXSSSXXXXXXSSSSC.....~~~~....~SRRRRRCRRCRRRRSSSRS..........RRRRRRRRRRRRRR.SS.....
..SSSS~~~~~~~~~~~CCC~~~~~~~~~~SSSSS.....~~~~....~SRRRRRCCCCRRRRRRRRS......SSS.RRRRRRRRRRRRRR..S.....
..SS~~~~~~~~~~~~~CCC~~~~~~~~~~~~~~~.....~~~~....~SSSSSSSCCSSSSSSSSSS......SSS.XXXX..RR..XXXXXXS.....
..X~~~~~~~~~~~~~~CCC~~~~~~~~~~~~~~~.....~~~~....~SS.....RRSSSSS..SSS......SSS.XXXX.CCCC.XXXXXX......
..X.......SSSS...RRRRRRRCCCC.XXXXXX.....~~~~............RR...SSSSS..SSSSS...........RRSSSSSSS.....SS
..X.......SSSS.SSRRRSSXXSCCSXXXXXXX.....~~~~........S...RR.S.SSSSS.SSSSSSS.SSS..S...RRSSSSSSS.SS..SS
..XXXXXXX......SSRRRSSXXSCCSXXXXXXX.....~~~~SSSSSS.SSS..RRSSSSSSSS.SSSSSSSSSSSSSSS..RRSSSSSSSSSSS...
..XXXXXXXXXXXXXSSCRCSSXXSCCSX.CC........~~~~SSSSSS.SSS..RRSSSSSSSS.SSSSSSSSSSSSSSS..RRSSSSSSSSSSS...
..XXXXXXXXXXXXXXSCRCSXCC.RR.CCCCS.C.....~~~~SSSSSS.SSS..RRSSSSSSSS.SSSSSSSSSSSSSSS..RRSSSSSSSSSSS...
..X......XXXXXXXSCRCSXCSSRR.CCSSS.C.....~~~~SSSSSS.SSS..RRSSSSSSSS.SSSSSSSSSSSSSSS..RRSSSSSSSSSSS...
..X...SSSRRRRRRXSCRCSXSSSRR.SSSSS.S.....~~~~SSSSSS.SSS..RRSSSSSSSS.SSSSSSSSSSSSSSS..RRSSSSSSSSSSS...
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR====RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR====RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR
........................RR............RR~~~~RRSSRRRRRRRRRSSRRRRRRCRS................RR..............
........................RR............RR~~~~RRSSSSSSRSSSSSSSRSSSSSSS................RR..............
........................RR............RR~~~~RRXSSSSSRSSSSSSSRSSSSSS....SSS..........RR..............
........................RR............RR~~~~RRSSSSSSRSSSSSSSRSSSSSS....SSS..........RR.SSS..........
........................RR............RR~~~~RRSSSSSSRSSSSSSSRSSSSSS....SSS..........RR.SSS..SSS.....
.........C.....C........RR............RR~~~~RRSCSSCCRSSSSSSSRSSSSSS...........SS....RR.SSS..SSS..SS.
....CSSSSSSSSSSSSSSSC...RR.S...SSS..S.RR~~~~RRSRSSSSRSSSSSSSSRCCCCSS..........SS....RR......SSS..SS.
....SSSSSSSSSSSSSSSSS...RRSSS.SSSSSSSSRR~~~~RRSRSSSSSSSCCCSSSSSRRRSS................RR......SSS.....
....SSSSSSSSSSSSSSSSS...RRSSS.SSSSSSSSRR~~~~RRSRSSSSSSRRRRRSSSSRSSSS.S..............RR..............
....SSSSSSSSSSSSSSSSS...RRSSS.SSSSSSSSRR~~~~RRSRRRRRSSRSSSRSSSSRSSSSSSSSSSSSS.SSSSS.RR..............
....SSSSSSSSSSSSSSSSS...RRSSS.SSSSSSSSRR~~~~RRRRRRRRSSSSSSRSSSSRSSSSSSSSSSSSSSSSSSSSRR..............
.S..SSSSSSSSSSSSSSSSS...RRSSS.SSSSSSSSRR~~~~RRRSCCCSSSCSSSRSSSSRRRCCSSSSSSSSSSSSSSSSRR.SSS..........
.S..SSSSSSSSSSSSSSSSS...RRRRRRRRRRRRRRRR~~~~RR.SCCCSSSCRRRRRRRRRRRCCSSSSSSSSSSSSSSSSRR.SSS........SS
.S..SSSSSSSSSSSSSSSSS...RRRRRRRRRRRRRRRR~~~~RR.SCRCS.C...XSSSXRR.SSSSSSSSSSSSSSSSSSSRR.SSS........SS
.........SSSSSSS........RR............RR~~~~RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR..............
..........SRRRS.........RR............RR~~~~RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR..............
.SS.......SRRRS.........RR............RR~~~~RR......................................RR..............
.SS..C...CCRRRCC...C....RR............RR~~~~RR......................SS...SSS........RR.SSSSSSS......
.....SSSSSCRRRCSSSSS....RR....SS..SS..RR~~~~RR......................SS...SSS........RRSSSSSSSSS.SS..
.....SSSSSSRRRSSSSSS....RR...SSSSSSSS.RR~~~~RR..............SSSSS........SSS........RRSSSSSSSSSSSSS.
.....SSSSS.RRR.SSSSS..S.RR.S.SSSSSSSS.RR~~~~RR.S..SS.......SSSSSSS..............SSS.RRSSSSSSSSSSSSS.
....RCRRRCCRRRCCRRRCR.S.RRSSSSSSSSSSS.RR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSS..SSSSSSSSSSSRRSSSSSSSSSSSSS.
.....SSSSSCRRRCSSSSS..S.RRSSSSSSSSSSS.RR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSS.SSSSSSSSSSSRR...SSS...SSSS.
.....SSSSSSRRRSSSSSS....RRSSSSSSSSSSS.RR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSRR...SSS...SSSS.
.....SSSSS.RRR.SSSSS....RRSSSSSSSSSSS.RR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSRRRRRRRRRRRRRRRR
.....RRRRR.RRR.RRRRR....RRSSSSSSSSSSS.RR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSRRRRRRRRRRRRRRRR
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR====RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.CCSSSSSSCCR..
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR====RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.SSSSSSSSSSR..
........................RR............RR~~~~RR......................................RRSSSSSSSSSS.R..
........................RR............RR~~~~RR.SSS.SSS..............................RRSSSSSSSSSS.R..
........................RR............RR~~~~RR.SSSSSSS.................SS...SS......RRSSSSSSSSSS.R..
...SSSSS......SSSSSS....RR.SSSSS......RR~~~~RRSSSSSSSSS.SSSSS..SSSSSS..SS..SSSSSSSSSRRSSSSSSSSSSXR..
.S.SSSSS.S..S.SSSSSS..S.RRSSSSSSS.S...RR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSS.....SSSSSSSSSRRSSSSSSSSSSSR..
SSSSSSSSSSSSSSSSSSSS.SSSRRSSSSSSSSSS..RR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSRRSSSSSSSSSSSR..
SSSSSSSSSSSSSSSSSSSS.SSSRRSSSSSSSSSS..RR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSRRSSSSSSSSSSSR..
SSSSSSSSSSSSSSSSSSSS.SSSRRSSSSSSSSSS..RR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSRRSSSSSSSSSSSR..
SSSSSSSSSSSSSSSSSSSS.SSSRRSSSSSSSSSS..RR~~~~RRSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSRRSSSSSR.SSSSR..
SSSSSSSSSSSSSSSSSSSS.SSSRRSSSSSSSSSS..RR~~~~RR.SSS.SSS.SSSSSSSSSSSSSSSSSSSSSSSSSSSSSRRSSSSSRRRRCRR..
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR====RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.SSS.SSSSSSR..
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR====RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.SSSSSSSSSSR..
........................RR....RR......RR~~~~RR......................................RR.SSSSSSSSSSR..
........................RR.ssSSs.C....RR~~~~RR.................................SS...RR.SS.SSSSSSSR..
........................RR.CCRRRss....RR~~~~RR........SSSSS........SSSSS......SSSS..RR.SS..SSSSSSR..
..........CSS.......C...RRsSSRRRRss...RR~~~~RR.......SSSSSSS.S...S.SSSSS......SSSS..RRSSSSS.SRRRRR..
.........SSSSSSSSSSSSSSSRRssRCCRRRs...RR~~~~RRSSSSS..SSSSSSSSSS.SSSSSSSSSSSSSSSSSS..RRSSSSS.SSSSSR..
.....SSSSSSSSSSSSSSSSSSSRRsRRSSRRRs...RR~~~~RRSSSSSS.SSSSSSSSSS.SSSSSSSSSSSSSSSSSS..RRSSSSS.SSSSSR..
.....SSSSSSSSSSSSSSSSSSSRRsRRRRRRRs...RR~~~~RRSSSSSSSSSSSSSSSSS.SSSSSSSSSSSSSSSSSS..RRSS..SSSSSS.R..
.....SSSSSSSSSSSSSSSSSSSRRssRsssss....RR~~~~RRSSSSSSSSSSSSSSSSS.SSSSSSSSSSSSSSSSSS..RRSS..SSSSSS.R..
.....SSSSSSSSSSSSSSSSSSSRRCsss.s......RR~~~~RRSSSSSSSSSSSSSSSSS.SSSSSSSSSSSSSSSSSS..RRRR..RRRRRR.R..
.....sssssssssssssssssssRRRRRRRRRRRRRRRR~~~~RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR
..~XXRRXXXX..XXXXXXXXXXXXXRRRRRRRRRRRRRR====RRRRCCCCCCRXXXXX...RRXXXX.SSS.XSXRRXXXXXX...............
..SS.RRXXXXCC.XXX.SRXRRRRRRS..SRRSRRRRRR====RRS.SSSXSSRRRSRRRRRRR.XXX.SSS.SSSRRXXXXXX...............
..SS.RRXXXXSS.RRRRRRRRSS..~~~~~==~~~~~~~~~~~~~~~~~~~~~~==RRRRRSRRRRRRRSSS.SSSRRRRRRS.......SS.......
...CCRRXXXX...R..~~~~~~~~~~~~~~==~~~~~~~~~~~~~SSSSSS~~~==~~~~~~~~~SS.R..SSSSSCR.SSS........SS.......
...CCRRXXXXCSCCS.~~~~~~~~~~~~~~==~SS~~~~~~~~~~SSSSSSS~~==~~~~~~~~~SSS==SSSSSSCR.SSS.................
...S.RRXXXXSSCCS~~~~~~~~~~~~~~~==SSS~~~~~~~~~SSSSSSSSS~==~~~~~~~~~~~~==~SSSSSR.SSSS.X......SS.......
...RRRRRRRRS~==~~~~~~~~~~~~~~~~==SSS~~~~~~~~SSSSSSSSSS~==~~~~~~~~~~~~==SSSSRRCCS..SSX......SS.......
..RRCRRSCRR~~==SS~~~~~~~~~~~~~~~~~~~~~~~~~~~SSSSSSSSSS~~~~~~~~~~~~~~~=CSSSCCCSSSC.SSX.SSS.......SS..
..R~S~~~S~~~~==~~~~~~~~~~~~~~~~~~~~~~~~~~~~~SSSSSSSSSS~~~~~~~~~~~~~~~=CSS~~SS~~SS~SSX.SSS.......SS..
..R~~~~~~~~~~==~~~~~~~~~~~~~SS~~~~~~~~~~~~~~SSSSSSSSSS~~~~~~~~~~~~~~~==~~~~~~~~~~SSSX.SSS..SS.......
..R~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~SS~~~~~~~~~~~~~~~~~~~SSSSX......SS....SSS
..CS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~SSSSX............SSS
..CS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~SS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~SS.X............SSS
..CS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~S.X............SSS
..R~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~S.X...............
```
