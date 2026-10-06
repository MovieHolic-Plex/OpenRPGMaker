"""Individually authored state rows, native coordinates starting at zero.
No frame transforms, coordinate propagation, geometry, or automatic filling.
The final pxgrid files contain full literal 64 by 64 canvases.
"""
ROWS = {
    'sleep_a': {
        33: (25, 'KrRRRRRRRRRrrrrHHK'),
        34: (25, 'KHHrRRRRRRRRrrrrrK'),
        35: (25, 'KHHSSsssrRRrrrrrrrK'),
        36: (26, 'KHHSSsLLssssssrrrSK'),
        37: (26, 'KHHHSsLLLLsssssssssK'),
        38: (27, 'KHHSSsLLLssssssssssK'),
        39: (28, 'KHSSsLLssssssssLsSK'),
        40: (29, 'KHSsLHsssssHsLsSK'),
        41: (30, 'KSsLLHHssssHHsLLsK'),
        42: (31, 'KSsLLLsssssssLsSK'),
        43: (32, 'KSsLLssssssSSSK'),
        44: (33, 'KSSsssssrsSSK'),
        45: (28, 'KBBnnKSSsssssSSSK'),
        46: (26, 'KBBBnBnKSSsssSSKnK'),
        47: (24, 'KsLLKNBBnKsSSKnNnK'),
        48: (23, 'KsLLLssKNBnKsSNNnK'),
    },
    'sleep_b': {
        34: (25, 'KrRRRRRRRRrrrrHHHK'),
        35: (25, 'KHHHrRRRRRRRRrrrrK'),
        36: (26, 'KHHSSssrRRRrrrrrrrK'),
        37: (26, 'KHHHSsLLssssssrrrSK'),
        38: (27, 'KHHSSsLLLLsssssssssK'),
        39: (28, 'KHHSsLLLssssssssssK'),
        40: (29, 'KHSSsLLssssssssLsSK'),
        41: (30, 'KHSsLHsssssHsLsSK'),
        42: (31, 'KSsLLHHssssHHsLLsK'),
        43: (32, 'KSsLLLsssssssLsSK'),
        44: (33, 'KSsLLssssssSSSK'),
        45: (34, 'KSSsssssrsSSK'),
        46: (29, 'KBBnnKSSssssSSSK'),
        47: (27, 'KBBBnBnKSSsssSKnK'),
        48: (24, 'KsLLKNBBnKsSSKnNnK'),
        49: (23, 'KsLLLssKNBnKsSNNnK'),
    },
    'dead': {
        34: (0, '................................................................'),
        35: (0, '................................................................'),
        36: (0, '................................................................'),
        37: (0, '................................................................'),
        38: (0, '................................................................'),
        39: (0, '................................................................'),
        40: (16, 'KKKKKKKK'),
        41: (13, 'KHHhhhhhhhHHKK'),
        42: (11, 'KHhhhhhhhhhhhHHK'),
        43: (10, 'KHhhhHHHHHHHHHHHK'),
        44: (10, 'KHhHHHHHHHHHHHHHHK'),
        45: (10, 'KHHHHHHHHHHHHHHHHHK'),
        46: (11, 'KrRRRRRRRRRrrrrHHK'),
        47: (11, 'KHHrRRRRRRRRrrrrrrK..KKKKKKKK'),
        48: (12, 'KHHSSsLssssrRRrrSKKKKNBBnnnnNNKK'),
        49: (13, 'KHHSSsLLsssssssssSKNBBnnnnnNNNnKKK'),
        50: (14, 'KHHsLLHsLsHssssSsKNBBBnnnnnnNNnKllpppKK'),
        51: (15, 'KHHsLLHHssHHssLssKNBBBnnnnNNNnnKllppppppKK'),
        52: (16, 'KHSsLLLLssssssSsSKNBBnnnnNNNNnKllppppppppPK'),
        53: (16, 'KSSssLLLssssrrsSKNBBnnnNNNNnKllppppPKppppPK'),
        54: (17, 'KSSssLLssssSSSKBBnnnNNNNnKllppppPK.ppppPK'),
        55: (18, 'KSSSSSssLLsSKrrRRRRrrrKllpppppPK..KpppPK'),
        56: (17, 'KKKKKKsssSSSKKmWWmmMKKKKppppppPPK...KHHHHK'),
        57: (15, 'KmWWWWmmmMMKssSKmWWWmmmMKpppppPPKKK...KHHhhhHHK'),
        58: (14, 'KmWWWWmmmmmMKSSSKmWWmmmmMKPPPPKKK.....KHHhhhhHHK'),
        59: (15, 'KmmmmmMMMMMMKSSSKmmmmMMMMKKKKKK.......KHHHHHHHHK'),
        60: (16, 'KKKKKKKKKKKKKKKKKMMMMMMMK.............KKKKKKKKK'),
    },
}

def apply_to_grids():
    from pathlib import Path
    root = Path(__file__).resolve().parent
    for name, chosen in ROWS.items():
        kind = 'poses' if name == 'dead' else 'actions'
        path = root / kind / (name + '.pxgrid')
        rows = path.read_text().splitlines()
        for y, (x, pixels) in chosen.items():
            if x + len(pixels) > 64:
                raise ValueError((name, x, y, 'literal exceeds row'))
            rows[y] = '.' * x + pixels + '.' * (64 - x - len(pixels))
        path.write_text('\n'.join(rows) + '\n')

if __name__ == '__main__':
    apply_to_grids()
