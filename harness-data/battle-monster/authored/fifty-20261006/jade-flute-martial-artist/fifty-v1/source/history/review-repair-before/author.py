"""Explicit authored row spans. No geometry, tracing, pose transforms or shading synthesis."""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parent
PALETTE = {
 'O':'#19212a','H':'#28323c','h':'#48545d',
 'J':'#205450','G':'#388477','g':'#82c5a1',
 'S':'#ac755b','s':'#dcab80','L':'#f3d5a1',
 'C':'#687b86','c':'#b1bdbb','W':'#edf0db',
 'B':'#303c4c','b':'#56667a','T':'#317e8a',
 't':'#68d3c7','E':'#d7fff1','P':'#9a6dac'
}
ROOT.mkdir(exist_ok=True)
(ROOT/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n')
def frame(name, y0, rows):
    canvas = ['.'*64 for _ in range(64)]
    for y,line in enumerate(rows.strip().splitlines(),y0):
        x,pixels = line.strip().split(' ',1)
        x = int(x)
        assert x > 0 and x+len(pixels) < 64, (name,y,x,len(pixels))
        assert 0 < y <= 60, (name,y)
        assert set(pixels) <= set(PALETTE)|{'.'},(name,y,pixels)
        canvas[y] = '.'*x+pixels+'.'*(64-x-len(pixels))
    folder = ROOT/('actions' if name.startswith(('skill','poison','stun','sleep')) else 'poses')
    folder.mkdir(exist_ok=True)
    (folder/(name+'.pxgrid')).write_text('\n'.join(canvas)+'\n')

frame('idle_a',8,'''
28 OOOOOOOOOO
26 OOhhhhhHHHHOO
25 OhhhhhHHHHHHHHO
24 OhhhhHHHHHHHHHHO
24 OhhHHHHHHHHHHHHOO
24 OHHHHHHHHHHHHOHHO
24 OJGGggggggGGGGGJJO
23 OJGGGGGGGGGGGGGGJO
23 OHHOSLLLLLssssssSO
24 OHOssLLLLssssssssO
25 OOSsLLOOsssOOsssSO
26 OSsLLLsOssssOsssSO
27 OsLLLsssssssssSO
27 OSsLLssssssssLLsO
28 OsLLssssssssssSO
28 OSsssssssSSsssSO
29 OSSssssssssssSO
30 OSSssssssssSO
31 OOSSSSSSSSO
32 OsLLssssSO
30 OCWsLLssSCO
27 OOCWWssSCccCOO
25 OCWWWcSCWWWccCCO
24 OCWWWccCWWWccccCCO
23 OCWWWWccCWWcccCCCO
22 OCWWWWccCWWWcccCCCO.............JgO
22 OCWWccOCcCWWWccCCCO...........JgGO
22 OCWccOOCccCWWWcCCCcO.........JgGO
21 OCWccO.OCccCWWccCCWcO.......JgGO
21 OCWccO..OCcccWWccCWWcO.....JgGO
21 OCWcCO..OCccccccccCWWcO...JgGO
21 OCWcCO..OJGGgggGGJCCWcO.JgGO
21 OCcCCO..OJGGGGGGGJJCCcsJgGO
22 OSSsO...OCccccccccCCcLsGGO
22 OsLsO..OCWWcccccccCCOsLsJO
23 OSSO...OCWWcccccccCCOOSSO
27 OCWWWccCcccCCCO
26 OCWWWccCCcccCCCO
26 OCWWcccCCccccCCO
26 OCWcccCOOCccccCCO
26 OCWcccO..OCcccCCO
26 OCWccCO..OCcccCCO
26 OCWccCO..OCcccCCO
25 OCWccCO...OCccCCO
25 OCWccCO...OCccCCO
25 OCcccCO...OCccCCO
25 OCccCCO...OCccCCO
25 OCcCCCO...OCcCCCO
25 OCCCCCO...OCCCCCO
24 OBBBBBO...OBBBBBBO
24 OBbbbBO...OBbbbBBO
23 OBbbbBBO..OBbbbbBBO
23 OOOOOOOO..OOOOOOOOO
''')

frame('idle_b',8,'''
28 OOOOOOOOOO
26 OOhhhhhHHHHOO
25 OhhhhhHHHHHHHHO
24 OhhhhHHHHHHHHHHO
24 OhhHHHHHHHHHHHHOO
24 OHHHHHHHHHHHHOHHO
24 OJGGggggggGGGGJJO
23 OJGGGGGGGGGGGGGJJO
23 OHHOSLLLLLssssssSO
24 OHOssLLLLssssssssO
25 OOSsLLOOsssOOsssSO
26 OSsLLLsOssssOsssSO
27 OsLLLsssssssssSO
27 OSsLLssssssssLLsO
28 OsLLssssssssssSO
28 OSsssssssSSsssSO
29 OSSssssssssssSO
30 OSSssssssssSO
31 OOSSSSSSSSO
32 OsLLssssSO
30 OCWsLLssSCO
27 OOCWWssSCccCOO
25 OCWWWcSCWWWccCCO
24 OCWWWccCWWWWcccCCO
23 OCWWWWccCWWWcccCCCO
22 OCWWWWccCWWWWcccCCCO............JgO
22 OCWWccOCcCWWWcccCCCO..........JgGO
22 OCWccOOCccCWWWccCCWcO........JgGO
21 OCWccO.OCccCWWWcCCWWcO......JgGO
21 OCWccO..OCcccWWccCCWWcO....JgGO
21 OCWcCO..OCccccccccCCWWcO..JgGO
21 OCWcCO..OJGGgggGGJCCCWcOJgGO
21 OCcCCO..OJGGGGGGGJJCCcLsGGO
22 OSSsO...OCccccccccCCCOsLsJO
22 OsLsO..OCWWcccccccCCCOOSSO
23 OSSO...OCWWcccccccCCO
27 OCWWWccCcccCCCO
26 OCWWWccCCcccCCCO
26 OCWWcccCCccccCCO
26 OCWcccCOOCccccCCO
26 OCWcccO..OCcccCCO
26 OCWccCO..OCcccCCO
26 OCWccCO..OCcccCCO
25 OCWccCO...OCccCCO
25 OCWccCO...OCccCCO
25 OCcccCO...OCccCCO
25 OCccCCO...OCccCCO
25 OCcCCCO...OCcCCCO
25 OCCCCCO...OCCCCCO
24 OBBBBBO...OBBBBBBO
24 OBbbbBO...OBbbbBBO
23 OBbbbBBO..OBbbbbBBO
23 OOOOOOOO..OOOOOOOOO
''')
frame('idle_c',8,'''
28 OOOOOOOOOO
26 OOhhhhhHHHHOO
25 OhhhhhHHHHHHHHO
24 OhhhhHHHHHHHHHHO
24 OhhHHHHHHHHHHHHOO
24 OHHHHHHHHHHHHOHHO
24 OJGGggggggGGGGGJJO
23 OJGGGGGGGGGGGGGGJO
23 OHHOSLLLLLssssssSO
24 OHOssLLLLssssssssO
25 OOSsLLOOsssOOsssSO
26 OSsLLLsSssssSsssSO
27 OsLLLsssssssssSO
27 OSsLLssssssssLLsO
28 OsLLssssssssssSO
28 OSsssssssSSsssSO
29 OSSssssssssssSO
30 OSSssssssssSO
31 OOSSSSSSSSO
32 OsLLssssSO
30 OCWsLLssSCO
27 OOCWWssSCccCOO
25 OCWWWcSCWWWccCCO
24 OCWWWccCWWWccccCCO
23 OCWWWWccCWWcccCCCO
22 OCWWWWccCWWWcccCCCO
22 OCWWccOCcCWWWccCCCO.............JgO
22 OCWccOOCccCWWWcCCCcO...........JgGO
21 OCWccO.OCccCWWccCCWcO.........JgGO
21 OCWccO..OCcccWWccCWWcO.......JgGO
21 OCWcCO..OCccccccccCWWcO.....JgGO
21 OCWcCO..OJGGgggGGJCCWcO...JgGO
21 OCcCCO..OJGGGGGGGJJCCWcO.JgGO
22 OSSsO...OCccccccccCCcsLsJgGO
22 OsLsO..OCWWcccccccCCOsLsGJO
23 OSSO...OCWWcccccccCCOOSSO
27 OCWWWccCcccCCCO
26 OCWWWccCCcccCCCO
26 OCWWcccCCccccCCO
26 OCWcccCOOCccccCCO
26 OCWcccO..OCcccCCO
26 OCWccCO..OCcccCCO
26 OCWccCO..OCcccCCO
25 OCWccCO...OCccCCO
25 OCWccCO...OCccCCO
25 OCcccCO...OCccCCO
25 OCccCCO...OCccCCO
25 OCcCCCO...OCcCCCO
25 OCCCCCO...OCCCCCO
24 OBBBBBO...OBBBBBBO
24 OBbbbBO...OBbbbBBO
23 OBbbbBBO..OBbbbbBBO
23 OOOOOOOO..OOOOOOOOO
''')
# Coil the foreground right elbow back beside the collar; flute projects above shoulder.
frame('windup',9,'''
26 OOOOOOOOOO
24 OOhhhhhHHHHOO
23 OhhhhhHHHHHHHHO
22 OhhhhHHHHHHHHHHO
22 OhhHHHHHHHHHHHHOO
22 OHHHHHHHHHHHHOHHO
22 OJGGggggggGGGGJJO
21 OJGGGGGGGGGGGGGJJO
21 OHHOSLLLLLssssssSO
22 OHOssLLLLssssssssO
23 OOSsLLOOsssOOsssSO
24 OSsLLLsOssssOsssSO
25 OsLLLsssssssssSO
25 OSsLLssssssssLLsO
26 OsLLssssssssssSO
26 OSsssssssSSsssSO
27 OSSssssssssssSO
28 OSSssssssssSO
29 OOSSSSSSSSO.......OJgggggGJO
30 OsLLssssSO....OJggGGGJJOO
27 OOCWsLLssSCOOJggGGJJOO
25 OCWWWssSCccJggGGJJOO
23 OCWWWccCWWsLsGGJOO
22 OCWWWWcCWWLsLsJO
21 OCWWWcccCWWsSSO
21 OCWWccCccCWWccO
20 OCWWcCOCcCWWcccO
20 OCWccCOOCccWWccO
20 OCWccCO.OCccWWccO
21 OCWccCO..OCccWWcO
21 OCcCCO...OJGGggGJO
22 OssSO....OJGGGGGJO
22 OsLsO...OCcccccccCO
23 OSSO...OCWWccccccCO
26 OCWWWccccccCCCO
25 OCWWccCCCcccCCCO
25 OCWccCCOOCCCCCCO
25 OCWccCO..OCcccCCO
25 OCWccCO...OCcccCCO
25 OCWccCO...OCcccCCO
25 OCccCCO....OCccCCO
24 OCccCCO.....OCccCCO
24 OCccCCO......OCccCCO
24 OCccCCO.......OCccCCO
24 OCCCCCO........OCCCCO
23 OBBBBBO.........OBBBBO
23 OBbbbBO.........OBbbBBO
22 OBbbbBBO.........OBbbBBO
22 OBbbbBBO..........OBbbBBO
22 OOOOOOOO..........OOOOOOO
22 OBBBBBBO..........OBBBBBBO
22 OOOOOOOO..........OOOOOOOO
''')
# Leading thigh and loaded rear knee are separately authored from the windup.
frame('move',9,'''
31 OOOOOOOOO
29 OOhhhhhHHHOO
28 OhhhhhHHHHHHHO
27 OhhhhHHHHHHHHHO
27 OhhHHHHHHHHHHHOO
27 OHHHHHHHHHHHOHHO
27 OJGGggggggGGGGJJO
26 OJGGGGGGGGGGGGGJO
26 OHHOSLLLLLsssssSO
27 OHOssLLLLsssssssSO
28 OOSsLLOOsssOOssSO
29 OSsLLLsOssssOssSO
30 OsLLLssssssssSO
30 OSsLLsssssssLLsO
31 OsLLsssssssssSO
31 OSssssssSSsssSO
32 OSSsssssssssSO
33 OSSsssssssSO
34 OOSSSSSSSO
33 OCWsLLsssSO
30 OCWWWssSCccOO
28 OCWWWccCWWWccCOO
26 OCWWWWccCWWcccCCO
24 OCWWWWWccCWWcccCCO
22 OCWWWcccCWWcccCCWcOO
20 OCWWWccCccCWWccCWWccO
19 OCWWccCOCcCWWWcCCWWccO
18 OCWccCCOOCccWWccCCCWccO
17 OCWccCCO.OCccWWccCCCWccO
16 OCWccCCO..OJGGggGGJCCCcO
16 OCccCCO...OJGGGGGGJJCsLsO
16 OssSSO....OCccccccccCOsLsO
17 OsLsO....OCWWcccccccCOOSSJO
18 OSSO....OCWWccCCCcccCCO.JgGO
25 OCWWWccCCOOCCCcccCCO.JgGO
24 OCWWWccCO..OCCCcccCCJgGO
23 OCWWWccCO...OCCCcccJgGO
22 OCWWWccCO....OCCcJgGO
21 OCWWccCCO.....OCJgGCCO
20 OCWWccCCO......OCcccCCO
19 OCWWccCCO.......OCcccCCO
18 OCWWccCCO........OCcccCCO
17 OCWWccCCO.........OCccCCO
16 OCWWccCCO..........OCCCCO
15 OCWWccCCO............OBBBO
14 OCWWccCCO.............OBbBBO
13 OCWWccCCO..............OBbBBO
12 OCCCCCCO................OBbBBO
11 OBBBBBBO.................OBbBBO
10 OBbbbBBO..................OBbBBO
9 OBbbbbBBO..................OBbbbBBO
8 OOOOOOOOO..................OOOOOOOO
''')
# Contact: shoulder, elbow, wrist and hand travel right; horizontal jade flute has one axis.
frame('attack',10,'''
33 OOOOOOOOO
31 OOhhhhhHHHOO
30 OhhhhhHHHHHHHO
29 OhhhhHHHHHHHHHO
29 OhhHHHHHHHHHHHOO
29 OHHHHHHHHHHHOHHO
29 OJGGggggggGGGGJJO
28 OJGGGGGGGGGGGGGJO
28 OHHOSLLLLLsssssSO
29 OHOssLLLLsssssssSO
30 OOSsLLOOsssOOssSO
31 OSsLLLsOssssOssSO
32 OsLLLssssssssSO
32 OSsLLsssssssLLsO
33 OsLLsssssssssSO
33 OSssssssSSsssSO
34 OSSsssssssssSO
35 OSSsssssssSO
35 OOSSSSSSSO
33 OCWsLLsssSO
31 OCWWWssSCccOO
29 OCWWWccCWWWccCOO
27 OCWWWWccCWWcccCCWO
25 OCWWWWWccCWWWccCWWWOO
23 OCWWWcccCWWcccCCWWWWWcOO
22 OCWWccCCcCWWcccCWWWWWWccOsLsO
21 OCWccCCOCccWWccCCcccccccOsLsO
20 OCWccCCOOJGGggGGJCCCccccOSSsOOOO
19 OCWccCCO.OJGGGGGGJJCOOOOJggGgGgGGgGJO
19 OCccCCO..OCccccccccCCO...OJJJJJJJJJJJJO
20 OsLsSO..OCWWcccccccCCCO
20 OSSsO..OCWWccccCCCCcccCCO
21 OOOO..OCWWcccCCOOCCCcccCCO
27 OCWWWcccCO..OCCCcccCCO
26 OCWWWcccCO...OCCCcccCCO
25 OCWWWcccCO....OCCCcccCCO
24 OCWWWcccCO.....OCCCcccCCO
23 OCWWcccCCO......OCWcccCCO
22 OCWWcccCCO.......OCWcccCCO
21 OCWWcccCCO........OCWccCCO
20 OCWWcccCCO.........OCWcCCO
19 OCWWcccCCO..........OCcCCO
18 OCWWcccCCO..........OCcCCO
17 OCWWcccCCO..........OCcCCO
16 OCWWcccCCO..........OCCCCO
15 OCWWcccCCO...........OBBBO
14 OCWWcccCCO............OBbBO
13 OCCCCCCCO..............OBbBO
12 OBBBBBBBO..............OBbbBO
11 OBbbbbBBO..............OBbbbbBBO
10 OOOOOOOOO..............OOOOOOOOOO
''')
frame('recover',9,'''
30 OOOOOOOOOO
28 OOhhhhhHHHHOO
27 OhhhhhHHHHHHHHO
26 OhhhhHHHHHHHHHHO
26 OhhHHHHHHHHHHHHOO
26 OHHHHHHHHHHHHOHHO
26 OJGGggggggGGGGJJO
25 OJGGGGGGGGGGGGGJJO
25 OHHOSLLLLLssssssSO
26 OHOssLLLLssssssssO
27 OOSsLLOOsssOOsssSO
28 OSsLLLsOssssOsssSO
29 OsLLLsssssssssSO
29 OSsLLssssssssLLsO
30 OsLLssssssssssSO
30 OSsssssssSSsssSO
31 OSSssssssssssSO
32 OSSssssssssSO
33 OOSSSSSSSSO
33 OsLLssssSO
30 OOCWsLLssSCO
28 OCWWWssSCccCOO
26 OCWWWccCWWWccCCO
25 OCWWWWcCWWWcccCCO
24 OCWWWWccCWWWccCCCO
23 OCWWccOCcCWWWcccCCO
22 OCWccCOOCccCWWccCCCcO
22 OCWccCO.OCccCWWccCWWcO
21 OCWccCO..OCcccWWccCWWcO
21 OCWccCO..OCcccccccCCWWcO
21 OCWccCO..OJGGggGGJCCWcO.....JgO
21 OCcCCO...OJGGGGGGJCCcsO...JgGO
22 OssSO....OCccccccccCLsLsJgGO
22 OsLsO...OCWWcccccccCOssJgGO
23 OSSO...OCWWccccccccCCOJgGO
27 OCWWWccCCCcccCCCO..JgGO
26 OCWWWccCOOCcccCCCOJgGO
25 OCWWWccCO.OCccccCCOJO
25 OCWWcccCO..OCcccCCO
25 OCWWccCO....OCccCCO
24 OCWWccCO.....OCccCCO
24 OCWcccCO.....OCccCCO
24 OCWcccCO.....OCccCCO
24 OCcccCCO.....OCccCCO
24 OCcccCCO.....OCccCCO
24 OCccCCCO.....OCCCCCO
24 OCCCCCCO......OBBBBO
23 OBBBBBBO......OBbbBBO
23 OBbbbBBO......OBbbBBO
22 OBbbbbBBO.....OBbbbBBO
22 OBbbbbBBO.....OBbbbbBBO
22 OOOOOOOOO.....OOOOOOOOO
''')
frame('hit',8,'''
25 OOOOOOOOOO
23 OOhhhhhHHHHOO
22 OhhhhhHHHHHHHHO
21 OhhhhHHHHHHHHHHO
21 OhhHHHHHHHHHHHHOO
21 OHHHHHHHHHHHHOHHO
21 OJGGggggggGGGGJJO
20 OJGGGGGGGGGGGGGJJO
20 OHHOSLLLLLssssssSO
21 OHOssLLLLssssssssO
22 OOSsLLsOOssOOsssSO
23 OSsLLLssOsssOsssSO
24 OsLLLsssssssssSO
24 OSsLLssssssssLLsO
25 OsLLssssssssssSO
25 OSsssssSOOsssSSO
26 OSSsssssSSsssSO
27 OSSssssssssSO
28 OOSSSSSSSSO
29 OsLLsssSO
27 OCWsLLssSO
25 OCWWWssSCcCO
24 OCWWWcSCWWccCO
23 OCWWWWcCWWcccCOO
22 OCWWWWccCWWcccCCCO
22 OCWWccCccCWWcccCCCO
21 OCWccCOCcCWWcccCCWcO
20 OCWccCOOCccWWccCCWWcO
20 OCWccCO.OCcccWWccCCWWcO
20 OCWccCO..OCccccccCCWWcO
20 OCWccCO..OJGGggGGJCCWcO
20 OCWccCO..OJGGGGGGJJCCWcO
21 OCcCCO...OCcccCCssCWWcO
22 OSSsO...OCWWccCLsLsCcO
22 OsLsO..OCWWcccCOssSSO
23 OSSO..OCWWcccCCOOOJsO
26 OCWWcccCCOOCCCccOGgJO
25 OCWWcccCO..OCccccOJgGO
25 OCWcccCO....OCcccCOJgGO
25 OCWcccCO.....OCccCCOJgGO
25 OCWcccCO.....OCccCCO.JgGO
24 OCWcccCO......OCccCCO.JgGO
24 OCWcccCO......OCccCCO..JgGO
24 OCWcccCO.......OCccCCO..JgGO
24 OCcccCCO.......OCccCCO...JgGO
24 OCccCCCO.......OCccCCO....JgGO
24 OCCCCCCO.......OCCCCCO.....JJO
23 OBBBBBBO........OBBBBBO
23 OBbbbBBO........OBbbBBO
22 OBbbbbBBO.......OBbbbBBO
22 OBbbbbBBO.......OBbbbbBBO
22 OOOOOOOOO.......OOOOOOOOO
''')
# Lowered body and skin neck remain joined; bent thighs, separate feet, relaxed hand.
frame('dead',39,'''
39 OOOOOOOOO
37 OOhhhhhHHHOO
36 OhhhhhHHHHHHOO
35 OhhhhHHHHHHHHHO
35 OhhHHHHHHHHHHHHO
35 OJGGggggggGGGGJJO
35 OJGGGGGGGGGGGGGJO
35 OHHOSLLLLLsssssSO
35 OHOssLLLLsssssssSO
34 OSSsLLssHHsssHsssO
32 OOssLLssssssssLLsO
29 OOCssLLLssssssssssSO
25 OOCWWssSSssssssSSSO
21 OOCWWWcSCssSSssssSO
17 OOCWWWccCCsLLSSSSO
14 OOCWWWWcccCCsLLsSCOO
11 OOCWWWWccCCCWWssSCccCOOOOO
9 OOCWWWcccCCCCCWWWccCWWccCOssLsSO
8 OCWWWccCCOOCCccWWWccCCccCOOSSsO.JggGgGGGgGGGJO
7 OCWWcccCCO..OCCCccccccccCCCOOOO.OJJJJJJJJJJJJO
6 OBBBBBCCCO...OCCCCCccCCCccCCO
6 OOOOOOOOO.....OOOOOOOOOOOOOO
''')
# Breath gathers at mouth (41,23) and the one horizontal flute shaft.
frame('skill_a',8,'''
27 OOOOOOOOOO
25 OOhhhhhHHHHOO
24 OhhhhhHHHHHHHHO
23 OhhhhHHHHHHHHHHO
23 OhhHHHHHHHHHHHHOO
23 OHHHHHHHHHHHHOHHO
23 OJGGggggggGGGGJJO
22 OJGGGGGGGGGGGGGJJO
22 OHHOSLLLLLssssssSO
23 OHOssLLLLssssssssO
24 OOSsLLOOsssOOsssSO
25 OSsLLLsOssssOsssSO
26 OsLLLsssssssssSO
26 OSsLLssssssssLLsO........tE
27 OsLLssssssssssSO.......TtE
27 OSsssssssSSssSJOgggGgGGGtEt
28 OSSssssssssssSOJJJJJJJJGtET
29 OSSssssssssSO...OsLsOO..Ttt
30 OOSSSSSSSSO...OsLLsO.....T
31 OsLLssssSO..OCssSSO
29 OCWsLLssSCOOCWcCO
26 OOCWWssSCccCWWccO
24 OCWWWcSCWWWcWWcCO
23 OCWWWccCWWcCWWcCO
22 OCWWWWccCWWCWWcCO
21 OCWWWWccCWWWcWcCO
21 OCWWccOCcCWWccWcCO
21 OCWccOOCccCWWccCCO
20 OCWccO.OCccCWWccCCO
20 OCWccO..OCcccWWcCCO
20 OCWcCO..OCcccccccCO
20 OCWcCO..OJGGgggGGJO
20 OCcCCO..OJGGGGGGGJO
21 OSSsO...OCcccccccCCO
21 OsLsO..OCWWccccccCCO
22 OSSO...OCWWccccccCCO
26 OCWWWccCcccCCCO
25 OCWWWccCCcccCCCO
25 OCWWcccCCccccCCO
25 OCWcccCOOCccccCCO
25 OCWcccO..OCcccCCO
25 OCWccCO..OCcccCCO
25 OCWccCO..OCcccCCO
24 OCWccCO...OCccCCO
24 OCWccCO...OCccCCO
24 OCcccCO...OCccCCO
24 OCccCCO...OCccCCO
24 OCcCCCO...OCcCCCO
24 OCCCCCO...OCCCCCO
23 OBBBBBO...OBBBBBBO
23 OBbbbBO...OBbbbBBO
22 OBbbbBBO..OBbbbbBBO
22 OOOOOOOO..OOOOOOOOO
''')
# Three connected, separately terminating sonic blades: upper, long middle, lower.
frame('skill_b',8,'''
25 OOOOOOOOOO
23 OOhhhhhHHHHOO
22 OhhhhhHHHHHHHHO
21 OhhhhHHHHHHHHHHO
21 OhhHHHHHHHHHHHHOO.................tEE
21 OHHHHHHHHHHHHOHHO..............TtEET
21 OJGGggggggGGGGJJO.............TtEET
20 OJGGGGGGGGGGGGGJJO...........TtEET
20 OHHOSLLLLLssssssSO...........tEET
21 OHOssLLLLssssssssO..........tEET
22 OOSsLLOOsssOOsssSO.........tEET
23 OSsLLLsOssssOsssSO.......TtEET
24 OsLLLsssssssssSO........tEET
24 OSsLLssssssssLLsO.....TtEET
25 OsLLssssssssssSO....TtEET.....ttEE
25 OSsssssssSSssSJggggtEtTTtEEEEEET
26 OSSssssssssssSOJJJGtEEEEEEEETT
27 OSSssssssssSO..OsLJttETTTTT..tE
28 OOSSSSSSSSO..OsLLsO.TtET...TtEE
29 OsLLssssSO.OCssSSO...TtET...tEE
27 OCWsLLssSCOCWcCCO.....TtET.TtET
24 OOCWWssSCcCWWccCO.......TtEtET
22 OCWWWcSCWWCWWccCO........TtEET
21 OCWWWccCWcCWWcCO..........TtEET
20 OCWWWWccCWCWWcCO...........TtEET
19 OCWWWWccCWcWWcCO............TtEET
19 OCWWccOCcCWWccCO..............tEE
19 OCWccOOCccCWWccCO..............Tt
18 OCWccO.OCccCWWccCO
18 OCWccO..OCcccWWCCO
18 OCWcCO..OCcccccccCO
18 OCWcCO..OJGGgggGGJO
18 OCcCCO..OJGGGGGGGJO
19 OSSsO...OCcccccccCCO
19 OsLsO..OCWWccccccCCO
20 OSSO...OCWWccccccCCO
24 OCWWWccCcccCCCO
23 OCWWWccCCcccCCCO
23 OCWWcccCCccccCCO
23 OCWcccCOOCccccCCO
23 OCWcccO..OCcccCCO
23 OCWccCO..OCcccCCO
23 OCWccCO..OCcccCCO
22 OCWccCO...OCccCCO
22 OCWccCO...OCccCCO
22 OCcccCO...OCccCCO
22 OCccCCO...OCccCCO
22 OCcCCCO...OCcCCCO
22 OCCCCCO...OCCCCCO
21 OBBBBBO...OBBBBBBO
21 OBbbbBO...OBbbbBBO
20 OBbbbBBO..OBbbbbBBO
20 OOOOOOOO..OOOOOOOOO
''')
frame('skill_c',8,'''
28 OOOOOOOOOO
26 OOhhhhhHHHHOO
25 OhhhhhHHHHHHHHO
24 OhhhhHHHHHHHHHHO
24 OhhHHHHHHHHHHHHOO
24 OHHHHHHHHHHHHOHHO
24 OJGGggggggGGGGJJO
23 OJGGGGGGGGGGGGGJJO
23 OHHOSLLLLLssssssSO
24 OHOssLLLLssssssssO
25 OOSsLLOOsssOOsssSO
26 OSsLLLsOssssOsssSO
27 OsLLLsssssssssSO
27 OSsLLssssssssLLsO
28 OsLLssssssssssSO
28 OSsssssssSSsssSO
29 OSSssssssssssSO.............tE
30 OSSssssssssSO..............tET
31 OOSSSSSSSSO................T
32 OsLLssssSO..................tE
30 OCWsLLssSCO..................Tt
27 OOCWWssSCccCOO
25 OCWWWcSCWWWccCCO
24 OCWWWccCWWWccccCCO
23 OCWWWWccCWWcccCCCO.................t
22 OCWWWWccCWWWcccCCCO...............tET
22 OCWWccOCcCWWWccCCCO.............tEt
22 OCWccOOCccCWWWcCCCcO...........JgT
21 OCWccO.OCccCWWccCCWcO.........JgGO
21 OCWccO..OCcccWWccCWWcO.......JgGO
21 OCWcCO..OCccccccccCWWcO.....JgGO
21 OCWcCO..OJGGgggGGJCCWcO...JgGO
21 OCcCCO..OJGGGGGGGJJCCWcO.JgGO
22 OSSsO...OCccccccccCCcsLsJgGO
22 OsLsO..OCWWcccccccCCOsLsGJO
23 OSSO...OCWWcccccccCCOOSSO
27 OCWWWccCcccCCCO
26 OCWWWccCCcccCCCO
26 OCWWcccCCccccCCO
26 OCWcccCOOCccccCCO
26 OCWcccO..OCcccCCO
26 OCWccCO..OCcccCCO
26 OCWccCO..OCcccCCO
25 OCWccCO...OCccCCO
25 OCWccCO...OCccCCO
25 OCcccCO...OCccCCO
25 OCccCCO...OCccCCO
25 OCcCCCO...OCcCCCO
25 OCCCCCO...OCCCCCO
24 OBBBBBO...OBBBBBBO
24 OBbbbBO...OBbbbBBO
23 OBbbbBBO..OBbbbbBBO
23 OOOOOOOO..OOOOOOOOO
''')
# Sick: left hand presses jaw, shoulders contract; jade flute droops in the right hand.
frame('poison_a',13,'''
25 OOOOOOOOOO
23 OOhhhhhHHHHOO
22 OhhhhhHHHHHHHHO
21 OhhhhHHHHHHHHHHO
21 OhhHHHHHHHHHHHHOO
21 OHHHHHHHHHHHHOHHO
21 OJGGggggggGGGGJJO
20 OJGGGGGGGGGGGGGJJO
20 OHHOSLLLLLssssssSO................PP
21 OHOssLLLLssssssssO..............PEtP
22 OOSsLLOOsssOOsssSO..............PtTP
23 OSsLLLsSssssSsssSO...............PP
24 OsLLLsssssssssSO
24 OSsLLssssssssLLsO
25 OsLLssssssssssSO
25 OSsssssSSsssSSSO
26 OSSsssssssssSSO
27 OSSsssssssSSO
28 OOSSSSSSSSO
28 OsLLssLsLsO
26 OCWsLLsLsLsO
24 OCWWWssSSsSOO
23 OCWWWccCWWcCOO
22 OCWWWcccCWWcCCO
21 OCWWcCOCcCWWcCCO
21 OCWWcCOOCccWWccCO
21 OCWWcCO.OCccWWccCO
22 OCWWcCO..OCcccWWcCO
23 OCccCCO..OCccccccCCO
24 OCCCCO...OJGGggGGJCO
26 OOOO....OJGGGGGGJCCO
29 OCWWccccccccCCcsO
28 OCWWWcccccccCCLsLsO
27 OCWWWcccCcccCCOsLsO
27 OCWWcccCCCcccCCOSSJO
27 OCWWccCCOOCcccCCOJGgO
27 OCWWccCO..OCcccCCOJgGO
27 OCWcccCO...OCccCCO.JgGO
26 OCWcccCO...OCccCCO..JgGO
26 OCWcccCO...OCccCCO...JgGO
26 OCcccCCO...OCccCCO....JgGO
26 OCccCCCO...OCccCCO.....JgGO
26 OCCCCCCO...OCCCCCO......JJO
25 OBBBBBBO...OBBBBBBO
25 OBbbbBBO...OBbbbBBO
24 OBbbbbBBO..OBbbbbBBO
24 OOOOOOOOO..OOOOOOOOO
''')
frame('poison_b',12,'''
26 OOOOOOOOOO
24 OOhhhhhHHHHOO
23 OhhhhhHHHHHHHHO
22 OhhhhHHHHHHHHHHO
22 OhhHHHHHHHHHHHHOO
22 OHHHHHHHHHHHHOHHO
22 OJGGggggggGGGGJJO
21 OJGGGGGGGGGGGGGJJO...............PPP
21 OHHOSLLLLLssssssSO.............PEttP
22 OHOssLLLLssssssssO.............PtTTP
23 OOSsLLOOsssOOsssSO..............PPP
24 OSsLLLsSssssSsssSO
25 OsLLLsssssssssSO
25 OSsLLssssssssLLsO................PP
26 OsLLssssssssssSO...............PEtP
26 OSsssssSSsssSSSO...............PTtP
27 OSSsssssssssSSO.................PP
28 OSSsssssssSSO
29 OOSSSSSSSSO
29 OsLLssLsLsO
27 OCWsLLsLsLsO
25 OCWWWssSSsSOO
24 OCWWWccCWWcCOO
23 OCWWWcccCWWcCCO
22 OCWWcCOCcCWWcCCO
22 OCWWcCOOCccWWccCO
22 OCWWcCO.OCccWWccCO
23 OCWWcCO..OCcccWWcCO
24 OCccCCO..OCccccccCCO
25 OCCCCO...OJGGggGGJCO
27 OOOO....OJGGGGGGJCCO
29 OCWWccccccccCCcsO
28 OCWWWcccccccCCLsLsO
27 OCWWWcccCcccCCOsLsO
27 OCWWcccCCCcccCCOSSJO
27 OCWWccCCOOCcccCCOJGgO
27 OCWWccCO..OCcccCCOJgGO
27 OCWcccCO...OCccCCO.JgGO
26 OCWcccCO...OCccCCO..JgGO
26 OCWcccCO...OCccCCO...JgGO
26 OCcccCCO...OCccCCO....JgGO
26 OCccCCCO...OCccCCO.....JgGO
26 OCcCCCCO...OCccCCO......JgGO
26 OCCCCCCO...OCCCCCO.......JJO
25 OBBBBBBO...OBBBBBBO
25 OBbbbBBO...OBbbbBBO
24 OBbbbbBBO..OBbbbbBBO
24 OBbbbbBBO..OBbbbbBBO
24 OOOOOOOOO..OOOOOOOOO
''')
# Stun: weapon arm and far arm hang; lowered face retains the same hair/headband.
frame('stun_a',11,'''
46 E
45 tEt
46 E
27 OOOOOOOOOO.....................t
25 OOhhhhhHHHHOO..................tEt
24 OhhhhhHHHHHHHHO.................t
23 OhhhhHHHHHHHHHHO
23 OhhHHHHHHHHHHHHOO
23 OHHHHHHHHHHHHOHHO
23 OJGGggggggGGGGJJO
22 OJGGGGGGGGGGGGGJJO
22 OHHOSLLLLLssssssSO
23 OHOssLLLLssssssssO
24 OOSsLLOOsssOOsssSO
25 OSsLLLsSssssSsssSO
26 OsLLLsssssssssSO
26 OSsLLssssssssLLsO
27 OsLLssssssssssSO
27 OSsssssssSSssSSO
28 OSSssssssssssSO
29 OSSssssssssSO
30 OOSSSSSSSSO
31 OsLLsssSO
28 OCWWsLLsSCOO
26 OCWWWssSCWWccCO
24 OCWWWccCWWWccCCO
23 OCWWWWcCWWWcccCCO
22 OCWWccCcCWWcccCCcO
21 OCWccCOCcCWWWccCccO
21 OCWccCOOCccWWccCCccO
21 OCWccCO.OCcccWWCCccO
21 OCWccCO..OCccccCCccO
21 OCWccCO..OJGGggGJccO
21 OCccCCO..OJGGGGGJccO
22 OSSsO...OCccccccCCcO
22 OsLsO..OCWWcccccCCcsO
22 OSSsO..OCWWcccccCCLsLsO
23 OOOO..OCWWcccCCCccOsLsO
26 OCWWcccCOOCcccCCOOSSJO
26 OCWWcccO..OCcccCCOJGgO
26 OCWcccCO..OCcccCCOJgGO
26 OCWcccCO..OCcccCCO.JgGO
25 OCWcccCO...OCccCCO..JgGO
25 OCcccCCO...OCccCCO...JgGO
25 OCCCCCCO...OCCCCCO....JgGO
24 OBBBBBBO...OBBBBBBO....JgGO
24 OBbbbBBO...OBbbbBBO.....JgGO
23 OBbbbbBBO..OBbbbbBBO.....JgGO
23 OBbbbbBBO..OBbbbbBBO......JJO
23 OOOOOOOOO..OOOOOOOOO
''')
frame('stun_b',10,'''
27 t
26 tEt
27 t
27 OOOOOOOOOO
25 OOhhhhhHHHHOO
24 OhhhhhHHHHHHHHO
23 OhhhhHHHHHHHHHHO.....................E
23 OhhHHHHHHHHHHHHOO..................tEt
23 OHHHHHHHHHHHHOHHO...................E
23 OJGGggggggGGGGJJO
22 OJGGGGGGGGGGGGGJJO
22 OHHOSLLLLLssssssSO
23 OHOssLLLLssssssssO
24 OOSsLLOOsssOOsssSO
25 OSsLLLsSssssSsssSO
26 OsLLLsssssssssSO
26 OSsLLssssssssLLsO
27 OsLLssssssssssSO
27 OSsssssssSSssSSO
28 OSSssssssssssSO
29 OSSssssssssSO
30 OOSSSSSSSSO
31 OsLLsssSO
28 OCWWsLLsSCOO
26 OCWWWssSCWWccCO
24 OCWWWccCWWWccCCO
23 OCWWWWcCWWWcccCCO
22 OCWWccCcCWWcccCCcO
21 OCWccCOCcCWWWccCccO
21 OCWccCOOCccWWccCCccO
21 OCWccCO.OCcccWWCCccO
21 OCWccCO..OCccccCCccO
21 OCWccCO..OJGGggGJccO
21 OCccCCO..OJGGGGGJccO
22 OSSsO...OCccccccCCcO
22 OsLsO..OCWWcccccCCcsO
22 OSSsO..OCWWcccccCCLsLsO
23 OOOO..OCWWcccCCCccOsLsO
26 OCWWcccCOOCcccCCOOSSJO
26 OCWWcccO..OCcccCCOJGgO
26 OCWcccCO..OCcccCCOJgGO
26 OCWcccCO..OCcccCCO.JgGO
25 OCWcccCO...OCccCCO..JgGO
25 OCcccCCO...OCccCCO...JgGO
25 OCccCCCO...OCccCCO....JgGO
25 OCCCCCCO...OCCCCCO.....JgGO
24 OBBBBBBO...OBBBBBBO.....JgGO
24 OBbbbBBO...OBbbbBBO......JgGO
23 OBbbbbBBO..OBbbbbBBO......JgGO
23 OBbbbbBBO..OBbbbbBBO.......JJO
23 OOOOOOOOO..OOOOOOOOO
''')
# Sitting sleep. Closed lid pixels are separated from nose/mouth and standing eyes.
frame('sleep_a',22,'''
28 OOOOOOOOOO
26 OOhhhhhHHHHOO
25 OhhhhhHHHHHHHHO
24 OhhhhHHHHHHHHHHO
24 OhhHHHHHHHHHHHHOO
24 OHHHHHHHHHHHHOHHO
24 OJGGggggggGGGGJJO
23 OJGGGGGGGGGGGGGJJO
23 OHHOSLLLLLssssssSO
24 OHOssLLLLssssssssO
25 OOSsLLLLsssssssssO
26 OSsLLLHHsssHHsssSO
27 OsLLLsssssssssSO
27 OSsLLssssssssLLsO
28 OsLLssssssssssSO
28 OSsssssssSSsssSO
29 OSSssssssssssSO
30 OSSssssssssSO
31 OOSSSSSSSSO
32 OsLLssssSO
29 OOCWsLLssSCOO
27 OCWWWssSCWWWccCO
25 OCWWWccCWWWWcccCCO
24 OCWWWWccCWWWcccCCWcO
23 OCWWWWccCWWWccCCWWcO
22 OCWWccOCcCWWWcCCWWcO
22 OCWccOOCccCWWccCCWWcO
22 OCWccO.OCccCWWccCCWcO
22 OCWcCO..OCcccccccCCWcO
22 OCcCCO..OJGGgggGGJCCcsO
23 OsLsO..OCJGGGGGGGJCCLsLsO
23 OSSsO.OCWWccccCCCCccOsLsO
24 OOOCWWcccCCOOCCCccccOSSJO
24 OCWWWcccCCO..OCWWWcccCJGgO
23 OCWWWcccCCO...OCWWcccCCJggGgGGGgGGGJO
22 OCWWWcccCCO...OCWWccccCCOJJJJJJJJJJJJO
21 OCCCCCCCcCCO..OCccccccCCO
20 OBBBBBBBCCCO...OCCCCCBBBBBO
20 OOOOOOOOOOOO...OOOOOOOOOOOO
''')
frame('sleep_b',22,'''
28 OOOOOOOOOO
26 OOhhhhhHHHHOO
25 OhhhhhHHHHHHHHO
24 OhhhhHHHHHHHHHHO
24 OhhHHHHHHHHHHHHOO
24 OHHHHHHHHHHHHOHHO
24 OJGGggggggGGGGJJO
23 OJGGGGGGGGGGGGGJJO
23 OHHOSLLLLLssssssSO
24 OHOssLLLLssssssssO
25 OOSsLLLLsssssssssO
26 OSsLLLHHsssHHsssSO
27 OsLLLsssssssssSO
27 OSsLLssssssssLLsO
28 OsLLssssssssssSO
28 OSsssssssSssssSO
29 OSSssssssssssSO
30 OSSssssssssSO
31 OOSSSSSSSSO
32 OsLLssssSO
29 OOCWsLLssSCOO
27 OCWWWssSCWWWWcCO
25 OCWWWccCWWWWWccCCO
24 OCWWWWccCWWWWccCCWcO
23 OCWWWWccCWWWWcCCWWcO
22 OCWWccOCcCWWWcCCWWcO
22 OCWccOOCccCWWccCCWWcO
22 OCWccO.OCccCWWccCCWcO
22 OCWcCO..OCcccccccCCWcO
22 OCcCCO..OJGGgggGGJCCcsO
23 OsLsO..OCJGGGGGGGJCCLsLsO
23 OSSsO.OCWWccccCCCCccOsLsO
24 OOOCWWcccCCOOCCCccccOSSJO
24 OCWWWcccCCO..OCWWWcccCJGgO
23 OCWWWcccCCO...OCWWcccCCJggGgGGGgGGGJO
22 OCWWWcccCCO...OCWWccccCCOJJJJJJJJJJJJO
21 OCCCCCCCcCCO..OCccccccCCO
20 OBBBBBBBCCCO...OCCCCCBBBBBO
20 OOOOOOOOOOOO...OOOOOOOOOOOO
''')

# Explicit corrections after opening the native and enlarged sheets.
# A patch is a chosen literal span; it never copies pixels from another frame.
def patch(name, edits):
    folder=ROOT/('actions' if name.startswith(('skill','poison','stun','sleep')) else 'poses')
    path=folder/(name+'.pxgrid'); rows=path.read_text().splitlines()
    for y,x,pixels in edits:
        assert 0<x and x+len(pixels)<64 and 0<y<=60
        rows[y]=rows[y][:x]+pixels+rows[y][x+len(pixels):]
    path.write_text('\n'.join(rows)+'\n')

patch('sleep_a',[
 (33,26,'OSsLLHHHssHHHssSO.'),
 (34,27,'OsLLLSSsssSSssSO')
])
patch('sleep_b',[
 (33,26,'OSsLLHHHssHHHssSO.'),
 (34,27,'OsLLLSSsssSSssSO')
])
patch('dead',[
 (48,34,'OSSsLLHHHsssHHHssO'),
 (56,9,'OOCWWWcccCCOOCWWccCWWccCOssLsSO.....'),
 (57,8,'OCWWWccCCO..OCWcccCWWccCOOSSsO.JggGgGGGgGGGJO'),
 (58,7,'OCWWcccCCO..OBbbbbBCCccccCCCOOOO.OJJJJJJJJJJJJO'),
 (59,6,'OBBBBBCCCO...OOOOOOOCCCccCCO.......')
])
patch('hit',[
 (59,22,'OBbbbbBBO.......OBbbbbBBO'),
 (60,22,'OOOOOOOOO.......OOOOOOOOO')
])
patch('poison_a',[
 (32,28,'OsLLssLsLsO'),
 (33,26,'OCWsLLsLsLsO.'),
 (34,24,'OCWWWssCOsLsO..'),
 (35,23,'OCWWWccOCWWcCCccCO...'),
 (36,22,'OCWWccOCWWcCCcCccCO..'),
 (37,21,'OCWWcOCWWcCCcCWWcCCO..'),
 (38,21,'OCWWcCWWcCCcCWWccCCO..'),
 (39,21,'OCWWWWcCCcCWWWccCCCO..'),
 (40,22,'OCWWccCCCccWWcccCCCO..'),
 (41,23,'OCccCCOOOCccccccCCCO..'),
 (59,24,'OBbbbbBBO..OBbbbbBBO'),
 (60,24,'OOOOOOOOO..OOOOOOOOO')
])
patch('poison_b',[
 (31,29,'OsLLssLsLsO'),
 (32,27,'OCWsLLsLsLsO.'),
 (33,25,'OCWWWssCOsLsO..'),
 (34,24,'OCWWWccOCWWcCCccCO...'),
 (35,23,'OCWWccOCWWcCCcCccCO..'),
 (36,22,'OCWWcOCWWcCCcCWWcCCO..'),
 (37,22,'OCWWcCWWcCCcCWWccCCO..'),
 (38,22,'OCWWWWcCCcCWWWccCCCO..'),
 (39,23,'OCWWccCCCccWWcccCCCO..'),
 (40,24,'OCccCCOOOCccccccCCCO..')
])
patch('skill_b',[
 (12,44,'..........tEEEE....'),
 (13,44,'........tEEEET.....'),
 (14,44,'.......tEEEET......'),
 (15,44,'......tEEET........'),
 (16,44,'.....tEEET.........'),
 (17,44,'.....tEET..........'),
 (18,44,'....tEET...........'),
 (19,44,'....tEET...........'),
 (20,44,'...tEET............'),
 (21,44,'..tEET.............'),
 (22,44,'.tEET.......tEEEE..'),
 (23,44,'tEtTTtEEEEEEEEEET..'),
 (24,44,'GtEEEEEEEEEETT.....'),
 (25,47,'tEET............'),
 (26,47,'.tEET...........'),
 (27,47,'...tEET.........'),
 (28,47,'....tEET........'),
 (29,47,'.....tEET.......'),
 (30,47,'......tEET......'),
 (31,47,'.......tEEET....'),
 (32,47,'.......tEEEET...'),
 (33,47,'......tEEEEET...'),
 (34,47,'.....tEEEEET....'),
 (35,47,'....tEEEET......'),
 (36,47,'...tEEET........'),
 (37,47,'..tEET..........')
])
# Motion-strip inspection: carry the same right hand near the shoulder during advance.
# Replace its old low flute with a prepared diagonal shaft, and expose the front thigh.
patch('move',[
 (23,55,'JgO'), (24,54,'JgGO'), (25,53,'JgGO'),
 (26,52,'JgGO'), (27,51,'JgGO'), (28,50,'JgGO'),
 (29,49,'JgGO'), (30,48,'JgGO'),
 (31,40,'CO..OsLsJgGO'),
 (32,24,'OCWWWWWccCWWccCCWcOOsLsJO'),
 (33,22,'OCWWWcccCWWcccCCWWccWcO.'),
 (34,20,'OCWWWccCccCWWccCCWWWWcO..'),
 (35,19,'OCWWccCOCcCWWWccCCCWWcO..'),
 (36,18,'OCWccCCOOCccWWccCCCCcO...'),
 (37,17,'OCWccCCO.OCccWWccCCCO....'),
 (38,16,'OCWccCCO..OJGGggGGJCCCO..'),
 (39,16,'OCccCCO...OJGGGGGGJJCCO....'),
 (40,16,'OssSSO....OCccccccccCCO....'),
 (41,17,'OsLsO....OCWWcccccccCCO......'),
 (42,18,'OSSO....OCWWccCCCcccCCO........'),
 (43,25,'OCWWWccCCOOCCCcccCCO........'),
 (44,24,'OCWWWccCO..OCCCcccCCO.......'),
 (45,23,'OCWWWccCO...OCCCcccCCO......'),
 (46,22,'OCWWWccCO....OCCCcccCCO.....'),
 (47,21,'OCWWccCCO.....OCWcccCCO.....')
])
# Casting loads a wider stance and the right thigh rather than shifting the idle body.
patch('skill_b',[
 (44,24,'OCWWWccCcccCCCO..'),
 (45,23,'OCWWWccCCcccCCCO..'),
 (46,23,'OCWWcccCCCcccCCCO.'),
 (47,23,'OCWcccCCOOCcccCCCO'),
 (48,23,'OCWcccCO..OCcccCCCO'),
 (49,23,'OCWccCCO...OCcccCCCO'),
 (50,23,'OCWccCCO....OCcccCCO'),
 (51,22,'OCWccCCO.....OCccCCO'),
 (52,22,'OCWccCCO.....OCccCCO'),
 (53,22,'OCcccCCO.....OCccCCO'),
 (54,22,'OCccCCCO.....OCccCCO'),
 (55,22,'OCcCCCCO.....OCccCCO'),
 (56,22,'OCCCCCCO.....OCCCCCO'),
 (57,21,'OBBBBBBO.....OBBBBBBO'),
 (58,21,'OBbbbBBO.....OBbbbBBO'),
 (59,20,'OBbbbbBBO....OBbbbbBBO'),
 (60,20,'OOOOOOOOO....OOOOOOOOO')
])
# Readable skin wrist overlaps rather than two touching outline pixels.
patch('move',[
 (32,40,'WcCSsLsJO'),
 (33,39,'WWccSsO'),
 (34,38,'WWccCO'),
 (35,37,'CWWcCO')
])
patch('attack',[
 (35,43,'WcCSsLsO'),
 (36,42,'cccSsLsO'),
 (37,42,'ccCSssOOOO')
])
# The cast shaft keeps the same eleven-pixel mouth-to-tip span as preparation.
# Its effect starts at native (50,23), immediately beyond the jade end at (49,23).
patch('skill_b',[
 (12,44,'.............tEEEE.'),
 (13,44,'............tEEEET.'),
 (14,44,'...........tEEEET..'),
 (15,44,'..........tEEET....'),
 (16,44,'..........tEEET....'),
 (17,44,'..........tEET.....'),
 (18,44,'.........tEET......'),
 (19,44,'.........tEET......'),
 (20,44,'........tEET.......'),
 (21,44,'.......tEET........'),
 (22,44,'......tEET.....tEEE'),
 (23,39,'JggGgGgGGgJtEEEEEEEEEEET'),
 (24,41,'JJJJJJJJJtEEEEEEETT...'),
 (25,45,'sO'),
 (25,47,'...tEET.........'),
 (26,47,'....tEET........'),
 (27,47,'......tEET......'),
 (28,47,'.......tEET.....'),
 (29,47,'........tEET....'),
 (30,47,'.........tEEET..'),
 (31,47,'..........tEEET.'),
 (32,47,'..........tEEEET'),
 (33,47,'.........tEEEEET'),
 (34,47,'........tEEEEET.'),
 (35,47,'.......tEEEET...'),
 (36,47,'......tEEET.....'),
 (37,47,'.....tEET.......')
])
