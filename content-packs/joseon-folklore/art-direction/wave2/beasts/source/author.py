"""Original ASCII cluster authorship, native64 only.

Literal row stamps and explicit anatomy replacement clusters are the source.
Every baked input is preserved as exactly 64 rows of 64 symbols. No imported
animal anatomy, drawing primitives, tracing, interpolation or random texture.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent.parent
PALETTES = {
    'wild-boar': {
        'o': '#25242c', 's': '#373640', 'd': '#4b484c', 'm': '#665c55',
        'l': '#807567', 'w': '#957d5e', 'h': '#ad9570', 'r': '#78615b',
        'p': '#a18273', 'e': '#d39d50', 'k': '#171a24', 'i': '#efe2c4',
        't': '#c6b998', 'u': '#22262d',
    },
    'venom-toad': {
        'o': '#29332d', 's': '#414c36', 'd': '#5d653e', 'm': '#7b7d48',
        'l': '#9b9754', 'h': '#b9aa65', 'r': '#947747', 'w': '#cfb46c',
        't': '#ad955f', 'e': '#d5bd60', 'k': '#1e2824', 'i': '#eee0af',
        'v': '#bdab69', 'c': '#515039', 'p': '#b98668',
    },
    'mortar-rabbit': {
        'o': '#33323b', 's': '#555463', 'd': '#797884', 'm': '#a5a19f',
        'l': '#cdc6b8', 'h': '#e6ddc9', 'r': '#865052', 'p': '#b97870',
        'k': '#242932', 'e': '#dac175', 'w': '#765540', 't': '#a27c4e',
        'v': '#c29b61', 'b': '#503f36',
    },
}


def blank():
    return [list('.' * 64) for _ in range(64)]


def copy(g):
    return [row[:] for row in g]


def stamp(g, x, y, rows):
    """Assign literal rows, including transparent symbols, at integer positions."""
    if isinstance(rows, str):
        rows = rows.strip('\n').splitlines()
    for dy, row in enumerate(rows):
        for dx, symbol in enumerate(row):
            assert 0 <= x + dx < 64 and 0 <= y + dy < 64
            g[y + dy][x + dx] = symbol
    return g


def erase(g, x, y, w, h):
    # This clears a native edit area; it does not draw an opaque shape.
    for yy in range(y, y + h):
        g[yy][x:x + w] = list('.' * w)


def save(slug, pose, g):
    folder = ROOT / 'source' / slug
    folder.mkdir(exist_ok=True)
    assert all(s == '.' or s in PALETTES[slug] for row in g for s in row)
    (folder / (pose + '.pxgrid')).write_text('\n'.join(''.join(row) for row in g) + '\n')
    (ROOT / 'source' / (slug + '.palette.json')).write_text(json.dumps(PALETTES[slug], indent=2) + '\n')


# WILD BOAR: short uneven bristles; low long torso; separate rounded rear
# haunch at left, modest shoulder right, two small ears, tapered muzzle.
boar = blank()
stamp(boar, 8, 26, '''
.........................o....o
........................olo..omoo
.......o......o.......oolmo..olmoo
.....oomoooooomooooooolllmmoolmmdo
....omlllllmmmmmmmmlllllmmmmmmddo
...omllmmmmmmmmmmmllllllmmmmddddo
..omlmmmmmmmmmmmllllllmmmmdddmdddo
.omlmmllllmmmmmmllllmmmmmmddmmmmddoo
omlmmllllllmmmmmmmmmmmmmddmmmmlmmddoo
ommmlllllmmmmmmmmmmmmmdddmmmllekmmdmo
ommmlllmmmmmmmmmmmmmmmddmmmllmmmmmrmmoo
ommmlmmmmmmmmmmmmmmmmddmmmmlmmmmrrrpppro
osmmmmmddddmmmmmmmmdddddmmmmmmrrppppprpo
osmmmdddddddmmmmmmddddddmmmrrrpppprkrrro
.osmmdddddddddmmmmddddddmmrrrrrppppprro
.osmmdddddddddmmmdddddddmmrtttrrrrrroo
.osmmdddddddddmmmdddddddmmtiitrroooo
..osmmdddddddmmmmdddddddmmtiito
..osmmddddddmmmdddddddddmmmto
...osmddddmmmmdddddddddmmmdo
....osddddmmmmddddddddmmmdo
....osddddmmmddddddddmmddo
.....osddmmssssssssssdddo
......osddsooooosddssddo
.......oddo....oddoo.dso
.......oddo....oddo..odo
.......odso....osdo..odo
''')
# Small tail behind the rump, and four separated short legs / split hooves.
stamp(boar, 6, 38, ['oo.', 'o.o', '.oo', '..o'])
stamp(boar, 17, 50, ['odo', 'odo', 'odo', 'oso', 'oso', 'ouo', 'ouo', 'u.u'])
stamp(boar, 37, 49, ['odo', 'odo', 'odo', 'odo', 'oso', 'ouo', 'ouo', 'u.u'])
stamp(boar, 12, 48, ['omddo', 'omddo', 'omdso', 'omdso', '.odso', '.odso', '.odso', '.osso', '.ouuo', '.uuuo', '.u.uo', '.u.u.'])
stamp(boar, 42, 48, ['omdo', 'omdo', 'omdo', 'oddo', 'odso', 'odso', 'osso', 'osso', 'ouuo', 'uuuo', 'u.uo', 'u.u.'])
# Warm accents remain sparse: three connected 2-3 px bristle clusters.
stamp(boar, 17, 30, ['ww', 'lm'])
stamp(boar, 29, 30, ['w', 'l'])
stamp(boar, 35, 29, ['wl', 'lm'])
# Chest descends to the forelegs; muzzle narrows to the right. This replaces
# the first silhouette's overly high underside and its isolated near leg.
erase(boar, 32, 32, 26, 28)
stamp(boar, 32, 32, '''
olllmmmmmmddoo
llllmmmmmddddooo
lllmmmmmmddmmmmdoo
llmmmmmmddmmlekmdoo
lmmmmmmddmmllllmrmdoo
mmmmmmddmmmlllmmrrpmmoo
mmmmmmddmmmllmmrrpppppro
mmmmmmddmmmmmmrrpppprkrrro
mmmmmmddmmmrrrpppppprrroo
mmmmmmddmmrrrrrppppprroo
mmmmmmddmmrrtttrrrrooo
mmmmmmdddmmttiioooo
mmmmmmdddmmmtiio
mmmmmmddddmmmmdo
mmmmmmddddmmmdo
dmmmmddddmmmdo
ddmmddddmmddo
.oddddddddoo
..osdddddso
...osddssso
....oooooo
''')
# Ivory tusk rises upward out of the near cheek, with a 1-pixel curved tip.
stamp(boar, 46, 38, ['..i', '.oi', '.oit', '.oit', 'otit', 'otto', '.oo.'])
stamp(boar, 43, 50, ['odo', 'odo', 'odo', 'oso', 'oso', 'ouo', 'ouo', 'u.u'])
stamp(boar, 38, 49, ['omdo', 'omdo', 'omdo', 'oddo', 'odso', 'odso', 'osso', 'osso', 'ouuo', 'uuuo', 'u.uo', 'u.u.'])
save('wild-boar', 'idle_a', boar)


# TOAD: angular rear thigh left, broad head right, ochre chin, flattened
# fingers. Its large near eye and long horizontal mouth carry expression.
toad = blank()
stamp(toad, 16, 35, '''
.........................oooo
........................oleeeo
.......................oleikeko
.....................oooleekkko
...........ooooooooolllmoeeekeo
.......ooollllllllmllllmmdoeeeo
.....oolllmmmmmmmmmmmmmmmmddoooo
....ollmmmmmmccmmmmmmccmmmddddddo
...olmmlmmmmmccmmmmmmccmmmddddddo
..olmmlllmmmmmmmmmmmmmmmmdddddddo
.olmmlllllmmmmmmmmmmmmmmmmdddddddo
olmmlllmmmddmmmmmmmmmmmmmmdddmmmdo
olmlllmmmddddmmmmmmmmmmmmmmmmmllmo
olmllmmmmddddddmmmmmmooooooooooomo
olmmmmmmdddddddmmmmdottttttttttto
osmmmmdddddddddddddottvvvvttttto
osmmmddddddddddddddottvvvvtttto
.osmmddddssssdddddddotttttttoo
..osmddsssssssssdddddotttoo
...osddssssssssssdddddooo
''')
# Broad folded hind limb, small far arm and larger near forearm.
stamp(toad, 16, 48, '''
.omlllllmo
omllllmmdo
omlllmmddo
omllmmddso
omlmmddso
.omdddso
..odddso
...odddoo
..oodddmmmoo
.odmmmllmmmmo
odmmmmmmmmddo
oo.oooo.ooooo
''')
stamp(toad, 35, 53, ['.odo', '.odo', '.oso', '.oso', 'oddo', 'osddooo', 'oo.oo.o'])
stamp(toad, 43, 50, ['omlo', 'omlo', 'omdo', 'oddo', 'oddo', 'oddo', 'osdo', 'osdooo', 'odllllo', 'oodddooo', 'oo.oo.oo'])
save('venom-toad', 'idle_a', toad)


# RABBIT: two independently tapered ears, sly side face, red neck cloth,
# hunched biped torso, two gray hands wrapped around a short wooden pestle.
rabbit = blank()
stamp(rabbit, 26, 16, '''
.oo
olmo
olpo
olpo
olpmo
olpmo
olpmo
olpmo
olpmo
olpmo
.olmo
.odmo
..odo
''')
stamp(rabbit, 35, 19, '''
....oo
...olmo
..olpmo
..olpmo
.olpmo
.olpmo
.olpmo
olppmo
olmmo
oddo
''')
stamp(rabbit, 25, 28, '''
....ooooooo
..oollllllloo
.olhhhhllllmmo
olhhhhllllmmddo
olhhhllllmmdddo
olhhllllmekmmdo
olhllllmkkkmllloo
ollllllmmddmhhhlmo
.olllllmmddlhhhllko
..ommmmmmmlhhhlmo
...ommdddllhhloo
....oorrrrooo
...orrpprrro
..orprrrrrrpo
..orrrroorrrro
...osddollorrrro
''')
stamp(rabbit, 23, 43, '''
....omlllmdo
...omlllllmdo
..omllllllmddo
.omlllllllmmdo
omllllllmmmddo
omlllllmmmmddo
omllmmmmmmdddo
omlmmmmmmdddso
.ommmmmdddsso
..ommmdddsso
..oddddddoo
..odddooo
''')
stamp(rabbit, 21, 48, ['.oolo', 'olhhlo', 'olllmo', '.oddo'])
stamp(rabbit, 25, 54, ['odddo..odddo', 'omddo..omddo', 'omddo..odddo', 'omddoo..oddo', 'omlllmmo.odlooo', 'olllllmo.ollmmmo', 'ooooooo..oooooo'])
# Pestle is a wood log with a grain seam and end face, not a hammer head.
stamp(rabbit, 43, 37, ['.oooo', 'ovtto', 'otwto', 'otwto', 'otwto', 'otwto', 'otwto', 'otwto', 'otwto', 'otwto', 'otwto', 'owbbo', '.ooo'])
stamp(rabbit, 33, 42, ['.ommo....', 'omllmo...', 'omllmmoolo', '.ommmmlhlmo', '..oddmlllmo', '....oooooo'])
stamp(rabbit, 36, 47, ['...ommoo', '..omllhlo', '.ommlhhlo', 'omddmmoo', '.ooooo'])
save('mortar-rabbit', 'idle_a', rabbit)

# The idle checkpoint intentionally precedes every additional pose.
if __name__ == '__main__':
    print('Three original idle_a grids saved. Bake --idle before authoring actions.')
