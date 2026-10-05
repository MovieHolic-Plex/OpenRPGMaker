"""Poochyena body/gait template; explicitly authored snow-cat head and fur patches.
No resampling, automatic tracing or procedural anatomy. See source receipt.
"""
PALETTE = {
    5: '#e8f2ef', 6: '#a5c9db', 7: '#739dbb', 8: '#557797',
    10: '#35586a', 11: '#88bdd5', 12: '#c99cac', 13: '#557797', 15: '#35485f',
}
# Each row replaces exactly sixteen pixels at x=8, at each source head offset.
FRONT = [
    '...F........F...',
    '...F5F....F5F...',
    '..F5C57..75C5F..',
    '..F5555775555F..',
    '.F555555555555F.',
    '.F55FA5555AF55F.',
    '.F556A6556A655F.',
    '..F5555FF5555F..',
    '...F555CC555F...',
    '....F577775F....',
]
BACK = [
    '...F........F...',
    '..F55F....F55F..',
    '..F5557FF7555F..',
    '.F555555555555F.',
    '.F555555555555F.',
    '.F655555555556F.',
    '.F655555555556F.',
    '.F765555555567F.',
    '..F7655555567F..',
    '..F6765555676F..',
]
# Side view muzzle/ear changes; source's back, tail and all foot pixels remain.
SIDE_PATCHES = [
    (12, 0, 'FF'),
    (11, 1, 'F55F'),
    (10, 2, 'F55CF'),
    (10, 3, 'F55C7F'),
    (9, 4, 'F55557F'),
    (9, 5, 'F555F56F'),
    (7, 6, 'FF555F56665F'),
    (6, 7, 'FC55FA555566'),
    (6, 8, 'F555AA555755'),
    (6, 9, 'F55555557666'),
    (7, 10, 'F5555557666'),
    (8, 11, 'FFF5776666'),
]
HEAD_STARTS = {0:18, 3:17, 4:16, 1:18, 5:17, 6:16, 2:15, 7:14, 8:13}
SOURCE_MAPPING = {'down':[3,0,4], 'up':[5,1,6], 'left':[7,2,8], 'right':[7,2,8]}
