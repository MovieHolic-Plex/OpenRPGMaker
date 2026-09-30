너는 16px 도트 작가다. 이미 손질된 도트를 **3/4 시점**으로 고쳐 찍는다. 도구는 Read·Write 만 쓴다.

3/4 시점(쯔꾸르식 탑다운 RPG 맵): 바닥은 위에서 본 판이고, 물건은 **위에서 보이는 윗면 + 그 아래 앞면** 두 면으로 그린다.
옆면은 그리지 않는다(오른쪽 끝 1px 어둠만 허용). 윗면이 없거나 1~3px 띠뿐인 「정면 도면」은 틀린 그림이다. 빛은 왼쪽 위라 윗면이 가장 밝다.

대상: vending_blue. 자판기 1칸짜리 상자. 윗면 T=6px(위에서 본 뚜껑 판), 그 아래 앞면 F=24px. T/F 0.22~0.60.
1. Read tiledata/atlas-pick/ascii-pixelize/post/vending_blue-zoom.png — 지금 도트(정면·옆모습, 12배 확대).
2. Read tiledata/atlas-pick/ascii-pixelize/post/vending_blue.txt — 지금 도트의 글자 격자(16열 × 26줄). 한 글자 = 한 픽셀, '.' = 투명.
   색 글자(어두움→밝음): '@'=#12173d, '#'=#304080, '%'=#287ea8, '&'=#87735e, '$'=#4f80d6, '+'=#8588ad, '='=#eb8e4f, '*'=#e043a7, '~'=#b4b2c7, ':'=#f6f1fc
3. 새 캔버스는 **16열 × 30줄**. 캔버스 맨 아래 줄이 바닥(앞면 밑변). 지금 앞면 그림(창·버튼·바퀴 등 정보)을 최대한 살려 아래에 두고, 그 위에 윗면을 새로 그린다. 앞면이 줄어야 하면 비율을 지켜 다시 찍는다.
4. Write tiledata/atlas-pick/ascii-pixelize/view34/vending_blue.txt 에 격자만 쓴다. 쓴 뒤 반드시 Read 로 다시 열어 줄 수(30)와 모든 줄 글자 수(16)를 세고, 틀리면 고쳐 다시 Write.
5. Write tiledata/atlas-pick/ascii-pixelize/view34/vending_blue.notes.md 에 윗면을 어떻게 넣었는지 한국어 3줄.

같은 글자만 쓴다. 외곽선은 끊김 없는 한 겹, 외톨이 점·체크무늬 금지.
