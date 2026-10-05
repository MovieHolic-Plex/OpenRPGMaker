"""Explicit native cluster replacements for anatomically distinct actions.

Run after author.py. Changes replace heads, joints, paws, hands and tools,
never translate, resize or rotate an entire sprite. The output full pxgrids
are the authoritative baker input and may also be edited directly.
"""
from author import boar, toad, rabbit, blank, copy, stamp, erase, save


# ---- BOAR / breathing and attentive sniff ----
g = copy(boar)
stamp(g, 21, 33, ['mmmmllllmm', 'mmllllllmm', 'mmllllmmmm', 'mmmmmmmmmm'])
stamp(g, 39, 27, ['..oo.', '.omlo', 'omlmo', 'omddo'])
stamp(g, 49, 38, ['rmpppro', 'rpppprro', 'rppkrrro'])
save('wild-boar', 'idle_b', g)

g = copy(boar)
stamp(g, 43, 35, ['mmmdo', 'lekmdo', 'lllmmdo', 'llmmrrmdo'])
stamp(g, 50, 39, ['pppprro', 'ppkrrro', 'pprrro.', 'rrroo..'])
stamp(g, 13, 53, ['odso', 'odso', 'osso', 'ouuo', 'uuuo', 'u.uo', 'u.u.'])
stamp(g, 38, 28, ['.oo.', 'olmo', 'omdo', 'oddo'])
save('wild-boar', 'idle_c', g)

# Windup: snout drops, foreknees bend and rear hocks brace. Body mass stays
# within the original native64 extent; the ground contact remains y60.
g = copy(boar)
erase(g, 32, 32, 28, 29)
stamp(g, 32, 32, '''
olllmmmmddooo
llllmmmmmdddoo
llllmmmmmddddo
lllmmmmmmdddddo
llmmmmmmddmmmmdo
lmmmmmmddmmmmmmdoo
mmmmmmddmmmllekmdoo
mmmmmmddmmmllllmmrdoo
mmmmmmdddmmllmmmrrrmmoo
mmmmmmdddmmmmmmrrrppppro
mmmmmmdddmmmmrrrppppprrro
mmmmmmdddmmmrrppppprkrrro
mmmmmmdddmmmrrppppppprro
mmmmmmddddmmrrrppppprroo
mmmmmmddddmmrrtttrrooo
mmmmmmddddmmttiiooo
dmmmmddddmmmtiito
ddmmddddmmmmmmdo
dddddddmmmmmmdo
osddddmmmmmmdo
osddssssssddo
ossssoooosso
ooooo....ooo
''')
stamp(g, 48, 43, ['..i', '.oit', '.oit', 'otit', 'otto'])
stamp(g, 38, 50, ['omddo', 'omddo', '.oddo', '..oddo', '..osdo', '..osdo', '.ouuuo', '.uuuuo', '.u.u.o', '.u.u..', '......'])
stamp(g, 46, 52, ['odo', 'odo', '.odo', '.odo', '.oso', 'ouuo', 'u.uo', 'u.u.', '....'])
erase(g, 12, 49, 12, 12)
stamp(g, 12, 49, ['omddo....odo', 'omddo....odo', 'omdso...odo.', 'omdso..odo..', 'omdso..oso..', 'osddo..oso..', '.odso..ouo..', '.odso..u.u..', '.ouuo.......', '.uuuo.......', '.u.uo.......', '.u.u........'])
save('wild-boar', 'windup', g)

# Move: lowered head and a true running leg arrangement. Rear legs push
# backwards; near foreleg stretches forward; far foreleg folds at the knee.
g = copy(boar)
erase(g, 8, 48, 45, 13)
stamp(g, 10, 47, '''
..osddddmmmddddddddddddddmmmmmmdo
..osddddmmsssssssssdddddddmmmmdo
..omdddooooooooooooosddddmmmdo
..omddo............osdddmddo
.omddo..............osddmddo
omddo................osddmddo
oddo..................osddmddo
oso....................odddmdo
ouuo....................oddmddo
uuuo.....................oddmddo
u.uo.....................osdmddo
u.u......................ouummdo
.........................uu.uuo
''')
stamp(g, 18, 49, ['odo', 'odo', 'odo', 'odo', 'osdo', '.osdo', '..osdoo', '...oddo', '...ouuo', '...u.uo'])
stamp(g, 43, 48, ['odo', 'odo', 'oddo', '.oddo', '..oddo', '..ouuo', '..uuuo', '..u.uo'])
erase(g, 43, 33, 16, 13)
stamp(g, 43, 35, ['oooo', 'lmmdoo', 'lekmddo', 'llllmmrdoo', 'lllmmrrpmmoo', 'lmmmrrpppppro', 'mmmmrrpppprkro', 'mmrrrppppprrro', 'rrrppppprrroo', 'tttrrrrrooo', 'ttiioooo', 'tiito'])
stamp(g, 49, 40, ['.i', 'oit', 'oit', 'tit', 'tto'])
save('wild-boar', 'move', g)

# Attack: muzzle driven farther right, mouth open below nostril, near tusk
# forward and up, four legs firmly spread rather than copying move.
g = copy(boar)
erase(g, 36, 33, 25, 28)
stamp(g, 36, 33, '''
lmmmmmmddooo
mmmmmmddmmddoo
mmmmmddmmmmmmdoo
mmmmddmmmllekmddoo
mmmmddmmlllllmmrdoo
mmmdddmmllllmmrrpmmoo
mmmdddmmmmmrrpppppppro
mmmddmmmrrrppppppprkro
mmmddmmrrrppppppppprro
mmmddmmrrtttkkkkkkkro
mmmddmmrrtiioiiikkkro
mmmddmmmttiirrprrroo
mmmddmmmmtiirrrrroo
mmmddmmmmmmrrrrooo
mmmddmmmmmmmmdoo
mmddmmmmmmmdoo
mdddmmmmmmdoo
ddddmmmmdsso
ddddmmmddso
ssdddddsso
osddddsso
.ossssoo
..ooooo
''')
stamp(g, 50, 39, ['..i', '.oit', '.oit', 'otit', 'tti.', 'tto.'])
stamp(g, 37, 51, ['odo', 'odo', 'oso', 'oso', 'ouo', 'u.u'])
stamp(g, 43, 49, ['omddo', 'omddo', 'omddo', '.omddo', '.odddo', '.odddo', '..osddo', '..osddo', '..ouuuo', '..uuuuo', '..u.u.o', '..u.u..'])
erase(g, 12, 51, 6, 10)
stamp(g, 11, 51, ['.omddo', '.omddo', 'omddo.', 'odddo.', 'odddo.', 'osddo.', 'ouuuo.', 'uuuuo.', 'u.u.o.', 'u.u...'])
save('wild-boar', 'attack', g)

# Recovery: head lifts with jaw closed; near foreleg remains bent, then
# starts returning under the shoulder. Ear angles and rear stance differ.
g = copy(boar)
erase(g, 41, 32, 18, 16)
stamp(g, 41, 32, ['.ooo', 'ommmdoo', 'mmmmmddoo', 'mllekmddoo', 'mllllmmrdoo', 'mlllmmrrpmmoo', 'mmmmrrpppppro', 'mmrrrpppprkro', 'mmrrrppppprro', 'rrtttrrrrroo', 'rttiirroooo', 'mtiito', 'mmtoo', 'mmdo', 'mdo', 'do'])
stamp(g, 45, 37, ['..i', '.oi', '.oit', 'otit', 'otto'])
erase(g, 38, 51, 5, 10)
stamp(g, 39, 51, ['omdo', 'omdo', 'oddo', 'oddo', 'osdo', 'osdo', 'ouuo', 'uuuo', 'u.uo', 'u.u.'])
stamp(g, 18, 53, ['odo', 'odo', 'oso', 'ouo', 'u.u'])
save('wild-boar', 'recover', g)

# Hit: ears fold and shoulder compresses. Chin opens in recoil; near hock
# buckles, without recoloring an unchanged silhouette.
g = copy(boar)
erase(g, 31, 26, 29, 26)
stamp(g, 31, 30, '''
.oooooooooo
ollllmmmmmmooo
llllmmmmmmmdmmoo
lllmmmmmmmmmddmdoo
llmmmmmmmmmmdddmmdoo
lmmmmmmmmmmmddmmmdoo
mmmmmmmmmmmddmmeekmo
mmmmmmmmmmmddmmkkmdoo
mmmmmmmmmmddmmmmmrrmdoo
mmmmmmmmmmddmmmmrrppppro
mmmmmmmmmmddmmrrpppprkro
mmmmmmmmmmddmmrrppppprro
mmmmmmmmmmddmrrttkkkro
mmmmmmmmmmddmrrtiikkro
mmmmmmmmmmddmmrtiirro
mmmmmmmmmmddmmmrtoo
mmmmmmmmmmdddmmmmdo
ddddmmmmmmddddmmdo
ddddmmmmmmdddsddo
ssssdddddssssddo
oooosssssssssso
....oooooooooo
''')
stamp(g, 47, 40, ['..i', '.oi', '.oit', 'otit', 'otto'])
erase(g, 38, 51, 8, 10)
stamp(g, 37, 51, ['omddo..odo', 'omddo..odo', '.oddo..odo', '..oddo.odo', '..osdo.oso', '..osdo.ouo', '..ouuo.u.u', '..uuuo....', '..u.uo....', '..u.u.....'])
save('wild-boar', 'hit', g)

# Dead: original lateral collapsed outline, tucked dark hooves, shut eye.
g = blank()
stamp(g, 10, 43, '''
.........oo......oo
........oddo....oddo
......ooomddooooomddoooo
....oomllllmmmmmmmmmmmmmmoo
..oomllllllmmmmmmmmmmmmmmmdoo
.omlllllmmmmmmmmmmmmmmmmdddmoo
omlllllmmmmmmmmmmmmmmmddddmmmoo
omlllmmmmmmmmmmmmmmmmddddmmmmddoo
omlmmmmmmmmmmmmmmmmddddmmmmmmmmddoo
ommmmmddddmmmmmmmmddddmmmmmmkkmmrddoo
ommmdddddddmmmmmmddddmmmmmmllmmrrpppro
osmmddddddddddmmmddddmmmrrrtttrppppprro
osmmmdddddddddddddddddmmrrrtiirppprkrro
.osmmmmdddddddddddddddmmmmmtiirrrpprro
..osssssddddddddddddddmmmmmrrrrrrrroo
...ooooosssssssssssssssssoooooooo
........ooooooooooooooooo
''')
stamp(g, 6, 50, ['.oo.', 'ooso', '.oso', '..oo'])
stamp(g, 17, 57, ['ouuo', 'u.uo', 'u.u.'])
stamp(g, 32, 57, ['ouuo', 'u.uo', 'u.u.'])
stamp(g, 46, 52, ['.i', 'oit', 'tit', 'tto'])
save('wild-boar', 'dead', g)


# ---- TOAD / breathe, blink, gather spit ----
g = copy(toad)
stamp(g, 39, 50, ['ttvvvvttto', 'ttvvvvvtto', 'ottvvvvto', '.ottttto', '..ooooo'])
stamp(g, 30, 42, ['mmllmm', 'mllllm', 'mmmmmm'])
save('venom-toad', 'idle_b', g)

g = copy(toad)
stamp(g, 41, 36, ['.ollllo', 'olmmddo', 'ommkkko', 'oddmmdo', '.odddo'])
stamp(g, 34, 49, ['ottttttttttttto', '.ottvvvvttttto'])
stamp(g, 45, 59, ['odddooo', 'oo.o.oo'])
save('venom-toad', 'idle_c', g)

g = copy(toad)
erase(g, 35, 44, 20, 17)
stamp(g, 35, 44, '''
mmmmmmmmmmmmmdddoo
mmmmmmmmmmmlllmddo
mmmmmmmmlllllllmmdo
mmmmmmmllllhhhhllmo
mmmmmmllhhhvvvhlmmo
oooooolhhvvvvvvlmmo
tttttthvvvvvvvvhltto
tttvvhvvvvvvvvvvhtto
otvvvhvvvvvvvvvvhtto
.otvvlhvvvvvvvvhltto
..otvvlhhvvvvhhltto
...ottvvllllllttoo
....otttttttttoo
.....ooooooooo
''')
# Braced front arms are authored around the swollen throat.
stamp(g, 46, 53, ['.omlo', '.omdo', '.oddo', '.oddo', 'odddo', 'odllllo', 'odddoooo', 'oo.oo.oo'])
stamp(g, 34, 54, ['odo', 'odo', 'oddo', 'osdo', 'osddooo', 'oo.oo.o'])
save('venom-toad', 'windup', g)

# Hop: new raised torso and head with tightly folded thighs below, two
# spread forearms extended forwards. No detached spit/projection pixels.
g = blank()
stamp(g, 19, 30, '''
.......................oooo
......................oleeeo
.....................oleikeko
...................ooleekkko
.........ooooooooollmmoeeekeo
......oollllllllmllllmdoeeeo
....oollmmmmmmmmmmmmmmmddoooo
...ollmmmmccmmmmmmccmmmddddddo
..olmmlmmmccmmmmmmccmmmmdddddo
.olmmllllmmmmmmmmmmmmmmmmddddo
olmmlllllmmmmmmmmmmmmmmmmdddmo
olmlllmmmddddmmmmmmmmmmmmlmmmo
ollllmmmmddddmmmmmmoooooooooo
olmllllmdddddmmmmdottttttttto
.omlllllmdddddmmddottvvvttto
..omllllmmdddddddddottvvtoo
...omlllmmmdddddddddotttoo
....ommmmmddssssssssddooo
.....osdddsssssssssssso
......ossssssssssssooo
.......oooooooooooo
''')
stamp(g, 20, 45, ['omllllmo', 'omllllmdo', '.ommmmddo', '..oddddo', '..odddo', '.odddo', 'odddo', 'osddooooo', '.oodmmmdo', '...oo.oo'])
stamp(g, 38, 43, ['odo', 'oddo', '.oddo', '..oddo', '...oddmoo', '....ooooo'])
stamp(g, 46, 42, ['omdo', 'omddo', '.omddo', '..omddo', '...odddoo', '....odlllo', '....oo.ooo'])
save('venom-toad', 'move', g)

# Attack at home: gape with ochre upper lip and open throat, downward lower
# jaw, forearms brace. Spit is deliberately left to the runtime effect.
g = copy(toad)
erase(g, 34, 43, 23, 16)
stamp(g, 34, 43, '''
mmmmmmmmmmdddmmmmdoo
mmmmmmmmmmddmmmmllmo
mmmmmmmmmmmmmlllllmo
mmmmmmmmmllllllllmo
mmmmmmmllloooooooo
mmmmmmlloikkkkkkko
mmmmmmloikkkkkkko
mmmmmloikkkkkkko
mmmmloikkkkkkko
mmmmloikrrrrrko
ddmmllorrpprrko
ddmmmllorppprrko
dddmmmllorrrrtoo
ddddmmllltttttoo
ssssddmmlllltoo
sssssssoooooo
''')
stamp(g, 46, 54, ['omdo', 'oddo', 'oddo', 'oddooo', 'odllllo', 'oodddooo', 'oo.oo.oo'])
stamp(g, 35, 53, ['odo', 'odo', 'oso', 'oso', 'oddo', 'osddooo', 'oo.oo.o'])
save('venom-toad', 'attack', g)

# Recovery: mouth half shuts, gular sac recoils, near elbow still flexed.
g = copy(toad)
stamp(g, 34, 48, ['mmmmmooooooooomo', 'mmmmoikkkkkttto', 'mmmmlorrttttto', 'dddmmllttttto', 'ddddmllvvvto', 'dddddmllvto', 'ddddddoooo'])
erase(g, 43, 53, 10, 8)
stamp(g, 43, 53, ['omdo', 'omddo', '.oddo', '..oddo', '..osdo', '.odlllo', 'oodddoooo', 'oo.oo..oo'])
stamp(g, 25, 57, ['mmmlllmmo', 'mmmdddmdo', 'oooo.oooo'])
save('venom-toad', 'recover', g)

# Hit: compact flat body, lowered eyelid, thigh squashed out to the left and
# elbows splayed. This silhouette is independently authored from native rows.
g = blank()
stamp(g, 15, 40, '''
...........................oooo
.........................oolllmo
......................ooommkkkmo
...........ooooooooolllllmmddddoo
.......ooolllmmmmmmmmmmmmmmmmdddoo
.....oollmmmmccmmmmmmmccmmmmmmdddo
....olmmmmmmmccmmmmmmmccmmmmmmdddo
...olmmllllmmmmmmmmmmmmmmmmmmmdddo
..olmmlllllllmmmmmmmmmmmmmmmmmmddo
.olmmllllllllmmmmmmmmmmmoooooooomo
olmmllllllmmmmdddmmmmmmoiktttttto
olmmllllmmmmddddddmmmmmlorrttttto
olmmmmmdddddddddddddddmmllttttoo
osmmmddddddddddddddddddmlltttoo
.osddddsssssssssssssssssssooo
..osssssssssssssssssssssso
...oooooooooooooooooooooo
''')
stamp(g, 15, 51, ['omlllllmo', 'omlllllmdo', 'omllllmddo', '.ommmddso', '..odddso', '.oodddoo', 'odmmmllmmo', 'odmmmmdddo', 'oo.ooo.ooo'])
stamp(g, 45, 54, ['omdo', 'omdo', '.oddo', '..oddoo', '...odlllo', '..oodddooo', '..oo.oo.oo'])
stamp(g, 35, 54, ['odo', 'odo', 'osdo', 'osddooo', 'oo.oo.o'])
save('venom-toad', 'hit', g)

# Dead: sideways pancake silhouette, closed eye, limp toes. Head is still
# on the right, not rotated into a front-facing oval.
g = blank()
stamp(g, 15, 48, '''
.......................oooooo
......................olmmmddoo
............oooooooooolmmkkkmdoo
........ooolllllmmmmmmmmmmmmddddoo
.....ooollllllmmmmmccmmmmmmmmmdddmo
...oolllmmmmmmmmmmmccmmmmmmmmmmmddo
..olllllmmmmmmmmmmmmmmmmmmmmmmllmmo
.ollllmmmmmmddddmmmmmmmmooooooooomo
ollllmmmmdddddddddddddddotttttttto
ommmmdddddddddddddddddddotttttttto
osddddsssssssssssssssssssoooooooo
.ossssssssssssssssssssso
..ooooooooooooooooooooo
''')
stamp(g, 11, 56, ['.omllmmo', 'omllllmdo', 'odmmmmddo', 'oo.oooo.o'])
stamp(g, 44, 57, ['omddooo', '.odmmmmmoo', '..oodddoooo', '..oo.oo..oo'])
save('venom-toad', 'dead', g)


# ---- RABBIT / ear flick and two-handed pestle actions ----
g = copy(rabbit)
erase(g, 35, 19, 8, 10)
stamp(g, 35, 18, ['...oo', '..olmo', '..olpo', '.olpmo', '.olpmo', '.olpmo', 'olppmo', 'olpmo', 'olmmo', 'oddo', 'odo'])
stamp(g, 28, 46, ['lllllm', 'llllmm', 'lllmmm', 'mmmmmm'])
stamp(g, 40, 43, ['lhlo', 'llmo'])
save('mortar-rabbit', 'idle_b', g)

g = copy(rabbit)
stamp(g, 32, 32, ['llllmmddo', 'lllmmkkmo', 'llmmddmdo', 'lllmmmllloo'])
stamp(g, 29, 41, ['rprrrrpo', 'rrrrrrrro', '.oorrrrro'])
stamp(g, 27, 58, ['mlllmmo', 'lllllmo', 'ooooooo'])
save('mortar-rabbit', 'idle_c', g)

# Windup: log lifted behind/right of the head, both hands gripping different
# ends, elbows turned up. Cloth knot and near hind foot brace the swing.
g = copy(rabbit)
erase(g, 33, 37, 20, 17)
stamp(g, 34, 37, ['lhhhlmo', 'hhhlmo', 'hhloo', 'ooo', 'rrro', 'rrrpo', 'orrrro', 'lorrrro'])
stamp(g, 43, 27, ['.oooo', 'ovtto', 'otwto', 'otwto', 'otwto', 'otwto', 'otwto', 'otwto', 'otwto', 'otwto', 'otwto', 'owbbo', '.ooo'])
stamp(g, 36, 32, ['.......omlo', '......omhhlo', '.....omllmmo', '....omlldoo', '...omllmdo', '..omllmdo', '.omllmdo', 'omllmdo', 'ommmdo', '.oooo'])
stamp(g, 33, 37, ['..........omlo', '.........omhhlo', '........omllmmo', '.......omllmdo', '......omllmdo', '.....omllmdo', '....omllmdo', '...omllmdo', '..ommmddo', '..osddo', '..ooo'])
stamp(g, 25, 55, ['omddo..odddo', 'omddo..omddo', 'omddo..omddo', 'omllmmoomddo', 'ollllmoomlllmmo', 'oooooo.ooooooo'])
save('mortar-rabbit', 'windup', g)

# Move: stride/hop with newly tucked far leg, extended near foot, bent ears
# and diagonal log braced across the chest. The torso is redrawn leaning.
g = copy(rabbit)
erase(g, 43, 37, 7, 14)
erase(g, 26, 16, 8, 13)
stamp(g, 24, 17, ['.oo', 'olmo', 'olpmo', '.olpmo', '..olpmo', '..olpmo', '...olpmo', '...olpmo', '....olmo', '....odmo', '.....odo', '.....odo'])
erase(g, 23, 42, 28, 19)
stamp(g, 24, 42, '''
.....orrrro
....orprrrro
...orrrrrrro
...omlllmmrrro
..omlllllmorrro
.omllllllmmdo
omllllllmmmddo
omllllmmmmmmdo
omllmmmmmmdddo
omlmmmmmmdddso
.ommmmmdddsoo
..ommmdddsoo
...omdddsso
....oddddo
''')
stamp(g, 23, 51, ['.odddo', 'ommmddo', 'ommmddo', 'omdddso', '.odddso', '..odddooo', '...olllmmo', '...ooooooo'])
stamp(g, 33, 53, ['omddo', 'omddo', '.omddo', '..omddo', '...omddoo', '....omllllmo', '....olllllmo', '....oooooooo'])
stamp(g, 39, 42, ['.oooo', 'ovtto', 'otwtoo', '.otwtoo', '..otwtoo', '...otwtoo', '....otwtoo', '.....owbbo', '......ooo'])
stamp(g, 32, 45, ['ommmmoo', 'omllmlhlo', '.omlllhmo', '..odmmmoo', '...ooooo'])
stamp(g, 36, 49, ['..ommoo', '.omllhlo', 'ommlhhlo', 'osddmmoo', '.ooooo'])
save('mortar-rabbit', 'move', g)

# Attack: ears sweep back, body crouches forward, log driven down/right.
# Both hands travel with the pestle; its log form and end grain remain clear.
g = blank()
stamp(g, 20, 21, ['.oo', 'olmo', 'olpmo', '.olpmo', '..olpmo', '...olpmo', '....olpmo', '.....olpmo', '......olmo', '.......odmo', '........odo'])
stamp(g, 29, 23, ['.oo', 'olmo', 'olpmo', '.olpmo', '..olpmo', '...olpmo', '....olpmo', '.....olmo', '......odo'])
stamp(g, 27, 32, '''
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
stamp(g, 24, 47, ['..omllllmdo', '.omllllllmdo', 'omllllllmmddo', 'omllllmmmmddo', 'ommmmmmmmddso', '.ommmddddsso', '..odddddsso', '...odddddo', '...oddddo', '...omdddo', '...omdddoo', '..omllllmmoo', '..ollllllmmo', '..oooooooooo'])
stamp(g, 34, 54, ['odo', 'omdo', 'omddo', '.omddoo', '..omlllmmo', '..olllllmo', '..oooooooo'])
stamp(g, 44, 47, ['.oooo', 'ovtto', 'otwtoo', '.otwtoo', '..otwtoo', '...otwtoo', '....otwtoo', '.....otwtoo', '......owbbo', '.......ooo'])
stamp(g, 35, 45, ['ommmmoo', 'omllmmmo', '.omllmlhlo', '..omlllhmo', '...odmmmoo', '....ooooo'])
stamp(g, 37, 49, ['omddmoo', 'ommmllmo', '.omllmlhlo', '..omlllhmo', '...odmmmoo', '....ooooo'])
save('mortar-rabbit', 'attack', g)

# Recovery: lowered pestle almost horizontal, two separate grip clusters,
# straightening torso and a planted wide foot arrangement.
g = copy(rabbit)
erase(g, 33, 42, 21, 12)
erase(g, 43, 37, 7, 13)
stamp(g, 34, 37, ['lhhhlmo', 'hhhlmo', 'hhloo', 'ooo', 'rrro', 'rrrpo', 'orrrro', 'lorrrro'])
stamp(g, 37, 51, ['.oooooooooooooo', 'ovttttttttttttbo', 'otwwwwwwwwwwtwbo', 'owbbbbbbbbbbbbbo', '.oooooooooooooo'])
stamp(g, 32, 44, ['ommmmo', 'omllmmo', 'omllmmdo', '.omllmdo', '..omllmdo', '...omllmdo', '....omllhlo', '.....omlhmo', '......oooo'])
stamp(g, 34, 48, ['.omddo', 'ommmddoo', '.ommmllmo', '..omlllhlo', '...odmmmoo', '....ooooo'])
stamp(g, 33, 57, ['odddoo', 'odmlllmmo', 'ollllllmo', 'ooooooooo'])
save('mortar-rabbit', 'recover', g)

# Hit: flattened ear tips, recoiling face with shut eye, buckled knees;
# loosened hands still grip the log rather than showing floating weapons.
g = copy(rabbit)
erase(g, 24, 16, 20, 25)
stamp(g, 20, 23, ['.oooo', 'olllmoo', '.oppllmoo', '..oppplmoo', '...oppplmoo', '....olllmmoo', '.....odddmoo', '......oooooo'])
stamp(g, 29, 22, ['.oooo', 'olllmoo', '.oppllmoo', '..oppplmoo', '...oppplmoo', '....olllmmoo', '.....odddmoo', '......oooooo'])
stamp(g, 23, 29, ['....ooooooo', '..oollllllloo', '.olhhhhllllmmo', 'olhhhhllllmmddo', 'olhhhllllmmdddo', 'olhhllllmmkkmdo', 'olhllllmkkmmllloo', 'ollllllmmddmhhhlmo', '.olllllmmddlhhhllko', '..ommmmmmmlhhhlmo', '...ommdddllhhloo', '....oorrrrooo'])
erase(g, 25, 53, 20, 8)
stamp(g, 25, 53, ['odddo..odddo', 'omddo..omddo', '.omddo.odddo', '..omddoodddo', '..odddoomddo', '.omllmmoomllmmo', '.ollllmo.ollmmmo', '.ooooooo.oooooo'])
stamp(g, 35, 44, ['omllmlhlo', '.omlllhmo', '..odmmmoo', '...ooooo'])
save('mortar-rabbit', 'hit', g)

# Dead: slumped sideways with long ears draped down-left, two legs folded
# on the ground, loosened log resting separately immediately beside hands.
g = blank()
stamp(g, 16, 41, '''
..ooooo
.olllmmoo
olppplmmoo
olpppplmmmoo
.olpppplmmmmoo
..ollppplmmmmmoo
...oollllmmmmmmmoo
.....ooooddddddddoo
.........ooooooooo
''')
stamp(g, 21, 39, ['..oooo', '.olllmoo', 'olppllmoo', '.olppllmoo', '..olppllmmoo', '...olpllllmoo', '....olllmdddoo', '.....oodddddoo', '.......oooooo'])
stamp(g, 29, 45, ['....ooooooo', '..oollllllloo', '.olhhhhllllmmo', 'olhhhhllllmmddo', 'olhhhllllmmdddo', 'olhhllllmmkkmdo', 'olhllllmkkmmllloo', 'ollllllmmddmhhhlmo', '.olllllmmddlhhhllko', '..ommmmmmmlhhhlmo', '...ommdddllhhloo', '....oorrrrooo'])
stamp(g, 22, 50, ['..omllmmdo', '.omlllmmddo', 'omllllmdddso', 'omlllmmdddso', 'omllmmdddso', '.ommmddssso', '..omddssso', '...odddoo', '..omlllmo', '..ooooooo'])
stamp(g, 29, 55, ['orrrro', 'omrrrro', 'odmrrrroo', 'odmmdddoo', 'olllllmmo', 'ooooooooo'])
stamp(g, 42, 57, ['.ooooooooooooo', 'ovtttttttttttbo', 'owbbbbbbbbbbbbo', '.ooooooooooooo'])
stamp(g, 37, 55, ['omddoo', 'ommlhlo', '.omlhmo', '..oooo'])
save('mortar-rabbit', 'dead', g)

print('Authored all 27 full native64 pose grids with explicit anatomy / tool edits.')
