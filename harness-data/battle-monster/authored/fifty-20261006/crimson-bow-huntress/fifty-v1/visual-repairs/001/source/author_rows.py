"""Explicit native row-run authoring. No frame transforms, geometry, or shade synthesis.
Every nontransparent run below is authored literally; blank canvas only is initialized.
The exported pxgrid files contain all 64 complete literal rows.
"""
from pathlib import Path
ROOT = Path(__file__).resolve().parent

def frame(group, name, text):
    rows = [['.'] * 64 for _ in range(64)]
    for record in text.strip().splitlines():
        y, x, ink = record.split()
        y, x = int(y), int(x)
        for j, symbol in enumerate(ink):
            rows[y][x+j] = symbol
    (ROOT / group / (name + '.pxgrid')).write_text('\n'.join(''.join(r) for r in rows)+'\n')

frame('poses', 'idle_a', '''
8 29 XXXXXXXX
9 27 XXHHHKKKKKXX
10 26 XHHHKKKKKKKKKX
11 25 XHHKKKKKKKKKKKX
12 24 XHKKKKKKKKKKKKKX
13 23 XKKKKKKKKKKKKKKKX
14 21 XRRXKKKKKKKKKKKKKX
15 20 XrhrXKKKKHHKXllllffX
16 19 XrhhRXKKKKKXlllllfffX
17 20 XRrRXKKKKKXlllllffffX
18 20 XKKKXKKKKXllffXXXfffX
19 19 XHKKXKKKKXlfffXKffffX
20 18 XHKKXKKKKXlfffffffffX
21 18 XKKKXKKKKXlffffffffssX
22 18 XKKKXXKKKXsfffffffssX
23 18 XKKKX.XKKXsffffsfssX
24 18 XKKKX..XXXssffffssX
25 18 XKKKX....XssssssX
26 18 XKKKX.....XsffsX
27 18 XKKX......XsffsX
28 18 XKKX...XXTullfsTXX
29 18 XKKX..XTuuuulflTTtX
30 18 XKKX.XTuuuuuuGTttttX
31 18 XKKXXTuuuuutGTtttttTX
32 18 XKXXTuuuuutGTttttttTX
33 18 XX.XTuuuutGTtttttttTX
34 21 XTuuuutGTttttttttTX
35 21 XTuuuttGTttTttttttTX
36 21 XTuutttGTttTTtttttTX
37 21 XTuutttGTttTXXTtttTX
38 22 XuutttGTtttX..XTutTX
39 22 XuutttGTtttX...XuffX
40 23 XffffXTttttX...XlffssX
41 23 XlffsXTttttX....XffssX
42 24 XsssXTrhrTTX....XXRX
43 25 XTTTTrhrrTTX
44 25 XPqqpppppPPX
45 25 XPqqpppppPPX
46 25 XPqqppPPppPX
47 25 XPqqppXPPpPX
48 25 XPqqpPX.PppPX
49 25 XPqqpPX.XPppX
50 25 XPqqpX..XPppX
51 25 XPqppX...XPppX
52 25 XPqppX...XPppX
53 25 XPqppX...XPppX
54 25 XPqppX...XPppX
55 25 XPppPX...XPppX
56 25 XPPPXX...XPPPX
57 24 XHHKKX...XHHKX
58 24 XHKKKX...XHKKKX
59 23 XKKKKKX..XKKKKKX
60 23 XXXXXXX..XXXXXXX
24 50 XRX
25 51 XhrX
26 52 XhrX
27 49 G...XhrX
28 49 G....XhrX
29 49 G....XhrX
30 49 G.....XrX
31 49 G.....XrX
32 49 G.....XrX
33 49 G.....XrX
34 49 G.....XrX
35 49 G....XhrX
36 49 G....XhrX
37 49 G...XhrX
38 49 G..XhrX
39 49 GXhrX
40 49 XGRX
41 49 XGRX
42 49 XGRX
43 49 GXrX
44 49 G.XrX
45 49 G..XrX
46 49 G...XrX
47 49 G....XrX
48 49 G....XrX
49 49 G....XrX
50 49 G...XrX
51 49 G..XrX
52 49 G.XrX
53 49 GXrX
54 49 XrX
55 48 XRX
27 21 lH.lH
28 21 HX.HX
29 21 GX.GX
30 21 GRRGX
31 21 XGrrX
32 21 XGrrX
33 21 XGrrX
34 21 XGrrX
35 21 XGrrX
36 21 XGrrX
37 21 XGrrX
38 21 XGRRX
39 21 XRRX
''')
# Explicit corrections to the first idle: elbow -> broad forearm -> wrist -> grip.
# These affect this pose only, with no propagated edits.
p=ROOT/'poses/idle_a.pxgrid'
r=[list(row) for row in p.read_text().splitlines()]
for y,x,ink in [(38,38,'XTuutTX'),(39,39,'XTuutttTX'),(40,40,'XTuuuulffXGRX'),(41,41,'XTTTssffsXGRX'),(42,43,'XXXsssXGRX')]:
    for j,symbol in enumerate(ink): r[y][x+j]=symbol
p.write_text('\n'.join(''.join(row) for row in r)+'\n')

frame('poses','idle_b','''
8 29 XXXXXXXX
9 27 XXHHHKKKKKXX
10 26 XHHHKKKKKKKKKX
11 25 XHHKKKKKKKKKKKX
12 24 XHKKKKKKKKKKKKKX
13 23 XKKKKKKKKKKKKKKKX
14 21 XRRXKKKKKKKKKKKKKX
15 20 XrhrXKKKKHHKXllllffX
16 19 XrhhRXKKKKKXlllllfffX
17 20 XRrRXKKKKKXlllllffffX
18 20 XKKKXKKKKXllffXXXfffX
19 19 XHKKXKKKKXlfffXKffffX
20 18 XHKKXKKKKXlfffffffffX
21 18 XKKKXKKKKXlffffffffssX
22 18 XKKKXXKKKXsfffffffssX
23 18 XKKKX.XKKXsffffsfssX
24 18 XKKKX..XXXssffffssX
25 18 XKKKX....XssssssX
26 18 XKKKX.....XsffsX
27 18 XKKX...XXTullfsTXX
28 18 XKKX..XTuuuulflTTtX
29 18 XKKX.XTuuuuuuGTttttX
30 18 XKKXXTuuuuutGTtttttTX
31 18 XKXXTuuuuutGTttttttTX
32 18 XX.XTuuuutGTtttttttTX
33 21 XTuuuutGTttttttttTX
34 21 XTuuuttGTttTttttttTX
35 21 XTuutttGTttTTtttttTX
36 21 XTuutttGTttTXXTtttTX
37 22 XuutttGTtttX.XTuutTX
38 22 XuutttGTtttX..XTuutTX
39 23 XffffXTttttX...XTuutttTX
40 23 XlffsXTttttX....XTuuulffXGRX
41 24 XsssXTrhrTTX.....XTTssffsXGRX
42 25 XTTTTrhrrTTX.......XXsssXGRX
43 25 XTTTTrrrTTTX
44 25 XPqqpppppPPX
45 25 XPqqpppppPPX
46 25 XPqqppPPppPX
47 25 XPqqppXPPpPX
48 25 XPqqpPX.PppPX
49 25 XPqqpPX.XPppX
50 25 XPqqpX..XPppX
51 25 XPqppX...XPppX
52 25 XPqppX...XPppX
53 25 XPqppX...XPppX
54 25 XPqppX...XPppX
55 25 XPppPX...XPppX
56 25 XPPPXX...XPPPX
57 24 XHHKKX...XHHKX
58 24 XHKKKX...XHKKKX
59 23 XKKKKKX..XKKKKKX
60 23 XXXXXXX..XXXXXXX
24 50 XRX
25 51 XhrX
26 52 XhrX
27 49 G...XhrX
28 49 G....XhrX
29 49 G....XhrX
30 49 G.....XrX
31 49 G.....XrX
32 49 G.....XrX
33 49 G.....XrX
34 49 G.....XrX
35 49 G....XhrX
36 49 G....XhrX
37 49 G...XhrX
38 49 G..XhrX
39 49 GXhrX
40 49 XGRX
41 49 XGRX
42 49 XGRX
43 49 GXrX
44 49 G.XrX
45 49 G..XrX
46 49 G...XrX
47 49 G....XrX
48 49 G....XrX
49 49 G....XrX
50 49 G...XrX
51 49 G..XrX
52 49 G.XrX
53 49 GXrX
54 49 XrX
55 48 XRX
26 21 lH.lH
27 21 HX.HX
28 21 GX.GX
29 21 GRRGX
30 21 XGrrX
31 21 XGrrX
32 21 XGrrX
33 21 XGrrX
34 21 XGrrX
35 21 XGrrX
36 21 XGrrX
37 21 XGRRX
38 21 XRRX
''')
frame('poses','idle_c','''
8 29 XXXXXXXX
9 27 XXHHHKKKKKXX
10 26 XHHHKKKKKKKKKX
11 25 XHHKKKKKKKKKKKX
12 24 XHKKKKKKKKKKKKKX
13 23 XKKKKKKKKKKKKKKKX
14 21 XRRXKKKKKKKKKKKKKX
15 20 XrhrXKKKKHHKXllllffX
16 19 XrhhRXKKKKKXlllllfffX
17 20 XRrRXKKKKKXlllllffffX
18 20 XKKKXKKKKXllffXXXfffX
19 19 XHKKXKKKKXlfffXKffffX
20 18 XHKKXKKKKXlfffffffffX
21 18 XKKKXKKKKXlffffffffssX
22 18 XKKKXXKKKXsfffffffssX
23 18 XKKKX.XKKXsffffsfssX
24 18 XKKKX..XXXssffffssX
25 18 XKKKX....XssssssX
26 18 XKKKX.....XsffsX
27 18 XKKX......XsffsX
28 18 XKKX....XXTullfsTXX
29 18 XKKX...XTuuuulflTTtX
30 18 XKKX..XTuuuuuuGTttttX
31 18 XKKX.XTuuuuutGTtttttTX
32 18 XKKXXTuuuuutGTttttttTX
33 18 XX.XTuuuutGTtttttttTX
34 21 XTuuuutGTttttttttTX
35 21 XTuuuttGTttTttttttTX
36 21 XTuutttGTttTTtttttTX
37 21 XTuutttGTttTXXTtttTX
38 22 XuutttGTtttX.XTuutTX
39 22 XuutttGTtttX..XTuutttTX
40 23 XffffXTttttX...XTuuuulffXGRX
41 23 XlffsXTttttX....XTTTssffsXGRX
42 24 XsssXTrhrTTX......XXsssXGRX
43 25 XTTTTrhrrTTX
44 25 XPqqpppppPPX
45 25 XPqqpppppPPX
46 25 XPqqppPPppPX
47 25 XPqqppXPPpPX
48 25 XPqqpPX.PppPX
49 25 XPqqpPX.XPppX
50 25 XPqqpX..XPppX
51 25 XPqppX...XPppX
52 25 XPqppX...XPppX
53 25 XPqppX...XPppX
54 25 XPqppX...XPppX
55 25 XPppPX...XPppX
56 25 XPPPXX...XPPPX
57 24 XHHKKX...XHHKX
58 24 XHKKKX...XHKKKX
59 23 XKKKKKX..XKKKKKX
60 23 XXXXXXX..XXXXXXX
24 50 XRX
25 51 XhrX
26 52 XhrX
27 49 G...XhrX
28 49 G....XhrX
29 49 G....XhrX
30 49 G.....XrX
31 49 G.....XrX
32 49 G.....XrX
33 49 G.....XrX
34 49 G.....XrX
35 49 G....XhrX
36 49 G....XhrX
37 49 G...XhrX
38 49 G..XhrX
39 49 GXhrX
40 49 XGRX
41 49 XGRX
42 49 XGRX
43 49 GXrX
44 49 G.XrX
45 49 G..XrX
46 49 G...XrX
47 49 G....XrX
48 49 G....XrX
49 49 G....XrX
50 49 G...XrX
51 49 G..XrX
52 49 G.XrX
53 49 GXrX
54 49 XrX
55 48 XRX
28 21 lH.lH
29 21 HX.HX
30 21 GX.GX
31 21 GRRGX
32 21 XGrrX
33 21 XGrrX
34 21 XGrrX
35 21 XGrrX
36 21 XGrrX
37 21 XGrrX
38 21 XGrrX
39 21 XGRRX
40 21 XRRX
''')
frame('poses','windup','''
8 28 XXXXXXXX
9 26 XXHHHKKKKKXX
10 25 XHHHKKKKKKKKKX
11 24 XHHKKKKKKKKKKKX
12 23 XHKKKKKKKKKKKKKX
13 22 XKKKKKKKKKKKKKKKX
14 20 XRRXKKKKKKKKKKKKKX
15 19 XrhrXKKKKHHKXllllffX
16 18 XrhhRXKKKKKXlllllfffX
17 19 XRrRXKKKKKXlllllffffX
18 19 XKKKXKKKKXllffXXXfffX
19 18 XHKKXKKKKXlfffXKffffX
20 17 XHKKXKKKKXlfffffffffX
21 17 XKKKXKKKKXlffffffffssX
22 17 XKKKXXKKKXsfffffffssX
23 17 XKKKX.XKKXsffffsfssX
24 17 XKKKX..XXXssffffssX
25 17 XKKKX....XssssssX
26 17 XKKKX.....XsffsX
27 17 XKKX......XsffsX..XlffX
28 17 XKKX..XXTullfsTTXXlfffX
29 17 XKKX.XTuuuulflTTTssffX
30 17 XKKXXTuuuuuGTttttTTssX
31 17 XKXXTuuuuuGTttttXlffXTTuuuTTXX
32 17 XX.XTuuuuGTtttttXlfffTTuuuttlffXGRX
33 20 XTuuuGTttttttTXsfffTTttttssffXGRX
34 19 XTuuuGTttttttTTXsffXTTTTTTTXGRX
35 19 XTuuuGTttttTTTXsffX
36 20 XTuuGTttttTX.XTTX
37 21 XTTGTtttttX
38 23 XGTttttttX
39 24 XTrhrTTTTX
40 24 XTrhrrTTTX
41 24 XPqqpppPPX
42 24 XPqqppppPPX
43 24 XPqqpppppPPX
44 23 XPqqpppPpppPX
45 22 XPqqppPXPPppPX
46 22 XPqqppX.XPppPX
47 21 XPqqpPX..XPppPX
48 21 XPqqpX....XPppX
49 20 XPqqpX.....XPppX
50 20 XPqqpX......XPppX
51 20 XPqppX......XPppX
52 20 XPqppX.......XPppX
53 20 XPqppX.......XPppX
54 20 XPppPX.......XPppX
55 20 XPPPX........XPPPX
56 19 XHHKX........XHHKX
57 19 XHKKX........XHKKX
58 18 XHKKKX.......XKKKKX
59 17 XKKKKKX......XKKKKKX
60 17 XXXXXXX......XXXXXXX
17 50 XRX
18 51 XhrX
19 52 XhrX
20 53 XhrX
21 48 G.....XhrX
22 47 G.......XrX
23 46 G........XrX
24 45 G.........XrX
25 44 G..........XrX
26 43 G...........XrX
27 42 G...........XhrX
28 41 G............XhrX
29 40 G............XhrX
30 40 G...........XhrX
31 40 G..........XhrX
32 52 XGRX
33 52 XGRX
34 52 XGRX
35 41 G..........XrX
36 42 G..........XrX
37 43 G..........XrX
38 44 G..........XrX
39 45 G..........XrX
40 46 G.........XrX
41 47 G.......XrX
42 48 G.....XrX
43 49 G...XrX
44 50 G.XrX
45 51 XrX
46 50 XRX
26 20 lH.lH
27 20 HX.HX
28 20 GX.GX
29 20 GRRGX
30 20 XGrrX
31 20 XGrrX
32 20 XGrrX
33 20 XGrrX
34 20 XGrrX
35 20 XGrrX
36 20 XGRRX
37 20 XRRX
29 40 lG
30 41 GX
31 42 GX
32 41 GGGGGGGGGGGGGGGG
''')
frame('poses','move','''
9 31 XXXXXXXX
10 29 XXHHHKKKKKXX
11 28 XHHHKKKKKKKKKX
12 27 XHHKKKKKKKKKKKX
13 26 XHKKKKKKKKKKKKKX
14 25 XKKKKKKKKKKKKKKKX
15 22 XRRXXKKKKKKKKKKKKX
16 20 XRhrRXKKKKHHKXllllffX
17 18 XrhhRXXKKKKKXlllllfffX
18 17 XrRRX.XKKKKXlllllffffX
19 16 XHKKX..XKKKXllffXXXfffX
20 15 XHKKX...XKKXlfffXKffffX
21 14 XHKKX....XKXlfffffffffX
22 14 XKKKX....XKXlffffffffssX
23 14 XKKX.....XKXsfffffffssX
24 14 XKKX......XXsffffsfssX
25 14 XKKX.......XsffffssX
26 15 XKKX........XsssssX
27 16 XKKX.........XsffsX
28 17 XXX.....XXTTullfsTTX.XlffX
29 22 XXTTuuuulflTTTTTXlfffX
30 21 XTuuuuuuuGTtttTTssffX
31 20 XTuuuuuuGTtttttXsffXTTuuuTTXX
32 19 XTuuuuuGTttttttXfffTTuuuttlffXGRX
33 19 XTuuuuGTttttttTXsffTTttttssffXGRX
34 19 XTuuuGTttttTTTXsffXTTTTTTTXGRX
35 20 XTuuGTttttTX.XTTX
36 21 XTuGTtttttX
37 23 XGTttttttX
38 24 XTrhrTTTTX
39 24 XTrhrrTTTX
40 24 XPqqpppPPX
41 24 XPqqppppPPX
42 23 XPqqppppppPPX
43 22 XPqqpppPppppPX
44 21 XPqqppPXPPpppPX
45 20 XPqqppX..XPpppPX
46 19 XPqqpPX...XPpppPX
47 18 XPqqpPX....XPpppPX
48 17 XPqqpPX......XPpppX
49 16 XPqqpPX........XPppX
50 15 XPqppPX.........XPppX
51 15 XPppPX...........XPppX
52 15 XPPPX............XPppX
53 14 XHHKX............XPppX
54 14 XHKKX............XPppX
55 13 XHKKKX...........XPppX
56 12 XKKKKX...........XPPPX
57 12 XXXXX.............XHHKX
58 30 XHKKKX
59 30 XKKKKKKX
60 30 XXXXXXXX
17 51 XRX
18 52 XhrX
19 53 XhrX
20 54 XhrX
21 49 G.....XhrX
22 48 G.......XrX
23 47 G........XrX
24 46 G.........XrX
25 45 G..........XrX
26 44 G...........XrX
27 43 G...........XhrX
28 42 G............XhrX
29 41 G............XhrX
30 41 G...........XhrX
31 41 G..........XhrX
32 53 XGRX
33 53 XGRX
34 53 XGRX
35 42 G..........XrX
36 43 G..........XrX
37 44 G..........XrX
38 45 G..........XrX
39 46 G..........XrX
40 47 G.........XrX
41 48 G.......XrX
42 49 G.....XrX
43 50 G...XrX
44 51 G.XrX
45 52 XrX
46 51 XRX
27 18 lH.lH
28 18 HX.HX
29 18 GX.GX
30 18 GRRGX
31 18 XGrrX
32 18 XGrrX
33 18 XGrrX
34 18 XGrrX
35 18 XGrrX
36 18 XGrrX
37 18 XGRRX
38 18 XRRX
32 42 GGGGGGGGGGGGGGGG
''')
frame('poses','attack','''
8 32 XXXXXXXX
9 30 XXHHHKKKKKXX
10 29 XHHHKKKKKKKKKX
11 28 XHHKKKKKKKKKKKX
12 27 XHKKKKKKKKKKKKKX
13 26 XKKKKKKKKKKKKKKKX
14 23 XRRXXKKKKKKKKKKKKX
15 21 XRhrRXKKKKHHKXllllffX
16 19 XrhhRXXKKKKKXlllllfffX
17 18 XrRRX.XKKKKXlllllffffX
18 17 XHKKX..XKKKXllffXXXfffX
19 16 XHKKX...XKKXlfffXKffffX
20 15 XHKKX....XKXlfffffffffX
21 15 XKKKX....XKXlffffffffssX
22 15 XKKX.....XKXsfffffffssX
23 15 XKKX......XXsffffsfssX
24 15 XKKX.......XsffffssX
25 16 XKKX........XsssssX
26 17 XKKX.........XsffsX
27 18 XXX......XXTTullfsTTX
28 22 XXTTuuuulflTTTTTTX
29 21 XTuuuuuuuGTttttTTTX
30 20 XTuuuuuuGTtttttTXTTuuuuuuTTXX
31 20 XTuuuuuGTttttttTXTTuuutttlffXGRX
32 20 XTuuuuGTttttttTXXTTttttttssffXGRX
33 20 XTuuuGTttttTTTX..XTTTTTTTTTXGRX
34 21 XTuuGTttttTX
35 22 XTuGTtttttX
36 24 XGTttttttX
37 25 XTrhrTTTTX
38 25 XTrhrrTTTX
39 25 XPqqpppPPX
40 25 XPqqppppPPX
41 24 XPqqppppppPPX
42 23 XPqqpppPppppPX
43 22 XPqqppPXPPpppPX
44 21 XPqqppX..XPpppPX
45 20 XPqqpPX....XPpppPX
46 19 XPqqpPX......XPppPX
47 18 XPqqpPX........XPppPX
48 17 XPqqpPX..........XPppX
49 16 XPqppPX...........XPppX
50 15 XPqppPX.............XPppX
51 14 XPqppPX..............XPppX
52 13 XPppPX...............XPppX
53 12 XPPPX................XPppX
54 11 XHHKX................XPppX
55 11 XHKKX................XPppX
56 10 XHKKKX...............XPPPX
57 9 XKKKKX................XHHKX
58 9 XXXXX.................XHKKKX
59 33 XKKKKKKX
60 33 XXXXXXXX
26 27 XXlffX
27 26 XllfffX
28 26 XlffssX
29 25 XsfffX
30 24 XTuusX
31 23 XTuuuX
32 22 XTuuuX
33 21 XTuuuX
34 21 XTTttX
35 22 XTTTX
16 51 XRX
17 52 XhrX
18 53 XhrX
19 50 G..XhrX
20 50 G...XhrX
21 50 G....XrX
22 50 G....XrX
23 50 G....XrX
24 50 G....XrX
25 50 G....XrX
26 50 G...XhrX
27 50 G...XhrX
28 50 G..XhrX
29 50 G.XhrX
30 50 GXhrX
31 53 XGRX
32 53 XGRX
33 53 XGRX
34 50 G..XrX
35 50 G...XrX
36 50 G....XrX
37 50 G....XrX
38 50 G....XrX
39 50 G....XrX
40 50 G...XrX
41 50 G..XrX
42 50 G.XrX
43 50 GXrX
44 50 XrX
45 49 XRX
26 19 lH.lH
27 19 HX.HX
28 19 GX.GX
29 19 GRRGX
30 19 XGrrX
31 19 XGrrX
32 19 XGrrX
33 19 XGrrX
34 19 XGrrX
35 19 XGrrX
36 19 XGRRX
37 19 XRRX
29 59 GX
30 60 GXX
31 55 GGGGGGX
32 60 GXX
33 59 GX
''')
frame('poses','recover','''
8 30 XXXXXXXX
9 28 XXHHHKKKKKXX
10 27 XHHHKKKKKKKKKX
11 26 XHHKKKKKKKKKKKX
12 25 XHKKKKKKKKKKKKKX
13 24 XKKKKKKKKKKKKKKKX
14 22 XRRXKKKKKKKKKKKKKX
15 21 XrhrXKKKKHHKXllllffX
16 20 XrhhRXKKKKKXlllllfffX
17 21 XRrRXKKKKKXlllllffffX
18 21 XKKKXKKKKXllffXXXfffX
19 20 XHKKXKKKKXlfffXKffffX
20 19 XHKKXKKKKXlfffffffffX
21 19 XKKKXKKKKXlffffffffssX
22 19 XKKKXXKKKXsfffffffssX
23 19 XKKKX.XKKXsffffsfssX
24 19 XKKKX..XXXssffffssX
25 19 XKKKX....XssssssX
26 19 XKKKX.....XsffsX
27 19 XKKX......XsffsX
28 19 XKKX...XXTullfsTXX
29 19 XKKX..XTuuuulflTTtX
30 19 XKKX.XTuuuuuuGTttttX
31 19 XKKXXTuuuuutGTtttttTX
32 19 XKXXTuuuuutGTttttttTX
33 19 XX.XTuuuutGTtttttttTX
34 22 XTuuuutGTttttttttTX
35 22 XTuuuttGTttTttttttTX
36 22 XTuutttGTttTTtttttTX
37 22 XTuutttGTttTXXTtttTX
38 23 XuutttGTtttX..XTuutTX
39 23 XuutttGTtttX...XTuutTX
40 24 XffffXTttttX....XTuutttTX
41 24 XlffsXTttttX.....XTuuulffXGRX
42 25 XsssXTrhrTTX......XTTssffsXGRX
43 26 XTTTTrhrrTTX........XXsssXGRX
44 26 XPqqpppppPPX
45 26 XPqqpppppPPX
46 25 XPqqppPPpppPX
47 25 XPqqpPXPPpppPX
48 24 XPqqpPX.XPpppPX
49 24 XPqqpX...XPppPX
50 23 XPqqpX....XPppX
51 23 XPqppX.....XPppX
52 23 XPqppX......XPppX
53 23 XPqppX......XPppX
54 23 XPqppX......XPppX
55 23 XPppPX......XPppX
56 23 XPPPXX......XPPPX
57 22 XHHKKX......XHHKX
58 22 XHKKKX......XHKKKX
59 21 XKKKKKX.....XKKKKKX
60 21 XXXXXXX.....XXXXXXX
25 51 XRX
26 52 XhrX
27 53 XhrX
28 50 G...XhrX
29 50 G....XhrX
30 50 G....XhrX
31 50 G.....XrX
32 50 G.....XrX
33 50 G.....XrX
34 50 G.....XrX
35 50 G.....XrX
36 50 G....XhrX
37 50 G....XhrX
38 50 G...XhrX
39 50 G..XhrX
40 50 GXhrX
41 50 XGRX
42 50 XGRX
43 50 XGRX
44 50 GXrX
45 50 G.XrX
46 50 G..XrX
47 50 G...XrX
48 50 G....XrX
49 50 G....XrX
50 50 G....XrX
51 50 G...XrX
52 50 G..XrX
53 50 G.XrX
54 50 GXrX
55 50 XrX
56 49 XRX
27 22 lH.lH
28 22 HX.HX
29 22 GX.GX
30 22 GRRGX
31 22 XGrrX
32 22 XGrrX
33 22 XGrrX
34 22 XGrrX
35 22 XGrrX
36 22 XGrrX
37 22 XGrrX
38 22 XGRRX
39 22 XRRX
''')
frame('poses','hit','''
11 24 XXXXXXX
12 22 XXHHHKKKKXX
13 21 XHHHKKKKKKKKX
14 20 XHHKKKKKKKKKKKX
15 19 XHKKKKKKKKKKKKKKX
16 18 XKKKKKKKKKKKKKKKKX
17 16 XRRXKKKKKKKKKKKKKKX
18 15 XrhrXKKKKHHKXllllffX
19 14 XrhhRXKKKKKXlllllfffX
20 15 XRrRXKKKKKXlllllffffX
21 15 XKKKXKKKKXllffXXffffX
22 14 XHKKXKKKKXlfffffXfffX
23 13 XHKKXKKKKXlffffXfffffX
24 13 XKKKXKKKKXsffffffffssX
25 13 XKKKXXKKKXsfffffffssX
26 13 XKKKX.XKKXsfffXfssX
27 13 XKKKX..XXXssffffssX
28 13 XKKKX....XssssssX
29 13 XKKKX.....XsffsX
30 13 XKKX......XsffssX
31 13 XKKX...XXTullfsTTX
32 13 XKKX..XTuuuulflTTtXX
33 13 XKKX.XTuuuuuuGTtttttX
34 13 XKKXXTuuuuutGTttttttTX
35 13 XKXXTuuuuutGTttttttttX
36 13 XX.XTuuuutGTttttttttTX
37 16 XTuuuutGTtttXXTttttTX
38 16 XTuuuttGTttTX.XTtttTX
39 17 XTuutttGTttX..XTttTX
40 18 XTuutttGTttX...XTutTX
41 19 XuutttGTtttX....XuffX
42 20 XffffXTttttX....XlffssXGRX
43 20 XlffsXTrhrTX.....XffssXGRX
44 21 XsssXTrhrrTX......XXssXGRX
45 22 XPqqpppppPPX
46 22 XPqqpppppPPX
47 22 XPqqppPPppPX
48 22 XPqqppXPPpPX
49 22 XPqqpPX.PppPX
50 21 XPqqpPX..PppPX
51 21 XPqqpX...XPppX
52 21 XPqppX....XPppX
53 20 XPqppX.....XPppX
54 20 XPqppX......XPppX
55 20 XPppPX......XPppX
56 20 XPPPXX......XPPPX
57 19 XHHKKX......XHHKX
58 19 XHKKKX......XHKKKX
59 18 XKKKKKX.....XKKKKKX
60 18 XXXXXXX.....XXXXXXX
28 20 lH.lH
29 20 HX.HX
30 20 GX.GX
31 20 GRRGX
32 20 XGrrX
33 20 XGrrX
34 20 XGrrX
35 20 XGrrX
36 20 XGrrX
37 20 XGrrX
38 20 XGrrX
39 20 XGRRX
40 20 XRRX
27 47 XRX
28 48 XhrX
29 49 XhrX
30 46 G...XhrX
31 46 G....XhrX
32 46 G.....XrX
33 46 G.....XrX
34 46 G.....XrX
35 46 G.....XrX
36 46 G.....XrX
37 46 G....XhrX
38 46 G....XhrX
39 46 G...XhrX
40 46 G..XhrX
41 46 GXhrX
42 46 XGRX
43 46 XGRX
44 46 XGRX
45 46 GXrX
46 46 G.XrX
47 46 G..XrX
48 46 G...XrX
49 46 G....XrX
50 46 G....XrX
51 46 G....XrX
52 46 G...XrX
53 46 G..XrX
54 46 G.XrX
55 46 GXrX
56 46 XrX
57 45 XRX
''')
frame('poses','dead','''
37 16 XXXXXXXX
38 14 XXHHHKKKKKXX
39 13 XHHHKKKKKKKKKX
40 12 XHHKKKKKKKKKKKKX
41 11 XHKKKKKKKKKKKKKKX
42 10 XKKKKKKKKKKKKKKKKX
43 9 XRRXKKKKKKKKKKKKKKX
44 8 XrhrXKKKKHHKXllllffX
45 8 XrhhRXKKKKKXlllllfffX
46 9 XRrRXKKKKKXlllllffffX
47 9 XKKKXKKKKXllfffXXffffX
48 8 XHKKXKKKKXlfffffffffffX
49 8 XHKKXKKKKXlfffffffffssX
50 8 XKKKXKKKKXsffffffssXssX
51 8 XKKKXXKKKXsffffsfssXffsTTXX
52 8 XKKKX.XKKXsffffssXfffsTuuuuTTXX
53 8 XKKKX..XXXssssssXssTuuuulGTttttTTXX
54 9 XKKKX......XXXXXXTuuuulGTttttttttTXPqqppXX
55 10 XKKKXX........XTuuuuGTtttttttttTXPqqpppppX
56 11 XHKKKKXX.....XTuuuGTttttttttttTXPqqppPPppX
57 12 XHKKKKKKXXXXXTTuuGTttttTTTTTTTXPqqppXPPppX
58 13 XKKKKKKKKKKKXTTTGTttTTXlffssXPqqpppX.PppPX
59 14 XXXXXXXXXXXXXTTTTTTTTXXfffssXPPpppPX..XHKKKX
60 26 XXXXXXXXXXXXXXXXsssXXXXPPPXX...XXXXXXX
51 38 lH.lH
52 38 HX.HX
53 39 GX.GX
54 39 GRRGX
55 40 XGrrX
56 41 XGRRX
57 41 XRRX
55 24 XRX
56 25 XrX
57 26 XhrX
58 27 XhrrXX..........XXrrhX
59 28 XXhrrXXXXXXXXXXrrhXX
60 30 XXXXXGGGGGGGGXXXXX
''')
frame('actions','skill_a','''
8 28 XXXXXXXX
9 26 XXHHHKKKKKXX
10 25 XHHHKKKKKKKKKX
11 24 XHHKKKKKKKKKKKX
12 23 XHKKKKKKKKKKKKKX
13 22 XKKKKKKKKKKKKKKKX
14 20 XRRXKKKKKKKKKKKKKX
15 19 XrhrXKKKKHHKXllllffX
16 18 XrhhRXKKKKKXlllllfffX
17 19 XRrRXKKKKKXlllllffffX
18 19 XKKKXKKKKXllffXXXfffX
19 18 XHKKXKKKKXlfffXKffffX
20 17 XHKKXKKKKXlfffffffffX
21 17 XKKKXKKKKXlffffffffssX
22 17 XKKKXXKKKXsfffffffssX
23 17 XKKKX.XKKXsffffsfssX
24 17 XKKKX..XXXssffffssX
25 17 XKKKX....XssssssX
26 17 XKKKX.....XsffsX
27 17 XKKX......XsffsX..XlffX
28 17 XKKX..XXTullfsTTXXlfffX
29 17 XKKX.XTuuuulflTTTssffX
30 17 XKKXXTuuuuuGTttttTTssX
31 17 XKXXTuuuuuGTttttXlffXTTuuuTTXX
32 17 XX.XTuuuuGTtttttXlfffTTuuuttlffXGRX
33 20 XTuuuGTttttttTXsfffTTttttssffXGRX
34 19 XTuuuGTttttttTTXsffXTTTTTTTXGRX
35 19 XTuuuGTttttTTTXsffX
36 20 XTuuGTttttTX.XTTX
37 21 XTTGTtttttX
38 23 XGTttttttX
39 24 XTrhrTTTTX
40 24 XTrhrrTTTX
41 24 XPqqpppPPX
42 24 XPqqppppPPX
43 24 XPqqpppppPPX
44 23 XPqqpppPpppPX
45 22 XPqqppPXPPppPX
46 22 XPqqppX.XPppPX
47 21 XPqqpPX..XPppPX
48 21 XPqqpX....XPppX
49 20 XPqqpX.....XPppX
50 20 XPqqpX......XPppX
51 20 XPqppX......XPppX
52 20 XPqppX.......XPppX
53 20 XPqppX.......XPppX
54 20 XPppPX.......XPppX
55 20 XPPPX........XPPPX
56 19 XHHKX........XHHKX
57 19 XHKKX........XHKKX
58 18 XHKKKX.......XKKKKX
59 17 XKKKKKX......XKKKKKX
60 17 XXXXXXX......XXXXXXX
17 50 XRX
18 51 XhrX
19 52 XhrX
20 53 XhrX
21 48 G.....XhrX
22 47 G.......XrX
23 46 G........XrX
24 45 G.........XrX
25 44 G..........XrX
26 43 G...........XrX
27 42 G...........XhrX
28 41 G............XhrX
29 40 G............XhrX
30 40 G...........XhrX
31 40 G..........XhrX
32 52 XGRX
33 52 XGRX
34 52 XGRX
35 41 G..........XrX
36 42 G..........XrX
37 43 G..........XrX
38 44 G..........XrX
39 45 G..........XrX
40 46 G.........XrX
41 47 G.......XrX
42 48 G.....XrX
43 49 G...XrX
44 50 G.XrX
45 51 XrX
46 50 XRX
26 20 lH.lH
27 20 HX.HX
28 20 GX.GX
29 20 GRRGX
30 20 XGrrX
31 20 XGrrX
32 20 XGrrX
33 20 XGrrX
34 20 XGrrX
35 20 XGrrX
36 20 XGRRX
37 20 XRRX
29 40 lG
30 41 GX
31 42 GX
28 47 R..h
29 47 rh.rh
30 46 RvehR
31 44 RhveehR
32 40 hhhheeeeeeeeeh
33 44 RhveehR
34 46 RvehR
35 47 rh.rh
36 47 R..h
''')
frame('actions','skill_b','''
8 31 XXXXXXXX
9 29 XXHHHKKKKKXX
10 28 XHHHKKKKKKKKKX
11 27 XHHKKKKKKKKKKKX
12 26 XHKKKKKKKKKKKKKX
13 25 XKKKKKKKKKKKKKKKX
14 22 XRRXXKKKKKKKKKKKKX
15 20 XRhrRXKKKKHHKXllllffX
16 18 XrhhRXXKKKKKXlllllfffX
17 17 XrRRX.XKKKKXlllllffffX
18 16 XHKKX..XKKKXllffXXXfffX
19 15 XHKKX...XKKXlfffXKffffX
20 14 XHKKX....XKXlfffffffffX
21 14 XKKKX....XKXlffffffffssX
22 14 XKKX.....XKXsfffffffssX
23 14 XKKX......XXsffffsfssX
24 14 XKKX.......XsffffssX
25 15 XKKX........XsssssX
26 16 XKKX.........XsffsX
27 17 XXX......XXTTullfsTTX
28 21 XXTTuuuulflTTTTTTX
29 20 XTuuuuuuuGTttttTTTX
30 19 XTuuuuuuGTtttttTXTTuuuuuuTTXX
31 19 XTuuuuuGTttttttTXTTuuutttlffXGRX
32 19 XTuuuuGTttttttTXXTTttttttssffXGRX
33 19 XTuuuGTttttTTTX..XTTTTTTTTTXGRX
34 20 XTuuGTttttTX
35 21 XTuGTtttttX
36 23 XGTttttttX
37 24 XTrhrTTTTX
38 24 XTrhrrTTTX
39 24 XPqqpppPPX
40 24 XPqqppppPPX
41 23 XPqqppppppPPX
42 22 XPqqpppPppppPX
43 21 XPqqppPXPPpppPX
44 20 XPqqppX..XPpppPX
45 19 XPqqpPX....XPpppPX
46 18 XPqqpPX......XPppPX
47 17 XPqqpPX........XPppPX
48 16 XPqqpPX..........XPppX
49 15 XPqppPX...........XPppX
50 14 XPqppPX.............XPppX
51 13 XPqppPX..............XPppX
52 12 XPppPX...............XPppX
53 11 XPPPX................XPppX
54 10 XHHKX................XPppX
55 10 XHKKX................XPppX
56 9 XHKKKX...............XPPPX
57 8 XKKKKX................XHHKX
58 8 XXXXX.................XHKKKX
59 32 XKKKKKKX
60 32 XXXXXXXX
26 26 XXlffX
27 25 XllfffX
28 25 XlffssX
29 24 XsfffX
30 23 XTuusX
31 22 XTuuuX
32 21 XTuuuX
33 20 XTuuuX
34 20 XTTttX
35 21 XTTTX
16 50 XRX
17 51 XhrX
18 52 XhrX
19 49 G..XhrX
20 49 G...XhrX
21 49 G....XrX
22 49 G....XrX
23 49 G....XrX
24 49 G....XrX
25 49 G....XrX
26 49 G...XhrX
27 49 G...XhrX
28 49 G..XhrX
29 49 G.XhrX
30 49 GXhrX
31 52 XGRX
32 52 XGRX
33 52 XGRX
34 49 G..XrX
35 49 G...XrX
36 49 G....XrX
37 49 G....XrX
38 49 G....XrX
39 49 G....XrX
40 49 G...XrX
41 49 G..XrX
42 49 G.XrX
43 49 GXrX
44 49 XrX
45 48 XRX
26 18 lH.lH
27 18 HX.HX
28 18 GX.GX
29 18 GRRGX
30 18 XGrrX
31 18 XGrrX
32 18 XGrrX
33 18 XGrrX
34 18 XGrrX
35 18 XGrrX
36 18 XGRRX
37 18 XRRX
23 52 Rh
24 52 Rvh
25 53 Rveh
26 54 Rveeh
27 55 Rveeeh
28 56 Rheeeh
29 47 Rhrhhhhveeeh
30 47 Rvveeeeeeeeeeh
31 43 hhhvveeeeeeeeeeeeeeh
32 47 Rvveeeeeeeeeeeh
33 47 Rhrhhhhveeeeh
34 55 Rveeeh
35 54 Rveeh
36 53 Rveh
37 52 Rvh
38 52 Rh
40 59 rh
41 60 h
''')
frame('actions','skill_c','''
9 30 XXXXXXXX
10 28 XXHHHKKKKKXX
11 27 XHHHKKKKKKKKKX
12 26 XHHKKKKKKKKKKKX
13 25 XHKKKKKKKKKKKKKX
14 24 XKKKKKKKKKKKKKKKX
15 22 XRRXKKKKKKKKKKKKKX
16 21 XrhrXKKKKHHKXllllffX
17 20 XrhhRXKKKKKXlllllfffX
18 21 XRrRXKKKKKXlllllffffX
19 21 XKKKXKKKKXllffXXXfffX
20 20 XHKKXKKKKXlfffXKffffX
21 19 XHKKXKKKKXlfffffffffX
22 19 XKKKXKKKKXlffffffffssX
23 19 XKKKXXKKKXsfffffffssX
24 19 XKKKX.XKKXsffffsfssX
25 19 XKKKX..XXXssffffssX
26 19 XKKKX....XssssssX
27 19 XKKKX.....XsffsX
28 19 XKKX......XsffsX
29 19 XKKX...XXTullfsTXX
30 19 XKKX..XTuuuulflTTtX
31 19 XKKX.XTuuuuuuGTttttX
32 19 XKKXXTuuuuutGTtttttTX
33 19 XKXXTuuuuutGTttttttTX
34 19 XX.XTuuuutGTtttttttTX
35 22 XTuuuutGTttttttttTX
36 22 XTuuuttGTttTttttttTX
37 22 XTuutttGTttTTtttttTX
38 22 XTuutttGTttTXXTtttTX
39 23 XuutttGTtttX..XTuutTX
40 23 XuutttGTtttX...XTuutTX
41 24 XffffXTttttX....XTuutttTX
42 24 XlffsXTttttX.....XTuuulffXGRX
43 25 XsssXTrhrTTX......XTTssffsXGRX
44 26 XTTTTrhrrTTX........XXsssXGRX
45 26 XPqqpppppPPX
46 26 XPqqpppppPPX
47 25 XPqqppPPpppPX
48 25 XPqqpPXPPpppPX
49 24 XPqqpPX.XPpppPX
50 24 XPqqpX...XPppPX
51 23 XPqqpX....XPppX
52 23 XPqppX.....XPppX
53 23 XPqppX......XPppX
54 23 XPqppX......XPppX
55 23 XPppPX......XPppX
56 23 XPPPXX......XPPPX
57 22 XHHKKX......XHHKX
58 22 XHKKKX......XHKKKX
59 21 XKKKKKX.....XKKKKKX
60 21 XXXXXXX.....XXXXXXX
26 51 XRX
27 52 XhrX
28 53 XhrX
29 50 G...XhrX
30 50 G....XhrX
31 50 G....XhrX
32 50 G.....XrX
33 50 G.....XrX
34 50 G.....XrX
35 50 G.....XrX
36 50 G.....XrX
37 50 G....XhrX
38 50 G....XhrX
39 50 G...XhrX
40 50 G..XhrX
41 50 GXhrX
42 50 XGRX
43 50 XGRX
44 50 XGRX
45 50 GXrX
46 50 G.XrX
47 50 G..XrX
48 50 G...XrX
49 50 G....XrX
50 50 G....XrX
51 50 G....XrX
52 50 G...XrX
53 50 G..XrX
54 50 G.XrX
55 50 GXrX
56 50 XrX
57 49 XRX
28 22 lH.lH
29 22 HX.HX
30 22 GX.GX
31 22 GRRGX
32 22 XGrrX
33 22 XGrrX
34 22 XGrrX
35 22 XGrrX
36 22 XGrrX
37 22 XGrrX
38 22 XGrrX
39 22 XGRRX
40 22 XRRX
35 60 rh
36 59 reh
37 59 rh
38 57 rv
39 57 h
42 53 he
43 54 vh
44 55 r
47 59 rh
48 58 vh
49 58 h
''')
frame('actions','poison_a','''
12 28 XXXXXXXX
13 26 XXHHHKKKKKXX
14 25 XHHHKKKKKKKKKX
15 24 XHHKKKKKKKKKKKX
16 23 XHKKKKKKKKKKKKKX
17 22 XKKKKKKKKKKKKKKKX
18 20 XRRXKKKKKKKKKKKKKX
19 19 XrhrXKKKKHHKXllllffX
20 18 XrhhRXKKKKKXlllllfffX
21 19 XRrRXKKKKKXlllllffffX
22 19 XKKKXKKKKXllffXXffffX
23 18 XHKKXKKKKXlfffffXfffX
24 17 XHKKXKKKKXlfffffffffX
25 17 XKKKXKKKKXlffffffffssX
26 17 XKKKXXKKKXsfffffffssX
27 17 XKKKX.XKKXsffffsfssX
28 17 XKKKX..XXXssffffssX
29 17 XKKKX....XssssssX
30 17 XKKKX.....XsffsX
31 17 XKKX......XsffsX...XfffX
32 17 XKKX...XXTullfsTTXXlfffX
33 17 XKKX..XTuuuulflTTXsffssX
34 17 XKKX.XTuuuuuuGTttXsfffX
35 17 XKKXXTuuuuutGTttTTsffX
36 17 XKXXTuuuuutGTtttTTuuX
37 17 XX.XTuuuutGTttttTTuuX
38 20 XTuuuutGTtttttTTTuuX
39 20 XTuuuttGTtttTTTtttX
40 20 XTuutttGTttTTttttX
41 21 XTuutttGTtttXTTTX
42 22 XuutttGTtttX
43 23 XuutttGTtttX
44 24 XuutttGTtttXX
45 24 XTutttGTttttTX
46 25 XuffXTrhrTTTTX
47 25 XlffssXrhrrTTX
48 26 XffssXqqpppPPX
49 27 XsssXqqppppPPX
50 27 XPqqppPPpppPX
51 26 XPqqppXPPpppPX
52 26 XPqqpPX.XPppPX
53 25 XPqqpPX..XPppX
54 25 XPqqpX....XPppX
55 25 XPqppX....XPppX
56 25 XPPPX.....XPPPX
57 24 XHHKX.....XHHKX
58 24 XHKKX.....XHKKKX
59 23 XKKKKX....XKKKKKX
60 23 XXXXXX....XXXXXXX
30 20 lH.lH
31 20 HX.HX
32 20 GX.GX
33 20 GRRGX
34 20 XGrrX
35 20 XGrrX
36 20 XGrrX
37 20 XGrrX
38 20 XGrrX
39 20 XGrrX
40 20 XGrrX
41 20 XGRRX
42 20 XRRX
32 43 XRX
33 44 XhrX
34 45 XhrX
35 43 G..XhrX
36 43 G...XhrX
37 43 G....XrX
38 43 G....XrX
39 43 G....XrX
40 43 G....XrX
41 43 G...XhrX
42 43 G..XhrX
43 43 G.XhrX
44 43 GXhrX
45 43 XGRX
46 43 XGRX
47 43 XGRX
48 43 GXrX
49 43 G.XrX
50 43 G..XrX
51 43 G...XrX
52 43 G...XrX
53 43 G...XrX
54 43 G..XrX
55 43 G.XrX
56 43 GXrX
57 43 XrX
58 42 XRX
18 50 TuT
19 49 TulGT
20 49 TuGGT
21 50 TTT
27 55 TT
28 54 TuGT
29 54 TGGT
30 55 TT
36 57 TuT
37 57 TGT
38 58 T
''')
frame('actions','poison_b','''
14 29 XXXXXXXX
15 27 XXHHHKKKKKXX
16 26 XHHHKKKKKKKKKX
17 25 XHHKKKKKKKKKKKX
18 24 XHKKKKKKKKKKKKKX
19 23 XKKKKKKKKKKKKKKKX
20 21 XRRXKKKKKKKKKKKKKX
21 20 XrhrXKKKKHHKXllllffX
22 19 XrhhRXKKKKKXlllllfffX
23 20 XRrRXKKKKKXlllllffffX
24 20 XKKKXKKKKXllffXXffffX
25 19 XHKKXKKKKXlfffffXfffX
26 18 XHKKXKKKKXlfffffffffX
27 18 XKKKXKKKKXlffffffffssX
28 18 XKKKXXKKKXsfffffffssX
29 18 XKKKX.XKKXsfffXfssX
30 18 XKKKX..XXXssffffssX
31 18 XKKKX....XssssssX
32 18 XKKKX.....XsffsX
33 18 XKKX......XsffsX...XfffX
34 18 XKKX...XXTullfsTTXXlfffX
35 18 XKKX..XTuuuulflTTXsffssX
36 18 XKKX.XTuuuuuuGTttXsfffX
37 18 XKKXXTuuuuutGTttTTsffX
38 18 XKXXTuuuuutGTtttTTuuX
39 18 XX.XTuuuutGTttttTTuuX
40 21 XTuuuutGTtttttTTTuuX
41 21 XTuuuttGTtttTTTtttX
42 21 XTuutttGTttTTttttX
43 22 XTuutttGTtttXTTTX
44 23 XuutttGTtttX
45 24 XuutttGTtttX
46 25 XuutttGTtttXX
47 25 XTutttGTttttTX
48 26 XuffXTrhrTTTTX
49 26 XlffssXrhrrTTX
50 27 XffssXqqpppPPX
51 28 XsssXqqppppPPX
52 28 XPqqppPPpppPX
53 27 XPqqppXPPpppPX
54 27 XPqqpPX.XPppPX
55 26 XPqppPX..XPppX
56 26 XPPPX....XPPPX
57 25 XHHKX....XHHKX
58 25 XHKKX....XHKKKX
59 24 XKKKKX...XKKKKKX
60 24 XXXXXX...XXXXXXX
32 21 lH.lH
33 21 HX.HX
34 21 GX.GX
35 21 GRRGX
36 21 XGrrX
37 21 XGrrX
38 21 XGrrX
39 21 XGrrX
40 21 XGrrX
41 21 XGrrX
42 21 XGrrX
43 21 XGRRX
44 21 XRRX
34 44 XRX
35 45 XhrX
36 46 XhrX
37 44 G..XhrX
38 44 G...XhrX
39 44 G....XrX
40 44 G....XrX
41 44 G....XrX
42 44 G....XrX
43 44 G...XhrX
44 44 G..XhrX
45 44 G.XhrX
46 44 GXhrX
47 44 XGRX
48 44 XGRX
49 44 XGRX
50 44 GXrX
51 44 G.XrX
52 44 G..XrX
53 44 G...XrX
54 44 G...XrX
55 44 G..XrX
56 44 G.XrX
57 44 GXrX
58 44 XrX
59 43 XRX
15 53 TT
16 52 TulT
17 52 TGGT
18 53 TT
24 56 TuT
25 55 TulGT
26 55 TuGGT
27 56 TTT
34 52 TT
35 51 TuGT
36 51 TGGT
37 52 TT
42 58 T
43 57 TuT
44 58 T
''')
frame('actions','stun_a','''
14 29 XXXXXXXX
15 27 XXHHHKKKKKXX
16 26 XHHHKKKKKKKKKX
17 25 XHHKKKKKKKKKKKX
18 24 XHKKKKKKKKKKKKKX
19 23 XKKKKKKKKKKKKKKKX
20 21 XRRXKKKKKKKKKKKKKX
21 20 XrhrXKKKKHHKXllllffX
22 19 XrhhRXKKKKKXlllllfffX
23 20 XRrRXKKKKKXlllllffffX
24 20 XKKKXKKKKXllfffXXfffX
25 19 XHKKXKKKKXlfffffffffX
26 18 XHKKXKKKKXlfffffffffX
27 18 XKKKXKKKKXsffffffffssX
28 18 XKKKXXKKKXsfffffffssX
29 18 XKKKX.XKKXsffffsfssX
30 18 XKKKX..XXXssffffssX
31 18 XKKKX....XssssssX
32 18 XKKKX.....XsffsX
33 18 XKKX......XsffsX
34 18 XKKX...XXTullfsTXX
35 18 XKKX..XTuuuulflTTtX
36 18 XKKX.XTuuuuuuGTttttX
37 18 XKKXXTuuuuutGTtttttTX
38 18 XKXXTuuuuutGTttttttTX
39 18 XX.XTuuuutGTtttttttTX
40 21 XTuuuutGTttttttttTX
41 21 XTuuuttGTttTttttttTX
42 21 XTuutttGTttTTtttttTX
43 21 XTuutttGTttTXXTtttTX
44 21 XTuutttGTttX..XTutTX
45 21 XTuutttGTttX...XTutTX
46 21 XuutttGTtttX....XuffX
47 21 XffffXTrhrTX....XlffssXGRX
48 21 XlffsXrhrrTX.....XffssXGRX
49 22 XsssXqpppPPX......XXssXGRX
50 23 XPqqpppppPPX
51 23 XPqqppPPppPX
52 23 XPqqppXPPpPX
53 23 XPqqpPX.PppPX
54 23 XPqqpPX.XPppPX
55 23 XPqppX...XPppX
56 23 XPPPX....XPPPX
57 22 XHHKX....XHHKX
58 22 XHKKX....XHKKKX
59 21 XKKKKX...XKKKKKX
60 21 XXXXXX...XXXXXXX
33 21 lH.lH
34 21 HX.HX
35 21 GX.GX
36 21 GRRGX
37 21 XGrrX
38 21 XGrrX
39 21 XGrrX
40 21 XGrrX
41 21 XGrrX
42 21 XGrrX
43 21 XGrrX
44 21 XGRRX
45 21 XRRX
34 46 XRX
35 47 XhrX
36 48 XhrX
37 45 G...XhrX
38 45 G....XhrX
39 45 G....XrX
40 45 G....XrX
41 45 G....XrX
42 45 G...XhrX
43 45 G..XhrX
44 45 G.XhrX
45 45 GXhrX
46 45 XGRX
47 45 XGRX
48 45 XGRX
49 45 GXrX
50 45 G.XrX
51 45 G..XrX
52 45 G...XrX
53 45 G...XrX
54 45 G..XrX
55 45 G.XrX
56 45 GXrX
57 45 XrX
58 44 XRX
8 23 G
9 22 GeG
10 20 GeeeeG
11 22 GeG
12 23 G
13 49 G
14 48 GeG
15 46 GeeeeG
16 48 GeG
17 49 G
22 11 G
23 10 GeG
24 11 G
''')
frame('actions','stun_b','''
15 30 XXXXXXXX
16 28 XXHHHKKKKKXX
17 27 XHHHKKKKKKKKKX
18 26 XHHKKKKKKKKKKKX
19 25 XHKKKKKKKKKKKKKX
20 24 XKKKKKKKKKKKKKKKX
21 22 XRRXKKKKKKKKKKKKKX
22 21 XrhrXKKKKHHKXllllffX
23 20 XrhhRXKKKKKXlllllfffX
24 21 XRrRXKKKKKXlllllffffX
25 21 XKKKXKKKKXllfffXXfffX
26 20 XHKKXKKKKXlfffffffffX
27 19 XHKKXKKKKXlfffffffffX
28 19 XKKKXKKKKXsffffffffssX
29 19 XKKKXXKKKXsfffffffssX
30 19 XKKKX.XKKXsffffsfssX
31 19 XKKKX..XXXssffffssX
32 19 XKKKX....XssssssX
33 19 XKKKX.....XsffsX
34 19 XKKX......XsffsX
35 19 XKKX...XXTullfsTXX
36 19 XKKX..XTuuuulflTTtX
37 19 XKKX.XTuuuuuuGTttttX
38 19 XKKXXTuuuuutGTtttttTX
39 19 XKXXTuuuuutGTttttttTX
40 19 XX.XTuuuutGTtttttttTX
41 22 XTuuuutGTttttttttTX
42 22 XTuuuttGTttTttttttTX
43 22 XTuutttGTttTTtttttTX
44 22 XTuutttGTttTXXTtttTX
45 22 XTuutttGTttX..XTutTX
46 22 XTuutttGTttX...XTutTX
47 22 XuutttGTtttX....XuffX
48 22 XffffXTrhrTX....XlffssXGRX
49 22 XlffsXrhrrTX.....XffssXGRX
50 23 XsssXqpppPPX......XXssXGRX
51 24 XPqqpppppPPX
52 24 XPqqppPPppPX
53 24 XPqqppXPPpPX
54 24 XPqqpPX.PppPX
55 24 XPqppPX.XPppPX
56 24 XPPPX...XPPPX
57 23 XHHKX...XHHKX
58 23 XHKKX...XHKKKX
59 22 XKKKKX..XKKKKKX
60 22 XXXXXX..XXXXXXX
34 22 lH.lH
35 22 HX.HX
36 22 GX.GX
37 22 GRRGX
38 22 XGrrX
39 22 XGrrX
40 22 XGrrX
41 22 XGrrX
42 22 XGrrX
43 22 XGrrX
44 22 XGrrX
45 22 XGRRX
46 22 XRRX
35 47 XRX
36 48 XhrX
37 49 XhrX
38 46 G...XhrX
39 46 G....XhrX
40 46 G....XrX
41 46 G....XrX
42 46 G....XrX
43 46 G...XhrX
44 46 G..XhrX
45 46 G.XhrX
46 46 GXhrX
47 46 XGRX
48 46 XGRX
49 46 XGRX
50 46 GXrX
51 46 G.XrX
52 46 G..XrX
53 46 G...XrX
54 46 G...XrX
55 46 G..XrX
56 46 G.XrX
57 46 GXrX
58 46 XrX
59 45 XRX
8 39 G
9 38 GeG
10 36 GeeeeG
11 38 GeG
12 39 G
15 13 G
16 12 GeG
17 10 GeeeeG
18 12 GeG
19 13 G
22 54 G
23 53 GeG
24 54 G
''')
frame('actions','sleep_a','''
20 29 XXXXXXXX
21 27 XXHHHKKKKKXX
22 26 XHHHKKKKKKKKKX
23 25 XHHKKKKKKKKKKKX
24 24 XHKKKKKKKKKKKKKX
25 23 XKKKKKKKKKKKKKKKX
26 21 XRRXKKKKKKKKKKKKKX
27 20 XrhrXKKKKHHKXllllffX
28 19 XrhhRXKKKKKXlllllfffX
29 20 XRrRXKKKKKXlllllffffX
30 20 XKKKXKKKKXllfffssfffX
31 19 XHKKXKKKKXlffffXXfffX
32 18 XHKKXKKKKXlfffffffffX
33 18 XKKKXKKKKXlffffffffssX
34 18 XKKKXXKKKXsfffffffssX
35 18 XKKKX.XKKXsffffsfssX
36 18 XKKKX..XXXssffffssX
37 18 XKKKX....XssssssX
38 18 XKKKX.....XsffsX
39 18 XKKX......XsffsX
40 18 XKKX...XXTullfsTXX
41 18 XKKX..XTuuuulflTTtX
42 18 XKKX.XTuuuuuuGTttttX
43 18 XKKXXTuuuuutGTtttttTX
44 18 XKXXTuuuuutGTttttttTX
45 18 XX.XTuuuutGTtttttttTX
46 21 XTuuuutGTttttttttTX
47 21 XTuuuttGTttTttttttTX
48 21 XTuutttGTttTTtttttTX
49 22 XTuutttGTttTXXTtttTX
50 23 XuutttGTtttX.XTtttTX
51 24 XuutttGTtttXX.XTuutTX
52 24 XPqqpppppPPpPX.XTuutTX
53 23 XPqqqqppPpppppPX.XTuutX
54 22 XPqqqppPXPPppppPX.XuffX
55 21 XPqqpppX.XPpppppPXlffssX
56 21 XPqqppPX..XPPppppXffssX
57 21 XPqppPX....XPppppPXssX
58 20 XHKKKX......XPpppPX
59 19 XKKKKKX......XHKKKKX
60 19 XXXXXXX......XXXXXXX
39 21 lH.lH
40 21 HX.HX
41 21 GX.GX
42 21 GRRGX
43 21 XGrrX
44 21 XGrrX
45 21 XGrrX
46 21 XGrrX
47 21 XGrrX
48 21 XGrrX
49 21 XGRRX
50 21 XRRX
53 29 XRX........................XRX
54 30 XrX......................XrX
55 31 XhrX....................XhrX
56 32 XhrrX..................XrrhX
57 33 XhrrXX......XGRX.....XXrrhX
58 34 XXhrrXXXXXXXGRXXXXXXXrrhXX
59 36 XXXrrrrRRRRGGRRRrrrrXXX
60 39 XXXXXXXXXXXXXXXXXXX
53 32 GGGGGGGGGGGGGGGGGGGGGGGGG
''')
frame('actions','sleep_b','''
21 29 XXXXXXXX
22 27 XXHHHKKKKKXX
23 26 XHHHKKKKKKKKKX
24 25 XHHKKKKKKKKKKKX
25 24 XHKKKKKKKKKKKKKX
26 23 XKKKKKKKKKKKKKKKX
27 21 XRRXKKKKKKKKKKKKKX
28 20 XrhrXKKKKHHKXllllffX
29 19 XrhhRXKKKKKXlllllfffX
30 20 XRrRXKKKKKXlllllffffX
31 20 XKKKXKKKKXllfffssfffX
32 19 XHKKXKKKKXlffffXXfffX
33 18 XHKKXKKKKXlfffffffffX
34 18 XKKKXKKKKXlffffffffssX
35 18 XKKKXXKKKXsfffffffssX
36 18 XKKKX.XKKXsffffsfssX
37 18 XKKKX..XXXssffffssX
38 18 XKKKX....XssssssX
39 18 XKKKX.....XsffsX
40 18 XKKX......XsffsX
41 18 XKKX....XXTullfsTXX
42 18 XKKX...XTuuuulflTTtX
43 18 XKKX..XTuuuuuuGTttttX
44 18 XKKX.XTuuuuutGTtttttTX
45 18 XKXXTuuuuutGTttttttTX
46 18 XX.XTuuuutGTtttttttTX
47 21 XTuuuutGTttttttttTX
48 21 XTuuuttGTttTttttttTX
49 22 XTuutttGTttTXXTtttTX
50 23 XuutttGTtttX.XTtttTX
51 24 XuutttGTtttXX.XTuutTX
52 24 XPqqpppppPPpPX.XTuutTX
53 23 XPqqqqppPpppppPX.XTuutX
54 22 XPqqqppPXPPppppPX.XuffX
55 21 XPqqpppX.XPpppppPXlffssX
56 21 XPqqppPX..XPPppppXffssX
57 21 XPqppPX....XPppppPXssX
58 20 XHKKKX......XPpppPX
59 19 XKKKKKX......XHKKKKX
60 19 XXXXXXX......XXXXXXX
40 21 lH.lH
41 21 HX.HX
42 21 GX.GX
43 21 GRRGX
44 21 XGrrX
45 21 XGrrX
46 21 XGrrX
47 21 XGrrX
48 21 XGrrX
49 21 XGRRX
50 21 XRRX
53 29 XRX........................XRX
54 30 XrX......................XrX
55 31 XhrX....................XhrX
56 32 XhrrX..................XrrhX
57 33 XhrrXX......XGRX.....XXrrhX
58 34 XXhrrXXXXXXXGRXXXXXXXrrhXX
59 36 XXXrrrrRRRRGGRRRrrrrXXX
60 39 XXXXXXXXXXXXXXXXXXX
53 32 GGGGGGGGGGGGGGGGGGGGGGGGG
''')

def replace_rows(group, name, rows):
    """Apply independently selected complete row runs, clearing only those rows."""
    p=ROOT/group/(name+'.pxgrid')
    grid=[list(row) for row in p.read_text().splitlines()]
    for y,runs in rows:
        grid[y]=list('.'*64)
        for x,ink in runs:
            for j,symbol in enumerate(ink): grid[y][x+j]=symbol
    p.write_text('\n'.join(''.join(row) for row in grid)+'\n')

replace_rows('poses','idle_a',[
(38,[(21,'XGRRXttGTtttX'),(36,'XTuutTX'),(49,'G..XhrX')]),
(39,[(21,'XRRXtttGTtttX'),(38,'XTuutttTX'),(49,'GXhrX')]),
(40,[(23,'XffffXTttttX'),(40,'XTuuuulffXGRX')]),
(41,[(23,'XlffsXTttttX'),(41,'XTTTssffsXGRX')]),
(42,[(24,'XsssXTrhrTTX'),(43,'XXXsssXGRX')])])
replace_rows('poses','idle_b',[
(37,[(21,'XGRRXtGTtttX'),(35,'XTuutTX'),(49,'G...XhrX')]),
(38,[(21,'XRRXttGTtttX'),(37,'XTuutTX'),(49,'G..XhrX')]),
(39,[(23,'XffffXTttttX'),(39,'XTuutttTX'),(49,'GXhrX')]),
(40,[(23,'XlffsXTttttX'),(40,'XTuuulfffXGRX')]),
(41,[(24,'XsssXTrhrTTX'),(41,'XTTssffssXGRX')]),
(42,[(25,'XTTTTrhrrTTX'),(43,'XXssssXGRX')])])
replace_rows('poses','idle_c',[
(38,[(21,'XGrrXttGTtttX'),(36,'XTuutTX'),(49,'G..XhrX')]),
(39,[(21,'XGRRXttGTtttX'),(38,'XTuutttTX'),(49,'GXhrX')]),
(40,[(21,'XRRXffXTttttX'),(40,'XTuuuulffXGRX')]),
(41,[(23,'XlffsXTttttX'),(41,'XTTTssffsXGRX')]),
(42,[(24,'XsssXTrhrTTX'),(43,'XXXsssXGRX')])])
replace_rows('actions','poison_a',[
(43,[(23,'XTuuuttGTtttX'),(43,'G.XhrX')]),
(44,[(24,'XTuuuuttGTtttXX'),(43,'GXhrX')]),
(45,[(25,'XTuuuuttTTTTlffsssXGRX')]),
(46,[(26,'XTTttttttTTTssfffXGRX')]),
(47,[(27,'XTTTTTTTTTTTXXsssXGRX')]),
(48,[(27,'XPqqppqqpppPPX'),(43,'GXrX')]),
(49,[(27,'XPqqqqpppppPPX'),(43,'G.XrX')])])
replace_rows('actions','poison_b',[
(45,[(24,'XTuuuttGTtttX'),(44,'G.XhrX')]),
(46,[(25,'XTuuuuttGTtttXX'),(44,'GXhrX')]),
(47,[(26,'XTuuuuttTTTTlffsssXGRX')]),
(48,[(27,'XTTttttttTTTssfffXGRX')]),
(49,[(28,'XTTTTTTTTTTTXXsssXGRX')]),
(50,[(28,'XPqqppqqpppPPX'),(44,'GXrX')]),
(51,[(28,'XPqqqqpppppPPX'),(44,'G.XrX')])])
replace_rows('actions','sleep_a',[
(34,[(18,'XKKKXXKKKXsfffffffssX'),(48,'XRX')]),
(35,[(18,'XKKKX.XKKXsffffsfssX'),(49,'XhrX')]),
(36,[(18,'XKKKX..XXXssffffssX'),(50,'XhrX')]),
(37,[(18,'XKKKX....XssssssX'),(48,'G..XhrX')]),
(38,[(18,'XKKKX.....XsffsX'),(48,'G...XhrX')]),
(39,[(18,'XKKX......XsffsX'),(48,'G....XhrX'),(21,'lH.lH')]),
(40,[(18,'XKKX...XXTullfsTXX'),(48,'G.....XrX'),(21,'HX.HX')]),
(41,[(18,'XKKX..XTuuuulflTTtX'),(48,'G.....XrX'),(21,'GX.GX')]),
(42,[(18,'XKKX.XTuuuuuuGTttttX'),(48,'G.....XrX'),(21,'GRRGX')]),
(43,[(18,'XKKXXTuuuuutGTtttttTX'),(48,'G.....XrX'),(21,'XGrrX')]),
(44,[(18,'XKXXTuuuuutGTttttttTX'),(48,'G.....XrX'),(21,'XGrrX')]),
(45,[(18,'XX.XTuuuutGTtttttttTX'),(48,'G....XhrX'),(21,'XGrrX')]),
(46,[(21,'XTuuuutGTttttttttTX'),(48,'G....XhrX'),(21,'XGrrX')]),
(47,[(21,'XTuuuttGTttTttttttTX'),(48,'G...XhrX'),(21,'XGrrX')]),
(48,[(21,'XTuutttGTttTTtttttTX'),(48,'G..XhrX'),(21,'XGrrX')]),
(49,[(21,'XGRRXttGTttTXXTtttTX'),(48,'G.XhrX')]),
(50,[(21,'XRRXutttGTtttX.XTuutTX'),(48,'GXhrX')]),
(51,[(24,'XuffXTTTTTTTX...XTuuuulffXGRX')]),
(52,[(24,'XlffsXPqqppPPX...XTTTssffsXGRX')]),
(53,[(24,'XsssXPqqqppppPX....XXsssXGRX')]),
(54,[(23,'XPqqppPqqqppppPX'),(48,'GXrX')]),
(55,[(22,'XPqqppXPPqqpppppX'),(48,'G.XrX')]),
(56,[(22,'XPqppPX..XPqqppppX'),(48,'G..XrX')]),
(57,[(22,'XPppPX....XPqpppPX'),(48,'G..XrX')]),
(58,[(21,'XHKKKX.....XPPppPX'),(48,'G.XrX')]),
(59,[(20,'XKKKKKX.....XHHKKKX'),(48,'GXrX')]),
(60,[(20,'XXXXXXX.....XXXXXXX'),(48,'XrX')])])
replace_rows('actions','sleep_b',[
(35,[(18,'XKKKXXKKKXsfffffffssX'),(48,'XRX')]),
(36,[(18,'XKKKX.XKKXsffffsfssX'),(49,'XhrX')]),
(37,[(18,'XKKKX..XXXssffffssX'),(50,'XhrX')]),
(38,[(18,'XKKKX....XssssssX'),(48,'G..XhrX')]),
(39,[(18,'XKKKX.....XsffsX'),(48,'G...XhrX')]),
(40,[(18,'XKKX......XsffsX'),(48,'G....XhrX'),(21,'lH.lH')]),
(41,[(18,'XKKX....XXTullfsTXX'),(48,'G....XrX'),(21,'HX.HX')]),
(42,[(18,'XKKX...XTuuuulflTTtX'),(48,'G....XrX'),(21,'GX.GX')]),
(43,[(18,'XKKX..XTuuuuuuGTttttX'),(48,'G....XrX'),(21,'GRRGX')]),
(44,[(18,'XKKX.XTuuuuutGTtttttTX'),(48,'G....XrX'),(21,'XGrrX')]),
(45,[(18,'XKXXTuuuuutGTttttttTX'),(48,'G....XrX'),(21,'XGrrX')]),
(46,[(18,'XX.XTuuuutGTtttttttTX'),(48,'G...XhrX'),(21,'XGrrX')]),
(47,[(21,'XTuuuutGTttttttttTX'),(48,'G...XhrX'),(21,'XGrrX')]),
(48,[(21,'XTuuuttGTttTttttttTX'),(48,'G..XhrX'),(21,'XGrrX')]),
(49,[(21,'XGRRXttGTttTXXTtttTX'),(48,'G.XhrX')]),
(50,[(21,'XRRXutttGTtttX.XTuutTX'),(48,'GXhrX')]),
(51,[(24,'XuffXTTTTTTTX...XTuuuulffXGRX')]),
(52,[(24,'XlffsXPqqppPPX...XTTTssffsXGRX')]),
(53,[(24,'XsssXPqqqppppPX....XXsssXGRX')]),
(54,[(23,'XPqqppPqqqppppPX'),(48,'GXrX')]),
(55,[(22,'XPqqppXPPqqpppppX'),(48,'G.XrX')]),
(56,[(22,'XPqppPX..XPqqppppX'),(48,'G..XrX')]),
(57,[(22,'XPppPX....XPqpppPX'),(48,'G..XrX')]),
(58,[(21,'XHKKKX.....XPPppPX'),(48,'G.XrX')]),
(59,[(20,'XKKKKKX.....XHHKKKX'),(48,'GXrX')]),
(60,[(20,'XXXXXXX.....XXXXXXX'),(48,'XrX')])])
# Individually selected calm 3/4 face clusters. Far eye leaves skin before nose.
# Closed lids use slate H in a horizontal run, distinct from idle's black pupil.
def pixels(group,name,records):
    p=ROOT/group/(name+'.pxgrid')
    rows=[list(row) for row in p.read_text().splitlines()]
    for y,x,ink in records:
        for j,s in enumerate(ink): rows[y][x+j]=s
    p.write_text('\n'.join(''.join(r) for r in rows)+'\n')
pixels('poses','idle_a',[(18,33,'HHHfH'),(19,33,'XH'),(19,37,'X')])
pixels('poses','idle_b',[(18,33,'HHHfH'),(19,33,'XH'),(19,37,'X')])
pixels('poses','idle_c',[(18,33,'HHHfH'),(19,33,'XH'),(19,37,'X')])
pixels('poses','windup',[(18,32,'HHHfH'),(19,32,'XH'),(19,36,'X')])
pixels('poses','move',[(19,35,'HHHfH'),(20,35,'XH'),(20,39,'X')])
pixels('poses','attack',[(18,36,'HHHfH'),(19,36,'XH'),(19,40,'X')])
pixels('poses','recover',[(18,34,'HHHfH'),(19,34,'XH'),(19,38,'X')])
pixels('poses','hit',[(21,28,'HHfffH'),(22,28,'sHX'),(22,33,'H')])
pixels('poses','dead',[(46,23,'fffffs'),(47,23,'sHHHsH'),(48,23,'ffffff')])
pixels('actions','skill_a',[(18,32,'HHHfH'),(19,32,'XH'),(19,36,'X')])
pixels('actions','skill_b',[(18,35,'HHHfH'),(19,35,'XH'),(19,39,'X')])
pixels('actions','skill_c',[(19,34,'HHHfH'),(20,34,'XH'),(20,38,'X')])
pixels('actions','poison_a',[(22,32,'HHHfH'),(23,32,'HfX'),(23,36,'X')])
pixels('actions','poison_b',[(24,33,'HHHfH'),(25,33,'HfX'),(25,37,'X')])
pixels('actions','stun_a',[(24,33,'sHHHsH'),(25,33,'fffffs')])
pixels('actions','stun_b',[(25,34,'sHHHsH'),(26,34,'fffffs')])
pixels('actions','sleep_a',[(30,33,'ffffff'),(31,33,'sHHHsH'),(32,33,'ffffff')])
pixels('actions','sleep_b',[(31,33,'ffffff'),(32,33,'sHHHsH'),(33,33,'ffffff')])
# Drawn bow hand: the wrist and fingers precede one single grip at x52.
# The arrow runs above the forearm; no gold shaft replaces the sleeve face.
replace_rows('poses','windup',[
(29,[(17,'XKKGRRGXuuulflTTTssffX'),(39,'G'),(53,'XhrX')]),
(30,[(17,'XKKXGrrXuuuGTttttTX'),(35,'XsfffX'),(38,'GGGGGGGGGGGGGGGGGG'),(52,'XhrX')]),
(31,[(17,'XKXXGrrXuuGTttttX'),(34,'XsfffTTuuuuuttlfffXGRX')]),
(32,[(17,'XX.XGrrXuGTtttttX'),(33,'XsfffTTtttttttssffXGRX')]),
(33,[(20,'XGrrXGTttttttTX'),(32,'XTuffXTTTTTTTTTTTTXGRX')]),
(34,[(19,'XXGrrXTttttttTX'),(32,'XTuuX'),(40,'G'),(52,'XrX')]),
(35,[(19,'XXGrrXTttttTTTX'),(32,'XTTX'),(41,'G'),(53,'XrX')])])
replace_rows('poses','move',[
(30,[(18,'GRRGXuuuuuuuGTtttTTX'),(37,'XsfffX'),(40,'GGGGGGGGGGGGGGGGGG'),(53,'XhrX')]),
(31,[(18,'XGrrXuuuuuGTtttttX'),(36,'XsfffTTuuuuuttlfffXGRX')]),
(32,[(18,'XGrrXuuuGTttttttX'),(35,'XsfffTTtttttttssffXGRX')]),
(33,[(18,'XGrrXuuGTttttttTX'),(34,'XTuffXTTTTTTTTTTTTXGRX')]),
(34,[(18,'XGrrXuGTttttTTTX'),(34,'XTuuX'),(42,'G'),(53,'XrX')]),
(35,[(18,'XGrrXuGTttttTX'),(34,'XTTX'),(43,'G'),(54,'XrX')])])
replace_rows('poses','attack',[
(30,[(19,'XGrrXXTuusXtttttTX'),(36,'XTTuuuuuuuuuuTTX'),(50,'GXhrX'),(60,'GXX')]),
(31,[(19,'XGrrXTuuuXttttttTX'),(37,'XTuuuuuutttlffssXGRX'),(56,'GGGGGGX')]),
(32,[(19,'XGrrXuuuXttttttTXX'),(38,'XTTttttttTTssffXGRX'),(60,'GXX')]),
(33,[(19,'XGrrXuuXttttTTTX'),(39,'XTTTTTTTTTTTTXXGRX'),(59,'GX')])])
replace_rows('actions','skill_a',[
(29,[(17,'XKKGRRGXuuulflTTTssffX'),(39,'G'),(47,'rh.rh'),(53,'XhrX')]),
(30,[(17,'XKKXGrrXuuuGTttttTX'),(35,'XsfffX'),(38,'GGGGGGGG'),(46,'RveeeehR'),(54,'XrX')]),
(31,[(17,'XKXXGrrXuuGTttttX'),(34,'XsfffTTuuuuuttlfffXGRX'),(53,'heh')]),
(32,[(17,'XX.XGrrXuGTtttttX'),(33,'XsfffTTtttttttssffXGRX'),(53,'heh')]),
(33,[(20,'XGrrXGTttttttTX'),(32,'XTuffXTTTTTTTTTTTTXGRX'),(54,'hr')]),
(34,[(19,'XXGrrXTttttttTX'),(32,'XTuuX'),(40,'G'),(47,'RvehR'),(52,'XrX')]),
(35,[(19,'XXGrrXTttttTTTX'),(32,'XTTX'),(41,'G'),(47,'rh.rh'),(53,'XrX')])])
replace_rows('actions','skill_b',[
(30,[(18,'XGrrXXTuusXtttttTX'),(35,'XTTuuuuuuuuuuTTX'),(49,'GXhrX'),(54,'Rvveeeeh')]),
(31,[(18,'XGrrXTuuuXttttttTX'),(36,'XTuuuuuutttlffssXGRX'),(54,'heeeeeeeh')]),
(32,[(18,'XGrrXuuuXttttttTXX'),(37,'XTTttttttTTssffXGRX'),(54,'Rvveeeeeh')]),
(33,[(18,'XGrrXuuXttttTTTX'),(38,'XTTTTTTTTTTTTXXGRX'),(55,'hrhveeeh')])])
# Nose/cheek edge: one selected skin pixel widens the visible face to 12 px.
# Each pose's actual edge is specified, never transformed from another frame.
pixels('poses','idle_a',[(20,38,'fX'),(21,39,'sX'),(22,38,'sX')])
pixels('poses','idle_b',[(20,38,'fX'),(21,39,'sX'),(22,38,'sX')])
pixels('poses','idle_c',[(20,38,'fX'),(21,39,'sX'),(22,38,'sX')])
pixels('poses','windup',[(20,37,'fX'),(21,38,'sX'),(22,37,'sX')])
pixels('poses','move',[(21,41,'fX'),(22,42,'sX'),(23,41,'sX')])
pixels('poses','attack',[(20,42,'fX'),(21,43,'sX'),(22,42,'sX')])
pixels('poses','recover',[(20,39,'fX'),(21,40,'sX'),(22,39,'sX')])
pixels('poses','hit',[(23,33,'fX'),(24,34,'sX'),(25,33,'sX')])
pixels('actions','skill_a',[(20,37,'fX'),(21,38,'sX'),(22,37,'sX')])
pixels('actions','skill_b',[(20,41,'fX'),(21,42,'sX'),(22,41,'sX')])
pixels('actions','skill_c',[(21,39,'fX'),(22,40,'sX'),(23,39,'sX')])
pixels('actions','poison_a',[(24,37,'fX'),(25,38,'sX'),(26,37,'sX')])
pixels('actions','poison_b',[(26,38,'fX'),(27,39,'sX'),(28,38,'sX')])
pixels('actions','stun_a',[(26,38,'fX'),(27,39,'sX'),(28,38,'sX')])
pixels('actions','stun_b',[(27,39,'fX'),(28,40,'sX'),(29,39,'sX')])
pixels('actions','sleep_a',[(32,39,'fX'),(33,39,'sX'),(34,38,'sX')])
pixels('actions','sleep_b',[(33,39,'fX'),(34,39,'sX'),(35,38,'sX')])
# Leaning heads: rewritten complete rows remove mischosen nose/eye pixels.
# The ponytail is behind the skull; the face gets 12 contiguous skin pixels.
replace_rows('poses','move',[
(19,[(16,'XHKKX..XKKKXllfffHHHfHffX'),(53,'XhrX')]),
(20,[(15,'XHKKX...XKKKXlffffXHffXffX'),(54,'XhrX')]),
(21,[(14,'XHKKX....XKKKXlfffffffffffX'),(49,'G.....XhrX')]),
(22,[(14,'XKKKX....XKKKXlfffffffffssX'),(48,'G.......XrX')]),
(23,[(14,'XKKX.....XKKKXsfffffffsssX'),(47,'G........XrX')]),
(24,[(14,'XKKX......XKKXsffffsfssX'),(46,'G.........XrX')]),
(25,[(14,'XKKX.......XXssffffssX'),(45,'G..........XrX')]),
(26,[(15,'XKKX........XsssssX'),(44,'G...........XrX')])])
replace_rows('poses','attack',[
(18,[(17,'XHKKX..XKKKXllfffHHHfHffX'),(53,'XhrX')]),
(19,[(16,'XHKKX...XKKKXlffffXHffXffX'),(50,'G..XhrX')]),
(20,[(15,'XHKKX....XKKKXlfffffffffffX'),(50,'G...XhrX')]),
(21,[(15,'XKKKX....XKKKXlfffffffffssX'),(50,'G....XrX')]),
(22,[(15,'XKKX.....XKKKXsfffffffsssX'),(50,'G....XrX')]),
(23,[(15,'XKKX......XKKXsffffsfssX'),(50,'G....XrX')]),
(24,[(15,'XKKX.......XXssffffssX'),(50,'G....XrX')]),
(25,[(16,'XKKX........XsssssX'),(50,'G....XrX')])])
replace_rows('actions','skill_b',[
(18,[(16,'XHKKX..XKKKXllfffHHHfHffX'),(52,'XhrX')]),
(19,[(15,'XHKKX...XKKKXlffffXHffXffX'),(49,'G..XhrX')]),
(20,[(14,'XHKKX....XKKKXlfffffffffffX'),(49,'G...XhrX')]),
(21,[(14,'XKKKX....XKKKXlfffffffffssX'),(49,'G....XrX')]),
(22,[(14,'XKKX.....XKKKXsfffffffsssX'),(49,'G....XrX')]),
(23,[(14,'XKKX......XKKXsffffsfssX'),(49,'G....XrX'),(52,'Rh')]),
(24,[(14,'XKKX.......XXssffffssX'),(49,'G....XrX'),(52,'Rvh')]),
(25,[(15,'XKKX........XsssssX'),(49,'G....XrX'),(53,'Rveh')])])
replace_rows('poses','dead',[
(60,[(26,'XXXXXXXXXXXXXXXXsssXXXXPPPXX'),(30,'XXXXXGGGGGGGGXXXXX'),(56,'XXXXXX')])])
