#!/usr/bin/env python3
"""Redraw plains from integer geometry: python3 -B scripts/asset-gen/pixel-scenery/plains.py."""
from lib_plains import palette, layers, rect, poly, line, leaf, grass, trunk, cloud, ground, finish

P = palette({
    'sky_top':'5993b0','sky_mid':'79b4c5','sky_low':'a7cbd0',
    'cloud_shadow':'b6d0cd','cloud':'e0e3cf','cloud_light':'f6efd5',
    'mountain':'7e9c9c','mountain_light':'99b4aa','hill':'668875','hill_light':'819969',
    'leaf_dark':'334d42','leaf_shadow':'49664a','leaf':'67834d','leaf_light':'91a560',
    'bark_dark':'484b39','bark':'6e6747','bark_light':'a19260',
    'soil':'9aa56a','soil_light':'a2ac72','turf':'8b9a60',
    'stone_shadow':'777e67','stone':'9c9d7d','stone_light':'b8b593',
})


def draw():
    im = layers()
    sky, far, mid, floor = (im[k] for k in ('sky','far','mid','ground'))
    rect(sky,(0,0,319,179),P['sky_top'])
    rect(sky,(0,26,319,179),P['sky_mid'])
    rect(sky,(0,53,319,179),P['sky_low'])
    for x,y,variant in [(16,9,False),(141,6,True),(243,31,False)]:
        cloud(sky,x,y,[P['cloud_shadow'],P['cloud'],P['cloud_light']],variant)
    # Broad stepped ridges, not smooth vector curves.
    poly(far,[(0,67),(15,67),(15,64),(27,64),(27,61),(38,61),(38,58),
              (48,58),(48,54),(58,54),(58,50),(65,50),(65,47),(75,47),
              (75,51),(87,51),(87,57),(102,57),(102,60),(124,60),
              (124,63),(152,63),(152,61),(172,61),(172,57),(185,57),
              (185,53),(196,53),(196,49),(207,49),(207,46),(216,46),
              (216,51),(228,51),(228,55),(243,55),(243,60),(260,60),
              (260,64),(287,64),(287,62),(304,62),(304,66),(319,66),
              (319,89),(0,89)],P['mountain'])
    poly(far,[(8,68),(30,62),(46,60),(63,52),(68,50),(76,53),
              (65,55),(59,60),(50,63),(51,66),(39,69)],P['mountain_light'])
    poly(far,[(159,66),(184,57),(205,51),(211,48),(217,53),
              (207,55),(197,60),(181,63),(183,66)],P['mountain_light'])
    poly(far,[(0,77),(21,74),(49,72),(74,74),(106,78),(142,79),
              (179,75),(216,71),(246,70),(273,74),(298,77),(319,76),
              (319,90),(0,90)],P['hill'])
    poly(far,[(0,77),(21,74),(49,73),(73,75),(102,79),(58,77),(23,78),(0,80)],P['hill_light'])
    foliage = [P[k] for k in ('leaf_dark','leaf_shadow','leaf','leaf_light')]
    # Trees form bookends with open sky across the battlefield center.
    for x,y in [(-3,42),(291,45)]:
        trunk(mid,x+14,y+8,85,8,[P['bark_dark'],P['bark'],P['bark_light']])
        leaf(mid,x-11,y+1,1,foliage)
        leaf(mid,x+6,y-5,1,foliage)
        leaf(mid,x+16,y+8,1,foliage)
        leaf(mid,x-5,y+10,1,foliage)
    for x,y in [(41,67),(59,71),(249,70),(270,68)]:
        leaf(mid,x,y,1,[P['hill'],P['hill'],P['hill_light'],P['hill_light']],False)
    # Small branch clusters vary the bookend silhouettes.
    leaf(mid,-10,37,1,foliage)
    leaf(mid,302,48,1,foliage)
    # A broken sunlit crest supplies depth on the middle hill.
    line(far,[(174,77),(184,75),(201,74),(217,72),(241,71)],P['hill_light'])
    ground(floor,P)
    for x,y in [(0,115),(7,118),(310,131),(317,134),(18,173),(293,174)]:
        grass(floor,x,y,[P['leaf_shadow'],P['leaf_light']])
    finish('plains',im,P)


if __name__ == '__main__':
    draw()
