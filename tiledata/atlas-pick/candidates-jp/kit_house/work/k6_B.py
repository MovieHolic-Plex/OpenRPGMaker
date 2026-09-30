from k6_std import *
# B: 빛·그림자 강하게 — 단 폭을 넓히고, 처마 밑·창틀·기초를 깊게.
S = dict(roof='kawara', wall='washi',
  row=[1,6,5,4,3,3,2,1], col=[1,0,0,-1],
  ridge=[2,6,5,2,0], rim=[0,3,5,2], mk=[5,3,6,4,2],
  eave=[0,1,2], top=[2,3], lit=5, groove=2, base=4, corner=5, rdark=2,
  fd=[2,4,1],
  fr=[6,2,1,6,5], gl=[3,2,1,5,7], sill=[5,2], fz=[3,5], bar=1,
  rail=[7,6,3,1,4,6],
  lin=[5,3,1], post=[3,1], step=[5,3,1], pan=[3,1], rail_d=[6,3,1], fd_=None, oni_dark=True)
build(S)
export('k6-B.pxg', 'kit_house k6-B 빛·그림자 강하게')
