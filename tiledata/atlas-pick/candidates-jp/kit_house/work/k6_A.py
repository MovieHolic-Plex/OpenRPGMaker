from k6_std import *
S = dict(roof='kawara', wall='washi',
  row=[2,5,4,4,3,3,3,2], col=[1,0,0,-1],
  ridge=[3,6,5,3,1], rim=[1,3,4,2], mk=[4,3,5,4,3],
  eave=[1,2,3], top=[3,4], lit=5, groove=3, base=4, corner=5, rdark=1,
  fd=[3,4,2],
  fr=[5,3,2,6,5], gl=[4,3,2,5,6], sill=[5,3], fz=[4,5], bar=2,
  rail=[6,5,3,2,4,5],
  lin=[4,3,2], post=[3,2], step=[4,3,2], pan=[3,2], rail_d=[5,3,2], fd_=None)
build(S)
export('k6-A.pxg', 'kit_house k6-A 강남 기준 결')
