#!/usr/bin/env python3
"""Redraw forest from integer geometry: python3 -B scripts/asset-gen/pixel-scenery/forest.py."""
from lib_plains import palette, layers, rect, poly, line, leaf, trunk, fern, ground, finish

P = palette({
    'sky_top':'668b80','sky_mid':'8ca994','sky_low':'b8bfa0',
    'mist':'a1b399','far_dark':'5c8073','far':'729283','far_light':'8ca38a',
    'leaf_dark':'203f39','leaf_shadow':'335743','leaf':'507649','leaf_light':'82954f',
    'bark_dark':'303e33','bark':'665e40','bark_light':'91815a',
    'bark_far':'486957','bark_far_light':'63816a',
    'soil':'89855e','soil_light':'918d65','turf':'797d54',
    'stone_shadow':'576450','stone':'81876a','stone_light':'a4a684',
    'fern_light':'9aa462',
})


def draw():
    im = layers()
    sky,far,mid,floor = (im[k] for k in ('sky','far','mid','ground'))
    rect(sky,(0,0,319,179),P['sky_top'])
    rect(sky,(0,26,319,179),P['sky_mid'])
    rect(sky,(0,51,319,179),P['sky_low'])
    # Forest haze is palette bands; all moving-sky columns match exactly.
    for x,y,w in [(16,0,8),(52,5,6),(87,-6,7),(122,5,5),(170,-5,7),
                  (202,0,6),(242,6,8),(282,-8,9)]:
        trunk(far,x,y,83,w,[P['far_dark'],P['far'],P['far_light']])
    distant = [P['far_dark'],P['far'],P['far_light'],P['far_light']]
    for x,y in [(-14,5),(19,12),(49,-9),(79,3),(113,-14),(157,-8),
                (190,10),(228,-6),(264,6),(300,-7)]:
        leaf(far,x,y,2,distant,False)
    # Smaller distant crowns break the even scallops of the far forest row.
    for x,y in [(6,35),(57,32),(105,27),(153,33),(197,26),(249,35),(288,31)]:
        leaf(far,x,y,1,distant,False)
    # Muted understory supplies a floor to the distant trees behind the grass lip.
    for x,y in [(71,72),(98,74),(130,71),(176,73),(203,72)]:
        leaf(far,x,y,1,[P['far_dark'],P['far'],P['far_light'],P['far_light']],False)
    # The clearing is asymmetric: old oak at left, slender grouping on right.
    for x,y,w in [(40,8,10),(63,21,8),(239,13,9),(262,3,13)]:
        trunk(mid,x,y,83,w,[P['leaf_dark'],P['bark_far'],P['bark_far_light']])
    for x,y in [(-15,43),(34,50),(62,63),(223,62),(259,48),(296,52)]:
        leaf(mid,x,y,1,[P['leaf_dark'],P['leaf_shadow'],P['leaf'],P['leaf_light']])
    trunk(mid,8,-9,84,19,[P['bark_dark'],P['bark'],P['bark_light']])
    trunk(mid,294,-6,84,18,[P['bark_dark'],P['bark'],P['bark_light']])
    foliage = [P[k] for k in ('leaf_dark','leaf_shadow','leaf','leaf_light')]
    for x,y,s in [(-24,-11,2),(11,-17,2),(49,-26,2),(88,-29,2),
                  (221,-23,2),(258,-12,2),(294,-10,2),(-21,17,2),
                  (289,20,2),(20,1,1),(56,-2,1),(254,5,1)]:
        leaf(mid,x,y,s,foliage)
    for x,y in [(-5,18),(27,19),(51,9),(78,-6),(236,4),(276,14),(303,32)]:
        leaf(mid,x,y,1,foliage)
    ground(floor,P,forest=True)
    for x,y,direction in [(1,123,1),(318,145,-1),(4,172,1),(316,175,-1)]:
        fern(floor,x,y,direction,[P['leaf_dark'],P['leaf'],P['fern_light']])
    finish('forest',im,P)


if __name__ == '__main__':
    draw()
