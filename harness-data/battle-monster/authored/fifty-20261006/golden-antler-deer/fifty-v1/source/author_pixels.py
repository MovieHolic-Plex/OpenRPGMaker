"""Literal coordinate-row authoring only. No geometry, frame transforms or fill.
Each table is independently chosen ASCII clusters on a transparent native canvas.
The resulting .pxgrid files contain all 64 literal rows and are the art originals.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
PALETTE={
 'K':'#302326','O':'#161923','D':'#604032','B':'#835038',
 'b':'#AD6942','t':'#CD8857','h':'#E8B27A','s':'#97866E',
 'c':'#D4C3A0','w':'#F4E7C8','g':'#956425','G':'#D9A43A',
 'Y':'#FFE28B','E':'#FFF4CB','p':'#7E9E58','P':'#CAE384'
}
FRAMES={}
PATCHES={}
def frame(name, text):
    FRAMES[name]=text

def write_sources():
    (ROOT/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n')
    for name, table in FRAMES.items():
        grid=[list('.'*64) for _ in range(64)]
        for line in table.strip().splitlines():
            y,x,run=line.split()
            y,x=int(y),int(x)
            if x<1 or x+len(run)>63 or not 1<=y<=60:
                raise ValueError((name,y,x,run))
            grid[y][x:x+len(run)]=run
        for y,x,run in PATCHES.get(name,[]):
            grid[y][x:x+len(run)]=run
        folder=ROOT/('poses' if name in ('idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead') else 'actions')
        folder.mkdir(exist_ok=True)
        (folder/(name+'.pxgrid')).write_text('\n'.join(''.join(row) for row in grid)+'\n')

frame('idle_a', '''
4 43 gY
5 43 gYG
6 34 gG.......gYG
7 34 gYG......gYG
8 34 gYG......gYG.....YG
9 34 gYG......gYG....gYG
10 30 G...gYG......gYG...gYG
11 30 YG..gYG......gYG..gYG
12 31 YG.gYG......gYG.gYG
13 32 YGgYG..YG..gYGGYG
14 33 GYYG..gYG.gYYYGg
15 34 gYG..gYG.gYGGg
16 35 gYG.gYG.gYGg
17 36 gYGGYG..gYG
18 37 gYYGg...gYG
19 38 gYG....gYGGg
20 35 KK..gG....gYYGg
21 35 KhtK.gG...gYG.KK
22 36 KhttK.gG..gYGKhtK
23 37 KhtttKKggggGKhtbK
24 38 KtttbKtttttttttBK
25 39 KtbKthhhttttttttBK
26 40 KbKthhhttttOhttbbK
27 40 KbtthhttttttbbbbbK
28 40 KbtthtttbbbbbccccbKK
29 39 KbttttbbbbbccwwccbbOK
30 38 KbttttbbbccwwwwccssK
31 37 KbttttbbccwwwwwcsKK
32 15 KKKKKKKKKKKK..........KbtttbbccwwwwcsK
33 7 K.....KhttttttttttttKKKKKKbtttbbccwwwcsK
34 6 KcK..KhttttttttttttttttthtttttbbccwwcsK
35 7 KwcKKhtthhhhhhttttttttttttttttbbccwwcsK
36 8 KccKhtthhhhhhhtttttttttttttttbbbccwwcsK
37 9 KcKhtthhhhhhhttttttttttttttttbbbccwwcsK
38 10 KhttthhhhhtttttttttttttttttbbbbccwwcsK
39 10 KtttttttttttttttttttttttttbbbbbccwcsK
40 10 KttttttttttttttttttttttttbbbbbbccwcsK
41 11 KttttttttttttttttttttttbbbbbbbccwcsK
42 11 KttttttbbbbbbbbbbbbbbbbbbbbbccwwcsK
43 12 KtttbbbbbbbbbbccccccccccccwwwwcsK
44 12 KttbbbbbbbbccwwwwwwwwwwwcccbbBK
45 13 KtbBBBBbbccwwwwwwwwwccssBBbbBK
46 13 KtbBDDBbbKssccccccssKDDKbbBK
47 13 KtbBDKDbBK.KKKKKKK..KDKbbBK
48 14 KtbBK.DBBK..........KDKbbK
49 15 KtbBK..DBK..........KDKtbK
50 16 KtbK...DBK..........KDKtbK
51 16 KtbK...DBK..........KDKtbK
52 16 KtbK...DBK..........KDKtbK
53 16 KtbK...DBK..........KDKtbK
54 16 KtbK..DBBK..........KDKtbK
55 16 KtbK..DOOK..........OOKtbK
56 16 KtbK..OOOK..........OOKtbK
57 16 KtbK..KKKK..........KKKtbK
58 16 KtbK..................KtbK
59 15 KOOOK..................KOOK
60 15 OOOOK..................OOOK
''')

frame('idle_b', '''
4 43 gY
5 43 gYG
6 34 gG.......gYG
7 34 gYG......gYG
8 34 gYG......gYG.....YG
9 34 gYG......gYG....gYG
10 30 G...gYG......gYG...gYG
11 30 YG..gYG......gYG..gYG
12 31 YG.gYG......gYG.gYG
13 32 YGgYG..YG..gYGGYG
14 33 GYYG..gYG.gYYYGg
15 34 gYG..gYG.gYGGg
16 35 gYG.gYG.gYGg
17 36 gYGGYG..gYG
18 37 gYYGg...gYG
19 38 gYG....gYGGg
20 39 gG.....gYYGg
21 35 KKK..gG...gYG
22 35 KhtbK.gG..gYG.KKK
23 36 KhttbKKggggGKhttK
24 37 KttttKtttttttttBK
25 38 KttbKthhhtttttttBK
26 39 KbbKthhhtttttttttBK
27 40 KbtthhhttttOhtttbbK
28 40 KbtthtttttttbbbbbbK
29 39 KbtttttbbbbccwwccbbOK
30 38 KbttttbbbbccwwwwccssK
31 37 KbttttbbbccwwwwwcssK
32 15 KKKKKKKKKKKK..........KbtttbbccwwwwcsKK
33 13 KhttttttttttttKKKKKKbtttbbccwwwcsK
34 12 KhttttttttttttttttthtttttbbccwwcsK
35 6 KK...KhtthhhhhhttttttttttttttbbccwwcsK
36 6 KwcKKhtthhhhhhhttttttttttttttbbbccwwcsK
37 7 KcccKthhhhhhhttttttttttttttttbbbccwwcsK
38 9 KchttthhhhhtttttttttttttttttbbbbccwwcsK
39 10 KtttttttttttttttttttttttttbbbbbccwwcsK
40 10 KttttttttttttttttttttttttbbbbbbccwwcsK
41 11 KttttttttttttttttttttttbbbbbbbccwwcsK
42 11 KttttttbbbbbbbbbbbbbbbbbbbbbccwwwcsK
43 12 KtttbbbbbbbbbbccccccccccccwwwwccsK
44 12 KttbbbbbbbbccwwwwwwwwwwwcccbbBK
45 13 KtbBBBBbbccwwwwwwwwwccssBBbbBK
46 13 KtbBDDBbbKssccccccssKDDKbbBK
47 13 KtbBDKDbBK.KKKKKKK..KDKbbBK
48 14 KtbBK.DBBK..........KDKbbK
49 15 KtbBK..DBK..........KDKtbK
50 16 KtbK...DBK..........KDKtbK
51 16 KtbK...DBK..........KDKtbK
52 16 KtbK...DBK..........KDKtbK
53 16 KtbK...DBK..........KDKtbK
54 16 KtbK..DBBK..........KDKtbK
55 16 KtbK..DOOK..........OOKtbK
56 16 KtbK..OOOK..........OOKtbK
57 16 KtbK..KKKK..........KKKtbK
58 16 KtbK..................KtbK
59 15 KOOOK..................KOOK
60 15 OOOOK..................OOOK
''')
frame('idle_c', '''
4 43 gY
5 43 gYG
6 34 gG.......gYG
7 34 gYG......gYG
8 34 gYG......gYG.....YG
9 34 gYG......gYG....gYG
10 30 G...gYG......gYG...gYG
11 30 YG..gYG......gYG..gYG
12 31 YG.gYG......gYG.gYG
13 32 YGgYG..YG..gYGGYG
14 33 GYYG..gYG.gYYYGg
15 34 gYG..gYG.gYGGg
16 35 gYG.gYG.gYGg
17 36 gYGGYG..gYG
18 37 gYYGg...gYG
19 36 KK.gYG....gYGGg
20 35 KhtK.gG....gYYGg
21 36 KhttK.gG...gYG.KK
22 37 KhtttKKgG.gYGKhtK
23 38 KtttbKttggggGttBK
24 39 KtbKthhhttttttttBK
25 40 KbKthhhttttOhttbbK
26 41 KbtthhttttttbbbbbK
27 40 KbtthttttbbbbbcccbKK
28 40 KbtttttbbbbccwwccbbOK
29 39 KbttttbbbbccwwwwccssK
30 38 KbttttbbbccwwwwwcsKK
31 37 KbttttbbccwwwwwcsK
32 15 KKKKKKKKKKKK..........KbtttbbccwwwwcsK
33 7 K.....KhttttttttttttKKKKKKbtttbbccwwwcsK
34 6 KcK..KhttttttttttttttttthtttttbbccwwcsK
35 7 KwcKKhtthhhhhhttttttttttttttttbbccwwcsK
36 8 KccKhtthhhhhhhtttttttttttttttbbbccwwcsK
37 9 KcKhtthhhhhhhttttttttttttttttbbbccwwcsK
38 10 KhttthhhhhtttttttttttttttttbbbbccwwcsK
39 10 KtttttttttttttttttttttttttbbbbbccwcsK
40 10 KttttttttttttttttttttttttbbbbbbccwcsK
41 11 KttttttttttttttttttttttbbbbbbbccwcsK
42 11 KttttttbbbbbbbbbbbbbbbbbbbbbccwwcsK
43 12 KtttbbbbbbbbbbccccccccccccwwwccsK
44 12 KttbbbbbbbbccwwwwwwwwwwwcccbbBK
45 13 KtbBBBBbbccwwwwwwwwwccssBBbbBK
46 13 KtbBDDBbbKssccccccssKDDKbbBK
47 13 KtbBDKDbBK.KKKKKKK..KDKbbBK
48 14 KtbBK.DBBK..........KDKbbBK
49 15 KtbBK..DBK..........KDKtbK
50 16 KtbK...DBK..........KDKtbK
51 16 KtbK...DBK..........KDKtbK
52 16 KtbK...DBK..........KDKtbK
53 16 KtbK...DBK..........KDKtbK
54 16 KtbK..DBBK..........KDKtbK
55 16 KtbK..DOOK..........OOKtbK
56 16 KtbK..OOOK..........OOKtbK
57 16 KtbK..KKKK..........KKKtbK
58 16 KtbK..................KtbK
59 15 KOOOK..................KOOK
60 15 OOOOK..................OOOK
''')
frame('windup', '''
10 46 YG
11 45 gYG
12 36 G.......gYG
13 36 YG.....gYG.......YG
14 36 gYG...gYG.......gYG
15 37 gYG..gYG.......gYG
16 32 YG...gYGgYG......gYG
17 33 YG..gYYYYG......gYG
18 34 YG.gYYGg.......gYG
19 35 GYYYGG..YG....gYG
20 36 gYYGg..gYG..gYGG
21 37 gYGg..gYG.gYYGg
22 38 gYG..gYGGYYGg
23 39 gYG.gYYYGGg
24 40 gYGGYGGg
25 38 KK.gYYGg
26 38 KhtK.gYGGg
27 39 KhttK.gYGG.KK
28 40 KhtttKKggGKhtK
29 41 KtttKttttttttBK
30 42 KbbKthhhttttttBK
31 42 KbtthhhttOhtttbbK
32 41 KbttthtttttbbbbbK
33 40 KbtttttbbbbccccbbKK
34 39 KbtttttbbbccwwccbbOK
35 38 KbttttbbbccwwwwccsK
36 13 KKKKKKKKKKKKK..........KbtttbbccwwwcssK
37 11 KhtttttttttttttKKKKKKKKbtttbbccwwcsK
38 5 K.....KhtthhhhhhtttttttthttttbbccwwcsK
39 5 KcK..KhtthhhhhhtttttttttttttbbccwwcsK
40 6 KwcKKhtthhhhhttttttttttttttbbbccwwcsK
41 7 KccKttttttttttttttttttttttbbbbccwwcsK
42 8 KcKttttttttttttttttttttttbbbbbccwwcsK
43 9 KtttttttttttttttttttttttbbbbbbccwcsK
44 9 KttttttttttttttttttttttbbbbbbbccwcsK
45 10 KtttttbbbbbbbbbbbbbbbbbbbbbbccwcsK
46 10 KtttbbbbbbbbbbbbccccccccccwwwwcsK
47 10 KttbbbbbbbbbbbccwwwwwwwwwwcccbbBK
48 11 KtbBBBBbbbbccwwwwwwwwwccssBBbbBK
49 11 KtbBDDDbbbKssccccccssKDDKbbBK
50 11 KtbBDDKbBK.KKKKKKK..KDDKbbK
51 10 KtbBK..DbBK.........KDD.KtbK
52 10 KtbBK...DbBK........KDDKtbK
53 11 KtbBK....DbBK.......KDKtbK
54 12 KtbBK....DBBK.......OOKtbK
55 12 KtbBK....DOOK.......OOKtbK
56 12 KtbBK....OOOK.......KKKtbK
57 12 KtbBK....KKKK.........KtbK
58 12 KtbK..................KtbK
59 11 KOOOK..................KOOK
60 11 OOOOK..................OOOK
''')
frame('move', '''
9 48 YG
10 47 gYG
11 39 G......gYG
12 39 YG....gYG......YG
13 39 gYG..gYG......gYG
14 40 gYG.gYG......gYG
15 35 YG...gYYYG......gYG
16 36 YG.gYYYGG.....gYG
17 37 YGgYYGg.....gYGG
18 38 GYYYGG.YG..gYYGg
19 39 gYYGg.gYGgYYGg
20 40 gYG..gYYYYGg
21 41 gYG.gYYGGg
22 42 gYGGYYGg
23 40 KK.gYYGg
24 39 KhtK.gYGGg..KK
25 40 KhttK.gYGG.KhtK
26 41 KhtttKKggGKhttK
27 42 KtttKttttttttBK
28 43 KbbKthhhttOtttbBK
29 44 KbtthhhtttttbbbbbK
30 12 KKKKKKKKKKKK.................KbtthttbbbccccbbKK
31 10 KhtttttttttttKKKKKK.........KbttttbbbccwwccbbOK
32 9 KhtthhhhhhtttttttttKKKKKKKKKbttttbbbccwwwccsK
33 5 KK.KhtthhhhhhttttttttttttthtttttbbbccwwwwcsK
34 4 KccKhtthhhhhtttttttttttttttttttbbbccwwwwcsK
35 5 KwwctttthhttttttttttttttttttttbbbbccwwwcsK
36 6 KccttttttttttttttttttttttttttbbbbccwwwcsK
37 7 KttttttttttttttttttttttttttttbbbbccwwcsK
38 8 KtttttttttttttttttttttttttttbbbbccwwcsK
39 8 KttttbbbbbbbbbbbbbbbbbbbbbbbbbccwwcsK
40 8 KtttbbbbbbbbbbbccccccccccccccwwwwcsK
41 9 KttbbbbbbbbbbccwwwwwwwwwwwwcccbbBK
42 9 KtbBBBBbbbccwwwwwwwwwwwccssBBbbBK
43 9 KtbBDDBbbKsscccccccssKKDbBBKbbBK
44 8 KtbBDKDbBK.KKKKKKKKK...KDBBBKbbBK
45 7 KtbBK.DBbK..............KDBBKtbbK
46 6 KtbBK..DBbK..............KDBKttbK
47 5 KtbBK....DBbK..............KDBKttbK
48 4 KtbBK......DBbK.............KDDKttbK
49 3 KtbBK........DBbK............KDDKttbK
50 3 KtbK..........DBbK............KDDKttbK
51 3 KtbK...........DBbK............KDDKttbK
52 3 KtbK............DOOK............KDDKttbK
53 3 KtbK............OOOK.............KDDKttbK
54 3 KtbK............KKKK..............KOOKttbK
55 3 KtbK..............................OOOKttbK
56 3 KtbK..............................KKKKttbK
57 2 KOOOK.................................KttbK
58 2 OOOOK..................................KOOK
59 41 OOOOK
''')
frame('attack', '''
20 55 YG
21 54 gYG
22 53 gYG.....YG
23 52 gYG.....gYG
24 43 YG......gYG.....gYG
25 44 YG....gYG.....gYG
26 45 YG..gYYG.....gYG
27 46 YGgYYYGG....gYG
28 43 YG.gYYYGG....gYGG
29 44 YGgYYYGG..YGgYYGg
30 45 GYYYGg..gYYYGg
31 43 KK.gYGGg.gYYGg
32 42 KhtK.gYGGYYGg
33 43 KhttKKgYYYGGg
34 13 KKKKKKKKKKKKK...........KhttbKggGGKK
35 11 KhtttttttttttttKKKKKKK...KtttKtttttbK
36 9 KhtthhhhhhtttttttttttttKKKKbbKthhttttbK
37 5 KK.KhtthhhhhhtttttttttttttthttthhhttttOtbK
38 4 KccKhtthhhhhttttttttttttttttttttttttbbbbbbK
39 5 KwwctttthhtttttttttttttttttttttttbbbbcccbbKK
40 6 KcctttttttttttttttttttttttttttttbbbccwwccbbOK
41 7 KtttttttttttttttttttttttttttttbbbbccwwwwccsK
42 8 KttttttttttttttttttttttttttttbbbbccwwwwwcsK
43 8 KtttttttttttttttttttttttttttbbbbbccwwwwcsK
44 8 KtttttbbbbbbbbbbbbbbbbbbbbbbbbbccwwwwcsK
45 9 KtttbbbbbbbbbbbbccccccccccccccwwwwwwcsK
46 9 KttbbbbbbbbbbccwwwwwwwwwwwwwwwwwcccbbBK
47 10 KtbBBBBbbbccwwwwwwwwwwwwwwwwccssBBbbBK
48 10 KtbBDDBbbKssccccccccccccccssKKDDKbbBK
49 9 KtbBDKDbBK.KKKKKKKKKKKKKKK...KDDKbbBK
50 8 KtbBK.DBbK...................KDDKbbBK
51 7 KtbBK..DBbK...................KDDKbbBK
52 6 KtbBK...DBbK..................KDDKtbBK
53 5 KtbBK....DBbK................KDDKttbBK
54 4 KtbBK.....DBbK..............KDDKttbBK
55 3 KtbBK......DBbK............KDDKttbBK
56 3 KtbK........DOOK...........KOOKttbK
57 3 KtbK........OOOK...........OOOKtbK
58 3 KtbK........KKKK...........KKKKtbK
59 2 KOOOK..........................KOOK
60 2 OOOOK..........................OOOK
''')
frame('recover', '''
7 44 YG
8 43 gYG
9 35 G......gYG
10 35 YG.....gYG......YG
11 35 gYG....gYG.....gYG
12 36 gYG...gYG.....gYG
13 31 YG...gYG.gYG....gYG
14 32 YG..gYYGGYG...gYG
15 33 YG.gYYYGg....gYGG
16 34 GYYYGG..YG..gYYGg
17 35 gYYGg..gYG.gYYGg
18 36 gYG...gYGGYYGg
19 37 gYG..gYYYGGg
20 38 gYG.gYYGGg
21 36 KK.gYGGYGg
22 35 KhtK.gYGGg
23 36 KhttK.gYGG.KK
24 37 KhtttKKggGKhtK
25 38 KtttKttttttttBK
26 39 KbbKthhhttttttBK
27 40 KbtthhhttOhtttbbK
28 40 KbtthttttttbbbbbK
29 39 KbtttttbbbbccccbbKK
30 38 KbtttttbbbccwwccbbOK
31 37 KbttttbbbccwwwwccsK
32 14 KKKKKKKKKKKK..........KbtttbbccwwwcssK
33 12 KhttttttttttttKKKKKKKKbtttbbccwwcsK
34 7 K...KhtthhhhhhtttttttthttttbbccwwcsK
35 6 KcKKhtthhhhhhttttttttttttttbbccwwcsK
36 7 KwccttthhhhhttttttttttttttbbbccwwcsK
37 8 KccctttttttttttttttttttttbbbbccwwcsK
38 9 KtttttttttttttttttttttttbbbbbccwwcsK
39 10 KttttttttttttttttttttttbbbbbbccwcsK
40 10 KtttttttttttttttttttttbbbbbbbccwcsK
41 11 KtttttbbbbbbbbbbbbbbbbbbbbbbccwcsK
42 11 KtttbbbbbbbbbbbbccccccccccwwwwcsK
43 12 KttbbbbbbbbbbbccwwwwwwwwwwcccbbBK
44 12 KtbBBBBbbbbccwwwwwwwwwccssBBbbBK
45 13 KtbBDDDbbbKssccccccssKDDKbbBK
46 13 KtbBDDKbBK.KKKKKKK..KDDKbbBK
47 13 KtbBK..DbBK.........KDD.KbbK
48 14 KtbBK...DbBK........KDDKtbK
49 15 KtbBK....DbBK.......KDKtbK
50 16 KtbBK....DBBK.......KDKtbK
51 16 KtbBK....DBBK.......KDKtbK
52 16 KtbBK....DBBK.......KDKtbK
53 16 KtbBK....DBBK.......KDKtbK
54 16 KtbBK....DBBK.......KDKtbK
55 16 KtbBK....DOOK.......OOKtbK
56 16 KtbBK....OOOK.......OOKtbK
57 16 KtbBK....KKKK.......KKKtbK
58 16 KtbK..................KtbK
59 15 KOOOK..................KOOK
60 15 OOOOK..................OOOK
''')
frame('hit', '''
5 32 YG
6 32 gYG
7 23 G.......gYG
8 23 YG......gYG
9 23 gYG......gYG.....YG
10 24 gYG......gYG....gYG
11 20 YG..gYG......gYG...gYG
12 21 YG..gYG......gYG..gYG
13 22 YG.gYG......gYG.gYG
14 23 YGgYG..YG..gYGGYG
15 24 GYYG..gYG.gYYYGg
16 25 gYG..gYG.gYGGg
17 26 gYG.gYG.gYGg
18 27 gYGGYG..gYG
19 28 gYYGg...gYG
20 29 gYG....gYGGg
21 26 KK..gG....gYYGg
22 26 KhtK.gG...gYG.KK
23 27 KhttK.gG..gYGKhtK
24 28 KhtttKKggggGKhtbK
25 29 KtttbKtttttttttBK
26 30 KtbKthhhttttttttBK
27 31 KbKthhhttttKOttbbK
28 31 KbtthhttttttbbbbbK
29 30 KbtthtttbbbbbccccbKK
30 29 KbttttbbbbbccwwccbbOK
31 28 KbttttbbbccwwwwccssK
32 27 KbttttbbccwwwwwcsKK
33 15 KKKKKKKKKKKKbtttbbccwwwwcsK
34 13 KhtttttttthttttbbccwwwcsK
35 7 KK..KhtttttttttttttttbbccwwcsK
36 7 KwcKKhtthhhhhhttttttttbbbccwwcsK
37 8 KccKhtthhhhhhhttttttttbbbccwwcsK
38 9 KcKhtthhhhhhhtttttttttbbbccwwcsK
39 10 KhttthhhhhtttttttttttbbbbccwwcsK
40 10 KtttttttttttttttttttbbbbbccwcsK
41 10 KttttttttttttttttttbbbbbbccwcsK
42 11 KttttttttttttttttbbbbbbbccwcsK
43 11 KttttttbbbbbbbbbbbbbbbccwwcsK
44 12 KtttbbbbbbbbccccccccccwwwwcsK
45 12 KttbbbbbbbccwwwwwwwwwcccbbBK
46 13 KtbBBBBbccwwwwwwwwccssBBbbBK
47 13 KtbBDDBbKsscccccssKDDKbbBK
48 13 KtbBDKDbK.KKKKKK..KDDKbbBK
49 12 KtbBK.DbBK........KDDKbbBK
50 12 KtbBK..DbBK........KDDKtbBK
51 13 KtbBK..DbBK.........KDDKtbBK
52 14 KtbBK..DbBK..........KDDKtbBK
53 15 KtbBK..DbBK...........KDDKtbBK
54 16 KtbK...DBBK............KDDKtbBK
55 16 KtbK...DOOK.............KOOKtbBK
56 16 KtbK...OOOK.............OOOKtbBK
57 16 KtbK...KKKK.............KKKKtbBK
58 16 KtbK........................KtbK
59 15 KOOOK........................KOOK
60 15 OOOOK........................OOOK
''')
frame('dead', '''
30 36 YG
31 36 gYG
32 29 YG.....gYG
33 30 YG....gYG.....YG
34 31 YG...gYG....gYG
35 32 YG.gYYG....gYG
36 33 YGgYYYGG..gYG
37 34 GYYYGG..gYGG
38 32 YG.gYYGg.gYYGg
39 33 YGgYGGg.gYYGg
40 34 GYYGg.gYYGg
41 35 gYGGgYYGg
42 36 gYYYGg
43 37 gYGGg
44 33 KKK..gYGg
45 10 KK....................KhttK.gYGG.KK
46 9 KwcK...KKKKKKKKKKKKK...KhtttKKggGKhtK
47 10 KccKKKKhtthhhhhhhttttKKKKtttttttttbK
48 11 KccttthhhhhhhhtttttttttttthhhttOOttbK
49 11 KttttthhhhhhhttttttttttttttttttttbbbK
50 11 KtttttttttttttttttttttttttttbbbbcccbbKK
51 11 KtttttttttttttttttttttttttbbbbccwwccbbOK
52 12 KtttttttttttttttttttttttbbbbccwwwwccssK
53 12 KttttttbbbbbbbbbbbbbbbbbbbbccwwwwwcsK
54 13 KtttbbbbbbbbbbbbcccccccccccwwwwwcssK
55 13 KttbbbbbbbbbbccwwwwwwwwwwwwwwccssKK
56 13 KtbBBBBbbbbccwwwwwwwwwwwwwwccsBBBK
57 12 KtbBDDDbbbbKssccccccccccccsssDBBBBKK
58 12 KtbBDDDDBbbbKKKKKKKKKKKKKDDDBbbbbOOK
59 12 KtbBDDDDOOOK............KDDbOOOKOOK
60 13 KKKKKKKOOOOK............KKKOOOOKKKK
''')

frame('skill_a', '''
2 44 Y
3 43 YEY
4 42 GYEEYG
5 43 GYEG
6 34 gG.......gYG
7 34 gYG......gYG
8 34 gYG......gYG.....YE
9 34 gYG......gYG....gEYG
10 30 G...gYG......gYG...gYEG
11 30 YG..gYG......gYG..gYG
12 31 YG.gYG......gYG.gYG
13 32 YGgYG..YG..gYGGYG
14 33 GYYG..gYG.gYYYGg
15 34 gYG..gYG.gYGGg
16 35 gYG.gYG.gYGg
17 36 gYGGYG..gYG
18 37 gYYGg...gYG
19 36 KK.gYG....gYGGg
20 35 KhtK.gG....gYYGg
21 36 KhttK.gG...gYG.KK
22 37 KhtttKKgG.gYGKhtK
23 38 KtttbKttggggGttBK
24 39 KtbKthhhttttttttBK
25 40 KbKthhhttttOhttbbK
26 40 KbtthhhtttttbbbbbK
27 40 KbtthttttbbbbbcccbKK
28 40 KbtttttbbbbccwwccbbOK
29 39 KbttttbbbbccwwwwccssK
30 38 KbttttbbbccwwwwwcsKK
31 37 KbttttbbccwwwwwcsK
32 15 KKKKKKKKKKKK..........KbtttbbccwwwwcsK
33 13 KhttttttttttttKKKKKKbtttbbccwwwcsK
34 7 K...KhtthhhhhhtttttttthtttttbbccwwcsK
35 6 KcKKhtthhhhhhhttttttttttttttbbccwwcsK
36 7 KwcctthhhhhhtttttttttttttttbbbccwwcsK
37 8 KccctthhhhhttttttttttttttttbbbccwwcsK
38 9 KtttthhhhtttttttttttttttttbbbbccwwcsK
39 10 KtttttttttttttttttttttttttbbbbbccwwcsK
40 10 KttttttttttttttttttttttttbbbbbbccwwcsK
41 11 KttttttttttttttttttttttbbbbbbbccwwcsK
42 11 KttttttbbbbbbbbbbbbbbbbbbbbbccwwwcsK
43 12 KtttbbbbbbbbbbccccccccccccwwwwccsK
44 12 KttbbbbbbbbccwwwwwwwwwwwcccbbBK
45 13 KtbBBBBbbccwwwwwwwwwccssBBbbBK
46 13 KtbBDDBbbKssccccccssKDDKbbBK
47 13 KtbBDKDbBK.KKKKKKK..KDKbbBK
48 14 KtbBK.DBBK..........KDKbbK
49 15 KtbBK..DBK..........KDKtbK
50 16 KtbK...DBK..........KDKtbK
51 16 KtbK...DBK..........KDKtbK
52 16 KtbK...DBK..........KDKtbK
53 16 KtbK...DBK..........KDKtbK
54 16 KtbK..DBBK..........KDKtbK
55 16 KtbK..DOOK..........OOKtbK
56 16 KtbK..OOOK..........OOKtbK
57 16 KtbK..KKKK..........KKKtbK
58 16 KtbK..................KtbK
59 15 KOOOK..................KOOK
60 15 OOOOK..................OOOK
''')
frame('skill_b', '''
8 59 Y
9 57 YEYG
10 55 YEYYG
11 55 YEEG
12 55 YEYG...Y
13 55 GEEYYG.Y
14 53 GYEEEEYEYG
15 50 GYYEEEYYYG
16 49 GYEEYGg
17 49 YEEYG
18 46 GYYEEYG
19 43 YGGYEEYG
20 43 gYEEYGg....GY
21 43 gYEYG.....YEYG
22 34 YG......gYEYG.....YEEYG
23 35 YG....gYEYG.......GYEEYG
24 36 YG..gYYG............GYEEYG
25 37 YGgYYYGG......GYYG..GYEEYG
26 34 YG.gYYYGG.....GYEEYG.GYEEYG
27 35 YGgYYYGG......gGYEEEEEEEYG
28 36 GYYYGg....GYYYYEEEEEEYYG
29 37 gYYGGg..gGYYYYYGgg.GYEYG
30 38 gYYGGg.gYYYGg.....gGYEEYG
31 39 gYYYYGYYYGg......gGYEEYG
32 36 KK..gYYYGg.............GYYG
33 35 KhtK..gYGg.................G
34 36 KhttKKggGK.KKK
35 13 KKKKKKKKKKKKK..........KhttbKtttKhtK
36 11 KhtttttttttttttKKKKKKKKttttthttttBK
37 10 KhtthhhhhhtttttttttttttthttthhttttbBK
38 6 K..KhtthhhhhhhttttttttttttttttttKOtbK
39 5 KcKKhtthhhhhttttttttttttttttttttbbbbbbK
40 6 KwcctttthhttttttttttttttttttttbbcccbbKK
41 7 KcctttttttttttttttttttttttttbbbccwwccbbOK
42 8 KttttttttttttttttttttttttttbbbccwwwwccsK
43 9 KtttttttttttttttttttttttttbbbbccwwwwcsK
44 9 KtttttbbbbbbbbbbbbbbbbbbbbbbbbccwwwcsK
45 10 KtttbbbbbbbbbbbbccccccccccccwwwwwcsK
46 10 KttbbbbbbbbbbccwwwwwwwwwwwwwwcccbbBK
47 11 KtbBBBBbbbccwwwwwwwwwwwwwwccssBBbbBK
48 11 KtbBDDBbbKssccccccccccccssKDDKbbBK
49 11 KtbBDKDbBK.KKKKKKKKKKKK..KDDKbbBK
50 10 KtbBK.DBBK...............KDDKtbBK
51 10 KtbBK..DBK................KDDKtbBK
52 11 KtbBK..DBK.................KDDKtbBK
53 12 KtbBK..DBK..................KDDKtbBK
54 12 KtbBK..DBBK..................KDDKtbBK
55 12 KtbBK..DOOK...................KOOKtbBK
56 12 KtbBK..OOOK...................OOOKtbBK
57 12 KtbBK..KKKK...................KKKKtbBK
58 12 KtbK..............................KtbK
59 11 KOOOK..............................KOOK
60 11 OOOOK..............................OOOK
''')
frame('skill_c', '''
4 43 gY
5 43 gYG.............Y
6 34 gG.......gYG.............EG
7 34 gYG......gYG.............Y
8 34 gYG......gYG.....YG
9 34 gYG......gYG....gYG
10 30 G...gYG......gYG...gYG
11 30 YG..gYG......gYG..gYG........YG
12 31 YG.gYG......gYG.gYG.........YE
13 32 YGgYG..YG..gYGGYG...........G
14 33 GYYG..gYG.gYYYGg
15 34 gYG..gYG.gYGGg
16 35 gYG.gYG.gYGg...........G
17 36 gYGGYG..gYG............YE
18 37 gYYGg...gYG.............G
19 38 gYG....gYGGg
20 35 KK..gG....gYYGg...........Y
21 35 KhtK.gG...gYG.KK.........G
22 36 KhttK.gG..gYGKhtK
23 37 KhtttKKggggGKhtbK
24 38 KtttbKtttttttttBK
25 39 KtbKthhhttttttttBK
26 40 KbKthhhttttOhttbbK
27 40 KbtthhttttttbbbbbK
28 40 KbtthtttbbbbbccccbKK
29 39 KbttttbbbbbccwwccbbOK
30 38 KbttttbbbccwwwwccssK
31 37 KbttttbbccwwwwwcsKK
32 15 KKKKKKKKKKKK..........KbtttbbccwwwwcsK
33 13 KhttttttttttttKKKKKKbtttbbccwwwcsK
34 8 K..KhtthhhhhhtttttttthtttttbbccwwcsK
35 7 KcKKhtthhhhhhhttttttttttttttbbccwwcsK
36 8 KwcctthhhhhhtttttttttttttttbbbccwwcsK
37 9 KccctthhhhhttttttttttttttttbbbccwwcsK
38 10 KtttthhhhtttttttttttttttttbbbbccwwcsK
39 10 KtttttttttttttttttttttttttbbbbbccwcsK
40 10 KttttttttttttttttttttttttbbbbbbccwcsK
41 11 KttttttttttttttttttttttbbbbbbbccwcsK
42 11 KttttttbbbbbbbbbbbbbbbbbbbbbccwwcsK
43 12 KtttbbbbbbbbbbccccccccccccwwwwcsK
44 12 KttbbbbbbbbccwwwwwwwwwwwcccbbBK
45 13 KtbBBBBbbccwwwwwwwwwccssBBbbBK
46 13 KtbBDDBbbKssccccccssKDDKbbBK
47 13 KtbBDKDbBK.KKKKKKK..KDKbbBK
48 14 KtbBK.DBBK..........KDKbbBK
49 15 KtbBK..DBK..........KDKtbK
50 16 KtbK...DBK..........KDKtbK
51 16 KtbK...DBK..........KDKtbK
52 16 KtbK...DBK..........KDKtbK
53 16 KtbK...DBK..........KDKtbK
54 16 KtbK..DBBK..........KDKtbK
55 16 KtbK..DOOK..........OOKtbK
56 16 KtbK..OOOK..........OOKtbK
57 16 KtbK..KKKK..........KKKtbK
58 16 KtbK..................KtbK
59 15 KOOOK..................KOOK
60 15 OOOOK..................OOOK
''')
frame('poison_a', '''
10 40 YG
11 39 gYG
12 30 G......gYG
13 30 YG.....gYG
14 30 gYG....gYG.....YG
15 31 gYG...gYG.....gYG
16 27 YG..gYG.gYG....gYG
17 28 YG..gYYGGYG...gYG
18 29 YG.gYYYGg....gYGG
19 30 GYYYGG..YG..gYYGg
20 31 gYYGg..gYG.gYYGg
21 32 gYG...gYGGYYGg
22 33 gYG..gYYYGGg
23 34 gYG.gYYGGg
24 35 gYGGYYGg
25 36 gYYGGg
26 37 gYGGg
27 34 KKK.gYGg
28 33 KhttK.gYGGg
29 34 KhtttKKggG.KK
30 35 KtttbKttttKhtK
31 36 KtbKthhhtttttBK
32 15 KKKKKKKKKKKK.........KbbthhhttKOtbbK
33 13 KhttttttttttttKKKKKKKKbtttttttbbbbK
34 12 KhtthhhhhhtttttttttttthttttbbbbccbKK
35 7 KK.KhtthhhhhhtttttttttttttbbbccwccbbOK
36 7 KccKhttthhhhtttttttttttttbbbccwwccssK
37 8 KwcctttttttttttttttttttbbbbccwwwcsK
38 9 KccttttttttttttttttttttbbbbccwwwcsK
39 10 KtttttttttttttttttttttbbbbbccwwcsK
40 10 KtttttttttttttttttttttbbbbbccwwcsK
41 11 KtttttbbbbbbbbbbbbbbbbbbbbccwwcsK
42 11 KtttbbbbbbbbbbbbcccccccccwwwwcsK
43 12 KttbbbbbbbbbbccwwwwwwwwwwcccbbBK
44 12 KtbBBBBbbbccwwwwwwwwwccssBBbbBK........pPp
45 13 KtbBDDBbbKsscccccccssKDDKbbBK........pP.Pp
46 13 KtbBDKDbBK.KKKKKKK..KDDKbbBK........ppPpp
47 13 KtbBK.DBBK..........KDDKbbBK.........ppp
48 14 KtbBK..DBK...........KDDKbbBK
49 15 KtbBK..DBK............KDDKbbBK
50 16 KtbK...DBK.............KDDKtbBK
51 16 KtbK...DBK..............KDDKtbBK.......pP
52 16 KtbK...DBK...............KDDKtbBK......pp
53 16 KtbK...DBK................KOOKtbBK
54 16 KtbK..DBBK................OOOKtbBK
55 16 KtbK..DOOK................KKKKtbBK
56 16 KtbK..OOOK....................KtbK
57 16 KtbK..KKKK....................KtbK
58 16 KtbK..........................KtbK
59 15 KOOOK..........................KOOK
60 15 OOOOK..........................OOOK
''')
frame('poison_b', '''
10 41 YG
11 40 gYG
12 30 G.......gYG
13 30 YG......gYG
14 31 gYG.....gYG.....YG
15 32 gYG....gYG.....gYG
16 27 YG...gYG.gYG....gYG
17 28 YG...gYYGGYG...gYG
18 29 YG..gYYYGg....gYGG
19 30 YGgYYYGG.YG..gYYGg
20 31 gYYYGg.gYG.gYYGg
21 32 gYGG..gYGGYYGg
22 33 gYG..gYYYGGg
23 34 gYG.gYYGGg
24 35 gYGGYYGg
25 36 gYYGGg
26 37 gYGGg
27 38 gYGg
28 34 KKK..gYGGg
29 34 KhttKKggG.KK
30 35 KhtttKtttKhtK
31 36 KttbKthhhttttBK
32 15 KKKKKKKKKKKK.........KbbthhhttttbbK
33 13 KhttttttttttttKKKKKKKKbttthhttKOtbK
34 12 KhtthhhhhhtttttttttttthtttttttbbbbK
35 7 K..KhtthhhhhhttttttttttttttbbbccbKK
36 6 KcKKhttthhhhtttttttttttttbbbccwccbbOK
37 7 KwccttttttttttttttttttttbbbccwwccssK.........pP
38 8 KcctttttttttttttttttttttbbbbccwwwcsK........pp
39 9 KttttttttttttttttttttttbbbbbccwwcsK
40 10 KtttttttttttttttttttttbbbbbccwwcsK
41 11 KtttttbbbbbbbbbbbbbbbbbbbbccwwcsK.............pPp
42 11 KtttbbbbbbbbbbbbcccccccccwwwwcsK.............pP.Pp
43 12 KttbbbbbbbbbbccwwwwwwwwwwcccbbBK.............ppPpp
44 12 KtbBBBBbbbccwwwwwwwwwccssBBbbBK...............ppp
45 13 KtbBDDBbbKsscccccccssKDDKbbBK
46 13 KtbBDKDbBK.KKKKKKK..KDDKbbBK
47 13 KtbBK.DBBK..........KDDKbbBK
48 14 KtbBK..DBK.........KDDKbbBK
49 15 KtbBK..DBK........KDDKbbBK
50 16 KtbK...DBK.......KDDKtbBK
51 16 KtbK...DBK......KDDKtbBK.................pPp
52 16 KtbK...DBK......KOOKtbK..................ppp
53 16 KtbK...DBK......OOOKtbK
54 16 KtbK..DBBK......KKKKtbK
55 16 KtbK..DOOK.........KtbK
56 16 KtbK..OOOK.........KtbK
57 16 KtbK..KKKK.........KtbK
58 16 KtbK...............KtbK
59 15 KOOOK...............KOOK
60 15 OOOOK...............OOOK
''')

frame('stun_a', '''
13 39 YG
14 38 gYG
15 29 G......gYG........Y
16 29 YG.....gYG.......GYG
17 29 gYG....gYG.....GYYEYYG
18 30 gYG...gYG.......GYG
19 26 YG..gYG.gYG........Y
20 27 YG..gYYGGYG...YG
21 28 YG.gYYYGg....gYG
22 29 GYYYGG.....gYG
23 30 gYYGg..YG.gYGG
24 31 gYG...gYGGYYGg
25 32 gYG..gYYYGGg...........Y
26 33 gYG.gYYGGg...........GYEYG
27 34 gYGGYYGg..............Y
28 35 gYYGGg
29 36 gYGGg
30 33 KKK.gYGg
31 33 KhttKKgYGG.KK
32 34 KhtttKggGKhtK
33 15 KKKKKKKKKKKK........KttbKttttttBK
34 13 KhttttttttttttKKKKKKKbbthhhhttbbBK
35 12 KhtthhhhhhttttttttttthttthhttOOtbK
36 7 K..KhtthhhhhhtttttttttttttttbbbbbbK
37 6 KcKKhttthhhhtttttttttttttbbbbccccbKK
38 7 KwccttttttttttttttttttttbbbccwwccbbOK
39 8 KcctttttttttttttttttttttbbbccwwwccsK
40 9 KttttttttttttttttttttttbbbbccwwwcsK
41 10 KtttttttttttttttttttttbbbbbccwwcsK
42 10 KtttttbbbbbbbbbbbbbbbbbbbbccwwcsK
43 11 KtttbbbbbbbbbbbbcccccccccwwwwcsK
44 12 KttbbbbbbbbbbccwwwwwwwwwwcccbbBK
45 12 KtbBBBBbbbccwwwwwwwwwccssBBbbBK
46 13 KtbBDDBbbKsscccccccssKDDKbbBK
47 13 KtbBDKDbBK.KKKKKKK..KDDKbbBK
48 13 KtbBK.DBBK..........KDDKbbBK
49 14 KtbBK..DBK..........KDDKbbBK
50 15 KtbBK..DBK...........KDDKtbBK
51 16 KtbK...DBK............KDDKtbBK
52 16 KtbK...DBK............KDDKtbBK
53 16 KtbK...DBK............KDDKtbBK
54 16 KtbK..DBBK............KOOKtbBK
55 16 KtbK..DOOK............OOOKtbBK
56 16 KtbK..OOOK............KKKKtbBK
57 16 KtbK..KKKK................KtbK
58 16 KtbK......................KtbK
59 15 KOOOK......................KOOK
60 15 OOOOK......................OOOK
''')
frame('stun_b', '''
13 39 YG
14 38 gYG
15 29 G......gYG
16 29 YG.....gYG.......Y
17 29 gYG....gYG.....GYEYG
18 30 gYG...gYG.......Y
19 26 YG..gYG.gYG
20 27 YG..gYYGGYG...YG
21 28 YG.gYYYGg....gYG............Y
22 29 GYYYGG.....gYG............GYG
23 30 gYYGg..YG.gYGG.........GYYEYYG
24 31 gYG...gYGGYYGg...........GYG
25 32 gYG..gYYYGGg.............Y
26 33 gYG.gYYGGg
27 34 gYGGYYGg
28 35 gYYGGg
29 36 gYGGg
30 37 gYGg
31 33 KKK..gYGG
32 33 KhttKKggGK.KK
33 15 KKKKKKKKKKKK........KhtttKttKhtK
34 13 KhttttttttttttKKKKKKKttbKthhtttBK
35 12 KhtthhhhhhttttttttttthbthhhhtttbbBK
36 7 K..KhtthhhhhhttttttttttttthhttOOtbK
37 6 KcKKhttthhhhtttttttttttttttttbbbbbbK
38 7 KwcctttttttttttttttttttttbbbbccccbKK
39 8 KccttttttttttttttttttttttbbbccwwccbbOK
40 9 KtttttttttttttttttttttttbbbccwwwccsK
41 10 KtttttttttttttttttttttbbbbbccwwcsK
42 10 KtttttbbbbbbbbbbbbbbbbbbbbccwwcsK
43 11 KtttbbbbbbbbbbbbcccccccccwwwwcsK
44 12 KttbbbbbbbbbbccwwwwwwwwwwcccbbBK
45 12 KtbBBBBbbbccwwwwwwwwwccssBBbbBK
46 13 KtbBDDBbbKsscccccccssKDDKbbBK
47 13 KtbBDKDbBK.KKKKKKK..KDDKbbBK
48 13 KtbBK.DBBK..........KDDKbbBK
49 14 KtbBK..DBK..........KDDKbbBK
50 15 KtbBK..DBK.........KDDKtbBK
51 16 KtbK...DBK........KDDKtbBK
52 16 KtbK...DBK.......KDDKtbBK
53 16 KtbK...DBK.......KDDKtbBK
54 16 KtbK..DBBK.......KOOKtbBK
55 16 KtbK..DOOK.......OOOKtbBK
56 16 KtbK..OOOK.......KKKKtbBK
57 16 KtbK..KKKK...........KtbK
58 16 KtbK.................KtbK
59 15 KOOOK.................KOOK
60 15 OOOOK.................OOOK
''')
frame('sleep_a', '''
16 44 YG
17 43 gYG
18 35 G......gYG
19 35 YG.....gYG
20 35 gYG....gYG.....YG
21 36 gYG...gYG.....gYG
22 32 YG..gYG.gYG....gYG
23 33 YG..gYYGGYG...gYG
24 34 YG.gYYYGg....gYGG
25 35 GYYYGG..YG..gYYGg
26 36 gYYGg..gYG.gYYGg
27 37 gYG...gYGGYYGg
28 38 gYG..gYYYGGg
29 39 gYG.gYYGGg
30 40 gYGGYYGg
31 41 gYYGGg
32 42 gYGGg
33 39 KKK.gYGg
34 38 KhttK.gYGGg
35 39 KhtttKKggG.KK
36 40 KtttbKttttKhtK
37 40 KtbKthhhtttttBK
38 39 KbbthhhtttttttbK
39 38 KbttthhttOOttbbK
40 18 KKKKKKKKK............KbtttttttbbbbK
41 15 KhttttttttttKKK......KbtttttbbbccbKK
42 13 KhtthhhhhhtttttKKKKKKbttttbbbccwccbbOK
43 11 KhtthhhhhhhttttttttthttttbbbccwwccssK
44 8 KK.KhttthhhhhtttttttttttttbbbccwwwcsK
45 7 KccKttttthhtttttttttttttttbbbbccwwcsK
46 8 KwccttttttttttttttttttttttbbbbccwwcsK
47 9 KccttttttttttttttttttttttbbbbbccwwcsK
48 10 KttttttttttttttttttttttbbbbbccwwwcsK
49 11 KttttttttttttttttttttbbbbbccwwwcsK
50 11 KtttttbbbbbbbbbbbbbbbbbbbccwwwwcsK
51 12 KtttbbbbbbbbbbbbcccccccccwwwwwcsK
52 12 KttbbbbbbbbbbccwwwwwwwwwwwwcccbbBK
53 13 KtbBBBBbbbccwwwwwwwwwwwwwccssBBbbBK
54 13 KtbBDDBbbKssccccccccccccssKDDKbbBK
55 13 KtbBDDDbbKKKKKKKKKKKKKKKDDDKtbBK
56 13 KtbBDDDbbbKK..........KDDDbKttbK
57 13 KtbBbbbbbOOK.........KDDDbttbOOK
58 14 KbbbbbOOOOK.........KDDbttbOOOK
59 15 KKKKKOOOOOK.........KKKOOOOOOK
60 20 KKKKKK...............KKKKKK
''')
frame('sleep_b', '''
16 44 YG
17 43 gYG
18 35 G......gYG
19 35 YG.....gYG
20 35 gYG....gYG.....YG
21 36 gYG...gYG.....gYG
22 32 YG..gYG.gYG....gYG
23 33 YG..gYYGGYG...gYG
24 34 YG.gYYYGg....gYGG
25 35 GYYYGG..YG..gYYGg
26 36 gYYGg..gYG.gYYGg
27 37 gYG...gYGGYYGg
28 38 gYG..gYYYGGg
29 39 gYG.gYYGGg
30 40 gYGGYYGg
31 41 gYYGGg
32 42 gYGGg
33 39 KKK.gYGg
34 38 KhttK.gYGGg
35 39 KhtttKKggG.KK
36 40 KtttbKttttKhtK
37 40 KtbKthhhtttttBK
38 39 KbbthhhtttttttbK
39 18 KKKKKKKKK............KbttthhttOOttbbK
40 15 KhttttttttttKKK......KbtttttttbbbbK
41 13 KhtthhhhhhtttttKKKKKKbtttttbbbccbKK
42 12 KhtthhhhhhhttttttttthttttbbbccwccbbOK
43 11 KhttthhhhhhttttttttttttttbbbccwwccssK
44 8 KK.KhttthhhhhtttttttttttttbbbccwwwcsK
45 7 KccKttttthhtttttttttttttttbbbbccwwwcsK
46 8 KwccttttttttttttttttttttttbbbbccwwwcsK
47 9 KccttttttttttttttttttttttbbbbbccwwwcsK
48 10 KttttttttttttttttttttttbbbbbccwwwcsK
49 11 KttttttttttttttttttttbbbbbccwwwwcsK
50 11 KtttttbbbbbbbbbbbbbbbbbbbccwwwwcsK
51 12 KtttbbbbbbbbbbbbcccccccccwwwwwcsK
52 12 KttbbbbbbbbbbccwwwwwwwwwwwwcccbbBK
53 13 KtbBBBBbbbccwwwwwwwwwwwwwccssBBbbBK
54 13 KtbBDDBbbKssccccccccccccssKDDKbbBK
55 13 KtbBDDDbbKKKKKKKKKKKKKKKDDDKtbBK
56 13 KtbBDDDbbbKK..........KDDDbKttbK
57 13 KtbBbbbbbOOK.........KDDDbttbOOK
58 14 KbbbbbOOOOK.........KDDbttbOOOK
59 15 KKKKKOOOOOK.........KKKOOOOOOK
60 20 KKKKKK...............KKKKKK
''')

# Revisions below are explicit chosen rows / clusters after image inspection.
# No diagnostic report is used as an editing mask.
def revise_rows(name, text):
    old={int(line.split()[0]):line for line in FRAMES[name].strip().splitlines()}
    for line in text.strip().splitlines():
        old[int(line.split()[0])]=line
    FRAMES[name]='\n'.join(old[y] for y in sorted(old))

revise_rows('recover', '''
7 44 YG
8 43 gYG
9 35 G.......gYG
10 35 YG......gYG....YG
11 35 gYG.....gYG...gYG
12 35 gYG.....gYG..gYG
13 31 YG..gYG.....gYG.gYG
14 32 YG.gYG...YGgYGGYG
15 33 YGgYG....gYYYGg
16 34 GYYGg....gYGGg
17 35 gYG......gYGG
18 36 gYG......gYYGg
19 37 gYG......gYGGg
20 38 gYG......gYGGg
21 36 KK.gYG....gYGGg
22 35 KhtKbggG...gYGGg
23 36 KhttKbgG..gYGGKK
24 37 KhtttKKggGKhtK
''')
revise_rows('poison_a', '''
10 40 YG
11 39 gYG
12 30 G......gYG
13 30 YG.....gYG
14 30 gYG....gYG.....YG
15 31 gYG...gYG.....gYG
16 27 YG..gYG.gYG....gYG
17 28 YG..gYYGGYG...gYG
18 29 YG.gYYYGg...gYG
19 30 GYYYGG..YG.gYG
20 31 gYYGg..gYGGYG
21 32 gYG....gYYGg
22 33 gYG....gYG
23 34 gYG....gYG
24 35 gYG...gYGG
25 36 gYG.gYYGg
26 37 gYGGYGg
27 34 KKKbgYGGg
28 33 KhttKbgYGGg
29 34 KhtttKKggGKKK
''')
revise_rows('poison_b', '''
10 41 YG
11 40 gYG
12 30 G.......gYG
13 30 YG......gYG
14 31 gYG.....gYG......YG
15 32 gYG....gYG......gYG
16 27 YG...gYG.gYG.....gYG
17 28 YG...gYYGGYG....gYG
18 29 YG..gYYYGg....gYG
19 30 YGgYYYGG.YG..gYG
20 31 gYYYGg.gYG.gYG
21 32 gYGG...gYGGYG
22 33 gYG....gYYGg
23 34 gYG....gYG
24 35 gYG...gYGG
25 36 gYG.gYYGg
26 37 gYGGYGg
27 38 gYGGg
28 34 KKKbgYGGg
29 34 KhttKKggGKKK
''')
revise_rows('sleep_a', '''
16 44 YG
17 43 gYG
18 35 G......gYG
19 35 YG.....gYG
20 35 gYG....gYG.....YG
21 36 gYG...gYG.....gYG
22 32 YG..gYG.gYG....gYG
23 33 YG..gYYGGYG...gYG
24 34 YG.gYYYGg...gYG
25 35 GYYYGG..YG.gYG
26 36 gYYGg..gYGGYG
27 37 gYG....gYYGg
28 38 gYG....gYG
29 39 gYG....gYG
30 40 gYG...gYGG
31 41 gYG.gYYGg
32 42 gYGGYGg
33 39 KKKbgYGGg
34 38 KhttKbgYGGg
35 39 KhtttKKggGKKK
''')
revise_rows('sleep_b', '''
16 44 YG
17 43 gYG
18 35 G......gYG
19 35 YG.....gYG
20 35 gYG....gYG.....YG
21 36 gYG...gYG.....gYG
22 32 YG..gYG.gYG....gYG
23 33 YG..gYYGGYG...gYG
24 34 YG.gYYYGg...gYG
25 35 GYYYGG..YG.gYG
26 36 gYYGg..gYGGYG
27 37 gYG....gYYGg
28 38 gYG....gYG
29 39 gYG....gYG
30 40 gYG...gYGG
31 41 gYG.gYYGg
32 42 gYGGYGg
33 39 KKKbgYGGg
34 38 KhttKbgYGGg
35 39 KhtttKKggGKKK
''')
# Fallen antlers are laid toward the right; these rows are separately selected.
revise_rows('dead', '''
30 36 .
31 36 .
32 29 .
33 30 .
34 31 .
35 32 .
36 33 .
37 34 .
38 32 ..............YG
39 33 .............gYG....YG
40 34 .......YG...gYG....gYG
41 35 .......gYG.gYG....gYG
42 36 .......gYYGGG...gYGG
43 37 .......gYYGg..gYYGg
44 33 KKK.........gYYGGYYGg
45 10 KK....................KhttK.....gYYYGGg
46 9 KwcK...KKKKKKKKKKKKK...KhtttKKggGGKhtK
''')
# Four grounded feet in the stable standing frames; the farther pair reaches y59.
revise_rows('idle_a', '''
48 14 KtbBKDDBBK.........DBK.KbbK
49 15 KtbBK..DBK........DBK..KtbK
50 16 KtbK...DBK.......DBK..KtbK
51 16 KtbK...DBK.......DBK..KtbK
52 16 KtbK...DBK.......DBK..KtbK
53 16 KtbK...DBK.......DBK..KtbK
54 16 KtbK...DBK.......DBK..KtbK
55 16 KtbK...DBK.......DBK..KtbK
56 16 KtbK...DBK.......DBK..KtbK
57 16 KtbK...DBK.......DBK..KtbK
58 16 KtbK..DOOK......KOOK..KtbK
59 15 KOOOK..OOOK......OOOK..KOOK
''')
revise_rows('idle_b', '''
48 14 KtbBKDDBBK.........DBK.KbbK
49 15 KtbBK..DBK........DBK..KtbK
50 16 KtbK...DBK.......DBK..KtbK
51 16 KtbK...DBK.......DBK..KtbK
52 16 KtbK...DBK.......DBK..KtbK
53 16 KtbK...DBK.......DBK..KtbK
54 16 KtbK...DBK.......DBK..KtbK
55 16 KtbK...DBK.......DBK..KtbK
56 16 KtbK...DBK.......DBK..KtbK
57 16 KtbK...DBK.......DBK..KtbK
58 16 KtbK..DOOK......KOOK..KtbK
59 15 KOOOK..OOOK......OOOK..KOOK
''')
revise_rows('idle_c', '''
48 14 KtbBKDDBBK.........DBK.KbbK
49 15 KtbBK..DBK........DBK..KtbK
50 16 KtbK...DBK.......DBK..KtbK
51 16 KtbK...DBK.......DBK..KtbK
52 16 KtbK...DBK.......DBK..KtbK
53 16 KtbK...DBK.......DBK..KtbK
54 16 KtbK...DBK.......DBK..KtbK
55 16 KtbK...DBK.......DBK..KtbK
56 16 KtbK...DBK.......DBK..KtbK
57 16 KtbK...DBK.......DBK..KtbK
58 16 KtbK..DOOK......KOOK..KtbK
59 15 KOOOK..OOOK......OOOK..KOOK
''')
revise_rows('skill_a', '''
48 14 KtbBKDDBBK.........DBK.KbbK
49 15 KtbBK..DBK........DBK..KtbK
50 16 KtbK...DBK.......DBK..KtbK
51 16 KtbK...DBK.......DBK..KtbK
52 16 KtbK...DBK.......DBK..KtbK
53 16 KtbK...DBK.......DBK..KtbK
54 16 KtbK...DBK.......DBK..KtbK
55 16 KtbK...DBK.......DBK..KtbK
56 16 KtbK...DBK.......DBK..KtbK
57 16 KtbK...DBK.......DBK..KtbK
58 16 KtbK..DOOK......KOOK..KtbK
59 15 KOOOK..OOOK......OOOK..KOOK
''')
revise_rows('skill_c', '''
48 14 KtbBKDDBBK.........DBK.KbbK
49 15 KtbBK..DBK........DBK..KtbK
50 16 KtbK...DBK.......DBK..KtbK
51 16 KtbK...DBK.......DBK..KtbK
52 16 KtbK...DBK.......DBK..KtbK
53 16 KtbK...DBK.......DBK..KtbK
54 16 KtbK...DBK.......DBK..KtbK
55 16 KtbK...DBK.......DBK..KtbK
56 16 KtbK...DBK.......DBK..KtbK
57 16 KtbK...DBK.......DBK..KtbK
58 16 KtbK..DOOK......KOOK..KtbK
59 15 KOOOK..OOOK......OOOK..KOOK
''')
PATCHES={
 'idle_a':[(21,39,'b'),(22,41,'b'),(21,48,'t'),(47,23,'D')],
 'idle_b':[(22,40,'b'),(47,23,'D')],
 'idle_c':[(19,38,'b'),(20,39,'b'),(21,41,'b'),(21,50,'t'),(47,23,'D')],
 'skill_a':[(19,38,'b'),(20,39,'b'),(21,41,'b'),(21,50,'t'),(47,23,'D')],
 'skill_c':[(21,39,'b'),(22,41,'b'),(21,48,'t'),(47,23,'D')],
 'windup':[(25,40,'b'),(26,42,'b'),(27,44,'b'),(51,33,'D')],
 'move':[(23,42,'b'),(24,43,'b'),(25,45,'b')],
 'attack':[(31,45,'b'),(32,46,'b')],
 'recover':[(46,23,'D'),(47,36,'D')],
 'hit':[(22,30,'b'),(23,32,'b'),(22,39,'t')],
 'poison_a':[(47,18,'D')],
 'poison_b':[(47,18,'D')],
 'stun_a':[(30,36,'b'),(48,18,'D')],
 'stun_b':[(48,18,'D')],
}
# Final fork topology: tips merge once into a stem; no closed antler loops.
revise_rows('sleep_a', '''
16 43 YG
17 42 gYG
18 33 G........gYG
19 33 YG.......gYG
20 33 gYG.......gYG
21 34 gYG..YG...gYG......YG
22 34 gYG..gYG..gYG.....gYG
23 30 YG..gYG...gYGGYG....gYG
24 31 YG..gYG...gYYYG....gYG
25 32 YG..gYG...gYGG...gYG
26 34 YG.gYG..gYGG.gYG
27 36 YGgYG...gYYYYG
28 39 gYG..gYYGg
29 40 gYG.gYGGg
30 41 gYG.gYGGg
31 42 gYG.gYG
32 43 gYGGYGg
33 39 KKKbgYGGg
''')
revise_rows('sleep_b', '''
16 43 YG
17 42 gYG
18 33 G........gYG
19 33 YG.......gYG
20 33 gYG.......gYG
21 34 gYG..YG...gYG......YG
22 34 gYG..gYG..gYG.....gYG
23 30 YG..gYG...gYGGYG....gYG
24 31 YG..gYG...gYYYG....gYG
25 32 YG..gYG...gYGG...gYG
26 34 YG.gYG..gYGG.gYG
27 36 YGgYG...gYYYYG
28 39 gYG..gYYGg
29 40 gYG.gYGGg
30 41 gYG.gYGGg
31 42 gYG.gYG
32 43 gYGGYGg
33 39 KKKbgYGGg
''')
revise_rows('poison_a', '''
10 40 YG
11 39 gYG
12 30 G........gYG
13 30 YG.......gYG
14 30 gYG.......gYG
15 31 gYG..YG...gYG......YG
16 31 gYG..gYG..gYG.....gYG
17 27 YG..gYG...gYGGYG....gYG
18 28 YG..gYG...gYYYG....gYG
19 29 YG..gYG...gYGG...gYG
20 31 YG.gYG..gYGG.gYG
21 33 YGgYG...gYYYYG
22 36 gYG..gYYGg
23 37 gYG.gYGGg
24 38 gYG.gYGGg
25 39 gYG.gYG
26 40 gYGGYGg
27 34 KKKbgYGGg
''')
revise_rows('poison_b', '''
10 40 YG
11 39 gYG
12 30 G........gYG
13 30 YG.......gYG
14 30 gYG.......gYG
15 31 gYG..YG...gYG......YG
16 31 gYG..gYG..gYG.....gYG
17 27 YG..gYG...gYGGYG....gYG
18 28 YG..gYG...gYYYG....gYG
19 29 YG..gYG...gYGG...gYG
20 31 YG.gYG..gYGG.gYG
21 33 YGgYG...gYYYYG
22 36 gYG..gYYGg
23 37 gYG.gYGGg
24 38 gYG.gYGGg
25 39 gYG.gYG
26 40 gYGGYGg
27 38 gYGGg
28 34 KKKbgYGGg
''')
PATCHES['recover'].append((21,38,'b'))
# Gold stem junctions observed at native size, each pixel chosen explicitly.
PATCHES['sleep_a']=[(26,36,'G'),(30,44,'g'),(31,45,'g')]
PATCHES['sleep_b']=[(26,36,'G'),(30,44,'g'),(31,45,'g')]
PATCHES['poison_a'] += [(20,33,'G'),(24,41,'g'),(25,42,'g')]
PATCHES['poison_b'] += [(20,33,'G'),(24,41,'g'),(25,42,'g')]
# Residual light travels from the upper right toward the raised antler tips.
revise_rows('skill_c', '''
11 30 YG..gYG......gYG..gYG....YG
12 31 YG.gYG......gYG.gYG.....YE
13 32 YGgYG..YG..gYGGYG.......G
16 35 gYG.gYG.gYGg.......G
17 36 gYGGYG..gYG.......YE
18 37 gYYGg...gYG......G
20 35 KK..gG....gYYGg..Y
21 35 KhtK.gG...gYG.KK.G
''')
if __name__=='__main__':
    write_sources()
    # Current revision: explicitly authored per-pose native runs, preserved separately.
    from repair_three_quarter import apply
    apply()
