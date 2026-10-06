"""Literal native row strips. Blank padding only; no pose transforms or shading synthesis."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
PALETTE={
'O':'#19242F','H':'#606E7F','S':'#AEBCC7','W':'#EFF4ED',
'K':'#AF8073','F':'#D9AB90','L':'#F6D1AC',
'T':'#184F58','C':'#287783','V':'#52AAA1',
'B':'#212E49','N':'#354C6B','U':'#627792',
'G':'#90603C','Y':'#D0A552','E':'#F2D585',
'A':'#9CDFD5','P':'#9B79B7'}
FRAMES={}
FRAMES['idle_a']='''
7 24 OOOOOO
8 22 OHHSSSWO
9 21 OHSSWWWSSO
10 20 OHSSWWSSSHHO
11 17 OOOOOOOOOOOOOOOOOOOO
12 20 OHSSWWWSSSHHOOOO
13 20 OSWWSSSSSHHHHSSO
14 20 OSWSSSWWSSHHSSSSO
15 20 OHSSSWWWSSSSSSSHO
16 21 OHSSWWSSSSSFFFFFO
17 21 OHHSSSSSSFFLLLLFFO
18 21 OHHSSSSSFFLLLLLFFO
19 21 OHHHSSSFKKFFLFFFO
20 22 OHHSSSSFKOFLLOFFO
21 22 OHSSSSHFFFFLLFFFO
22 22 OHHSSSHFFFLFFFFLFO................WO
23 23 OHHHSHKFFFFFKFFFO...............WSO
24 24 OHHHHOKFFFFFLLFO...............WSHO
25 25 OOOOOKKFFFFFO................WSHO
26 26 OTCOOKKFFFO................WSHO
27 24 OTVCVWKKKOCO...............WSHO
28 22 OCVVVCCWSCCCO.............WSHO
29 21 OCVVVVCCWSCCTO...........WSHO
30 20 OCVVCCCCWCCCTTO.........WSHO
31 19 OCVVCCCCCWCCCTTO.......WSHO
32 19 OVVCCCTCCWCCCTTO......WSHO
33 19 OVCCCTTCCTWCCCTO.....WSHO
34 20 OCCCTTTCCTWCCCTO....WSHO
35 20 OCCTTTCCTTWCCCCO...WSHO
36 20 OTCTTTCCTTWCVVCCO.WSHO
37 20 OTCTTCCTTTWCVVVCCWSHO
38 20 OTTCCTTTTTWCVCVCCOEO
39 19 OYEEYYYYYYYCVCCCCGYO
40 18 OGYYYYGGYYYYOCCCOFLFO
41 17 OGTTOCCTTTOBNOCOKFFKO
42 16 OHTTOCCCTTOBNNOCOKKO
43 15 OHTTOCCCTTOBNNNOOGO
44 14 OHTOCCCCTTOBNNNOOO
45 13 OHTOCCCCTTOBNNNNO
46 12 OHTOCCCCTTOBNNNNNO
47 11 OHT.OCCCTTOBUNNNNNO
48 11 OHO.OCCCTTOBUUNNNNNO
49 12 OO.OCCCCTTOBUUNNNNNO
50 15 OCCVCCTTOBUNNNNNNNNO
51 15 OCVVCCTTOBUNNNBNNNNO
52 14 OCVVCCTTOBUNNNBBNNNNO
53 14 OCVVCCTTOBUNNNBBNNNNO
54 13 OCVVCCTTOBUNNNBBBUNNNO
55 13 OCCVCCTTOBUNNNOOBUNNO
56 13 OCCCTTTOOBUNNO..OBNNO
57 14 OOOOOOO.OUUNO...ONNO
58 20 OHHHO....OHSSO
59 19 OHSWHO....OHSWWO
60 18 OOOOOOO....OOOOOOO
'''

def write_sources():
    (ROOT/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n')
    for name,block in FRAMES.items():
        rows=[list('.'*64) for _ in range(64)]
        for line in block.strip().splitlines():
            y,x,pixels=line.split(); y=int(y); x=int(x)
            if not(1<=x and x+len(pixels)<=63 and 1<=y<=60):
                raise ValueError((name,y,x,len(pixels)))
            if set(pixels)-set(PALETTE)-{'.'}: raise ValueError((name,line))
            rows[y][x:x+len(pixels)]=pixels
        folder=ROOT/('poses' if name in ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'] else 'actions')
        folder.mkdir(exist_ok=True)
        (folder/(name+'.pxgrid')).write_text('\n'.join(''.join(row) for row in rows)+'\n')

def read_more():
    path=ROOT/'literal-rows.txt'
    if not path.exists(): return
    name=None
    for line in path.read_text().splitlines():
        if line.startswith('['):
            name=line[1:-1];FRAMES[name]=''
        elif line.strip() and not line.startswith('#'):
            FRAMES[name]+=line+'\n'

if __name__=='__main__':
    read_more()
    repairs=ROOT/'repair-rows.txt'
    if repairs.exists():
        name=None
        for line in repairs.read_text().splitlines():
            if line.startswith('['): name=line[1:-1]
            elif line.strip() and not line.startswith('#'): FRAMES[name]+=line+'\n'
    write_sources()
    from importlib.util import spec_from_file_location, module_from_spec
    spec = spec_from_file_location('skirt_fall_revision', ROOT/'apply-skirt-fall.py')
    revision = module_from_spec(spec)
    spec.loader.exec_module(revision)
    revision.apply()
