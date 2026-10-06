"""Explicit hand-selected ASCII clusters. No geometric drawing or pose transforms.
The only operation is placing each independently written row at its stated native coordinate.
The exported pxgrids contain the complete 96x96 literal canvas.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
PALETTE={'o':'#211B23','r':'#4B242D','s':'#84383B','t':'#B85246','w':'#883329','m':'#CE5137','n':'#EF8551','p':'#FFD279','e':'#30161C','f':'#F1C69B','a':'#36333E','b':'#62606A','c':'#94909A','v':'#4B4143','u':'#7F6B60','h':'#B39A7D','j':'#B9CE72','k':'#71804B'}
FRAMES={}
def frame(name, *clusters):
    canvas=[list('.'*96) for _ in range(96)]
    for x,y,rows in clusters:
        for dy,row in enumerate(rows.strip('\n').splitlines()):
            for dx,ch in enumerate(row):
                if ch!='.':
                    assert ch in PALETTE, (name,ch)
                    assert 1<=x+dx<=94 and 1<=y+dy<=92, (name,x+dx,y+dy)
                    canvas[y+dy][x+dx]=ch
    FRAMES[name]=[''.join(row) for row in canvas]

frame('idle_a',
(51,6,'''
........oo
.......offo
......offfo
.....ofppfo
....ofppfo
...ofppnfo
..ofppnnfo
..ofpnnnwo
.ofpnnnmwo
.ofnnnmmwo
ofnnnmmmwo
oonnmmmwwo
..owwmmwwo
..owmmmwwo
..owwwwwo
'''),
(43,20,'''
........ooooooo
.....ooonnnnnnnooo
...oonnnnnnnnnnnmmmoo
..onnnnppnnnnnnmmmmmmwo
.onnnnpppnnnnmmmmmmmmwwo
onnnnnnnnnnnmmmmmmmmwwwwo
onnnnnnnnnnmmmmmmmmwwwwwo
onhhnnnnnnmmmmmmmmmmwwwwwo
onnhhnnnmmmmmmmmmmmmwwwwwo
onnnnnmmmwwwwmmmmmmmmwwwwo
onnnnnmmweeeewmmwwwmmmwwwo
onnnnmmweeeepemweeeeewwwwo
onnnnmmweeeeeemwepeeeewwwo
onnnmmmwwweeeemmweeeewwwwo
onnnmmmmwwweeeemweeeewwwwo
onnnmmmmmwwweeeewweeemwwwo
onnmmmmmmmwweeeeeeeemmmwwo
onnmmmmmmmmweeeeeeewmmmmwo
onnmmmnmmmmmweeeeeewmmmmwo
onnmmmnnmmmmweffeffeewmmwo
.onnmmmmmmmmweeeeeeeewmmwo
.onnnmmmmmmmweeeeeeeewmmwo
..onnnmmmmmmmweffffewmmwo
..onnnnmmmmmmmweeeewmmwo
...onnnnmmmmmmmwwwmmmwo
....onnnnmmmmmmmmmmwwo
.....oonnnmmmmmmwwwwo
.......oowwwwwwwwoo
.........ooooooo
'''),
(23,29,'''
..........oooo
........oobbbboo
.......obccbbbaao
.....oobccccbbaaao
....obccccccbbbaao
...obcchccbbbbaaaao
..obcccbbbbbbaaaooo
..obcccbbbbbaaaobmmo
.obccbbbbbaaaabomnnmo
obccbbbccbbbaaomnpmwo
obcbbbccccbbaaowmmmwo
obbbbccccbbbaaaowwwo
obbbcccbbbbbbaaaao
obbcccbbbbbbaaaaao
obcccbbbbbbaaaaaao
.obbbbbbbbaaaaaao
.obbbbbbbaaaaaao
..obbbbbaaaaaao
...obbaaaaaao
....oaaaaao
.....ooooo
'''),
(20,44,'''
..........................orrssssttssro
......................ooovhhhuuurrsssssro
....................ovhhhhhhuuuuvrssssssro
..................oovhhhhhuuuuuuvrssssttssro
................ovhhhhhhhuuuuuuuuvrssstttssro
..............oovhhhhhhhuuuuuuuuuuvrssstttssro
............orrovhhhhhuuuuuuuuuuuvrssstttssro
..........orrssovhhhhuuuuuuuuuuuuvorssstttssro
........orrttssovhhhuuuuuuuuuuuuuvvoorsstttsssro
.......orttttssovhhhuuuuuuuuuuuuvvvooorsstttsssro
......ortttttssovhhhuuuuuuuuuuuuvvvvoorstttttsssro
.....orttttsssrohhhuuuuuuuuuuuuuvvvvoorsstttttssro
....orttttsssrovhhuuuuuuuuuuuuuuvvvvoorstttttsssro
...ortttssssroovhhuuuuuuuuuuuuuuvvvvoorssttttsssro
..ortttsssroo.ovhhuuuuuuuuuuuuvvvvvoorrstttsssro
..orttsssro...ovhhuuuuuuuuuuuuvvvvvo.orrsssssro
.orttsssro....ovhhuuuuuuuuuuuuvvvvvo..orrsssro
.ortttssro....ovhhuuuuuuuvuuuvvvvvvo...oooooo
orttttssro....ovhhuuuuuuuvvuuuvvvvvo
orttssssro....ovhhuuuuuvvvvvvvvvvvvo
orttssssro....ovhuuuuuvvvvvvvvvvvvvo
orrsssssro....ovuuuuuvvvvvvvvvvvvvo
.orrsssro.....ovuuuuvvvvvvvvvvvvvvo
..ooooo.......ovuuuvvvvvvvvvvvvvoo
...............ovvvvvvvvvvvvvvo
...............orrssssrrssssrro
..............orrttssrrrsssssrrro
.............orrtttssrr..orssssssro
............orrttttsrro...orssssssro
............orttttssro....orssssssro
...........orttttssro.....orssssssro
...........ortttssrro.....orsssssssro
..........ortttssrro......orsttssssro
..........ortttssro.......orstttsssro
..........ortttssro.......orstttsssro
..........orrsssro........orstttsssro
..........orrssro.........orstttsssro
.........orrsssro.........orstttsssro
........orrttssro.........orstttsssro
.......ortttttssro........orrsttsssro
......ortttttttssro.......orrsssssro
.....orttttttttsssro.....orrttssssro
....ortttttttttsssro....ortttttttssro
...orttttffttttssssro..ortttttttttssro
...ortttfffftttssssro..ortttttttttssro
...orrttfftttttssssro..ortttffttttssro
....orrtttttttssssro...orttffffttsssro
.....orrrrrrrrrrrro...orrttfftttsssro
......ooooooooooo....oooooooooooooo
'''))

if __name__=='__main__':
    from additional import draw
    draw(frame)
    (ROOT/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n')
    for name,rows in FRAMES.items():
        folder='poses' if name in ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'] else 'actions'
        (ROOT/folder/(name+'.pxgrid')).write_text('\n'.join(rows)+'\n')
