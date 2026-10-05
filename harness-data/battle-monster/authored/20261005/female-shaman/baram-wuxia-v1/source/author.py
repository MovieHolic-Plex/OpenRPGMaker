from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).parent
PALETTE = {
    'o':'#211F2B', 'h':'#302C3C', 'n':'#25314B', 'b':'#435370',
    's':'#B77960', 't':'#DEA17B', 'u':'#F4C89A',
    'e':'#F5EDD4', 'c':'#D6CBB0', 'd':'#A99B91',
    'v':'#6C293A', 'r':'#AB3946', 'p':'#DF6554',
    'k':'#705133', 'g':'#BE8643', 'w':'#EEB55D', 'f':'#FFF0B0',
    'j':'#859465',
}

def rows(spec):
    canvas = ['.' * 64 for _ in range(64)]
    for line in spec.strip().splitlines():
        y, x, ink = line.split()
        y, x = int(y), int(x)
        assert x >= 1 and x + len(ink) <= 63, (y, x, ink)
        assert 1 <= y <= 60
        assert set(ink) <= set(PALETTE) | {'.'}
        canvas[y] = canvas[y][:x] + ink + canvas[y][x+len(ink):]
    return canvas

def replace(canvas, spec):
    result = canvas.copy()
    for line in spec.strip().splitlines():
        y, x, ink = line.split()
        y, x = int(y), int(x)
        assert x >= 1 and x+len(ink)<=63
        assert set(ink)<=set(PALETTE)|{'.'}
        result[y] = '.'*x + ink + '.'*(64-x-len(ink))
    return result

def pixels(canvas, spec):
    result = canvas.copy()
    for line in spec.strip().splitlines():
        y, x, ink = line.split()
        y, x = int(y), int(x)
        result[y] = result[y][:x]+ink+result[y][x+len(ink):]
    return result

def save(name, canvas, action=False):
    dest = ROOT / ('actions' if action else 'poses') / (name+'.pxgrid')
    dest.write_text('\n'.join(canvas)+'\n', encoding='ascii')

def decode(canvas):
    im = Image.new('RGBA',(64,64))
    colors = {c:tuple(bytes.fromhex(v[1:]))+(255,) for c,v in PALETTE.items()}
    im.putdata([colors.get(c,(0,0,0,0)) for row in canvas for c in row])
    return im

IDLE = rows('''
8 29 ooooooo
9 26 oohhhnboooo
10 25 ohhhnbbhhhhhoo
11 24 orpnhbbnnhhhhho
12 23 orpphhhnnhhhhhoo
13 23 ovrrhhhhttttshhho
14 23 ohrhhnnuuuuutthhho
15 23 ohhhhnnuuuuuutthho
16 23 ohhhhnnuukkuukktsho
17 23 ohhhhnsuuuuuuuuutso
18 24 ohhhnsuueouueoutsso
19 24 ohhhnsuutouutouttso
20 24 ohhhnsuuuuuuuttssso
21 24 ohhhnsuuuuuuttutsso
22 24 ohhhhsuuuuttttssso
23 24 ohhhhstuutttkktsso
24 24 ohhhhhsttttttssso
25 24 ohhhhhnstttsssoo
26 24 ohhhhhnosssso
27 23 ohhhhnoccutso
28 22 ohhhnnceeeetsccoo
29 21 ohhhnceeeeencceecdo
30 20 ohhnceeeeeennceeeccdo
31 19 ohnceeeeecnnnceeecccdo....kgk
32 18 oceeeeeccnnnbcceeeccddo..gfwg
33 18 oceeeeccnnnbccceeccddo..gfwwg
34 18 oceeeccnnnbcceeeccddotuskgwg
35 18 occeccnnnbcceeccdddoututskk
36 19 occccddnbcceccdddo..sttso
37 20 occcdddnncccdduuso..oso
38 21 oddddnnnbcddutuso
39 22 odddnnngwgnttso
40 23 onnnnnngfgnoo
41 24 ovrrrppgrrvvo
42 24 orrrppprrrrvvo
43 24 orrppprrrrvvvvo
44 23 orrppprrrrvvvvvo
45 23 orpppprrrvvrvvvvo
46 22 orpppprrrvvrvrrvvo
47 22 orpppprrrvvrvrrvvo
48 22 orppprrrrvvrvrrrvvo
49 21 orppprrrrvvrvrrrvvo
50 21 orppprrrrvvrvrrrrvvo
51 21 orpprrrrrvvrvrrrrvvo
52 20 orpprrrrrvvrvrrrrrvvo
53 20 orpprrrrrvvrvrrrrrvvo
54 20 orpprrrrvvvrvrrrrrvvo
55 19 orpprrrrvvvrrvrrrrrvvo
56 19 orrrrvvvvvvrrvvrrrrvvo
57 20 ovvvvvvooovvvvvvrvvo
58 23 onnbno....onbbno
59 22 onbbnno....onbbnno
60 22 ooooooo....ooooooo
''')

IDLE = pixels(IDLE, '''
30 37 gff
31 37 kff
32 37 kff
33 37 kff
34 37 kff
35 37 sff
36 36 utf
37 35 utso
''')

(ROOT/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n')
save('idle_a', IDLE)
decode(IDLE).save(ROOT/'progress/idle.png')
decode(IDLE).resize((512,512),Image.Resampling.NEAREST).save(ROOT/'progress/idle-8x.png')
decode(IDLE).crop((21,7,46,29)).resize((200,176),Image.Resampling.NEAREST).save(ROOT/'progress/face.png')

IDLE_B = replace(IDLE, '''
28 22 ohhhnnceeeeetsccoo
29 21 ohhhnceeeeencceeeccdo
30 20 ohhnceeeeeennceeeegff
31 19 ohnceeeeecnnnceeeckff.....kgk
32 18 oceeeeeccnnnbcceeeckffo..gfwg
33 18 oceeeeccnnnbcccecckffo..gfwwg
34 18 oceeeccnnnbcceeccdkffutuskgwg
35 19 oceeccnnnbceeccdddsffututskk
36 19 occccddnbcceccddduutfsttso
37 20 occcdddnncccdduutso.oso
38 21 oddddnnnbcddutuso
39 22 odddnnngwgnttso
44 23 orrppprrrrvvvvvo
45 23 orpppprrrrvvrvvvvo
46 22 orppppprrvvrvrrvvo
47 22 orppppprrvvrvrrvvo
48 22 orppprrrrvvrrvrrvvo
49 21 orppprrrrvvrrvrrvvo
50 21 orppprrrrvvrrvrrrvvo
55 19 orpprrrrvvvrrvrrrrrvvo
56 19 orrrrvvvvvvrrvvrrrvvvo
''')
IDLE_B = pixels(IDLE_B, '''
12 25 pphhhn
27 24 hhhhn
''')
save('idle_b', IDLE_B)

IDLE_C = replace(IDLE, '''
29 21 ohhhnceeeeencceccdo
30 20 ohhnceeeeeennceecdgff
31 19 ohnceeeeecnnnceecckff.....kgk
32 18 oceeeeeccnnnbceecckffo..gfwg
33 18 oceeeeccnnnbcceccdkffo..gfwwg
34 19 oceeccnnnbcceccdddkffutuskgwg
35 19 occccnnnbcceccddodsffututskk
36 20 occcddnbccceccddoutfsttso
37 21 occdddnnccdduutso..oso
38 22 odddnnnbcdutuso
39 23 oddnnngwgnttso
41 24 ovrrrppgrrvvo
45 23 orpppprrrvvrrvvvo
46 23 orpppprrvvrrvrrvvo
47 22 orppprrrvvrrvrrrvvo
48 22 orppprrrvvrrvrrrvvo
49 22 orppprrrvvrrvrrrrvvo
50 21 orppprrrvvrrvrrrrvvo
51 21 orpprrrrvvrrvrrrrvvo
52 20 orpprrrrvvrrvrrrrrvvo
''')
IDLE_C = pixels(IDLE_C, '''
13 24 rrrhh
25 25 hhhhn
''')
save('idle_c', IDLE_C)

WINDUP = replace(IDLE, '''
8 1 .
9 29 ooooooo
10 26 oohhnnbhooo
11 25 ohhnnbbhhhhhoo
12 24 orpnhbnnnhhhhho
13 23 orpphhhnhhhhhoo
14 23 ovrrhhhnttttshhho
15 23 ohhhhnnuuuuuttshho
16 23 ohhhhnnuuuuuutthho
17 23 ohhhhnnuukkukkttsho
18 23 ohhhhnstuuuuuuttso
19 24 ohhhnsuueouueoutso
20 24 ohhhnsuutouutouttso
21 24 ohhhnsuuuuuutttssso
22 24 ohhhnsuuuuuttutsso
23 24 ohhhhsuuuttttssso
24 24 ohhhhstuutkkttssso
25 24 ohhhhhstttttssso
26 24 ohhhhhnsttsssoo
27 24 ohhhhhnossso
28 23 ohhhhnoceetcco
29 22 ohhhnnceeeetnccoo
30 21 ohhhnceeeecnnceegffo
31 20 ohhnceeeecnnnccckffo..kgk
32 19 ohnceeeccnnnbccckffo.gfwg
33 19 oceeeeccnnnbcccukffogfwwg
34 19 oceeeccnnnbccuutsttsskgwg
35 20 oceccnnnbccutttsto.utskk
36 21 occddnnnbeecstsoo..oso
37 22 odddnnnbeecccdo
38 23 oddnnnnbeccddo
39 24 onnnnngwgnddo
40 24 onnnnngfgnno
41 24 ovrrppgrrrvvo
42 23 orrppprrrrrvvvo
43 23 orrppprrrrvvvvvo
44 22 orpppprrrrvvrvvvo
45 22 orpppprrrvvvrvvvvo
46 21 orppprrrvvvrvrrvvvo
47 21 orppprrrvvvrrvrrvvvo
48 21 orppprrrvvvrrvrrrvvvo
49 20 orppprrrvvvrrvrrrvvvo
50 20 orppprrrvvvrrvrrrrvvvo
51 20 orpprrrrvvvrrvrrrrvvvo
52 19 orpprrrrvvvrrvrrrrrvvvo
53 19 orpprrrrvvvrrvrrrrrvvvo
54 19 orpprrrvvvvrrvrrrrrvvvo
55 19 orrrrvvvvvvrrvvrrrrvvvo
56 20 ovvvvvvvoovvvvvrrrvvvo
57 22 onnnno.....ovvvvvvvo
58 22 onbbno.......onbbno
59 21 onbbnno.......onbbnno
60 21 ooooooo.......ooooooo
''')
save('windup', WINDUP)

MOVE = rows('''
9 32 ooooooo
10 29 oohhnnbhooo
11 28 ohhnnbbhhhhhoo
12 26 oorpnhbnnnhhhhho
13 25 ohrpphhhnhhhhhoo
14 25 ohvrrhhhnttttshhho
15 25 ohhhhhnnuuuuuttshho
16 26 ohhhhnnuuuuuutthho
17 26 ohhhhnnuukkukkttsho
18 26 ohhhhnstuuuuuuttso
19 27 ohhhnsuueouueoutso
20 27 ohhhnsuutouutouttso
21 27 ohhhnsuuuuuutttssso
22 27 ohhhnsuuuuuttutsso
23 26 ohhhhhsuuuttttssso
24 25 ohhhhhstuutkkttssso
25 24 ohhhhhhnstttttssso
26 23 ohhhhhhnnsttsssoo
27 22 ohhhhnnoceetcco
28 21 ohhhnnceeeetnccoo
29 20 ohhhnceeeecnnceeccoo
30 19 ohhnceeeecnnnceeecccdo........kgk
31 18 ohnceeeccnnnbcceeeecccdo....gfwg
32 17 ohceeeccnnnbccceeeeccccdo..gfwwg
33 16 oceeeccnnnbcceeeecccccddotukgwg
34 16 oceeccnnnbcceeeccccddddoututkk
35 17 occccnnnbcceccdddddddo..sttso
36 18 occddnnnbccdddo..gff..oso
37 19 odddnnnbcddutuso.kff
38 20 oddnnnbcdutttso..kff
39 22 onnnnngwgntso...sff
40 23 onnnnngfgno....utf
41 22 ovrrrppgrrvvo
42 21 orrppppprrrrvvo
43 20 orrppppprrrrvvvvo
44 19 orppppprrrrvvrrvvo
45 18 orpppprrrrvvvrrrvvo
46 17 orpppprrrrvvvrrprrvvo
47 16 orpppprrrvvvrrppprrvvo
48 15 orppprrrvvvrrppprrrvvvo
49 14 orppprrrvvvrrppprrrrvvvo
50 13 orppprrrvvvrrppprrrrvvvo
51 13 orpprrrvvvrrrppprrrrvvvvo
52 13 orpprrrvvvrrrppprrrrvvvvo
53 14 orrrrvvvoovrrrppprrrrvvvvo
54 15 ovvvvvo...ovrrrppprrrrvvvo
55 15 onnnno.....ovrrrppprrrrvvo
56 15 onbbno......ovvrrrrrrrrvvo
57 15 onbbno........ovvvvvvvvo
58 14 onbbnno...........onnbbno
59 13 onbbnnno...........onbbnno
60 13 oooooooo...........ooooooo
''')
save('move', MOVE)

ATTACK = rows('''
10 32 ooooooo
11 29 oohhnnbhooo
12 28 ohhnnbbhhhhhoo
13 27 orpnhbnnnhhhhho
14 26 orpphhhnhhhhhoo
15 26 ovrrhhhnttttshhho
16 26 ohhhhnnuuuuuttshho
17 26 ohhhhnnuuuuuutthho
18 26 ohhhhnnuukkukkttsho
19 26 ohhhhnstuuuuuuttso
20 27 ohhhnsuueouueoutso
21 27 ohhhnsuutouutouttso
22 27 ohhhnsuuuuuutttssso
23 27 ohhhnsuuuuuttutsso
24 26 ohhhhhsuuuttttssso
25 25 ohhhhhstuutkkttssso
26 24 ohhhhhhnstttttssso
27 23 ohhhhhhnnsttsssoo
28 22 ohhhhnnoceetcco...........gff
29 21 ohhhnnceeeetnccooo.........fff
30 20 ohhhnceeeecnnceeeeccooo....ffw
31 19 ohhnceeeecnnnceeeeeeccuutuso..p
32 18 ohnceeeccnnnbcceeeeeeccutttso..w
33 18 oceeeeccnnnbccceeeeecccssso
34 18 oceeeccnnnbcceeeeeccccddoo
35 19 oceeccnnnbcceeecccccddoo
36 20 occddnnnbcccccdddddoo......kgk
37 21 odddnnnbccddddddoo.......gfwg
38 22 oddnnnbcdutuso.........gfwwg
39 23 onnnnngwgnttso.......sukgwg
40 24 onnnnngfgnstssoo....uttskk
41 23 ovrrrppgrrvvddecccdouttso
42 22 orrpppprrrrvvddeeeccddoo
43 21 orrpppprrrrvvddecccddoo
44 20 orpppprrrrvvvddddddoo
45 19 orpppprrrrvvrrvvvvvo
46 18 orppprrrrvvrrpprrvvvo
47 17 orppprrrvvvrrppprrvvvo
48 16 orppprrrvvvrrppprrrvvvo
49 15 orppprrrvvvrrppprrrrvvvo
50 14 orppprrrvvvrrppprrrrvvvo
51 14 orpprrrvvvrrrppprrrrvvvvo
52 14 orpprrrvvvrrrppprrrrvvvvo
53 14 orrrrvvvoovrrrppprrrrvvvvo
54 15 ovvvvvo...ovrrrppprrrrvvvo
55 15 onnnno.....ovrrrppprrrrvvo
56 15 onbbno......ovvrrrrrrrrvvo
57 15 onbbno........ovvvvvvvvo
58 14 onbbnno...........onnbbno
59 13 onbbnnno...........onbbnno
60 13 oooooooo...........ooooooo
''')
save('attack', ATTACK)

RECOVER = replace(IDLE, '''
27 23 ohhhhnoccutso
28 22 ohhhnnceeeeetsccoo
29 21 ohhhnceeeeencceeccdo
30 20 ohhnceeeeeennceeeccdo
31 19 ohnceeeeecnnnceeecccdo
32 18 oceeeeeccnnnbcceeeccccdo
33 18 oceeeeccnnnbccceeccccddo
34 18 oceeeccnnnbcceeeccccddo
35 19 oceeccnnnbcceeccccdddo
36 20 occccddnbccecccdddddoutso
37 21 occcdddnncccdddddoututso
38 22 oddddnnnbcddutuso...sttso
39 23 odddnnngwgnttso......oso
40 24 onnnnnngfgnoo.........k
41 24 ovrrrppgrrvvo.........k
42 24 orrrppprrrrvvo.......kgk
43 23 orrppprrrrvvvvvo....gfwg
44 23 orrppprrrrvvvvvo....gfwwg
45 22 orpppprrrvvrvvvvo....kgwg
46 22 orpppprrrvvrvrrvvo....kk
47 21 orpppprrrvvrvrrvvo
48 21 orppprrrrvvrvrrrvvo
49 21 orppprrrrvvrvrrrvvo
50 20 orppprrrrvvrvrrrrvvo
51 20 orpprrrrrvvrvrrrrvvo
52 20 orpprrrrrvvrvrrrrrvvo
53 20 orpprrrrrvvrvrrrrrvvo
54 20 orpprrrrvvvrvrrrrrvvo
55 20 orpprrrrvvvrrvrrrrrvvo
56 20 orrrrvvvvvvrrvvrrrrvvo
57 21 ovvvvvvooovvvvvvrvvo
58 24 onnbno....onbbno
59 23 onbbnno....onbbnno
60 23 ooooooo....ooooooo
''')
RECOVER = pixels(RECOVER, '''
35 36 uttso
36 36 utso
37 38 gff
38 38 kff
39 38 kff
40 38 kff
41 38 kff
42 38 kff
''')
save('recover', RECOVER)

HIT = rows('''
10 26 ooooooo
11 23 oohhnnbhooo
12 22 ohhnnbbhhhhhoo
13 21 orpnhbnnnhhhhho
14 20 orpphhhnhhhhhoo
15 20 ovrrhhhnttttshhho
16 20 ohhhhnnuuuuuttshho
17 21 ohhhhnnuuuuuutthho
18 21 ohhhhnnuukkukkttsho
19 21 ohhhhnstuuuuuutttso
20 22 ohhhnsuutkkutkkttso
21 22 ohhhnsuuuuuutttssso
22 22 ohhhnsuuuuuttutsso
23 23 ohhhhhsuuuttttssso
24 23 ohhhhstuutkottssso
25 23 ohhhhhstttkottssso
26 23 ohhhhhnstttsssoo
27 23 ohhhhhnosssso
28 22 ohhhhnoceetcco
29 21 ohhhnnceeeetnccoo
30 20 ohhhnceeeecnnceccdoo
31 19 ohhnceeeecnnnceeccddo
32 18 ohnceeeccnnnbccecccddo
33 17 oceeeeccnnnbcceeeecccdo
34 17 oceeeccnnnbcceeeeeccccdo
35 18 oceeccnnnbcceeecccccddo
36 19 occddnnnbcccecccddddoutso
37 20 odddnnnbcccccddddoututso
38 21 oddnnnbcdutuso.....sttso
39 22 onnnnngwgnttso......oso
40 23 onnnnngfgnutso.......k
41 23 ovrrrppgrrvvo........k
42 23 orrpppprrrrvvo......kgk
43 22 orrpppprrrrvvvvo...gfwg
44 22 orpppprrrrvvrvvvo..gfwwg
45 21 orpppprrrvvvrvvvvo..kgwg
46 21 orppprrrvvvrvrrvvvo..kk
47 20 orppprrrvvvrrvrrvvvo
48 20 orppprrrvvvrrvrrrvvvo
49 20 orppprrrvvvrrvrrrvvvo
50 19 orppprrrvvvrrvrrrrvvvo
51 19 orpprrrrvvvrrvrrrrvvvo
52 19 orpprrrrvvvrrvrrrrrvvvo
53 19 orpprrrrvvvrrvrrrrrvvvo
54 19 orpprrrvvvvrrvrrrrrvvvo
55 19 orrrrvvvvvvrrvvrrrrvvvo
56 20 ovvvvvvvoovvvvvrrrvvvo
57 22 onnnno.....ovvvvvvvo
58 22 onbbno.......onbbno
59 21 onbbnno.......onbbnno
60 21 ooooooo.......ooooooo
''')
HIT = pixels(HIT, '''
38 34 gff
39 34 kff
40 34 kff
41 34 kff
42 34 kff
43 34 kff
''')
save('hit', HIT)

DEAD = rows('''
41 15 oooooo
42 13 oohhnnbooo
43 12 ohhnnbbhhhoo
44 11 ohhbbnhhhhhhho
45 10 ohhhnnhhhhhhhoo
46 10 orpphhuutttshhho
47 10 orprhnuuuuutshhho
48 10 ovrrhnuukkuttshhho
49 11 ohhhnsuuuutuutshhho
50 11 ohhhnsuuutkkuttshhhoo
51 11 ohhhhsuuuuuttstshhhnnccooo
52 12 ohhhhhsuuuttsttshhhnnceeeccoo
53 12 ohhhhhhsuutkkttshnncceeeeccddoo
54 13 ohhhhhhhsttttsshnoceeeccnnceccddo
55 14 ohhhhhhhhssssonnoceeeccnnnccddutso....oo
56 15 ohhhhhhhhhhnnnoceeeeccnnbccdutttsonnnnnbno
57 12 kgkoohhhhhhnnnnoceeeccnnnbcddsssovrrppprrvvo
58 11 gfwg.ooooooooooceeeecccddnnngwgovrrppprrrrvvo
59 11 gfwwg......outtcccccddddnngfgnvrrpprrrvvvvvvo
60 12 kgwgo......osssodddoooovvvvvvvvvooovvvvvvo.gff
''')
save('dead', DEAD)

SKILL_A = replace(IDLE, '''
16 23 ohhhhnnuukkuukktsho
18 24 ohhhnsuueouueoutsso
19 24 ohhhnsuutouutouttso
23 24 ohhhhstuutttkktsso
27 23 ohhhhnoccutso
28 22 ohhhnnceeeeetsccoo.....gff..kgk
29 21 ohhhnceeeeencceecdoo....kff.gfwg
30 20 ohhnceeeeeennceeeccdoo...kffgfwwg
31 19 ohnceeeeecnnnceeecccdooutuskffkgwg
32 18 oceeeeeccnnnbcceeeeccutttskffkk
33 18 oceeeeccnnnbccceeeeccsssoutfso
34 19 oceeccnnnbcceeeeccdddoutttso
35 20 occccnnnbcceeeccdddddostso
36 21 occcddnbcccecccddddddoo
37 22 occdddnncccddddddoo
38 23 odddnnnbcddddoo
39 24 onnnnngwgnddo
40 24 onnnnngfgnno
41 24 ovrrppgrrrvvo
42 23 orrppprrrrrvvvo
43 23 orrppprrrrvvvvvo
44 23 orpppprrrrvvrvvvo
45 22 orpppprrrvvvrvvvvo
46 22 orppprrrvvvrvrrvvvo
47 21 orppprrrvvvrrvrrvvvo
48 21 orppprrrvvvrrvrrrvvvo
49 21 orppprrrvvvrrvrrrvvvo
50 20 orppprrrvvvrrvrrrrvvvo
51 20 orpprrrrvvvrrvrrrrvvvo
52 20 orpprrrrvvvrrvrrrrrvvvo
53 20 orpprrrrvvvrrvrrrrrvvvo
54 20 orpprrrvvvvrrvrrrrrvvvo
55 20 orrrrvvvvvvrrvvrrrrvvvo
56 21 ovvvvvvvoovvvvvrrrvvvo
57 23 onnnno.....ovvvvvvvo
58 23 onbbno.......onbbno
59 22 onbbnno.......onbbnno
60 22 ooooooo.......ooooooo
''')
SKILL_A = pixels(SKILL_A, '''
23 46 p
24 45 prp
25 45 rwpp
26 44 prfw
27 44 rwfwp
28 45 wfw
''')
save('skill_a', SKILL_A, True)

SKILL_B = rows('''
9 32 ooooooo
10 29 oohhnnbhooo
11 28 ohhnnbbhhhhhoo
12 27 orpnhbnnnhhhhho
13 26 orpphhhnhhhhhoo
14 26 ovrrhhhnttttshhho
15 26 ohhhhnnuuuuuttshho
16 26 ohhhhnnuuuuuutthho
17 26 ohhhhnnuukkukkttsho
18 26 ohhhhnstuuuuuuttso
19 27 ohhhnsuueouueoutso
20 27 ohhhnsuutouutouttso
21 27 ohhhnsuuuuuutttssso
22 27 ohhhnsuuuuuttutsso
23 26 ohhhhhsuuuttttssso
24 25 ohhhhhstuutkkttssso
25 24 ohhhhhhnstttttssso
26 23 ohhhhhhnnsttsssoo
27 22 ohhhhnnoceetccoo
28 21 ohhhnnceeeetncceccoo....utso
29 20 ohhhnceeeecnnceeeeccoututttso
30 19 ohhnceeeecnnnceeeeeeccutttso
31 18 ohnceeeccnnnbcceeeeeeccsssso
32 18 oceeeeccnnnbccceeeeeccddoo
33 18 oceeeccnnnbcceeeeeccddoo
34 19 oceeccnnnbcceeecccddoo
35 20 occddnnnbcccccdddoo
36 21 odddnnnbcccddddoo.kgk
37 22 oddnnnbccdddddo.gfwg
38 23 onnnnngwgnutso.gfwwg
39 24 onnnnngfgnttso..kgwg
40 23 ovrrrppgrrvuutssokk
41 22 orrpppprrrvvcceuutso
42 21 orrpppprrrvvcceeccddo
43 20 orpppprrrrvvddceccddo
44 19 orpppprrrrvvvddddddo
45 18 orppprrrrvvrrvvvvvo
46 17 orppprrrvvvrrpprrvvvo
47 16 orppprrrvvvrrppprrvvvo
48 15 orppprrrvvvrrppprrrvvvo
49 14 orppprrrvvvrrppprrrrvvvo
50 13 orppprrrvvvrrppprrrrvvvo
51 13 orpprrrvvvrrrppprrrrvvvvo
52 13 orpprrrvvvrrrppprrrrvvvvo
53 14 orrrrvvvoovrrrppprrrrvvvvo
54 15 ovvvvvo...ovrrrppprrrrvvvo
55 15 onnnno.....ovrrrppprrrrvvo
56 15 onbbno......ovvrrrrrrrrvvo
57 15 onbbno........ovvvvvvvvo
58 14 onbbnno...........onnbbno
59 13 onbbnnno...........onbbnno
60 13 oooooooo...........ooooooo
''')
SKILL_B = pixels(SKILL_B, '''
17 57 p
18 56 rp
19 56 rw
20 55 rww
21 54 prfw
22 54 rwfp
23 53 prfw
24 52 prfw
25 52 rfw.....p
26 51 prfw....pr
27 50 prfwp..prw
28 49 gffwpprrwfw
29 48 gfffwwffwfwp
30 49 fwwfwwwwwrp
31 50 rwpwwrrpp
32 50 prfwpp
33 51 prfw
34 52 prfwp
35 53 rfwpp
36 54 rwfwp
37 55 rwwp
38 56 rwp
39 56 pr
''')
save('skill_b', SKILL_B, True)

SKILL_C = replace(RECOVER, '''
28 22 ohhhnnceeeeetsccoo
29 21 ohhhnceeeeencceeccdo
30 20 ohhnceeeeeennceeeccdo
31 19 ohnceeeeecnnnceeecccdo
32 18 oceeeeeccnnnbcceeeccccdo
33 18 oceeeeccnnnbccceeccccddo
34 19 oceeccnnnbcceeeccccddoutso
35 20 occccddnbcceeeeccdddoututso
36 21 occcdddnncccecccdddo..sttso
37 22 oddddnnnbcddutuso......oso
38 23 odddnnnbcdutttso........k
39 24 onnnnngwgnttso..........k
40 24 onnnnngfgnstso.........kgk
41 24 ovrrrppgrrvvo.........gfwg
42 23 orrrppprrrrvvo........gfwwg
43 23 orrppprrrrvvvvvo.......kgwg
44 22 orrppprrrrvvvvvo........kk
45 22 orpppprrrvvrvvvvo
46 21 orpppprrrvvrvrrvvo
47 21 orpppprrrvvrvrrvvo
48 20 orppprrrrvvrvrrrvvo
49 20 orppprrrrvvrvrrrvvo
50 20 orppprrrrvvrvrrrrvvo
51 20 orpprrrrrvvrvrrrrvvo
52 20 orpprrrrrvvrvrrrrrvvo
53 20 orpprrrrrvvrvrrrrrvvo
54 20 orpprrrrvvvrvrrrrrvvo
55 20 orpprrrrvvvrrvrrrrrvvo
56 20 orrrrvvvvvvrrvvrrrrvvo
''')
SKILL_C = pixels(SKILL_C, '''
21 52 pr
22 51 rw
23 52 p
27 57 fw
28 58 w
31 49 ff
32 50 wp
33 51 p
35 55 wf
36 55 pr
38 60 p
''')
save('skill_c', SKILL_C, True)

POISON_A = replace(IDLE, '''
8 1 .
9 1 .
10 29 ooooooo
11 26 oohhnnbhooo
12 25 ohhnnbbhhhhhoo
13 24 orpnhbnnnhhhhho
14 23 orpphhhnhhhhhoo
15 23 ovrrhhhnttttshhho
16 23 ohhhhnnuuuuuttshho
17 23 ohhhhnnuuuuuutthho
18 23 ohhhhnnuukkukkttsho
19 23 ohhhhnstuuuuuuttso
20 24 ohhhnsuueouukoutso
21 24 ohhhnsuutouuttsttso
22 24 ohhhnsuuuuuutttssso
23 24 ohhhnsuuuuuttutsso
24 24 ohhhhsuuuttttssso
25 24 ohhhhstuutkkktssso
26 24 ohhhhhstttttssso
27 24 ohhhhhnsttsssoo
28 24 ohhhhhnossso
29 23 ohhhhnoceetcco
30 22 ohhhnnceeeetnccoo
31 21 ohhhnceeeecnnceccdoo
32 20 ohhnceeeecnnnceeccddo
33 19 ohnceeeccnnnbccecccddo
34 19 oceeeeccnnnbcceeeecccdo
35 19 oceeeccnnnbcceeeeeccccdo
36 20 oceeccnnnbcceeecccccddo
37 21 occddnnnbcccecccddddoutso
38 22 odddnnnbcccccddddoututso
39 23 oddnnnbcdutuso.....sttso
40 24 onnnnngwgnttso......oso
41 24 onnnnngfgnutso.......k
42 24 ovrrppgrrvuuso.......k
43 23 orrppprrrrvvvo......kgk
44 23 orrppprrrrvvvvvo...gfwg
45 22 orpppprrrrvvrvvvo..gfwwg
46 22 orpppprrrvvvrvvvvo..kgwg
47 21 orppprrrvvvrvrrvvvo..kk
48 21 orppprrrvvvrrvrrvvvo
49 21 orppprrrvvvrrvrrrvvvo
50 20 orppprrrvvvrrvrrrvvvo
51 20 orpprrrrvvvrrvrrrrvvvo
52 20 orpprrrrvvvrrvrrrrvvvo
53 20 orpprrrrvvvrrvrrrrrvvvo
54 20 orpprrrvvvvrrvrrrrrvvvo
55 20 orrrrvvvvvvrrvvrrrrvvvo
56 21 ovvvvvvvoovvvvvrrrvvvo
57 23 onnnno.....ovvvvvvvo
58 23 onbbno.......onbbno
59 22 onbbnno.......onbbnno
60 22 ooooooo.......ooooooo
''')
POISON_A = pixels(POISON_A, '''
14 17 jj
15 16 jfj
16 16 j.j
17 17 jj
25 49 jj
26 48 jfj
27 48 j.j
28 49 jj
36 14 j
37 13 jfj
38 14 j
41 38 gff
42 38 kff
43 38 kff
44 38 kff
45 38 kff
''')
save('poison_a', POISON_A, True)

POISON_B = rows('''
12 29 ooooooo
13 26 oohhnnbhooo
14 25 ohhnnbbhhhhhoo
15 24 orpnhbnnnhhhhho
16 23 orpphhhnhhhhhoo
17 23 ovrrhhhnttttshhho
18 23 ohhhhnnuuuuuttshho
19 24 ohhhhnnuuuuuutthho
20 24 ohhhhnnuukkukkttsho
21 24 ohhhhnstuuuuuutttso
22 25 ohhhnsuukkkukkkttso
23 25 ohhhnsuuuuuutttssso
24 25 ohhhnsuuuuuttutsso
25 25 ohhhhhsuuuttttssso
26 25 ohhhhstuutkottssso
27 25 ohhhhhstttkkttssso
28 25 ohhhhhnstttsssoo
29 25 ohhhhhnosssso
30 24 ohhhhnoceetcco
31 23 ohhhnnceeeetnccoo
32 22 ohhhnceeeecnnceccdoo
33 21 ohhnceeeecnnnceeccddo
34 20 ohnceeeccnnnbccecccddo
35 20 oceeeeccnnnbcceeeecccdo
36 20 oceeeccnnnbcceeeeeccccdo
37 21 oceeccnnnbcceeecccccddo
38 22 occddnnnbccceccccddddo
39 23 odddnnnbcccccdddddoutso
40 24 oddnnnbcdutuso..oututso
41 25 onnnnngwgnttso...sttso
42 25 onnnnngfgnutso....oso
43 24 ovrrppgrrvutso.....k
44 23 orrppprrrrvsso.....k
45 23 orrppprrrrvvvvo...kgk
46 22 orpppprrrvvvrvvvo.gfwg
47 21 orppprrrvvvrvrrvvogfwwg
48 21 orppprrrvvvrrvrrvvokgwg
49 20 orppprrrvvvrrvrrrvvokk
50 20 orppprrrvvvrrvrrrvvvo
51 19 orpprrrrvvvrrvrrrrvvvo
52 19 orpprrrrvvvrrvrrrrvvvo
53 19 orpprrrrvvvrrvrrrrrvvvo
54 19 orpprrrvvvvrrvrrrrrvvvo
55 19 orrrrvvvvvvrrvvrrrrvvvo
56 20 ovvvvvvvoovvvvvrrrvvvo
57 22 onnnno.....ovvvvvvvo
58 22 onbbno.......onbbno
59 21 onbbnno.......onbbnno
60 21 ooooooo.......ooooooo
''')
POISON_B = pixels(POISON_B, '''
10 19 j.j
11 20 j
19 49 jjj
20 48 jf.j
21 48 j..j
22 49 jjj
31 14 jj
32 13 jfj
33 14 jj
42 39 gff
43 39 kff
44 39 kff
45 39 kff
46 39 kff
''')
save('poison_b', POISON_B, True)

STUN_A = replace(POISON_A, '''
16 23 ohhhhnnuuuuuttshho
17 23 ohhhhnnuuuuuutthho
18 23 ohhhhnnuukkuukktsho
19 23 ohhhhnstuuuuuuttso
20 24 ohhhnsuueouueoutso
21 24 ohhhnsuutouutouttso
22 24 ohhhnsuuuuuutttssso
23 24 ohhhnsuuuuuttutsso
24 24 ohhhhsuuuttttssso
25 24 ohhhhstuutkottssso
26 24 ohhhhhstttkottssso
31 21 ohhhnceeeecnnceccdoo
32 20 ohhnceeeecnnnceeccddo
33 19 ohnceeeccnnnbccecccddo
34 19 oceeeeccnnnbcceeeecccdo
35 19 oceeeccnnnbcceeeeeccccdo
36 20 oceeccnnnbcceeecccccddo
37 21 occddnnnbcccecccddddo
38 22 odddnnnbcccdddddddoutso
39 23 oddnnnbcddddddddoututso
40 24 onnnnngwgndddddo..sttso
41 24 onnnnngfgndddo.....oso
42 24 ovrrppgrrvvdo.......k
43 23 orrppprrrrvvvo......k
44 23 orrppprrrrvvvvvo...kgk
45 22 orpppprrrrvvrvvvo.gfwg
46 22 orpppprrrvvvrvvvvogfwwg
47 21 orppprrrvvvrvrrvvvokgwg
48 21 orppprrrvvvrrvrrvvvokk
49 21 orppprrrvvvrrvrrrvvvo
''')
# The parent shares the deliberately lowered neck; erase its toxic bubbles.
STUN_A = pixels(STUN_A, '''
14 17 ..
15 16 ...
16 16 ...
17 17 ..
25 49 ..
26 48 ...
27 48 ...
28 49 ..
36 14 .
37 13 ...
38 14 .
6 23 w
7 23 f
8 21 wfffw
9 23 f
10 23 w
12 48 w
13 47 wfw
14 48 w
39 27 utso
40 27 utso
41 27 gff
42 27 kff
43 27 kff
44 27 kff
45 27 kff
46 27 kff
''')
save('stun_a', STUN_A, True)

STUN_B = rows('''
11 27 ooooooo
12 24 oohhnnbhooo
13 23 ohhnnbbhhhhhoo
14 22 orpnhbnnnhhhhho
15 21 orpphhhnhhhhhoo
16 21 ovrrhhhnttttshhho
17 21 ohhhhnnuuuuuttshho
18 22 ohhhhnnuuuuuutthho
19 22 ohhhhnnuukkuukktsho
20 22 ohhhhnstuuuuuutttso
21 23 ohhhnsuukouueouttso
22 23 ohhhnsuutouttouttso
23 23 ohhhnsuuuuuutttssso
24 23 ohhhnsuuuuuttutsso
25 24 ohhhhhsuuuttttssso
26 24 ohhhhstuutkottssso
27 24 ohhhhhstttkottssso
28 24 ohhhhhnstttsssoo
29 24 ohhhhhnosssso
30 23 ohhhhnoceetcco
31 22 ohhhnnceeeetnccoo
32 21 ohhhnceeeecnnceccdoo
33 20 ohhnceeeecnnnceeccddo
34 19 ohnceeeccnnnbccecccddo
35 18 oceeeeccnnnbcceeeecccdo
36 18 oceeeccnnnbcceeeeeccccdo
37 19 oceeccnnnbcceeecccccddo
38 20 occddnnnbcccdddddddddo
39 21 odddnnnbccdddddddddoutso
40 22 oddnnnbcddddddddddoututso
41 23 onnnnngwgnddddddoo..sttso
42 23 onnnnngfgnddddo......oso
43 23 ovrrppgrrvvddo........k
44 23 orrppprrrrvvvo........k
45 22 orrppprrrrvvvvvo.....kgk
46 22 orpppprrrvvvrvvvo...gfwg
47 21 orppprrrvvvrvrrvvvo.gfwwg
48 21 orppprrrvvvrrvrrvvvo.kgwg
49 20 orppprrrvvvrrvrrrvvvo.kk
50 20 orppprrrvvvrrvrrrvvvo
51 19 orpprrrrvvvrrvrrrrvvvo
52 19 orpprrrrvvvrrvrrrrvvvo
53 19 orpprrrrvvvrrvrrrrrvvvo
54 19 orpprrrvvvvrrvrrrrrvvvo
55 19 orrrrvvvvvvrrvvrrrrvvvo
56 20 ovvvvvvvoovvvvvrrrvvvo
57 22 onnnno.....ovvvvvvvo
58 22 onbbno.......onbbno
59 21 onbbnno.......onbbnno
60 21 ooooooo.......ooooooo
''')
STUN_B = pixels(STUN_B, '''
7 40 w
8 40 f
9 38 wfffw
10 40 f
11 40 w
12 18 w
13 17 wfw
14 18 w
40 25 utso
41 25 utso
42 25 gff
43 25 kff
44 25 kff
45 25 kff
46 25 kff
47 25 kff
''')
save('stun_b', STUN_B, True)

SLEEP_A = replace(IDLE, '''
16 23 ohhhhnnuukkuukktsho
17 23 ohhhhnstuuuuuuttso
18 24 ohhhnsuutkkutkkttso
19 24 ohhhnsuuuuuutttssso
20 24 ohhhnsuuuuuutttssso
21 24 ohhhnsuuuuuttutsso
22 24 ohhhhsuuuttttssso
23 24 ohhhhstuutttkktsso
27 23 ohhhhnoccutso
28 22 ohhhnnceeeeetsccoo
29 21 ohhhnceeeeencceeccdo
30 20 ohhnceeeeeennceeeccdo
31 19 ohnceeeeecnnnceeecccdo
32 18 oceeeeeccnnnbcceeeccccdo
33 18 oceeeeccnnnbccceeccccddo
34 18 oceeeccnnnbcceeeccccddo
35 19 oceeccnnnbcceeccccdddo
36 20 occccddnbccecccdddddoutso
37 21 occcdddnncccdddddoututso
38 22 oddddnnnbcdddddddo..sttso
39 23 odddnnngwgnddddo....oso
40 24 onnnnnngfgnddo.......k
41 24 ovrrrppgrrvvo........k
42 24 orrrppprrrrvvo......kgk
43 24 orrppprrrrvvvvvo...gfwg
44 23 orrppprrrrvvvvvo...gfwwg
45 23 orpppprrrvvrvvvvo...kgwg
46 22 orpppprrrvvrvrrvvo...kk
47 22 orpppprrrvvrvrrvvo
48 22 orppprrrrvvrvrrrvvo
49 21 orppprrrrvvrvrrrvvo
50 21 orppprrrrvvrvrrrrvvo
51 21 orpprrrrrvvrvrrrrvvo
52 20 orpprrrrrvvrvrrrrrvvo
53 20 orpprrrrrvvrvrrrrrvvo
54 20 orpprrrrvvvrvrrrrrvvo
55 19 orpprrrrvvvrrvrrrrrvvo
56 19 orrrrvvvvvvrrvvrrrrvvo
57 20 ovvvvvvooovvvvvvrvvo
58 23 onnbno....onbbno
59 22 onbbnno....onbbnno
60 22 ooooooo....ooooooo
''')
SLEEP_A = pixels(SLEEP_A, '''
38 27 utso
39 27 utso
40 27 gff
41 27 kff
42 27 kff
43 27 kff
44 27 kff
45 27 kff
''')
save('sleep_a', SLEEP_A, True)

SLEEP_B = rows('''
10 29 ooooooo
11 26 oohhnnbhooo
12 25 ohhnnbbhhhhhoo
13 24 orpnhbnnnhhhhho
14 23 orpphhhnhhhhhoo
15 23 ovrrhhhnttttshhho
16 23 ohhhhnnuuuuuttshho
17 24 ohhhhnnuuuuuutthho
18 24 ohhhhnnuukkuukktsho
19 24 ohhhhnstuuuuuutttso
20 25 ohhhnsuutkkutkkttso
21 25 ohhhnsuuuuuutttssso
22 25 ohhhnsuuuuuutttssso
23 25 ohhhnsuuuuuttutsso
24 25 ohhhhhsuuuttttssso
25 25 ohhhhstuutttkktsso
26 25 ohhhhhsttttttssso
27 25 ohhhhhnstttsssoo
28 25 ohhhhhnosssso
29 24 ohhhhnoceetcco
30 23 ohhhnnceeeetnccoo
31 22 ohhhnceeeecnnceccdoo
32 21 ohhnceeeecnnnceeccddo
33 20 ohnceeeccnnnbccecccddo
34 19 oceeeeccnnnbcceeeecccdo
35 19 oceeeccnnnbcceeeeeccccdo
36 20 oceeccnnnbcceeecccccddo
37 21 occddnnnbcccdddddddddo
38 22 odddnnnbccdddddddddddo
39 23 oddnnnbcddddddddddoutso
40 24 onnnnngwgndddddddoututso
41 24 onnnnngfgnddddddo..sttso
42 24 ovrrppgrrvvdddo....oso
43 23 orrppprrrrvvvo......k
44 23 orrppprrrrvvvvvo....k
45 22 orpppprrrvvvrvvvo..kgk
46 22 orppprrrvvvrvrrvvogfwg
47 21 orppprrrvvvrrvrrvvgfwwg
48 21 orppprrrvvvrrvrrrvvkgwg
49 21 orppprrrvvvrrvrrrvvokk
50 21 orpprrrrvvvrrvrrrrvvvo
51 20 orpprrrrvvvrrvrrrrvvvo
52 20 orpprrrrvvvrrvrrrrrvvvo
53 20 orpprrrrvvvrrvrrrrrvvvo
54 20 orpprrrvvvvrrvrrrrrvvvo
55 20 orrrrvvvvvvrrvvrrrrvvvo
56 21 ovvvvvvvoovvvvvrrrvvvo
57 23 onnnno.....ovvvvvvvo
58 23 onbbno.......onbbno
59 22 onbbnno.......onbbnno
60 22 ooooooo.......ooooooo
''')
SLEEP_B = pixels(SLEEP_B, '''
40 28 utso
41 28 utso
42 28 gff
43 28 kff
44 28 kff
45 28 kff
46 28 kff
47 28 kff
''')
save('sleep_b', SLEEP_B, True)

# Loose hanging sleeves are separately chosen from the bent ritual sleeves.
STUN_A = replace(STUN_A, '''
31 22 ohhnceeeecnnceccdoo
32 21 ohnceeeccnnnceecccddo
33 21 oceeeeccnnnbccecccddo
34 21 oceeeccnnnbcceeeecccdo
35 21 oceeeccnnnbcceeeecccddo
36 21 occeeccnnbcceeeecccdddo
37 21 occceccnnbcceccccdddddoutso
38 22 occccddnnbcccdddddddoututso
39 22 odcccddnnnbcdddddddo..sttso
40 23 odddcddnngwgdddddo....oso
41 24 odccdddnngfgnndo.......k
42 24 oddcdddvrrrvvdo........k
43 25 odcdutsoorrrvvvo......kgk
44 25 ossttsoorrrrvvvvvo...gfwg
45 24 orrgffrrrrrvvrvvvo..gfwwg
46 23 orrpkffrrrvvvrvvvvo..kgwg
47 22 orrpkffrrvvvrvrrvvvo..kk
48 22 orrpkffrrvvvrrvrrvvvo
49 21 orppkffrrvvvrrvrrrvvvo
''')
save('stun_a', STUN_A, True)

STUN_B = replace(STUN_B, '''
33 21 ohnceeeecnnnceeccddo
34 20 oceeeeccnnnbccecccddo
35 20 oceeeccnnnbcceeeeecccdo
36 20 occeeccnnnbcceeeeccccdo
37 20 occceccnnbcceeeecccdddo
38 20 odcceccnnbcccdddddddddoutso
39 21 odcccddnnbccddddddddoututso
40 21 oddccddnnnbcdddddddo..sttso
41 22 odddcddnngwgdddddoo....oso
42 23 odccdddnngfgnnddo.......k
43 23 oddcdddvrrrvvddo........k
44 24 odcdutsoorrrvvvo.......kgk
45 24 ossttsoorrrrvvvvvo....gfwg
46 23 orrgffrrrrrvvvrvvvo...gfwwg
47 23 orrkffrrrvvvrvrrvvvo...kgwg
48 22 orrpkffrrvvvrrvrrvvvo...kk
49 22 orrpkffrrvvvrrvrrrvvvo
50 21 orppkffrrvvvrrvrrrvvvo
''')
save('stun_b', STUN_B, True)

SLEEP_A = replace(SLEEP_A, '''
30 21 ohnceeeeennceeeccdo
31 21 oceeeeccnnnceeecccdo
32 21 oceeeccnnnbcceeeccccdo
33 21 occeeccnnbccceeccccddo
34 21 occceccnnbcceeeccccddo
35 21 odcceccnnbcceeccccdddo
36 22 odcccddnbccecccdddddoutso
37 22 oddccddnncccdddddoututso
38 22 odddcddnnbcddddddo..sttso
39 23 odccddngwgnddddo....oso
40 23 oddcddngfgnddo.......k
41 24 odcdutsoorrrvvo......k
42 24 ossttsoorrrrvvo.....kgk
43 24 orrgffrrrvvvvvo....gfwg
44 23 orrpkffrrrvvvvvo...gfwwg
45 23 orppkffrrvvrvvvvo...kgwg
46 22 orppkffrrvvrvrrvvo...kk
47 22 orppkffrrvvrvrrvvo
48 22 orppkffrrvvrvrrrvvo
''')
save('sleep_a', SLEEP_A, True)

SLEEP_B = replace(SLEEP_B, '''
31 23 ohnceeeecnnceccdoo
32 22 oceeeeccnnnceeccddo
33 22 oceeeccnnnbccecccddo
34 22 occeeccnnbcceeeecccdo
35 22 occceccnnbcceeeeccccdo
36 22 odcceccnnbcceeecccccddo
37 23 odcccddnbcccdddddddddo
38 23 oddccddnbccdddddddddddo
39 23 odddcddnbcddddddddddoutso
40 24 odccddngwgndddddddoututso
41 24 oddcddngfgnddddddo..sttso
42 25 odcdutsoorvvdddo....oso
43 25 ossttsoorrrvvvo......k
44 25 orrgffrrrvvvvvo......k
45 24 orrpkffrrvvvrvvvo...kgk
46 24 orppkffrrvvrvrrvvo.gfwg
47 23 orppkffrrvvrrvrrvvogfwwg
48 22 orpppkffrrvvrrvrrrvvokgwg
49 22 orpppkffrrvvrrvrrrvvo.kk
''')
save('sleep_b', SLEEP_B, True)
