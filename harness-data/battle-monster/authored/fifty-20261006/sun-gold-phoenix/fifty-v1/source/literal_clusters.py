"""Hand chosen horizontal pixel strings. No geometric or frame transforms.
Each line is x followed by the literal pixels at successive y coordinates.
Final .pxgrid files contain all 128 literal rows; this preserves the working marks.
"""
PALETTE = {
'k':'#2B1C2B', 's':'#592638', 'r':'#922F3F', 'v':'#C54A36',
'o':'#E9793D', 'a':'#F2AF4E', 'g':'#F9D777', 'h':'#FFF0B4',
'b':'#41493E', 'c':'#71815B', 'd':'#B6B776', 'e':'#172330',
't':'#305B63', 'u':'#639891', 'p':'#865793', 'q':'#BDCA83',
'f':'#FFFDDF'
}
# An asymmetric belly: left light, right cool crimson shadows, joined shoulder.
BODY = (43, '''
61 kkkksrrkkkk
57 kkkroaavvvrrrskk
54 kkrvoaaaaaovvvrrssk
52 krvoaaggggaaaovvvrrssk
50 krvoaagggggggaaovvvrrssk
49 krvoaagghhggggaaovvvrrssk
48 krvoaagghhhgggaaaovvvrrssk
47 krvoaagghhhgggaaaovvvvrrssk
46 krvoaagghhgggaaaaovvvvrrssk
46 krooaagggggaaaaaovvvvvrrssk
45 krvoaaaggggaaaaovvvvvvrrsssk
45 krvoaaaaggaaaaoovvvvvvrrsssk
44 krvvoaaaaaaaaoovvvvvvvrrsssk
44 krvvoaaaaaaaoovvvvvvvvrrsssk
44 krvvvoaaaaaoovvvvvvvvrrssssk
43 krvvvvoaaaovvvvvvvvvvrrssssk
43 krvvvvoaaovvvvvvvvvvvrrssssk
43 krvvvvoaovvvvvvvvvvvrrrssssk
43 krvvvvoovvvvvvvvvvvvrrrssssk
42 krvvvvoovvvvvvvvvvvvrrrsssskk
42 krvvvvoovvvvvvvvvvvrrrssssskk
42 krvvvvoovvvvvvvvvvvrrrssssskk
42 krvvvvoovvvvvvvvvvvrrrssssskk
42 krvvvvoovvvvvvvvvvrrrssssskkk
43 krvvvvoovvvvvvvvvrrrssssskkk
43 krvvvvoovvvvvvvvvrrrssssskkk
43 krvvvvoovvvvvvvvrrrssssskkk
44 krvvvvoovvvvvvvvrrrssssskkk
44 krvvvvoovvvvvvvrrrssssskkkk
45 krvvvvoovvvvvvrrrssssskkkk
45 krvvvvoovvvvvvrrrssssskkkk
46 krvvvvoovvvvvrrrsssssktuk
46 krvvvvoovvvvvrrrssssktuuk
47 krvvvvoovvvvrrrssssktuuk
47 krvvvvoovvvvrrrssssktuuk
48 krvvvvoovvvvrrrssssktuuuk
48 krvvvvoovvvvrrrssssktuuuk
49 krvvvvoovvvrrrsssssktuuuk
49 krvvvvoovvvrrrsssssktuuuk
50 krvvvvoovvvrrrsssssktuuuk
50 krvvvvoovvvrrrsssssktuuuk
51 krvvvvoovvrrrssssssktuuuk
51 krvvvvoovvrrrssssssktuuk
52 krvvvvoovvrrrsssssktuuk
52 krvvvvoovvrrrsssssktuuk
53 krvvvvoovvrrrsssssktuk
53 krvvvvoovvrrrssssktuk
54 krvvvvoovvrrrsssskkk
54 krvvvvoovvrrrsssskk
55 krvvvvoovvrrrssssk
55 krvvvooovvrrrssskk
56 krvvvooovvrrrsssk
56 krvvvooovvrrrsssk
57 krvooooovvrrrssk
57 krooooovvrrrssk
58 kroooovvrrrssk
59 krooovvrrrssk
60 krovvrrrssk
61 krvvrrssk
62 krrrsskk
63 kssskk
64 kkkk
''')
# Crest tips are individual hooked plumage, golden beak at the right of small eye.
HEAD = (6, '''
87 kk
86 kagk
86 kaghk
85 kaaghk
84 kraahk
83 kroaghk
81 kkrvoagk....kk
79 kkrvvoagk...kagk
77 kkrvvvoagk..kaghk
76 krvovvvaagk.kaghk
75 kroovvvvaagkkaghk
74 krooovvvvaaggaghk
73 kroaoovvvaaggggk
72 kroaaoovvaaggagk
72 kroaaaoovaaggagk
73 kroaaaaooaagggk
74 krooaaaaoaaggk
74 krvoaaaaoaagk
74 krvooooaaaak
73 krvvoooaagggkk
72 krvoooaagghhggkk
72 kroooaagghhhggaakk
71 kroooaagghhhhggaaak
71 kroooaagghhhhgggaaak
71 kroooaagghhgkkgggaaak
71 kroooaagghgkeekgggaaakk
72 kroooaagggekehkggghhgggaakk
72 krvooaagggeekggghhhgggaaaggkk
73 krvooaaggggggghhhgggaaaagggggkk
74 krvooaagggggggggaaaaggghhhhgggaakk
75 krvoaaaggggaaaaaggghhhhhgggaaak
75 krvooaaaaaaaagggggaaaaaaakkk
75 krvoooaaaaaaaaggggkkkkkk
75 krvooooaaaaaaaagggk
74 krvoooooaaaaaaaaak
74 krvooooooaaaaaaaak
73 krvoooooooaaaaaak
73 krvoooooooaaaagk
72 krvoooooooaaagk
72 krvoooooooaaagk
71 krvoooooooaaagk
71 krvoooooooaaagk
70 krvooooooooaaagk
70 krvooooooooaaagk
69 krvoooooooooaaagk
69 krvoooooooooaaagk
68 krvoooooooooaaaagk
67 krvooooooooooaaagk
66 krvooooooovvoaaagk
65 krvoooooovvvvoaaagk
64 krvooooovvvvvoaaagk
63 krvoooovvvvvvoaaaagk
62 krvooovvvvvvvoaaaagk
61 krvoovvvvvvvvvoaaaagk
60 krvoovvvvvvvvvoaaaagk
59 krvoovvvvvvvvvoaaaagk
58 krvoovvvvvvvvvvoaaagk
57 krvoovvvvvvvvvvoaaagk
56 krvoovvvvvvvvvvoaaagk
55 krvoovvvvvvvvvvoaaagk
''')
# Three individually diverging tail feathers. Gold tips, teal eyes, red coverts.
TAIL = (68, '''
25 kkkkkkkk
21 kkkrrvvooaakk
18 kkrrvvvoooaagkk
16 krrvvvvoooaaagggkk
14 krrvvvooooaaaggggakk
12 krrvvvoooaaaggggaarrkk
11 krrvvvoooaaaggggaaavrrrkk
10 krrvvvoooaaaggggaaaovvrrrkk
9 krrvvvoooaaaggggaaaovvvrrrskk
8 krrvvvoooaaaggggaaaovvvvrrrsskk
8 krvvooooaaaggggaaaovvvvrrrssskkk
7 krvvooooaaaggggaaaovvvvrrrsssrkkk
7 krvoooooaaaggggaaovvvvrrrsssrraakk
6 krvoooooaaaggggaaovvvvrrrsssrragggkk
6 krvoooooaaaggggaaovvvrrrssssrraggggkk
6 krvoooooaaaggggaaovvvrrrssssrraaaggggkk
6 kroooooaaaggggaaovvvrrrssssrrrraaaggggkk
6 krooooaaaggggaaaovvrrrssssrrrraaaaggggkk
6 kroooaaaggggaaaovvrrrssssrrrraaaaggggakk
6 krooaaaggggaaovvrrrssssrrrraaaagggaaarrkk
6 kroaaaggggaovvrrrssssrrrraaaagggaaavvvrrkk
7 kraaggggaovvrrrsssssrrrraaaagggaaavvvvrrskk
7 kaagggaovvrrrssssksrrrraaaagggaaavvvvrrssk
7 kagggaovvrrrsssk..krrraaaagggaaavvvvrrssk
7 kagggaovvrrsssk...krraaaagggaaavvvvrrssk
7 kaggaovvrrssk....krraaaagggaaavvvvrrssk
7 kaggoovrrsk.....krraaaagggaaavvvvrrssk
7 kagovvrsk......krraaaagggaaavvvvrrssk
7 kaovrsk.......krraaaagggaaavvvvrrssk
7 kavrsk.......krraaaagggaaavvvvrrssk
7 karsk.......krraaaagggaaavvvvrrssk
7 kask.......krraaaagggaaavvvvrrssk
7 kkk.......krraaaagggaaavvvvrrssk
17 krraaagggaaavvvvrrssk
16 krraagggaaavvvvrrsssk
15 kraaagggaavvvvrrsssk
14 kraaagggaavvvvrrsssk
13 kraaagggaavvvvrrsssk
12 kraaagggaavvvvrrsssk
11 kraaagggaavvvvrrsskk
10 kraaagggaavvvvrrsskk
9 kraaagggaavvvvrrsskk
8 kraaagggaavvvvrrssk
8 kraaagggaavvvvrrssk
7 kraaagggaavvvvrrssk
7 kraaagggaavvvvrrssk
7 kraaggtttuvvvrrssk
7 kraagttuuutvrrssk
8 kragttuquutrrssk
9 kraggttuutrrssk
10 kraggtttrrsskk
11 kraaggrssk
12 kraaggsk
13 kaaggk
14 kaggk
15 kkk
''')
# Near folded wing: broad shoulder planes, long curved overlapping feather fans.
WING = (40, '''
48 kkkkk
45 kkroaagkkk
43 kroaaaggggakk
41 kroaaaggggggaaakk
39 kroaaagghhggggaaakk
37 kroaaagghhhggggaaaakk
35 kroaaagghhhhggggaaaakk
33 kroaaagghhhhggggaaaaakk
31 kroaaagghhhhggggaaaaaovkk
30 kroaaagghhhhggggaaaaaovvrkk
29 kroaaagghhhhggggaaaaaovvvrrk
28 kroaaagghhhhggggaaaaaovvvrrsk
27 kroaaagghhhhggggaaaaovvvvrrssk
26 kroaaagghhhhggggaaaovvvvvrrssk
25 kroaaagghhhggggaaaaovvvvvrrsssk
24 kroaaagghhhgggaaaaovvvvvvrrsssk
24 kroaaagghhgggaaaaovvvvvvvrrsssk
23 kroaaagghgggaaaaovvvvvvvvrrsssk
23 kroaaagggggaaaovvvvvvvvvrrrsssk
23 kroaaaggggaaovvvvvvvvvvrrrssssk
23 kroaaagggaaovvvvvvvvvvvrrrssssk
23 kroaaaggaaovvvvvvvvvvvvrrrssssk
23 kroaaaggaovvvvvvvvvvvvrrrsssssk
23 kroaaagovvvvvvvvvvvvvvrrrsssssk
23 kroaaagovvvvvvvvvvvvvrrrsssssskk
23 kroaaagovvvvvvvvvvvvvrrrssssssk
24 kroaaagovvvvvvvvvvvvrrrsssssssk
24 kroaaagovvvvvvvvvvvrrrsssssssk
25 kroaaagovvvvvvvvvvrrrsssssssk
25 kroaaagovvvvvvvvvrrrssssssskoak
26 kroaaagovvvvvvvvrrrsssssskoaagk
26 kroaaagovvvvvvvrrrssssssskoaggk
27 kroaaagovvvvvvrrrsssssskoaggghk
27 kroaaagovvvvvrrrsssssskoaggghhk
28 kroaaagovvvvrrrssssskroaggghhk
28 kroaaagovvvrrrssssskroaggghhk
29 kroaaagovvrrrssssskroaggghhk
29 kroaaagovrrrssssskoaggghhk
30 kroaaagorrsssssskoaggghhk
30 kroaaagrrsssssskoaggghhk
31 kroaagrrssssskoaggghhk
31 kroaagrrsssskoaggghhk
32 kroaagrrssskoaggghhk
32 kroaagrrsskoaggghhk
33 kroaagrrskoaggghhk
33 kroaagrrkoaggghhk
34 kroaagrrkoaggghhk
34 kroaagrrkoaggghk
35 kroaagrrkoaggghk
35 kroaagrrkoaggghk
36 kroaagrrkoagghk
36 kroaagrrkoagghk
37 kroaagrrkoagghk
37 kroaagrrkoagghk
38 kroaagrrkoagghk
38 kroaagrrkoagghk
39 kroaagrrkoagghk
39 kroaagrrkoagghk
40 kroaagrrkoagghk
40 kroaagrrkoagghk
41 kroaagrrkoagghk
41 kroaagrrkoaggk
42 kroaagrrkoagk
42 kroaagrrkak
43 kroaagrrkk
44 kraagrkk
45 kkakk
''')
LEGS = (101, '''
63 kbbccbk.............kbcccbk
63 kbcccbk.............kbcdcck
63 kbcdcbk.............kbddcck
64 kbddck..............kbddcck
64 kbddck..............kbddcck
64 kbddck..............kbddcck
64 kbddck..............kbddcck
64 kbddck..............kbddcck
64 kbddck..............kbddcck
64 kbddck..............kbddcck
64 kbddck..............kbddcck
64 kbddck..............kbddcck
63 kbcddck.............kbddcck
63 kbcddck.............kbddcck
62 kbccddck...........kbddccck
61 kbccddcck..........kbddccck
60 kbcccdddck.........kbddccck
59 kbcccccddck........kbddcccckk
58 kbcccdccddck.......kbddccddccckk
57 kbccdcccddcck.....kbcdccccddcddck
56 kbccdcccddcccbbkkkkbccdddccccddcck
55 kbcdddccbbcccddcccbccccddccccbddddk
55 kbdddddk..kbdddddk.kbdddddck..kbdddck
55 kkkkkkk...kkkkkkk..kkkkkkk....kkkkk
''')

def canvas():
    return [list('.'*128) for _ in range(128)]

def ink(grid, block):
    y, source = block
    for row in source.strip('\n').splitlines():
        xs, pixels = row.strip().split(' ', 1)
        x = int(xs)
        assert 0 <= x and x + len(pixels) <= 128, (x, y, pixels)
        assert y < 128
        assert set(pixels) <= set(PALETTE) | {'.'}, (x, y, pixels)
        grid[y][x:x+len(pixels)] = list(pixels)
        y += 1

def idle():
    g = canvas()
    for block in [BODY, TAIL, LEGS, HEAD, WING]:
        ink(g, block)
    return g
# The first diagnostic exposed the distant shin floating beyond the narrow belly.
# This literal breast/flank closes the hip anatomically and adds a wide red plane.
BREAST = (65, '''
70 oooaaaovvvvvrrsskk
70 oooaaaovvvvvvrrsskk
70 oooaaaovvvvvvvrrsskk
69 voooaaaovvvvvvvrrsskk
69 voooaaaovvvvvvvvrrsskk
68 vvoooaaaovvvvvvvvrrsskk
68 vvoooaaaovvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvrrrsskk
67 vvvoooaaaovvvvvvvrrrsskk
67 vvvoooaaaovvvvvvvrrrsskk
67 vvvoooaaaovvvvvvvrrrsskk
67 vvvoooaaaovvvvvvrrrsskk
67 vvvoooaaaovvvvvvrrrsskk
67 vvvoooaaaovvvvvvrrrsskk
67 vvvoooaaaovvvvvrrrsskk
67 vvvoooaaaovvvvvrrrsskk
67 vvvoooaaaovvvvvrrrsskk
67 vvvoooaaaovvvvrrrsskk
67 vvvoooaaaovvvvrrrsskk
67 vvvoooaaaovvvvrrrsskk
67 vvvoooaaaovvvrrrsskk
67 vvvoooaaaovvvrrrsskk
68 vvoooaaaovvvrrrsskk
68 vvoooaaaovvvrrrsskk
69 voooaaaovvrrrsskk
70 oooaaaovvrrrsskk
71 ooaaovvrrrsskk
72 oaaovvrrrsskk
''')
TAIL_THIRD = (84, '''
44 krvoaaggggkk
43 krvoaaaggggakk
42 krvoooaaagggakk
41 krvvoooaaagggakk
40 krvvvoooaaagggakk
39 krvvvvoooaaagggakk
38 krvvvvoooaaagggakk
37 krvvvvoooaaagggakk
36 krvvvvoooaaagggakk
35 krvvvvoooaaagggakk
34 krvvvvoooaaagggakk
33 krvvvvoooaaagggakk
32 krvvvvoooaaagggakk
31 krvvvvoooaaagggakk
30 krvvvvoooaaagggakk
29 krvvvvoooaaagggakk
28 krvvvvoooaaagggakk
27 krvvvvoooaaagggakk
26 krvvvvoooaaagggakk
25 krvvvvoooaaagggakk
24 krvvvvoooaaagggakk
23 krvvvvoooaaagggakk
22 krvvvvoooaaagggakk
22 krvvvvoooaaagggakk
23 krvvvvoooaaggakk
24 krvvvvooaaggakk
25 krvvvvoaaggakk
26 krvvvoaggakk
27 krvvtttggakk
28 krrtuuuuggk
29 krtuuqqugk
30 krtuuuqgk
31 krttuggk
32 krttggk
33 kraggk
34 kragk
35 kkk
''')
WING_RIBS = (57, '''
31 aaggggaoovvvv
31 aaggggaovvvvv
31 aagggaaovvvvv
31 aagggaovvvvvv
32 agggaovvvvvvv
32 agggaovvvvvvv
33 aggaovvvvvvvv
33 aggaovvvvvvvv
34 ggaovvvvvvvvv
34 ggaovvvvvvvvv
35 gaovvvvvvvvvv
35 gaovvvvooavvv
36 aovvvvoaaovvv
36 aovvvvoagovvv
37 ovvvvoagovvv
37 ovvvvoagovvv
38 vvvvoagovvv
38 vvvvoagovvv
39 vvvoagovvv
39 vvvoagovvv
40 vvoagovvv
40 vvoagovvv
41 voagovvv
41 voagovvv
42 oagovvv
42 oagovvv
43 agovvv
43 agovvv
''')
TAIL_TIP_FIX = (80, '''
7 krvvooooaaaggggaaaovvvvrrrssskkk
7 krvvooooaaaggggaaaovvvvrrrsssrkkk
7 krvoooooaaaggggaaovvvvrrrsssrraakk
8 rvoooooaaaggggaaovvvvrrrsssrragggkk
9 voooooaaaggggaaovvvrrrssssrraggggkk
10 oooooaaaggggaaovvvrrrssssrraaaggggkk
11 ooooaaaggggaaovvvrrrssssrrrraaaggggkk
12 oooaaaggggaaaovvrrrssssrrrraaaaggggkk
13 ooaaaggggaaaovvrrrssssrrrraaaaggggakk
14 oaaaggggaaovvrrrssssrrrraaaagggaaarrkk
''')
# Replace idle construction after the actual visual corrections.
def idle():
    g = canvas()
    for block in [BODY, TAIL, TAIL_THIRD, LEGS, BREAST, HEAD, WING, WING_RIBS]:
        ink(g, block)
    # Hand-selected replacement rows taper the rear-most feather instead of a cut edge.
    ink(g, (80, '''
6 .krvvooooaaaggggaaaovvvvrrrssskkk
6 .krvvooooaaaggggaaaovvvvrrrsssrkkk
6 .krvoooooaaaggggaaovvvvrrrsssrraakk
6 ..krvooooaaaggggaaovvvvrrrsssrragggkk
6 ...krvoooaaaggggaaovvvrrrssssrraggggkk
6 ....kroooaaaggggaaovvvrrrssssrraaaggggkk
6 .....krooaaaggggaaovvvrrrssssrrrraaaggggkk
6 ......kroaaaggggaaaovvrrrssssrrrraaaaggggkk
6 .......kraaaggggaaaovvrrrssssrrrraaaaggggakk
6 ........kraagggaaovvrrrssssrrrraaaagggaaarrkk
6 .........kaagggaovvrrrssssrrrraaaagggaaavvvrrkk
6 ..........kagggaovvrrrsssssrrrraaaagggaaavvvvrrskk
6 ...........kaggaovvrrrssssksrrrraaaagggaaavvvvrrssk
6 ............kagaovvrrrsssk..krrraaaagggaaavvvvrrssk
6 .............kagovvrrsssk...krraaaagggaaavvvvrrssk
6 ..............kaovrrssk....krraaaagggaaavvvvrrssk
6 ...............kavrrsk.....krraaaagggaaavvvvrrssk
6 ................karrk......krraaaagggaaavvvvrrssk
6 .................kak.......krraaaagggaaavvvvrrssk
6 ..................k........krraaaagggaaavvvvrrssk
'''))
    return g
# Replacement of the entire tail region: three separately tapered ribbons.
# Kept behind the body and wing; every gap is a literal dot choice.
TAIL_FINAL = (73, '''
30 kkkrrvvooaagggggakk
27 kkrrvvvoooaaagggggaakk
24 krrvvvvoooaaagggggaaarrkk
21 krrvvvvoooaaagggggaaaovvrrkk
18 krrvvvvoooaaagggggaaaovvvrrkk
15 krrvvvvoooaaagggggaaaovvvvrrskk
12 krrvvvvoooaaagggggaaaovvvvrrsskk
10 krrvvvvoooaaagggggaaaovvvvrrsssrrkk
9 krvvvvoooaaagggggaaaovvvvrrssssrrakk
8 krvvvvoooaaagggggaaaovvvvrrssssrraakk
7 krvvvvoooaaagggggaaaovvvvrrssssrraaagkk
6 krvvvvoooaaagggggaaaovvvvrrssssrraaagggkk
6 krvvvvoooaaagggggaaaovvvvrrssssrraaaggggakk
6 krvvvvoooaaagggggaaaovvvvrrssssrraaaggggaakk
7 krvvoooaaagggggaaaovvvvrrssssrraaaggggaaarrkk
8 krvoooaaagggggaaaovvvvrrssssrraaaggggaaaovvrrkk
9 kroooaaagggggaaaovvvvrrssssrraaaggggaaaovvvrrkk
10 krooaaagggggaaaovvvvrrsskrrrraaaggggaaaovvvrrkk
11 kroaaaggggaaovvvvrrsskk.krrraaaggggaaaovvvrrsk
12 kraagggaaovvvvrrsskk...krrraaaggggaaaovvvrrsk
13 kraaggaovvvrrsskk.....krrraaaggggaaaovvvrrsk
14 kraagovvvrrsskk......krrraaaggggaaaovvvrrsk
15 kragovvrrsskk.......krrraaaggggaaaovvvrrsk
16 krgovrrsskk........krrraaaggggaaaovvvrrsk
17 krgorrsk.........krrraaaggggaaaovvvrrsk
18 kagrsk.........krrraaaggggaaaovvvrrssk
19 kak..........krrraaaggggaaaovvvrrsssk
20 k...........krrraaaggggaaaovvvrrsssk
30 krrraaaggggaaaovvvrrsssk
28 krrraaaggggaaaovvvrrsssk
26 krrraaaggggaaaovvvrrsssk
24 krrraaaggggaaaovvvrrsssk
22 krrraaaggggaaaovvvrrsssk
20 krrraaaggggaaaovvvrrsssk
18 krrraaaggggaaaovvvrrsssk
16 krrraaaggggaaaovvvrrsssk
14 krrraaaggggaaaovvvrrsssk
12 krrraaaggggaaaovvvrrssk
10 krrraaaggggaaaovvvrrssk
9 krrraaaggggaaovvvrrssk
8 krrraaaggggaovvrrsskk
8 krraaaggggaovrrssk..kraaggtttuk
8 kraaaggggaovrrssk...kragttuuuutk
9 kraaggtttovrrssk...kragttuqutk
10 kraggttuuttssk...kraggttuutk
11 kraggttuqutsk...kraaggttuk
12 kraggttuutsk...kraaggttk
13 kraggtttssk...kraaggak
14 kraaggssk....kraaggk
15 kraaggsk.....kraagk
16 kaggk........kkk
17 kkk
''')

def idle():
    g=canvas()
    for block in [BODY, TAIL_FINAL, LEGS, BREAST, HEAD, WING, WING_RIBS]:
        ink(g,block)
    return g
# The narrow third plume extends separately between the lower ribbon and body.
THIRD_TAIL = (94, '''
45 krvoaagggkk
44 krvoaaggggak
43 krvvoaaggggak
42 krvvvoaaggggak
41 krvvvvoaaggggak
40 krvvvvoaaggggak
39 krvvvvoaaggggak
38 krvvvvoaaggggak
37 krvvvvoaaggggak
36 krvvvvoaaggggak
35 krvvvvoaaggggak
34 krvvvvoaaggggak
33 krvvvvoaaggggak
32 krvvvvoaaggggak
31 krvvvvoaaggggak
30 krvvvvoaaggggak
29 krvvvvoaaggggak
28 krvvvvoaaggggak
28 krvvvvoaaggggak
28 krvvvvoaaggggak
29 krvvvvoaagggak
30 krvvvvoaaggak
31 krvvvtttggak
32 krvvtuuuutk
33 krvtuuqqutk
34 krtuuuqutk
35 krttuqugk
36 krttuggk
37 kraaggk
38 kraagk
39 kkk
''')

def idle():
    g=canvas()
    for block in [BODY, TAIL_FINAL, THIRD_TAIL, LEGS, BREAST, HEAD, WING, WING_RIBS]:
        ink(g,block)
    return g
# Three broad selected gold covert clusters break up the smooth red breast plane.
BREAST_PLUMES = (70, '''
73 oaagghggg
73 oaagghhggg
73 voaagghggg
73 vvoaagggg
73 vvvoaagg
73 vvvvoag
73 vvvvvo
74 vvvvvo
74 vvvvvo
75 vvvvo
75 vvvvo
75 vvvvo
74 oaagggg
73 oaagghgg
73 voaagghgg
73 vvoaaggg
73 vvvoaagg
73 vvvvoag
73 vvvvvo
74 vvvvvo
74 vvvvvo
75 vvvvo
75 vvvvo
75 vvvvo
74 oaaggg
74 oaaghgg
74 voaaghgg
74 vvoaagg
74 vvvoag
74 vvvvo
74 vvvvo
''')

def idle():
    g=canvas()
    for block in [BODY,TAIL_FINAL,THIRD_TAIL,LEGS,BREAST,BREAST_PLUMES,HEAD,WING,WING_RIBS]: ink(g,block)
    return g
