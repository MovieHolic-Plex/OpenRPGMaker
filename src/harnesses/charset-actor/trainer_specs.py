"""몬스터 수집 게임용 사람 걷기 칩(monster-trainer 계열) — 베이스 칩 분할 SPECS(partedit.SPECS 에 합쳐진다).

베이스는 전부 EasyRPG RTP CharSet(CC BY 4.0). 분할(얼굴 상자·상의 시작·허리·신발 줄·맨살 글자·손 칸)은
베이스마다 원본 크기 격자와 8배 그림을 눈으로 보고 정했다(partedit 와 같은 규약). 얼굴 상자 안과 맨살 글자는 고정 부위(F)다.
held 장비(손에 든 것)를 쓰는 베이스에만 hands 가 있다.
"""

_HANDS_STD = {
    'down': {'vl': [(5, 23), (6, 23), (5, 24), (6, 24)], 'vr': [(17, 23), (18, 23), (17, 24), (18, 24)]},
    'up': {'vl': [(5, 23), (6, 23), (5, 24), (6, 24)], 'vr': [(17, 23), (18, 23), (17, 24), (18, 24)]},
    'right': {'near': [(8, 23), (9, 23), (8, 24), (9, 24)]},
    'left': {'near': [(14, 23), (15, 23), (14, 24), (15, 24)]},
}

TRAINER_SPECS = {
    # 곤충채집 소년: 오렌지 머리·파란 윗옷. 흰 장갑 손(hands) — 잠자리채(held).
    'People3:2': dict(face={'down': (6, 12, 17, 17), 'right': (10, 12, 16, 17), 'left': (7, 12, 13, 17), 'up': None},
                      t_start=18, waist=23, shoe_top=29, skin='N', hands=_HANDS_STD),
    # 주인공(여): 갈색 머리 소녀. 맨팔.
    'People1:5': dict(face={'down': (7, 13, 16, 17), 'right': (11, 13, 16, 17), 'left': (7, 13, 12, 17), 'up': None},
                      t_start=18, waist=25, shoe_top=29, skin='vyr'),
    # 라이벌: 어두운 머리·회색 윗옷·붉은 띠.
    'Actor2:0': dict(face={'down': (7, 12, 16, 17), 'right': (10, 12, 17, 17), 'left': (6, 12, 13, 17), 'up': None},
                     t_start=18, waist=26, shoe_top=29, skin='qr'),
    # 등산가: 곱슬 머리·안경·녹색 윗옷.
    'People4:1': dict(face={'down': (7, 14, 16, 19), 'right': (10, 14, 16, 19), 'left': (7, 14, 13, 19), 'up': None},
                      t_start=20, waist=26, shoe_top=29, skin='wys'),
    # 낚시꾼: 남색 머리·회색 윗옷·녹색 바지. 흰 소매 손(hands) — 낚싯대(held).
    'Actor4:0': dict(face={'down': (6, 12, 17, 17), 'right': (10, 12, 17, 17), 'left': (6, 12, 13, 17), 'up': None},
                     t_start=18, waist=25, shoe_top=28, skin='yA', hands=_HANDS_STD),
    # 학생: 오렌지 머리·하늘색 윗옷·붉은 바지.
    'Actor2:1': dict(face={'down': (9, 14, 14, 17), 'right': (10, 14, 15, 17), 'left': (8, 14, 13, 17), 'up': None},
                     t_start=18, waist=23, shoe_top=29, skin='qu'),
    # 도장 관장: 검은 뾰족 머리·붉은 머리띠·붉은 윗옷.
    'People5:2': dict(face={'down': (7, 14, 16, 17), 'right': (10, 14, 16, 17), 'left': (7, 14, 13, 17), 'up': None},
                      t_start=18, waist=25, shoe_top=29, skin='pqr'),
    # 상점 직원: 금발 곱슬·하늘색 윗옷.
    'Actor4:1': dict(face={'down': (7, 12, 16, 17), 'right': (11, 12, 16, 17), 'left': (7, 12, 12, 17), 'up': None},
                     t_start=18, waist=25, shoe_top=29, skin='B'),
    # 수영 선수(2차): 윗몸이 맨살인 청록 머리 베이스 — 수영모·물안경·수영복 바지로 읽히기 쉽다. 맨살 글자 z·B(몸·팔), 팔찌는 T.
    'Actor3:5': dict(face={'down': (8, 12, 15, 17), 'right': (11, 12, 16, 17), 'left': (7, 12, 12, 17), 'up': None},
                     t_start=18, waist=25, shoe_top=29, skin='zB'),
}
