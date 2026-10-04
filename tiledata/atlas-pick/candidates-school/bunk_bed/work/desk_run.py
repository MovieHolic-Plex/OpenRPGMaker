from desk import *
# A
c = desk(32, 'vpine', [('vblue',3),('vred',2),('vgreen',3),('vyellow',2),('vblue',2)], 'vblue', ('vgreen','vyellow','viron'), ('vblue','vred'))
fin(c, 'A', 'v5 결: 소나무 책상+선반, 책 5권(파랑·빨강·초록·노랑), 초록 스탠드, 공책, 파란 방석 의자')
# B : 어둡고 대비 센 짙은 나무, 붉은 램프, 스탠드 불 밝게
c = desk(32, 'vwood', [('vred',3),('vwhite',5),('vblue',3),('vred',2),('vblack',5)], 'vred', ('vred','vyellow','vblack'), ('vgreen','vwhite'))
fin(c, 'B', '센 명암: 짙은 갈색 나무 책상, 붉은 스탠드에 노란 불빛 점, 붉은 방석 의자, 책 다섯 권 흑백 섞음')
# C : 철제 실루엣
c = desk(32, 'hinoki', [('vblue',2),('vwhite',4),('vblue',3),('vgreen',2)], 'vgreen', ('vwhite','vyellow','viron'), ('vred','vwhite'), chair_metal=True)
fin(c, 'C', '실루엣 다르게: 밝은 편백 책상, 회색 철제 의자(초록 방석), 흰 스탠드, 책 4권 파랑 계열')
