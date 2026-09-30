from closet import *
os.makedirs(ROOT + '/dorm_closet', exist_ok=True)
c = closet('vpine', 10, 'A'); doors(c, 'vpine', 10, 'A'); fin(c, 'A', 'v5 결: 소나무 붙박이장, 위칸 문+양문 가운데 틈에 남색 교복 줄, 황동 손잡이 둘, 위 1px 밝은 윗면')
c = closet('vwood', 9, 'B'); doors(c, 'vwood', 9, 'B', uni=('uniform', 2)); fin(c, 'B', '센 명암: 짙은 호두색 장, 왼쪽 테두리 밝고 오른쪽 어둡게, 교복 틈이 검게 깊다, 황동 손잡이')
c = closet('locker', 11, 'C'); doors(c, 'locker', 11, 'C', uni=('uniform', 3), hcol=('vwhite', 4)); fin(c, 'C', '실루엣 다르게: 회색 철제 붙박이장(사물함 계열), 위칸이 더 높고 흰 손잡이, 틈에 남색 교복')
