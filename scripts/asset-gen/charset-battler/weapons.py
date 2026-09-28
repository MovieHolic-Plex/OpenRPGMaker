"""Hand-pixelled equipment, with the palm pixel as its only placement anchor.

Angles for a LEFT-facing battler: 0 left, 45 upper-left, 90 up,
135 upper-right, 180 right, 225 lower-right, 270 down, 315 lower-left.
Each family has a separately authored axial and 1:1 staircase diagonal grid.
The other six grids are exact integer quarter-turn permutations, NEVER image
rotation/resampling. @ is the grip. D/M/L/H are four metal values; o/w/g wood
and brass; j/J a jewel. No image generation, tracing or antialiasing.

Use stamp(cell, kind, angle, hand) BEFORE painting the fingers over the grip.
Out-of-cell equipment raises: the caller must author a reachable arm position,
not clip, scale or silently move the weapon away from its hand.
"""
from dataclasses import dataclass

PALETTE = {
 'D':(35,43,59,255), 'M':(99,124,145,255),
 'L':(187,208,217,255), 'H':(244,249,237,255),
 'o':(68,44,39,255), 'w':(139,88,49,255), 'g':(217,169,87,255),
 'j':(42,115,139,255), 'J':(115,224,219,255), '@':(139,88,49,255),
}

# Leading spaces have meaning. Rows are padded with transparent pixels.
AXIAL = {
 'sword': '''
             g
  HLLLLLLLLLMDg
 DMMMMMMMMMMMogw@wo
  DDDDDDDDDDMDg
             g
''',
 'greatsword': '''
               g
   HLLLLLLLLLLMDg
 DMMMMMMMMMMMMMDgw@wwo
  DDDDDDDDDDDDMDg
               g
''',
 'dagger': '''
        g
 HLLLLMDg
 DMMMMMogw@wo
  DDDDDDg
        g
''',
 'staff': '''
  ooo
 ojJgo
 oJHgogwwgww@wwgwo
 ojJgoowwowwowwowo
  ooo
''',
 'mace': '''
  DLD
 DLLLMD
 HMLMLDgwgww@wo
 DLLLMDooooooo
  DLD
''',
 'spear': '''
    L
 HLLLMgwwgwwgww@wwgo
  DMMDoowwoowwoowwoo
    D
''',
 'axe': '''
  DDD
 DMLLD
 DMLHLD
  DMLLD
   ooogwwgww@wo
  DMLLDooooooo
 DMLHLD
 DMLLD
  DDD
''',
 # A narrow front half-bow; @ is in the wooden riser, string behind it.
 'bow': '''
      go
    owL
   ow L
  ow  L
 ow   L
 ow   L
 ow   L
 o@   L
 ow   L
 ow   L
 ow   L
  ow  L
   ow L
    owL
      go
''',
}
DIAGONAL = {
 'sword': '''
 H
 LMD
  LMD
   LMD
    LMD
     LMD
      LMD
       LMD g
        LMg
         gD
        g w
           @
            w
             o
''',
 'greatsword': '''
  H
 LLM
 DLMMD
  DLMMD
   DLMMD
    DLMMD
     DLMMD
      DLMMD g
       DLMgg
        DgD
        g w
           @
            w
             w
              o
''',
 'dagger': '''
 H
 LMD
  LMD
   LMD g
    LMg
     gD
    g w
       @
        o
''',
 'staff': '''
  ooo
 ojJgo
 oJHgo
 ogjgo
  ooow
     gw
      ow
       ow
        gw
         ow
          @w
           ow
            gw
             oo
''',
 'mace': '''
  DLD
 DLLLMD
 HMLMLD
 DLLLMD
  DLDw
     gw
      ow
       ow
        gw
         @w
          oo
''',
 'spear': '''
 H
 LLD
 DLM
  DMD
    gw
     ow
      ow
       gw
        ow
         ow
          gw
           @w
            ow
             go
''',
 'axe': '''
    DD
   DMLD
   MLHLD
   MLLLD
 DD wDDD
 DML gw
  MLL ow
   LH  ow
    D   gw
         @w
          oo
''',
 'bow': '''
          og
        ow L
      ow  L
    ow   L
   ow   L
  o@   L
  ow  L
  ow L
   ow
    og
''',
}

# This is the animation contract, not inferred from a noisy old blade.
POSE_ANGLES = {
 'idle':45, 'walk_a':45, 'walk_b':45, 'walk_c':45,
 'attack_windup':135, 'attack_strike':90, 'attack':0,
 'attack_follow':315, 'defend':45, 'guard_hit':45,
 'victory':90, 'victory_b':90, 'skill':45,
 'evade':315, 'hit':315, 'weak':315, 'dying':315, 'revive':45,
 'item':90, 'cast_charge':90, 'cast_raise':90, 'cast_release':45,
 'dead':0, 'front':90,
}

@dataclass(frozen=True)
class Sprite:
    rows: tuple
    grip: tuple

    def pixels(self):
        for y,row in enumerate(self.rows):
            for x,c in enumerate(row):
                if c!=' ':yield x-self.grip[0],y-self.grip[1],PALETTE[c]

    @property
    def bounds(self):
        ps=list(self.pixels())
        return min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)


def parse(grid):
    rows=grid.strip('\n').splitlines(); width=max(map(len,rows))
    rows=tuple(r.ljust(width) for r in rows)
    grips=[(x,y) for y,r in enumerate(rows) for x,c in enumerate(r) if c=='@']
    assert len(grips)==1
    return Sprite(rows,grips[0])


def quarter_turn(s):
    # Counterclockwise angles in the left-facing convention turn left to up.
    w,h=len(s.rows[0]),len(s.rows)
    rows=tuple(''.join(s.rows[h-1-x][y] for x in range(h)) for y in range(w))
    return Sprite(rows,(h-1-s.grip[1],s.grip[0]))

SPRITES={}
for kind in AXIAL:
    for angle,grid in ((0,AXIAL[kind]),(45,DIAGONAL[kind])):
        s=parse(grid)
        for turn in range(4):
            SPRITES[kind,(angle+turn*90)%360]=s
            s=quarter_turn(s)


def fitting_hand(kind,angle,hand):
    """Return the minimum arm re-pose needed for a full sprite + 1px margin."""
    x0,y0,x1,y1=SPRITES[kind,angle%360].bounds
    x,y=hand
    return max(1-x0,min(46-x1,x)),max(1-y0,min(44-y1,y))


def stamp(im,kind,angle,hand):
    sprite=SPRITES[kind,angle%360]
    points=[(hand[0]+x,hand[1]+y,c) for x,y,c in sprite.pixels()]
    assert all(0<x<47 and 0<y<=44 for x,y,c in points),(kind,angle,hand,'clipped')
    for x,y,c in points:im.putpixel((x,y),c)
    return points
