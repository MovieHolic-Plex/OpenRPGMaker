# 예시 배치 · 언덕 위 성 아래 마을 (`hilltop`)

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 23936칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

의도: 성은 북쪽 한가운데 언덕, 저택·성당이 양 날개. 큰길(38행) 아래 포룸, 동쪽 귀족 구역(저택+정원), 서쪽 풍차 들. 성벽 밖 남쪽 모랫길에 목조집과 우물 광장. 강·항구 없음 — 내륙 성읍.

그림 `layout-hilltop` (엔진 렌더 100×100, 820px 로 줄임). 이 배치는 `scripts/content/author-beodeul-layouts.mts --only hilltop` 가
편집기 도구를 아래 순서로 불러 만든다(같은 순서로 부르면 같은 맵이 나온다 — 전체 아래층·윗층 배열은 이 순서의 결과다).

## 잰 값
| 항목 | 값 |
|---|---|
| 원본과 같은 칸 | 45/10000 (0.45%) |
| 구역 키트 | bd-castle✓, bd-estate✓, bd-forum✓, bd-cathedral✓, bd-windmill✓, bd-harbour·, bd-harbour-west·, bd-river-bridge· |
| 문 | 43곳 — 육지 도달 43, 포장 길망 도달 43 |
| 막다른 포장 칸 / 막다른 넓은 거리 | 0 / 0 |
| 물에 닿아 끝나는 거리 / 막힌 문 앞 / 같은 조각 셋 일렬 | 0 / 0 / 0 |
| 빈 바닥(물건 없는 걷는 비포장 땅) | 맵 전체 50.0% · 20×15 화면 35개 중 40% 넘는 화면 24개 (가장 빈 화면 78%) |
| 도구 호출 | 237번(잔디 무늬 조각 60번 포함) |

## 도구 순서 (잔디 무늬 60번은 뺐다)
```text
create_map {"id": "hilltop", "name": "언덕 위 성 아래 마을", "width": 100, "height": 100, "tilesetId": "beodeul_city"}
fill_region 버들항 풀밭 (0,0) 100×100
stamp_object bd-castle @(33,0)
stamp_object bd-estate @(6,4)
stamp_object bd-cathedral @(77,5)
stamp_object bd-forum @(39,44)
stamp_object bd-windmill @(1,40)
stamp_object bd-manor-timber @(72,41)
stamp_object bd-garden-formal @(72,53)
fill_region 버들항 길 포석 (48,33) 3×5
fill_region 버들항 길 포석 (14,26) 2×12
fill_region 버들항 길 포석 (83,27) 2×11
fill_region 버들항 길 포석 (12,38) 73×2
fill_region 버들항 길 포석 (48,40) 3×4
fill_region 버들항 길 포석 (16,40) 2×30
fill_region 버들항 길 포석 (61,40) 2×30
fill_region 버들항 길 포석 (13,48) 3×2
fill_region 버들항 길 포석 (18,48) 21×2
fill_region 버들항 길 포석 (37,50) 2×8
fill_region 버들항 길 포석 (13,58) 26×2
fill_region 버들항 길 포석 (55,58) 6×2
fill_region 버들항 길 포석 (12,62) 1×6
fill_region 버들항 길 포석 (12,68) 88×2
fill_region 버들항 길 포석 (79,61) 3×7
fill_region 버들항 길 포석 (42,58) 1×10
fill_region 버들항 길 포석 (16,70) 2×8
fill_region 버들항 길 포석 (94,70) 2×8
stamp_object bd-house-h116_0 @(18,30)
stamp_object bd-house-h120_0 @(23,32)
stamp_object bd-house-i15 @(30,32)
stamp_object bd-house-h123_1 @(33,32)
stamp_object bd-house-i0 @(39,32)
stamp_object bd-house-i0 @(52,32)
stamp_object bd-house-i7 @(59,32)
stamp_object bd-house-h119_0 @(65,32)
stamp_object bd-house-h123_0 @(70,32)
stamp_object bd-house-i14 @(73,32)
stamp_object bd-house-h102_1 @(76,30)
stamp_object bd-house-h141_0 @(18,42)
stamp_object bd-house-h139_0 @(21,40)
stamp_object bd-house-i3 @(25,42)
stamp_object bd-house-h109_0 @(32,42)
stamp_object bd-house-h109_0 @(18,52)
stamp_object bd-house-i14 @(23,52)
stamp_object bd-house-h117_1 @(26,50)
stamp_object bd-house-i0 @(30,52)
stamp_object bd-house-h106_1 @(18,60)
stamp_object bd-house-i15 @(24,62)
stamp_object bd-house-i6 @(28,62)
stamp_object bd-house-i8 @(35,62)
stamp_object bd-house-h131_0 @(43,62)
stamp_object bd-house-i9 @(49,62)
stamp_object bd-house-i8 @(55,62)
stamp_object bd-house-h103_1 @(63,62)
stamp_object bd-house-h113_1 @(68,62)
stamp_object bd-house-i13 @(73,62)
stamp_object bd-house-h144_0 @(76,62)
stamp_object bd-house-i8 @(82,62)
stamp_object bd-house-h138_0 @(88,60)
stamp_object bd-house-h120_0 @(92,62)
fill_region 버들항 길 포석 (48,70) 2×1
fill_region 버들항 모랫길 (0,78) 100×2
stamp_object bd-out-well-plaza-sand @(44,71)
stamp_object bd-out-house-plank @(8,72)
stamp_object bd-out-cabin @(18,72)
stamp_object bd-out-longhouse @(23,72)
stamp_object bd-out-house-plank @(33,72)
stamp_object bd-out-cabin-small @(56,74)
stamp_object bd-out-house-plank @(60,72)
stamp_object bd-out-cabin @(68,72)
stamp_object bd-out-cabin-small @(73,74)
stamp_object bd-out-longhouse @(78,72)
stamp_object bd-tree-d61d7e @(29,23)
stamp_object bd-tree-f4f319 @(30,28)
stamp_object bd-tree-28ad5e @(29,19)
stamp_object bd-tree-132848 @(31,18)
stamp_object bd-tree-d43edd @(67,19)
stamp_object bd-tree-e9d9b3 @(69,27)
stamp_object bd-tree-d43edd @(90,81)
stamp_object bd-tree-132848 @(17,84)
stamp_object bd-tree-f4f319 @(87,95)
stamp_object bd-tree-a80c85 @(83,82)
stamp_object bd-tree-b1d104 @(31,90)
stamp_object bd-tree-cc0fcb @(79,88)
stamp_object bd-tree-37f48b @(26,85)
stamp_object bd-tree-03a8f7 @(43,81)
stamp_object bd-tree-bdd36e @(22,92)
stamp_object bd-tree-3e8732 @(74,86)
stamp_object bd-tree-d105b2 @(67,93)
stamp_object bd-tree-7ecdb8 @(51,94)
stamp_object bd-tree-5844f6 @(73,93)
stamp_object bd-tree-cc0fcb @(59,83)
stamp_object bd-tree-eef4bc @(19,89)
stamp_object bd-tree-a80c85 @(95,88)
stamp_object bd-tree-f4f319 @(4,69)
stamp_object bd-tree-28ad5e @(8,29)
stamp_object bd-tree-cc0fcb @(59,95)
stamp_object bd-tree-03a8f7 @(95,47)
stamp_object bd-tree-1a786c @(56,90)
stamp_object bd-tree-3e8732 @(13,83)
stamp_object bd-tree-1e09f0 @(93,41)
stamp_object bd-tree-7ecdb8 @(67,82)
stamp_object bd-tree-132848 @(33,82)
stamp_object bd-tree-a80c85 @(88,38)
stamp_object bd-tree-47e17a @(63,89)
stamp_object bd-tree-28ad5e @(95,29)
stamp_object bd-tree-bdd36e @(10,87)
stamp_object bd-tree-d105b2 @(39,83)
stamp_object bd-tree-c27062 @(91,90)
stamp_object bd-tree-d61d7e @(22,87)
stamp_object bd-tree-47e17a @(26,93)
stamp_object bd-tree-3e8732 @(5,90)
stamp_object bd-tree-b1d104 @(3,28)
stamp_object bd-tree-e9d9b3 @(91,50)
stamp_object bd-tree-d105b2 @(86,33)
stamp_object bd-tree-f4f319 @(19,96)
stamp_object bd-tree-47e17a @(94,96)
stamp_object bd-tree-132848 @(25,81)
stamp_object bd-tree-03a8f7 @(90,34)
stamp_object bd-tree-1a786c @(82,93)
stamp_object bd-tree-1e09f0 @(39,86)
stamp_object bd-tree-cc0fcb @(83,87)
stamp_object bd-tree-47e17a @(77,28)
stamp_object bd-tree-03a8f7 @(10,92)
stamp_object bd-tree-d43edd @(46,88)
stamp_object bd-tree-eef4bc @(70,44)
stamp_object bd-tree-bdd36e @(41,94)
stamp_object bd-tree-cc0fcb @(74,28)
stamp_object bd-tree-132848 @(70,96)
stamp_object bd-tree-37f48b @(46,95)
stamp_object bd-tree-1a786c @(8,34)
stamp_object bd-tree-3e8732 @(62,92)
stamp_object bd-tree-03a8f7 @(37,95)
stamp_object bd-tree-28ad5e @(69,55)
stamp_object bd-tree-eef4bc @(97,27)
stamp_object bd-tree-47e17a @(25,30)
stamp_object bd-tree-a80c85 @(17,27)
stamp_object bd-tree-1a786c @(95,57)
stamp_object bd-tree-cc0fcb @(14,94)
stamp_object bd-tree-132848 @(13,97)
stamp_object bd-tree-03a8f7 @(69,87)
stamp_object bd-tree-d105b2 @(28,82)
stamp_object bd-tree-eef4bc @(2,96)
stamp_object bd-tree-cc0fcb @(7,84)
stamp_object bd-tree-7ecdb8 @(63,81)
stamp_object bd-tree-5844f6 @(1,82)
stamp_object bd-tree-3e8732 @(78,95)
stamp_object bd-tree-f4f319 @(55,81)
stamp_object bd-tree-d105b2 @(6,95)
stamp_object bd-tree-28ad5e @(55,85)
stamp_object bd-tree-37f48b @(75,83)
stamp_object bd-tree-47e17a @(30,85)
stamp_object bd-tree-e9d9b3 @(51,83)
stamp_object bd-tree-c27062 @(52,89)
stamp_object bd-tree-a80c85 @(63,85)
stamp_object bd-tree-132848 @(89,98)
stamp_object bd-tree-eef4bc @(67,89)
stamp_object bd-tree-d105b2 @(43,91)
stamp_object bd-tree-37f48b @(78,92)
stamp_object bd-tree-f4f319 @(56,95)
stamp_object bd-tree-c27062 @(16,88)
stamp_object bd-tree-cc0fcb @(84,98)
stamp_object bd-tree-d105b2 @(19,81)
stamp_object bd-tree-1e09f0 @(66,96)
stamp_object bd-tree-132848 @(97,98)
stamp_object bd-tree-e9d9b3 @(21,84)
stamp_object bd-tree-cc0fcb @(35,85)
stamp_object bd-tree-5844f6 @(96,81)
stamp_object bd-tree-37f48b @(80,83)
stamp_object bd-tree-1a786c @(1,88)
stamp_object bd-tree-eef4bc @(98,93)
stamp_object bd-tree-e9d9b3 @(26,96)
stamp_object bd-tree-d105b2 @(31,98)
stamp_object bd-tree-f4f319 @(60,89)
stamp_object bd-tree-0f7ed1 @(92,87)
stamp_object bd-tree-28ad5e @(54,89)
stamp_object bd-tree-e9d9b3 @(51,98)
```

## 역할 격자 100×100 (R 포장 · s 모랫길 · = 다리/잔교 · ~ 물 · . 걷는 땅 · X 막힌 땅 · C 윗층 걸음 · S 윗층 막힘)
```text
..................................XXXXXXXXXXXSSXXXXXXSSXXXXXXXXXX...................................
..................................XXXXXXXXXXSSSXSSSXSSSXXXXXXXXXX...................................
..................................XXXXXXXXXXSSSSSSSSSSSXXXXXXXXXX...................................
..................................SSSSXSSSSXSSSSSSSSSSSXSSSSXSSSS...................................
.......XXXXXXSXXXSXXXXXXXXX.......SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS...................................
.......S.XXXXSSSSSXXXXSSSSS.......SSSRSSSSSSSSSSSSSSSSSSSSSSSRSSS...................................
.......SSXXXSSSSSSSXXXSSSSS.......SSSRSSSSSSSSSSSSSSSSSSSSSSSRSSS............X.C...........SS.......
.......SSSSSSSSSSSSSSSSSSSS.......SSSRSSSSSSSSSSSSSSSSSSSSSSSRSSS............XXSXXXXXXXXXX.SS.......
.......SSSSSSSSSSSSSSS...S........RRRRSSSSSSSSSSSSSSSSSSSSSSSRCRR............XSSSXXXXXXXXXSSS.......
.......S.SSSSSSSSSSSSSSSSSS.......RSSRSSSSSSSSSSSSSSSSSSSSSSSRSSS.............SSSXXXXXXXXXSSS.......
.......SSSSSSSSSSSSSSSSSSSS.......RRRRSSSSSSSSSSSSSSSSSSSSSSSRSSS............XSSSSSSSSSSSSSSS.......
.......SSSSSSSSSSSSSSSSSSSS.......RRRRRRRRRRRSCCRRRCCSRRRRRRRRSSS............XSSSSSSSSSSSSSS........
.......SSSSSSSSSSSSSSSSSSS........SSRXXXXXXXXXSCRRRCSXXXXXXXXXSSS............XSSSSSSSSSSSSSS........
.......S.SSSSSSSSSSSSSSSSSX.......SSRXXXXXXXXXSCRRRCSXXXXXXXXXSSS............XSSSSSSSSSSSSXSX.......
.......SRRRRRCCCCCRRRRRRRSX.......RCCXXXXXXXXSSCRRRCSSSXXXXXXXRCC............XSSSSSSSSSSSSSSSS......
.......SRRRSSSRRSSSSSSSSXSX.......CCCRRRCRSSCCCRRRRRCCCSSCCRRRCCC............XSSSSSSSSSSSSSSSS......
.......SSSRSSSRRSSSSSSSSXS........CCCRRRCRSSCCCRRRCCCCCSSCCRRRCCC.............SSSSSSSSSSSSSSSS......
.......SSSSSSRRRSSRSSSSSXSX.......CCCRRSCRSSCCCRRRCCCCCSSCRRRRCCC.............SSSSSSSSSSSSSSSC......
.......SSSSSSRRRSSRSSSSSRSX....SS.CCCRRSSRRRCCCRRRSSCCCRRSXRRRCCC.............SSSSSSSSSSSSSSS.......
.......SRRSSSRRRSSRSSSSSRSX..S.SS.SSS.......SSSXRRRXSSS.......SSS..SSSS......RRRRRRRRRRRRRRRS.......
.......SRRSSRRRRSSRSSSSSRSX..S....SSSXXXXXXXSSSXRRRXSSSXXXXXXXSSS..SSSS......RRRRRRRRRRRRRR..S......
.......SRRSSRCRRCRRRRSSSRS...S....SSSXXXXXXXSSSXRRRXSSSXXXXXXXSSS..SSSS......SRRRRRRSSRRRRSSSS......
.......SRRRRRCRRCRRRRSSSRS........SSSXXXXXXXSSSXCRCXSSSXXXXXXSSSS..SSSS......RSSRRRRSSRRSRR.SS......
.......SRRRRRCCCCRRRRRRRRS...SSS..~SS~~~~~~~~~~~CCC~~~~~~~~~~SSSS~.SSSS......RRRRRRRRRRRRRR.SS......
.......SSSSSSSCCSSSSSSSSSS...SSS..~~~~~~~~~~~~~~CCC~~~~~~~~~~~~~~~...........RRRRRRRRRRRRRR..S......
.......XX.....RRXXXXX..XXX...SSS..~~~~~~~~~~~~~~CCC~~~~~~~~~~~~~~~...........XXXX..RR..XXXXXXS......
..............RR.............SSS.........SSSS...RRRRRRRCCCC.XXXXXX...........XXXX..RR..XXXXXX.......
..............RR.SSS.....................SSSS.SSRRRSSXXSCCSXXXXXXX...SS............RR............S..
...SSSS.......RR.SSS..........SS.XXXXXXX......SSRRRSSXXSCCSXXXXXXX...SS...SS.SS....RR............S..
...SSSS.S.....RR.SSS..........SS.XXXXXXXXXXXXXSSCRCSSXXSCCSX.CC...........SS.SS....RR..........S.S..
...SSSS.S.....RR.........SS......XXXXXXXXXXXXXXSCRCSXCC.RR.CCCCS.C.................RR..........S....
...SSSS.S.....RR..SSSSS..SS.............XXXXXXXSCRCSXCSSRR.CCSSS.C..........SSSSS..RR..........S....
...SSSS.......RR..SSSSS........S.....XXX......XSCRCSXSSSRR.SSSSS.XSS...S..S.SSSSS..RR...............
..............RR..SSSSSSSSSSSSSSSSSSSSS.SSSSS...RRR..SSSSS.SSSSSSSSSS.SSSSSSSSSSS..RR.SS............
........SSS...RR..SSSSSSSSSSSSSSSSSSSSSSSSSSSS..RRR.SSSSSSSSSSSSSSSSS.SSSSSSSSSSS..RR.SS..SSS.......
........SSS...RR..SSSSSSSSSSSSSSSSSSSSSSSSSSSS..RRR.SSSSSSSSSSSSSSSSS.SSSSSSSSSSS..RR.....SSS.......
........SSS...RR..SSSSSSSSSSSSSSSSSSSSSSSSSSSS..RRR.SSSSSSSSSSSSSSSSS.SSSSSSSSSSS..RR.....SSS.......
........SSS...RR..SSSSSSSSSSSSSSSSSSSSSSSSSSSS..RRR.SSSSSSSSSSSSSSSSS.SSSSSSSSSSS..RR...............
............RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR...SSS.........
............RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR...SSS.........
....XXXXXX..R...RR....SS........................RRR..........RR.........................SSS.........
..XXXXXXXXXXR...RR...SSSS.......................RRR..........RR..............C.....C.........SSS....
.SSSSSSSSSS.R...RR.S.SSSS........SSS............RRR..........RR.........CSSSSSSSSSSSSSSSC....SSS....
.SSSSSSSSSS.R...RRSSSSSSSSSSSS..SSSSS...........RRR..........RR.........SSSSSSSSSSSSSSSSS....SSS....
.SSSSSSSSSS.R...RRSSSSSSSSSSSSS.SSSSS..XXRRRRRRRRRSS.RRRRRCRXRR.......S.SSSSSSSSSSSSSSSSS....SSS....
.SSSSSSSSSSXR...RRSSSSSSSSSSSSSSSSSSS..XSSSSSRSSSSSSSRSSSSSSXRR.......S.SSSSSSSSSSSSSSSSS...........
.SSSSSSSSSSSR...RRSSSSSSSSSSSSSSSSSSS..XSSSSSRSSSSSSSRSSSSSSRRR.......S.SSSSSSSSSSSSSSSSS...........
.SSSSSSSSSSSR...RRSSSSSSSSSSSSSSSSSSS..XSSSSSRSSSSSSSRSSSSSSRRR.........SSSSSSSSSSSSSSSSS......SSS..
.SSSSSSSSSSSRRRRRRRRRRRRRRRRRRRRRRRRRRRXSSSSSRSSSSSSSRSSSSSSRRR.........SSSSSSSSSSSSSSSSS......SSS..
.SSSSSSSSSSSRRRRRRRRRRRRRRRRRRRRRRRRRRRXCSSCCRSSSSSSSRSSSSSSRRR.........SSSSSSSSSSSSSSSSS......SSS..
.SSSSSR.SSSSR...RR.........SS........RRXRSSSSRSSSSSSSSRCCCCSXRR...............SSSSS........SS.......
.SSSSSRRRRCRR...RR........SSSS.......RRXRSSSSSSSCCCSSSSSRRRSXRR...............SRRRS........SS.......
..SSS.SSSSSSR...RR.SSS..S.SSSS.......RRXRSSSSSSRRRRRSSSSRSSSXRR...............SRRRS.................
..SSSSSSSSSSR...RRSSSSSSSSSSSS.SSSSS.RRXRRRRRSSRSSSRSSSSRSSSXRR..........C...CCRRRCC...C............
..SSSSSSSSSSR...RRSSSSSSSSSSSSSSSSSSSRRRRRRRRSSSSSSRSSSSRSSSXRR..........SSSSSCRRRCSSSSS............
..SS.SSSSSSSR...RRSSSSSSSSSSSSSSSSSSSRRRXRRRXSSCSSSRSSSSRRRCRRR......S...SSSSSSRRRSSSSSS............
..SS..SSSSSSR...RRSSSSSSSSSSSSSSSSSSSRRRXRRRXSSCRRRRRRRRRRRC.RR......S...SSSSS.RRR.SSSSS............
.SSSSS.SRRRRR...RRSSSSSSSSSSSSSSSSSSSRRRXRRRX.....XXXXXRR.XXXRR......S..RCRRRCCRRRCCRRRCR......SSS..
.SSSSS.SSSSSRRRRRRRRRRRRRRRRRRRRRRRRRRR...R............RRRRRRRR..........SSSSSCRRRCSSSSS.......SSS..
.SSSSS.SSSSSRRRRRRRRRRRRRRRRRRRRRRRRRRR...R............RRRRRRRR..........SSSSSSRRRSSSSSS.......SSS..
.XX..XXXXXX.R...RR........................R..................RR..........SSSSS.RRR.SSSSS.SS....SSS..
.XX..XXXXXX.R...RRSSSSSS..................R..................RR................RRR......SSSS........
............R...RRSSSSSS.S................R..................RR.SSS..SSS..S..S.RRR......SSSS........
............R...RRSSSSSSSSS..SSSSS.SSSSSS.RSSSSSSSSSSSSSSSSSSRRSSSSSSSSSSSSSSSSRRRSSSSSSSSSSSSSSSSS.
............R...RRSSSSSSSSS.SSSSSSSSSSSSS.RSSSSSSSSSSSSSSSSSSRRSSSSSSSSSSSSSSSSRRRSSSSSSSSSSSSSSSSS.
............R...RRSSSSSSSSS.SSSSSSSSSSSSS.RSSSSSSSSSSSSSSSSSSRRSSSSSSSSSSSSSSSSRRRSSSSSSSSSSSSSSSSS.
............R...RRSSSSSSSSS.SSSSSSSSSSSSS.RSSSSSSSSSSSSSSSSSSRRSSSSSSSSSSSSSSSSRRRSSSSSSSSSSSSSSSSS.
............R...RRSSSSSSSSS.SSSSSSSSSSSSS.RSSSSSSSSSSSSSSSSSSRRSSSSSSSSSSSSSSSSRRRSSSSSSSSSSSSSSSSS.
............RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR
....SS......RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR
....SS..........RR..............................RR............................................RR....
................RR...........................ssSSs.C..........................................RR....
........SSSSSSSSRR.CSS.......C...SSSSSSSS....CCRRRss........SSSSSSSS.CSS............C.........RR....
........SSSSSSSSRRSSSSSSSSSSSSSSSSSSSSSSS...sSSRRRRss.......SSSSSSSSSSSSS.....SSSSSSSSSS......RR....
........SSSSSSSSRRSSSSSSSSSSSSSSSSSSSSSSS...ssRCCRRRs...SSSSSSSSSSSSSSSSSSSSS.SSSSSSSSSS......RR....
........SSSSSSSSRRSSSSSSSSSSSSSSSSSSSSSSS...sRRSSRRRs...SSSSSSSSSSSSSSSSSSSSS.SSSSSSSSSS......RR....
........SSSSSSSSRRSSSSSSSSSSSSSSSSSSSSSSS...sRRRRRRRs...SSSSSSSSSSSSSSSSSSSSS.SSSSSSSSSS......RR....
........SSSSSSSSRRSSSSSSSSSSSSSSSSSSSSSSS...ssRsssss....SSSSSSSSSSSSSSSSSSSSS.SSSSSSSSSS......RR....
ssssssssssssssssssssssssssssssssssssssssssssCsssssssssssssssssssssssssssssssssssssssssssssssssssssss
ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss
....................................................................................................
...................SS....SS................SSS.........SS......SSS........................SSSS..SSSS
.SSSS..............SS....SS.SS...SS........SSS.........SS......SSS.SSS.............SSS....SSSS..SSSS
.SSSS........SSS............SS...SS....SS..SSS.....SS......SS..SSS.SSS.....SS...SS.SSS....SSSS..SSSS
.SSSS..SS....SSS.SS..SS................SS..........SS......SS......SSS.....SS...SS.SSS....SSSS..SSSS
.SSSS..SS....SSS.SS..SS...SS..SS...SS..................S.......SSS........................SSSS..SSSS
.SSSS.....................SS..SS...SS..SSS.............S.......SSS........SSS.......................
..........SSS.........SSS..............SSS.............S.......SSS...SSS..SSS......SS.......SS......
.SSS......SSS...S.....SSS..............SSS....SSSS...................SSS..SSS..SS..SS.......SS.SSS..
.SSS......SSS...S..S..SSS..............SSS....SSSS..S.S.....SS.SS..S.SSS.......SS..............SSS..
.SSS.SSS..SSS...S..S..SSS......SSSS...........SSSS..S.S.SSS.SS.SS..S.......................S...SSS..
.SSS.SSS...........S...........SSSS........SS.SSSS..S.S.SSS........S.......................S........
.....SSS..SSS.........SSS......SSSS........SS.SSSS......SSS...SSS.............SS...........S........
..........SSS.........SSS.SS...SSSS.....................SSS...SSS..SS....SSSS.SS..SSS.............S.
..........SSS.SS......SSS.SS...SSSS......SSS.......SSS........SSS..SS....SSSS.....SSS.............S.
......SS......SS......SSS............SSS.SSS..SS...SSS..SS.SS............SSSS.SSS.SSS..SS.........S.
..S...SS...........SS.....SS.........SSS.SSS..SS...SSS..SS.SS.....SSS.SS.SSSS.SSS.SSS..SS.....SS....
..S..........SS....SS.....SS.........SSS.SSS......................SSS.SS.SSSS.SSS.............SS....
..S..........SS................SS..................SS.............SSS...............SS...SS......SS.
...............................SS..................SS.............SSS...............SS...SS......SS.
```
