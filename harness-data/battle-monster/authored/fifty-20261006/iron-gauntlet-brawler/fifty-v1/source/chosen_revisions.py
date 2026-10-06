"""Explicit full-row corrections chosen after opening native/enlarged PNGs.
Values are (x, literal pixels); padding is transparency only. No propagated patches.
"""
ROWS={
# Ground move, independently redraw the boot lower edge.
'move': {
58:(9,'KHhhhhHK............KHHHHHHHHK'),
59:(9,'KHHHHHHK............KHHHHHHHHK'),
60:(10,'KKKKKKK.............KKKKKKKKK'),
},
# More readable knee and rear-leg volume at contact.
'attack': {
51:(18,'KllppppPK......KllpppppPK'),
52:(17,'KllppppPK.......KppppppPK'),
53:(16,'KllpppPPK........KpppppPK'),
54:(15,'KlppppPK..........KpppPPK'),
},
# Compress the sick posture's thighs/knees without moving its upper body.
'poison_b': {
50:(25,'KllpppPrRRrrrPPKMMMKKK'),
51:(24,'KllppppppPPPpppppppPK'),
52:(23,'KllpppppPPK.KppppppppPK'),
53:(22,'KlppppppPK...KppppppppPK'),
54:(22,'KllppppPK.....KpppppppPK'),
55:(21,'KlpppPPK.......KppppPPK'),
56:(21,'KpppPPK.........KpppPPK'),
57:(21,'KHHhHK...........KppPPK'),
58:(20,'KHhhhHHK..........KHhhHHK'),
59:(19,'KHhhHHHHK.........KHhhhHHHK'),
60:(19,'KKKKKKKKKKK.......KKKKKKKKKK'),
61:(0,'................................................................'),
62:(0,'................................................................'),
63:(0,'................................................................'),
},
'stun_a': {
52:(23,'KllppppPPK.KpppKKKKKK'),
53:(22,'KllppppPK...KpppppppPK'),
54:(22,'KlppppPK.....KppppppPK'),
55:(21,'KlpppPPK.......KppppPK'),
56:(21,'KpppPPK.........KppPPK'),
57:(21,'KHHhHK..........KHhhHHK'),
58:(20,'KHhhhHHK.........KHhhhHHK'),
59:(19,'KHhhHHHHK........KHhhhHHHK'),
60:(19,'KKKKKKKKKKK......KKKKKKKKKK'),
61:(0,'................................................................'),
},
'stun_b': {
52:(21,'KKKKKllpppPPPPKMMMMMMK'),
53:(22,'KllppppPKK.KppKKKKKK'),
54:(22,'KlppppPK....KpppppppPK'),
55:(21,'KllppPK......KppppppPK'),
56:(21,'KpppPPK........KppppPK'),
57:(21,'KHHhHK..........KppPPK'),
58:(20,'KHhhhHHK.........KHhhHHK'),
59:(19,'KHhhHHHHK........KHhhhHHHK'),
60:(19,'KKKKKKKKKKK......KKKKKKKKKK'),
61:(0,'................................................................'),
62:(0,'................................................................'),
},
# Larger upper shard, a broad short middle shard and a bent lower shard.
'skill_b': {
24:(28,'KHHHHsLssssssLsssssK.........EM'),
25:(29,'KHHsLLLLsssssssssSK......EWWM'),
26:(30,'KHSsLLLsssssssSSK......EWWWM'),
27:(31,'KSssssssssrrsSK......EWWWWM'),
28:(32,'KSSssssssSSSK.......EWWM'),
29:(33,'KSSsssssSSK.........EWWWM'),
30:(29,'KBBnnKssssSKnnK........EWWM'),
31:(27,'KBBBnBnKssSKNNnK........EWWM'),
32:(26,'KsLLKNBBnKsKnNnnK.......EWWM'),
33:(25,'KsLLLssKNBnKssNNnK......EWWM'),
34:(25,'KsLLLLssKKKKKKKKKKKKKKK.EWWM.....EM'),
35:(25,'KsLLLLLLLLLLssssSmWWWWmMWEWWWWWWWWWM'),
36:(25,'KsLLLLLLLLLLLLssSmWWWmmMWEWWWWWWWMM'),
37:(26,'KsLLLLLLLLssssssSmWWmmmMWEWEEE'),
38:(26,'KssLLLLssssssSSSSmWmmmMMWE.EWWM'),
39:(27,'KssssssssSSSSKKKKmmmmMMK...EWWWM'),
40:(28,'KSSSSSSSKKBBnnNNNKMMMMK....EWWWWM'),
41:(28,'KssKBBBnBBnnNNNNNNKKK........EWWWWM'),
42:(28,'KsSKBBBnBBnnNNNnssK...........EWWWM'),
43:(27,'KBBBnBBBnBBnnNNnssK............EWM'),
44:(26,'KBBBnBBBnnBBnnNKmWWmmK...........EM'),
45:(25,'KBBnnBBBnnBBnnNKmWWWmmMK'),
51:(21,'KllppppppPPPPppppppppPK'),
52:(20,'KllpppppPKK..KllpppppppPK'),
53:(19,'KllppppPK.....KllppppppPK'),
54:(18,'KlpppppPK......KllpppppPK'),
55:(17,'KlppppPK........KppppppPK'),
56:(16,'KllppPK..........KpppPPK'),
57:(15,'KppPPK............KppPPK'),
58:(14,'KHhhHK............KHhhHHK'),
59:(13,'KHhhhHHK...........KHhhhHHHK'),
60:(12,'KKKKKKKK............KKKKKKKKK'),
61:(0,'................................................................'),
},
# Bubble rings are drawn around chosen native centres, with real interior gaps.
'poison_a': {
12:(31,'KKKKKKKK...............EE'),
13:(28,'KHHhhhhHHHHKK.............EWWE'),
14:(27,'KHhhhhhhhhHHHHK............E..E'),
15:(26,'KHhhhHHHHHHHHHHHK...........EE'),
16:(26,'KHhHHHHHHHHHHHHHHK'),
17:(26,'KHHHHHHHHHHHHHHHHHK'),
18:(26,'KrRRRRRRRRRRRrrrrrK.........EE'),
19:(26,'KrRRRRRRrrrrrrrrrrK........EWWE'),
20:(26,'KHHSSssssssssssSK............EE'),
},
}
# Individually placed cheek/sideburn rows: a fourteen-pixel central skin face,
# with small, calm eyes left of the nose. These are per-pose decisions.
ROWS['idle_a']={
18:(23,'KHHSSsLsssssssLsSK'),
19:(23,'KHHSSsLsKKsssKsssK'),
20:(23,'KHHHHsLssssssLsssssK'),
21:(24,'KHHsLLLLsssssssssSK'),
22:(25,'KHSsLLLsssssssSSK'),
}
ROWS['idle_b']={
18:(23,'KHHSSsLsssssssLsSK'),
19:(23,'KHHSSsLsKKsssKsssK'),
20:(23,'KHHHHsLssssssLsssssK'),
21:(24,'KHHsLLLLsssssssssSK'),
22:(25,'KHSsLLLsssssssSSK'),
}
ROWS['idle_c']={
19:(23,'KHHSSsLsssssssLsSK'),
20:(23,'KHHSSsLsKKsssKsssK'),
21:(23,'KHHHHsLssssssLsssssK'),
22:(24,'KHHsLLLLsssssssssSK'),
23:(25,'KHSsLLLsssssssSSK'),
}
ROWS['windup']={
20:(21,'KHHSSsLsssssssLsSK'),
21:(21,'KHHSSsLsKKsssKsssK'),
22:(21,'KHHHHsLssssssLsssssK'),
23:(22,'KHHsLLLLsssssssssSK'),
24:(23,'KHSsLLLsssssssSSK'),
}
ROWS['move'].update({
19:(26,'KHHSSsLsssssssLsSK'),
20:(26,'KHHSSsLsKKsssKsssK'),
21:(26,'KHHHHsLssssssLsssssK'),
22:(27,'KHHsLLLLsssssssssSK'),
23:(28,'KHSsLLLsssssssSSK'),
})
ROWS['attack'].update({
19:(28,'KHHSSsLsssssssLsSK'),
20:(28,'KHHSSsLsKKsssKsssK'),
21:(28,'KHHHHsLssssssLsssssK'),
22:(29,'KHHsLLLLsssssssssSK'),
23:(30,'KHSsLLLsssssssSSK'),
})
ROWS['recover']={
19:(25,'KHHSSsLsssssssLsSK'),
20:(25,'KHHSSsLsKKsssKsssK'),
21:(25,'KHHHHsLssssssLsssssK'),
22:(26,'KHHsLLLLsssssssssSK'),
23:(27,'KHSsLLLsssssssSSK'),
}
ROWS['hit']={
19:(19,'KHHSSsLsKsssKsLsSK'),
20:(20,'KHHsssLLsssssssssK'),
21:(20,'KHHHLLLssssssLsssssK'),
22:(21,'KHHsLLLsssssssssSK'),
23:(22,'KHSsLLssssKrrsSSK'),
}
ROWS['dead']={
44:(11,'KHHSSssSSssssssK'),
45:(12,'KHHssLLsKKssKKsK'),
46:(12,'KHHHLLLsssssssssK'),
47:(13,'KHHsLLLssssssssSK..KKKKKKKK'),
}
# Recovery must keep qi on the same NEAR attacking hand. Rebuild its fold;
# the lower/right far hand stays an unlit guard. Two tiny remnants break off.
ROWS['skill_c']={
32:(21,'KsLLLLssKNBnnNNnnNK'),
33:(20,'KsLLLLsssKNBnnNKKKKKK'),
34:(20,'KsLLLssssKNBnnKmWWmmK..EW'),
35:(20,'KsLLssssSKNBnKmWWWmmMKEW'),
36:(20,'KssssssSSKKKKmWWmmmmMWE'),
37:(21,'KsssLLLLssssSmWmmmMMKE'),
38:(22,'KssssLLLLsssSmmmmMMMK.EW'),
39:(23,'KSSssssSSSSSSMMMMMMK...E'),
40:(24,'KSSSSSKBBnnNNKKKKKssK'),
41:(25,'KBBBnBBBnBBnnNNKmWWmmK'),
42:(25,'KBBBnBBBnnBBnnNKmWWWmmMK'),
43:(25,'KBBnnBBBnnBBnnNKmWWmmmmMK'),
44:(25,'KBBnnnBBnnNNNNNKmWmmmMMMK'),
45:(26,'KBBnnnnrRRRRrrrrKMMMMMMK'),
46:(26,'KNNnrrRRRRrrrrrrrKKKKK'),
}

# State-specific face/head/forearm repairs, individually selected native rows.
from state_revisions import ROWS as STATE_ROWS
for state_name, state_rows in STATE_ROWS.items():
    ROWS.setdefault(state_name, {}).update(state_rows)
